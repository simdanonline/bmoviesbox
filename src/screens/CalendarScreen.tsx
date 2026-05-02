import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useUserData } from "../context/UserDataContext";
import MovieAPI from "../services/MovieAPI";
import CalendarEventCard from "../components/CalendarEventCard";
import { ReleaseEvent, TitleReminder } from "../types/app";
import {
  scheduleReminderNotification,
  cancelReminderNotification,
  requestNotificationPermission,
} from "../services/NotificationService";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";

function groupByDateSection(events: ReleaseEvent[]): Record<string, ReleaseEvent[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const nextWeek = new Date(today.getTime() + 7 * 86400000);

  const groups: Record<string, ReleaseEvent[]> = {
    Today: [],
    Tomorrow: [],
    "This Week": [],
    Later: [],
    Past: [],
  };

  for (const ev of events) {
    const d = new Date(ev.releaseAt);
    if (d < today) {
      groups["Past"].push(ev);
    } else if (d < tomorrow) {
      groups["Today"].push(ev);
    } else if (d < new Date(tomorrow.getTime() + 86400000)) {
      groups["Tomorrow"].push(ev);
    } else if (d < nextWeek) {
      groups["This Week"].push(ev);
    } else {
      groups["Later"].push(ev);
    }
  }

  return groups;
}

export default function CalendarScreen({
  navigation,
}: NativeStackScreenProps<any>) {
  const { reminders, addReminder, removeReminder, knownMetadata, getReminderForTitle } =
    useUserData();
  const [apiEvents, setApiEvents] = useState<ReleaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const from = now.toISOString().split("T")[0];
        const to = new Date(now.getTime() + 30 * 86400000)
          .toISOString()
          .split("T")[0];
        const events = await MovieAPI.getCalendar(from, to);
        setApiEvents(events);
      } catch {
        // Calendar endpoint may not exist
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build events from known metadata with future release dates
  const metadataEvents = useMemo((): ReleaseEvent[] => {
    const events: ReleaseEvent[] = [];
    const now = new Date();
    for (const meta of Object.values(knownMetadata)) {
      if (meta.releaseDate) {
        const d = new Date(meta.releaseDate);
        if (d >= now) {
          events.push({
            id: `meta_${meta.url}`,
            titleUrl: meta.url,
            title: meta.title,
            isSeries: meta.isSeries,
            thumbnail: meta.thumbnail,
            releaseAt: meta.releaseDate,
            source: "local_cache",
          });
        }
      }
    }
    return events;
  }, [knownMetadata]);

  // Build events from active reminders
  const reminderEvents = useMemo((): ReleaseEvent[] => {
    return reminders
      .filter((r) => r.active)
      .map((r) => ({
        id: `reminder_${r.id}`,
        titleUrl: r.titleUrl,
        title: r.title,
        isSeries: r.isSeries,
        thumbnail: knownMetadata[r.titleUrl]?.thumbnail ?? null,
        releaseAt: r.releaseAt,
        source: "reminder" as const,
      }));
  }, [reminders, knownMetadata]);

  // Merge and deduplicate
  const allEvents = useMemo(() => {
    const map = new Map<string, ReleaseEvent>();
    for (const ev of [...apiEvents, ...metadataEvents, ...reminderEvents]) {
      const key = `${ev.titleUrl}_${ev.releaseAt}_${ev.seasonNumber || ""}_${ev.episodeNumber || ""}`;
      if (!map.has(key)) {
        map.set(key, ev);
      }
    }
    const arr = Array.from(map.values());
    arr.sort(
      (a, b) => new Date(a.releaseAt).getTime() - new Date(b.releaseAt).getTime()
    );
    return arr;
  }, [apiEvents, metadataEvents, reminderEvents]);

  const grouped = useMemo(() => groupByDateSection(allEvents), [allEvents]);

  const handlePress = (event: ReleaseEvent) => {
    const meta = knownMetadata[event.titleUrl];
    if (event.isSeries) {
      navigation.navigate("SeriesDetails", { url: event.titleUrl });
    } else {
      const urlParts = event.titleUrl.split("/").filter(Boolean);
      const slug = urlParts[urlParts.length - 1];
      navigation.navigate("MovieDetails", {
        slug,
        movie: meta || { url: event.titleUrl, title: event.title },
      });
    }
  };

  const handleToggleReminder = useCallback(
    async (event: ReleaseEvent) => {
      const existing = getReminderForTitle(event.titleUrl);
      if (existing) {
        await cancelReminderNotification(existing.notificationId);
        removeReminder(existing.id);
        return;
      }

      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in Settings to receive reminders."
        );
        return;
      }

      const reminder: TitleReminder = {
        id: `${event.titleUrl}_${Date.now()}`,
        titleUrl: event.titleUrl,
        title: event.title,
        releaseAt: event.releaseAt,
        isSeries: event.isSeries,
        leadTime: "1_hour_before",
        notificationId: null,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const notificationId = await scheduleReminderNotification(reminder);
      addReminder({ ...reminder, notificationId });
    },
    [getReminderForTitle, removeReminder, addReminder]
  );

  const sectionOrder = ["Today", "Tomorrow", "This Week", "Later"];

  const hasAnyEvents = allEvents.length > 0;

  return (
    <SafeAreaView style={calStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={calStyles.header}>
          <Text style={calStyles.headerTitle}>Calendar</Text>
        </View>

        {loading && (
          <View style={calStyles.centered}>
            <ActivityIndicator size="large" color="#e74c3c" />
          </View>
        )}

        {!loading && !hasAnyEvents && (
          <View style={calStyles.emptyContainer}>
            <FontAwesome name="calendar-o" size={56} color="#333" />
            <Text style={calStyles.emptyText}>No upcoming releases</Text>
            <Text style={calStyles.emptySubText}>
              Browse movies and series to discover upcoming releases. You can
              also set reminders from title detail pages when a future release
              date is available.
            </Text>
          </View>
        )}

        {!loading &&
          sectionOrder.map((section) => {
            const items = grouped[section];
            if (!items || items.length === 0) return null;
            return (
              <View key={section} style={calStyles.section}>
                <Text style={calStyles.sectionTitle}>{section}</Text>
                {items.map((event) => (
                  <CalendarEventCard
                    key={event.id}
                    event={event}
                    hasReminder={!!getReminderForTitle(event.titleUrl)}
                    onPress={() => handlePress(event)}
                    onToggleReminder={() => handleToggleReminder(event)}
                  />
                ))}
              </View>
            );
          })}

        {/* Show active reminders summary */}
        {reminders.filter((r) => r.active).length > 0 && (
          <View style={calStyles.section}>
            <Text style={calStyles.sectionTitle}>
              Active Reminders ({reminders.filter((r) => r.active).length})
            </Text>
            <Text style={calStyles.reminderHint}>
              You'll be notified before these titles release. Tap the bell on
              any event to manage reminders.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const calStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  centered: {
    paddingTop: 60,
    alignItems: "center",
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubText: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  reminderHint: {
    color: "#888",
    fontSize: 13,
    lineHeight: 18,
  },
});
