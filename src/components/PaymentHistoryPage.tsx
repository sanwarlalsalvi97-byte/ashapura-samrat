import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, FileDown, Search, History, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { listSites } from "@/lib/sites";
import { exportCSV, exportPDF } from "@/lib/export-utils";
import { toISODate } from "@/lib/date-utils";

type PaymentRow = {
  id: string;
  worker_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string | null;
  note: string | null;
  site_name: string | null;
  workers?: { name: string | null } | null;
};

const monthNames = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

export default function PaymentHistoryPage() {
  const now = new Date();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [siteFilter, setSiteFilter] = useState("__all__");

  const sites = useMemo(() => listSites().map((s) => s.name).sort(), []);

  const loadHistory = async () => {
    setLoading(true);
    let query = supabase
      .from("payment_history")
      .select("id, worker_id, amount, payment_date, payment_mode, note, site_name, workers(name)")
      .order("payment_date", { ascending: false });

    if (selectedMonth) {
      const start = `${selectedMonth}-01`;
      const [y, m] = selectedMonth.split("-").map(Number);
      const end =toISODate(new Date(y, m, 0));
      query = query.gte("payment_date", start).lte("payment_date", end);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("भुगतान इतिहास लोड करने में विफल");
    } else {
      setPayments((data || []) as PaymentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, [selectedMonth]);

  useEffect(() => {
    const ch = supabase
      .channel("pay-hist-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_history" }, loadHistory)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedMonth]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchesSite = siteFilter === "__all__" || (p.site_name || "") === siteFilter;
      const workerName = p.workers?.name || "";
      const matchesSearch = !search || workerName.toLowerCase().includes(search.toLowerCase()) || (p.note || "").toLowerCase().includes(search.toLowerCase());
      return matchesSite && matchesSearch;
    });
  }, [payments, siteFilter, search]);

  const totalAmount = useMemo(() => filtered.reduce((s, p) => s + (p.amount || 0), 0), [filtered]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("payment_history").delete().eq("id", id);
    if (error) {
      toast.error("हटाने में विफल: " + error.message);
    } else {
      toast.success("भुगतान रिकॉर्ड हटा दिया गया");
    }
  };

  const handleExportCSV = () => {
    const headers = ["तारीख", "मजदूर का नाम", "साइट", "राशि", "भुगतान का तरीका", "नोट"];
    const rows = filtered.map((p) => [
      p.payment_date,
      p.workers?.name || "—",
      p.site_name || "—",
      p.amount,
      p.payment_mode || "—",
      p.note || "—"
    ]);
    exportCSV(`भुगतान-इतिहास-${selectedMonth}.csv`, headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ["तारीख", "मजदूर का नाम", "साइट", "राशि", "भुगतान का तरीका", "नोट"];
    const rows = filtered.map((p) => [
      p.payment_date,
      p.workers?.name || "—",
      p.site_name || "—",
      p.amount,
      p.payment_mode || "—",
      p.note || "—"
    ]);
    exportPDF(`भुगतान इतिहास — ${selectedMonth}`, headers, rows);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center justify-between gap-2 bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-extrabold">भुगतान इतिहास</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs h-8">
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-xs h-8">
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-card rounded-2xl border border-border/60 p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="मजदूर का नाम खोजें..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs font-semibold"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 text-xs font-semibold flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="h-9 bg-background border border-input rounded-md px-2 text-xs font-semibold flex-1 w-full"
          >
            <option value="__all__">सभी साइट</option>
            {sites.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 flex items-center justify-between px-4">
        <span className="text-xs font-bold text-muted-foreground">कुल चुकाई गई राशि ({filtered.length} रिकॉर्ड)</span>
        <span className="text-lg font-extrabold text-primary tabular-nums">₹{totalAmount.toLocaleString("hi-IN")}</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-xs text-muted-foreground">लोड हो रहा है...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/60 p-6 text-muted-foreground">
          <p className="text-sm font-semibold">कोई भुगतान रिकॉर्ड नहीं मिला</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="border-border/60 shadow-sm">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-extrabold text-foreground truncate">{p.workers?.name || "मजदूर"}</span>
                    {p.site_name && (
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-semibold shrink-0">
                        {p.site_name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap font-medium">
                    <span>{p.payment_date}</span>
                    <span>•</span>
                    <span>{p.payment_mode || "Cash"}</span>
                    {p.note && (
                      <>
                        <span>•</span>
                        <span className="text-foreground/80 font-normal italic truncate">{p.note}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ₹{p.amount.toLocaleString("hi-IN")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="हटाएं"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
