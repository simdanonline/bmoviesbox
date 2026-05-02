import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { TitleReminder, LEAD_TIME_LABELS } from "../types/app";

let permissionGranted: boolean | null = null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") {
    permissionGranted = true;
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  permissionGranted = status === "granted";
  return permissionGranted;
}

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (permissionGranted !== null) return permissionGranted;
  const { status } = await Notifications.getPermissionsAsync();
  permissionGranted = status === "granted";
  return permissionGranted;
}

function getNotificationDate(releaseAt: string, leadTime: TitleReminder["leadTime"]): Date {
  const release = new Date(releaseAt);
  switch (leadTime) {
    case "1_hour_before":
      return new Date(release.getTime() - 60 * 60 * 1000);
    case "1_day_before":
      return new Date(release.getTime() - 24 * 60 * 60 * 1000);
    case "at_time":
    default:
      return release;
  }
}

export async function scheduleReminderNotification(
  reminder: TitleReminder
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return null;

  const triggerDate = getNotificationDate(reminder.releaseAt, reminder.leadTime);
  const now = new Date();

  if (triggerDate <= now) return null;

  const secondsUntil = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${reminder.isSeries ? "Series" : "Movie"} Reminder`,
        body: `${reminder.title} — ${LEAD_TIME_LABELS[reminder.leadTime]}`,
        data: { titleUrl: reminder.titleUrl, reminderId: reminder.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
        repeats: false,
      },
    });
    return id;
  } catch (e) {
    console.error("Failed to schedule notification:", e);
    return null;
  }
}

export async function cancelReminderNotification(
  notificationId: string | null
): Promise<void> {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (e) {
    console.error("Failed to cancel notification:", e);
  }
}

export function setupNotificationHandler(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
