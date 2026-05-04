import { useState, useEffect, useCallback, useMemo } from "react";
import { getWorkers, getAttendanceByDate, markAttendance, getContractors, type Worker, type AttendanceStatus, type Contractor } from "@/lib/supabase-helpers";
import { getGroupingMode, resolveGroupLabel } from "@/lib/grouping-prefs";
import AttendanceCard from "./AttendanceCard";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell, Clock, WifiOff, CloudUpload, Check, FileDown, FileText } from "lucide-react";
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
  const [attendance, setAttendance] = useState<Record<string, { status: AttendanceStatus; advance: number }>>({});
  const [selections, setSelections] = useState<Record<string, AttendanceStatus>>({});
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([getWorkers(), getAttendanceByDate(formatDate(date))]);
      setWorkers(w);
      const map: typeof attendance = {};
      a.forEach((r) => {
        map[r.worker_id] = { status: r.status, advance: r.advance };
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

  const saveAll = async () => {
    const entries = workers
      .map((w) => {
        const sel = selections[w.id];
        const existing = attendance[w.id];
        // Skip if no new selection AND already saved
        if (!sel && existing) return null;
        const status = sel || existing?.status;
        if (!status) return null;
        // Skip if selection equals existing status (no change)
        if (!sel && existing) return null;
        return { worker: w, status, advance: existing?.advance || 0 };
      })
      .filter(Boolean) as { worker: Worker; status: AttendanceStatus; advance: number }[];

    if (entries.length === 0) {
      toast({ title: "कोई नई हाजिरी नहीं चुनी", variant: "destructive" });
      return;
    }

    setSavingAll(true);
    let ok = 0, fail = 0;
    for (const e of entries) {
      try {
        await markAttendance({
          worker_id: e.worker.id,
          date: formatDate(date),
          status: e.status,
          advance: e.advance,
          site_name: e.worker.site_name,
        });
        ok++;
      } catch {
        fail++;
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

      {workers.length > 0 && (
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
      )}

      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई मजदूर नहीं</p>
          <p className="text-sm mt-1">पहले "मजदूर" टैब में मजदूर जोड़ें</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 pb-20">
            {workers.map((w) => (
              <AttendanceCard
                key={w.id}
                worker={w}
                date={formatDate(date)}
                currentStatus={attendance[w.id]?.status}
                currentAdvance={attendance[w.id]?.advance}
                onMarked={loadData}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </div>
          {Object.keys(selections).length > 0 && (
            <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 pt-2 bg-gradient-to-t from-background via-background to-transparent z-10">
              <Button
                className="w-full shadow-lg"
                size="lg"
                onClick={saveAll}
                disabled={savingAll}
              >
                <Check className="w-5 h-5" />
                {savingAll
                  ? "सेव हो रहा है..."
                  : `सब की हाजिरी सेव करें (${Object.keys(selections).length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
