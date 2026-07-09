import { monthBoundsISO, parseISODate, toISODate } from "@/lib/date-utils";
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
import { CalendarIcon, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet } from "lucide-react";
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
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const { startISO: monthStartISO, endISO: monthEndISO } = useMemo(
    () => monthBoundsISO(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const goPrevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

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
          .gte("date", monthStartISO)
          .lte("date", monthEndISO)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStartISO, monthEndISO]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("advance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const total = entries.reduce((s, e) => s + (e.advance || 0), 0);

  const workerWise = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number }>();
    entries.forEach((e) => {
      const name = e.workers?.name || "मजदूर";
      const cur = map.get(e.worker_id) || { name, amount: 0, count: 0 };
      cur.amount += e.advance || 0;
      cur.count += 1;
      map.set(e.worker_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [entries]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (e: AdvEntry) => { setEditing(e); setFormOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Preserve attendance status/date, clear only the advance amount.
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
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white grid place-items-center shadow-sm">
            <Wallet className="w-5 h-5" />
          </span>
          एडवांस
        </h1>
        <Button
          onClick={openAdd}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-1 rounded-xl shadow-sm"
        >
          <Plus className="w-4 h-4" />
          नया एडवांस
        </Button>
      </div>

      {/* Summary card */}
      <div className="rounded-[20px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 p-4 shadow-[0_4px_14px_-6px_rgba(234,88,12,0.35)]">
        <div className="text-xs font-bold text-orange-700/80 dark:text-orange-400/80">
          कुल एडवांस दिया — {HINDI_MONTHS[now.getMonth()]} {now.getFullYear()}
        </div>
        <div className="text-3xl font-extrabold tabular-nums text-orange-700 dark:text-orange-300 mt-1">
          ₹{total.toLocaleString("hi-IN")}
        </div>
        <div className="text-[11px] font-semibold text-orange-700/80 dark:text-orange-400/80 mt-1">
          {entries.length} बार एडवांस दिया गया
        </div>
      </div>

      {/* Worker-wise */}
      {workerWise.length > 0 && (
        <section>
          <h2 className="text-base font-extrabold mb-2 px-1">मजदूर वाइज एडवांस</h2>
          <div className="space-y-2">
            {workerWise.map((r) => (
              <div
                key={r.name}
                className="rounded-[20px] bg-card border border-border/60 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)] px-4 py-3 flex items-center justify-between"
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
        <h2 className="text-base font-extrabold mb-2 px-1">सभी एडवांस एंट्री</h2>
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">लोड हो रहा है...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p className="text-sm font-medium">कोई एडवांस नहीं मिला</p>
            <p className="text-xs mt-1">ऊपर "+ नया एडवांस" से जोड़ें</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="rounded-[20px] border-border/60 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]">
                  <CardContent className="p-3 flex items-center gap-3">
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
                          className="w-7 h-7 rounded-lg grid place-items-center hover:bg-muted active:scale-95 transition text-primary"
                          aria-label="एडिट"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(e)}
                          className="w-7 h-7 rounded-lg grid place-items-center hover:bg-destructive/10 active:scale-95 transition text-destructive"
                          aria-label="हटाएं"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
            <AlertDialogCancel>रद्द करें</AlertDialogCancel>
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
      // Read existing attendance for same worker+date to preserve status
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
              placeholder="जैसे: दवाई के लिए"
              className="mt-1 h-10"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>रद्द करें</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? "सेव..." : editing ? "अपडेट करें" : "सेव करें"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
