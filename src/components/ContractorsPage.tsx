import { useState, useEffect, useMemo } from "react";
import { getContractors, addContractor, deleteContractor, updateContractor, getWorkers, type Contractor, type Worker } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Phone, Trash2, Pencil, HardHat, Wallet, CheckCircle2, PauseCircle, PlayCircle, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import UpiPayDialog from "./UpiPayDialog";
import { toast } from "@/hooks/use-toast";

interface FormState {
  name: string;
  phone: string;
  site_name: string;
  contract_amount: string;
  advance_paid: string;
  notes: string;
  status: string;
  progress: string;
  upi_id: string;
}

const empty: FormState = { name: "", phone: "", site_name: "", contract_amount: "", advance_paid: "", notes: "", status: "चालू", progress: "0", upi_id: "" };
const STATUSES = ["चालू", "पूरा", "रुका"] as const;

export default function ContractorsPage() {
  const [list, setList] = useState<Contractor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "चालू" | "पूरा" | "रुका">("all");

  // Quick payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Contractor | null>(null);
  const [payAmount, setPayAmount] = useState("");

  // UPI dialog
  const [upiTarget, setUpiTarget] = useState<Contractor | null>(null);

  const load = async () => {
    try { setList(await getContractors()); } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    let total = 0, paid = 0, due = 0, active = 0, done = 0;
    list.forEach((c: any) => {
      total += c.contract_amount;
      paid += c.advance_paid;
      due += c.contract_amount - c.advance_paid;
      if (c.status === "पूरा") done++;
      else if (c.status === "चालू") active++;
    });
    return { total, paid, due, active, done };
  }, [list]);

  const filtered = useMemo(() => {
    if (filter === "all") return list;
    return list.filter((c: any) => c.status === filter);
  }, [list, filter]);

  const openAdd = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      site_name: c.site_name ?? "",
      contract_amount: String(c.contract_amount),
      advance_paid: String(c.advance_paid),
      notes: c.notes ?? "",
      status: c.status ?? "चालू",
      progress: String(c.progress ?? 0),
      upi_id: c.upi_id ?? "",
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
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        site_name: form.site_name.trim() || null,
        contract_amount: parseInt(form.contract_amount) || 0,
        advance_paid: parseInt(form.advance_paid) || 0,
        notes: form.notes.trim() || null,
        status: form.status,
        progress: Math.max(0, Math.min(100, parseInt(form.progress) || 0)),
        upi_id: form.upi_id.trim() || null,
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

  const openPay = (c: Contractor) => { setPayTarget(c); setPayAmount(""); setPayOpen(true); };
  const savePay = async () => {
    const amt = parseInt(payAmount);
    if (!payTarget || !amt || amt <= 0) {
      toast({ title: "राशि डालें", variant: "destructive" });
      return;
    }
    try {
      await updateContractor(payTarget.id, { advance_paid: payTarget.advance_paid + amt });
      toast({ title: `✅ ₹${amt.toLocaleString()} पेमेंट जोड़ी` });
      setPayOpen(false);
      load();
    } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    }
  };

  const quickStatus = async (c: any, status: string) => {
    try {
      await updateContractor(c.id, { status } as any);
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

      {/* Summary */}
      {list.length > 0 && (
        <Card>
          <CardContent className="p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">कुल राशि</p>
              <p className="text-sm font-bold">₹{summary.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">दी गई</p>
              <p className="text-sm font-bold text-accent">₹{summary.paid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">बकाया</p>
              <p className="text-sm font-bold text-destructive">₹{summary.due.toLocaleString()}</p>
            </div>
            <div className="col-span-3 pt-2 border-t border-border flex justify-around text-[11px]">
              <span>चालू: <b className="text-primary">{summary.active}</b></span>
              <span>पूरा: <b className="text-accent">{summary.done}</b></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      {list.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {(["all", "चालू", "पूरा", "रुका"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs h-7">
              {f === "all" ? "सभी" : f}
            </Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HardHat className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{list.length === 0 ? "अभी कोई ठेकेदार नहीं" : "इस फ़िल्टर में कुछ नहीं"}</p>
          {list.length === 0 && <p className="text-sm mt-1">"जोड़ें" बटन दबाएं</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any, i) => {
            const balance = c.contract_amount - c.advance_paid;
            const progress = c.progress ?? 0;
            const status = c.status ?? "चालू";
            const statusColor = status === "पूरा" ? "bg-accent/15 text-accent" : status === "रुका" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary";
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{c.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{status}</span>
                        </div>
                        {c.site_name && <p className="text-xs text-muted-foreground mt-0.5">📍 {c.site_name}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openPay(c)} className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20" title="पेमेंट लॉग">
                          <Wallet className="w-4 h-4" />
                        </button>
                        {c.upi_id && (
                          <button onClick={() => setUpiTarget(c)} className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20" title="UPI से पेमेंट">
                            <Smartphone className="w-4 h-4" />
                          </button>
                        )}
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

                    {/* Progress bar */}
                    <div className="pt-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>प्रोग्रेस</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${status === "पूरा" ? "bg-accent" : status === "रुका" ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
                      <div>
                        <p className="text-[10px] text-muted-foreground">कुल</p>
                        <p className="text-sm font-semibold">₹{c.contract_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">दी गई</p>
                        <p className="text-sm font-semibold text-accent">₹{c.advance_paid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">बकाया</p>
                        <p className={`text-sm font-semibold ${balance > 0 ? "text-destructive" : "text-primary"}`}>
                          ₹{balance.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Quick status actions */}
                    <div className="flex gap-1 pt-1">
                      {status !== "चालू" && (
                        <button onClick={() => quickStatus(c, "चालू")} className="flex-1 text-[10px] py-1 rounded bg-primary/10 text-primary flex items-center justify-center gap-1">
                          <PlayCircle className="w-3 h-3" /> चालू
                        </button>
                      )}
                      {status !== "रुका" && (
                        <button onClick={() => quickStatus(c, "रुका")} className="flex-1 text-[10px] py-1 rounded bg-destructive/10 text-destructive flex items-center justify-center gap-1">
                          <PauseCircle className="w-3 h-3" /> रोकें
                        </button>
                      )}
                      {status !== "पूरा" && (
                        <button onClick={() => quickStatus(c, "पूरा")} className="flex-1 text-[10px] py-1 rounded bg-accent/10 text-accent flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> पूरा
                        </button>
                      )}
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
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
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
                <Label>दी गई (₹)</Label>
                <Input type="number" inputMode="numeric" value={form.advance_paid} onChange={(e) => setForm({ ...form, advance_paid: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>स्टेटस</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {STATUSES.map((s) => (
                  <Button key={s} type="button" size="sm" variant={form.status === s ? "default" : "outline"} onClick={() => setForm({ ...form, status: s })}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label>प्रोग्रेस: {form.progress}%</Label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: e.target.value })}
                className="w-full mt-2"
              />
            </div>
            <div>
              <Label>UPI ID (ऑनलाइन पेमेंट के लिए)</Label>
              <Input value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="जैसे 9876543210@upi" />
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

      {/* Quick payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>पेमेंट जोड़ें {payTarget && `— ${payTarget.name}`}</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                अभी बकाया: <b className="text-destructive">₹{(payTarget.contract_amount - payTarget.advance_paid).toLocaleString()}</b>
              </div>
              <div>
                <Label>राशि (₹)</Label>
                <Input type="number" inputMode="numeric" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="5000" autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>रद्द</Button>
            <Button onClick={savePay}>जोड़ें</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpiPayDialog
        open={!!upiTarget}
        onOpenChange={(v) => !v && setUpiTarget(null)}
        payeeName={upiTarget?.name || ""}
        payeeVpa={(upiTarget as any)?.upi_id}
        defaultAmount={upiTarget ? Math.max(0, upiTarget.contract_amount - upiTarget.advance_paid) : undefined}
        defaultNote={upiTarget ? `${upiTarget.name} - ठेकेदार पेमेंट` : ""}
      />
    </div>
  );
}
