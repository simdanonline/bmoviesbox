import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Movie } from "../services/MovieAPI";
import Focusable from "./Focusable";
import TvSafeImage from "./TvSafeImage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RAIL_CARD_WIDTH = Platform.isTV ? Math.min(SCREEN_WIDTH / 7, 240) : 120;
const RAIL_CARD_HEIGHT = Platform.isTV
  ? Math.round(Math.min(SCREEN_WIDTH / 7, 240) * 1.5)
  : 170;

interface RecommendationRailProps {
  title: string;
  items: Movie[];
  onPress: (movie: Movie) => void;
}

export default function RecommendationRail({
  title,
  items,
  onPress,
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
            focusedStyle={railStyles.cardFocused}
            onPress={() => onPress(item)}
          >
            <TvSafeImage
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
    paddingVertical: 8,
    overflow: "visible",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  scroll: {
    paddingHorizontal: Platform.isTV ? 32 : 16,
    paddingVertical: Platform.isTV ? 20 : 16,
    gap: 12,
  },
  card: {
    width: Platform.isTV ? RAIL_CARD_WIDTH + 8 : RAIL_CARD_WIDTH,
    borderWidth: Platform.isTV ? 4 : 0,
    borderColor: "transparent",
    borderRadius: 12,
    overflow: "visible",
  },
  cardFocused: {
    borderColor: "#fff",
    zIndex: 10,
  },
  image: {
    width: "100%",
    height: RAIL_CARD_HEIGHT,
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
