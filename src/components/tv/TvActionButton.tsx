import React from "react";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Focusable from "../Focusable";
import { colors, radii } from "../../styles/theme";
import { tvType, tvLayout } from "../../styles/tvTheme";

interface TvActionButtonProps {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  hasTVPreferredFocus?: boolean;
  loading?: boolean;
  active?: boolean;
}

export default function TvActionButton({
  icon,
  label,
  onPress,
  primary,
  hasTVPreferredFocus,
  loading,
  active,
}: TvActionButtonProps) {
  // `active` should not reduce contrast when the button is `primary` (accent bg).
  const baseIconColor = primary ? colors.text : colors.textSecondary;
  const iconTint = active && !primary ? colors.accent : baseIconColor;
  return (
    <Focusable
      style={[styles.button, primary && styles.primary]}
      focusedStyle={styles.focused}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.inner}>
          <FontAwesome name={icon} size={20} color={iconTint} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 14,
    marginBottom: 14,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  focused: {
    borderColor: colors.text,
    transform: [{ scale: tvLayout.focusScale }],
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...tvType.meta,
    color: colors.text,
    marginLeft: 10,
  },
});
