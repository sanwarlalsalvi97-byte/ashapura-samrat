import { useState } from "react";
import { type Worker, type AttendanceStatus } from "@/lib/supabase-helpers";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  worker: Worker;
  date: string;
  currentStatus?: AttendanceStatus;
  currentAdvance?: number;
  onMarked: () => void;
  onSelectionChange?: (workerId: string, status: AttendanceStatus | undefined) => void;
}

const ORDER: AttendanceStatus[] = ["Present", "Absent", "Half-Day"];
const PILL: Record<string, { label: string; bg: string }> = {
  Present: { label: "P", bg: "bg-emerald-500" },
  Absent: { label: "A", bg: "bg-rose-500" },
  "Half-Day": { label: "HD", bg: "bg-amber-500" },
};

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function AttendanceCard({ worker, currentStatus, onSelectionChange }: Props) {
  const [sel, setSel] = useState<AttendanceStatus | undefined>(currentStatus);

  const cycle = () => {
    const cur = sel || currentStatus;
    const idx = cur ? ORDER.indexOf(cur) : -1;
    const next = ORDER[(idx + 1) % ORDER.length];
    setSel(next);
    onSelectionChange?.(worker.id, next);
  };

  const shown = sel || currentStatus;
  const pill = shown ? PILL[shown] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-card border border-border/60 shadow-sm"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 dark:from-orange-700 dark:to-orange-900 grid place-items-center text-white text-sm font-bold shrink-0">
        {initials(worker.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{worker.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{worker.role}</div>
      </div>
      <button
        onClick={cycle}
        className={`w-14 h-9 rounded-lg text-white text-sm font-bold grid place-items-center shadow active:scale-95 transition ${
          pill ? pill.bg : "bg-muted text-muted-foreground"
        }`}
        aria-label="Toggle status"
      >
        {pill ? pill.label : "—"}
      </button>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </motion.div>
  );
}
