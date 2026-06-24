import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Share,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { styles, width } from "../styles/styles";
import MovieAPI, {
  Episode,
  ResolvedStream,
  SeriesDetail,
} from "../services/MovieAPI";
import { useTvApp } from "../context/TvAppContext";
import { useUserData } from "../context/UserDataContext";
import StarRating from "../components/StarRating";
import StatusSelector from "../components/StatusSelector";
import TitlePlanningPanel from "../components/TitlePlanningPanel";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import { WatchStatus } from "../types/app";
import { useTVBackHandler } from "../hooks/useTVBackHandler";
import Focusable from "../components/Focusable";
import TvSafeImage from "../components/TvSafeImage";
import { pickBest, pickForDownload } from "../utils/streamRanking";
import { getOriginalLanguage } from "../services/tmdb";
import { useDownloads } from "../context/DownloadContext";
import { DownloadStartError } from "../services/DownloadManager";
import { confirmLargeDownload } from "../utils/downloadConfirm";
import DownloadSourcePicker from "../components/DownloadSourcePicker";
import { validateDownloadStream } from "../utils/downloadValidation";
import {
  filterBadDownloadSources,
  markBadDownloadSource,
} from "../utils/downloadSourceHealth";
import {
  resolveEpisodePlayback,
  type SeriesRef,
} from "../utils/episodePlayback";
import { getWebPlayerMode } from "../utils/webPlayerMode";

type SeriesDetailsScreenProps = NativeStackScreenProps<any, "SeriesDetails">;

export default function SeriesDetailsScreen({
  route,
  navigation,
}: SeriesDetailsScreenProps) {
  useTVBackHandler(() => navigation.goBack());
  const { isTvApp } = useTvApp();
  const usesTvPlaybackControls = Platform.isTV || isTvApp;
  // Downloads are gated behind TV-app mode on native, but on web a download is
  // just a browser download — always offer it there.
  const canDownload = isTvApp || Platform.OS === "web";
  const {
    isInWatchlist,
    toggleWantToWatch,
    addToHistory,
    getRating,
    setRating,
    getLibraryItem,
    setLibraryStatus,
    removeFromLibrary,
    updateLibraryItemOpened,
    saveKnownTitleMetadata,
    markEpisodeWatched,
    markEpisodeUnwatched,
    isEpisodeWatched,
    getSeriesProgress,
    updateLibraryEpisodeContext,
  } = useUserData();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { url } = route.params as { url: string };
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seriesData, setSeriesData] = useState<SeriesDetail | null>(null);
  const [gettingLinks, setGettingLinks] = useState(false);
  const [downloadingEpisode, setDownloadingEpisode] = useState<number | null>(
    null,
  );
  const [episodeDownloadPicker, setEpisodeDownloadPicker] = useState<{
    episode: Episode;
    sources: ResolvedStream[];
  } | null>(null);
  const [validatingDownloadUrl, setValidatingDownloadUrl] = useState<
    string | null
  >(null);
  const downloads = useDownloads();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await MovieAPI.getSeriesByUrl(url);
        setSeriesData(details);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load series details";
        setError(errorMessage);
        Alert.alert("Error", errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, []);

  useEffect(() => {
    if (seriesData) {
      addToHistory({
        id: seriesData.id,
        title: seriesData.title,
        thumbnail: seriesData.thumbnail,
        imdbRating: seriesData.ratings?.imdb ?? null,
        releaseYear: seriesData.releaseYear,
        genres: seriesData.genres,
        url: seriesData.url,
        isSeries: true,
        savedAt: Date.now(),
      });

      updateLibraryItemOpened(seriesData.url);

      saveKnownTitleMetadata({
        url: seriesData.url,
        title: seriesData.title,
        isSeries: true,
        thumbnail: seriesData.thumbnail,
        coverImage: seriesData.coverImage,
        genres: seriesData.genres,
        runtime: seriesData.duration,
        releaseYear: seriesData.releaseYear,
        releaseDate: seriesData.releaseDate,
        imdbRating: seriesData.ratings?.imdb ?? null,
        directors: seriesData.directors,
        actors: seriesData.actors,
        countries: seriesData.countries,
        updatedAt: Date.now(),
      });
    }
  }, [seriesData?.id]);

  const currentSeason = seriesData?.seasons?.find(
    (s) => s.seasonNumber === selectedSeason,
  );
  const currentEpisodes = currentSeason?.episodes || [];

  const seriesProgress = useMemo(
    () => (seriesData ? getSeriesProgress(seriesData.url) : []),
    [seriesData?.url, getSeriesProgress],
  );

  const watchedCount = useMemo(
    () => seriesProgress.filter((p) => p.watched).length,
    [seriesProgress],
  );

  const totalEpisodes = useMemo(() => {
    if (!seriesData) return 0;
    return seriesData.seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  }, [seriesData]);

  // Season-level progress
  const seasonWatchedCount = useMemo(() => {
    return seriesProgress.filter(
      (p) => p.watched && p.seasonNumber === selectedSeason,
    ).length;
  }, [seriesProgress, selectedSeason]);

  // How many episodes in the active season are downloaded (or in flight) —
  // surfaced in the Episodes header so the user can see download progress
  // across the season at a glance, not just per-card.
  const seasonDownloadStats = useMemo(() => {
    if (!seriesData) return { completed: 0, active: 0 };
    let completed = 0;
    let active = 0;
    for (const r of downloads.records) {
      if (r.kind !== "episode") continue;
      if (r.tmdbId !== String(seriesData.id)) continue;
      if (r.season !== selectedSeason) continue;
      if (r.status === "completed") completed += 1;
      else if (r.status === "downloading" || r.status === "paused") active += 1;
    }
    return { completed, active };
  }, [downloads.records, seriesData?.id, selectedSeason]);

  const libraryItem = seriesData ? getLibraryItem(seriesData.url) : undefined;
  const currentStatus = libraryItem?.status ?? null;

  const handleStatusSelect = (status: WatchStatus) => {
    if (!seriesData) return;
    setLibraryStatus({
      url: seriesData.url,
      id: seriesData.id,
      title: seriesData.title,
      thumbnail: seriesData.thumbnail,
      releaseYear: seriesData.releaseYear,
      genres: seriesData.genres,
      imdbRating: seriesData.ratings?.imdb ?? null,
      isSeries: true,
      status,
    });
  };

  const handleToggleEpisodeWatched = (episode: Episode) => {
    if (!seriesData) return;
    const epUrl = episode.episodeUrl;
    if (isEpisodeWatched(epUrl)) {
      markEpisodeUnwatched(seriesData.url, epUrl);
    } else {
      markEpisodeWatched({
        seriesUrl: seriesData.url,
        episodeUrl: epUrl,
        episodeTitle: episode.episodeTitle,
        seasonNumber: selectedSeason,
        episodeNumber: episode.episodeNumber,
      });
      updateLibraryEpisodeContext(
        seriesData.url,
        epUrl,
        selectedSeason,
        episode.episodeNumber,
      );
    }
  };

  const handleDownloadSeason = async () => {
    if (!seriesData || currentEpisodes.length === 0) return;
    // Skip episodes already on disk or actively being fetched. Sequential
    // start() — the DownloadManager itself handles parallel scheduling per
    // the user's maxParallel preference.
    const todo = currentEpisodes.filter((ep) => {
      const r = downloads.records.find(
        (rr) =>
          rr.kind === "episode" &&
          rr.tmdbId === String(seriesData.id) &&
          rr.season === selectedSeason &&
          rr.episode === ep.episodeNumber,
      );
      return !r || r.status === "failed" || r.status === "cancelled";
    });
    if (todo.length === 0) {
      Alert.alert(
        "All set",
        "Every episode in this season is already downloaded or in progress.",
      );
      return;
    }
    Alert.alert(
      "Download season",
      `Queue ${todo.length} episode${todo.length === 1 ? "" : "s"} from season ${selectedSeason}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Queue",
          onPress: async () => {
            for (const ep of todo) {
              try {
                await handleDownloadEpisode(ep, { silent: true });
              } catch (e) {
                // DownloadStartError (storage_cap / wifi_required) — stop the
                // whole batch rather than spam alerts per episode.
                console.warn(
                  "Season queue stopped at episode:",
                  ep.episodeNumber,
                  e,
                );
                break;
              }
            }
          },
        },
      ],
    );
  };

  const showEpisodeDownloadError = (e: unknown) => {
    if (e instanceof DownloadStartError) {
      const titleMap: Record<DownloadStartError["reason"], string> = {
        storage_cap: "Storage cap reached",
        wifi_required: "Wi-Fi required",
        no_sources: "No downloadable sources",
        already_active: "Already downloading",
        unknown: "Download failed",
      };
      Alert.alert(titleMap[e.reason], e.message);
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    Alert.alert("Download failed", msg);
  };

  const startEpisodeDownload = async (
    episode: Episode,
    source: ResolvedStream,
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    if (!seriesData) return false;

    const sourceContext = {
      tmdbId: String(seriesData.id),
      kind: "episode" as const,
      season: selectedSeason,
      episode: episode.episodeNumber,
    };

    setDownloadingEpisode(episode.episodeNumber);
    setValidatingDownloadUrl(source.url);
    try {
      const validation = await validateDownloadStream(source);
      if (!validation.ok) {
        await markBadDownloadSource(
          source,
          sourceContext,
          validation.reason ?? "Source failed validation",
        );
        if (!options?.silent) {
          const nextSources =
            episodeDownloadPicker?.sources.filter(
              (candidate) => candidate.url !== source.url,
            ) ?? [];
          setEpisodeDownloadPicker((current) => {
            if (
              !current ||
              current.episode.episodeNumber !== episode.episodeNumber
            ) {
              return current;
            }
            const sources = current.sources.filter(
              (candidate) => candidate.url !== source.url,
            );
            return sources.length > 0 ? { ...current, sources } : null;
          });
          Alert.alert(
            "Source unavailable",
            `${validation.reason ?? "This source could not be verified."}${
              nextSources.length > 0 ? " Choose another source." : ""
            }`,
          );
        }
        return false;
      }

      console.log("[SeriesDetails] starting episode download:", {
        s: selectedSeason,
        e: episode.episodeNumber,
        url: source.url,
        type: source.type,
        quality: source.quality,
        sizeBytes: source.sizeBytes,
        hasHeaders: !!source.headers,
      });

      if (!options?.silent) {
        const epLabel = `${seriesData.title} · S${selectedSeason}E${episode.episodeNumber}`;
        const confirmed = await confirmLargeDownload(
          source.sizeBytes ?? 0,
          epLabel,
        );
        if (!confirmed) return false;
      }

      await downloads.start(source, {
        tmdbId: String(seriesData.id),
        title: seriesData.title,
        kind: "episode",
        season: selectedSeason,
        episode: episode.episodeNumber,
        thumbnail: seriesData.thumbnail,
      });
      if (!options?.silent) setEpisodeDownloadPicker(null);
      return true;
    } catch (e) {
      const stack = e instanceof Error && e.stack ? `\n${e.stack}` : "";
      console.warn("Episode download failed:", e, stack);
      if (options?.silent) throw e;
      showEpisodeDownloadError(e);
      return false;
    } finally {
      setDownloadingEpisode(null);
      setValidatingDownloadUrl(null);
    }
  };

  const startFirstValidEpisodeDownload = async (
    episode: Episode,
    sources: ResolvedStream[],
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    for (const source of sources) {
      const started = await startEpisodeDownload(episode, source, options);
      if (started) return true;
      if (!options?.silent) return false;
    }
    return false;
  };

  const handleDownloadEpisode = async (
    episode: Episode,
    options?: { silent?: boolean },
  ) => {
    if (!seriesData) return;

    const existing = downloads.findCompletedEpisode(
      String(seriesData.id),
      selectedSeason,
      episode.episodeNumber,
    );
    if (existing) {
      // Already on disk → tapping plays it.
      const originalLanguage = await getOriginalLanguage(
        existing.tmdbId,
        existing.kind === "episode" ? "series" : "movie",
      );
      navigation.navigate("NativeVideoPlayer", {
        streams: [
          {
            url: existing.fileUri,
            type: existing.containerType,
            quality: existing.quality,
            name: "Offline",
            title: existing.title,
            source: "download",
            sizeBytes: existing.sizeBytes,
          },
        ],
        title: `${existing.title} - S${existing.season}E${existing.episode}`,
        recordId: existing.id,
        initialPositionMs: existing.watchProgressMs,
        originalLanguage: originalLanguage ?? undefined,
      });
      return;
    }

    setDownloadingEpisode(episode.episodeNumber);
    try {
      // Original-language lookup is independent of stream resolution; start it
      // in parallel so the TMDB round-trip doesn't add to time-to-first-frame.
      const languagePromise = getOriginalLanguage(seriesData.id, "series");
      const resolved = await MovieAPI.getResolvedStreams(
        "series",
        { tmdbId: seriesData.id },
        selectedSeason,
        episode.episodeNumber,
      );
      const originalLanguage = await languagePromise;
      const ranked = await filterBadDownloadSources(
        pickForDownload(resolved, originalLanguage),
        {
          tmdbId: String(seriesData.id),
          kind: "episode",
          season: selectedSeason,
          episode: episode.episodeNumber,
        },
      );
      if (ranked.length === 0) {
        if (!options?.silent) {
          Alert.alert(
            "No downloadable sources",
            "Couldn't find a stream we can save offline.",
          );
        }
        return;
      }

      if (options?.silent) {
        const started = await startFirstValidEpisodeDownload(episode, ranked, {
          silent: true,
        });
        if (!started) {
          throw new DownloadStartError(
            "no_sources",
            "No valid downloadable sources were available.",
          );
        }
        return;
      }

      setEpisodeDownloadPicker({ episode, sources: ranked });
    } catch (e) {
      const stack = e instanceof Error && e.stack ? `\n${e.stack}` : "";
      console.warn("Episode download failed:", e, stack);
      if (options?.silent) throw e;
      showEpisodeDownloadError(e);
    } finally {
      setDownloadingEpisode(null);
    }
  };

  const handlePlayEpisode = async (episode: Episode) => {
    if (!seriesData) return;
    setSelectedEpisode(episode.episodeNumber);
    setGettingLinks(true);
    const movieTitle = `${seriesData.title} - S${selectedSeason}E${episode.episodeNumber} ${episode.episodeTitle}`;

    // Tier 1: backend's resolved-stream pipeline (Stremio + Real-Debrid).
    // MKV streams stay in the list — NativeVideoPlayer falls back to libVLC
    // on iOS automatically. Resolve logic lives in resolveEpisodePlayback so
    // the player can reuse it for the "next episode" flow.
    const seriesRef: SeriesRef = {
      id: String(seriesData.id),
      url: seriesData.url,
      title: seriesData.title,
    };
    // Tier 2 (legacy WebView/embed) navigation, shared by the web "embedded
    // player" preference below and the no-direct-stream fallback.
    const goToEmbedEpisode = async () => {
      try {
        const links = await MovieAPI.getSeriesServer(episode.episodeUrl);
        setGettingLinks(false);
        const servers = links.videoLinks;

        if (servers.length === 1) {
          navigation.navigate("VideoPlayer", {
            server: servers[0],
            servers,
            serverIndex: 0,
            movieTitle,
          });
        } else {
          navigation.navigate("ServerSelection", {
            servers,
            movieTitle,
          });
        }
      } catch {
        setGettingLinks(false);
        Alert.alert("Error", "Failed to get streaming links.");
      }
    };

    // On web the user can opt into the legacy embedded player (better MKV +
    // subtitle support) via Settings — skip the direct <video> pipeline.
    if (Platform.OS === "web" && (await getWebPlayerMode()) === "embed") {
      await goToEmbedEpisode();
      return;
    }

    const params = await resolveEpisodePlayback(
      seriesRef,
      selectedSeason,
      episode,
    );
    if (params) {
      setGettingLinks(false);
      navigation.navigate("NativeVideoPlayer", {
        ...params,
        seriesContext: {
          seriesId: seriesRef.id,
          seriesUrl: seriesRef.url,
          seriesTitle: seriesRef.title,
          seasons: seriesData.seasons,
          season: selectedSeason,
          episode: episode.episodeNumber,
        },
      });
      return;
    }

    // Tier 2: legacy WebView path.
    await goToEmbedEpisode();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
        </View>
      </View>
    );
  }

  if (error || !seriesData) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Series not found"}</Text>
        </View>
      </View>
    );
  }

  const handlePressTrailer = () => {
    if (!seriesData.trailerUrl) {
      Alert.alert("No Trailer", "Trailer not available for this series");
      return;
    }
    if (Platform.OS === "web") {
      // @ts-ignore
      window.open(seriesData.trailerUrl, "_blank");
      return;
    }
    navigation.navigate("TrailerScreen", { videoUrl: seriesData.trailerUrl });
  };

  // Resume action for default build
  const lastProgress = libraryItem?.lastEpisodeNumber
    ? `S${libraryItem.lastSeasonNumber}E${libraryItem.lastEpisodeNumber}`
    : null;

  return (
    <ScrollView
      style={seriesStyles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover Image */}
      {seriesData.coverImage && (
        <TvSafeImage
          source={{ uri: seriesData.coverImage?.trim() }}
          style={seriesStyles.coverImage}
          contentFit="cover"
        />
      )}

      {/* Action Buttons */}
      <View style={detailActionStyles.actionRow}>
        <Focusable
          style={detailActionStyles.actionButton}
          focusedStyle={detailActionStyles.focused}
          hasTVPreferredFocus={Platform.isTV}
          onPress={() =>
            toggleWantToWatch({
              id: seriesData.id,
              title: seriesData.title,
              thumbnail: seriesData.thumbnail,
              imdbRating: seriesData.ratings?.imdb ?? null,
              releaseYear: seriesData.releaseYear,
              genres: seriesData.genres,
              url: seriesData.url,
              isSeries: true,
              savedAt: Date.now(),
            })
          }
        >
          <FontAwesome
            name={isInWatchlist(seriesData.url) ? "bookmark" : "bookmark-o"}
            size={22}
            color={isInWatchlist(seriesData.url) ? "#e74c3c" : "#fff"}
          />
          <Text style={detailActionStyles.actionText}>
            {isInWatchlist(seriesData.url) ? "Saved" : "Save"}
          </Text>
        </Focusable>

        <Focusable
          style={detailActionStyles.actionButton}
          focusedStyle={detailActionStyles.focused}
          onPress={() =>
            Share.share({
              message: `Check out the series "${seriesData.title}" on Reelmark!`,
              title: seriesData.title,
            })
          }
        >
          <FontAwesome name="share-alt" size={22} color="#fff" />
          <Text style={detailActionStyles.actionText}>Share</Text>
        </Focusable>
      </View>

      {/* Trailer Button */}
      {seriesData.trailerUrl && (
        <Focusable
          style={[
            seriesStyles.trailerButton,
            detailActionStyles.primaryActionButton,
          ]}
          focusedStyle={detailActionStyles.focused}
          onPress={handlePressTrailer}
        >
          <Text style={seriesStyles.trailerButtonText}>Watch Trailer</Text>
        </Focusable>
      )}

      {/* Status Selector — default build */}
      {!isTvApp && (
        <View style={detailActionStyles.statusSection}>
          <StatusSelector
            currentStatus={currentStatus}
            onSelect={handleStatusSelect}
            onRemove={
              libraryItem ? () => removeFromLibrary(seriesData.url) : undefined
            }
          />
          {libraryItem && (
            <Text style={detailActionStyles.trackedLabel}>
              Tracked in Library
            </Text>
          )}
        </View>
      )}

      {/* Resume from last episode — default build */}
      {!isTvApp && lastProgress && watchedCount > 0 && (
        <View style={detailActionStyles.resumeSection}>
          <Text style={detailActionStyles.resumeLabel}>
            Pick up where you left off — {lastProgress}
          </Text>
          <Text style={detailActionStyles.progressLabel}>
            {watchedCount}/{totalEpisodes} episodes watched
          </Text>
        </View>
      )}

      {/* Series Info */}
      <View style={seriesStyles.movieInfoContainer}>
        <Text style={seriesStyles.movieTitle}>{seriesData.title}</Text>

        {/* Year & Duration */}
        <View style={seriesStyles.metaRow}>
          <Text style={seriesStyles.metaText}>{seriesData.releaseYear}</Text>
          {seriesData.duration && (
            <>
              <Text style={seriesStyles.metaDot}>•</Text>
              <Text style={seriesStyles.metaText}>{seriesData.duration}</Text>
            </>
          )}
          {seriesData.seasons.length > 0 && (
            <>
              <Text style={seriesStyles.metaDot}>•</Text>
              <Text style={seriesStyles.metaText}>
                {seriesData.seasons.length} Season
                {seriesData.seasons.length !== 1 ? "s" : ""}
              </Text>
            </>
          )}
        </View>

        {/* Progress Summary */}
        {watchedCount > 0 && (
          <View style={seriesStyles.progressSummary}>
            <View style={seriesStyles.progressBar}>
              <View
                style={[
                  seriesStyles.progressFill,
                  {
                    width: `${
                      totalEpisodes > 0
                        ? (watchedCount / totalEpisodes) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={seriesStyles.progressText}>
              {watchedCount}/{totalEpisodes} episodes
            </Text>
          </View>
        )}

        {/* Genres */}
        {seriesData.genres.length > 0 && (
          <View style={seriesStyles.genresContainer}>
            {seriesData.genres.map((genre, index) => (
              <View key={index} style={seriesStyles.genreTag}>
                <Text style={seriesStyles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Ratings */}
        <View style={seriesStyles.ratingsContainer}>
          <Text style={seriesStyles.ratingsTitle}>Ratings</Text>
          <View style={seriesStyles.ratingsGrid}>
            {seriesData.ratings.imdb && (
              <View style={seriesStyles.ratingItem}>
                <Text style={seriesStyles.ratingSource}>IMDb</Text>
                <Text style={seriesStyles.ratingValue}>
                  {parseFloat(seriesData.ratings.imdb).toFixed(1)}
                </Text>
              </View>
            )}
            {seriesData.ratings.tmdb && (
              <View style={seriesStyles.ratingItem}>
                <Text style={seriesStyles.ratingSource}>TMDb</Text>
                <Text style={seriesStyles.ratingValue}>
                  {seriesData.ratings.tmdb}
                </Text>
              </View>
            )}
            {seriesData.ratings.rottenTomatoes && (
              <View style={seriesStyles.ratingItem}>
                <Text style={seriesStyles.ratingSource}>RT</Text>
                <Text style={seriesStyles.ratingValue}>
                  {seriesData.ratings.rottenTomatoes}
                </Text>
              </View>
            )}
            {seriesData.ratings.metacritic && (
              <View style={seriesStyles.ratingItem}>
                <Text style={seriesStyles.ratingSource}>Metacritic</Text>
                <Text style={seriesStyles.ratingValue}>
                  {seriesData.ratings.metacritic}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Your Rating */}
        <View style={detailActionStyles.yourRatingSection}>
          <Text style={seriesStyles.sectionTitle}>Your Rating</Text>
          <StarRating
            rating={getRating(seriesData.url)}
            onRate={(r) => setRating(seriesData.url, r)}
          />
        </View>

        <TitlePlanningPanel
          titleUrl={seriesData.url}
          title={seriesData.title}
          isSeries={true}
          thumbnail={seriesData.thumbnail}
        />

        {/* Description */}
        {seriesData.description && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Synopsis</Text>
            <Text style={seriesStyles.description}>
              {seriesData.description}
            </Text>
          </View>
        )}

        {/* Episodes Section — visible in BOTH builds now */}
        {seriesData.seasons.length > 0 && (
          <View style={seriesStyles.section}>
            <View style={seriesStyles.episodesHeader}>
              <View style={{ flex: 1 }}>
                <Text style={seriesStyles.sectionTitle}>Episodes</Text>
                {(seasonWatchedCount > 0 ||
                  seasonDownloadStats.completed > 0 ||
                  seasonDownloadStats.active > 0) && (
                  <Text style={seriesStyles.episodesSubtitle}>
                    {seasonWatchedCount > 0
                      ? `${seasonWatchedCount}/${currentEpisodes.length} watched`
                      : ""}
                    {seasonWatchedCount > 0 &&
                    (seasonDownloadStats.completed > 0 ||
                      seasonDownloadStats.active > 0)
                      ? " · "
                      : ""}
                    {seasonDownloadStats.completed > 0
                      ? `${seasonDownloadStats.completed}/${currentEpisodes.length} downloaded`
                      : ""}
                    {seasonDownloadStats.active > 0
                      ? ` (${seasonDownloadStats.active} in progress)`
                      : ""}
                  </Text>
                )}
              </View>
              {canDownload &&
                currentEpisodes.length > 0 &&
                seasonDownloadStats.completed < currentEpisodes.length && (
                  <Focusable
                    style={seriesStyles.seasonDownloadBtn}
                    focusedStyle={seriesStyles.focused}
                    onPress={handleDownloadSeason}
                  >
                    <FontAwesome name="cloud-download" size={12} color="#fff" />
                    <Text style={seriesStyles.seasonDownloadBtnText}>
                      Download S{selectedSeason}
                    </Text>
                  </Focusable>
                )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={seriesStyles.seasonSelector}
            >
              {seriesData.seasons.map((season) => (
                <Focusable
                  key={season.seasonNumber}
                  style={[
                    seriesStyles.seasonButton,
                    selectedSeason === season.seasonNumber &&
                      seriesStyles.seasonButtonActive,
                  ]}
                  focusedStyle={seriesStyles.focused}
                  onPress={() => setSelectedSeason(season.seasonNumber)}
                >
                  <Text
                    style={[
                      seriesStyles.seasonButtonText,
                      selectedSeason === season.seasonNumber &&
                        seriesStyles.seasonButtonTextActive,
                    ]}
                  >
                    S{season.seasonNumber}
                  </Text>
                </Focusable>
              ))}
            </ScrollView>

            <View style={seriesStyles.episodesGrid}>
              {currentEpisodes.map((episode) => {
                const watched = isEpisodeWatched(episode.episodeUrl);
                const epRecord = downloads.records.find(
                  (r) =>
                    r.kind === "episode" &&
                    r.tmdbId === String(seriesData.id) &&
                    r.season === selectedSeason &&
                    r.episode === episode.episodeNumber,
                );
                const isQueuing = downloadingEpisode === episode.episodeNumber;
                return (
                  <Focusable
                    key={episode.episodeNumber}
                    style={[
                      seriesStyles.episodeCard,
                      watched && seriesStyles.episodeCardWatched,
                    ]}
                    focusedStyle={seriesStyles.focused}
                    onPress={() => {
                      if (usesTvPlaybackControls) {
                        handlePlayEpisode(episode);
                      } else {
                        handleToggleEpisodeWatched(episode);
                      }
                    }}
                    disabled={gettingLinks && usesTvPlaybackControls}
                  >
                    {gettingLinks &&
                    selectedEpisode === episode.episodeNumber &&
                    usesTvPlaybackControls ? (
                      <View style={seriesStyles.centered}>
                        <ActivityIndicator />
                      </View>
                    ) : (
                      <>
                        <View
                          style={[
                            seriesStyles.episodeNumber,
                            watched && seriesStyles.episodeNumberWatched,
                          ]}
                        >
                          <Text style={seriesStyles.episodeNumberText}>
                            E{episode.episodeNumber}
                          </Text>
                        </View>
                        <Text
                          style={seriesStyles.episodeTitle}
                          numberOfLines={1}
                        >
                          {episode.episodeTitle}
                        </Text>
                        {usesTvPlaybackControls ? (
                          <View style={seriesStyles.playIconSmall}>
                            <Text style={seriesStyles.playIcon}>▶</Text>
                          </View>
                        ) : (
                          <FontAwesome
                            name={watched ? "check-circle" : "circle-o"}
                            size={22}
                            color={watched ? "#2ecc71" : "#555"}
                          />
                        )}
                      </>
                    )}

                    {/* Download icon — corner overlay. Shown in TV-app mode and
                        always on web. Nested touchable wins focus over the parent
                        card on phone touch. */}
                    {canDownload && (
                      <TouchableOpacity
                        style={[
                          seriesStyles.downloadIconBtn,
                          epRecord?.status === "completed" &&
                            seriesStyles.downloadIconBtnDone,
                        ]}
                        onPress={() => handleDownloadEpisode(episode)}
                        disabled={isQueuing || epRecord?.status === "downloading"}
                      >
                        {isQueuing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : epRecord?.status === "completed" ? (
                          <FontAwesome name="check" size={11} color="#fff" />
                        ) : epRecord?.status === "downloading" ? (
                          <Text style={seriesStyles.downloadIconPct}>
                            {epRecord.sizeBytes > 0
                              ? `${Math.floor(
                                  (epRecord.bytesDownloaded /
                                    epRecord.sizeBytes) *
                                    100,
                                )}%`
                              : "…"}
                          </Text>
                        ) : (
                          <FontAwesome
                            name="cloud-download"
                            size={11}
                            color="#fff"
                          />
                        )}
                      </TouchableOpacity>
                    )}
                  </Focusable>
                );
              })}
            </View>
          </View>
        )}

        {/* Directors */}
        {seriesData.directors.length > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Directors</Text>
            <Text style={seriesStyles.personText}>
              {seriesData.directors.join(", ")}
            </Text>
          </View>
        )}

        {/* Cast */}
        {seriesData.actors.length > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Cast</Text>
            <Text style={seriesStyles.personText}>
              {seriesData.actors.join(", ")}
            </Text>
          </View>
        )}

        {/* Countries */}
        {seriesData.countries.length > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Countries</Text>
            <Text style={seriesStyles.personText}>
              {seriesData.countries.join(", ")}
            </Text>
          </View>
        )}

        {/* Production Companies */}
        {seriesData.companies.length > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Production</Text>
            <Text style={seriesStyles.personText}>
              {seriesData.companies.join(", ")}
            </Text>
          </View>
        )}

        {/* Awards */}
        {seriesData.awards && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Awards</Text>
            <Text style={seriesStyles.personText}>{seriesData.awards}</Text>
          </View>
        )}

        {/* Views */}
        {seriesData.views > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.metaText}>
              {seriesData.views.toLocaleString()} views
            </Text>
          </View>
        )}
      </View>
      {canDownload && (
        <DownloadSourcePicker
          visible={!!episodeDownloadPicker}
          title={seriesData.title}
          subtitle={
            episodeDownloadPicker
              ? `${seriesData.title} · S${selectedSeason}E${episodeDownloadPicker.episode.episodeNumber}`
              : seriesData.title
          }
          sources={episodeDownloadPicker?.sources ?? []}
          activeUrl={validatingDownloadUrl}
          onSelect={(source) => {
            if (!episodeDownloadPicker) return;
            void startEpisodeDownload(episodeDownloadPicker.episode, source);
          }}
          onClose={() => {
            if (validatingDownloadUrl) return;
            setEpisodeDownloadPicker(null);
          }}
        />
      )}
    </ScrollView>
  );
}

const seriesStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  coverImage: {
    width: "100%",
    height: 250,
    backgroundColor: "#1a1a1a",
  },
  trailerButton: {
    backgroundColor: "#e74c3c",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  trailerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  movieInfoContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  movieTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaText: {
    color: "#aaa",
    fontSize: 14,
  },
  metaDot: {
    color: "#666",
    marginHorizontal: 8,
  },
  progressSummary: {
    marginBottom: 14,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#e74c3c",
    borderRadius: 2,
  },
  progressText: {
    color: "#888",
    fontSize: 12,
  },
  genresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 8,
  },
  genreTag: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e74c3c",
  },
  genreText: {
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: "600",
  },
  ratingsContainer: {
    marginBottom: 16,
  },
  ratingsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  ratingsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  ratingItem: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
  },
  ratingSource: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },
  ratingValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  description: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 22,
  },
  personText: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 22,
  },
  seasonSelector: {
    marginBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  seasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    marginRight: 8,
    borderWidth: 2,
    borderColor: "#333",
  },
  seasonButtonActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  seasonButtonText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
  },
  seasonButtonTextActive: {
    color: "#fff",
  },
  episodesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  episodeCard: {
    width: (width - 48) / 2,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    borderWidth: 3,
    borderColor: "#333",
    alignItems: "center",
  },
  focused: {
    borderColor: "#fff",
  },
  episodeCardWatched: {
    borderColor: "#2ecc71",
    backgroundColor: "#0a1a0a",
  },
  episodeNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  episodeNumberWatched: {
    backgroundColor: "#2ecc71",
  },
  episodeNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  episodeTitle: {
    color: "#ccc",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  playIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 14,
  },
  downloadIconBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 28,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadIconBtnDone: { backgroundColor: "#27ae60" },
  downloadIconPct: { color: "#fff", fontSize: 9, fontWeight: "700" },
  episodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  episodesSubtitle: { color: "#aaa", fontSize: 12, marginTop: -8 },
  seasonDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#2c3e50",
    borderWidth: 2,
    borderColor: "transparent",
  },
  seasonDownloadBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});

const detailActionStyles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  actionButton: {
    alignItems: "center",
    padding: 8,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 8,
    minWidth: 72,
  },
  primaryActionButton: {
    borderWidth: 3,
    borderColor: "transparent",
  },
  focused: {
    borderColor: "#fff",
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
  },
  yourRatingSection: {
    marginBottom: 16,
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 8,
  },
  statusSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  trackedLabel: {
    color: "#2ecc71",
    fontSize: 12,
    marginTop: 4,
  },
  resumeSection: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#e74c3c",
    marginBottom: 8,
  },
  resumeLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  progressLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
});
