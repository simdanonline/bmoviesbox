import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useTVBackHandler } from "../hooks/useTVBackHandler";

type TrailerScreenProps = NativeStackScreenProps<any, "TrailerScreen">;

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const YOUTUBE_ORIGINS = [
  "https://www.youtube.com",
  "https://m.youtube.com",
  "https://youtube.com",
  "https://youtu.be",
  "https://www.youtube-nocookie.com",
  "https://*.googlevideo.com",
  "https://*.ytimg.com",
  "https://*.ggpht.com",
  "https://accounts.google.com",
];

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return embedMatch[1];
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

const TrailerScreen: React.FC<TrailerScreenProps> = ({ route, navigation }) => {
  useTVBackHandler(() => navigation.goBack());
  const { videoUrl } = route.params as { videoUrl: string };
  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  const [useFallback, setUseFallback] = useState(false);

  const onMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    if (event.nativeEvent.data === "EMBED_BLOCKED") {
      setUseFallback(true);
    }
  }, []);

  if (!videoId) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Unable to load trailer.</Text>
      </View>
    );
  }

  // Embed-restricted videos (errors 150, 152, 153, "Video unavailable") cannot
  // play inside an iframe. We detect the failure via the YouTube IFrame Player
  // API's onError event and fall back to loading the full mobile YouTube
  // watch page, which is not subject to embed restrictions.
  const embedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          html, body { margin: 0; padding: 0; background: #000; height: 100%; width: 100%; overflow: hidden; }
          #player { position: absolute; inset: 0; width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);

          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              videoId: '${videoId}',
              playerVars: {
                autoplay: 1,
                playsinline: 1,
                rel: 0,
                modestbranding: 1,
                controls: 1,
                fs: 1,
              },
              events: {
                onReady: function(e) { try { e.target.playVideo(); } catch(_) {} },
                onError: function() {
                  window.ReactNativeWebView && window.ReactNativeWebView.postMessage('EMBED_BLOCKED');
                }
              }
            });
          }

          // Backup text-based detection in case the API never loads or YouTube
          // renders the unavailable page directly.
          function textCheck() {
            var t = document.body ? document.body.innerText : '';
            if (t && /unavailable|Error\\s*15[0-9]/i.test(t)) {
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage('EMBED_BLOCKED');
            }
          }
          setTimeout(textCheck, 2500);
          setTimeout(textCheck, 5000);
        </script>
      </body>
    </html>
  `;

  if (useFallback) {
    return (
      <View style={styles.container}>
        <WebView
          originWhitelist={YOUTUBE_ORIGINS}
          source={{ uri: `https://m.youtube.com/watch?v=${videoId}` }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.center, StyleSheet.absoluteFillObject]}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          userAgent={Platform.OS === "android" ? MOBILE_UA : undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={YOUTUBE_ORIGINS}
        source={{ html: embedHtml, baseUrl: "https://www.youtube.com" }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        startInLoadingState
        onMessage={onMessage}
        renderLoading={() => (
          <View style={[styles.center, StyleSheet.absoluteFillObject]}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        userAgent={Platform.OS === "android" ? MOBILE_UA : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default TrailerScreen;
