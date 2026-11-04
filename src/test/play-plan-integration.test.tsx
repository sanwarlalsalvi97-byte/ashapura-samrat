import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubscriptionPage from "@/components/SubscriptionPage";
import { purchasePlaySubscription, restorePlaySubscriptions } from "@/lib/subscription-billing";
import type { PlayPurchase } from "@/lib/play-billing";

// These tests execute the real page and TypeScript orchestration, NOT Java or Play.
// Native catalogue errors and purchase responses below are explicitly fixtures.
const mocks = vi.hoisted(() => ({
  purchase: vi.fn(), verify: vi.fn(), ack: vi.fn(), restore: vi.fn(),
  user: vi.fn(), trial: vi.fn(), toast: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
}));
vi.mock("@/lib/play-billing", () => ({
  PlayBilling: {
    purchaseSubscription: mocks.purchase,
    acknowledgePurchase: mocks.ack,
    restoreSubscriptions: mocks.restore,
  },
}));
vi.mock("@/lib/premium", () => ({
  verifyAndActivatePurchase: mocks.verify, loadTrial: mocks.trial,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: mocks.user } },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));

const plans = [
  { name: "Standard Monthly ₹99", cycle: "monthly", button: "अभी शुरू करें", product: "standard_plan", base: "standard-monthly" },
  { name: "Pro Monthly ₹199", cycle: "monthly", button: "Pro चुनें", product: "pro_plan", base: "pro-monthly" },
  { name: "Standard Yearly", cycle: "yearly", button: "अभी शुरू करें", product: "standard_plan", base: "standard-yearly" },
  { name: "Pro Yearly", cycle: "yearly", button: "Pro चुनें", product: "pro_plan", base: "pro-yearly" },
] as const;

function purchaseFixture(productId: string): PlayPurchase {
  return {
    productId, purchaseToken: `fixture-${productId}`,
    acknowledged: false, purchaseState: "PURCHASED",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "fixture-account" } }, error: null });
  mocks.verify.mockResolvedValue({ ok: true, premium: true });
  mocks.ack.mockResolvedValue(undefined);
  mocks.restore.mockResolvedValue({ purchases: [] });
  mocks.purchase.mockImplementation(async ({ productId }: { productId: string }) =>
    purchaseFixture(productId.split(":")[0]));
});
afterEach(cleanup);

describe("page selection against the requested Play catalogue", () => {
  for (const plan of plans) {
    it(`${plan.name} sends the requested product and base plan`, async () => {
      render(<SubscriptionPage />);
      if (plan.cycle === "yearly") fireEvent.click(screen.getByRole("button", { name: /वार्षिक/ }));
      fireEvent.click(screen.getByRole("button", { name: plan.button }));
      await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
      // Intentionally exposes the current pro-annual / requested pro-yearly mismatch.
      // Do not change production selection merely to make this test pass.
      expect(mocks.purchase).toHaveBeenCalledWith({
        productId: `${plan.product}:${plan.base}`,
        obfuscatedAccountId: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
    });
  }

  it("switching yearly back to monthly does not reuse the yearly selection", async () => {
    render(<SubscriptionPage />);
    fireEvent.click(screen.getByRole("button", { name: /वार्षिक/ }));
    fireEvent.click(screen.getByRole("button", { name: "मासिक" }));
    fireEvent.click(screen.getByRole("button", { name: "अभी शुरू करें" }));
    await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
    expect(mocks.purchase.mock.calls[0][0].productId).toBe("standard_plan:standard-monthly");
  });
});

describe("purchase verification and acknowledgement with native fixtures", () => {
  for (const plan of plans) {
    it(`${plan.name} verifies the bare product and same token before acknowledging`, async () => {
      expect(await purchasePlaySubscription(`${plan.product}:${plan.base}`)).toBe(true);
      expect(mocks.verify).toHaveBeenCalledExactlyOnceWith({
        productId: plan.product, purchaseToken: `fixture-${plan.product}`, type: "subs",
      });
      expect(mocks.ack).toHaveBeenCalledExactlyOnceWith({ purchaseToken: `fixture-${plan.product}` });
      expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(mocks.ack.mock.invocationCallOrder[0]);
    });
  }

  for (const product of ["standard_plan", "pro_plan"]) {
    it(`restores ${product} through verification and skips already acknowledged fixtures`, async () => {
      mocks.restore.mockResolvedValue({ purchases: [{ ...purchaseFixture(product), acknowledged: true }] });
      expect(await restorePlaySubscriptions()).toBe(true);
      expect(mocks.verify).toHaveBeenCalledExactlyOnceWith({
        productId: product, purchaseToken: `fixture-${product}`, type: "subs",
      });
      expect(mocks.ack).not.toHaveBeenCalled();
    });
  }

  it("a rejected wrong-product verification never acknowledges", async () => {
    mocks.purchase.mockResolvedValue(purchaseFixture("unknown_product"));
    mocks.verify.mockResolvedValue({ ok: false, premium: false });
    await expect(purchasePlaySubscription("unknown_product:missing")).rejects.toThrow();
    expect(mocks.verify).toHaveBeenCalledWith({
      productId: "unknown_product", purchaseToken: "fixture-unknown_product", type: "subs",
    });
    expect(mocks.ack).not.toHaveBeenCalled();
  });

  for (const [name, message] of [
    ["unavailable base plan", "चुना हुआ मासिक/वार्षिक प्लान Google Play पर उपलब्ध नहीं है।"],
    ["unavailable product", "यह प्लान Google Play पर उपलब्ध नहीं है।"],
  ]) {
    it(`a native ${name} rejection stops before verification and acknowledgement`, async () => {
      mocks.purchase.mockRejectedValue(new Error(message));
      await expect(purchasePlaySubscription("standard_plan:missing")).rejects.toThrow(message);
      expect(mocks.verify).not.toHaveBeenCalled();
      expect(mocks.ack).not.toHaveBeenCalled();
    });
  }
});