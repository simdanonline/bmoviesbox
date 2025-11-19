import React, { useRef, useState } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { width } from "../styles/styles";

export default function SecureVideoWebView({ url }: { url: string }) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  console.log("Loading video URL in secure webview:", url);
  // Include only *real ad domains*, not Google or YouTube
  const AD_DOMAINS = [
    "doubleclick.net",
    "googlesyndication.com",
    "popads.net",
    "propellerads.com",
    "adnxs.com",
    "advertising.com",
    "exponential.com",
    "adservice.google.com",
    "outbrain.com",
    "taboola.com",
    "popcash.net",
    "adcash.com",
  ];

  // Injected code (runs inside the WebView)
  const INJECT = `
    (function() {
      // Block window.open popups
      window.open = function() { return null; };

      // Remove common ad elements repeatedly
      const removeAds = () => {
        const selectors = [
          'iframe[src*="ads"]',
          'iframe[src*="ad"]',
          '[id*="ad"]',
          '[class*="ad"]',
          '#ad',
          '.ad',
          '.ads',
          '.advert',
          '[role="banner"]',
          'script[src*="ad"]',
          'script[src*="pop"]',
          'div[id*="popup"]',
          'div[class*="popup"]',
        ];
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => el.remove());
        });
      };
      setInterval(removeAds, 600);

      // Prevent new tabs, forced redirects
      const original = window.location.assign;
      window.location.assign = function(url) {
        if (!url.includes('embed') && !url.includes('video') && !url.includes('streamingnow')) {
          console.log("Blocked redirect:", url);
          return;
        }
        return original.call(window.location, url);
      };

      true;
    })();
  `;

  const handleRequest = (request: any) => {
    const { url: reqUrl } = request;

    // Block ad domains
    for (const domain of AD_DOMAINS) {
      if (reqUrl.includes(domain)) {
        console.log("Blocked ad domain:", reqUrl);
        return false;
      }
    }

    // Block completely external redirects (adult, casino, spam)
    if (
      !reqUrl.includes("embed") &&
      !reqUrl.includes("video") &&
      !reqUrl.includes("multiembed") &&
      !reqUrl.includes("nextgencloudtools") &&
      !reqUrl.includes("moviesapi") &&
      !reqUrl.includes("streamingnow") &&
      !reqUrl.includes("claithfoiter.click")
    ) {
      console.log("Blocked external redirect:", reqUrl);
      return false;
    }

    return true; // allow normal player loading
  };

  const handleRequest2 = ({ url: reqUrl }: any) => {
    console.log("REQUEST INTERCEPTED:", reqUrl);

    if (reqUrl === "about:blank") {
      return true;
    }
    // Block known advertisement domains only
    for (const domain of AD_DOMAINS) {
      if (reqUrl.includes(domain)) {
        console.log("Blocked ad domain:", reqUrl);
        return false;
      }
    }

    // Allow direct video files
    if (reqUrl.match(/\.(m3u8|mp4|ts)(\?.*)?$/)) {
      console.log("Allowed video file:", reqUrl);
      return true;
    }

    // Allow token gateways (dynamic subdomains)
    const VIDEO_GATEWAY_KEYWORDS = [
      "stream",
      "video",
      "embed",
      "play",
      "player",
      "mcloud",
      "cdn",
      "cloud",
      "moviesapi",
    ];

    if (VIDEO_GATEWAY_KEYWORDS.some((key) => reqUrl.includes(key))) {
      console.log("Allowed token gateway:", reqUrl);
      return true;
    }

    // Allow same-origin navigation
    if (reqUrl.includes("moviesapi.club")) {
      return true;
    }

    // Otherwise block
    console.log("Blocked external redirect:", reqUrl);
    return false;
  };

  return (
    <View style={styles.container}>
      {loading && Platform.OS !== "web" && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#e74c3c" />
        </View>
      )}

      {Platform.OS === "web" ? (
        <iframe
          src={url}
          style={{ width: "100vw", height: "100vh", border: "none" }}
          allow="autoplay; fullscreen"
        />
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, width: width, height: "100%" }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScriptBeforeContentLoaded={INJECT}
          onShouldStartLoadWithRequest={handleRequest2}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loader: {
    ...StyleSheet.absoluteFillObject,
    // justifyContent: "centre",
    // alignItems: "centre",
    zIndex: 10,
    backgroundColor: "#000",
  },
});
