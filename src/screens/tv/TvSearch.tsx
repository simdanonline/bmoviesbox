import React from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { Movie } from "../../services/MovieAPI";

interface TvSearchProps {
  query: string;
  setQuery: (q: string) => void;
  inputRef: React.RefObject<TextInput>;
  activeTab: "movies" | "series";
  setActiveTab: (t: "movies" | "series") => void;
  movies: Movie[];
  series: Movie[];
  loading: boolean;
  searched: boolean;
  onMoviePress: (m: Movie) => void;
}

export default function TvSearch({
  query, setQuery, inputRef, activeTab, setActiveTab,
  movies, series, loading, searched, onMoviePress,
}: TvSearchProps) {
  const results = activeTab === "movies" ? movies : series;
  const showTabs = searched && !loading && (movies.length > 0 || series.length > 0);

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={22} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies & series"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      {showTabs && (
        <View style={styles.tabs}>
          {(["movies", "series"] as const).map((t) => {
            const active = activeTab === t;
            const count = t === "movies" ? movies.length : series.length;
            return (
              <Focusable
                key={t}
                style={[styles.tab, active && styles.tabActive]}
                focusedStyle={styles.tabFocused}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === "movies" ? "Movies" : "TV"} ({count})
                </Text>
              </Focusable>
            );
          })}
        </View>
      )}

      {loading && (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.accent} />
      )}

      {!loading && searched && results.length === 0 && (
        <Text style={styles.empty}>No results found</Text>
      )}

      {!loading && results.length > 0 && (
        <FlatList
          key={activeTab}
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={tvLayout.gridColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              onPress={() => onMoviePress(item)}
              style={styles.card}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: tvLayout.overscanH, paddingTop: tvLayout.overscanV },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    height: 64,
  },
  input: { ...tvType.body, color: colors.text, flex: 1, marginLeft: 14 },
  tabs: { flexDirection: "row", marginTop: 20 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  tabText: { ...tvType.meta, color: colors.textSecondary },
  tabTextActive: { color: colors.text },
  empty: { ...tvType.body, color: colors.textMuted, textAlign: "center", marginTop: 48 },
  grid: { paddingTop: 20, paddingBottom: tvLayout.overscanV * 2 },
  gridRow: { gap: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
  card: { width: tvLayout.railCardWidth },
});
