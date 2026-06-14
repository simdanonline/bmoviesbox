import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { TvAppProvider } from "../context/TvAppContext";
import { UserDataProvider, useUserData } from "../context/UserDataContext";
import { DownloadProvider } from "../context/DownloadContext";
import MovieDetailsScreen from "../screens/MovieDetailsScreen";
import ServerSelectionScreen from "../screens/ServerSelectionScreen";
import VideoPlayerScreen from "../screens/VideoPlayerScreen";
import NativeVideoPlayer from "../screens/NativeVideoPlayer";
import TrailerScreen from "../screens/TrailerScreen";
import SearchScreen from "../screens/SearchScreen";
import MyTabs from "./Tabs";
import TvTabs from "./TvTabs";
import SeriesDetailsScreen from "../screens/SeriesDetailScreen";
import LiveGamePlayer from "../screens/LiveGamePlayer";
import StreamSelection from "../screens/StreamSelection";
import OnboardingScreen from "../screens/OnboardingScreen";
import PreferencesScreen from "../screens/PreferencesScreen";
import PlannerScreen from "../screens/PlannerScreen";
import DownloadedTitlesScreen from "../screens/DownloadedTitlesScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isOnboardingComplete, isLoading } = useUserData();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#e74c3c" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
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
        {!isOnboardingComplete && (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        )}
        <Stack.Screen
          name="Home"
          component={Platform.isTV ? TvTabs : MyTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="MovieDetails"
          component={MovieDetailsScreen}
          options={{ title: "Movie Details" }}
        />
        <Stack.Screen
          name="ServerSelection"
          component={ServerSelectionScreen}
          options={{ title: "Select Server" }}
        />
        <Stack.Screen
          name="VideoPlayer"
          component={VideoPlayerScreen}
          options={{ title: "Now Playing", headerShown: false }}
        />
        <Stack.Screen
          name="NativeVideoPlayer"
          component={NativeVideoPlayer}
          options={{
            title: "Now Playing",
            headerShown: false,
            // Force landscape on phones for a real fullscreen feel — VLC has
            // no native fullscreen button and AVPlayer's is easy to miss.
            // Platform.isTV already runs in landscape, so this is a no-op there.
            orientation: Platform.isTV ? "default" : "landscape",
          }}
        />
        <Stack.Screen
          name="TrailerScreen"
          component={TrailerScreen}
          options={{ title: "Trailer" }}
        />
        <Stack.Screen
          name="SearchScreen"
          component={SearchScreen}
          options={{ title: "Search" }}
        />
        <Stack.Screen
          name="SeriesDetails"
          component={SeriesDetailsScreen}
          options={{ title: "Series Details", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="LiveGamePlayer"
          component={LiveGamePlayer}
          options={{ title: "Live Game", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="StreamSelection"
          component={StreamSelection}
          options={{ title: "Select Stream", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{ title: "Edit Preferences", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="Planner"
          component={PlannerScreen}
          options={{ title: "Planner", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="DownloadedTitles"
          component={DownloadedTitlesScreen}
          options={{ title: "Downloads", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          // SettingsScreen renders its own header (with a back chevron when
          // pushed); hide the native one to avoid a doubled "Settings" title.
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </>
  );
}

export default function AppStack() {
  return (
    <TvAppProvider>
      <UserDataProvider>
        <DownloadProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </DownloadProvider>
      </UserDataProvider>
    </TvAppProvider>
  );
}
