import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TasteProfile,
  DEFAULT_TASTE_PROFILE,
  LibraryItem,
  EpisodeProgress,
  TitleReminder,
  KnownTitleMetadata,
  WatchStatus,
  WatchPlanItem,
  WatchPlanStatus,
  TitleNote,
} from "../types/app";

// ── Storage keys ──
const WATCHLIST_KEY = "@bmoviebox_watchlist";
const HISTORY_KEY = "@bmoviebox_history";
const RATINGS_KEY = "@bmoviebox_ratings";
const TASTE_PROFILE_KEY = "@bmoviebox_taste_profile";
const LIBRARY_KEY = "@bmoviebox_library";
const EPISODE_PROGRESS_KEY = "@bmoviebox_episode_progress";
const REMINDERS_KEY = "@bmoviebox_reminders";
const KNOWN_METADATA_KEY = "@bmoviebox_known_title_metadata";
const WATCH_PLANS_KEY = "@bmoviebox_watch_plans";
const TITLE_NOTES_KEY = "@bmoviebox_title_notes";
const MIGRATION_KEY = "@bmoviebox_migration_v1";

// ── Legacy type (kept for migration and compat) ──
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

// ── Context type ──
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

  tasteProfile: TasteProfile;
  setTasteProfile: (profile: TasteProfile) => void;
  completeOnboarding: () => void;
  resetTasteProfile: () => void;
  isOnboardingComplete: boolean;

  library: LibraryItem[];
  setLibraryStatus: (
    item: Omit<
      LibraryItem,
      | "status"
      | "savedAt"
      | "updatedAt"
      | "lastOpenedAt"
      | "lastEpisodeUrl"
      | "lastSeasonNumber"
      | "lastEpisodeNumber"
      | "completedEpisodes"
      | "totalEpisodes"
    > & { status: WatchStatus },
  ) => void;
  toggleWantToWatch: (item: SavedItem) => void;
  getLibraryItem: (url: string) => LibraryItem | undefined;
  getItemsByStatus: (status: WatchStatus) => LibraryItem[];
  removeFromLibrary: (url: string) => void;
  updateLibraryItemOpened: (url: string) => void;
  updateLibraryEpisodeContext: (
    seriesUrl: string,
    episodeUrl: string,
    seasonNumber: number,
    episodeNumber: number,
  ) => void;

  episodeProgress: EpisodeProgress[];
  markEpisodeWatched: (
    ep: Omit<EpisodeProgress, "watched" | "watchedAt" | "updatedAt">,
  ) => void;
  markEpisodeUnwatched: (seriesUrl: string, episodeUrl: string) => void;
  getSeriesProgress: (seriesUrl: string) => EpisodeProgress[];
  isEpisodeWatched: (episodeUrl: string) => boolean;

  getContinueWatchingItems: () => LibraryItem[];

  reminders: TitleReminder[];
  addReminder: (reminder: TitleReminder) => void;
  removeReminder: (id: string) => void;
  updateReminder: (id: string, updates: Partial<TitleReminder>) => void;
  getReminderForTitle: (titleUrl: string) => TitleReminder | undefined;

  watchPlans: WatchPlanItem[];
  addWatchPlan: (
    item: Omit<WatchPlanItem, "id" | "status" | "createdAt" | "updatedAt"> & {
      status?: WatchPlanStatus;
    },
  ) => void;
  updateWatchPlan: (id: string, updates: Partial<WatchPlanItem>) => void;
  removeWatchPlan: (id: string) => void;
  getPlansForTitle: (titleUrl: string) => WatchPlanItem[];

  titleNotes: Record<string, TitleNote>;
  saveTitleNote: (note: Omit<TitleNote, "createdAt" | "updatedAt">) => void;
  deleteTitleNote: (titleUrl: string) => void;
  getTitleNote: (titleUrl: string) => TitleNote | undefined;

  knownMetadata: Record<string, KnownTitleMetadata>;
  saveKnownTitleMetadata: (metadata: KnownTitleMetadata) => void;
  getKnownTitleMetadata: (url: string) => KnownTitleMetadata | undefined;

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
  tasteProfile: DEFAULT_TASTE_PROFILE,
  setTasteProfile: () => {},
  completeOnboarding: () => {},
  resetTasteProfile: () => {},
  isOnboardingComplete: false,
  library: [],
  setLibraryStatus: () => {},
  toggleWantToWatch: () => {},
  getLibraryItem: () => undefined,
  getItemsByStatus: () => [],
  removeFromLibrary: () => {},
  updateLibraryItemOpened: () => {},
  updateLibraryEpisodeContext: () => {},
  episodeProgress: [],
  markEpisodeWatched: () => {},
  markEpisodeUnwatched: () => {},
  getSeriesProgress: () => [],
  isEpisodeWatched: () => false,
  getContinueWatchingItems: () => [],
  reminders: [],
  addReminder: () => {},
  removeReminder: () => {},
  updateReminder: () => {},
  getReminderForTitle: () => undefined,
  watchPlans: [],
  addWatchPlan: () => {},
  updateWatchPlan: () => {},
  removeWatchPlan: () => {},
  getPlansForTitle: () => [],
  titleNotes: {},
  saveTitleNote: () => {},
  deleteTitleNote: () => {},
  getTitleNote: () => undefined,
  knownMetadata: {},
  saveKnownTitleMetadata: () => {},
  getKnownTitleMetadata: () => undefined,
  isLoading: true,
});

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<SavedItem[]>([]);
  const [history, setHistory] = useState<SavedItem[]>([]);
  const [ratings, setRatings] = useState<Record<string, UserRating>>({});
  const [tasteProfile, setTasteProfileState] = useState<TasteProfile>(
    DEFAULT_TASTE_PROFILE,
  );
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress[]>([]);
  const [reminders, setReminders] = useState<TitleReminder[]>([]);
  const [watchPlans, setWatchPlans] = useState<WatchPlanItem[]>([]);
  const [titleNotes, setTitleNotes] = useState<Record<string, TitleNote>>({});
  const [knownMetadata, setKnownMetadata] = useState<
    Record<string, KnownTitleMetadata>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  const libraryRef = useRef(library);
  libraryRef.current = library;
  const episodeProgressRef = useRef(episodeProgress);
  episodeProgressRef.current = episodeProgress;

  useEffect(() => {
    (async () => {
      try {
        const [
          watchlistData,
          historyData,
          ratingsData,
          tasteData,
          libraryData,
          epProgressData,
          remindersData,
          metadataData,
          watchPlansData,
          titleNotesData,
          migrationDone,
        ] = await Promise.all([
          AsyncStorage.getItem(WATCHLIST_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(RATINGS_KEY),
          AsyncStorage.getItem(TASTE_PROFILE_KEY),
          AsyncStorage.getItem(LIBRARY_KEY),
          AsyncStorage.getItem(EPISODE_PROGRESS_KEY),
          AsyncStorage.getItem(REMINDERS_KEY),
          AsyncStorage.getItem(KNOWN_METADATA_KEY),
          AsyncStorage.getItem(WATCH_PLANS_KEY),
          AsyncStorage.getItem(TITLE_NOTES_KEY),
          AsyncStorage.getItem(MIGRATION_KEY),
        ]);

        if (watchlistData) setWatchlist(JSON.parse(watchlistData));
        if (historyData) setHistory(JSON.parse(historyData));
        if (ratingsData) setRatings(JSON.parse(ratingsData));
        if (tasteData) setTasteProfileState(JSON.parse(tasteData));
        if (epProgressData) setEpisodeProgress(JSON.parse(epProgressData));
        if (remindersData) setReminders(JSON.parse(remindersData));
        if (metadataData) setKnownMetadata(JSON.parse(metadataData));
        if (watchPlansData) setWatchPlans(JSON.parse(watchPlansData));
        if (titleNotesData) setTitleNotes(JSON.parse(titleNotesData));

        let parsedLibrary: LibraryItem[] = libraryData
          ? JSON.parse(libraryData)
          : [];

        // Migration: convert old watchlist → library items with status want_to_watch
        if (!migrationDone && watchlistData) {
          const oldWatchlist: SavedItem[] = JSON.parse(watchlistData);
          const existingUrls = new Set(parsedLibrary.map((l) => l.url));
          const migratedItems: LibraryItem[] = oldWatchlist
            .filter((w) => !existingUrls.has(w.url))
            .map((w) => ({
              url: w.url,
              id: w.id,
              title: w.title,
              thumbnail: w.thumbnail,
              releaseYear: w.releaseYear,
              genres: w.genres,
              imdbRating: w.imdbRating,
              isSeries: w.isSeries,
              status: "want_to_watch" as WatchStatus,
              savedAt: w.savedAt,
              updatedAt: Date.now(),
              lastOpenedAt: null,
              lastEpisodeUrl: null,
              lastSeasonNumber: null,
              lastEpisodeNumber: null,
              completedEpisodes: 0,
              totalEpisodes: null,
            }));
          parsedLibrary = [...migratedItems, ...parsedLibrary];
          await AsyncStorage.setItem(
            LIBRARY_KEY,
            JSON.stringify(parsedLibrary),
          );
          await AsyncStorage.setItem(MIGRATION_KEY, "done");
        }

        setLibrary(parsedLibrary);
      } catch (e) {
        console.error("Failed to load user data:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Persist helpers ──
  const persistLibrary = useCallback((items: LibraryItem[]) => {
    AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  }, []);
  const persistEpisodeProgress = useCallback((items: EpisodeProgress[]) => {
    AsyncStorage.setItem(EPISODE_PROGRESS_KEY, JSON.stringify(items));
  }, []);
  const persistReminders = useCallback((items: TitleReminder[]) => {
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(items));
  }, []);
  const persistWatchPlans = useCallback((items: WatchPlanItem[]) => {
    AsyncStorage.setItem(WATCH_PLANS_KEY, JSON.stringify(items));
  }, []);
  const persistTitleNotes = useCallback((items: Record<string, TitleNote>) => {
    AsyncStorage.setItem(TITLE_NOTES_KEY, JSON.stringify(items));
  }, []);
  const persistMetadata = useCallback(
    (data: Record<string, KnownTitleMetadata>) => {
      AsyncStorage.setItem(KNOWN_METADATA_KEY, JSON.stringify(data));
    },
    [],
  );

  // ── Legacy watchlist ──
  const isInWatchlist = useCallback(
    (url: string) => watchlist.some((w) => w.url === url),
    [watchlist],
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
      const next = {
        ...prev,
        [url]: { itemId: url, rating, ratedAt: Date.now() },
      };
      AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getRating = useCallback(
    (url: string): number | null => ratings[url]?.rating ?? null,
    [ratings],
  );

  // ── Taste profile ──
  const setTasteProfile = useCallback((profile: TasteProfile) => {
    const updated = { ...profile, updatedAt: Date.now() };
    setTasteProfileState(updated);
    AsyncStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(updated));
  }, []);

  const completeOnboarding = useCallback(() => {
    setTasteProfileState((prev) => {
      const updated = {
        ...prev,
        onboardingCompletedAt: Date.now(),
        updatedAt: Date.now(),
      };
      AsyncStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetTasteProfile = useCallback(() => {
    const fresh = { ...DEFAULT_TASTE_PROFILE, updatedAt: Date.now() };
    setTasteProfileState(fresh);
    AsyncStorage.setItem(TASTE_PROFILE_KEY, JSON.stringify(fresh));
  }, []);

  const isOnboardingComplete = tasteProfile.onboardingCompletedAt !== null;

  // ── Library ──
  const setLibraryStatus = useCallback(
    (
      item: Omit<
        LibraryItem,
        | "status"
        | "savedAt"
        | "updatedAt"
        | "lastOpenedAt"
        | "lastEpisodeUrl"
        | "lastSeasonNumber"
        | "lastEpisodeNumber"
        | "completedEpisodes"
        | "totalEpisodes"
      > & { status: WatchStatus },
    ) => {
      setLibrary((prev) => {
        const existing = prev.find((l) => l.url === item.url);
        const now = Date.now();
        let next: LibraryItem[];
        if (existing) {
          next = prev.map((l) =>
            l.url === item.url ? { ...l, ...item, updatedAt: now } : l,
          );
        } else {
          const newItem: LibraryItem = {
            ...item,
            savedAt: now,
            updatedAt: now,
            lastOpenedAt: null,
            lastEpisodeUrl: null,
            lastSeasonNumber: null,
            lastEpisodeNumber: null,
            completedEpisodes: 0,
            totalEpisodes: null,
          };
          next = [newItem, ...prev];
        }
        persistLibrary(next);
        return next;
      });
    },
    [persistLibrary],
  );

  const toggleWantToWatch = useCallback(
    (item: SavedItem) => {
      toggleWatchlist(item);
      setLibrary((prev) => {
        const existing = prev.find((l) => l.url === item.url);
        let next: LibraryItem[];
        if (existing) {
          if (existing.status === "want_to_watch") {
            next = prev.filter((l) => l.url !== item.url);
          } else {
            next = prev;
          }
        } else {
          const newItem: LibraryItem = {
            url: item.url,
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail,
            releaseYear: item.releaseYear,
            genres: item.genres,
            imdbRating: item.imdbRating,
            isSeries: item.isSeries,
            status: "want_to_watch",
            savedAt: Date.now(),
            updatedAt: Date.now(),
            lastOpenedAt: null,
            lastEpisodeUrl: null,
            lastSeasonNumber: null,
            lastEpisodeNumber: null,
            completedEpisodes: 0,
            totalEpisodes: null,
          };
          next = [newItem, ...prev];
        }
        persistLibrary(next);
        return next;
      });
    },
    [persistLibrary, toggleWatchlist],
  );

  const getLibraryItem = useCallback(
    (url: string) => library.find((l) => l.url === url),
    [library],
  );

  const getItemsByStatus = useCallback(
    (status: WatchStatus) => library.filter((l) => l.status === status),
    [library],
  );

  const removeFromLibrary = useCallback(
    (url: string) => {
      setLibrary((prev) => {
        const next = prev.filter((l) => l.url !== url);
        persistLibrary(next);
        return next;
      });
      removeFromWatchlist(url);
    },
    [persistLibrary, removeFromWatchlist],
  );

  const updateLibraryItemOpened = useCallback(
    (url: string) => {
      setLibrary((prev) => {
        const exists = prev.find((l) => l.url === url);
        if (!exists) return prev;
        const next = prev.map((l) =>
          l.url === url
            ? { ...l, lastOpenedAt: Date.now(), updatedAt: Date.now() }
            : l,
        );
        persistLibrary(next);
        return next;
      });
    },
    [persistLibrary],
  );

  const updateLibraryEpisodeContext = useCallback(
    (
      seriesUrl: string,
      episodeUrl: string,
      seasonNumber: number,
      episodeNumber: number,
    ) => {
      setLibrary((prev) => {
        const exists = prev.find((l) => l.url === seriesUrl);
        if (!exists) return prev;
        const next = prev.map((l) =>
          l.url === seriesUrl
            ? {
                ...l,
                lastEpisodeUrl: episodeUrl,
                lastSeasonNumber: seasonNumber,
                lastEpisodeNumber: episodeNumber,
                updatedAt: Date.now(),
              }
            : l,
        );
        persistLibrary(next);
        return next;
      });
    },
    [persistLibrary],
  );

  // ── Episode progress ──
  const markEpisodeWatched = useCallback(
    (ep: Omit<EpisodeProgress, "watched" | "watchedAt" | "updatedAt">) => {
      const now = Date.now();
      setEpisodeProgress((prev) => {
        const filtered = prev.filter((p) => p.episodeUrl !== ep.episodeUrl);
        const entry: EpisodeProgress = {
          ...ep,
          watched: true,
          watchedAt: now,
          updatedAt: now,
        };
        const next = [...filtered, entry];
        persistEpisodeProgress(next);
        return next;
      });

      setLibrary((prev) => {
        const existing = prev.find((l) => l.url === ep.seriesUrl);
        if (!existing) return prev;
        const allWatched = episodeProgressRef.current.filter(
          (p) => p.seriesUrl === ep.seriesUrl && p.watched,
        );
        const count = allWatched.length + 1;
        const newStatus: WatchStatus =
          existing.status === "want_to_watch" || existing.status === "dropped"
            ? "watching"
            : existing.status;
        const next = prev.map((l) =>
          l.url === ep.seriesUrl
            ? {
                ...l,
                status: newStatus,
                completedEpisodes: count,
                lastEpisodeUrl: ep.episodeUrl,
                lastSeasonNumber: ep.seasonNumber,
                lastEpisodeNumber: ep.episodeNumber,
                updatedAt: now,
              }
            : l,
        );
        persistLibrary(next);
        return next;
      });
    },
    [persistEpisodeProgress, persistLibrary],
  );

  const markEpisodeUnwatched = useCallback(
    (seriesUrl: string, episodeUrl: string) => {
      setEpisodeProgress((prev) => {
        const next = prev.map((p) =>
          p.episodeUrl === episodeUrl
            ? { ...p, watched: false, watchedAt: null, updatedAt: Date.now() }
            : p,
        );
        persistEpisodeProgress(next);
        return next;
      });

      setLibrary((prev) => {
        const existing = prev.find((l) => l.url === seriesUrl);
        if (!existing) return prev;
        const allWatched = episodeProgressRef.current.filter(
          (p) =>
            p.seriesUrl === seriesUrl &&
            p.watched &&
            p.episodeUrl !== episodeUrl,
        );
        const next = prev.map((l) =>
          l.url === seriesUrl
            ? {
                ...l,
                completedEpisodes: allWatched.length,
                updatedAt: Date.now(),
              }
            : l,
        );
        persistLibrary(next);
        return next;
      });
    },
    [persistEpisodeProgress, persistLibrary],
  );

  const getSeriesProgress = useCallback(
    (seriesUrl: string) =>
      episodeProgress.filter((p) => p.seriesUrl === seriesUrl),
    [episodeProgress],
  );

  const isEpisodeWatched = useCallback(
    (episodeUrl: string) =>
      episodeProgress.some((p) => p.episodeUrl === episodeUrl && p.watched),
    [episodeProgress],
  );

  // ── Continue watching ──
  const getContinueWatchingItems = useCallback((): LibraryItem[] => {
    const watchingSeries = library.filter(
      (l) => l.isSeries && l.status === "watching" && l.completedEpisodes > 0,
    );
    const watchingOther = library.filter(
      (l) => !l.isSeries && l.status === "watching",
    );
    const excludedUrls = new Set(
      library
        .filter((l) => l.status === "completed" || l.status === "dropped")
        .map((l) => l.url),
    );
    const libraryUrls = new Set(library.map((l) => l.url));
    const recentFromHistory: LibraryItem[] = history
      .filter((h) => !excludedUrls.has(h.url) && !libraryUrls.has(h.url))
      .slice(0, 5)
      .map((h) => ({
        url: h.url,
        id: h.id,
        title: h.title,
        thumbnail: h.thumbnail,
        releaseYear: h.releaseYear,
        genres: h.genres,
        imdbRating: h.imdbRating,
        isSeries: h.isSeries,
        status: "watching" as WatchStatus,
        savedAt: h.savedAt,
        updatedAt: h.savedAt,
        lastOpenedAt: h.savedAt,
        lastEpisodeUrl: null,
        lastSeasonNumber: null,
        lastEpisodeNumber: null,
        completedEpisodes: 0,
        totalEpisodes: null,
      }));

    const all = [...watchingSeries, ...watchingOther, ...recentFromHistory];
    all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const seen = new Set<string>();
    return all
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      })
      .slice(0, 10);
  }, [library, history]);

  // ── Reminders ──
  const addReminder = useCallback(
    (reminder: TitleReminder) => {
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.id !== reminder.id);
        const next = [reminder, ...filtered];
        persistReminders(next);
        return next;
      });
    },
    [persistReminders],
  );

  const removeReminder = useCallback(
    (id: string) => {
      setReminders((prev) => {
        const next = prev.filter((r) => r.id !== id);
        persistReminders(next);
        return next;
      });
    },
    [persistReminders],
  );

  const updateReminder = useCallback(
    (id: string, updates: Partial<TitleReminder>) => {
      setReminders((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r,
        );
        persistReminders(next);
        return next;
      });
    },
    [persistReminders],
  );

  const getReminderForTitle = useCallback(
    (titleUrl: string) =>
      reminders.find((r) => r.titleUrl === titleUrl && r.active),
    [reminders],
  );

  // ── Local watch planning and title notes ──
  const addWatchPlan = useCallback(
    (
      item: Omit<WatchPlanItem, "id" | "status" | "createdAt" | "updatedAt"> & {
        status?: WatchPlanStatus;
      },
    ) => {
      const now = Date.now();
      const plan: WatchPlanItem = {
        ...item,
        id: `${item.titleUrl}_${now}`,
        status: item.status ?? "planned",
        createdAt: now,
        updatedAt: now,
      };

      setWatchPlans((prev) => {
        const next = [plan, ...prev];
        persistWatchPlans(next);
        return next;
      });
    },
    [persistWatchPlans],
  );

  const updateWatchPlan = useCallback(
    (id: string, updates: Partial<WatchPlanItem>) => {
      setWatchPlans((prev) => {
        const next = prev.map((plan) =>
          plan.id === id
            ? { ...plan, ...updates, updatedAt: Date.now() }
            : plan,
        );
        persistWatchPlans(next);
        return next;
      });
    },
    [persistWatchPlans],
  );

  const removeWatchPlan = useCallback(
    (id: string) => {
      setWatchPlans((prev) => {
        const next = prev.filter((plan) => plan.id !== id);
        persistWatchPlans(next);
        return next;
      });
    },
    [persistWatchPlans],
  );

  const getPlansForTitle = useCallback(
    (titleUrl: string) =>
      watchPlans
        .filter((plan) => plan.titleUrl === titleUrl)
        .sort(
          (a, b) =>
            new Date(a.plannedFor).getTime() - new Date(b.plannedFor).getTime(),
        ),
    [watchPlans],
  );

  const saveTitleNote = useCallback(
    (note: Omit<TitleNote, "createdAt" | "updatedAt">) => {
      setTitleNotes((prev) => {
        const next = { ...prev };
        const body = note.body.trim();

        if (!body) {
          delete next[note.titleUrl];
          persistTitleNotes(next);
          return next;
        }

        const existing = prev[note.titleUrl];
        next[note.titleUrl] = {
          ...note,
          body,
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        persistTitleNotes(next);
        return next;
      });
    },
    [persistTitleNotes],
  );

  const deleteTitleNote = useCallback(
    (titleUrl: string) => {
      setTitleNotes((prev) => {
        const next = { ...prev };
        delete next[titleUrl];
        persistTitleNotes(next);
        return next;
      });
    },
    [persistTitleNotes],
  );

  const getTitleNote = useCallback(
    (titleUrl: string) => titleNotes[titleUrl],
    [titleNotes],
  );

  // ── Known metadata ──
  const saveKnownTitleMetadata = useCallback(
    (metadata: KnownTitleMetadata) => {
      setKnownMetadata((prev) => {
        const next = {
          ...prev,
          [metadata.url]: { ...metadata, updatedAt: Date.now() },
        };
        persistMetadata(next);
        return next;
      });
    },
    [persistMetadata],
  );

  const getKnownTitleMetadata = useCallback(
    (url: string) => knownMetadata[url],
    [knownMetadata],
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
        tasteProfile,
        setTasteProfile,
        completeOnboarding,
        resetTasteProfile,
        isOnboardingComplete,
        library,
        setLibraryStatus,
        toggleWantToWatch,
        getLibraryItem,
        getItemsByStatus,
        removeFromLibrary,
        updateLibraryItemOpened,
        updateLibraryEpisodeContext,
        episodeProgress,
        markEpisodeWatched,
        markEpisodeUnwatched,
        getSeriesProgress,
        isEpisodeWatched,
        getContinueWatchingItems,
        reminders,
        addReminder,
        removeReminder,
        updateReminder,
        getReminderForTitle,
        watchPlans,
        addWatchPlan,
        updateWatchPlan,
        removeWatchPlan,
        getPlansForTitle,
        titleNotes,
        saveTitleNote,
        deleteTitleNote,
        getTitleNote,
        knownMetadata,
        saveKnownTitleMetadata,
        getKnownTitleMetadata,
        isLoading,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export const useUserData = () => useContext(UserDataContext);
export default UserDataContext;
