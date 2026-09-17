import { LocalNotifications } from "@capacitor/local-notifications";
import { ensureAttendanceChannel, ensureNotificationPermission, isNative } from "@/lib/native";

export type ReminderId = "morning" | "evening" | "summary" | "cashbook";

export type ReminderSetting = {
  id: ReminderId;
  enabled: boolean;
  time: string;
};

export const NOTIFICATION_SETTINGS_KEY = "ashapura-notification-settings-v1";

export const DEFAULT_REMINDERS: ReminderSetting[] = [
  { id: "morning", enabled: false, time: "08:00" },
  { id: "evening", enabled: false, time: "19:00" },
  { id: "summary", enabled: false, time: "20:00" },
  { id: "cashbook", enabled: false, time: "19:30" },
];

const NOTIFICATION_IDS: Record<ReminderId, number> = {
  morning: 8101,
  evening: 8102,
  summary: 8103,
  cashbook: 8104,
};

const COPY: Record<ReminderId, { title: string; body: string }> = {
  morning: {
    title: "सुबह की हाज़िरी रिमाइंडर",
    body: "सुबह की हाज़िरी दर्ज करने का समय हो गया है।",
  },
  evening: {
    title: "शाम की हाज़िरी रिमाइंडर",
    body: "आज की हाज़िरी जाँच लें और अधूरी एंट्री पूरी करें।",
  },
  summary: {
    title: "हाज़िरी सारांश",
    body: "मज़दूरों की आज की हाज़िरी का सारांश देखें।",
  },
  cashbook: {
    title: "कैश एंट्री रिमाइंडर",
    body: "आज के नकद लेनदेन कैशबुक में दर्ज करें।",
  },
};

export function loadNotificationSettings(): ReminderSetting[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY) || "[]") as Partial<ReminderSetting>[];
    return DEFAULT_REMINDERS.map((fallback) => {
      const saved = parsed.find((item) => item.id === fallback.id);
      return {
        ...fallback,
        enabled: typeof saved?.enabled === "boolean" ? saved.enabled : fallback.enabled,
        time: /^\d{2}:\d{2}$/.test(saved?.time || "") ? String(saved?.time) : fallback.time,
      };
    });
  } catch {
    return DEFAULT_REMINDERS.map((item) => ({ ...item }));
  }
}

export function saveNotificationSettings(settings: ReminderSetting[]): void {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

export async function syncScheduledReminders(settings: ReminderSetting[]): Promise<"scheduled" | "web" | "denied"> {
  if (!isNative()) return "web";

  const enabled = settings.filter((item) => item.enabled);
  if (enabled.length > 0 && !(await ensureNotificationPermission())) return "denied";

  await ensureAttendanceChannel();
  await LocalNotifications.cancel({
    notifications: Object.values(NOTIFICATION_IDS).map((id) => ({ id })),
  });

  if (enabled.length > 0) {
    await LocalNotifications.schedule({
      notifications: enabled.map((item) => {
        const [hour = 0, minute = 0] = item.time.split(":").map(Number);
        return {
          id: NOTIFICATION_IDS[item.id],
          title: COPY[item.id].title,
          body: COPY[item.id].body,
          channelId: "attendance_alarm",
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#0E7A3A",
          schedule: {
            on: { hour, minute },
            repeats: true,
            allowWhileIdle: true,
          },
        };
      }),
    });
  }

  return "scheduled";
}