import { useState, useEffect } from "react";
import { getContractors, addContractor, deleteContractor, updateContractor, type Contractor } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Phone, Trash2, Pencil, HardHat } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface FormState {
  name: string;
  phone: string;
  site_name: string;
  contract_amount: string;
  advance_paid: string;
  notes: string;
}

const empty: FormState = { name: "", phone: "", site_name: "", contract_amount: "", advance_paid: "", notes: "" };

export default function ContractorsPage() {
  const [list, setList] = useState<Contractor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setList(await getContractors()); } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Contractor) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      site_name: c.site_name ?? "",
      contract_amount: String(c.contract_amount),
      advance_paid: String(c.advance_paid),
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "नाम डालें", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        site_name: form.site_name.trim() || null,
        contract_amount: parseInt(form.contract_amount) || 0,
        advance_paid: parseInt(form.advance_paid) || 0,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await updateContractor(editing.id, payload);
        toast({ title: "✅ ठेकेदार अपडेट हुआ" });
      } else {
        await addContractor(payload);
        toast({ title: "✅ ठेकेदार जोड़ा गया" });
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contractor) => {
    try {
      await deleteContractor(c.id);
      toast({ title: `✅ ${c.name} हटा दिया गया` });
      load();
    } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ठेकेदार ({list.length})</h2>
        <Button size="sm" onClick={openAdd} className="gap-1">
          <Plus className="w-4 h-4" /> जोड़ें
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HardHat className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">अभी कोई ठेकेदार नहीं</p>
          <p className="text-sm mt-1">"जोड़ें" बटन दबाएं</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c, i) => {
            const balance = c.contract_amount - c.advance_paid;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        {c.site_name && <p className="text-xs text-muted-foreground mt-0.5">📍 {c.site_name}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(c)} className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="p-2 rounded-full bg-accent/10 text-accent">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>क्या आप पक्के हैं?</AlertDialogTitle>
                              <AlertDialogDescription>{c.name} को हटा दिया जाएगा।</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>रहने दें</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(c)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">हटाएं</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
                      <div>
                        <p className="text-[10px] text-muted-foreground">कुल</p>
                        <p className="text-sm font-semibold">₹{c.contract_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">एडवांस</p>
                        <p className="text-sm font-semibold text-accent">₹{c.advance_paid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">बकाया</p>
                        <p className={`text-sm font-semibold ${balance > 0 ? "text-destructive" : "text-primary"}`}>
                          ₹{balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {c.notes && <p className="text-xs text-muted-foreground italic pt-1">{c.notes}</p>}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "ठेकेदार बदलें" : "नया ठेकेदार"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>नाम *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ठेकेदार का नाम" />
            </div>
            <div>
              <Label>फ़ोन</Label>
              <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
            </div>
            <div>
              <Label>साइट</Label>
              <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="साइट का नाम" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>कुल राशि (₹)</Label>
                <Input type="number" inputMode="numeric" value={form.contract_amount} onChange={(e) => setForm({ ...form, contract_amount: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>एडवांस (₹)</Label>
                <Input type="number" inputMode="numeric" value={form.advance_paid} onChange={(e) => setForm({ ...form, advance_paid: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>नोट्स</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="कोई जानकारी..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>रद्द करें</Button>
            <Button onClick={save} disabled={saving}>{saving ? "रुकें..." : "सेव करें"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
