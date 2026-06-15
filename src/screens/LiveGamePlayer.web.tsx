import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import MovieAPI from "../services/MovieAPI";

// Web implementation of LiveGamePlayer, mirroring the native two-tier flow:
//   Tier 1 — /sports/resolve extracts a direct HLS/MP4 stream → hand off to
//            NativeVideoPlayer (its .web.tsx renders a real <video> + hls.js).
//   Tier 2 — fall back to the embed page, rendered in a sandboxed <iframe>
//            (react-native-webview has no web build).

export default function LiveGamePlayerWeb({ route, navigation }: any) {
  const { link, game, stream } = route?.params ?? {};
  const [embedLink, setEmbedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerTitle = useMemo(() => {
    if (game?.homeTeam && game?.awayTeam) {
      return `${game.homeTeam} vs ${game.awayTeam}`;
    }
    return stream?.channel || game?.league || "Live stream";
  }, [game, stream]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      // Tier 1: direct stream → reuse the web <video> player.
      try {
        const resolved = await MovieAPI.getResolvedLiveStreams(link);
        const playable = resolved.filter((s) => s.type !== "magnet");
        if (!cancelled && playable.length > 0) {
          navigation.replace("NativeVideoPlayer", {
            streams: playable,
            title: playerTitle,
          });
          return;
        }
      } catch (e) {
        console.warn("Live resolve failed, falling back to embed:", e);
      }

      if (cancelled) return;

      // Tier 2: embed page → iframe.
      try {
        const data = await MovieAPI.getLiveGameEmbed(link);
        if (!cancelled) setEmbedLink(data.embedLink);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load live stream",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

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
          {playerTitle}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.stage}>
        {embedLink ? (
          <iframe
            src={embedLink}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
            style={{
              border: "0",
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
            }}
          />
        ) : (
          <View style={styles.center}>
            {error ? (
              <>
                <Text style={styles.errIcon}>📡</Text>
                <Text style={styles.errTitle}>Live stream unavailable</Text>
                <Text style={styles.errText}>{error}</Text>
                <Pressable
                  style={styles.button}
                  onPress={() => navigation?.goBack?.()}
                >
                  <Text style={styles.buttonText}>Go back</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#e50914" />
                <Text style={styles.loadingText}>Loading live stream…</Text>
              </>
            )}
          </View>
        )}
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
  stage: { flex: 1, backgroundColor: "#000" },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingText: { color: "#ccc", marginTop: 12, fontSize: 14 },
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
});
