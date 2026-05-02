import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { ReleaseEvent } from "../types/app";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

interface CalendarEventCardProps {
  event: ReleaseEvent;
  hasReminder: boolean;
  onPress: () => void;
  onToggleReminder: () => void;
}

export default function CalendarEventCard({
  event,
  hasReminder,
  onPress,
  onToggleReminder,
}: CalendarEventCardProps) {
  const date = new Date(event.releaseAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TouchableOpacity
      style={cardStyles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {event.thumbnail && (
        <Image
          source={{ uri: event.thumbnail.trim() }}
          style={cardStyles.thumbnail}
          contentFit="cover"
        />
      )}
      <View style={cardStyles.info}>
        <Text style={cardStyles.title} numberOfLines={2}>
          {event.title}
        </Text>
        {event.label && (
          <Text style={cardStyles.label}>{event.label}</Text>
        )}
        {event.seasonNumber && (
          <Text style={cardStyles.episode}>
            S{event.seasonNumber}
            {event.episodeNumber ? `E${event.episodeNumber}` : ""}
          </Text>
        )}
        <Text style={cardStyles.time}>{timeStr}</Text>
        <View style={cardStyles.badges}>
          <View
            style={[
              cardStyles.typeBadge,
              event.isSeries && cardStyles.seriesBadge,
            ]}
          >
            <Text style={cardStyles.typeText}>
              {event.isSeries ? "Series" : "Movie"}
            </Text>
          </View>
          {event.source === "reminder" && (
            <View style={cardStyles.reminderBadge}>
              <Text style={cardStyles.reminderBadgeText}>Reminder</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={cardStyles.bellButton}
        onPress={onToggleReminder}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <FontAwesome
          name={hasReminder ? "bell" : "bell-o"}
          size={18}
          color={hasReminder ? "#e74c3c" : "#666"}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  thumbnail: {
    width: 70,
    height: 95,
    backgroundColor: "#2a2a2a",
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  label: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 2,
  },
  episode: {
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  time: {
    color: "#888",
    fontSize: 11,
    marginBottom: 4,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  typeBadge: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seriesBadge: {
    backgroundColor: "#1a3a5a",
  },
  typeText: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "600",
  },
  reminderBadge: {
    backgroundColor: "#3a1a1a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reminderBadgeText: {
    color: "#e74c3c",
    fontSize: 10,
    fontWeight: "600",
  },
  bellButton: {
    justifyContent: "center",
    paddingHorizontal: 14,
  },
});
