import { StyleSheet, Dimensions, Platform } from "react-native";

export const { width, height } = Dimensions.get("window");

// TV-aware card sizing. Google TV is always landscape (typically 1920x1080).
// On phones, cards stay percentage-based ("48%"/"24%"). On TV, target ~7 cards
// visible per row at 1920px wide for a comfortable across-the-room density.
const TV_CARD_WIDTH = Math.min(width / 7, 260);
const TV_CARD_IMAGE_HEIGHT = Math.min((width / 7) * 1.5, 390);
// TV overscan: many TVs clip ~3-5% on the edges. Bump horizontal padding so
// rails/grids don't get cropped.
const TV_HORIZONTAL_PADDING = Math.round(width * 0.05);

export const styles = StyleSheet.create({
  // Global
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  iconButtonFocused: {
    backgroundColor: "rgba(231, 76, 60, 0.25)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#e74c3c",
    transform: [{ scale: 1.1 }],
  },
  headerLogoWrap: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },

  // Featured Movie
  featuredContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 12,
    overflow: "hidden",
  },
  featuredFocused: {
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#fff",
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
    transform: [{ scale: 1.02 }],
  },
  featuredGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  featuredHeroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 6,
  },
  featuredPlayWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredImage: {
    width: "100%",
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
  },
  featuredBadge: {
    backgroundColor: "#e74c3c",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontWeight: "bold",
    fontSize: 12,
    alignSelf: "flex-start",
  },
  playButtonLarge: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playIconLarge: {
    fontSize: 60,
    color: "#fff",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  featuredInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1a1a1a",
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featuredMetaText: {
    color: "#aaa",
    fontSize: 14,
  },
  genresList: {
    color: "#888",
    fontSize: 12,
    marginBottom: 8,
  },
  ratingBadge: {
    backgroundColor: "#2d2d2d",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  ratingBadgeText: {
    color: "#ffc107",
    fontWeight: "600",
    fontSize: 12,
  },

  // TV Featured Movie (horizontal split layout)
  tvFeaturedContainer: {
    flexDirection: "row",
    height: Math.round(height * 0.38),
    marginHorizontal: Math.round(width * 0.05),
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  tvFeaturedImage: {
    flex: 1.4, // ~58% (image side wider than info)
    justifyContent: "center",
    alignItems: "center",
  },
  tvFeaturedPlayWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  tvFeaturedInfo: {
    flex: 1, // ~42%
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: "center",
  },
  tvFeaturedTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 12,
  },

  // Movies Section
  moviesSection: {
    paddingHorizontal: Platform.isTV ? TV_HORIZONTAL_PADDING : 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  moviesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // Movie Card
  movieCardContainer: {
    width: Platform.isTV
      ? TV_CARD_WIDTH
      : Platform.OS === "web"
        ? "24%"
        : "48%",
    marginBottom: 16,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  cardFocused: {
    transform: [{ scale: 1.08 }],
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#fff",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
    zIndex: 10,
  },
  cardImageWrapper: {
    position: "relative",
    width: "100%",
    height: Platform.isTV ? TV_CARD_IMAGE_HEIGHT : 200,
    backgroundColor: "#2a2a2a",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(231, 76, 60, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIconSmall: {
    fontSize: 24,
    color: "#fff",
  },
  cardInfo: {
    padding: 12,
  },
  cardTitle: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
    marginBottom: 6,
    height: 32,
  },
  cardRating: {
    marginBottom: 4,
  },
  cardRatingText: {
    color: "#ffc107",
    fontWeight: "600",
    fontSize: 12,
  },
  cardYear: {
    color: "#888",
    fontSize: 11,
  },

  // Movie Details
  coverImage: {
    width: "100%",
    height: 400,
    resizeMode: "cover",
  },
  playButton: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 20,
    backgroundColor: "#e74c3c",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  playButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  movieInfoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  movieTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaText: {
    color: "#aaa",
    fontSize: 14,
  },
  metaDot: {
    color: "#aaa",
    marginHorizontal: 8,
  },
  genresContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  genreTag: {
    backgroundColor: "#2d2d2d",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    color: "#e74c3c",
    fontWeight: "600",
    fontSize: 12,
  },
  ratingsContainer: {
    marginBottom: 24,
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 8,
  },
  ratingsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  ratingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  ratingItem: {
    width: "48%",
    backgroundColor: "#2d2d2d",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  ratingSource: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },
  ratingValue: {
    color: "#ffc107",
    fontSize: 18,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 20,
  },
  description: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
  },
  personText: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  subtext: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
  },

  // Server Selection
  serverSelectionContainer: {
    flex: 1,
    padding: 16,
    paddingTop: 24,
  },
  serversGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serverCard: {
    width: "48%",
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
  },
  serverName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  serverQuality: {
    color: "#ffc107",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  serverNumber: {
    color: "#888",
    fontSize: 12,
  },

  // Video Player
  playerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  playerTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginHorizontal: 16,
    textAlign: "center",
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: width,
    height: height * 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  playerFooter: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  serverInfo: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  trailerButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e74c3c",
    marginHorizontal: 16,
    marginBottom: 16,

  },
  trailerButtonText: {
    color: "#fff",
    fontSize: 16,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 2,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#e74c3c",
    borderRadius: 6,
  },
  seriesBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ffc107",
    padding: 4,
    borderRadius: 4,
  },

  // TV Video Player overlay (D-pad focusable play affordance)
  tvPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  tvPlayButton: {
    paddingHorizontal: 60,
    paddingVertical: 30,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#fff",
    backgroundColor: "rgba(231, 76, 60, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  tvPlayButtonFocused: {
    borderColor: "#fff",
    borderWidth: 5,
    backgroundColor: "#e74c3c",
    shadowColor: "#fff",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
    transform: [{ scale: 1.1 }],
  },
  tvPlayButtonIcon: {
    color: "#fff",
    fontSize: 72,
    textAlign: "center",
    marginBottom: 4,
  },
  tvPlayButtonLabel: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  tvShowControlsWrap: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
  },
  tvShowControlsButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  tvShowControlsButtonFocused: {
    borderColor: "#e74c3c",
    borderWidth: 3,
    backgroundColor: "rgba(231, 76, 60, 0.8)",
    transform: [{ scale: 1.05 }],
  },
  tvShowControlsLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
