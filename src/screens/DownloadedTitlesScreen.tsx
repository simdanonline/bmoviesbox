import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import { useDownloads } from "../context/DownloadContext";
import { DownloadRecord } from "../services/DownloadManager";
import { getOriginalLanguage } from "../services/tmdb";
import { styles } from "../styles/styles";
import Focusable from "../components/Focusable";

type SortOrder = "newest" | "largest" | "title";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function formatDate(ts?: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DownloadedTitlesScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const downloads = useDownloads();
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const completed = useMemo(
    () => downloads.records.filter((r) => r.status === "completed"),
    [downloads.records],
  );

  const sorted = useMemo(() => {
    const arr = [...completed];
    switch (sortOrder) {
      case "largest":
        arr.sort((a, b) => b.sizeBytes - a.sizeBytes);
        break;
      case "title":
        arr.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
      default:
        arr.sort((a, b) => (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0));
    }
    return arr;
  }, [completed, sortOrder]);

  const handlePlay = async (r: DownloadRecord) => {
    const originalLanguage = await getOriginalLanguage(
      r.tmdbId,
      r.kind === "episode" ? "series" : "movie",
    );
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
      originalLanguage: originalLanguage ?? undefined,
    });
  };

  const handleDelete = (r: DownloadRecord) => {
    Alert.alert(
      "Delete download",
      `Remove "${r.title}${r.kind === "episode" ? ` · S${r.season}E${r.episode}` : ""}" (${formatBytes(r.sizeBytes)}) from device?`,
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, dlStyles.headerRow]}>
        <Text style={styles.headerTitle}>Downloads</Text>
        <Text style={dlStyles.totalText}>
          {sorted.length} · {formatBytes(downloads.storageUsedBytes)}
        </Text>
      </View>

      {/* Sort row */}
      <View style={dlStyles.sortRow}>
        <Text style={dlStyles.sortLabel}>Sort:</Text>
        {(["newest", "largest", "title"] as SortOrder[]).map((opt) => (
          <Focusable
            key={opt}
            onPress={() => setSortOrder(opt)}
            style={dlStyles.sortChip}
            focusedStyle={dlStyles.sortChipFocused}
          >
            <Text
              style={[
                dlStyles.sortChipText,
                sortOrder === opt && dlStyles.sortChipTextActive,
              ]}
            >
              {opt === "newest"
                ? "Newest"
                : opt === "largest"
                  ? "Largest"
                  : "Title"}
            </Text>
          </Focusable>
        ))}
      </View>

      {sorted.length === 0 ? (
        <View style={dlStyles.empty}>
          <FontAwesome name="cloud-download" size={56} color="#333" />
          <Text style={dlStyles.emptyText}>No downloads yet</Text>
          <Text style={dlStyles.emptySubText}>
            Tap Download on any movie or episode to save it offline.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={dlStyles.list}>
          {sorted.map((r) => {
            const subtitle =
              r.kind === "episode"
                ? `S${r.season}E${r.episode} · ${r.quality}`
                : r.quality;
            return (
              <View key={r.id} style={dlStyles.row}>
                <Focusable
                  style={dlStyles.rowMain}
                  focusedStyle={dlStyles.rowMainFocused}
                  onPress={() => handlePlay(r)}
                >
                  <View style={dlStyles.thumbBox}>
                    <FontAwesome name="play" size={14} color="#fff" />
                  </View>
                  <View style={dlStyles.rowText}>
                    <Text style={dlStyles.rowTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={dlStyles.rowMeta} numberOfLines={1}>
                      {subtitle}
                    </Text>
                    <Text style={dlStyles.rowMetaSecondary} numberOfLines={1}>
                      {formatBytes(r.sizeBytes)} · saved {formatDate(r.downloadedAt)}
                      {r.lastPlayedAt
                        ? ` · last played ${formatDate(r.lastPlayedAt)}`
                        : ""}
                    </Text>
                  </View>
                </Focusable>
                <Focusable
                  onPress={() => handleDelete(r)}
                  style={dlStyles.deleteButton}
                  focusedStyle={dlStyles.deleteButtonFocused}
                >
                  <FontAwesome name="trash" size={16} color="#fff" />
                </Focusable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const dlStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalText: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  sortLabel: { color: "#666", fontSize: 13 },
  sortChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  sortChipFocused: { borderColor: "#e74c3c" },
  sortChipText: { color: "#666", fontSize: 13 },
  sortChipTextActive: { color: "#e74c3c", fontWeight: "600" },
  empty: {
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
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    gap: 8,
    padding: 12,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  rowMainFocused: { borderColor: "#fff" },
  thumbBox: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: "#e74c3c",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  rowMeta: { color: "#aaa", fontSize: 12 },
  rowMetaSecondary: { color: "#666", fontSize: 11 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  deleteButtonFocused: { borderColor: "#e74c3c" },
});
