// UPI deep-link helper. Generates the standard upi:// URI plus an
// intent:// fallback that works reliably in Android Chrome / installed PWA
// / Samsung Internet, and detects whether an app is likely to open.

import { isAndroidNative, openExternalUrl } from "./native";

export interface UpiPayParams {
  payeeVpa: string;   // e.g. 9876543210@upi
  payeeName: string;  // shown in the UPI app
  amount?: number;    // INR
  note?: string;      // remark
  txnRef?: string;    // transaction ref id
}

export function isValidUpiId(vpa: string): boolean {
  return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa.trim());
}

function buildQuery(p: UpiPayParams): string {
  const params = new URLSearchParams();
  params.set("pa", p.payeeVpa.trim());
  params.set("pn", p.payeeName);
  params.set("cu", "INR");
  if (p.amount && p.amount > 0) params.set("am", p.amount.toFixed(2));
  if (p.note) params.set("tn", p.note.slice(0, 80));
  if (p.txnRef) params.set("tr", p.txnRef);
  return params.toString();
}

export function buildUpiLink(p: UpiPayParams): string {
  return `upi://pay?${buildQuery(p)}`;
}

/** Android intent:// fallback that opens the UPI chooser reliably. */
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
  // iOS Safari legacy
  const ios = (navigator as any).standalone === true;
  return !!(mq || ios);
}

/**
 * Try to launch a UPI app.
 * Returns a promise that resolves with `true` if the browser appears to
 * have switched context (likely opened a UPI app) and `false` if nothing
 * happened after ~1.5s (user should be shown the fallback UI).
 */
export function launchUpi(p: UpiPayParams): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }

    const upiUrl = buildUpiLink(p);
    const intentUrl = buildUpiIntentLink(p);
    const started = Date.now();
    let done = false;

    const finish = (opened: boolean) => {
      if (done) return;
      done = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      resolve(opened);
    };

    const onVis = () => { if (document.hidden) finish(true); };
    const onHide = () => finish(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);

    // If the page is still here after 1500ms and we never hid, assume nothing opened.
    window.setTimeout(() => {
      if (Date.now() - started >= 1400) finish(false);
    }, 1500);

    try {
      if (isAndroidNative()) {
        // Native Android WebView: use the OS URL handler so the UPI intent
        // resolves against the real Android chooser.
        openExternalUrl(intentUrl);
        window.setTimeout(() => { if (!done) openExternalUrl(upiUrl); }, 300);
      } else if (isAndroid()) {
        // Prefer intent:// on Android — works in Chrome, Samsung, PWA.
        window.location.href = intentUrl;
        // Also queue upi:// as a backup for browsers that don't honour intent://
        window.setTimeout(() => { if (!done) window.location.href = upiUrl; }, 250);
      } else {
        window.location.href = upiUrl;
      }
    } catch {
      finish(false);
    }
  });
}
