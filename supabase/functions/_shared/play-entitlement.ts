/** Subscription expiry must be supplied by Google; missing expiry is not lifetime access. */
export function subscriptionEntitlement(data: { paymentState?: number; expiryTimeMillis?: string | number }, now: number) {
  const expiryTimeMillis = Number(data.expiryTimeMillis);
  return {
    premium: (data.paymentState === 1 || data.paymentState === 2)
      && Number.isFinite(expiryTimeMillis) && expiryTimeMillis > now,
    expiryTimeMillis: Number.isFinite(expiryTimeMillis) && expiryTimeMillis > 0 ? expiryTimeMillis : undefined,
  };
}