import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Calculator,
  HardHat,
  Bell,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
} from "lucide-react";
import type { TabId } from "./BottomNav";
import { listSites, type Site } from "@/lib/sites";

interface Props {
  onNavigate: (tab: TabId) => void;
}

type CashRow = { type: "income" | "expense"; amount: number; site_name: string | null };

const HINDI_DAYS = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HINDI_MONTHS = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const TITHI = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा/अमावस्या"];

function approxTithi(d: Date): string {
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
  const days = (d.getTime() - ref) / 86400000;
  const phase = ((days % 29.53) + 29.53) % 29.53;
  const paksha = phase < 14.765 ? "शुक्ल" : "कृष्ण";
  const idx = Math.floor((phase % 14.765) / (14.765 / 15));
  return `${paksha} ${TITHI[Math.min(idx, 14)]}`;
}

function greeting(h: number): string {
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  notes: string | null;
};

export default function HomePage({ onNavigate }: Props) {
  const [stats, setStats] = useState({ workers: 0, present: 0, absent: 0, half: 0, income: 0, expense: 0 });
  const [recent, setRecent] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Admin");

  const today = new Date();
  const dateStr = `${today.getDate()} ${HINDI_MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const dayStr = `${HINDI_DAYS[today.getDay()]} · ${EN_DAYS[today.getDay()]}`;
  const tithiStr = approxTithi(today);
  const todayISO = today.toISOString().slice(0, 10);

  useEffect(() => {
    loadStats();
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email;
      if (e) setName(e.split("@")[0]);
    });
  }, []);

  async function loadStats() {
    try {
      const [w, a, c, r] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("status").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount"),
        supabase
          .from("cashbook")
          .select("id,type,amount,category,date,notes")
          .order("date", { ascending: false })
          .limit(3),
      ]);
      const att = a.data || [];
      const cb = c.data || [];
      setStats({
        workers: w.count || 0,
        present: att.filter((x) => x.status === "Present").length,
        absent: att.filter((x) => x.status === "Absent").length,
        half: att.filter((x) => x.status === "Half-Day").length,
        income: cb.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0),
        expense: cb.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0),
      });
      setRecent((r.data || []) as Tx[]);
    } finally {
      setLoading(false);
    }
  }

  const balance = stats.income - stats.expense;
  const totalAtt = stats.present + stats.absent + stats.half;
  const pct = (n: number) => (totalAtt > 0 ? (n / totalAtt) * 100 : 0);
  const pPct = pct(stats.present);
  const aPct = pct(stats.absent);
  const hPct = pct(stats.half);

  // donut math (circumference = 2πr; r=42 -> ~263.89)
  const C = 2 * Math.PI * 42;
  const pLen = (pPct / 100) * C;
  const aLen = (aPct / 100) * C;
  const hLen = (hPct / 100) * C;

  const summaryCards = [
    { label: "कुल मजदूर", value: stats.workers, icon: Users, from: "from-blue-500", to: "to-blue-600" },
    { label: "आज हाजिरी", value: `${stats.present}/${stats.workers}`, icon: CalendarCheck, from: "from-emerald-500", to: "to-emerald-600" },
    { label: "कुल आय", value: `₹${stats.income.toLocaleString("hi-IN")}`, icon: TrendingUp, from: "from-amber-500", to: "to-orange-500" },
    { label: "कुल खर्च", value: `₹${stats.expense.toLocaleString("hi-IN")}`, icon: TrendingDown, from: "from-rose-500", to: "to-red-600" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl"
           style={{ background: "linear-gradient(135deg, hsl(220 90% 55%) 0%, hsl(260 70% 55%) 45%, hsl(25 90% 55%) 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-xs opacity-90">{greeting(today.getHours())}</div>
            <div className="text-xl font-bold capitalize">Namaste, {name} 👋</div>
            <div className="mt-3 inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              तिथि: {tithiStr}
            </div>
          </div>
          <button className="relative w-10 h-10 rounded-full bg-white/15 backdrop-blur grid place-items-center hover:bg-white/25 transition">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-400 ring-2 ring-white/30" />
          </button>
        </div>
        <div className="relative mt-4 flex items-end justify-between">
          <div>
            <div className="text-3xl font-extrabold leading-none">{today.getDate()} {HINDI_MONTHS[today.getMonth()]}</div>
            <div className="text-xs opacity-90 mt-1">{dayStr} · {today.getFullYear()}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Balance</div>
            <div className="text-2xl font-bold">₹{balance.toLocaleString("hi-IN")}</div>
          </div>
        </div>
      </div>

      {/* Horizontal scroll summary */}
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 w-max">
          {summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className={`min-w-[140px] rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br ${c.from} ${c.to} transition-transform hover:scale-[1.03]`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-xl font-bold leading-tight">{c.value}</div>
                <div className="text-[11px] opacity-90 mt-0.5">{c.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold">शॉर्टकट</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction icon={CalendarCheck} label="हाजिरी" sub="Mark Attendance" tone="primary" onClick={() => onNavigate("attendance")} />
          <QuickAction icon={Wallet} label="हिसाब जोड़ें" sub="Add Cash Entry" tone="accent" onClick={() => onNavigate("cashbook")} />
          <QuickAction icon={Calculator} label="कैलकुलेटर" sub="Open Calculator" tone="warning" onClick={() => onNavigate("bricks")} />
          <QuickAction icon={HardHat} label="ठेकेदार" sub="Contractor" tone="violet" onClick={() => onNavigate("contractors")} />
        </div>
      </div>

      {/* Attendance donut */}
      <Card className="rounded-2xl overflow-hidden border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Attendance Overview</h2>
            <button onClick={() => onNavigate("attendance")} className="text-xs text-primary font-medium flex items-center gap-0.5">
              View <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                {totalAtt > 0 && (
                  <>
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(145 60% 45%)" strokeWidth="10"
                            strokeDasharray={`${pLen} ${C}`} strokeDashoffset="0" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0 75% 55%)" strokeWidth="10"
                            strokeDasharray={`${aLen} ${C}`} strokeDashoffset={`${-pLen}`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(40 95% 55%)" strokeWidth="10"
                            strokeDasharray={`${hLen} ${C}`} strokeDashoffset={`${-(pLen + aLen)}`} strokeLinecap="round" />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <div className="text-2xl font-extrabold">{totalAtt || stats.workers}</div>
                  <div className="text-[10px] text-muted-foreground -mt-0.5">Total</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <LegendRow color="hsl(145 60% 45%)" label="Present" value={stats.present} pct={pPct} />
              <LegendRow color="hsl(0 75% 55%)" label="Absent" value={stats.absent} pct={aPct} />
              <LegendRow color="hsl(40 95% 55%)" label="Half Day" value={stats.half} pct={hPct} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cashbook preview */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">हाल के लेन-देन</h2>
            <button onClick={() => onNavigate("cashbook")} className="text-xs text-primary font-medium flex items-center gap-0.5">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">कोई एंट्री नहीं</div>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className={`w-10 h-10 rounded-xl grid place-items-center ${
                    t.type === "income" ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                  }`}>
                    {t.type === "income" ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{t.notes || (t.type === "income" ? "आय" : "खर्च")}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{t.category} · {t.date}</div>
                  </div>
                  <div className={`text-sm font-bold ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {t.type === "income" ? "+" : "−"}₹{t.amount.toLocaleString("hi-IN")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Calculator shortcuts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold">Calculator Shortcuts</h2>
        </div>
        <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-3 w-max">
            <CalcShortcut icon={Layers} label="Brick" sub="ईंट गणना" color="from-orange-500 to-red-500" onClick={() => onNavigate("bricks")} />
            <CalcShortcut icon={HardHat} label="Roof / RCC" sub="छत गणना" color="from-slate-600 to-slate-800" onClick={() => onNavigate("roof")} />
            <CalcShortcut icon={Calculator} label="Cement" sub="सीमेंट" color="from-blue-500 to-indigo-600" onClick={() => onNavigate("bricks")} />
            <CalcShortcut icon={Users} label="Workers" sub="मजदूर" color="from-emerald-500 to-teal-600" onClick={() => onNavigate("workers")} />
          </div>
        </div>
      </div>

      {/* Floating quick add */}
      <button
        onClick={() => onNavigate("cashbook")}
        aria-label="Quick add"
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full grid place-items-center text-white shadow-2xl active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, hsl(25 90% 55%), hsl(0 80% 55%))" }}
      >
        <Plus className="w-7 h-7" />
      </button>

      {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
    </div>
  );
}

function LegendRow({ color, label, value, pct }: { color: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, sub, tone, onClick,
}: {
  icon: any; label: string; sub: string; tone: "primary" | "accent" | "warning" | "violet"; onClick: () => void;
}) {
  const map: Record<string, string> = {
    primary: "from-blue-500 to-indigo-600",
    accent: "from-emerald-500 to-teal-600",
    warning: "from-amber-500 to-orange-600",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-4 text-left text-white shadow-md bg-gradient-to-br ${map[tone]} active:scale-[0.98] transition`}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 blur-xl" />
      <Icon className="w-6 h-6 mb-3 opacity-95" />
      <div className="text-sm font-bold">{label}</div>
      <div className="text-[11px] opacity-90">{sub}</div>
    </button>
  );
}

function CalcShortcut({
  icon: Icon, label, sub, color, onClick,
}: { icon: any; label: string; sub: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[120px] rounded-2xl p-4 text-left text-white shadow-md bg-gradient-to-br ${color} active:scale-[0.98] transition`}
    >
      <div className="w-9 h-9 rounded-xl bg-white/20 grid place-items-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm font-bold">{label}</div>
      <div className="text-[11px] opacity-90">{sub}</div>
    </button>
  );
}
