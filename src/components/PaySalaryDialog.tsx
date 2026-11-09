import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type WorkerLedger } from "@/lib/payment-engine";

interface PaySalaryDialogProps {
  target: WorkerLedger | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function PaySalaryDialog({ target, onClose, onSaved }: PaySalaryDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!target) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast({ title: "कृपया सही राशि दर्ज करें", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("payment_history").insert({
        worker_id: target.worker.id,
        amount: num,
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: paymentMode,
        notes: notes || "वेतन भुगतान",
        site_name: target.worker.site_name,
      });

      if (error) throw error;

      toast({ title: `💵 ${target.worker.name} को ₹${num} का भुगतान दर्ज हो गया` });
      setAmount("");
      setNotes("");
      onSaved();
    } catch (err: any) {
      toast({ title: "त्रुटि", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            भुगतान करें — {target.worker.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePay} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">भुगतान राशि (₹)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="राशि दर्ज करें"
              className="rounded-xl font-bold text-base"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">माध्यम (Mode)</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm font-semibold"
            >
              <option value="cash">नकद (Cash)</option>
              <option value="online">ऑनलाइन (Online / UPI)</option>
              <option value="bank">बैंक ट्रांसफर (Bank Transfer)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">टिप्पणी (Notes - वैकल्पिक)</label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="विवरण लिखें"
              className="rounded-xl text-sm"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              रद्द करें
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              {loading ? "सुरक्षित हो रहा है..." : "भुगतान सेव करें"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
