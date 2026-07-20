// Simple premium/free plan gate. Play Billing verification is expected to
// call setPremium(true) after a successful subscription purchase in the
// native Android layer. Until then, this key is set manually or by the
// billing bridge (see ANDROID_RELEASE.md).

const KEY = "as_premium_v1";
export const FREE_WORKER_LIMIT = 5;

export function isPremium(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPremium(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("premium-updated"));
  } catch {}
}

export function canAddWorker(currentCount: number): boolean {
  if (isPremium()) return true;
  return currentCount < FREE_WORKER_LIMIT;
}
