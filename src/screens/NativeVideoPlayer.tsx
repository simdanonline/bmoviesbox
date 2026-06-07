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
  Pressable,
  ScrollView,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
} from "../utils/sourceLanguage";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import TrackSelectionMenu, {
  PlayerTrack,
} from "../components/TrackSelectionMenu";

type NativeVideoPlayerProps = NativeStackScreenProps<any, "NativeVideoPlayer">;

const CONTROLS_HIDE_MS = 4000;
const SEEK_STEP_MS = 10_000;
// Save watch progress no more than every 5 seconds — anything more is wasted
// AsyncStorage writes for a UX that resumes within ±5s anyway.
const PROGRESS_SAVE_INTERVAL_MS = 5_000;
// Don't try to resume from positions within 30s of the end; the user clearly
// finished watching last time.
const RESUME_THRESHOLD_FROM_END_MS = 30_000;
// AsyncStorage prefix for streamed-playback resume points (downloads use the
// DownloadManager's own progress field instead).
const STREAM_PROGRESS_KEY_PREFIX = "@bmoviebox_stream_progress::";

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
  };

  const insets = useSafeAreaInsets();
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
  // `hasStarted` flips true the first time playback actually advances —
  // tracked separately from `errored` so re-buffer events during normal
  // playback can't drag the loading overlay back on screen. (rnv's onBuffer
  // fires `true` mid-stream but its `false` follow-up is unreliable.)
  const [hasStarted, setHasStarted] = useState(false);
  const [errored, setErrored] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

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
  const [trackWidth, setTrackWidth] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  // Drives the rnv `controls` prop. Briefly flipped to false on TV back-press
  // to dismiss the native overlay without leaving the screen, then restored.
  const [nativeControlsEnabled, setNativeControlsEnabled] = useState(true);
  // Streamed-playback resume point loaded asynchronously from AsyncStorage.
  // Merged with `initialPositionMs` (download path) by the seek effect.
  const [streamResumeMs, setStreamResumeMs] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the pending native-controls re-enable timer so unmounts/rebacks
  // can cancel it before it fires (prevents state updates after unmount).
  const controlsRestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const failureCount = useRef(0);
  const videoRef = useRef<VideoRef>(null);
  const didInitialSeekRef = useRef(false);
  // Subtitle selection is seeded from the player's reported tracks exactly once
  // per stream. Without this, a re-fired onTextTracks/onLoad would overwrite a
  // user's explicit choice (we can't use a null-guard like audio because -1 is
  // a valid user value meaning "Off").
  const didSeedTextRef = useRef(false);
  const lastSavedProgressMsRef = useRef(0);

  const current = streams[currentIndex];
  const useVlc = needsVlc(current);
  const currentLanguageLabel = current
    ? getSourceLanguageLabel(current)
    : null;

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
    scheduleHide();
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

  useEffect(
    () => () => {
      if (controlsRestoreTimer.current) {
        clearTimeout(controlsRestoreTimer.current);
        controlsRestoreTimer.current = null;
      }
    },
    [],
  );

  // Reset resume bookkeeping when the active stream changes — otherwise the
  // initial-seek effect would try to apply the saved offset to a different
  // file. (User picking a different source = fresh playback.)
  useEffect(() => {
    didInitialSeekRef.current = false;
    lastSavedProgressMsRef.current = 0;
    didSeedTextRef.current = false;
  }, [currentIndex]);

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
    // While controls are on-screen, back should dismiss the overlay rather
    // than exit playback. Errored state still goes back so the user isn't
    // trapped on the failure screen.
    if (controlsVisible && !errored) {
      if (useVlc) {
        clearHideTimer();
        setControlsVisible(false);
      } else {
        // rnv has no imperative hide API for native controls. Re-mount the
        // overlay by flipping `controls` off and back on the next tick —
        // dismisses the visible overlay while keeping ExoPlayer running.
        setNativeControlsEnabled(false);
        if (controlsRestoreTimer.current) {
          clearTimeout(controlsRestoreTimer.current);
        }
        controlsRestoreTimer.current = setTimeout(() => {
          controlsRestoreTimer.current = null;
          setNativeControlsEnabled(true);
        }, 50);
        setControlsVisible(false);
      }
      return;
    }
    navigation.goBack();
  });

  const advanceOnError = (msg: string) => {
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
    markStarted();
  };

  const handleVlcLoad = (e: VideoInfo) => {
    if (e.duration > 0) setDurationMs(e.duration);
    const audio: PlayerTrack[] = (e.audioTracks ?? []).map((t, i) => ({
      key: t.id,
      label: t.name || `Track ${i + 1}`,
    }));
    setAudioTracks(audio);
    if (audio.length > 0) {
      setSelectedAudioKey((prev) => (prev === null ? audio[0].key : prev));
    }
    // VLC may already include a "disable"/id -1 row; drop it and add a single
    // synthetic "Off" so the option appears exactly once.
    const subs: PlayerTrack[] = (e.textTracks ?? [])
      .filter((t) => t.id !== -1)
      .map((t, i) => ({ key: t.id, label: t.name || `Track ${i + 1}` }));
    setTextTracks(subs.length > 0 ? [{ key: -1, label: "Off" }, ...subs] : []);
    // VLC reports no default-selected subtitle; seed "Off" once per stream so a
    // re-fired onLoad can't override a user's later choice.
    if (!didSeedTextRef.current) {
      setSelectedTextKey(-1);
      didSeedTextRef.current = true;
    }
    markStarted();
  };

  // rnv's onLoad gives duration in seconds. Track it in ms so the resume
  // effect (shared with VLC) has the units it expects.
  const handleRnvLoad = (data: OnLoadData) => {
    if (data.duration > 0) setDurationMs(data.duration * 1000);
    markStarted();
  };

  const handleRnvProgress = (data: { currentTime: number }) => {
    const ms = data.currentTime * 1000;
    setPositionMs(ms);
    saveProgressIfDue(ms);
    markStarted();
  };

  const handleRnvAudioTracks = (e: OnAudioTracksData) => {
    const tracks: PlayerTrack[] = e.audioTracks.map((t) => ({
      key: t.index,
      label: t.title || t.language || `Track ${t.index + 1}`,
    }));
    setAudioTracks(tracks);
    const sel = e.audioTracks.find((t) => t.selected);
    if (sel) {
      setSelectedAudioKey(sel.index);
    } else if (tracks.length > 0) {
      setSelectedAudioKey((prev) => (prev === null ? tracks[0].key : prev));
    }
  };

  const handleRnvTextTracks = (e: OnTextTracksData) => {
    const subs: PlayerTrack[] = e.textTracks.map((t) => ({
      key: t.index,
      label: t.title || t.language || `Track ${t.index + 1}`,
    }));
    // Only offer subtitles (with an "Off" entry) when real tracks exist.
    setTextTracks(subs.length > 0 ? [{ key: -1, label: "Off" }, ...subs] : []);
    // Seed the initial selection once so re-fires don't clobber a user choice.
    if (!didSeedTextRef.current) {
      const sel = e.textTracks.find((t) => t.selected);
      setSelectedTextKey(sel ? sel.index : -1);
      didSeedTextRef.current = true;
    }
  };

  const seekVlcBy = (deltaMs: number) => {
    if (durationMs <= 0) return;
    const target = Math.max(
      0,
      Math.min(durationMs - 1000, positionMs + deltaMs),
    );
    setSeekFraction(target / durationMs);
    setPositionMs(target); // optimistic — next onProgress will replace
    showControls();
  };

  const seekVlcToFraction = (fraction: number) => {
    if (durationMs <= 0) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    setSeekFraction(clamped);
    setPositionMs(clamped * durationMs); // optimistic
    showControls();
  };

  const toggleVlcPaused = () => {
    setPaused((p) => !p);
    showControls();
  };

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
          seekVlcToFraction(fraction);
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

  const livePositionFraction =
    durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;
  const displayFraction =
    scrubFraction !== null ? scrubFraction : livePositionFraction;
  const displayMs =
    scrubFraction !== null ? scrubFraction * durationMs : positionMs;

  return (
    <View style={styles.root}>
      {/* Hide the status bar entirely — letterboxed cinematic content already
          eats screen real estate; we don't want iOS's notch-area "11:43" row
          stealing more. */}
      <StatusBar hidden />

      {useVlc ? (
        // Pressable wraps VLC so a tap on the video toggles controls; libVLC
        // doesn't surface tap events itself.
        <Pressable
          style={styles.video}
          onPress={() =>
            controlsVisible ? setControlsVisible(false) : showControls()
          }
        >
          <VLCPlayer
            style={styles.video}
            source={vlcSource}
            paused={paused}
            seek={seekFraction}
            audioTrack={selectedAudioKey ?? undefined}
            textTrack={selectedTextKey}
            resizeMode="contain"
            onPlaying={markStarted}
            onProgress={handleVlcProgress}
            onLoad={handleVlcLoad}
            onError={() => advanceOnError("VLC playback error")}
            onEnd={() => navigation.goBack()}
          />
        </Pressable>
      ) : (
        <Video
          ref={videoRef}
          source={rnvSource}
          style={styles.video}
          resizeMode="contain"
          controls={nativeControlsEnabled}
          paused={paused}
          selectedAudioTrack={
            selectedAudioKey !== null
              ? { type: SelectedTrackType.INDEX, value: selectedAudioKey }
              : undefined
          }
          selectedTextTrack={
            selectedTextKey === -1
              ? { type: SelectedTrackType.DISABLED }
              : { type: SelectedTrackType.INDEX, value: selectedTextKey }
          }
          onAudioTracks={handleRnvAudioTracks}
          onTextTracks={handleRnvTextTracks}
          playInBackground={false}
          ignoreSilentSwitch="ignore"
          onLoad={handleRnvLoad}
          onProgress={handleRnvProgress}
          onControlsVisibilityChange={(e) => setControlsVisible(e.isVisible)}
          onError={(e) => {
            const msg =
              e?.error?.errorString ??
              e?.error?.localizedDescription ??
              "Playback error";
            advanceOnError(msg);
          }}
          onEnd={() => navigation.goBack()}
          progressUpdateInterval={1000}
        />
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

      {/* VLC-only custom controls. rnv path uses the native AVPlayer/ExoPlayer
          controls (better scrubber, fullscreen, AirPlay built-in). */}
      {useVlc && controlsVisible && !errored && (
        <>
          {/* Center transport row */}
          <View style={styles.transportRow} pointerEvents="box-none">
            <Focusable
              style={styles.transportButton}
              focusedStyle={styles.transportButtonFocused}
              onPress={() => seekVlcBy(-SEEK_STEP_MS)}
            >
              <Text style={styles.transportButtonText}>« 10s</Text>
            </Focusable>
            <Focusable
              style={[styles.transportButton, styles.transportPlayButton]}
              focusedStyle={styles.transportButtonFocused}
              hasTVPreferredFocus
              onPress={toggleVlcPaused}
            >
              <Text style={styles.transportPlayText}>
                {paused ? "▶" : "❚❚"}
              </Text>
            </Focusable>
            <Focusable
              style={styles.transportButton}
              focusedStyle={styles.transportButtonFocused}
              onPress={() => seekVlcBy(SEEK_STEP_MS)}
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
                <View style={styles.progressTrack}>
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
                    {
                      left: `${displayFraction * 100}%`,
                      transform: [
                        { translateX: -7 },
                        { scale: scrubFraction !== null ? 1.4 : 1 },
                      ],
                    },
                  ]}
                />
              </View>
            </GestureDetector>
            <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
          </View>
        </>
      )}

      {/* Footer: title, meta, source picker. Tied to controlsVisible on both
          paths — on the rnv path, the native player drives visibility via
          onControlsVisibilityChange so this stays in sync with the native UI. */}
      {controlsVisible && !errored && (
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
      {controlsVisible && !errored && (
        <Focusable
          style={[
            styles.pickerButton,
            styles.pickerButtonAnchor,
            { top: 12 + insets.top, right: 12 + insets.right },
          ]}
          focusedStyle={styles.pickerButtonFocused}
          onPress={() => {
            setShowPicker((v) => !v);
            if (useVlc) showControls();
          }}
        >
          <Text style={styles.pickerButtonText}>{streams.length} sources</Text>
        </Focusable>
      )}

      {showPicker && (
        <View
          style={[
            styles.pickerPanel,
            {
              // Sit below the Back button (top: 12 + insets.top, ~36pt tall),
              // and clear the right-side notch inset.
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

      {/* Back button — top-left. Offset by safe-area insets so it clears the notch/
          Dynamic Island in landscape. */}
      {controlsVisible && (
        <Focusable
          style={[
            styles.backButton,
            { top: 12 + insets.top, left: 12 + insets.left },
          ]}
          focusedStyle={styles.backButtonFocused}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Focusable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1, backgroundColor: "#000" },
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
});
