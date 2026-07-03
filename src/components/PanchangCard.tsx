import { useEffect, useMemo, useState } from "react";
import { computePanchang, type Panchang } from "@/lib/panchang";
import {
  Sun,
  Sunset,
  Moon,
  Star,
  Compass,
  Sprout,
  CalendarDays,
} from "lucide-react";

interface Props {
  date?: Date;
  className?: string;
}

export default function PanchangCard({ date, className }: Props) {
  const [now, setNow] = useState(() => date ?? new Date());

  // Auto-refresh: recompute every minute so tithi flips in real time.
  useEffect(() => {
    if (date) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [date]);

  const p: Panchang = useMemo(() => computePanchang(now), [now]);

  const highlight = p.isPurnima
    ? { label: "🌕 पूर्णिमा", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" }
    : p.isAmavasya
    ? { label: "🌑 अमावस्या", tone: "bg-slate-800/15 text-slate-700 dark:text-slate-200 border-slate-500/30" }
    : p.isEkadashi
    ? { label: "🪷 एकादशी", tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" }
    : null;

  return (
    <section
      className={
        "bg-card rounded-[20px] border border-border/60 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)] p-3 " +
        (className || "")
      }
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-orange-600" />
          <h2 className="text-sm font-extrabold">पंचांग</h2>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground">{p.gregorian}</span>
      </div>

      {/* Primary row: Vaar • Paksha • Tithi */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-muted-foreground">वार</div>
          <div className="text-sm font-extrabold truncate">{p.vaar}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-muted-foreground">पक्ष</div>
          <div className="text-sm font-extrabold truncate">{p.paksha}</div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold text-muted-foreground">तिथि</div>
          <div className="text-sm font-extrabold truncate text-orange-700 dark:text-orange-300">{p.tithi}</div>
        </div>
      </div>

      {highlight && (
        <div className={`text-center text-[11px] font-bold px-2 py-1 rounded-full border mb-2 ${highlight.tone}`}>
          {highlight.label}
        </div>
      )}

      {/* Grid: Masa, Nakshatra, Ayana, Ritu, Sunrise, Sunset */}
      <div className="grid grid-cols-2 gap-2">
        <Info icon={Moon} label="मास" value={p.masa} />
        <Info icon={Star} label="नक्षत्र" value={p.nakshatra} />
        <Info icon={Compass} label="अयन" value={p.ayana} />
        <Info icon={Sprout} label="ऋतु" value={p.ritu} />
        <Info icon={Sun} label="सूर्योदय" value={p.sunrise} tone="text-amber-600" />
        <Info icon={Sunset} label="सूर्यास्त" value={p.sunset} tone="text-rose-600" />
      </div>

      {p.festival && (
        <div className="mt-2 text-center text-[11px] font-bold text-rose-600 dark:text-rose-300">
          🎉 {p.festival}
        </div>
      )}
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-2.5 py-1.5">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${tone || "text-muted-foreground"}`} />
      <div className="min-w-0">
        <div className="text-[9px] font-semibold text-muted-foreground leading-none">{label}</div>
        <div className="text-[12px] font-extrabold truncate leading-tight">{value}</div>
      </div>
    </div>
  );
}
