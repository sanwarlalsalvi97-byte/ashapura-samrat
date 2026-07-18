// UPI deep-link helper. On Capacitor Android we use @capacitor/app-launcher
// to open the UPI intent directly through the OS (no WebView / browser hop).
// On web/PWA we fall back to the existing intent:// + upi:// browser flow.

import { AppLauncher } from "@capacitor/app-launcher";
import { isAndroidNative } from "./native";

export interface UpiPayParams {
  payeeVpa: string;   // e.g. 9876543210@upi
  payeeName: string;  // shown in the UPI app
  amount?: number;    // INR
  note?: string;      // remark
  txnRef?: string;    // transaction ref id
}

export interface UpiLaunchResult {
  opened: boolean;
  platform: "android-native" | "android-web" | "web";
  fallbackUsed: "none" | "upi-scheme" | "intent-scheme" | "app-launcher-failed";
  error?: string;
}

export function isValidUpiId(vpa: string): boolean {
  return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa.trim());
}

export function validateUpiParams(p: UpiPayParams): string | null {
  if (!p.payeeVpa || !isValidUpiId(p.payeeVpa)) return "Invalid UPI ID";
  if (!p.payeeName || !p.payeeName.trim()) return "Payee name is required";
  if (p.amount !== undefined && !(p.amount > 0)) return "Amount must be greater than 0";
  return null;
}

function buildQuery(p: UpiPayParams): string {
  // URLSearchParams encodes each value with encodeURIComponent semantics.
  const params = new URLSearchParams();
  params.set("pa", p.payeeVpa.trim());
  params.set("pn", p.payeeName.trim());
  if (p.amount && p.amount > 0) params.set("am", p.amount.toFixed(2));
  if (p.note) params.set("tn", p.note.slice(0, 80));
  if (p.txnRef) params.set("tr", p.txnRef);
  params.set("cu", "INR");
  return params.toString();
}

export function buildUpiLink(p: UpiPayParams): string {
  return `upi://pay?${buildQuery(p)}`;
}

/** Android intent:// fallback for browser/PWA contexts. */
export function buildUpiIntentLink(p: UpiPayParams): string {
  const q = buildQuery(p);
  return `intent://pay?${q}#Intent;scheme=upi;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)").matches;
  const ios = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!(mq || ios);
}

/**
 * Launch the installed UPI app.
 * - Capacitor Android: uses AppLauncher.openUrl (OS-level intent, no WebView).
 * - Web/PWA: uses intent:// then upi:// with visibility heuristics.
 */
export async function launchUpi(p: UpiPayParams): Promise<UpiLaunchResult> {
  const err = validateUpiParams(p);
  if (err) {
    console.warn("[UPI] validation failed:", err);
    return { opened: false, platform: isAndroidNative() ? "android-native" : (isAndroid() ? "android-web" : "web"), fallbackUsed: "none", error: err };
  }

  const upiUrl = buildUpiLink(p);

  // ---- Native Android (Capacitor) ----
  if (isAndroidNative()) {
    console.log("[UPI] platform=android-native uri=", upiUrl);
    try {
      const canOpen = await AppLauncher.canOpenUrl({ url: upiUrl }).catch(() => ({ value: true }));
      console.log("[UPI] canOpenUrl=", canOpen);
      const res = await AppLauncher.openUrl({ url: upiUrl });
      console.log("[UPI] AppLauncher.openUrl result=", res);
      if (res?.completed) {
        return { opened: true, platform: "android-native", fallbackUsed: "none" };
      }
      return { opened: false, platform: "android-native", fallbackUsed: "app-launcher-failed", error: "No UPI app handled the intent" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[UPI] AppLauncher exception:", msg);
      return { opened: false, platform: "android-native", fallbackUsed: "app-launcher-failed", error: msg };
    }
  }

  // ---- Web / Android Chrome / PWA ----
  const platform: UpiLaunchResult["platform"] = isAndroid() ? "android-web" : "web";
  const intentUrl = buildUpiIntentLink(p);
  console.log("[UPI] platform=", platform, "uri=", upiUrl);

  return await new Promise<UpiLaunchResult>((resolve) => {
    if (typeof window === "undefined") { resolve({ opened: false, platform, fallbackUsed: "none" }); return; }
    const started = Date.now();
    let done = false;
    let fallback: UpiLaunchResult["fallbackUsed"] = "upi-scheme";

    const finish = (opened: boolean) => {
      if (done) return;
      done = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      console.log("[UPI] web finish opened=", opened, "fallback=", fallback);
      resolve({ opened, platform, fallbackUsed: fallback });
    };
    const onVis = () => { if (document.hidden) finish(true); };
    const onHide = () => finish(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);

    window.setTimeout(() => { if (Date.now() - started >= 1400) finish(false); }, 1500);

    try {
      if (isAndroid()) {
        fallback = "intent-scheme";
        window.location.href = intentUrl;
        window.setTimeout(() => { if (!done) { fallback = "upi-scheme"; window.location.href = upiUrl; } }, 250);
      } else {
        window.location.href = upiUrl;
      }
    } catch (e) {
      console.error("[UPI] web launch exception:", e);
      finish(false);
    }
  });
}
