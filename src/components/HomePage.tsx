import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarCheck, TrendingUp, TrendingDown, Wallet, Plus, Calculator } from "lucide-react";
import type { TabId } from "./BottomNav";

interface Props {
  onNavigate: (tab: TabId) => void;
}

const HINDI_DAYS = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
const HINDI_MONTHS = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const TITHI = ["प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी", "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी", "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा/अमावस्या"];

function approxTithi(d: Date): string {
  // simple approximation based on lunar cycle (29.53 days). Reference new moon: 2000-01-06
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
  const days = (d.getTime() - ref) / 86400000;
  const phase = ((days % 29.53) + 29.53) % 29.53;
  const paksha = phase < 14.765 ? "शुक्ल" : "कृष्ण";
  const idx = Math.floor((phase % 14.765) / (14.765 / 15));
  return `${paksha} ${TITHI[Math.min(idx, 14)]}`;
}

export default function HomePage({ onNavigate }: Props) {
  const [stats, setStats] = useState({ workers: 0, present: 0, absent: 0, half: 0, income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const dateStr = `${today.getDate()} ${HINDI_MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const dayStr = HINDI_DAYS[today.getDay()];
  const tithiStr = approxTithi(today);
  const todayISO = today.toISOString().slice(0, 10);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [w, a, c] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("attendance").select("status").eq("date", todayISO),
        supabase.from("cashbook").select("type,amount"),
      ]);
      const att = a.data || [];
      const cb = c.data || [];
      setStats({
        workers: w.count || 0,
        present: att.filter((x) => x.status === "Present").length,
        absent: att.filter((x) => x.status === "Absent").length,
        half: att.filter((x) => x.status === "Half Day").length,
        income: cb.filter((x) => x.type === "income").reduce((s, x) => s + (x.amount || 0), 0),
        expense: cb.filter((x) => x.type === "expense").reduce((s, x) => s + (x.amount || 0), 0),
      });
    } finally {
      setLoading(false);
    }
  }

  const balance = stats.income - stats.expense;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Date card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
        <CardContent className="p-4">
          <div className="text-sm opacity-90">{dayStr}</div>
          <div className="text-2xl font-bold">{dateStr}</div>
          <div className="text-sm opacity-90 mt-1">तिथि: {tithiStr}</div>
        </CardContent>
      </Card>

      {/* Workers + Attendance */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="w-4 h-4" /> कुल मजदूर
            </div>
            <div className="text-3xl font-bold mt-1">{stats.workers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CalendarCheck className="w-4 h-4" /> आज हाजिरी
            </div>
            <div className="text-3xl font-bold mt-1 text-accent">{stats.present}</div>
            <div className="text-[11px] text-muted-foreground">
              अनुपस्थित: {stats.absent} · आधा: {stats.half}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cashbook summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <TrendingUp className="w-3 h-3" /> आय
            </div>
            <div className="text-lg font-bold text-accent">₹{stats.income.toLocaleString("hi-IN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <TrendingDown className="w-3 h-3" /> खर्च
            </div>
            <div className="text-lg font-bold text-destructive">₹{stats.expense.toLocaleString("hi-IN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
              <Wallet className="w-3 h-3" /> बैलेंस
            </div>
            <div className={`text-lg font-bold ${balance >= 0 ? "text-primary" : "text-destructive"}`}>
              ₹{balance.toLocaleString("hi-IN")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <div className="text-sm font-semibold mb-2">शॉर्टकट</div>
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="h-auto flex-col py-3 gap-1" onClick={() => onNavigate("attendance")}>
            <CalendarCheck className="w-5 h-5" />
            <span className="text-xs">हाजिरी</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col py-3 gap-1" onClick={() => onNavigate("cashbook")}>
            <Plus className="w-5 h-5" />
            <span className="text-xs">हिसाब</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col py-3 gap-1" onClick={() => onNavigate("bricks")}>
            <Calculator className="w-5 h-5" />
            <span className="text-xs">कैलकुलेटर</span>
          </Button>
        </div>
      </div>

      {loading && <div className="text-center text-xs text-muted-foreground">लोड हो रहा है...</div>}
    </div>
  );
}
