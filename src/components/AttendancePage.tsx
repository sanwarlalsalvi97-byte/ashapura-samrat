import { useState, useEffect, useCallback, useMemo } from "react";
import { getWorkers, getAttendanceByDate, markAttendance, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import AttendanceCard from "./AttendanceCard";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon, Bell, Clock, WifiOff, CloudUpload, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWorkTime, formatTime12h } from "@/lib/work-time";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { toast } from "@/hooks/use-toast";

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
    } catch {}
  }, [date]);

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

      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">कोई मजदूर नहीं</p>
          <p className="text-sm mt-1">पहले "मजदूर" टैब में मजदूर जोड़ें</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((w) => (
            <AttendanceCard
              key={w.id}
              worker={w}
              date={formatDate(date)}
              currentStatus={attendance[w.id]?.status}
              currentAdvance={attendance[w.id]?.advance}
              onMarked={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
}
