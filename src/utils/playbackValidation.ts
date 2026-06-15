import { Platform } from "react-native";
import type { ResolvedStream } from "../services/MovieAPI";
import { validateVideoBytes } from "./downloadValidation";
import {
  filterBadPlaybackSources,
  markBadPlaybackSource,
  PlaybackSourceContext,
} from "./playbackSourceHealth";

export interface PlaybackValidationResult {
  ok: boolean;
  reason?: string;
}

const VALIDATION_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_PREFLIGHT_ATTEMPTS = 5;
const MAX_HLS_PLAYLIST_BYTES = 1024 * 1024;

const BLOCKED_TEXT_RX =
  /(file\s+(was\s+)?removed|removed\s+from\s+.*debrid|copyright\s+infringement|due\s+to\s+copyright|dmca|takedown|video\s+has\s+been\s+removed|file\s+not\s+found|access\s+denied|unexpected\s+error\s+occurred|not\s+available)/i;

const BAD_PLAYBACK_CONTENT_TYPE_RX =
  /^(text\/html|application\/(json|xml|html|xhtml\+xml))/i;

export async function preparePlayableStreams(
  streams: ResolvedStream[],
  context: PlaybackSourceContext,
): Promise<ResolvedStream[]> {
  // On web, the preflight below (HEAD/ranged-GET via fetch) is blocked by the
  // browser's CORS policy for cross-origin stream hosts, so every source would
  // be wrongly rejected. But <video>/<iframe> playback itself does NOT require
  // CORS — so we skip the network preflight on web and let the web player try
  // each source in order, falling through on a real playback error.
  if (Platform.OS === "web") {
    return filterBadPlaybackSources(streams, context);
  }

  const candidates = await filterBadPlaybackSources(streams, context);
  const rejectedUrls = new Set<string>();
  const limit = Math.min(MAX_PREFLIGHT_ATTEMPTS, candidates.length);

  for (let i = 0; i < limit; i++) {
    const candidate = candidates[i];
    const validation = await validatePlaybackStream(candidate);
    if (validation.ok) {
      return [
        candidate,
        ...candidates.filter(
          (stream) =>
            stream.url !== candidate.url && !rejectedUrls.has(stream.url),
        ),
      ];
    }

    rejectedUrls.add(candidate.url);
    await markBadPlaybackSource(
      candidate,
      context,
      validation.reason ?? "Playback preflight failed",
    );
  }

  return candidates.filter((stream) => !rejectedUrls.has(stream.url));
}

export async function validatePlaybackStream(
  stream: ResolvedStream,
): Promise<PlaybackValidationResult> {
  if (stream.type === "magnet") {
    return fail("Magnet links are not directly playable.");
  }
  if (stream.url.startsWith("file://")) return { ok: true };
  if (!/^https?:\/\//i.test(stream.url)) {
    return fail("Stream URL is not a playable network URL.");
  }

  if (stream.type === "hls") return validateHlsStream(stream);
  return validateFileStream(stream);
}

async function validateHlsStream(
  stream: ResolvedStream,
): Promise<PlaybackValidationResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(stream.url, {
      method: "GET",
      headers: sanitizeHeaders(stream.headers),
    });
  } catch {
    return fail("Could not reach this HLS source.");
  }

  if (response.status < 200 || response.status >= 400) {
    return fail(`HLS source returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && BAD_PLAYBACK_CONTENT_TYPE_RX.test(contentType)) {
    return fail(`HLS source returned ${contentType}.`);
  }

  const contentLength = parseContentLength(
    response.headers.get("content-length"),
  );
  if (contentLength > MAX_HLS_PLAYLIST_BYTES) {
    return { ok: true };
  }

  try {
    const text = await response.text();
    if (BLOCKED_TEXT_RX.test(text)) {
      return fail("HLS source appears to be an error or takedown notice.");
    }
    if (!text.includes("#EXTM3U")) {
      return fail("HLS source did not return a playlist.");
    }
    return { ok: true };
  } catch {
    return fail("Could not inspect this HLS source.");
  }
}

async function validateFileStream(
  stream: ResolvedStream,
): Promise<PlaybackValidationResult> {
  const headers = sanitizeHeaders(stream.headers);

  try {
    const head = await fetchWithTimeout(stream.url, {
      method: "HEAD",
      headers,
    });
    const headCheck = validatePlaybackHeaders(head);
    if (!headCheck.ok) return headCheck;
  } catch {
    // Some CDNs reject HEAD. The ranged GET below is the real check.
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(stream.url, {
      method: "GET",
      headers: {
        ...headers,
        Range: `bytes=0-${VALIDATION_BYTES - 1}`,
      },
    });
  } catch {
    return fail("Could not reach this video source.");
  }

  const headerCheck = validatePlaybackHeaders(response);
  if (!headerCheck.ok) return headerCheck;

  const contentLength = parseContentLength(
    response.headers.get("content-length"),
  );
  const canInspectBody =
    response.status === 206 ||
    (contentLength > 0 && contentLength <= VALIDATION_BYTES * 2);

  if (!canInspectBody) return { ok: true };

  try {
    const bytes = new Uint8Array(await response.arrayBuffer());
    const validation = validateVideoBytes(
      bytes,
      stream.type,
      response.headers.get("content-type"),
    );
    return validation.ok
      ? { ok: true }
      : fail(validation.reason ?? "Video source failed preflight.");
  } catch {
    return fail("Could not inspect this video source.");
  }
}

function validatePlaybackHeaders(response: Response): PlaybackValidationResult {
  if (response.status < 200 || response.status >= 400) {
    return fail(`Video source returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && BAD_PLAYBACK_CONTENT_TYPE_RX.test(contentType)) {
    return fail(`Video source returned ${contentType}.`);
  }

  return { ok: true };
}

function sanitizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (typeof value === "string") clean[key] = value;
  }
  return clean;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseContentLength(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fail(reason: string): PlaybackValidationResult {
  return { ok: false, reason };
}
