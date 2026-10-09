import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/native", () => ({ isAndroidNative: () => false }));
import { parseRupeesToPaise, formatPaise } from "@/lib/currency";
import { buildUpiLink, buildUpiIntentLink } from "@/lib/upi";

describe("UPI exact currency", () => {
  it("preserves ₹250.75 in QR and payment intent from the same parameters", () => {
    const amountPaise = parseRupeesToPaise("250.75");
    expect(amountPaise).toBe(25075);
    if (amountPaise === null) throw new Error("Invalid amount");
    const params = { payeeVpa: "worker@upi", payeeName: "Worker", amountPaise };
    expect(new URL(buildUpiLink(params)).searchParams.get("am")).toBe("250.75");
    expect(buildUpiIntentLink(params)).toContain("am=250.75");
  });
  it("parses 0.29 as exactly 29 paise", () => {
    expect(parseRupeesToPaise("0.29")).toBe(29);
    expect(formatPaise(29)).toBe("0.29");
  });
  it("rejects sub-paise amounts rather than truncating", () => {
    expect(parseRupeesToPaise("250.755")).toBeNull();
  });
});