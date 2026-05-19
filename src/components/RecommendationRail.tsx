import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { Movie } from "../services/MovieAPI";
import Focusable from "./Focusable";

interface RecommendationRailProps {
  title: string;
  items: Movie[];
  onPress: (movie: Movie) => void;
  isFirstRail?: boolean;
}

export default function RecommendationRail({
  title,
  items,
  onPress,
  isFirstRail,
}: RecommendationRailProps) {
  if (items.length === 0) return null;

  return (
    <View style={railStyles.container}>
      <Text style={railStyles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={railStyles.scroll}
      >
        {items.map((item, idx) => (
          <Focusable
            key={item.id + idx}
            style={railStyles.card}
            onPress={() => onPress(item)}
            hasTVPreferredFocus={isFirstRail && idx === 0}
          >
            <Image
              source={{ uri: item.thumbnail?.trim() }}
              style={railStyles.image}
              contentFit="cover"
            />
            <Text style={railStyles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.imdbRating && (
              <Text style={railStyles.rating}>
                {parseFloat(item.imdbRating).toFixed(1)}
              </Text>
            )}
          </Focusable>
        ))}
      </ScrollView>
    </View>
  );
}

const railStyles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 120,
  },
  image: {
    width: 120,
    height: 170,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
  },
  cardTitle: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  rating: {
    color: "#ffc107",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});
