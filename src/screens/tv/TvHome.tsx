import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import FeaturedMovie from "../../components/FeaturedMovie";
import RecommendationRail from "../../components/RecommendationRail";
import ContinueWatchingSection from "../../components/ContinueWatchingCard";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import { colors } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { Movie } from "../../services/MovieAPI";
import type { LibraryItem } from "../../types/app";

interface TvHomeProps {
  featuredMovie: Movie | null;
  rails: { id: string; title: string; items: Movie[] }[];
  filteredMovies: Movie[];
  continueWatching: LibraryItem[];
  isTvApp: boolean;
  onLogoPress: () => void;
  onMoviePress: (m: Movie) => void;
  onContinuePress: (i: LibraryItem) => void;
  onSearch: () => void;
  onSettings: () => void;
}

export default function TvHome({
  featuredMovie,
  rails,
  filteredMovies,
  continueWatching,
  isTvApp,
  onLogoPress,
  onMoviePress,
  onContinuePress,
  onSearch,
  onSettings,
}: TvHomeProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Focusable
          style={styles.logoButton}
          focusedStyle={styles.logoFocused}
          hasTVPreferredFocus={!isTvApp}
          onPress={onLogoPress}
        >
          <Text style={styles.logo}>Reelmark</Text>
        </Focusable>
        <View style={styles.headerActions}>
          <Focusable style={styles.iconBtn} focusedStyle={styles.iconFocused} onPress={onSearch}>
            <FontAwesome name="search" size={22} color={colors.text} />
          </Focusable>
          <Focusable style={styles.iconBtn} focusedStyle={styles.iconFocused} onPress={onSettings}>
            <FontAwesome name="gear" size={22} color={colors.text} />
          </Focusable>
        </View>
      </View>

      {!!featuredMovie && (
        <FeaturedMovie movie={featuredMovie} onPress={() => onMoviePress(featuredMovie)} />
      )}

      {!isTvApp && (
        <ContinueWatchingSection items={continueWatching} onPress={onContinuePress} />
      )}

      {rails.map((rail) => (
        <RecommendationRail
          key={rail.id}
          title={rail.title}
          items={rail.items}
          onPress={onMoviePress}
        />
      ))}

      {filteredMovies.length > 0 && (
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>More Movies</Text>
          <View style={styles.grid}>
            {filteredMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onPress={() => onMoviePress(movie)}
                style={styles.gridCard}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const CARD_W = tvLayout.railCardWidth;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: tvLayout.overscanV * 2 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: tvLayout.overscanV,
    paddingBottom: 12,
  },
  logoButton: {
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  logoFocused: { borderColor: colors.text },
  logo: { ...tvType.heroTitle, color: colors.accent },
  headerActions: { flexDirection: "row" },
  iconBtn: {
    padding: 12,
    borderRadius: 999,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  gridSection: { paddingHorizontal: tvLayout.overscanH, paddingTop: 24 },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCard: { width: CARD_W, marginRight: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
});
