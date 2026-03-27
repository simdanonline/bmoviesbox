import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useUserData, SavedItem } from "../context/UserDataContext";
import MovieCard from "../components/MovieCard";
import { styles } from "../styles/styles";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

type FilterType = "all" | "movies" | "series";

export default function WatchlistScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const { watchlist, removeFromWatchlist } = useUserData();
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredItems = useMemo(() => {
    if (filter === "movies") return watchlist.filter((w) => !w.isSeries);
    if (filter === "series") return watchlist.filter((w) => w.isSeries);
    return watchlist;
  }, [watchlist, filter]);

  const handleItemPress = (item: SavedItem) => {
    if (item.isSeries) {
      navigation.navigate("SeriesDetails", { url: item.url });
    } else {
      const urlParts = item.url.split("/").filter(Boolean);
      const slug = urlParts[urlParts.length - 1];
      navigation.navigate("MovieDetails", { slug, movie: item });
    }
  };

  const handleLongPress = (item: SavedItem) => {
    Alert.alert(
      "Remove from Watchlist",
      `Remove "${item.title}" from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeFromWatchlist(item.url),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, styles.row]}>
          <Text style={styles.headerTitle}>Watchlist</Text>
        </View>

        {/* Filter Chips */}
        <View style={watchlistStyles.filterRow}>
          {(["all", "movies", "series"] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                watchlistStyles.filterChip,
                filter === f && watchlistStyles.filterChipActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  watchlistStyles.filterText,
                  filter === f && watchlistStyles.filterTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredItems.length === 0 ? (
          <View style={watchlistStyles.emptyContainer}>
            <FontAwesome name="bookmark-o" size={64} color="#333" />
            <Text style={watchlistStyles.emptyText}>No items saved yet</Text>
            <Text style={watchlistStyles.emptySubText}>
              Browse movies and series, then tap the bookmark icon to save them
              here.
            </Text>
          </View>
        ) : (
          <View style={styles.moviesSection}>
            <Text style={styles.sectionTitle}>
              {filteredItems.length} saved{" "}
              {filter === "all" ? "item" : filter.replace(/s$/, "")}
              {filteredItems.length !== 1 ? "s" : ""}
            </Text>
            <View style={styles.moviesGrid}>
              {filteredItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.id + idx}
                  onLongPress={() => handleLongPress(item)}
                  activeOpacity={0.7}
                  style={{ width: "48%" }}
                >
                  <MovieCard
                    movie={item as any}
                    onPress={() => handleItemPress(item)}
                    style={{ width: "100%" }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const watchlistStyles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  filterChipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  filterText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubText: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
