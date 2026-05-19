import React, { useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Focusable from "../components/Focusable";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import LibraryScreen from "../screens/LibraryScreen";
import CalendarScreen from "../screens/CalendarScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LiveTab from "../screens/LiveTab";
import { useTvApp } from "../context/TvAppContext";

const { width } = Dimensions.get("window");

type TabKey = "Movies" | "Series" | "Library" | "Calendar" | "Settings" | "Live";

export default function TvTabs({ navigation, route }: any) {
  const { isTvApp } = useTvApp();
  const [activeTab, setActiveTab] = useState<TabKey>("Movies");

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "Movies", label: "Movies" },
    { key: "Series", label: "Series" },
    { key: "Library", label: "Library" },
    { key: "Calendar", label: "Calendar" },
    { key: "Settings", label: "Settings" },
    ...(isTvApp ? [{ key: "Live" as TabKey, label: "Live" }] : []),
  ];

  const renderActive = () => {
    const screenProps = { navigation, route };
    switch (activeTab) {
      case "Movies":
        return <HomeScreen {...screenProps} />;
      case "Series":
        return <SeriesList {...screenProps} />;
      case "Library":
        return <LibraryScreen {...screenProps} />;
      case "Calendar":
        return <CalendarScreen {...screenProps} />;
      case "Settings":
        return <SettingsScreen {...screenProps} />;
      case "Live":
        return <LiveTab {...screenProps} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <Focusable
              key={t.key}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              focusedStyle={styles.tabButtonFocused}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Focusable>
          );
        })}
      </View>
      <View style={styles.screenHost}>{renderActive()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: Math.round(width * 0.05),
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#e74c3c",
    borderBottomWidth: 3,
  },
  tabButtonFocused: {
    borderColor: "#e74c3c",
    backgroundColor: "rgba(231, 76, 60, 0.15)",
    transform: [{ scale: 1.05 }],
  },
  tabLabel: { color: "#999", fontSize: 18, fontWeight: "600" },
  tabLabelActive: { color: "#fff" },
  screenHost: { flex: 1 },
});
