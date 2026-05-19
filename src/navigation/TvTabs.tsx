import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { View, StyleSheet } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import LibraryScreen from "../screens/LibraryScreen";
import PlannerScreen from "../screens/PlannerScreen";
import CalendarScreen from "../screens/CalendarScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LiveTab from "../screens/LiveTab";
import { useTvApp } from "../context/TvAppContext";

const Tab = createMaterialTopTabNavigator();

export default function TvTabs() {
  const { isTvApp } = useTvApp();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          swipeEnabled: false,
          tabBarStyle: { backgroundColor: "#000" },
          tabBarIndicatorStyle: { backgroundColor: "#e74c3c", height: 3 },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#999",
          tabBarLabelStyle: { fontSize: 16, fontWeight: "600" },
        }}
      >
        <Tab.Screen name="Movies" component={HomeScreen} />
        <Tab.Screen name="Series" component={SeriesList} />
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "Settings" }} />
        {isTvApp && <Tab.Screen name="LiveTab" component={LiveTab} options={{ title: "Live" }} />}
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
