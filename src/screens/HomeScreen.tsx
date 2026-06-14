import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MovieAPI, { Movie, MoviesResponse } from "../services/MovieAPI";
import FeaturedMovie from "../components/FeaturedMovie";
import MovieCard from "../components/MovieCard";
import RecommendationRail from "../components/RecommendationRail";
import ContinueWatchingSection from "../components/ContinueWatchingCard";
import Focusable from "../components/Focusable";
import { styles } from "../styles/styles";
import { useTvApp } from "../context/TvAppContext";
import { useUserData } from "../context/UserDataContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import * as Device from "expo-device";
import {
  buildRecommendationPool,
  getPersonalizedRails,
  RecommendationRail as RailType,
} from "../services/RecommendationService";
import { LibraryItem } from "../types/app";

type HomeScreenProps = NativeStackScreenProps<any, "Movies">;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [bgSeries, setBgSeries] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [accessInputFocused, setAccessInputFocused] = useState(false);
  const { isTvApp, unlockTvApp } = useTvApp();
  const {
    history,
    tasteProfile,
    library,
    knownMetadata,
    ratings,
    getContinueWatchingItems,
    isOnboardingComplete,
  } = useUserData();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const accessInputRef = useRef<TextInput>(null);

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    if (Platform.isTV) {
      // Small delay so the layout has measured by the time we scroll
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 120, animated: false });
      }, 150);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!showAccessModal) {
      setAccessInputFocused(false);
      return;
    }

    const t = setTimeout(() => {
      accessInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [showAccessModal]);

  // Background-fetch a few pages of movies + series for recommendation pool
  useEffect(() => {
    (async () => {
      try {
        const [p2, seriesP1] = await Promise.all([
          MovieAPI.getAllMovies(2).catch(() => null),
          MovieAPI.getAllSeries(1).catch(() => null),
        ]);
        if (p2?.movies) {
          setMovies((prev) => {
            const urls = new Set(prev.map((m) => m.url));
            return [...prev, ...p2.movies.filter((m) => !urls.has(m.url))];
          });
        }
        if (seriesP1?.movies) {
          setBgSeries(seriesP1.movies);
        }
      } catch {
        // non-critical
      }
    })();
  }, []);

  const fetchMovies = async () => {
    try {
      setError(null);
      const response: MoviesResponse = await MovieAPI.getAllMovies(1);
      setMovies(response.movies);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load movies";
      console.error("Error fetching movies:", errorMessage);
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response: MoviesResponse = await MovieAPI.getAllMovies(1);
      setMovies(response.movies);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const featuredMovie = movies.length > 0 ? movies[0] : null;
  const otherMovies = movies.length > 1 ? movies.slice(1) : [];

  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    movies.forEach((m) => m.genres?.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!selectedGenre) return otherMovies;
    return otherMovies.filter((m) => m.genres?.includes(selectedGenre));
  }, [otherMovies, selectedGenre]);

  // Recommendation rails
  const historyUrls = useMemo(
    () => new Set(history.map((h) => h.url)),
    [history],
  );

  const rails = useMemo((): RailType[] => {
    if (movies.length === 0) return [];
    const pool = buildRecommendationPool(
      movies,
      bgSeries,
      tasteProfile,
      library,
      knownMetadata,
      ratings,
      historyUrls,
    );
    return getPersonalizedRails(pool, tasteProfile, ratings);
  }, [
    movies,
    bgSeries,
    tasteProfile,
    library,
    knownMetadata,
    ratings,
    historyUrls,
  ]);

  const continueWatching = useMemo(
    () => getContinueWatchingItems(),
    [getContinueWatchingItems],
  );

  const handleMoviePress = (movie: Movie) => {
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    if (movie.isSeries) {
      navigation.navigate("SeriesDetails", { url: movie.url });
    } else {
      navigation.navigate("MovieDetails", { slug, movie });
    }
  };

  const handleContinuePress = (item: LibraryItem) => {
    if (item.isSeries) {
      navigation.navigate("SeriesDetails", { url: item.url });
    } else {
      const urlParts = item.url.split("/").filter(Boolean);
      const slug = urlParts[urlParts.length - 1];
      navigation.navigate("MovieDetails", { slug, movie: item });
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

  if (error && movies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.subtext}>
            Make sure the API server is running and accessible.
          </Text>
        </View>
      </View>
    );
  }

  const onclickSearch = () => {
    navigation.navigate("SearchScreen");
  };

  const onclickSettings = () => {
    navigation.navigate("Settings");
  };

  const handleHeaderTap = () => {
    if (Platform.OS === "web") return;
    if (isTvApp) {
      checkForUpdate();
      return;
    }
    const now = Date.now();
    if (now - lastTapTimeRef.current > 3000) {
      tapCountRef.current = 1;
    } else {
      tapCountRef.current += 1;
    }
    lastTapTimeRef.current = now;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      if (Platform.OS === "ios") {
        Alert.prompt(
          "Enter Access Key",
          "",
          async (text) => {
            if (text) {
              const success = await unlockTvApp(text);
              if (!success) Alert.alert("Invalid Key", "");
              if (success) {
                checkForUpdate();
              }
            }
          },
          "secure-text",
        );
      } else {
        setShowAccessModal(true);
      }
    }
  };

  const checkForUpdate = async () => {
    try {
      if (__DEV__) {
        Alert.alert(
          "Development Mode",
          "Updates are not available in development mode.",
        );
        return;
      }
      if (!Device.isDevice) {
        Alert.alert(
          "Device Required",
          "Updates can only be checked on physical devices.",
        );
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Updates.reloadAsync();
      } else {
        Alert.alert("Up to Date", "You are using the latest version.", [
          { text: "OK" },
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error checking for update:", error);
      if (message.includes("HTTP response error 400")) {
        Alert.alert(
          "Configuration Error",
          "Update service is not properly configured.",
        );
      } else {
        Alert.alert("Error", "Failed to check for updates: " + message);
      }
    }
  };

  const handleAccessConfirm = async () => {
    const success = await unlockTvApp(accessKey);
    setAccessKey("");
    setShowAccessModal(false);
    if (!success) Alert.alert("Invalid Key", "");
    if (success) {
      checkForUpdate();
    }
  };

  const handleAccessCancel = () => {
    setShowAccessModal(false);
    setAccessKey("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e74c3c"
            colors={["#e74c3c"]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, styles.row]}>
          <Focusable
            style={styles.headerLogoWrap}
            focusedStyle={styles.iconButtonFocused}
            onPress={handleHeaderTap}
          >
            <Text style={styles.headerTitle}>BMovie</Text>
          </Focusable>
          <View style={styles.row}>
            <Focusable
              style={styles.headerIconWrap}
              focusedStyle={styles.iconButtonFocused}
              onPress={onclickSettings}
            >
              <FontAwesome name="gear" size={26} color={"#fff"} />
            </Focusable>
            <Focusable
              style={styles.headerIconWrap}
              focusedStyle={styles.iconButtonFocused}
              onPress={onclickSearch}
            >
              <FontAwesome name="search" size={30} color={"#fff"} />
            </Focusable>
          </View>
        </View>

        {/* Welcome hint if onboarding was skipped */}
        {!isOnboardingComplete && movies.length > 0 && (
          <View style={homeStyles.hintBanner}>
            <Text style={homeStyles.hintText}>
              Set your taste preferences in Settings to get personalized
              recommendations.
            </Text>
          </View>
        )}

        {/* Featured Movie */}
        {featuredMovie && (
          <FeaturedMovie
            movie={featuredMovie}
            onPress={() => handleMoviePress(featuredMovie)}
          />
        )}

        {/* Continue Watching */}
        {!isTvApp && (
          <ContinueWatchingSection
            items={continueWatching}
            onPress={handleContinuePress}
          />
        )}

        {/* Recommendation Rails */}
        {rails.map((rail) => (
          <RecommendationRail
            key={rail.id}
            title={rail.title}
            items={rail.items}
            onPress={handleMoviePress}
          />
        ))}

        {/* Genre Filters */}
        {allGenres.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={homeStyles.genreScroll}
          >
            <Focusable
              style={[
                homeStyles.genreChip,
                !selectedGenre && homeStyles.genreChipActive,
              ]}
              focusedStyle={homeStyles.genreChipFocused}
              onPress={() => setSelectedGenre(null)}
            >
              <Text
                style={[
                  homeStyles.genreChipText,
                  !selectedGenre && homeStyles.genreChipTextActive,
                ]}
              >
                All
              </Text>
            </Focusable>
            {allGenres.map((genre) => (
              <Focusable
                key={genre}
                style={[
                  homeStyles.genreChip,
                  selectedGenre === genre && homeStyles.genreChipActive,
                ]}
                focusedStyle={homeStyles.genreChipFocused}
                onPress={() =>
                  setSelectedGenre(selectedGenre === genre ? null : genre)
                }
              >
                <Text
                  style={[
                    homeStyles.genreChipText,
                    selectedGenre === genre && homeStyles.genreChipTextActive,
                  ]}
                >
                  {genre}
                </Text>
              </Focusable>
            ))}
          </ScrollView>
        )}

        {/* Movies List */}
        <View style={styles.moviesSection}>
          <Text style={styles.sectionTitle}>
            {selectedGenre ? selectedGenre : "More Movies"}
          </Text>
          <View style={styles.moviesGrid}>
            {filteredMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onPress={() => handleMoviePress(movie)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Access Key Modal (Android) */}
      <Modal
        visible={showAccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleAccessCancel}
      >
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContent}>
            <Text style={modalStyles.modalTitle}>Access Key</Text>
            <Text style={modalStyles.modalMessage}>
              Enter access key to continue:
            </Text>
            <TextInput
              ref={accessInputRef}
              style={[
                modalStyles.textInput,
                accessInputFocused && modalStyles.textInputFocused,
              ]}
              placeholder="Access key"
              placeholderTextColor="#888"
              value={accessKey}
              onChangeText={setAccessKey}
              onFocus={() => setAccessInputFocused(true)}
              onBlur={() => setAccessInputFocused(false)}
              onSubmitEditing={handleAccessConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={true}
              autoFocus={showAccessModal}
              returnKeyType="done"
            />
            <View style={modalStyles.buttonContainer}>
              <Focusable
                style={[modalStyles.button, modalStyles.cancelButton]}
                focusedStyle={modalStyles.buttonFocused}
                onPress={handleAccessCancel}
              >
                <Text style={modalStyles.cancelButtonText}>Cancel</Text>
              </Focusable>
              <Focusable
                style={[modalStyles.button, modalStyles.confirmButton]}
                focusedStyle={modalStyles.buttonFocused}
                hasTVPreferredFocus={Platform.isTV}
                onPress={handleAccessConfirm}
              >
                <Text style={modalStyles.confirmButtonText}>Submit</Text>
              </Focusable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 20,
    textAlign: "center",
  },
  textInput: {
    backgroundColor: "#2a2a2a",
    borderWidth: 2,
    borderColor: "#444",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
  },
  textInputFocused: {
    borderColor: "#fff",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  buttonFocused: {
    borderColor: "#fff",
  },
  cancelButton: {
    backgroundColor: "#333",
    borderWidth: 1,
    borderColor: "#555",
  },
  confirmButton: {
    backgroundColor: "#e74c3c",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

const homeStyles = StyleSheet.create({
  hintBanner: {
    backgroundColor: "#1a1a1a",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#e74c3c",
  },
  hintText: {
    color: "#aaa",
    fontSize: 13,
    lineHeight: 18,
  },
  genreScroll: {
    paddingHorizontal: Platform.isTV ? 32 : 16,
    paddingVertical: Platform.isTV ? 12 : 8,
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: Platform.isTV ? 2 : 1,
    borderColor: "#333",
  },
  genreChipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  genreChipFocused: {
    borderColor: "#fff",
  },
  genreChipText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  genreChipTextActive: {
    color: "#fff",
  },
});
