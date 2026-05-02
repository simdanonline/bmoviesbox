import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WatchStatus, STATUS_LABELS, STATUS_COLORS } from "../types/app";

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
            <TouchableOpacity
              key={status}
              style={[
                sStyles.chip,
                isActive && { backgroundColor: STATUS_COLORS[status], borderColor: STATUS_COLORS[status] },
              ]}
              onPress={() => onSelect(status)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  sStyles.chipText,
                  isActive && sStyles.chipTextActive,
                ]}
              >
                {STATUS_LABELS[status]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {currentStatus && onRemove && (
        <TouchableOpacity onPress={onRemove} style={sStyles.removeBtn}>
          <Text style={sStyles.removeText}>Remove from Library</Text>
        </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: "#333",
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
  },
  removeText: {
    color: "#e74c3c",
    fontSize: 13,
  },
});
