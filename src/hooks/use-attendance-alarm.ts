import { useEffect, useRef } from "react";
import { getWorkTime, todayKey, WORK_TIME_KEYS } from "@/lib/work-time";

/**
 * Schedules a daily browser notification at the user's alarm time.
 * Checks every minute. Only fires once per day.
 */
export function useAttendanceAlarm() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const { alarmEnabled, alarmTime } = getWorkTime();
      if (!alarmEnabled) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const current = `${hh}:${mm}`;
      if (current !== alarmTime) return;

      const today = todayKey();
      const last = localStorage.getItem(WORK_TIME_KEYS.lastAlarmDate);
      if (last === today) return;
      localStorage.setItem(WORK_TIME_KEYS.lastAlarmDate, today);

      try {
        new Notification("हाजिरी का समय!", {
          body: "आज की हाजिरी लगाना न भूलें 🙏",
          icon: "/favicon.ico",
          tag: "hajiri-alarm",
        });
      } catch {}
    };

    tick();
    timerRef.current = window.setInterval(tick, 30_000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}
