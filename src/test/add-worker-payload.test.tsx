import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addWorker: vi.fn(),
  updateWorker: vi.fn(),
  toast: vi.fn(),
  uploadPhoto: vi.fn(),
  removePhoto: vi.fn(),
}));

vi.mock("@/lib/supabase-helpers", () => ({
  addWorker: mocks.addWorker,
  updateWorker: mocks.updateWorker,
}));
vi.mock("@/lib/worker-photos", () => ({
  uploadWorkerPhoto: mocks.uploadPhoto,
  removeWorkerPhoto: mocks.removePhoto,
}));
vi.mock("@/lib/sites", () => ({ listSites: () => [] }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));

import AddWorkerDialog from "@/components/AddWorkerDialog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.addWorker.mockResolvedValue({
    id: "w1",
    name: "रामलाल शर्मा",
    role: "मजदूर",
    daily_rate: 500,
    site_name: null,
    phone: null,
    upi_id: "9876543210@upi",
  });
});

async function openDialogAndFillFields() {
  render(<AddWorkerDialog onAdded={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "मजदूर जोड़ें" }));

  fireEvent.change(screen.getByPlaceholderText("नाम *"), { target: { value: "रामलाल शर्मा" } });
  fireEvent.change(screen.getByPlaceholderText("फोन नंबर"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByPlaceholderText("12 अंकों का आधार नंबर"), { target: { value: "123456789012" } });
  fireEvent.change(screen.getByPlaceholderText("UPI ID (जैसे 9876543210@upi)"), { target: { value: "9876543210@upi" } });
  fireEvent.change(screen.getByPlaceholderText("बैंक खाता संख्या दर्ज करें"), { target: { value: "1234567890123" } });
  fireEvent.change(screen.getByPlaceholderText("IFSC कोड दर्ज करें"), { target: { value: "abcd0001234" } });
}

describe("Add Worker insert payload", () => {
  it("sends only columns that exist in the workers table", async () => {
    await openDialogAndFillFields();
    fireEvent.click(screen.getByRole("button", { name: "जोड़ें" }));

    await waitFor(() => expect(mocks.addWorker).toHaveBeenCalledTimes(1));
    const payload = mocks.addWorker.mock.calls[0][0] as Record<string, unknown>;

    // These three columns do not exist in the workers table, so sending them
    // (even as null) made every single insert fail.
    expect(Object.keys(payload)).not.toContain("aadhaar");
    expect(Object.keys(payload)).not.toContain("bank_account");
    expect(Object.keys(payload)).not.toContain("ifsc_code");

    expect(payload).toEqual({
      name: "रामलाल शर्मा",
      role: "मजदूर",
      daily_rate: 500,
      site_name: null,
      phone: "9876543210",
      upi_id: "9876543210@upi",
    });
  });

  it("keeps Aadhaar input restricted to 12 digits", () => {
    render(<AddWorkerDialog onAdded={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "मजदूर जोड़ें" }));
    const aadhaar = screen.getByPlaceholderText("12 अंकों का आधार नंबर");

    fireEvent.change(aadhaar, { target: { value: "98765abc4321" } });
    expect(aadhaar).toHaveValue("987654321");

    fireEvent.change(aadhaar, { target: { value: "987654321098765" } });
    expect(aadhaar).toHaveValue("987654321");

    // Devanagari digits are still rejected by the existing ASCII-digit filter.
    fireEvent.change(aadhaar, { target: { value: "१२३४५६७८९०१२" } });
    expect(aadhaar).toHaveValue("");
  });
});
