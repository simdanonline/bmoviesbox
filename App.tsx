import { useEffect } from "react";
import * as Updates from "expo-updates";
import * as Device from "expo-device";
import AppStack from "./src/navigation/AppStack";

export default function App() {
  useEffect(() => {
    if (__DEV__ || !Device.isDevice) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.warn("Auto update check failed:", e);
      }
    })();
  }, []);

  return (
    <>
      <AppStack />
    </>
  );
}
