import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import WebView from "react-native-webview";
import MovieAPI from "../services/MovieAPI";
import { SafeAreaView } from "react-native-safe-area-context";
import VideoHintToast from "../components/VideoHintToast";
import Focusable from "../components/Focusable";
import { useTVBackHandler } from "../hooks/useTVBackHandler";

type TvPlayerCommand = "play" | "toggle";

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

const TV_CONTROL_RUNTIME = `
(function() {
  'use strict';

  function attemptTvPlay() {
    function fireTouch(el, type, x, y) {
      try {
        var t = (typeof Touch === 'function') ? new Touch({
          identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y
        }) : null;
        var init = { bubbles: true, cancelable: true, composed: true, view: window };
        if (t) {
          init.touches = (type === 'touchend' ? [] : [t]);
          init.targetTouches = (type === 'touchend' ? [] : [t]);
          init.changedTouches = [t];
        }
        var evt = (typeof TouchEvent === 'function') ? new TouchEvent(type, init) : new Event(type, init);
        el.dispatchEvent(evt);
      } catch(_) {}
    }

    function clickElement(el) {
      if (!el) return false;
      var rect;
      try { rect = el.getBoundingClientRect(); }
      catch(_) { rect = {left: 0, top: 0, width: 0, height: 0}; }
      var x = rect.left + (rect.width || 0) / 2;
      var y = rect.top + (rect.height || 0) / 2;
      try {
        fireTouch(el, 'touchstart', x, y);
        fireTouch(el, 'touchend', x, y);
        ['pointerdown','mousedown','mouseup','pointerup','click'].forEach(function(type) {
          el.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, composed: true, view: window,
            clientX: x, clientY: y, button: 0
          }));
        });
        ['keydown','keypress','keyup'].forEach(function(type) {
          el.dispatchEvent(new KeyboardEvent(type, {
            bubbles: true, cancelable: true, composed: true,
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13
          }));
        });
        if (typeof el.focus === 'function') { try { el.focus(); } catch(_) {} }
        if (typeof el.click === 'function') el.click();
        return true;
      } catch(_) {
        try { el.click(); return true; } catch(__) { return false; }
      }
    }

    var played = false;
    try {
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        try {
          v.muted = false;
          v.volume = 1;
          var result = v.play && v.play();
          played = true;
          if (result && result.catch) result.catch(function(){});
        } catch(_) {}
      }
    } catch(_) {}

    var selectors = [
      'button[aria-label*="play" i]',
      '[role="button"][aria-label*="play" i]',
      '.jw-icon-playback',
      '.jw-display-icon-container',
      '.vjs-big-play-button',
      '.plyr__control--overlaid',
      '.plyr__control[data-plyr="play"]',
      '[class*="bigPlay" i]',
      '[class*="big-play" i]',
      '[class*="poster" i]',
      '[class*="thumbnail" i]',
      '[class*="preview" i]',
      '[class*="play" i]',
      '[id*="play" i]'
    ];

    for (var s = 0; s < selectors.length; s++) {
      try {
        var candidates = document.querySelectorAll(selectors[s]);
        for (var c = 0; c < candidates.length; c++) {
          var candidateRect = candidates[c].getBoundingClientRect();
          if (candidateRect.width > 0 && candidateRect.height > 0) {
            played = clickElement(candidates[c]) || played;
          }
        }
      } catch(_) {}
    }

    try {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var pts = [[w/2, h/2], [w/2, h*0.45], [w/2, h*0.55], [w*0.45, h/2], [w*0.55, h/2]];
      for (var p = 0; p < pts.length; p++) {
        var el = document.elementFromPoint(pts[p][0], pts[p][1]);
        if (el) played = clickElement(el) || played;
      }
    } catch(_) {}

    try {
      ['keydown','keypress','keyup'].forEach(function(type) {
        (document.body || document.documentElement).dispatchEvent(new KeyboardEvent(type, {
          bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
        }));
      });
    } catch(_) {}

    try {
      var frames = document.querySelectorAll('iframe');
      for (var f = 0; f < frames.length; f++) {
        try { frames[f].contentWindow.postMessage('__BMB_TV_PLAY__', '*'); } catch(_) {}
      }
    } catch(_) {}

    return played;
  }

  function handleTvCommand(command) {
    if (command === 'play') return attemptTvPlay();

    var handled = false;
    try {
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        var v = videos[i];
        try {
          if (command === 'toggle') {
            if (v.paused) {
              v.muted = false;
              v.volume = 1;
              var result = v.play && v.play();
              if (result && result.catch) result.catch(function(){});
            } else {
              v.pause();
            }
            handled = true;
          }
        } catch(_) {}
      }
    } catch(_) {}

    if (command === 'toggle' && !handled) {
      handled = attemptTvPlay() || handled;
    }

    try {
      var frames = document.querySelectorAll('iframe');
      for (var f = 0; f < frames.length; f++) {
        try { frames[f].contentWindow.postMessage('__BMB_TV_COMMAND__:' + command, '*'); } catch(_) {}
      }
    } catch(_) {}

    return handled;
  }

  try {
    window.__BMB_TV_PLAY__ = attemptTvPlay;
    window.__BMB_TV_CONTROL__ = handleTvCommand;
    window.addEventListener('message', function(event) {
      if (event && event.data === '__BMB_TV_PLAY__') {
        attemptTvPlay();
      } else if (event && typeof event.data === 'string' && event.data.indexOf('__BMB_TV_COMMAND__:') === 0) {
        handleTvCommand(event.data.replace('__BMB_TV_COMMAND__:', ''));
      }
    });
  } catch(_) {}
})();
true;
`;

const LiveGamePlayer = ({ route, navigation }: any) => {
  const { link, game, stream } = route.params;
  const [embedLink, setEmbedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(Platform.isTV);
  const [webViewInteractive, setWebViewInteractive] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const playOverlayRef = useRef<View>(null);
  const playPauseRef = useRef<View>(null);

  useEffect(() => {
    resolveAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);

  useTVBackHandler(() => {
    if (webViewInteractive) {
      setWebViewInteractive(false);
      return;
    }
    navigation.goBack();
  });

  useEffect(() => {
    if (!Platform.isTV || !embedLink) return;
    const focus = () => {
      if (webViewInteractive) {
        const webView = webViewRef.current as unknown as {
          requestFocus?: () => void;
        } | null;
        webView?.requestFocus?.();
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
  }, [embedLink, showPlayOverlay, webViewInteractive]);

  // Title shown on the native player when Tier-1 resolves. Falls back through
  // game/team data → stream channel → "Live stream" so something is always set.
  const playerTitle = useMemo(() => {
    if (game?.homeTeam && game?.awayTeam) {
      return `${game.homeTeam} vs ${game.awayTeam}`;
    }
    return stream?.channel || game?.league || "Live stream";
  }, [game, stream]);

  // Two-tier flow mirroring MovieDetails/SeriesDetails:
  //   Tier 1 — `/sports/resolve` extracts direct HLS/MP4 from the embed page.
  //            Hand off to NativeVideoPlayer (proper controls, source picker,
  //            language badges) and replace this route so Back goes to the
  //            previous screen, not back here.
  //   Tier 2 — fall back to the existing WebView embed.
  const resolveAndPlay = async () => {
    setLoading(true);
    setError(null);
    setShowPlayOverlay(Platform.isTV);
    setWebViewInteractive(false);
    try {
      const resolved = await MovieAPI.getResolvedLiveStreams(link);
      // Magnets aren't playable; the native player would just choke. Drop them
      // up front so the picker only shows usable sources.
      const playable = resolved.filter((s) => s.type !== "magnet");
      if (playable.length > 0) {
        navigation.replace("NativeVideoPlayer", {
          streams: playable,
          title: playerTitle,
        });
        return;
      }
    } catch (e) {
      console.warn("Live resolve failed, falling back to WebView:", e);
    }

    // Tier 2 fallback
    try {
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

  const sendTvCommand = useCallback((command: TvPlayerCommand) => {
    webViewRef.current?.injectJavaScript(buildTvCommandScript(command));
    setShowPlayOverlay(false);
  }, []);

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
        hostJson,
      ).replace(/\{\{ALLOW_NEEDLES\}\}/g, allowJson),
      runtimeScript:
        RUNTIME_TEMPLATE.replace(/\{\{INIT_HOST\}\}/g, hostJson).replace(
          /\{\{ALLOW_NEEDLES\}\}/g,
          allowJson,
        ) +
        // TV control hooks are only used on TV hardware; don't inject them into
        // phone/tablet WebViews where they'd add unused JS and side effects.
        (Platform.isTV ? "\n" + TV_CONTROL_RUNTIME : ""),
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
      if (reqUrl.startsWith("file:") || reqUrl.startsWith("javascript:")) {
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
    [],
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
          <Text style={styles.retryText} onPress={resolveAndPlay}>
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
            ref={webViewRef}
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
            focusable={!Platform.isTV || webViewInteractive}
            accessible={!Platform.isTV || webViewInteractive}
            importantForAccessibility={
              Platform.isTV && !webViewInteractive
                ? "no-hide-descendants"
                : "auto"
            }
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
                    msg.data?.url ?? msg.data?.preview ?? "",
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
        {Platform.isTV && showPlayOverlay && !webViewInteractive && (
          <View style={styles.tvPlayOverlay} pointerEvents="box-none">
            <Focusable
              ref={playOverlayRef}
              style={styles.tvPlayButton}
              focusedStyle={styles.tvPlayButtonFocused}
              hasTVPreferredFocus
              onPress={() => sendTvCommand("play")}
            >
              <Text style={styles.tvPlayButtonIcon}>▶</Text>
              <Text style={styles.tvPlayButtonLabel}>Press OK to play</Text>
            </Focusable>
          </View>
        )}
        {Platform.isTV && webViewInteractive && (
          <View style={styles.tvInteractiveHint} pointerEvents="none">
            <Text style={styles.tvInteractiveHintText}>
              Use D-pad in player • Press BACK to return to controls
            </Text>
          </View>
        )}
        {Platform.isTV && !webViewInteractive && !showPlayOverlay && (
          <View style={styles.tvNativeControlsWrap}>
            <Focusable
              ref={playPauseRef}
              style={[
                styles.tvNativeControlButton,
                styles.tvNativeControlButtonPrimary,
              ]}
              focusedStyle={styles.tvNativeControlButtonFocused}
              hasTVPreferredFocus
              onPress={() => sendTvCommand("toggle")}
            >
              <Text style={styles.tvNativeControlLabel}>Play/Pause</Text>
            </Focusable>
            <Focusable
              style={styles.tvNativeControlButton}
              focusedStyle={styles.tvNativeControlButtonFocused}
              onPress={() => {
                webViewRef.current?.reload();
                setShowPlayOverlay(true);
                setWebViewInteractive(false);
              }}
            >
              <Text style={styles.tvNativeControlLabel}>Reload</Text>
            </Focusable>
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
        {!Platform.isTV && <VideoHintToast />}
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
  tvPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  tvPlayButton: {
    paddingHorizontal: 60,
    paddingVertical: 30,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "rgba(231, 76, 60, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  tvPlayButtonFocused: {
    borderColor: "#fff",
    borderWidth: 5,
    backgroundColor: "#e74c3c",
    shadowColor: "#fff",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
    transform: [{ scale: 1.1 }],
  },
  tvPlayButtonIcon: {
    color: "#fff",
    fontSize: 72,
    textAlign: "center",
    marginBottom: 4,
  },
  tvPlayButtonLabel: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  tvNativeControlsWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  tvNativeControlButton: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
  },
  tvNativeControlButtonPrimary: {
    minWidth: 150,
    backgroundColor: "rgba(231, 76, 60, 0.9)",
  },
  tvNativeControlButtonFocused: {
    borderColor: "#fff",
    backgroundColor: "#e74c3c",
    shadowColor: "#fff",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
    transform: [{ scale: 1.06 }],
  },
  tvNativeControlLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  tvInteractiveHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
  },
  tvInteractiveHintText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
});
