# Player gesture controls: brightness + volume, unified custom controls, custom AirPlay button

Date: 2026-06-08
Status: Approved decisions captured; pending spec review.

## Goal

Add the standard streaming-player drag gestures to `NativeVideoPlayer`:

- **Left half, vertical drag → screen brightness**
- **Right half, vertical drag → playback volume**

…available on **every playback path** (rnv on iOS + Android, VLC for MKV). Reaching
"every path" requires moving the iOS mainstream path off native AVPlayer controls
onto the app's custom overlay, so the gesture layer is uniform. To replace the
native AirPlay button that iOS loses in that move, add a custom AirPlay button.

## Background / current state

`src/screens/NativeVideoPlayer.tsx` has two control regimes today:

- **iOS rnv** (non-MKV): native AVPlayer controls (`controls={true}`).
- **VLC** (MKV, both platforms) and **Android rnv** (after the original-audio fix):
  custom JS overlay (transport row, scrubber, footer, track menu), `controls={false}`,
  video wrapped in a `Pressable` for tap-to-toggle.

`usesCustomControls = useVlc || Platform.OS === "android"`. This design makes it
**always true**.

## Design

### 1. Control unification (prerequisite)

- rnv `controls={false}` on **both** platforms → `usesCustomControls` is always true.
  Simplify/remove: `nativeControlsEnabled` state, the iOS back-press
  toggle hack in `useTVBackHandler`, `usesNativeControls`, `backButtonAlwaysVisible`,
  and the `onControlsVisibilityChange` handler.
- The custom overlay drives every path; `controlsVisible` is governed solely by
  tap + the existing auto-hide timer.
- Gate external (AirPlay) video playback on focus: `allowsExternalPlayback={isFocused}`.
  While the player is focused (i.e. you're watching) AirPlay still works, including
  Control-Center-initiated handoff. When you navigate away the screen loses focus
  and the AVPlayer pulls video back from the TV instead of leaving a half-connected
  session behind. (Revised from the original "always `true`" — see the AirPlay
  lifecycle note in §6. The audio output route is system-sticky regardless; the
  always-visible route button is how the user moves audio back.)
- iOS audio-track selection is unaffected — the iOS native module has no `controls`
  guard (unlike Android, which is exactly why this whole unification matters there).
- **TV:** gestures are touch-only and inert on TV; the existing `Focusable` transport
  buttons remain the remote-navigable controls. No regression.

### 2. Brightness (left)

- Add `expo-brightness` (native module → dev-client rebuild required).
- `brightnessRef` captures the original brightness on mount via
  `Brightness.getBrightnessAsync()`; restore it on unmount.
- Left-half vertical drag: `next = clamp(start - translationY / areaHeight, 0, 1)`
  (drag up = brighter). Apply with `Brightness.setBrightnessAsync(next)`.
- Uses the app/window brightness API (no Android `WRITE_SETTINGS`, no iOS permission).

### 3. Volume (right)

- New `volume` state, default `1.0` (player output volume, **not** device volume;
  hardware buttons unaffected).
- Pass to players: rnv `volume={volume}` (0–1); VLC `volume={Math.round(volume * 100)}`
  (libVLC 0–100).
- Right-half vertical drag: same delta math as brightness, clamped [0,1].

### 4. Gesture layer

- Replace the video-area `Pressable` (all paths) with a `GestureDetector` composing:
  - **Tap** → toggle controls (replaces the `Pressable` onPress).
  - **Pan** (vertical) with `activeOffsetY([-12, 12])` + `failOffsetX([-20, 20])` so
    only vertical drags activate and horizontal motion is ignored. `onBegin`
    records normalized start-x and the starting brightness/volume; `x < 0.5` →
    brightness mode, else volume mode. `onUpdate` computes the delta and applies.
    `onEnd` schedules the indicator to hide.
  - Compose with `Gesture.Race(tap, pan)`.
- Measure the gesture area height via `onLayout` (`areaHeight` state) for delta math.
- The bottom-bar horizontal scrubber stays its own `GestureDetector` in the overlay
  (a sibling view, not nested). Overlay containers keep `pointerEvents="box-none"`
  so drags that don't start on a button fall through to the video gesture layer —
  mirrors today's VLC Pressable + overlay coexistence.

### 5. Brightness/volume indicator

- Small centered overlay: icon (sun / speaker) + vertical level bar + percent.
- Visible only during an active drag; auto-hides ~800 ms after release.
- Independent of `controlsVisible` (it must work while controls are hidden).
- New component `src/components/PlayerLevelIndicator.tsx`.

### 6. Custom AirPlay button (native, iOS-only)

- `react-native-video` exposes no route-picker UI, so wrap iOS `AVRoutePickerView`
  in a **local Expo native module** at `modules/airplay-route-picker/`
  (`npx create-expo-module --local`), exposing a native view with tint props.
- `src/components/AirPlayButton.tsx`: renders the native view on iOS, `null` on Android.
- Placed in the top-right overlay cluster (near sources / CC buttons), shown with
  `controlsVisible`.
- Shown on **every** path (revised from the original rnv-only `!useVlc` plan).
  `AVRoutePickerView` controls the *system audio route*, not a specific player, so
  it must be reachable even on the VLC/MKV path — otherwise a previously-picked
  AirPlay route stays stuck on the TV with no in-app way to move audio back. On the
  rnv path it also hands off video; on VLC it only re-routes audio (libVLC can't
  hand off video), which is acceptable and still useful.

### AirPlay lifecycle note (why §1 gates `allowsExternalPlayback`)

The AirPlay *route* is a system-wide, user-selected audio output that iOS keeps
after you pick it; deactivating rnv's audio session on unmount does not clear it.
So after AirPlaying movie A and leaving, movie B's audio follows the same route.
We don't force-override the user's chosen route (hacky, inconsistent for AirPlay,
untestable without hardware). Instead: (a) the route button is always reachable so
the user can re-select iPhone, and (b) `allowsExternalPlayback={isFocused}` ends
external *video* when leaving so a full handoff doesn't linger.
- Android: renders nothing here (Chromecast is a separate future effort, out of scope).

## Files touched

- `src/screens/NativeVideoPlayer.tsx` — unification, gesture layer, volume/brightness
  state, indicator + AirPlay button placement.
- `src/components/PlayerLevelIndicator.tsx` — new.
- `src/components/AirPlayButton.tsx` — new.
- `modules/airplay-route-picker/` — new local Expo module (iOS Swift `AVRoutePickerView`).
- `package.json` — add `expo-brightness`.
- Native: dev-client rebuild (expo-brightness both platforms; AirPlay module iOS).

## Risks / notes

- New native deps (`expo-brightness`, local AirPlay module) → dev-client rebuild.
- Gesture composition vs. tap-toggle and the bottom scrubber needs on-device testing.
- VLC `volume` assumed 0–100; confirm on device.
- This stacks on the **Android original-audio fix that is not yet runtime-verified**;
  we will verify both together on device.

## Verification

On Android emulator + iOS simulator/device:

1. Drag left half up/down → brightness indicator shows and screen brightness changes;
   restored on exit.
2. Drag right half up/down → volume indicator shows and audio level changes.
3. Quick tap still toggles controls; bottom scrubber still seeks; track menu + sources
   still work on all paths.
4. iOS rnv shows the AirPlay button and it opens the route picker; VLC path hides it.
5. Original-audio still auto-selects (Android fix) and iOS audio selection still works
   after `controls={false}`.
