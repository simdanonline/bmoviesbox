import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
  RefreshControl,
  TextInput,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import MovieAPI, { LiveGame } from "../services/MovieAPI";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTvApp } from "../context/TvAppContext";

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
      const errorMessage = err instanceof Error ? err.message : "Failed to load games";
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
        stream: null
      });
    } else {
      // Otherwise, go to stream selection
      navigation.navigate("StreamSelection", { game });
    }
  };

  const renderGameCard = ({ item }: { item: LiveGame }) => (
    <TouchableOpacity
      style={styles.gameCard}
      onPress={() => handleGamePress(item)}
      activeOpacity={0.8}
      disabled={!isTvApp}
    >
      <View style={styles.cardHeader}>
        <View style={styles.leagueBadge}>
          <Text style={styles.leagueBadgeText}>{item.league}</Text>
        </View>
        <Text style={styles.datetime}>{item.status}</Text>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.teamName} numberOfLines={1}>
          {item.homeTeam}
        </Text>
        {item.awayTeam ? (
          <>
            <Text style={styles.vsText}>vs</Text>
            <Text style={styles.teamName} numberOfLines={1}>
              {item.awayTeam}
            </Text>
          </>
        ) : null}
      </View>

      {isTvApp ? <View style={styles.playButtonContainer}>
        <View style={styles.playButton}>
          <MaterialCommunityIcons
            name="play-circle"
            size={24}
            color="#fff"
          />
          <Text style={styles.playButtonText}>Watch</Text>
        </View>
      </View> : null}
    </TouchableOpacity>
  );

  // Filter games based on search query
  const filteredGames = games.filter((game) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      game.homeTeam.toLowerCase().includes(query) ||
      game.awayTeam.toLowerCase().includes(query) ||
      game.league.toLowerCase().includes(query) ||
      game.status.toLowerCase().includes(query)
    );
  });

  const groupedGames = filteredGames.reduce(
    (acc, game) => {
      const league = game.league;
      if (!acc[league]) {
        acc[league] = [];
      }
      acc[league].push(game);
      return acc;
    },
    {} as Record<string, LiveGame[]>
  );

  const renderLeagueSection = (league: string, leagueGames: LiveGame[]) => (
    <View key={league} style={styles.leagueSection}>
      <Text style={styles.leagueTitle}>{league}</Text>
      {leagueGames.map((game, index) => (
        <View key={`${league}-${index}`}>
          {renderGameCard({ item: game })}
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading live games...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  if (games.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  const noSearchResults = searchQuery && filteredGames.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="basketball" size={28} color="#e74c3c" />
        <Text style={styles.headerTitle}>Live Games</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams, leagues..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearButton}>
            <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {noSearchResults ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="magnify-close"
            size={48}
            color="#666"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>No games found for "{searchQuery}"</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setSearchQuery("")}>
            <Text style={styles.retryButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
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
    </SafeAreaView>
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
    alignItems: "center",
  },
  teamName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  vsText: {
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: "600",
    marginVertical: 8,
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