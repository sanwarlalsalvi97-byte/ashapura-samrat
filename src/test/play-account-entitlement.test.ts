import { describe, expect, it } from "vitest";
import { ownsPlayPurchase, playAccountIdentifier } from "../../supabase/functions/_shared/play-account";
import { subscriptionEntitlement } from "../../supabase/functions/_shared/play-entitlement";

describe("Google-returned account ownership", () => {
  it("accepts the purchasing app account", async () => {
    expect(await ownsPlayPurchase("account-a", await playAccountIdentifier("account-a"))).toBe(true);
  });
  it("rejects the same Google token ownership on another app account", async () => {
    const googleOwner = await playAccountIdentifier("account-a");
    expect(await ownsPlayPurchase("account-b", googleOwner)).toBe(false);
  });
  it.each([undefined, null, "", "account-a"])("fails closed for missing or untrusted legacy owner %s", async (owner) => {
    expect(await ownsPlayPurchase("account-a", owner)).toBe(false);
  });
});

describe("Google subscription V2 states", () => {
  const item = { productId: "basic_plan", expiryTime: new Date(2000).toISOString() };
  it.each(["ACTIVE", "IN_GRACE_PERIOD", "CANCELED"])("keeps paid access for %s only until expiry", (state) => {
    const data = { subscriptionState: `SUBSCRIPTION_STATE_${state}`, lineItems: [item] };
    expect(subscriptionEntitlement(data, 1000, "basic_plan").premium).toBe(true);
    expect(subscriptionEntitlement(data, 2000, "basic_plan").premium).toBe(false);
  });
  it.each(["PENDING", "PENDING_PURCHASE_CANCELED", "EXPIRED", "ON_HOLD", "PAUSED", "UNSPECIFIED"])("denies %s even with future expiry", (state) => {
    expect(subscriptionEntitlement({ subscriptionState: `SUBSCRIPTION_STATE_${state}`, lineItems: [item] }, 1000, "basic_plan").premium).toBe(false);
  });
  it("rejects a product not present in the Google response", () => {
    expect(subscriptionEntitlement({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [item] }, 1000, "pro_plan").premium).toBe(false);
  });
  it.each([undefined, "invalid"])("rejects missing/invalid expiry %s", (expiryTime) => {
    expect(subscriptionEntitlement({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ ...item, expiryTime }] }, 1000, "basic_plan").premium).toBe(false);
  });
});