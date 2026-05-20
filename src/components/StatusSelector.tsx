import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { WatchStatus, STATUS_LABELS, STATUS_COLORS } from "../types/app";
import Focusable from "./Focusable";

interface StatusSelectorProps {
  currentStatus: WatchStatus | null;
  onSelect: (status: WatchStatus) => void;
  onRemove?: () => void;
}

const STATUSES: WatchStatus[] = [
  "want_to_watch",
  "watching",
  "completed",
  "dropped",
];

export default function StatusSelector({
  currentStatus,
  onSelect,
  onRemove,
}: StatusSelectorProps) {
  return (
    <View style={sStyles.container}>
      <Text style={sStyles.label}>Status</Text>
      <View style={sStyles.row}>
        {STATUSES.map((status) => {
          const isActive = currentStatus === status;
          return (
            <Focusable
              key={status}
              style={[
                sStyles.chip,
                isActive && {
                  backgroundColor: STATUS_COLORS[status],
                  borderColor: STATUS_COLORS[status],
                },
              ]}
              focusedStyle={sStyles.focused}
              onPress={() => onSelect(status)}
            >
              <Text
                style={[
                  sStyles.chipText,
                  isActive && sStyles.chipTextActive,
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </Focusable>
          );
        })}
      </View>
      {currentStatus && onRemove && (
        <Focusable
          onPress={onRemove}
          style={sStyles.removeBtn}
          focusedStyle={sStyles.focused}
        >
          <Text style={sStyles.removeText}>Remove from Library</Text>
        </Focusable>
      )}
    </View>
  );
}

const sStyles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
    borderWidth: 2,
    borderColor: "#333",
  },
  focused: {
    borderColor: "#fff",
  },
  chipText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  removeBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  removeText: {
    color: "#e74c3c",
    fontSize: 13,
  },
});
