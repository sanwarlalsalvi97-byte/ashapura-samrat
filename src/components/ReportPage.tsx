import { monthBoundsISO, todayISO } from "@/lib/date-utils";
import { useRole } from "@/lib/roles";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteWorkerMonthAttendance, getWorkers, getContractors, type Worker, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import { listSites } from "@/lib/sites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaise, parseRupeesToPaise } from "@/lib/currency";
import { ChevronLeft, ChevronRight, Share2, Trash2, FileDown, FileText, Building2, Users, Wallet, TrendingDown, BadgeIndianRupee, ArrowLeftRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportCSV, exportPDF } from "@/lib/export-utils";
import { computeWorkerLedger, type WorkerLedger, subscribePaymentSources } from "@/lib/payment-engine";
import WorkerReconciliationTable from "@/components/WorkerReconciliationTable";
import SiteFilterBar from "@/components/SiteFilterBar";
import SiteWiseReport from "@/components/SiteWiseReport";
import PaySalaryDialog from "@/components/PaySalaryDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const monthNames = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

function inr(n: number) {
  return `${n < 0 ? "-" : ""}₹${Math.abs(n).toLocaleString("hi-IN", { maximumFractionDigits: 2 })}`;
}

export default function ReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [ledger, setLedger] = useState<WorkerLedger[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState({
    previousBalance: 0, currentEarnings: 0, currentAdvance: 0,
    totalAdvanceLifetime: 0, currentPaid: 0, netPayable: 0, remainingBalance: 0,
  });
  const [siteFilter, setSiteFilter] = useState<string>("__all__");
  const [siteAtt, setSiteAtt] = useState<any[]>([]);
  const [siteCash, setSiteCash] = useState<{ amount: number; site_name: string | null; type: string }[]>([]);
  const [siteExp, setSiteExp] = useState<{ amount: number; site_name: string | null }[]>([]);
  const [sitePay, setSitePay] = useState<{ amount: number; site_name: string | null }[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const { readOnly } = useRole();
  const [payTarget, setPayTarget] = useState<WorkerLedger | null>(null);

  const loadSiteData = useCallback(async () => {
    try {
      const { startISO: startDate, endISO: endDate } = monthBoundsISO(year, month - 1);
      const [a, c, e, p, w] = await Promise.all([
        supabase.from("attendance").select("status, advance, site_name, worker_id, workers(name, daily_rate)").gte("date", startDate).lte("date", endDate),
        supabase.from("cashbook").select("amount, site_name, type").gte("date", startDate).lte("date", endDate),
        supabase.from("worker_expenses").select("amount, site_name").gte("date", startDate).lte("date", endDate),
        supabase.from("payment_history").select("amount, site_name").gte("payment_date", startDate).lte("payment_date", endDate),
        getWorkers().catch(() => [] as Worker[]),
      ]);
      setSiteAtt((a.data as any[]) || []);
      setSiteCash((c.data as any[]) || []);
      setSiteExp((e.data as any[]) || []);
      setSitePay((p.data as any[]) || []);
      setAllWorkers(w);
    } catch (err) {
      console.error("Site Data Load Error:", err);
    }
  }, [year, month]);

  useEffect(() => { loadSiteData(); }, [loadSiteData]);

  const activeSite = siteFilter === "__all__" ? null : siteFilter;

  const loadLedger = useCallback(async () => {
    try {
      const res = await computeWorkerLedger({ year, monthIndex0: month - 1, siteFilter: activeSite });
      setLedger(res.rows);
      setLedgerTotals(res.totals);
    } catch (err: any) {
      console.error("Ledger Load Error:", err);
      toast({ 
        title: "रिपोर्ट लोड करने में त्रुटि", 
        description: err?.message || String(err), 
        variant: "destructive" 
      });
    }
  }, [year, month, activeSite]);

  useEffect(() => {
    loadLedger();
    const unsub = subscribePaymentSources(() => { loadLedger(); loadSiteData(); });
    return () => unsub();
  }, [loadLedger, loadSiteData]);

  const visibleLedger = useMemo(() => {
    if (!activeSite) return ledger;
    return ledger.filter((l) =>
      (l.worker?.site_name || "").trim() === activeSite ||
      l.presentDays || l.halfDays || l.absentDays ||
      l.currentEarnings || l.currentAdvance || l.currentPaid || l.previousBalance
    );
  }, [ledger, activeSite]);

  const handleDelete = async (worker: WorkerLedger) => {
    try {
      await deleteWorkerMonthAttendance(worker.worker.id, year, month);
      toast({ title: `🗑️ ${worker.worker.name} की ${monthNames[month - 1]} की रिपोर्ट हटा दी गई` });
      loadLedger();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    }
  };

  const changeMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const exportMonthly = async (format: "csv" | "pdf") => {
    if (visibleLedger.length === 0) return;
    const mode = getGroupingMode();
    let workers: Worker[] = [];
    let contractors: Contractor[] = [];
    try {
      workers = await getWorkers();
      if (mode === "contractor") contractors = await getContractors();
    } catch {}
    const workerById = new Map(workers.map((w) => [w.id, w]));

    const headers = ["साइट", "ठेकेदार/समूह", "नाम", "पिछला बाकी", "हाजिर", "आधा", "गैर", "कमाई", "एडवांस", "जीवन एडवांस", "चुकाया", "देय", "बाकी"];
    const rows: (string | number)[][] = visibleLedger.map((s) => {
      const w = workerById.get(s.worker.id);
      const group = w ? resolveGroupLabel(w, contractors, mode) : "—";
      const site = activeSite || (w?.site_name || s.worker?.site_name || "—");
      return [
        site, group, s.worker?.name || "अज्ञात",
        Math.round(s.previousBalance),
        s.presentDays, s.halfDays, s.absentDays,
        Math.round(s.currentEarnings), Math.round(s.currentAdvance),
        Math.round(s.totalAdvanceLifetime), Math.round(s.currentPaid),
        Math.round(s.netPayable), s.remainingBalance,
      ];
    });
    rows.push([activeSite || "सभी साइट", "", "कुल", Math.round(ledgerTotals.previousBalance), "", "", "",
      Math.round(ledgerTotals.currentEarnings), Math.round(ledgerTotals.currentAdvance),
      Math.round(ledgerTotals.totalAdvanceLifetime), Math.round(ledgerTotals.currentPaid),
      Math.round(ledgerTotals.netPayable), ledgerTotals.remainingBalance]);
    const siteLabel = activeSite ? ` — साइट: ${activeSite}` : " — सभी साइट";
    const title = `मासिक रिपोर्ट — ${monthNames[month - 1]} ${year}${siteLabel}`;
    if (format === "csv") {
      const fileSite = activeSite ? `-${activeSite.replace(/[\\/:*?"<>|\s]+/g, "_")}` : "";
      exportCSV(`रिपोर्ट-${year}-${String(month).padStart(2, "0")}${fileSite}.csv`, headers, rows);
      toast({ title: "CSV डाउनलोड हो गई" });
    } else {
      exportPDF(title, headers, rows);
    }
  };

  const shareOnWhatsApp = (worker?: WorkerLedger) => {
    let text = "";
    if (worker) {
      text = `📋 *${worker.worker?.name || "मज़दूर"}* — ${monthNames[month - 1]} ${year}\n\n` +
        `🔁 पिछला बाकी: ${inr(worker.previousBalance)}\n` +
        `✅ हाजिर: ${worker.presentDays} | आधा: ${worker.halfDays} | गैर: ${worker.absentDays}\n\n` +
        `💰 इस माह कमाई: ${inr(worker.currentEarnings)}\n` +
        `💸 इस माह एडवांस: ${inr(worker.currentAdvance)}\n` +
        `📊 कुल एडवांस (जीवन): ${inr(worker.totalAdvanceLifetime)}\n` +
        `💵 चुकाया: ${inr(worker.currentPaid)}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 *देय (Net Payable): ${inr(worker.netPayable)}*\n` +
        `🏁 *बाकी: ${inr(worker.remainingBalance)}*`;
    } else {
      text = `📋 *पेरोल रिपोर्ट — ${monthNames[month - 1]} ${year}*\n🏗️ साइट: ${activeSite || "सभी साइट"}\n\n`;
      visibleLedger.forEach((s) => {
        text += `👷 *${s.worker?.name || "मज़दूर"}*\n` +
          `   पिछला: ${inr(s.previousBalance)} | कमाई: ${inr(s.currentEarnings)} | एडवांस: ${inr(s.currentAdvance)}\n` +
          `   बाकी: *${inr(s.remainingBalance)}*\n\n`;
      });
      text += `💰 *कुल बाकी: ${inr(ledgerTotals.remainingBalance)}*`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Month selector */}
      <div className="flex items-center justify-between gap-2 bg-card rounded-2xl p-2 border border-border/60 shadow-sm">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-background border border-input rounded-lg px-2 py-2 text-sm font-semibold">
            {monthNames.map((n, i) => (<option key={i} value={i + 1}>{n}</option>))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-background border border-input rounded-lg px-2 py-2 text-sm font-semibold">
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => changeMonth(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Site filter */}
      <SiteFilterBar value={siteFilter} onChange={setSiteFilter} />

      {/* === Payroll Summary Cards === */}
      <section>
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.55)]">
          <div className="text-[11px] font-bold uppercase tracking-widest opacity-90">
            कुल बाकी (Remaining) • {activeSite || "सभी साइट"}
          </div>
          <div className="text-4xl font-extrabold tabular-nums mt-1">{inr(ledgerTotals.remainingBalance)}</div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-2xl bg-white/15 backdrop-blur p-2.5">
              <div className="text-[10px] font-bold uppercase opacity-90">पिछला बाकी</div>
              <div className="text-base font-extrabold tabular-nums">{inr(ledgerTotals.previousBalance)}</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur p-2.5">
              <div className="text-[10px] font-bold uppercase opacity-90">इस माह कमाई</div>
              <div className="text-base font-extrabold tabular-nums">{inr(ledgerTotals.currentEarnings)}</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur p-2.5">
              <div className="text-[10px] font-bold uppercase opacity-90">कुल एडवांस</div>
              <div className="text-base font-extrabold tabular-nums">{inr(ledgerTotals.totalAdvanceLifetime)}</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur p-2.5">
              <div className="text-[10px] font-bold uppercase opacity-90">कुल देय</div>
              <div className="text-base font-extrabold tabular-nums">{inr(ledgerTotals.netPayable)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* === मजदूर-वार हिसाब मिलान (Reconciliation) === */}
      <WorkerReconciliationTable
        rows={visibleLedger}
        totals={ledgerTotals}
        defaultCollapsed={false}
      />

      {/* === साइट-वाइज मासिक रिपोर्ट === */}
      <SiteWiseReport
        att={siteAtt}
        cash={siteCash}
        exp={siteExp}
        pay={sitePay}
        workers={allWorkers}
        monthLabel={`${monthNames[month - 1]} ${year}`}
        siteFilter={siteFilter}
        onSiteFilterChange={setSiteFilter}
      />

      {visibleLedger.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई रिकॉर्ड नहीं</p>
          <p className="text-sm mt-1">
            {activeSite ? `${activeSite} पर इस महीने कोई हाजिरी नहीं` : "इस महीने की हाजिरी लगाएं"}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => shareOnWhatsApp()}>
              <Share2 className="w-4 h-4" /> WhatsApp
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                  <FileDown className="w-4 h-4" /> एक्सपोर्ट
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportMonthly("csv")}>
                  <FileDown className="w-4 h-4 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportMonthly("pdf")}>
                  <FileText className="w-4 h-4 mr-2" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-3">
            {visibleLedger.map((s) => (
              <LedgerCard
                key={s.worker?.id || Math.random()}
                l={s}
                month={month}
                year={year}
                onPay={readOnly ? undefined : () => setPayTarget(s)}
                onShare={() => shareOnWhatsApp(s)}
                onDelete={readOnly ? undefined : () => handleDelete(s)}
              />
            ))}
          </div>
        </>
      )}

      <PaySalaryDialog
        target={payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={() => { setPayTarget(null); loadLedger(); }}
      />
    </div>
  );
}

function LedgerCard({
  l, month, year, onPay, onShare, onDelete,
}: {
  l: WorkerLedger;
  month: number;
  year: number;
  onPay?: () => void;
  onShare: () => void;
  onDelete?: () => void;
}) {
  const negative = l.remainingBalance < -0.5;
  const positive = l.remainingBalance > 0.5;
  const workerName = l.worker?.name || "मज़दूर";
  const workerSite = l.worker?.site_name || "साइट नहीं";
  const profileUrl = (l.worker as any)?.profile_url;

  return (
    <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 p-4 bg-gradient-to-r from-emerald-50/70 to-transparent dark:from-emerald-950/20">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {profileUrl ? (
              <img 
                src={profileUrl} 
                alt={workerName} 
                className="w-10 h-10 rounded-xl object-cover border border-emerald-200 shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 grid place-items-center font-extrabold text-sm shrink-0">
                {workerName.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block font-extrabold truncate">{workerName}</span>
              <span className="block text-[10px] font-bold text-muted-foreground truncate">
                🏗️ {workerSite}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onShare}>
              <Share2 className="w-4 h-4" />
            </Button>
            {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>रिपोर्ट हटाएं?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {workerName} की {monthNames[month - 1]} {year} की पूरी हाजिरी और एडवांस हट जाएंगी।
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>रद्द</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    हटाएं
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-3 space-y-3">
        {/* Days */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl p-2">
            <p className="text-emerald-700 dark:text-emerald-300 font-extrabold text-lg tabular-nums">{l.presentDays}</p>
            <p className="text-muted-foreground text-[10px] font-bold">हाजिर</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-2">
            <p className="text-amber-700 dark:text-amber-300 font-extrabold text-lg tabular-nums">{l.halfDays}</p>
            <p className="text-muted-foreground text-[10px] font-bold">आधा</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/30 rounded-xl p-2">
            <p className="text-red-600 dark:text-red-300 font-extrabold text-lg tabular-nums">{l.absentDays}</p>
            <p className="text-muted-foreground text-[10px] font-bold">गैरहाजिर</p>
          </div>
        </div>

        {/* Ledger rows */}
        <div className="space-y-1 text-sm">
          <Row label="🔁 पिछला बाकी (Carry Fwd)"
            value={inr(l.previousBalance)}
            tone={l.previousBalance < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-300"} />
          <Row label="💰 इस माह कमाई" value={inr(l.currentEarnings)} />
          <Row label="💸 इस माह एडवांस" value={`- ${inr(l.currentAdvance)}`} tone="text-orange-600" />
          <Row label="📊 कुल एडवांस (जीवन)" value={inr(l.totalAdvanceLifetime)} muted />
          {l.currentPaid > 0 && (
            <Row label="💵 इस माह चुकाया" value={`- ${inr(l.currentPaid)}`} tone="text-blue-600" />
          )}
        </div>

        {/* Net Payable */}
        <div className="rounded-2xl border-2 border-dashed border-border/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">देय (Net Payable)</span>
            <span className={`text-lg font-extrabold tabular-nums ${l.netPayable < 0  ? "text-red-600" : "text-emerald-700 dark:text-emerald-300"}`}>
              {inr(l.netPayable)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-muted-foreground">बाकी राशि (Remaining)</span>
            <span className={`text-xl font-extrabold tabular-nums ${negative ? "text-red-600" : positive ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
               {inr(l.remainingBalance)}
            </span>
          </div>
        </div>

        {/* Pay button */}
        {onPay && (
          <Button onClick={onPay} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            💵 भुगतान करें (Pay Salary)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, tone = "", muted = false }: { label: string; value: string; tone?: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className={`text-xs font-semibold ${muted ? "text-muted-foreground/80" : "text-muted-foreground"}`}>{label}</span>
      <span className={`text-xs font-extrabold tabular-nums ${tone || (muted ? "text-muted-foreground" : "")}`}>{value}</span>
    </div>
  );
}
