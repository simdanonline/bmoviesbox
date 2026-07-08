import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import TvSafeImage from "../../components/TvSafeImage";
import TvActionButton from "../../components/tv/TvActionButton";
import RecommendationRail from "../../components/RecommendationRail";
import StatusSelector from "../../components/StatusSelector";
import StarRating from "../../components/StarRating";
import TitlePlanningPanel from "../../components/TitlePlanningPanel";
import { buildMetaPills } from "./detailMeta";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { MovieDetail, Movie } from "../../services/MovieAPI";
import type { WatchStatus } from "../../types/app";

interface TvMovieDetailsProps {
  movieDetails: MovieDetail;
  relatedTitles: Movie[];
  resolvingStreams: boolean;
  isTvApp: boolean;
  isSaved: boolean;
  currentStatus: WatchStatus | null;
  onPlay: () => void;
  onToggleWatchlist: () => void;
  onTrailer: () => void;
  onStatusSelect: (s: WatchStatus) => void;
  onRemoveStatus: () => void;
  getRating: (url: string) => number | null;
  setRating: (url: string, r: number) => void;
  onRelatedPress: (m: Movie) => void;
}

export default function TvMovieDetails({
  movieDetails,
  relatedTitles,
  resolvingStreams,
  isTvApp,
  isSaved,
  currentStatus,
  onPlay,
  onToggleWatchlist,
  onTrailer,
  onStatusSelect,
  onRemoveStatus,
  getRating,
  setRating,
  onRelatedPress,
}: TvMovieDetailsProps) {
  const pills = buildMetaPills({
    releaseYear: movieDetails.releaseYear,
    duration: movieDetails.duration,
    rating: movieDetails.ratings?.imdb ?? null,
    genres: movieDetails.genres,
  });
  const cast = (movieDetails.actors ?? []).slice(0, 6).join(", ");
  const directors = (movieDetails.directors ?? []).join(", ");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero: info-left / art-right */}
      <View style={styles.hero}>
        <View style={styles.heroArt}>
          {!!movieDetails.coverImage && (
            <TvSafeImage
              source={{ uri: movieDetails.coverImage.trim() }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          {/* Feather art into bg toward the left info column and along the bottom. */}
          <LinearGradient
            colors={[colors.bg, "rgba(10,10,14,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(10,10,14,0)", colors.bg]}
            style={styles.heroArtBottom}
            pointerEvents="none"
          />
        </View>

        <View style={styles.heroInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {movieDetails.title}
          </Text>

          <View style={styles.pillRow}>
            {pills.map((p, i) => (
              <View key={`${p}-${i}`} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>

          {!!movieDetails.description && (
            <Text style={styles.synopsis} numberOfLines={3}>
              {movieDetails.description}
            </Text>
          )}

          <View style={styles.actionRow}>
            {isTvApp && (
              <TvActionButton
                icon="play"
                label="Play"
                primary
                hasTVPreferredFocus
                loading={resolvingStreams}
                onPress={onPlay}
              />
            )}
            <TvActionButton
              icon={isSaved ? "bookmark" : "bookmark-o"}
              label={isSaved ? "Saved" : "Save"}
              active={isSaved}
              onPress={onToggleWatchlist}
            />
            <TvActionButton icon="play-circle" label="Trailer" onPress={onTrailer} />
          </View>
        </View>
      </View>

      {/* Secondary info + tracking */}
      <View style={styles.section}>
        <StatusSelector
          currentStatus={currentStatus}
          onSelect={onStatusSelect}
          onRemove={onRemoveStatus}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Rating</Text>
        <StarRating
          rating={getRating(movieDetails.url)}
          onRate={(r) => setRating(movieDetails.url, r)}
        />
      </View>

      <View style={styles.section}>
        <TitlePlanningPanel
          titleUrl={movieDetails.url}
          title={movieDetails.title}
          isSeries={false}
          thumbnail={movieDetails.thumbnail}
        />
      </View>

      {!!cast && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <Text style={styles.body}>{cast}</Text>
        </View>
      )}
      {!!directors && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Director</Text>
          <Text style={styles.body}>{directors}</Text>
        </View>
      )}

      {relatedTitles.length > 0 && (
        <View style={styles.railSection}>
          <RecommendationRail
            title="More Like This"
            items={relatedTitles}
            onPress={onRelatedPress}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: tvLayout.overscanV * 2 },
  hero: { minHeight: tvLayout.heroHeight, flexDirection: "row" },
  heroArt: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: tvLayout.heroArtWidth,
    backgroundColor: colors.surface,
  },
  heroArtBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  heroInfo: {
    width: tvLayout.heroInfoWidth,
    paddingLeft: tvLayout.overscanH,
    paddingRight: tvLayout.overscanH,
    // Clear the stack nav header (~56px) and anchor content from the top so a
    // 2-line title never rides under the header or overflows the hero.
    paddingTop: tvLayout.overscanV + 56,
    justifyContent: "flex-start",
  },
  title: { ...tvType.heroTitle, color: colors.text, marginBottom: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
    marginBottom: 8,
  },
  pillText: { ...tvType.caption, color: colors.textSecondary },
  synopsis: { ...tvType.body, color: colors.textSecondary, marginBottom: 24 },
  actionRow: { flexDirection: "row", flexWrap: "wrap" },
  section: {
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: 24,
  },
  railSection: { paddingTop: 28, paddingLeft: tvLayout.overscanH - 8 },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 12 },
  body: { ...tvType.body, color: colors.textSecondary },
});
