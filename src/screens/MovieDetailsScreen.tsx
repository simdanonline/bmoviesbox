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
import MovieAPI, { MovieDetail } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import * as WebBrowser from "expo-web-browser";
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

type MovieDetailsScreenProps = NativeStackScreenProps<any, "MovieDetails">;

function getSlugFromUrl(value?: string | null): string | null {
  if (!value) return null;
  const urlParts = value.split("/").filter(Boolean);
  return urlParts[urlParts.length - 1] ?? null;
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
  const [error, setError] = useState<string | null>(null);

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

  const handlePlayPress = () => {
    console.log("Available streaming servers:", movieDetails);
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

  function extractYouTubeUrl(embedUrl: string): string | null {
    const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    return `https://www.youtube.com/watch?v=${match[1]}`;
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
        <TvSafeImage
          source={{ uri: movieDetails.coverImage?.trim() }}
          style={styles.coverImage}
          contentFit="cover"
        />
      )}

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

      {/* Play Button — shown for Android TV hardware or unlocked TV mode */}
      {usesTvPlaybackControls ? (
        <Focusable
          style={[styles.playButton, detailActionStyles.primaryActionButton]}
          focusedStyle={detailActionStyles.focused}
          hasTVPreferredFocus={Platform.isTV}
          onPress={handlePlayPress}
        >
          <Text style={styles.playButtonText}>PLAY</Text>
        </Focusable>
      ) : null}

      <Focusable
        style={[styles.trailerButton, detailActionStyles.primaryActionButton]}
        focusedStyle={detailActionStyles.focused}
        onPress={handlePressTrailer}
      >
        <Text style={styles.trailerButtonText}>Watch Trailer</Text>
      </Focusable>

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
});
