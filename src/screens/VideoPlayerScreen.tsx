import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
  TVEventHandler,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StreamingServer } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import { SafeAreaView } from "react-native-safe-area-context";
import SecureVideoWebView, {
  SecureVideoWebViewHandle,
} from "./SecureWebview";
import VideoHintToast from "../components/VideoHintToast";
import Focusable from "../components/Focusable";
import { useTVBackHandler } from "../hooks/useTVBackHandler";

type VideoPlayerScreenProps = NativeStackScreenProps<any, "VideoPlayer">;

// JS snippets dispatched to the embedded WebView <video> element so the
// Google TV D-pad can drive playback even though we don't own a native player.
const TOGGLE_PLAY_PAUSE_JS = `
(function() {
  try {
    var v = document.querySelector('video');
    if (!v) return true;
    if (v.paused) { v.play(); } else { v.pause(); }
  } catch (_) {}
  true;
})();
`;

const seekJs = (deltaSeconds: number) => `
(function() {
  try {
    var v = document.querySelector('video');
    if (!v || !isFinite(v.duration)) return true;
    var next = Math.max(0, Math.min(v.duration, v.currentTime + (${deltaSeconds})));
    v.currentTime = next;
  } catch (_) {}
  true;
})();
`;

export default function VideoPlayerScreen({
  route,
  navigation,
}: VideoPlayerScreenProps) {
  const { server, movieTitle } = route.params as {
    server: StreamingServer;
    movieTitle: string;
  };

  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const webViewRef = useRef<SecureVideoWebViewHandle>(null);

  // Remote back/menu button returns to the previous screen on TV.
  useTVBackHandler(() => navigation.goBack());

  // D-pad handling for Google TV. Touch devices skip this entirely.
  useEffect(() => {
    if (!Platform.isTV) return;
    const handler = new TVEventHandler();
    handler.enable(null, (_cmp, evt: { eventType?: string }) => {
      switch (evt?.eventType) {
        case "select":
          webViewRef.current?.injectJavaScript(TOGGLE_PLAY_PAUSE_JS);
          break;
        case "right":
          webViewRef.current?.injectJavaScript(seekJs(10));
          break;
        case "left":
          webViewRef.current?.injectJavaScript(seekJs(-10));
          break;
        case "up":
        case "down":
          setControlsVisible(true);
          break;
      }
    });
    return () => handler.disable();
  }, []);

  return (
    <SafeAreaView style={styles.playerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Option A: hide touch header controls on TV — the remote back button
          (via useTVBackHandler) replaces the on-screen back affordance. */}
      {!Platform.isTV && (
        <View style={styles.playerHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.playerTitle} numberOfLines={1}>
            {movieTitle}
          </Text>
          <View style={{ width: 60 }} />
        </View>
      )}

      <View style={styles.videoWrapper}>
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
              ⚠️ {error}
            </Text>
            {Platform.isTV ? (
              <Focusable
                style={[styles.retryButton, { marginTop: 15 }]}
                hasTVPreferredFocus
                onPress={() => {
                  setError(null);
                  webViewRef.current?.reload();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </Focusable>
            ) : (
              <TouchableOpacity
                style={[styles.retryButton, { marginTop: 15 }]}
                onPress={() => {
                  setError(null);
                  webViewRef.current?.reload();
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <SecureVideoWebView ref={webViewRef} url={server.url} />
        {controlsVisible && <VideoHintToast />}
      </View>

      <View style={styles.playerFooter}>
        <Text style={styles.serverInfo}>
          ▶️ {server.serverName || server.name} • {server.quality}
        </Text>
      </View>
    </SafeAreaView>
  );
}
