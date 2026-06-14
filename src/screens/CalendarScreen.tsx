import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import UpcomingReleases from "../components/UpcomingReleases";

/**
 * Standalone calendar screen. On phones the calendar lives inside the Library
 * "Upcoming" tab (see LibraryScreen); this screen is kept for the TV tab bar,
 * where width isn't constrained. Both render the same `UpcomingReleases` body.
 */
export default function CalendarScreen() {
  return (
    <SafeAreaView style={calStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={calStyles.header}>
          <Text style={calStyles.headerTitle}>Calendar</Text>
        </View>
        <UpcomingReleases />
      </ScrollView>
    </SafeAreaView>
  );
}

const calStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
});
