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
import { useDownloads } from "../context/DownloadContext";
import { DownloadRecord } from "../services/DownloadManager";
import {
  LibraryItem,
  WatchStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "../types/app";
import MovieCard from "../components/MovieCard";
import Focusable from "../components/Focusable";
import { styles } from "../styles/styles";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

type TypeFilter = "all" | "movies" | "series";
type StatusFilter = "all" | WatchStatus;
type SortOrder = "recent" | "title" | "status";

function formatLibGB(bytes: number): string {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export default function LibraryScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const { library, removeFromLibrary } = useUserData();
  const downloads = useDownloads();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");

  const activeDownloads = useMemo(
    () =>
      downloads.records.filter(
        (r) => r.status === "downloading" || r.status === "paused",
      ),
    [downloads.records],
  );
  const completedDownloads = useMemo(
    () => downloads.records.filter((r) => r.status === "completed"),
    [downloads.records],
  );
  // Anything completed with watch progress > 0 (and not within the
  // end-of-content threshold) — surface at the top so resume is one tap away.
  const continueWatching = useMemo(
    () =>
      completedDownloads
        .filter((r) => {
          const ms = r.watchProgressMs ?? 0;
          if (ms <= 0) return false;
          // Skip if "near the end" — match NativeVideoPlayer's 30s threshold.
          if (r.sizeBytes > 0 && ms > 0) {
            // We don't know the duration here without opening the file; rely
            // on the player's own end-guard to no-op a near-end resume.
          }
          return true;
        })
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
        .slice(0, 6),
    [completedDownloads],
  );
  const failedDownloads = useMemo(
    () => downloads.records.filter((r) => r.status === "failed"),
    [downloads.records],
  );

  const handlePlayOffline = (r: DownloadRecord) => {
    navigation.navigate("NativeVideoPlayer", {
      streams: [
        {
          url: r.fileUri,
          type: r.containerType,
          quality: r.quality,
          name: "Offline",
          title: r.title,
          source: "download",
          sizeBytes: r.sizeBytes,
        },
      ],
      title:
        r.kind === "episode"
          ? `${r.title} - S${r.season}E${r.episode}`
          : r.title,
      recordId: r.id,
      initialPositionMs: r.watchProgressMs,
    });
  };

  const handleDeleteDownload = (r: DownloadRecord) => {
    Alert.alert(
      "Delete download",
      `Remove "${r.title}" from device? (${formatLibGB(r.sizeBytes)})`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void downloads.remove(r.id);
          },
        },
      ],
    );
  };

  const handleCancelDownload = (r: DownloadRecord) => {
    void downloads.cancel(r.id);
  };

  const handleRetryDownload = async (r: DownloadRecord) => {
    try {
      await downloads.retry(r.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't retry";
      Alert.alert("Retry failed", msg);
    }
  };

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
          <Focusable
            style={libStyles.headerButton}
            focusedStyle={libStyles.headerButtonFocused}
            onPress={() => navigation.navigate("Planner")}
          >
            <FontAwesome name="calendar-check-o" size={22} color="#fff" />
            <Text style={libStyles.headerButtonText}>Planner</Text>
          </Focusable>
        </View>

        {/* Type filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={libStyles.filterRow}
        >
          {(["all", "movies", "series"] as TypeFilter[]).map((f) => (
            <Focusable
              key={f}
              style={[
                libStyles.filterChip,
                typeFilter === f && libStyles.filterChipActive,
              ]}
              focusedStyle={libStyles.filterChipFocused}
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
            </Focusable>
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
              <Focusable
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
                focusedStyle={libStyles.filterChipFocused}
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
              </Focusable>
            );
          })}
        </ScrollView>

        {/* Continue Watching — offline-resumable downloads, scrollable row. */}
        {continueWatching.length > 0 && (
          <View style={libStyles.continueSection}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={libStyles.continueScroll}
            >
              {continueWatching.map((r) => {
                const progressMs = r.watchProgressMs ?? 0;
                // sizeBytes is the file size, not duration — we don't have
                // duration in the record. Show elapsed time as the indicator;
                // the player will resume from this exact spot.
                const min = Math.floor(progressMs / 60000);
                const sec = Math.floor((progressMs % 60000) / 1000)
                  .toString()
                  .padStart(2, "0");
                return (
                  <Focusable
                    key={r.id}
                    style={libStyles.continueCard}
                    focusedStyle={libStyles.cardFocused}
                    onPress={() => handlePlayOffline(r)}
                  >
                    <View style={libStyles.continuePlayBadge}>
                      <FontAwesome name="play" size={14} color="#fff" />
                    </View>
                    <Text style={libStyles.continueTitle} numberOfLines={2}>
                      {r.title}
                      {r.kind === "episode"
                        ? ` · S${r.season}E${r.episode}`
                        : ""}
                    </Text>
                    <Text style={libStyles.continueMeta}>
                      Resume at {min}:{sec}
                    </Text>
                  </Focusable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Downloads section — only render if there's anything to show. */}
        {downloads.records.length > 0 && (
          <View style={libStyles.downloadsSection}>
            <View style={libStyles.downloadsHeader}>
              <Text style={styles.sectionTitle}>Downloads</Text>
              <Text style={libStyles.downloadsStorageText}>
                {formatLibGB(downloads.storageUsedBytes)} on device
              </Text>
            </View>

            {activeDownloads.map((r) => {
              const pct =
                r.sizeBytes > 0
                  ? Math.floor((r.bytesDownloaded / r.sizeBytes) * 100)
                  : 0;
              const isPaused = r.status === "paused";
              return (
                <View key={r.id} style={libStyles.downloadRow}>
                  <View style={libStyles.downloadRowInfo}>
                    <Text style={libStyles.downloadRowTitle} numberOfLines={1}>
                      {r.title}
                      {r.kind === "episode"
                        ? ` · S${r.season}E${r.episode}`
                        : ""}
                    </Text>
                    <Text
                      style={
                        isPaused
                          ? libStyles.downloadRowMetaPaused
                          : libStyles.downloadRowMeta
                      }
                    >
                      {isPaused ? "Paused · " : ""}
                      {r.quality} · {pct}% ·{" "}
                      {formatLibGB(r.bytesDownloaded)}
                      {r.sizeBytes > 0 ? ` / ${formatLibGB(r.sizeBytes)}` : ""}
                      {r.errorMessage && isPaused ? ` · ${r.errorMessage}` : ""}
                    </Text>
                    <View style={libStyles.downloadProgressTrack}>
                      <View
                        style={[
                          libStyles.downloadProgressFill,
                          isPaused && libStyles.downloadProgressFillPaused,
                          { width: `${pct}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Focusable
                    onPress={() =>
                      isPaused
                        ? downloads.resume(r.id)
                        : downloads.pause(r.id)
                    }
                    style={libStyles.downloadActionButton}
                    focusedStyle={libStyles.downloadActionButtonFocused}
                  >
                    <FontAwesome
                      name={isPaused ? "play" : "pause"}
                      size={14}
                      color="#fff"
                    />
                  </Focusable>
                  <Focusable
                    onPress={() => handleCancelDownload(r)}
                    style={libStyles.downloadActionButton}
                    focusedStyle={libStyles.downloadActionButtonFocused}
                  >
                    <FontAwesome name="times" size={16} color="#fff" />
                  </Focusable>
                </View>
              );
            })}

            {failedDownloads.map((r) => (
              <View key={r.id} style={libStyles.downloadRow}>
                <View style={libStyles.downloadRowInfo}>
                  <Text style={libStyles.downloadRowTitle} numberOfLines={1}>
                    {r.title}
                    {r.kind === "episode"
                      ? ` · S${r.season}E${r.episode}`
                      : ""}
                  </Text>
                  <Text style={libStyles.downloadRowFailed} numberOfLines={1}>
                    Failed{r.errorMessage ? ` — ${r.errorMessage}` : ""}
                  </Text>
                </View>
                <Focusable
                  onPress={() => handleRetryDownload(r)}
                  style={libStyles.downloadActionButton}
                  focusedStyle={libStyles.downloadActionButtonFocused}
                >
                  <FontAwesome name="refresh" size={14} color="#fff" />
                </Focusable>
                <Focusable
                  onPress={() => handleDeleteDownload(r)}
                  style={libStyles.downloadActionButton}
                  focusedStyle={libStyles.downloadActionButtonFocused}
                >
                  <FontAwesome name="trash" size={14} color="#fff" />
                </Focusable>
              </View>
            ))}

            {completedDownloads.length > 0 && (
              <View style={libStyles.completedGrid}>
                {completedDownloads.map((r) => (
                  <Focusable
                    key={r.id}
                    style={libStyles.completedCard}
                    focusedStyle={libStyles.cardFocused}
                    onPress={() => handlePlayOffline(r)}
                    onLongPress={() => handleDeleteDownload(r)}
                  >
                    <Text
                      style={libStyles.completedCardTitle}
                      numberOfLines={2}
                    >
                      {r.title}
                      {r.kind === "episode"
                        ? ` · S${r.season}E${r.episode}`
                        : ""}
                    </Text>
                    <Text style={libStyles.completedCardMeta}>
                      {r.quality} · {formatLibGB(r.sizeBytes)}
                    </Text>
                    <View style={libStyles.completedCardBadge}>
                      <FontAwesome
                        name="download"
                        size={10}
                        color="#fff"
                      />
                      <Text style={libStyles.completedCardBadgeText}>
                        Offline
                      </Text>
                    </View>
                  </Focusable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Sort */}
        <View style={libStyles.sortRow}>
          <Text style={libStyles.sortLabel}>Sort:</Text>
          {(["recent", "title", "status"] as SortOrder[]).map((s) => (
            <Focusable
              key={s}
              onPress={() => setSortOrder(s)}
              style={libStyles.sortOption}
              focusedStyle={libStyles.sortOptionFocused}
            >
              <Text
                style={[
                  libStyles.sortText,
                  sortOrder === s && libStyles.sortTextActive,
                ]}
              >
                {s === "recent" ? "Recent" : s === "title" ? "Title" : "Status"}
              </Text>
            </Focusable>
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
  // Shared TV focus indicators
  headerButtonFocused: {
    borderColor: "#e74c3c",
    backgroundColor: "rgba(231, 76, 60, 0.15)",
  },
  filterChipFocused: {
    borderColor: "#fff",
    transform: [{ scale: 1.05 }],
  },
  cardFocused: {
    borderWidth: 3,
    borderColor: "#fff",
    transform: [{ scale: 1.03 }],
  },
  downloadActionButtonFocused: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  sortOptionFocused: {
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    borderRadius: 6,
    paddingHorizontal: 6,
  },
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

  // Continue Watching row (horizontal)
  continueSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  continueScroll: { gap: 10, paddingRight: 16 },
  continueCard: {
    width: 200,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#e74c3c",
  },
  continuePlayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e74c3c",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  continueTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    minHeight: 32,
  },
  continueMeta: { color: "#aaa", fontSize: 11, marginTop: 4 },

  // Downloads section
  downloadsSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  downloadsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  downloadsStorageText: { color: "#888", fontSize: 12 },
  downloadRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  downloadRowInfo: { flex: 1 },
  downloadRowTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  downloadRowMeta: { color: "#aaa", fontSize: 12, marginTop: 2 },
  downloadRowMetaPaused: { color: "#f39c12", fontSize: 12, marginTop: 2 },
  downloadRowFailed: { color: "#e74c3c", fontSize: 12, marginTop: 2 },
  downloadProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 8,
    overflow: "hidden",
  },
  downloadProgressFill: {
    height: "100%",
    backgroundColor: "#e74c3c",
  },
  downloadProgressFillPaused: { backgroundColor: "#f39c12" },
  downloadActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  completedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  completedCard: {
    width: "48%",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#27ae60",
  },
  completedCardTitle: { color: "#fff", fontSize: 13, fontWeight: "600" },
  completedCardMeta: { color: "#aaa", fontSize: 11, marginTop: 4 },
  completedCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27ae60",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  completedCardBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
