import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2 } from "lucide-react";

type Entry = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: "material" | "labor" | "transport" | "other";
  amount: number;
  site_name: string | null;
  notes: string | null;
};

const CAT_LABEL: Record<Entry["category"], string> = {
  material: "मटेरियल",
  labor: "मजदूरी",
  transport: "यातायात",
  other: "अन्य",
};

export default function CashbookPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  // form
  const [type, setType] = useState<Entry["type"]>("expense");
  const [category, setCategory] = useState<Entry["category"]>("material");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [site, setSite] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cashbook")
      .select("id,date,type,category,amount,site_name,notes")
      .order("date", { ascending: false })
      .limit(200);
    if (error) toast({ title: "गलती", description: error.message, variant: "destructive" });
    else setEntries((data || []) as Entry[]);
    setLoading(false);
  }

  async function save() {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) {
      toast({ title: "राशि सही डालें", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("cashbook").insert({
      user_id: user.id,
      type,
      category,
      amount: amt,
      date,
      site_name: site || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "गलती", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "जोड़ दिया!" });
    setOpen(false);
    setAmount(""); setNotes(""); setSite("");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("cashbook").delete().eq("id", id);
    if (error) toast({ title: "गलती", description: error.message, variant: "destructive" });
    else { toast({ title: "हटा दिया" }); load(); }
  }

  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = income - expense;

  // This month
  const ym = new Date().toISOString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(ym));
  const mIncome = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const mExpense = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);

  const visible = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Balance */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Wallet className="w-4 h-4" /> कुल बैलेंस
          </div>
          <div className="text-3xl font-bold">₹{balance.toLocaleString("hi-IN")}</div>
          <div className="text-xs opacity-80 mt-1">इस महीने: आय ₹{mIncome.toLocaleString("hi-IN")} · खर्च ₹{mExpense.toLocaleString("hi-IN")}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3" /> कुल आय</div>
            <div className="text-xl font-bold text-accent">₹{income.toLocaleString("hi-IN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="w-3 h-3" /> कुल खर्च</div>
            <div className="text-xl font-bold text-destructive">₹{expense.toLocaleString("hi-IN")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">सभी</TabsTrigger>
            <TabsTrigger value="income" className="flex-1">आय</TabsTrigger>
            <TabsTrigger value="expense" className="flex-1">खर्च</TabsTrigger>
          </TabsList>
        </Tabs>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />जोड़ें</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>नई एंट्री</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">प्रकार</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">आय (Income)</SelectItem>
                      <SelectItem value="expense">खर्च (Expense)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">श्रेणी</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CAT_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">राशि (₹)</Label>
                <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">तारीख</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">साइट (वैकल्पिक)</Label>
                <Input value={site} onChange={(e) => setSite(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">नोट्स</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "रुकें..." : "सेव करें"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-center text-muted-foreground text-sm py-8">लोड हो रहा है...</div>}
        {!loading && visible.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">कोई एंट्री नहीं</div>
        )}
        {visible.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${e.type === "income" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
                    {e.type === "income" ? "आय" : "खर्च"}
                  </span>
                  <span className="text-xs text-muted-foreground">{CAT_LABEL[e.category]}</span>
                  <span className="text-xs text-muted-foreground">· {e.date}</span>
                </div>
                {(e.site_name || e.notes) && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {[e.site_name, e.notes].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className={`font-bold ${e.type === "income" ? "text-accent" : "text-destructive"}`}>
                {e.type === "income" ? "+" : "−"}₹{e.amount.toLocaleString("hi-IN")}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(e.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
