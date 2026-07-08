import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import TvSafeImage from "../../components/TvSafeImage";
import Focusable from "../../components/Focusable";
import TvActionButton from "../../components/tv/TvActionButton";
import RecommendationRail from "../../components/RecommendationRail";
import StatusSelector from "../../components/StatusSelector";
import StarRating from "../../components/StarRating";
import TitlePlanningPanel from "../../components/TitlePlanningPanel";
import { buildMetaPills } from "./detailMeta";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type {
  SeriesDetail,
  Movie,
  Season,
  Episode,
} from "../../services/MovieAPI";
import type { WatchStatus } from "../../types/app";

interface TvSeriesDetailProps {
  seriesData: SeriesDetail;
  relatedTitles: Movie[];
  seasons: Season[];
  selectedSeason: number;
  currentEpisodes: Episode[];
  gettingLinks: boolean;
  selectedEpisode: number | null;
  isSaved: boolean;
  currentStatus: WatchStatus | null;
  isEpisodeWatched: (episodeUrl: string) => boolean;
  onSelectSeason: (n: number) => void;
  onPlayEpisode: (ep: Episode) => void;
  onToggleWatchlist: () => void;
  onShare: () => void;
  onTrailer: () => void;
  onStatusSelect: (s: WatchStatus) => void;
  onRemoveStatus: () => void;
  getRating: (url: string) => number | null;
  setRating: (url: string, r: number) => void;
  onRelatedPress: (m: Movie) => void;
}

export default function TvSeriesDetail(props: TvSeriesDetailProps) {
  const {
    seriesData,
    relatedTitles,
    seasons,
    selectedSeason,
    currentEpisodes,
    gettingLinks,
    selectedEpisode,
    isSaved,
    currentStatus,
    isEpisodeWatched,
    onSelectSeason,
    onPlayEpisode,
    onToggleWatchlist,
    onShare,
    onTrailer,
    onStatusSelect,
    onRemoveStatus,
    getRating,
    setRating,
    onRelatedPress,
  } = props;

  const pills = buildMetaPills({
    releaseYear: seriesData.releaseYear,
    duration: seriesData.duration,
    rating: seriesData.ratings?.imdb ?? null,
    genres: seriesData.genres,
  });
  const cast = (seriesData.actors ?? []).slice(0, 6).join(", ");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroArt}>
          {!!seriesData.coverImage && (
            <TvSafeImage
              source={{ uri: seriesData.coverImage.trim() }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
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
            {seriesData.title}
          </Text>
          <View style={styles.pillRow}>
            {pills.map((p, i) => (
              <View key={`${p}-${i}`} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>
          {!!seriesData.description && (
            <Text style={styles.synopsis} numberOfLines={3}>
              {seriesData.description}
            </Text>
          )}
          <View style={styles.actionRow}>
            <TvActionButton
              icon={isSaved ? "bookmark" : "bookmark-o"}
              label={isSaved ? "Saved" : "Save"}
              primary
              hasTVPreferredFocus
              active={isSaved}
              onPress={onToggleWatchlist}
            />
            {!!seriesData.trailerUrl && (
              <TvActionButton icon="play-circle" label="Trailer" onPress={onTrailer} />
            )}
            <TvActionButton icon="share-alt" label="Share" onPress={onShare} />
          </View>
        </View>
      </View>

      {/* Season selector */}
      <View style={styles.railSection}>
        <Text style={styles.sectionTitle}>Seasons</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {seasons.map((s) => {
            const active = s.seasonNumber === selectedSeason;
            return (
              <Focusable
                key={s.seasonNumber}
                style={[styles.seasonChip, active && styles.seasonChipActive]}
                focusedStyle={styles.chipFocused}
                onPress={() => onSelectSeason(s.seasonNumber)}
              >
                <Text
                  style={[styles.seasonText, active && styles.seasonTextActive]}
                >
                  Season {s.seasonNumber}
                </Text>
              </Focusable>
            );
          })}
        </ScrollView>
      </View>

      {/* Episodes rail */}
      <View style={styles.railSection}>
        <Text style={styles.sectionTitle}>Episodes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {currentEpisodes.map((ep) => {
            const watched = isEpisodeWatched(ep.episodeUrl);
            const loading = gettingLinks && selectedEpisode === ep.episodeNumber;
            return (
              <Focusable
                key={ep.episodeNumber}
                style={styles.episodeCard}
                focusedStyle={styles.chipFocused}
                disabled={gettingLinks}
                onPress={() => onPlayEpisode(ep)}
              >
                <View style={styles.episodeTop}>
                  <Text style={styles.episodeNum}>E{ep.episodeNumber}</Text>
                  <FontAwesome
                    name={loading ? "spinner" : watched ? "check-circle" : "play"}
                    size={16}
                    color={watched ? colors.accent : colors.text}
                  />
                </View>
                <Text style={styles.episodeTitle} numberOfLines={2}>
                  {ep.episodeTitle}
                </Text>
              </Focusable>
            );
          })}
        </ScrollView>
      </View>

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
          rating={getRating(seriesData.url)}
          onRate={(r) => setRating(seriesData.url, r)}
        />
      </View>
      <View style={styles.section}>
        <TitlePlanningPanel
          titleUrl={seriesData.url}
          title={seriesData.title}
          isSeries={true}
          thumbnail={seriesData.thumbnail}
        />
      </View>
      {!!cast && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <Text style={styles.body}>{cast}</Text>
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
  hero: { height: tvLayout.heroHeight, flexDirection: "row" },
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
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: tvLayout.overscanV,
    justifyContent: "center",
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
  section: { paddingHorizontal: tvLayout.overscanH, paddingTop: 24 },
  railSection: { paddingTop: 28, paddingHorizontal: tvLayout.overscanH },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 12 },
  body: { ...tvType.body, color: colors.textSecondary },
  seasonChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  seasonChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  seasonText: { ...tvType.meta, color: colors.textSecondary },
  seasonTextActive: { color: colors.text },
  chipFocused: {
    borderColor: colors.text,
    transform: [{ scale: tvLayout.focusScale }],
  },
  episodeCard: {
    width: 260,
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 14,
  },
  episodeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  episodeNum: { ...tvType.meta, color: colors.accent },
  episodeTitle: { ...tvType.body, color: colors.text },
});
