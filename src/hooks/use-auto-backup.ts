import { useEffect, useRef } from "react";
import { backupFilename, buildBackup, encryptBackup, savePendingBackup } from "@/lib/backup";
import { toast } from "@/hooks/use-toast";
import { isGoogleDriveConnected, uploadBackupToGoogleDrive } from "@/lib/google-drive-backup";

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
  return raw === "manual" || raw === "weekly" || raw === "monthly" ? raw : "daily";
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

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;

    const runIfDue = async () => {
      if (cancelled || runningRef.current) return;
      const freq = getAutoBackupFreq();
      const lastRun = readStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY) || readStorage(window.localStorage, LAST_BACKUP_KEY);
      if (!isAutoBackupDue(freq, new Date(), lastRun)) return;

      runningRef.current = true;
      let fallbackName: string | null = null;
      let fallbackText: string | null = null;
      try {
        const payload = await buildBackup();
        const text = await encryptBackup(payload);
        const name = backupFilename();
        fallbackName = name;
        fallbackText = text;
        if (navigator.onLine) {
          const driveConnected = await isGoogleDriveConnected();
          if (driveConnected) {
            await uploadBackupToGoogleDrive(name, text, false);
          } else {
            // Record the attempt so focus/visibility events do not create a retry
            // loop, but do not claim that a backup was completed.
            const at = new Date().toISOString();
            writeStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY, at);
            toast({
              title: "Google Drive जुड़ा नहीं है",
              description: "ऑटो बैकअप सेव नहीं हुआ। Settings में Google Drive जोड़ें।",
            });
            return;
          }
        } else {
          savePendingBackup(text, name);
        }
        const at = new Date().toISOString();
        writeStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY, at);
        writeStorage(window.localStorage, LAST_BACKUP_KEY, at);
        window.dispatchEvent(new CustomEvent("auto-backup-completed", { detail: { at } }));
        toast({ title: navigator.onLine ? "✅ दैनिक बैकअप सेव हो गया / Daily backup saved" : "ऑफलाइन बैकअप तैयार है / Offline backup queued" });
      } catch (err: any) {
        // Keep the attempt timestamp to prevent an immediate re-fail loop. A
        // failed attempt must never update the last successful backup status.
        const at = new Date().toISOString();
        writeStorage(window.localStorage, AUTO_BACKUP_LAST_RUN_KEY, at);
        toast({
          title: "Google Drive बैकअप पूरा नहीं हुआ",
          description: err?.message || String(err),
          variant: "destructive",
        });
      } finally {
        runningRef.current = false;
      }
    };

    const check = () => {
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