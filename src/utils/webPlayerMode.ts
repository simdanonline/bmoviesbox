import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Web-only playback preference. The custom <video> player is fast but can't
// decode MKV/HEVC and has no subtitle UI in the browser. "embed" mode instead
// routes web playback through the legacy external-site player (vidsrc /
// multiembed / etc.) inside an <iframe>, which plays any format and brings its
// own subtitle controls. Native builds ignore this entirely.

export type WebPlayerMode = "native" | "embed";

const KEY = "web_player_mode";

// Default is "embed" on web: the external-site players handle MKV/HEVC and bring
// their own subtitle rendering, which the built-in <video> player can't. Users
// who prefer the faster direct player can switch in Settings (stored as "native").
export async function getWebPlayerMode(): Promise<WebPlayerMode> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value === "native" ? "native" : "embed";
  } catch {
    return "embed";
  }
}

export async function setWebPlayerMode(mode: WebPlayerMode): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {
    // Preference is best-effort; ignore storage failures.
  }
}

/** Reactive accessor for the Settings toggle. */
export function useWebPlayerMode(): {
  mode: WebPlayerMode;
  ready: boolean;
  setMode: (mode: WebPlayerMode) => void;
} {
  const [mode, setModeState] = useState<WebPlayerMode>("embed");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getWebPlayerMode().then((m) => {
      if (mounted) {
        setModeState(m);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: WebPlayerMode) => {
    setModeState(next);
    void setWebPlayerMode(next);
  }, []);

  return { mode, ready, setMode };
}
