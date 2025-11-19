import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AppStack from "./AppStack";
import { NavigationContainer } from "@react-navigation/native";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import AntDesign from "@expo/vector-icons/build/AntDesign";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

const Tab = createBottomTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarStyle: { backgroundColor: "#000" } }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: () => <Text style={{ color: "#fff" }}>Home</Text>,
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
    </Tab.Navigator>
  );
}
export default MyTabs;
