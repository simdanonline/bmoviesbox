import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { ResolvedStream } from "../services/MovieAPI";

// Web video player. The native screen uses VLC / react-native-video; on web we
// render a real HTML5 <video> element (valid here because Expo web runs on
// react-dom). Browser codec/container support is limited:
//   - MP4 (H.264/AAC) and HLS (.m3u8) play widely
//   - MKV / HEVC-x265 generally do NOT play in browsers
// So we attempt every non-magnet source in order and fall through on error,
// surfacing a clear message only if none can play.

const HLS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";

declare global {
  interface Window {
    Hls?: any;
  }
}

function isHlsStream(s: ResolvedStream): boolean {
  return s.type === "hls" || /\.m3u8(\?|$)/i.test(s.url);
}

function loadHlsEngine(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.Hls) return Promise.resolve(window.Hls);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-hls-engine]",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Hls));
      existing.addEventListener("error", () => reject(new Error("hls load")));
      return;
    }
    const script = document.createElement("script");
    script.src = HLS_CDN;
    script.async = true;
    script.setAttribute("data-hls-engine", "1");
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error("Failed to load HLS engine"));
    document.head.appendChild(script);
  });
}

export default function NativeVideoPlayerWeb({ route, navigation }: any) {
  const params = route?.params ?? {};
  const title: string = params.title ?? "Now Playing";

  // Magnets and non-network URLs (e.g. file:// downloads) can't play on web.
  // Then order by browser-decodability: MP4/HLS play widely, MKV/HEVC usually
  // don't — so try the web-playable containers first and leave MKV as a last
  // resort instead of failing on it and falling through. The incoming order is
  // already quality-ranked, and the sort is stable, so quality order is kept
  // within each tier.
  const streams: ResolvedStream[] = useMemo(
    () =>
      (params.streams ?? [])
        .filter(
          (s: ResolvedStream) =>
            s && s.type !== "magnet" && /^https?:\/\//i.test(s.url),
        )
        .sort(
          (a: ResolvedStream, b: ResolvedStream) =>
            (a.type === "mkv" ? 1 : 0) - (b.type === "mkv" ? 1 : 0),
        ),
    [params.streams],
  );

  const [index, setIndex] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const current = streams[index];

  const advanceOrFail = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < streams.length) return i + 1;
      setFatalError(
        "This title couldn't be played in your browser. The available sources " +
          "use a format (e.g. MKV / HEVC) that browsers can't play, or the host " +
          "refused the connection. Try another title, or use the iOS / Android app.",
      );
      return i;
    });
  }, [streams.length]);

  // Attach the current source to the <video> element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    setLoading(true);
    let cancelled = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsStream(current)) {
      // Safari (and iOS browsers) play HLS natively.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = current.url;
        video.play?.().catch(() => {});
      } else {
        loadHlsEngine()
          .then((Hls) => {
            if (cancelled) return;
            if (!Hls || !Hls.isSupported()) {
              video.src = current.url; // last-ditch native attempt
              return;
            }
            const hls = new Hls({ enableWorker: true });
            hlsRef.current = hls;
            hls.loadSource(current.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
              if (data?.fatal) advanceOrFail();
            });
            video.play?.().catch(() => {});
          })
          .catch(() => advanceOrFail());
      }
    } else {
      video.src = current.url;
      video.play?.().catch(() => {});
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.url]);

  const pickSource = (i: number) => {
    setShowSources(false);
    setFatalError(null);
    setIndex(i);
  };

  if (streams.length === 0) {
    return (
      <UnplayableShell
        title={title}
        navigation={navigation}
        message="No browser-playable source is available for this title. Magnet/torrent sources can only be played in the iOS or Android app."
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <Text style={styles.headerBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => setShowSources((v) => !v)}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <Text style={styles.headerBtnText}>Sources</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        {/* Raw DOM <video> — valid on web because Expo web renders via react-dom. */}
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          onCanPlay={() => setLoading(false)}
          onPlaying={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onError={advanceOrFail}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
          }}
        />

        {loading && !fatalError && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.overlayText}>
              Loading source {index + 1} of {streams.length}…
            </Text>
          </View>
        )}

        {fatalError && (
          <View style={styles.overlay}>
            <Text style={styles.errIcon}>🎬</Text>
            <Text style={styles.errTitle}>Can't play in browser</Text>
            <Text style={styles.errText}>{fatalError}</Text>
            <Pressable
              style={styles.button}
              onPress={() => navigation?.goBack?.()}
            >
              <Text style={styles.buttonText}>Go back</Text>
            </Pressable>
          </View>
        )}
      </View>

      {showSources && (
        <ScrollView style={styles.sourceList}>
          {streams.map((s, i) => (
            <Pressable
              key={`${s.url}-${i}`}
              style={[styles.sourceRow, i === index && styles.sourceRowActive]}
              onPress={() => pickSource(i)}
            >
              <Text style={styles.sourceName} numberOfLines={1}>
                {i === index ? "▶ " : ""}
                {s.name || s.source || `Source ${i + 1}`}
              </Text>
              <Text style={styles.sourceMeta}>
                {s.quality}
                {s.type ? ` · ${s.type.toUpperCase()}` : ""}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UnplayableShell({
  title,
  message,
  navigation,
}: {
  title: string;
  message: string;
  navigation?: { goBack?: () => void };
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <Text style={styles.headerBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerBtn} />
      </View>
      <View style={styles.stage}>
        <View style={styles.overlay}>
          <Text style={styles.errIcon}>🎬</Text>
          <Text style={styles.errTitle}>Playback unavailable</Text>
          <Text style={styles.errText}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    height: 52,
    backgroundColor: "#0c0c0c",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222",
  },
  headerBtn: { minWidth: 64, paddingVertical: 8 },
  headerBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  stage: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  overlayText: { color: "#ccc", marginTop: 12, fontSize: 14 },
  errIcon: { fontSize: 44, marginBottom: 14 },
  errTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  errText: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 460,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#e50914",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sourceList: {
    maxHeight: 220,
    backgroundColor: "#0c0c0c",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
  },
  sourceRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1a1a1a",
  },
  sourceRowActive: { backgroundColor: "#1a1010" },
  sourceName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  sourceMeta: { color: "#888", fontSize: 12, marginTop: 3 },
});
