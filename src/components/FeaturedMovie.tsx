import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { Movie } from '../services/MovieAPI';
import { styles } from '../styles/styles';

interface FeaturedMovieProps {
  movie: Movie;
  onPress: () => void;
}

export default function FeaturedMovie({ movie, onPress }: FeaturedMovieProps) {
  return (
    <TouchableOpacity
      style={styles.featuredContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <ImageBackground
        source={{ uri: movie.thumbnail?.trim() }}
        style={styles.featuredImage}
        imageStyle={{ borderRadius: 12 }}
        resizeMode='contain'
      >
        <View style={styles.featuredOverlay}>
          <Text style={styles.featuredBadge}>FEATURED</Text>
          <View style={styles.playButtonLarge}>
            <Text style={styles.playIconLarge}>▶</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.featuredInfo}>
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {movie.title}
        </Text>

        <View style={styles.featuredMeta}>
          {movie.releaseYear && (
            <Text style={styles.featuredMetaText}>{movie.releaseYear}</Text>
          )}
          {movie.runtime && (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.featuredMetaText}>{movie.runtime}</Text>
            </>
          )}
        </View>

        {movie.genres.length > 0 && (
          <Text style={styles.genresList}>
            {movie.genres.slice(0, 3).join(', ')}
          </Text>
        )}

        {movie.imdbRating && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>
              ⭐ {movie.imdbRating}/10
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
