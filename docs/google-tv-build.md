# Building BMovieBox for Google TV

## Build

```bash
npm run tv:build
```

Download the resulting APK from the EAS build page link printed in the terminal.

## One-time TV setup

1. On the Google TV: Settings → System → About → tap "Android TV OS build" 7 times. Developer Options will appear under Settings → System.
2. In Developer Options, enable "Network debugging" (a.k.a. "ADB debugging").
3. Note the TV's IP address from Settings → Network → (your network) → IP address.
4. On your laptop:
   ```bash
   adb connect <TV_IP>:5555
   ```
   Accept the prompt on the TV (check "Always allow").

## Install the APK

```bash
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv.apk
```

For re-installs over a non-TV build of the app, uninstall first:
```bash
adb -s <TV_IP>:5555 uninstall com.simdanonline.bmoviebox
```

## Tail logs while running

```bash
adb -s <TV_IP>:5555 logcat *:S ReactNative:V ReactNativeJS:V
```

## Verifying

- Open the Google TV launcher. BMovieBox should appear in the **Apps row** with its banner — not just buried in "All apps."
- Launch the app. The first focus should land on the FeaturedMovie play button (red border / glow / scale).
- D-pad **right / left** moves along a rail; **down** moves to the next rail; **up** lands on the top tab bar.
- Center button activates a card.
- The remote's **back** button exits MovieDetails and VideoPlayer.

If the app installs but doesn't appear in the Apps row, the Leanback manifest didn't take effect — inspect the APK's manifest with `apktool d -s -f bmoviebox-tv.apk -o /tmp/inspect` and check `grep LEANBACK_LAUNCHER /tmp/inspect/AndroidManifest.xml`.
