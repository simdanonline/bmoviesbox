import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import MovieAPI, { Movie, MoviesResponse } from "../services/MovieAPI";
import FeaturedMovie from "../components/FeaturedMovie";
import MovieCard from "../components/MovieCard";
import { styles } from "../styles/styles";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome, Ionicons } from "@expo/vector-icons";

type HomeScreenProps = NativeStackScreenProps<any, "Home">;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleMoviePress = (movie: Movie) => {
    // Extract slug from URL
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie });
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

  const featuredMovie = movies.length > 0 ? movies[0] : null;
  const otherMovies = movies.length > 1 ? movies.slice(1) : [];

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
          <Text style={styles.headerTitle}>BMovieBox</Text>
          <TouchableOpacity onPress={onclickSearch}>
            <FontAwesome name="search" size={30} color={"#fff"} />
          </TouchableOpacity>
        </View>

        {/* Featured Movie */}
        {featuredMovie && (
          <FeaturedMovie
            movie={featuredMovie}
            onPress={() => handleMoviePress(featuredMovie)}
          />
        )}

        {/* Movies List */}
        <View style={styles.moviesSection}>
          <Text style={styles.sectionTitle}>More Movies</Text>
          <View style={styles.moviesGrid}>
            {otherMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onPress={() => handleMoviePress(movie)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
