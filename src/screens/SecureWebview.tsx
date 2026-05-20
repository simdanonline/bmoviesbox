import React, {
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { View, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { width } from "../styles/styles";

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
  "vsembed.ru",
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

// =============================================================================
// BEFORE_CONTENT_LOAD: runs at document_start, in EVERY frame.
// All API hooks must land here so ad scripts cannot see the originals.
// =============================================================================
const BEFORE_LOAD_SCRIPT = `
(function() {
  'use strict';

  var ALLOWED_HOSTS = [
    'multiembed.mov','streamingnow.mov','moviesapi.club','moviesapi.to',
    'vidsrc.to','vidsrc.me','vidsrc.cc','vidsrc.xyz', 'vsembed.ru',
    '2embed.cc','2embed.to','autoembed.cc','vidora.stream','cloudnestra.com'
  ];
  var ALLOWED_NETWORK_NEEDLES = [
    'multiembed','streamingnow','moviesapi','vidsrc','2embed','autoembed','cloudnestra','vidora',
    'cloudflare','akamai','fastly','cloudfront','jwp','videojs','hls','bitmovin','mux.com',
    'plyr.io','vimeocdn','jsdelivr','unpkg','bootstrapcdn','gstatic','googleapis'
  ];
  var VIDEO_RX = /\\.(m3u8|mp4|ts|webm|mkv|mov|mpd|m4s|key)(\\?|#|$)/i;

  function send(tag, payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({tag: tag, data: payload}));
      }
    } catch(_) {}
  }

  function attemptTvPlay() {
    function fireTouch(el, type, x, y) {
      try {
        var t = (typeof Touch === 'function') ? new Touch({
          identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y
        }) : null;
        var init = { bubbles: true, cancelable: true, composed: true, view: window };
        if (t) { init.touches = (type === 'touchend' ? [] : [t]); init.targetTouches = (type === 'touchend' ? [] : [t]); init.changedTouches = [t]; }
        var evt = (typeof TouchEvent === 'function') ? new TouchEvent(type, init) : new Event(type, init);
        el.dispatchEvent(evt);
      } catch(_) {}
    }
    function clickElement(el) {
      if (!el) return false;
      var rect; try { rect = el.getBoundingClientRect(); } catch(_) { rect = {left:0,top:0,width:0,height:0}; }
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
          var rect = candidates[c].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            played = clickElement(candidates[c]) || played;
          }
        }
      } catch(_) {}
    }

    // Click multiple points so an overlay covering the play button still triggers it.
    try {
      var w = window.innerWidth, h = window.innerHeight;
      var pts = [[w/2, h/2], [w/2, h*0.45], [w/2, h*0.55], [w*0.45, h/2], [w*0.55, h/2]];
      for (var p = 0; p < pts.length; p++) {
        var el = document.elementFromPoint(pts[p][0], pts[p][1]);
        if (el) played = clickElement(el) || played;
      }
    } catch(_) {}

    // Send Enter to document.body in case the player binds global keypress.
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
              var toggleResult = v.play && v.play();
              if (toggleResult && toggleResult.catch) toggleResult.catch(function(){});
            } else {
              v.pause();
            }
            handled = true;
          } else if (command === 'pause') {
            v.pause();
            handled = true;
          } else if (command === 'seekForward') {
            if (Number.isFinite(v.duration)) v.currentTime = Math.min(v.duration, v.currentTime + 15);
            else v.currentTime = v.currentTime + 15;
            handled = true;
          } else if (command === 'seekBackward') {
            v.currentTime = Math.max(0, v.currentTime - 15);
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

  function isAllowedHost(href) {
    if (!href) return false;
    try {
      var h = new URL(href, location.href).hostname.toLowerCase();
      return ALLOWED_HOSTS.some(function(a){ return h === a || h.endsWith('.' + a); });
    } catch(_) { return false; }
  }

  function isAllowedNetworkUrl(url) {
    if (!url) return true;
    var s = ('' + url).toLowerCase();
    if (s.indexOf('data:') === 0 || s.indexOf('blob:') === 0) return true;
    if (VIDEO_RX.test(s)) return true;
    return ALLOWED_NETWORK_NEEDLES.some(function(d){ return s.indexOf(d) !== -1; });
  }

  // ---------- window.open / popups ----------
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

  // location.href setter
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

  // beforeunload trap (ads use this for tab-trapping)
  window.addEventListener('beforeunload', function(e){
    e.preventDefault(); e.returnValue = ''; return '';
  }, true);

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

  // ---------- fetch / XHR ----------
  try {
    var origFetch = window.fetch;
    window.fetch = function() {
      var url = (arguments[0] && arguments[0].url) || arguments[0] || '';
      if (!isAllowedNetworkUrl(url)) {
        send('block',{kind:'fetch',url:('' + url).substring(0,80)});
        return Promise.resolve(new Response('', {status: 204}));
      }
      return origFetch.apply(this, arguments);
    };
  } catch(_) {}

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

  // ---------- sendBeacon (used by ad/tracking pings) ----------
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

  // ---------- HTMLIFrameElement.src / HTMLScriptElement.src / embed / object ----------
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
  patchSrc(HTMLIFrameElement.prototype, 'iframe');
  patchSrc(HTMLScriptElement.prototype, 'script');
  if (typeof HTMLEmbedElement !== 'undefined') patchSrc(HTMLEmbedElement.prototype, 'embed');
  if (typeof HTMLObjectElement !== 'undefined') patchSrc(HTMLObjectElement.prototype, 'object');

  // ---------- createElement filter (catches setAttribute('src', ...) too) ----------
  try {
    var origCreate = document.createElement.bind(document);
    document.createElement = function(tag) {
      var el = origCreate(tag);
      var t = (tag || '').toLowerCase();
      if (t === 'script' || t === 'iframe' || t === 'embed' || t === 'object') {
        var origSetAttr = el.setAttribute.bind(el);
        el.setAttribute = function(name, value) {
          if ((name === 'src' || name === 'data') && !isAllowedNetworkUrl(value)) {
            send('block',{kind:t+'.setAttribute',url:('' + value).substring(0,80)});
            return;
          }
          return origSetAttr(name, value);
        };
      }
      // Force-unmute any new <video> element (Android Chrome auto-mutes autoplay)
      if (t === 'video') {
        ['loadedmetadata','play','playing','canplay','canplaythrough'].forEach(function(evt){
          el.addEventListener(evt, function(){
            try {
              if (el.hasAttribute('muted')) el.removeAttribute('muted');
              if (el.muted) el.muted = false;
              if (el.volume < 1) el.volume = 1.0;
            } catch(_) {}
          });
        });
        el.addEventListener('volumechange', function(){
          if (el.muted) {
            try { el.muted = false; if (el.volume < 1) el.volume = 1.0; } catch(_) {}
          }
        });
      }
      return el;
    };
  } catch(_) {}

  // ---------- DOM injection guard (catches appendChild / insertBefore tricks) ----------
  try {
    function guardChild(node) {
      if (!node || !node.tagName) return node;
      var tag = node.tagName.toLowerCase();
      if (tag === 'script' || tag === 'iframe' || tag === 'embed' || tag === 'object') {
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
// AT_LOAD: runs at document_end. DOM cleanup + observer + CSS.
// =============================================================================
const RUNTIME_SCRIPT = `
(function() {
  'use strict';

  var ALLOWED_HOSTS = [
    'multiembed.mov','streamingnow.mov','moviesapi.club','moviesapi.to',
    'vidsrc.to','vidsrc.me','vidsrc.cc','vidsrc.xyz', 'vsembed.ru',
    '2embed.cc','2embed.to','autoembed.cc','vidora.stream','cloudnestra.com'
  ];

  function isAllowedHost(href) {
    if (!href) return false;
    try {
      var h = new URL(href, location.href).hostname.toLowerCase();
      return ALLOWED_HOSTS.some(function(a){ return h === a || h.endsWith('.' + a); });
    } catch(_) { return false; }
  }

  // ---------- CSS rules ----------
  var style = document.createElement('style');
  style.textContent = [
    'ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot] { display: none !important; }',
    'iframe[src*="ads"], iframe[src*="adservice"], iframe[src*="doubleclick"] { display: none !important; }',
    '[id*="ad-banner"], [id*="ad_banner"], [class*="ad-banner"], [class*="ad_banner"] { display: none !important; }',
    'body { overscroll-behavior: contain !important; }'
  ].join('\\n');
  (document.head || document.documentElement).appendChild(style);

  // ---------- DOM cleanup ----------
  function removeOverlays() {
    var els = document.querySelectorAll('div, a, span, aside, section');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var st;
      try { st = window.getComputedStyle(el); } catch(_) { continue; }
      var z = parseInt(st.zIndex) || 0;
      var pos = st.position;
      if ((pos === 'fixed' || pos === 'absolute') && z > 50) {
        var rect = el.getBoundingClientRect();
        var op = parseFloat(st.opacity);
        var bg = st.backgroundColor;
        if (rect.width > 100 && rect.height > 100) {
          var transparent = op < 0.1 || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
          var notPlayer = !el.querySelector('video, iframe') &&
                          !el.closest('[class*="player"]') &&
                          !el.closest('[id*="player"]') &&
                          !((el.className || '') + '').includes('player') &&
                          !((el.id || '') + '').includes('player');
          if (transparent && notPlayer) {
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
      if (ifr.closest('[class*="player"]') || ifr.closest('[id*="player"]')) continue;
      var src = (ifr.src || '').toLowerCase();
      if (isAllowedHost(src)) continue;
      var st;
      try { st = window.getComputedStyle(ifr); } catch(_) { st = null; }
      if (st && (st.display === 'none' || ifr.width === '0' || ifr.height === '0' ||
          parseInt(st.width) < 10 || parseInt(st.height) < 10)) {
        try { ifr.remove(); } catch(_) {}
        continue;
      }
      if (src === '' || src === 'about:blank') {
        try { ifr.remove(); } catch(_) {}
        continue;
      }
      if (src) {
        try { ifr.remove(); } catch(_) {}
      }
    }

    var ads = document.querySelectorAll(
      'ins.adsbygoogle, div.adsbygoogle, [data-ad-client], [data-ad-slot], [id*="banner_ad"], [class*="banner_ad"]'
    );
    for (var j = 0; j < ads.length; j++) { try { ads[j].remove(); } catch(_) {} }

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

  function maybePromotePlayerFrame() {
    if (!window.__BMB_PROMOTE_FRAME__) return;
    try {
      var iframes = document.querySelectorAll('iframe');
      var best = null;
      var bestArea = 0;
      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        var src = iframe.src || iframe.getAttribute('src') || '';
        if (!src || src === 'about:blank') continue;
        var lower = src.toLowerCase();
        if (lower.indexOf('doubleclick') !== -1 || lower.indexOf('googlesyndication') !== -1 || lower.indexOf('/ads') !== -1) continue;
        var rect = iframe.getBoundingClientRect();
        var area = rect.width * rect.height;
        var looksLikePlayer =
          area > 60000 ||
          lower.indexOf('embed') !== -1 ||
          lower.indexOf('player') !== -1 ||
          lower.indexOf('stream') !== -1 ||
          lower.indexOf('video') !== -1;
        if (looksLikePlayer && area >= bestArea) {
          best = src;
          bestArea = area;
        }
      }
      if (best && window.__BMB_LAST_PLAYER_FRAME__ !== best) {
        window.__BMB_LAST_PLAYER_FRAME__ = best;
        send('playerFrame', { url: best });
      }
    } catch(_) {}
  }

  function attemptTvPlay() {
    function fireTouch(el, type, x, y) {
      try {
        var t = (typeof Touch === 'function') ? new Touch({
          identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y
        }) : null;
        var init = { bubbles: true, cancelable: true, composed: true, view: window };
        if (t) { init.touches = (type === 'touchend' ? [] : [t]); init.targetTouches = (type === 'touchend' ? [] : [t]); init.changedTouches = [t]; }
        var evt = (typeof TouchEvent === 'function') ? new TouchEvent(type, init) : new Event(type, init);
        el.dispatchEvent(evt);
      } catch(_) {}
    }
    function clickElement(el) {
      if (!el) return false;
      var rect; try { rect = el.getBoundingClientRect(); } catch(_) { rect = {left:0,top:0,width:0,height:0}; }
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
          var rect = candidates[c].getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            played = clickElement(candidates[c]) || played;
          }
        }
      } catch(_) {}
    }

    // Click multiple points so an overlay covering the play button still triggers it.
    try {
      var w = window.innerWidth, h = window.innerHeight;
      var pts = [[w/2, h/2], [w/2, h*0.45], [w/2, h*0.55], [w*0.45, h/2], [w*0.55, h/2]];
      for (var p = 0; p < pts.length; p++) {
        var el = document.elementFromPoint(pts[p][0], pts[p][1]);
        if (el) played = clickElement(el) || played;
      }
    } catch(_) {}

    // Send Enter to document.body in case the player binds global keypress.
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
              var toggleResult = v.play && v.play();
              if (toggleResult && toggleResult.catch) toggleResult.catch(function(){});
            } else {
              v.pause();
            }
            handled = true;
          } else if (command === 'pause') {
            v.pause();
            handled = true;
          } else if (command === 'seekForward') {
            if (Number.isFinite(v.duration)) v.currentTime = Math.min(v.duration, v.currentTime + 15);
            else v.currentTime = v.currentTime + 15;
            handled = true;
          } else if (command === 'seekBackward') {
            v.currentTime = Math.max(0, v.currentTime - 15);
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

  maybePromotePlayerFrame();
  removeAds();
  unmuteAllVideos();
  try {
    var observer = new MutationObserver(function(){ maybePromotePlayerFrame(); removeAds(); unmuteAllVideos(); });
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['muted']
      });
    }
  } catch(_) {}
  setInterval(function(){ maybePromotePlayerFrame(); removeAds(); unmuteAllVideos(); }, 800);
})();
true;
`;

const SecureVideoWebView = forwardRef<SecureVideoWebViewHandle, SecureVideoWebViewProps>(
  function SecureVideoWebView({ url, promotePlayerFrame = false, interactive = false }, ref) {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState(url);
  const currentUrlRef = useRef(url);
  const promotedFrameRef = useRef<string | null>(null);

  React.useEffect(() => {
    currentUrlRef.current = url;
    promotedFrameRef.current = null;
    setSourceUrl(url);
  }, [url]);

  useImperativeHandle(
    ref,
    () => ({
      injectJavaScript: (script: string) => {
        webRef.current?.injectJavaScript(script);
      },
      reload: () => {
        webRef.current?.reload();
      },
      requestFocus: () => {
        const w = webRef.current as unknown as { requestFocus?: () => void } | null;
        w?.requestFocus?.();
      },
    }),
    []
  );


  const getInitialHost = useCallback(() => {
    try {
      return new URL(currentUrlRef.current).hostname;
    } catch {
      return "";
    }
  }, []);

  const handleRequest = useCallback(
    ({ url: reqUrl }: { url: string }) => {
      if (!reqUrl || reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
        return true;
      }
      if (reqUrl === "about:blank") {
        console.log("[AdBlock] ✗ Blocked: about:blank");
        return false;
      }

      const lower = reqUrl.toLowerCase();
      if (VIDEO_FILE_PATTERNS.test(reqUrl)) return true;

      const isAllowed = ALLOWED_DOMAINS.some((d) => lower.includes(d));
      if (isAllowed) return true;

      try {
        const initialHost = getInitialHost();
        const reqHost = new URL(reqUrl).hostname;
        if (reqHost === initialHost || reqHost.endsWith("." + initialHost)) {
          return true;
        }
        if (reqHost.includes("multiembed") || reqHost.includes("streamingnow")) {
          return true;
        }
      } catch {}

      console.log("[AdBlock] ✗ Blocked nav:", reqUrl.substring(0, 60));
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
          source={{ uri: sourceUrl }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={{ flex: 1, width: width, height: "100%" }}
          focusable={!Platform.isTV || interactive}
          accessible={!Platform.isTV || interactive}
          importantForAccessibility={
            Platform.isTV && !interactive ? "no-hide-descendants" : "auto"
          }
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          // Inject into EVERY frame (incl. ad iframes), at document_start AND end
          injectedJavaScriptBeforeContentLoaded={
            (promotePlayerFrame && Platform.isTV
              ? "window.__BMB_PROMOTE_FRAME__=true;"
              : "window.__BMB_PROMOTE_FRAME__=false;") + BEFORE_LOAD_SCRIPT
          }
          injectedJavaScript={RUNTIME_SCRIPT}
          injectedJavaScriptForMainFrameOnly={false}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
          onShouldStartLoadWithRequest={handleRequest}
          originWhitelist={["*"]}
          mixedContentMode="compatibility"
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          // Android-specific
          androidLayerType="hardware"
          cacheEnabled={false}
          incognito
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
              } else if (msg && msg.tag === "playerFrame") {
                const frameUrl = msg.data?.url;
                if (
                  promotePlayerFrame &&
                  Platform.isTV &&
                  typeof frameUrl === "string" &&
                  /^https?:\/\//i.test(frameUrl) &&
                  frameUrl !== sourceUrl &&
                  frameUrl !== promotedFrameRef.current
                ) {
                  promotedFrameRef.current = frameUrl;
                  currentUrlRef.current = frameUrl;
                  setSourceUrl(frameUrl);
                }
              }
            } catch {
              console.log("[WebView]:", event.nativeEvent.data);
            }
          }}
        />
      )}
    </View>
  );
  }
);

export default SecureVideoWebView;

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
