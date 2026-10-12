export type PlaySubscriptionV2 = {
  subscriptionState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }>;
};

/** Google V2 state and the requested product's future expiry are both required. */
export function subscriptionEntitlement(data: PlaySubscriptionV2, now: number, productId: string) {
  const entitledState = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(data.subscriptionState || "");
  const items = (data.lineItems || []).filter((item) => item.productId === productId);
  const expiryTimeMillis = Math.max(0, ...items.map((item) => Date.parse(item.expiryTime || "")).filter(Number.isFinite));
  return {
    premium: entitledState && expiryTimeMillis > now,
    expiryTimeMillis: expiryTimeMillis > 0 ? expiryTimeMillis : undefined,
    autoRenewing: items.some((item) => item.autoRenewingPlan?.autoRenewEnabled === true),
  };
}