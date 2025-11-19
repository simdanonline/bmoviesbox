import React, { useRef, useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useVideoPlayer, VideoView, VideoSource } from "expo-video";
import { height, width } from "../styles/styles";

interface VideoExtractorProps {
  url: string;
}

export default function VideoExtractor({ url }: VideoExtractorProps) {
  const webRef = useRef<WebView>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Create a video player but don’t start playback yet
  const player = useVideoPlayer(
    { uri: videoUrl ?? undefined } as VideoSource,
    (playerInstance) => {
      // Setup: when the source is set, auto-play
      if (videoUrl) {
        playerInstance.play();
      }
    }
  );

  // Inject JS into WebView to catch streaming URL
  const injectedJS = `
    (function() {
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await origFetch(...args);
        const requestUrl = args[0];
        if (typeof requestUrl === "string" && requestUrl.match(/\\.(m3u8|mp4|ts)(\\?.*)?$/)) {
          window.ReactNativeWebView.postMessage(requestUrl);
        }
        return response;
      };

      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === "string" && url.match(/\\.(m3u8|mp4|ts)(\\?.*)?$/)) {
          window.ReactNativeWebView.postMessage(url);
        }
        return origOpen.apply(this, arguments);
      };

      true;
    })();
  `;

  const onMessage = (event: any) => {
    const msg = event.nativeEvent.data;
    console.log("WebView message received:", msg);
    if (msg && !videoUrl) {
      console.log("Detected video URL:", msg);
      setVideoUrl(msg);
      webRef.current?.stopLoading();
    }
  };

  // While we don’t have a video URL yet, show a WebView + loader
  if (!videoUrl) {
    return (
      <View style={[]}>
        <ActivityIndicator size="large" color="#e74c3c" style={styles.loader} />
        <WebView
          ref={webRef}
          source={{ uri: url }}
          injectedJavaScript={injectedJS}
          onMessage={onMessage}
          style={[styles.webview, { width, height: height * 0.6 }]}
        />
      </View>
    );
  }

  // When videoUrl is available, render the native video view
  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        allowsPictureInPicture={true}
        allowsFullscreen={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loader: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -25,
    marginTop: -25,
  },
  webview: { flex: 1, opacity: 0.01 }, // nearly invisible
  video: { flex: 1 },
});
