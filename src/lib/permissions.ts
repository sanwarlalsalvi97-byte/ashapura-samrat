// Unified runtime permission helper.
//
// On native Android it goes through the `NativePermissions` Capacitor plugin
// (registered in MainActivity) so every permission declared in
// AndroidManifest.xml can be requested and shows up under
// App Settings → Permissions. On web it degrades to the closest browser API.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native";

export type PermissionGroup =
  | "camera"
  | "microphone"
  | "location"
  | "contacts"
  | "notifications";

interface NativePermissionsPlugin {
  check(options: { group: PermissionGroup }): Promise<{ group: string; granted: boolean }>;
  request(options: { group: PermissionGroup }): Promise<{ group: string; granted: boolean }>;
  checkAll(): Promise<Record<string, boolean | string[]>>;
  openAppSettings(): Promise<void>;
}

const NativePermissions = registerPlugin<NativePermissionsPlugin>("NativePermissions");

const isAndroid = () => isNative() && Capacitor.getPlatform() === "android";

/** Human labels for UI (Hindi + English). */
export const PERMISSION_LABELS: Record<PermissionGroup, string> = {
  camera: "कैमरा / Camera",
  microphone: "माइक्रोफ़ोन / Microphone",
  location: "लोकेशन / Location",
  photos: "फ़ोटो / Photos",
  storage: "स्टोरेज / Storage",
  contacts: "कॉन्टैक्ट्स / Contacts",
  notifications: "नोटिफिकेशन / Notifications",
};

/** Web fallbacks so the same call works in the PWA/preview. */
async function webRequest(group: PermissionGroup): Promise<boolean> {
  try {
    switch (group) {
      case "camera":
      case "microphone": {
        if (!navigator.mediaDevices?.getUserMedia) return false;
        const stream = await navigator.mediaDevices.getUserMedia(
          group === "camera" ? { video: true } : { audio: true },
        );
        stream.getTracks().forEach((t) => t.stop());
        return true;
      }
      case "location":
        return await new Promise<boolean>((resolve) => {
          if (!navigator.geolocation) return resolve(false);
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 10000 },
          );
        });
      case "notifications": {
        if (typeof Notification === "undefined") return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;
        return (await Notification.requestPermission()) === "granted";
      }
      case "contacts":
        return "contacts" in navigator;
      case "photos":
      case "storage":
        return true; // file input / download API needs no permission on web
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/** Check without prompting. */
export async function checkPermission(group: PermissionGroup): Promise<boolean> {
  if (!isAndroid()) {
    if (group === "notifications" && typeof Notification !== "undefined") {
      return Notification.permission === "granted";
    }
    return true;
  }
  try {
    const res = await NativePermissions.check({ group });
    return !!res.granted;
  } catch {
    return false;
  }
}

/** Prompt the user. Resolves true once every underlying permission is granted. */
export async function requestPermission(group: PermissionGroup): Promise<boolean> {
  if (!isAndroid()) return webRequest(group);
  try {
    const res = await NativePermissions.request({ group });
    return !!res.granted;
  } catch {
    return false;
  }
}

/** Request several groups in sequence (Android shows one dialog per group). */
export async function requestPermissions(
  groups: PermissionGroup[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const g of groups) out[g] = await requestPermission(g);
  return out;
}

/** Snapshot of all groups — for a diagnostics/settings screen. */
export async function checkAllPermissions(): Promise<Record<PermissionGroup, boolean>> {
  const groups: PermissionGroup[] = [
    "camera",
    "microphone",
    "location",
    "photos",
    "storage",
    "contacts",
    "notifications",
  ];
  if (!isAndroid()) {
    const entries = await Promise.all(groups.map(async (g) => [g, await checkPermission(g)] as const));
    return Object.fromEntries(entries) as Record<PermissionGroup, boolean>;
  }
  try {
    const res = (await NativePermissions.checkAll()) as Record<string, boolean>;
    return Object.fromEntries(groups.map((g) => [g, !!res[g]])) as Record<PermissionGroup, boolean>;
  } catch {
    return Object.fromEntries(groups.map((g) => [g, false])) as Record<PermissionGroup, boolean>;
  }
}

/** Open the OS App Info screen so the user can flip a denied permission. */
export async function openAppSettings(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await NativePermissions.openAppSettings();
  } catch {}
}

/**
 * Convenience wrappers used by features.
 * Each returns true when the feature may proceed.
 */
export const ensureCameraPermission = () => requestPermission("camera");
export const ensureMicrophonePermission = () => requestPermission("microphone");
export const ensurePhotosPermission = () => requestPermission("photos");
export const ensureContactsPermission = () => requestPermission("contacts");
export const ensureLocationPermissionNative = () => requestPermission("location");
export const ensureNotificationsPermission = () => requestPermission("notifications");
