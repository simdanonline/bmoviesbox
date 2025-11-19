import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import MovieDetailsScreen from "./src/screens/MovieDetailsScreen";
import ServerSelectionScreen from "./src/screens/ServerSelectionScreen";
import VideoPlayerScreen from "./src/screens/VideoPlayerScreen";
import TrailerScreen from "./src/screens/TrailerScreen";
import MyTabs from "./src/navigation/Tabs";
import AppStack from "./src/navigation/AppStack";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <AppStack />
    </>
  );
}
