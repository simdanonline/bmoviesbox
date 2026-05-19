import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import { useUserData } from "../context/UserDataContext";
import { LibraryItem, WatchPlanItem, WatchPlanStatus } from "../types/app";
import { styles } from "../styles/styles";
import MovieAPI, { Movie } from "../services/MovieAPI";

type PlannerFilter = WatchPlanStatus;

function createTonightDate(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(20, 0, 0, 0);
  if (date.getTime() < Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString();
}

function formatPlanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function planSort(a: WatchPlanItem, b: WatchPlanItem): number {
  return new Date(a.plannedFor).getTime() - new Date(b.plannedFor).getTime();
}

function getSlugFromUrl(value: string): string {
  const urlParts = value.split("/").filter(Boolean);
  return urlParts[urlParts.length - 1];
}

function isMovieDetailsSlug(value: string | null | undefined): value is string {
  return !!value && /^\d+$/.test(value);
}

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

export default function PlannerScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const {
    watchPlans,
    titleNotes,
    library,
    addWatchPlan,
    updateWatchPlan,
    removeWatchPlan,
  } = useUserData();
  const [filter, setFilter] = useState<PlannerFilter>("planned");
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [resolvingPlanId, setResolvingPlanId] = useState<string | null>(null);

  const upcomingCount = useMemo(
    () => watchPlans.filter((plan) => plan.status === "planned").length,
    [watchPlans],
  );
  const doneCount = useMemo(
    () => watchPlans.filter((plan) => plan.status === "done").length,
    [watchPlans],
  );
  const noteCount = Object.keys(titleNotes).length;

  const filteredPlans = useMemo(
    () =>
      watchPlans
        .filter((plan) => plan.status === filter)
        .sort(
          filter === "planned" ? planSort : (a, b) => b.updatedAt - a.updatedAt,
        ),
    [watchPlans, filter],
  );

  const suggestionPool = useMemo(() => {
    const plannedUrls = new Set(
      watchPlans
        .filter((plan) => plan.status === "planned")
        .map((plan) => plan.titleUrl),
    );
    return library
      .filter(
        (item) =>
          item.status !== "completed" &&
          item.status !== "dropped" &&
          !plannedUrls.has(item.url),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [library, watchPlans]);

  const suggestion =
    suggestionPool.length > 0
      ? suggestionPool[suggestionIndex % suggestionPool.length]
      : null;

  const findMovieListMatch = async (
    title: string,
  ): Promise<Movie | undefined> => {
    const target = normalizeTitle(title);

    for (let page = 1; page <= 5; page += 1) {
      const response = await MovieAPI.getAllMovies(page);
      const match = response.movies.find(
        (movie) => normalizeTitle(movie.title) === target,
      );
      if (match) return match;
      if (!response.pagination?.hasNextPage) break;
    }

    return undefined;
  };

  const openTitle = async (item: WatchPlanItem | LibraryItem) => {
    const titleUrl = "titleUrl" in item ? item.titleUrl : item.url;

    if (item.isSeries) {
      navigation.navigate("SeriesDetails", { url: titleUrl });
      return;
    }

    const slug =
      "detailSlug" in item && item.detailSlug
        ? item.detailSlug
        : getSlugFromUrl(titleUrl);

    const isLegacyCanonicalUrl = titleUrl.startsWith("/movie/");

    if (isMovieDetailsSlug(slug) && !isLegacyCanonicalUrl) {
      navigation.navigate("MovieDetails", { slug, movie: item });
      return;
    }

    if (!("titleUrl" in item)) {
      navigation.navigate("MovieDetails", { slug, movie: item });
      return;
    }

    try {
      setResolvingPlanId(item.id);
      const match = await findMovieListMatch(item.title);
      if (!match) {
        Alert.alert(
          "Movie Not Found",
          "This planned title could not be matched to the Movies catalog.",
        );
        return;
      }

      const resolvedSlug = getSlugFromUrl(match.url);
      updateWatchPlan(item.id, {
        titleUrl: match.url,
        detailSlug: resolvedSlug,
        thumbnail: match.thumbnail,
      });
      navigation.navigate("MovieDetails", { slug: resolvedSlug, movie: match });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to open movie.";
      Alert.alert("Error", message);
    } finally {
      setResolvingPlanId(null);
    }
  };

  const handlePlanSuggestion = () => {
    if (!suggestion) return;
    addWatchPlan({
      titleUrl: suggestion.url,
      detailSlug: getSlugFromUrl(suggestion.url),
      title: suggestion.title,
      isSeries: suggestion.isSeries,
      thumbnail: suggestion.thumbnail,
      plannedFor: createTonightDate(),
      note: "Picked from my library",
    });
  };

  const handleRemovePlan = (plan: WatchPlanItem) => {
    Alert.alert("Remove Plan", `Remove "${plan.title}" from your planner?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeWatchPlan(plan.id),
      },
    ]);
  };

  const renderPlan = (plan: WatchPlanItem) => {
    const isResolving = resolvingPlanId === plan.id;
    return (
      <TouchableOpacity
        key={plan.id}
        style={plannerStyles.planCard}
        onPress={() => openTitle(plan)}
        activeOpacity={0.8}
      >
        {plan.thumbnail ? (
          <Image
            source={{ uri: plan.thumbnail.trim() }}
            style={plannerStyles.poster}
            contentFit="cover"
          />
        ) : (
          <View style={plannerStyles.posterFallback}>
            <FontAwesome name="film" size={22} color="#555" />
          </View>
        )}
        <View style={plannerStyles.planBody}>
          <View style={plannerStyles.planTitleRow}>
            <Text style={plannerStyles.planTitle} numberOfLines={2}>
              {plan.title}
            </Text>
            <View style={plannerStyles.typeBadge}>
              <Text style={plannerStyles.typeBadgeText}>
                {plan.isSeries ? "Series" : "Movie"}
              </Text>
            </View>
          </View>
          <View style={plannerStyles.planDateRow}>
            <FontAwesome name="clock-o" size={11} color="#e74c3c" />
            <Text style={plannerStyles.planDate}>
              {formatPlanDate(plan.plannedFor)}
            </Text>
          </View>
          {plan.note ? (
            <Text style={plannerStyles.planNote} numberOfLines={2}>
              {plan.note}
            </Text>
          ) : null}
          <View style={plannerStyles.planActions}>
            {plan.status === "planned" && (
              <>
                <TouchableOpacity
                  style={plannerStyles.actionButton}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    updateWatchPlan(plan.id, { status: "done" });
                  }}
                >
                  <FontAwesome name="check" size={12} color="#2ecc71" />
                  <Text style={plannerStyles.actionText}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={plannerStyles.actionButton}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    updateWatchPlan(plan.id, { status: "skipped" });
                  }}
                >
                  <FontAwesome name="forward" size={12} color="#f1c40f" />
                  <Text style={plannerStyles.actionText}>Skip</Text>
                </TouchableOpacity>
              </>
            )}
            {plan.status !== "planned" && (
              <TouchableOpacity
                style={plannerStyles.actionButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  updateWatchPlan(plan.id, { status: "planned" });
                }}
              >
                <FontAwesome name="calendar-plus-o" size={12} color="#e74c3c" />
                <Text style={plannerStyles.actionText}>Plan again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={plannerStyles.actionButton}
              onPress={(event) => {
                event.stopPropagation?.();
                handleRemovePlan(plan);
              }}
            >
              <FontAwesome name="trash-o" size={12} color="#888" />
              <Text style={plannerStyles.actionText}>Remove</Text>
            </TouchableOpacity>
            {isResolving && (
              <Text style={plannerStyles.resolvingText}>Opening…</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filterCounts: Record<PlannerFilter, number> = {
    planned: upcomingCount,
    done: doneCount,
    skipped: watchPlans.filter((plan) => plan.status === "skipped").length,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={plannerStyles.scrollContent}
      >
        <View style={plannerStyles.statsRow}>
          <View style={[plannerStyles.statBlock, plannerStyles.statBlockAccent]}>
            <View style={plannerStyles.statIconRow}>
              <View style={plannerStyles.statDotAccent} />
              <Text style={plannerStyles.statLabel}>Upcoming</Text>
            </View>
            <Text style={plannerStyles.statValue}>{upcomingCount}</Text>
          </View>
          <View style={plannerStyles.statBlock}>
            <View style={plannerStyles.statIconRow}>
              <FontAwesome name="check" size={11} color="#2ecc71" />
              <Text style={plannerStyles.statLabel}>Completed</Text>
            </View>
            <Text style={plannerStyles.statValue}>{doneCount}</Text>
          </View>
          <View style={plannerStyles.statBlock}>
            <View style={plannerStyles.statIconRow}>
              <FontAwesome name="sticky-note-o" size={11} color="#888" />
              <Text style={plannerStyles.statLabel}>Notes</Text>
            </View>
            <Text style={plannerStyles.statValue}>{noteCount}</Text>
          </View>
        </View>

        {suggestion && (
          <View style={plannerStyles.suggestionPanel}>
            {suggestion.thumbnail ? (
              <Image
                source={{ uri: suggestion.thumbnail.trim() }}
                style={plannerStyles.suggestionPoster}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  plannerStyles.suggestionPoster,
                  plannerStyles.suggestionPosterFallback,
                ]}
              >
                <FontAwesome name="film" size={18} color="#555" />
              </View>
            )}
            <View style={plannerStyles.suggestionCopy}>
              <Text style={plannerStyles.suggestionLabel}>Tonight's pick</Text>
              <Text style={plannerStyles.suggestionTitle} numberOfLines={2}>
                {suggestion.title}
              </Text>
              <Text style={plannerStyles.suggestionMeta}>
                {suggestion.releaseYear || "From your library"}
              </Text>
              <View style={plannerStyles.suggestionActions}>
                <TouchableOpacity
                  style={plannerStyles.planTonightButton}
                  onPress={handlePlanSuggestion}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="calendar-plus-o" size={13} color="#fff" />
                  <Text style={plannerStyles.planTonightText}>Plan tonight</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={plannerStyles.roundButton}
                  onPress={() => setSuggestionIndex((value) => value + 1)}
                  activeOpacity={0.85}
                >
                  <FontAwesome name="refresh" size={14} color="#ddd" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={plannerStyles.filterRow}>
          {(["planned", "done", "skipped"] as PlannerFilter[]).map((item) => {
            const active = filter === item;
            const label =
              item === "planned"
                ? "Upcoming"
                : item.charAt(0).toUpperCase() + item.slice(1);
            return (
              <TouchableOpacity
                key={item}
                style={[
                  plannerStyles.filterChip,
                  active && plannerStyles.filterChipActive,
                ]}
                onPress={() => setFilter(item)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    plannerStyles.filterText,
                    active && plannerStyles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>
                <View
                  style={[
                    plannerStyles.filterCount,
                    active && plannerStyles.filterCountActive,
                  ]}
                >
                  <Text
                    style={[
                      plannerStyles.filterCountText,
                      active && plannerStyles.filterCountTextActive,
                    ]}
                  >
                    {filterCounts[item]}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={plannerStyles.section}>
          {filteredPlans.length === 0 ? (
            <View style={plannerStyles.emptyContainer}>
              <FontAwesome name="calendar-o" size={52} color="#333" />
              <Text style={plannerStyles.emptyTitle}>
                {filter === "planned"
                  ? "No upcoming plans"
                  : "Nothing here yet"}
              </Text>
              <Text style={plannerStyles.emptyText}>
                Add titles to your planner from movie and series detail pages.
                Your plans and notes stay saved on this device.
              </Text>
            </View>
          ) : (
            filteredPlans.map(renderPlan)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const plannerStyles = StyleSheet.create({
  scrollContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  statBlock: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  statBlockAccent: {
    borderColor: "rgba(231,76,60,0.45)",
    backgroundColor: "rgba(231,76,60,0.08)",
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDotAccent: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#e74c3c",
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    color: "#9a9a9a",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  suggestionPanel: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#222",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    gap: 12,
  },
  suggestionPoster: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  suggestionPosterFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionCopy: {
    flex: 1,
    justifyContent: "center",
  },
  suggestionLabel: {
    color: "#e74c3c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  suggestionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 21,
  },
  suggestionMeta: {
    color: "#888",
    fontSize: 12,
    marginTop: 3,
    marginBottom: 10,
  },
  suggestionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: "#2e2e2e",
  },
  planTonightButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  planTonightText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  filterChipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  filterText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#fff",
  },
  filterCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  filterCountText: {
    color: "#bbb",
    fontSize: 11,
    fontWeight: "800",
  },
  filterCountTextActive: {
    color: "#fff",
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  planCard: {
    flexDirection: "row",
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f1f1f",
    overflow: "hidden",
    marginBottom: 12,
  },
  poster: {
    width: 86,
    height: 132,
    backgroundColor: "#222",
  },
  posterFallback: {
    width: 86,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  planBody: {
    flex: 1,
    padding: 12,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  planTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    color: "#bbb",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  planDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  planDate: {
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: "700",
  },
  planNote: {
    color: "#9a9a9a",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  planActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  actionText: {
    color: "#ddd",
    fontSize: 11,
    fontWeight: "700",
  },
  resolvingText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 6,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
});
