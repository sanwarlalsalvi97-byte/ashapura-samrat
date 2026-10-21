import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  getLegacyImportPlan,
  getSitesUserId,
  importLegacySites,
  setLegacyImportDeclined,
  subscribeSites,
  type LegacyImportPlan,
} from "@/lib/sites";

/** Asks before copying this phone's old (device-only) sites into the signed-in account. */
export default function SitesLegacyImportDialog() {
  const [plan, setPlan] = useState<LegacyImportPlan | null>(null);
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [snoozed, setSnoozed] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const uid = getSitesUserId();
      if (!uid || snoozed === uid) { setPlan(null); return; }
      setPlan(getLegacyImportPlan());
    };
    check();
    return subscribeSites(check);
  }, [snoozed]);

  useEffect(() => {
    if (!plan) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
  }, [plan]);

  if (!plan) return null;

  const doImport = async () => {
    setBusy(true);
    const r = await importLegacySites(plan);
    setBusy(false);
    if (r.ok) {
      toast({ title: `✅ ${r.imported} साइटें Cloud में सेव हुईं` });
      setPlan(null);
    } else {
      toast({ title: "पूरी साइटें सेव नहीं हुईं — फ़ोन का डेटा सुरक्षित है, फिर से कोशिश करें", variant: "destructive" });
      setPlan(getLegacyImportPlan());
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) setSnoozed(getSitesUserId()); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>इस फ़ोन पर {plan.toImport.length} पुरानी साइटें मिलीं</DialogTitle>
          <DialogDescription>
            क्या इन्हें इस अकाउंट{email ? ` (${email})` : ""} में Cloud पर सेव करें? फ़ोन का मूल डेटा नहीं हटेगा।
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 overflow-auto text-sm space-y-1 rounded-lg border border-border p-2">
          {plan.toImport.map((s) => (
            <li key={s.id}>• {s.name}{s.location ? ` — ${s.location}` : ""}</li>
          ))}
        </ul>
        {(plan.alreadyInCloud.length > 0 || plan.duplicates.length > 0 || plan.blank.length > 0) && (
          <p className="text-xs text-muted-foreground">
            {plan.alreadyInCloud.length > 0 && `${plan.alreadyInCloud.length} पहले से Cloud में हैं। `}
            {plan.duplicates.length > 0 && `${plan.duplicates.length} दोहराए गए नाम छोड़े जाएँगे। `}
            {plan.blank.length > 0 && `${plan.blank.length} खाली नाम छोड़े जाएँगे।`}
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={() => void doImport()} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "हाँ, सेव करें"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setSnoozed(getSitesUserId())}>
              अभी नहीं
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={busy}
              onClick={() => { const uid = getSitesUserId(); if (uid) setLegacyImportDeclined(uid); setPlan(null); }}
            >
              नहीं
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
