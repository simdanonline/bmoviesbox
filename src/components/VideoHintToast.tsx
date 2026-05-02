import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface Props {
  message?: string;
  /** Icon name from MaterialCommunityIcons */
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  /** How long the toast stays visible after fading in (ms) */
  duration?: number;
  /** Where on the screen to show it */
  position?: "top" | "bottom";
}

/**
 * Subtle, non-blocking hint shown over a video player. Fades in, lingers
 * for `duration`, then fades out. Tap to dismiss early.
 */
export default function VideoHintToast({
  message = "Double-tap to open full screen",
  icon = "gesture-double-tap",
  duration = 4000,
  position = "top",
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    });

    const fadeOut = Animated.timing(opacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    });

    fadeIn.start(() => {
      if (cancelled) return;
      const timer = setTimeout(() => {
        fadeOut.start(({ finished }) => {
          if (finished && !cancelled) setHidden(true);
        });
      }, duration);
      return () => clearTimeout(timer);
    });

    return () => {
      cancelled = true;
      fadeIn.stop();
      fadeOut.stop();
    };
  }, [duration, opacity]);

  if (hidden) return null;

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setHidden(true);
    });
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        position === "bottom" ? styles.wrapBottom : styles.wrapTop,
        { opacity },
      ]}
    >
      <TouchableWithoutFeedback onPress={dismiss}>
        <View style={styles.toast}>
          <MaterialCommunityIcons name={icon} size={18} color="#fff" />
          <Text style={styles.text} numberOfLines={1}>
            {message}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  wrapTop: {
    top: 12,
  },
  wrapBottom: {
    bottom: 24,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 20, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(231, 76, 60, 0.4)",
    maxWidth: "90%",
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },
});
