// Lightweight local stock register for cement (bags) and sand (CFT).
// Stored in localStorage to avoid backend schema changes. Per-user device.

export type MaterialKind = "cement" | "sand";
export type MaterialEntryType = "In" | "Out";

export interface MaterialEntry {
  id: string;
  date: string; // YYYY-MM-DD
  kind: MaterialKind;
  entry_type: MaterialEntryType;
  quantity: number; // bags for cement, CFT for sand
  rate: number; // ₹ per bag / per CFT
  site_name?: string;
  notes?: string;
  created_at: number;
}

const KEY = "hajiri-material-stock";

function read(): MaterialEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(rows: MaterialEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function getMaterialEntries(kind?: MaterialKind): MaterialEntry[] {
  const all = read().sort((a, b) => (b.date.localeCompare(a.date)) || (b.created_at - a.created_at));
  return kind ? all.filter((e) => e.kind === kind) : all;
}

export function addMaterialEntry(e: Omit<MaterialEntry, "id" | "created_at">) {
  const rows = read();
  rows.push({ ...e, id: crypto.randomUUID(), created_at: Date.now() });
  write(rows);
}

export function deleteMaterialEntry(id: string) {
  write(read().filter((e) => e.id !== id));
}

export function getMaterialTotals(kind: MaterialKind) {
  const rows = read().filter((e) => e.kind === kind);
  let inQ = 0, outQ = 0, inCost = 0;
  rows.forEach((e) => {
    if (e.entry_type === "In") { inQ += e.quantity; inCost += e.quantity * e.rate; }
    else outQ += e.quantity;
  });
  return { stock: inQ - outQ, inQty: inQ, outQty: outQ, inCost };
}
