# iOS Audio & Subtitle Track Selection — Design

**Date:** 2026-06-07
**Screen:** `src/screens/NativeVideoPlayer.tsx`
**Status:** Approved

## Problem

On Android, `NativeVideoPlayer` renders `react-native-video` with `controls={true}`,
which gives ExoPlayer's native control bar an inline settings button for choosing
audio and subtitle tracks. On iOS, the equivalent AVPlayer audio/subtitle (CC) menu
only appears in *fullscreen* presentation — embedded inline, there is no visible
track-selection control. iOS users therefore cannot change audio or subtitle tracks.

This affects both iOS render paths in the screen:

- **react-native-video / AVPlayer** — the default path for HLS/MP4 on iOS.
- **react-native-vlc-media-player / VLC** — the MKV-only path on iOS (`needsVlc`).

## Goal

Add a custom, iOS-only audio/subtitle picker covering both iOS render paths. Android
is left untouched (its native ExoPlayer menu already works).

## Non-Goals (Out of Scope)

- Sideloaded / external subtitle files (`.srt`/`.vtt` URLs).
- Persisting the chosen track across sessions.
- `LiveGamePlayer` (WebView-based live streams — no track API).
- Changing the Android experience.

## Library APIs (versions: react-native-video 6.19.2, react-native-vlc-media-player 1.0.98)

### react-native-video (iOS AVPlayer)
- **Enumerate:** `onAudioTracks={(e) => e.audioTracks}` and `onTextTracks={(e) => e.textTracks}`.
  - `audioTracks[]`: `{ index: number; title?: string; language?: string; selected?: boolean }`
  - `textTracks[]`: `{ index: number; title?: string; language?: string; selected?: boolean }`
- **Apply:**
  - `selectedAudioTrack={{ type: 'index', value: <index> }}`
  - `selectedTextTrack={{ type: 'index', value: <index> }}` or `{ type: 'disabled' }` to turn subs off.

### react-native-vlc-media-player (iOS VLC / MKV)
- **Enumerate:** the existing `onLoad` payload (`VideoInfo`) carries `audioTracks` and `textTracks`.
  - `Track`: `{ id: number; name: string }`
- **Apply:** `audioTrack={<id>}` and `textTrack={<id>}` props. VLC treats `textTrack={-1}` as "subtitles off".

## Design

### 1. Track normalization

Normalize both players' track lists to one shape:

```ts
type PlayerTrack = { key: number; label: string };
```

- rnv: `key = index`, `label = title || language || `Track ${index + 1}``
- vlc: `key = id`, `label = name || `Track ${id}``

Subtitles get a synthetic **"Off"** entry with `key = -1`. VLC sometimes already emits a
"Disable"/`-1` row in `textTracks`; dedupe so "Off" appears exactly once.

### 2. State (added to NativeVideoPlayer)

- `audioTracks: PlayerTrack[]`
- `textTracks: PlayerTrack[]`
- `selectedAudioKey: number | null`
- `selectedTextKey: number` (defaults to `-1` = Off)
- `showTrackMenu: boolean`

All reset in the existing "active stream changed" effect (keyed on `currentIndex`),
alongside the other transient playback state.

### 3. Capturing tracks

- **rnv path:** add `onAudioTracks` / `onTextTracks` handlers → normalize into state and
  seed `selectedAudioKey` / `selectedTextKey` from whichever track reports `selected: true`.
- **vlc path:** extend the existing `handleVlcLoad` (which already receives the `onLoad`
  `VideoInfo`) to also read `audioTracks` / `textTracks` and normalize them.

### 4. Applying selection

- **rnv:**
  - `selectedAudioTrack = { type: 'index', value: selectedAudioKey }` (omit when null)
  - `selectedTextTrack = selectedTextKey === -1 ? { type: 'disabled' } : { type: 'index', value: selectedTextKey }`
- **vlc:**
  - `audioTrack = selectedAudioKey ?? undefined`
  - `textTrack = selectedTextKey` (`-1` = off, native VLC behavior)

### 5. UI (iOS only)

- A floating **CC/audio button** (FontAwesome `cc` icon), rendered next to the existing
  "sources" button, gated by `Platform.OS === 'ios'` **and** shown only when there's
  something to choose: `audioTracks.length > 1 || textTracks.length > 0`.
- Tapping toggles a panel styled like the existing source-picker panel, with two labeled
  sections — **Audio** and **Subtitles** — each a list of selectable `Focusable` rows with
  a checkmark on the active row. Selecting a row applies it; subtitles include "Off".
- The button and panel respect `controlsVisible` exactly like the sources picker.
- `useTVBackHandler` closes the track menu first when open (same pattern as `showPicker`).

### 6. Code organization

NativeVideoPlayer.tsx is already ~1060 lines. Extract a **presentational** component
`src/components/TrackSelectionMenu.tsx`:

- **Props:** `audioTracks`, `textTracks`, `selectedAudioKey`, `selectedTextKey`,
  `onSelectAudio(key)`, `onSelectText(key)`, `onClose()`.
- All player wiring (state, capture handlers, the `selected*Track` / `audioTrack` /
  `textTrack` props) stays in NativeVideoPlayer. The component is pure UI built from
  `Focusable` rows, reusing the existing panel visual language.

### 7. Android

Untouched. The CC button is `Platform.OS === 'ios'`-gated, so ExoPlayer's native track
menu remains the Android experience.

## Edge Cases

- **No tracks / single audio track, no subs:** button hidden (the visibility predicate).
- **VLC duplicate "Off" row:** deduped against the synthetic `-1` entry.
- **Stream switch (source picker):** track state and selection reset via the
  `currentIndex` effect; menu closes.
- **TV back press with menu open:** closes the menu rather than exiting playback.

## Testing / Verification

Manual QA on the iOS simulator via Argent:
1. Play an HLS/MP4 title with multiple audio/subtitle tracks → CC button appears →
   switching audio and subtitles takes effect; "Off" disables subtitles.
2. Play an MKV title (VLC path) with embedded tracks → same menu works.
3. Confirm a single-track title hides the CC button.
4. Confirm Android still shows its native ExoPlayer menu (button absent there).
