// Dark-only design tokens. Plain constants — no provider, zero runtime cost.
export const colors = {
  bg: "#0A0A0E",
  surface: "#131318",
  surfaceHigh: "#1C1C24",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  textSecondary: "#B8B8C0",
  textMuted: "#71717A",
  accent: "#E5484D",
  accentPressed: "#C93B40",
  accentSoft: "rgba(229,72,77,0.15)",
  gold: "#F5C518",
  // Gradient scrim stops (transparent → near-bg) for hero/backdrop overlays.
  scrimTop: "rgba(10,10,14,0)",
  scrimMid: "rgba(10,10,14,0.55)",
  scrimBottom: "rgba(10,10,14,0.95)",
  overlay: "rgba(0,0,0,0.4)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  card: 14,
  button: 12,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: "800", lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: "700", lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: "400", lineHeight: 20, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 16, letterSpacing: 0.2 },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  poster: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;
