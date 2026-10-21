import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => { throw new Error("no network in test"); },
  },
}));

import { normalizeSiteName, planLegacyImport, readLegacySites, LEGACY_KEY_V2 } from "@/lib/sites";

describe("site name rules", () => {
  it("treats case and extra spaces as the same name", () => {
    expect(normalizeSiteName("  Samrat   Heights ")).toBe(normalizeSiteName("samrat heights"));
  });
});

describe("legacy import plan", () => {
  it("skips names already in cloud, duplicates and blanks without losing them from the report", () => {
    const plan = planLegacyImport(
      [
        { id: "a", name: "Site A" },
        { id: "b", name: "site  a" },
        { id: "c", name: "   " },
        { id: "d", name: "Site B" },
        { id: "e", name: "Site C" },
      ],
      [{ name: "SITE B" }],
    );
    expect(plan.toImport.map((s) => s.id)).toEqual(["a", "e"]);
    expect(plan.duplicates.map((s) => s.id)).toEqual(["b"]);
    expect(plan.blank.map((s) => s.id)).toEqual(["c"]);
    expect(plan.alreadyInCloud.map((s) => s.id)).toEqual(["d"]);
    expect(plan.total).toBe(5);
  });

  it("running the plan again after import finds nothing new (idempotent)", () => {
    const local = [{ id: "a", name: "Site A" }, { id: "b", name: "Site B" }];
    const again = planLegacyImport(local, [{ name: "Site A" }, { name: "Site B" }]);
    expect(again.toImport).toHaveLength(0);
  });
});

describe("reading old phone sites", () => {
  beforeEach(() => localStorage.clear());
  it("reads without modifying the original stored data", () => {
    const raw = JSON.stringify([{ id: "x", name: "Old · Owner", isActive: true }]);
    localStorage.setItem(LEGACY_KEY_V2, raw);
    const sites = readLegacySites();
    expect(sites[0]).toMatchObject({ name: "Old", location: "Owner" });
    expect(localStorage.getItem(LEGACY_KEY_V2)).toBe(raw);
  });
});
