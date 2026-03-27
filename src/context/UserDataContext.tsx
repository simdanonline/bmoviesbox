import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WATCHLIST_KEY = "@bmoviebox_watchlist";
const HISTORY_KEY = "@bmoviebox_history";
const RATINGS_KEY = "@bmoviebox_ratings";

export interface SavedItem {
  id: string;
  title: string;
  thumbnail: string;
  imdbRating: string | null;
  releaseYear: string | null;
  genres: string[];
  url: string;
  isSeries: boolean;
  savedAt: number;
}

interface UserRating {
  itemId: string;
  rating: number;
  ratedAt: number;
}

interface UserDataContextType {
  watchlist: SavedItem[];
  isInWatchlist: (url: string) => boolean;
  toggleWatchlist: (item: SavedItem) => void;
  removeFromWatchlist: (url: string) => void;

  history: SavedItem[];
  addToHistory: (item: SavedItem) => void;
  clearHistory: () => void;

  ratings: Record<string, UserRating>;
  setRating: (url: string, rating: number) => void;
  getRating: (url: string) => number | null;

  isLoading: boolean;
}

const UserDataContext = createContext<UserDataContextType>({
  watchlist: [],
  isInWatchlist: () => false,
  toggleWatchlist: () => {},
  removeFromWatchlist: () => {},
  history: [],
  addToHistory: () => {},
  clearHistory: () => {},
  ratings: {},
  setRating: () => {},
  getRating: () => null,
  isLoading: true,
});

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<SavedItem[]>([]);
  const [history, setHistory] = useState<SavedItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, UserRating>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [watchlistData, historyData, ratingsData] = await Promise.all([
          AsyncStorage.getItem(WATCHLIST_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(RATINGS_KEY),
        ]);
        if (watchlistData) setWatchlist(JSON.parse(watchlistData));
        if (historyData) setHistory(JSON.parse(historyData));
        if (ratingsData) setRatings(JSON.parse(ratingsData));
      } catch (e) {
        console.error("Failed to load user data:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const isInWatchlist = useCallback(
    (url: string) => watchlist.some((w) => w.url === url),
    [watchlist]
  );

  const toggleWatchlist = useCallback((item: SavedItem) => {
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.url === item.url);
      const next = exists
        ? prev.filter((w) => w.url !== item.url)
        : [{ ...item, savedAt: Date.now() }, ...prev];
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFromWatchlist = useCallback((url: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((w) => w.url !== url);
      AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addToHistory = useCallback((item: SavedItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.url !== item.url);
      const next = [{ ...item, savedAt: Date.now() }, ...filtered].slice(0, 50);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

  const setRating = useCallback((url: string, rating: number) => {
    setRatings((prev) => {
      const next = { ...prev, [url]: { itemId: url, rating, ratedAt: Date.now() } };
      AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getRating = useCallback(
    (url: string): number | null => {
      return ratings[url]?.rating ?? null;
    },
    [ratings]
  );

  return (
    <UserDataContext.Provider
      value={{
        watchlist,
        isInWatchlist,
        toggleWatchlist,
        removeFromWatchlist,
        history,
        addToHistory,
        clearHistory,
        ratings,
        setRating,
        getRating,
        isLoading,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export const useUserData = () => useContext(UserDataContext);
export default UserDataContext;
