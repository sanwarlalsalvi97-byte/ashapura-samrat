import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import PendingPaymentsCard from "./PendingPaymentsCard";
import { listSites, subscribeSites, getSitesVersion } from "@/lib/sites";

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
  const [site, setSite] = useState<string>("__all__");
  useSyncExternalStore(subscribeSites, getSitesVersion, getSitesVersion);
  const sites = useMemo(() => listSites(), []);

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

      <div className="bg-card rounded-2xl border border-border/60 px-3 py-2.5 shadow-sm">
        <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground mb-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          साइट फ़िल्टर
        </label>
        <select
          value={site}
          onChange={(e) => setSite(e.target.value)}
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <option value="__all__">सभी साइट</option>
          {sites.map((s) => (
            <option key={s.id} value={s.name}>{s.name}{s.location ? ` — ${s.location}` : ""}</option>
          ))}
        </select>
      </div>

      <PendingPaymentsCard
        startISO={startISO}
        endISO={endISO}
        monthLabel={label}
        siteFilter={site === "__all__" ? null : site}
      />
    </div>
  );
}
