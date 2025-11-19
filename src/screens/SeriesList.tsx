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

type SeriesListProps = NativeStackScreenProps<any, "Series">;

export default function SeriesList({ navigation }: SeriesListProps) {
  const [series, setSeries] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSeries();
  }, []);

  const fetchSeries = async () => {
    try {
      setError(null);
      const response: MoviesResponse = await MovieAPI.getAllSeries(1);
      setSeries(response.movies);
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
      const response: MoviesResponse = await MovieAPI.getAllSeries(1);
      setSeries(response.movies);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSeriesPress = (movie: Movie) => {
    // Extract slug from URL
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    console.log("Navigating to SeriesDetails with slug:", movie.url);
    // navigation.navigate("MovieDetails", { slug, movie });
    navigation.navigate("SeriesDetails", { url: movie.url });
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

  if (error && series.length === 0) {
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

  const featuredSeries = series.length > 0 ? series[0] : null;
  const otherSeries = series.length > 1 ? series.slice(1) : [];

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
        {featuredSeries && (
          <FeaturedMovie
            movie={featuredSeries}
            onPress={() => handleSeriesPress(featuredSeries)}
          />
        )}

        {/* Movies List */}
        <View style={styles.moviesSection}>
          <Text style={styles.sectionTitle}>More Series</Text>
          <View style={styles.moviesGrid}>
            {otherSeries.map((series) => (
              <MovieCard
                key={series.id}
                movie={series}
                onPress={() => handleSeriesPress(series)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
