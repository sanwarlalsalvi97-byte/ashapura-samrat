import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ qr: vi.fn(), launch: vi.fn() }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
vi.mock("@/lib/native", () => ({ isAndroidNative: () => false }));
vi.mock("@/lib/upi", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/upi")>(), launchUpi: mocks.launch }));
import UpiPayDialog from "@/components/UpiPayDialog";

it("uses exactly the displayed ₹250.75 for both actual QR generation and button launch", async () => {
  mocks.qr.mockResolvedValue("data:image/png;base64,test");
  mocks.launch.mockResolvedValue({ opened: true });
  render(<UpiPayDialog open onOpenChange={() => {}} payeeName="Worker" payeeVpa="worker@upi" defaultAmount={250.75} />);
  await waitFor(() => expect(mocks.qr).toHaveBeenCalled());
  expect(new URL(mocks.qr.mock.calls[0][0]).searchParams.get("am")).toBe("250.75");
  fireEvent.click(screen.getByRole("button", { name: "UPI ऐप खोलें" }));
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledWith({ payeeVpa: "worker@upi", payeeName: "Worker", amountPaise: 25075, note: "Worker - पेमेंट" }));
});