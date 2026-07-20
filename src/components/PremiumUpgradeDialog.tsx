import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpgrade: () => void;
}

export default function PremiumUpgradeDialog({ open, onOpenChange, onUpgrade }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" /> Premium Upgrade
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Free Plan में अधिकतम 5 मजदूर जोड़े जा सकते हैं।</p>
          <p className="text-muted-foreground">Unlimited मजदूर जोड़ने के लिए Premium लें।</p>
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
