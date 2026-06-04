import { useEffect, useState } from "react";
import { type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  worker: Worker;
  date: string;
  currentStatus?: AttendanceStatus;
  currentAdvance?: number;
  mode?: "manual" | "gps";
  onMarked: () => void;
  onSelectionChange?: (workerId: string, status: AttendanceStatus | undefined) => void;
  onSiteChange?: (workerId: string, site: string) => void;
  onGpsChange?: (workerId: string, gps: { lat: number; lng: number } | undefined) => void;
}

const ORDER: AttendanceStatus[] = ["Present", "Absent", "Half-Day"];
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

export default function AttendanceCard({ worker, date, currentStatus, mode = "manual", onSelectionChange, onSiteChange, onGpsChange }: Props) {
  const [sel, setSel] = useState<AttendanceStatus | undefined>(currentStatus);
  const [expanded, setExpanded] = useState(false);
  const [site, setSite] = useState(worker.site_name || "");
  const [gps, setGps] = useState<{ lat: number; lng: number } | undefined>();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => { setSel(currentStatus); }, [currentStatus, date]);

  const cycle = () => {
    const cur = sel;
    const idx = cur ? ORDER.indexOf(cur) : -1;
    const next = ORDER[(idx + 1) % ORDER.length];
    setSel(next);
    onSelectionChange?.(worker.id, next);
  };

  const updateSite = (v: string) => {
    setSite(v);
    onSiteChange?.(worker.id, v);
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
        toast({ title: `📍 GPS सेव हुआ (${g.lat}, ${g.lng})` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "GPS नहीं मिला", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pill = sel ? PILL[sel] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-card border border-border/60 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 dark:from-orange-700 dark:to-orange-900 grid place-items-center text-white text-sm font-bold shrink-0">
          {initials(worker.name)}
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 min-w-0 text-left">
          <div className="font-semibold text-sm truncate">{worker.name}</div>
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            {worker.role}
            {site && <span>• 📍 {site}</span>}
            {gps && <span className="text-emerald-600">• GPS ✓</span>}
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setCalOpen(true); }}
          className="w-9 h-9 grid place-items-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
          title="इस मजदूर का कैलेंडर"
        >
          <CalendarDays className="w-4 h-4" />
        </button>
        <button
          onClick={cycle}
          className={`w-14 h-9 rounded-lg text-white text-sm font-bold grid place-items-center shadow active:scale-95 transition ${
            pill ? pill.bg : "bg-muted text-muted-foreground"
          }`}
          aria-label="Toggle status"
        >
          {pill ? pill.label : "—"}
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 space-y-2 border-t border-border/60"
          >
            <div className="pt-2">
              <label className="text-[11px] text-muted-foreground">साइट का नाम</label>
              <Input
                value={site}
                onChange={(e) => updateSite(e.target.value)}
                placeholder="जैसे शर्मा रेजिडेंसी"
                className="h-9 text-sm"
              />
            </div>
            <button
              onClick={captureGps}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 disabled:opacity-60"
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {gps ? `GPS लॉक: ${gps.lat}, ${gps.lng}` : "GPS लोकेशन लें"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <WorkerCalendarDialog open={calOpen} onOpenChange={setCalOpen} worker={worker} />
    </motion.div>
  );
}

function WorkerCalendarDialog({ open, onOpenChange, worker }: { open: boolean; onOpenChange: (v: boolean) => void; worker: Worker }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [rows, setRows] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("attendance")
        .select("date,status")
        .eq("worker_id", worker.id)
        .gte("date", start)
        .lte("date", end);
      const map: Record<string, AttendanceStatus> = {};
      (data || []).forEach((r: any) => { map[r.date] = r.status; });
      setRows(map);
      setLoading(false);
    })();
  }, [open, year, month, worker.id]);

  const cells: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = new Date(year, month, d).toISOString().slice(0, 10);
    cells.push({ day: d, iso });
  }

  const totals = Object.values(rows).reduce(
    (acc, s) => {
      if (s === "Present") acc.P++;
      else if (s === "Absent") acc.A++;
      else if (s === "Half-Day") acc.H++;
      return acc;
    },
    { P: 0, A: 0, H: 0 }
  );
  const earning = totals.P * worker.daily_rate + totals.H * worker.daily_rate * 0.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">{worker.name} — हाजिरी कैलेंडर</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="px-2 py-1 rounded hover:bg-muted text-sm">‹</button>
            <span className="text-sm font-semibold">{HINDI_MONTHS[month]} {year}</span>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="px-2 py-1 rounded hover:bg-muted text-sm">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {WEEK.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="aspect-square" />;
              const s = rows[c.iso];
              const p = s ? PILL[s] : null;
              return (
                <div key={i} className={`aspect-square rounded-md flex flex-col items-center justify-center text-[10px] ${p ? "" : "bg-muted/30"}`}>
                  <span className="leading-none">{c.day}</span>
                  {p && <span className={`mt-0.5 w-4 h-4 rounded-full text-white text-[8px] font-bold grid place-items-center ${p.bg}`}>{p.label}</span>}
                </div>
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
