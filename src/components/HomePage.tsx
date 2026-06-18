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
import { listSites, subscribeSites, getSitesVersion, type Site } from "@/lib/sites";
import { useSyncExternalStore } from "react";

interface Props {
  onNavigate: (tab: TabId) => void;
}

type CashRow = { type: "income" | "expense"; amount: number; site_name: string | null };

function shortInr(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

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
  const [stats, setStats] = useState({ workers: 0, present: 0, absent: 0, half: 0, income: 0, expense: 0, contractors: 0, activeContractors: 0 });
  const [recent, setRecent] = useState<Tx[]>([]);
  const [allCash, setAllCash] = useState<CashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Admin");
  const [sites, setSites] = useState<Site[]>(() => listSites());
  // Live-subscribe: re-read sites instantly on any add/edit/delete (same tab or other tabs).
  useSyncExternalStore(
    (cb) => subscribeSites(() => { setSites(listSites()); cb(); }),
    getSitesVersion,
    getSitesVersion,
  );
  const [siteFilter, setSiteFilter] = useState<string>("__all__");
  const [locationFilter, setLocationFilter] = useState<string>("__all__");

  const today = new Date();
  const dateStr = `${today.getDate()} ${HINDI_MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const dayStr = `${HINDI_DAYS[today.getDay()]} · ${EN_DAYS[today.getDay()]}`;
  const tithiStr = approxTithi(today);
  const todayISO = today.toISOString().slice(0, 10);

  // Unique locations from sites
  const locations = useMemo(() => {
    const set = new Set<string>();
    sites.forEach((s) => { const l = (s.location || "").trim(); if (l) set.add(l); });
    return Array.from(set).sort();
  }, [sites]);

  useEffect(() => {
    loadStats();
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email;
      if (e) setName(e.split("@")[0]);
    });
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    // Live updates: refetch cashbook on any change
    const channel = supabase
      .channel("home-cashbook")
      .on("postgres_changes", { event: "*", schema: "public", table: "cashbook" }, () => loadStats())
      .subscribe();

    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      supabase.removeChannel(channel);
    };
  }, []);

  // Set of site names matching current location filter
  const sitesInLocation = useMemo(() => {
    if (locationFilter === "__all__") return null;
    return new Set(
      sites.filter((s) => (s.location || "").trim() === locationFilter).map((s) => s.name)
    );
  }, [locationFilter, sites]);

  // Recompute totals when filters change
  useEffect(() => {
    const filtered = allCash.filter((x) => {
      if (siteFilter !== "__all__" && (x.site_name || "") !== siteFilter) return false;
      if (sitesInLocation && !sitesInLocation.has(x.site_name || "")) return false;
      return true;
    });
    setStats((s) => ({
      ...s,
      income: filtered.filter((x) => x.type === "income").reduce((sum, x) => sum + (x.amount || 0), 0),
      expense: filtered.filter((x) => x.type === "expense").reduce((sum, x) => sum + (x.amount || 0), 0),
    }));
  }, [siteFilter, sitesInLocation, allCash]);


  async function loadStats() {
    try {
      const [w, a, c, r, ct] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("status").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount,site_name"),
        supabase
          .from("cashbook")
          .select("id,type,amount,category,date,notes")
          .order("date", { ascending: false })
          .limit(3),
        supabase.from("contractors").select("status"),
      ]);
      const att = a.data || [];
      const cb = (c.data || []) as CashRow[];
      const cts = (ct.data || []) as { status: string }[];
      setAllCash(cb);
      setStats({
        workers: w.count || 0,
        present: att.filter((x) => x.status === "Present").length,
        absent: att.filter((x) => x.status === "Absent").length,
        half: att.filter((x) => x.status === "Half-Day").length,
        income: cb.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0),
        expense: cb.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0),
        contractors: cts.length,
        activeContractors: cts.filter((x) => x.status === "चालू").length,
      });
      setRecent((r.data || []) as Tx[]);
    } finally {
      setLoading(false);
    }
  }

  // Per-site expense breakdown (respects location filter; always shows all known sites)
  const sitewise = useMemo(() => {
    const map = new Map<string, number>();
    const includedSites = sitesInLocation
      ? sites.filter((s) => sitesInLocation.has(s.name))
      : sites;
    const knownSet = new Set(includedSites.map((s) => s.name));
    includedSites.forEach((s) => map.set(s.name, 0));
    allCash
      .filter((x) => x.type === "expense")
      .forEach((x) => {
        const key = (x.site_name || "").trim();
        if (!key || !knownSet.has(key)) return;
        map.set(key, (map.get(key) || 0) + (x.amount || 0));
      });
    const rows = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
    rows.sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const max = Math.max(1, ...rows.map((r) => r.amount));
    return { rows, total, max };
  }, [allCash, sites, sitesInLocation]);



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
    <div className="space-y-4 animate-fade-in pb-6 font-[Poppins,sans-serif]">
      {/* Date card */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-5 text-center">
          <div className="text-xs font-semibold text-muted-foreground tracking-wide">आज की तारीख</div>
          <div className="text-5xl font-extrabold text-primary leading-none mt-2">{today.getDate()}</div>
          <div className="text-sm font-semibold mt-1">{HINDI_MONTHS[today.getMonth()]} {today.getFullYear()}</div>
          <div className="mt-3 inline-flex items-center gap-2 bg-muted/60 rounded-full px-3 py-1 text-xs">
            <span className="text-muted-foreground">वार</span>
            <span className="font-semibold">{HINDI_DAYS[today.getDay()]}</span>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 actions */}
      <div className="grid grid-cols-3 gap-2">
        <ActionChip emoji="📅" label="हाजिरी लगाएं" onClick={() => onNavigate("attendance")} />
        <ActionChip emoji="💰" label="हिसाब लिखें" onClick={() => onNavigate("cashbook")} />
        <ActionChip emoji="🧮" label="केलकुलेटर" onClick={() => onNavigate("bricks")} />
      </div>

      {/* Two info cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold">कुल मजदूर</div>
            <div className="text-3xl font-extrabold text-primary mt-1">{stats.workers}</div>
            <div className="text-[11px] text-accent font-semibold mt-1">सक्रिय</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/60">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold">आज हाजिर</div>
            <div className="text-3xl font-extrabold text-accent mt-1">{stats.present}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-1">{stats.half} हाफ-डे</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance stats row */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-4 grid grid-cols-3 divide-x divide-border/60 text-center">
          <div>
            <div className="text-2xl font-extrabold text-accent">{stats.present}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">हाजिर</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-warning">{stats.half}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">हाफ-डे</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-destructive">{Math.max(0, stats.workers - stats.present - stats.half)}</div>
            <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">गैरहाजिर</div>
          </div>
        </CardContent>
      </Card>

      {/* Site-wise expense chart → मासिक हिसाब */}
      <button
        onClick={() => onNavigate("report")}
        className="w-full text-left"
        aria-label="साइट-वाइज खर्च — मासिक हिसाब खोलें"
      >
        <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏗️</span>
                <span className="text-sm font-bold">साइट-वाइज खर्च</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                मासिक हिसाब <ArrowRight className="w-3 h-3" />
              </div>
            </div>
            {sitewise.rows.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-3">कोई साइट नहीं — सेटिंग्स से जोड़ें</div>
            ) : (
              <div className="space-y-2">
                {sitewise.rows.slice(0, 4).map((r) => (
                  <div key={r.name}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold truncate pr-2">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">₹{shortInr(r.amount)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        style={{ width: `${(r.amount / sitewise.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-[11px] pt-2 border-t border-border/60">
                  <span className="text-muted-foreground">कुल खर्च</span>
                  <span className="font-bold tabular-nums">₹{sitewise.total.toLocaleString("hi-IN")}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </button>

      {/* Contractor summary → ठेका प्रबंधन */}
      <button
        onClick={() => onNavigate("contractors")}
        className="w-full text-left"
        aria-label="ठेका प्रबंधन खोलें"
      >
        <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center text-white text-xl">📄</div>
            <div className="flex-1">
              <div className="text-sm font-bold">ठेका प्रबंधन</div>
              <div className="text-[11px] text-muted-foreground">
                {stats.contractors} कुल · <span className="text-accent font-semibold">{stats.activeContractors} चालू</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </button>

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-3">
        <LinkTile emoji="📈" label="मासिक हिसाब" onClick={() => onNavigate("report")} />
        <LinkTile emoji="👷" label="मजदूर जोड़ें" onClick={() => onNavigate("workers")} />
        <LinkTile emoji="🧮" label="ईंट केलकुलेटर" onClick={() => onNavigate("bricks")} />
        <LinkTile emoji="📄" label="ठेका प्रबंधन" onClick={() => onNavigate("contractors")} />
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
    </div>
  );
}

function ActionChip({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border/60 p-3 flex flex-col items-center gap-1 shadow-sm active:scale-[0.97] transition"
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

function LinkTile({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition text-left"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
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
