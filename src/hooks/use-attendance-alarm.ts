import { useEffect, useRef } from "react";
import { getWorkTime, todayKey, WORK_TIME_KEYS } from "@/lib/work-time";
import {
  ensureAttendanceChannel,
  ensureNotificationPermission,
  isNative,
  showAttendanceNotification,
} from "@/lib/native";

const TITLE = "हाजिरी का समय!";
const BODY = "आज की हाजिरी लगाना न भूलें 🙏";

/** Short beep so the web/PWA notification is also audible. */
function playAlertSound() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const beep = (start: number, freq: number) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.32);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.35);
    };
    beep(0, 880);
    beep(0.4, 1046);
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

/**
 * Schedules a daily attendance notification at the user's alarm time.
 * On Android it goes through the high-importance `attendance_alarm`
 * channel (sound + vibration); on web it falls back to the Notification
 * API plus an audible beep.
 */
export function useAttendanceAlarm() {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    ensureAttendanceChannel();

    const tick = async () => {
      const { alarmEnabled, alarmTime } = getWorkTime();
      if (!alarmEnabled) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      if (`${hh}:${mm}` !== alarmTime) return;

      const today = todayKey();
      if (localStorage.getItem(WORK_TIME_KEYS.lastAlarmDate) === today) return;

      if (isNative()) {
        const ok = await showAttendanceNotification(TITLE, BODY);
        if (!ok) return;
        localStorage.setItem(WORK_TIME_KEYS.lastAlarmDate, today);
        return;
      }

      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      localStorage.setItem(WORK_TIME_KEYS.lastAlarmDate, today);
      try {
        new Notification(TITLE, {
          body: BODY,
          icon: "/favicon.ico",
          tag: "hajiri-alarm",
          silent: false,
        });
        playAlertSound();
      } catch {}
    };

    void tick();
    timerRef.current = window.setInterval(() => void tick(), 30_000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);
}

export async function requestNotificationPermission(): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (granted) await ensureAttendanceChannel();
  return granted;
}
