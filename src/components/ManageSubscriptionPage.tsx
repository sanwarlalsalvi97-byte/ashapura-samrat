import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Crown, Leaf, RefreshCw, CheckCircle2, XCircle, Sparkles, ShieldCheck, CalendarClock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { isPremium, setPremium } from "@/lib/premium";
import type { TabId } from "./BottomNav";

interface Props {
  onNavigate?: (tab: TabId) => void;
}

// Local metadata about the current subscription. In production this is
// hydrated by the Play Billing bridge (native side calls setSubscriptionMeta).
const META_KEY = "as_subscription_meta_v1";

type SubMeta = {
  planId?: "basic" | "standard" | "pro";
  planName?: string;
  cycle?: "monthly" | "yearly";
  startedAt?: string; // ISO
  renewsAt?: string; // ISO
  autoRenew?: boolean;
  source?: "play" | "manual" | "trial";
};

function readMeta(): SubMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as SubMeta) : {};
  } catch {
    return {};
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("hi-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function ManageSubscriptionPage({ onNavigate }: Props) {
  const [premium, setPremiumState] = useState<boolean>(isPremium());
  const [meta, setMeta] = useState<SubMeta>(readMeta());
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const onUpd = () => {
      setPremiumState(isPremium());
      setMeta(readMeta());
    };
    window.addEventListener("premium-updated", onUpd);
    window.addEventListener("storage", onUpd);
    return () => {
      window.removeEventListener("premium-updated", onUpd);
      window.removeEventListener("storage", onUpd);
    };
  }, []);

  const restorePurchases = async () => {
    setRestoring(true);
    try {
      // Native Play Billing bridge hook — if present, ask it to re-query
      // purchases and call setPremium()/persist meta. Otherwise this is a
      // no-op in web/PWA.
      const bridge = (window as unknown as {
        AshapuraBilling?: { restorePurchases?: () => Promise<boolean> };
      }).AshapuraBilling;
      if (bridge?.restorePurchases) {
        const ok = await bridge.restorePurchases();
        toast({
          title: ok ? "Purchases restored" : "कोई सक्रिय सदस्यता नहीं मिली",
          description: ok
            ? "आपकी Premium सदस्यता पुनः सक्रिय हो गई है।"
            : "Google Play पर इस अकाउंट से कोई सक्रिय subscription नहीं मिली।",
        });
      } else {
        toast({
          title: "Restore requested",
          description:
            "Play Billing bridge इस build में उपलब्ध नहीं है। Play Store से खरीदी गई सदस्यता native app में automatically restore होगी।",
        });
      }
    } catch (e) {
      toast({ title: "Restore failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const isPro = premium;
  const planLabel = isPro ? meta.planName || "Premium" : "Free";
  const cycleLabel = meta.cycle === "yearly" ? "वार्षिक" : meta.cycle === "monthly" ? "मासिक" : "—";

  return (
    <div className="relative pb-10 animate-fade-in">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute top-40 -right-20 w-72 h-72 rounded-full bg-violet-400/20 blur-3xl" />
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
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> मेरी सदस्यता
        </div>
      </div>

      {/* Current plan card */}
      <div
        className={`mt-5 rounded-3xl border border-white/50 dark:border-white/10 backdrop-blur-xl p-5 shadow-xl shadow-black/5 ${
          isPro
            ? "bg-[linear-gradient(135deg,rgba(243,232,255,0.9),rgba(219,234,254,0.75))] dark:bg-[linear-gradient(135deg,rgba(45,25,60,0.7),rgba(20,25,45,0.6))]"
            : "bg-[linear-gradient(135deg,rgba(236,253,245,0.85),rgba(255,255,255,0.7))] dark:bg-[linear-gradient(135deg,rgba(20,45,35,0.65),rgba(15,25,22,0.55))]"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 shadow-lg ${
              isPro
                ? "bg-gradient-to-br from-fuchsia-500 to-violet-600"
                : "bg-gradient-to-br from-emerald-400 to-green-600"
            }`}
          >
            {isPro ? <Crown className="w-6 h-6 text-white" /> : <Leaf className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold">{planLabel} प्लान</h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPro
                    ? "bg-violet-500/15 text-violet-600"
                    : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {isPro ? "ACTIVE" : "FREE"}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isPro ? "सभी Premium फीचर्स अनलॉक हैं" : "अधिकतम 5 मजदूर तक सीमित"}
            </p>
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MetaTile
            icon={<CalendarClock className="w-4 h-4" />}
            label="बिलिंग साइकिल"
            value={isPro ? cycleLabel : "—"}
          />
          <MetaTile
            icon={<ShieldCheck className="w-4 h-4" />}
            label="स्रोत"
            value={isPro ? (meta.source === "play" ? "Google Play" : meta.source === "trial" ? "Trial" : "Manual") : "—"}
          />
          <MetaTile
            icon={<CalendarClock className="w-4 h-4" />}
            label="शुरू हुई"
            value={isPro ? fmtDate(meta.startedAt) : "—"}
          />
          <MetaTile
            icon={isPro && meta.autoRenew ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
            label={isPro && meta.autoRenew ? "अगला रिन्यूअल" : "रिन्यूअल"}
            value={isPro ? (meta.autoRenew ? fmtDate(meta.renewsAt) : "बंद (Cancelled)") : "—"}
          />
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2">
          {!isPro && (
            <Button
              onClick={() => onNavigate?.("subscription")}
              className="h-11 rounded-2xl font-bold bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30"
            >
              <Crown className="w-4 h-4 mr-1.5" /> Premium में अपग्रेड करें
            </Button>
          )}
          {isPro && (
            <>
              <Button
                variant="outline"
                onClick={() => onNavigate?.("subscription")}
                className="h-11 rounded-2xl font-bold"
              >
                प्लान बदलें
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const url = "https://play.google.com/store/account/subscriptions";
                  try {
                    window.open(url, "_blank");
                  } catch {
                    /* noop */
                  }
                }}
                className="h-11 rounded-2xl font-semibold text-muted-foreground"
              >
                Google Play पर मैनेज करें
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            disabled={restoring}
            onClick={restorePurchases}
            className="h-11 rounded-2xl font-semibold text-primary"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${restoring ? "animate-spin" : ""}`} />
            {restoring ? "रिस्टोर हो रहा है…" : "Restore Purchases"}
          </Button>
        </div>
      </div>

      {/* Dev-only toggle for QA. Hidden in production Play Billing flow. */}
      {import.meta.env.DEV && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/40 dark:border-white/10 p-3 text-[11px] text-muted-foreground bg-white/40 dark:bg-white/5">
          <div className="font-semibold mb-1">Dev tools</div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPremium(!premium);
              if (!premium) {
                const now = new Date();
                const renews = new Date(now);
                renews.setMonth(renews.getMonth() + 1);
                localStorage.setItem(
                  META_KEY,
                  JSON.stringify({
                    planId: "standard",
                    planName: "Standard",
                    cycle: "monthly",
                    startedAt: now.toISOString(),
                    renewsAt: renews.toISOString(),
                    autoRenew: true,
                    source: "manual",
                  } satisfies SubMeta)
                );
              } else {
                localStorage.removeItem(META_KEY);
              }
              setMeta(readMeta());
            }}
          >
            Toggle premium (dev)
          </Button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5" /> Google Play द्वारा सुरक्षित बिलिंग
      </div>
    </div>
  );
}

function MetaTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3 bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-bold truncate">{value}</div>
    </div>
  );
}
