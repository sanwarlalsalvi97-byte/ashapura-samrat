import { toISODate } from "@/lib/date-utils";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ShoppingBag, Utensils, Coffee, Pill, Home as HomeIcon, Wrench, MoreHorizontal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { listSites } from "@/lib/sites";

type Worker = { id: string; name: string; site_name: string | null };
type Expense = {
  id: string;
  worker_id: string;
  date: string;
  category: string;
  amount: number;
  site_name: string | null;
  note: string | null;
};

const CATEGORIES = [
  { id: "food", label: "खाना", icon: Utensils },
  { id: "tea", label: "चाय", icon: Coffee },
  { id: "medicine", label: "दवा", icon: Pill },
  { id: "rent", label: "किराया", icon: HomeIcon },
  { id: "tools", label: "औजार", icon: Wrench },
  { id: "other", label: "अन्य", icon: MoreHorizontal },
];

function todayISO() {
toISODate(return new Date());
}

export default function WorkerExpensesPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [workerId, setWorkerId] = useState<string>("");
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [site, setSite] = useState("");
  const [note, setNote] = useState("");

  const sites = useMemo(() => listSites().map((s) => s.name), []);

  const load = async () => {
    const [w, e] = await Promise.all([
      supabase.from("workers").select("id,name,site_name").eq("is_active", true).order("name"),
      supabase
        .from("worker_expenses")
        .select("id,worker_id,date,category,amount,site_name,note")
        .order("date", { ascending: false })
        .limit(100),
    ]);
    setWorkers((w.data || []) as Worker[]);
    setExpenses((e.data || []) as Expense[]);
    setLoading(false);
    if (!workerId && w.data?.[0]) setWorkerId(w.data[0].id);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("worker-expenses-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_expenses" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workerName = (id: string) => workers.find((w) => w.id === id)?.name || "—";

  const add = async () => {
    const amt = Number(amount);
    if (!workerId) return toast({ title: "मजदूर चुनें", variant: "destructive" });
    if (!amt || amt <= 0) return toast({ title: "राशि सही नहीं", variant: "destructive" });
    const worker = workers.find((w) => w.id === workerId);
    const { error } = await supabase.from("worker_expenses").insert({
      worker_id: workerId,
      date,
      category,
      amount: amt,
      site_name: (site || worker?.site_name || "").trim() || null,
      note: note.trim() || null,
    });
    if (error) return toast({ title: "गलती", description: error.message, variant: "destructive" });
    toast({ title: "✅ खर्च जोड़ा गया" });
    setAmount(""); setNote("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("worker_expenses").delete().eq("id", id);
    if (error) return toast({ title: "गलती", description: error.message, variant: "destructive" });
    toast({ title: "हटाया गया" });
  };

  const total = useMemo(() => expenses.reduce((s, x) => s + Number(x.amount), 0), [expenses]);

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-extrabold">मजदूर खर्च जोड़ें</h2>
          </div>
          <div className="text-[11px] text-amber-800 dark:text-amber-300 mb-3 leading-tight">
            खाना, चाय, दवा, किराया, औजार आदि — ये worker के पेमेंट में जुड़ेंगे।
            <br />(Cashbook बिल्कुल अलग है)
          </div>

          <label className="block text-xs font-semibold mb-1">मजदूर</label>
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className="w-full bg-background border border-input rounded-md px-2 py-2 text-sm font-semibold mb-2"
          >
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <label className="block text-xs font-semibold mb-1">श्रेणी</label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                className={`rounded-xl border px-2 py-2 flex flex-col items-center gap-1 text-[11px] font-bold transition ${
                  category === id ? "border-amber-500 bg-amber-100 dark:bg-amber-950/40" : "border-border bg-card"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs font-semibold mb-1">राशि ₹</label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">तारीख</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <label className="block text-xs font-semibold mb-1">साइट</label>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="w-full bg-background border border-input rounded-md px-2 py-2 text-sm mb-2"
          >
            <option value="">(मजदूर की डिफ़ॉल्ट साइट)</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label className="block text-xs font-semibold mb-1">नोट (optional)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="जैसे: सुबह की चाय" />

          <Button onClick={add} className="w-full mt-3 gap-2 bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="w-4 h-4" /> जोड़ें
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-base font-extrabold">हाल के खर्च</h3>
            <span className="text-sm font-bold text-amber-700">₹{Math.round(total).toLocaleString("hi-IN")}</span>
          </div>
          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-3">लोड हो रहा है...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-3">अभी कोई खर्च नहीं</p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((x) => {
                const cat = CATEGORIES.find((c) => c.id === x.category) || CATEGORIES[5];
                const Icon = cat.icon;
                return (
                  <li key={x.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 grid place-items-center text-amber-700 shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{workerName(x.worker_id)}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {x.date} • {cat.label}
                        {x.site_name ? ` • ${x.site_name}` : ""}
                        {x.note ? ` • ${x.note}` : ""}
                      </div>
                    </div>
                    <span className="text-sm font-extrabold tabular-nums">
                      ₹{Math.round(Number(x.amount)).toLocaleString("hi-IN")}
                    </span>
                    <button
                      onClick={() => remove(x.id)}
                      className="w-8 h-8 grid place-items-center rounded-full text-destructive hover:bg-destructive/10"
                      aria-label="हटाएं"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
