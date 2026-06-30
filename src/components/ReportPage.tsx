import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteWorkerMonthAttendance, getWorkers, getContractors, type Worker, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import { listSites } from "@/lib/sites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Share2, Trash2, FileDown, FileText, Building2, Users, Wallet, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportCSV, exportPDF } from "@/lib/export-utils";
import { computeWorkerPayments, subscribePaymentSources, monthBoundsISO } from "@/lib/payment-engine";
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

interface WorkerSummary {
  workerId: string;
  name: string;
  role: string;
  dailyRate: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  totalAdvance: number;
  totalEarning: number;
  workerExpenses: number;
  paidAmount: number;
  netPayable: number;
}

export default function ReportPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<WorkerSummary[]>([]);
  const [siteFilter, setSiteFilter] = useState<string>("__all__");
  const [siteAtt, setSiteAtt] = useState<any[]>([]);
  const [siteCash, setSiteCash] = useState<{ amount: number; site_name: string | null; type: string }[]>([]);
  const [siteExp, setSiteExp] = useState<{ amount: number; site_name: string | null }[]>([]);
  const [sitePay, setSitePay] = useState<{ amount: number; site_name: string | null }[]>([]);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);

  const loadSiteData = useCallback(async () => {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
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

  const loadReport = useCallback(async () => {
    try {
      const { startISO, endISO } = monthBoundsISO(year, month - 1);
      const res = await computeWorkerPayments({ startISO, endISO });
      // Need role per worker — fetch in parallel with workers list
      const workersList = await getWorkers().catch(() => [] as Worker[]);
      const roleById = new Map(workersList.map((w) => [w.id, w.role || ""]));
      const rows: WorkerSummary[] = res.rows
        .filter((r) => r.presentDays + r.halfDays + r.absentDays + r.workerExpenses + r.advance + r.paidAmount > 0)
        .map((r) => ({
          workerId: r.worker.id,
          name: r.worker.name,
          role: roleById.get(r.worker.id) || "",
          dailyRate: r.worker.daily_rate || 0,
          presentDays: r.presentDays,
          halfDays: r.halfDays,
          absentDays: r.absentDays,
          totalAdvance: r.advance,
          totalEarning: r.earned,
          workerExpenses: r.workerExpenses,
          paidAmount: r.paidAmount,
          netPayable: r.outstanding,
        }));
      setSummary(rows);
    } catch {}
  }, [year, month]);

  useEffect(() => {
    loadReport();
    const unsub = subscribePaymentSources(() => { loadReport(); loadSiteData(); });
    return () => unsub();
  }, [loadReport, loadSiteData]);

  const handleDelete = async (worker: WorkerSummary) => {
    try {
      await deleteWorkerMonthAttendance(worker.workerId, year, month);
      toast({ title: `🗑️ ${worker.name} की ${monthNames[month - 1]} की रिपोर्ट हटा दी गई` });
      loadReport();
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
    if (summary.length === 0) return;
    const mode = getGroupingMode();
    let workers: Worker[] = [];
    let contractors: Contractor[] = [];
    try {
      workers = await getWorkers();
      if (mode === "contractor") contractors = await getContractors();
    } catch {}
    const workerById = new Map(workers.map((w) => [w.id, w]));

    const headers = ["ठेकेदार/साइट", "नाम", "पद", "दैनिक दर", "हाजिर", "आधा दिन", "गैरहाजिर", "कमाई", "मजदूर खर्च", "एडवांस", "चुकाई राशि (Paid)", "बाकी"];
    const rows: (string | number)[][] = summary.map((s) => {
      const w = workerById.get(s.workerId);
      const group = w ? resolveGroupLabel(w, contractors, mode) : "—";
      return [
        group, s.name, s.role, s.dailyRate, s.presentDays, s.halfDays, s.absentDays,
        Math.round(s.totalEarning), Math.round(s.workerExpenses), Math.round(s.totalAdvance), Math.round(s.paidAmount), Math.round(s.netPayable),
      ];
    });
    rows.push(["", "कुल", "", "", "", "", "", "", "", "", "", Math.round(grandTotal)]);
    const title = `मासिक रिपोर्ट — ${monthNames[month - 1]} ${year}`;
    if (format === "csv") {
      exportCSV(`रिपोर्ट-${year}-${String(month).padStart(2, "0")}.csv`, headers, rows);
      toast({ title: "CSV डाउनलोड हो गई" });
    } else {
      exportPDF(title, headers, rows);
    }
  };

  const grandTotal = summary.reduce((acc, s) => acc + s.netPayable, 0);

  const shareOnWhatsApp = (worker?: WorkerSummary) => {
    let text = "";
    if (worker) {
      text = `📋 *${worker.name}* — ${monthNames[month - 1]} ${year}\n` +
        `👷 ${worker.role} | ₹${worker.dailyRate}/दिन\n\n` +
        `✅ हाजिर: ${worker.presentDays} दिन\n` +
        `⏰ आधा दिन: ${worker.halfDays}\n` +
        `❌ गैरहाजिर: ${worker.absentDays}\n\n` +
        `💰 कुल कमाई: ₹${Math.round(worker.totalEarning).toLocaleString("hi-IN")}\n` +
        `🛒 मजदूर खर्च: ₹${Math.round(worker.workerExpenses).toLocaleString("hi-IN")}\n` +
        `💸 एडवांस: ₹${Math.round(worker.totalAdvance).toLocaleString("hi-IN")}\n` +
        `💵 चुकाई राशि: ₹${Math.round(worker.paidAmount).toLocaleString("hi-IN")}\n` +
        `✅ *बाकी राशि: ₹${Math.round(worker.netPayable).toLocaleString("hi-IN")}*`;
    } else {
      text = `📋 *हाजिरी रिपोर्ट — ${monthNames[month - 1]} ${year}*\n\n`;
      summary.forEach((s) => {
        text += `👷 *${s.name}* (${s.role})\n` +
          `   हाजिर: ${s.presentDays} | आधा: ${s.halfDays} | गैरहाजिर: ${s.absentDays}\n` +
          `   बाकी: ₹${Math.round(s.netPayable).toLocaleString("hi-IN")}\n\n`;
      });
      text += `💰 *कुल देय: ₹${Math.round(grandTotal).toLocaleString("hi-IN")}*`;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 bg-card rounded-xl p-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => changeMonth(-1)}
          aria-label="पिछला महीना"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-background border border-input rounded-md px-2 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="महीना चुनें"
          >
            {monthNames.map((n, i) => (
              <option key={i} value={i + 1}>{n}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-background border border-input rounded-md px-2 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="साल चुनें"
          >
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => changeMonth(1)}
          aria-label="अगला महीना"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

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



      {summary.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई रिकॉर्ड नहीं</p>
          <p className="text-sm mt-1">इस महीने की हाजिरी लगाएं</p>
        </div>
      ) : (
        <>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">कुल देय राशि</p>
              <p className="text-3xl font-bold text-primary">₹{grandTotal.toLocaleString("hi-IN")}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => shareOnWhatsApp()}
                >
                  <Share2 className="w-4 h-4" />
                  WhatsApp शेयर
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileDown className="w-4 h-4" />
                      एक्सपोर्ट
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportMonthly("csv")}>
                      <FileDown className="w-4 h-4 mr-2" /> CSV डाउनलोड
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportMonthly("pdf")}>
                      <FileText className="w-4 h-4 mr-2" /> PDF (प्रिंट)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {summary.map((s) => (
              <Card key={s.workerId}>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-normal text-muted-foreground mr-1">{s.role}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => shareOnWhatsApp(s)}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>रिपोर्ट हटाएं?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {s.name} की {monthNames[month - 1]} {year} की पूरी हाजिरी और एडवांस records हट जाएंगी। यह वापस नहीं आएगा।
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(s)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              हटाएं
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div className="bg-success/10 rounded-lg p-2">
                      <p className="text-success font-bold text-lg">{s.presentDays}</p>
                      <p className="text-muted-foreground">हाजिर</p>
                    </div>
                    <div className="bg-warning/10 rounded-lg p-2">
                      <p className="text-warning font-bold text-lg">{s.halfDays}</p>
                      <p className="text-muted-foreground">आधा दिन</p>
                    </div>
                    <div className="bg-destructive/10 rounded-lg p-2">
                      <p className="text-destructive font-bold text-lg">{s.absentDays}</p>
                      <p className="text-muted-foreground">गैरहाजिर</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">कुल कमाई</span>
                      <span className="font-medium">₹{Math.round(s.totalEarning).toLocaleString("hi-IN")}</span>
                    </div>
                    {s.workerExpenses > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">मजदूर खर्च</span>
                        <span className="font-medium text-amber-600">+₹{Math.round(s.workerExpenses).toLocaleString("hi-IN")}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">एडवांस</span>
                      <span className="font-medium text-destructive">-₹{Math.round(s.totalAdvance).toLocaleString("hi-IN")}</span>
                    </div>
                    {s.paidAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">चुकाई राशि (Paid)</span>
                        <span className="font-medium text-emerald-600">-₹{Math.round(s.paidAmount).toLocaleString("hi-IN")}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1 border-border">
                      <span className="font-semibold">बाकी राशि</span>
                      <span className="font-bold text-primary">₹{Math.round(s.netPayable).toLocaleString("hi-IN")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
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
      const totalSiteExpense = earning + workerExpenses + cashbookExpense;
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
          <div className="text-[10px] text-muted-foreground">कुल खर्च</div>
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
                  <Row label="मजदूर खर्च" value={`₹${s.workerExpenses.toLocaleString("hi-IN")}`} tone="text-amber-600" />
                  <Row label="कुल एडवांस" value={`₹${s.advance.toLocaleString("hi-IN")}`} tone="text-warning" />
                  <Row label="कैशबुक खर्च" value={`₹${s.cashbookExpense.toLocaleString("hi-IN")}`} tone="text-destructive" />
                  <Row label="सैलरी चुकाई (Paid)" value={`₹${s.salaryPaid.toLocaleString("hi-IN")}`} tone="text-emerald-600" />
                  <div className="border-t border-border/40 pt-1 mt-1 font-bold">
                    <Row label="कुल साइट खर्च" value={`₹${s.totalSiteExpense.toLocaleString("hi-IN")}`} bold tone="text-primary" />
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

function Row({ label, value, bold, tone }: { label: string; value: string | number; bold?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : "font-medium"} ${tone || ""}`}>{value}</span>
    </div>
  );
}

