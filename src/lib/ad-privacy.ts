// Runtime smoke test: proves Advertising ID / AdServices reporting is OFF.
// On native Android it queries the merged manifest of the installed build via
// the AdPrivacy plugin. On web it returns a "not applicable" result.

import { registerPlugin } from "@capacitor/core";
import { isAndroidNative } from "./native";

export interface AdPrivacyReport {
  ok: boolean;
  platform: "android" | "web";
  packageName?: string;
  versionName?: string;
  versionCode?: number;
  violations: string[];
  analyticsFlags: Record<string, boolean>;
  declaredPermissions?: string[];
  error?: string;
}

interface AdPrivacyPlugin {
  check(): Promise<{
    ok: boolean;
    packageName: string;
    versionName: string;
    versionCode: number;
    violations: string[];
    declaredPermissions: string[];
    analyticsFlags: Record<string, boolean>;
  }>;
}

const AdPrivacy = registerPlugin<AdPrivacyPlugin>("AdPrivacy");

/** Expected: every ad-related Analytics flag false and no ad permissions. */
export async function runAdPrivacyCheck(): Promise<AdPrivacyReport> {
  if (!isAndroidNative()) {
    return {
      ok: true,
      platform: "web",
      violations: [],
      analyticsFlags: {},
      error: "web-build: native manifest not applicable",
    };
  }
  try {
    const res = await AdPrivacy.check();
    return {
      ok: res.ok,
      platform: "android",
      packageName: res.packageName,
      versionName: res.versionName,
      versionCode: res.versionCode,
      violations: res.violations ?? [],
      analyticsFlags: res.analyticsFlags ?? {},
      declaredPermissions: res.declaredPermissions ?? [],
    };
  } catch (e: any) {
    return {
      ok: false,
      platform: "android",
      violations: [],
      analyticsFlags: {},
      error: e?.message ?? String(e),
    };
  }
}

/** Human-readable log line, also printed to logcat/console on app boot. */
export function formatAdPrivacyReport(r: AdPrivacyReport): string {
  const flags = Object.entries(r.analyticsFlags)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return [
    `[AdPrivacy] platform=${r.platform} ok=${r.ok}`,
    r.versionName ? `version=${r.versionName} (${r.versionCode})` : "",
    r.violations.length ? `violations=${r.violations.join(",")}` : "violations=none",
    flags ? `flags: ${flags}` : "",
    r.error ? `note: ${r.error}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}
