import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import WebView from "react-native-webview";
import MovieAPI from "../services/MovieAPI";
import { SafeAreaView } from "react-native-safe-area-context";
import VideoHintToast from "../components/VideoHintToast";

// Generic CDN / video infrastructure allowlist (host substring match).
// The init host (the embed URL hostname) is added at runtime.
const NETWORK_ALLOW_NEEDLES = [
  // Generic CDNs
  "cloudflare",
  "akamai",
  "fastly",
  "cloudfront",
  "edgecast",
  "stackpath",
  "bootstrapcdn",
  "jsdelivr",
  "unpkg",
  // Video player infra
  "jwp",
  "videojs",
  "hls",
  "bitmovin",
  "mux.com",
  "plyr.io",
  "vimeocdn",
  "vidcdn",
  // Google fonts (NOT analytics/ads)
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

const VIDEO_FILE_PATTERNS = /\.(m3u8|mp4|ts|webm|mkv|mov|mpd|m4s|key)(\?|#|$)/i;

// =============================================================================
// BEFORE_CONTENT_LOAD: runs at document_start in EVERY frame.
// {{INIT_HOST}} is replaced with the embed URL's hostname at render time.
// =============================================================================
const BEFORE_LOAD_TEMPLATE = `
(function() {
  'use strict';

  var INIT_HOST = {{INIT_HOST}};
  var ALLOWED_NETWORK_NEEDLES = {{ALLOW_NEEDLES}};
  var VIDEO_RX = /\\.(m3u8|mp4|ts|webm|mkv|mov|mpd|m4s|key)(\\?|#|$)/i;

  function send(tag, payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({tag: tag, data: payload}));
      }
    } catch(_) {}
  }

  function hostOf(href) {
    try { return new URL(href, location.href).hostname.toLowerCase(); }
    catch(_) { return ''; }
  }

  function isAllowedHost(href) {
    if (!href) return false;
    var h = hostOf(href);
    if (!h) return false;
    if (INIT_HOST && (h === INIT_HOST || h.endsWith('.' + INIT_HOST))) return true;
    return ALLOWED_NETWORK_NEEDLES.some(function(n){ return h.indexOf(n) !== -1; });
  }

  function isAllowedNetworkUrl(url) {
    if (!url) return true;
    var s = ('' + url).toLowerCase();
    if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0) return true;
    if (VIDEO_RX.test(s)) return true;
    return isAllowedHost(s);
  }

  // ---------- window.open / popups (non-reassignable) ----------
  try {
    Object.defineProperty(window, 'open', {
      value: function() { send('block', {kind:'open', url: arguments[0]||''}); return null; },
      writable: false, configurable: false
    });
  } catch(_) { window.open = function(){ return null; }; }

  // ---------- location traps ----------
  try {
    var origAssign = window.location.assign.bind(window.location);
    var origReplace = window.location.replace.bind(window.location);
    window.location.assign = function(u) {
      if (!isAllowedHost(u)) { send('block',{kind:'assign',url:u}); return; }
      return origAssign(u);
    };
    window.location.replace = function(u) {
      if (!isAllowedHost(u)) { send('block',{kind:'replace',url:u}); return; }
      return origReplace(u);
    };
  } catch(_) {}

  try {
    var hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href') ||
                   Object.getOwnPropertyDescriptor(window.location, 'href');
    if (hrefDesc && hrefDesc.set) {
      var origHrefSet = hrefDesc.set;
      Object.defineProperty(window.location, 'href', {
        configurable: true,
        get: hrefDesc.get,
        set: function(u) {
          if (!isAllowedHost(u)) { send('block',{kind:'href',url:u}); return; }
          return origHrefSet.call(window.location, u);
        }
      });
    }
  } catch(_) {}

  // beforeunload trap
  window.addEventListener('beforeunload', function(e){
    e.preventDefault(); e.returnValue = ''; return '';
  }, true);

  // ---------- meta refresh ----------
  function killMetaRefresh() {
    try {
      document.querySelectorAll('meta[http-equiv="refresh"]').forEach(function(t){ t.remove(); });
    } catch(_) {}
  }
  killMetaRefresh();

  // ---------- insertAdjacentHTML ----------
  try {
    var origInsert = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function(pos, html) {
      var s = (html || '').toLowerCase();
      if (s.indexOf('<scr' + 'ipt') !== -1 || s.indexOf('<ifr' + 'ame') !== -1 || s.indexOf('<emb' + 'ed') !== -1) {
        send('block',{kind:'insertAdjacentHTML',preview:s.substring(0,80)});
        return;
      }
      return origInsert.call(this, pos, html);
    };
  } catch(_) {}

  // ---------- fetch ----------
  try {
    var origFetch = window.fetch.bind(window);
    window.fetch = function() {
      var url = (arguments[0] && arguments[0].url) || arguments[0] || '';
      if (!isAllowedNetworkUrl(url)) {
        send('block',{kind:'fetch',url:('' + url).substring(0,80)});
        return Promise.resolve(new Response('', {status: 204}));
      }
      return origFetch.apply(null, arguments);
    };
  } catch(_) {}

  // ---------- XHR ----------
  try {
    var origXHROpen = XMLHttpRequest.prototype.open;
    var origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, u) {
      if (!isAllowedNetworkUrl(u)) {
        this.__blocked = true;
        send('block',{kind:'xhr',url:('' + u).substring(0,80)});
      }
      return origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      if (this.__blocked) return;
      return origXHRSend.apply(this, arguments);
    };
  } catch(_) {}

  // ---------- sendBeacon ----------
  try {
    if (navigator.sendBeacon) {
      var origBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(u, d) {
        if (!isAllowedNetworkUrl(u)) {
          send('block',{kind:'beacon',url:('' + u).substring(0,80)});
          return false;
        }
        return origBeacon(u, d);
      };
    }
  } catch(_) {}

  // ---------- iframe / script / embed / object .src setters ----------
  function patchSrc(proto, tagLabel) {
    try {
      var d = Object.getOwnPropertyDescriptor(proto, 'src');
      if (!d || !d.set) return;
      var origSet = d.set;
      Object.defineProperty(proto, 'src', {
        configurable: true,
        get: d.get,
        set: function(v) {
          if (!isAllowedNetworkUrl(v)) {
            send('block',{kind:tagLabel+'.src',url:('' + v).substring(0,80)});
            return;
          }
          return origSet.call(this, v);
        }
      });
    } catch(_) {}
  }
  // Iframes are intentionally NOT host-whitelisted — sports stream embeds
  // commonly nest a player iframe on a rotating CDN that we cannot enumerate.
  // Popup/redirect/click defenses still apply inside those iframes via
  // injectedJavaScriptForMainFrameOnly={false}.
  patchSrc(HTMLScriptElement.prototype, 'script');
  if (typeof HTMLEmbedElement !== 'undefined') patchSrc(HTMLEmbedElement.prototype, 'embed');
  if (typeof HTMLObjectElement !== 'undefined') patchSrc(HTMLObjectElement.prototype, 'object');

  // ---------- createElement filter ----------
  try {
    var origCreate = document.createElement.bind(document);
    document.createElement = function(tag) {
      var el = origCreate(tag);
      var t = (tag || '').toLowerCase();
      // Iframe intentionally excluded — see note on patchSrc above.
      if (t === 'script' || t === 'embed' || t === 'object') {
        var origSetAttr = el.setAttribute.bind(el);
        el.setAttribute = function(name, value) {
          if ((name === 'src' || name === 'data') && !isAllowedNetworkUrl(value)) {
            send('block',{kind:t+'.setAttribute',url:('' + value).substring(0,80)});
            return;
          }
          return origSetAttr(name, value);
        };
      }
      // Block meta http-equiv=refresh creation
      if (t === 'meta') {
        var origMetaSetAttr = el.setAttribute.bind(el);
        el.setAttribute = function(name, value) {
          if (name && name.toLowerCase() === 'http-equiv' &&
              value && value.toLowerCase() === 'refresh') {
            send('block',{kind:'meta-refresh'});
            return;
          }
          return origMetaSetAttr(name, value);
        };
      }
      return el;
    };
  } catch(_) {}

  // ---------- DOM injection guard ----------
  try {
    function guardChild(node) {
      if (!node || !node.tagName) return node;
      var tag = node.tagName.toLowerCase();
      // Iframes intentionally excluded — see note on patchSrc above.
      if (tag === 'script' || tag === 'embed' || tag === 'object') {
        var src = node.src || node.getAttribute('src') || node.getAttribute('data') || '';
        if (src && !isAllowedNetworkUrl(src)) {
          send('block',{kind:tag+'.append',url:('' + src).substring(0,80)});
          return document.createComment('blocked-' + tag);
        }
      }
      return node;
    }
    var origAppend = Node.prototype.appendChild;
    var origInsertNode = Node.prototype.insertBefore;
    Node.prototype.appendChild = function(node) {
      return origAppend.call(this, guardChild(node));
    };
    Node.prototype.insertBefore = function(node, ref) {
      return origInsertNode.call(this, guardChild(node), ref);
    };
  } catch(_) {}

  // ---------- visibility spoofing (kills "tab hidden" ad nags) ----------
  try {
    Object.defineProperty(document, 'hidden', { value: false, writable: false, configurable: false });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false, configurable: false });
    document.addEventListener('visibilitychange', function(e){ e.stopImmediatePropagation(); }, true);
  } catch(_) {}

  // ---------- ad-library stubs ----------
  try {
    window.googletag = window.googletag || { cmd: [], pubads: function(){ return { set: function(){}, refresh: function(){} }; } };
    window.ga = window.ga || function(){};
    window.gtag = window.gtag || function(){};
    window.adsbygoogle = window.adsbygoogle || { loaded: true, push: function(){} };
  } catch(_) {}

  // ---------- force-unmute video (Android Chrome auto-mutes on autoplay) ----------
  function unmuteVideo(v) {
    try {
      if (v.hasAttribute('muted')) v.removeAttribute('muted');
      if (v.muted) v.muted = false;
      if (v.volume < 1) v.volume = 1.0;
    } catch(_) {}
  }
  try {
    var origVideoCreate = document.createElement.bind(document);
    document.createElement = function(tag) {
      var el = origVideoCreate(tag);
      if ((tag || '').toLowerCase() === 'video') {
        ['loadedmetadata','play','playing','canplay','canplaythrough'].forEach(function(evt){
          el.addEventListener(evt, function(){ unmuteVideo(el); });
        });
        el.addEventListener('volumechange', function(){
          if (el.muted) unmuteVideo(el);
        });
      }
      return el;
    };
  } catch(_) {}

  // ---------- click / pointer hijack guards ----------
  function isHostileLink(el) {
    while (el && el !== document.body) {
      if (el.tagName === 'A') {
        var href = (el.href || '').toLowerCase();
        if (!href || href.indexOf('javascript:void') === 0) return false;
        if (!isAllowedHost(href)) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  ['click','mousedown','mouseup','pointerdown','pointerup','touchstart','touchend','auxclick','contextmenu'].forEach(function(evt){
    document.addEventListener(evt, function(e){
      if (isHostileLink(e.target)) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        send('block',{kind:evt,target:String(e.target && e.target.tagName)});
      }
    }, true);
  });

  send('init', {frame: location.hostname});
})();
true;
`;

// =============================================================================
// AT_LOAD: tighter CSS selectors (no [class*="modal"] / overlay / popup
// because those false-positive on player UI). DOM cleanup observer.
// =============================================================================
const RUNTIME_TEMPLATE = `
(function() {
  'use strict';

  var INIT_HOST = {{INIT_HOST}};
  var ALLOWED_NETWORK_NEEDLES = {{ALLOW_NEEDLES}};

  function hostOf(href) {
    try { return new URL(href, location.href).hostname.toLowerCase(); }
    catch(_) { return ''; }
  }
  function isAllowedHost(href) {
    if (!href) return false;
    var h = hostOf(href);
    if (!h) return false;
    if (INIT_HOST && (h === INIT_HOST || h.endsWith('.' + INIT_HOST))) return true;
    return ALLOWED_NETWORK_NEEDLES.some(function(n){ return h.indexOf(n) !== -1; });
  }

  // ---------- CSS rules (conservative — won't hide player chrome) ----------
  var style = document.createElement('style');
  style.textContent = [
    'ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot] { display: none !important; }',
    '[class*="adsbygoogle"], [id*="google_ads"], [aria-label*="Advertisement"], [aria-label*="advertisement"] { display: none !important; }',
    'iframe[src*="doubleclick"], iframe[src*="googlesyndication"], iframe[src*="adservice"] { display: none !important; }',
    '[id*="ad-banner"], [id*="ad_banner"], [class*="ad-banner"], [class*="ad_banner"] { display: none !important; }',
    '.ad-container, .ad-wrapper, .ad-slot, .ad-unit, .ad-leaderboard, .ad-sidebar, .ad-interstitial, .ad-overlay, .ad-sticky, .ad-float, .ad-fixed { display: none !important; }',
    '.OUTBRAIN, .taboola, #taboola-below-article, #outbrain-widget, .promoted-content, .native-ad, .dfp-ad, .gpt-ad { display: none !important; }',
    'amp-ad, amp-embed, amp-sticky-ad { display: none !important; }',
    'body { overscroll-behavior: contain !important; }'
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);

  function killMetaRefresh() {
    try {
      document.querySelectorAll('meta[http-equiv="refresh"]').forEach(function(t){ t.remove(); });
    } catch(_) {}
  }

  function removeOverlays() {
    var els = document.querySelectorAll('div, aside, section');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var st;
      try { st = window.getComputedStyle(el); } catch(_) { continue; }
      var z = parseInt(st.zIndex) || 0;
      var pos = st.position;
      // Higher z-index threshold than movie blocker — sports streams stack player chrome
      if (z > 9000 && (pos === 'fixed' || pos === 'absolute')) {
        var rect = el.getBoundingClientRect();
        var op = parseFloat(st.opacity);
        var bg = st.backgroundColor;
        if (rect.width > window.innerWidth * 0.5 || rect.height > window.innerHeight * 0.5) {
          var transparent = op < 0.1 || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
          var hasMedia = el.querySelector('video, iframe[src*="player"], iframe[src*="embed"], iframe[src*="stream"]');
          var className = ((el.className || '') + '').toLowerCase();
          var idStr = ((el.id || '') + '').toLowerCase();
          var isPlayer = className.indexOf('player') !== -1 || className.indexOf('video') !== -1 ||
                         idStr.indexOf('player') !== -1 || idStr.indexOf('video') !== -1;
          if (transparent && !hasMedia && !isPlayer) {
            try { el.remove(); } catch(_) {}
          }
        }
      }
    }
  }

  function removeAds() {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      var ifr = iframes[i];
      // Never touch the actual player iframe
      if (ifr.closest('[class*="player"]') || ifr.closest('[id*="player"]')) continue;
      var src = (ifr.src || '').toLowerCase();
      var st;
      try { st = window.getComputedStyle(ifr); } catch(_) { st = null; }
      // Hidden / tiny iframes are tracking pixels
      if (st && (st.display === 'none' || ifr.width === '0' || ifr.height === '0' ||
          parseInt(st.width) < 10 || parseInt(st.height) < 10)) {
        try { ifr.remove(); } catch(_) {}
        continue;
      }
      if (src === '' || src === 'about:blank') {
        try { ifr.remove(); } catch(_) {}
        continue;
      }
      // NOTE: do NOT remove iframes purely because the host isn't on the
      // allowlist. Stream embeds (especially F1) commonly nest a player
      // iframe pointing at a rotating, no-name CDN — killing them
      // breaks playback. The src-setter, fetch, XHR, sendBeacon, click,
      // and popup hooks already fail-close on those hosts.
    }

    var ads = document.querySelectorAll(
      'ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot], ' +
      '[id*="banner_ad"], [class*="banner_ad"], .ad-container, .ad-wrapper, .ad-slot, ' +
      '.OUTBRAIN, .taboola, .promoted-content, .native-ad, amp-ad, amp-embed, amp-sticky-ad'
    );
    for (var j = 0; j < ads.length; j++) { try { ads[j].remove(); } catch(_) {} }

    killMetaRefresh();
    removeOverlays();
  }

  function unmuteAllVideos() {
    var vids = document.querySelectorAll('video');
    for (var k = 0; k < vids.length; k++) {
      var v = vids[k];
      try {
        if (v.hasAttribute('muted')) v.removeAttribute('muted');
        if (v.muted) v.muted = false;
        if (v.volume < 1) v.volume = 1.0;
      } catch(_) {}
    }
  }

  removeAds();
  unmuteAllVideos();
  try {
    var observer = new MutationObserver(function(){ removeAds(); unmuteAllVideos(); });
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['muted']
      });
    }
  } catch(_) {}
  setInterval(function(){ removeAds(); unmuteAllVideos(); }, 1000);
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

  // Derive init host from the embed URL
  const initHost = useMemo(() => {
    if (!embedLink) return "";
    try {
      return new URL(embedLink).hostname.toLowerCase();
    } catch {
      return "";
    }
  }, [embedLink]);

  // Build the injection scripts with the init host baked in
  const { beforeLoadScript, runtimeScript } = useMemo(() => {
    const allowJson = JSON.stringify(NETWORK_ALLOW_NEEDLES);
    const hostJson = JSON.stringify(initHost);
    return {
      beforeLoadScript: BEFORE_LOAD_TEMPLATE.replace(
        /\{\{INIT_HOST\}\}/g,
        hostJson
      ).replace(/\{\{ALLOW_NEEDLES\}\}/g, allowJson),
      runtimeScript: RUNTIME_TEMPLATE.replace(
        /\{\{INIT_HOST\}\}/g,
        hostJson
      ).replace(/\{\{ALLOW_NEEDLES\}\}/g, allowJson),
    };
  }, [initHost]);

  // Native-side request guard. On iOS this fires for every sub-resource
  // (including nested player iframes); on Android only main-frame nav.
  // We deliberately keep this LENIENT — the in-frame JS hooks
  // (popup/redirect/fetch/click) handle the bulk of ad blocking, and
  // sports stream embeds commonly nest player iframes on rotating CDNs we
  // can't enumerate. We only deny obvious hostile patterns here.
  const handleShouldStartLoadWithRequest = useCallback(
    (request: { url: string }) => {
      const reqUrl = request.url;
      if (!reqUrl) return true;
      if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
        return true;
      }
      if (reqUrl === "about:blank") {
        console.log("[AdBlock] ✗ Blocked: about:blank");
        return false;
      }
      if (
        reqUrl.startsWith("file:") ||
        reqUrl.startsWith("javascript:")
      ) {
        return false;
      }
      // Known-bad ad-network hosts (small, conservative blacklist).
      const lower = reqUrl.toLowerCase();
      const HARD_BLOCK = [
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "adservice.google.com",
        "popads.net",
        "popcash.net",
        "propellerads.com",
        "exoclick.com",
        "juicyads.com",
        "adsterra.com",
        "hilltopads.com",
        "trafficjunky.com",
      ];
      if (HARD_BLOCK.some((d) => lower.includes(d))) {
        console.log("[AdBlock] ✗ Hard-blocked nav:", reqUrl.substring(0, 60));
        return false;
      }
      return true;
    },
    []
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
      <View style={styles.playerArea}>
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
              Referer: link || embedLink,
              "User-Agent":
                Platform.OS === "ios"
                  ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                  : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            },
          }}
          style={styles.webview}
          // Inject into EVERY frame, at document_start AND document_end
          injectedJavaScriptBeforeContentLoaded={beforeLoadScript}
          injectedJavaScript={runtimeScript}
          injectedJavaScriptForMainFrameOnly={false}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          scalesPageToFit
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="compatibility"
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          androidLayerType="hardware"
          cacheEnabled={false}
          incognito
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
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg && msg.tag === "block") {
                console.log(
                  "[AdBlock] ✗",
                  msg.data?.kind,
                  msg.data?.url ?? msg.data?.preview ?? ""
                );
              } else if (msg && msg.tag === "init") {
                console.log("[AdBlock] init in frame:", msg.data?.frame);
              }
            } catch {
              console.log("[WebView]:", event.nativeEvent.data);
            }
          }}
        />
      )}
        <VideoHintToast />
      </View>
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
  playerArea: {
    flex: 1,
    position: "relative",
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
