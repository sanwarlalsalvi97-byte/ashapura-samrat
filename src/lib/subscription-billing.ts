import { Capacitor } from "@capacitor/core";
import { PlayBilling, type PlayPurchase } from "./play-billing";
import { loadTrial, verifyAndActivatePurchase } from "./premium";
import { supabase } from "@/integrations/supabase/client";
import { playAccountIdentifier } from "../../supabase/functions/_shared/play-account";

const processing = new Map<string, Promise<boolean>>();
const restoring = new Map<string, Promise<boolean>>();

async function accountId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("खरीद की जाँच के लिए पहले लॉग इन करें।");
  return user.id;
}

export async function purchasePlaySubscription(productId: string): Promise<boolean> {
  const userId = await accountId();
  const purchase = await PlayBilling.purchaseSubscription({ productId, obfuscatedAccountId: await playAccountIdentifier(userId) });
  if (await accountId() !== userId) throw new Error("ऐप अकाउंट बदल गया है। सही अकाउंट से रीस्टोर करें।");
  return processPlayPurchase(purchase);
}

export function billingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/not implemented|not available/i.test(message)) {
    return "इस इंस्टॉल ऐप में भुगतान सुविधा नहीं मिली। नवीनतम पूरा Android ऐप इंस्टॉल करें।";
  }
  return message || "भुगतान की पुष्टि नहीं हो पाई। ऐप दोबारा खोलने पर खरीद फिर जाँची जाएगी।";
}

/** Only server-verified PURCHASED subscriptions may be acknowledged. */
export async function processPlayPurchase(purchase: PlayPurchase): Promise<boolean> {
  if (purchase.purchaseState !== "PURCHASED") return false;
  const userId = await accountId();
  const key = `${userId}:${purchase.purchaseToken}`;
  const existing = processing.get(key);
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
    if (await accountId() !== userId) throw new Error("ऐप अकाउंट बदल गया है। सही अकाउंट से रीस्टोर करें।");
    if (!purchase.acknowledged) {
      await PlayBilling.acknowledgePurchase({ purchaseToken: purchase.purchaseToken });
    }
    return true;
  })().finally(() => processing.delete(key));
  processing.set(key, task);
  return task;
}

/** The same query/verify/acknowledge flow is used by both buttons and lifecycle recovery. */
export async function restorePlaySubscriptions(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  const userId = await accountId();
  const existing = restoring.get(userId);
  if (existing) return existing;
  const task = (async () => {
    const { purchases } = await PlayBilling.restoreSubscriptions();
    let active = false;
    let failure: unknown;
    for (const purchase of purchases) {
      if (await accountId() !== userId) throw new Error("ऐप अकाउंट बदल गया है। रीस्टोर दोबारा करें।");
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
  })().finally(() => { restoring.delete(userId); });
  restoring.set(userId, task);
  return task;
}