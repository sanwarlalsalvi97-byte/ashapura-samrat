import { monthBoundsISO, todayISO } from "@/lib/date-utils";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteWorkerMonthAttendance, getWorkers, getContractors, type Worker, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import { listSites } from "@/lib/sites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Share2, Trash2, FileDown, FileText, Building2, Users, Wallet, TrendingDown, BadgeIndianRupee, ArrowLeftRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportCSV, exportPDF } from "@/lib/export-utils";
import { computeWorkerLedger, type WorkerLedger, subscribePaymentSources } from "@/lib/payment-engine";
import WorkerReconciliationTable from "./WorkerReconciliationTable";
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
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}₹${Math.abs(rounded).toLocaleString("hi-IN")}`;
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
  const [payTarget, setPayTarget] = useState<WorkerLedger | null>(null);

  const loadSiteData = useCallback(async () => {
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
  }, [year, month]);

  useEffect(() => { loadSiteData(); }, [loadSiteData]);

  const loadLedger = useCallback(async () => {
    try {
      const res = await computeWorkerLedger({ year, monthIndex0: month - 1 });
      setLedger(res.rows);
      setLedgerTotals(res.totals);
    } catch {}
  }, [year, month]);

  useEffect(() => {
    loadLedger();
    const unsub = subscribePaymentSources(() => { loadLedger(); loadSiteData(); });
    return () => unsub();
  }, [loadLedger, loadSiteData]);

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
    if (ledger.length === 0) return;
    const mode = getGroupingMode();
    let workers: Worker[] = [];
    let contractors: Contractor[] = [];
    try {
      workers = await getWorkers();
      if (mode === "contractor") contractors = await getContractors();
    } catch {}
    const workerById = new Map(workers.map((w) => [w.id, w]));

    const headers = ["ठेकेदार/साइट", "नाम", "पिछला बाकी", "हाजिर", "आधा", "गैर", "कमाई", "एडवांस", "जीवन एडवांस", "चुकाया", "देय", "बाकी"];
    const rows: (string | number)[][] = ledger.map((s) => {
      const w = workerById.get(s.worker.id);
      const group = w ? resolveGroupLabel(w, contractors, mode) : "—";
      return [
        group, s.worker.name,
        Math.round(s.previousBalance),
        s.presentDays, s.halfDays, s.absentDays,
        Math.round(s.currentEarnings), Math.round(s.currentAdvance),
        Math.round(s.totalAdvanceLifetime), Math.round(s.currentPaid),
        Math.round(s.netPayable), Math.round(s.remainingBalance),
      ];
    });
    rows.push(["", "कुल", Math.round(ledgerTotals.previousBalance), "", "", "",
      Math.round(ledgerTotals.currentEarnings), Math.round(ledgerTotals.currentAdvance),
      Math.round(ledgerTotals.totalAdvanceLifetime), Math.round(ledgerTotals.currentPaid),
      Math.round(ledgerTotals.netPayable), Math.round(ledgerTotals.remainingBalance)]);
    const title = `मासिक रिपोर्ट — ${monthNames[month - 1]} ${year}`;
    if (format === "csv") {
      exportCSV(`रिपोर्ट-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
      toast({ title: "CSV डाउनलोड हो गई" });
    } else {
      exportPDF(title, headers, rows);
    }
  };

  const shareOnWhatsApp = (worker?: WorkerLedger) => {
    let text = "";
    if (worker) {
      text = `📋 *${worker.worker.name}* — ${monthNames[month - 1]} ${year}\n\n` +
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
      text = `📋 *पेरोल रिपोर्ट — ${monthNames[month - 1]} ${year}*\n\n`;
      ledger.forEach((s) => {
        text += `👷 *${s.worker.name}*\n` +
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

      {/* === Payroll Summary Cards === */}
      <section>
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.55)]">
          <div className="text-[11px] font-bold uppercase tracking-widest opacity-90">कुल बाकी (Remaining)</div>
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
        rows={ledger}
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

      {ledger.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई रिकॉर्ड नहीं</p>
          <p className="text-sm mt-1">इस महीने की हाजिरी लगाएं</p>
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
            {ledger.map((s) => (
              <LedgerCard
                key={s.worker.id}
                l={s}
                month={month}
                year={year}
                onPay={() => setPayTarget(s)}
                onShare={() => shareOnWhatsApp(s)}
                onDelete={() => handleDelete(s)}
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
  onPay: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const negative = l.remainingBalance < -0.5;
  const positive = l.remainingBalance > 0.5;
  return (
    <Card className="rounded-3xl border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="pb-2 p-4 bg-gradient-to-r from-emerald-50/70 to-transparent dark:from-emerald-950/20">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 grid place-items-center font-extrabold text-sm">
              {l.worker.name.slice(0, 1)}
            </span>
            <span className="font-extrabold">{l.worker.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onShare}>
              <Share2 className="w-4 h-4" />
            </Button>
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
                    {l.worker.name} की {monthNames[month - 1]} {year} की पूरी हाजिरी और एडवांस हट जाएंगी।
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
            <span className={`text-lg font-extrabold tabular-nums ${l.netPayable < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-300"}`}>
              {inr(l.netPayable)}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-muted-foreground">बाकी राशि (Remaining)</span>
            <span className={`text-xl font-extrabold tabular-nums ${negative ? "text-red-600" : positive ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>
              {inr(l.remainingBalance)}
            </span>
          </div>
          {negative && (
            <div className="mt-1 text-[10px] font-semibold text-red-600 flex items-center gap-1">
              <ArrowLeftRight className="w-3 h-3" /> अगले माह में कैरी-फ़ॉरवर्ड होगा
            </div>
          )}
        </div>

        <Button
          onClick={onPay}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl h-11 font-bold"
        >
          <BadgeIndianRupee className="w-4 h-4" /> Pay Salary / सैलरी चुकाएं
        </Button>
      </CardContent>
    </Card>
  );
}

function PaySalaryDialog({
  target, onClose, onSaved,
}: {
  target: WorkerLedger | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("cash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      const suggested = Math.max(0, Math.round(target.remainingBalance));
      setAmount(String(suggested));
      setNote(`सैलरी सेटलमेंट`);
      setMode("cash");
    }
  }, [target]);

  const handlePay = async () => {
    if (!target) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast({ title: "राशि दर्ज करें", variant: "destructive" });
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("payment_history").insert({
        user_id: user.id,
        worker_id: target.worker.id,
        amount: amt,
        payment_date: todayISO(),
        payment_mode: mode,
        note: note || null,
        site_name: target.worker.site_name || null,
      });
      if (error) throw error;
      toast({ title: `✅ ${target.worker.name} को ${inr(amt)} चुकाए गए` });
      onSaved();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>सैलरी चुकाएं — {target?.worker.name}</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-900/50">
              <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">बाकी राशि</div>
              <div className="text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                {inr(target.remainingBalance)}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">राशि (₹)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 h-11 text-lg font-extrabold"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">तरीका</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold"
              >
                <option value="cash">Cash / नकद</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">नोट</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-10" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>रद्द</Button>
          <Button
            onClick={handlePay}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <BadgeIndianRupee className="w-4 h-4" /> {saving ? "सहेज रहा है..." : "चुकाएं"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SiteWiseReport({
  att, cash, exp, pay, workers, monthLabel, siteFilter, onSiteFilterChange,
}: {
  att: any[];
  cash: { amount: number; site_name: string | null; type: string }[];
  exp: { amount: number; site_name: string | null }[];
  pay: { amount: number; site_name: string | null }[];
  workers: Worker[];
  monthLabel: string;
  siteFilter: string;
  onSiteFilterChange: (v: string) => void;
}) {
  const sites = useMemo(() => {
    // Only show sites the user has manually added in the "Sites" page.
    return listSites().map((s) => s.name).sort();
  }, []);

  const data = useMemo(() => {
    const list = siteFilter === "__all__" ? sites : sites.filter((s) => s === siteFilter);
    return list.map((siteName) => {
      const aRows = att.filter((r) => (r.site_name || "") === siteName);
      const cRows = cash.filter((r) => (r.site_name || "") === siteName);
      const eRows = exp.filter((r) => (r.site_name || "") === siteName);
      const pRows = pay.filter((r) => (r.site_name || "") === siteName);
      const workerSet = new Set<string>();
      aRows.forEach((r) => workerSet.add(r.worker_id));
      workers.filter((w) => w.site_name === siteName).forEach((w) => workerSet.add(w.id));
      const present = aRows.filter((r) => r.status === "Present").length;
      const half = aRows.filter((r) => r.status === "Half-Day").length;
      const absent = aRows.filter((r) => r.status === "Absent").length;
      const totalAdvance = aRows.reduce((s, r) => s + (r.advance || 0), 0);
      const earning = aRows.reduce((s, r) => {
        const rate = r.workers?.daily_rate || 0;
        if (r.status === "Present") return s + rate;
        if (r.status === "Half-Day") return s + rate / 2;
        return s;
      }, 0);
      const cashbookExpense = cRows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      const workerExpenses = eRows.reduce((s, r) => s + r.amount, 0);
      const salaryPaid = pRows.reduce((s, r) => s + r.amount, 0);
      // Total Payable = Earnings − Advances already paid.
      // Advances are NEVER added to earnings; they reduce the remaining liability.
      const totalSiteExpense = earning - totalAdvance;
      return {
        siteName,
        workers: workerSet.size,
        attendance: present + half + absent,
        present, half, absent,
        earning,
        workerExpenses,
        advance: totalAdvance,
        cashbookExpense,
        salaryPaid,
        totalSiteExpense,
      };
    });
  }, [att, cash, exp, pay, workers, sites, siteFilter]);

  const totals = useMemo(() => ({
    workers: data.reduce((s, x) => s + x.workers, 0),
    attendance: data.reduce((s, x) => s + x.attendance, 0),
    expense: data.reduce((s, x) => s + x.totalSiteExpense, 0),
  }), [data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> साइट-वाइज रिपोर्ट
        </h2>
        <select
          value={siteFilter}
          onChange={(e) => onSiteFilterChange(e.target.value)}
          className="bg-background border border-input rounded-md px-2 py-1.5 text-xs font-semibold"
        >
          <option value="__all__">सभी साइट</option>
          {sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center">
          <Users className="w-4 h-4 mx-auto text-primary mb-1" />
          <div className="text-lg font-bold tabular-nums">{totals.workers}</div>
          <div className="text-[10px] text-muted-foreground">कुल मजदूर</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Wallet className="w-4 h-4 mx-auto text-accent mb-1" />
          <div className="text-lg font-bold tabular-nums">{totals.attendance}</div>
          <div className="text-[10px] text-muted-foreground">कुल हाजिरी</div>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <TrendingDown className="w-4 h-4 mx-auto text-destructive mb-1" />
          <div className="text-lg font-bold tabular-nums">₹{totals.expense.toLocaleString("hi-IN")}</div>
          <div className="text-[10px] text-muted-foreground">कुल देय (Payable)</div>
        </CardContent></Card>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">कोई साइट डेटा नहीं — {monthLabel}</div>
      ) : (
        <div className="space-y-3">
          {data.map((s) => (
            <Card key={s.siteName} className="border-border/60">
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  साइट: {s.siteName}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2 text-xs">
                <Row label="कुल मजदूर" value={s.workers} />
                <Row label="कुल हाजिरी" value={`${s.attendance} दिन`} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-success/10 rounded-lg p-2">
                    <div className="text-success font-bold">{s.present}</div>
                    <div className="text-[10px] text-muted-foreground">हाजिर</div>
                  </div>
                  <div className="bg-warning/10 rounded-lg p-2">
                    <div className="text-warning font-bold">{s.half}</div>
                    <div className="text-[10px] text-muted-foreground">हाफ-डे</div>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-2">
                    <div className="text-destructive font-bold">{s.absent}</div>
                    <div className="text-[10px] text-muted-foreground">गैरहाजिर</div>
                  </div>
                </div>
                <div className="border-t border-border/60 pt-2 space-y-1">
                  <Row label="कुल भुगतान (कमाई)" value={`₹${s.earning.toLocaleString("hi-IN")}`} bold />
                  <Row label="कुल एडवांस" value={`₹${s.advance.toLocaleString("hi-IN")}`} tone="text-warning" />
                  <div className="border-t border-border/40 pt-1 mt-1 font-bold">
                    <Row label="कुल देय (Payable)" value={`₹${s.totalSiteExpense.toLocaleString("hi-IN")}`} bold tone="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, tone, muted }: { label: string; value: string | number; bold?: boolean; tone?: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground/70 text-xs" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-medium"} ${tone || ""}`}>{value}</span>
    </div>
  );
}

