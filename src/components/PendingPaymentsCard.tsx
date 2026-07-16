import { toISODate } from "@/lib/date-utils";
import { useEffect, useMemo, useState } from "react";
import { Wallet, Smartphone, Phone, ArrowRight, AlertCircle, Check } from "lucide-react";
import UpiPayDialog from "./UpiPayDialog";
import {
  computeWorkerPayments,
  subscribePaymentSources,
  sumPendingOutstanding,
  type WorkerPayment,
} from "@/lib/payment-engine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  startISO: string;
  endISO: string;
  monthLabel: string;
  siteFilter?: string | null;
};

export default function PendingPaymentsCard({ startISO, endISO, monthLabel, siteFilter = null }: Props) {
  const [rows, setRows] = useState<WorkerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payTarget, setPayTarget] = useState<WorkerPayment | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await computeWorkerPayments({ startISO, endISO, siteFilter });
      if (!alive) return;
      setRows(res.rows.filter((r) => Math.round(r.outstanding) > 0));
      setLoading(false);
    };
    setLoading(true);
    load();
    const unsub = subscribePaymentSources(load);
    return () => { alive = false; unsub(); };
  }, [startISO, endISO, siteFilter]);

  const total = useMemo(() => sumPendingOutstanding(rows), [rows]);

  const handleMarkAsPaid = async (r: WorkerPayment) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("कृपया पहले लॉग इन करें");
      return;
    }
    const amount = Math.round(r.outstanding);
    if (amount <= 0) return;

    const todayISO =toISODate(new Date());
    const { error } = await supabase.from("payment_history").insert({
      user_id: user.id,
      worker_id: r.worker.id,
      amount: amount,
      payment_date: todayISO,
      payment_mode: "Cash",
      note: `${monthLabel} भुगतान`,
      site_name: r.worker.site_name || null,
    });

    if (error) {
      toast.error("भुगतान दर्ज करने में विफल: " + error.message);
    } else {
      toast.success(`${r.worker.name} का ₹${amount.toLocaleString("hi-IN")} भुगतान दर्ज हुआ`);
    }
  };

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
            const pending = Math.round(r.outstanding);
            const earned = Math.round(r.earned);
            const exp = Math.round(r.workerExpenses);
            const adv = Math.round(r.advance);
            const hasUpi = !!r.worker.upi_id;
            return (
              <li
                key={r.worker.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{r.worker.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.days} दिन • कमाई ₹{earned.toLocaleString("hi-IN")}
                    {exp > 0 ? ` • खर्च ₹${exp.toLocaleString("hi-IN")}` : ""}
                    {adv > 0 ? ` • एडवांस ₹${adv.toLocaleString("hi-IN")}` : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                    ₹{pending.toLocaleString("hi-IN")}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      onClick={() => handleMarkAsPaid(r)}
                      className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm"
                    >
                      <Check className="w-3 h-3" /> ✓ Mark as Paid
                    </button>
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
        defaultAmount={payTarget ? Math.round(payTarget.outstanding) : undefined}
        defaultNote={`${payTarget?.worker.name || ""} - ${monthLabel} की मजदूरी`}
      />
    </section>
  );
}
