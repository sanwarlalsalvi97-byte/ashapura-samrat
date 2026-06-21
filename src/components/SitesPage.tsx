import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  listSites,
  createSite,
  updateSite,
  deleteSite,
  setActiveSite,
  type Site,
} from "@/lib/sites";

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);

  const refresh = () => setSites(listSites());

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("sites-updated", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("sites-updated", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setLocation("");
    setOpen(true);
  };

  const openEdit = (s: Site) => {
    setEditing(s);
    setName(s.name);
    setLocation(s.location || "");
    setOpen(true);
  };

  const handleSave = () => {
    const n = name.trim();
    if (!n) {
      toast({ title: "साइट का नाम ज़रूरी है", variant: "destructive" });
      return;
    }
    if (editing) {
      const ok = updateSite(editing.id, { name: n, location });
      if (!ok) {
        toast({ title: "यह नाम पहले से मौजूद है", variant: "destructive" });
        return;
      }
      toast({ title: "✅ साइट अपडेट हो गई" });
    } else {
      const created = createSite({ name: n, location });
      if (!created) {
        toast({ title: "यह साइट पहले से मौजूद है", variant: "destructive" });
        return;
      }
      toast({ title: "✅ नई साइट जोड़ी गई" });
    }
    setOpen(false);
    refresh();
  };

  const handleSelect = (s: Site) => {
    if (s.isActive) return;
    setActiveSite(s.id);
    toast({ title: `✅ ${s.name} अब चालू है` });
    refresh();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteSite(deleteTarget.id);
    toast({ title: `🗑 ${deleteTarget.name} हटा दी गई` });
    setDeleteTarget(null);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          साइट <span className="text-muted-foreground font-semibold">({sites.length})</span>
        </h2>
        <Button
          size="sm"
          onClick={openAdd}
          className="gap-1.5 rounded-full text-white shadow-md border-0"
          style={{ background: "linear-gradient(135deg, hsl(25 95% 55%), hsl(15 90% 50%))" }}
        >
          <Plus className="w-4 h-4" />
          नई साइट
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-base font-medium">अभी कोई साइट नहीं</p>
          <p className="text-sm mt-1">ऊपर "+ नई साइट" बटन दबाएं</p>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {sites.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04 }}
              >
                <button
                  onClick={() => handleSelect(s)}
                  className={`w-full text-left rounded-[15px] p-4 flex items-center gap-3 transition-all shadow-sm active:scale-[0.99] ${
                    s.isActive
                      ? "border-2 border-orange-500 bg-orange-50 dark:bg-orange-500/10 shadow-md"
                      : "border border-border bg-card hover:border-orange-300"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${
                      s.isActive
                        ? "bg-gradient-to-br from-orange-500 to-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Building2 className="w-6 h-6" />
                  </div>

                  {/* Name + location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-base truncate">{s.name}</h3>
                      {s.isActive && (
                        <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </div>
                    {s.location ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {s.location}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">कोई पता नहीं</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      s.isActive
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.isActive ? "चालू" : "बंद"}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openEdit(s); } }}
                      className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDeleteTarget(s); } }}
                      className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "साइट बदलें" : "नई साइट जोड़ें"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">साइट का नाम *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="जैसे: समरत हाइट्स"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">मालिक का नाम (Owner)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="जैसे: अंबालाल गुर्जर"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              रद्द करें
            </Button>
            <Button
              className="flex-1 text-white border-0"
              style={{ background: "linear-gradient(135deg, hsl(25 95% 55%), hsl(15 90% 50%))" }}
              onClick={handleSave}
            >
              {editing ? "अपडेट" : "जोड़ें"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>क्या आप इस साइट को हटाना चाहते हैं?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> को सूची से हटा दिया जाएगा।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>रहने दें</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              हटाएं
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
