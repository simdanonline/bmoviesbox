import { useEffect, useRef } from "react";
import { Platform, BackHandler } from "react-native";

export function useTVBackHandler(onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!Platform.isTV) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);
}
