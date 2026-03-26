import React, { useRef, useState, useCallback } from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { width } from "../styles/styles";

// WHITELIST: Only these domains are allowed
const ALLOWED_DOMAINS = [
  // Video streaming - add more as you discover them
  "multiembed.mov",
  "streamingnow.mov",
  "moviesapi.club",
  "vidsrc.to",
  "vidsrc.me",
  "vidsrc.cc",
  "vidsrc.xyz",
  "2embed.cc",
  "2embed.to",
  "autoembed.cc",
  "vidora.stream",
  "moviesapi.to",
  "cloudnestra.com",
  // CDNs
  "cloudflare.com",
  "cloudflare-dns.com",
  "cdnjs.cloudflare.com",
  "jsdelivr.net",
  "unpkg.com",
  "akamaized.net",
  "akamai.net",
  "akamaihd.net",
  "fastly.net",
  "cloudfront.net",
  "edgecast.net",
  "stackpath.com",
  "bootstrapcdn.com",
  // Google (only for fonts/APIs, not ads)
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  // Video players
  "jwpcdn.com",
  "jwplayer.com",
  "videojs.com",
  "vimeocdn.com",
  "vidcdn.pro",
  "plyr.io",
  "mux.com",
  "bitmovin.com",
  "hlsjs.video-cdn.net",
  // HLS/Video specific
  "m3u8",
];

// Quick check patterns for video files
const VIDEO_FILE_PATTERNS = /\.(m3u8|mp4|ts|webm|mkv|mov|mpd|m4s|key)(\?|#|$)/i;

// Ad blocker script
const AD_BLOCK_SCRIPT = `
(function() {
  'use strict';
  
  // ========== BLOCK ALL POPUPS/REDIRECTS ==========
  
  window.open = () => null;
  
  try {
    Object.defineProperty(window, 'open', {
      value: () => null,
      writable: false,
      configurable: false
    });
  } catch(e) {}
  
  // Block all location changes
  const allowedHosts = ['multiembed.mov', 'streamingnow.mov'];
  
  const originalAssign = window.location.assign.bind(window.location);
  const originalReplace = window.location.replace.bind(window.location);
  
  function isAllowedUrl(url) {
    if (!url) return false;
    try {
      const host = new URL(url, window.location.href).hostname;
      return allowedHosts.some(h => host.includes(h));
    } catch(e) {
      return false;
    }
  }
  
  window.location.assign = function(url) {
    if (!isAllowedUrl(url)) {
      console.log('[AdBlock] Blocked redirect:', url);
      return;
    }
    return originalAssign(url);
  };
  
  window.location.replace = function(url) {
    if (!isAllowedUrl(url)) {
      console.log('[AdBlock] Blocked redirect:', url);
      return;
    }
    return originalReplace(url);
  };
  
  // ========== REMOVE CLICK HIJACKERS ==========
  
  function removeOverlays() {
    // Remove invisible overlays
    document.querySelectorAll('div, a, span, aside').forEach(el => {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex) || 0;
      const position = style.position;
      
      if ((position === 'fixed' || position === 'absolute') && zIndex > 50) {
        const rect = el.getBoundingClientRect();
        const opacity = parseFloat(style.opacity);
        const bg = style.backgroundColor;
        
        // Large transparent/invisible overlay = click hijacker
        if (rect.width > 100 && rect.height > 100) {
          const isTransparent = opacity < 0.1 || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
          const isNotPlayer = !el.querySelector('video, iframe') && 
                              !el.closest('[class*="player"]') && 
                              !el.closest('[id*="player"]') &&
                              !(el.className || '').toString().includes('player') &&
                              !(el.id || '').includes('player');
          
          if (isTransparent && isNotPlayer) {
            el.remove();
          }
        }
      }
    });
    
    // Remove ad links that overlay content
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href.toLowerCase();
      const style = window.getComputedStyle(a);
      
      if ((style.position === 'absolute' || style.position === 'fixed') && 
          !allowedHosts.some(h => href.includes(h))) {
        a.remove();
      }
    });
  }
  
  // ========== REMOVE AD ELEMENTS ==========
  
  function removeAds() {
    // Remove iframes that aren't from allowed domains
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = (iframe.src || '').toLowerCase();
      
      // Keep player iframes
      if (iframe.closest('[class*="player"]') || iframe.closest('[id*="player"]')) {
        return;
      }
      
      // Keep if it's from an allowed host
      if (allowedHosts.some(h => src.includes(h))) {
        return;
      }
      
      // Remove hidden/tiny iframes (ad trackers)
      const style = window.getComputedStyle(iframe);
      if (style.display === 'none' || iframe.width === '0' || iframe.height === '0' ||
          parseInt(style.width) < 10 || parseInt(style.height) < 10) {
        iframe.remove();
        return;
      }
      
      // Remove about:blank iframes
      if (src === '' || src === 'about:blank') {
        iframe.remove();
      }
    });
    
    // Remove obvious ad elements
    document.querySelectorAll('ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot]').forEach(el => el.remove());
    
    removeOverlays();
  }
  
  // ========== BLOCK NETWORK REQUESTS ==========
  
  function isAllowedNetworkUrl(url) {
    if (!url) return true;
    const lower = url.toLowerCase();
    
    // Allow video files
    if (/\\.(m3u8|mp4|ts|webm|key|mpd|m4s)(\\?|#|$)/i.test(url)) {
      return true;
    }
    
    // Allow whitelisted domains
    const allowedNetworkDomains = [
      'multiembed.mov', 'streamingnow.mov', 'moviesapi',
      'cloudflare', 'akamai', 'fastly', 'cloudfront', 
      'jwp', 'videojs', 'hls', 'bitmovin', 'mux.com'
    ];
    
    return allowedNetworkDomains.some(d => lower.includes(d));
  }
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = (args[0]?.url || args[0] || '').toString();
    if (!isAllowedNetworkUrl(url)) {
      console.log('[AdBlock] Blocked fetch:', url.substring(0, 50));
      return Promise.resolve(new Response('', { status: 204 }));
    }
    return originalFetch.apply(this, args);
  };
  
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (!isAllowedNetworkUrl((url || '').toString())) {
      console.log('[AdBlock] Blocked XHR:', (url || '').toString().substring(0, 50));
      this._blocked = true;
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };
  
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._blocked) return;
    return originalXHRSend.apply(this, args);
  };
  
  // ========== BLOCK DYNAMIC ELEMENTS ==========
  
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName) {
    const el = originalCreateElement(tagName);
    const tag = tagName.toLowerCase();
    
    if (tag === 'script' || tag === 'iframe') {
      let blocked = false;
      
      const origSetAttr = el.setAttribute.bind(el);
      el.setAttribute = function(name, value) {
        if (name === 'src' && !isAllowedNetworkUrl(value)) {
          console.log('[AdBlock] Blocked', tag, ':', value.substring(0, 50));
          blocked = true;
          return;
        }
        return origSetAttr(name, value);
      };
      
      Object.defineProperty(el, 'src', {
        get: () => blocked ? '' : el.getAttribute('src'),
        set: (value) => {
          if (!isAllowedNetworkUrl(value)) {
            console.log('[AdBlock] Blocked', tag, 'src:', value.substring(0, 50));
            blocked = true;
            return;
          }
          el.setAttribute('src', value);
        }
      });
    }
    
    return el;
  };
  
  // ========== GLOBAL CLICK PROTECTION ==========
  
  document.addEventListener('click', function(e) {
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A') {
        const href = (el.href || '').toLowerCase();
        if (!allowedHosts.some(h => href.includes(h)) && !href.startsWith('javascript:void')) {
          console.log('[AdBlock] Blocked click:', href.substring(0, 50));
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
      el = el.parentElement;
    }
  }, true);
  
  // Block mousedown hijacking
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(evt => {
    document.addEventListener(evt, function(e) {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === 'A') {
          const href = (el.href || '').toLowerCase();
          if (!allowedHosts.some(h => href.includes(h))) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }
        }
        el = el.parentElement;
      }
    }, true);
  });
  
  // ========== RUN ==========
  
  removeAds();
  
  const observer = new MutationObserver(removeAds);
  
  function init() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      removeAds();
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  setInterval(removeAds, 800);
  
  console.log('[AdBlock] Whitelist mode active');
})();
true;
`;

const CSS_INJECTION_SCRIPT = `
(function() {
  const style = document.createElement('style');
  style.textContent = \`
    ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot] {
      display: none !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(style);
})();
true;
`;

export default function SecureVideoWebView({ url }: { url: string }) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const initialUrlRef = useRef(url);

  console.log("Loading video URL in secure webview:", url);

  // Extract initial hostname for same-origin checks
  const getInitialHost = useCallback(() => {
    try {
      return new URL(initialUrlRef.current).hostname;
    } catch {
      return "";
    }
  }, []);

  const handleRequest = useCallback(
    ({ url: reqUrl }: { url: string }) => {
      // Allow data/blob URLs
      if (!reqUrl || reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
        return true;
      }

      // BLOCK about:blank - this is always an ad popup
      if (reqUrl === "about:blank") {
        console.log("[AdBlock] ✗ Blocked: about:blank");
        return false;
      }

      const lower = reqUrl.toLowerCase();

      // Allow video file extensions
      if (VIDEO_FILE_PATTERNS.test(reqUrl)) {
        console.log("[AdBlock] ✓ Video file:", reqUrl.substring(0, 60));
        return true;
      }

      // Check against whitelist
      const isAllowed = ALLOWED_DOMAINS.some((domain) =>
        lower.includes(domain)
      );
      if (isAllowed) {
        console.log("[AdBlock] ✓ Whitelist:", reqUrl.substring(0, 60));
        return true;
      }

      // Allow same-origin
      try {
        const initialHost = getInitialHost();
        const reqHost = new URL(reqUrl).hostname;
        if (reqHost === initialHost || reqHost.endsWith("." + initialHost)) {
          console.log("[AdBlock] ✓ Same-origin:", reqUrl.substring(0, 60));
          return true;
        }

        // Also allow if the request host is a subdomain pattern we've seen
        if (
          reqHost.includes("multiembed") ||
          reqHost.includes("streamingnow")
        ) {
          console.log("[AdBlock] ✓ Streaming domain:", reqUrl.substring(0, 60));
          return true;
        }
      } catch (e) {}

      // BLOCK everything else - this is the key change!
      console.log("[AdBlock] ✗ Blocked:", reqUrl.substring(0, 60));
      return false;
    },
    [getInitialHost]
  );

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
          injectedJavaScriptBeforeContentLoaded={CSS_INJECTION_SCRIPT}
          injectedJavaScript={AD_BLOCK_SCRIPT}
          onShouldStartLoadWithRequest={handleRequest}
          originWhitelist={["*"]}
          mixedContentMode="always"
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          setSupportMultipleWindows={false}
          userAgent={
            Platform.OS === "ios"
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          }
          onError={(e) => console.log("[WebView Error]:", e.nativeEvent)}
          onHttpError={(e) =>
            console.log(
              "[HTTP Error]:",
              e.nativeEvent.statusCode,
              e.nativeEvent.url
            )
          }
          onMessage={(event) =>
            console.log("[WebView]:", event.nativeEvent.data)
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "#000",
  },
});
