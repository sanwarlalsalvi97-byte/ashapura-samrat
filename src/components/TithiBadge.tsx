import { useEffect, useState } from "react";
import { approxTithi, getTithi, type TithiInfo } from "@/lib/tithi";

const KIND_BADGE: Record<string, string> = {
  ekadashi: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30",
  purnima: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30",
  amavasya: "bg-slate-800/15 text-slate-700 dark:text-slate-200 border-slate-500/30",
  normal: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
};

interface Props {
  date: Date;
  compact?: boolean;
  className?: string;
}

export default function TithiBadge({ date, compact, className }: Props) {
  const [info, setInfo] = useState<TithiInfo>(() => approxTithi(date));

  useEffect(() => {
    let mounted = true;
    setInfo(approxTithi(date));
    getTithi(date).then((v) => { if (mounted) setInfo(v); });
    return () => { mounted = false; };
  }, [date]);

  const badge = KIND_BADGE[info.kind];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge} ${className || ""}`}>
        <span className="text-orange-600 dark:text-orange-300">{info.name}</span>
        {info.festival && (
          <span className="text-rose-600 dark:text-rose-300">• {info.festival}</span>
        )}
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${className || ""}`}>
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
        <span>{info.paksha}</span>
        <span className="text-orange-600 dark:text-orange-300">{info.name}</span>
      </span>
      {info.festival && (
        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-300">
          {info.festival}
        </span>
      )}
    </div>
  );
}
