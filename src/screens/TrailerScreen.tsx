import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useState } from "react";
import { View, StyleSheet, Alert, Platform } from "react-native";


type TrailerScreenProps = NativeStackScreenProps<any, "TrailerScreen">;

const TrailerScreen: React.FC<TrailerScreenProps> = ({ route }) => {
  const { videoUrl } = route.params as { videoUrl: string };
  const videoId = videoUrl?.split("/")[4];
  //   const videoId = videoUrl?.split("/")[1]?.split("&")[0];
  const [playing, setPlaying] = useState(true);

  const onStateChange = useCallback((state: string) => {
    if (state === "ended") {
      setPlaying(false);
      Alert.alert("video has finished playing!");
    }
  }, []);



  return (
    <View style={styles.container}>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default TrailerScreen;
