import React, { useMemo } from 'react';
import { View, Text, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Movie } from '../services/MovieAPI';
import { styles } from '../styles/styles';
import Focusable from './Focusable';

interface FeaturedMovieProps {
  movie: Movie;
  onPress: () => void;
}

function FeaturedMovie({ movie, onPress }: FeaturedMovieProps) {
  const source = useMemo(
    () => ({ uri: movie.thumbnail?.trim() }),
    [movie.thumbnail]
  );

  if (Platform.isTV) {
    return (
      <Focusable
        style={styles.tvFeaturedContainer}
        focusedStyle={styles.featuredFocused}
        onPress={onPress}
        hasTVPreferredFocus={true}
      >
        <View style={styles.tvFeaturedImage}>
          <Image
            source={source}
            style={styles.tvFeaturedImageBg}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.tvFeaturedPlayWrap}>
            <View style={styles.playButtonLarge}>
              <Text style={styles.playIconLarge}>▶</Text>
            </View>
          </View>
        </View>

        <View style={styles.tvFeaturedInfo}>
          <Text style={styles.featuredBadge}>FEATURED</Text>
          <Text style={styles.tvFeaturedTitle} numberOfLines={2}>
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

  // Phone layout — unchanged from current
  return (
    <Focusable
      style={styles.featuredContainer}
      focusedStyle={styles.featuredFocused}
      onPress={onPress}
      hasTVPreferredFocus={true}
    >
      <View style={styles.featuredImage}>
        <Image
          source={source}
          style={styles.featuredImageBg}
          contentFit="cover"
          transition={200}
        />
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
      </View>

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

export default React.memo(FeaturedMovie);
