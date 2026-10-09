import { Capacitor } from "@capacitor/core";
import { PlayBilling, type PlayPurchase } from "./play-billing";
import { loadTrial, verifyAndActivatePurchase } from "./premium";

const processing = new Map<string, Promise<boolean>>();
let restoring: Promise<boolean> | null = null;

export function billingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/not implemented|not available/i.test(message)) {
    return "इस इंस्टॉल ऐप में भुगतान सुविधा नहीं मिली। नवीनतम पूरा Android ऐप इंस्टॉल करें।";
  }
  return message || "भुगतान की पुष्टि नहीं हो पाई। ऐप दोबारा खोलने पर खरीद फिर जाँची जाएगी।";
}

/** Only server-verified PURCHASED subscriptions may be acknowledged. */
export function processPlayPurchase(purchase: PlayPurchase): Promise<boolean> {
  if (purchase.purchaseState !== "PURCHASED") return Promise.resolve(false);
  const existing = processing.get(purchase.purchaseToken);
  if (existing) return existing;
  const task = (async () => {
    const verification = await verifyAndActivatePurchase({
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken,
      type: "subs",
    });
    if (!verification.ok) {
      throw new Error("खरीद की पुष्टि अभी नहीं हो पाई। अगली बार ऐप खोलने या रीस्टोर करने पर फिर जाँच होगी।");
    }
    if (!verification.premium) return false;
    if (!purchase.acknowledged) {
      await PlayBilling.acknowledgePurchase({ purchaseToken: purchase.purchaseToken });
    }
    return true;
  })().finally(() => processing.delete(purchase.purchaseToken));
  processing.set(purchase.purchaseToken, task);
  return task;
}

/** The same query/verify/acknowledge flow is used by both buttons and lifecycle recovery. */
export function restorePlaySubscriptions(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return Promise.resolve(false);
  if (restoring) return restoring;
  restoring = (async () => {
    const { purchases } = await PlayBilling.restoreSubscriptions();
    let active = false;
    let failure: unknown;
    for (const purchase of purchases) {
      try {
        active = (await processPlayPurchase(purchase)) || active;
      } catch (error) {
        failure = error;
      }
    }
    // Query all purchases even if one failed; do not hide an acknowledgement failure.
    if (failure) throw failure;
    await loadTrial();
    return active;
  })().finally(() => { restoring = null; });
  return restoring;
}