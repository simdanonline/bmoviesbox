import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
  Share,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MovieAPI, { MovieDetail } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useTvApp } from "../context/TvAppContext";
import { useUserData } from "../context/UserDataContext";
import StarRating from "../components/StarRating";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

type MovieDetailsScreenProps = NativeStackScreenProps<any, "MovieDetails">;

export default function MovieDetailsScreen({
  route,
  navigation,
}: MovieDetailsScreenProps) {
  const { isTvApp } = useTvApp();
  const { isInWatchlist, toggleWatchlist, addToHistory, getRating, setRating } =
    useUserData();
  const { slug } = route.params as { slug: string };
  const [movieDetails, setMovieDetails] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMovieDetails();
  }, [slug]);

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
    }
  }, [movieDetails?.id]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await MovieAPI.getMovieDetailsBySlug(slug);
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

  const handlePlayPress = () => {
    if (movieDetails.streamingServers.length === 0) {
      Alert.alert(
        "No Servers",
        "No streaming servers available for this movie",
      );
      return;
    }

    if (movieDetails.streamingServers.length === 1) {
      // If only one server, go directly to player
      navigation.navigate("VideoPlayer", {
        server: movieDetails.streamingServers[0],
        movieTitle: movieDetails.title,
      });
    } else {
      // If multiple servers, show selection screen
      navigation.navigate("ServerSelection", {
        servers: movieDetails.streamingServers,
        movieTitle: movieDetails.title,
      });
    }
  };

  function extractYouTubeUrl(embedUrl: string): string | null {
    const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;

    const videoId = match[1];
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  const handlePressTrailer = async () => {
    if (movieDetails.trailerUrl) {
      if (Platform.OS === "web") {
        // @ts-ignore
        window.open(movieDetails.trailerUrl, "_blank");
      } else {
        const youtubeUrl = extractYouTubeUrl(movieDetails.trailerUrl);
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
    <ScrollView style={styles.container}>
      {/* Cover Image */}
      {movieDetails.coverImage && (
        <Image
          source={{ uri: movieDetails.coverImage?.trim() }}
          style={styles.coverImage}
        />
      )}

      {/* Action Buttons */}
      <View style={detailActionStyles.actionRow}>
        <TouchableOpacity
          style={detailActionStyles.actionButton}
          onPress={() =>
            toggleWatchlist({
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
            {isInWatchlist(movieDetails.url) ? "Saved" : "Watchlist"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={detailActionStyles.actionButton}
          onPress={() =>
            Share.share({
              message: `Check out "${movieDetails.title}" on BMovieBox!`,
              title: movieDetails.title,
            })
          }
        >
          <FontAwesome name="share-alt" size={22} color="#fff" />
          <Text style={detailActionStyles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Play Button */}
      {isTvApp ? (
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPress}>
          <Text style={styles.playButtonText}>▶ PLAY</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.trailerButton}
        onPress={handlePressTrailer}
      >
        <Text style={styles.trailerButtonText}>Watch Trailer</Text>
      </TouchableOpacity>

      {/* Movie Info */}
      <View style={styles.movieInfoContainer}>
        <Text style={styles.movieTitle}>{movieDetails.title}</Text>

        {/* Year & Duration */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{movieDetails.releaseYear}</Text>
          {movieDetails.duration && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{movieDetails.duration}</Text>
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
            {movieDetails.ratings.imdb && (
              <View style={styles.ratingItem}>
                <Text style={styles.ratingSource}>IMDb</Text>
                <Text style={styles.ratingValue}>
                  {movieDetails.ratings.imdb}
                </Text>
              </View>
            )}
            {movieDetails.ratings.tmdb && (
              <View style={styles.ratingItem}>
                <Text style={styles.ratingSource}>TMDb</Text>
                <Text style={styles.ratingValue}>
                  {movieDetails.ratings.tmdb}
                </Text>
              </View>
            )}
            {movieDetails.ratings.rottenTomatoes && (
              <View style={styles.ratingItem}>
                <Text style={styles.ratingSource}>RT</Text>
                <Text style={styles.ratingValue}>
                  {movieDetails.ratings.rottenTomatoes}%
                </Text>
              </View>
            )}
            {movieDetails.ratings.metacritic && (
              <View style={styles.ratingItem}>
                <Text style={styles.ratingSource}>Metacritic</Text>
                <Text style={styles.ratingValue}>
                  {movieDetails.ratings.metacritic}
                </Text>
              </View>
            )}
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
              👁️ {movieDetails.views.toLocaleString()} views
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

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
});
