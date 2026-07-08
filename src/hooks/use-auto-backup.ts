import { useEffect, useRef } from "react";
import { backupFilename, buildBackup, clearPendingBackup, downloadText, encryptBackup, readPendingBackup, savePendingBackup } from "@/lib/backup";
import { toast } from "@/hooks/use-toast";

export type AutoBackupFreq = "manual" | "daily" | "weekly" | "monthly";

export const AUTO_BACKUP_FREQ_KEY = "auto-backup-freq";
export const AUTO_BACKUP_PASSWORD_KEY = "auto-backup-session-password";
export const AUTO_BACKUP_LAST_RUN_KEY = "auto-backup-last-run";
export const AUTO_BACKUP_SETTINGS_EVENT = "auto-backup-settings-changed";

const LAST_BACKUP_KEY = "last-backup-at";
const CHECK_EVERY_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function readStorage(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {}
}

function removeStorage(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {}
}

export function getAutoBackupFreq(): AutoBackupFreq {
  const raw = readStorage(typeof window === "undefined" ? undefined : window.localStorage, AUTO_BACKUP_FREQ_KEY);
  return raw === "daily" || raw === "weekly" || raw === "monthly" ? raw : "manual";
}

export function getAutoBackupPassword(): string {
  return readStorage(typeof window === "undefined" ? undefined : window.sessionStorage, AUTO_BACKUP_PASSWORD_KEY) || "";
}

export function setAutoBackupPassword(password: string) {
  if (typeof window === "undefined") return;
  if (password.length > 0) writeStorage(window.sessionStorage, AUTO_BACKUP_PASSWORD_KEY, password);
  else removeStorage(window.sessionStorage, AUTO_BACKUP_PASSWORD_KEY);
  dispatchAutoBackupSettingsChanged();
}

export function dispatchAutoBackupSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTO_BACKUP_SETTINGS_EVENT));
}

export function isAutoBackupDue(freq: AutoBackupFreq, now = new Date(), lastRunRaw?: string | null): boolean {
  if (freq === "manual") return false;
  if (!lastRunRaw) return true;
  const last = new Date(lastRunRaw);
  if (Number.isNaN(last.getTime())) return true;
  if (freq === "daily") return now.getTime() - last.getTime() >= DAY_MS;
  if (freq === "weekly") return now.getTime() - last.getTime() >= 7 * DAY_MS;
  return now.getFullYear() !== last.getFullYear() || now.getMonth() !== last.getMonth();
}

export function useAutoBackup(enabled: boolean) {
  const runningRef = useRef(false);
  const passwordNoticeAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;

    const flushPendingDownload = () => {
      if (!navigator.onLine) return;
      const pending = readPendingBackup();
      if (!pending) return;
      downloadText(pending.name, pending.text);
      clearPendingBackup();
      toast({ title: "ऑफलाइन बैकअप डाउनलोड हो गया / Offline backup downloaded" });
    };

    const runIfDue = async () => {
      if (cancelled || runningRef.current) return;
      const freq = getAutoBackupFreq();
      const lastRun = readStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY) || readStorage(window.localStorage, LAST_BACKUP_KEY);
      if (!isAutoBackupDue(freq, new Date(), lastRun)) return;

      const password = getAutoBackupPassword();
      if (password.length < 6) {
        const now = Date.now();
        if (now - passwordNoticeAtRef.current > DAY_MS) {
          passwordNoticeAtRef.current = now;
          toast({
            title: "Auto backup password required",
            description: "Settings में backup password भरें ताकि scheduled backup बन सके।",
            variant: "destructive",
          });
        }
        return;
      }

      runningRef.current = true;
      try {
        const payload = await buildBackup();
        const text = await encryptBackup(payload, password);
        const name = backupFilename();
        if (navigator.onLine) {
          downloadText(name, text);
        } else {
          savePendingBackup(text, name);
        }
        const at = new Date().toISOString();
        writeStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY, at);
        writeStorage(window.localStorage, LAST_BACKUP_KEY, at);
        window.dispatchEvent(new CustomEvent("auto-backup-completed", { detail: { at } }));
        toast({ title: "✅ ऑटो बैकअप तैयार / Auto backup ready" });
      } catch (err: any) {
        toast({ title: "Auto backup failed", description: err?.message || String(err), variant: "destructive" });
      } finally {
        runningRef.current = false;
      }
    };

    const check = () => {
      flushPendingDownload();
      void runIfDue();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const interval = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    window.addEventListener(AUTO_BACKUP_SETTINGS_EVENT, check);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      window.removeEventListener(AUTO_BACKUP_SETTINGS_EVENT, check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}