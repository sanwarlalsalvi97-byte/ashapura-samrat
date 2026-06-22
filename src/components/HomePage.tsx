import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calculator,
  ArrowRight,
  Building2,
  FileBarChart,
  ClipboardList,
  UserPlus,
  Briefcase,
  Sparkles,
} from "lucide-react";
import type { TabId } from "./BottomNav";
import { listSites, subscribeSites, getSitesVersion, type Site } from "@/lib/sites";
import { useSyncExternalStore } from "react";

interface Props {
  onNavigate: (tab: TabId) => void;
}

type CashRow = { type: "income" | "expense"; amount: number; site_name: string | null };
type AdvRow = { id: string; date: string; advance: number; worker_id: string; workers?: { name: string } | null };

function shortInr(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

const HINDI_DAYS = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const HINDI_MONTHS = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const TITHI = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा/अमावस्या"];

export function approxTithi(d: Date): { paksha: string; name: string; full: string } {
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
  const days = (d.getTime() - ref) / 86400000;
  const phase = ((days % 29.53) + 29.53) % 29.53;
  const paksha = phase < 14.765 ? "शुक्ल" : "कृष्ण";
  const idx = Math.floor((phase % 14.765) / (14.765 / 15));
  const name = TITHI[Math.min(idx, 14)];
  return { paksha, name, full: `${paksha} ${name}` };
}

export default function HomePage({ onNavigate }: Props) {
  const [stats, setStats] = useState({
    workers: 0, present: 0, absent: 0, half: 0,
    income: 0, expense: 0,
    contractors: 0, activeContractors: 0,
    totalAdvance: 0, advanceCount: 0, lastAdvanceDate: "" as string,
  });
  const [recentAdv, setRecentAdv] = useState<AdvRow[]>([]);
  const [allCash, setAllCash] = useState<CashRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState<Site[]>(() => listSites());
  useSyncExternalStore(
    (cb) => subscribeSites(() => { setSites(listSites()); cb(); }),
    getSitesVersion,
    getSitesVersion,
  );

  const today = new Date();
  const tithi = approxTithi(today);
  const todayISO = today.toISOString().slice(0, 10);

  useEffect(() => {
    loadStats();
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    const ch = supabase
      .channel("home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cashbook" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, loadStats)
      .subscribe();

    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      supabase.removeChannel(ch);
    };
  }, []);

  async function loadStats() {
    try {
      const [w, a, c, ct, advRecent, advAll] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("status").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount,site_name"),
        supabase.from("contractors").select("status"),
        supabase
          .from("attendance")
          .select("id,date,advance,worker_id, workers(name)")
          .gt("advance", 0)
          .order("date", { ascending: false })
          .limit(5),
        supabase
          .from("attendance")
          .select("advance,date")
          .gt("advance", 0)
          .order("date", { ascending: false }),
      ]);
      const att = a.data || [];
      const cb = (c.data || []) as CashRow[];
      const cts = (ct.data || []) as { status: string }[];
      const advs = (advRecent.data || []) as AdvRow[];
      const advAllRows = (advAll.data || []) as { advance: number; date: string }[];
      setAllCash(cb);
      setRecentAdv(advs);
      setStats({
        workers: w.count || 0,
        present: att.filter((x) => x.status === "Present").length,
        absent: att.filter((x) => x.status === "Absent").length,
        half: att.filter((x) => x.status === "Half-Day").length,
        income: cb.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0),
        expense: cb.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0),
        contractors: cts.length,
        activeContractors: cts.filter((x) => x.status === "चालू").length,
        totalAdvance: advAllRows.reduce((s, x) => s + (x.advance || 0), 0),
        advanceCount: advAllRows.length,
        lastAdvanceDate: advAllRows[0]?.date || "",
      });
    } finally {
      setLoading(false);
    }
  }

  const sitewise = useMemo(() => {
    const map = new Map<string, number>();
    const known = new Set(sites.map((s) => s.name));
    sites.forEach((s) => map.set(s.name, 0));
    allCash
      .filter((x) => x.type === "expense")
      .forEach((x) => {
        const k = (x.site_name || "").trim();
        if (!k || !known.has(k)) return;
        map.set(k, (map.get(k) || 0) + (x.amount || 0));
      });
    const rows = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
    rows.sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const max = Math.max(1, ...rows.map((r) => r.amount));
    return { rows, total, max };
  }, [allCash, sites]);

  const absentToday = Math.max(0, stats.workers - stats.present - stats.half);

  return (
    <div className="space-y-4 animate-fade-in pb-24 font-[Poppins,sans-serif]">
      {/* Date + Tithi card */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-5 text-center bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="text-xs font-semibold text-muted-foreground tracking-wide">आज की तारीख</div>
          <div className="text-5xl font-extrabold text-primary leading-none mt-2">{today.getDate()}</div>
          <div className="text-sm font-semibold mt-1">{HINDI_MONTHS[today.getMonth()]} {today.getFullYear()}</div>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1 text-xs">
              <span className="text-muted-foreground">वार</span>
              <span className="font-semibold">{HINDI_DAYS[today.getDay()]}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
              <Sparkles className="w-3 h-3" />
              {tithi.full}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 actions */}
      <div className="grid grid-cols-3 gap-2">
        <ActionChip icon={CalendarCheck} label="हाजिरी लगाएं" tone="emerald" onClick={() => onNavigate("attendance")} />
        <ActionChip icon={Wallet} label="हिसाब लिखें" tone="amber" onClick={() => onNavigate("cashbook")} />
        <ActionChip icon={Calculator} label="केलकुलेटर" tone="violet" onClick={() => onNavigate("bricks")} />
      </div>

      {/* Attendance stats */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">आज की हाजिरी</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{stats.workers} कुल मजदूर</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border/60 text-center">
            <div>
              <div className="text-2xl font-extrabold text-accent">{stats.present}</div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">हाजिर</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-warning">{stats.half}</div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">हाफ-डे</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-destructive">{absentToday}</div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">गैरहाजिर</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advance summary */}
      <button onClick={() => onNavigate("advance")} className="w-full text-left">
        <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition active:scale-[0.98]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">एडवांस सारांश</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-primary/10 rounded-xl p-2">
                <div className="text-base font-extrabold text-primary tabular-nums">₹{shortInr(stats.totalAdvance)}</div>
                <div className="text-[10px] text-muted-foreground">कुल एडवांस</div>
              </div>
              <div className="bg-muted/60 rounded-xl p-2">
                <div className="text-base font-extrabold tabular-nums">{stats.advanceCount}</div>
                <div className="text-[10px] text-muted-foreground">बार लिया</div>
              </div>
              <div className="bg-muted/60 rounded-xl p-2">
                <div className="text-[11px] font-bold tabular-nums leading-tight">{stats.lastAdvanceDate || "—"}</div>
                <div className="text-[10px] text-muted-foreground">आख़िरी</div>
              </div>
            </div>
            {recentAdv.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-2">कोई एडवांस नहीं</div>
            ) : (
              <ul className="space-y-1.5">
                {recentAdv.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="truncate pr-2">
                      <span className="font-semibold">{r.workers?.name || "—"}</span>
                      <span className="text-muted-foreground"> · {r.date}</span>
                    </span>
                    <span className="font-bold text-primary tabular-nums">₹{r.advance.toLocaleString("hi-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </button>

      {/* Site-wise expense → मासिक रिपोर्ट */}
      <button onClick={() => onNavigate("report")} className="w-full text-left">
        <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition active:scale-[0.98]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">साइट-वाइज खर्च</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                मासिक रिपोर्ट <ArrowRight className="w-3 h-3" />
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

      {/* Income / Expense quick */}
      <div className="grid grid-cols-2 gap-3">
        <MiniStat icon={TrendingUp} label="कुल आय" value={`₹${shortInr(stats.income)}`} tone="text-accent" />
        <MiniStat icon={TrendingDown} label="कुल खर्च" value={`₹${shortInr(stats.expense)}`} tone="text-destructive" />
      </div>

      {/* Contractor card */}
      <button onClick={() => onNavigate("contractors")} className="w-full text-left">
        <Card className="rounded-2xl border-border/60 hover:border-primary/40 transition active:scale-[0.98]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center text-white">
              <Briefcase className="w-5 h-5" />
            </div>
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

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <LinkTile icon={FileBarChart} label="मासिक रिपोर्ट" onClick={() => onNavigate("report")} />
        <LinkTile icon={UserPlus} label="मजदूर जोड़ें" onClick={() => onNavigate("workers")} />
        <LinkTile icon={Calculator} label="ईंट केलकुलेटर" onClick={() => onNavigate("bricks")} />
        <LinkTile icon={ClipboardList} label="ठेका प्रबंधन" onClick={() => onNavigate("contractors")} />
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
    </div>
  );
}

function ActionChip({ icon: Icon, label, tone, onClick }: { icon: any; label: string; tone: "emerald" | "amber" | "violet"; onClick: () => void }) {
  const map: Record<string, string> = {
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-orange-500",
    violet: "from-violet-500 to-purple-600",
  };
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border/60 p-3 flex flex-col items-center gap-1.5 shadow-sm active:scale-[0.96] transition"
    >
      <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${map[tone]} grid place-items-center text-white shadow-sm`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-[11px] font-semibold text-foreground text-center leading-tight">{label}</span>
    </button>
  );
}

function LinkTile({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border/60 p-4 flex items-center gap-3 shadow-sm active:scale-[0.96] transition text-left"
    >
      <span className="w-9 h-9 rounded-xl bg-primary/10 grid place-items-center text-primary">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="p-3 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground font-semibold">{label}</div>
          <div className={`text-base font-extrabold tabular-nums ${tone}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
