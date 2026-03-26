import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import React, { useEffect, useState, useCallback } from "react";
import WebView from "react-native-webview";
import MovieAPI from "../services/MovieAPI";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

// Comprehensive list of ad domains to block
const AD_DOMAINS = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "adservice.google.com",
  "pagead2.googlesyndication.com",
  "facebook.com/tr",
  "connect.facebook.net",
  "amazon-adsystem.com",
  "ads.yahoo.com",
  "ads.twitter.com",
  "ads.linkedin.com",
  "adsrvr.org",
  "adnxs.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "criteo.com",
  "criteo.net",
  "outbrain.com",
  "taboola.com",
  "mgid.com",
  "revcontent.com",
  "adroll.com",
  "bidswitch.net",
  "casalemedia.com",
  "contextweb.com",
  "indexww.com",
  "lijit.com",
  "mathtag.com",
  "media.net",
  "moatads.com",
  "popads.net",
  "popcash.net",
  "propellerads.com",
  "richaudience.com",
  "scorecardresearch.com",
  "sharethis.com",
  "sharethrough.com",
  "smartadserver.com",
  "spotxchange.com",
  "statcounter.com",
  "stickyadstv.com",
  "tapad.com",
  "teads.tv",
  "tradedoubler.com",
  "tremorhub.com",
  "tribalfusion.com",
  "turn.com",
  "undertone.com",
  "yieldmo.com",
  "zedo.com",
  "adcolony.com",
  "unity3d.com",
  "applovin.com",
  "mopub.com",
  "inmobi.com",
  "chartboost.com",
  "vungle.com",
  "ironsrc.com",
  "adjust.com",
  "branch.io",
  "kochava.com",
  "appsflyer.com",
  "amplitude.com",
  "mixpanel.com",
  "segment.com",
  "hotjar.com",
  "crazyegg.com",
  "clicktale.net",
  "newrelic.com",
  "nr-data.net",
  "onesignal.com",
  "pushwoosh.com",
  "leanplum.com",
  "braze.com",
  "clevertap.com",
  "webengage.com",
  "exoclick.com",
  "juicyads.com",
  "trafficjunky.com",
  "adsterra.com",
  "hilltopads.com",
  "clickadu.com",
  "admaven.com",
  "ad-maven.com",
  "propellerclick.com",
  "onclickmax.com",
  "pushame.com",
  "pushengage.com",
  "exosrv.com",
  "realsrv.com",
  "tsyndicate.com",
  "betrad.com",
  "bongacams",
  "livejasmin",
  "stripchat",
  "chaturbate",
  "1xbet",
  "bet365",
  "betway",
  "sponsor.",
  "banner.",
  "popunder",
  "popup",
  "clicktrack",
  "tracking.",
];

// CSS selectors for common ad elements
const AD_SELECTORS = [
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[class*="advert"]',
  '[class*="sponsored"]',
  '[class*="banner"]',
  '[id*="ad-"]',
  '[id*="ads-"]',
  '[id*="advert"]',
  '[id*="google_ads"]',
  '[id*="sponsored"]',
  "[data-ad]",
  "[data-ads]",
  "[data-ad-slot]",
  "[data-ad-client]",
  "[data-google-query-id]",
  'iframe[src*="doubleclick"]',
  'iframe[src*="googlesyndication"]',
  'iframe[src*="googleads"]',
  'iframe[id*="google_ads"]',
  "ins.adsbygoogle",
  "div.adsbygoogle",
  ".google-auto-placed",
  "amp-ad",
  "amp-embed",
  "amp-sticky-ad",
  '[aria-label*="advertisement"]',
  '[aria-label*="Advertisement"]',
  '[aria-label*="Sponsored"]',
  ".ad-container",
  ".ad-wrapper",
  ".ad-slot",
  ".ad-unit",
  ".ad-banner",
  ".ad-leaderboard",
  ".ad-sidebar",
  ".ad-footer",
  ".ad-header",
  ".ad-interstitial",
  ".ad-overlay",
  ".ad-popup",
  ".ad-sticky",
  ".ad-float",
  ".ad-fixed",
  "#ad-container",
  "#ad-wrapper",
  "#advertisement",
  "#sponsorship",
  'aside[class*="ad"]',
  'section[class*="ad"]',
  'div[class*="outbrain"]',
  'div[class*="taboola"]',
  ".OUTBRAIN",
  ".taboola",
  "#taboola-below-article",
  "#outbrain-widget",
  ".promoted-content",
  ".native-ad",
  ".dfp-ad",
  ".gpt-ad",
  '[class*="popup"]',
  '[class*="modal"]:not([class*="video"])',
  '[class*="overlay"]:not([class*="video"])',
  '[id*="popup"]',
  '[id*="modal"]:not([id*="video"])',
  ".push-notification",
  '[class*="notification-prompt"]',
  '[class*="subscribe-popup"]',
  '[class*="newsletter"]',
  ".floating-ad",
  ".sticky-ad",
  ".bottom-ad",
  ".top-ad",
  '[class*="adplacement"]',
  '[class*="adspot"]',
  '[class*="adzone"]',
];

// Comprehensive ad blocker and redirect blocker script
const AD_BLOCK_SCRIPT = `
(function() {
  'use strict';
  
  const adDomains = ${JSON.stringify(AD_DOMAINS)};
  const adSelectors = ${JSON.stringify(AD_SELECTORS)};
  
  // ========== REDIRECT BLOCKING ==========
  
  // Block window.open
  window.open = function() {
    console.log('[AdBlock] Blocked window.open:', arguments[0]);
    return null;
  };
  
  // Block location changes via assignment
  let currentLocation = window.location.href;
  const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  
  // Intercept location.href, location.replace, location.assign
  const originalReplace = window.location.replace;
  const originalAssign = window.location.assign;
  
  window.location.replace = function(url) {
    if (adDomains.some(d => url.includes(d))) {
      console.log('[AdBlock] Blocked location.replace:', url);
      return;
    }
    return originalReplace.call(this, url);
  };
  
  window.location.assign = function(url) {
    if (adDomains.some(d => url.includes(d))) {
      console.log('[AdBlock] Blocked location.assign:', url);
      return;
    }
    return originalAssign.call(this, url);
  };
  
  // Block meta refresh redirects
  function removeMetaRefresh() {
    document.querySelectorAll('meta[http-equiv="refresh"]').forEach(tag => tag.remove());
  }
  removeMetaRefresh();
  
  // ========== AD ELEMENT REMOVAL ==========
  
  function removeAds() {
    const selector = adSelectors.join(', ');
    try {
      document.querySelectorAll(selector).forEach(el => el.remove());
    } catch(e) {}
    
    // Remove iframes from ad domains
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = (iframe.src || '').toLowerCase();
      if (adDomains.some(domain => src.includes(domain))) {
        iframe.remove();
      }
    });
    
    // Remove scripts from ad domains
    document.querySelectorAll('script').forEach(script => {
      const src = (script.src || '').toLowerCase();
      if (adDomains.some(domain => src.includes(domain))) {
        script.remove();
      }
    });
    
    // Remove suspicious high z-index overlays (likely popups/ads)
    document.querySelectorAll('div, aside, section').forEach(el => {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex) || 0;
      const position = style.position;
      
      if (zIndex > 9000 && (position === 'fixed' || position === 'absolute')) {
        const rect = el.getBoundingClientRect();
        // If it covers significant screen area, it's likely an overlay ad
        if (rect.width > window.innerWidth * 0.5 || rect.height > window.innerHeight * 0.5) {
          // Don't remove if it contains video elements
          if (!el.querySelector('video, iframe[src*="player"], iframe[src*="embed"]')) {
            el.remove();
          }
        }
      }
    });
    
    removeMetaRefresh();
  }
  
  // ========== NETWORK REQUEST BLOCKING ==========
  
  // Block fetch requests to ad domains
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = (args[0]?.url || args[0] || '').toString().toLowerCase();
    if (adDomains.some(domain => url.includes(domain))) {
      console.log('[AdBlock] Blocked fetch:', url);
      return Promise.reject(new Error('Blocked by ad blocker'));
    }
    return originalFetch.apply(this, args);
  };
  
  // Block XMLHttpRequest to ad domains
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    const urlLower = (url || '').toString().toLowerCase();
    if (adDomains.some(domain => urlLower.includes(domain))) {
      console.log('[AdBlock] Blocked XHR:', url);
      this._blocked = true;
      return;
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };
  
  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._blocked) return;
    return originalXHRSend.apply(this, args);
  };
  
  // ========== ELEMENT CREATION INTERCEPTION ==========
  
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName) {
    const element = originalCreateElement(tagName);
    const tag = tagName.toLowerCase();
    
    if (tag === 'script' || tag === 'iframe' || tag === 'img') {
      const originalSetAttribute = element.setAttribute.bind(element);
      element.setAttribute = function(name, value) {
        if (name === 'src' && adDomains.some(domain => value.toLowerCase().includes(domain))) {
          console.log('[AdBlock] Blocked ' + tag + ' src:', value);
          return;
        }
        return originalSetAttribute(name, value);
      };
      
      let blockedSrc = false;
      Object.defineProperty(element, 'src', {
        set: function(value) {
          if (adDomains.some(domain => value.toLowerCase().includes(domain))) {
            console.log('[AdBlock] Blocked ' + tag + ' src property:', value);
            blockedSrc = true;
            return;
          }
          element.setAttribute('src', value);
        },
        get: function() {
          return blockedSrc ? '' : element.getAttribute('src');
        }
      });
    }
    
    // Block meta refresh creation
    if (tag === 'meta') {
      const originalSetAttribute = element.setAttribute.bind(element);
      element.setAttribute = function(name, value) {
        if (name.toLowerCase() === 'http-equiv' && value.toLowerCase() === 'refresh') {
          console.log('[AdBlock] Blocked meta refresh');
          return;
        }
        return originalSetAttribute(name, value);
      };
    }
    
    return element;
  };
  
  // ========== VISIBILITY API SPOOFING (prevents "tab hidden" ads) ==========
  
  Object.defineProperty(document, 'hidden', { value: false, writable: false });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
  document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
  
  // ========== STUB AD LIBRARIES ==========
  
  window.googletag = window.googletag || { cmd: [], pubads: () => ({ set: () => {}, refresh: () => {} }) };
  window.ga = window.ga || function() {};
  window.gtag = window.gtag || function() {};
  window.__gads = null;
  window._gaq = window._gaq || [];
  window.adsbygoogle = window.adsbygoogle || { loaded: true, push: function() {} };
  window.google_ad_client = '';
  window.google_ad_slot = '';
  
  // ========== MUTATION OBSERVER ==========
  
  const observer = new MutationObserver((mutations) => {
    let shouldClean = false;
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const el = node;
            const className = (el.className || '').toString().toLowerCase();
            const id = (el.id || '').toLowerCase();
            const tagName = (el.tagName || '').toLowerCase();
            
            // Quick check for obvious ad elements
            if (className.includes('ad') || className.includes('popup') || 
                className.includes('modal') || className.includes('overlay') ||
                id.includes('ad') || id.includes('popup')) {
              // Don't remove video-related elements
              if (!el.querySelector('video') && !className.includes('video') && !id.includes('video')) {
                shouldClean = true;
              }
            }
            
            // Check iframes and scripts
            if (tagName === 'iframe' || tagName === 'script') {
              const src = (el.src || '').toLowerCase();
              if (adDomains.some(d => src.includes(d))) {
                el.remove();
              }
            }
          }
        });
      }
    });
    if (shouldClean) {
      removeAds();
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  
  // ========== PERIODIC CLEANUP ==========
  
  removeAds();
  setInterval(removeAds, 1500);
  
  // ========== CLICK HIJACKING PROTECTION ==========
  
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (target.tagName === 'A') {
      const href = (target.href || '').toLowerCase();
      if (adDomains.some(d => href.includes(d))) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AdBlock] Blocked ad link click:', href);
      }
    }
  }, true);
  
  console.log('[AdBlock] Strict ad blocker activated');
})();
true;
`;

// CSS injection to hide ads before JS runs
const AD_BLOCK_CSS = `
${AD_SELECTORS.map((s) => s).join(",\n")} {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  width: 0 !important;
  max-height: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  left: -9999px !important;
}

div[style*="z-index: 9999"],
div[style*="z-index:9999"],
div[style*="z-index: 99999"],
div[style*="position: fixed"][style*="inset: 0"] {
  display: none !important;
}
`;

const CSS_INJECTION_SCRIPT = `
(function() {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.id = 'adblock-css';
  style.appendChild(document.createTextNode(\`${AD_BLOCK_CSS.replace(
    /`/g,
    "\\`"
  )}\`));
  (document.head || document.documentElement).appendChild(style);
})();
true;
`;

const LiveGamePlayer = ({ route, navigation }: any) => {
  const { link, game, stream } = route.params;
  const [embedLink, setEmbedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmbedLink();
  }, [link]);

  const fetchEmbedLink = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MovieAPI.getLiveGameEmbed(link);
      setEmbedLink(data.embedLink);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load embed";
      setError(errorMessage);
      console.error("Error fetching embed link:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if URL should be blocked
  const shouldBlockUrl = useCallback((requestUrl: string): boolean => {
    const lowercaseUrl = requestUrl.toLowerCase();
    return AD_DOMAINS.some((domain) => lowercaseUrl.includes(domain));
  }, []);

  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      // Block ad domain requests
      if (shouldBlockUrl(request.url)) {
        console.log("[AdBlock] Blocked navigation to:", request.url);
        return false;
      }

      // Allow data URLs
      if (request.url.startsWith("data:") || request.url.startsWith("blob:")) {
        return true;
      }

      // Allow the initial embed URL
      if (!embedLink) return true;

      try {
        const initialDomain = new URL(embedLink).hostname;
        const requestDomain = new URL(request.url).hostname;

        // Allow same-domain and subdomains
        if (
          requestDomain === initialDomain ||
          requestDomain.endsWith("." + initialDomain)
        ) {
          return true;
        }

        // Allow common CDNs and video hosts
        const allowedDomains = [
          "cloudflare.com",
          "jsdelivr.net",
          "cdnjs.cloudflare.com",
          "akamaized.net",
          "fastly.net",
          "cloudfront.net",
          "googleapis.com",
          "gstatic.com",
          "jwpcdn.com",
          "jwplayer.com",
          "videojs.com",
          "vimeocdn.com",
          "vidcdn.pro",
          "hlsjs.video-cdn",
        ];

        if (allowedDomains.some((d) => requestDomain.includes(d))) {
          return true;
        }

        console.log("[AdBlock] Blocked external navigation to:", request.url);
        return false;
      } catch (e) {
        return true;
      }
    },
    [embedLink, shouldBlockUrl]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading game...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <Text style={styles.retryText} onPress={fetchEmbedLink}>
            Try Again
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!embedLink) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            No player available, try another channel
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {game?.homeTeam} {game?.awayTeam ? "vs " + game.awayTeam : ""}
        </Text>
        <Text style={styles.headerSubtitle}>{game?.league}</Text>
        {stream && (
          <Text style={styles.headerSource}>Stream: {stream.source}</Text>
        )}
      </View>
      {Platform.OS === "web" ? (
        <iframe
          src={embedLink}
          style={{ width: "100vw", height: "100vh", border: "none" }}
          allow="autoplay; fullscreen"
        />
      ) : (
        <WebView
          source={{
            uri: embedLink,
            headers: {
              Referer: "https://sportytrend.net/",
              "User-Agent":
                Platform.OS === "ios"
                  ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                  : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            },
          }}
          style={styles.webview}
          injectedJavaScriptBeforeContentLoaded={CSS_INJECTION_SCRIPT}
          injectedJavaScript={AD_BLOCK_SCRIPT}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          scalesPageToFit={true}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="compatibility"
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e74c3c" />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn("WebView error: ", nativeEvent);
          }}
          onMessage={(event) => {
            // Log messages from ad blocker script
            console.log("[WebView]:", event.nativeEvent.data);
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default LiveGamePlayer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#999",
  },
  headerSource: {
    fontSize: 11,
    color: "#e74c3c",
    marginTop: 4,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryText: {
    color: "#3498db",
    fontSize: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#3498db",
    borderRadius: 8,
  },
});
