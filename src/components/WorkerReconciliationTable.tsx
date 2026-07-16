import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type { WorkerLedger } from "@/lib/payment-engine";

/**
 * Per-worker reconciliation table.
 * Shows exactly how each worker contributes to the on-screen totals:
 *
 *   Total Earned    = Σ currentEarnings
 *   Total Paid      = Σ currentPaid
 *   Total Advance   = Σ totalAdvanceLifetime  (includes carry-forward)
 *   Remaining       = Σ remainingBalance
 *
 * The Remaining column shows the SAME formula the dashboard/pending page uses:
 *   Remaining = Previous Balance + Current Earnings − Current Advance
 *               + Current Expenses − Current Paid
 */

type Totals = {
  currentEarnings: number;
  currentPaid: number;
  totalAdvanceLifetime: number;
  remainingBalance: number;
};

function inr(n: number) {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}₹${Math.abs(r).toLocaleString("hi-IN")}`;
}

export default function WorkerReconciliationTable({
  rows,
  totals,
  title = "मजदूर-वार हिसाब मिलान (Reconciliation)",
  defaultCollapsed = true,
}: {
  rows: WorkerLedger[];
  totals: Totals;
  title?: string;
  defaultCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.remainingBalance - a.remainingBalance),
    [rows],
  );

  if (rows.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 active:scale-[0.998] transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <h3 className="text-sm font-extrabold truncate text-left">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {rows.length} मजदूर
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold sticky left-0 bg-muted/50">मजदूर</th>
                <th className="px-3 py-2 font-bold text-right whitespace-nowrap">कमाई</th>
                <th className="px-3 py-2 font-bold text-right whitespace-nowrap">एडवांस*</th>
                <th className="px-3 py-2 font-bold text-right whitespace-nowrap">चुकाया</th>
                <th className="px-3 py-2 font-bold text-right whitespace-nowrap">बाकी</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const rem = Math.round(r.remainingBalance);
                const tone =
                  rem > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : rem < 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground";
                return (
                  <tr
                    key={r.worker.id}
                    className="border-t border-border/40 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 font-semibold sticky left-0 bg-card">
                      <div className="truncate max-w-[9rem]">{r.worker.name}</div>
                      {r.worker.site_name && (
                        <div className="text-[10px] text-muted-foreground truncate max-w-[9rem]">
                          {r.worker.site_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {inr(r.currentEarnings)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-orange-600 dark:text-orange-400">
                      {inr(r.totalAdvanceLifetime)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-blue-600 dark:text-blue-400">
                      {inr(r.currentPaid)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-extrabold ${tone}`}>
                      {inr(r.remainingBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/60 font-extrabold">
              <tr>
                <td className="px-3 py-2 sticky left-0 bg-muted/60">कुल</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {inr(totals.currentEarnings)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-orange-600 dark:text-orange-400">
                  {inr(totals.totalAdvanceLifetime)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-blue-600 dark:text-blue-400">
                  {inr(totals.currentPaid)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {inr(totals.remainingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/40">
            * एडवांस में पिछले महीनों का कैरी-फ़ॉरवर्ड शामिल है।
            बाकी = कमाई + पिछला बाकी − एडवांस + खर्च − चुकाया
          </p>
        </div>
      )}
    </section>
  );
}
