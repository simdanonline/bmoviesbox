import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { styles, width } from "../styles/styles";
import * as WebBrowser from "expo-web-browser";
import MovieAPI, { Episode, SeriesDetail } from "../services/MovieAPI";

type SeriesDetailsScreenProps = NativeStackScreenProps<any, "SeriesDetails">;

export default function SeriesDetailsScreen({
  route,
  navigation,
}: SeriesDetailsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { url } = route.params as { url: string };
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [seriesData, setSeriesData] = useState<SeriesDetail | null>(null);
  const [gettingLinks, setGettingLinks] = useState(false);
  React.useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await MovieAPI.getSeriesByUrl(url);
        setSeriesData(details);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load movie details";
        setError(errorMessage);
        Alert.alert("Error", errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, []);
  const currentSeason = seriesData?.seasons?.find(
    (s) => s.seasonNumber === selectedSeason
  );
  const currentEpisodes = currentSeason?.episodes || [];

  const handlePlayEpisode = async (episode: Episode) => {
    setSelectedEpisode(episode.episodeNumber);
    setGettingLinks(true);
    const links = await MovieAPI.getSeriesServer(episode.episodeUrl);
    setGettingLinks(false);
    const servers = links.videoLinks;
    const movieTitle = `${seriesData?.title} - S${selectedSeason}E${episode.episodeNumber} ${episode.episodeTitle}`;

    if (servers.length === 1) {
      // If only one server, go directly to player
      navigation.navigate("VideoPlayer", {
        server: servers[0],
        movieTitle: movieTitle,
      });
    } else {
      // If multiple servers, show selection screen
      navigation.navigate("ServerSelection", {
        servers: servers,
        movieTitle: movieTitle,
      });
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

    const videoId = match[1];
    return `https://www.youtube.com/watch?v=${videoId}`;
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
      Alert.alert("No Trailer", "Trailer not available for this movie");
    }
  };

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

      {/* Play Trailer Button */}
      {seriesData.trailerUrl && (
        <TouchableOpacity
          style={seriesStyles.trailerButton}
          onPress={handlePressTrailer}
        >
          <Text style={seriesStyles.trailerButtonText}>▶ Watch Trailer</Text>
        </TouchableOpacity>
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

        {/* Description */}
        {seriesData.description && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Synopsis</Text>
            <Text style={seriesStyles.description}>
              {seriesData.description}
            </Text>
          </View>
        )}

        {/* Seasons & Episodes */}
        {seriesData.seasons.length > 0 && (
          <View style={seriesStyles.section}>
            <Text style={seriesStyles.sectionTitle}>Episodes</Text>

            {/* Season Selector */}
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

            {/* Episodes Grid */}
            <View style={seriesStyles.episodesGrid}>
              {currentEpisodes.map((episode) => (
                <TouchableOpacity
                  key={episode.episodeNumber}
                  style={seriesStyles.episodeCard}
                  onPress={() => handlePlayEpisode(episode)}
                  disabled={gettingLinks}
                >
                  {gettingLinks && selectedEpisode === episode.episodeNumber ? (
                    <View style={seriesStyles.centered}>
                      <ActivityIndicator />
                    </View>
                  ) : (
                    <>
                      <View style={seriesStyles.episodeNumber}>
                        <Text style={seriesStyles.episodeNumberText}>
                          E{episode.episodeNumber}
                        </Text>
                      </View>
                      <Text style={seriesStyles.episodeTitle} numberOfLines={1}>
                        {episode.episodeTitle}
                      </Text>
                      <View style={seriesStyles.playIconSmall}>
                        <Text style={seriesStyles.playIcon}>▶</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ))}
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
              👁️ {seriesData.views.toLocaleString()} views
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
  episodeNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
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
