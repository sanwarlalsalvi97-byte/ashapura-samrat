import { useEffect, useMemo, useState } from "react";
import { markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Loader2, Pencil, Clock, AlertCircle, Timer } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { listSites, createSite, type Site } from "@/lib/sites";
import { getWorkTime } from "@/lib/work-time";
import { calcHours, splitOT, fmt12, fmtHours, HALF_DAY_HOURS } from "@/lib/work-hours";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

export type WorkerTimes = {
  in_time: string | null;
  out_time: string | null;
  total_hours: number;
  overtime_hours: number;
};

interface Props {
  worker: Worker;
  date: string;
  currentStatus?: AttendanceStatus;
  currentAdvance?: number;
  currentCreatedAt?: string;
  currentUpdatedAt?: string;
  currentInTime?: string | null;
  currentOutTime?: string | null;
  currentTotalHours?: number;
  currentOvertimeHours?: number;
  mode?: "manual" | "gps";
  onMarked: () => void;
  onSelectionChange?: (workerId: string, status: AttendanceStatus | undefined) => void;
  onSiteChange?: (workerId: string, site: string) => void;
  onGpsChange?: (workerId: string, gps: { lat: number; lng: number } | undefined) => void;
  onTimesChange?: (workerId: string, times: WorkerTimes) => void;
}

const ORDER: AttendanceStatus[] = ["Present", "Absent", "Half-Day"];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; full: string; activeBg: string; activeText: string; ring: string; idleBg: string; idleText: string }[] = [
  {
    value: "Present",
    label: "P",
    full: "हाजिर",
    activeBg: "bg-emerald-500",
    activeText: "text-white",
    ring: "ring-emerald-500/40",
    idleBg: "bg-emerald-500/10",
    idleText: "text-emerald-700 dark:text-emerald-400",
  },
  {
    value: "Half-Day",
    label: "HD",
    full: "आधा दिन",
    activeBg: "bg-amber-500",
    activeText: "text-white",
    ring: "ring-amber-500/40",
    idleBg: "bg-amber-500/10",
    idleText: "text-amber-700 dark:text-amber-400",
  },
  {
    value: "Absent",
    label: "A",
    full: "गैरहाजिर",
    activeBg: "bg-rose-500",
    activeText: "text-white",
    ring: "ring-rose-500/40",
    idleBg: "bg-rose-500/10",
    idleText: "text-rose-700 dark:text-rose-400",
  },
];

const PILL: Record<string, { label: string; bg: string }> = {
  Present: { label: "P", bg: "bg-emerald-500" },
  Absent: { label: "A", bg: "bg-rose-500" },
  "Half-Day": { label: "HD", bg: "bg-amber-500" },
};

const WEEK = ["र", "सो", "मं", "बु", "गु", "शु", "श"];
const HINDI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function AttendanceCard({ worker, date, currentStatus, currentCreatedAt, currentUpdatedAt, mode = "manual", onMarked, onSelectionChange, onSiteChange, onGpsChange }: Props) {
  const [sel, setSel] = useState<AttendanceStatus | undefined>(currentStatus);
  const [site, setSite] = useState(worker.site_name || "");
  const [sites, setSites] = useState<Site[]>(() => listSites());
  const [gps, setGps] = useState<{ lat: number; lng: number } | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [siteError, setSiteError] = useState(false);

  useEffect(() => { setSel(currentStatus); }, [currentStatus, date]);
  useEffect(() => { setSite(worker.site_name || ""); }, [worker.site_name]);
  useEffect(() => {
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    return () => window.removeEventListener("sites-updated", refresh);
  }, []);

  const pickStatus = (status: AttendanceStatus) => {
    // Toggle off if same status tapped
    const next = sel === status ? undefined : status;
    setSel(next);
    onSelectionChange?.(worker.id, next);
    if (next && !site) setSiteError(true);
    else setSiteError(false);
  };

  const updateSite = (v: string) => {
    if (v === "__add__") {
      const name = window.prompt("नई साइट का नाम लिखें:")?.trim();
      if (!name) return;
      const created = createSite({ name });
      if (!created) {
        toast({ title: "यह साइट पहले से है या नाम गलत है", variant: "destructive" });
        return;
      }
      setSites(listSites());
      v = created.name;
    }
    const val = v === "__none__" ? "" : v;
    setSite(val);
    onSiteChange?.(worker.id, val);
    if (val) setSiteError(false);
  };

  const captureGps = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "इस फोन में GPS नहीं है", variant: "destructive" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
        setGps(g);
        onGpsChange?.(worker.id, g);
        setGpsLoading(false);
        if (mode === "gps") {
          setSel("Present");
          onSelectionChange?.(worker.id, "Present");
          toast({ title: `✅ ${worker.name} — हाजिर (GPS लॉक)` });
        } else {
          toast({ title: `📍 GPS सेव हुआ` });
        }
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "GPS नहीं मिला", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const isEdited = !!currentStatus && !!sel && sel !== currentStatus;
  const wasEdited = !!currentCreatedAt && !!currentUpdatedAt && Math.abs(new Date(currentUpdatedAt).getTime() - new Date(currentCreatedAt).getTime()) > 1000;
  const updatedLabel = currentUpdatedAt
    ? new Date(currentUpdatedAt).toLocaleString("hi-IN", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl bg-card border ${isEdited ? "border-amber-500/60 ring-1 ring-amber-500/30" : "border-border/60"} shadow-sm overflow-hidden`}
    >
      {/* Header: avatar + name + actions */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/70 grid place-items-center text-primary-foreground text-base font-bold shrink-0 shadow-sm">
          {initials(worker.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate flex items-center gap-1.5">
            {worker.name}
            {(isEdited || wasEdited) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Edited</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {worker.role} <span className="mx-1 opacity-50">•</span>
            <span className="font-semibold text-foreground">₹{worker.daily_rate.toLocaleString()}</span>/दिन
          </div>
          {updatedLabel && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {updatedLabel}
            </div>
          )}
        </div>
        {mode === "gps" && (
          <button
            onClick={captureGps}
            disabled={gpsLoading}
            className={`w-9 h-9 grid place-items-center rounded-lg active:scale-95 transition ${gps ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"} hover:bg-primary/20 disabled:opacity-60`}
            title="GPS से हाजिर करें"
          >
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={() => setCalOpen(true)}
          className="w-9 h-9 grid place-items-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition"
          title="इस मजदूर का कैलेंडर"
        >
          <CalendarDays className="w-4 h-4" />
        </button>
      </div>

      {/* Attendance pill buttons row */}
      <div className="px-4 pb-2 grid grid-cols-3 gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = sel === opt.value;
          return (
            <motion.button
              key={opt.value}
              whileTap={{ scale: 0.96 }}
              onClick={() => pickStatus(opt.value)}
              className={`relative h-11 rounded-full font-bold text-sm flex items-center justify-center gap-1.5 transition-all duration-200 ${
                active
                  ? `${opt.activeBg} ${opt.activeText} shadow-md ring-2 ${opt.ring}`
                  : `${opt.idleBg} ${opt.idleText} hover:brightness-95`
              }`}
              aria-pressed={active}
            >
              <span className={`grid place-items-center rounded-full text-[11px] font-extrabold w-6 h-6 ${active ? "bg-white/25" : "bg-white/70 dark:bg-black/20"}`}>
                {opt.label}
              </span>
              <span className="text-[12px]">{opt.full}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Site dropdown */}
      <div className="px-4 pb-3 pt-1">
        <label className="text-[11px] text-muted-foreground font-medium">साइट चुनें</label>
        <Select value={site || "__none__"} onValueChange={updateSite}>
          <SelectTrigger className={`h-10 mt-1 text-sm rounded-xl bg-background ${siteError ? "border-rose-500 ring-1 ring-rose-500/40" : "border-primary/30"}`}>
            <SelectValue placeholder="साइट चुनें" />
          </SelectTrigger>
          <SelectContent className="z-[100] bg-popover">
            <SelectItem value="__none__">— कोई नहीं —</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}{s.location ? ` · ${s.location}` : ""}
              </SelectItem>
            ))}
            <SelectItem value="__add__" className="text-primary font-medium">
              ➕ नई साइट जोड़ें
            </SelectItem>
          </SelectContent>
        </Select>
        {siteError && (
          <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> कृपया साइट चुनें
          </p>
        )}
      </div>

      <WorkerCalendarDialog open={calOpen} onOpenChange={setCalOpen} worker={worker} onSaved={onMarked} />
    </motion.div>
  );
}

type CalendarAttendance = {
  status: AttendanceStatus;
  advance: number;
  site_name: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

function WorkerCalendarDialog({ open, onOpenChange, worker, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; worker: Worker; onSaved: () => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [rows, setRows] = useState<Record<string, CalendarAttendance>>({});
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savingDay, setSavingDay] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);

  const fetchMonth = async () => {
    setLoading(true);
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("date,status,advance,site_name,notes,created_at,updated_at")
      .eq("worker_id", worker.id)
      .gte("date", start)
      .lte("date", end);
    const map: Record<string, CalendarAttendance> = {};
    (data || []).forEach((r: any) => { map[r.date] = r; });
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { if (open) fetchMonth(); /* eslint-disable-line */ }, [open, year, month, worker.id]);

  const cycleDay = async (iso: string) => {
    if (iso > todayIso) {
      toast({ title: "भविष्य की तारीख edit नहीं हो सकती", variant: "destructive" });
      return;
    }
    const cur = rows[iso];
    const idx = cur ? ORDER.indexOf(cur.status) : -1;
    const next = ORDER[(idx + 1) % ORDER.length];
    if (!window.confirm(`${iso} — ${cur ? `${cur.status} → ${next}` : `सेट करें: ${next}`}?`)) return;
    setSavingDay(iso);
    try {
      const saved = await markAttendance({
        worker_id: worker.id,
        date: iso,
        status: next,
        advance: cur?.advance || 0,
        site_name: cur?.site_name ?? worker.site_name,
        notes: cur?.notes ?? null,
      });
      setRows((r) => ({
        ...r,
        [iso]: {
          status: next,
          advance: saved.advance ?? cur?.advance ?? 0,
          site_name: saved.site_name ?? cur?.site_name ?? worker.site_name,
          notes: saved.notes ?? cur?.notes ?? null,
          created_at: saved.created_at ?? cur?.created_at,
          updated_at: saved.updated_at ?? new Date().toISOString(),
        },
      }));
      onSaved();
      toast({ title: `✅ ${iso} — ${next}` });
    } catch (e: any) {
      toast({ title: "सेव नहीं हुआ", description: e.message, variant: "destructive" });
    } finally {
      setSavingDay(null);
    }
  };

  const cells: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = new Date(year, month, d).toISOString().slice(0, 10);
    cells.push({ day: d, iso });
  }

  const totals = Object.values(rows).reduce(
    (acc, row) => {
      if (row.status === "Present") acc.P++;
      else if (row.status === "Absent") acc.A++;
      else if (row.status === "Half-Day") acc.H++;
      return acc;
    },
    { P: 0, A: 0, H: 0 }
  );
  const earning = totals.P * worker.daily_rate + totals.H * worker.daily_rate * 0.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center justify-between gap-2">
            <span>{worker.name} — हाजिरी कैलेंडर</span>
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`text-[11px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 ${editMode ? "bg-amber-500 text-white" : "bg-primary/10 text-primary"}`}
            >
              <Pencil className="w-3 h-3" /> {editMode ? "बंद करें" : "एडिट"}
            </button>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="px-2 py-1 rounded hover:bg-muted text-sm">‹</button>
            <span className="text-sm font-semibold">{HINDI_MONTHS[month]} {year}</span>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="px-2 py-1 rounded hover:bg-muted text-sm">›</button>
          </div>
          {editMode && (
            <p className="text-[10px] text-center text-amber-600 font-medium">किसी दिन पर टैप करें: P → A → HD क्रम में बदलेगा</p>
          )}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEK.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="aspect-square" />;
              const s = rows[c.iso];
              const p = s ? PILL[s.status] : null;
              const disabled = !editMode || c.iso > todayIso;
              const isSaving = savingDay === c.iso;
              return (
                <button
                  key={i}
                  disabled={disabled || isSaving}
                  onClick={() => cycleDay(c.iso)}
                  className={`aspect-square rounded-md flex flex-col items-center justify-center text-[10px] ${p ? "" : "bg-muted/30"} ${editMode && c.iso <= todayIso ? "ring-1 ring-amber-400/40 hover:ring-amber-500 active:scale-95 transition" : "cursor-default"}`}
                >
                  <span className="leading-none">{c.day}</span>
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin mt-0.5" />
                  ) : p ? (
                    <span className={`mt-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold grid place-items-center ${p.bg}`}>{p.label}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-2 border-t border-border">
            <div><div className="text-emerald-600 font-bold">{totals.P}</div><div className="text-muted-foreground">P</div></div>
            <div><div className="text-rose-600 font-bold">{totals.A}</div><div className="text-muted-foreground">A</div></div>
            <div><div className="text-amber-600 font-bold">{totals.H}</div><div className="text-muted-foreground">HD</div></div>
            <div><div className="text-primary font-bold">₹{earning.toLocaleString()}</div><div className="text-muted-foreground">कमाई</div></div>
          </div>
          {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
