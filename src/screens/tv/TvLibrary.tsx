import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import UpcomingReleases from "../../components/UpcomingReleases";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import { STATUS_LABELS, STATUS_COLORS } from "../../types/app";
import type { LibraryItem } from "../../types/app";

interface TvLibraryProps {
  viewMode: "library" | "upcoming";
  setViewMode: (v: "library" | "upcoming") => void;
  filteredItems: LibraryItem[];
  onItemPress: (item: LibraryItem) => void;
}

const SEGMENTS = [
  { key: "library", label: "Watchlist" },
  { key: "upcoming", label: "Upcoming" },
] as const;

export default function TvLibrary({
  viewMode, setViewMode, filteredItems, onItemPress,
}: TvLibraryProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      <View style={styles.segments}>
        {SEGMENTS.map((seg) => {
          const active = viewMode === seg.key;
          return (
            <Focusable
              key={seg.key}
              style={[styles.segment, active && styles.segmentActive]}
              focusedStyle={styles.segFocused}
              onPress={() => setViewMode(seg.key)}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {seg.label}
              </Text>
            </Focusable>
          );
        })}
      </View>

      {viewMode === "upcoming" ? (
        <View style={styles.upcoming}>
          <UpcomingReleases />
        </View>
      ) : filteredItems.length === 0 ? (
        <Text style={styles.empty}>Your watchlist is empty</Text>
      ) : (
        <View style={styles.grid}>
          {filteredItems.map((item) => (
            <View key={item.url} style={styles.cell}>
              <MovieCard
                movie={item as any}
                onPress={() => onItemPress(item)}
                style={styles.card}
              />
              {!!item.status && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: tvLayout.overscanH, paddingTop: tvLayout.overscanV, paddingBottom: tvLayout.overscanV * 2 },
  header: { marginBottom: 16 },
  title: { ...tvType.heroTitle, color: colors.text },
  segments: { flexDirection: "row", marginBottom: 24 },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  segText: { ...tvType.meta, color: colors.textSecondary },
  segTextActive: { color: colors.text },
  empty: { ...tvType.body, color: colors.textMuted, textAlign: "center", marginTop: 48 },
  upcoming: {},
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { marginRight: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
  card: { width: tvLayout.railCardWidth },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  badgeText: { ...tvType.caption, color: colors.text },
});
