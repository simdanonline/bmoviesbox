import React from "react";
import { View, Text, StyleSheet, ScrollView, StyleProp, ViewStyle } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Focusable from "./Focusable";

/** A track normalized from either react-native-video or VLC into one shape. */
export type PlayerTrack = { key: number; label: string };

interface TrackSelectionMenuProps {
  /** Audio options. Pass [] to hide the Audio section (e.g. only one track). */
  audioTracks: PlayerTrack[];
  /** Subtitle options, including a synthetic { key: -1, label: "Off" } entry. */
  textTracks: PlayerTrack[];
  selectedAudioKey: number | null;
  selectedTextKey: number;
  onSelectAudio: (key: number) => void;
  onSelectText: (key: number) => void;
  onClose: () => void;
  /** Absolute positioning (top/right + insets) supplied by the parent. */
  style?: StyleProp<ViewStyle>;
}

function TrackRow({
  label,
  selected,
  onPress,
  hasTVPreferredFocus,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}) {
  return (
    <Focusable
      style={[styles.row, selected && styles.rowActive]}
      focusedStyle={styles.rowFocused}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
    >
      <FontAwesome
        name="check"
        size={12}
        color={selected ? "#fff" : "transparent"}
        style={styles.rowCheck}
      />
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
    </Focusable>
  );
}

export default function TrackSelectionMenu({
  audioTracks,
  textTracks,
  selectedAudioKey,
  selectedTextKey,
  onSelectAudio,
  onSelectText,
  onClose,
  style,
}: TrackSelectionMenuProps) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Audio & Subtitles</Text>
        <Focusable
          style={styles.closeButton}
          focusedStyle={styles.closeButtonFocused}
          onPress={onClose}
        >
          <Text style={styles.closeText}>Close</Text>
        </Focusable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        {audioTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Audio</Text>
            {audioTracks.map((t, idx) => (
              <TrackRow
                key={`a-${t.key}`}
                label={t.label}
                selected={t.key === selectedAudioKey}
                hasTVPreferredFocus={idx === 0}
                onPress={() => onSelectAudio(t.key)}
              />
            ))}
          </>
        )}
        {textTracks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Subtitles</Text>
            {textTracks.map((t, idx) => (
              <TrackRow
                key={`t-${t.key}`}
                label={t.label}
                selected={t.key === selectedTextKey}
                hasTVPreferredFocus={audioTracks.length === 0 && idx === 0}
                onPress={() => onSelectText(t.key)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    width: 280,
    maxHeight: "70%",
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingBottom: 8,
    borderBottomColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  headerText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  closeButtonFocused: {
    backgroundColor: "#e74c3c",
    transform: [{ scale: 1.05 }],
  },
  closeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  sectionLabel: {
    color: "#9a9a9a",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 4,
    marginBottom: 2,
  },
  rowActive: { backgroundColor: "rgba(231,76,60,0.25)" },
  rowFocused: { backgroundColor: "#e74c3c", transform: [{ scale: 1.02 }] },
  rowCheck: { width: 18 },
  rowLabel: { color: "#ddd", fontSize: 12, flexShrink: 1 },
});
