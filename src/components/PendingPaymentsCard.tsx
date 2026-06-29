import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Smartphone, Phone, ArrowRight, AlertCircle } from "lucide-react";
import UpiPayDialog from "./UpiPayDialog";

type Props = {
  startISO: string;
  endISO: string;
  monthLabel: string;
  siteFilter?: string | null;

};

type W = { id: string; name: string; daily_rate: number | null; upi_id: string | null; phone: string | null; site_name: string | null };
type A = { worker_id: string; status: string; advance: number | null; overtime_hours: number | null };

type PendingRow = {
  worker: W;
  earned: number;
  advance: number;
  pending: number;
  days: number;
};

export default function PendingPaymentsCard({ startISO, endISO, monthLabel }: Props) {
  const [workers, setWorkers] = useState<W[]>([]);
  const [att, setAtt] = useState<A[]>([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState<PendingRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [w, a] = await Promise.all([
        supabase.from("workers").select("id,name,daily_rate,upi_id,phone,site_name").eq("is_active", true),
        supabase
          .from("attendance")
          .select("worker_id,status,advance,overtime_hours")
          .gte("date", startISO)
          .lte("date", endISO),
      ]);
      if (!alive) return;
      setWorkers((w.data || []) as W[]);
      setAtt((a.data || []) as A[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startISO, endISO]);

  const rows = useMemo<PendingRow[]>(() => {
    const byWorker = new Map<string, { earned: number; advance: number; days: number }>();
    workers.forEach((w) => byWorker.set(w.id, { earned: 0, advance: 0, days: 0 }));
    att.forEach((r) => {
      const acc = byWorker.get(r.worker_id);
      if (!acc) return;
      const w = workers.find((x) => x.id === r.worker_id);
      const rate = w?.daily_rate || 0;
      const dayFactor = r.status === "Present" ? 1 : r.status === "Half-Day" ? 0.5 : 0;
      const otHours = r.overtime_hours || 0;
      const otRate = rate / 8; // hourly rate
      acc.earned += rate * dayFactor + otRate * otHours;
      acc.advance += r.advance || 0;
      if (dayFactor > 0) acc.days += dayFactor;
    });
    const out: PendingRow[] = [];
    workers.forEach((w) => {
      const v = byWorker.get(w.id)!;
      const pending = Math.round(v.earned - v.advance);
      if (pending > 0) out.push({ worker: w, earned: Math.round(v.earned), advance: Math.round(v.advance), pending, days: v.days });
    });
    out.sort((a, b) => b.pending - a.pending);
    return out;
  }, [workers, att]);

  const total = rows.reduce((s, r) => s + r.pending, 0);

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <h2 className="text-base font-extrabold">बकाया भुगतान</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">{monthLabel}</span>
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground">
          {rows.length} मजदूरों का बकाया
        </span>
        <span className="text-xl font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
          ₹{total.toLocaleString("hi-IN")}
        </span>
      </div>

      {loading ? (
        <div className="text-center text-xs text-muted-foreground py-3">लोड हो रहा है...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-3">
          ✓ कोई बकाया नहीं — सब चुकाया जा चुका है
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((r) => {
            const hasUpi = !!r.worker.upi_id;
            return (
              <li
                key={r.worker.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{r.worker.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.days} दिन • कमाई ₹{r.earned.toLocaleString("hi-IN")}
                    {r.advance > 0 ? ` • एडवांस ₹${r.advance.toLocaleString("hi-IN")}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                    ₹{r.pending.toLocaleString("hi-IN")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {hasUpi ? (
                      <button
                        onClick={() => setPayTarget(r)}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition"
                      >
                        <Smartphone className="w-3 h-3" /> भुगतान
                      </button>
                    ) : r.worker.phone ? (
                      <a
                        href={`tel:${r.worker.phone}`}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-sky-600 text-white"
                      >
                        <Phone className="w-3 h-3" /> कॉल
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        <AlertCircle className="w-3 h-3" /> UPI जोड़ें
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {rows.length > 8 && (
            <li className="text-center text-[11px] text-muted-foreground pt-1">
              और {rows.length - 8} मजदूर बाकी हैं
              <ArrowRight className="inline w-3 h-3 ml-1" />
            </li>
          )}
        </ul>
      )}

      <UpiPayDialog
        open={!!payTarget}
        onOpenChange={(v) => !v && setPayTarget(null)}
        payeeName={payTarget?.worker.name || ""}
        payeeVpa={payTarget?.worker.upi_id}
        defaultAmount={payTarget?.pending}
        defaultNote={`${payTarget?.worker.name || ""} - ${monthLabel} की मजदूरी`}
      />
    </section>
  );
}
