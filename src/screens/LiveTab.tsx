import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  TextInput,
  Image,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MovieAPI, { LiveGame } from "../services/MovieAPI";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTvApp } from "../context/TvAppContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const STATE_COLORS: Record<LiveGame["state"], string> = {
  in: "#27ae60",
  pre: "#f39c12",
  post: "#7f8c8d",
  unknown: "#7f8c8d",
};

const STATE_LABELS: Record<LiveGame["state"], string> = {
  in: "LIVE",
  pre: "UPCOMING",
  post: "FINAL",
  unknown: "",
};

type SportMeta = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  accent: string;
};

// Maps the `sport` field that ESPN returns -> display metadata
// Note: ESPN uses American naming. We relabel so European users see
// "Football" for soccer and "American Football" for the NFL.
const SPORT_META: Record<string, SportMeta> = {
  basketball: { label: "Basketball", icon: "basketball", accent: "#e67e22" },
  soccer: { label: "Football", icon: "soccer", accent: "#27ae60" },
  football: {
    label: "American Football",
    icon: "football",
    accent: "#8e44ad",
  },
  baseball: { label: "Baseball", icon: "baseball", accent: "#c0392b" },
  hockey: { label: "Hockey", icon: "hockey-puck", accent: "#3498db" },
  tennis: { label: "Tennis", icon: "tennis-ball", accent: "#f1c40f" },
  mma: { label: "MMA", icon: "boxing-glove", accent: "#e74c3c" },
  racing: { label: "Racing", icon: "racing-helmet", accent: "#d35400" },
  cricket: { label: "Cricket", icon: "cricket", accent: "#16a085" },
};

const sportMeta = (sport: string): SportMeta =>
  SPORT_META[sport] ?? {
    label: sport ? sport[0].toUpperCase() + sport.slice(1) : "Other",
    icon: "trophy",
    accent: "#7f8c8d",
  };

const formatKickoff = (iso: string): string => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

type Props = {};
type NavigationProp = NativeStackNavigationProp<any>;

const LiveTab = (props: Props) => {
  const { isTvApp } = useTvApp();
  const navigation = useNavigation<NavigationProp>();
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MovieAPI.getLiveGames();
      setGames(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load games";
      setError(errorMessage);
      console.error("Error fetching games:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  const handleGamePress = (game: LiveGame) => {
    // If the link is from watchfootballhighlights.com, go directly to player
    if (game.link.includes("https://watchfootballhighlights.com")) {
      navigation.navigate("LiveGamePlayer", {
        link: game.link,
        game,
        stream: null,
      });
    } else {
      // Otherwise, go to stream selection
      navigation.navigate("StreamSelection", { game });
    }
  };

  const renderGameCard = ({ item }: { item: LiveGame }) => {
    const accent = STATE_COLORS[item.state] ?? STATE_COLORS.unknown;
    const stateLabel = STATE_LABELS[item.state] ?? "";
    const showScore = item.state === "in" || item.state === "post";
    const isMatchup = !!item.awayTeam;

    return (
      <TouchableOpacity
        style={[styles.gameCard, { borderLeftColor: accent }]}
        onPress={() => handleGamePress(item)}
        activeOpacity={0.8}
        disabled={!isTvApp}
      >
        <View style={styles.cardHeader}>
          <View style={styles.leagueRow}>
            {item.leagueLogo ? (
              <Image
                source={{ uri: item.leagueLogo }}
                style={styles.leagueLogo}
                resizeMode="contain"
              />
            ) : null}
            <View style={[styles.leagueBadge, { backgroundColor: accent }]}>
              <Text style={styles.leagueBadgeText} numberOfLines={1}>
                {item.league}
              </Text>
            </View>
          </View>
          {stateLabel ? (
            <View style={[styles.stateChip, { borderColor: accent }]}>
              {item.state === "in" ? (
                <View style={[styles.liveDot, { backgroundColor: accent }]} />
              ) : null}
              <Text style={[styles.stateChipText, { color: accent }]}>
                {stateLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {isMatchup ? (
          <View style={styles.cardContent}>
            <View style={styles.teamColumn}>
              {item.homeLogo ? (
                <Image
                  source={{ uri: item.homeLogo }}
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.teamLogoPlaceholder} />
              )}
              <Text style={styles.teamName} numberOfLines={2}>
                {item.homeTeam}
              </Text>
            </View>

            <View style={styles.middleColumn}>
              {showScore ? (
                <Text style={styles.scoreText}>
                  {item.homeScore ?? "-"} : {item.awayScore ?? "-"}
                </Text>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
              <Text style={styles.kickoffText} numberOfLines={1}>
                {item.state === "pre"
                  ? formatKickoff(item.datetime)
                  : item.status}
              </Text>
            </View>

            <View style={styles.teamColumn}>
              {item.awayLogo ? (
                <Image
                  source={{ uri: item.awayLogo }}
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.teamLogoPlaceholder} />
              )}
              <Text style={styles.teamName} numberOfLines={2}>
                {item.awayTeam}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.singleCardContent}>
            {item.homeLogo ? (
              <Image
                source={{ uri: item.homeLogo }}
                style={styles.singleLogo}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.singleTitle} numberOfLines={2}>
              {item.homeTeam}
            </Text>
            <Text style={styles.kickoffText} numberOfLines={1}>
              {item.state === "pre"
                ? formatKickoff(item.datetime)
                : item.status}
            </Text>
          </View>
        )}

        {isTvApp ? (
          <View style={styles.playButtonContainer}>
            <View style={[styles.playButton, { backgroundColor: accent }]}>
              <MaterialCommunityIcons
                name="play-circle"
                size={24}
                color="#fff"
              />
              <Text style={styles.playButtonText}>Watch</Text>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Filter games by selected sport + search query
  const filteredGames = games.filter((game) => {
    if (selectedSport && game.sport !== selectedSport) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      game.homeTeam.toLowerCase().includes(query) ||
      game.awayTeam.toLowerCase().includes(query) ||
      game.league.toLowerCase().includes(query) ||
      game.status.toLowerCase().includes(query)
    );
  });

  // Bucket all games by sport (ignores selectedSport — used for the grid view)
  const sportBuckets = games.reduce(
    (acc, game) => {
      const key = game.sport || "other";
      if (!acc[key]) acc[key] = { total: 0, live: 0, upcoming: 0 };
      acc[key].total++;
      if (game.state === "in") acc[key].live++;
      else if (game.state === "pre") acc[key].upcoming++;
      return acc;
    },
    {} as Record<string, { total: number; live: number; upcoming: number }>,
  );

  // Sport keys sorted: any-LIVE first (most live games), then by total
  const sportKeys = Object.keys(sportBuckets).sort((a, b) => {
    const A = sportBuckets[a];
    const B = sportBuckets[b];
    if (A.live > 0 !== B.live > 0) return A.live > 0 ? -1 : 1;
    if (A.live !== B.live) return B.live - A.live;
    return B.total - A.total;
  });

  const renderSportCard = (sportKey: string) => {
    const meta = sportMeta(sportKey);
    const counts = sportBuckets[sportKey];
    const hasLive = counts.live > 0;
    return (
      <TouchableOpacity
        key={sportKey}
        style={[styles.sportCard, { borderColor: meta.accent }]}
        onPress={() => setSelectedSport(sportKey)}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.sportIconWrap,
            { backgroundColor: meta.accent + "22" },
          ]}
        >
          <MaterialCommunityIcons
            name={meta.icon}
            size={36}
            color={meta.accent}
          />
        </View>
        <Text style={styles.sportLabel}>{meta.label}</Text>
        <View style={styles.sportCountRow}>
          {hasLive ? (
            <View style={styles.sportLiveChip}>
              <View style={styles.sportLiveDot} />
              <Text style={styles.sportLiveText}>{counts.live} LIVE</Text>
            </View>
          ) : null}
          <Text style={styles.sportTotalText}>
            {counts.total} {counts.total === 1 ? "game" : "games"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const groupedGames = filteredGames.reduce(
    (acc, game) => {
      const league = game.league;
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(game);
      return acc;
    },
    {} as Record<string, LiveGame[]>,
  );

  const renderLeagueSection = (league: string, leagueGames: LiveGame[]) => (
    <View key={league} style={styles.leagueSection}>
      <Text style={styles.leagueTitle}>{league}</Text>
      {leagueGames.map((game, index) => (
        <View key={`${league}-${index}`}>{renderGameCard({ item: game })}</View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading live games...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color="#e74c3c"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGames}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (games.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="calendar-blank"
            size={48}
            color="#666"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>No live games available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGames}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const noSearchResults = searchQuery && filteredGames.length === 0;

  // Show the sports grid when no sport is selected and the user hasn't searched.
  // Searching jumps to a flat results view across all sports.
  const showSportsGrid = !selectedSport && !searchQuery;
  const selectedMeta = selectedSport ? sportMeta(selectedSport) : null;

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        {selectedMeta ? (
          <>
            <TouchableOpacity
              style={styles.backIconButton}
              onPress={() => setSelectedSport(null)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
            <MaterialCommunityIcons
              name={selectedMeta.icon}
              size={28}
              color={selectedMeta.accent}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.headerTitle}>{selectedMeta.label}</Text>
              <Text style={styles.headerSportLabel}>
                {filteredGames.length}{" "}
                {filteredGames.length === 1 ? "game" : "games"}
              </Text>
            </View>
          </>
        ) : (
          <>
            <MaterialCommunityIcons
              name="basketball"
              size={28}
              color="#e74c3c"
            />
            <Text style={styles.headerTitle}>Live Games</Text>
          </>
        )}
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color="#999"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={
            selectedMeta
              ? `Search ${selectedMeta.label.toLowerCase()}...`
              : "Search teams, leagues, sports..."
          }
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={styles.clearButton}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color="#999"
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSportsGrid ? (
        <FlatList
          key="sports-grid"
          data={sportKeys}
          renderItem={({ item }) => renderSportCard(item)}
          keyExtractor={(item) => item}
          numColumns={2}
          columnWrapperStyle={styles.sportsGridRow}
          contentContainerStyle={styles.sportsGrid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e74c3c"
              colors={["#e74c3c"]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : noSearchResults ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="magnify-close"
            size={48}
            color="#666"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>
            No games found for "{searchQuery}"
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setSearchQuery("")}
          >
            <Text style={styles.retryButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : filteredGames.length === 0 ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="calendar-blank"
            size={48}
            color="#666"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>
            No {selectedMeta?.label.toLowerCase() ?? ""} games today
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => setSelectedSport(null)}
          >
            <Text style={styles.retryButtonText}>Pick another sport</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key="games-list"
          data={Object.keys(groupedGames)}
          renderItem={({ item: league }) =>
            renderLeagueSection(league, groupedGames[league])
          }
          keyExtractor={(item) => item}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e74c3c"
              colors={["#e74c3c"]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default LiveTab;

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  leagueSection: {
    marginBottom: 24,
  },
  leagueTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e74c3c",
    marginBottom: 12,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  gameCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  leagueBadge: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  datetime: {
    color: "#999",
    fontSize: 11,
    fontWeight: "600",
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamColumn: {
    flex: 1,
    alignItems: "center",
  },
  teamLogo: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    marginBottom: 8,
    borderRadius: 24,
    backgroundColor: "#2a2a2a",
  },
  teamName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  middleColumn: {
    flex: 0.8,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  vsText: {
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  scoreText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: 1,
  },
  kickoffText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  singleCardContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  singleLogo: {
    width: 56,
    height: 56,
    marginBottom: 10,
  },
  singleTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  leagueRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  leagueLogo: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  stateChipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sportsGrid: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sportsGridRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sportCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1.5,
  },
  sportIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  sportLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  sportCountRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  sportLiveChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#27ae6022",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sportLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#27ae60",
    marginRight: 4,
  },
  sportLiveText: {
    color: "#27ae60",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  sportTotalText: {
    color: "#999",
    fontSize: 11,
    fontWeight: "600",
  },
  backIconButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  headerSportLabel: {
    color: "#999",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  playButtonContainer: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  playButton: {
    flexDirection: "row",
    backgroundColor: "#e74c3c",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  loadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#e74c3c",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
