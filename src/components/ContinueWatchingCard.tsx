import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LibraryItem } from "../types/app";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CW_CARD_WIDTH = Platform.isTV ? Math.min(SCREEN_WIDTH / 6, 320) : 140;
const CW_CARD_HEIGHT = Platform.isTV
  ? Math.round((Math.min(SCREEN_WIDTH / 6, 320) * 9) / 16)
  : 90;

interface ContinueWatchingSectionProps {
  items: LibraryItem[];
  onPress: (item: LibraryItem) => void;
}

export default function ContinueWatchingSection({
  items,
  onPress,
}: ContinueWatchingSectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={cwStyles.container}>
      <Text style={cwStyles.title}>Continue Watching</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cwStyles.scroll}
      >
        {items.map((item, idx) => (
          <TouchableOpacity
            key={item.url + idx}
            style={cwStyles.card}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
          >
            <View style={cwStyles.imageWrapper}>
              <Image
                source={{ uri: item.thumbnail?.trim() }}
                style={cwStyles.image}
                contentFit="cover"
              />
              {item.isSeries && item.lastSeasonNumber && item.lastEpisodeNumber && (
                <View style={cwStyles.progressBadge}>
                  <Text style={cwStyles.progressText}>
                    S{item.lastSeasonNumber}E{item.lastEpisodeNumber}
                  </Text>
                </View>
              )}
              {item.isSeries && item.completedEpisodes > 0 && (
                <View style={cwStyles.epCountBadge}>
                  <Text style={cwStyles.epCountText}>
                    {item.completedEpisodes} ep{item.completedEpisodes !== 1 ? "s" : ""}
                  </Text>
                </View>
              )}
            </View>
            <Text style={cwStyles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const cwStyles = StyleSheet.create({
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
    width: CW_CARD_WIDTH,
  },
  imageWrapper: {
    position: "relative",
  },
  image: {
    width: CW_CARD_WIDTH,
    height: CW_CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
  },
  progressBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(231, 76, 60, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  epCountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epCountText: {
    color: "#aaa",
    fontSize: 10,
  },
  cardTitle: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
});
