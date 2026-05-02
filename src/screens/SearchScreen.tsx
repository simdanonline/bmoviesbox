import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MovieAPI, { Movie } from "../services/MovieAPI";
import MovieCard from "../components/MovieCard";

type SearchScreenNavigationProp = NativeStackNavigationProp<any>;
type Tab = "movies" | "series";

const SearchScreen = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [series, setSeries] = useState<Movie[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("movies");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const search = async () => {
      try {
        if (query.length > 2) {
          setLoading(true);
          setSearched(true);
          const response = await MovieAPI.searchMovies(query);
          if (cancelled) return;

          const nextMovies = response.results ?? [];
          const nextSeries = response.series ?? [];
          setMovies(nextMovies);
          setSeries(nextSeries);

          // If the user's current tab has no results but the other does,
          // switch to the populated tab so they see something useful.
          setActiveTab((prev) => {
            const prevHas = prev === "movies" ? nextMovies.length : nextSeries.length;
            if (prevHas > 0) return prev;
            if (nextMovies.length > 0) return "movies";
            if (nextSeries.length > 0) return "series";
            return prev;
          });
        } else {
          setMovies([]);
          setSeries([]);
          if (query.length === 0) setSearched(false);
        }
      } catch {
        // swallow — UI shows empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(search, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleMoviePress = (movie: Movie) => {
    if (movie.isSeries) {
      navigation.navigate("SeriesDetails", { url: movie.url });
      return;
    }
    const urlParts = movie.url.split("/").filter(Boolean);
    const slug = urlParts[urlParts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie });
  };

  const activeResults = activeTab === "movies" ? movies : series;
  const showTabs = searched && !loading && (movies.length > 0 || series.length > 0);

  return (
    <View style={localStyles.container}>
      <View style={localStyles.searchHeader}>
        <TextInput
          style={localStyles.searchInput}
          onChangeText={setQuery}
          value={query}
          placeholder="Search for movies, series..."
          placeholderTextColor="#666"
        />
      </View>

      {showTabs && (
        <View style={localStyles.tabRow}>
          <TabButton
            label="Movies"
            count={movies.length}
            active={activeTab === "movies"}
            onPress={() => setActiveTab("movies")}
          />
          <TabButton
            label="TV"
            count={series.length}
            active={activeTab === "series"}
            onPress={() => setActiveTab("series")}
          />
        </View>
      )}

      {!searched && (
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>🔍 Search for movies</Text>
          <Text style={localStyles.emptySubText}>
            Type at least 3 characters to search
          </Text>
        </View>
      )}

      {loading && (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={localStyles.loadingText}>Searching...</Text>
        </View>
      )}

      {!loading && searched && activeResults.length === 0 && (
        <View style={localStyles.emptyContainer}>
          <Text style={localStyles.emptyText}>😔 No results found</Text>
          <Text style={localStyles.emptySubText}>
            {activeTab === "movies"
              ? series.length > 0
                ? `Try the TV tab — ${series.length} match${series.length === 1 ? "" : "es"}`
                : "Try searching with different keywords"
              : movies.length > 0
                ? `Try the Movies tab — ${movies.length} match${movies.length === 1 ? "" : "es"}`
                : "Try searching with different keywords"}
          </Text>
        </View>
      )}

      {!loading && activeResults.length > 0 && (
        <FlatList
          key={activeTab}
          data={activeResults}
          keyExtractor={(item) => `${activeTab}-${item.id}`}
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

interface TabButtonProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  count,
  active,
  onPress,
}) => (
  <TouchableOpacity
    style={[localStyles.tab, active && localStyles.tabActive]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[localStyles.tabLabel, active && localStyles.tabLabelActive]}>
      {label}
    </Text>
    <View
      style={[
        localStyles.tabCountBadge,
        active && localStyles.tabCountBadgeActive,
      ]}
    >
      <Text
        style={[
          localStyles.tabCountText,
          active && localStyles.tabCountTextActive,
        ]}
      >
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

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
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  tabActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  tabLabel: {
    color: "#bbb",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: "#fff",
  },
  tabCountBadge: {
    marginLeft: 8,
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 22,
    alignItems: "center",
  },
  tabCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabCountText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "700",
  },
  tabCountTextActive: {
    color: "#fff",
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
