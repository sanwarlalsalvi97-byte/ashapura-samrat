import { useState, useEffect, useCallback } from "react";
import { getWorkers, getAttendanceByDate, markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon, Wallet, Check, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import UpiPayDialog from "./UpiPayDialog";

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(d: Date) {
  const days = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
  const months = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

interface RowState {
  amount: string;
  status: AttendanceStatus;
  loading: boolean;
}

export default function AdvancePage() {
  const [date, setDate] = useState(new Date());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([getWorkers(), getAttendanceByDate(formatDate(date))]);
      setWorkers(w);
      const map: Record<string, RowState> = {};
      w.forEach((worker) => {
        const existing = a.find((r) => r.worker_id === worker.id);
        map[worker.id] = {
          amount: existing ? String(existing.advance) : "0",
          status: existing?.status || "Present",
          loading: false,
        };
      });
      setRows(map);
    } catch {}
  }, [date]);

  useEffect(() => { loadData(); }, [loadData]);

  const changeDate = (dir: number) => {
    setDate((d) => { const n = new Date(d); n.setDate(n.getDate() + dir); return n; });
  };

  const updateAmount = (workerId: string, amount: string) => {
    setRows((r) => ({ ...r, [workerId]: { ...r[workerId], amount } }));
  };

  const handleSave = async (worker: Worker) => {
    const row = rows[worker.id];
    const amount = parseInt(row.amount) || 0;
    setRows((r) => ({ ...r, [worker.id]: { ...r[worker.id], loading: true } }));
    try {
      await markAttendance({
        worker_id: worker.id,
        date: formatDate(date),
        status: row.status,
        advance: amount,
        site_name: worker.site_name,
      });
      toast({ title: `✅ ${worker.name} — एडवांस ₹${amount} सेव हो गया` });
      loadData();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setRows((r) => ({ ...r, [worker.id]: { ...r[worker.id], loading: false } }));
    }
  };

  const totalAdvance = Object.values(rows).reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card rounded-xl p-3">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              <div className="text-center">
                <p className="font-semibold text-sm">{formatDisplayDate(date)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { if (d) { setDate(d); setCalendarOpen(false); } }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => changeDate(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {workers.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">कुल एडवांस (इस तारीख का)</span>
            </div>
            <span className="text-lg font-bold text-primary">₹{totalAdvance}</span>
          </CardContent>
        </Card>
      )}

      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई मजदूर नहीं</p>
          <p className="text-sm mt-1">पहले "मजदूर" टैब में मजदूर जोड़ें</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((worker) => {
            const row = rows[worker.id];
            if (!row) return null;
            return (
              <motion.div key={worker.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-base">{worker.name}</h3>
                        <p className="text-xs text-muted-foreground">{worker.role} • ₹{worker.daily_rate}/दिन</p>
                      </div>
                      {parseInt(row.amount) > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-success/15 text-success">
                          ₹{row.amount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">₹</span>
                      <Input
                        type="number"
                        value={row.amount}
                        onChange={(e) => updateAmount(worker.id, e.target.value)}
                        className="h-10"
                        min={0}
                        placeholder="0"
                      />
                      <Button
                        onClick={() => handleSave(worker)}
                        disabled={row.loading}
                        className="whitespace-nowrap gap-1"
                      >
                        <Check className="w-4 h-4" />
                        सेव
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
