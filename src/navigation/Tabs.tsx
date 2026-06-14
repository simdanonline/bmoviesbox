import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import LibraryScreen from "../screens/LibraryScreen";
import AntDesign from "@expo/vector-icons/build/AntDesign";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
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
            <AntDesign
              name="play-circle"
              size={24}
              color={focused ? "#fff" : "#999"}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Series"
        component={SeriesList}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Series</Text>,
          tabBarIcon: ({ focused }) => (
            <FontAwesome
              name="tv"
              size={24}
              color={focused ? "#fff" : "#999"}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Library</Text>,
          tabBarIcon: ({ focused }) => (
            <FontAwesome
              name="folder-open"
              size={22}
              color={focused ? "#fff" : "#999"}
            />
          ),
        }}
      />
      {/* Calendar lives in the Library "Upcoming" tab, and Settings in the Home
          header (gear icon) — keeping the bar to ≤5 items so labels don't wrap.
          (Both remain full tabs in TvTabs, where width isn't constrained.) */}
      {isTvApp && (
        <Tab.Screen
          name="LiveTab"
          component={LiveTab}
          options={{
            headerShown: false,
            tabBarLabel: () => <Text style={{ color: "#fff" }}>Live</Text>,
            tabBarIcon: ({ focused }) => (
              <FontAwesome
                name="tv"
                size={24}
                color={focused ? "#fff" : "#999"}
              />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}
export default MyTabs;
