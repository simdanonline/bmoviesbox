import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MovieAPI, { Movie, MoviesResponse } from "../services/MovieAPI";
import FeaturedMovie from "../components/FeaturedMovie";
import MovieCard from "../components/MovieCard";
import { styles } from "../styles/styles";
import { useTvApp } from "../context/TvAppContext";
import { useUserData } from "../context/UserDataContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Updates from "expo-updates";
import * as Device from "expo-device";

type HomeScreenProps = NativeStackScreenProps<any, "Movies">;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const { isTvApp, unlockTvApp } = useTvApp();
  const { history } = useUserData();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  useEffect(() => {
    fetchMovies();
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

  const recentMovies = useMemo(
    () => history.filter((h) => !h.isSeries).slice(0, 10),
    [history]
  );

  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    movies.forEach((m) => m.genres?.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [movies]);

  const filteredMovies = useMemo(() => {
    if (!selectedGenre) return otherMovies;
    return otherMovies.filter((m) => m.genres?.includes(selectedGenre));
  }, [otherMovies, selectedGenre]);

  const handleMoviePress = (movie: Movie) => {
    // Extract slug from URL
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie });
  };

  const handleRecentPress = (item: any) => {
    const urlParts = item.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie: item });
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
            }
          },
          "secure-text"
        );
      } else {
        setShowAccessModal(true);
      }
    }
  };

  const checkForUpdate = async () => {
    try {
      if (__DEV__) {
        Alert.alert("Development Mode", "Updates are not available in development mode.");
        return;
      }
      if (!Device.isDevice) {
        Alert.alert("Device Required", "Updates can only be checked on physical devices.");
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Updates.reloadAsync();
      } else {
        Alert.alert("Up to Date", "You are using the latest version.", [{ text: "OK" }]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error checking for update:", error);
      if (message.includes("HTTP response error 400")) {
        Alert.alert("Configuration Error", "Update service is not properly configured.");
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
  };

  const handleAccessCancel = () => {
    setShowAccessModal(false);
    setAccessKey("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
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
          <Text onPress={handleHeaderTap} style={styles.headerTitle}>
            BMovieBox
          </Text>
          <TouchableOpacity onPress={onclickSearch}>
            <FontAwesome name="search" size={30} color={"#fff"} />
          </TouchableOpacity>
        </View>

        {/* Recently Viewed */}
        {recentMovies.length > 0 && (
          <View style={homeStyles.recentSection}>
            <Text style={styles.sectionTitle}>Recently Viewed</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={homeStyles.recentScroll}
            >
              {recentMovies.map((item, idx) => (
                <TouchableOpacity
                  key={item.id + idx}
                  style={homeStyles.recentCard}
                  onPress={() => handleRecentPress(item)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: item.thumbnail?.trim() }}
                    style={homeStyles.recentImage}
                    contentFit="cover"
                  />
                  <Text style={homeStyles.recentTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Movie */}
        {featuredMovie && (
          <FeaturedMovie
            movie={featuredMovie}
            onPress={() => handleMoviePress(featuredMovie)}
          />
        )}

        {/* Genre Filters */}
        {allGenres.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={homeStyles.genreScroll}
          >
            <TouchableOpacity
              style={[
                homeStyles.genreChip,
                !selectedGenre && homeStyles.genreChipActive,
              ]}
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
            </TouchableOpacity>
            {allGenres.map((genre) => (
              <TouchableOpacity
                key={genre}
                style={[
                  homeStyles.genreChip,
                  selectedGenre === genre && homeStyles.genreChipActive,
                ]}
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
              </TouchableOpacity>
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
              style={modalStyles.textInput}
              placeholder="Access key"
              placeholderTextColor="#888"
              value={accessKey}
              onChangeText={setAccessKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={true}
            />
            <View style={modalStyles.buttonContainer}>
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.cancelButton]}
                onPress={handleAccessCancel}
              >
                <Text style={modalStyles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.button, modalStyles.confirmButton]}
                onPress={handleAccessConfirm}
              >
                <Text style={modalStyles.confirmButtonText}>Submit</Text>
              </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
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
  recentSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 12,
  },
  recentScroll: {
    gap: 12,
  },
  recentCard: {
    width: 100,
    alignItems: "center",
  },
  recentImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
  },
  recentTitle: {
    color: "#ccc",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    width: 100,
  },
  genreScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  genreChipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
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
