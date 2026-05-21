import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DownloadManager,
  DownloadRecord,
  DownloadMetadata,
  DownloadPreferences,
} from "../services/DownloadManager";
import type { ResolvedStream } from "../services/MovieAPI";

interface DownloadContextValue {
  records: DownloadRecord[];
  byId: Record<string, DownloadRecord>;
  byTmdbId: Record<string, DownloadRecord[]>;
  storageUsedBytes: number;
  preferences: DownloadPreferences;
  ready: boolean;

  start: (stream: ResolvedStream, metadata: DownloadMetadata) => Promise<string>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setPreferences: (next: Partial<DownloadPreferences>) => Promise<void>;
  /** Resolve a downloaded record for a given TMDB id (movie). */
  findCompletedMovie: (tmdbId: string) => DownloadRecord | undefined;
  /** Resolve a downloaded record for a specific episode. */
  findCompletedEpisode: (
    tmdbId: string,
    season: number,
    episode: number,
  ) => DownloadRecord | undefined;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [preferences, setPreferencesState] = useState<DownloadPreferences>(
    DownloadManager.getPreferences(),
  );
  const [ready, setReady] = useState(false);

  // Hydrate from disk once, then subscribe to manager changes for the lifetime
  // of the app.
  useEffect(() => {
    let mounted = true;
    DownloadManager.init()
      .then(() => {
        if (!mounted) return;
        setRecords(DownloadManager.list());
        setPreferencesState(DownloadManager.getPreferences());
        setReady(true);
      })
      .catch((e) => {
        // If init fails (e.g. FS error creating the downloads directory) we
        // still need to flip `ready` so the UI stops waiting — downloads
        // won't work, but the rest of the app shouldn't be blocked.
        console.warn("[DownloadContext] DownloadManager.init failed:", e);
        if (!mounted) return;
        setReady(true);
      });
    const unsubscribe = DownloadManager.subscribe(() => {
      setRecords(DownloadManager.list());
      setPreferencesState(DownloadManager.getPreferences());
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const byId: Record<string, DownloadRecord> = {};
  const byTmdbId: Record<string, DownloadRecord[]> = {};
  let storageUsedBytes = 0;
  for (const r of records) {
    byId[r.id] = r;
    if (!byTmdbId[r.tmdbId]) byTmdbId[r.tmdbId] = [];
    byTmdbId[r.tmdbId].push(r);
    if (r.status === "completed") storageUsedBytes += r.sizeBytes;
  }

  const start = useCallback(
    (stream: ResolvedStream, metadata: DownloadMetadata) =>
      DownloadManager.start(stream, metadata),
    [],
  );
  const pause = useCallback((id: string) => DownloadManager.pause(id), []);
  const resume = useCallback((id: string) => DownloadManager.resume(id), []);
  const retry = useCallback((id: string) => DownloadManager.retry(id), []);
  const cancel = useCallback((id: string) => DownloadManager.cancel(id), []);
  const remove = useCallback((id: string) => DownloadManager.delete(id), []);
  const clearAll = useCallback(() => DownloadManager.clearAll(), []);
  const setPreferences = useCallback(
    (next: Partial<DownloadPreferences>) =>
      DownloadManager.setPreferences(next),
    [],
  );

  const findCompletedMovie = useCallback(
    (tmdbId: string) => {
      const list = byTmdbId[tmdbId];
      if (!list) return undefined;
      return list.find((r) => r.kind === "movie" && r.status === "completed");
    },
    [byTmdbId],
  );

  const findCompletedEpisode = useCallback(
    (tmdbId: string, season: number, episode: number) => {
      const list = byTmdbId[tmdbId];
      if (!list) return undefined;
      return list.find(
        (r) =>
          r.kind === "episode" &&
          r.season === season &&
          r.episode === episode &&
          r.status === "completed",
      );
    },
    [byTmdbId],
  );

  const value: DownloadContextValue = {
    records,
    byId,
    byTmdbId,
    storageUsedBytes,
    preferences,
    ready,
    start,
    pause,
    resume,
    retry,
    cancel,
    remove,
    clearAll,
    setPreferences,
    findCompletedMovie,
    findCompletedEpisode,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloads(): DownloadContextValue {
  const ctx = useContext(DownloadContext);
  if (!ctx) {
    throw new Error("useDownloads must be used inside <DownloadProvider>");
  }
  return ctx;
}
