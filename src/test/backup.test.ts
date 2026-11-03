import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "owner", email: null } } }) },
  rpc: mock.rpc, from: mock.from,
} }));
vi.mock("@/lib/sites", () => ({ refreshSites: mock.refresh }));
import { buildBackup, restoreBackup, type BackupPayload } from "@/lib/backup";
const payload = (): BackupPayload => ({ version: 1, app: "AshapuraSamrat", createdAt: "2026-11-02", user: { id: "owner", email: null }, data: { workers: [], sites: [{ name: "साइट", owner_name: "राम" }] }, preferences: { "hajiri-lang": "hi" } });
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mock.rpc.mockResolvedValue({ error: null }); });
describe("backup integration", () => {
  it("backs up material, punch rows and their office dependencies with owner filtering", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    mock.from.mockReturnValue({ select: () => ({ eq }) });
    const result = await buildBackup();
    for (const table of ["material_entries", "attendance_logs", "office_locations"]) {
      expect(mock.from).toHaveBeenCalledWith(table);
      expect(result.data[table]).toEqual([]);
    }
    expect(eq.mock.calls.every(([key, id]) => key === "user_id" && id === "owner")).toBe(true);
  });
  it("sends sites through the single restore transaction and refreshes after success", async () => {
    await restoreBackup(payload());
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("restore_user_data", { backup_json: expect.objectContaining({ data: expect.objectContaining({ sites: [{ name: "साइट", owner_name: "राम" }] }) }) });
    expect(mock.refresh).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("hajiri-lang")).toBe("hi");
  });
  it("does not change preferences or refresh when the transaction fails", async () => {
    mock.rpc.mockResolvedValue({ error: { message: "invalid reference" } });
    await expect(restoreBackup(payload())).rejects.toThrow("invalid reference");
    expect(localStorage.getItem("hajiri-lang")).toBeNull();
    expect(mock.refresh).not.toHaveBeenCalled();
  });
  it("rejects another owner before any restore request", async () => {
    const p = payload(); p.user.id = "other";
    await expect(restoreBackup(p)).rejects.toThrow();
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});