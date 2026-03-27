import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { TvAppProvider } from "../context/TvAppContext";
import { UserDataProvider } from "../context/UserDataContext";
import HomeScreen from "../screens/HomeScreen";
import MovieDetailsScreen from "../screens/MovieDetailsScreen";
import ServerSelectionScreen from "../screens/ServerSelectionScreen";
import VideoPlayerScreen from "../screens/VideoPlayerScreen";
import TrailerScreen from "../screens/TrailerScreen";
import SearchScreen from "../screens/SearchScreen";
import MyTabs from "./Tabs";
import SeriesDetailsScreen from "../screens/SeriesDetailScreen";
import LiveGamePlayer from "../screens/LiveGamePlayer";
import StreamSelection from "../screens/StreamSelection";

const Stack = createNativeStackNavigator();

export default function AppStack() {
  return (
    <TvAppProvider>
    <UserDataProvider>
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
          <Stack.Screen name="SeriesDetails" options={{
            title: "Series details",
            headerBackTitle:"Back"
          }} component={SeriesDetailsScreen} />

          <Stack.Screen
            name="LiveGamePlayer"
            component={LiveGamePlayer}
            options={{
              title: "Live Game",
              headerBackTitle: "Back",
            }}
          />

          <Stack.Screen
            name="StreamSelection"
            component={StreamSelection}
            options={{
              title: "Select Stream",
              headerBackTitle: "Back",
            }}
          />
        </Stack.Navigator>
      </>
    </NavigationContainer>
    </UserDataProvider>
    </TvAppProvider>
  );
}
