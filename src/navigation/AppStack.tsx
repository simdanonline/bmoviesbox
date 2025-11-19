import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "../screens/HomeScreen";
import MovieDetailsScreen from "../screens/MovieDetailsScreen";
import ServerSelectionScreen from "../screens/ServerSelectionScreen";
import VideoPlayerScreen from "../screens/VideoPlayerScreen";
import TrailerScreen from "../screens/TrailerScreen";
import SearchScreen from "../screens/SearchScreen";
import MyTabs from "./Tabs";
import SeriesDetailsScreen from "../screens/SeriesDetailScreen";

const Stack = createNativeStackNavigator();

export default function AppStack() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: "#1a1a1a",
            },
            headerTintColor: "#fff",
            headerTitleStyle: {
              fontWeight: "bold",
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={MyTabs}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="MovieDetails"
            component={MovieDetailsScreen}
            options={{
              title: "Movie Details",
            }}
          />
          <Stack.Screen
            name="ServerSelection"
            component={ServerSelectionScreen}
            options={{
              title: "Select Server",
            }}
          />
          <Stack.Screen
            name="VideoPlayer"
            component={VideoPlayerScreen}
            options={{
              title: "Now Playing",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="TrailerScreen"
            component={TrailerScreen}
            options={{
              title: "Trailer",
            }}
          />
          <Stack.Screen
            name="SearchScreen"
            component={SearchScreen}
            options={{
              title: "Search",
            }}
          />
          <Stack.Screen name="SeriesDetails" component={SeriesDetailsScreen} />
        </Stack.Navigator>
      </>
    </NavigationContainer>
  );
}
