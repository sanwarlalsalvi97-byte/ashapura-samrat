// Crashlytics bridge: reports JavaScript errors from the WebView to Firebase.
// Safe on web — every call no-ops unless running on a native platform.

import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";
import { isNative } from "./native";

let installed = false;

function stringifyError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    return { message: `${err.name}: ${err.message}`, stack: err.stack };
  }
  try {
    return { message: String(err) };
  } catch {
    return { message: "Unknown error" };
  }
}

/** Log a non-fatal JS error to Crashlytics (no-op on web). */
export async function logJsError(err: unknown, context?: string) {
  if (!isNative()) return;
  const { message, stack } = stringifyError(err);
  try {
    if (context) {
      await FirebaseCrashlytics.setCustomKey({
        key: "js_context",
        value: context,
        type: "string",
      });
    }
    await FirebaseCrashlytics.log({ message: stack ? `${message}\n${stack}` : message });
    await FirebaseCrashlytics.recordException({ message });
  } catch {
    /* never let reporting break the app */
  }
}

/** Attach the signed-in user so crashes can be traced back (no-op on web). */
export async function setCrashlyticsUser(userId: string | null) {
  if (!isNative()) return;
  try {
    await FirebaseCrashlytics.setUserId({ userId: userId ?? "" });
  } catch {}
}

/** Install global window error / unhandled rejection handlers. */
export function initCrashlytics() {
  if (installed) return;
  installed = true;

  if (!isNative()) return;

  try {
    FirebaseCrashlytics.setEnabled({ enabled: true }).catch(() => {});
  } catch {}

  window.addEventListener("error", (event) => {
    void logJsError(event.error ?? event.message, "window.onerror");
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logJsError(event.reason, "unhandledrejection");
  });
}
