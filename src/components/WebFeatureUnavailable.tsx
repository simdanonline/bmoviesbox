import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface WebFeatureUnavailableProps {
  title?: string;
  message?: string;
  // Navigation screens pass this; child components may omit it.
  navigation?: { goBack?: () => void } | null;
}

/**
 * Placeholder rendered on the web build for features that depend on native-only
 * modules (VLC / react-native-video playback, react-native-webview embeds,
 * background downloads). The web bundle resolves the `*.web.tsx` sibling of each
 * such screen to this component so the app shell renders instead of crashing
 * with `__fbBatchedBridgeConfig is not set`. Native builds keep the real screens.
 */
export default function WebFeatureUnavailable({
  title = "Not available on web",
  message = "This feature relies on native playback and isn't supported in the web version. Please use the iOS or Android app.",
  navigation,
}: WebFeatureUnavailableProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎬</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {navigation?.goBack && (
        <Pressable
          style={styles.button}
          onPress={() => navigation.goBack && navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go back</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    color: "#aaa",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 420,
  },
  button: {
    marginTop: 28,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#e50914",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
