import { toISODate } from "@/lib/date-utils";
import { useState, useEffect, useMemo } from "react";
import { getBrickEntries, addBrickEntry, deleteBrickEntry, type BrickStock, type BrickEntryType } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, Layers, Calculator, Package } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { calcMortarForBricks } from "@/lib/mortar-calc";
import {
  getMaterialEntries, addMaterialEntry, deleteMaterialEntry, getMaterialTotals,
  type MaterialEntry, type MaterialKind,
} from "@/lib/material-stock";

const today = () =>toISODate(new Date());
const MORTAR_RATIOS = ["1:4", "1:5", "1:6"];

export default function BricksPage() {
  const [entries, setEntries] = useState<BrickStock[]>([]);
  const [open, setOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState({
    length: "",
    height: "",
    thickness: "9", // 9 inch (single brick wall) default
    unit: "ft" as "ft" | "m",
    wastage: "5",
    ratio: "1:6", // mortar mix
    mortarWastage: "10",
  });
  const [form, setForm] = useState({
    date: today(),
    site_name: "",
    entry_type: "In" as BrickEntryType,
    quantity: "",
    rate: "",
    notes: "",
  });

  // Material (cement / sand) stock — local
  const [materials, setMaterials] = useState<MaterialEntry[]>([]);
  const [matOpen, setMatOpen] = useState(false);
  const [matForm, setMatForm] = useState({
    date: today(),
    kind: "cement" as MaterialKind,
    entry_type: "In" as "In" | "Out",
    quantity: "",
    rate: "",
    site_name: "",
    notes: "",
  });
  const reloadMaterials = () => setMaterials(getMaterialEntries());
  useEffect(() => { reloadMaterials(); }, []);
  const cementTotals = useMemo(() => getMaterialTotals("cement"), [materials]);
  const sandTotals = useMemo(() => getMaterialTotals("sand"), [materials]);

  const load = async () => {
    try { setEntries(await getBrickEntries()); }
    catch (e: any) { toast({ title: "गलती", description: e.message, variant: "destructive" }); }
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    let inQty = 0, outQty = 0, inCost = 0;
    entries.forEach((e) => {
      if (e.entry_type === "In") { inQty += e.quantity; inCost += e.quantity * Number(e.rate); }
      else outQty += e.quantity;
    });
    return { stock: inQty - outQty, inQty, outQty, inCost };
  }, [entries]);

  const reset = () => setForm({ date: today(), site_name: "", entry_type: "In", quantity: "", rate: "", notes: "" });

  const save = async () => {
    const qty = parseInt(form.quantity);
    if (!qty || qty <= 0) {
      toast({ title: "मात्रा डालें", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addBrickEntry({
        date: form.date,
        site_name: form.site_name.trim() || null,
        entry_type: form.entry_type,
        quantity: qty,
        rate: parseFloat(form.rate) || 0,
        notes: form.notes.trim() || null,
      });
      toast({ title: "✅ entry जुड़ गई" });
      setOpen(false);
      reset();
      load();
    } catch (e: any) {
      toast({ title: "गलती", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try { await deleteBrickEntry(id); toast({ title: "✅ हटा दिया" }); load(); }
    catch (e: any) { toast({ title: "गलती", description: e.message, variant: "destructive" }); }
  };

  // ईंट calculator (standard ईंट: 9"×4.5"×3" = 0.75 ft × 0.375 ft × 0.25 ft)
  // mortar सहित: ~ 9.5"×4.75"×3.25"
  // सूत्र: bricks per cu.ft ≈ 13.5 (1/2 ईंट = 4.5" wall) से 50 (मानक 9" wall)
  // सटीक गणना: wall volume / brick volume (mortar सहित)
  const calcResult = useMemo(() => {
    const L = parseFloat(calc.length);
    const H = parseFloat(calc.height);
    const Tin = parseFloat(calc.thickness); // inches
    const W = parseFloat(calc.wastage) || 0;
    if (!L || !H || !Tin) return null;
    // convert L,H to feet
    const Lft = calc.unit === "m" ? L * 3.28084 : L;
    const Hft = calc.unit === "m" ? H * 3.28084 : H;
    const Tft = Tin / 12;
    const wallVol = Lft * Hft * Tft; // cubic feet
    // ईंट + mortar size in feet: 9.5" × 4.75" × 3.25"
    const brickVolWithMortar = (9.5 / 12) * (4.75 / 12) * (3.25 / 12);
    const bricksRaw = wallVol / brickVolWithMortar;
    const bricks = Math.ceil(bricksRaw * (1 + W / 100));
    const mortar = calcMortarForBricks({
      bricks,
      ratio: calc.ratio,
      wastagePct: parseFloat(calc.mortarWastage) || 0,
    });
    return { wallVol: wallVol.toFixed(2), bricks, bricksRaw: Math.ceil(bricksRaw), mortar };
  }, [calc]);

  const saveMaterial = () => {
    const qty = parseFloat(matForm.quantity);
    if (!qty || qty <= 0) {
      toast({ title: "मात्रा डालें", variant: "destructive" });
      return;
    }
    addMaterialEntry({
      date: matForm.date,
      kind: matForm.kind,
      entry_type: matForm.entry_type,
      quantity: qty,
      rate: parseFloat(matForm.rate) || 0,
      site_name: matForm.site_name.trim() || undefined,
      notes: matForm.notes.trim() || undefined,
    });
    toast({ title: "✅ entry जुड़ गई" });
    setMatOpen(false);
    setMatForm({ date: today(), kind: matForm.kind, entry_type: "In", quantity: "", rate: "", site_name: "", notes: "" });
    reloadMaterials();
  };

  const removeMaterial = (id: string) => {
    deleteMaterialEntry(id);
    toast({ title: "✅ हटा दिया" });
    reloadMaterials();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ईंट का स्टॉक</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCalcOpen(true)} className="gap-1">
            <Calculator className="w-4 h-4" /> calc
          </Button>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }} className="gap-1">
            <Plus className="w-4 h-4" /> entry
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">मौजूदा स्टॉक</p>
            <p className="text-lg font-bold text-primary">{totals.stock.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">कुल आई</p>
            <p className="text-lg font-bold text-accent">{totals.inQty.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">इस्तेमाल</p>
            <p className="text-lg font-bold text-destructive">{totals.outQty.toLocaleString()}</p>
          </div>
          <div className="col-span-3 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">कुल खर्च (खरीद)</p>
            <p className="text-base font-semibold">₹{totals.inCost.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">अभी कोई entry नहीं</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className={`p-2 rounded-full shrink-0 ${e.entry_type === "In" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
                    {e.entry_type === "In" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{e.quantity.toLocaleString()} ईंट</span>
                      {e.entry_type === "In" && Number(e.rate) > 0 && (
                        <span className="text-xs text-muted-foreground">@ ₹{e.rate}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("hi-IN", { day: "numeric", month: "short" })}
                      {e.site_name && ` • ${e.site_name}`}
                    </p>
                    {e.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{e.notes}</p>}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-2 rounded-full bg-destructive/10 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>entry हटाएं?</AlertDialogTitle>
                        <AlertDialogDescription>यह entry स्थायी रूप से हट जाएगी।</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>रहने दें</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">हटाएं</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>नई ईंट entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.entry_type === "In" ? "default" : "outline"}
                onClick={() => setForm({ ...form, entry_type: "In" })}
                className="gap-1"
              >
                <ArrowDownToLine className="w-4 h-4" /> आई
              </Button>
              <Button
                type="button"
                variant={form.entry_type === "Out" ? "default" : "outline"}
                onClick={() => setForm({ ...form, entry_type: "Out" })}
                className="gap-1"
              >
                <ArrowUpFromLine className="w-4 h-4" /> इस्तेमाल
              </Button>
            </div>
            <div>
              <Label>तारीख</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>साइट</Label>
              <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="साइट का नाम" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>मात्रा *</Label>
                <Input type="number" inputMode="numeric" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="1000" />
              </div>
              {form.entry_type === "In" && (
                <div>
                  <Label>rate (₹/ईंट)</Label>
                  <Input type="number" inputMode="decimal" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="8" />
                </div>
              )}
            </div>
            <div>
              <Label>नोट्स</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>रद्द</Button>
            <Button onClick={save} disabled={saving}>{saving ? "रुकें..." : "सेव"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ईंट Calculator */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" /> ईंट calculator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={calc.unit === "ft" ? "default" : "outline"}
                onClick={() => setCalc({ ...calc, unit: "ft" })}
              >
                फिट (ft)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={calc.unit === "m" ? "default" : "outline"}
                onClick={() => setCalc({ ...calc, unit: "m" })}
              >
                मीटर (m)
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>लम्बाई ({calc.unit})</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={calc.length}
                  onChange={(e) => setCalc({ ...calc, length: e.target.value })}
                  placeholder="50"
                />
              </div>
              <div>
                <Label>ऊंचाई ({calc.unit})</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={calc.height}
                  onChange={(e) => setCalc({ ...calc, height: e.target.value })}
                  placeholder="11"
                />
              </div>
            </div>
            <div>
              <Label>दीवार की मोटाई (इंच)</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { v: "4.5", l: '4.5"' },
                  { v: "9", l: '9"' },
                  { v: "13.5", l: '13.5"' },
                ].map((t) => (
                  <Button
                    key={t.v}
                    type="button"
                    size="sm"
                    variant={calc.thickness === t.v ? "default" : "outline"}
                    onClick={() => setCalc({ ...calc, thickness: t.v })}
                  >
                    {t.l}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>ईंट wastage (%)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={calc.wastage}
                  onChange={(e) => setCalc({ ...calc, wastage: e.target.value })}
                  placeholder="5"
                />
              </div>
              <div>
                <Label>mortar wastage (%)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={calc.mortarWastage}
                  onChange={(e) => setCalc({ ...calc, mortarWastage: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <Label>mortar अनुपात (cement : रेत)</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {MORTAR_RATIOS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={calc.ratio === r ? "default" : "outline"}
                    onClick={() => setCalc({ ...calc, ratio: r })}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            {calcResult ? (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">दीवार का आयतन</span>
                    <span className="font-medium">{calcResult.wallVol} cu.ft</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ईंट (बिना wastage)</span>
                    <span className="font-medium">{calcResult.bricksRaw.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-baseline">
                    <span className="text-sm font-semibold">कुल ईंट चाहिए</span>
                    <span className="text-2xl font-bold text-primary">
                      {calcResult.bricks.toLocaleString()}
                    </span>
                  </div>
                  {calcResult.mortar && (
                    <div className="border-t border-border pt-2 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">mortar (अनुपात {calcResult.mortar.ratio})</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">सीमेंट</span>
                        <span className="font-bold text-primary">{calcResult.mortar.cementBags} बैग (50kg)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">रेत</span>
                        <span className="font-bold text-primary">{calcResult.mortar.sandCFT} CFT</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground pt-1">
                    * मानक ईंट 9"×4.5"×3" + mortar gap, dry volume × 1.33 के हिसाब से
                  </p>
                </CardContent>
              </Card>
            ) : (
              <p className="text-xs text-center text-muted-foreground py-2">
                लम्बाई, ऊंचाई और मोटाई डालें
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcOpen(false)}>बंद</Button>
            {calcResult && (
              <Button
                onClick={() => {
                  setForm({ ...form, entry_type: "Out", quantity: String(calcResult.bricks), notes: `दीवार ${calc.length}×${calc.height} ${calc.unit}` });
                  setCalcOpen(false);
                  setOpen(true);
                }}
              >
                entry में डालें
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ===== Material (cement / sand) Stock ===== */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Package className="w-5 h-5" /> सीमेंट / रेत
          </h2>
          <Button size="sm" onClick={() => setMatOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> entry
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">सीमेंट स्टॉक</p>
              <p className="text-lg font-bold text-primary">{cementTotals.stock.toLocaleString()} <span className="text-xs font-normal">बैग</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">खर्च ₹{cementTotals.inCost.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">रेत स्टॉक</p>
              <p className="text-lg font-bold text-primary">{sandTotals.stock.toLocaleString()} <span className="text-xs font-normal">CFT</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">खर्च ₹{sandTotals.inCost.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {materials.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">अभी कोई material entry नहीं</p>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className={`p-2 rounded-full shrink-0 ${m.entry_type === "In" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
                    {m.entry_type === "In" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold capitalize">
                        {m.kind === "cement" ? "सीमेंट" : "रेत"} — {m.quantity.toLocaleString()} {m.kind === "cement" ? "बैग" : "CFT"}
                      </span>
                      {m.entry_type === "In" && m.rate > 0 && (
                        <span className="text-xs text-muted-foreground">@ ₹{m.rate}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.date).toLocaleDateString("hi-IN", { day: "numeric", month: "short" })}
                      {m.site_name && ` • ${m.site_name}`}
                    </p>
                    {m.notes && <p className="text-xs italic text-muted-foreground mt-0.5">{m.notes}</p>}
                  </div>
                  <button onClick={() => removeMaterial(m.id)} className="p-2 rounded-full bg-destructive/10 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Material entry dialog */}
      <Dialog open={matOpen} onOpenChange={setMatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>नई material entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={matForm.kind === "cement" ? "default" : "outline"}
                onClick={() => setMatForm({ ...matForm, kind: "cement" })}
              >
                सीमेंट (बैग)
              </Button>
              <Button
                type="button"
                variant={matForm.kind === "sand" ? "default" : "outline"}
                onClick={() => setMatForm({ ...matForm, kind: "sand" })}
              >
                रेत (CFT)
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={matForm.entry_type === "In" ? "default" : "outline"}
                onClick={() => setMatForm({ ...matForm, entry_type: "In" })}
                className="gap-1"
              >
                <ArrowDownToLine className="w-4 h-4" /> आई
              </Button>
              <Button
                type="button"
                variant={matForm.entry_type === "Out" ? "default" : "outline"}
                onClick={() => setMatForm({ ...matForm, entry_type: "Out" })}
                className="gap-1"
              >
                <ArrowUpFromLine className="w-4 h-4" /> इस्तेमाल
              </Button>
            </div>
            <div>
              <Label>तारीख</Label>
              <Input type="date" value={matForm.date} onChange={(e) => setMatForm({ ...matForm, date: e.target.value })} />
            </div>
            <div>
              <Label>साइट</Label>
              <Input value={matForm.site_name} onChange={(e) => setMatForm({ ...matForm, site_name: e.target.value })} placeholder="साइट का नाम" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>मात्रा * ({matForm.kind === "cement" ? "बैग" : "CFT"})</Label>
                <Input type="number" inputMode="decimal" value={matForm.quantity} onChange={(e) => setMatForm({ ...matForm, quantity: e.target.value })} placeholder={matForm.kind === "cement" ? "10" : "100"} />
              </div>
              {matForm.entry_type === "In" && (
                <div>
                  <Label>rate (₹/{matForm.kind === "cement" ? "बैग" : "CFT"})</Label>
                  <Input type="number" inputMode="decimal" step="0.01" value={matForm.rate} onChange={(e) => setMatForm({ ...matForm, rate: e.target.value })} placeholder={matForm.kind === "cement" ? "400" : "50"} />
                </div>
              )}
            </div>
            <div>
              <Label>नोट्स</Label>
              <Textarea rows={2} value={matForm.notes} onChange={(e) => setMatForm({ ...matForm, notes: e.target.value })} placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatOpen(false)}>रद्द</Button>
            <Button onClick={saveMaterial}>सेव</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
