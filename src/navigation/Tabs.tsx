import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import WatchlistScreen from "../screens/WatchlistScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AntDesign from "@expo/vector-icons/build/AntDesign";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Ionicons from "@expo/vector-icons/build/Ionicons";
import LiveTab from "../screens/LiveTab";
import { useTvApp } from "../context/TvAppContext";

const Tab = createBottomTabNavigator();

function MyTabs() {
  const { isTvApp } = useTvApp();

  return (
    <Tab.Navigator screenOptions={{ tabBarStyle: { backgroundColor: "#000" } }}>
      <Tab.Screen
        name="Movies"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Movies</Text>,
          tabBarIcon: ({ focused }) => (
            <AntDesign name="play-circle" size={24} color={ focused ? "#fff" : "#999"} />
          ),
        }}
      />
      <Tab.Screen
        name="Series"
        component={SeriesList}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Series</Text>,
          tabBarIcon: ({ focused }) => <FontAwesome name="tv" size={24} color={ focused ? "#fff" : "#999"} />,
        }}
      />
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Watchlist</Text>,
          tabBarIcon: ({ focused }) => (
            <FontAwesome name="bookmark" size={24} color={focused ? "#fff" : "#999"} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Settings</Text>,
          tabBarIcon: ({ focused }) => (
            <Ionicons name="settings-outline" size={24} color={focused ? "#fff" : "#999"} />
          ),
        }}
      />
      {isTvApp && (
        <Tab.Screen
          name="LiveTab"
          component={LiveTab}
          options={{
            headerShown: false,
            tabBarLabel: () => <Text style={{ color: "#fff" }}>Live</Text>,
            tabBarIcon: ({ focused }) => <FontAwesome name="tv" size={24} color={ focused ? "#fff" : "#999"} />,
          }}
        />
      )}
    </Tab.Navigator>
  );
}
export default MyTabs;
