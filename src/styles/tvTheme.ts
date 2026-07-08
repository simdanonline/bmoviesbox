// TV-only layout constants (Android TV, Platform.isTV). Colors come from theme.ts;
// this module holds dimensions / sizing / TV type scale only. Plain constants,
// zero runtime cost.
import { Dimensions } from "react-native";
import { colors } from "./theme";

const { width, height } = Dimensions.get("window");
const railCardWidth = Math.min(width / 7, 240);

export const tvLayout = {
  screenWidth: width,
  screenHeight: height,
  // Overscan-safe margins (~5%): many TVs clip the physical edges.
  overscanH: Math.round(width * 0.05),
  overscanV: Math.round(height * 0.05),
  // Detail hero: info-left / art-right split; hero ~58% of screen height.
  heroHeight: Math.round(height * 0.58),
  heroInfoWidth: Math.round(width * 0.45),
  heroArtWidth: Math.round(width * 0.55),
  // Focus scale for cards/buttons.
  focusScale: 1.08,
  // Poster rail card sizing (2:3 poster ratio).
  railCardWidth,
  railCardHeight: Math.round(railCardWidth * 1.5),
  // Grid (Search results, Library).
  gridColumns: 5,
  gridGutter: 16,
} as const;

export const tvType = {
  heroTitle: { fontSize: 40, fontWeight: "800", lineHeight: 46, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: -0.2 },
  body: { fontSize: 18, fontWeight: "400", lineHeight: 26, letterSpacing: 0 },
  meta: { fontSize: 16, fontWeight: "600", lineHeight: 20, letterSpacing: 0 },
  caption: { fontSize: 14, fontWeight: "500", lineHeight: 18, letterSpacing: 0.2 },
} as const;

export const tvFocus = {
  borderWidth: 3,
  borderColor: colors.text, // "#FFFFFF"
  radius: 12,
} as const;
