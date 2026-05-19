import React from 'react';
import { View, Text, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Movie } from '../services/MovieAPI';
import { styles } from '../styles/styles';
import Focusable from './Focusable';

interface FeaturedMovieProps {
  movie: Movie;
  onPress: () => void;
}

export default function FeaturedMovie({ movie, onPress }: FeaturedMovieProps) {
  return (
    <Focusable
      style={styles.featuredContainer}
      focusedStyle={styles.featuredFocused}
      onPress={onPress}
      hasTVPreferredFocus={true}
    >
      <ImageBackground
        source={{ uri: movie.thumbnail?.trim() }}
        style={styles.featuredImage}
        imageStyle={{ borderRadius: 12 }}
        resizeMode='cover'
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.featuredGradient}
        >
          <Text style={styles.featuredBadge}>FEATURED</Text>
          <Text style={styles.featuredHeroTitle} numberOfLines={2}>
            {movie.title}
          </Text>
        </LinearGradient>
        <View style={styles.featuredPlayWrap}>
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
              ⭐ {(parseFloat(movie?.imdbRating || "0").toFixed(1))}/10
            </Text>
          </View>
        )}
      </View>
    </Focusable>
  );
}
