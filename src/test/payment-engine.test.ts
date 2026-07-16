import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client BEFORE importing the engine.
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {
  workers: [],
  attendance: [],
  worker_expenses: [],
  payment_history: [],
};

function makeQuery(table: string) {
  let rows = () => tables[table].slice();
  const filters: Array<(r: Row) => boolean> = [];
  const api: any = {
    select: () => api,
    eq: (col: string, val: any) => { filters.push((r) => r[col] === val); return api; },
    gte: (col: string, val: any) => { filters.push((r) => r[col] >= val); return api; },
    lte: (col: string, val: any) => { filters.push((r) => r[col] <= val); return api; },
    gt: (col: string, val: any) => { filters.push((r) => r[col] > val); return api; },
    then: (resolve: any) =>
      Promise.resolve({
        data: rows().filter((r) => filters.every((f) => f(r))),
        error: null,
      }).then(resolve),
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    removeChannel: () => {},
  },
}));

import {
  computeWorkerLedger,
  computeWorkerPayments,
  sumPendingOutstanding,
} from "@/lib/payment-engine";

beforeEach(() => {
  tables.workers = [];
  tables.attendance = [];
  tables.worker_expenses = [];
  tables.payment_history = [];
});

describe("computeWorkerLedger — carry-forward", () => {
  it("carries previous-month unpaid earnings into next month's previousBalance", async () => {
    tables.workers = [
      { id: "w1", name: "Ram", daily_rate: 500, is_active: true, upi_id: null, phone: null, site_name: null },
    ];
    // September: 10 present days, no advance, no payment => 5000 unpaid
    for (let d = 1; d <= 10; d++) {
      tables.attendance.push({
        worker_id: "w1",
        status: "Present",
        advance: 0,
        overtime_hours: 0,
        site_name: null,
        date: `2025-09-${String(d).padStart(2, "0")}`,
      });
    }
    // October: 2 present days = 1000 earned this month
    for (let d = 1; d <= 2; d++) {
      tables.attendance.push({
        worker_id: "w1",
        status: "Present",
        advance: 0,
        overtime_hours: 0,
        site_name: null,
        date: `2025-10-${String(d).padStart(2, "0")}`,
      });
    }

    const oct = await computeWorkerLedger({ year: 2025, monthIndex0: 9 });
    expect(oct.rows).toHaveLength(1);
    const r = oct.rows[0];
    expect(r.previousBalance).toBe(5000);
    expect(r.currentEarnings).toBe(1000);
    // netPayable = current earnings + previous balance − current advance
    expect(r.netPayable).toBe(6000);
    expect(r.remainingBalance).toBe(6000);
  });

  it("does not reset carry-forward when moving from month N to N+1", async () => {
    tables.workers = [
      { id: "w1", name: "Ram", daily_rate: 400, is_active: true, upi_id: null, phone: null, site_name: null },
    ];
    tables.attendance = [
      { worker_id: "w1", status: "Present", advance: 0, overtime_hours: 0, site_name: null, date: "2025-08-05" },
      { worker_id: "w1", status: "Present", advance: 0, overtime_hours: 0, site_name: null, date: "2025-08-06" },
    ];
    const sep = await computeWorkerLedger({ year: 2025, monthIndex0: 8 });
    const nov = await computeWorkerLedger({ year: 2025, monthIndex0: 10 });
    // August earnings (800) still visible as previousBalance in Sep AND Nov.
    expect(sep.rows[0].previousBalance).toBe(800);
    expect(nov.rows[0].previousBalance).toBe(800);
  });

  it("red/green remaining matches formula: earnings + prev − advance + expenses − paid", async () => {
    tables.workers = [
      { id: "w1", name: "A", daily_rate: 500, is_active: true, upi_id: null, phone: null, site_name: null },
    ];
    tables.attendance = [
      { worker_id: "w1", status: "Present", advance: 200, overtime_hours: 0, site_name: null, date: "2025-10-01" },
      { worker_id: "w1", status: "Present", advance: 0, overtime_hours: 0, site_name: null, date: "2025-10-02" },
    ];
    tables.worker_expenses = [
      { worker_id: "w1", amount: 100, site_name: null, date: "2025-10-03" },
    ];
    tables.payment_history = [
      { worker_id: "w1", amount: 300, site_name: null, payment_date: "2025-10-04" },
    ];
    const oct = await computeWorkerLedger({ year: 2025, monthIndex0: 9 });
    const r = oct.rows[0];
    // earnings 1000, prev 0, advance 200 => netPayable 800
    expect(r.netPayable).toBe(800);
    // remaining = 800 + 100 − 300 = 600 (positive => red)
    expect(r.remainingBalance).toBe(600);
    expect(r.remainingBalance > 0).toBe(true);
  });

  it("remaining goes negative (green) when paid + advance exceed dues", async () => {
    tables.workers = [
      { id: "w1", name: "A", daily_rate: 500, is_active: true, upi_id: null, phone: null, site_name: null },
    ];
    tables.attendance = [
      { worker_id: "w1", status: "Present", advance: 0, overtime_hours: 0, site_name: null, date: "2025-10-01" },
    ];
    tables.payment_history = [
      { worker_id: "w1", amount: 1500, site_name: null, payment_date: "2025-10-04" },
    ];
    const oct = await computeWorkerLedger({ year: 2025, monthIndex0: 9 });
    const r = oct.rows[0];
    expect(r.remainingBalance).toBe(-1000);
    expect(r.remainingBalance < 0).toBe(true);
  });
});

describe("sumPendingOutstanding — shared source of truth", () => {
  it("ignores overpaid workers (negative outstanding) so dashboard matches pending page", async () => {
    tables.workers = [
      { id: "w1", name: "A", daily_rate: 500, is_active: true, upi_id: null, phone: null, site_name: null },
      { id: "w2", name: "B", daily_rate: 500, is_active: true, upi_id: null, phone: null, site_name: null },
    ];
    // w1: earns 5000, nothing paid => +5000 pending
    for (let d = 1; d <= 10; d++) {
      tables.attendance.push({
        worker_id: "w1", status: "Present", advance: 0, overtime_hours: 0, site_name: null,
        date: `2025-10-${String(d).padStart(2, "0")}`,
      });
    }
    // w2: earns 500, paid 800 => −300 (overpaid)
    tables.attendance.push({
      worker_id: "w2", status: "Present", advance: 0, overtime_hours: 0, site_name: null, date: "2025-10-01",
    });
    tables.payment_history.push({
      worker_id: "w2", amount: 800, site_name: null, payment_date: "2025-10-02",
    });

    const res = await computeWorkerPayments({ startISO: "2025-10-01", endISO: "2025-10-31" });
    // Raw totals nets to 4700, but shared helper returns 5000 (only positives).
    expect(Math.round(res.totals.outstanding)).toBe(4700);
    expect(sumPendingOutstanding(res.rows)).toBe(5000);
  });
});
