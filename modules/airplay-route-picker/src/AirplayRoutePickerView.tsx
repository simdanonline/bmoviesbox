import { requireNativeView } from "expo";
import * as React from "react";
import type { ViewProps } from "react-native";

export type AirplayRoutePickerViewProps = ViewProps & {
  tint?: string;
  activeTint?: string;
};

const NativeView = requireNativeView<AirplayRoutePickerViewProps>(
  "AirplayRoutePicker",
);

export default function AirplayRoutePickerView(
  props: AirplayRoutePickerViewProps,
) {
  return <NativeView {...props} />;
}
