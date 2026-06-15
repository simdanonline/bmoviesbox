import { Alert, Platform } from "react-native";

// Threshold above which we ask before queueing. Tuned so a typical efficient
// 1080p (≤2 GB) downloads silently and 4K-ish or REMUX-ish files prompt once.
const LARGE_DOWNLOAD_BYTES = 3 * 1024 ** 3;

/**
 * Resolves true when the user confirms (or the file is small enough to skip
 * the prompt). Use to gate `downloads.start()` from screens.
 *
 * Keeps small/medium downloads frictionless and only nags on the >3 GB cases
 * where the user is about to commit real storage + bandwidth.
 */
export function confirmLargeDownload(
  sizeBytes: number,
  title: string,
): Promise<boolean> {
  if (!sizeBytes || sizeBytes < LARGE_DOWNLOAD_BYTES) {
    return Promise.resolve(true);
  }
  const gb = (sizeBytes / 1024 ** 3).toFixed(1);
  // react-native-web's Alert doesn't render multi-button dialogs, so the native
  // path below would hang forever. Use the browser's confirm() instead.
  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(
            `"${title}" is ${gb} GB. It'll use this much storage and bandwidth. Download?`,
          )
        : true;
    return Promise.resolve(ok);
  }
  return new Promise((resolve) => {
    Alert.alert(
      `Download ${gb} GB?`,
      `"${title}" is a large file. It'll use this much storage and bandwidth.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Download", onPress: () => resolve(true) },
      ],
    );
  });
}
