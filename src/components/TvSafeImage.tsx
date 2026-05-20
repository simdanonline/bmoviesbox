import React from "react";
import { Image as NativeImage, Platform } from "react-native";
import type {
  ImageResizeMode,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import type { ImageContentFit } from "expo-image";

interface TvSafeImageProps {
  source: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
}

const resizeModeByContentFit: Record<ImageContentFit, ImageResizeMode> = {
  contain: "contain",
  cover: "cover",
  fill: "stretch",
  none: "center",
  "scale-down": "contain",
};

export default function TvSafeImage({
  source,
  style,
  contentFit = "cover",
  transition,
}: TvSafeImageProps) {
  if (Platform.isTV) {
    return (
      <NativeImage
        source={source}
        style={style}
        resizeMode={resizeModeByContentFit[contentFit]}
        fadeDuration={0}
      />
    );
  }

  return (
    <ExpoImage
      source={source}
      style={style}
      contentFit={contentFit}
      transition={transition}
    />
  );
}
