import { daysInMonth, isoDateFromParts, monthBoundsISO, toISODate, weekdayOfISO } from "@/lib/date-utils";
import { useEffect, useMemo, useState } from "react";
import { markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Loader2, Pencil, Clock, Timer, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSites, createSite, type Site } from "@/lib/sites";
import { getWorkTime } from "@/lib/work-time";
import { HALF_DAY_HOURS, STANDARD_HOURS, timeToMinutes } from "@/lib/work-hours";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

/**
 * Attendance codes — encoded on top of the DB enum + overtime_hours + notes:
 *   A     → status=Absent
 *   P     → status=Present,   ot=0
 *   HALF  → status=Half-Day,  ot=0            (label "½")
 *   P_HALF→ status=Present,   ot=4            (label "P+½", = 1.5 day)
 *   PP    → status=Present,   ot=8            (label "P+P", = 2 days)
 *   OT    → status=Present,   ot=<user hrs>
 *   PA    → status=Present,   ot=0, notes="PA"  (Paid Absent)
 */
export type AttCode = "A" | "P" | "HALF" | "P_HALF" | "PP" | "OT" | "PA";

export type WorkerTimes = {
  in_time: string | null;
  out_time: string | null;
  total_hours: number;
  overtime_hours: number;
  invalid?: boolean;
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
  currentNotes?: string | null;
  mode?: "manual" | "gps";
  /** Worker (मजदूर) accounts: view only, no marking/editing. */
  readOnly?: boolean;
  onMarked: () => void;
  // Legacy no-op props (page still passes them)
  onSelectionChange?: (workerId: string, status: AttendanceStatus | undefined) => void;
  onSiteChange?: (workerId: string, site: string) => void;
  onGpsChange?: (workerId: string, gps: { lat: number; lng: number } | undefined) => void;
  onTimesChange?: (workerId: string, times: WorkerTimes) => void;
}

const HINDI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
const WEEK = ["र", "सो", "मं", "बु", "गु", "शु", "श"];

const ORDER: AttendanceStatus[] = ["Present", "Absent", "Half-Day"];

const PILL: Record<string, { label: string; bg: string }> = {
  Present: { label: "P", bg: "bg-emerald-500" },
  Absent: { label: "A", bg: "bg-rose-500" },
  "Half-Day": { label: "HD", bg: "bg-amber-500" },
};

type CodeSpec = {
  code: AttCode;
  label: string;
  full: string;
  active: string;   // active bg + text
  idle: string;     // idle bg + text
};

const CODES: CodeSpec[] = [
  { code: "A",      label: "A",   full: "गैरहाजिर",  active: "bg-rose-500 text-white",     idle: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  { code: "P",      label: "P",   full: "हाजिर",     active: "bg-emerald-500 text-white",  idle: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { code: "HALF",   label: "½",   full: "आधा दिन",   active: "bg-amber-500 text-white",    idle: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { code: "P_HALF", label: "P+½", full: "1.5 दिन",   active: "bg-lime-600 text-white",     idle: "bg-lime-500/10 text-lime-700 dark:text-lime-300" },
  { code: "PP",     label: "P+P", full: "डबल",       active: "bg-teal-600 text-white",     idle: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
  { code: "OT",     label: "OT",  full: "ओवरटाइम",   active: "bg-purple-600 text-white",   idle: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  { code: "PA",     label: "PA",  full: "पेड़ छुट्टी", active: "bg-sky-600 text-white",     idle: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
];

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

/** Derive current attendance code from stored row. */
function deriveCode(
  status?: AttendanceStatus,
  ot?: number | null,
  notes?: string | null,
): AttCode | undefined {
  if (!status) return undefined;
  if (status === "Absent") return "A";
  if (status === "Half-Day") return "HALF";
  // Present
  const otN = Number(ot || 0);
  if (notes && notes.trim().toUpperCase() === "PA") return "PA";
  if (otN === 4) return "P_HALF";
  if (otN === 8) return "PP";
  if (otN > 0) return "OT";
  return "P";
}

/** Convert code + optional OT hours into DB payload fields. */
function codeToPayload(code: AttCode, otHours: number, checkIn: string, checkOut: string) {
  // Default IN/OUT auto-filled for Present-like codes
  const halfOut = (() => {
    const startMin = timeToMinutes(checkIn) ?? 8 * 60;
    const end = startMin + HALF_DAY_HOURS * 60;
    const h = Math.floor(end / 60) % 24;
    const m = end % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  })();

  switch (code) {
    case "A":
      return { status: "Absent" as AttendanceStatus, ot: 0, in_time: null as string | null, out_time: null as string | null, total: 0, notes: null as string | null };
    case "P":
      return { status: "Present" as AttendanceStatus, ot: 0, in_time: checkIn, out_time: checkOut, total: STANDARD_HOURS, notes: null };
    case "HALF":
      return { status: "Half-Day" as AttendanceStatus, ot: 0, in_time: checkIn, out_time: halfOut, total: HALF_DAY_HOURS, notes: null };
    case "P_HALF":
      return { status: "Present" as AttendanceStatus, ot: 4, in_time: checkIn, out_time: checkOut, total: STANDARD_HOURS, notes: null };
    case "PP":
      return { status: "Present" as AttendanceStatus, ot: 8, in_time: checkIn, out_time: checkOut, total: STANDARD_HOURS, notes: null };
    case "OT":
      return { status: "Present" as AttendanceStatus, ot: Math.max(0.5, otHours), in_time: checkIn, out_time: checkOut, total: STANDARD_HOURS, notes: null };
    case "PA":
      return { status: "Present" as AttendanceStatus, ot: 0, in_time: null, out_time: null, total: 0, notes: "PA" };
  }
}

export default function AttendanceCard({
  worker, date, currentStatus, currentCreatedAt, currentUpdatedAt,
  currentInTime, currentOutTime, currentOvertimeHours, currentNotes,
  mode = "manual", onMarked, onSiteChange, onGpsChange, readOnly = false,
}: Props) {
  const derivedCode = deriveCode(currentStatus, currentOvertimeHours, currentNotes);
  const [code, setCode] = useState<AttCode | undefined>(derivedCode);
  const [site, setSite] = useState(worker.site_name || "");
  const [sites, setSites] = useState<Site[]>(() => listSites());
  const [gps, setGps] = useState<{ lat: number; lng: number } | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [savingCode, setSavingCode] = useState<AttCode | null>(null);
  const [otDialog, setOtDialog] = useState(false);
  const [otHours, setOtHours] = useState<number>(currentOvertimeHours && currentOvertimeHours > 0 && currentOvertimeHours !== 4 && currentOvertimeHours !== 8 ? Number(currentOvertimeHours) : 2);
  const [siteDialog, setSiteDialog] = useState(false);
  const [pendingCode, setPendingCode] = useState<AttCode | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const workDefaults = useMemo(() => getWorkTime(), []);

  useEffect(() => {
    setCode(deriveCode(currentStatus, currentOvertimeHours, currentNotes));
  }, [currentStatus, currentOvertimeHours, currentNotes, date]);
  useEffect(() => { setSite(worker.site_name || ""); }, [worker.site_name]);
  useEffect(() => {
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    return () => window.removeEventListener("sites-updated", refresh);
  }, []);

  async function doSave(nextCode: AttCode, otVal?: number) {
    const effectiveSite = (site || worker.site_name || "").trim();
    if (!effectiveSite) {
      setPendingCode(nextCode);
      setSiteDialog(true);
      return;
    }
    const p = codeToPayload(nextCode, otVal ?? otHours, workDefaults.checkIn, workDefaults.checkOut);
    setSavingCode(nextCode);
    try {
      await markAttendance({
        worker_id: worker.id,
        date,
        status: p.status,
        advance: 0,
        site_name: effectiveSite,
        notes: p.notes,
        gps_status: gps ? "ON" : "OFF",
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
        in_time: p.in_time,
        out_time: p.out_time,
        total_hours: p.total,
        overtime_hours: p.ot,
      } as any);
      setCode(nextCode);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
      toast({ title: `✓ ${worker.name} — ${CODES.find(c => c.code === nextCode)?.full}` });
      onMarked();
    } catch (e: any) {
      toast({ title: "सेव नहीं हुआ", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCode(null);
    }
  }

  const pickCode = (c: AttCode) => {
    if (readOnly) return;
    if (c === "OT") {
      setOtDialog(true);
      return;
    }
    void doSave(c);
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
        if (mode === "gps") void doSave("P");
        else toast({ title: `📍 GPS सेव हुआ` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "GPS नहीं मिला", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const wasEdited = !!currentCreatedAt && !!currentUpdatedAt && Math.abs(new Date(currentUpdatedAt).getTime() - new Date(currentCreatedAt).getTime()) > 1000;
  const updatedLabel = currentUpdatedAt
    ? new Date(currentUpdatedAt).toLocaleString("hi-IN", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <motion.div
      id={`attendance-card-${worker.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`scroll-mt-24 rounded-2xl bg-card border ${justSaved ? "border-emerald-500/60 ring-1 ring-emerald-500/30" : "border-border/60"} shadow-sm overflow-hidden transition`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/70 grid place-items-center text-primary-foreground text-base font-bold shrink-0 shadow-sm">
          {initials(worker.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] truncate flex items-center gap-1.5">
            {worker.name}
            {wasEdited && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">Edited</span>
            )}
            {justSaved && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> सेव
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {worker.role} <span className="mx-1 opacity-50">•</span>
            <span className="font-semibold text-foreground">₹{worker.daily_rate.toLocaleString()}</span>/दिन
            {code === "OT" && Number(currentOvertimeHours) > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-purple-600 dark:text-purple-300 font-semibold">
                <Timer className="w-3 h-3" /> {Number(currentOvertimeHours)}घं
              </span>
            )}
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

      {/* Code buttons — instant save on tap */}
      <div className="px-3 pb-2 grid grid-cols-7 gap-1.5">
        {CODES.map((c) => {
          const active = code === c.code;
          const busy = savingCode === c.code;
          return (
            <motion.button
              key={c.code}
              whileTap={{ scale: 0.94 }}
              onClick={() => pickCode(c.code)}
              disabled={!!savingCode}
              title={c.full}
              className={`relative h-12 rounded-xl font-extrabold text-[13px] leading-none flex flex-col items-center justify-center gap-0.5 transition-all ${
                active ? `${c.active} shadow-md` : c.idle
              } ${savingCode && !busy ? "opacity-60" : ""}`}
              aria-pressed={active}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{c.label}</span>
                  <span className="text-[8px] font-semibold opacity-80 truncate max-w-full px-0.5">{c.full}</span>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Site dropdown */}
      <div className="px-4 pb-3 pt-1">
        <label className="text-[11px] text-muted-foreground font-medium">साइट</label>
        <Select value={site || "__none__"} onValueChange={updateSite}>
          <SelectTrigger className="h-9 mt-1 text-sm rounded-xl bg-background border-primary/30">
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
      </div>

      {/* OT Hours dialog */}
      <Dialog open={otDialog} onOpenChange={setOtDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">ओवरटाइम घंटे</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{worker.name} — कितने घंटे ओवरटाइम?</p>
            <Input
              type="number"
              step="0.5"
              min={0.5}
              max={12}
              inputMode="decimal"
              value={otHours}
              onChange={(e) => setOtHours(Math.max(0, Number(e.target.value) || 0))}
              className="h-12 text-lg font-bold text-center"
              autoFocus
            />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => setOtHours(h)}
                  className={`h-9 rounded-lg text-sm font-bold transition ${otHours === h ? "bg-purple-600 text-white" : "bg-muted"}`}
                >
                  {h}घं
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setOtDialog(false)}
              className="flex-1 h-11 rounded-xl bg-muted font-bold"
            >
              रद्द
            </button>
            <button
              onClick={() => {
                if (otHours <= 0) {
                  toast({ title: "घंटे भरें", variant: "destructive" });
                  return;
                }
                setOtDialog(false);
                void doSave("OT", otHours);
              }}
              className="flex-1 h-11 rounded-xl bg-purple-600 text-white font-bold"
            >
              सेव करें
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Site required dialog */}
      <Dialog open={siteDialog} onOpenChange={setSiteDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">पहले साइट चुनें</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">इस मजदूर के लिए कोई साइट सेट नहीं है।</p>
            <Select
              onValueChange={(v) => {
                if (v === "__add__") {
                  const name = window.prompt("नई साइट का नाम लिखें:")?.trim();
                  if (!name) return;
                  const created = createSite({ name });
                  if (!created) return;
                  setSites(listSites());
                  v = created.name;
                }
                setSite(v);
                onSiteChange?.(worker.id, v);
                setSiteDialog(false);
                if (pendingCode) {
                  const c = pendingCode;
                  setPendingCode(null);
                  // Save now with newly-picked site (state might be async; pass via override)
                  setTimeout(() => {
                    const p = codeToPayload(c, otHours, workDefaults.checkIn, workDefaults.checkOut);
                    setSavingCode(c);
                    markAttendance({
                      worker_id: worker.id,
                      date,
                      status: p.status,
                      advance: 0,
                      site_name: v,
                      notes: p.notes,
                      gps_status: gps ? "ON" : "OFF",
                      gps_lat: gps?.lat ?? null,
                      gps_lng: gps?.lng ?? null,
                      in_time: p.in_time,
                      out_time: p.out_time,
                      total_hours: p.total,
                      overtime_hours: p.ot,
                    } as any)
                      .then(() => {
                        setCode(c);
                        setJustSaved(true);
                        setTimeout(() => setJustSaved(false), 1200);
                        toast({ title: `✓ ${worker.name} — ${CODES.find(x => x.code === c)?.full}` });
                        onMarked();
                      })
                      .catch((e: any) => toast({ title: "सेव नहीं हुआ", description: e?.message, variant: "destructive" }))
                      .finally(() => setSavingCode(null));
                  }, 0);
                }
              }}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="साइट चुनें" />
              </SelectTrigger>
              <SelectContent className="z-[200] bg-popover">
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
                <SelectItem value="__add__" className="text-primary font-medium">➕ नई साइट जोड़ें</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      <WorkerCalendarDialog open={calOpen} onOpenChange={setCalOpen} worker={worker} onSaved={onMarked} />
    </motion.div>
  );
}

/* ---------------- Worker calendar dialog (unchanged behaviour) ---------------- */

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
  const firstDow = weekdayOfISO(year, month, 1);
  const monthDays = daysInMonth(year, month);
  const todayIso = toISODate(new Date());

  const fetchMonth = async () => {
    setLoading(true);
    const { startISO: start, endISO: end } = monthBoundsISO(year, month);
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
  for (let d = 1; d <= monthDays; d++) {
    const iso = isoDateFromParts(year, month, d);
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
