import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyReport, deleteWorkerMonthAttendance, getWorkers, getContractors, type Worker, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Share2, Trash2, FileDown, FileText, Building2, Users, Wallet, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { exportCSV, exportPDF } from "@/lib/export-utils";
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
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);

  const loadSiteData = useCallback(async () => {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const [a, c, w] = await Promise.all([
      supabase.from("attendance").select("status, advance, site_name, worker_id, workers(name, daily_rate)").gte("date", startDate).lte("date", endDate),
      supabase.from("cashbook").select("amount, site_name, type").gte("date", startDate).lte("date", endDate),
      getWorkers().catch(() => [] as Worker[]),
    ]);
    setSiteAtt((a.data as any[]) || []);
    setSiteCash((c.data as any[]) || []);
    setAllWorkers(w);
  }, [year, month]);

  useEffect(() => { loadSiteData(); }, [loadSiteData]);

  const loadReport = useCallback(async () => {
    try {
      const data = await getMonthlyReport(year, month);
      const map: Record<string, WorkerSummary> = {};
      data.forEach((r: any) => {
        const wid = r.worker_id;
        if (!map[wid]) {
          map[wid] = {
            workerId: wid,
            name: r.workers?.name || "",
            role: r.workers?.role || "",
            dailyRate: r.workers?.daily_rate || 0,
            presentDays: 0,
            halfDays: 0,
            absentDays: 0,
            totalAdvance: 0,
            totalEarning: 0,
            netPayable: 0,
          };
        }
        const s = map[wid];
        if (r.status === "Present") s.presentDays++;
        else if (r.status === "Half-Day") s.halfDays++;
        else s.absentDays++;
        s.totalAdvance += r.advance || 0;
      });
      Object.values(map).forEach((s) => {
        s.totalEarning = (s.presentDays * s.dailyRate) + (s.halfDays * s.dailyRate * 0.5);
        s.netPayable = s.totalEarning - s.totalAdvance;
      });
      setSummary(Object.values(map));
    } catch {}
  }, [year, month]);

  useEffect(() => { loadReport(); }, [loadReport]);

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

    const headers = ["ठेकेदार/साइट", "नाम", "पद", "दैनिक दर", "हाजिर", "आधा दिन", "गैरहाजिर", "कमाई", "एडवांस", "बाकी"];
    const rows: (string | number)[][] = summary.map((s) => {
      const w = workerById.get(s.workerId);
      const group = w ? resolveGroupLabel(w, contractors, mode) : "—";
      return [
        group, s.name, s.role, s.dailyRate, s.presentDays, s.halfDays, s.absentDays,
        s.totalEarning, s.totalAdvance, s.netPayable,
      ];
    });
    rows.push(["", "कुल", "", "", "", "", "", "", "", grandTotal]);
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
        `💰 कुल कमाई: ₹${worker.totalEarning.toLocaleString("hi-IN")}\n` +
        `💸 एडवांस: ₹${worker.totalAdvance.toLocaleString("hi-IN")}\n` +
        `✅ *बाकी राशि: ₹${worker.netPayable.toLocaleString("hi-IN")}*`;
    } else {
      text = `📋 *हाजिरी रिपोर्ट — ${monthNames[month - 1]} ${year}*\n\n`;
      summary.forEach((s) => {
        text += `👷 *${s.name}* (${s.role})\n` +
          `   हाजिर: ${s.presentDays} | आधा: ${s.halfDays} | गैरहाजिर: ${s.absentDays}\n` +
          `   बाकी: ₹${s.netPayable.toLocaleString("hi-IN")}\n\n`;
      });
      text += `💰 *कुल देय: ₹${grandTotal.toLocaleString("hi-IN")}*`;
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
                      <span className="font-medium">₹{s.totalEarning.toLocaleString("hi-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">एडवांस</span>
                      <span className="font-medium text-destructive">-₹{s.totalAdvance.toLocaleString("hi-IN")}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 border-border">
                      <span className="font-semibold">बाकी राशि</span>
                      <span className="font-bold text-primary">₹{s.netPayable.toLocaleString("hi-IN")}</span>
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
