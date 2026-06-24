import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Focusable from "../components/Focusable";
import { useUserData } from "../context/UserDataContext";
import {
  ALL_GENRES,
  Mood,
  MOOD_LABELS,
  RuntimeBucket,
  RUNTIME_LABELS,
  DECADES,
  TasteProfile,
  DEFAULT_TASTE_PROFILE,
} from "../types/app";

const STEPS = ["Genres", "Avoid", "Mood", "Duration", "Era"] as const;

export default function OnboardingScreen() {
  const { setTasteProfile, completeOnboarding } = useUserData();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<TasteProfile>({
    ...DEFAULT_TASTE_PROFILE,
  });

  const toggleInArray = <T extends string>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  const handleSkip = () => {
    setTasteProfile({ ...DEFAULT_TASTE_PROFILE, updatedAt: Date.now() });
    completeOnboarding();
  };

  const handleFinish = () => {
    setTasteProfile(profile);
    completeOnboarding();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const renderChips = <T extends string>(
    items: T[],
    selected: T[],
    labelMap: Record<T, string> | null,
    onToggle: (item: T) => void
  ) => (
    <View style={obStyles.chipGrid}>
      {items.map((item) => {
        const isActive = selected.includes(item);
        return (
          <Focusable
            key={item}
            style={[obStyles.chip, isActive && obStyles.chipActive]}
            onPress={() => onToggle(item)}
          >
            <Text
              style={[obStyles.chipText, isActive && obStyles.chipTextActive]}
            >
              {labelMap ? labelMap[item] : item}
            </Text>
          </Focusable>
        );
      })}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            <Text style={obStyles.stepTitle}>What genres do you love?</Text>
            <Text style={obStyles.stepSubtitle}>
              Pick as many as you like — we'll use these to find great matches.
            </Text>
            {renderChips(ALL_GENRES, profile.favoriteGenres, null, (g) =>
              setProfile((p) => ({
                ...p,
                favoriteGenres: toggleInArray(p.favoriteGenres, g),
              }))
            )}
          </View>
        );
      case 1:
        return (
          <View>
            <Text style={obStyles.stepTitle}>Anything you'd rather skip?</Text>
            <Text style={obStyles.stepSubtitle}>
              We'll try to keep these out of your recommendations.
            </Text>
            {renderChips(
              ALL_GENRES.filter((g) => !profile.favoriteGenres.includes(g)),
              profile.dislikedGenres,
              null,
              (g) =>
                setProfile((p) => ({
                  ...p,
                  dislikedGenres: toggleInArray(p.dislikedGenres, g),
                }))
            )}
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={obStyles.stepTitle}>What's your mood?</Text>
            <Text style={obStyles.stepSubtitle}>
              Pick the vibes that match your taste.
            </Text>
            {renderChips(
              Object.keys(MOOD_LABELS) as Mood[],
              profile.moods,
              MOOD_LABELS,
              (m) =>
                setProfile((p) => ({
                  ...p,
                  moods: toggleInArray(p.moods, m),
                }))
            )}
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={obStyles.stepTitle}>Runtime preference?</Text>
            <Text style={obStyles.stepSubtitle}>
              Quick movie night or long marathon?
            </Text>
            {renderChips(
              Object.keys(RUNTIME_LABELS) as RuntimeBucket[],
              profile.runtimeBuckets,
              RUNTIME_LABELS,
              (r) =>
                setProfile((p) => ({
                  ...p,
                  runtimeBuckets: toggleInArray(p.runtimeBuckets, r),
                }))
            )}
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={obStyles.stepTitle}>Favorite era?</Text>
            <Text style={obStyles.stepSubtitle}>
              Do you prefer modern or classic?
            </Text>
            {renderChips(DECADES, profile.decades, null, (d) =>
              setProfile((p) => ({
                ...p,
                decades: toggleInArray(p.decades, d),
              }))
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={obStyles.container}>
      <ScrollView
        contentContainerStyle={obStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={obStyles.header}>
          <Text style={obStyles.logoText}>Reelmark</Text>
          <Text style={obStyles.tagline}>Let's personalize your experience</Text>
        </View>

        {/* Progress */}
        <View style={obStyles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                obStyles.progressDot,
                i <= step && obStyles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Step content */}
        {renderStep()}
      </ScrollView>

      {/* Bottom controls */}
      <View style={obStyles.bottomBar}>
        <View style={obStyles.navRow}>
          {step > 0 ? (
            <Focusable onPress={handleBack} style={obStyles.backBtn}>
              <Text style={obStyles.backText}>Back</Text>
            </Focusable>
          ) : (
            <Focusable onPress={handleSkip} style={obStyles.skipBtn}>
              <Text style={obStyles.skipText}>Skip for now</Text>
            </Focusable>
          )}

          <Focusable
            onPress={handleNext}
            style={obStyles.nextBtn}
            hasTVPreferredFocus={true}
          >
            <Text style={obStyles.nextText}>
              {step === STEPS.length - 1 ? "Get Started" : "Next"}
            </Text>
          </Focusable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const obStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
    paddingTop: 30,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: "#aaa",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 30,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333",
  },
  progressDotActive: {
    backgroundColor: "#e74c3c",
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#888",
    marginBottom: 20,
    lineHeight: 20,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  chipActive: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  chipText: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    padding: 12,
  },
  backText: {
    color: "#aaa",
    fontSize: 16,
  },
  skipBtn: {
    padding: 12,
  },
  skipText: {
    color: "#666",
    fontSize: 14,
  },
  nextBtn: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
