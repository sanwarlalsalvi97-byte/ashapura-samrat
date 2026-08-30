import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { FREE_WORKER_LIMIT, TRIAL_MONTHS, isTrialActive, trialDaysLeft } from "@/lib/premium";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpgrade: () => void;
}

export default function PremiumUpgradeDialog({ open, onOpenChange, onUpgrade }: Props) {
  const trialActive = isTrialActive();
  const daysLeft = trialDaysLeft();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" /> Premium Upgrade
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {trialActive ? (
            <>
              <p className="font-semibold">
                {TRIAL_MONTHS} महीने के फ्री ट्रायल में अधिकतम {FREE_WORKER_LIMIT} मजदूर जोड़े जा सकते हैं।
              </p>
              <p className="text-muted-foreground">ट्रायल में {daysLeft} दिन बाकी हैं। Unlimited मजदूर के लिए Premium लें।</p>
            </>
          ) : (
            <>
              <p className="font-semibold">आपका {TRIAL_MONTHS} महीने का फ्री ट्रायल समाप्त हो गया है।</p>
              <p className="text-muted-foreground">ऐप का उपयोग जारी रखने के लिए सब्सक्रिप्शन लें।</p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>बाद में</Button>
          <Button onClick={onUpgrade} className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
            <Crown className="w-4 h-4" /> Premium लें
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
