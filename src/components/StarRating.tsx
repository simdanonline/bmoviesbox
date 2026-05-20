import React from "react";
import { View, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Focusable from "./Focusable";

interface StarRatingProps {
  rating: number | null;
  onRate: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

export default function StarRating({
  rating,
  onRate,
  size = 28,
  readonly = false,
}: StarRatingProps) {
  return (
    <View style={starStyles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Focusable
          key={star}
          onPress={() => !readonly && onRate(star)}
          disabled={readonly}
          style={starStyles.star}
          focusedStyle={starStyles.starFocused}
        >
          <FontAwesome
            name={rating && star <= rating ? "star" : "star-o"}
            size={size}
            color={rating && star <= rating ? "#ffc107" : "#555"}
          />
        </Focusable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  star: {
    padding: 4,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 6,
  },
  starFocused: {
    borderColor: "#fff",
  },
});
