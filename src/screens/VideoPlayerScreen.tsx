import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { WebView } from "react-native-webview";
import { StreamingServer } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import AdBlockingVideoPlayer from "./AdBlockingVideoPlayer";
import { SafeAreaView } from "react-native-safe-area-context";
import SecureVideoWebView from "./SecureWebview";

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
  const webViewRef = React.useRef<WebView>(null);


  return (
    <SafeAreaView style={styles.playerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

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

      <View style={styles.videoWrapper}>

        {error && (
          <View style={styles.errorOverlay}>
            <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
              ⚠️ {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { marginTop: 15 }]}
              onPress={() => {
                setError(null);
                webViewRef.current?.reload();
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <SecureVideoWebView url={server.url} />
        {/* <AdBlockingVideoPlayer url={server.url} /> */}
      </View>

      <View style={styles.playerFooter}>
        <Text style={styles.serverInfo}>
          ▶️ {server.serverName || server.name} • {server.quality}
        </Text>
      </View>
    </SafeAreaView>
  );
}
