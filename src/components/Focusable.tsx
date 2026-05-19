import React, { useState } from "react";
import {
  Pressable,
  PressableProps,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { styles } from "../styles/styles";

interface FocusableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
  children: React.ReactNode;
}

export default function Focusable({
  style,
  focusedStyle,
  hasTVPreferredFocus,
  children,
  ...rest
}: FocusableProps) {
  const [focused, setFocused] = useState(false);
  const isTV = Platform.isTV;

  return (
    <Pressable
      {...rest}
      hasTVPreferredFocus={isTV ? hasTVPreferredFocus : undefined}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={({ pressed }) => [
        style,
        !isTV && pressed && { opacity: 0.7 },
        isTV && focused && (focusedStyle ?? styles.cardFocused),
      ]}
    >
      {children}
    </Pressable>
  );
}
