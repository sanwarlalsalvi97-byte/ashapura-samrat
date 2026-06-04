import { useState, useEffect, useMemo } from "react";
import { calcRcc, RCC_RATIOS, type Unit } from "@/lib/rcc-calc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Calculator } from "lucide-react";

export default function RoofPage() {
  const [unit, setUnit] = useState<Unit>("ft");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [thickness, setThickness] = useState("5");
  const [ratio, setRatio] = useState("1:1.5:3");
  const [customMode, setCustomMode] = useState(false);
  const [customC, setCustomC] = useState("1");
  const [customS, setCustomS] = useState("2");
  const [customA, setCustomA] = useState("4");
  const [wastage, setWastage] = useState("5");
  const [steel, setSteel] = useState("3.5");

  const effectiveRatio = useMemo(() => {
    if (!customMode) return ratio;
    const c = parseFloat(customC), s = parseFloat(customS), a = parseFloat(customA);
    if (!c || !s || !a) return ratio;
    return `${c}:${s}:${a}`;
  }, [customMode, customC, customS, customA, ratio]);

  const result = useMemo(() => calcRcc({
    length: parseFloat(length),
    width: parseFloat(width),
    thicknessIn: parseFloat(thickness),
    unit,
    ratio: effectiveRatio,
    wastagePct: parseFloat(wastage) || 0,
    steelKgPerCft: parseFloat(steel) || 0,
  }), [length, width, thickness, unit, effectiveRatio, wastage, steel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Home className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">छत गणना (RCC slab)</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant={unit === "ft" ? "default" : "outline"} onClick={() => setUnit("ft")}>फिट (ft)</Button>
            <Button size="sm" variant={unit === "m" ? "default" : "outline"} onClick={() => setUnit("m")}>मीटर (m)</Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>लम्बाई ({unit})</Label>
              <Input type="number" inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="30" />
            </div>
            <div>
              <Label>चौड़ाई ({unit})</Label>
              <Input type="number" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="20" />
            </div>
          </div>

          <div>
            <Label>छत की मोटाई (इंच)</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["4", "4.5", "5", "6"].map((t) => (
                <Button key={t} size="sm" variant={thickness === t ? "default" : "outline"} onClick={() => setThickness(t)}>{t}"</Button>
              ))}
            </div>
          </div>

          <div>
            <Label>कंक्रीट ग्रेड</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {RCC_RATIOS.map((r) => (
                <Button key={r.v} size="sm" variant={ratio === r.v ? "default" : "outline"} onClick={() => setRatio(r.v)} className="text-[11px] px-1">
                  {r.l}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>wastage (%)</Label>
              <Input type="number" inputMode="decimal" value={wastage} onChange={(e) => setWastage(e.target.value)} />
            </div>
            <div>
              <Label>सरिया (kg/cft)</Label>
              <Input type="number" inputMode="decimal" value={steel} onChange={(e) => setSteel(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">क्षेत्रफल</p>
                <p className="text-lg font-bold text-primary">{result.areaSqFt.toLocaleString()} <span className="text-xs font-normal">sq.ft</span></p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">कंक्रीट आयतन</p>
                <p className="text-lg font-bold text-primary">{result.volumeCft.toLocaleString()} <span className="text-xs font-normal">cft</span></p>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">मटेरियल अनुमान (ग्रेड {result.ratio})</p>
              <Row label="सीमेंट" value={`${result.cementBags} बैग (50kg)`} />
              <Row label="रेत" value={`${result.sandCft} CFT`} />
              <Row label="गिट्टी (aggregate)" value={`${result.aggregateCft} CFT`} />
              <Row label="सरिया (steel)" value={`~${result.steelKg.toLocaleString()} kg`} />
            </div>

            <p className="text-[10px] text-muted-foreground pt-1">
              * dry volume × 1.54, सरिया slab में लगभग 1% by volume मानकर। असली ज़रूरत डिज़ाइन पर निर्भर।
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Calculator className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">लम्बाई, चौड़ाई, मोटाई डालें</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-primary">{value}</span>
    </div>
  );
}
