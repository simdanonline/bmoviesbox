import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
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

export default function VideoPlayerScreen({
  route,
  navigation,
}: VideoPlayerScreenProps) {
  const { server, movieTitle } = route.params as {
    server: StreamingServer;
    movieTitle: string;
  };

  const [error, setError] = useState<string | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(Platform.isTV);
  const controlsVisible = true;
  const webViewRef = useRef<SecureVideoWebViewHandle>(null);

  // Remote back/menu button returns to the previous screen on TV.
  useTVBackHandler(() => navigation.goBack());

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

        {Platform.isTV && showPlayOverlay && (
          <View style={styles.tvPlayOverlay} pointerEvents="box-none">
            <Focusable
              style={styles.tvPlayButton}
              focusedStyle={styles.tvPlayButtonFocused}
              hasTVPreferredFocus
              onPress={() => {
                webViewRef.current?.injectJavaScript(
                  "(function(){try{var v=document.querySelector('video');if(v){v.play();}}catch(e){}})(); true;"
                );
                setShowPlayOverlay(false);
              }}
            >
              <Text style={styles.tvPlayButtonIcon}>▶</Text>
              <Text style={styles.tvPlayButtonLabel}>Press OK to play</Text>
            </Focusable>
          </View>
        )}

        {Platform.isTV && !showPlayOverlay && (
          <View style={styles.tvShowControlsWrap}>
            <Focusable
              style={styles.tvShowControlsButton}
              focusedStyle={styles.tvShowControlsButtonFocused}
              onPress={() => setShowPlayOverlay(true)}
            >
              <Text style={styles.tvShowControlsLabel}>Show controls</Text>
            </Focusable>
          </View>
        )}
      </View>

      <View style={styles.playerFooter}>
        <Text style={styles.serverInfo}>
          ▶️ {server.serverName || server.name} • {server.quality}
        </Text>
      </View>
    </SafeAreaView>
  );
}
