import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Droplets, Filter, Package, Search, Truck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { parseISODate, todayISO, toISODate } from "@/lib/date-utils";
import { getActiveSite, listSites } from "@/lib/sites";
import { cn } from "@/lib/utils";

type MaterialEntry = Database["public"]["Tables"]["material_entries"]["Row"];
type MaterialType = "sand" | "aggregate" | "cement" | "water" | "steel" | "other";
type MaterialUnit = "bags" | "tons" | "trips" | "cft" | "liters" | "kg" | "pieces";
type PaymentStatus = "paid" | "unpaid" | "partial";

const MATERIALS: Array<{ value: MaterialType; label: string }> = [
  { value: "sand", label: "रेती / रेत" },
  { value: "aggregate", label: "गिट्टी / पत्थर" },
  { value: "cement", label: "सीमेंट" },
  { value: "water", label: "पानी / टैंकर" },
  { value: "steel", label: "सरिया / लोहा" },
  { value: "other", label: "अन्य" },
];

const UNITS: Record<MaterialType, MaterialUnit[]> = {
  sand: ["cft", "tons", "trips"],
  aggregate: ["cft", "tons", "trips"],
  cement: ["bags", "tons", "kg"],
  water: ["trips", "liters"],
  steel: ["kg", "tons", "pieces"],
  other: ["pieces", "kg", "tons", "trips", "cft", "liters", "bags"],
};

const UNIT_LABELS: Record<MaterialUnit, string> = {
  bags: "बोरी / Bags",
  tons: "टन / Tons",
  trips: "ट्रिप / Trips",
  cft: "क्यूबिक फीट / CFT",
  liters: "लीटर / Liters",
  kg: "किलो / Kg",
  pieces: "नग / Pieces",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: "नकद (Paid)",
  unpaid: "उधार (Unpaid)",
  partial: "आंशिक (Partial)",
};

const formSchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  site_name: z.string().trim().min(1, "साइट चुनें").max(120),
  material_type: z.enum(["sand", "aggregate", "cement", "water", "steel", "other"]),
  quantity: z.coerce.number().positive("सही मात्रा डालें").max(9999999999),
  unit: z.enum(["bags", "tons", "trips", "cft", "liters", "kg", "pieces"]),
  supplier_vehicle: z.string().trim().max(160, "सप्लायर / गाड़ी नंबर बहुत लंबा है"),
  total_amount: z.coerce.number().min(0, "राशि 0 से कम नहीं हो सकती").max(9999999999),
  payment_status: z.enum(["paid", "unpaid", "partial"]),
});

const emptyForm = () => {
  const activeSite = getActiveSite();
  return {
    entry_date: todayISO(),
    site_name: activeSite?.name ?? "",
    material_type: "cement" as MaterialType,
    quantity: "",
    unit: "bags" as MaterialUnit,
    supplier_vehicle: "",
    total_amount: "",
    payment_status: "unpaid" as PaymentStatus,
  };
};

export default function MaterialEntryPage() {
  const [entries, setEntries] = useState<MaterialEntry[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const sites = useMemo(() => listSites().filter((site) => site.isActive), []);

  const loadEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("material_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "मटीरियल आवक लोड नहीं हुई", description: "कृपया दोबारा कोशिश करें।", variant: "destructive" });
    } else {
      setEntries(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadEntries();
  }, []);

  const availableUnits = UNITS[form.material_type];

  const summaries = useMemo(() => ({
    cementBags: entries
      .filter((entry) => entry.material_type === "cement" && entry.unit === "bags")
      .reduce((total, entry) => total + Number(entry.quantity), 0),
    sandStoneCft: entries
      .filter((entry) => ["sand", "aggregate"].includes(entry.material_type) && entry.unit === "cft")
      .reduce((total, entry) => total + Number(entry.quantity), 0),
    waterTrips: entries
      .filter((entry) => entry.material_type === "water" && entry.unit === "trips")
      .reduce((total, entry) => total + Number(entry.quantity), 0),
  }), [entries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("hi-IN");
    return entries.filter((entry) => {
      if (materialFilter !== "all" && entry.material_type !== materialFilter) return false;
      if (siteFilter !== "all" && entry.site_name !== siteFilter) return false;
      if (!query) return true;
      const material = MATERIALS.find((item) => item.value === entry.material_type)?.label ?? entry.material_type;
      return [material, entry.site_name, entry.supplier_vehicle ?? ""].some((value) => value.toLocaleLowerCase("hi-IN").includes(query));
    });
  }, [entries, materialFilter, search, siteFilter]);

  const saveEntry = async () => {
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "जानकारी पूरी करें", description: parsed.error.issues[0]?.message ?? "सभी जरूरी जानकारी भरें।", variant: "destructive" });
      return;
    }
    if (!UNITS[parsed.data.material_type].includes(parsed.data.unit)) {
      toast({ title: "मटीरियल के अनुसार सही इकाई चुनें", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast({ title: "सेशन समाप्त हो गया", description: "कृपया फिर से लॉगिन करें।", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("material_entries").insert({
      user_id: authData.user.id,
      entry_date: parsed.data.entry_date,
      site_name: parsed.data.site_name,
      material_type: parsed.data.material_type,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      supplier_vehicle: parsed.data.supplier_vehicle || null,
      total_amount: parsed.data.total_amount,
      payment_status: parsed.data.payment_status,
    });
    if (error) {
      toast({ title: "मटीरियल आवक सेव नहीं हुई", description: "कृपया जानकारी जाँचकर दोबारा कोशिश करें।", variant: "destructive" });
    } else {
      toast({ title: "मटीरियल आवक सेव हो गई" });
      setForm(emptyForm());
      await loadEntries();
    }
    setSaving(false);
  };

  const updateMaterial = (material: MaterialType) => {
    setForm((current) => ({ ...current, material_type: material, unit: UNITS[material][0] }));
  };

  return (
    <div className="space-y-4 pb-24 animate-fade-in">
      <div>
        <h2 className="text-xl font-extrabold">मटीरियल एंट्री</h2>
        <p className="text-sm text-muted-foreground">साइट पर आई सामग्री और भुगतान का रिकॉर्ड</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Summary icon={Package} label="सीमेंट" value={summaries.cementBags} unit="बैग" />
        <Summary icon={Truck} label="रेत / गिट्टी" value={summaries.sandStoneCft} unit="CFT" />
        <Summary icon={Droplets} label="पानी" value={summaries.waterTrips} unit="ट्रिप" />
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold">नई मटीरियल आवक</h3>
          <p className="text-xs text-muted-foreground">* वाली जानकारी जरूरी है</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>तारीख *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  <CalendarIcon className="h-4 w-4" />
                  {format(parseISODate(form.entry_date), "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISODate(form.entry_date)}
                  onSelect={(date) => date && setForm((current) => ({ ...current, entry_date: toISODate(date) }))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>साइट चुनें *</Label>
            <Select value={form.site_name} onValueChange={(value) => setForm((current) => ({ ...current, site_name: value }))}>
              <SelectTrigger><SelectValue placeholder="चालू साइट चुनें" /></SelectTrigger>
              <SelectContent>
                {sites.map((site) => <SelectItem key={site.id} value={site.name}>{site.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {sites.length === 0 && <p className="text-xs text-destructive">पहले साइट प्रबंधन में चालू साइट जोड़ें।</p>}
          </div>

          <div className="space-y-1.5">
            <Label>मटीरियल का प्रकार *</Label>
            <Select value={form.material_type} onValueChange={(value: MaterialType) => updateMaterial(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MATERIALS.map((material) => <SelectItem key={material.value} value={material.value}>{material.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="material-quantity">मात्रा *</Label>
              <Input id="material-quantity" type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>इकाई *</Label>
              <Select value={form.unit} onValueChange={(value: MaterialUnit) => setForm((current) => ({ ...current, unit: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => <SelectItem key={unit} value={unit}>{UNIT_LABELS[unit]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier-vehicle">सप्लायर / गाड़ी नंबर</Label>
            <Input id="supplier-vehicle" maxLength={160} value={form.supplier_vehicle} onChange={(event) => setForm((current) => ({ ...current, supplier_vehicle: event.target.value }))} placeholder="जैसे: RJ14 XX XXXX" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-amount">कुल राशि (₹) *</Label>
            <Input id="material-amount" type="number" min="0" step="0.01" value={form.total_amount} onChange={(event) => setForm((current) => ({ ...current, total_amount: event.target.value }))} placeholder="0" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>भुगतान स्थिति *</Label>
          <RadioGroup value={form.payment_status} onValueChange={(value: PaymentStatus) => setForm((current) => ({ ...current, payment_status: value }))} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(PAYMENT_LABELS) as PaymentStatus[]).map((status) => (
              <Label key={status} htmlFor={`payment-${status}`} className={cn("flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 cursor-pointer", form.payment_status === status && "border-primary bg-primary/5")}>
                <RadioGroupItem value={status} id={`payment-${status}`} />
                <span className="text-sm font-medium">{PAYMENT_LABELS[status]}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <Button className="w-full" onClick={saveEntry} disabled={saving || sites.length === 0}>
          {saving ? "सेव हो रहा है..." : "मटीरियल आवक सेव करें"}
        </Button>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-bold">हाल ही की मटीरियल आवक</h3>
          <p className="text-xs text-muted-foreground">{filteredEntries.length} रिकॉर्ड</p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="मटीरियल, साइट या गाड़ी खोजें" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={materialFilter} onValueChange={setMaterialFilter}>
              <SelectTrigger><Filter className="h-4 w-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सभी मटीरियल</SelectItem>
                {MATERIALS.map((material) => <SelectItem key={material.value} value={material.value}>{material.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सभी साइट</SelectItem>
                {Array.from(new Set(entries.map((entry) => entry.site_name))).map((site) => <SelectItem key={site} value={site}>{site}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">लोड हो रहा है...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-9 w-9 opacity-40" />
            <p className="text-sm font-medium">कोई मटीरियल आवक नहीं मिली</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => {
              const material = MATERIALS.find((item) => item.value === entry.material_type)?.label ?? entry.material_type;
              return (
                <Card key={entry.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold truncate">{material}</p>
                        <p className="text-sm text-muted-foreground truncate">{entry.site_name}{entry.supplier_vehicle ? ` • ${entry.supplier_vehicle}` : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold tabular-nums">{Number(entry.quantity).toLocaleString("hi-IN")} {UNIT_LABELS[entry.unit as MaterialUnit]?.split(" / ")[0] ?? entry.unit}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISODate(entry.entry_date), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
                      <span className={cn("font-semibold", entry.payment_status === "paid" ? "text-accent" : entry.payment_status === "partial" ? "text-warning" : "text-destructive")}>{PAYMENT_LABELS[entry.payment_status as PaymentStatus] ?? entry.payment_status}</span>
                      <span className="font-bold tabular-nums">₹{Number(entry.total_amount).toLocaleString("hi-IN")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ icon: Icon, label, value, unit }: { icon: typeof Package; label: string; value: number; unit: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <Icon className="mx-auto mb-1 h-5 w-5 text-primary" />
        <p className="text-lg font-extrabold tabular-nums leading-tight">{value.toLocaleString("hi-IN")}</p>
        <p className="text-[10px] font-semibold text-muted-foreground">{label} · {unit}</p>
      </CardContent>
    </Card>
  );
}