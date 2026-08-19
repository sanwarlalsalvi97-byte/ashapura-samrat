// Native (Capacitor) integration helpers. Safe on web — every call
// checks `Capacitor.isNativePlatform()` before touching a plugin.

import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { Share } from "@capacitor/share";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = () => Capacitor.isNativePlatform();
export const isAndroidNative = () =>
  isNative() && Capacitor.getPlatform() === "android";

let initialised = false;

/** Boot native-only setup: splash, status bar, back button, keyboard. */
export async function initNative(onBack?: () => boolean) {
  if (initialised || !isNative()) return;
  initialised = true;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#0E7A3A" });
  } catch {}

  try {
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
  } catch {}

  // Android hardware back button: let caller decide; default = pop history / exit.
  CapApp.addListener("backButton", ({ canGoBack }) => {
    const handled = onBack?.() ?? false;
    if (handled) return;
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });

  // Deep links (OAuth callbacks, password reset emails): carry path + tokens into the SPA.
  CapApp.addListener("appUrlOpen", async ({ url }) => {
    try {
      const parsed = new URL(url);
      const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
      const query = parsed.searchParams;

      const isRecovery =
        hash.get("type") === "recovery" ||
        query.get("type") === "recovery" ||
        parsed.pathname.includes("reset-password");

      // Native Google OAuth callback (custom scheme) → establish the session here.
      if (!isRecovery) {
        try {
          const { supabase } = await import("@/integrations/supabase/client");
          const access_token = hash.get("access_token");
          const refresh_token = hash.get("refresh_token");
          const code = query.get("code");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            window.history.replaceState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
            return;
          }
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              window.history.replaceState({}, "", "/");
              window.dispatchEvent(new PopStateEvent("popstate"));
              return;
            }
          }
        } catch {}
      }

      // Fallback: forward path + params into the SPA router.
      const path = isRecovery
        ? "/reset-password"
        : parsed.protocol.startsWith("http")
        ? parsed.pathname || "/"
        : "/";
      window.history.pushState({}, "", `${path}${parsed.search}${parsed.hash}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {}
  });

  // Hide the native splash after first paint.
  setTimeout(() => {
    SplashScreen.hide().catch(() => {});
  }, 300);
}

/** Share arbitrary text/URL via the native share sheet, falling back to web share / clipboard. */
export async function shareText(opts: { title?: string; text?: string; url?: string }) {
  if (isNative()) {
    await Share.share(opts);
    return true;
  }
  if (navigator.share) {
    try { await navigator.share(opts); return true; } catch { /* cancelled */ }
  }
  const payload = [opts.title, opts.text, opts.url].filter(Boolean).join("\n");
  try { await navigator.clipboard.writeText(payload); return true; } catch {}
  return false;
}

/**
 * Save a text file. On native, writes to Documents/ and offers a share sheet.
 * On web, triggers a normal browser download.
 */
export async function saveTextFile(name: string, text: string, mime = "application/json") {
  if (isNative()) {
    const res = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    try {
      await Share.share({
        title: name,
        url: res.uri,
        dialogTitle: "Save / Share backup",
      });
    } catch { /* user cancelled */ }
    return res.uri;
  }
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return url;
}

/** Android notification channel used for the "हाजिरी का समय" alarm. */
export const ATTENDANCE_CHANNEL_ID = "attendance_alarm";

let channelReady = false;

/** Create (idempotently) the high-importance attendance channel with sound. */
export async function ensureAttendanceChannel(): Promise<void> {
  if (!isAndroidNative() || channelReady) return;
  try {
    await LocalNotifications.createChannel({
      id: ATTENDANCE_CHANNEL_ID,
      name: "हाजिरी अलार्म / Attendance time",
      description: "Daily reminder to mark attendance",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
      lights: true,
      lightColor: "#0E7A3A",
    });
    channelReady = true;
  } catch {}
}

/** Ensure notification permission on native devices. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }
  try {
    await ensureAttendanceChannel();
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Fire the attendance reminder immediately through the high-importance
 * channel (so Android plays the alert sound). Returns false on web.
 */
export async function showAttendanceNotification(
  title: string,
  body: string,
): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await ensureAttendanceChannel();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 100000),
          title,
          body,
          channelId: ATTENDANCE_CHANNEL_ID,
          sound: "default",
          smallIcon: "ic_stat_icon_config_sample",
          iconColor: "#0E7A3A",
          schedule: { at: new Date(Date.now() + 500), allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/** Open a URL using the native OS handler (used for UPI intents on Android). */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (isNative()) {
    try {
      // Use Browser plugin-less approach: window.open triggers Android intent handling.
      window.open(url, "_system");
      return true;
    } catch {
      return false;
    }
  }
  window.location.href = url;
  return true;
}
