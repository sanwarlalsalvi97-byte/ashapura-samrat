import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ payments: vi.fn(), ledger: vi.fn(), launch: vi.fn(), qr: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/native", () => ({ isAndroidNative: () => false }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
vi.mock("@/lib/upi", async (original) => ({ ...await original<typeof import("@/lib/upi")>(), launchUpi: mocks.launch }));
vi.mock("@/lib/payment-engine", async (original) => ({ ...await original<typeof import("@/lib/payment-engine")>(), computeWorkerPayments: mocks.payments, computeWorkerLedger: mocks.ledger, subscribePaymentSources: () => () => {} }));
vi.mock("@/lib/roles", () => ({ useRole: () => ({ readOnly: false }) }));
vi.mock("@/lib/sites", () => ({ listSites: () => [] }));
vi.mock("@/lib/supabase-helpers", () => ({ getWorkers: async () => [], getContractors: async () => [], deleteWorkerMonthAttendance: vi.fn() }));
vi.mock("@/lib/export-utils", () => ({ exportCSV: vi.fn(), exportPDF: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
  from: () => {
    const query = { select: () => query, gte: () => query, lte: () => query, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve), insert: mocks.insert };
    return query;
  },
} }));
import PendingPaymentsCard from "@/components/PendingPaymentsCard";
import ReportPage from "@/components/ReportPage";
import type { WorkerLedger, WorkerPayment } from "@/lib/payment-engine";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const worker = { id: "w1", name: "Worker", daily_rate: 0, upi_id: "worker@upi" };
function payment(amount: number): WorkerPayment {
  return { worker, outstanding: amount, presentDays: 0, halfDays: 0, absentDays: 0, days: 0, baseEarning: 0, overtimePay: 0, earned: 0, workerExpenses: 0, advance: 0, paidAmount: 0 };
}
function ledger(amount: number): WorkerLedger {
  return { worker, remainingBalance: amount, previousBalance: 0, presentDays: 0, halfDays: 0, absentDays: 0, currentEarnings: amount, currentAdvance: 0, currentExpenses: 0, currentPaid: 0, totalAdvanceLifetime: 0, netPayable: amount };
}

it.each([[250.75, 25075], [100.50, 10050], [100.00, 10000], [250.00, 25000], [0.75, 75]])("pending ₹%s reaches the actual dialog, QR and launch unchanged", async (amount, paise) => {
  mocks.payments.mockResolvedValue({ rows: [payment(amount)] });
  mocks.qr.mockResolvedValue("data:image/png;base64,test");
  mocks.launch.mockResolvedValue({ opened: true });
  render(<PendingPaymentsCard startISO="2026-10-01" endISO="2026-10-31" monthLabel="October" />);
  fireEvent.click(await screen.findByRole("button", { name: "भुगतान" }));
  expect(screen.getByPlaceholderText("जैसे 5000")).toHaveValue(String(amount));
  await waitFor(() => expect(mocks.qr).toHaveBeenCalled());
  expect(new URL(mocks.qr.mock.calls[0][0]).searchParams.get("am")).toBe(amount.toFixed(2));
  fireEvent.click(screen.getByRole("button", { name: "UPI ऐप खोलें" }));
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: paise })));
});

it.each([[250.75, 25075], [100.50, 10050], [100.00, 10000], [250.00, 25000], [0.75, 75]])("report ₹%s reaches launch and confirmed payment unchanged", async (amount, paise) => {
  const row = ledger(amount);
  mocks.ledger.mockResolvedValue({ rows: [row], totals: row });
  mocks.launch.mockResolvedValue({ opened: true });
  mocks.insert.mockResolvedValue({ error: null });
  render(<ReportPage />);
  fireEvent.click(await screen.findByRole("button", { name: /Pay Salary/ }));
  const dialog = screen.getByRole("dialog");
  const input = dialog.querySelector("input");
  if (!input) throw new Error("Missing amount input");
  expect(input).toHaveValue(String(amount));
  fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "upi" } });
  fireEvent.click(screen.getByRole("button", { name: "UPI ऐप खोलें" }));
  await waitFor(() => expect(mocks.launch).toHaveBeenCalledWith(expect.objectContaining({ amountPaise: paise })));
  expect(mocks.insert).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "हाँ, पूरा हुआ" }));
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ amount })));
});

it.each([0, -0.75])("does not offer a pending payment for balance %s", async (amount) => {
  mocks.payments.mockResolvedValue({ rows: [payment(amount)] });
  render(<PendingPaymentsCard startISO="2026-10-01" endISO="2026-10-31" monthLabel="October" />);
  await screen.findByText(/कोई बकाया नहीं/);
  expect(screen.queryByRole("button", { name: "भुगतान" })).toBeNull();
});

it.each([0, -0.75])("report does not launch UPI for non-positive balance %s", async (amount) => {
  const row = ledger(amount);
  mocks.ledger.mockResolvedValue({ rows: [row], totals: row });
  render(<ReportPage />);
  fireEvent.click(await screen.findByRole("button", { name: /Pay Salary/ }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(dialog.querySelector("select") as HTMLSelectElement, { target: { value: "upi" } });
  fireEvent.click(screen.getByRole("button", { name: "UPI ऐप खोलें" }));
  expect(mocks.launch).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});