import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { GestureAxis } from "../utils/playerGestureMath";

type Props = { axis: GestureAxis; level: number }; // level 0..1

export default function PlayerLevelIndicator({ axis, level }: Props) {
  const pct = Math.round(level * 100);
  const icon =
    axis === "brightness" ? "sun-o" : level <= 0 ? "volume-off" : "volume-up";
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.card}>
        <FontAwesome name={icon} size={22} color="#fff" />
        <View style={styles.track}>
          <View style={[styles.fill, { height: `${pct}%` }]} />
        </View>
        <Text style={styles.label}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    width: 92,
  },
  track: {
    width: 6,
    height: 120,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginVertical: 12,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: 6, borderRadius: 3, backgroundColor: "#fff" },
  label: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
