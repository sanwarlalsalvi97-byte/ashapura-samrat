// Offline queue for attendance changes.
// When the user is offline, attendance entries are saved to localStorage
// and automatically flushed to Supabase when connection returns.

import { supabase } from "@/integrations/supabase/client";
import type { AttendanceInsert } from "@/lib/supabase-helpers";

const ATTENDANCE_UPDATED_EVENT = "attendance-updated";

function notifyAttendanceUpdated() {
  try {
    window.dispatchEvent(new Event(ATTENDANCE_UPDATED_EVENT));
  } catch {}
}

const QUEUE_KEY = "hajiri-offline-queue-v1";

export type QueuedAttendance = {
  id: string; // local id (worker_id + date) — used to dedupe
  payload: AttendanceInsert;
  queuedAt: number;
};

function readQueue(): QueuedAttendance[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAttendance[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => {
    try { l(); } catch {}
  });
}

export function subscribeQueue(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getQueueCount() {
  return readQueue().length;
}

export function getQueue() {
  return readQueue();
}

const SIMULATE_OFFLINE_KEY = "hajiri-simulate-offline";

export function isSimulatedOffline() {
  try {
    return localStorage.getItem(SIMULATE_OFFLINE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSimulatedOffline(on: boolean) {
  try {
    if (on) localStorage.setItem(SIMULATE_OFFLINE_KEY, "1");
    else localStorage.removeItem(SIMULATE_OFFLINE_KEY);
  } catch {}
  notify();
}

export function isOnline() {
  if (isSimulatedOffline()) return false;
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function enqueueAttendance(payload: AttendanceInsert) {
  const items = readQueue();
  const id = `${payload.worker_id}__${payload.date}`;
  // Replace any existing entry for the same worker+date (latest wins).
  const filtered = items.filter((i) => i.id !== id);
  filtered.push({ id, payload, queuedAt: Date.now() });
  writeQueue(filtered);
}

let flushing = false;

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  if (!isOnline()) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = readQueue();
    if (items.length === 0) return { ok: 0, failed: 0 };

    const remaining: QueuedAttendance[] = [];
    for (const item of items) {
      try {
        const { error } = await supabase
          .from("attendance")
          .upsert(item.payload, { onConflict: "worker_id,date" });
        if (error) {
          failed++;
          remaining.push(item);
        } else {
          ok++;
        }
      } catch {
        failed++;
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    if (ok > 0) notifyAttendanceUpdated();
    return { ok, failed };
  } finally {
    flushing = false;
  }
}
