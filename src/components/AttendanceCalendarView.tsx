import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, CalendarIcon, MapPin, Loader2 } from "lucide-react";
import { ATTENDANCE_UPDATED_EVENT, getWorkers, markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { approxTithi } from "./HomePage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const HINDI_MONTHS = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const WEEK = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];

type DayStat = { P: number; A: number; H: number };

function ymd(d: Date) { return d.toISOString().slice(0, 10); }

export default function AttendanceCalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const [stats, setStats] = useState<Record<string, DayStat>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ iso: string; day: number } | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = ymd(new Date());

  const loadStats = async () => {
      setLoading(true);
      const start = ymd(new Date(year, month, 1));
      const end = ymd(new Date(year, month + 1, 0));
      const { data } = await supabase
        .from("attendance")
        .select("date,status")
        .gte("date", start)
        .lte("date", end);
      const map: Record<string, DayStat> = {};
      (data || []).forEach((r: any) => {
        const k = r.date;
        if (!map[k]) map[k] = { P: 0, A: 0, H: 0 };
        if (r.status === "Present") map[k].P++;
        else if (r.status === "Absent") map[k].A++;
        else if (r.status === "Half-Day") map[k].H++;
      });
      setStats(map);
      setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, [year, month]);

  useEffect(() => {
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, loadStats);
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, loadStats);
  }, [year, month]);

  const cells = useMemo(() => {
    const arr: ({ day: number; iso: string } | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, iso: ymd(new Date(year, month, d)) });
    }
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [firstDow, daysInMonth, year, month]);

  function dominantBadge(s?: DayStat) {
    if (!s) return null;
    const max = Math.max(s.P, s.A, s.H);
    if (max === 0) return null;
    if (s.P === max) return { label: "P", bg: "bg-emerald-500" };
    if (s.A === max) return { label: "A", bg: "bg-rose-500" };
    return { label: "HD", bg: "bg-amber-500" };
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card border border-border/60 shadow-sm p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <CalendarIcon className="w-4 h-4 text-primary" />
            {HINDI_MONTHS[month]} {year}
          </div>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground mb-1">
          {WEEK.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="aspect-square" />;
            const s = stats[c.iso];
            const badge = dominantBadge(s);
            const isToday = c.iso === today;
            const t = approxTithi(new Date(c.iso));
            return (
              <button
                key={i}
                onClick={() => setSelected({ iso: c.iso, day: c.day })}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs active:scale-95 transition ${
                  isToday ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/30 hover:bg-muted/60"
                }`}
              >
                <div className={`leading-none text-[11px] ${isToday ? "text-primary font-bold" : "text-foreground"}`}>{c.day}</div>
                {badge ? (
                  <span className={`mt-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold grid place-items-center ${badge.bg}`}>
                    {badge.label}
                  </span>
                ) : (
                  <span className="mt-0.5 h-4" />
                )}
                <span className="text-[7px] leading-none text-muted-foreground truncate max-w-full px-0.5">{t.name.split("/")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected ? `${selected.day} ${HINDI_MONTHS[month]} ${year}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <DayDetails
              iso={selected.iso}
              onChanged={loadStats}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-around text-[11px] text-muted-foreground px-2">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />प्रेजेंट</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />एब्सेंट</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />हाफ डे</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />कोई नहीं</span>
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
    </div>
  );
}
