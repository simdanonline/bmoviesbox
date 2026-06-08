# iOS Audio & Subtitle Track Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an iOS-only custom audio/subtitle track picker to `NativeVideoPlayer`, covering both iOS render paths (react-native-video / AVPlayer and react-native-vlc-media-player / VLC), so iOS users can switch audio and subtitle tracks the way Android users already can via ExoPlayer's native menu.

**Architecture:** A new presentational component `TrackSelectionMenu` renders a panel (Audio + Subtitles sections) from a normalized `PlayerTrack[]` model. `NativeVideoPlayer` owns all player wiring: it captures tracks from each player's callbacks, normalizes them, holds the selection state, and feeds the selection back through each player's selection props. A floating CC button (iOS only, shown only when there's a choice) toggles the menu.

**Tech Stack:** React Native, TypeScript, react-native-video 6.19.2, react-native-vlc-media-player 1.0.98, `@expo/vector-icons` FontAwesome, existing `Focusable` component.

**Project conventions:** This project has **no unit-test framework** (no jest, no test files). Per the writing-plans skill's "follow established patterns" rule, verification is done via **TypeScript type-checking** plus **manual QA on the iOS simulator (Argent MCP)** — not unit tests. Typecheck command (the plain `tsc` invocation fails on an Expo base-config quirk, so use the override):

```bash
npx tsc --noEmit --moduleResolution bundler --module esnext
```

Expected baseline: exit 0, no output. Run this after each code task.

---

## File Structure

- **Create:** `src/components/TrackSelectionMenu.tsx` — presentational menu (Audio/Subtitles sections, selectable rows). Exports `PlayerTrack` type. No player knowledge.
- **Modify:** `src/screens/NativeVideoPlayer.tsx` — imports, track state, capture handlers, selection props on both players, CC button + menu render, back-handler integration.

Verified API facts (do not re-derive):
- `react-native-video` root re-exports `SelectedTrackType`, `OnAudioTracksData`, `OnTextTracksData` (via `export * from './types'`).
  - `OnAudioTracksData['audioTracks'][n]` = `{ index: number; title?: string; language?: string; selected?: boolean }`
  - `OnTextTracksData['textTracks'][n]` = `{ index: number; title?: string; language?: string; selected?: boolean }`
  - Apply: `selectedAudioTrack={{ type: SelectedTrackType.INDEX, value }}`, `selectedTextTrack={{ type: SelectedTrackType.DISABLED }}` or `{ type: SelectedTrackType.INDEX, value }`.
- `react-native-vlc-media-player` root exports type `VideoInfo` = `{ duration; target; videoSize; audioTracks: Track[]; textTracks: Track[] }` where `Track = { id: number; name: string }`. The `onLoad` callback receives `VideoInfo`. Apply via `audioTrack={id}` / `textTrack={id}` props (`-1` = subtitles off).

---

## Task 1: Create the `TrackSelectionMenu` presentational component

**Files:**
- Create: `src/components/TrackSelectionMenu.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/TrackSelectionMenu.tsx` with exactly this content:

```tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Focusable from "./Focusable";

/** A track normalized from either react-native-video or VLC into one shape. */
export type PlayerTrack = { key: number; label: string };

interface TrackSelectionMenuProps {
  /** Audio options. Pass [] to hide the Audio section (e.g. only one track). */
  audioTracks: PlayerTrack[];
  /** Subtitle options, including a synthetic { key: -1, label: "Off" } entry. */
  textTracks: PlayerTrack[];
  selectedAudioKey: number | null;
  selectedTextKey: number;
  onSelectAudio: (key: number) => void;
  onSelectText: (key: number) => void;
  onClose: () => void;
  /** Absolute positioning (top/right + insets) supplied by the parent. */
  style?: object;
}

function TrackRow({
  label,
  selected,
  onPress,
  hasTVPreferredFocus,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}) {
  return (
    <Focusable
      style={[styles.row, selected && styles.rowActive]}
      focusedStyle={styles.rowFocused}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
    >
      <FontAwesome
        name="check"
        size={12}
        color={selected ? "#fff" : "transparent"}
        style={styles.rowCheck}
      />
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
    </Focusable>
  );
}

export default function TrackSelectionMenu({
  audioTracks,
  textTracks,
  selectedAudioKey,
  selectedTextKey,
  onSelectAudio,
  onSelectText,
  onClose,
  style,
}: TrackSelectionMenuProps) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Audio & Subtitles</Text>
        <Focusable
          style={styles.closeButton}
          focusedStyle={styles.closeButtonFocused}
          onPress={onClose}
        >
          <Text style={styles.closeText}>Close</Text>
        </Focusable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {audioTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Audio</Text>
            {audioTracks.map((t, idx) => (
              <TrackRow
                key={`a-${t.key}`}
                label={t.label}
                selected={t.key === selectedAudioKey}
                hasTVPreferredFocus={idx === 0}
                onPress={() => onSelectAudio(t.key)}
              />
            ))}
          </>
        )}
        {textTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Subtitles</Text>
            {textTracks.map((t) => (
              <TrackRow
                key={`t-${t.key}`}
                label={t.label}
                selected={t.key === selectedTextKey}
                onPress={() => onSelectText(t.key)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    width: 280,
    maxHeight: "70%",
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  headerText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeButtonFocused: {
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.05 }],
  },
  closeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  sectionLabel: {
    color: "#9a9a9a",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 4,
    marginBottom: 2,
  },
  rowActive: { backgroundColor: "rgba(231,76,60,0.25)" },
  rowFocused: { backgroundColor: "#e74c3c", transform: [{ scale: 1.02 }] },
  rowCheck: { width: 18 },
  rowLabel: { color: "#ddd", fontSize: 12, flexShrink: 1 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrackSelectionMenu.tsx
git commit -m "feat: add TrackSelectionMenu presentational component"
```

---

## Task 2: Add track imports, state, and reset to NativeVideoPlayer

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Update the react-native-video import**

In `src/screens/NativeVideoPlayer.tsx`, replace this line (currently line 21):

```tsx
import Video, { VideoRef, OnLoadData } from "react-native-video";
```

with:

```tsx
import Video, {
  VideoRef,
  OnLoadData,
  OnAudioTracksData,
  OnTextTracksData,
  SelectedTrackType,
} from "react-native-video";
```

- [ ] **Step 2: Add the VLC VideoInfo type import**

Replace this line (currently line 22):

```tsx
import { VLCPlayer } from "react-native-vlc-media-player";
```

with:

```tsx
import { VLCPlayer } from "react-native-vlc-media-player";
import type { VideoInfo } from "react-native-vlc-media-player";
```

- [ ] **Step 3: Import the new component and its type**

Directly below the FontAwesome import (currently line 36, `import FontAwesome from "@expo/vector-icons/build/FontAwesome";`), add:

```tsx
import TrackSelectionMenu, {
  PlayerTrack,
} from "../components/TrackSelectionMenu";
```

- [ ] **Step 4: Add track state**

Find the `const [showPicker, setShowPicker] = useState(false);` line (currently line 126). Immediately after it, add:

```tsx
  // Audio/subtitle track selection (iOS only — Android uses ExoPlayer's native
  // menu). Tracks are normalized from rnv's onAudioTracks/onTextTracks and
  // VLC's onLoad payload into a common PlayerTrack[] shape. selectedTextKey of
  // -1 means subtitles off (matches VLC's native "disable" id).
  const [audioTracks, setAudioTracks] = useState<PlayerTrack[]>([]);
  const [textTracks, setTextTracks] = useState<PlayerTrack[]>([]);
  const [selectedAudioKey, setSelectedAudioKey] = useState<number | null>(null);
  const [selectedTextKey, setSelectedTextKey] = useState<number>(-1);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
```

- [ ] **Step 5: Reset track state when the active stream changes**

Find the "Reset transient state when the active stream changes" effect (currently lines 197-207). Add these lines just before the closing `scheduleHide();` call inside it:

```tsx
    setAudioTracks([]);
    setTextTracks([]);
    setSelectedAudioKey(null);
    setSelectedTextKey(-1);
    setShowTrackMenu(false);
```

The effect body should now read:

```tsx
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
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext`
Expected: exit 0. (`PlayerTrack`, the new imports, and state are now referenced/used minimally; unused-import errors are not part of this project's tsconfig, so a clean exit is expected. The selection props that consume the state are added in Task 3.)

- [ ] **Step 7: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: add track-selection state to NativeVideoPlayer"
```

---

## Task 3: Capture tracks and apply selection on both players

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Add rnv track-capture handlers**

Find `handleRnvProgress` (currently ends around line 416). Immediately after that function, add:

```tsx
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
    const sel = e.textTracks.find((t) => t.selected);
    setSelectedTextKey(sel ? sel.index : -1);
  };
```

- [ ] **Step 2: Extend the VLC load handler to capture tracks**

Replace the existing `handleVlcLoad` (currently lines 399-402):

```tsx
  const handleVlcLoad = (e: { duration: number }) => {
    if (e.duration > 0) setDurationMs(e.duration);
    markStarted();
  };
```

with:

```tsx
  const handleVlcLoad = (e: VideoInfo) => {
    if (e.duration > 0) setDurationMs(e.duration);
    const audio: PlayerTrack[] = (e.audioTracks ?? []).map((t) => ({
      key: t.id,
      label: t.name || `Track ${t.id}`,
    }));
    setAudioTracks(audio);
    if (audio.length > 0) {
      setSelectedAudioKey((prev) => (prev === null ? audio[0].key : prev));
    }
    // VLC may already include a "disable"/id -1 row; drop it and add a single
    // synthetic "Off" so the option appears exactly once.
    const subs: PlayerTrack[] = (e.textTracks ?? [])
      .filter((t) => t.id !== -1)
      .map((t) => ({ key: t.id, label: t.name || `Track ${t.id}` }));
    setTextTracks(subs.length > 0 ? [{ key: -1, label: "Off" }, ...subs] : []);
    markStarted();
  };
```

- [ ] **Step 3: Apply selection props on the VLCPlayer**

Find the `<VLCPlayer ... />` element (currently lines 517-528). Add these two props directly after the `seek={seekFraction}` prop:

```tsx
            audioTrack={selectedAudioKey ?? undefined}
            textTrack={selectedTextKey}
```

- [ ] **Step 4: Apply selection props and capture handlers on the Video (rnv) element**

Find the `<Video ... />` element (currently lines 531-552). Add these props directly after the `paused={paused}` prop:

```tsx
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
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: capture and apply audio/subtitle tracks on both iOS players"
```

---

## Task 4: Render the CC button and track menu, wire back-handler

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Add a derived visibility flag**

Find `const useVlc = needsVlc(current);` (currently line 171). Immediately after it, add:

```tsx
  // The track menu is iOS-only (Android keeps ExoPlayer's native menu) and only
  // worth showing when there's an actual choice to make.
  const hasTrackChoices =
    Platform.OS === "ios" && (audioTracks.length > 1 || textTracks.length > 0);
```

- [ ] **Step 2: Close the track menu first on TV back press**

Find the `useTVBackHandler` callback (currently starts line 336). It begins with:

```tsx
  useTVBackHandler(() => {
    if (showPicker) {
      setShowPicker(false);
      return;
    }
```

Insert a track-menu check directly after the `showPicker` block, so it becomes:

```tsx
  useTVBackHandler(() => {
    if (showPicker) {
      setShowPicker(false);
      return;
    }
    if (showTrackMenu) {
      setShowTrackMenu(false);
      return;
    }
```

- [ ] **Step 3: Make the source picker and track menu mutually exclusive**

Find the sources-button `onPress` (currently lines 709-712):

```tsx
          onPress={() => {
            setShowPicker((v) => !v);
            if (useVlc) showControls();
          }}
```

Replace it with:

```tsx
          onPress={() => {
            setShowTrackMenu(false);
            setShowPicker((v) => !v);
            if (useVlc) showControls();
          }}
```

- [ ] **Step 4: Move the source picker panel down to clear the new CC button**

Find the source picker panel's inline position (currently lines 722-728). Change its `top` from `12 + insets.top + 44` to `12 + insets.top + 88`. The block should read:

```tsx
            {
              // Sit below the Back/sources/CC button stack, clear of the
              // right-side notch inset.
              top: 12 + insets.top + 88,
              right: 16 + insets.right,
            },
```

- [ ] **Step 5: Render the CC button**

Find the source-picker button block. It ends at its closing `</Focusable>` followed by `)}` (currently around line 716, the block that starts with `{controlsVisible && !errored && (` and renders the `{streams.length} sources` button). Immediately after that block's closing `)}`, add:

```tsx
      {/* Audio/subtitle button — iOS only, below the sources button. Hidden
          when the source picker is open so the two never overlap. */}
      {controlsVisible && !errored && hasTrackChoices && !showPicker && (
        <Focusable
          style={[
            styles.pickerButton,
            styles.pickerButtonAnchor,
            { top: 12 + insets.top + 44, right: 12 + insets.right },
          ]}
          focusedStyle={styles.pickerButtonFocused}
          onPress={() => {
            setShowPicker(false);
            setShowTrackMenu((v) => !v);
            if (useVlc) showControls();
          }}
        >
          <FontAwesome name="cc" size={14} color="#fff" />
        </Focusable>
      )}
```

- [ ] **Step 6: Render the track menu panel**

Directly after the CC button block from Step 5, add:

```tsx
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
        />
      )}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext`
Expected: exit 0, no output.

- [ ] **Step 8: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: iOS CC button and audio/subtitle menu in NativeVideoPlayer"
```

---

## Task 5: Manual QA on the iOS simulator

**Files:** none (verification only)

This project has no automated UI tests; verify behavior on the iOS simulator via Argent MCP. Read the `argent-react-native-app-workflow` and `argent-test-ui-flow` skills first, then run the app on iOS.

- [ ] **Step 1: Build/run the app on the iOS simulator**

Use the Argent React Native workflow (boot simulator → start Metro → `expo run:ios`). Navigate into a playable title that opens `NativeVideoPlayer`.

- [ ] **Step 2: Verify the AVPlayer (HLS/MP4) path**

- Play a title with multiple audio and/or subtitle tracks.
- Confirm the **CC button** appears below the "sources" button (top-right) once controls are visible.
- Tap it → the **Audio & Subtitles** panel opens with the expected sections.
- Switch audio → audio changes. Switch subtitle → subtitle changes. Select **Off** → subtitles disappear.
- Confirm the source picker and track menu never show at the same time.

- [ ] **Step 3: Verify the VLC (MKV) path**

- Play an MKV title (forces the VLC path on iOS).
- Repeat the audio/subtitle/Off checks from Step 2.

- [ ] **Step 4: Verify the empty case and Android**

- Play a single-audio, no-subtitle title → confirm the CC button is **absent**.
- (If an Android emulator is available) confirm Android shows no CC button and still exposes ExoPlayer's native track menu.

- [ ] **Step 5: Report results**

Summarize what was verified with screenshots. If anything fails, switch to `superpowers:systematic-debugging` before patching.

---

## Self-Review Notes

- **Spec coverage:** normalization (Task 1 + Task 3), state (Task 2), capture rnv+vlc (Task 3), apply rnv+vlc (Task 3), iOS-only CC button + visibility predicate (Task 4), panel UI mirroring source picker (Task 1 + Task 4), back-handler (Task 4), Android untouched (Platform gate, Task 4), edge cases — single-track hide (Task 4 predicate + Task 4 Step 6 `audioTracks.length > 1` guard), VLC duplicate Off dedupe (Task 3 Step 2), stream-switch reset (Task 2 Step 5). All covered.
- **Type consistency:** `PlayerTrack { key; label }`, `selectedAudioKey: number | null`, `selectedTextKey: number` (−1 = off), `setSelectedAudioKey`/`setSelectedTextKey` passed directly as `onSelectAudio`/`onSelectText` (both `(key: number) => void`). `SelectedTrackType.INDEX`/`.DISABLED` and `VideoInfo` confirmed exported.
- **No placeholders:** every code step shows full code.
