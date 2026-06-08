import ReactNativeBlobUtil from "react-native-blob-util";
import {
  createDownloadTask,
  getExistingDownloadTasks,
  completeHandler,
  directories,
  setConfig as setDownloaderConfig,
  type DownloadTask,
} from "./downloader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
import MovieAPI from "./MovieAPI";
import type { ResolvedStream } from "./MovieAPI";
import { pickForDownload } from "../utils/streamRanking";
import { getOriginalLanguage } from "./tmdb";
import { notifyDownloadComplete } from "./NotificationService";
import { validateLocalVideoFile } from "../utils/downloadValidation";
import {
  filterBadDownloadSources,
  markBadDownloadRecord,
} from "../utils/downloadSourceHealth";

const MANIFEST_KEY = "downloads.manifest.v1";
const PREFS_KEY = "downloads.prefs.v1";
// Files live in the library's documents dir so background-downloader can
// write directly. We still use blob-util for fs operations (mkdir/exists/
// unlink) — the downloader doesn't expose those.
//
// We resolve the path inside init() rather than at module-load time. The
// `directories.documents` getter triggers TurboModule lookup; doing that at
// import time can crash the JS bridge before it's ready (especially on iOS
// new arch). Lazy lookup keeps module import side-effect-free.
let ROOT_DIR = "";

export interface DownloadPreferences {
  /** 0 = unlimited. Otherwise hard cap in bytes. */
  maxStorageBytes: number;
  /** Refuse + pause when on cellular. */
  wifiOnly: boolean;
  /** When cap is hit at start, delete oldest watched-completed records
   * until the new download fits. Opt-in to avoid surprising data loss. */
  autoEvictWatched: boolean;
  /** Max parallel downloads. iOS NSURLSession honors this natively; on
   * Android the system schedules independently of this hint. */
  maxParallel: number;
}

const DEFAULT_PREFS: DownloadPreferences = {
  maxStorageBytes: 0,
  wifiOnly: true,
  autoEvictWatched: false,
  maxParallel: 2,
};

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface DownloadMetadata {
  tmdbId: string;
  title: string;
  kind: "movie" | "episode";
  season?: number;
  episode?: number;
  thumbnail: string;
}

export interface DownloadRecord {
  id: string;
  tmdbId: string;
  title: string;
  kind: "movie" | "episode";
  season?: number;
  episode?: number;
  thumbnail: string;
  originalUrl: string;
  fileUri: string;
  sizeBytes: number;
  bytesDownloaded: number;
  quality: ResolvedStream["quality"];
  containerType: ResolvedStream["type"];
  streamName?: string;
  streamTitle?: string;
  streamSource?: string;
  headers?: Record<string, string>;
  status: DownloadStatus;
  downloadedAt?: number;
  lastPlayedAt?: number;
  watchProgressMs?: number;
  errorMessage?: string;
  /** Wall-clock ms when the manager auto-paused this download (e.g. cellular
   * drop). Distinguishes system-paused from user-paused so we know which to
   * auto-resume when Wi-Fi returns. */
  autoPausedAt?: number;
}

type ChangeListener = () => void;

export class DownloadStartError extends Error {
  constructor(
    public reason:
      | "storage_cap"
      | "wifi_required"
      | "no_sources"
      | "already_active"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "DownloadStartError";
  }
}

/**
 * Singleton manager that delegates to a platform-specific downloader (see
 * `./downloader`). On iOS the backing implementation is the kesha
 * react-native-background-downloader library (NSURLSession background
 * downloads, native pause/resume, re-attach across launches). On Android
 * we use react-native-blob-util — downloads run only while the app is in
 * the foreground, pause = cancel-and-restart-on-resume, and no foreground
 * service permission is needed.
 *
 * Records (title/tmdbId/thumbnail/etc.) live in AsyncStorage. iOS task
 * state survives app restart and is re-synced on init; Android starts with
 * no in-flight tasks and any "downloading"/"paused" records left from the
 * previous session are marked failed (the same path used when iOS loses
 * its native tasks after a force-quit).
 */
class DownloadManagerImpl {
  private records = new Map<string, DownloadRecord>();
  private tasks = new Map<string, DownloadTask>();
  private listeners = new Set<ChangeListener>();
  private initPromise: Promise<void> | null = null;
  private prefs: DownloadPreferences = { ...DEFAULT_PREFS };
  private netUnsubscribe: (() => void) | null = null;

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit() {
    // Resolve the documents dir here (not at module load) so the TurboModule
    // lookup happens after the bridge is ready. Wrap in try/catch so a missing
    // native module surfaces as a logged warning instead of a hard crash that
    // takes down DownloadProvider.
    try {
      ROOT_DIR = `${directories.documents}/downloads`;
    } catch (e) {
      console.warn(
        "[DownloadManager] native module not linked — downloads disabled:",
        e,
      );
      return;
    }

    const exists = await ReactNativeBlobUtil.fs.exists(ROOT_DIR);
    if (!exists) await ReactNativeBlobUtil.fs.mkdir(ROOT_DIR);

    const prefsRaw = await AsyncStorage.getItem(PREFS_KEY);
    if (prefsRaw) {
      try {
        this.prefs = { ...DEFAULT_PREFS, ...JSON.parse(prefsRaw) };
      } catch (e) {
        console.warn("[DownloadManager] prefs parse failed:", e);
      }
    }

    // Lower native progress event frequency so the JS bridge isn't flooded
    // when several downloads run concurrently. Native logs are forwarded to
    // Metro so iOS NSURLSession failures surface instead of crashing silently.
    //
    // IMPORTANT (iOS): we deliberately do NOT pass `maxParallelDownloads`
    // here. The library's `_setMaxParallelDownloadsInternal` invalidates the
    // background NSURLSession and immediately recreates one with the *same*
    // bundle identifier — iOS doesn't fully tear the previous session down
    // in time, so the new session inherits the invalidated state. Any
    // subsequent `downloadTaskWithRequest:` crashes with EXC_BAD_ACCESS
    // ("attempted to create NSURLSessionDownloadTask in a session that has
    // been invalidated"). Since `init` already calls `lazyRegisterSession`,
    // `urlSession` is never nil when we'd call setMaxParallelDownloads, so
    // the bug fires every launch. Letting the lib use its default avoids it.
    setDownloaderConfig({
      progressInterval: 500,
      isLogsEnabled: true,
      logCallback: (...args: unknown[]) =>
        console.log("[RNBackgroundDownloader]", ...args),
    });

    const raw = await AsyncStorage.getItem(MANIFEST_KEY);
    if (raw) {
      try {
        const parsed: DownloadRecord[] = JSON.parse(raw);
        for (const r of parsed) this.records.set(r.id, r);
      } catch (e) {
        console.warn("[DownloadManager] manifest parse failed:", e);
      }
    }

    // Verify that completed records still have their file on disk. iOS Files
    // app or "Free Up Space" could have evicted them; if missing, mark failed
    // so the user gets a Retry instead of a silently broken "Play Offline".
    for (const r of this.records.values()) {
      if (r.status !== "completed") continue;
      const localPath = r.fileUri.replace(/^file:\/\//, "");
      try {
        const fileExists = await ReactNativeBlobUtil.fs.exists(localPath);
        if (!fileExists) {
          r.status = "failed";
          r.errorMessage = "File removed by system";
          r.bytesDownloaded = 0;
        }
      } catch {
        /* best effort — leave record as-is on fs check failure */
      }
    }

    // Re-attach: native side preserved in-flight + paused tasks across app
    // restart. Wire up our handlers to them and sync record state with the
    // native task state.
    try {
      const existing = await getExistingDownloadTasks();
      const seenIds = new Set<string>();
      for (const task of existing) {
        seenIds.add(task.id);
        const record = this.records.get(task.id);
        if (!record) {
          // Stray native task with no matching record — let it run; we'll
          // pick it up next time the user creates a matching record. Most
          // likely from a previous install or a manual call.
          continue;
        }
        record.status = task.state === "PAUSED" ? "paused" : "downloading";
        this.attachHandlers(record, task);
        this.tasks.set(record.id, task);
      }
      // Records that thought they were downloading/paused but have no native
      // task → native state was lost. On iOS this is almost always the user
      // force-quitting from the App Switcher; NSURLSession cancels every
      // background task in that case and Apple doesn't expose resume data,
      // so there's no recovery path. On Android we don't persist tasks at all
      // (blob-util is foreground-only), so every record in this state on
      // launch is expected.
      const platformHint =
        Platform.OS === "ios"
          ? "App was force-quit — iOS can't preserve background downloads through that"
          : "Downloads don't continue after the app is closed on Android";
      for (const r of this.records.values()) {
        if (
          (r.status === "downloading" || r.status === "paused") &&
          !seenIds.has(r.id)
        ) {
          r.status = "failed";
          r.errorMessage = platformHint;
        }
      }
      void this.persist();
    } catch (e) {
      console.warn("[DownloadManager] re-attach failed:", e);
    }

    // Wi-Fi enforcement: pause running downloads on cellular drop, resume
    // when Wi-Fi returns. Only records auto-paused by this listener are
    // auto-resumed — user-paused ones stay paused.
    this.netUnsubscribe = NetInfo.addEventListener((state) => {
      if (!this.prefs.wifiOnly) return;
      const onWifi = state.type === "wifi" && state.isConnected === true;
      if (onWifi) {
        // Wi-Fi back — resume any record we auto-paused. Native pause/resume
        // preserves the byte offset, so this is a true continuation.
        for (const r of this.records.values()) {
          if (r.status !== "paused" || !r.autoPausedAt) continue;
          void this.resumeAuto(r.id);
        }
      } else {
        for (const [id, task] of this.tasks) {
          const r = this.records.get(id);
          if (!r || r.status !== "downloading") continue;
          void task.pause().then(() => {
            r.status = "paused";
            r.errorMessage = "Paused: cellular network";
            r.autoPausedAt = Date.now();
            this.persist();
            this.emit();
          });
        }
      }
    });
  }

  /** Internal: resume a download that was auto-paused by the network watcher.
   * Distinct from public `resume()` so we can clear the auto-paused marker. */
  private async resumeAuto(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    const task = this.tasks.get(id);
    try {
      if (task) {
        await task.resume();
      } else {
        // Re-attach must have failed earlier — spawn a fresh task.
        this.spawnTask(record, /* allowRefresh */ true);
      }
      record.status = "downloading";
      record.errorMessage = undefined;
      record.autoPausedAt = undefined;
      void this.persist();
      this.emit();
    } catch (e) {
      console.warn("[DownloadManager] auto-resume failed:", e);
    }
  }

  list(): DownloadRecord[] {
    return Array.from(this.records.values()).sort((a, b) => {
      const aActive =
        a.status === "downloading" || a.status === "paused" ? 1 : 0;
      const bActive =
        b.status === "downloading" || b.status === "paused" ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0);
    });
  }

  get(id: string): DownloadRecord | undefined {
    return this.records.get(id);
  }

  idFor(url: string): string {
    return hashUrl(url);
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) {
      try {
        l();
      } catch (e) {
        console.warn("[DownloadManager] listener threw:", e);
      }
    }
  }

  private async persist() {
    const arr = Array.from(this.records.values());
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(arr));
  }

  async start(
    stream: ResolvedStream,
    metadata: DownloadMetadata,
  ): Promise<string> {
    await this.init();

    if (!ROOT_DIR) {
      throw new DownloadStartError(
        "unknown",
        "Downloader native module isn't available in this build. Rebuild after installing @kesha-antonov/react-native-background-downloader.",
      );
    }

    const id = this.idFor(stream.url);
    const existing = this.records.get(id);
    if (existing?.status === "completed") return id;
    if (existing?.status === "downloading") {
      throw new DownloadStartError(
        "already_active",
        "This download is already in progress.",
      );
    }
    if (existing?.status === "paused") {
      // Paused → resume rather than starting fresh.
      await this.resume(id);
      return id;
    }

    // Storage cap — try auto-evict if enabled, then check again.
    if (this.prefs.maxStorageBytes > 0 && stream.sizeBytes) {
      let projected = this.storageUsed() + stream.sizeBytes;
      if (
        projected > this.prefs.maxStorageBytes &&
        this.prefs.autoEvictWatched
      ) {
        await this.evictWatchedToFit(projected - this.prefs.maxStorageBytes);
        projected = this.storageUsed() + stream.sizeBytes;
      }
      if (projected > this.prefs.maxStorageBytes) {
        throw new DownloadStartError(
          "storage_cap",
          `Would use ${formatGb(projected)} of your ${formatGb(this.prefs.maxStorageBytes)} cap. Delete some downloads first or enable auto-evict.`,
        );
      }
    }

    if (this.prefs.wifiOnly) {
      const net = await NetInfo.fetch();
      if (net.type !== "wifi" || !net.isConnected) {
        throw new DownloadStartError(
          "wifi_required",
          "Downloads are limited to Wi-Fi. Connect to Wi-Fi or disable the setting.",
        );
      }
    }

    const ext = extFor(stream);
    const localPath = `${ROOT_DIR}/${id}.${ext}`;
    const fileUri = `file://${localPath}`;

    if (await ReactNativeBlobUtil.fs.exists(localPath)) {
      await ReactNativeBlobUtil.fs.unlink(localPath);
    }

    const record: DownloadRecord = {
      id,
      tmdbId: metadata.tmdbId,
      title: metadata.title,
      kind: metadata.kind,
      season: metadata.season,
      episode: metadata.episode,
      thumbnail: metadata.thumbnail,
      originalUrl: stream.url,
      fileUri,
      sizeBytes: stream.sizeBytes ?? 0,
      bytesDownloaded: 0,
      quality: stream.quality,
      containerType: stream.type,
      streamName: stream.name,
      streamTitle: stream.title,
      streamSource: stream.source,
      headers: stream.headers,
      status: "downloading",
    };
    this.records.set(id, record);
    void this.persist();
    this.emit();

    try {
      this.spawnTask(record, /* allowRefresh */ true);
    } catch (e) {
      // spawnTask is sync — a throw here is almost always either a missing
      // native module or invalid URL/destination. Roll the record back so the
      // UI shows a clean "failed" state and re-throw as a typed error the
      // screen can format into an Alert.
      record.status = "failed";
      record.errorMessage =
        e instanceof Error ? e.message : "Failed to start download";
      void this.persist();
      this.emit();
      throw new DownloadStartError("unknown", record.errorMessage);
    }
    return id;
  }

  /**
   * Create + start a native download task for the given record and attach
   * progress/done/error callbacks.
   */
  private spawnTask(record: DownloadRecord, allowRefresh: boolean) {
    const localPath = record.fileUri.replace(/^file:\/\//, "");
    // Sanitize headers: NSURLSession on iOS hard-crashes if a header value is
    // null/undefined/non-string. The library filters its own internal nulls,
    // but RD-returned headers can include them from the addon pass-through.
    const cleanHeaders = sanitizeHeaders(record.headers);
    console.log("[DownloadManager] spawnTask", {
      id: record.id,
      url: record.originalUrl,
      destination: localPath,
      headerKeys: cleanHeaders ? Object.keys(cleanHeaders) : null,
    });
    const task = createDownloadTask({
      id: record.id,
      url: record.originalUrl,
      destination: localPath,
      headers: cleanHeaders,
      metadata: { tmdbId: record.tmdbId, title: record.title },
    });
    this.tasks.set(record.id, task);
    this.attachHandlers(record, task, allowRefresh);
    task.begin(({ expectedBytes }) => {
      if (expectedBytes > 0 && record.sizeBytes !== expectedBytes) {
        record.sizeBytes = expectedBytes;
        this.emit();
      }
    });
    task.start();
  }

  /**
   * Wire progress / done / error callbacks for a task. Used both for fresh
   * downloads (after spawnTask) and re-attached ones (after app restart).
   */
  private attachHandlers(
    record: DownloadRecord,
    task: DownloadTask,
    allowRefresh = false,
  ) {
    task.progress(({ bytesDownloaded, bytesTotal }) => {
      const cur = this.records.get(record.id);
      if (!cur || cur.status === "completed") return;
      cur.bytesDownloaded = bytesDownloaded;
      if (bytesTotal > 0 && cur.sizeBytes !== bytesTotal) {
        cur.sizeBytes = bytesTotal;
      }
      this.emit();
    });

    task.done(({ bytesDownloaded, bytesTotal }) => {
      void this.handleTaskDone(record, bytesDownloaded, bytesTotal);
    });

    task.error(({ error, errorCode }) => {
      const cur = this.records.get(record.id);
      if (!cur) return;
      this.tasks.delete(record.id);
      console.warn(
        `[DownloadManager] task ${record.id} error: ${error} (code ${errorCode})`,
      );
      // RD URL expiry typically surfaces as HTTP 4xx via errorCode. Try one
      // refresh + restart.
      if (allowRefresh && isLikelyExpiryCode(errorCode)) {
        void this.refreshAndRetry(record);
        return;
      }
      cur.status = "failed";
      cur.errorMessage = error ?? `Error ${errorCode ?? "unknown"}`;
      void this.persist();
      this.emit();
    });
  }

  private async handleTaskDone(
    record: DownloadRecord,
    bytesDownloaded: number,
    bytesTotal: number,
  ) {
    const cur = this.records.get(record.id);
    if (!cur) return;

    this.tasks.delete(record.id);
    // Required: releases iOS background time + removes Android notification.
    completeHandler(record.id);

    cur.bytesDownloaded = bytesDownloaded;
    if (bytesTotal > 0) cur.sizeBytes = bytesTotal;

    const localPath = cur.fileUri.replace(/^file:\/\//, "");
    const validation = await validateLocalVideoFile(
      localPath,
      cur.containerType,
      cur.sizeBytes,
    );
    if (!validation.ok) {
      try {
        if (await ReactNativeBlobUtil.fs.exists(localPath)) {
          await ReactNativeBlobUtil.fs.unlink(localPath);
        }
      } catch (e) {
        console.warn("[DownloadManager] invalid file cleanup failed:", e);
      }
      cur.status = "failed";
      cur.errorMessage =
        validation.reason ?? "Downloaded file was not a playable video.";
      cur.bytesDownloaded = 0;
      try {
        await markBadDownloadRecord(cur, cur.errorMessage);
      } catch (e) {
        console.warn("[DownloadManager] bad-source mark failed:", e);
      }
      void this.persist();
      this.emit();
      return;
    }

    cur.status = "completed";
    cur.downloadedAt = Date.now();
    cur.errorMessage = undefined;
    void this.persist();
    this.emit();
    // iOS-only local notification. Android already shows a system one via
    // DownloadManager, so the helper short-circuits there.
    void notifyDownloadComplete(
      cur.title,
      cur.kind === "episode" ? `S${cur.season}E${cur.episode}` : undefined,
    );
  }

  private async refreshAndRetry(record: DownloadRecord) {
    const refreshed = await this.refreshUrl(record);
    if (!refreshed) {
      record.status = "failed";
      record.errorMessage = "Couldn't refresh expired stream URL";
      void this.persist();
      this.emit();
      return;
    }
    record.originalUrl = refreshed.url;
    record.headers = refreshed.headers;
    record.status = "downloading";
    record.errorMessage = undefined;
    void this.persist();
    this.emit();
    this.spawnTask(record, /* allowRefresh */ false);
  }

  private async refreshUrl(
    record: DownloadRecord,
  ): Promise<{ url: string; headers?: Record<string, string> } | null> {
    try {
      const resolved = await MovieAPI.getResolvedStreams(
        record.kind === "episode" ? "series" : "movie",
        { tmdbId: record.tmdbId },
        record.season,
        record.episode,
      );
      const originalLanguage = await getOriginalLanguage(
        record.tmdbId,
        record.kind === "episode" ? "series" : "movie",
      );
      const ranked = await filterBadDownloadSources(
        pickForDownload(resolved, originalLanguage),
        {
          tmdbId: record.tmdbId,
          kind: record.kind,
          season: record.season,
          episode: record.episode,
        },
      );
      if (ranked.length === 0) return null;
      let pick = ranked[0];
      if (record.sizeBytes > 0) {
        const tol = record.sizeBytes * 0.15;
        const close = ranked.find(
          (s) =>
            s.sizeBytes &&
            Math.abs(s.sizeBytes - record.sizeBytes) <= tol &&
            s.quality === record.quality,
        );
        if (close) pick = close;
      }
      return { url: pick.url, headers: pick.headers };
    } catch (e) {
      console.warn("[DownloadManager] refreshUrl failed:", e);
      return null;
    }
  }

  async pause(id: string): Promise<void> {
    const record = this.records.get(id);
    const task = this.tasks.get(id);
    if (!record || !task) return;
    if (record.status !== "downloading") return;
    await task.pause();
    record.status = "paused";
    // Manual pause overrides any prior auto-pause marker so the Wi-Fi watcher
    // won't auto-resume a user-paused download when the network changes.
    record.autoPausedAt = undefined;
    record.errorMessage = undefined;
    void this.persist();
    this.emit();
  }

  async resume(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.status !== "paused") return;
    const task = this.tasks.get(id);
    if (task) {
      await task.resume();
      record.status = "downloading";
      record.errorMessage = undefined;
      record.autoPausedAt = undefined;
      void this.persist();
      this.emit();
      return;
    }
    // No live task (e.g. failed re-attach) — spawn a fresh one. Native side
    // won't resume from partial in this case; we'll start over.
    record.status = "downloading";
    record.errorMessage = undefined;
    record.autoPausedAt = undefined;
    void this.persist();
    this.emit();
    this.spawnTask(record, /* allowRefresh */ true);
  }

  async cancel(id: string): Promise<void> {
    await this.cancelInternal(id);
  }

  private async cancelInternal(id: string, message?: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.status === "completed") return;
    const task = this.tasks.get(id);
    if (task) {
      try {
        await task.stop();
      } catch (e) {
        console.warn("[DownloadManager] task.stop threw:", e);
      }
    }
    this.tasks.delete(id);
    record.status = "cancelled";
    record.autoPausedAt = undefined;
    if (message) record.errorMessage = message;
    // Best-effort cleanup — a transient FS error must not block state updates,
    // otherwise the record would stay stuck in "downloading" in the UI.
    try {
      const localPath = record.fileUri.replace(/^file:\/\//, "");
      if (await ReactNativeBlobUtil.fs.exists(localPath)) {
        await ReactNativeBlobUtil.fs.unlink(localPath);
      }
    } catch (e) {
      console.warn("[DownloadManager] partial-file cleanup failed:", e);
    }
    record.bytesDownloaded = 0;
    void this.persist();
    this.emit();
  }

  /**
   * Retry a failed (or previously cancelled) download. Re-resolves the stream
   * URL from the backend before spawning a fresh task — the old URL has
   * almost certainly expired by the time the user gets around to retrying.
   *
   * Preserves the record id (and therefore metadata) so it doesn't create a
   * duplicate entry in the Library.
   */
  async retry(id: string): Promise<void> {
    await this.init();
    const record = this.records.get(id);
    if (!record) return;
    if (record.status === "downloading" || record.status === "paused") return;

    // Same wifi/cap gate as start() — retrying a 20 GB file off Wi-Fi or
    // over cap shouldn't sneak past the user's preferences.
    if (this.prefs.wifiOnly) {
      const net = await NetInfo.fetch();
      if (net.type !== "wifi" || !net.isConnected) {
        throw new DownloadStartError(
          "wifi_required",
          "Downloads are limited to Wi-Fi. Connect to Wi-Fi or disable the setting.",
        );
      }
    }
    if (this.prefs.maxStorageBytes > 0 && record.sizeBytes > 0) {
      let projected = this.storageUsed() + record.sizeBytes;
      if (
        projected > this.prefs.maxStorageBytes &&
        this.prefs.autoEvictWatched
      ) {
        await this.evictWatchedToFit(projected - this.prefs.maxStorageBytes);
        projected = this.storageUsed() + record.sizeBytes;
      }
      if (projected > this.prefs.maxStorageBytes) {
        throw new DownloadStartError(
          "storage_cap",
          `Would use ${formatGb(projected)} of your ${formatGb(this.prefs.maxStorageBytes)} cap.`,
        );
      }
    }

    const refreshed = await this.refreshUrl(record);
    if (!refreshed) {
      throw new DownloadStartError(
        "no_sources",
        "Couldn't find a fresh stream URL — try again later.",
      );
    }
    record.originalUrl = refreshed.url;
    record.headers = refreshed.headers;
    record.status = "downloading";
    record.errorMessage = undefined;
    record.bytesDownloaded = 0;
    void this.persist();
    this.emit();
    // We just refreshed, so don't allow another refresh on first failure —
    // genuine errors should surface, not loop.
    this.spawnTask(record, /* allowRefresh */ false);
  }

  async delete(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.status === "downloading" || record.status === "paused") {
      await this.cancel(id);
    }
    const localPath = record.fileUri.replace(/^file:\/\//, "");
    if (await ReactNativeBlobUtil.fs.exists(localPath)) {
      await ReactNativeBlobUtil.fs.unlink(localPath);
    }
    this.records.delete(id);
    void this.persist();
    this.emit();
  }

  async setWatchProgress(id: string, positionMs: number): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    record.watchProgressMs = positionMs;
    record.lastPlayedAt = Date.now();
    void this.persist();
    this.emit();
  }

  storageUsed(): number {
    let total = 0;
    for (const r of this.records.values()) {
      if (r.status === "completed") total += r.sizeBytes;
    }
    return total;
  }

  getPreferences(): DownloadPreferences {
    return { ...this.prefs };
  }

  async setPreferences(next: Partial<DownloadPreferences>): Promise<void> {
    this.prefs = { ...this.prefs, ...next };
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    // Push concurrent-cap changes to the native side immediately. Other prefs
    // are read on next start()/cellular event.
    //
    // iOS: skip the native push entirely — see the doInit comment for why.
    // setMaxParallelDownloads invalidates and recreates the background
    // NSURLSession with the same identifier, which iOS rejects on the next
    // task creation (EXC_BAD_ACCESS). The pref is still saved to AsyncStorage
    // and will take effect on the next launch, when init can pass it before
    // any download has been kicked off.
    if (next.maxParallel !== undefined && Platform.OS !== "ios") {
      setDownloaderConfig({ maxParallelDownloads: this.prefs.maxParallel });
    }
    this.emit();
  }

  async clearAll(): Promise<void> {
    const ids = Array.from(this.records.keys());
    for (const id of ids) await this.delete(id);
  }

  /**
   * Delete completed downloads (oldest-watched first, then never-watched
   * oldest-downloaded) until at least `bytesNeeded` of headroom is freed.
   * Returns the number of bytes actually reclaimed.
   */
  private async evictWatchedToFit(bytesNeeded: number): Promise<number> {
    const candidates = Array.from(this.records.values())
      .filter((r) => r.status === "completed")
      .sort((a, b) => {
        // Prefer evicting items the user has actually opened (watched).
        const aWatched = a.lastPlayedAt ? 1 : 0;
        const bWatched = b.lastPlayedAt ? 1 : 0;
        if (aWatched !== bWatched) return bWatched - aWatched;
        // Within each bucket, oldest first (lastPlayedAt for watched,
        // downloadedAt for unwatched).
        const aTs = a.lastPlayedAt ?? a.downloadedAt ?? 0;
        const bTs = b.lastPlayedAt ?? b.downloadedAt ?? 0;
        return aTs - bTs;
      });

    let freed = 0;
    for (const r of candidates) {
      if (freed >= bytesNeeded) break;
      freed += r.sizeBytes;
      await this.delete(r.id);
    }
    return freed;
  }
}

/**
 * Drop null/undefined/non-string header values. NSURLSession + the lib's
 * cxxbridge marshalling crash on null entries — the JSI cast (NSDictionary*)
 * accepts the dict but `setValue:forHTTPHeaderField:` fails the value-type
 * assertion, taking the app down with a SIGABRT. Filtering here makes the
 * downloader resilient to whatever the addon happened to set.
 */
function sanitizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string" && v.length > 0) cleaned[k] = v;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function extFor(stream: ResolvedStream): string {
  if (stream.type === "mkv") return "mkv";
  if (stream.type === "hls") return "mp4";
  if (stream.type === "mp4") return "mp4";
  return "bin";
}

function hashUrl(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h + url.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * iOS NSURLSession surfaces HTTP failures via NSURLErrorDomain (-1011 ish for
 * unsupported URL, but most cleanly via the `errorCode` for HTTP 4xx). Android
 * passes through HTTP status as the errorCode. Either way: 4xx in [400, 500)
 * is the expiry signature for RD links.
 */
function isLikelyExpiryCode(errorCode: number | undefined | null): boolean {
  if (errorCode == null) return false;
  if (
    errorCode === 401 ||
    errorCode === 403 ||
    errorCode === 404 ||
    errorCode === 410
  ) {
    return true;
  }
  return false;
}

function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export const DownloadManager = new DownloadManagerImpl();
export type { DownloadManagerImpl };
