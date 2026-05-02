import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUserData } from "../context/UserDataContext";
import {
  ALL_GENRES,
  Mood,
  MOOD_LABELS,
  RuntimeBucket,
  RUNTIME_LABELS,
  DECADES,
  TasteProfile,
} from "../types/app";

export default function PreferencesScreen({ navigation }: any) {
  const { tasteProfile, setTasteProfile, resetTasteProfile } = useUserData();
  const [profile, setProfile] = useState<TasteProfile>({ ...tasteProfile });

  useEffect(() => {
    setProfile({ ...tasteProfile });
  }, [tasteProfile]);

  const toggleInArray = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const handleSave = () => {
    setTasteProfile(profile);
    Alert.alert("Saved", "Your preferences have been updated.");
    navigation.goBack();
  };

  const handleReset = () => {
    Alert.alert(
      "Reset Preferences",
      "This will clear all your taste preferences. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetTasteProfile();
            navigation.goBack();
          },
        },
      ]
    );
  };

  const renderChips = <T extends string>(
    items: T[],
    selected: T[],
    labelMap: Record<T, string> | null,
    onToggle: (item: T) => void
  ) => (
    <View style={prefStyles.chipGrid}>
      {items.map((item) => {
        const isActive = selected.includes(item);
        return (
          <TouchableOpacity
            key={item}
            style={[prefStyles.chip, isActive && prefStyles.chipActive]}
            onPress={() => onToggle(item)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                prefStyles.chipText,
                isActive && prefStyles.chipTextActive,
              ]}
            >
              {labelMap ? labelMap[item] : item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={prefStyles.container} edges={["bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={prefStyles.scrollContent}
      >
        {/* Favorite Genres */}
        <View style={prefStyles.section}>
          <Text style={prefStyles.sectionTitle}>Favorite Genres</Text>
          {renderChips(ALL_GENRES, profile.favoriteGenres, null, (g) =>
            setProfile((p) => ({
              ...p,
              favoriteGenres: toggleInArray(p.favoriteGenres, g),
            }))
          )}
        </View>

        {/* Disliked Genres */}
        <View style={prefStyles.section}>
          <Text style={prefStyles.sectionTitle}>Genres to Avoid</Text>
          {renderChips(
            ALL_GENRES.filter((g) => !profile.favoriteGenres.includes(g)),
            profile.dislikedGenres,
            null,
            (g) =>
              setProfile((p) => ({
                ...p,
                dislikedGenres: toggleInArray(p.dislikedGenres, g),
              }))
          )}
        </View>

        {/* Mood */}
        <View style={prefStyles.section}>
          <Text style={prefStyles.sectionTitle}>Mood Preferences</Text>
          {renderChips(
            Object.keys(MOOD_LABELS) as Mood[],
            profile.moods,
            MOOD_LABELS,
            (m) =>
              setProfile((p) => ({
                ...p,
                moods: toggleInArray(p.moods, m),
              }))
          )}
        </View>

        {/* Runtime */}
        <View style={prefStyles.section}>
          <Text style={prefStyles.sectionTitle}>Runtime Preference</Text>
          {renderChips(
            Object.keys(RUNTIME_LABELS) as RuntimeBucket[],
            profile.runtimeBuckets,
            RUNTIME_LABELS,
            (r) =>
              setProfile((p) => ({
                ...p,
                runtimeBuckets: toggleInArray(p.runtimeBuckets, r),
              }))
          )}
        </View>

        {/* Decades */}
        <View style={prefStyles.section}>
          <Text style={prefStyles.sectionTitle}>Favorite Era</Text>
          {renderChips(DECADES, profile.decades, null, (d) =>
            setProfile((p) => ({
              ...p,
              decades: toggleInArray(p.decades, d),
            }))
          )}
        </View>

        {/* Reset */}
        <TouchableOpacity onPress={handleReset} style={prefStyles.resetBtn}>
          <Text style={prefStyles.resetText}>Reset All Preferences</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Save button */}
      <View style={prefStyles.bottomBar}>
        <TouchableOpacity onPress={handleSave} style={prefStyles.saveBtn}>
          <Text style={prefStyles.saveText}>Save Preferences</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const prefStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  chipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  chipText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  resetBtn: {
    alignSelf: "center",
    padding: 12,
    marginTop: 8,
  },
  resetText: {
    color: "#e74c3c",
    fontSize: 14,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 30,
  },
  saveBtn: {
    backgroundColor: "#e74c3c",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
