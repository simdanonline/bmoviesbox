import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../styles/styles";
import { useUserData } from "../context/UserDataContext";
import MovieAPI from "../services/MovieAPI";
import AsyncStorage from "@react-native-async-storage/async-storage";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

export default function SettingsScreen() {
  const { watchlist, history, ratings, clearHistory } = useUserData();

  const ratingsCount = Object.keys(ratings).length;

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached movie and series data. Your watchlist and ratings will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            MovieAPI.clearAllCache();
            await AsyncStorage.multiRemove([
              "bmoviebox_movies_cache",
              "bmoviebox_series_cache",
            ]);
            Alert.alert("Done", "Cache cleared successfully.");
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Watch History",
      "This will remove all your recently viewed items.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearHistory },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Stats Section */}
        <View style={settingsStyles.section}>
          <Text style={settingsStyles.sectionTitle}>Your Activity</Text>
          <View style={settingsStyles.statsRow}>
            <View style={settingsStyles.statCard}>
              <FontAwesome name="bookmark" size={20} color="#e74c3c" />
              <Text style={settingsStyles.statNumber}>{watchlist.length}</Text>
              <Text style={settingsStyles.statLabel}>In Watchlist</Text>
            </View>
            <View style={settingsStyles.statCard}>
              <FontAwesome name="eye" size={20} color="#e74c3c" />
              <Text style={settingsStyles.statNumber}>{history.length}</Text>
              <Text style={settingsStyles.statLabel}>Viewed</Text>
            </View>
            <View style={settingsStyles.statCard}>
              <FontAwesome name="star" size={20} color="#ffc107" />
              <Text style={settingsStyles.statNumber}>{ratingsCount}</Text>
              <Text style={settingsStyles.statLabel}>Rated</Text>
            </View>
          </View>
        </View>

        {/* Data Management */}
        <View style={settingsStyles.section}>
          <Text style={settingsStyles.sectionTitle}>Data Management</Text>
          <TouchableOpacity
            style={settingsStyles.settingRow}
            onPress={handleClearCache}
          >
            <View style={settingsStyles.settingLeft}>
              <FontAwesome name="trash-o" size={18} color="#aaa" />
              <View style={settingsStyles.settingTextContainer}>
                <Text style={settingsStyles.settingText}>Clear API Cache</Text>
                <Text style={settingsStyles.settingDetail}>
                  Free up storage space
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#555" />
          </TouchableOpacity>

          <TouchableOpacity
            style={settingsStyles.settingRow}
            onPress={handleClearHistory}
          >
            <View style={settingsStyles.settingLeft}>
              <FontAwesome name="history" size={18} color="#aaa" />
              <View style={settingsStyles.settingTextContainer}>
                <Text style={settingsStyles.settingText}>
                  Clear Watch History
                </Text>
                <Text style={settingsStyles.settingDetail}>
                  {history.length} items
                </Text>
              </View>
            </View>
            <FontAwesome name="chevron-right" size={14} color="#555" />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={settingsStyles.section}>
          <Text style={settingsStyles.sectionTitle}>About</Text>
          <View style={settingsStyles.settingRow}>
            <View style={settingsStyles.settingLeft}>
              <FontAwesome name="info-circle" size={18} color="#aaa" />
              <View style={settingsStyles.settingTextContainer}>
                <Text style={settingsStyles.settingText}>Version</Text>
                <Text style={settingsStyles.settingDetail}>1.0.0</Text>
              </View>
            </View>
          </View>
          <View style={settingsStyles.settingRow}>
            <View style={settingsStyles.settingLeft}>
              <FontAwesome name="film" size={18} color="#aaa" />
              <View style={settingsStyles.settingTextContainer}>
                <Text style={settingsStyles.settingText}>BMovieBox</Text>
                <Text style={settingsStyles.settingDetail}>
                  Movie & Series Discovery
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const settingsStyles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    gap: 6,
  },
  statNumber: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingTextContainer: {
    gap: 2,
  },
  settingText: {
    color: "#fff",
    fontSize: 15,
  },
  settingDetail: {
    color: "#888",
    fontSize: 13,
  },
});
