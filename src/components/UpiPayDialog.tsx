import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Copy, Check } from "lucide-react";
import { buildUpiLink, isValidUpiId } from "@/lib/upi";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payeeName: string;
  payeeVpa: string | null | undefined;
  defaultAmount?: number;
  defaultNote?: string;
}

export default function UpiPayDialog({ open, onOpenChange, payeeName, payeeVpa, defaultAmount, defaultNote }: Props) {
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount) : "");
  const [note, setNote] = useState(defaultNote || `${payeeName} - पेमेंट`);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount ? String(defaultAmount) : "");
      setNote(defaultNote || `${payeeName} - पेमेंट`);
      setCopied(false);
    }
  }, [open, defaultAmount, defaultNote, payeeName]);

  const validVpa = !!payeeVpa && isValidUpiId(payeeVpa);

  const link = useMemo(() => {
    if (!validVpa) return "";
    return buildUpiLink({
      payeeVpa: payeeVpa!,
      payeeName,
      amount: parseInt(amount) || undefined,
      note,
    });
  }, [validVpa, payeeVpa, payeeName, amount, note]);

  useEffect(() => {
    if (!link) { setQrUrl(""); return; }
    QRCode.toDataURL(link, { width: 280, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(""));
  }, [link]);

  const handlePay = () => {
    if (!link) return;
    // Opens UPI app on mobile; on desktop browser will likely fail silently
    window.location.href = link;
  };

  const copyVpa = async () => {
    if (!payeeVpa) return;
    try {
      await navigator.clipboard.writeText(payeeVpa);
      setCopied(true);
      toast({ title: "UPI ID कॉपी हो गई" });
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>UPI से पेमेंट — {payeeName}</DialogTitle>
        </DialogHeader>

        {!validVpa ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            इस व्यक्ति की UPI ID नहीं है।<br />
            पहले उनकी जानकारी में UPI ID (जैसे <b>9876543210@upi</b>) जोड़ें।
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
              <span className="text-sm font-mono truncate">{payeeVpa}</span>
              <button onClick={copyVpa} className="p-1.5 rounded hover:bg-background">
                {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div>
              <Label>राशि (₹)</Label>
              <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="जैसे 5000" autoFocus />
            </div>

            <div>
              <Label>नोट</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="जैसे — जुलाई की मजदूरी" />
            </div>

            {qrUrl && (
              <div className="flex flex-col items-center pt-2">
                <img src={qrUrl} alt="UPI QR" className="w-44 h-44 rounded-md border border-border" />
                <p className="text-[10px] text-muted-foreground mt-1">किसी भी UPI ऐप से QR स्कैन करें</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>बंद करें</Button>
          {validVpa && (
            <Button onClick={handlePay} className="gap-2">
              <Smartphone className="w-4 h-4" /> UPI ऐप खोलें
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
