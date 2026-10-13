import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.user }, functions: { invoke: mocks.invoke } } }));
import { isPremium, verifyAndActivatePurchase } from "@/lib/premium";
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "account-a" } } });
  mocks.invoke.mockResolvedValue({ data: { ok: true, premium: true, expiryTimeMillis: Date.now() + 60000 }, error: null });
});
it("does not activate local Premium after an ownership denial", async () => {
  mocks.invoke.mockResolvedValue({ data: { ok: false, error: "Ownership denied" }, error: null });
  expect((await verifyAndActivatePurchase({ productId: "basic_plan", purchaseToken: "fixture-token" })).ok).toBe(false);
  expect(isPremium()).toBe(false);
});
it("does not leak a successful verification into a newly signed-in account", async () => {
  mocks.invoke.mockImplementation(async () => {
    mocks.user.mockResolvedValue({ data: { user: { id: "account-b" } } });
    return { data: { ok: true, premium: true }, error: null };
  });
  expect((await verifyAndActivatePurchase({ productId: "basic_plan", purchaseToken: "fixture-token" })).ok).toBe(false);
  expect(isPremium()).toBe(false);
});
it("requires authentication before verification", async () => {
  mocks.user.mockResolvedValue({ data: { user: null } });
  expect((await verifyAndActivatePurchase({ productId: "basic_plan", purchaseToken: "fixture-token" })).ok).toBe(false);
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("activates only a successful same-account verification", async () => {
  expect((await verifyAndActivatePurchase({ productId: "basic_plan", purchaseToken: "fixture-token" })).premium).toBe(true);
  expect(isPremium()).toBe(true);
});