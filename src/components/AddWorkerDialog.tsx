import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addWorker, type WorkerRole } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";
import SiteNameInput from "./SiteNameInput";
// sites are managed exclusively in the Sites page

interface Props {
  onAdded: () => void;
}

export default function AddWorkerDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<WorkerRole>("मजदूर");
  const [dailyRate, setDailyRate] = useState("500");
  const [siteName, setSiteName] = useState("");
  const [phone, setPhone] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      if (siteName.trim()) addSite(siteName);
      await addWorker({
        name: name.trim(),
        role,
        daily_rate: parseInt(dailyRate) || 500,
        site_name: siteName.trim() || null,
        phone: phone.trim() || null,
        upi_id: upiId.trim() || null,
      } as any);
      toast({ title: "✅ मजदूर जोड़ दिया गया!" });
      setName("");
      setDailyRate("500");
      setSiteName("");
      setPhone("");
      setUpiId("");
      setOpen(false);
      onAdded();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          मजदूर जोड़ें
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>नया मजदूर जोड़ें</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="नाम *" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select value={role} onValueChange={(v) => setRole(v as WorkerRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="मिस्त्री">मिस्त्री</SelectItem>
              <SelectItem value="मजदूर">मजदूर</SelectItem>
              <SelectItem value="हेल्पर">हेल्पर</SelectItem>
              <SelectItem value="ठेकेदार">ठेकेदार</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder="दिहाड़ी (₹)" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
          <SiteNameInput value={siteName} onChange={setSiteName} />
          <Input placeholder="फोन नंबर" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="UPI ID (जैसे 9876543210@upi)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "जोड़ रहे हैं..." : "जोड़ें"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
