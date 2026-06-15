import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View, StyleSheet } from "react-native";

// Web implementation of SecureWebview. The native screen uses react-native-webview
// to host embed-player pages (vidsrc / multiembed / 2embed / etc.). Those pages
// are built for browsers, so on web we render a real <iframe> — giving actual
// in-browser playback for embed sources. The <iframe> is sandboxed to block the
// popup/redirect ads these hosts are known for while still allowing their player
// scripts to run.

export interface SecureVideoWebViewHandle {
  injectJavaScript: (script: string) => void;
  reload: () => void;
  requestFocus: () => void;
}

interface SecureVideoWebViewProps {
  url: string;
  promotePlayerFrame?: boolean;
  interactive?: boolean;
}

const SecureVideoWebView = forwardRef<
  SecureVideoWebViewHandle,
  SecureVideoWebViewProps
>(({ url }, ref) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    // Cross-origin embeds can't be scripted from the parent; no-op safely.
    injectJavaScript: () => {},
    reload: () => {
      if (frameRef.current) frameRef.current.src = url;
    },
    requestFocus: () => {
      frameRef.current?.focus?.();
    },
  }));

  return (
    <View style={styles.container}>
      <iframe
        ref={frameRef}
        src={url}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
        // Allow the player's own scripts/forms but block popups and
        // top-level navigation so ad redirects can't hijack the page.
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        style={{
          border: "0",
          width: "100%",
          height: "100%",
          backgroundColor: "#000",
        }}
      />
    </View>
  );
});

SecureVideoWebView.displayName = "SecureVideoWebView";

export default SecureVideoWebView;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
