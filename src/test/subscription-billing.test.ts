import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), ack: vi.fn(), query: vi.fn(), trial: vi.fn(), user: vi.fn(), purchase: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "android" } }));
vi.mock("@/lib/play-billing", () => ({ PlayBilling: { acknowledgePurchase: mocks.ack, restoreSubscriptions: mocks.query, purchaseSubscription: mocks.purchase } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.user } } }));
vi.mock("@/lib/premium", () => ({ verifyAndActivatePurchase: mocks.verify, loadTrial: mocks.trial }));
import { processPlayPurchase, purchasePlaySubscription, restorePlaySubscriptions } from "@/lib/subscription-billing";
import { playAccountIdentifier } from "../../supabase/functions/_shared/play-account";
import type { PlayPurchase } from "@/lib/play-billing";
import { subscriptionEntitlement } from "../../supabase/functions/_shared/play-entitlement";

const purchase: PlayPurchase = { productId: "basic_plan", purchaseToken: "test-token", acknowledged: false, purchaseState: "PURCHASED" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ ok: true, premium: true });
  mocks.ack.mockResolvedValue(undefined);
  mocks.query.mockResolvedValue({ purchases: [purchase] });
  mocks.user.mockResolvedValue({ data: { user: { id: "account-a" } }, error: null });
  mocks.purchase.mockResolvedValue(purchase);
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
    expect(subscriptionEntitlement({ subscriptionState: "SUBSCRIPTION_STATE_PENDING", lineItems: [{ productId: "basic_plan", expiryTime: new Date(2000).toISOString() }] }, 1000, "basic_plan").premium).toBe(false);
  });
  it("a subscription without a valid future expiry cannot grant lifetime premium", () => {
    expect(subscriptionEntitlement({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE" }, 1000, "basic_plan").premium).toBe(false);
    expect(subscriptionEntitlement({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "basic_plan", expiryTime: new Date(2000).toISOString() }] }, 1000, "basic_plan").premium).toBe(true);
  });
  it("passes the authenticated account binding to the native purchase", async () => {
    expect(await purchasePlaySubscription("basic_plan:basic-plan")).toBe(true);
    expect(mocks.purchase).toHaveBeenCalledWith({ productId: "basic_plan:basic-plan", obfuscatedAccountId: await playAccountIdentifier("account-a") });
  });
  it("does not acknowledge an ownership verification rejection", async () => {
    mocks.verify.mockResolvedValue({ ok: false, premium: false });
    await expect(restorePlaySubscriptions()).rejects.toThrow();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("keeps duplicate restore requests in one account-scoped query", async () => {
    await Promise.all([restorePlaySubscriptions(), restorePlaySubscriptions()]);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.ack).toHaveBeenCalledOnce();
  });
  it("stops verification when the account changes in the native purchase dialog", async () => {
    mocks.purchase.mockImplementation(async () => {
      mocks.user.mockResolvedValue({ data: { user: { id: "account-b" } }, error: null });
      return purchase;
    });
    await expect(purchasePlaySubscription("basic_plan:basic-plan")).rejects.toThrow(/अकाउंट बदल/);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("stops acknowledgement when the account changes during verification", async () => {
    mocks.verify.mockImplementation(async () => {
      mocks.user.mockResolvedValue({ data: { user: { id: "account-b" } }, error: null });
      return { ok: true, premium: true };
    });
    await expect(processPlayPurchase(purchase)).rejects.toThrow(/अकाउंट बदल/);
    expect(mocks.ack).not.toHaveBeenCalled();
  });
  it("a failed acknowledgement is retried through restore", async () => {
    mocks.ack.mockRejectedValueOnce(new Error("ack unavailable"));
    await expect(processPlayPurchase(purchase)).rejects.toThrow("ack unavailable");
    expect(await restorePlaySubscriptions()).toBe(true);
    expect(mocks.ack).toHaveBeenCalledTimes(2);
  });
});