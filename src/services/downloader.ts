import { Platform } from "react-native";
import * as BgDl from "@kesha-antonov/react-native-background-downloader";
import ReactNativeBlobUtil from "react-native-blob-util";
import * as LegacyFileSystem from "expo-file-system/legacy";
import type {
  DownloadResumable,
  FileSystemDownloadResult,
} from "expo-file-system/legacy";

// On Android we deliberately bypass @kesha-antonov/react-native-background-downloader.
// That library declares FOREGROUND_SERVICE_DATA_SYNC + ResumableDownloadService, which
// trips Play Console's foreground-service review for an app whose download feature is
// gated behind a hidden mode. Instead we run a foreground-only download via
// expo-file-system's `createDownloadResumable` — downloads pause when the app is
// backgrounded, but no FGS permission is needed and the manifest stays clean.
//
// We previously used react-native-blob-util's `fetch({path})` here, but that path
// drives the file write via OkHttp's `ResponseBody.bytes()`, which refuses to buffer
// any body whose Content-Length exceeds Integer.MAX_VALUE (~2 GiB) and throws
// "Cannot buffer entire body". blob-util swallows that, so every download ≥2 GB (i.e.
// nearly all real movie sources) failed instantly with "Download interrupted". expo's
// downloader streams straight to disk with no such limit. blob-util is still used for
// filesystem ops (mkdir/exists/stat/unlink) and to resolve the documents dir.
//
// iOS keeps the kesha lib because NSURLSession background downloads aren't an Android
// FGS concern and the iOS feature is already battle-tested in this codebase.

export type DownloadTaskState =
  | "PENDING"
  | "DOWNLOADING"
  | "PAUSED"
  | "DONE"
  | "FAILED"
  | "STOPPED";

export interface BeginHandlerParams {
  expectedBytes: number;
}
export interface ProgressHandlerParams {
  bytesDownloaded: number;
  bytesTotal: number;
}
export interface DoneHandlerParams {
  bytesDownloaded: number;
  bytesTotal: number;
}
export interface ErrorHandlerParams {
  error: string;
  errorCode: number;
}

export interface DownloadTask {
  id: string;
  state: DownloadTaskState;
  begin(handler: (p: BeginHandlerParams) => void): DownloadTask;
  progress(handler: (p: ProgressHandlerParams) => void): DownloadTask;
  done(handler: (p: DoneHandlerParams) => void): DownloadTask;
  error(handler: (p: ErrorHandlerParams) => void): DownloadTask;
  start(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateDownloadTaskParams {
  id: string;
  url: string;
  destination: string;
  headers?: Record<string, string>;
  metadata?: { tmdbId: string; title: string };
}

export interface DownloaderConfig {
  progressInterval?: number;
  isLogsEnabled?: boolean;
  logCallback?: (...args: unknown[]) => void;
  maxParallelDownloads?: number;
}

const isIOS = Platform.OS === "ios";

export const directories = {
  get documents(): string {
    if (isIOS) return BgDl.directories.documents;
    return ReactNativeBlobUtil.fs.dirs.DocumentDir;
  },
};

export function setConfig(config: DownloaderConfig): void {
  if (isIOS) {
    BgDl.setConfig(config);
    return;
  }
  androidConfig.progressInterval =
    config.progressInterval ?? androidConfig.progressInterval;
  androidConfig.logCallback = config.logCallback ?? androidConfig.logCallback;
}

export function completeHandler(jobId: string): void {
  if (isIOS) {
    BgDl.completeHandler(jobId);
  }
  // Android: no-op. blob-util doesn't use iOS background time and download
  // notifications are managed by the OS DownloadManager (which we don't use).
}

export async function getExistingDownloadTasks(): Promise<DownloadTask[]> {
  if (isIOS) {
    // The lib's DownloadTask is structurally compatible with our interface for
    // every member DownloadManager touches.
    return (await BgDl.getExistingDownloadTasks()) as unknown as DownloadTask[];
  }
  // Android: blob-util has no persistence across app launches. DownloadManager
  // already handles the "lost native task" case by marking records as failed,
  // so returning an empty list re-uses that path.
  return [];
}

export function createDownloadTask(
  params: CreateDownloadTaskParams,
): DownloadTask {
  if (isIOS) {
    return BgDl.createDownloadTask(params) as unknown as DownloadTask;
  }
  return new AndroidDownloadTask(params);
}

// ---------- Android implementation ----------

const androidConfig: {
  progressInterval: number;
  logCallback?: (...args: unknown[]) => void;
} = {
  progressInterval: 500,
};

class AndroidDownloadTask implements DownloadTask {
  id: string;
  state: DownloadTaskState = "PENDING";

  private url: string;
  /** file:// URI expo-file-system writes to. */
  private fileUri: string;
  /** Plain path (no scheme) for blob-util fs cleanup. */
  private destination: string;
  private headers?: Record<string, string>;

  private resumable: DownloadResumable | null = null;
  private beginHandler?: (p: BeginHandlerParams) => void;
  private progressHandler?: (p: ProgressHandlerParams) => void;
  private doneHandler?: (p: DoneHandlerParams) => void;
  private errorHandler?: (p: ErrorHandlerParams) => void;
  private beginFired = false;
  private lastWritten = 0;
  private lastTotal = 0;

  constructor(params: CreateDownloadTaskParams) {
    this.id = params.id;
    this.url = params.url;
    this.destination = params.destination.replace(/^file:\/\//, "");
    this.fileUri = `file://${this.destination}`;
    this.headers = params.headers;
  }

  begin(handler: (p: BeginHandlerParams) => void): DownloadTask {
    this.beginHandler = handler;
    return this;
  }
  progress(handler: (p: ProgressHandlerParams) => void): DownloadTask {
    this.progressHandler = handler;
    return this;
  }
  done(handler: (p: DoneHandlerParams) => void): DownloadTask {
    this.doneHandler = handler;
    return this;
  }
  error(handler: (p: ErrorHandlerParams) => void): DownloadTask {
    this.errorHandler = handler;
    return this;
  }

  start(): void {
    if (this.state === "DOWNLOADING" || this.state === "DONE") return;
    this.state = "DOWNLOADING";
    this.beginFired = false;
    this.lastWritten = 0;
    this.lastTotal = 0;

    androidConfig.logCallback?.("[downloader.android] start", this.id, this.url);

    this.resumable = LegacyFileSystem.createDownloadResumable(
      this.url,
      this.fileUri,
      { headers: this.headers },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) =>
        this.onProgress(totalBytesWritten, totalBytesExpectedToWrite),
    );
    this.attachResult(this.resumable.downloadAsync());
  }

  private onProgress(written: number, total: number) {
    if (this.state !== "DOWNLOADING") return;
    this.lastWritten = written;
    if (total > 0) this.lastTotal = total;
    if (!this.beginFired && total > 0) {
      this.beginFired = true;
      this.beginHandler?.({ expectedBytes: total });
    }
    this.progressHandler?.({ bytesDownloaded: written, bytesTotal: total });
  }

  /** Wire the download/resume promise to our done/error handlers. */
  private attachResult(
    promise: Promise<FileSystemDownloadResult | undefined>,
  ): void {
    promise
      .then(async (result) => {
        // Pause/cancel resolves to undefined; a stale resolution after we've
        // already moved on is ignored via the state guard.
        if (this.state !== "DOWNLOADING") return;
        if (!result) return;
        if (result.status >= 400) {
          this.state = "FAILED";
          this.resumable = null;
          await this.safeUnlink();
          this.errorHandler?.({
            error: `HTTP ${result.status}`,
            errorCode: result.status,
          });
          return;
        }
        const total = this.lastTotal > 0 ? this.lastTotal : this.lastWritten;
        this.state = "DONE";
        this.resumable = null;
        this.doneHandler?.({
          bytesDownloaded: this.lastWritten || total,
          bytesTotal: total,
        });
      })
      .catch(async (err: unknown) => {
        // Deliberate pause/stop also rejects on some paths — if we already
        // transitioned, swallow.
        if (this.state === "PAUSED" || this.state === "STOPPED") {
          return;
        }
        this.state = "FAILED";
        this.resumable = null;
        await this.safeUnlink();
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Download failed";
        this.errorHandler?.({ error: msg, errorCode: -1 });
      });
  }

  async pause(): Promise<void> {
    if (this.state !== "DOWNLOADING" || !this.resumable) return;
    // expo-file-system supports true pause/resume (preserves the byte offset),
    // so unlike the old blob-util path we keep the partial file.
    this.state = "PAUSED";
    try {
      await this.resumable.pauseAsync();
    } catch {
      /* best effort */
    }
  }

  async resume(): Promise<void> {
    if (this.state !== "PAUSED" || !this.resumable) return;
    this.state = "DOWNLOADING";
    this.attachResult(this.resumable.resumeAsync());
  }

  async stop(): Promise<void> {
    this.state = "STOPPED";
    if (this.resumable) {
      try {
        await this.resumable.cancelAsync();
      } catch {
        /* best effort */
      }
      this.resumable = null;
    }
    await this.safeUnlink();
  }

  private async safeUnlink(): Promise<void> {
    try {
      if (await ReactNativeBlobUtil.fs.exists(this.destination)) {
        await ReactNativeBlobUtil.fs.unlink(this.destination);
      }
    } catch {
      /* best effort cleanup */
    }
  }
}
