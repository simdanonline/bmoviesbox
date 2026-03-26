import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from "react-native";
import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MovieAPI, { LiveGame, LiveStream } from "../services/MovieAPI";

type Props = NativeStackScreenProps<any, "StreamSelection">;

const StreamSelection = ({ route, navigation }: Props) => {
  const { game } = route.params as { game: LiveGame };
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await MovieAPI.getStreams(game.link);
      setStreams(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load streams";
      setError(errorMessage);
      console.error("Error fetching streams:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStreamPress = (stream: LiveStream) => {
    navigation.navigate("LiveGamePlayer", { 
      link: stream.link, 
      game,
      stream
    });
  };

  const getQualityColor = (quality: string) => {
    switch (quality.toLowerCase()) {
      case "platinum":
        return "#FFD700";
      case "gold":
        return "#FFA500";
      case "silver":
        return "#C0C0C0";
      default:
        return "#999";
    }
  };

  const renderStreamCard = ({ item }: { item: LiveStream }) => (
    <TouchableOpacity
      style={styles.streamCard}
      onPress={() => handleStreamPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.streamHeader}>
        <View style={styles.sourceContainer}>
          <Text style={styles.sourceName}>{item.source || "Unknown"}</Text>
        </View>
        <View style={[styles.qualityBadge, { borderColor: getQualityColor(item.quality) }]}>
          <Text style={[styles.qualityText, { color: getQualityColor(item.quality) }]}>
            {item.quality}
          </Text>
        </View>
      </View>

      <View style={styles.streamContent}>
        <Text style={styles.channel} numberOfLines={1}>
          {item.channel}
        </Text>
        <View style={styles.streamFooter}>
          <Text style={styles.language}>{item.language}</Text>
          <MaterialCommunityIcons name="play-circle" size={20} color="#e74c3c" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading available streams...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchStreams}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (streams.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <MaterialCommunityIcons
            name="wifi-off"
            size={48}
            color="#666"
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.emptyText}>No streams available</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchStreams}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Stream</Text>
        <Text style={styles.headerSubtitle}>
          {game.homeTeam} {game.awayTeam ? "vs " + game.awayTeam : ""}
        </Text>
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#FFD700" }]} />
          <Text style={styles.legendText}>Platinum</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#FFA500" }]} />
          <Text style={styles.legendText}>Gold</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#C0C0C0" }]} />
          <Text style={styles.legendText}>Silver</Text>
        </View>
      </View>

      <FlatList
        data={streams}
        renderItem={renderStreamCard}
        keyExtractor={(item, index) => `${item.source}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default StreamSelection;

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
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#999",
  },
  legendContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0a0a0a",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    color: "#999",
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  streamCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  streamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  sourceContainer: {
    flex: 1,
  },
  sourceName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  qualityBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qualityText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  streamContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  channel: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 8,
  },
  streamFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  language: {
    color: "#999",
    fontSize: 12,
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
