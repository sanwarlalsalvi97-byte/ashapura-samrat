import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), ack: vi.fn(), query: vi.fn(), trial: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android" } }));
vi.mock("@/lib/play-billing", () => ({ PlayBilling: { acknowledgePurchase: mocks.ack, restoreSubscriptions: mocks.query } }));
vi.mock("@/lib/premium", () => ({ verifyAndActivatePurchase: mocks.verify, loadTrial: mocks.trial }));
import { processPlayPurchase, restorePlaySubscriptions } from "@/lib/subscription-billing";
import type { PlayPurchase } from "@/lib/play-billing";
import { subscriptionEntitlement } from "../../supabase/functions/_shared/play-entitlement";

const purchase: PlayPurchase = { productId: "basic_plan", purchaseToken: "test-token", acknowledged: false, purchaseState: "PURCHASED" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ ok: true, premium: true });
  mocks.ack.mockResolvedValue(undefined);
  mocks.query.mockResolvedValue({ purchases: [purchase] });
});
describe("verified Play Billing", () => {
  it("does not verify or acknowledge PENDING purchases", async () => {
    expect(await processPlayPurchase({ ...purchase, purchaseState: "PENDING" })).toBe(false);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("acknowledges only after valid entitlement verification", async () => {
    expect(await processPlayPurchase(purchase)).toBe(true);
    expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(mocks.ack.mock.invocationCallOrder[0]);
    expect(mocks.ack).toHaveBeenCalledWith({ purchaseToken: "test-token" });
  });
  it("skips already acknowledged purchases", async () => {
    expect(await processPlayPurchase({ ...purchase, acknowledged: true })).toBe(true);
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("does not acknowledge failed verification and recovers on the next query", async () => {
    mocks.verify.mockResolvedValueOnce({ ok: false, premium: false });
    await expect(processPlayPurchase(purchase)).rejects.toThrow();
    expect(mocks.ack).not.toHaveBeenCalled();
    expect(await restorePlaySubscriptions()).toBe(true);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.ack).toHaveBeenCalledOnce();
  });
  it("does not acknowledge a purchased but expired subscription", async () => {
    mocks.verify.mockResolvedValue({ ok: true, premium: false });
    expect(await processPlayPurchase(purchase)).toBe(false);
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent purchase callbacks", async () => {
    await Promise.all([processPlayPurchase(purchase), processPlayPurchase(purchase)]);
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.ack).toHaveBeenCalledOnce();
  });
  it("Google pending payment cannot grant premium", () => {
    expect(subscriptionEntitlement({ paymentState: 0, expiryTimeMillis: "2000" }, 1000).premium).toBe(false);
  });
  it("a subscription without a valid future expiry cannot grant lifetime premium", () => {
    expect(subscriptionEntitlement({ paymentState: 1 }, 1000).premium).toBe(false);
    expect(subscriptionEntitlement({ paymentState: 1, expiryTimeMillis: "2000" }, 1000).premium).toBe(true);
  });
});