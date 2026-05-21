import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ResolvedStream } from "../services/MovieAPI";
import type { DownloadRecord } from "../services/DownloadManager";

const BAD_SOURCE_KEY = "downloads.bad_sources.v1";
const BAD_SOURCE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES_PER_CONTEXT = 50;

export interface DownloadSourceContext {
  tmdbId: string;
  kind: "movie" | "episode";
  season?: number;
  episode?: number;
}

interface BadSourceEntry {
  fingerprints: string[];
  reason: string;
  markedAt: number;
}

type BadSourceStore = Record<string, BadSourceEntry[]>;

type SourceLike = Pick<
  ResolvedStream,
  "url" | "name" | "title" | "quality" | "type" | "source" | "sizeBytes"
>;

export async function filterBadDownloadSources(
  streams: ResolvedStream[],
  context: DownloadSourceContext,
): Promise<ResolvedStream[]> {
  const store = await loadStore();
  const badEntries = store[contextKey(context)] ?? [];
  if (badEntries.length === 0) return streams;

  const bad = new Set(badEntries.flatMap((entry) => entry.fingerprints));
  return streams.filter((stream) =>
    sourceFingerprints(stream).every((fingerprint) => !bad.has(fingerprint)),
  );
}

export async function markBadDownloadSource(
  stream: SourceLike,
  context: DownloadSourceContext,
  reason: string,
): Promise<void> {
  const key = contextKey(context);
  const store = await loadStore();
  const now = Date.now();
  const fingerprints = sourceFingerprints(stream);
  const existing = store[key] ?? [];
  const merged = [
    { fingerprints, reason, markedAt: now },
    ...existing.filter(
      (entry) =>
        !entry.fingerprints.some((fingerprint) =>
          fingerprints.includes(fingerprint),
        ),
    ),
  ].slice(0, MAX_ENTRIES_PER_CONTEXT);

  store[key] = merged;
  await AsyncStorage.setItem(BAD_SOURCE_KEY, JSON.stringify(store));
}

export async function markBadDownloadRecord(
  record: DownloadRecord,
  reason: string,
): Promise<void> {
  await markBadDownloadSource(
    {
      url: record.originalUrl,
      name: record.streamName ?? record.title,
      title: record.streamTitle ?? record.title,
      source: record.streamSource ?? "download",
      quality: record.quality,
      type: record.containerType,
      sizeBytes: record.sizeBytes,
    },
    {
      tmdbId: record.tmdbId,
      kind: record.kind,
      season: record.season,
      episode: record.episode,
    },
    reason,
  );
}

function sourceFingerprints(source: SourceLike): string[] {
  const sizeMb = source.sizeBytes
    ? Math.round(source.sizeBytes / 1024 / 1024)
    : 0;
  const stableParts = [
    source.source,
    source.name,
    source.title,
    source.quality,
    source.type,
    sizeMb,
  ]
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join("|")
    .toLowerCase();

  return [
    hashString(`stable:${stableParts}`),
    hashString(`url:${urlIdentity(source.url)}`),
  ];
}

async function loadStore(): Promise<BadSourceStore> {
  const raw = await AsyncStorage.getItem(BAD_SOURCE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as BadSourceStore;
    const cutoff = Date.now() - BAD_SOURCE_TTL_MS;
    const pruned: BadSourceStore = {};
    for (const [key, entries] of Object.entries(parsed)) {
      const fresh = entries.filter((entry) => entry.markedAt >= cutoff);
      if (fresh.length > 0) pruned[key] = fresh;
    }
    return pruned;
  } catch {
    return {};
  }
}

function contextKey(context: DownloadSourceContext): string {
  return [
    context.kind,
    context.tmdbId,
    context.season ?? "movie",
    context.episode ?? "title",
  ].join(":");
}

function urlIdentity(raw: string): string {
  const withoutQuery = raw.split(/[?#]/)[0].toLowerCase();
  const match = withoutQuery.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
  if (!match) return withoutQuery;
  return `${match[1]}${match[2] ?? ""}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
