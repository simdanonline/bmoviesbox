import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AppStack from "./src/navigation/AppStack";
import * as Updates from "expo-updates";
import * as Device from "expo-device";
import { Alert } from "react-native";


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <AppStack />
    </>
  );
}
