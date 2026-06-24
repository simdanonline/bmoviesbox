import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  AppState,
  AppStateStatus,
  Alert,
  ToastAndroid,
  Pressable,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Video, {
  VideoRef,
  OnLoadData,
  OnAudioTracksData,
  OnTextTracksData,
  SelectedTrackType,
} from "react-native-video";
import { VLCPlayer } from "react-native-vlc-media-player";
import type { VideoInfo } from "react-native-vlc-media-player";
import * as Brightness from "expo-brightness";
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PlayerLevelIndicator from "../components/PlayerLevelIndicator";
import AirPlayButton from "../components/AirPlayButton";
import {
  applyVerticalDelta,
  gestureAxisForX,
  type GestureAxis,
} from "../utils/playerGestureMath";
import Focusable from "../components/Focusable";
import { useTVBackHandler } from "../hooks/useTVBackHandler";
import { ResolvedStream } from "../services/MovieAPI";
import { DownloadManager } from "../services/DownloadManager";
import {
  markBadPlaybackSource,
  PlaybackSourceContext,
} from "../utils/playbackSourceHealth";
import {
  getSourceLanguageBadges,
  getSourceLanguageLabel,
  trackTextMatchesIso,
} from "../utils/sourceLanguage";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import TrackSelectionMenu, {
  PlayerTrack,
} from "../components/TrackSelectionMenu";
import type { Season } from "../services/MovieAPI";
import {
  getNextEpisode,
  resolveEpisodePlayback,
  type SeriesRef,
} from "../utils/episodePlayback";
import { useUserData } from "../context/UserDataContext";

type NativeVideoPlayerProps = NativeStackScreenProps<any, "NativeVideoPlayer">;

const CONTROLS_HIDE_MS = 4000;
const SEEK_STEP_MS = 10_000;
// TV D-pad seeking: vanilla RN (not react-native-tvos) exposes no arrow-key
// events, so a focused bar can't listen for left/right itself. Instead the
// progress bar is overlaid with this many invisible focusable segments —
// D-pad left/right walks native focus across them (each focus move previews
// that position on the thumb + timestamp) and OK commits the seek. The
// preview is anchored to the live position on entry (not the segment's
// absolute fraction), so it always starts where playback is — see
// tvScrubPreviewFraction. The «10s / 10s» buttons remain for fine seeking.
const TV_SEEK_SEGMENTS = 20;
// Save watch progress no more than every 5 seconds — anything more is wasted
// AsyncStorage writes for a UX that resumes within ±5s anyway.
const PROGRESS_SAVE_INTERVAL_MS = 5_000;
// Don't try to resume from positions within 30s of the end; the user clearly
// finished watching last time.
const RESUME_THRESHOLD_FROM_END_MS = 30_000;
// A source that loads but reports a positive-but-implausibly-short duration is
// almost certainly a fake/error clip (e.g. torrentio's "failed to fetch"
// sentinel that plays a few seconds of "an error occurred"), not the real
// title. Preflight can't catch these — they're valid media bytes — so we reject
// them on load and auto-advance. duration === 0 ("unknown", e.g. some HLS/live)
// is left alone; no real movie or episode is under this floor.
const MIN_VALID_DURATION_MS = 3 * 60_000;

// Credits ("outro") heuristic for the persistent Next-episode prompt. There's
// no real credits metadata for these streams, so the prompt appears once the
// remaining time drops under a fraction of the runtime, capped so long movies
// or TV episodes don't surface it absurdly early.
const OUTRO_WINDOW_FRACTION = 0.05;
const OUTRO_WINDOW_MAX_MS = 2 * 60_000;
// AsyncStorage prefix for streamed-playback resume points (downloads use the
// DownloadManager's own progress field instead).
const STREAM_PROGRESS_KEY_PREFIX = "@bmoviebox_stream_progress::";
// When playback is paused (or the app backgrounded) the player fills its buffer
// and stops reading, leaving the HTTP connection to the origin idle. Servers /
// CDNs (incl. Real-Debrid) close idle sockets after a few minutes, so resuming
// reads from a dead connection and fails. If the idle gap is at least this long
// we proactively re-open the stream from the current position instead of
// trusting the stale connection.
const RECONNECT_AFTER_IDLE_MS = 60_000;
// After any resume/foreground we keep a short window where a playback error is
// treated as the expected dead-connection symptom: we silently reload the same
// URL from position rather than blacklisting the source and skipping. Covers
// short pauses where we didn't pre-emptively reload but the socket still died.
const RECONNECT_GRACE_MS = 20_000;
// Cap silent reload attempts per resume. If the same URL still won't play after
// this many tries the connection drop isn't transient — fall through to the
// normal advance-and-blacklist path so the user isn't stuck in a reload loop.
const MAX_RECONNECT_ATTEMPTS = 2;

// User-selectable playback speeds. 1 is normal; applied to both players via
// their `rate` prop and surfaced through the speed menu. Kept across source
// switches and reconnect remounts (it's a session preference, not per-stream).
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

// "1x", "1.5x", "0.5x" — drops a trailing ".0" so whole speeds read cleanly.
const formatRate = (rate: number): string => `${rate}x`;

// VLC is only needed on iOS for containers AVPlayer can't open (MKV today;
// extensible to other formats later). Android's ExoPlayer handles MKV
// natively in react-native-video, so always use the main player there.
const needsVlc = (stream: ResolvedStream | undefined): boolean => {
  if (!stream) return false;
  if (Platform.OS !== "ios") return false;
  return stream.type === "mkv";
};

const formatSize = (bytes?: number) => {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

const formatTime = (ms: number): string => {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// react-native-video needs an explicit `type` for HLS streams whose URL
// doesn't end in .m3u8. For our magnet-resolved direct files we leave it
// undefined and let the extension drive detection.
const sourceTypeFor = (stream: ResolvedStream): "m3u8" | undefined =>
  stream.type === "hls" ? "m3u8" : undefined;

// Headers are critical for some CDNs (Referer/Origin). For VLC they're
// translated to libVLC --http-* flags.
const vlcInitOptionsFor = (stream: ResolvedStream): string[] => {
  const opts: string[] = ["--network-caching=1500"];
  const h = stream.headers ?? {};
  const ref = h.Referer ?? h.referer;
  const ua = h["User-Agent"] ?? h["user-agent"];
  if (ref) opts.push(`--http-referrer=${ref}`);
  if (ua) opts.push(`--http-user-agent=${ua}`);
  return opts;
};

export default function NativeVideoPlayer({
  route,
  navigation,
}: NativeVideoPlayerProps) {
  const {
    streams,
    title,
    recordId,
    initialPositionMs,
    sourceContext,
    streamProgressKey,
    originalLanguage,
    seriesContext,
  } = route.params as {
    streams: ResolvedStream[];
    title: string;
    /** If set, watch progress is saved back to this download record so the
     * next open can resume from the saved position. */
    recordId?: string;
    /** Where to start playback. Used to resume offline downloads. */
    initialPositionMs?: number;
    /** Network playback context used to remember sources the player rejected. */
    sourceContext?: PlaybackSourceContext;
    /** AsyncStorage key under STREAM_PROGRESS_KEY_PREFIX for resuming streamed
     * playback. Ignored when `recordId` is set (downloads have their own
     * progress field). Typically the movie URL, or `${seriesUrl}::s${n}e${m}`. */
    streamProgressKey?: string;
    /** Title's original language as an ISO-639 code (e.g. "ja"). When set, the
     * player auto-selects the matching audio track to avoid dubs. */
    originalLanguage?: string;
    /** Series playback context. Present only for episodes — drives the "next
     * episode" button, the end-of-episode autoplay countdown, and marking the
     * episode watched. Absent for movies and downloads. */
    seriesContext?: {
      seriesId: string;
      seriesUrl: string;
      seriesTitle: string;
      seasons: Season[];
      season: number;
      episode: number;
    };
  };

  const insets = useSafeAreaInsets();
  // External (AirPlay) video playback is allowed only while this screen is
  // focused, so navigating away pulls video back from the TV instead of leaving
  // a half-connected session behind. (The audio route is system-sticky — the
  // always-visible route button is how the user moves audio back.)
  const isFocused = useIsFocused();
  const { markEpisodeWatched } = useUserData();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  // Audio/subtitle track selection (iOS only — Android uses ExoPlayer's native
  // menu). Tracks are normalized from rnv's onAudioTracks/onTextTracks and
  // VLC's onLoad payload into a common PlayerTrack[] shape. selectedTextKey of
  // -1 means subtitles off (matches VLC's native "disable" id).
  const [audioTracks, setAudioTracks] = useState<PlayerTrack[]>([]);
  const [textTracks, setTextTracks] = useState<PlayerTrack[]>([]);
  const [selectedAudioKey, setSelectedAudioKey] = useState<number | null>(null);
  const [selectedTextKey, setSelectedTextKey] = useState<number>(-1);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  // Playback-speed menu + the active rate (1 = normal). Both players take it via
  // their `rate` prop; the rate persists across source switches and reconnects.
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  // `hasStarted` flips true the first time playback actually advances —
  // tracked separately from `errored` so re-buffer events during normal
  // playback can't drag the loading overlay back on screen. (rnv's onBuffer
  // fires `true` mid-stream but its `false` follow-up is unreliable.)
  const [hasStarted, setHasStarted] = useState(false);
  const [errored, setErrored] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // Bumped to force a fresh player instance (via the `key` prop) when we need to
  // re-open the stream from the current position — see the reconnect logic.
  const [reloadNonce, setReloadNonce] = useState(0);
  // True while resolving the next episode's streams (between tapping Next /
  // countdown expiry and the navigation.replace). Drives the button label.
  const [advancing, setAdvancing] = useState(false);
  // Seconds left on the end-of-episode autoplay countdown; null when idle.
  const [countdown, setCountdown] = useState<number | null>(null);
  // True once the user dismisses the outro Next-episode prompt ("watch the
  // credits"). Cleared whenever playback leaves the outro window, so seeking
  // back out and returning re-arms the prompt.
  const [outroDismissed, setOutroDismissed] = useState(false);

  // VLC-only playback state. Times are milliseconds (matches native VLC API).
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  // VLC's `seek` prop expects a fraction 0..1. We set it as a one-shot value
  // each time the user seeks; setting the same fraction twice won't re-trigger,
  // so consecutive nudges naturally produce distinct fractions via position.
  const [seekFraction, setSeekFraction] = useState<number | undefined>(
    undefined,
  );
  // Scrubber state. `null` = not actively dragging; any number means the user
  // is mid-drag and the progress bar should render this fraction instead of
  // the live `positionMs`. Decoupled so the bar doesn't snap back to the
  // actual position between drag frames.
  const [scrubFraction, setScrubFraction] = useState<number | null>(null);
  // TV D-pad scrub state: index of the focused seek segment (see
  // TV_SEEK_SEGMENTS), or null when focus is elsewhere. Same display role as
  // scrubFraction but driven by focus moves instead of touch.
  const [tvScrubIndex, setTvScrubIndex] = useState<number | null>(null);
  // Anchor recorded the moment focus enters the bar: the entry segment and the
  // live position then. The preview maps segments relative to this anchor so it
  // starts at the current position instead of the segment's absolute fraction
  // (which would snap to a fixed spot every re-entry). Re-seeded on each fresh
  // entry; held in a ref because it's read during render but never drives one.
  const tvScrubAnchorRef = useRef<{ index: number; fraction: number } | null>(
    null,
  );
  // True while native focus sits on some seek segment. Lets onBlur tell a
  // segment-to-segment move (focus immediately returns) from leaving the bar.
  const tvFocusInRowRef = useRef(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Controls lock. When on, every interactive overlay is suppressed and the
  // surface stops adjusting brightness/volume — a tap only reveals the unlock
  // affordance. Prevents accidental pause/seek/level changes while holding the
  // phone mid-movie. Mirrored to a ref so the memoized gesture closure can read
  // the live value without rebuilding on every toggle.
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  // Player output volume (0..1). Not the device volume — hardware buttons stay
  // independent. Passed to both players (VLC takes 0..100). Driven by the
  // right-half vertical drag.
  const [volume, setVolume] = useState(1);
  // Live brightness (0..1) for the HUD; original captured for restore on exit.
  const [brightness, setBrightness] = useState(1);
  const originalBrightnessRef = useRef<number | null>(null);
  // Video surface size, measured for the gesture math (full-height drag = full
  // 0..1 range; start-x picks brightness vs. volume).
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  // Active brightness/volume HUD (null when idle).
  const [hud, setHud] = useState<{ axis: GestureAxis; level: number } | null>(
    null,
  );
  const hudHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Captured at gesture start so updates are relative to the starting level.
  const gestureStartRef = useRef<{ axis: GestureAxis; start: number }>({
    axis: "brightness",
    start: 1,
  });
  // Live mirrors so the (memoized) gesture closure reads current levels.
  const brightnessRef = useRef(1);
  const volumeRef = useRef(1);
  // Streamed-playback resume point loaded asynchronously from AsyncStorage.
  // Merged with `initialPositionMs` (download path) by the seek effect.
  const [streamResumeMs, setStreamResumeMs] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const failureCount = useRef(0);
  const videoRef = useRef<VideoRef>(null);
  const didInitialSeekRef = useRef(false);
  // Subtitle selection is seeded from the player's reported tracks exactly once
  // per stream. Without this, a re-fired onTextTracks/onLoad would overwrite a
  // user's explicit choice (we can't use a null-guard like audio because -1 is
  // a valid user value meaning "Off").
  const didSeedTextRef = useRef(false);
  // Maps each react-native-video subtitle index (as reported by onTextTracks) to
  // its language/title. On Android the controlled `selectedTextTrack` by index is
  // broken: the native selectTextTrackInternal matches the value against the
  // per-group track index, but onTextTracks numbers tracks with a flat counter
  // across groups — so any track past the first (each subtitle is its own group)
  // matches nothing and ExoPlayer keeps subtitles off. We select by language/title
  // instead, which the native side matches across every group. See handleRnvTextTracks.
  const rnvTextMetaRef = useRef<
    Map<number, { language?: string; title?: string }>
  >(new Map());
  const lastSavedProgressMsRef = useRef(0);
  // Guards the 90%-watched write so it fires at most once per mount.
  const markedWatchedRef = useRef(false);
  // Live mirrors of state the reconnect logic reads from listeners/callbacks
  // whose closures are created once (AppState) — avoids stale captures without
  // re-subscribing every render.
  const positionMsRef = useRef(0);
  const hasStartedRef = useRef(false);
  const erroredRef = useRef(false);
  // Mirrored for showControls, whose identity must stay stable for the
  // surfaceGesture memo — depending on `paused` state would stale-capture it.
  const pausedRef = useRef(false);
  // Timestamps marking when the network last went idle. One is set while paused,
  // the other while backgrounded; whichever fired is read on resume/foreground.
  const pausedAtRef = useRef<number | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);
  // Position to seek back to once the freshly-remounted player reports onLoad.
  const pendingReloadSeekMsRef = useRef<number | null>(null);
  // Audio track to re-apply after a reconnect remount. Both players honor an
  // index/id selection only as a post-load change (the null -> value transition
  // first mount makes), not as a prop already set on a fresh instance — so on
  // remount we drop the selection to null and restore it once tracks reload.
  const pendingReloadAudioKeyRef = useRef<number | null>(null);
  // Mirror of selectedAudioKey for the stable-identity reload callback to read.
  const selectedAudioKeyRef = useRef<number | null>(null);
  // Subtitle counterpart of the two refs above: iOS/VLC select subtitles by
  // index/id, which a fresh instance only honors as a post-load change, so the
  // pick is captured and restored across a reconnect remount the same way.
  const pendingReloadTextKeyRef = useRef<number | null>(null);
  const selectedTextKeyRef = useRef<number>(-1);
  // Until this timestamp, a playback error is treated as a transient
  // dead-connection symptom (silent reload) rather than a bad source.
  const reconnectGraceUntilRef = useRef(0);
  // Silent reload attempts used within the current resume's grace window.
  const reconnectAttemptsRef = useRef(0);
  // On Android, react-native-video (ExoPlayer) decodes through device codecs and
  // fails on content the hardware can't handle — AC3/E-AC3 audio and HEVC 10-bit
  // are the usual gaps. libVLC bundles software decoders for these, so when
  // ExoPlayer errors on a source we retry that same source with VLC once before
  // blacklisting it. Stream indices bumped to VLC this way live here; the ref
  // mirror guards against a duplicate error firing before the remount lands.
  const [vlcForcedIndices, setVlcForcedIndices] = useState<Set<number>>(
    () => new Set(),
  );
  const vlcAttemptedRef = useRef<Set<number>>(new Set());

  const current = streams[currentIndex];
  const useVlc = needsVlc(current) || vlcForcedIndices.has(currentIndex);
  // The episode to play after this one (rolls across seasons), or null when
  // this isn't a series or it's the series finale. Drives the Next button and
  // the autoplay countdown.
  const nextEpisode = useMemo(
    () =>
      seriesContext
        ? getNextEpisode(
            seriesContext.seasons,
            seriesContext.season,
            seriesContext.episode,
          )
        : null,
    [seriesContext],
  );
  // Every path now uses the app's custom control overlay. The rnv `controls`
  // flag stays off so (a) ExoPlayer honors programmatic audio selection on
  // Android (its setSelectedAudioTrack only applies when `!controls`) and
  // (b) our brightness/volume gestures own the surface uniformly on both
  // platforms. VLC never had native chrome to begin with.
  const usesCustomControls = true;
  // The custom track menu is shown whenever there's an actual choice to make.
  const hasTrackChoices = audioTracks.length > 1 || textTracks.length > 0;
  const currentLanguageLabel = current ? getSourceLanguageLabel(current) : null;

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_MS,
    );
  }, [clearHideTimer]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    // While paused the controls must stay up — arming the timer here would
    // bypass the paused-state effect, which only clears it on transitions.
    if (!pausedRef.current) scheduleHide();
  }, [scheduleHide]);

  // Reset transient state when the active stream changes.
  useEffect(() => {
    setHasStarted(false);
    setErrored(false);
    setErrorMessage(null);
    setPaused(false);
    setPositionMs(0);
    setDurationMs(0);
    setSeekFraction(undefined);
    setControlsVisible(true);
    setAudioTracks([]);
    setTextTracks([]);
    setSelectedAudioKey(null);
    setSelectedTextKey(-1);
    setShowTrackMenu(false);
    setShowSpeedMenu(false);
    setLocked(false);
    scheduleHide();
  }, [currentIndex, scheduleHide]);

  // Keep controls visible while paused; resume auto-hide on play.
  useEffect(() => {
    if (paused) {
      clearHideTimer();
      setControlsVisible(true);
    } else if (hasStarted) {
      scheduleHide();
    }
  }, [paused, hasStarted, clearHideTimer, scheduleHide]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  // Hold the screen awake while actually watching. Android (and iOS) let the
  // display sleep on the OS timeout when untouched; that's wrong mid-movie. We
  // override it only while playback is live — not while paused or on the error
  // screen, where the user may have stepped away and the normal sleep timer
  // should resume. deactivateKeepAwake on cleanup releases the lock on exit.
  useEffect(() => {
    if (!hasStarted || paused || errored) return;
    void activateKeepAwakeAsync();
    return () => {
      void deactivateKeepAwake();
    };
  }, [hasStarted, paused, errored]);

  // Seed the HUD with the current screen brightness and restore it on exit so
  // we don't leave the device dimmed/brightened after playback.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const current = await Brightness.getBrightnessAsync();
        if (!active) return;
        originalBrightnessRef.current = current;
        setBrightness(current);
      } catch {
        // brightness is best-effort; ignore read failures
      }
    })();
    return () => {
      active = false;
      const original = originalBrightnessRef.current;
      if (original != null) void Brightness.setBrightnessAsync(original);
    };
  }, []);

  // Keep live mirrors current so the memoized gesture closure reads fresh levels.
  useEffect(() => {
    brightnessRef.current = brightness;
  }, [brightness]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Clear the HUD auto-hide timer on unmount.
  useEffect(
    () => () => {
      if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
    },
    [],
  );

  // Close the track menu whenever controls hide so it never floats without its
  // trigger button.
  useEffect(() => {
    if (!controlsVisible) {
      setShowTrackMenu(false);
      setShowSpeedMenu(false);
    }
  }, [controlsVisible]);

  // Reset resume bookkeeping when the active stream changes — otherwise the
  // initial-seek effect would try to apply the saved offset to a different
  // file. (User picking a different source = fresh playback.)
  useEffect(() => {
    didInitialSeekRef.current = false;
    lastSavedProgressMsRef.current = 0;
    didSeedTextRef.current = false;
    rnvTextMetaRef.current = new Map();
    // A pending reconnect-seek belongs to the previous source; dropping to a new
    // stream is fresh playback, so clear it and the reconnect bookkeeping.
    pendingReloadSeekMsRef.current = null;
    pendingReloadAudioKeyRef.current = null;
    pendingReloadTextKeyRef.current = null;
    reconnectGraceUntilRef.current = 0;
    reconnectAttemptsRef.current = 0;
  }, [currentIndex]);

  // Mirror state the AppState listener (closed over once) and the error handler
  // read, so they never see a stale value.
  useEffect(() => {
    positionMsRef.current = positionMs;
  }, [positionMs]);
  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);
  useEffect(() => {
    erroredRef.current = errored;
  }, [errored]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    selectedAudioKeyRef.current = selectedAudioKey;
  }, [selectedAudioKey]);
  useEffect(() => {
    selectedTextKeyRef.current = selectedTextKey;
  }, [selectedTextKey]);

  // Re-open the current stream from the last known position by remounting the
  // player (fresh `key`). Used both proactively on resume after a long idle and
  // reactively when a resume error is the expected dead-connection symptom.
  // Stable identity (reads refs) so the AppState subscription mounts once.
  const reloadFromCurrentPosition = useCallback(() => {
    if (!hasStartedRef.current || erroredRef.current) return;
    if (positionMsRef.current <= 0) return;
    pendingReloadSeekMsRef.current = positionMsRef.current;
    // A fresh player ignores an audio selection already set on its props, so it
    // would fall back to the native default (often a dubbed track). Remember the
    // current pick, drop to null for the remount, and re-apply it post-load —
    // the same transition that makes the selection stick on first mount.
    pendingReloadAudioKeyRef.current = selectedAudioKeyRef.current;
    setSelectedAudioKey(null);
    // Subtitles share the same fresh-instance limitation: capture the pick, drop
    // to "Off", and let the re-fired track handlers restore it post-load.
    pendingReloadTextKeyRef.current = selectedTextKeyRef.current;
    didSeedTextRef.current = false;
    setSelectedTextKey(-1);
    setReloadNonce((n) => n + 1);
  }, []);

  // Resume after a pause: open a reconnect grace window, and if the player sat
  // idle long enough that the origin likely dropped the socket, re-open now
  // rather than waiting for the stale-connection read to fail.
  useEffect(() => {
    if (paused) {
      pausedAtRef.current = Date.now();
      return;
    }
    const pausedAt = pausedAtRef.current;
    pausedAtRef.current = null;
    if (pausedAt === null || !hasStartedRef.current) return;
    reconnectAttemptsRef.current = 0;
    reconnectGraceUntilRef.current = Date.now() + RECONNECT_GRACE_MS;
    if (Date.now() - pausedAt >= RECONNECT_AFTER_IDLE_MS) {
      reloadFromCurrentPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Background/foreground: an idle period spent in the background drops the
  // connection the same way a long pause does (and `playInBackground={false}`
  // stops playback outright). Treat returning to the foreground like a resume.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (bgAt === null || !hasStartedRef.current) return;
        reconnectAttemptsRef.current = 0;
        reconnectGraceUntilRef.current = Date.now() + RECONNECT_GRACE_MS;
        if (Date.now() - bgAt >= RECONNECT_AFTER_IDLE_MS) {
          reloadFromCurrentPosition();
        }
      } else if (backgroundedAtRef.current === null) {
        backgroundedAtRef.current = Date.now();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [reloadFromCurrentPosition]);

  // Load streamed-playback resume point. Skipped when a downloaded recordId is
  // active (DownloadManager owns that progress) or when no key was supplied.
  useEffect(() => {
    if (recordId) return;
    if (!streamProgressKey) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(
          STREAM_PROGRESS_KEY_PREFIX + streamProgressKey,
        );
        if (cancelled) return;
        const parsed = raw ? Number(raw) : 0;
        if (Number.isFinite(parsed) && parsed > 0) setStreamResumeMs(parsed);
      } catch {
        // ignore — resume is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordId, streamProgressKey]);

  // Effective resume point: explicit `initialPositionMs` (downloads) wins; the
  // streamed key is the streaming fallback.
  const resumeMs = initialPositionMs ?? streamResumeMs ?? 0;

  // Initial seek for resume. Fires once per stream, after duration is known.
  // We need duration on the VLC path (seek is a fraction); rnv could seek with
  // raw seconds, but waiting for onLoad simplifies the state machine.
  useEffect(() => {
    if (didInitialSeekRef.current) return;
    if (!resumeMs || resumeMs <= 0) return;
    if (durationMs <= 0) return;
    // Don't resume if we're within the threshold of the end.
    if (durationMs - resumeMs < RESUME_THRESHOLD_FROM_END_MS) {
      didInitialSeekRef.current = true;
      return;
    }
    if (useVlc) {
      setSeekFraction(resumeMs / durationMs);
      setPositionMs(resumeMs);
    } else {
      videoRef.current?.seek(resumeMs / 1000);
      setPositionMs(resumeMs);
    }
    didInitialSeekRef.current = true;
  }, [durationMs, resumeMs, useVlc]);

  // Throttled save: only persist when position has moved at least
  // PROGRESS_SAVE_INTERVAL_MS. Downloads write to DownloadManager; streamed
  // playback writes to AsyncStorage under STREAM_PROGRESS_KEY_PREFIX.
  const saveProgressIfDue = (currentMs: number) => {
    if (!recordId && !streamProgressKey) return;
    if (
      currentMs - lastSavedProgressMsRef.current <
      PROGRESS_SAVE_INTERVAL_MS
    ) {
      return;
    }
    lastSavedProgressMsRef.current = currentMs;
    if (recordId) {
      void DownloadManager.setWatchProgress(recordId, currentMs);
    } else if (streamProgressKey) {
      void AsyncStorage.setItem(
        STREAM_PROGRESS_KEY_PREFIX + streamProgressKey,
        String(currentMs),
      );
    }
  };

  // Mark the current episode watched once playback passes 90%. Fires at most
  // once per mount (ref-guarded) and only for series playback — so a user who
  // bails during the credits still gets credit for finishing.
  const maybeMarkWatched = (currentMs: number) => {
    if (markedWatchedRef.current) return;
    if (!seriesContext || durationMs <= 0) return;
    if (currentMs / durationMs < 0.9) return;
    const season = seriesContext.seasons.find(
      (s) => s.seasonNumber === seriesContext.season,
    );
    const ep = season?.episodes.find(
      (e) => e.episodeNumber === seriesContext.episode,
    );
    if (!ep) return;
    markedWatchedRef.current = true;
    markEpisodeWatched({
      seriesUrl: seriesContext.seriesUrl,
      episodeUrl: ep.episodeUrl,
      episodeTitle: ep.episodeTitle,
      seasonNumber: seriesContext.season,
      episodeNumber: seriesContext.episode,
    });
  };

  // Final save on unmount — captures the position right before the user
  // backs out, even if the throttle window hadn't elapsed.
  useEffect(() => {
    return () => {
      // Avoid saving 0 if the user backs out before playback ever started.
      if (lastSavedProgressMsRef.current === 0) return;
      if (recordId) {
        void DownloadManager.setWatchProgress(
          recordId,
          lastSavedProgressMsRef.current,
        );
      } else if (streamProgressKey) {
        void AsyncStorage.setItem(
          STREAM_PROGRESS_KEY_PREFIX + streamProgressKey,
          String(lastSavedProgressMsRef.current),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, streamProgressKey]);

  const markStarted = () => {
    setHasStarted(true);
    setErrored(false);
  };

  useTVBackHandler(() => {
    if (showPicker) {
      setShowPicker(false);
      return;
    }
    if (showTrackMenu) {
      setShowTrackMenu(false);
      return;
    }
    if (showSpeedMenu) {
      setShowSpeedMenu(false);
      return;
    }
    // While controls are on-screen, back should dismiss the overlay rather
    // than exit playback. Errored state still goes back so the user isn't
    // trapped on the failure screen.
    if (controlsVisible && !errored) {
      clearHideTimer();
      setControlsVisible(false);
      return;
    }
    navigation.goBack();
  });

  const advanceOnError = (msg: string) => {
    // An error landing in the post-resume grace window is the expected
    // dead-connection symptom, not a bad source. Silently re-open the same URL
    // from position instead of blacklisting it and skipping. Capped so a URL
    // that's genuinely gone still falls through to the real failure path below.
    if (
      Date.now() < reconnectGraceUntilRef.current &&
      hasStartedRef.current &&
      !erroredRef.current &&
      positionMsRef.current > 0 &&
      reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
    ) {
      reconnectAttemptsRef.current += 1;
      // Extend the window so the reload's own load/buffer phase is still covered.
      reconnectGraceUntilRef.current = Date.now() + RECONNECT_GRACE_MS;
      console.warn(
        `[NativeVideoPlayer] reconnecting stream ${currentIndex} after resume error (attempt ${reconnectAttemptsRef.current}): ${msg}`,
      );
      reloadFromCurrentPosition();
      return;
    }
    setErrored(true);
    setErrorMessage(msg);
    failureCount.current += 1;
    console.warn(`[NativeVideoPlayer] stream ${currentIndex} failed: ${msg}`);
    if (sourceContext && current) {
      void markBadPlaybackSource(current, sourceContext, msg);
    }
    if (currentIndex + 1 < streams.length) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // Called from both players' onLoad. Returns true (and kicks off an advance) if
  // the loaded media is too short to be the real title, so the caller can bail
  // before applying duration/track state from a bogus source.
  const rejectShortDurationAndAdvance = (loadedMs: number): boolean => {
    if (loadedMs <= 0 || loadedMs >= MIN_VALID_DURATION_MS) return false;
    // Local downloads are known-good; never auto-skip them.
    if (!current || current.url.startsWith("file://")) return false;
    advanceOnError(
      `Source is only ${formatTime(loadedMs)} long — likely not the full title.`,
    );
    return true;
  };

  const handleTryNext = () => {
    if (currentIndex + 1 < streams.length) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handlePickStream = (idx: number) => {
    setCurrentIndex(idx);
    setShowPicker(false);
    failureCount.current = 0;
  };

  const handleVlcProgress = (e: { currentTime: number; duration: number }) => {
    setPositionMs(e.currentTime);
    if (e.duration > 0) setDurationMs(e.duration);
    saveProgressIfDue(e.currentTime);
    maybeMarkWatched(e.currentTime);
    markStarted();
  };

  const handleVlcLoad = (e: VideoInfo) => {
    // VLC reports duration in ms already.
    if (rejectShortDurationAndAdvance(e.duration > 0 ? e.duration : 0)) return;
    if (e.duration > 0) setDurationMs(e.duration);
    // Restore position after a reconnect remount. VLC seeks by fraction, so this
    // needs the freshly-reported duration.
    const reloadSeekMs = pendingReloadSeekMsRef.current;
    if (reloadSeekMs != null && reloadSeekMs > 0 && e.duration > 0) {
      setSeekFraction(reloadSeekMs / e.duration);
      setPositionMs(reloadSeekMs);
      pendingReloadSeekMsRef.current = null;
    }
    const audio: PlayerTrack[] = (e.audioTracks ?? []).map((t, i) => ({
      key: t.id,
      label: t.name || `Track ${i + 1}`,
    }));
    setAudioTracks(audio);
    if (audio.length > 0) {
      // Prefer the original-language track (matched against VLC's free-text
      // name); fall back to the first track when there's no match or no
      // reference language. Seeded once per stream so a re-fired onLoad can't
      // clobber a user's later manual choice.
      const original = (e.audioTracks ?? []).find((t) =>
        trackTextMatchesIso(t.name, originalLanguage),
      );
      // After a reconnect remount, restore the track that was playing (original
      // or a manual pick) when it still exists; otherwise seed the original.
      const pendingReload = pendingReloadAudioKeyRef.current;
      pendingReloadAudioKeyRef.current = null;
      const reloadKey =
        pendingReload !== null && audio.some((t) => t.key === pendingReload)
          ? pendingReload
          : null;
      const target = reloadKey ?? (original ? original.id : audio[0].key);
      setSelectedAudioKey((prev) => (prev === null ? target : prev));
    }
    // VLC may already include a "disable"/id -1 row; drop it and add a single
    // synthetic "Off" so the option appears exactly once.
    const subs: PlayerTrack[] = (e.textTracks ?? [])
      .filter((t) => t.id !== -1)
      .map((t, i) => ({ key: t.id, label: t.name || `Track ${i + 1}` }));
    setTextTracks(subs.length > 0 ? [{ key: -1, label: "Off" }, ...subs] : []);
    // VLC reports no default-selected subtitle; seed "Off" once per stream so a
    // re-fired onLoad can't override a user's later choice. After a reconnect
    // remount, restore the prior pick instead when that track still exists.
    if (!didSeedTextRef.current) {
      const pendingReloadText = pendingReloadTextKeyRef.current;
      pendingReloadTextKeyRef.current = null;
      const restored =
        pendingReloadText !== null &&
        (pendingReloadText === -1 ||
          subs.some((t) => t.key === pendingReloadText))
          ? pendingReloadText
          : -1;
      setSelectedTextKey(restored);
      didSeedTextRef.current = true;
    }
    markStarted();
  };

  // rnv's onLoad gives duration in seconds. Track it in ms so the resume
  // effect (shared with VLC) has the units it expects.
  const handleRnvLoad = (data: OnLoadData) => {
    const loadedMs = data.duration > 0 ? data.duration * 1000 : 0;
    if (rejectShortDurationAndAdvance(loadedMs)) return;
    if (loadedMs > 0) setDurationMs(loadedMs);
    // Restore position after a reconnect remount (rnv seeks in seconds).
    const reloadSeekMs = pendingReloadSeekMsRef.current;
    if (reloadSeekMs != null && reloadSeekMs > 0) {
      videoRef.current?.seek(reloadSeekMs / 1000);
      setPositionMs(reloadSeekMs);
      pendingReloadSeekMsRef.current = null;
    }
    markStarted();
  };

  const handleRnvProgress = (data: { currentTime: number }) => {
    const ms = data.currentTime * 1000;
    setPositionMs(ms);
    saveProgressIfDue(ms);
    maybeMarkWatched(ms);
    markStarted();
  };

  const handleRnvAudioTracks = (e: OnAudioTracksData) => {
    const tracks: PlayerTrack[] = e.audioTracks.map((t) => ({
      key: t.index,
      label: t.title || t.language || `Track ${t.index + 1}`,
    }));
    setAudioTracks(tracks);
    // Prefer the original-language audio (by ISO code or title) when we know it,
    // else the track the player marked selected, else the first. Seeded only
    // while no choice exists for this stream (reset to null on stream change) so
    // a re-fired event or a user's manual pick is never overridden.
    const original = e.audioTracks.find(
      (t) =>
        trackTextMatchesIso(t.language, originalLanguage) ||
        trackTextMatchesIso(t.title, originalLanguage),
    );
    const sel = e.audioTracks.find((t) => t.selected);
    // After a reconnect remount, restore the track that was playing (original or
    // a manual pick) when it still exists; otherwise seed the original.
    const pendingReload = pendingReloadAudioKeyRef.current;
    pendingReloadAudioKeyRef.current = null;
    const reloadKey =
      pendingReload !== null && tracks.some((t) => t.key === pendingReload)
        ? pendingReload
        : null;
    const target =
      reloadKey ?? original?.index ?? sel?.index ?? tracks[0]?.key ?? null;
    if (target !== null) {
      setSelectedAudioKey((prev) => (prev === null ? target : prev));
    }
  };

  const handleRnvTextTracks = (e: OnTextTracksData) => {
    const subs: PlayerTrack[] = e.textTracks.map((t) => ({
      key: t.index,
      label: t.title || t.language || `Track ${t.index + 1}`,
    }));
    // Remember each track's language/title so the Android selection path can
    // target it by name instead of the broken index match (see rnvTrackProps).
    const meta = new Map<number, { language?: string; title?: string }>();
    e.textTracks.forEach((t) =>
      meta.set(t.index, { language: t.language, title: t.title }),
    );
    rnvTextMetaRef.current = meta;
    // Only offer subtitles (with an "Off" entry) when real tracks exist.
    setTextTracks(subs.length > 0 ? [{ key: -1, label: "Off" }, ...subs] : []);
    // Seed the initial selection once so re-fires don't clobber a user choice.
    // After a reconnect remount, restore the prior pick when it still exists.
    if (!didSeedTextRef.current) {
      const pendingReloadText = pendingReloadTextKeyRef.current;
      pendingReloadTextKeyRef.current = null;
      let next: number;
      if (pendingReloadText !== null) {
        next =
          pendingReloadText === -1 ||
          e.textTracks.some((t) => t.index === pendingReloadText)
            ? pendingReloadText
            : -1;
      } else {
        const sel = e.textTracks.find((t) => t.selected);
        next = sel ? sel.index : -1;
      }
      setSelectedTextKey(next);
      didSeedTextRef.current = true;
    }
  };

  // Seek helpers shared by every custom-controls path. VLC seeks by fraction
  // (the `seek` prop); rnv seeks imperatively in seconds via the ref.
  const seekToMs = (target: number) => {
    if (useVlc) {
      setSeekFraction(target / durationMs);
    } else {
      videoRef.current?.seek(target / 1000);
    }
    setPositionMs(target); // optimistic — next onProgress will replace
    showControls();
  };

  const seekBy = (deltaMs: number) => {
    if (durationMs <= 0) return;
    seekToMs(Math.max(0, Math.min(durationMs - 1000, positionMs + deltaMs)));
  };

  const seekToFraction = (fraction: number) => {
    if (durationMs <= 0) return;
    seekToMs(Math.max(0, Math.min(1, fraction)) * durationMs);
  };

  // Fraction a focused segment previews, relative to the entry anchor: the
  // anchor segment maps to the live position; segments to its left compress
  // [0 .. live], to its right compress [live .. 1]. So the whole timeline is
  // reachable in one motion from a centred entry, yet the preview always
  // begins at the current position. Division is guarded — `index` can't pass
  // the anchor on the side whose denominator would be zero.
  const tvScrubPreviewFraction = (
    index: number,
    anchor: { index: number; fraction: number },
  ) => {
    if (index <= anchor.index) {
      return anchor.index === 0
        ? anchor.fraction
        : anchor.fraction * (index / anchor.index);
    }
    const span = TV_SEEK_SEGMENTS - 1 - anchor.index;
    return anchor.fraction + (1 - anchor.fraction) * ((index - anchor.index) / span);
  };

  const commitTvScrub = (index: number) => {
    if (durationMs <= 0 || !tvScrubAnchorRef.current) return;
    const fraction = tvScrubPreviewFraction(index, tvScrubAnchorRef.current);
    // Clamp away from the very end (like seekBy) so committing the last
    // segment doesn't land on durationMs and immediately fire onEnd.
    seekToMs(Math.max(0, Math.min(durationMs - 1000, fraction * durationMs)));
    // Drop the preview + anchor so the bar tracks live playback again; the
    // next focus move re-anchors at the just-sought position.
    tvScrubAnchorRef.current = null;
    setTvScrubIndex(null);
  };

  const togglePaused = () => {
    setPaused((p) => !p);
    showControls();
  };

  const showHud = (axis: GestureAxis, level: number) => {
    setHud({ axis, level });
    if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
  };

  const scheduleHudHide = () => {
    if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
    hudHideTimer.current = setTimeout(() => setHud(null), 800);
  };

  // Surface gesture: a quick tap toggles controls; a vertical drag adjusts
  // brightness (left half) or volume (right half). The recognizers race so a
  // completed tap wins unless the finger first crosses the vertical-drag
  // threshold. Horizontal motion fails both and remains available to navigation.
  const surfaceGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(20)
      .onEnd((_event, success) => {
        if (!success) return;
        if (controlsVisible) {
          clearHideTimer();
          setControlsVisible(false);
        } else {
          showControls();
        }
      });

    const verticalPan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-20, 20])
      .failOffsetX([-24, 24])
      .onStart((e) => {
        // Locked: ignore brightness/volume drags entirely.
        if (lockedRef.current) return;
        const axis = gestureAxisForX(e.x, surfaceSize.width);
        const start =
          axis === "brightness" ? brightnessRef.current : volumeRef.current;
        gestureStartRef.current = { axis, start };
        showHud(axis, start);
      })
      .onUpdate((e) => {
        if (lockedRef.current) return;
        const { axis, start } = gestureStartRef.current;
        const next = applyVerticalDelta(
          start,
          e.translationY,
          surfaceSize.height,
        );
        if (axis === "brightness") {
          setBrightness(next);
          void Brightness.setBrightnessAsync(next);
        } else {
          setVolume(next);
        }
        showHud(axis, next);
      })
      .onFinalize(scheduleHudHide);

    return Gesture.Race(verticalPan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceSize.width, surfaceSize.height, controlsVisible]);

  // Resolve and switch to the next episode. Uses navigation.replace so episodes
  // don't pile up on the back stack and the player fully remounts (reusing all
  // the mount/seek/reconnect logic). On failure, surface a toast and stay put.
  const advanceToNextEpisode = async () => {
    if (!seriesContext || !nextEpisode || advancing) return;
    setAdvancing(true);
    const series: SeriesRef = {
      id: seriesContext.seriesId,
      url: seriesContext.seriesUrl,
      title: seriesContext.seriesTitle,
    };
    const params = await resolveEpisodePlayback(
      series,
      nextEpisode.season,
      nextEpisode.episode,
    );
    setAdvancing(false);
    if (!params) {
      if (Platform.OS === "android") {
        ToastAndroid.show("Couldn't load next episode", ToastAndroid.SHORT);
      } else {
        Alert.alert("Couldn't load next episode");
      }
      return;
    }
    navigation.replace("NativeVideoPlayer", {
      ...params,
      seriesContext: {
        seriesId: seriesContext.seriesId,
        seriesUrl: seriesContext.seriesUrl,
        seriesTitle: seriesContext.seriesTitle,
        seasons: seriesContext.seasons,
        season: nextEpisode.season,
        episode: nextEpisode.episode.episodeNumber,
      },
    });
  };

  // At end of playback: if a next episode exists, pause and start a 5s autoplay
  // countdown; otherwise preserve the original behaviour of leaving the player.
  const handlePlaybackEnded = () => {
    if (nextEpisode) {
      setPaused(true);
      setCountdown(5);
    } else {
      navigation.goBack();
    }
  };

  const cancelCountdown = () => setCountdown(null);

  // Tick the autoplay countdown once per second; advance when it reaches 0.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void advanceToNextEpisode();
      return;
    }
    const id = setTimeout(
      () => setCountdown((c) => (c === null ? null : c - 1)),
      1000,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Pan = scrub. Tap = jump-to-position (treated as a zero-distance pan).
  // runOnJS keeps callbacks on the JS thread so we can call useState setters
  // without reanimated worklets — gesture-handler v2.x supports this.
  const scrubGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin((e) => {
          if (trackWidth <= 0) return;
          clearHideTimer();
          setControlsVisible(true);
          setScrubFraction(Math.max(0, Math.min(1, e.x / trackWidth)));
        })
        .onUpdate((e) => {
          if (trackWidth <= 0) return;
          setScrubFraction(Math.max(0, Math.min(1, e.x / trackWidth)));
        })
        .onEnd((e) => {
          if (trackWidth <= 0) return;
          const fraction = Math.max(0, Math.min(1, e.x / trackWidth));
          seekToFraction(fraction);
          setScrubFraction(null);
        })
        .onFinalize(() => {
          // Safety: if the gesture is cancelled (e.g. swipe-back), clear the
          // scrub state and resume the auto-hide schedule.
          setScrubFraction(null);
          if (!paused) scheduleHide();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trackWidth, durationMs, paused],
  );

  // VLCPlayer mutates its `source` prop in render() (isNetwork, autoplay,
  // initOptions). Memoizing would reuse the same object across renders, and
  // the RN bridge deep-freezes it after the first dispatch — second render
  // throws on the mutation. A fresh object per render sidesteps the freeze.
  const vlcSource = {
    uri: current.url,
    initType: 2 as const,
    initOptions: vlcInitOptionsFor(current),
  };
  const rnvSource = useMemo(
    () => ({
      uri: current.url,
      headers: current.headers,
      type: sourceTypeFor(current),
    }),
    [current.url, current.headers, current.type],
  );

  // Resolve the controlled subtitle selection for react-native-video.
  //
  // iOS (AVPlayer) honors index-based selection — the index lines up with the
  // onTextTracks order. Android (ExoPlayer) does NOT: its selectTextTrackInternal
  // matches an "index" value against the per-group track index, while onTextTracks
  // numbers tracks with a flat counter across groups. Since each subtitle is
  // normally its own single-track group, only index 0 ever matches and every other
  // pick silently leaves subtitles off. So on Android we target the track by its
  // language (or title) instead, which the native side matches across all groups.
  const rnvSelectedTextTrack = () => {
    if (selectedTextKey === -1) {
      return { type: SelectedTrackType.DISABLED };
    }
    if (Platform.OS !== "android") {
      return { type: SelectedTrackType.INDEX, value: selectedTextKey };
    }
    const meta = rnvTextMetaRef.current.get(selectedTextKey);
    if (meta?.language) {
      return { type: SelectedTrackType.LANGUAGE, value: meta.language };
    }
    if (meta?.title) {
      return { type: SelectedTrackType.TITLE, value: meta.title };
    }
    // No language/title to match on — fall back to index (works for the first
    // track, which is the only one ExoPlayer's index path can resolve anyway).
    return { type: SelectedTrackType.INDEX, value: selectedTextKey };
  };

  // Controlled track selection for both rnv platforms. Audio stays index-based
  // (the original-audio seed in handleRnvAudioTracks resolves an exact index);
  // subtitles resolve per-platform via rnvSelectedTextTrack. This only takes
  // effect because we keep `controls={false}` on the custom-controls paths —
  // ExoPlayer ignores programmatic selection while its native controls are on
  // (see `usesCustomControls`).
  const rnvTrackProps: Partial<React.ComponentProps<typeof Video>> = {
    selectedAudioTrack:
      selectedAudioKey !== null
        ? { type: SelectedTrackType.INDEX, value: selectedAudioKey }
        : undefined,
    selectedTextTrack: rnvSelectedTextTrack(),
    onAudioTracks: handleRnvAudioTracks,
    onTextTracks: handleRnvTextTracks,
  };

  const livePositionFraction =
    durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  // Touch scrubbing and TV D-pad scrubbing share the same preview slot —
  // they can't both be active (no touch on TV, no segments off TV).
  const previewFraction =
    scrubFraction !== null
      ? scrubFraction
      : tvScrubIndex !== null && tvScrubAnchorRef.current
        ? tvScrubPreviewFraction(tvScrubIndex, tvScrubAnchorRef.current)
        : null;
  const displayFraction =
    previewFraction !== null ? previewFraction : livePositionFraction;
  const displayMs =
    previewFraction !== null ? previewFraction * durationMs : positionMs;

  // While locked, every interactive overlay is suppressed; only the unlock
  // affordance (gated on controlsVisible alone) shows through.
  const controlsActive = controlsVisible && !locked;

  // The TV seek segments unmount with the chrome, which skips their onBlur —
  // without this the preview fraction would stay pinned and the bar would
  // reopen frozen at the stale position. Clear the anchor too so the next
  // entry re-seeds at the live position.
  useEffect(() => {
    if (!controlsVisible) {
      tvScrubAnchorRef.current = null;
      tvFocusInRowRef.current = false;
      setTvScrubIndex(null);
    }
  }, [controlsVisible]);

  // Netflix-style outro prompt: once playback enters the credits window the
  // Next-episode button stays on screen even with the chrome hidden.
  // `positionMs > 0` keeps a not-yet-reported position (VLC briefly reports 0
  // after load) from counting as "remaining ≈ duration window" on short items.
  const outroWindowMs = Math.min(
    OUTRO_WINDOW_MAX_MS,
    durationMs * OUTRO_WINDOW_FRACTION,
  );
  const inOutroWindow =
    nextEpisode !== null &&
    hasStarted &&
    durationMs > 0 &&
    positionMs > 0 &&
    durationMs - positionMs <= outroWindowMs;
  const outroPromptVisible =
    inOutroWindow &&
    !outroDismissed &&
    !locked &&
    !errored &&
    countdown === null;

  // Re-arm the dismissed prompt when playback leaves the outro window (seek
  // back, source switch, next episode mounts fresh anyway).
  useEffect(() => {
    if (!inOutroWindow) setOutroDismissed(false);
  }, [inOutroWindow]);

  // `controls` is always off: our custom overlay drives every path now, and
  // keeping native controls off is what lets ExoPlayer honor programmatic audio
  // selection on Android (and our brightness/volume gestures own the surface).
  const rnvVideo = (
    <Video
      // Bumping reloadNonce remounts a fresh AVPlayer/ExoPlayer instance to
      // drop a dead connection and re-open the stream from position.
      key={`rnv-${currentIndex}-${reloadNonce}`}
      ref={videoRef}
      source={rnvSource}
      style={styles.video}
      resizeMode="contain"
      controls={false}
      paused={paused}
      rate={playbackRate}
      volume={volume}
      allowsExternalPlayback
      {...rnvTrackProps}
      playInBackground={false}
      ignoreSilentSwitch="ignore"
      onLoad={handleRnvLoad}
      onProgress={handleRnvProgress}
      onError={(e) => {
        const msg =
          e?.error?.errorString ??
          e?.error?.localizedDescription ??
          "Playback error";
        // ExoPlayer leans on device codecs; on Android it fails for content the
        // hardware can't decode (AC3/E-AC3 audio, HEVC 10-bit). libVLC carries
        // its own software decoders, so retry this exact source with VLC once
        // before giving up and skipping to the next server. Resume where we
        // were (or the original resume point) via the remount-seek channel.
        if (
          Platform.OS === "android" &&
          !useVlc &&
          !vlcAttemptedRef.current.has(currentIndex)
        ) {
          vlcAttemptedRef.current.add(currentIndex);
          pendingReloadSeekMsRef.current =
            positionMsRef.current > 0 ? positionMsRef.current : resumeMs;
          // Resume is handled by the pending-seek channel on VLC's onLoad; keep
          // the initial-seek effect from double-seeking the fresh instance.
          didInitialSeekRef.current = true;
          // Track ids from ExoPlayer's index space don't map to VLC's. Clear the
          // selection so VLC's onLoad seeds audio/subtitle tracks afresh.
          didSeedTextRef.current = false;
          setAudioTracks([]);
          setTextTracks([]);
          setSelectedAudioKey(null);
          setSelectedTextKey(-1);
          setVlcForcedIndices((prev) => {
            const next = new Set(prev);
            next.add(currentIndex);
            return next;
          });
          console.warn(
            `[NativeVideoPlayer] ExoPlayer failed on stream ${currentIndex} (${msg}); falling back to VLC`,
          );
          return;
        }
        advanceOnError(msg);
      }}
      onEnd={handlePlaybackEnded}
      progressUpdateInterval={1000}
    />
  );

  return (
    <View style={styles.root}>
      {/* Hide the status bar entirely — letterboxed cinematic content already
          eats screen real estate; we don't want iOS's notch-area "11:43" row
          stealing more. */}
      <StatusBar hidden />

      <View style={styles.video}>
        {useVlc ? (
          <VLCPlayer
            // Bumping reloadNonce remounts a fresh libVLC instance, the
            // reliable way to drop a dead connection and re-open from position.
            key={`vlc-${currentIndex}-${reloadNonce}`}
            // NOT styles.video: that carries backgroundColor, and VLCPlayer's
            // Android view is a TextureView which crashes on a background
            // drawable ("TextureView doesn't support displaying a background
            // drawable"). The wrapping View already paints the black backdrop.
            style={styles.vlcVideo}
            source={vlcSource}
            paused={paused}
            rate={playbackRate}
            volume={Math.round(volume * 100)}
            seek={seekFraction}
            audioTrack={selectedAudioKey ?? undefined}
            textTrack={selectedTextKey}
            resizeMode="contain"
            onPlaying={markStarted}
            onProgress={handleVlcProgress}
            onLoad={handleVlcLoad}
            onError={() => advanceOnError("VLC playback error")}
            onEnd={handlePlaybackEnded}
          />
        ) : (
          rnvVideo
        )}
      </View>

      {/* Keep the recognizer on a transparent sibling above the native player.
          On physical iOS devices AVPlayer/libVLC can consume touches before an
          ancestor GestureDetector sees them. Later siblings (the actual control
          buttons and menus) still render above this catcher and remain tappable. */}
      <GestureDetector gesture={surfaceGesture}>
        <View
          style={styles.gestureSurface}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            controlsVisible
              ? "Hide playback controls"
              : "Show playback controls"
          }
          // The tap-to-toggle lives in the Pan gesture, which a screen reader
          // can't trigger — so wire the a11y "activate" action to the same
          // toggle, otherwise this is a dead accessible element.
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "activate") {
              if (controlsVisible) setControlsVisible(false);
              else showControls();
            }
          }}
          onLayout={(e) =>
            setSurfaceSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        />
      </GestureDetector>

      {/* TV focus catcher. With the overlay hidden nothing on screen is
          focusable, so the remote's OK/select key has no target — the gesture
          surface above is touch-only. (ExoPlayer's native controller used to
          be focusable and showed itself on any key; that went away with
          controls={false}.) Mounted only while the chrome is hidden so it
          never competes with real buttons for D-pad focus: on hide it grabs
          focus and turns OK into "show controls"; on show it unmounts and the
          play/pause button's hasTVPreferredFocus takes over. Excluded while a
          panel that outlives the chrome (source picker / track menu / autoplay
          countdown / error / outro Next prompt) holds its own focus. */}
      {Platform.isTV &&
        !controlsVisible &&
        !errored &&
        countdown === null &&
        !outroPromptVisible &&
        !showPicker &&
        !showTrackMenu && (
          <Focusable
            style={styles.gestureSurface}
            focusedStyle={styles.tvCatcherFocused}
            hasTVPreferredFocus
            accessibilityRole="button"
            accessibilityLabel="Show playback controls"
            onPress={showControls}
          >
            {null}
          </Focusable>
        )}

      {!hasStarted && !errored && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Buffering…</Text>
        </View>
      )}

      {errored && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>Couldn’t play this stream.</Text>
          <Text style={styles.errorSubText}>
            {errorMessage ?? "Unknown error"}
          </Text>
          {currentIndex + 1 < streams.length ? (
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              hasTVPreferredFocus
              onPress={handleTryNext}
            >
              <Text style={styles.buttonText}>Try next stream</Text>
            </Focusable>
          ) : (
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              hasTVPreferredFocus
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Back</Text>
            </Focusable>
          )}
        </View>
      )}

      {/* Custom transport controls. Every path uses these now — all rnv
          playback runs with controls={false} so the app overlay is the only
          chrome on both platforms. */}
      {usesCustomControls && controlsActive && !errored && (
        <>
          {/* Center transport row */}
          <View style={styles.transportRow} pointerEvents="box-none">
            {/* onFocus keeps the chrome alive while the user D-pads between
                buttons — focus moves don't tick the auto-hide timer otherwise,
                and a mid-navigation hide strands TV focus on the catcher. */}
            <Focusable
              style={styles.transportButton}
              focusedStyle={styles.transportButtonFocused}
              onFocus={showControls}
              onPress={() => seekBy(-SEEK_STEP_MS)}
            >
              <Text style={styles.transportButtonText}>« 10s</Text>
            </Focusable>
            <Focusable
              style={[styles.transportButton, styles.transportPlayButton]}
              focusedStyle={styles.transportButtonFocused}
              hasTVPreferredFocus
              onFocus={showControls}
              onPress={togglePaused}
            >
              <Text style={styles.transportPlayText}>
                {paused ? "▶" : "❚❚"}
              </Text>
            </Focusable>
            <Focusable
              style={styles.transportButton}
              focusedStyle={styles.transportButtonFocused}
              onFocus={showControls}
              onPress={() => seekBy(SEEK_STEP_MS)}
            >
              <Text style={styles.transportButtonText}>10s »</Text>
            </Focusable>
          </View>

          {/* Bottom: progress bar + time. The gesture target is the wider
              padded container, not the thin track itself — easier to grab.
              Lifted above the footer + safe-area home indicator. */}
          <View
            style={[
              styles.controlsBottom,
              {
                bottom: 70 + insets.bottom,
                left: 16 + insets.left,
                right: 16 + insets.right,
              },
            ]}
            pointerEvents="box-none"
          >
            <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
            <GestureDetector gesture={scrubGesture}>
              <View
                style={styles.progressHitArea}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
              >
                <View
                  style={[
                    styles.progressTrack,
                    tvScrubIndex !== null && styles.progressTrackTvFocused,
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${displayFraction * 100}%` },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.progressThumb,
                    tvScrubIndex !== null && styles.progressThumbTvFocused,
                    {
                      left: `${displayFraction * 100}%`,
                      transform: [
                        { translateX: -7 },
                        { scale: previewFraction !== null ? 1.4 : 1 },
                      ],
                    },
                  ]}
                />
                {/* TV D-pad seek segments (see TV_SEEK_SEGMENTS). Invisible
                    focusables spanning the bar: left/right walks focus across
                    them, each focus move previews that position, OK commits.
                    Touch never reaches them off-TV — they aren't rendered. */}
                {Platform.isTV && (
                  <View style={styles.tvSeekRow}>
                    {Array.from({ length: TV_SEEK_SEGMENTS }, (_, i) => (
                      <Pressable
                        key={i}
                        style={styles.tvSeekSegment}
                        accessibilityRole="adjustable"
                        accessibilityLabel={`Seek position ${i + 1} of ${TV_SEEK_SEGMENTS}`}
                        onFocus={() => {
                          showControls();
                          tvFocusInRowRef.current = true;
                          // First segment touched on entry — anchor to the live
                          // position so the preview starts where playback is.
                          if (!tvScrubAnchorRef.current) {
                            tvScrubAnchorRef.current = {
                              index: i,
                              fraction: livePositionFraction,
                            };
                          }
                          setTvScrubIndex(i);
                        }}
                        onBlur={() => {
                          tvFocusInRowRef.current = false;
                          // A within-row move re-focuses a sibling on the same
                          // tick and flips this back true; if it's still false,
                          // focus left the bar, so drop the preview + anchor and
                          // let the next entry re-seed at the live position.
                          setTimeout(() => {
                            if (!tvFocusInRowRef.current) {
                              tvScrubAnchorRef.current = null;
                              setTvScrubIndex(null);
                            }
                          }, 50);
                        }}
                        onPress={() => commitTvScrub(i)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </GestureDetector>
            <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
          </View>
        </>
      )}

      {/* Next-episode button — shown when controls are up, and persistently
          during the outro window (credits heuristic) even with the chrome
          hidden. Hidden while the autoplay countdown is on screen (the
          countdown has its own "Play now"). In outro-only mode a ✕ pill lets
          the user dismiss it and watch the credits; on TV the prompt takes
          D-pad focus (the catcher is excluded), so OK advances — Netflix
          behaviour. */}
      {nextEpisode &&
        (controlsActive || outroPromptVisible) &&
        !errored &&
        countdown === null && (
          <View
            style={[
              styles.nextRow,
              { bottom: 110 + insets.bottom, right: 16 + insets.right },
            ]}
            pointerEvents="box-none"
          >
            {!controlsActive && (
              <Focusable
                style={styles.outroDismissButton}
                focusedStyle={styles.buttonFocused}
                accessibilityLabel="Dismiss and watch credits"
                onPress={() => setOutroDismissed(true)}
              >
                <Text style={styles.buttonText}>✕</Text>
              </Focusable>
            )}
            <Focusable
              style={styles.nextButton}
              focusedStyle={styles.buttonFocused}
              hasTVPreferredFocus={!controlsVisible}
              onFocus={controlsActive ? showControls : undefined}
              onPress={advanceToNextEpisode}
            >
              <Text style={styles.buttonText}>
                {advancing ? "Loading…" : "Next ▶"}
              </Text>
            </Focusable>
          </View>
        )}

      {/* End-of-episode autoplay countdown. Auto-advances at 0; Play now jumps
          immediately, Cancel stops and stays on the finished episode. */}
      {countdown !== null && nextEpisode && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Next episode in {countdown}s</Text>
          <View style={styles.countdownRow}>
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              hasTVPreferredFocus
              onPress={() => {
                setCountdown(null);
                void advanceToNextEpisode();
              }}
            >
              <Text style={styles.buttonText}>Play now</Text>
            </Focusable>
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              onPress={cancelCountdown}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Focusable>
          </View>
        </View>
      )}

      {/* Footer: title, meta, source picker. Visibility is driven entirely by
          the app's own controlsVisible/lock state (controlsActive) — there are
          no native player controls to sync with. */}
      {controlsActive && !errored && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: 12 + insets.bottom,
              paddingLeft: 16 + insets.left,
              paddingRight: 16 + insets.right,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.footerInfo}>
            <Text style={styles.footerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.footerMeta} numberOfLines={1}>
              {current.quality} • {current.name}
              {currentLanguageLabel ? ` • ${currentLanguageLabel}` : ""}
              {current.sizeBytes ? ` • ${formatSize(current.sizeBytes)}` : ""}
              {useVlc ? " • VLC" : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Source picker button — top-right, mirroring the Back button on the
          left. Visible whenever controls are, so the user can swap sources
          without first hunting the footer. */}
      {controlsActive && !errored && (
        <Focusable
          style={[
            styles.pickerButton,
            styles.pickerButtonAnchor,
            { top: 12 + insets.top, right: 12 + insets.right },
          ]}
          focusedStyle={styles.pickerButtonFocused}
          onFocus={showControls}
          onPress={() => {
            setShowTrackMenu(false);
            setShowSpeedMenu(false);
            setShowPicker((v) => !v);
            if (usesCustomControls) showControls();
          }}
        >
          <Text style={styles.pickerButtonText}>{streams.length} sources</Text>
        </Focusable>
      )}

      {/* Audio/subtitle button — iOS only, below the sources button. Hidden
          when the source picker is open so the two never overlap. */}
      {controlsActive && !errored && hasTrackChoices && !showPicker && (
        <Focusable
          style={[
            styles.pickerButton,
            styles.pickerButtonAnchor,
            showTrackMenu && styles.pickerButtonFocused,
            { top: 12 + insets.top + 44, right: 12 + insets.right },
          ]}
          focusedStyle={styles.pickerButtonFocused}
          accessibilityRole="button"
          accessibilityLabel="Audio and subtitles"
          onFocus={showControls}
          onPress={() => {
            setShowPicker(false);
            setShowSpeedMenu(false);
            setShowTrackMenu((v) => !v);
            if (usesCustomControls) showControls();
          }}
        >
          <FontAwesome name="cc" size={14} color="#fff" />
        </Focusable>
      )}

      {/* AirPlay / route-picker button — shown on every path. AVRoutePickerView
          controls the system audio route regardless of player, so it lets the
          user send audio back to the phone even on the VLC path (where the route
          would otherwise stay stuck on a previously-picked AirPlay device with no
          way to change it). On rnv it also hands off video. Hidden while a menu
          that occupies the same column is open. */}
      {controlsActive &&
        !errored &&
        !useVlc &&
        !showPicker &&
        !showTrackMenu && (
          <View
            style={[
              styles.pickerButton,
              styles.pickerButtonAnchor,
              { top: 12 + insets.top + 88, right: 12 + insets.right },
            ]}
            pointerEvents="box-none"
          >
            <AirPlayButton style={{ width: 28, height: 28 }} />
          </View>
        )}

      {/* Playback-speed button — right column, below the AirPlay/track slots.
          Shows the active rate so the current speed is visible at a glance, and
          accents when it isn't 1×. Hidden while the source picker or track menu
          is open so it never sits under those panels. */}
      {controlsActive && !errored && !showPicker && !showTrackMenu && (
        <Focusable
          style={[
            styles.pickerButton,
            styles.pickerButtonAnchor,
            (showSpeedMenu || playbackRate !== 1) && styles.pickerButtonFocused,
            { top: 12 + insets.top + 132, right: 12 + insets.right },
          ]}
          focusedStyle={styles.pickerButtonFocused}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed, currently ${formatRate(playbackRate)}`}
          onFocus={showControls}
          onPress={() => {
            setShowPicker(false);
            setShowTrackMenu(false);
            setShowSpeedMenu((v) => !v);
            if (usesCustomControls) showControls();
          }}
        >
          <Text style={styles.pickerButtonText}>{formatRate(playbackRate)}</Text>
        </Focusable>
      )}

      {showSpeedMenu && (
        <View
          style={[
            styles.speedPanel,
            { top: 12 + insets.top + 132, right: 16 + insets.right },
          ]}
        >
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerHeaderText}>Playback speed</Text>
            <Focusable
              style={styles.pickerCloseButton}
              focusedStyle={styles.pickerCloseButtonFocused}
              onFocus={showControls}
              onPress={() => setShowSpeedMenu(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </Focusable>
          </View>
          {PLAYBACK_RATES.map((rate) => {
            const selected = rate === playbackRate;
            return (
              <Focusable
                key={rate}
                style={[styles.speedRow, selected && styles.speedRowActive]}
                focusedStyle={styles.speedRowFocused}
                hasTVPreferredFocus={selected}
                onFocus={showControls}
                onPress={() => {
                  setPlaybackRate(rate);
                  setShowSpeedMenu(false);
                  showControls();
                }}
              >
                <FontAwesome
                  name="check"
                  size={12}
                  color={selected ? "#fff" : "transparent"}
                  style={styles.speedRowCheck}
                />
                <Text style={styles.speedRowText}>
                  {rate === 1 ? "Normal (1x)" : formatRate(rate)}
                </Text>
              </Focusable>
            );
          })}
        </View>
      )}

      {showTrackMenu && hasTrackChoices && (
        <TrackSelectionMenu
          style={{ top: 12 + insets.top + 88, right: 16 + insets.right }}
          audioTracks={audioTracks.length > 1 ? audioTracks : []}
          textTracks={textTracks}
          selectedAudioKey={selectedAudioKey}
          selectedTextKey={selectedTextKey}
          onSelectAudio={setSelectedAudioKey}
          onSelectText={setSelectedTextKey}
          onClose={() => setShowTrackMenu(false)}
          onInteraction={showControls}
        />
      )}

      {showPicker && (
        <View
          style={[
            styles.pickerPanel,
            {
              // Sit just below the sources button. The CC button is hidden
              // whenever this picker is open (`!showPicker` gate), so there's
              // nothing else to clear on either platform.
              top: 12 + insets.top + 44,
              right: 16 + insets.right,
            },
          ]}
        >
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerHeaderText}>
              Sources ({streams.length})
            </Text>
            <Focusable
              style={styles.pickerCloseButton}
              focusedStyle={styles.pickerCloseButtonFocused}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </Focusable>
          </View>
          <ScrollView
            style={styles.pickerScroll}
            contentContainerStyle={styles.pickerScrollContent}
            showsVerticalScrollIndicator
          >
            {streams.map((s, idx) => {
              const badges = getSourceLanguageBadges(s);
              return (
                <Focusable
                  key={`${s.url}-${idx}`}
                  style={[
                    styles.pickerRow,
                    idx === currentIndex && styles.pickerRowActive,
                  ]}
                  focusedStyle={styles.pickerRowFocused}
                  hasTVPreferredFocus={idx === currentIndex}
                  onPress={() => handlePickStream(idx)}
                >
                  <Text style={styles.pickerRowQuality}>{s.quality}</Text>
                  <View style={styles.pickerRowMain}>
                    <Text style={styles.pickerRowName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {/* Two always-rendered chips so absence ("No subs") is as
                        visible as presence. Original-cut audio gets its own
                        accent color so dubs stand out. */}
                    <View style={styles.pickerRowBadges}>
                      <View style={styles.pickerBadge}>
                        <FontAwesome
                          name="volume-up"
                          size={10}
                          color="#bbb"
                          style={styles.pickerBadgeIcon}
                        />
                        <Text
                          style={[
                            styles.pickerBadgeText,
                            badges.audioIsOriginal &&
                              styles.pickerBadgeOriginal,
                          ]}
                          numberOfLines={1}
                        >
                          {badges.audio}
                        </Text>
                      </View>
                      <View style={styles.pickerBadge}>
                        <FontAwesome
                          name="cc"
                          size={10}
                          color={badges.hasSubs ? "#bbb" : "#666"}
                          style={styles.pickerBadgeIcon}
                        />
                        <Text
                          style={[
                            styles.pickerBadgeText,
                            !badges.hasSubs && styles.pickerBadgeMuted,
                          ]}
                          numberOfLines={1}
                        >
                          {badges.subs}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.pickerRowSize}>
                    {formatSize(s.sizeBytes)}
                  </Text>
                </Focusable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Back button — top-left. Offset by safe-area insets so it clears the
          notch/Dynamic Island in landscape. Tied to controlsVisible on every
          path now that all playback uses the custom overlay. */}
      {controlsActive && (
        <Focusable
          style={[
            styles.backButton,
            { top: 12 + insets.top, left: 12 + insets.left },
          ]}
          focusedStyle={styles.backButtonFocused}
          onFocus={showControls}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Focusable>
      )}

      {/* Lock button — left edge, vertically centered. Engaging it suppresses
          every control and the brightness/volume gestures so the phone can't be
          nudged mid-movie; closes any open menu and hides the chrome so the
          locked state is clean. Both platforms (Android especially). */}
      {controlsActive && !errored && (
        <Focusable
          style={[styles.lockButton, { left: 12 + insets.left }]}
          focusedStyle={styles.lockButtonFocused}
          accessibilityRole="button"
          accessibilityLabel="Lock controls"
          onFocus={showControls}
          onPress={() => {
            setShowPicker(false);
            setShowTrackMenu(false);
            clearHideTimer();
            setControlsVisible(false);
            setLocked(true);
          }}
        >
          <FontAwesome name="unlock-alt" size={16} color="#fff" />
        </Focusable>
      )}

      {/* Unlock affordance — the only thing visible while locked, and only
          after a tap reveals it (controlsVisible). Tapping unlocks and restores
          the normal control overlay. */}
      {locked && controlsVisible && (
        <Focusable
          style={[styles.lockButton, styles.lockButtonActive, { left: 12 + insets.left }]}
          focusedStyle={styles.lockButtonFocused}
          hasTVPreferredFocus
          accessibilityRole="button"
          accessibilityLabel="Unlock controls"
          onFocus={showControls}
          onPress={() => {
            setLocked(false);
            showControls();
          }}
        >
          <FontAwesome name="lock" size={16} color="#fff" />
        </Focusable>
      )}

      {/* Brightness/volume HUD — shown only during a drag, independent of
          controlsVisible so it works while controls are hidden. */}
      {hud && <PlayerLevelIndicator axis={hud.axis} level={hud.level} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1, backgroundColor: "#000" },
  // VLCPlayer's Android view is a TextureView, which throws on a background
  // drawable — so it gets a background-less style. The parent View supplies #000.
  vlcVideo: { flex: 1 },
  gestureSurface: StyleSheet.absoluteFillObject,
  // The TV focus catcher is invisible by design; an empty focused style
  // suppresses Focusable's default focus border, which would otherwise
  // outline the whole screen whenever the catcher holds focus.
  tvCatcherFocused: {},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  overlayText: { color: "#fff", marginTop: 12, fontSize: 14 },
  errorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  errorSubText: {
    color: "#bbb",
    fontSize: 12,
    marginBottom: 18,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  buttonFocused: { backgroundColor: "#c0392b", transform: [{ scale: 1.05 }] },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  // Positioning lives on the row so the outro ✕ pill and the Next button
  // share the same anchor whether or not the dismiss pill is mounted.
  nextRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextButton: {
    backgroundColor: "rgba(231,76,60,0.9)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  outroDismissButton: {
    backgroundColor: "rgba(40,40,40,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  countdownRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
  },

  // Transport (center)
  transportRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  transportButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  transportPlayButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(231,76,60,0.85)",
  },
  transportButtonFocused: {
    borderColor: "#fff",
    transform: [{ scale: 1.08 }],
  },
  transportButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  transportPlayText: { color: "#fff", fontSize: 26, fontWeight: "700" },

  // Bottom controls strip (above footer)
  controlsBottom: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    minWidth: 48,
  },
  progressHitArea: {
    flex: 1,
    height: 32,
    justifyContent: "center",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#e74c3c",
  },
  progressThumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#e74c3c",
    top: "50%",
    marginTop: -7,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  // D-pad focus feedback: the bar brightens and the thumb gains a white ring
  // while a TV seek segment holds focus (the segments themselves stay
  // invisible — the thumb/timestamp preview is the focus indicator).
  progressTrackTvFocused: {
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  progressThumbTvFocused: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  tvSeekRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  tvSeekSegment: {
    flex: 1,
    height: "100%",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    gap: 8,
  },
  footerInfo: { flex: 1, marginRight: 12 },
  footerTitle: { color: "#fff", fontSize: 13, fontWeight: "600" },
  footerMeta: { color: "#bbb", fontSize: 11, marginTop: 2 },
  pickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  // Mirrors `backButton` on the opposite corner — applied alongside
  // `pickerButton` when the button floats top-right instead of sitting in
  // the footer row.
  pickerButtonAnchor: {
    position: "absolute",
  },
  pickerButtonFocused: {
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.05 }],
  },
  pickerButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  pickerPanel: {
    // Anchored top-right under the back button. Capped by maxHeight so the
    // ScrollView inside still scrolls and the panel never spills into the
    // footer/controls area.
    position: "absolute",
    right: 16,
    top: 12,
    width: 360,
    maxHeight: "70%",
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  pickerHeaderText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  pickerCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pickerCloseButtonFocused: {
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.05 }],
  },
  pickerCloseText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  // Playback-speed menu — compact, mirrors the source picker's look.
  speedPanel: {
    position: "absolute",
    right: 16,
    width: 200,
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 4,
    marginBottom: 2,
  },
  speedRowActive: { backgroundColor: "rgba(231,76,60,0.25)" },
  speedRowFocused: { backgroundColor: "#e74c3c", transform: [{ scale: 1.02 }] },
  speedRowCheck: { width: 18 },
  speedRowText: { color: "#ddd", fontSize: 12, flexShrink: 1 },
  pickerScroll: { flex: 1 },
  pickerScrollContent: { paddingBottom: 4 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  pickerRowActive: { backgroundColor: "rgba(231,76,60,0.25)" },
  pickerRowFocused: {
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.02 }],
  },
  pickerRowQuality: {
    color: "#fff",
    width: 50,
    fontSize: 12,
    fontWeight: "700",
  },
  pickerRowMain: { flex: 1, minWidth: 0 },
  pickerRowName: { color: "#ddd", fontSize: 11 },
  pickerRowLanguage: { color: "#9ecfff", fontSize: 10, marginTop: 2 },
  pickerRowBadges: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 10,
    flexWrap: "wrap",
  },
  pickerBadge: { flexDirection: "row", alignItems: "center" },
  pickerBadgeIcon: { marginRight: 4 },
  pickerBadgeText: { color: "#bbb", fontSize: 10 },
  pickerBadgeMuted: { color: "#666", fontStyle: "italic" },
  pickerBadgeOriginal: { color: "#7be8a8", fontWeight: "600" },
  pickerRowSize: { color: "#bbb", fontSize: 11, marginLeft: 8 },

  backButton: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  backButtonFocused: {
    borderColor: "#fff",
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.05 }],
  },
  backButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Lock/unlock toggle — circular, left edge, vertically centered.
  lockButton: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  // Engaged state gets the accent fill so the unlock affordance reads as active.
  lockButtonActive: {
    backgroundColor: "rgba(231,76,60,0.85)",
  },
  lockButtonFocused: {
    borderColor: "#fff",
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.08 }],
  },
});
