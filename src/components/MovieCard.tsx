import React, { useRef } from "react";
import { View, Text, ViewStyle, Animated, Platform } from "react-native";
import { Movie } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import { Feather } from "@expo/vector-icons";
import Focusable from "./Focusable";
import TvSafeImage from "./TvSafeImage";

interface MovieCardProps {
  movie: Movie;
  onPress: () => void;
  style?: ViewStyle;
  hasTVPreferredFocus?: boolean;
}

export default function MovieCard({
  movie,
  onPress,
  style,
  hasTVPreferredFocus,
}: MovieCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  if (!movie.thumbnail) {
    return null;
  }

  // Phone-only subtle press-scale. Forwarded to Focusable's underlying
  // Pressable via its ...rest passthrough (onFocus/onBlur are the only
  // handlers it intercepts), so this never touches TV focus behavior.
  const handlePressIn = () => {
    if (Platform.isTV) return;
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    if (Platform.isTV) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Focusable
      style={[styles.movieCardContainer, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hasTVPreferredFocus={hasTVPreferredFocus}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={styles.cardImageWrapper}>
          <TvSafeImage
            source={{ uri: movie.thumbnail.trim() }}
            style={styles.cardImage}
            contentFit="scale-down"
            transition={200}
          />
          <View style={styles.cardOverlay}>
            <View style={styles.playButtonSmall}>
              <Text style={styles.playIconSmall}>▶</Text>
            </View>
          </View>
          {movie.isSeries && (
            <View style={styles.seriesBadge}>
              <Feather name="tv" size={24} color="black" />
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {movie.title}
          </Text>

          {movie.imdbRating && (
            <View style={styles.cardRating}>
              <Text style={styles.cardRatingText}>
                ⭐ {parseFloat(movie?.imdbRating || "0").toFixed(1)}
              </Text>
            </View>
          )}

          <Text style={styles.cardYear}>{movie.releaseYear}</Text>
        </View>
      </Animated.View>
    </Focusable>
  );
}
