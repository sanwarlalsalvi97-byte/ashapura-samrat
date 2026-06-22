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
    const ch = supabase
      .channel("attendance-cal-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, loadStats)
      .subscribe();
    return () => {
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, loadStats);
      supabase.removeChannel(ch);
    };
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

const STATUSES: AttendanceStatus[] = ["Present", "Half-Day", "Absent"];
const STATUS_PILL: Record<AttendanceStatus, { label: string; bg: string; ring: string }> = {
  Present: { label: "P", bg: "bg-emerald-500", ring: "ring-emerald-500" },
  "Half-Day": { label: "HD", bg: "bg-amber-500", ring: "ring-amber-500" },
  Absent: { label: "A", bg: "bg-rose-500", ring: "ring-rose-500" },
};

type DayRow = {
  worker: Worker;
  status?: AttendanceStatus;
  site_name: string;
  gps_status?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
};

function DayDetails({ iso, onChanged }: { iso: string; onChanged: () => void }) {
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const tithi = approxTithi(new Date(iso));
  const todayIso = new Date().toISOString().slice(0, 10);
  const isFuture = iso > todayIso;

  const load = async () => {
    setLoading(true);
    try {
      const [workers, attRes] = await Promise.all([
        getWorkers(),
        supabase.from("attendance").select("*").eq("date", iso),
      ]);
      const map = new Map<string, any>();
      (attRes.data || []).forEach((r: any) => map.set(r.worker_id, r));
      setRows(
        workers.map((w) => {
          const a = map.get(w.id);
          return {
            worker: w,
            status: a?.status,
            site_name: a?.site_name ?? w.site_name ?? "",
            gps_status: a?.gps_status ?? null,
            gps_lat: a?.gps_lat ?? null,
            gps_lng: a?.gps_lng ?? null,
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [iso]);

  const updateLocal = (workerId: string, patch: Partial<DayRow>) => {
    setRows((prev) => prev.map((r) => (r.worker.id === workerId ? { ...r, ...patch } : r)));
  };

  const saveRow = async (row: DayRow, nextStatus: AttendanceStatus) => {
    if (isFuture) {
      toast({ title: "भविष्य की तारीख edit नहीं हो सकती", variant: "destructive" });
      return;
    }
    setSavingId(row.worker.id);
    try {
      await markAttendance({
        worker_id: row.worker.id,
        date: iso,
        status: nextStatus,
        advance: 0,
        site_name: row.site_name?.trim() || row.worker.site_name,
        notes: null,
        gps_status: row.gps_status ?? "OFF",
        gps_lat: row.gps_lat ?? null,
        gps_lng: row.gps_lng ?? null,
      } as any);
      updateLocal(row.worker.id, { status: nextStatus });
      onChanged();
      toast({ title: `✅ ${row.worker.name} — ${nextStatus}` });
    } catch (e: any) {
      toast({ title: "सेव नहीं हुआ", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const captureGps = (row: DayRow) => {
    if (!("geolocation" in navigator)) {
      updateLocal(row.worker.id, { gps_status: "OFF" });
      toast({ title: "GPS नहीं मिला", variant: "destructive" });
      return;
    }
    setSavingId(row.worker.id);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(5);
        const lng = +pos.coords.longitude.toFixed(5);
        updateLocal(row.worker.id, { gps_status: "ON", gps_lat: lat, gps_lng: lng });
        setSavingId(null);
        toast({ title: `📍 GPS सेव (${lat}, ${lng})` });
      },
      () => {
        updateLocal(row.worker.id, { gps_status: "OFF" });
        setSavingId(null);
        toast({ title: "GPS OFF — लोकेशन नहीं मिली", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const totals = rows.reduce(
    (a, r) => {
      if (r.status === "Present") a.P++;
      else if (r.status === "Half-Day") a.H++;
      else if (r.status === "Absent") a.A++;
      return a;
    },
    { P: 0, H: 0, A: 0 }
  );

  return (
    <div className="space-y-3 text-sm">
      <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold">
        {tithi.full}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-500/10 rounded-lg p-2"><div className="text-xl font-bold text-emerald-600">{totals.P}</div><div className="text-[10px] text-muted-foreground">हाजिर</div></div>
        <div className="bg-amber-500/10 rounded-lg p-2"><div className="text-xl font-bold text-amber-600">{totals.H}</div><div className="text-[10px] text-muted-foreground">हाफ-डे</div></div>
        <div className="bg-rose-500/10 rounded-lg p-2"><div className="text-xl font-bold text-rose-600">{totals.A}</div><div className="text-[10px] text-muted-foreground">गैरहाजिर</div></div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-xs">लोड हो रहा है...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">कोई मजदूर नहीं</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.worker.id} className="rounded-xl border border-border/60 bg-card p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{row.worker.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{row.worker.role}</div>
                </div>
                {savingId === row.worker.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {STATUSES.map((s) => {
                  const p = STATUS_PILL[s];
                  const active = row.status === s;
                  return (
                    <button
                      key={s}
                      disabled={isFuture || savingId === row.worker.id}
                      onClick={() => saveRow(row, s)}
                      className={`py-1.5 rounded-lg text-xs font-bold text-white transition active:scale-95 ${p.bg} ${active ? `ring-2 ring-offset-1 ${p.ring}` : "opacity-60"}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={row.site_name}
                  onChange={(e) => updateLocal(row.worker.id, { site_name: e.target.value })}
                  onBlur={() => { if (row.status) saveRow(row, row.status); }}
                  placeholder="साइट का नाम"
                  className="h-8 text-xs flex-1"
                />
                <button
                  onClick={() => captureGps(row)}
                  disabled={savingId === row.worker.id}
                  className={`h-8 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${
                    row.gps_status === "ON"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : row.gps_status === "OFF"
                        ? "bg-rose-500/15 text-rose-600"
                        : "bg-muted text-muted-foreground"
                  }`}
                  title={row.gps_lat && row.gps_lng ? `${row.gps_lat}, ${row.gps_lng}` : "GPS स्थिति"}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {row.gps_status || "—"}
                </button>
              </div>
              {row.gps_lat != null && row.gps_lng != null && (
                <div className="text-[10px] text-muted-foreground">📍 {row.gps_lat}, {row.gps_lng}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
