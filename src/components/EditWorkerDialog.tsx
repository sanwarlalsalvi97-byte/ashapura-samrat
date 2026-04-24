import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateWorker, type Worker, type WorkerRole } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

interface Props {
  worker: Worker;
  onUpdated: () => void;
}

export default function EditWorkerDialog({ worker, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(worker.name);
  const [role, setRole] = useState<WorkerRole>(worker.role);
  const [dailyRate, setDailyRate] = useState(String(worker.daily_rate));
  const [siteName, setSiteName] = useState(worker.site_name || "");
  const [phone, setPhone] = useState(worker.phone || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateWorker(worker.id, {
        name: name.trim(),
        role,
        daily_rate: parseInt(dailyRate) || 500,
        site_name: siteName.trim() || null,
        phone: phone.trim() || null,
      });
      toast({ title: "✅ जानकारी अपडेट हो गई!" });
      setOpen(false);
      onUpdated();
    } catch (err: any) {
      toast({ title: "गलती", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>मजदूर की जानकारी बदलें</DialogTitle>
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
          <Input placeholder="साइट का नाम" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          <Input placeholder="फोन नंबर" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "अपडेट हो रहा है..." : "अपडेट करें"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
