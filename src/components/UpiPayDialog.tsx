import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { buildUpiLink, isValidUpiId, launchUpi, isAndroid, isStandalonePWA } from "@/lib/upi";
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
  const [launching, setLaunching] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount ? String(defaultAmount) : "");
      setNote(defaultNote || `${payeeName} - पेमेंट`);
      setCopied(false);
      setShowFallback(false);
    }
  }, [open, defaultAmount, defaultNote, payeeName]);

  const validVpa = !!payeeVpa && isValidUpiId(payeeVpa);
  const pwa = isStandalonePWA();
  const android = isAndroid();

  const params = useMemo(() => (
    validVpa ? {
      payeeVpa: payeeVpa!,
      payeeName,
      amount: parseInt(amount) || undefined,
      note,
    } : null
  ), [validVpa, payeeVpa, payeeName, amount, note]);

  const link = useMemo(() => params ? buildUpiLink(params) : "", [params]);

  useEffect(() => {
    if (!link) { setQrUrl(""); return; }
    QRCode.toDataURL(link, { width: 280, margin: 1 }).then(setQrUrl).catch(() => setQrUrl(""));
  }, [link]);

  const handlePay = async () => {
    if (!params) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "राशि डालें", description: "कृपया 0 से बड़ी राशि डालें।", variant: "destructive" });
      return;
    }
    if (!payeeName?.trim()) {
      toast({ title: "नाम आवश्यक है", variant: "destructive" });
      return;
    }
    setLaunching(true);
    setShowFallback(false);
    const result = await launchUpi({ ...params, amount: amt });
    setLaunching(false);
    console.log("[UpiPayDialog] launch result:", result);
    if (!result.opened) {
      setShowFallback(true);
      toast({
        title: "कोई UPI ऐप नहीं मिला",
        description: result.error || "कृपया Google Pay, PhonePe, Paytm या BHIM इंस्टॉल करें, या QR स्कैन करें।",
        variant: "destructive",
      });
    }
  };

  const openInBrowser = () => {
    if (!link) return;
    // Opens outside the PWA so Chrome/Samsung's app chooser can kick in.
    window.open(link, "_blank");
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
              <button onClick={copyVpa} className="p-1.5 rounded hover:bg-background" aria-label="Copy UPI ID">
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

            {showFallback && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4" /> UPI ऐप नहीं खुला
                </div>
                <p className="text-muted-foreground">
                  {android && pwa
                    ? "इंस्टॉल किए गए ऐप से UPI ऐप कभी-कभी नहीं खुलता। ब्राउज़र में खोलें या QR स्कैन करें।"
                    : "कृपया GPay / PhonePe / Paytm / BHIM में से कोई ऐप इंस्टॉल करें, या नीचे QR स्कैन करें।"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={openInBrowser} className="flex-1 gap-1">
                    <ExternalLink className="w-3 h-3" /> Browser में खोलें
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyVpa} className="flex-1 gap-1">
                    <Copy className="w-3 h-3" /> UPI ID कॉपी
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>बंद करें</Button>
          {validVpa && (
            <Button onClick={handlePay} disabled={launching} className="gap-2">
              <Smartphone className="w-4 h-4" /> {launching ? "खोल रहा है…" : "UPI ऐप खोलें"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
