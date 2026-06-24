import { useState, useEffect, useCallback, useMemo } from "react";
import { ATTENDANCE_UPDATED_EVENT, getWorkers, getAttendanceByDate, markAttendance, getContractors, type Worker, type AttendanceStatus, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import AttendanceCard, { type WorkerTimes } from "./AttendanceCard";
import AttendanceCalendarView from "./AttendanceCalendarView";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell, Clock, WifiOff, CloudUpload, Check, FileDown, FileText, List, CalendarDays, Search, Hand, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWorkTime, formatTime12h } from "@/lib/work-time";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { toast } from "@/hooks/use-toast";
import { exportCSV, exportPDF } from "@/lib/export-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TithiBadge from "./TithiBadge";

const STATUS_LABEL: Record<string, string> = {
  Present: "हाजिर",
  "Half-Day": "आधा दिन",
  Absent: "गैरहाजिर",
};

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(d: Date) {
  const days = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
  const months = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export default function AttendancePage() {
  const [date, setDate] = useState(new Date());
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; advance: number; created_at?: string; updated_at?: string }>>({});
  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>({});
  const [siteOverrides, setSiteOverrides] = useState<Record<string, string>>({});
  const [gpsMap, setGpsMap] = useState<Record<string, { lat: number; lng: number }>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"manual" | "gps">(() => (localStorage.getItem("att-mode") as "manual" | "gps") || "manual");

  useEffect(() => { localStorage.setItem("att-mode", mode); }, [mode]);

  const loadData = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([getWorkers(), getAttendanceByDate(formatDate(date))]);
      setWorkers(w);
      const map: typeof attendance = {};
      a.forEach((r: any) => {
        map[r.worker_id] = { status: r.status, advance: r.advance, created_at: r.created_at, updated_at: r.updated_at };
      });
      setAttendance(map);
      setSelections({});
    } catch {}
  }, [date]);

  const handleSelectionChange = useCallback((workerId: string, status: AttendanceStatus | undefined) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (status) next[workerId] = status;
      else delete next[workerId];
      return next;
    });
  }, []);

  const handleSiteChange = useCallback((workerId: string, site: string) => {
    setSiteOverrides((p) => ({ ...p, [workerId]: site }));
  }, []);

  const handleGpsChange = useCallback((workerId: string, gps: { lat: number; lng: number } | undefined) => {
    setGpsMap((p) => {
      const n = { ...p };
      if (gps) n[workerId] = gps; else delete n[workerId];
      return n;
    });
  }, []);

  const saveAll = async () => {
    const entries = workers
      .map((w) => {
        const sel = selections[w.id];
        if (!sel) return null;
        const existing = attendance[w.id];
        // Skip if selection equals existing status (no change)
        if (existing && existing.status === sel) return null;
        return { worker: w, status: sel, advance: existing?.advance || 0, wasEdit: !!existing };
      })
      .filter(Boolean) as { worker: Worker; status: AttendanceStatus; advance: number; wasEdit: boolean }[];

    if (entries.length === 0) {
      toast({ title: "कोई नई हाजिरी नहीं चुनी", description: "पहले P / HD / A में से कोई एक चुनें", variant: "destructive" });
      return;
    }

    // Validate: every selected entry must have a site
    const missingSite = entries.filter((e) => {
      const s = (siteOverrides[e.worker.id] ?? e.worker.site_name ?? "").trim();
      return !s;
    });
    if (missingSite.length > 0) {
      toast({
        title: `${missingSite.length} मजदूर की साइट नहीं चुनी`,
        description: missingSite.map((e) => e.worker.name).join(", "),
        variant: "destructive",
      });
      return;
    }

    const edits = entries.filter((e) => e.wasEdit).length;
    const news = entries.length - edits;
    const msg = `${entries.length} एंट्री सेव होगी${edits > 0 ? ` (${news} नई, ${edits} अपडेट)` : ""}। क्या आप पक्का सेव करना चाहते हैं?`;
    if (!window.confirm(msg)) return;


    setSavingAll(true);
    let ok = 0, fail = 0;
    const savedAt = new Date().toISOString();
    for (const e of entries) {
      try {
        const siteOverride = siteOverrides[e.worker.id];
        const gps = gpsMap[e.worker.id];
        const gpsStatus = mode === "gps" ? (gps ? "ON" : "OFF") : (gps ? "ON" : "OFF");
        await markAttendance({
          worker_id: e.worker.id,
          date: formatDate(date),
          status: e.status,
          advance: e.advance,
          site_name: (siteOverride && siteOverride.trim()) || e.worker.site_name,
          notes: null,
          gps_status: gpsStatus,
          gps_lat: gps?.lat ?? null,
          gps_lng: gps?.lng ?? null,
        } as any);
        setAttendance((prev) => ({
          ...prev,
          [e.worker.id]: {
            status: e.status,
            advance: e.advance,
            created_at: prev[e.worker.id]?.created_at || savedAt,
            updated_at: savedAt,
          },
        }));
        setSelections((prev) => {
          const next = { ...prev };
          delete next[e.worker.id];
          return next;
        });
        ok++;
      } catch (err: any) {
        fail++;
        toast({ title: `${e.worker.name} सेव नहीं हुआ`, description: err?.message, variant: "destructive" });
      }
    }
    setSavingAll(false);
    toast({
      title: `${ok} मजदूर की हाजिरी सेव हो गई${fail > 0 ? ` (${fail} में गलती)` : ""}`,
    });
    loadData();
  };

  const exportToday = async (format: "csv" | "pdf") => {
    const dateStr = formatDate(date);
    const displayDate = `${formatDisplayDate(date)} (${dateStr})`;
    const mode = getGroupingMode();
    let contractors: Contractor[] = [];
    if (mode === "contractor") {
      try { contractors = await getContractors(); } catch { contractors = []; }
    }

    // Group by contractor/site based on user preference
    const groups = new Map<string, Worker[]>();
    workers.forEach((w) => {
      const key = resolveGroupLabel(w, contractors, mode);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(w);
    });

    const rows: (string | number)[][] = [];
    let totalEarning = 0, totalAdvance = 0, totalNet = 0;

    Array.from(groups.entries()).forEach(([contractor, ws]) => {
      ws.forEach((w) => {
        const a = attendance[w.id];
        const status = a?.status || "—";
        const statusLabel = STATUS_LABEL[status] || status;
        const advance = a?.advance || 0;
        let earning = 0;
        if (status === "Present") earning = w.daily_rate;
        else if (status === "Half-Day") earning = w.daily_rate * 0.5;
        const net = earning - advance;
        totalEarning += earning;
        totalAdvance += advance;
        totalNet += net;
        rows.push([
          contractor,
          w.name,
          w.role,
          w.daily_rate,
          statusLabel,
          earning,
          advance,
          net,
        ]);
      });
    });

    const headers = ["ठेकेदार/साइट", "नाम", "पद", "दैनिक दर", "हाजिरी", "कमाई", "एडवांस", "बाकी"];

    if (format === "csv") {
      rows.push(["", "", "", "", "कुल", totalEarning, totalAdvance, totalNet]);
      exportCSV(`हाजिरी-${dateStr}.csv`, headers, rows);
      toast({ title: "CSV डाउनलोड हो गई" });
    } else {
      rows.push(["", "", "", "", "कुल", totalEarning, totalAdvance, totalNet]);
      exportPDF(`हाजिरी रिपोर्ट`, headers, rows, displayDate);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, loadData);
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, loadData);
  }, [loadData]);

  const changeDate = (dir: number) => {
    setDate((d) => { const n = new Date(d); n.setDate(n.getDate() + dir); return n; });
  };

  const handleCalendarSelect = (selected: Date | undefined) => {
    if (selected) {
      setDate(selected);
      setCalendarOpen(false);
    }
  };

  const isToday = useMemo(() => formatDate(date) === formatDate(new Date()), [date]);
  const pendingCount = useMemo(
    () => workers.filter((w) => !attendance[w.id]).length,
    [workers, attendance]
  );
  const workTime = useMemo(() => getWorkTime(), []);
  const { online, pending } = useOfflineSync();

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(q) || (w.role || "").toLowerCase().includes(q));
  }, [workers, search]);

  const totals = useMemo(() => {
    const merged: Record<string, AttendanceStatus> = {};
    workers.forEach((w) => {
      const s = selections[w.id] ?? attendance[w.id]?.status;
      if (s) merged[w.id] = s;
    });
    const vals = Object.values(merged);
    return {
      P: vals.filter((s) => s === "Present").length,
      A: vals.filter((s) => s === "Absent").length,
      H: vals.filter((s) => s === "Half-Day").length,
      total: workers.length,
    };
  }, [workers, attendance, selections]);

  return (
    <div className="space-y-4">
      {(!online || pending > 0) && (
        <div className={cn(
          "flex items-start gap-3 rounded-xl p-3 border",
          !online
            ? "bg-destructive/10 border-destructive/30"
            : "bg-primary/10 border-primary/30"
        )}>
          {!online ? (
            <WifiOff className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <CloudUpload className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-pulse" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {!online ? "ऑफलाइन मोड" : "सिंक हो रहा है…"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!online
                ? `हाजिरी फोन में सेव होगी${pending > 0 ? ` (${pending} एंट्री बाकी)` : ""}, इंटरनेट आते ही अपने आप सर्वर पर भेज दी जाएगी।`
                : `${pending} एंट्री सर्वर पर भेजी जा रही है।`}
            </p>
          </div>
        </div>
      )}

      {isToday && workers.length > 0 && pendingCount > 0 && (
        <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 rounded-xl p-3">
          <Bell className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              आज {pendingCount} मजदूर की हाजिरी बाकी है
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime12h(workTime.checkIn)} – {formatTime12h(workTime.checkOut)}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-card rounded-xl p-3">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="gap-2 h-auto py-1.5">
              <CalendarIcon className="w-4 h-4" />
              <div className="text-center">
                <p className="font-semibold text-sm">{formatDisplayDate(date)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
                <TithiBadge date={date} compact className="mt-1" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleCalendarSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" onClick={() => changeDate(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* View toggle: List / Calendar */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => setView("list")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
            view === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground"
          }`}
        >
          <List className="w-4 h-4" /> लिस्ट
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
            view === "calendar" ? "bg-card shadow text-foreground" : "text-muted-foreground"
          }`}
        >
          <CalendarDays className="w-4 h-4" /> कैलेंडर
        </button>
      </div>

      {view === "calendar" ? (
        <AttendanceCalendarView />
      ) : (
        <>
          {workers.length > 0 && (
            <>
              {/* Mode toggle: Manual / GPS */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                <button
                  onClick={() => setMode("manual")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    mode === "manual" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Hand className="w-4 h-4" /> मैनुअल
                </button>
                <button
                  onClick={() => setMode("gps")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                    mode === "gps" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <MapPin className="w-4 h-4" /> GPS
                </button>
              </div>
              {mode === "gps" && (
                <p className="text-[11px] text-muted-foreground -mt-1 px-1">
                  GPS बटन दबाने पर मजदूर अपने आप "हाजिर" मार्क होगा और लोकेशन सेव होगी।
                </p>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="मजदूर खोजें..."
                  className="pl-9 rounded-xl"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <FileDown className="w-4 h-4" />
                    आज की हाजिरी एक्सपोर्ट करें
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => exportToday("csv")}>
                    <FileDown className="w-4 h-4 mr-2" /> CSV डाउनलोड करें
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToday("pdf")}>
                    <FileText className="w-4 h-4 mr-2" /> PDF (प्रिंट) करें
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {workers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">कोई मजदूर नहीं</p>
              <p className="text-sm mt-1">पहले "मजदूर" टैब में मजदूर जोड़ें</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 pb-44">
                {filteredWorkers.map((w) => (
                  <AttendanceCard
                    key={w.id}
                    worker={w}
                    date={formatDate(date)}
                    currentStatus={attendance[w.id]?.status}
                    currentAdvance={attendance[w.id]?.advance}
                    currentCreatedAt={attendance[w.id]?.created_at}
                    currentUpdatedAt={attendance[w.id]?.updated_at}
                    mode={mode}
                    onMarked={loadData}
                    onSelectionChange={handleSelectionChange}
                    onSiteChange={handleSiteChange}
                    onGpsChange={handleGpsChange}
                  />
                ))}
              </div>

              {/* Totals strip + Save button (sticky bottom) */}
              <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10">
                <div className="max-w-lg mx-auto space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2 text-center">
                      <div className="text-[10px] font-semibold text-emerald-600">P</div>
                      <div className="text-base font-extrabold text-emerald-600 leading-none">{totals.P}</div>
                    </div>
                    <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2 text-center">
                      <div className="text-[10px] font-semibold text-rose-600">A</div>
                      <div className="text-base font-extrabold text-rose-600 leading-none">{totals.A}</div>
                    </div>
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2 text-center">
                      <div className="text-[10px] font-semibold text-amber-600">HD</div>
                      <div className="text-base font-extrabold text-amber-600 leading-none">{totals.H}</div>
                    </div>
                    <div className="rounded-xl bg-muted border border-border p-2 text-center">
                      <div className="text-[10px] font-semibold text-muted-foreground">कुल</div>
                      <div className="text-base font-extrabold leading-none">{totals.total}</div>
                    </div>
                  </div>
                  <Button
                    className="w-full shadow-lg"
                    size="lg"
                    onClick={saveAll}
                    disabled={savingAll || Object.keys(selections).length === 0}
                  >
                    <Check className="w-5 h-5" />
                    {savingAll
                      ? "सेव हो रहा है..."
                      : Object.keys(selections).length > 0
                        ? `हाजिरी सेव करें (${Object.keys(selections).length})`
                        : "हाजिरी सेव करें"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
