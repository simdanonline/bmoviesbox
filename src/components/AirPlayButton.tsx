import { Platform } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { AirplayRoutePickerView } from "../../modules/airplay-route-picker";

export default function AirPlayButton({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  // AVRoutePickerView is iOS-only; Android casting (Chromecast) is out of scope.
  if (Platform.OS !== "ios") return null;
  return (
    <AirplayRoutePickerView style={style} tint="#ffffff" activeTint="#1e90ff" />
  );
}
