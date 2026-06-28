import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PendingPaymentsCard from "./PendingPaymentsCard";

const HINDI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

function bounds(y: number, m: number) {
  const s = new Date(y, m, 1);
  const e = new Date(y, m + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startISO: iso(s), endISO: iso(e) };
}

export default function PendingPaymentsPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const { startISO, endISO } = useMemo(
    () => bounds(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const label = `${HINDI_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border/60 px-3 py-2.5 shadow-sm">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95"
          aria-label="पिछला महीना"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-[11px] text-muted-foreground font-semibold">बकाया पेमेंट</div>
          <div className="text-base font-extrabold tracking-tight">{label}</div>
        </div>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95"
          aria-label="अगला महीना"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <PendingPaymentsCard startISO={startISO} endISO={endISO} monthLabel={label} />
    </div>
  );
}
