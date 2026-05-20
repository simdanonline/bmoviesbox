import React, { useEffect, useRef, useState } from "react";
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
type TvPlayerCommand = "play" | "toggle" | "seekBackward" | "seekForward";

const buildTvCommandScript = (command: TvPlayerCommand) => `
(function(){
  try {
    var command = ${JSON.stringify(command)};
    if (window.__BMB_TV_CONTROL__) {
      window.__BMB_TV_CONTROL__(command);
    } else if (command === 'play' && window.__BMB_TV_PLAY__) {
      window.__BMB_TV_PLAY__();
    }
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try { frames[i].contentWindow.postMessage('__BMB_TV_COMMAND__:' + command, '*'); } catch (_) {}
    }
  } catch (_) {}
})();
true;
`;

export default function VideoPlayerScreen({
  route,
  navigation,
}: VideoPlayerScreenProps) {
  const { server, movieTitle } = route.params as {
    server: StreamingServer;
    movieTitle: string;
    servers?: StreamingServer[];
    serverIndex?: number;
  };
  const routeParams = route.params as {
    server: StreamingServer;
    movieTitle: string;
    servers?: StreamingServer[];
    serverIndex?: number;
  };
  const serverList =
    routeParams.servers && routeParams.servers.length > 0
      ? routeParams.servers
      : [server];
  const initialServerIndex =
    typeof routeParams.serverIndex === "number"
      ? routeParams.serverIndex
      : Math.max(
          0,
          serverList.findIndex((item) => item.url === server.url),
        );

  const [error, setError] = useState<string | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(Platform.isTV);
  const [currentServerIndex, setCurrentServerIndex] =
    useState(initialServerIndex);
  const [webViewInteractive, setWebViewInteractive] = useState(false);
  const controlsVisible = true;
  const webViewRef = useRef<SecureVideoWebViewHandle>(null);
  const playOverlayRef = useRef<View>(null);
  const playPauseRef = useRef<View>(null);
  const currentServer = serverList[currentServerIndex] ?? server;

  // Remote back: in WebView-interactive mode, return to native controls
  // instead of leaving the screen.
  useTVBackHandler(() => {
    if (webViewInteractive) {
      setWebViewInteractive(false);
      return;
    }
    navigation.goBack();
  });

  // On Android TV vanilla RN, hasTVPreferredFocus can be unreliable when
  // a sibling WebView claims D-pad focus. Force-request focus on the visible
  // primary control after layout so the remote lands on it.
  useEffect(() => {
    if (!Platform.isTV) return;
    const focus = () => {
      if (webViewInteractive) {
        webViewRef.current?.requestFocus();
        return;
      }
      const target = showPlayOverlay ? playOverlayRef : playPauseRef;
      (target.current as unknown as { focus?: () => void })?.focus?.();
    };
    const raf = requestAnimationFrame(focus);
    const t = setTimeout(focus, 250);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [showPlayOverlay, currentServerIndex, webViewInteractive]);

  const sendTvCommand = (command: TvPlayerCommand) => {
    webViewRef.current?.injectJavaScript(buildTvCommandScript(command));
    setShowPlayOverlay(false);
  };

  const goToNextServer = () => {
    setCurrentServerIndex((index) => (index + 1) % serverList.length);
    setShowPlayOverlay(true);
    setError(null);
  };

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

        <SecureVideoWebView
          key={currentServer.url}
          ref={webViewRef}
          url={currentServer.url}
          promotePlayerFrame
          interactive={Platform.isTV && webViewInteractive}
        />
        {controlsVisible && <VideoHintToast />}

        {Platform.isTV && showPlayOverlay && !webViewInteractive && (
          <View style={styles.tvPlayOverlay} pointerEvents="box-none">
            <Focusable
              ref={playOverlayRef}
              style={styles.tvPlayButton}
              focusedStyle={styles.tvPlayButtonFocused}
              hasTVPreferredFocus
              onPress={() => {
                setShowPlayOverlay(false);
                setWebViewInteractive(true);
              }}
            >
              <Text style={styles.tvPlayButtonIcon}>▶</Text>
              <Text style={styles.tvPlayButtonLabel}>Press OK to play</Text>
            </Focusable>
          </View>
        )}

        {Platform.isTV && webViewInteractive && (
          <View
            style={styles.tvInteractiveHint}
            pointerEvents="none"
          >
            <Text style={styles.tvInteractiveHintText}>
              Use D-pad in player • Press BACK to return to controls
            </Text>
          </View>
        )}

        {Platform.isTV && !webViewInteractive && (
          <View style={styles.tvNativeControlsWrap}>
            <Focusable
              style={styles.tvNativeControlButton}
              focusedStyle={styles.tvNativeControlButtonFocused}
              onPress={() => sendTvCommand("seekBackward")}
            >
              <Text style={styles.tvNativeControlLabel}>-15s</Text>
            </Focusable>
            <Focusable
              ref={playPauseRef}
              style={[
                styles.tvNativeControlButton,
                styles.tvNativeControlButtonPrimary,
              ]}
              focusedStyle={styles.tvNativeControlButtonFocused}
              hasTVPreferredFocus={!showPlayOverlay}
              onPress={() => sendTvCommand("toggle")}
            >
              <Text style={styles.tvNativeControlLabel}>Play/Pause</Text>
            </Focusable>
            <Focusable
              style={styles.tvNativeControlButton}
              focusedStyle={styles.tvNativeControlButtonFocused}
              onPress={() => sendTvCommand("seekForward")}
            >
              <Text style={styles.tvNativeControlLabel}>+15s</Text>
            </Focusable>
            <Focusable
              style={styles.tvNativeControlButton}
              focusedStyle={styles.tvNativeControlButtonFocused}
              onPress={() => {
                webViewRef.current?.reload();
                setShowPlayOverlay(true);
              }}
            >
              <Text style={styles.tvNativeControlLabel}>Reload</Text>
            </Focusable>
            {serverList.length > 1 && (
              <Focusable
                style={styles.tvNativeControlButton}
                focusedStyle={styles.tvNativeControlButtonFocused}
                onPress={goToNextServer}
              >
                <Text style={styles.tvNativeControlLabel}>Next Server</Text>
              </Focusable>
            )}
            <Focusable
              style={styles.tvNativeControlButton}
              focusedStyle={styles.tvNativeControlButtonFocused}
              onPress={() => {
                setShowPlayOverlay(false);
                setWebViewInteractive(true);
              }}
            >
              <Text style={styles.tvNativeControlLabel}>Use Player</Text>
            </Focusable>
          </View>
        )}
      </View>

      <View style={styles.playerFooter}>
        <Text style={styles.serverInfo}>
          ▶️ {currentServer.serverName || currentServer.name} •{" "}
          {currentServer.quality}
          {serverList.length > 1
            ? ` • Server ${currentServerIndex + 1}/${serverList.length}`
            : ""}
        </Text>
      </View>
    </SafeAreaView>
  );
}
