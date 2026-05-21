import type { ResolvedStream } from "../services/MovieAPI";

const QUALITY_RANK: Record<ResolvedStream["quality"], number> = {
  "4K": 5,
  "1080p": 4,
  "720p": 3,
  "480p": 2,
  unknown: 1,
  CAM: 0,
};

// Per-tier "this is what an efficient encode looks like" target, in GB. Used
// as the pivot for the size penalty: bigger than this = bloat (REMUX, mastered
// rips), smaller = an efficient HEVC/AV1 encode (rewarded). Numbers tuned for
// ~120 min movies; series episodes will skew small and still score fine.
const SWEET_SPOT_GB: Record<ResolvedStream["quality"], number> = {
  "4K": 15,
  "1080p": 4,
  "720p": 2,
  "480p": 1,
  unknown: 4,
  CAM: 1,
};

const HEVC_RX = /\b(x265|h\.?265|hevc|av1)\b/i;
const REMUX_RX = /\b(remux|untouched|uhd-?bdrip)\b/i;
const BAD_SOURCE_TEXT_RX =
  /(file\s+(was\s+)?removed|copyright\s+infringement|removed\s+from\s+.*debrid|dmca|takedown|not\s+available|file\s+not\s+found)/i;

/**
 * Stremio addons (especially torrentio) sometimes return a placeholder MP4
 * when they can't resolve a real stream — e.g.
 *   https://torrentio.strem.fun/videos/failed_unexpected_v2.mp4
 * The file plays a "failed to fetch" message but advertises bogus quality/size
 * metadata. Letting it through to the player wastes a tap; letting it through
 * to the downloader is worse — iOS NSURLSession has crashed when re-using a
 * session that previously processed one of these.
 *
 * Match conservatively: any addon-served /videos/*.mp4 URL is suspicious
 * because real resolved streams come from CDN/RD hosts, never from the addon
 * itself.
 */
const ADDON_SENTINEL_RX =
  /\/videos\/(failed|unavailable|no[_-]?stream|error)[^/]*\.(mp4|m4v|mkv)$/i;

export function isSentinelStream(s: ResolvedStream): boolean {
  if (!s.url) return true;
  return ADDON_SENTINEL_RX.test(s.url);
}

function scoreStream(s: ResolvedStream): number {
  const text = `${s.name} ${s.title}`;
  const qRank = QUALITY_RANK[s.quality] ?? 1;
  const sweetSpot = SWEET_SPOT_GB[s.quality] ?? 4;
  const sizeGB = s.sizeBytes ? s.sizeBytes / 1024 ** 3 : 0;

  // Quality dominates — a small 480p shouldn't beat a balanced 1080p.
  let score = qRank * 100;

  if (HEVC_RX.test(text)) score += 20;
  if (REMUX_RX.test(text)) score -= 30;

  // Honeypot guard: a real 4K HDR/DV movie is ≥ 8 GB (even efficient HEVC
  // hits ~15-25 Mbps for HDR; 5 GB at 120 min is ~6 Mbps — way below the
  // floor for legitimate 4K). Fake/scam torrents masquerade as 4K with a
  // 1-7 GB payload of garbage (the "An unexpected error occurred" sentinel
  // video has been spotted at 5.2 GB). Tiered cliffs:
  //   < 5 GB  → certainly fake (-400)
  //   < 8 GB  → almost certainly fake (-200)
  if (s.quality === "4K" && sizeGB > 0) {
    if (sizeGB < 5) score -= 400;
    else if (sizeGB < 8) score -= 200;
  }

  if (sizeGB > 0) {
    if (sizeGB > sweetSpot) {
      // Penalize bloat linearly past the sweet spot.
      score -= (sizeGB - sweetSpot) * 5;
    } else {
      // Light bonus for under-sweet-spot encodes (efficient codecs).
      score += (sweetSpot - sizeGB) * 2;
    }
  } else {
    // Unknown size → small penalty so it loses to a stream with metadata.
    score -= 5;
  }

  if (s.rdCached) score += 10;

  // Tiebreaker: more seeders = healthier torrent (matters even for
  // RD-cached, since RD cache misses fall back to RD downloading on demand).
  score += Math.log10((s.seeders ?? 0) + 1);

  return score;
}

/**
 * Re-rank a list of streams to prefer the "best quality at sensible size".
 * Returns a new array sorted high-score-first; the original is untouched.
 *
 * Heuristic: quality is dominant, then a per-tier "bloat penalty" pushes
 * down REMUX-scale files in favor of efficient encodes. RD-cached and
 * HEVC/AV1 get small bonuses.
 */
export function pickBest(streams: ResolvedStream[]): ResolvedStream[] {
  return streams
    .filter((s) => !isSentinelStream(s))
    .sort((a, b) => scoreStream(b) - scoreStream(a));
}

/**
 * Re-rank for offline download. Same scoring backbone as pickBest but with
 * a downward bias: quality weight halved, size penalty doubled, magnets
 * filtered. The goal is "smallest file that's still watchable" — a 720p
 * HEVC at 1.2 GB should beat a 1080p at 6 GB and a 4K at 18 GB. Honeypot
 * guards (e.g. 4K < 8 GB) still apply.
 *
 * Magnet and HLS entries are dropped here too — the offline downloader needs
 * one direct MP4/MKV file, not a resolver link or playlist.
 */
export function pickForDownload(streams: ResolvedStream[]): ResolvedStream[] {
  return streams
    .filter(isDownloadableFileStream)
    .map((s) => ({ s, score: scoreForDownload(s) }))
    .sort((a, b) => b.score - a.score)
    .map(({ s }) => s);
}

export function isDownloadableFileStream(s: ResolvedStream): boolean {
  if (s.type !== "mp4" && s.type !== "mkv") return false;
  if (isSentinelStream(s)) return false;
  return !BAD_SOURCE_TEXT_RX.test(`${s.name} ${s.title} ${s.source}`);
}

function scoreForDownload(s: ResolvedStream): number {
  const text = `${s.name} ${s.title}`;
  const qRank = QUALITY_RANK[s.quality] ?? 1;
  const sweetSpot = SWEET_SPOT_GB[s.quality] ?? 4;
  const sizeGB = s.sizeBytes ? s.sizeBytes / 1024 ** 3 : 0;

  // Quality matters but is downweighted — a balanced 720p beats a balanced 4K
  // for download purposes (less disk, same watchable experience on a phone).
  let score = qRank * 50;

  if (HEVC_RX.test(text)) score += 30;
  if (REMUX_RX.test(text)) score -= 80;

  // Same honeypot cliffs as pickBest — never download known-bad files.
  if (s.quality === "4K" && sizeGB > 0) {
    if (sizeGB < 5) score -= 400;
    else if (sizeGB < 8) score -= 200;
  }

  if (sizeGB > 0) {
    if (sizeGB > sweetSpot) {
      // Bloat penalty doubled vs streaming: every GB above target hurts more
      // because it's storage we're physically committing.
      score -= (sizeGB - sweetSpot) * 10;
    } else {
      // Reward efficient encodes more aggressively.
      score += (sweetSpot - sizeGB) * 5;
    }
  } else {
    // No known size = risky to commit to disk; penalize harder than pickBest.
    score -= 30;
  }

  if (s.rdCached) score += 10;
  score += Math.log10((s.seeders ?? 0) + 1);

  return score;
}

/** Exposed for tests/debug. */
export const _scoreStream = scoreStream;
export const _scoreForDownload = scoreForDownload;
