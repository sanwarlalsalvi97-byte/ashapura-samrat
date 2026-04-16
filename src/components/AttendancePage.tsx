import { useState, useEffect, useCallback } from "react";
import { getWorkers, getAttendanceByDate, type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import AttendanceCard from "./AttendanceCard";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [calendarOpen, setCalendarOpen] = useState(false);

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
