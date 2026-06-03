import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Shield, Lock, Cloud, FileDown, Wifi, Bell, Sparkles, HardHat, Headphones, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { TabId } from "./BottomNav";

interface Props { onNavigate?: (tab: TabId) => void }

type Plan = {
  id: "basic" | "pro" | "premium";
  name: string;
  tag: string;
  price: number;
  color: string;
  ring: string;
  btn: string;
  popular?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "basic", name: "Basic Plan", tag: "छोटे ठेकेदार और शुरुआत के लिए", price: 99,
    color: "text-blue-600", ring: "ring-blue-200 dark:ring-blue-900", btn: "border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950",
    features: ["Unlimited Workers", "Daily Attendance", "Cashbook (Full)", "Basic Reports", "Calculator Tools", "5 PDF Export / माह"],
  },
  {
    id: "pro", name: "Pro Plan", tag: "ज़्यादातर ठेकेदारों के लिए बेस्ट", price: 199, popular: true,
    color: "text-orange-600", ring: "ring-2 ring-orange-400", btn: "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:opacity-95",
    features: ["सब कुछ Basic में शामिल", "Salary Auto Calculation", "Advance & Balance Tracking", "PDF Reports (Unlimited)", "Backup & Restore", "Multi-language Support", "Priority Support"],
  },
  {
    id: "premium", name: "Premium Plan", tag: "बड़े प्रोजेक्ट और टीम के लिए", price: 499,
    color: "text-violet-600", ring: "ring-violet-200 dark:ring-violet-900", btn: "border-violet-500 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950",
    features: ["सब कुछ Pro में शामिल", "Multi-user Access", "Contractor Management", "Advanced Reports & Analytics", "Cloud Backup (Auto)", "Team Attendance", "Priority Support (24x7)"],
  },
];

const PAY_METHODS = [
  { label: "Any UPI App", sub: "UPI" },
  { label: "PhonePe", sub: "" },
  { label: "Google Pay", sub: "" },
  { label: "Paytm", sub: "" },
  { label: "Debit / Credit Card", sub: "CARD" },
];

export default function SubscriptionPage({ onNavigate }: Props) {
  const choose = (p: Plan) => {
    toast({ title: `${p.name} चुना`, description: `₹${p.price}/माह — पेमेंट सेटअप जल्द ही।` });
  };

  return (
    <div className="space-y-5 pb-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => onNavigate?.("settings")} className="flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="w-5 h-5" /> Subscription
        </button>
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Headphones className="w-4 h-4" /> सहायता
        </button>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-xl"
           style={{ background: "linear-gradient(135deg, hsl(220 80% 35%) 0%, hsl(225 70% 45%) 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="flex items-start gap-3 relative">
          <div className="w-16 h-16 rounded-2xl bg-white/95 grid place-items-center shrink-0 shadow-lg">
            <HardHat className="w-9 h-9 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">
              Smart Attendance &<br />
              <span className="text-orange-300">Construction Manager</span>
            </h1>
            <p className="text-xs mt-1 opacity-90">आसानी से करें हाजिरी, हिसाब और मैनेजमेंट</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["Attendance", "Cashbook", "Calculator"].map((c) => (
                <span key={c} className="text-[10px] bg-white/15 backdrop-blur rounded-full px-2.5 py-1 font-medium">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2 font-bold">
          <Sparkles className="w-4 h-4 text-orange-500" />
          आपका काम, हमारी ज़िम्मेदारी
          <Sparkles className="w-4 h-4 text-orange-500" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">अपना प्लान चुनें और सभी प्रीमियम फीचर्स का लाभ उठाएं</p>
      </div>

      {/* Plans */}
      <div className="space-y-4">
        {PLANS.map((p) => (
          <Card key={p.id} className={`relative rounded-2xl border-2 ${p.popular ? "border-orange-400 shadow-lg" : "border-border"} p-5 ${p.popular ? "" : ""}`}>
            {p.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow flex items-center gap-1">
                ★ सबसे लोकप्रिय
              </div>
            )}
            <div className="text-center">
              <h2 className={`text-xl font-extrabold ${p.color}`}>{p.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{p.tag}</p>
              <div className="mt-4">
                <span className={`text-4xl font-extrabold ${p.color}`}>₹{p.price}</span>
                <span className="text-sm text-muted-foreground">/माह</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className={`w-4 h-4 shrink-0 ${p.color}`} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() => choose(p)}
              variant={p.popular ? "default" : "outline"}
              className={`w-full mt-5 ${p.btn}`}
            >
              चुनें
            </Button>
          </Card>
        ))}
      </div>

      {/* Secure payment banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 grid place-items-center shrink-0">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">100% सुरक्षित भुगतान</div>
          <div className="text-[11px] text-muted-foreground">आपका पेमेंट पूरी तरह सुरक्षित है और कभी भी रद्द किया जा सकता है।</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Lock className="w-3.5 h-3.5" /> Secure
        </div>
      </div>

      {/* Payment methods */}
      <div>
        <h3 className="text-sm font-bold mb-2">भुगतान के तरीके</h3>
        <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 w-max">
            {PAY_METHODS.map((m) => (
              <div key={m.label} className="min-w-[110px] rounded-xl border border-border bg-card px-3 py-3 text-center shadow-sm">
                <div className="text-sm font-bold">{m.label}</div>
                {m.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Cloud, title: "Backup & Restore", sub: "अपना डेटा सुरक्षित रखें", color: "text-blue-600 bg-blue-500/10" },
          { icon: FileDown, title: "PDF Export", sub: "रिपोर्ट को PDF में निकालें", color: "text-rose-600 bg-rose-500/10" },
          { icon: Wifi, title: "Offline Support", sub: "बिना इंटरनेट भी काम करें", color: "text-emerald-600 bg-emerald-500/10" },
          { icon: Bell, title: "Smart Alerts", sub: "महत्वपूर्ण रिमाइंडर पाएं", color: "text-amber-600 bg-amber-500/10" },
        ].map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-xl border border-border bg-card p-3 flex items-start gap-2">
              <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${f.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{f.title}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{f.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="w-full text-center text-sm text-primary font-semibold py-2">
        ↻ Restore Purchase
      </button>
    </div>
  );
}
