import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MovieAPI, { MovieDetail, ResolvedStream } from "../services/MovieAPI";
import { styles } from "../styles/styles";
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
import { useDownloads } from "../context/DownloadContext";
import {
  DownloadRecord,
  DownloadStartError,
} from "../services/DownloadManager";
import { confirmLargeDownload } from "../utils/downloadConfirm";
import DownloadSourcePicker from "../components/DownloadSourcePicker";
import { validateDownloadStream } from "../utils/downloadValidation";
import {
  filterBadDownloadSources,
  markBadDownloadSource,
} from "../utils/downloadSourceHealth";
import { preparePlayableStreams } from "../utils/playbackValidation";

type MovieDetailsScreenProps = NativeStackScreenProps<any, "MovieDetails">;

function getSlugFromUrl(value?: string | null): string | null {
  if (!value) return null;
  const urlParts = value.split("/").filter(Boolean);
  return urlParts[urlParts.length - 1] ?? null;
}

function formatGB(bytes: number): string {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function formatResumeAt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Some APIs return non-numeric placeholders like "N/A" — guard the cast so
// Number("N/A").toFixed(1) doesn't render "NaN" to users.
function formatRating(value: unknown): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return typeof value === "string" ? value : null;
  }
  return n.toFixed(1);
}

function downloadButtonLabel(record?: DownloadRecord): string {
  if (!record) return "Download";
  switch (record.status) {
    case "downloading": {
      const pct =
        record.sizeBytes > 0
          ? Math.floor((record.bytesDownloaded / record.sizeBytes) * 100)
          : 0;
      return `Downloading ${pct}%  •  Tap to cancel`;
    }
    case "completed": {
      const progress = record.watchProgressMs ?? 0;
      if (progress > 0) {
        return `Continue at ${formatResumeAt(progress)}  •  ${formatGB(record.sizeBytes)}`;
      }
      return `Play Offline  •  ${formatGB(record.sizeBytes)}`;
    }
    case "failed":
      return "Retry Download";
    case "cancelled":
      return "Download";
    case "queued":
      return "Queued…";
    default:
      return "Download";
  }
}

export default function MovieDetailsScreen({
  route,
  navigation,
}: MovieDetailsScreenProps) {
  useTVBackHandler(() => navigation.goBack());
  const { isTvApp } = useTvApp();
  const usesTvPlaybackControls = Platform.isTV || isTvApp;
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
  } = useUserData();
  const { slug, url, movie } = route.params as {
    slug?: string;
    url?: string;
    movie?: { url?: string };
  };
  const detailsSlug = slug ?? getSlugFromUrl(movie?.url) ?? getSlugFromUrl(url);
  const [movieDetails, setMovieDetails] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvingStreams, setResolvingStreams] = useState(false);
  const [resolvingForDownload, setResolvingForDownload] = useState(false);
  const [downloadSources, setDownloadSources] = useState<ResolvedStream[]>([]);
  const [downloadPickerVisible, setDownloadPickerVisible] = useState(false);
  const [validatingDownloadUrl, setValidatingDownloadUrl] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const downloads = useDownloads();
  const downloadRecord = movieDetails
    ? downloads.byTmdbId[String(movieDetails.id)]?.find(
        (r) => r.kind === "movie",
      )
    : undefined;

  useEffect(() => {
    fetchMovieDetails();
  }, [detailsSlug]);

  useEffect(() => {
    if (movieDetails) {
      addToHistory({
        id: movieDetails.id,
        title: movieDetails.title,
        thumbnail: movieDetails.thumbnail,
        imdbRating: movieDetails.ratings?.imdb ?? null,
        releaseYear: movieDetails.releaseYear,
        genres: movieDetails.genres,
        url: movieDetails.url,
        isSeries: false,
        savedAt: Date.now(),
      });

      // Update lastOpenedAt in library
      updateLibraryItemOpened(movieDetails.url);

      // Save to known metadata cache
      saveKnownTitleMetadata({
        url: movieDetails.url,
        title: movieDetails.title,
        isSeries: false,
        thumbnail: movieDetails.thumbnail,
        coverImage: movieDetails.coverImage,
        genres: movieDetails.genres,
        runtime: movieDetails.duration,
        releaseYear: movieDetails.releaseYear,
        releaseDate: movieDetails.releaseDate,
        imdbRating: movieDetails.ratings?.imdb ?? null,
        directors: movieDetails.directors,
        actors: movieDetails.actors,
        countries: movieDetails.countries,
        updatedAt: Date.now(),
      });
    }
  }, [movieDetails?.id]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!detailsSlug) {
        throw new Error("Movie reference is missing.");
      }
      const details = await MovieAPI.getMovieDetailsBySlug(detailsSlug);
      setMovieDetails(details);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load movie details";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
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

  if (error || !movieDetails) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "Movie not found"}</Text>
        </View>
      </View>
    );
  }

  const libraryItem = getLibraryItem(movieDetails.url);
  const currentStatus = libraryItem?.status ?? null;
  const canonicalMovieUrl = movieDetails.url;
  const canonicalMovieSlug = detailsSlug ?? movieDetails.id;

  const handleStatusSelect = (status: WatchStatus) => {
    setLibraryStatus({
      url: movieDetails.url,
      id: movieDetails.id,
      title: movieDetails.title,
      thumbnail: movieDetails.thumbnail,
      releaseYear: movieDetails.releaseYear,
      genres: movieDetails.genres,
      imdbRating: movieDetails.ratings?.imdb ?? null,
      isSeries: false,
      status,
    });
  };

  const handlePlayPress = async () => {
    // Tier 1: try the backend's resolved-stream pipeline (Stremio addon +
    // Real-Debrid → direct CDN URL). If anything comes back, hand off to
    // the native player and skip the WebView path entirely.
    setResolvingStreams(true);
    try {
      const resolved = await MovieAPI.getResolvedStreams("movie", {
        tmdbId: movieDetails.id,
      });
      // Magnets aren't directly playable by either native player. Everything
      // else (MP4/HLS/MKV) is handled — MKV falls back to libVLC on iOS,
      // ExoPlayer plays it natively on Android. pickBest re-ranks for
      // quality-vs-bloat so the auto-played first stream isn't a 60GB REMUX.
      const compatible = pickBest(resolved.filter((s) => s.type !== "magnet"));
      const sourceContext = {
        tmdbId: String(movieDetails.id),
        kind: "movie" as const,
      };
      const playable = await preparePlayableStreams(compatible, sourceContext);
      if (playable.length > 0) {
        navigation.navigate("NativeVideoPlayer", {
          streams: playable,
          title: movieDetails.title,
          sourceContext,
          streamProgressKey: movieDetails.url,
        });
        return;
      }
      if (resolved.length > 0) {
        console.warn(
          `Stream resolved (${resolved.length}) but all magnets; falling back to WebView`,
        );
      }
    } catch (e) {
      console.warn("Stream resolution failed, falling back to WebView:", e);
    } finally {
      setResolvingStreams(false);
    }

    // Tier 2: fall back to the existing embed-URL + SecureWebView path.
    if (movieDetails.streamingServers.length === 0) {
      Alert.alert(
        "No Servers",
        "No streaming servers available for this movie",
      );
      return;
    }
    if (movieDetails.streamingServers.length === 1) {
      navigation.navigate("VideoPlayer", {
        server: movieDetails.streamingServers[0],
        servers: movieDetails.streamingServers,
        serverIndex: 0,
        movieTitle: movieDetails.title,
      });
    } else {
      navigation.navigate("ServerSelection", {
        servers: movieDetails.streamingServers,
        movieTitle: movieDetails.title,
      });
    }
  };

  const startMovieDownload = async (source: ResolvedStream) => {
    if (!movieDetails) return;

    const sourceContext = {
      tmdbId: String(movieDetails.id),
      kind: "movie" as const,
    };

    setResolvingForDownload(true);
    setValidatingDownloadUrl(source.url);
    try {
      const validation = await validateDownloadStream(source);
      if (!validation.ok) {
        await markBadDownloadSource(
          source,
          sourceContext,
          validation.reason ?? "Source failed validation",
        );
        const nextSources = downloadSources.filter(
          (candidate) => candidate.url !== source.url,
        );
        setDownloadSources(nextSources);
        if (nextSources.length === 0) setDownloadPickerVisible(false);
        Alert.alert(
          "Source unavailable",
          `${validation.reason ?? "This source could not be verified."}${
            nextSources.length > 0 ? " Choose another source." : ""
          }`,
        );
        return;
      }
      console.log("[MovieDetails] starting download:", {
        url: source.url,
        type: source.type,
        quality: source.quality,
        sizeBytes: source.sizeBytes,
        hasHeaders: !!source.headers,
      });
      const confirmed = await confirmLargeDownload(
        source.sizeBytes ?? 0,
        movieDetails.title,
      );
      if (!confirmed) return;
      await downloads.start(source, {
        tmdbId: String(movieDetails.id),
        title: movieDetails.title,
        kind: "movie",
        thumbnail: movieDetails.thumbnail,
      });
      setDownloadPickerVisible(false);
      setDownloadSources([]);
    } catch (e) {
      const stack = e instanceof Error && e.stack ? `\n${e.stack}` : "";
      console.warn("Download start failed:", e, stack);
      if (e instanceof DownloadStartError) {
        const titleMap: Record<DownloadStartError["reason"], string> = {
          storage_cap: "Storage cap reached",
          wifi_required: "Wi-Fi required",
          no_sources: "No downloadable sources",
          already_active: "Already downloading",
          unknown: "Download failed",
        };
        Alert.alert(titleMap[e.reason], e.message);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert("Download failed", msg);
      }
    } finally {
      setResolvingForDownload(false);
      setValidatingDownloadUrl(null);
    }
  };

  const handleDownloadPress = async () => {
    if (!movieDetails) return;

    // Already downloading → second tap cancels.
    if (downloadRecord?.status === "downloading") {
      await downloads.cancel(downloadRecord.id);
      return;
    }

    // Already on disk → play the local file via the same NativeVideoPlayer.
    if (downloadRecord?.status === "completed") {
      navigation.navigate("NativeVideoPlayer", {
        streams: [
          {
            url: downloadRecord.fileUri,
            type: downloadRecord.containerType,
            quality: downloadRecord.quality,
            name: "Offline",
            title: downloadRecord.title,
            source: "download",
            sizeBytes: downloadRecord.sizeBytes,
          },
        ],
        title: downloadRecord.title,
        recordId: downloadRecord.id,
        initialPositionMs: downloadRecord.watchProgressMs,
      });
      return;
    }

    // Otherwise (idle / failed / cancelled) → resolve candidate downloads.
    setResolvingForDownload(true);
    try {
      const resolved = await MovieAPI.getResolvedStreams("movie", {
        tmdbId: movieDetails.id,
      });
      const ranked = await filterBadDownloadSources(pickForDownload(resolved), {
        tmdbId: String(movieDetails.id),
        kind: "movie",
      });
      if (ranked.length === 0) {
        Alert.alert(
          "No downloadable sources",
          "Couldn't find a stream we can save offline.",
        );
        return;
      }
      setDownloadSources(ranked);
      setDownloadPickerVisible(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Download failed", msg);
    } finally {
      setResolvingForDownload(false);
    }
  };

  const handlePressTrailer = () => {
    if (!movieDetails.trailerUrl) {
      Alert.alert("No Trailer", "Trailer not available for this movie");
      return;
    }
    if (Platform.OS === "web") {
      // @ts-ignore
      window.open(movieDetails.trailerUrl, "_blank");
      return;
    }
    navigation.navigate("TrailerScreen", { videoUrl: movieDetails.trailerUrl });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Hero: cover image with the Play button overlaid dead-center, so the
          most common action is reachable without scrolling past the artwork. */}
      <View style={detailActionStyles.heroContainer}>
        {movieDetails.coverImage && (
          <TvSafeImage
            source={{ uri: movieDetails.coverImage?.trim() }}
            style={styles.coverImage}
            contentFit="cover"
          />
        )}
        {usesTvPlaybackControls && (
          <Focusable
            style={detailActionStyles.heroPlayButton}
            focusedStyle={detailActionStyles.heroPlayButtonFocused}
            hasTVPreferredFocus={Platform.isTV}
            onPress={resolvingStreams ? () => {} : handlePlayPress}
          >
            {resolvingStreams ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <FontAwesome name="play" size={36} color="#fff" />
            )}
          </Focusable>
        )}
      </View>

      {/* Action Buttons */}
      <View style={detailActionStyles.actionRow}>
        <Focusable
          style={detailActionStyles.actionButton}
          focusedStyle={detailActionStyles.focused}
          onPress={() =>
            toggleWantToWatch({
              id: movieDetails.id,
              title: movieDetails.title,
              thumbnail: movieDetails.thumbnail,
              imdbRating: movieDetails.ratings?.imdb ?? null,
              releaseYear: movieDetails.releaseYear,
              genres: movieDetails.genres,
              url: movieDetails.url,
              isSeries: false,
              savedAt: Date.now(),
            })
          }
        >
          <FontAwesome
            name={isInWatchlist(movieDetails.url) ? "bookmark" : "bookmark-o"}
            size={22}
            color={isInWatchlist(movieDetails.url) ? "#e74c3c" : "#fff"}
          />
          <Text style={detailActionStyles.actionText}>
            {isInWatchlist(movieDetails.url) ? "Saved" : "Save"}
          </Text>
        </Focusable>

        <Focusable
          style={detailActionStyles.actionButton}
          focusedStyle={detailActionStyles.focused}
          onPress={() =>
            Share.share({
              message: `Check out "${movieDetails.title}" on BMovieBox!`,
              title: movieDetails.title,
            })
          }
        >
          <FontAwesome name="share-alt" size={22} color="#fff" />
          <Text style={detailActionStyles.actionText}>Share</Text>
        </Focusable>
      </View>

      <Focusable
        style={[
          styles.trailerButton,
          detailActionStyles.primaryActionButton,
          { borderColor: "#e74c3c", marginTop: 12 },
        ]}
        focusedStyle={detailActionStyles.focused}
        onPress={handlePressTrailer}
      >
        <Text style={styles.trailerButtonText}>Watch Trailer</Text>
      </Focusable>

      {/* Download button — only shown when TV-app mode is unlocked. Cycles idle → downloading → completed.
          Progress fill renders as a relative bar behind the label. */}
      {isTvApp && (
        <Focusable
          style={[
            detailActionStyles.downloadButton,
            detailActionStyles.primaryActionButton,
            downloadRecord?.status === "completed" &&
              detailActionStyles.downloadButtonCompleted,
            downloadRecord?.status === "failed" &&
              detailActionStyles.downloadButtonFailed,
          ]}
          focusedStyle={detailActionStyles.focused}
          onPress={resolvingForDownload ? () => {} : handleDownloadPress}
        >
          {downloadRecord?.status === "downloading" && (
            <View
              style={[
                detailActionStyles.downloadProgressFill,
                {
                  width: `${
                    downloadRecord.sizeBytes > 0
                      ? Math.min(
                          100,
                          (downloadRecord.bytesDownloaded /
                            downloadRecord.sizeBytes) *
                            100,
                        )
                      : 0
                  }%`,
                },
              ]}
              pointerEvents="none"
            />
          )}
          {resolvingForDownload ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={detailActionStyles.downloadButtonText}>
              {downloadButtonLabel(downloadRecord)}
            </Text>
          )}
        </Focusable>
      )}

      {/* Status Selector — default build */}
      {!isTvApp && (
        <View style={detailActionStyles.statusSection}>
          <StatusSelector
            currentStatus={currentStatus}
            onSelect={handleStatusSelect}
            onRemove={
              libraryItem
                ? () => removeFromLibrary(movieDetails.url)
                : undefined
            }
          />
          {libraryItem && (
            <Text style={detailActionStyles.trackedLabel}>
              Tracked in Library
            </Text>
          )}
        </View>
      )}

      {/* Movie Info */}
      <View style={styles.movieInfoContainer}>
        <Text style={styles.movieTitle}>{movieDetails.title}</Text>

        {/* Year & Duration & Release Date */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{movieDetails.releaseYear}</Text>
          {movieDetails.duration && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{movieDetails.duration}</Text>
            </>
          )}
          {movieDetails.releaseDate && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{movieDetails.releaseDate}</Text>
            </>
          )}
        </View>

        {/* Genres */}
        {movieDetails.genres.length > 0 && (
          <View style={styles.genresContainer}>
            {movieDetails.genres.map((genre, index) => (
              <View key={index} style={styles.genreTag}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Ratings */}
        <View style={styles.ratingsContainer}>
          <Text style={styles.ratingsTitle}>Ratings</Text>
          <View style={styles.ratingsGrid}>
            {(() => {
              const imdb = formatRating(movieDetails.ratings.imdb);
              return imdb ? (
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingSource}>IMDb</Text>
                  <Text style={styles.ratingValue}>{imdb}</Text>
                </View>
              ) : null;
            })()}
            {(() => {
              const tmdb = formatRating(movieDetails.ratings.tmdb);
              return tmdb ? (
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingSource}>TMDb</Text>
                  <Text style={styles.ratingValue}>{tmdb}</Text>
                </View>
              ) : null;
            })()}
            {(() => {
              const rt = formatRating(movieDetails.ratings.rottenTomatoes);
              return rt ? (
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingSource}>RT</Text>
                  <Text style={styles.ratingValue}>{rt}%</Text>
                </View>
              ) : null;
            })()}
            {(() => {
              const meta = formatRating(movieDetails.ratings.metacritic);
              return meta ? (
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingSource}>Metacritic</Text>
                  <Text style={styles.ratingValue}>{meta}</Text>
                </View>
              ) : null;
            })()}
          </View>
        </View>

        {/* Your Rating */}
        <View style={detailActionStyles.yourRatingSection}>
          <Text style={styles.sectionTitle}>Your Rating</Text>
          <StarRating
            rating={getRating(movieDetails.url)}
            onRate={(r) => setRating(movieDetails.url, r)}
          />
        </View>

        <TitlePlanningPanel
          titleUrl={canonicalMovieUrl}
          detailSlug={canonicalMovieSlug}
          title={movieDetails.title}
          isSeries={false}
          thumbnail={movieDetails.thumbnail}
        />

        {/* Description */}
        {movieDetails.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Synopsis</Text>
            <Text style={styles.description}>{movieDetails.description}</Text>
          </View>
        )}

        {/* Directors */}
        {movieDetails.directors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Directors</Text>
            <Text style={styles.personText}>
              {movieDetails.directors.join(", ")}
            </Text>
          </View>
        )}

        {/* Actors */}
        {movieDetails.actors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cast</Text>
            <Text style={styles.personText}>
              {movieDetails.actors.join(", ")}
            </Text>
          </View>
        )}

        {/* Countries */}
        {movieDetails.countries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Countries</Text>
            <Text style={styles.personText}>
              {movieDetails.countries.join(", ")}
            </Text>
          </View>
        )}

        {/* Production Companies */}
        {movieDetails.companies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Production</Text>
            <Text style={styles.personText}>
              {movieDetails.companies.join(", ")}
            </Text>
          </View>
        )}

        {/* Awards */}
        {movieDetails.awards && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Awards</Text>
            <Text style={styles.personText}>{movieDetails.awards}</Text>
          </View>
        )}

        {/* Views */}
        {movieDetails.views > 0 && (
          <View style={styles.section}>
            <Text style={styles.metaText}>
              {movieDetails.views.toLocaleString()} views
            </Text>
          </View>
        )}
      </View>
      {isTvApp && (
        <DownloadSourcePicker
          visible={downloadPickerVisible}
          title={movieDetails.title}
          subtitle={movieDetails.title}
          sources={downloadSources}
          activeUrl={validatingDownloadUrl}
          onSelect={(source) => void startMovieDownload(source)}
          onClose={() => {
            if (validatingDownloadUrl) return;
            setDownloadPickerVisible(false);
          }}
        />
      )}
    </ScrollView>
  );
}

const detailActionStyles = StyleSheet.create({
  heroContainer: {
    position: "relative",
  },
  heroPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 84,
    height: 84,
    marginTop: -42,
    marginLeft: -42,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.52)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  heroPlayButtonFocused: {
    borderColor: "#fff",
    transform: [{ scale: 1.08 }],
  },
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
  downloadButton: {
    backgroundColor: "#2c3e50",
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  downloadButtonCompleted: { backgroundColor: "#27ae60" },
  downloadButtonFailed: { backgroundColor: "#7f1d1d" },
  downloadButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  downloadProgressFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(231,76,60,0.45)",
  },
});
