// Geolocation helpers: Capacitor-native on device, browser API on web.
import { Geolocation } from "@capacitor/geolocation";
import { isNative } from "@/lib/native";

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/** Great-circle distance between two points, in meters (Haversine). */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000; // earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Ask for location permission (native) — resolves true when usable. */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNative()) return typeof navigator !== "undefined" && !!navigator.geolocation;
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
    const req = await Geolocation.requestPermissions();
    return req.location === "granted";
  } catch {
    return false;
  }
}

/** Current high-accuracy position. Throws with a readable message on failure. */
export async function getCurrentCoords(): Promise<Coords> {
  const ok = await ensureLocationPermission();
  if (!ok) throw new Error("Location permission नहीं मिली — कृपया अनुमति दें।");

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`GPS location नहीं मिली (${msg}). Location ON करके दोबारा कोशिश करें।`);
  }
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
