import { Platform } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import type { ResolvedStream } from "../services/MovieAPI";

export interface DownloadValidationResult {
  ok: boolean;
  reason?: string;
  inspectedBytes?: number;
  warning?: string;
}

const VALIDATION_BYTES = 64 * 1024;
const MIN_VIDEO_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

const BLOCKED_TEXT_RX =
  /(file\s+(was\s+)?removed|removed\s+from\s+.*debrid|copyright\s+infringement|due\s+to\s+copyright|dmca|takedown|video\s+has\s+been\s+removed|file\s+not\s+found|access\s+denied|unexpected\s+error\s+occurred|not\s+available)/i;

const BAD_CONTENT_TYPE_RX =
  /^(text\/|application\/(json|xml|html|xhtml\+xml)|application\/vnd\.apple\.mpegurl|application\/x-mpegurl)/i;

export async function validateDownloadStream(
  stream: ResolvedStream,
): Promise<DownloadValidationResult> {
  if (stream.type === "magnet") {
    return fail("Magnet links are not direct downloadable video files.");
  }
  if (stream.type === "hls") {
    return fail("HLS streams are not safe for offline file downloads.");
  }
  if (!/^https?:\/\//i.test(stream.url)) {
    return fail("Source URL is not a downloadable network file.");
  }

  // On web the HEAD/ranged-GET preflight below is blocked by the browser's CORS
  // policy for cross-origin debrid/CDN hosts, so it would wrongly reject every
  // source. The browser's own download (which doesn't need CORS) is the real
  // test — accept any direct http(s) file here and let the browser handle it.
  if (Platform.OS === "web") {
    return { ok: true };
  }

  const baseHeaders = sanitizeHeaders(stream.headers);

  try {
    const head = await fetchWithTimeout(stream.url, {
      method: "HEAD",
      headers: baseHeaders,
    });
    if (head.ok) {
      const headCheck = validateResponseHeaders(head, stream.sizeBytes);
      if (!headCheck.ok) return headCheck;
    }
  } catch {
    // Many debrid/CDN URLs reject HEAD. The ranged GET below is authoritative.
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(stream.url, {
      method: "GET",
      headers: {
        ...baseHeaders,
        Range: `bytes=0-${VALIDATION_BYTES - 1}`,
      },
    });
  } catch {
    return fail("Could not reach this source to verify it.");
  }

  if (response.status < 200 || response.status >= 400) {
    return fail(`Source returned HTTP ${response.status}.`);
  }

  const headerCheck = validateResponseHeaders(response, stream.sizeBytes);
  if (!headerCheck.ok) return headerCheck;

  const contentLength = parseContentLength(
    response.headers.get("content-length"),
  );
  const canInspectBody =
    response.status === 206 ||
    (contentLength > 0 && contentLength <= VALIDATION_BYTES * 2);

  if (!canInspectBody) {
    return {
      ok: true,
      warning: "Source did not support ranged validation.",
    };
  }

  try {
    const buffer = await response.arrayBuffer();
    return validateVideoBytes(
      new Uint8Array(buffer),
      stream.type,
      response.headers.get("content-type"),
    );
  } catch {
    return fail("Could not inspect the beginning of this source.");
  }
}

export async function validateLocalVideoFile(
  localPath: string,
  type: ResolvedStream["type"],
  expectedBytes = 0,
): Promise<DownloadValidationResult> {
  if (type === "magnet" || type === "hls") {
    return fail("Downloaded file is not a direct video container.");
  }

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(localPath);
    if (!exists) return fail("Downloaded file is missing.");

    const stat = await ReactNativeBlobUtil.fs.stat(localPath);
    if (stat.size < MIN_VIDEO_BYTES) {
      return fail("Downloaded file is too small to be a playable video.");
    }
    if (expectedBytes > 0 && stat.size < expectedBytes * 0.9) {
      return fail("Downloaded file is incomplete.");
    }

    const tmpPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/download-validate-${Date.now()}-${Math.floor(
      Math.random() * 100_000,
    )}.bin`;

    try {
      await ReactNativeBlobUtil.fs.slice(
        localPath,
        tmpPath,
        0,
        Math.min(VALIDATION_BYTES, stat.size),
      );
      const encoded = await ReactNativeBlobUtil.fs.readFile(tmpPath, "base64");
      return validateVideoBytes(base64ToBytes(String(encoded)), type);
    } finally {
      try {
        if (await ReactNativeBlobUtil.fs.exists(tmpPath)) {
          await ReactNativeBlobUtil.fs.unlink(tmpPath);
        }
      } catch {
        /* best effort cleanup */
      }
    }
  } catch {
    return fail("Downloaded file could not be verified.");
  }
}

export function validateVideoBytes(
  bytes: Uint8Array,
  type: ResolvedStream["type"],
  contentType?: string | null,
): DownloadValidationResult {
  if (bytes.length === 0) return fail("Source returned an empty file.");

  const hasSignature =
    type === "mp4" ? hasMp4Signature(bytes) : hasMkvSignature(bytes);

  const blockedMessage = findBlockedTextMessage(bytes);
  if (blockedMessage && !hasSignature) return fail(blockedMessage);

  if (contentType && BAD_CONTENT_TYPE_RX.test(contentType) && !hasSignature) {
    return fail(`Source returned ${contentType}, not a video file.`);
  }

  if (!hasSignature) {
    return fail(
      type === "mp4"
        ? "Source did not look like an MP4 video file."
        : "Source did not look like an MKV video file.",
    );
  }

  if (blockedMessage) return fail(blockedMessage);

  return { ok: true, inspectedBytes: bytes.length };
}

function validateResponseHeaders(
  response: Response,
  expectedBytes?: number,
): DownloadValidationResult {
  const contentType = response.headers.get("content-type");
  const contentLength = parseContentLength(
    response.headers.get("content-length"),
  );
  const contentRangeTotal = parseContentRangeTotal(
    response.headers.get("content-range"),
  );
  const apparentTotal =
    response.status === 206 ? contentRangeTotal : contentLength;

  if (contentType && BAD_CONTENT_TYPE_RX.test(contentType)) {
    return fail(`Source returned ${contentType}, not a video file.`);
  }
  if (apparentTotal > 0 && apparentTotal < MIN_VIDEO_BYTES) {
    return fail("Source is too small to be a playable video.");
  }
  if (
    expectedBytes &&
    apparentTotal > 0 &&
    apparentTotal < expectedBytes * 0.5
  ) {
    return fail("Source size does not match the expected video file.");
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

function parseContentRangeTotal(value: string | null): number {
  if (!value) return 0;
  const match = value.match(/\/(\d+)$/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasMp4Signature(bytes: Uint8Array): boolean {
  for (let i = 0; i <= Math.min(bytes.length - 4, 64); i++) {
    if (
      bytes[i] === 0x66 &&
      bytes[i + 1] === 0x74 &&
      bytes[i + 2] === 0x79 &&
      bytes[i + 3] === 0x70
    ) {
      return true;
    }
  }
  return false;
}

function hasMkvSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

function findBlockedTextMessage(bytes: Uint8Array): string | null {
  const text = asciiPreview(bytes).toLowerCase();
  if (!BLOCKED_TEXT_RX.test(text)) return null;
  return "Source appears to be an error or takedown notice, not the movie.";
}

function asciiPreview(bytes: Uint8Array): string {
  let out = "";
  const limit = Math.min(bytes.length, 4096);
  for (let i = 0; i < limit; i++) {
    const b = bytes[i];
    out += b >= 32 && b <= 126 ? String.fromCharCode(b) : " ";
  }
  return out;
}

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const ch of clean) {
    if (ch === "=") break;
    const value = base64Value(ch);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(out);
}

function base64Value(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97 + 26;
  if (code >= 48 && code <= 57) return code - 48 + 52;
  if (ch === "+") return 62;
  if (ch === "/") return 63;
  return -1;
}

function fail(reason: string): DownloadValidationResult {
  return { ok: false, reason };
}
