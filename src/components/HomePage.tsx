import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowRight,
  Building2,
  FileBarChart,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  ClipboardList,
  Briefcase,
  Clock,
} from "lucide-react";
import type { TabId } from "./BottomNav";
import { listSites, subscribeSites, getSitesVersion, type Site } from "@/lib/sites";
import { useSyncExternalStore } from "react";
import TithiBadge from "./TithiBadge";

interface Props {
  onNavigate: (tab: TabId) => void;
}

type CashRow = { type: "income" | "expense"; amount: number; date: string };
type AttRow = { worker_id: string; status: string; site_name: string | null; date: string };
type WorkerRow = { id: string; daily_rate: number | null };

const HINDI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];

function shortInr(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function monthBounds(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startISO: iso(start), endISO: iso(end) };
}

export default function HomePage({ onNavigate }: Props) {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const { startISO, endISO } = useMemo(
    () => monthBounds(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const [workersList, setWorkersList] = useState<WorkerRow[]>([]);
  const [monthAtt, setMonthAtt] = useState<AttRow[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttRow[]>([]);
  const [monthCash, setMonthCash] = useState<CashRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState<Site[]>(() => listSites());
  useSyncExternalStore(
    (cb) => subscribeSites(() => { setSites(listSites()); cb(); }),
    getSitesVersion,
    getSitesVersion,
  );

  useEffect(() => {
    load();
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    const ch = supabase
      .channel("home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cashbook" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "workers" }, load)
      .subscribe();
    return () => {
      window.removeEventListener("sites-updated", refresh);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO]);

  async function load() {
    try {
      const [w, mAtt, tAtt, cash] = await Promise.all([
        supabase.from("workers").select("id,daily_rate").eq("is_active", true),
        supabase.from("attendance").select("worker_id,status,site_name,date").gte("date", startISO).lte("date", endISO),
        supabase.from("attendance").select("worker_id,status,site_name,date").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount,date").gte("date", startISO).lte("date", endISO),
      ]);
      setWorkersList((w.data || []) as WorkerRow[]);
      setMonthAtt((mAtt.data || []) as AttRow[]);
      setTodayAtt((tAtt.data || []) as AttRow[]);
      setMonthCash((cash.data || []) as CashRow[]);
    } finally {
      setLoading(false);
    }
  }

  // Summary numbers
  const income = monthCash.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0);
  const expense = monthCash.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0);
  const balance = income - expense;

  const presentToday = todayAtt.filter((x) => x.status === "Present").length;
  const halfToday = todayAtt.filter((x) => x.status === "Half-Day").length;
  const absentToday = Math.max(0, workersList.length - presentToday - halfToday);

  // Site-wise wages from attendance ONLY
  const sitewise = useMemo(() => {
    const wageOf = new Map<string, number>();
    workersList.forEach((w) => wageOf.set(w.id, w.daily_rate || 0));
    const known = new Set(sites.map((s) => s.name));
    const map = new Map<string, number>();
    sites.forEach((s) => map.set(s.name, 0));
    monthAtt.forEach((row) => {
      const site = (row.site_name || "").trim();
      if (!site || !known.has(site)) return;
      const wage = wageOf.get(row.worker_id) || 0;
      const w = row.status === "Present" ? 1 : row.status === "Half-Day" ? 0.5 : 0;
      if (w > 0) map.set(site, (map.get(site) || 0) + wage * w);
    });
    const rows = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
    rows.sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const max = Math.max(1, ...rows.map((r) => r.amount));
    return { rows, total, max };
  }, [monthAtt, workersList, sites]);

  const goPrevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {/* Month selector */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border/60 px-3 py-2.5 shadow-sm">
        <button
          onClick={goPrevMonth}
          className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95 transition"
          aria-label="पिछला महीना"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-[11px] text-muted-foreground font-semibold">महीना</div>
          <div className="text-base font-extrabold tracking-tight">
            {HINDI_MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
        </div>
        <button
          onClick={goNextMonth}
          className="w-9 h-9 rounded-xl grid place-items-center hover:bg-muted active:scale-95 transition"
          aria-label="अगला महीना"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Today's Tithi */}
      <div className="flex items-center justify-between bg-card rounded-2xl border border-border/60 px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground font-semibold">आज की तिथि</div>
          <div className="text-sm font-extrabold">
            {today.toLocaleDateString("hi-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
        <TithiBadge date={today} />
      </div>


      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          tone="green"
          icon={TrendingUp}
          label="कुल आय"
          value={`₹${shortInr(income)}`}
        />
        <SummaryCard
          tone="red"
          icon={TrendingDown}
          label="कुल खर्च"
          value={`₹${shortInr(expense)}`}
        />
        <SummaryCard
          tone="blue"
          icon={Wallet}
          label="कुल बैलेंस"
          value={`₹${shortInr(balance)}`}
        />
        <SummaryCard
          tone="orange"
          icon={Users}
          label="कुल मजदूर"
          value={String(workersList.length)}
        />
      </div>

      {/* Site-wise मजदूरी खर्च (from attendance only) */}
      <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-extrabold">साइट-वाइज मजदूरी खर्च</h2>
          </div>
          <button
            onClick={() => onNavigate("report")}
            className="text-[11px] font-semibold text-primary flex items-center gap-1"
          >
            रिपोर्ट <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {sitewise.rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            कोई साइट नहीं — सेटिंग्स से जोड़ें
          </div>
        ) : (
          <div className="space-y-3">
            {sitewise.rows.map((r) => (
              <div key={r.name}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="min-w-0 pr-2">
                    <div className="text-sm font-bold truncate">{r.name}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      उपस्थित मजदूरी खर्च
                    </div>
                  </div>
                  <div className="text-lg font-extrabold tabular-nums">
                    ₹{r.amount.toLocaleString("hi-IN")}
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all"
                    style={{ width: `${(r.amount / sitewise.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between items-baseline pt-3 mt-1 border-t border-border/60">
              <span className="text-xs font-bold text-muted-foreground">कुल मजदूरी खर्च</span>
              <span className="text-lg font-extrabold tabular-nums text-primary">
                ₹{sitewise.total.toLocaleString("hi-IN")}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Today's attendance */}
      <section className="bg-card rounded-2xl border border-border/60 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            <h2 className="text-base font-extrabold">आज की हाजिरी</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">{workersList.length} कुल</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <AttStat tone="green" label="P" value={presentToday} />
          <AttStat tone="red" label="A" value={absentToday} />
          <AttStat tone="yellow" label="HD" value={halfToday} />
          <AttStat tone="purple" label="OT" value={0} suffix="h" icon={Clock} />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-extrabold mb-3 px-1">त्वरित कार्य</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={UserPlus} label="मजदूर जोड़ें" onClick={() => onNavigate("workers")} tone="orange" />
          <QuickAction icon={CalendarCheck} label="हाजिरी दर्ज करें" onClick={() => onNavigate("attendance")} tone="green" />
          <QuickAction icon={Plus} label="खर्च जोड़ें" onClick={() => onNavigate("cashbook")} tone="red" />
          <QuickAction icon={FileBarChart} label="रिपोर्ट देखें" onClick={() => onNavigate("report")} tone="blue" />
          <QuickAction icon={ClipboardList} label="मासिक रिपोर्ट" onClick={() => onNavigate("report")} tone="purple" />
          <QuickAction icon={Briefcase} label="ठेका" onClick={() => onNavigate("contractors")} tone="violet" />
          <QuickAction icon={Building2} label="साइट प्रबंधन" onClick={() => onNavigate("sites")} tone="orange" />
          <QuickAction icon={HardHat} label="छत / RCC" onClick={() => onNavigate("roof")} tone="blue" />
        </div>
      </section>

      {loading && (
        <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>
      )}
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

type Tone = "green" | "red" | "blue" | "orange" | "yellow" | "purple" | "violet";

const TONE_BG: Record<Tone, string> = {
  green: "from-emerald-500 to-green-600",
  red: "from-rose-500 to-red-600",
  blue: "from-sky-500 to-blue-600",
  orange: "from-amber-500 to-orange-600",
  yellow: "from-yellow-400 to-amber-500",
  purple: "from-fuchsia-500 to-purple-600",
  violet: "from-violet-500 to-indigo-600",
};

const TONE_SOFT: Record<Tone, string> = {
  green: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
  red: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
  blue: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300",
  orange: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  yellow: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300",
  purple: "bg-fuchsia-50 dark:bg-fuchsia-950/30 text-fuchsia-700 dark:text-fuchsia-300",
  violet: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300",
};

function SummaryCard({
  tone, icon: Icon, label, value,
}: { tone: Tone; icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} grid place-items-center text-white shadow-sm`}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <div className="text-xl font-extrabold tabular-nums tracking-tight leading-tight">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function AttStat({
  tone, label, value, suffix, icon: Icon,
}: { tone: Tone; label: string; value: number; suffix?: string; icon?: any }) {
  return (
    <div className={`rounded-2xl ${TONE_SOFT[tone]} p-3 text-center`}>
      <div className="text-xl font-extrabold tabular-nums leading-none">
        {String(value).padStart(2, "0")}{suffix || ""}
      </div>
      <div className="text-[11px] font-bold mt-1 flex items-center justify-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, onClick, tone,
}: { icon: any; label: string; onClick: () => void; tone: Tone }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 shadow-sm active:scale-[0.96] transition text-left"
    >
      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} grid place-items-center text-white shadow-sm shrink-0`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-sm font-bold leading-tight">{label}</span>
    </button>
  );
}
