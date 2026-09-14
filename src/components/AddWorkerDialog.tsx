import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addWorker, deleteWorkerPermanently, updateWorker, type WorkerRole } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Camera, ImagePlus, Trash2, UserPlus } from "lucide-react";
import SiteNameInput from "./SiteNameInput";
import { removeWorkerPhoto, uploadWorkerPhoto } from "@/lib/worker-photos";
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "कृपया फोटो फ़ाइल चुनें", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "फोटो 5 MB से छोटी रखें", variant: "destructive" });
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      // Site must already exist in Sites page; we never auto-create.
      const worker = await addWorker({
        name: name.trim(),
        role,
        daily_rate: parseInt(dailyRate) || 500,
        site_name: siteName.trim() || null,
        phone: phone.trim() || null,
        upi_id: upiId.trim() || null,
      });
      let uploadedPath: string | null = null;
      try {
        if (photo) {
          uploadedPath = await uploadWorkerPhoto(worker.id, photo);
          await updateWorker(worker.id, {
            name: worker.name,
            role: worker.role,
            daily_rate: worker.daily_rate,
            site_name: worker.site_name,
            phone: worker.phone,
            upi_id: worker.upi_id,
            photo_url: uploadedPath,
          });
        }
      } catch (photoError) {
        if (uploadedPath) await removeWorkerPhoto(uploadedPath).catch(() => undefined);
        await deleteWorkerPermanently(worker.id).catch(() => undefined);
        throw photoError;
      }
      toast({ title: "✅ मजदूर जोड़ दिया गया!" });
      setName("");
      setDailyRate("500");
      setSiteName("");
      setPhone("");
      setUpiId("");
      clearPhoto();
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
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">पहचान फोटो (वैकल्पिक)</p>
            {photoPreview ? (
              <div className="flex items-center gap-3">
                <img src={photoPreview} alt="चुनी गई मजदूर फोटो" className="h-16 w-16 rounded-full border border-border object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{photo?.name}</p>
                  <Button type="button" variant="ghost" size="sm" className="mt-1 gap-1 text-destructive" onClick={clearPhoto}>
                    <Trash2 className="h-4 w-4" /> हटाएं
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                  <label>
                    <Camera className="h-4 w-4" /> कैमरा
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </Button>
                <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                  <label>
                    <ImagePlus className="h-4 w-4" /> गैलरी
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </Button>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "जोड़ रहे हैं..." : "जोड़ें"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
