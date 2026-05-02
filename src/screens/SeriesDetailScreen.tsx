import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { styles, width } from "../styles/styles";
import * as WebBrowser from "expo-web-browser";
import MovieAPI, { Episode, SeriesDetail } from "../services/MovieAPI";
import { useTvApp } from "../context/TvAppContext";
import { useUserData } from "../context/UserDataContext";
import StarRating from "../components/StarRating";
import StatusSelector from "../components/StatusSelector";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import { WatchStatus } from "../types/app";

type SeriesDetailsScreenProps = NativeStackScreenProps<any, "SeriesDetails">;

export default function SeriesDetailsScreen({
  route,
  navigation,
}: SeriesDetailsScreenProps) {
  const { isTvApp } = useTvApp();
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
    (s) => s.seasonNumber === selectedSeason
  );
  const currentEpisodes = currentSeason?.episodes || [];

  const seriesProgress = useMemo(
    () => (seriesData ? getSeriesProgress(seriesData.url) : []),
    [seriesData?.url, getSeriesProgress]
  );

  const watchedCount = useMemo(
    () => seriesProgress.filter((p) => p.watched).length,
    [seriesProgress]
  );

  const totalEpisodes = useMemo(() => {
    if (!seriesData) return 0;
    return seriesData.seasons.reduce((sum, s) => sum + s.episodes.length, 0);
  }, [seriesData]);

  // Season-level progress
  const seasonWatchedCount = useMemo(() => {
    return seriesProgress.filter(
      (p) => p.watched && p.seasonNumber === selectedSeason
    ).length;
  }, [seriesProgress, selectedSeason]);

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
        episode.episodeNumber
      );
    }
  };

  const handlePlayEpisode = async (episode: Episode) => {
    setSelectedEpisode(episode.episodeNumber);
    setGettingLinks(true);
    try {
      const links = await MovieAPI.getSeriesServer(episode.episodeUrl);
      setGettingLinks(false);
      const servers = links.videoLinks;
      const movieTitle = `${seriesData?.title} - S${selectedSeason}E${episode.episodeNumber} ${episode.episodeTitle}`;

      if (servers.length === 1) {
        navigation.navigate("VideoPlayer", {
          server: servers[0],
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

  function extractYouTubeUrl(embedUrl: string): string | null {
    const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }

  const handlePressTrailer = async () => {
    if (seriesData.trailerUrl) {
      if (Platform.OS === "web") {
        // @ts-ignore
        window.open(seriesData.trailerUrl, "_blank");
      } else {
        const youtubeUrl = extractYouTubeUrl(seriesData.trailerUrl);
        if (youtubeUrl) {
          await WebBrowser.openBrowserAsync(youtubeUrl);
          return;
        }
      }
    } else {
      Alert.alert("No Trailer", "Trailer not available for this series");
    }
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
        <Image
          source={{ uri: seriesData.coverImage?.trim() }}
          style={seriesStyles.coverImage}
        />
      )}

      {/* Action Buttons */}
      <View style={detailActionStyles.actionRow}>
        <TouchableOpacity
          style={detailActionStyles.actionButton}
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
        </TouchableOpacity>

        <TouchableOpacity
          style={detailActionStyles.actionButton}
          onPress={() =>
            Share.share({
              message: `Check out the series "${seriesData.title}" on BMovieBox!`,
              title: seriesData.title,
            })
          }
        >
          <FontAwesome name="share-alt" size={22} color="#fff" />
          <Text style={detailActionStyles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Trailer Button */}
      {seriesData.trailerUrl && (
        <TouchableOpacity
          style={seriesStyles.trailerButton}
          onPress={handlePressTrailer}
        >
          <Text style={seriesStyles.trailerButtonText}>Watch Trailer</Text>
        </TouchableOpacity>
      )}

      {/* Status Selector — default build */}
      {!isTvApp && (
        <View style={detailActionStyles.statusSection}>
          <StatusSelector
            currentStatus={currentStatus}
            onSelect={handleStatusSelect}
            onRemove={
              libraryItem
                ? () => removeFromLibrary(seriesData.url)
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
            <Text style={seriesStyles.sectionTitle}>
              Episodes{" "}
              {seasonWatchedCount > 0 &&
                `(${seasonWatchedCount}/${currentEpisodes.length} watched)`}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={seriesStyles.seasonSelector}
            >
              {seriesData.seasons.map((season) => (
                <TouchableOpacity
                  key={season.seasonNumber}
                  style={[
                    seriesStyles.seasonButton,
                    selectedSeason === season.seasonNumber &&
                      seriesStyles.seasonButtonActive,
                  ]}
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
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={seriesStyles.episodesGrid}>
              {currentEpisodes.map((episode) => {
                const watched = isEpisodeWatched(episode.episodeUrl);
                return (
                  <TouchableOpacity
                    key={episode.episodeNumber}
                    style={[
                      seriesStyles.episodeCard,
                      watched && seriesStyles.episodeCardWatched,
                    ]}
                    onPress={() => {
                      if (isTvApp) {
                        handlePlayEpisode(episode);
                      } else {
                        handleToggleEpisodeWatched(episode);
                      }
                    }}
                    disabled={gettingLinks && isTvApp}
                  >
                    {gettingLinks &&
                    selectedEpisode === episode.episodeNumber &&
                    isTvApp ? (
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
                        {isTvApp ? (
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
                  </TouchableOpacity>
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
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
