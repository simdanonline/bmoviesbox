import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import WebFeatureUnavailable from "../components/WebFeatureUnavailable";

// Web implementation of TrailerScreen. The native screen embeds the YouTube
// trailer in react-native-webview; on web we render a real YouTube <iframe>.

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  return (
    url.match(/\/embed\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/[?&]v=([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1] ??
    null
  );
}

export default function TrailerScreenWeb({ route, navigation }: any) {
  const videoUrl: string = route?.params?.videoUrl ?? "";
  const id = extractYouTubeId(videoUrl);

  if (!id) {
    return (
      <WebFeatureUnavailable
        navigation={navigation}
        title="Trailer unavailable"
        message="No playable trailer was found for this title."
      />
    );
  }

  const embed = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

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
        <Text style={styles.headerTitle}>Trailer</Text>
        <View style={styles.headerBtn} />
      </View>
      <View style={styles.stage}>
        <iframe
          src={embed}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          style={{
            border: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
          }}
        />
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
  },
  stage: { flex: 1, backgroundColor: "#000" },
});
