import { toISODate } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { getWorkers, deleteWorker, updateWorker, type Worker } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddWorkerDialog from "./AddWorkerDialog";
import EditWorkerDialog from "./EditWorkerDialog";
import UpiPayDialog from "./UpiPayDialog";
import PremiumUpgradeDialog from "./PremiumUpgradeDialog";
import { Button } from "@/components/ui/button";
import { Phone, Trash2, Smartphone, Building2, UserPlus, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { listSites, type Site, createSite } from "@/lib/sites";
import { computeWorkerPayments, subscribePaymentSources, type WorkerPayment } from "@/lib/payment-engine";
import { canAddWorker, isPremium, FREE_WORKER_LIMIT, loadTrial, getTrial, trialDaysLeft } from "@/lib/premium";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const roleColors: Record<string, string> = {
  "मिस्त्री": "bg-primary/15 text-primary",
  "मजदूर": "bg-accent/15 text-accent",
  "हेल्पर": "bg-muted text-muted-foreground",
  "ठेकेदार": "bg-destructive/15 text-destructive",
};

export default function WorkersPage({ onNavigate }: { onNavigate?: (tab: any) => void } = {}) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payTarget, setPayTarget] = useState<Worker | null>(null);
  const [sites, setSites] = useState<Site[]>(() => listSites());
  const [paymentsMap, setPaymentsMap] = useState<Map<string, WorkerPayment>>(new Map());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [planTick, setPlanTick] = useState(0);
  const premium = isPremium();
  const trial = getTrial();
  const daysLeft = trialDaysLeft();
  const blocked = !canAddWorker(workers.length);


  const load = async () => {
    try {
      const ws = await getWorkers();
      setWorkers(ws);
      setSites(listSites());

      const now = new Date();
      const startISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endISO =toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const res = await computeWorkerPayments({ startISO, endISO });
      const pMap = new Map<string, WorkerPayment>();
      res.rows.forEach((r) => pMap.set(r.worker.id, r));
      setPaymentsMap(pMap);
    } catch {}
  };

  useEffect(() => {
    load();
    loadTrial();
    const refresh = () => setSites(listSites());
    const planRefresh = () => setPlanTick((t) => t + 1);
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("premium-updated", planRefresh);
    const unsub = subscribePaymentSources(load);
    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("premium-updated", planRefresh);
      unsub();
    };
  }, []);


  const handleSiteChange = async (w: Worker, newSite: string) => {
    if (newSite === "__add__") {
      const name = window.prompt("नई साइट का नाम लिखें:")?.trim();
      if (!name) return;
      const created = createSite({ name });
      if (!created) {
        toast({ title: "यह साइट पहले से है या नाम गलत है", variant: "destructive" });
        return;
      }
      setSites(listSites());
      newSite = created.name;
    }
    const site_name = newSite === "__none__" ? null : newSite;
    // Optimistic update
    setWorkers((prev) => prev.map((x) => (x.id === w.id ? { ...x, site_name } : x)));
    try {
      await updateWorker(w.id, {
        name: w.name,
        role: w.role as any,
        daily_rate: w.daily_rate,
        site_name,
        phone: w.phone ?? null,
        upi_id: (w as any).upi_id ?? null,
      });
      toast({ title: `✅ ${w.name} — साइट अपडेट` });
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
      load();
    }
  };


  const handleDelete = async (worker: Worker) => {
    try {
      await deleteWorker(worker.id);
      toast({ title: `✅ ${worker.name} को हटा दिया गया` });
      load();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">मजदूरों की सूची ({workers.length})</h2>
        {blocked ? (
          <Button size="sm" onClick={() => setShowUpgrade(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
            <Crown className="w-4 h-4" /> Premium लें
          </Button>
        ) : (
          <AddWorkerDialog onAdded={load} />
        )}
      </div>

      {!premium && (
        <div className="text-xs text-muted-foreground bg-muted/60 rounded-md px-3 py-2" data-tick={planTick}>
          {!trial.known ? (
            <>फ्री प्लान: {workers.length}/{FREE_WORKER_LIMIT} मजदूर · ट्रायल जानकारी लोड हो रही है…</>
          ) : trial.active ? (
            <>फ्री ट्रायल: {workers.length}/{FREE_WORKER_LIMIT} मजदूर · {daysLeft} दिन बाकी</>
          ) : (
            <>फ्री ट्रायल समाप्त — नए मजदूर जोड़ने के लिए सब्सक्रिप्शन लें</>
          )}
        </div>
      )}


      <PremiumUpgradeDialog
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        onUpgrade={() => { setShowUpgrade(false); onNavigate?.("subscription"); }}
      />


      {workers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">अभी कोई मजदूर नहीं</p>
          <p className="text-sm mt-1">ऊपर "मजदूर जोड़ें" बटन दबाएं</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((w, i) => {
            const pInfo = paymentsMap.get(w.id);
            const pendingBal = pInfo ? Math.round(pInfo.outstanding) : 0;
            return (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{w.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[w.role] || ""}`}>
                          {w.role}
                        </span>
                        {(w as any).worker_code && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                            कोड: {(w as any).worker_code}
                            {(w as any).linked_user_id ? " • जुड़ा" : " • अनलिंक"}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">₹{w.daily_rate}/दिन</span>
                        {pendingBal !== 0 && (
                          <span className={`text-xs font-bold ${pendingBal > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                            • बाकी: ₹{pendingBal.toLocaleString("hi-IN")}
                          </span>
                        )}
                      </div>

                    </div>

                    <div className="flex items-center gap-2">
                    <EditWorkerDialog worker={w} onUpdated={load} />
                    {(w as any).upi_id && (
                      <button onClick={() => setPayTarget(w)} className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20" title="UPI से पेमेंट">
                        <Smartphone className="w-4 h-4" />
                      </button>
                    )}
                    {w.phone && (
                      <a href={`tel:${w.phone}`} className="p-2 rounded-full bg-accent/10 text-accent">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>क्या आप पक्के हैं?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {w.name} को सूची से हटा दिया जाएगा। उनकी पुरानी हाजिरी रिपोर्ट में दिखती रहेगी।
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>रहने दें</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(w)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            हटाएं
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </div>

                  {/* Inline site selector */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground shrink-0">साइट:</span>
                    <Select
                      value={w.site_name || "__none__"}
                      onValueChange={(v) => handleSiteChange(w, v)}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs flex-1 bg-background border-primary/30">
                        <SelectValue placeholder="साइट चुनें" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] bg-popover">
                        <SelectItem value="__none__">— कोई नहीं —</SelectItem>
                        {sites.map((s) => (
                          <SelectItem key={s.id} value={s.name}>
                            {s.name}{s.location ? ` · ${s.location}` : ""}
                          </SelectItem>
                        ))}
                        <SelectItem value="__add__" className="text-primary font-medium">
                          ➕ नई साइट जोड़ें
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>

              </Card>
            </motion.div>
            );
          })}
        </div>
      )}

      <UpiPayDialog
        open={!!payTarget}
        onOpenChange={(v) => !v && setPayTarget(null)}
        payeeName={payTarget?.name || ""}
        payeeVpa={(payTarget as any)?.upi_id}
        defaultAmount={payTarget?.daily_rate}
      />
    </div>
  );
}
