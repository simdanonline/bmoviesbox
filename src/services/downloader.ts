import { Platform } from "react-native";
import * as BgDl from "@kesha-antonov/react-native-background-downloader";
import ReactNativeBlobUtil from "react-native-blob-util";
import type {
  StatefulPromise,
  FetchBlobResponse,
} from "react-native-blob-util";

// On Android we deliberately bypass @kesha-antonov/react-native-background-downloader.
// That library declares FOREGROUND_SERVICE_DATA_SYNC + ResumableDownloadService, which
// trips Play Console's foreground-service review for an app whose download feature is
// gated behind a hidden mode. Instead we run a foreground-only download via
// react-native-blob-util — downloads pause when the app is backgrounded, but no FGS
// permission is needed and the manifest stays clean.
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
  private destination: string;
  private headers?: Record<string, string>;

  private fetchTask: StatefulPromise<FetchBlobResponse> | null = null;
  private beginHandler?: (p: BeginHandlerParams) => void;
  private progressHandler?: (p: ProgressHandlerParams) => void;
  private doneHandler?: (p: DoneHandlerParams) => void;
  private errorHandler?: (p: ErrorHandlerParams) => void;
  private beginFired = false;
  private lastBytesTotal = 0;

  constructor(params: CreateDownloadTaskParams) {
    this.id = params.id;
    this.url = params.url;
    this.destination = params.destination.replace(/^file:\/\//, "");
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
    this.lastBytesTotal = 0;
    this.spawnFetch();
  }

  private spawnFetch() {
    const log = androidConfig.logCallback;
    log?.("[downloader.android] start", this.id, this.url);

    const fetchTask = ReactNativeBlobUtil.config({
      fileCache: false,
      path: this.destination,
      // overwrite is the default for `path` — keep partial files out of
      // the way before resume(), which deletes them first.
    }).fetch("GET", this.url, this.headers);

    this.fetchTask = fetchTask;

    fetchTask.progress(
      { interval: androidConfig.progressInterval },
      (received, total) => {
        if (this.state !== "DOWNLOADING") return;
        const r = Number(received);
        const t = Number(total);
        if (!this.beginFired && t > 0) {
          this.beginFired = true;
          this.beginHandler?.({ expectedBytes: t });
        }
        if (t > 0) this.lastBytesTotal = t;
        this.progressHandler?.({ bytesDownloaded: r, bytesTotal: t });
      },
    );

    fetchTask
      .then(async (res) => {
        // Pause/stop cancels the fetch — blob-util rejects in that case, so
        // resolution here means a network completion (success OR HTTP error).
        if (this.state !== "DOWNLOADING") return;
        const status = res.info().status;
        if (status >= 400) {
          this.state = "FAILED";
          this.fetchTask = null;
          // Clean up the partial file so retry doesn't see a half-written
          // body that passes existence checks.
          await this.safeUnlink();
          this.errorHandler?.({ error: `HTTP ${status}`, errorCode: status });
          return;
        }
        let size = this.lastBytesTotal;
        try {
          const stat = await ReactNativeBlobUtil.fs.stat(this.destination);
          size = Number(stat.size) || size;
        } catch {
          /* stat failure is non-fatal; use last reported total */
        }
        this.state = "DONE";
        this.fetchTask = null;
        this.doneHandler?.({
          bytesDownloaded: size,
          bytesTotal: size,
        });
      })
      .catch(async (err: unknown) => {
        // A cancelled task throws here too. If we cancelled deliberately the
        // state is already PAUSED/STOPPED and we just swallow.
        if (this.state === "PAUSED" || this.state === "STOPPED") {
          this.fetchTask = null;
          return;
        }
        this.state = "FAILED";
        this.fetchTask = null;
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
    if (this.state !== "DOWNLOADING") return;
    // blob-util has no native pause/resume. Cancel the in-flight fetch and
    // delete the partial file so resume() starts fresh — restarting from
    // byte 0 is a regression vs the iOS lib, but it's the trade-off for
    // removing FOREGROUND_SERVICE_DATA_SYNC.
    this.state = "PAUSED";
    if (this.fetchTask) {
      try {
        this.fetchTask.cancel();
      } catch {
        /* best effort */
      }
      this.fetchTask = null;
    }
    await this.safeUnlink();
  }

  async resume(): Promise<void> {
    if (this.state !== "PAUSED") return;
    this.state = "PENDING";
    this.start();
  }

  async stop(): Promise<void> {
    this.state = "STOPPED";
    if (this.fetchTask) {
      try {
        this.fetchTask.cancel();
      } catch {
        /* best effort */
      }
      this.fetchTask = null;
    }
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
