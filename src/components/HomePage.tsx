import { toISODate } from "@/lib/date-utils";
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
  HardHat,
} from "lucide-react";
import type { TabId } from "./BottomNav";
import { listSites, subscribeSites, getSitesVersion, type Site } from "@/lib/sites";
import { useSyncExternalStore } from "react";
import TithiBadge from "./TithiBadge";
import { computeWorkerPayments } from "@/lib/payment-engine";

interface Props {
  onNavigate: (tab: TabId) => void;
}

type CashRow = { type: "income" | "expense"; amount: number; date: string };
type AttRow = { worker_id: string; status: string; site_name: string | null; date: string };
type WorkerRow = { id: string; name?: string | null; daily_rate: number | null };
type AdvRow = { advance: number };
type ExpRow = { amount: number };
type PayRow = { amount: number };

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
  const iso = (d: Date) => toISODate(d);
  return { startISO: iso(start), endISO: iso(end) };
}

export default function HomePage({ onNavigate }: Props) {
  const today = new Date();
  const todayISO = toISODate(today);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const { startISO, endISO } = useMemo(
    () => monthBounds(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );

  const [workersList, setWorkersList] = useState<WorkerRow[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttRow[]>([]);
  const [monthCash, setMonthCash] = useState<CashRow[]>([]);
  const [advances, setAdvances] = useState<AdvRow[]>([]);
  const [monthExp, setMonthExp] = useState<ExpRow[]>([]);
  const [monthPay, setMonthPay] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [, setSites] = useState<Site[]>(() => listSites());
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
      .on("postgres_changes", { event: "*", schema: "public", table: "worker_expenses" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_history" }, load)
      .subscribe();
    return () => {
      window.removeEventListener("sites-updated", refresh);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO]);

  async function load() {
    try {
      const [w, tAtt, cash, adv, exp, pay] = await Promise.all([
        supabase.from("workers").select("id,name,daily_rate").eq("is_active", true),
        supabase.from("attendance").select("worker_id,status,site_name,date").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount,date").gte("date", startISO).lte("date", endISO),
        supabase.from("attendance").select("advance").gte("date", startISO).lte("date", endISO).gt("advance", 0),
        supabase.from("worker_expenses").select("amount").gte("date", startISO).lte("date", endISO),
        supabase.from("payment_history").select("amount").gte("payment_date", startISO).lte("payment_date", endISO),
      ]);
      setWorkersList((w.data || []) as WorkerRow[]);
      setTodayAtt((tAtt.data || []) as AttRow[]);
      setMonthCash((cash.data || []) as CashRow[]);
      setAdvances((adv.data || []) as AdvRow[]);
      setMonthExp((exp.data || []) as ExpRow[]);
      setMonthPay((pay.data || []) as PayRow[]);
    } finally {
      setLoading(false);
    }
  }

  const totalAdvance = advances.reduce((s, a) => s + (a.advance || 0), 0);
  const advanceCount = advances.length;

  // Summary numbers — logic unchanged
  const income = monthCash.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0);
  const cashbookExpense = monthCash.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0);
  const totalWorkerExp = monthExp.reduce((s, x) => s + (x.amount || 0), 0);
  const totalSalaryPaid = monthPay.reduce((s, x) => s + (x.amount || 0), 0);
  const expense = cashbookExpense + totalWorkerExp + totalSalaryPaid;
  const balance = income - expense;

  const presentToday = todayAtt.filter((x) => x.status === "Present").length;
  const halfToday = todayAtt.filter((x) => x.status === "Half-Day").length;
  const absentToday = Math.max(0, workersList.length - presentToday - halfToday);

  const [pendingOutstanding, setPendingOutstanding] = useState(0);
  useEffect(() => {
    let alive = true;
    computeWorkerPayments({ startISO, endISO }).then((res) => {
      if (!alive) return;
      setPendingOutstanding(res.totals.outstanding);
    });
    return () => { alive = false; };
  }, [startISO, endISO, advances, monthExp, monthPay, workersList]);

  const goPrevMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNextMonth = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));

  return (
    <div className="space-y-3 animate-fade-in pb-24">
      {/* Month + Tithi combined compact bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-between bg-card rounded-[20px] border border-border/60 px-2 py-2 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]">
          <button
            onClick={goPrevMonth}
            className="w-8 h-8 rounded-xl grid place-items-center hover:bg-muted active:scale-95 transition"
            aria-label="पिछला महीना"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center leading-tight">
            <div className="text-[10px] text-muted-foreground font-semibold">महीना</div>
            <div className="text-sm font-extrabold tracking-tight">
              {HINDI_MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
          </div>
          <button
            onClick={goNextMonth}
            className="w-8 h-8 rounded-xl grid place-items-center hover:bg-muted active:scale-95 transition"
            aria-label="अगला महीना"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-card rounded-[20px] border border-border/60 px-3 py-2 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)] flex items-center gap-2">
          <div className="leading-tight">
            <div className="text-[10px] text-muted-foreground font-semibold">आज</div>
            <div className="text-xs font-extrabold">
              {today.toLocaleDateString("hi-IN", { day: "numeric", month: "short" })}
            </div>
          </div>
          <TithiBadge date={today} />
        </div>
      </div>

      {/* Summary Cards: Income, Expense, Balance, Workers */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard tone="green" icon={TrendingUp} label="कुल आय" value={`₹${shortInr(income)}`} />
        <SummaryCard tone="red" icon={TrendingDown} label="कुल खर्च" value={`₹${shortInr(expense)}`} />
        <SummaryCard tone="blue" icon={Wallet} label="कुल बैलेंस" value={`₹${shortInr(balance)}`} />
        <SummaryCard tone="orange" icon={Users} label="कुल मजदूर" value={String(workersList.length)} />
      </div>

      {/* Today's attendance */}
      <section className="bg-card rounded-[20px] border border-border/60 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)] p-3">
        <div className="flex items-center justify-between mb-2">
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

      {/* Advance compact card */}
      <button
        onClick={() => onNavigate("advance")}
        className="w-full text-left bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-[20px] border border-orange-200/70 dark:border-orange-900/40 p-3 shadow-[0_4px_14px_-6px_rgba(234,88,12,0.35)] active:scale-[0.99] transition"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white shadow-sm">
              <Wallet className="w-4 h-4" />
            </span>
            <h2 className="text-base font-extrabold text-orange-800 dark:text-orange-200">कुल एडवांस दिया</h2>
          </div>
          <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300 flex items-center gap-0.5">
            सब देखें <ArrowRight className="w-3 h-3" />
          </span>
        </div>
        <div className="text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-300 leading-tight">
          ₹{totalAdvance.toLocaleString("hi-IN")}
        </div>
        <div className="text-[11px] font-semibold text-orange-700/80 dark:text-orange-400/80 mt-0.5">
          {advanceCount} बार एडवांस दिया गया
        </div>
      </button>

      {/* Pending Payments compact CTA */}
      <button
        onClick={() => onNavigate("pending")}
        className="w-full flex items-center gap-3 rounded-[20px] border border-orange-300/70 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 px-3 py-3 shadow-[0_4px_14px_-6px_rgba(234,88,12,0.35)] active:scale-[0.98] transition text-left"
      >
        <span className="w-10 h-10 rounded-2xl bg-white dark:bg-orange-950/40 grid place-items-center text-orange-600 text-xl font-extrabold shadow-sm shrink-0">
          ₹
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-base font-extrabold text-orange-700 dark:text-orange-300 leading-tight">पेमेंट बाकी</span>
          <span className="block text-xs font-semibold text-orange-600/80 dark:text-orange-400/80 tabular-nums">
            ₹{pendingOutstanding.toLocaleString("hi-IN")} बकाया
          </span>
        </span>
        <ArrowRight className="w-5 h-5 text-orange-600 shrink-0" />
      </button>
      <button
        onClick={() => onNavigate("pending")}
        className="w-full text-center text-xs font-bold text-primary py-1 -mt-1"
      >
        सभी पेमेंट बाकी देखें →
      </button>

      {/* Quick actions */}
      <section>
        <h2 className="text-base font-extrabold mb-2 px-1">त्वरित कार्य</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={Wallet} label="एडवांस" onClick={() => onNavigate("advance")} tone="orange" />
          <QuickAction icon={CalendarCheck} label="हाजिरी" onClick={() => onNavigate("attendance")} tone="green" />
          <QuickAction icon={UserPlus} label="मजदूर जोड़ें" onClick={() => onNavigate("workers")} tone="violet" />
          <QuickAction icon={Plus} label="खर्च जोड़ें" onClick={() => onNavigate("cashbook")} tone="red" />
          <QuickAction icon={FileBarChart} label="रिपोर्ट" onClick={() => onNavigate("report")} tone="blue" />
          <QuickAction icon={ClipboardList} label="भुगतान इतिहास" onClick={() => onNavigate("payment_history")} tone="green" />
          <QuickAction icon={Building2} label="साइट प्रबंधन" onClick={() => onNavigate("sites")} tone="orange" />
          <QuickAction icon={HardHat} label="छत / RCC" onClick={() => onNavigate("roof")} tone="blue" />
          <QuickAction icon={Briefcase} label="ठेका" onClick={() => onNavigate("contractors")} tone="purple" />
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
    <div className="rounded-[20px] bg-card border border-border/60 p-3 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between mb-1">
        <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} grid place-items-center text-white shadow-sm`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-lg font-extrabold tabular-nums tracking-tight leading-tight">{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function AttStat({
  tone, label, value, suffix, icon: Icon,
}: { tone: Tone; label: string; value: number; suffix?: string; icon?: any }) {
  return (
    <div className={`rounded-2xl ${TONE_SOFT[tone]} p-2.5 text-center`}>
      <div className="text-lg font-extrabold tabular-nums leading-none">
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
      className="rounded-[20px] bg-card border border-border/60 p-3 flex items-center gap-3 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.12)] active:scale-[0.96] transition text-left"
    >
      <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${TONE_BG[tone]} grid place-items-center text-white shadow-sm shrink-0`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-sm font-bold leading-tight">{label}</span>
    </button>
  );
}
