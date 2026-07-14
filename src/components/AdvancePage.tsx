import { monthBoundsISO, parseISODate, todayISO, toISODate } from "@/lib/date-utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkers, markAttendance, type Worker } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CalendarIcon, ChevronLeft, ChevronRight, Filter, Pencil, Plus, Trash2, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

type AdvEntry = {
  id: string;
  worker_id: string;
  date: string;
  advance: number;
  notes: string | null;
  site_name: string | null;
  status: string;
  workers?: { name: string | null } | null;
};

const HINDI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

function iso(d: Date) { return toISODate(d); }
function fmt(d: string) {
  const dt = parseISODate(d);
  return `${dt.getDate()} ${HINDI_MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getFullYear()}`;
}

export default function AdvancePage() {
  const now = new Date();
  // Month filter is OPTIONAL. null = All Time.
  const [monthFilter, setMonthFilter] = useState<{ y: number; m: number } | null>(null);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [entries, setEntries] = useState<AdvEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdvEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdvEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, a] = await Promise.all([
        getWorkers(),
        supabase
          .from("attendance")
          .select("id,worker_id,date,advance,notes,site_name,status,workers(name)")
          .gt("advance", 0)
          .order("date", { ascending: false }),
      ]);
      setWorkers(w);
      setEntries((a.data as any as AdvEntry[]) || []);
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("advance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const today = todayISO();
  const thisMonth = useMemo(() => monthBoundsISO(now.getFullYear(), now.getMonth()), []);

  const totals = useMemo(() => {
    let td = 0, mo = 0, all = 0;
    entries.forEach((e) => {
      const amt = e.advance || 0;
      all += amt;
      if (e.date === today) td += amt;
      if (e.date >= thisMonth.startISO && e.date <= thisMonth.endISO) mo += amt;
    });
    return { td, mo, all };
  }, [entries, today, thisMonth]);

  const filtered = useMemo(() => {
    if (!monthFilter) return entries;
    const { startISO, endISO } = monthBoundsISO(monthFilter.y, monthFilter.m);
    return entries.filter((e) => e.date >= startISO && e.date <= endISO);
  }, [entries, monthFilter]);

  const filteredTotal = filtered.reduce((s, e) => s + (e.advance || 0), 0);

  const workerWise = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    filtered.forEach((e) => {
      const name = e.workers?.name || "मजदूर";
      const cur = map.get(e.worker_id) || { name, amount: 0, count: 0 };
      cur.amount += e.advance || 0;
      cur.count += 1;
      map.set(e.worker_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: AdvEntry) => { setEditing(e); setFormOpen(true); };

  const goPrevMonth = () => {
    const cur = monthFilter || { y: now.getFullYear(), m: now.getMonth() };
    const d = new Date(cur.y, cur.m - 1, 1);
    setMonthFilter({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goNextMonth = () => {
    const cur = monthFilter || { y: now.getFullYear(), m: now.getMonth() };
    const d = new Date(cur.y, cur.m + 1, 1);
    setMonthFilter({ y: d.getFullYear(), m: d.getMonth() });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const w = workers.find((x) => x.id === deleteTarget.worker_id);
      await markAttendance({
        worker_id: deleteTarget.worker_id,
        date: deleteTarget.date,
        status: (deleteTarget.status as any) || "Present",
        advance: 0,
        site_name: deleteTarget.site_name || w?.site_name || null,
        notes: deleteTarget.notes || null,
      });
      toast({ title: "🗑️ एडवांस हटा दिया गया" });
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white grid place-items-center shadow-sm">
            <Wallet className="w-5 h-5" />
          </span>
          एडवांस लेजर
        </h1>
        <Button
          onClick={openAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-2xl shadow-sm"
        >
          <Plus className="w-4 h-4" />
          नया
        </Button>
      </div>

      {/* Hero summary card */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.55)]">
        <div className="text-[11px] font-bold uppercase tracking-widest opacity-90">कुल एडवांस (All Time)</div>
        <div className="text-4xl font-extrabold tabular-nums mt-1">₹{totals.all.toLocaleString("hi-IN")}</div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
            <div className="text-[10px] font-bold uppercase opacity-90">आज</div>
            <div className="text-lg font-extrabold tabular-nums">₹{totals.td.toLocaleString("hi-IN")}</div>
          </div>
          <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
            <div className="text-[10px] font-bold uppercase opacity-90">इस महीने</div>
            <div className="text-lg font-extrabold tabular-nums">₹{totals.mo.toLocaleString("hi-IN")}</div>
          </div>
        </div>
      </div>

      {/* Month filter (optional) */}
      <div className="flex items-center gap-2 bg-card rounded-2xl border border-border/60 px-2 py-2 shadow-sm">
        {monthFilter ? (
          <>
            <button
              onClick={goPrevMonth}
              className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 text-center leading-tight">
              <div className="text-[10px] text-muted-foreground font-semibold">फ़िल्टर</div>
              <div className="text-sm font-extrabold tracking-tight">
                {HINDI_MONTHS[monthFilter.m]} {monthFilter.y}
              </div>
            </div>
            <button
              onClick={goNextMonth}
              className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMonthFilter(null)}
              className="w-9 h-9 rounded-xl grid place-items-center hover:bg-destructive/10 text-destructive active:scale-95"
              aria-label="फ़िल्टर हटाएं"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setMonthFilter({ y: now.getFullYear(), m: now.getMonth() })}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground py-1.5 rounded-xl hover:bg-muted"
          >
            <Filter className="w-4 h-4" /> महीने से फ़िल्टर करें (सभी दिखाए जा रहे हैं)
          </button>
        )}
      </div>

      {monthFilter && (
        <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase text-orange-700 dark:text-orange-400">इस फ़िल्टर का कुल</div>
            <div className="text-xl font-extrabold tabular-nums text-orange-600 dark:text-orange-300">
              ₹{filteredTotal.toLocaleString("hi-IN")}
            </div>
          </div>
          <div className="text-xs font-semibold text-orange-700 dark:text-orange-400">
            {filtered.length} एंट्री
          </div>
        </div>
      )}

      {/* Worker-wise */}
      {workerWise.length > 0 && (
        <section>
          <h2 className="text-base font-extrabold mb-2 px-1">मजदूर वाइज</h2>
          <div className="space-y-2">
            {workerWise.map((r) => (
              <div
                key={r.name}
                className="rounded-2xl bg-card border border-border/60 shadow-sm px-4 py-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground font-semibold">{r.count} बार</div>
                </div>
                <div className="text-lg font-extrabold tabular-nums text-orange-600">
                  ₹{r.amount.toLocaleString("hi-IN")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All entries */}
      <section>
        <h2 className="text-base font-extrabold mb-2 px-1">
          {monthFilter ? "फ़िल्टर की एंट्री" : "सभी एडवांस एंट्री"}
        </h2>
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">लोड हो रहा है...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm font-medium">कोई एडवांस नहीं मिला</p>
            <p className="text-xs mt-1">ऊपर "+ नया" से जोड़ें</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-1 self-stretch rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">
                        {e.workers?.name || "मजदूर"}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-semibold">
                        {fmt(e.date)}{e.site_name ? ` • ${e.site_name}` : ""}
                      </div>
                      {e.notes && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate italic">
                          {e.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-extrabold tabular-nums text-orange-600">
                        ₹{(e.advance || 0).toLocaleString("hi-IN")}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          onClick={() => openEdit(e)}
                          className="w-8 h-8 rounded-xl grid place-items-center hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95 transition text-emerald-700 dark:text-emerald-400"
                          aria-label="एडिट"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(e)}
                          className="w-8 h-8 rounded-xl grid place-items-center hover:bg-destructive/10 active:scale-95 transition text-destructive"
                          aria-label="हटाएं"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <AdvanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        workers={workers}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>एडवांस हटाएं?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.workers?.name} — {deleteTarget && fmt(deleteTarget.date)} का ₹{deleteTarget?.advance} एडवांस हट जाएगा।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रद्द</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              हटाएं
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdvanceFormDialog({
  open, onOpenChange, editing, workers, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AdvEntry | null;
  workers: Worker[];
  onSaved: () => void;
}) {
  const [workerId, setWorkerId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setWorkerId(editing.worker_id);
      setDate(parseISODate(editing.date));
      setAmount(String(editing.advance || ""));
      setNotes(editing.notes || "");
    } else {
      setWorkerId(workers[0]?.id || "");
      setDate(new Date());
      setAmount("");
      setNotes("");
    }
  }, [open, editing, workers]);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!workerId) return toast({ title: "मजदूर चुनें", variant: "destructive" });
    if (!amt || amt <= 0) return toast({ title: "राशि दर्ज करें", variant: "destructive" });

    setSaving(true);
    try {
      const w = workers.find((x) => x.id === workerId);
      const { data: existing } = await supabase
        .from("attendance")
        .select("status,site_name,notes")
        .eq("worker_id", workerId)
        .eq("date", iso(date))
        .maybeSingle();
      await markAttendance({
        worker_id: workerId,
        date: iso(date),
        status: (existing?.status as any) || "Present",
        advance: amt,
        site_name: existing?.site_name || w?.site_name || null,
        notes: notes || existing?.notes || null,
      });
      toast({ title: editing ? "✏️ एडवांस अपडेट हुआ" : "✅ एडवांस जोड़ा गया" });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "एडवांस एडिट करें" : "नया एडवांस जोड़ें"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground">मजदूर</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              disabled={!!editing}
              className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-70"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name} — ₹{w.daily_rate}/दिन</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground">तारीख</label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!editing}
                  className="w-full mt-1 justify-start gap-2 font-semibold"
                >
                  <CalendarIcon className="w-4 h-4" />
                  {iso(date)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground">राशि (₹)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-1 h-10 text-base font-bold"
              min={0}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground">नोट (वैकल्पिक)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="जैसे — किराए के लिए"
              className="mt-1 h-10"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>रद्द</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "सहेज रहा है..." : (editing ? "अपडेट करें" : "जोड़ें")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
