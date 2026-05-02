import React from "react";
import { View, Text, TouchableOpacity, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Movie } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import { Feather } from "@expo/vector-icons";

interface MovieCardProps {
  movie: Movie;
  onPress: () => void;
  style?: ViewStyle;
}

export default function MovieCard({ movie, onPress, style }: MovieCardProps) {
  if (!movie.thumbnail) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[styles.movieCardContainer, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardImageWrapper}>
        <Image
          source={{
            uri: movie.thumbnail.trim(),
          }}
          style={styles.cardImage}
          contentFit="scale-down"
          onProgress={(e) => console.log(e)}
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
            <Text style={styles.cardRatingText}>⭐ {(parseFloat(movie?.imdbRating || "0")).toFixed(1)}</Text>
          </View>
        )}

        <Text style={styles.cardYear}>{movie.releaseYear}</Text>
      </View>
    </TouchableOpacity>
  );
}
