import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), login: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capgo/capacitor-social-login", () => ({ SocialLogin: mocks }));
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); });

it("waits for shared initialization before login even during startup", async () => {
  let ready: (() => void) | undefined;
  mocks.initialize.mockImplementation(() => new Promise<void>((resolve) => { ready = resolve; }));
  mocks.login.mockResolvedValue({ result: { responseType: "online", idToken: "test-only" } });
  const { initSocialLogin, nativeGoogleLogin } = await import("@/lib/native");
  const startup = initSocialLogin();
  const login = nativeGoogleLogin();
  expect(mocks.initialize).toHaveBeenCalledOnce();
  expect(mocks.login).not.toHaveBeenCalled();
  ready?.();
  await Promise.all([startup, login]);
  expect(mocks.login).toHaveBeenCalledOnce();
});

it("does not open the picker on initialization failure and can retry", async () => {
  mocks.initialize.mockRejectedValueOnce(new Error("configuration missing")).mockResolvedValue(undefined);
  mocks.login.mockResolvedValue({ result: {} });
  const { nativeGoogleLogin } = await import("@/lib/native");
  await expect(nativeGoogleLogin()).rejects.toThrow("configuration missing");
  expect(mocks.login).not.toHaveBeenCalled();
  await nativeGoogleLogin();
  expect(mocks.initialize).toHaveBeenCalledTimes(2);
  expect(mocks.login).toHaveBeenCalledOnce();
});