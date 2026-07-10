import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Shield,
  Zap,
  Headphones,
  RefreshCw,
  ArrowLeft,
  Sparkles,
  Star,
  Leaf,
  Rocket,
  Crown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { TabId } from "./BottomNav";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

type PlanId = "basic" | "standard" | "pro";
type Cycle = "monthly" | "yearly";

type Plan = {
  id: PlanId;
  name: string;
  tag: string;
  monthly: number;
  Icon: typeof Leaf;
  iconWrap: string;
  accent: string; // text color
  chipBg: string;
  gradient: string; // card background gradient
  ringColor: string;
  btnClass: string;
  popular?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    tag: "छोटे ठेकेदार के लिए",
    monthly: 49,
    Icon: Leaf,
    iconWrap: "bg-gradient-to-br from-emerald-400 to-green-600",
    accent: "text-emerald-600",
    chipBg: "bg-emerald-500/10",
    gradient:
      "bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(236,253,245,0.7))] dark:bg-[linear-gradient(135deg,rgba(20,45,35,0.65),rgba(15,25,22,0.55))]",
    ringColor: "ring-emerald-200/60 dark:ring-emerald-900/40",
    btnClass:
      "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-95 shadow-lg shadow-emerald-500/25",
    features: [
      "50 मजदूर",
      "हाजिरी",
      "कैशबुक",
      "मासिक रिपोर्ट",
      "बेसिक बैकअप",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    tag: "ज़्यादातर के लिए बेस्ट",
    monthly: 99,
    Icon: Rocket,
    iconWrap: "bg-gradient-to-br from-sky-400 to-blue-600",
    accent: "text-blue-600",
    chipBg: "bg-blue-500/10",
    gradient:
      "bg-[linear-gradient(135deg,rgba(219,234,254,0.9),rgba(255,255,255,0.75))] dark:bg-[linear-gradient(135deg,rgba(20,35,60,0.7),rgba(15,20,30,0.6))]",
    ringColor: "ring-blue-300/70 dark:ring-blue-800/60",
    btnClass:
      "bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white hover:opacity-95 shadow-lg shadow-blue-500/30",
    popular: true,
    features: [
      "Unlimited मजदूर",
      "एडवांस मैनेजमेंट",
      "ओवरटाइम",
      "साइट अनुसार रिपोर्ट",
      "PDF / Excel Export",
      "ऑटो बैकअप",
      "प्राथमिक सहायता",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tag: "बड़ी टीम और मल्टी-साइट",
    monthly: 199,
    Icon: Crown,
    iconWrap: "bg-gradient-to-br from-fuchsia-500 to-violet-600",
    accent: "text-violet-600",
    chipBg: "bg-violet-500/10",
    gradient:
      "bg-[linear-gradient(135deg,rgba(243,232,255,0.9),rgba(255,255,255,0.75))] dark:bg-[linear-gradient(135deg,rgba(45,25,60,0.7),rgba(20,15,30,0.6))]",
    ringColor: "ring-violet-300/70 dark:ring-violet-800/60",
    btnClass:
      "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-95 shadow-lg shadow-violet-500/30",
    features: [
      "Standard के सभी फीचर्स",
      "मल्टी-साइट मैनेजमेंट",
      "टीम अकाउंट",
      "क्लाउड सिंक",
      "रियल-टाइम डैशबोर्ड",
      "Play Store Priority Support",
      "भविष्य के सभी Premium फीचर्स",
    ],
  },
];

const BENEFITS = [
  { Icon: Shield, title: "सुरक्षित डेटा", sub: "एन्क्रिप्टेड बैकअप", color: "from-emerald-400 to-green-600" },
  { Icon: Zap, title: "तेज़ प्रदर्शन", sub: "ऑफलाइन-फर्स्ट", color: "from-amber-400 to-orange-500" },
  { Icon: Headphones, title: "24×7 सहायता", sub: "जब भी ज़रूरत हो", color: "from-sky-400 to-blue-600" },
  { Icon: RefreshCw, title: "कभी भी बदलें", sub: "अपग्रेड / डाउनग्रेड", color: "from-fuchsia-500 to-violet-600" },
];

function formatPrice(monthly: number, cycle: Cycle) {
  if (cycle === "monthly") return { amount: monthly, unit: "/माह", sub: null as string | null };
  // 20% off on yearly (2 months free vibe)
  const yearly = Math.round(monthly * 12 * 0.8);
  const perMonth = Math.round(yearly / 12);
  return { amount: perMonth, unit: "/माह", sub: `₹${yearly}/साल — 20% बचत` };
}

export default function SubscriptionPage({ onNavigate }: Props) {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const choose = (p: Plan) => {
    const price = formatPrice(p.monthly, cycle);
    toast({
      title: `${p.name} प्लान चुना`,
      description: `₹${price.amount}${price.unit}${price.sub ? ` • ${price.sub}` : ""} — पेमेंट सेटअप जल्द ही।`,
    });
  };

  return (
    <div className="relative pb-10 animate-fade-in">
      {/* Ambient background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-blue-400/25 blur-3xl" />
        <div className="absolute top-40 -right-20 w-72 h-72 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => onNavigate?.("settings")}
          className="flex items-center gap-2 text-sm font-semibold rounded-full px-3 py-1.5 bg-white/60 dark:bg-white/5 backdrop-blur border border-white/40 dark:border-white/10 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> वापस
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground rounded-full px-3 py-1.5 bg-white/60 dark:bg-white/5 backdrop-blur border border-white/40 dark:border-white/10">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Ashapura Samrat
        </div>
      </div>

      {/* Hero */}
      <div className="mt-5 text-center px-1">
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
          सरल प्लान,<br />शक्तिशाली फीचर्स
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          अपने मजदूर, हाजिरी, कैशबुक और रिपोर्ट को प्रोफेशनल तरीके से मैनेज करें।
        </p>
      </div>

      {/* Cycle toggle */}
      <div className="mt-5 flex justify-center">
        <div className="relative inline-flex items-center p-1 rounded-full bg-white/60 dark:bg-white/5 backdrop-blur border border-white/50 dark:border-white/10 shadow-sm">
          {(["monthly", "yearly"] as Cycle[]).map((c) => {
            const active = cycle === c;
            return (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`relative z-10 px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                  active ? "text-white" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-md shadow-blue-500/30 animate-scale-in" />
                )}
                {c === "monthly" ? "मासिक" : "वार्षिक"}
                {c === "yearly" && (
                  <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-emerald-500/15 text-emerald-600"}`}>
                    -20%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plans */}
      <div className="mt-6 space-y-5">
        {PLANS.map((p, i) => {
          const price = formatPrice(p.monthly, cycle);
          const Icon = p.Icon;
          return (
            <div
              key={p.id}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`relative rounded-3xl border border-white/50 dark:border-white/10 backdrop-blur-xl ${p.gradient} ${
                p.popular ? `ring-2 ${p.ringColor} shadow-2xl shadow-blue-500/10` : "shadow-xl shadow-black/5"
              } p-5 animate-fade-in transition-transform hover:-translate-y-0.5`}
            >
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg shadow-orange-500/30">
                    <Star className="w-3 h-3 fill-white" /> सबसे लोकप्रिय
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 shadow-lg ${p.iconWrap}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h2 className={`text-lg font-extrabold ${p.accent}`}>{p.name}</h2>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.chipBg} ${p.accent}`}>Plan</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{p.tag}</p>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-[13px] font-bold text-muted-foreground mb-1">₹</span>
                <span className={`text-5xl font-extrabold leading-none ${p.accent} tracking-tight`}>
                  {price.amount}
                </span>
                <span className="text-sm text-muted-foreground mb-1">{price.unit}</span>
              </div>
              {price.sub && (
                <div className="mt-1 text-[11px] font-semibold text-emerald-600">{price.sub}</div>
              )}

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent" />

              <ul className="space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 grid place-items-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                    </span>
                    <span className="text-foreground/90">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => choose(p)}
                className={`w-full mt-5 h-11 rounded-2xl font-bold text-[14px] ${p.btnClass}`}
              >
                {p.popular ? "अभी शुरू करें" : `${p.name} चुनें`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Benefits */}
      <div className="mt-8">
        <h3 className="text-sm font-bold text-center mb-3">क्यों चुनें Ashapura Samrat?</h3>
        <div className="grid grid-cols-2 gap-3">
          {BENEFITS.map((b) => {
            const Icon = b.Icon;
            return (
              <div
                key={b.title}
                className="rounded-2xl p-3 border border-white/50 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-sm flex items-start gap-2.5"
              >
                <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-gradient-to-br ${b.color} shadow-md`}>
                  <Icon className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold truncate">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{b.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secure footer */}
      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Shield className="w-3.5 h-3.5" /> 100% सुरक्षित भुगतान • कभी भी रद्द करें
      </div>

      <button className="mt-3 w-full text-center text-sm text-primary font-semibold py-2">
        ↻ Restore Purchase
      </button>
    </div>
  );
}
