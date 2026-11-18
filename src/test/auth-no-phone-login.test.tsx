import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signInWithOAuth } = vi.hoisted(() => ({
  signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPassword, signInWithOAuth, signUp: vi.fn(), resend: vi.fn(), resetPasswordForEmail: vi.fn() } },
}));
vi.mock("@/lib/native", () => ({ nativeGoogleLogin: vi.fn() }));
vi.mock("@/lib/roles", () => ({ setPendingSignupRole: vi.fn() }));
vi.mock("@/assets/logo.png", () => ({ default: "logo.png" }));

import Auth from "@/pages/Auth";
import authSource from "@/pages/Auth.tsx?raw";

afterEach(() => { cleanup(); signInWithPassword.mockClear(); signInWithOAuth.mockClear(); });

describe("Sign-in page without phone login", () => {
  it("offers no mobile-number / OTP sign-in option", () => {
    render(<Auth />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(labels.some((t) => /मोबाइल|OTP/i.test(t))).toBe(false);
  });

  it("never derives a password from a phone number", () => {
    expect(authSource).not.toMatch(/Ashapura@/);
    expect(authSource).not.toMatch(/@ashapura\.auth/);
    expect(authSource).not.toMatch(/signInWithPhoneNumber|RecaptchaVerifier/);
  });

  it("keeps Google sign-in", () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
  });

  it("keeps email sign-in using the typed email and password only", async () => {
    render(<Auth />);
    fireEvent.change(screen.getByPlaceholderText("ईमेल"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("पासवर्ड"), { target: { value: "secret12" } });
    fireEvent.click(screen.getByRole("button", { name: "ईमेल से लॉगिन करें" }));
    await vi.waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "secret12" }));
  });
});
