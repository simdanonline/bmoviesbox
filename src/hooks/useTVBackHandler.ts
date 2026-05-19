import { useEffect } from "react";
import { Platform, TVEventHandler } from "react-native";

export function useTVBackHandler(onBack: () => void) {
  useEffect(() => {
    if (!Platform.isTV) return;
    const handler = new TVEventHandler();
    handler.enable(null, (_cmp, evt: { eventType?: string }) => {
      if (evt?.eventType === "menu") onBack();
    });
    return () => handler.disable();
  }, [onBack]);
}
