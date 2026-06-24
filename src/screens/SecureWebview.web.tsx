import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { sandboxForEmbed } from "../utils/embedSandbox";

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
        title="Video player"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
        // Per-provider sandbox: vidsrc-family hosts tolerate a loosened sandbox
        // (popups allowed, silent top-nav blocked); multiembed-class hosts detect
        // ANY sandbox and refuse ("Sandboxing is not allowed!"), so for those
        // sandboxForEmbed returns undefined and the attribute is omitted.
        sandbox={sandboxForEmbed(url)}
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
  // The shared player stage (videoWrapper) centers its child with
  // alignItems:center, which would shrink a raw <iframe> to its intrinsic
  // 300px default. alignSelf:stretch + width:100% override that so the iframe
  // fills the full stage width.
  container: { flex: 1, width: "100%", alignSelf: "stretch", backgroundColor: "#000" },
});
