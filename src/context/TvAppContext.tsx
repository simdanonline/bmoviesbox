import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const TV_MODE_KEY = "@bmoviebox_tv_mode";
const UNLOCK_PASSWORD = "letmein";

interface TvAppContextType {
  isTvApp: boolean;
  isLoading: boolean;
  unlockTvApp: (password: string) => Promise<boolean>;
  lockTvApp: () => Promise<void>;
}

const TvAppContext = createContext<TvAppContextType>({
  isTvApp: false,
  isLoading: true,
  unlockTvApp: async () => false,
  lockTvApp: async () => {},
});

export function TvAppProvider({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === "web";
  const [isTvApp, setIsTvApp] = useState(isWeb);
  const [isLoading, setIsLoading] = useState(!isWeb);

  useEffect(() => {
    if (isWeb) return;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(TV_MODE_KEY);
        if (value) {
          const parsed = JSON.parse(value);
          setIsTvApp(parsed.unlocked === true);
        }
      } catch (e) {
        console.error("Failed to load TV mode state:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const unlockTvApp = useCallback(
    async (password: string): Promise<boolean> => {
      if (password.toLowerCase() === UNLOCK_PASSWORD) {
        await AsyncStorage.setItem(
          TV_MODE_KEY,
          JSON.stringify({ unlocked: true })
        );
        setIsTvApp(true);
        return true;
      }
      return false;
    },
    []
  );

  const lockTvApp = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(TV_MODE_KEY);
    setIsTvApp(false);
  }, []);

  return (
    <TvAppContext.Provider value={{ isTvApp, isLoading, unlockTvApp, lockTvApp }}>
      {children}
    </TvAppContext.Provider>
  );
}

export const useTvApp = () => useContext(TvAppContext);
export default TvAppContext;
