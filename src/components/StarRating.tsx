import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

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
        <TouchableOpacity
          key={star}
          onPress={() => !readonly && onRate(star)}
          disabled={readonly}
          style={starStyles.star}
          activeOpacity={readonly ? 1 : 0.6}
        >
          <FontAwesome
            name={rating && star <= rating ? "star" : "star-o"}
            size={size}
            color={rating && star <= rating ? "#ffc107" : "#555"}
          />
        </TouchableOpacity>
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
  },
});
