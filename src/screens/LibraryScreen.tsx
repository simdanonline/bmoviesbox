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
import { useUserData } from "../context/UserDataContext";
import {
  LibraryItem,
  WatchStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "../types/app";
import MovieCard from "../components/MovieCard";
import { styles } from "../styles/styles";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

type TypeFilter = "all" | "movies" | "series";
type StatusFilter = "all" | WatchStatus;
type SortOrder = "recent" | "title" | "status";

export default function LibraryScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const { library, removeFromLibrary } = useUserData();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  const filteredItems = useMemo(() => {
    let items = [...library];

    if (typeFilter === "movies") items = items.filter((i) => !i.isSeries);
    if (typeFilter === "series") items = items.filter((i) => i.isSeries);
    if (statusFilter !== "all")
      items = items.filter((i) => i.status === statusFilter);

    switch (sortOrder) {
      case "title":
        items.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "status":
        items.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "recent":
      default:
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
    }

    return items;
  }, [library, typeFilter, statusFilter, sortOrder]);

  const handlePress = (item: LibraryItem) => {
    if (item.isSeries) {
      navigation.navigate("SeriesDetails", { url: item.url });
    } else {
      const urlParts = item.url.split("/").filter(Boolean);
      const slug = urlParts[urlParts.length - 1];
      navigation.navigate("MovieDetails", { slug, movie: item });
    }
  };

  const handleLongPress = (item: LibraryItem) => {
    Alert.alert(
      "Remove from Library",
      `Remove "${item.title}" from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeFromLibrary(item.url),
        },
      ],
    );
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: library.length };
    for (const item of library) {
      counts[item.status] = (counts[item.status] || 0) + 1;
    }
    return counts;
  }, [library]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, styles.row]}>
          <Text style={styles.headerTitle}>Library</Text>
          <TouchableOpacity
            style={libStyles.headerButton}
            onPress={() => navigation.navigate("Planner")}
            activeOpacity={0.7}
          >
            <FontAwesome name="calendar-check-o" size={22} color="#fff" />
            <Text style={libStyles.headerButtonText}>Planner</Text>
          </TouchableOpacity>
        </View>

        {/* Type filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={libStyles.filterRow}
        >
          {(["all", "movies", "series"] as TypeFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                libStyles.filterChip,
                typeFilter === f && libStyles.filterChipActive,
              ]}
              onPress={() => setTypeFilter(f)}
            >
              <Text
                style={[
                  libStyles.filterText,
                  typeFilter === f && libStyles.filterTextActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Status filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={libStyles.filterRow}
        >
          {(
            [
              "all",
              "want_to_watch",
              "watching",
              "completed",
              "dropped",
            ] as StatusFilter[]
          ).map((s) => {
            const isActive = statusFilter === s;
            const label = s === "all" ? "All" : STATUS_LABELS[s as WatchStatus];
            const count = statusCounts[s] || 0;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  libStyles.statusChip,
                  isActive && {
                    backgroundColor:
                      s === "all" ? "#e74c3c" : STATUS_COLORS[s as WatchStatus],
                    borderColor:
                      s === "all" ? "#e74c3c" : STATUS_COLORS[s as WatchStatus],
                  },
                ]}
                onPress={() => setStatusFilter(s)}
              >
                <Text
                  style={[
                    libStyles.filterText,
                    isActive && libStyles.filterTextActive,
                  ]}
                >
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort */}
        <View style={libStyles.sortRow}>
          <Text style={libStyles.sortLabel}>Sort:</Text>
          {(["recent", "title", "status"] as SortOrder[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortOrder(s)}
              style={libStyles.sortOption}
            >
              <Text
                style={[
                  libStyles.sortText,
                  sortOrder === s && libStyles.sortTextActive,
                ]}
              >
                {s === "recent" ? "Recent" : s === "title" ? "Title" : "Status"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredItems.length === 0 ? (
          <View style={libStyles.emptyContainer}>
            <FontAwesome name="folder-open-o" size={56} color="#333" />
            <Text style={libStyles.emptyText}>Your library is empty</Text>
            <Text style={libStyles.emptySubText}>
              Browse movies and series, then use the status selector to add them
              to your library. Track what you want to watch, what you're
              watching, and what you've completed.
            </Text>
          </View>
        ) : (
          <View style={styles.moviesSection}>
            <Text style={styles.sectionTitle}>
              {filteredItems.length} title
              {filteredItems.length !== 1 ? "s" : ""}
            </Text>
            <View style={styles.moviesGrid}>
              {filteredItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.url + idx}
                  onLongPress={() => handleLongPress(item)}
                  activeOpacity={0.7}
                  style={{ width: "48%" }}
                >
                  <View>
                    <MovieCard
                      movie={item as any}
                      onPress={() => handlePress(item)}
                      style={{ width: "100%" }}
                    />
                    {/* Status badge */}
                    <View
                      style={[
                        libStyles.statusBadge,
                        { backgroundColor: STATUS_COLORS[item.status] },
                      ]}
                    >
                      <Text style={libStyles.statusBadgeText}>
                        {STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                    {/* Progress for series */}
                    {item.isSeries && item.completedEpisodes > 0 && (
                      <View style={libStyles.progressBadge}>
                        <Text style={libStyles.progressBadgeText}>
                          {item.completedEpisodes}
                          {item.totalEpisodes
                            ? `/${item.totalEpisodes}`
                            : ""}{" "}
                          ep
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const libStyles = StyleSheet.create({
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    marginTop: 4,
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
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  filterText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  sortLabel: {
    color: "#666",
    fontSize: 13,
  },
  sortOption: {
    paddingVertical: 4,
  },
  sortText: {
    color: "#666",
    fontSize: 13,
  },
  sortTextActive: {
    color: "#e74c3c",
    fontWeight: "600",
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
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  progressBadge: {
    position: "absolute",
    bottom: 50,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBadgeText: {
    color: "#e74c3c",
    fontSize: 10,
    fontWeight: "600",
  },
});
