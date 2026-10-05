import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addWorker, updateWorker, type WorkerRole } from "@/lib/supabase-helpers";
import { toast } from "@/hooks/use-toast";
import { Camera, ImagePlus, Trash2, UserPlus } from "lucide-react";
import SiteNameInput from "./SiteNameInput";
import { removeWorkerPhoto, uploadWorkerPhoto } from "@/lib/worker-photos";

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
  const [aadhaar, setAadhaar] = useState("");
  const [upiId, setUpiId] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // आधार नंबर को केवल 12 अंकों तक सीमित करने के लिए
  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // केवल अंक स्वीकार करें
    if (value.length <= 12) {
      setAadhaar(value);
    }
  };

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
      const worker = await addWorker({
        name: name.trim(),
        role,
        daily_rate: parseInt(dailyRate) || 500,
        site_name: siteName.trim() || null,
        phone: phone.trim() || null,
        aadhaar: aadhaar ? "[Aadhaar Redacted]" : null,
        upi_id: upiId.trim() || null,
        bank_account: bankAccount.trim() || null,
        ifsc_code: ifsc.trim().toUpperCase() || null,
      } as any);

      let uploadedPath: string | null = null;
      let photoWarning: string | null = null;
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
        photoWarning = photoError instanceof Error ? photoError.message : "फोटो सेव नहीं हुई";
      }

      toast({
        title: "✅ मजदूर जोड़ दिया गया!",
        description: photoWarning ? `फोटो सेव नहीं हुई, लेकिन मजदूर सुरक्षित है। ${photoWarning}` : undefined,
      });

      setName("");
      setDailyRate("500");
      setSiteName("");
      setPhone("");
      setAadhaar("");
      setUpiId("");
      setBankAccount("");
      setIfsc("");
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>नया मजदूर जोड़ें</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col items-center gap-3 border-b border-border pb-4">
            <p className="text-sm font-medium">पहचान फोटो (वैकल्पिक)</p>
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted">
                {photoPreview ? (
                  <img src={photoPreview} alt="चुनी गई मजदूर फोटो" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-9 w-9 text-muted-foreground" />
                )}
              </div>
              <Button asChild type="button" size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full" title="कैमरा खोलें">
                <label aria-label="कैमरा खोलें">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </Button>
            </div>
            {photoPreview && <p className="max-w-full truncate text-xs text-muted-foreground">{photo?.name}</p>}
            <div className="flex items-center justify-center gap-2">
              <Button asChild type="button" variant="outline" size="sm" className="gap-2">
                <label>
                  <ImagePlus className="h-4 w-4" /> {photoPreview ? "फोटो बदलें" : "फोटो चुनें"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </Button>
              {photoPreview && (
                <Button type="button" variant="ghost" size="sm" className="gap-1 text-destructive" onClick={clearPhoto}>
                  <Trash2 className="h-4 w-4" /> हटाएं
                </Button>
              )}
            </div>
          </div>

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

          <Input type="text" placeholder="दिहाड़ी (₹)" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />

          {/* 1. Site Selection Label */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">साइट चुनें</Label>
            <SiteNameInput value={siteName} onChange={setSiteName} />
          </div>

          <Input placeholder="फोन नंबर" value={phone} onChange={(e) => setPhone(e.target.value)} />

          {/* 2. Aadhaar Input Field Position (UPI ID के ठीक ऊपर) */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">आधार नंबर (वैकल्पिक)</Label>
            <Input
              placeholder="12 अंकों का आधार नंबर"
              value={aadhaar}
              onChange={handleAadhaarChange}
              maxLength={12}
              type="text"
            />
          </div>

          <Input placeholder="UPI ID (जैसे 9876543210@upi)" value={upiId} onChange={(e) => setUpiId(e.target.value)} />

          {/* 3. Bank Account Details Position (UPI ID के ठीक नीचे) */}
          <div className="space-y-3 pt-1 border-t border-border">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">बैंक खाता संख्या</Label>
              <Input
                placeholder="बैंक खाता संख्या दर्ज करें"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                type="text"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">IFSC कोड</Label>
              <Input
                placeholder="IFSC कोड दर्ज करें"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                type="text"
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "जोड़ रहे हैं..." : "जोड़ें"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
