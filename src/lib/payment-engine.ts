/**
 * Centralized Payment Engine
 * --------------------------
 * The SINGLE source of truth for worker payment calculations across the app.
 *
 * Inputs (only these three modules affect a worker's outstanding amount):
 *   1. Attendance     — earnings (Present/Half-Day wage + Overtime pay)
 *   2. Advance        — stored on the same attendance row (`advance` column)
 *   3. Worker Expenses — `worker_expenses` table (food, tea, medicine, rent, tools…)
 *
 * Cashbook is COMPLETELY INDEPENDENT and must NEVER be read here.
 *
 * Global Formula:
 *   Outstanding = Earnings (Attendance) + Worker Expenses − Advances
 */
import { supabase } from "@/integrations/supabase/client";

export type WorkerLite = {
  id: string;
  name: string;
  daily_rate: number | null;
  upi_id?: string | null;
  phone?: string | null;
  site_name?: string | null;
};

export type WorkerPayment = {
  worker: WorkerLite;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  days: number;            // Present + 0.5 × Half-Day
  baseEarning: number;     // wage × days
  overtimePay: number;     // overtime_hours × hourly_rate
  earned: number;          // baseEarning + overtimePay
  workerExpenses: number;  // sum of worker_expenses for that worker in window
  advance: number;
  paidAmount: number;      // sum of payment_history for that worker in window
  outstanding: number;     // earned + workerExpenses − advance − paidAmount
};

type AttRow = {
  worker_id: string;
  status: string | null;
  advance: number | null;
  overtime_hours: number | null;
  site_name: string | null;
  date: string;
};

type ExpRow = {
  worker_id: string;
  amount: number | null;
  site_name: string | null;
  date: string;
};

type PayRow = {
  worker_id: string;
  amount: number | null;
  site_name: string | null;
  payment_date: string;
};

export type PaymentResult = {
  rows: WorkerPayment[];
  totals: {
    earned: number;
    workerExpenses: number;
    advance: number;
    paidAmount: number;
    outstanding: number;
  };
};

/**
 * Fetch & compute all worker payments for a date window, optionally filtered by site.
 * `site` matches against the attendance/expense row's site_name (case-insensitive trimmed).
 */
export async function computeWorkerPayments(opts: {
  startISO: string;
  endISO: string;
  siteFilter?: string | null;
}): Promise<PaymentResult> {
  const { startISO, endISO } = opts;
  const site = (opts.siteFilter || "").trim();

  const [wRes, aRes, eRes, pRes] = await Promise.all([
    supabase
      .from("workers")
      .select("id,name,daily_rate,upi_id,phone,site_name")
      .eq("is_active", true),
    supabase
      .from("attendance")
      .select("worker_id,status,advance,overtime_hours,site_name,date")
      .gte("date", startISO)
      .lte("date", endISO),
    supabase
      .from("worker_expenses")
      .select("worker_id,amount,site_name,date")
      .gte("date", startISO)
      .lte("date", endISO),
    supabase
      .from("payment_history")
      .select("worker_id,amount,site_name,payment_date")
      .gte("payment_date", startISO)
      .lte("payment_date", endISO),
  ]);

  const workers: WorkerLite[] = (wRes.data || []) as WorkerLite[];
  const att: AttRow[] = (aRes.data || []) as AttRow[];
  const exp: ExpRow[] = (eRes.data || []) as ExpRow[];
  const pay: PayRow[] = (pRes.data || []) as PayRow[];

  return reduceWorkerPayments(workers, att, exp, pay, site);
}

/** Pure reducer — exported for tests / in-memory use. */
export function reduceWorkerPayments(
  workers: WorkerLite[],
  att: AttRow[],
  exp: ExpRow[],
  pay: PayRow[] = [],
  siteFilter?: string | null,
): PaymentResult {
  const site = (siteFilter || "").trim();
  const matchesSite = (s: string | null | undefined) =>
    !site || (s || "").trim() === site;

  const byId = new Map<string, WorkerLite>();
  workers.forEach((w) => byId.set(w.id, w));

  const acc = new Map<string, WorkerPayment>();
  const init = (w: WorkerLite): WorkerPayment => ({
    worker: w,
    presentDays: 0,
    halfDays: 0,
    absentDays: 0,
    days: 0,
    baseEarning: 0,
    overtimePay: 0,
    earned: 0,
    workerExpenses: 0,
    advance: 0,
    paidAmount: 0,
    outstanding: 0,
  });

  // Attendance → earnings + advance
  att.forEach((r) => {
    if (!matchesSite(r.site_name)) return;
    const w = byId.get(r.worker_id);
    if (!w) return;
    const row = acc.get(w.id) || init(w);
    const rate = w.daily_rate || 0;
    const otRate = rate / 8;

    if (r.status === "Present") {
      row.presentDays += 1;
      row.days += 1;
      row.baseEarning += rate;
    } else if (r.status === "Half-Day") {
      row.halfDays += 1;
      row.days += 0.5;
      row.baseEarning += rate * 0.5;
    } else if (r.status === "Absent") {
      row.absentDays += 1;
    }
    row.overtimePay += (r.overtime_hours || 0) * otRate;
    row.advance += r.advance || 0;
    acc.set(w.id, row);
  });

  // Worker expenses
  exp.forEach((r) => {
    if (!matchesSite(r.site_name)) return;
    const w = byId.get(r.worker_id);
    if (!w) return;
    const row = acc.get(w.id) || init(w);
    row.workerExpenses += Number(r.amount) || 0;
    acc.set(w.id, row);
  });

  // Paid amount (payment_history)
  pay.forEach((r) => {
    if (!matchesSite(r.site_name)) return;
    const w = byId.get(r.worker_id);
    if (!w) return;
    const row = acc.get(w.id) || init(w);
    row.paidAmount += Number(r.amount) || 0;
    acc.set(w.id, row);
  });

  // If site filter is set, drop workers with no activity in that site.
  // If not, include all active workers (even zero rows).
  if (!site) {
    workers.forEach((w) => {
      if (!acc.has(w.id)) acc.set(w.id, init(w));
    });
  }

  const rows: WorkerPayment[] = [];
  acc.forEach((row) => {
    row.earned = row.baseEarning + row.overtimePay;
    row.outstanding = row.earned + row.workerExpenses - row.advance - row.paidAmount;
    rows.push(row);
  });
  rows.sort((a, b) => b.outstanding - a.outstanding);

  const totals = rows.reduce(
    (t, r) => {
      t.earned += r.earned;
      t.workerExpenses += r.workerExpenses;
      t.advance += r.advance;
      t.paidAmount += r.paidAmount;
      t.outstanding += r.outstanding;
      return t;
    },
    { earned: 0, workerExpenses: 0, advance: 0, paidAmount: 0, outstanding: 0 },
  );

  return { rows, totals };
}

/**
 * Subscribe to all tables that affect payment calculations.
 * Returns an unsubscribe function. Call inside a useEffect.
 */
export function subscribePaymentSources(onChange: () => void) {
  const ch = supabase
    .channel("payment-engine-" + Math.random().toString(36).slice(2, 8))
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "worker_expenses" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "payment_history" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "cashbook" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "workers" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}

export function monthBoundsISO(year: number, monthIndex0: number) {
  const s = new Date(year, monthIndex0, 1);
  const e = new Date(year, monthIndex0 + 1, 0);
  const iso = (d: Date) => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; };
  return { startISO: iso(s), endISO: iso(e) };
}
