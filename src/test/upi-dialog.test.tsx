import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ qr: vi.fn(), launch: vi.fn() }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
vi.mock("@/lib/native", () => ({ isAndroidNative: () => false }));
vi.mock("@/lib/upi", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/upi")>(), launchUpi: mocks.launch }));
import UpiPayDialog from "@/components/UpiPayDialog";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([250.75, 100.50, 100.00, 250.00, 0.75])("uses exactly ₹%s for QR generation and button launch", async (amount) => {
  mocks.qr.mockResolvedValue("data:image/png;base64,test");
  mocks.launch.mockResolvedValue({ opened: true });
  render(<UpiPayDialog open onOpenChange={() => {}} payeeName="Worker" payeeVpa="worker@upi" defaultAmount={amount} />);
  await waitFor(() => expect(mocks.qr).toHaveBeenCalled());
  expect(new URL(mocks.qr.mock.calls[0][0]).searchParams.get("am")).toBe(amount.toFixed(2));
  fireEvent.click(screen.getByRole("button", { name: "UPI ऐप खोलें" }));
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledWith({ payeeVpa: "worker@upi", payeeName: "Worker", amountPaise: Math.round(amount * 100), note: "Worker - पेमेंट" }));
});