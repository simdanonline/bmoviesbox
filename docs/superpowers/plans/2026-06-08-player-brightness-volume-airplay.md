# Player brightness/volume gestures + unified controls + AirPlay button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add left=brightness / right=volume vertical-drag gestures to the video player on every playback path, unify all paths onto the custom control overlay, and add a custom iOS AirPlay button.

**Architecture:** All rnv playback moves to `controls={false}` so the app's custom overlay drives every path (VLC, rnv iOS, rnv Android). A single `GestureDetector` over the video composes a tap (toggle controls) with a vertical pan (left half → `expo-brightness`, right half → player `volume`). A pure helper holds the gesture math (unit-tested). A local Expo module wraps `AVRoutePickerView` for the AirPlay button.

**Tech Stack:** React Native, react-native-gesture-handler v2, react-native-video v6, react-native-vlc-media-player, expo-brightness, Expo local native module (Swift / AVKit), Jest.

**Spec:** `docs/superpowers/specs/2026-06-08-player-brightness-volume-airplay-design.md`

---

## File Structure

- Create `src/utils/playerGestureMath.ts` — pure helpers: axis-from-x, clamped vertical delta.
- Create `src/utils/__tests__/playerGestureMath.test.ts` — Jest unit tests.
- Create `src/components/PlayerLevelIndicator.tsx` — brightness/volume HUD.
- Create `modules/airplay-route-picker/` — local Expo module (iOS `AVRoutePickerView`).
- Create `src/components/AirPlayButton.tsx` — RN wrapper, `null` on Android.
- Modify `src/screens/NativeVideoPlayer.tsx` — unification, state, gesture layer, HUD + button placement.
- Modify `package.json` — add `expo-brightness`.

---

## Task 1: Add native dependencies

**Files:**
- Modify: `package.json`
- Create: `modules/airplay-route-picker/` (scaffold)

- [ ] **Step 1: Install expo-brightness**

Run: `npx expo install expo-brightness`
Expected: `expo-brightness` added to `package.json` dependencies.

- [ ] **Step 2: Scaffold the local AirPlay Expo module**

Run: `npx create-expo-module@latest --local airplay-route-picker`
When prompted, accept defaults (name `airplay-route-picker`). This creates `modules/airplay-route-picker/` with `ios/`, `src/`, `index.ts`, `expo-module.config.json`.

- [ ] **Step 3: Commit the scaffold**

```bash
git add package.json package-lock.json modules/airplay-route-picker
git commit -m "chore: add expo-brightness and scaffold local airplay-route-picker module"
```

---

## Task 2: Pure gesture math helper (TDD)

**Files:**
- Create: `src/utils/playerGestureMath.ts`
- Test: `src/utils/__tests__/playerGestureMath.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/utils/__tests__/playerGestureMath.test.ts
import { gestureAxisForX, applyVerticalDelta } from "../playerGestureMath";

describe("gestureAxisForX", () => {
  it("returns brightness on the left half", () => {
    expect(gestureAxisForX(10, 100)).toBe("brightness");
  });
  it("returns volume on the right half", () => {
    expect(gestureAxisForX(60, 100)).toBe("volume");
  });
  it("treats exact midpoint as volume", () => {
    expect(gestureAxisForX(50, 100)).toBe("volume");
  });
  it("falls back to brightness when width is unknown", () => {
    expect(gestureAxisForX(10, 0)).toBe("brightness");
  });
});

describe("applyVerticalDelta", () => {
  it("increases value on upward drag (negative translationY)", () => {
    expect(applyVerticalDelta(0.5, -100, 200)).toBeCloseTo(1.0);
  });
  it("decreases value on downward drag", () => {
    expect(applyVerticalDelta(0.5, 100, 200)).toBeCloseTo(0.0);
  });
  it("clamps to [0,1]", () => {
    expect(applyVerticalDelta(0.5, -1000, 200)).toBe(1);
    expect(applyVerticalDelta(0.5, 1000, 200)).toBe(0);
  });
  it("returns the start value when area height is non-positive", () => {
    expect(applyVerticalDelta(0.3, -50, 0)).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/__tests__/playerGestureMath.test.ts`
Expected: FAIL — cannot find module `../playerGestureMath`.

- [ ] **Step 3: Implement the helper**

```ts
// src/utils/playerGestureMath.ts
export type GestureAxis = "brightness" | "volume";

/** Left half of the surface controls brightness, right half controls volume.
 *  Width 0 (not yet measured) defaults to brightness. */
export function gestureAxisForX(x: number, width: number): GestureAxis {
  if (width <= 0) return "brightness";
  return x < width / 2 ? "brightness" : "volume";
}

/** Map a vertical drag to a new 0..1 level. Dragging up (negative
 *  translationY) raises the level; a full-height drag spans the full range.
 *  Non-positive areaHeight (not yet measured) leaves the value unchanged. */
export function applyVerticalDelta(
  start: number,
  translationY: number,
  areaHeight: number,
): number {
  if (areaHeight <= 0) return start;
  const next = start - translationY / areaHeight;
  return Math.max(0, Math.min(1, next));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/playerGestureMath.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/utils/playerGestureMath.ts src/utils/__tests__/playerGestureMath.test.ts
git commit -m "feat: add pure gesture math helpers for player brightness/volume"
```

---

## Task 3: Brightness/volume HUD component

**Files:**
- Create: `src/components/PlayerLevelIndicator.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/PlayerLevelIndicator.tsx
import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { GestureAxis } from "../utils/playerGestureMath";

type Props = { axis: GestureAxis; level: number }; // level 0..1

export default function PlayerLevelIndicator({ axis, level }: Props) {
  const pct = Math.round(level * 100);
  const icon =
    axis === "brightness" ? "sun-o" : level <= 0 ? "volume-off" : "volume-up";
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.card}>
        <FontAwesome name={icon} size={22} color="#fff" />
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${pct}%` }]} />
        </View>
        <Text style={styles.label}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    width: 92,
  },
  track: {
    width: 6,
    height: 120,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginVertical: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: 6, borderRadius: 3, backgroundColor: "#fff" },
  label: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep PlayerLevelIndicator || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlayerLevelIndicator.tsx
git commit -m "feat: add PlayerLevelIndicator HUD for brightness/volume"
```

---

## Task 4: AirPlay local module (iOS) + RN wrapper

**Files:**
- Modify: `modules/airplay-route-picker/expo-module.config.json`
- Create/Modify: `modules/airplay-route-picker/ios/AirplayRoutePickerModule.swift`
- Modify: `modules/airplay-route-picker/src/AirplayRoutePickerView.tsx`
- Modify: `modules/airplay-route-picker/index.ts`
- Create: `src/components/AirPlayButton.tsx`

- [ ] **Step 1: Set the module config to Apple-only**

```json
// modules/airplay-route-picker/expo-module.config.json
{
  "platforms": ["apple"],
  "apple": { "modules": ["AirplayRoutePickerModule"] }
}
```

- [ ] **Step 2: Implement the native view module**

```swift
// modules/airplay-route-picker/ios/AirplayRoutePickerModule.swift
import ExpoModulesCore
import AVKit

public class AirplayRoutePickerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AirplayRoutePicker")

    View(AirplayRoutePickerView.self) {
      Prop("tint") { (view: AirplayRoutePickerView, color: UIColor?) in
        view.picker.tintColor = color
      }
      Prop("activeTint") { (view: AirplayRoutePickerView, color: UIColor?) in
        view.picker.activeTintColor = color
      }
    }
  }
}

class AirplayRoutePickerView: ExpoView {
  let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.prioritizesVideoDevices = true
    addSubview(picker)
    picker.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      picker.leadingAnchor.constraint(equalTo: leadingAnchor),
      picker.trailingAnchor.constraint(equalTo: trailingAnchor),
      picker.topAnchor.constraint(equalTo: topAnchor),
      picker.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }
}
```

- [ ] **Step 3: Implement the RN view binding**

```tsx
// modules/airplay-route-picker/src/AirplayRoutePickerView.tsx
import { requireNativeView } from "expo";
import * as React from "react";
import type { ViewProps } from "react-native";

export type AirplayRoutePickerViewProps = ViewProps & {
  tint?: string;
  activeTint?: string;
};

const NativeView = requireNativeView<AirplayRoutePickerViewProps>(
  "AirplayRoutePicker",
);

export default function AirplayRoutePickerView(
  props: AirplayRoutePickerViewProps,
) {
  return <NativeView {...props} />;
}
```

- [ ] **Step 4: Export from the module index**

```ts
// modules/airplay-route-picker/index.ts
export { default as AirplayRoutePickerView } from "./src/AirplayRoutePickerView";
export type { AirplayRoutePickerViewProps } from "./src/AirplayRoutePickerView";
```

- [ ] **Step 5: Create the cross-platform AirPlay button**

```tsx
// src/components/AirPlayButton.tsx
import { Platform } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { AirplayRoutePickerView } from "../../modules/airplay-route-picker";

export default function AirPlayButton({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  // AVRoutePickerView is iOS-only; Android casting (Chromecast) is out of scope.
  if (Platform.OS !== "ios") return null;
  return (
    <AirplayRoutePickerView style={style} tint="#ffffff" activeTint="#1e90ff" />
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add modules/airplay-route-picker src/components/AirPlayButton.tsx
git commit -m "feat: add iOS AVRoutePickerView module and AirPlayButton wrapper"
```

---

## Task 5: Unify all playback onto custom controls

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Make `usesCustomControls` always true and drop the native-controls flags**

Replace the block defining `usesCustomControls` / `usesNativeControls` / `backButtonAlwaysVisible` (currently around lines 246-261) with:

```tsx
  // Every path now uses the app's custom control overlay. The rnv `controls`
  // flag stays off so (a) ExoPlayer honors programmatic audio selection on
  // Android and (b) our brightness/volume gestures own the surface uniformly.
  const usesCustomControls = true;
  // Back button is tied to controlsVisible on every path (no native controls to
  // outlive the overlay), so it no longer needs an always-visible mode.
  const backButtonAlwaysVisible = false;
  // Show the custom track menu whenever there's a choice to make.
  const hasTrackChoices = audioTracks.length > 1 || textTracks.length > 0;
```

- [ ] **Step 2: Remove the `nativeControlsEnabled` state**

Delete the line (around 206):

```tsx
  const [nativeControlsEnabled, setNativeControlsEnabled] = useState(true);
```

Also delete the now-unused `controlsRestoreTimer` ref (around 213-215) and its
cleanup effect (the effect whose body clears `controlsRestoreTimer.current`,
around 316-324).

- [ ] **Step 3: Simplify the back handler**

In `useTVBackHandler`, replace the `if (controlsVisible && !errored) { ... }` body
(the branch that currently toggles `setNativeControlsEnabled`) with the
custom-controls behavior only:

```tsx
    if (controlsVisible && !errored) {
      clearHideTimer();
      setControlsVisible(false);
      return;
    }
```

- [ ] **Step 4: Force `controls={false}` and drop the native-visibility handler**

In the `rnvVideo` element, change:

```tsx
      controls={usesNativeControls && nativeControlsEnabled}
```
to:
```tsx
      controls={false}
```

and delete the `onControlsVisibilityChange={(e) => setControlsVisible(e.isVisible)}`
prop (it never fires when `controls={false}`).

- [ ] **Step 5: Typecheck (expect no unused-symbol errors)**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep -E "NativeVideoPlayer|usesNativeControls|nativeControlsEnabled" || echo OK`
Expected: `OK` (no references to removed symbols remain).

- [ ] **Step 6: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "refactor: unify all player paths onto custom controls (controls=false)"
```

---

## Task 6: Brightness + volume state and player wiring

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Import expo-brightness**

Add near the other imports:

```tsx
import * as Brightness from "expo-brightness";
```

- [ ] **Step 2: Add volume state and a brightness restore ref**

Add with the other `useState`/`useRef` declarations:

```tsx
  // Player output volume (0..1). Not the device volume — hardware buttons are
  // independent. Passed to both players (VLC takes 0..100).
  const [volume, setVolume] = useState(1);
  // Live brightness (0..1) for the HUD; original captured for restore on exit.
  const [brightness, setBrightness] = useState(1);
  const originalBrightnessRef = useRef<number | null>(null);
```

- [ ] **Step 3: Capture + restore brightness on mount/unmount**

Add an effect (near the other mount effects):

```tsx
  // Seed the HUD with the current brightness and restore it when leaving.
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
```

- [ ] **Step 4: Pass `volume` to the rnv `<Video>`**

In the `rnvVideo` element add (next to `paused={paused}`):

```tsx
      volume={volume}
```

- [ ] **Step 5: Pass `volume` to the `<VLCPlayer>`**

In the VLC element add (next to `paused={paused}`):

```tsx
            volume={Math.round(volume * 100)}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep NativeVideoPlayer || echo OK`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: add player volume + brightness state and player wiring"
```

---

## Task 7: Gesture layer + HUD wiring

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Import the helpers and HUD**

```tsx
import PlayerLevelIndicator from "../components/PlayerLevelIndicator";
import {
  applyVerticalDelta,
  gestureAxisForX,
  type GestureAxis,
} from "../utils/playerGestureMath";
```

- [ ] **Step 2: Add gesture/HUD state and refs**

```tsx
  // Width/height of the video surface, measured for gesture math.
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
```

- [ ] **Step 3: Add live mirrors so the gesture closure isn't stale**

```tsx
  const brightnessRef = useRef(1);
  const volumeRef = useRef(1);
  useEffect(() => {
    brightnessRef.current = brightness;
  }, [brightness]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
```

- [ ] **Step 4: Add the apply + HUD-hide helpers**

```tsx
  const showHud = (axis: GestureAxis, level: number) => {
    setHud({ axis, level });
    if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
  };

  const scheduleHudHide = () => {
    if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
    hudHideTimer.current = setTimeout(() => setHud(null), 800);
  };

  // Clear the HUD timer on unmount.
  useEffect(
    () => () => {
      if (hudHideTimer.current) clearTimeout(hudHideTimer.current);
    },
    [],
  );
```

- [ ] **Step 5: Build the composed brightness/volume + tap gesture**

```tsx
  const surfaceGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(250)
      .onEnd(() => {
        if (controlsVisible) setControlsVisible(false);
        else showControls();
      });

    const pan = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-12, 12])
      .failOffsetX([-20, 20])
      .onBegin((e) => {
        const axis = gestureAxisForX(e.x, surfaceSize.width);
        const start =
          axis === "brightness" ? brightnessRef.current : volumeRef.current;
        gestureStartRef.current = { axis, start };
        showHud(axis, start);
      })
      .onUpdate((e) => {
        const { axis, start } = gestureStartRef.current;
        const next = applyVerticalDelta(start, e.translationY, surfaceSize.height);
        if (axis === "brightness") {
          setBrightness(next);
          void Brightness.setBrightnessAsync(next);
        } else {
          setVolume(next);
        }
        showHud(axis, next);
      })
      .onFinalize(() => {
        scheduleHudHide();
      });

    return Gesture.Race(pan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceSize.width, surfaceSize.height, controlsVisible]);
```

- [ ] **Step 6: Wrap the video surface with the gesture + measure layout**

Replace the player-rendering block. The VLC branch and the Android-rnv branch
currently use a `Pressable` for tap-to-toggle; both now use a single
`GestureDetector`. Replace the whole `{useVlc ? (...) : usesCustomControls ? (...) : (...)}`
expression with:

```tsx
      <GestureDetector gesture={surfaceGesture}>
        <View
          style={styles.video}
          onLayout={(e) =>
            setSurfaceSize({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })
          }
        >
          {useVlc ? (
            <VLCPlayer
              key={`vlc-${currentIndex}-${reloadNonce}`}
              style={styles.video}
              source={vlcSource}
              paused={paused}
              volume={Math.round(volume * 100)}
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
          ) : (
            rnvVideo
          )}
        </View>
      </GestureDetector>
```

(The `volume`/`paused` props on the VLC element are carried over from Task 6 Step 5;
keep them as shown here. `rnvVideo` already carries its own `volume` prop.)

- [ ] **Step 7: Render the HUD**

Add just before the closing `</View>` of the root (after the back button block):

```tsx
      {hud && <PlayerLevelIndicator axis={hud.axis} level={hud.level} />}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep NativeVideoPlayer || echo OK`
Expected: `OK`.

- [ ] **Step 9: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: left=brightness / right=volume drag gestures with HUD"
```

---

## Task 8: Place the AirPlay button in the overlay

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx`

- [ ] **Step 1: Import the button**

```tsx
import AirPlayButton from "../components/AirPlayButton";
```

- [ ] **Step 2: Render it in the top-right cluster on the rnv path**

Add after the sources/CC button blocks (so it sits in the same top-right column).
AirPlay only makes sense for AVPlayer (rnv), not libVLC, so gate on `!useVlc`:

```tsx
      {controlsVisible && !errored && !useVlc && (
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep NativeVideoPlayer || echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: add custom AirPlay button to the player overlay (iOS rnv path)"
```

---

## Task 9: Build, verify on device, remove temp log

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx` (remove temp log)

- [ ] **Step 1: Install pods + rebuild dev clients (native deps added)**

This project commits `ios/`/`android/` (they are git-tracked, not gitignored) and
the Podfile uses `use_expo_modules!` — so DO NOT run `expo prebuild` (it would
regenerate the committed native projects). Both `expo-brightness` and the local
`modules/airplay-route-picker` module autolink. Just install pods and build:

Run: `npx pod-install` (or `cd ios && pod install`), then `npm run ios` and
`npm run android`. Expected: both apps build with `expo-brightness` linked and the
AirPlay module compiled into the iOS Pods project (apple-only; Android ignores it).

- [ ] **Step 2: Verify on Android emulator**

Play a multi-audio title. Confirm via Metro logs the `[NativeVideoPlayer] onAudioTracks`
line shows `matchedOriginalIndex` set and audio plays the original language.
Then: drag left half → brightness HUD + screen brightness changes; drag right half
→ volume HUD + audio level changes; quick tap toggles controls; bottom scrubber
seeks; track menu + sources open.

- [ ] **Step 3: Verify on iOS**

Confirm the custom overlay now drives iOS (no native AVPlayer controls), audio
selection still works, brightness/volume gestures work, and the AirPlay button
appears top-right and opens the route picker. On an MKV/VLC title, confirm the
AirPlay button is hidden and volume/brightness still work.

- [ ] **Step 4: Remove the temporary audio log**

Delete the `// TEMP(verify-android-original-audio)` `console.log(...)` block in
`handleRnvAudioTracks`.

- [ ] **Step 5: Typecheck + unit tests**

Run: `npx jest src/utils/__tests__/playerGestureMath.test.ts` → PASS.
Run: `npx tsc --noEmit --moduleResolution bundler --module esnext 2>&1 | grep -E "NativeVideoPlayer|playerGestureMath" || echo OK` → `OK`.

- [ ] **Step 6: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "chore: remove temporary audio-track diagnostic log"
```

---

## Self-Review

**Spec coverage:**
- Control unification → Task 5. ✓
- Brightness (expo-brightness, restore on exit) → Tasks 1, 6. ✓
- Volume (player prop, both players) → Tasks 6, 7. ✓
- Gesture layer (vertical pan, axis-by-x, tap compose, layout measure) → Tasks 2, 7. ✓
- HUD indicator → Tasks 3, 7. ✓
- AirPlay button (AVRoutePickerView local module, iOS-only, rnv-only) → Tasks 1, 4, 8. ✓
- Keep `allowsExternalPlayback` → already present on `rnvVideo`; untouched. ✓
- TV inertness → gestures are touch-only; Focusable transport buttons unchanged. ✓
- Verification incl. Android audio fix → Task 9. ✓

**Placeholder scan:** none — all steps carry concrete code/commands.

**Type consistency:** `GestureAxis`, `gestureAxisForX`, `applyVerticalDelta` defined in Task 2 and used identically in Tasks 3 and 7. `surfaceSize`, `hud`, `volume`, `brightness` names consistent across Tasks 6–8. VLC volume scaling (`Math.round(volume * 100)`) consistent in Task 6 Step 5 and Task 7 Step 6.
