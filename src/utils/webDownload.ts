import type { ResolvedStream } from "../services/MovieAPI";

// Web "download" = hand the resolved direct URL to the browser, which saves the
// file with its own download manager / progress UI. Real-debrid links serve
// `Content-Disposition: attachment`, so this downloads even cross-origin (the
// `download` attribute is ignored cross-origin, but the attachment header wins).
// Native builds never import this — downloads there go through DownloadManager.

export function buildDownloadFilename(
  title: string,
  stream: ResolvedStream,
): string {
  const ext =
    stream.type === "mkv" ? "mkv" : stream.type === "mp4" ? "mp4" : "mp4";
  const safe = (title || "video").replace(/[^\w.\- ]+/g, "").trim() || "video";
  const quality = stream.quality && stream.quality !== "unknown"
    ? `.${stream.quality}`
    : "";
  return `${safe}${quality}.${ext}`;
}

export function triggerWebDownload(
  stream: ResolvedStream,
  filename: string,
): void {
  if (typeof document === "undefined") return;
  const anchor = document.createElement("a");
  anchor.href = stream.url;
  anchor.download = filename;
  // No target="_blank": an <a download> click downloads in-place and isn't
  // popup-blocked (which matters here because validation/confirm run between the
  // user's tap and this click). Real-debrid serves Content-Disposition:
  // attachment, so the browser saves the file rather than navigating to it.
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
