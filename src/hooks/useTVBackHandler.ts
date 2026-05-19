import { useEffect, useRef } from "react";
import { Platform, TVEventHandler } from "react-native";

export function useTVBackHandler(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!Platform.isTV) return;
    const handler = new TVEventHandler();
    handler.enable(null, (_cmp, evt: { eventType?: string }) => {
      if (evt?.eventType === "menu") onBackRef.current();
    });
    return () => handler.disable();
  }, []);
}
