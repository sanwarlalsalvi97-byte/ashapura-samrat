// Premium/free plan gate. Purchases from Google Play Billing must be
// verified server-side (see supabase/functions/verify-play-purchase) before
// we flip the local flag to premium.

import { supabase } from "@/integrations/supabase/client";

const KEY = "as_premium_v1";
const RECEIPT_KEY = "as_premium_receipt_v1";
const TRIAL_KEY = "as_trial_v1";
/** Free trial: 3 months from sign-up, up to 7 workers. */
export const FREE_WORKER_LIMIT = 7;
export const TRIAL_MONTHS = 3;

export type TrialInfo = {
  trialEndsAt: string | null; // ISO
  active: boolean;
};

let trialCache: TrialInfo = readTrialCache();

function readTrialCache(): TrialInfo {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as TrialInfo) : null;
    if (!parsed?.trialEndsAt) return { trialEndsAt: null, active: false };
    return { trialEndsAt: parsed.trialEndsAt, active: new Date(parsed.trialEndsAt).getTime() > Date.now() };
  } catch {
    return { trialEndsAt: null, active: false };
  }
}

/** Synchronous trial state (from cache). Call `loadTrial()` to refresh. */
export function getTrial(): TrialInfo {
  trialCache = readTrialCache();
  return trialCache;
}

export function isTrialActive(): boolean {
  return getTrial().active;
}

export function trialDaysLeft(): number {
  const t = getTrial();
  if (!t.trialEndsAt) return 0;
  const ms = new Date(t.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Ensures the signed-in user has a subscription row (3-month trial from
 * sign-up) and caches the trial end date locally.
 */
export async function loadTrial(): Promise<TrialInfo> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return getTrial();

    let { data: row } = await supabase
      .from("subscriptions")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!row) {
      const started = user.created_at ? new Date(user.created_at) : new Date();
      const ends = new Date(started);
      ends.setMonth(ends.getMonth() + TRIAL_MONTHS);
      const { data: inserted } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          trial_started_at: started.toISOString(),
          trial_ends_at: ends.toISOString(),
        })
        .select("trial_ends_at")
        .maybeSingle();
      row = inserted ?? { trial_ends_at: ends.toISOString() };
    }

    const info: TrialInfo = {
      trialEndsAt: row.trial_ends_at,
      active: new Date(row.trial_ends_at).getTime() > Date.now(),
    };
    localStorage.setItem(TRIAL_KEY, JSON.stringify(info));
    trialCache = info;
    window.dispatchEvent(new Event("premium-updated"));
    return info;
  } catch {
    return getTrial();
  }
}


export type PremiumReceipt = {
  productId: string;
  purchaseToken: string;
  type: "subs" | "inapp";
  premium: boolean;
  expiryTimeMillis?: number;
  autoRenewing?: boolean;
  verifiedAt: number;
};

export function isPremium(): boolean {
  try {
    if (localStorage.getItem(KEY) !== "1") return false;
    const r = getReceipt();
    // If we have a receipt with an expiry, honour it.
    if (r?.expiryTimeMillis && r.expiryTimeMillis <= Date.now()) {
      setPremium(false);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setPremium(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(RECEIPT_KEY);
    }
    window.dispatchEvent(new Event("premium-updated"));
  } catch {}
}

export function getReceipt(): PremiumReceipt | null {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    return raw ? (JSON.parse(raw) as PremiumReceipt) : null;
  } catch {
    return null;
  }
}

function saveReceipt(r: PremiumReceipt) {
  try {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(r));
  } catch {}
}

/**
 * Verify a Play Billing purchase token against Google Play and, if valid,
 * activate premium locally. Returns the verification result.
 */
export async function verifyAndActivatePurchase(params: {
  productId: string;
  purchaseToken: string;
  type?: "subs" | "inapp";
}): Promise<{ ok: boolean; premium: boolean; error?: string; receipt?: PremiumReceipt }> {
  const { productId, purchaseToken, type = "subs" } = params;
  if (!productId || !purchaseToken) {
    return { ok: false, premium: false, error: "productId and purchaseToken are required" };
  }
  try {
    const { data, error } = await supabase.functions.invoke("verify-play-purchase", {
      body: { productId, purchaseToken, type },
    });
    if (error) return { ok: false, premium: false, error: error.message };
    if (!data?.ok) return { ok: false, premium: false, error: data?.error ?? "verification failed" };

    const receipt: PremiumReceipt = {
      productId,
      purchaseToken,
      type,
      premium: Boolean(data.premium),
      expiryTimeMillis: data.expiryTimeMillis,
      autoRenewing: data.autoRenewing,
      verifiedAt: Date.now(),
    };
    if (receipt.premium) {
      saveReceipt(receipt);
      setPremium(true);
    } else {
      setPremium(false);
    }
    return { ok: true, premium: receipt.premium, receipt };
  } catch (e) {
    return { ok: false, premium: false, error: (e as Error).message };
  }
}

/**
 * Re-verify the currently stored receipt (e.g. from a "Restore purchases"
 * button or on app resume). Downgrades to free if Google says it's no longer
 * active.
 */
export async function refreshPremiumFromReceipt(): Promise<boolean> {
  const r = getReceipt();
  if (!r) return false;
  const res = await verifyAndActivatePurchase({
    productId: r.productId,
    purchaseToken: r.purchaseToken,
    type: r.type,
  });
  return res.premium;
}

export function canAddWorker(currentCount: number): boolean {
  if (isPremium()) return true;
  // Free trial (3 months from sign-up): up to FREE_WORKER_LIMIT workers.
  if (isTrialActive()) return currentCount < FREE_WORKER_LIMIT;
  // Trial over → subscription required.
  return false;
}

