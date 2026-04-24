// Helpers for work time + alarm settings (saved in localStorage)

export const WORK_TIME_KEYS = {
  checkIn: "hajiri-checkin-time",   // "08:00"
  checkOut: "hajiri-checkout-time", // "18:00"
  alarmTime: "hajiri-alarm-time",   // "09:00"
  alarmEnabled: "hajiri-alarm-enabled", // "1" | "0"
  lastAlarmDate: "hajiri-alarm-last", // YYYY-MM-DD
} as const;

export function getWorkTime() {
  return {
    checkIn: localStorage.getItem(WORK_TIME_KEYS.checkIn) || "08:00",
    checkOut: localStorage.getItem(WORK_TIME_KEYS.checkOut) || "18:00",
    alarmTime: localStorage.getItem(WORK_TIME_KEYS.alarmTime) || "09:00",
    alarmEnabled: localStorage.getItem(WORK_TIME_KEYS.alarmEnabled) !== "0",
  };
}

export function setWorkTime(v: {
  checkIn: string;
  checkOut: string;
  alarmTime: string;
  alarmEnabled: boolean;
}) {
  localStorage.setItem(WORK_TIME_KEYS.checkIn, v.checkIn);
  localStorage.setItem(WORK_TIME_KEYS.checkOut, v.checkOut);
  localStorage.setItem(WORK_TIME_KEYS.alarmTime, v.alarmTime);
  localStorage.setItem(WORK_TIME_KEYS.alarmEnabled, v.alarmEnabled ? "1" : "0");
}

export function formatTime12h(t: string) {
  if (!t || !t.includes(":")) return t;
  const [hStr, m] = t.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
