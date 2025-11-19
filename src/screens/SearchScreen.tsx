import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MovieAPI, { Movie } from "../services/MovieAPI";
import MovieCard from "../components/MovieCard";
import { width, styles } from "../styles/styles";

type SearchScreenNavigationProp = NativeStackNavigationProp<any>;

const SearchScreen = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const search = async () => {
      try {
        if (query.length > 2) {
          setLoading(true);
          setSearched(true);
          const response = await MovieAPI.searchMovies(query);
          setResults([...response.results, ...response.series]);
          setLoading(false);
        } else {
          setResults([]);
          if (query.length === 0) {
            setSearched(false);
          }
        }
      } catch (error) {
        setLoading(false);
      }
    };

    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleMoviePress = (movie: Movie) => {
    // Extract slug from URL
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    if(movie.isSeries) {
      navigation.navigate("SeriesDetails", { url: movie.url });
      return;
    }
    navigation.navigate("MovieDetails", { slug, movie });
  };

  return (
    <View style={localStyles.container}>
      {/* Search Header */}
      <View style={localStyles.searchHeader}>
        <TextInput
          style={localStyles.searchInput}
          onChangeText={setQuery}
          value={query}
          placeholder="Search for movies..."
          placeholderTextColor="#666"
        />
      </View>

      {/* No search yet */}
      {!searched && (
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>🔍 Search for movies</Text>
          <Text style={localStyles.emptySubText}>
            Type at least 3 characters to search
          </Text>
        </View>
      )}

      {/* Loading state */}
      {loading && (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={localStyles.loadingText}>Searching...</Text>
        </View>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>😔 No results found</Text>
          <Text style={localStyles.emptySubText}>
            Try searching with different keywords
          </Text>
        </View>
      )}

      {!loading && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          numColumns={Platform.OS === "web" ? 4 : 2}
          columnWrapperStyle={localStyles.columnWrapper}
          contentContainerStyle={localStyles.listContent}
          renderItem={({ item }) => (
            <MovieCard movie={item} onPress={() => handleMoviePress(item)} />
          )}
          scrollEnabled={true}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  searchHeader: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  searchInput: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginBottom: 16,
    gap: 10,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubText: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
});

export default SearchScreen;
