// छत (RCC slab) calculator — सीमेंट / रेत / गिट्टी / सरिया अनुमान
//
// Inputs:
//   length, width — feet या मीटर
//   thickness     — inches (आम तौर पर 4-6")
//   ratio         — "1:1.5:3" (M20) या "1:1:2" (M25)
//   steelKgPerCft — सरिया अनुमान (default 3.5 kg/cft slab — 1% by volume)
//   wastagePct    — default 5%
//
// Outputs:
//   areaSqFt, volumeCft, cementBags (50kg), sandCft, aggregateCft, steelKg

const CU_M_PER_CFT = 1 / 35.3147;
const CEMENT_BAG_VOL_CU_M = 0.0347;

export type Unit = "ft" | "m";

export interface RccInput {
  length: number;
  width: number;
  thicknessIn: number;
  unit: Unit;
  ratio: string; // "1:1.5:3"
  wastagePct?: number;
  steelKgPerCft?: number;
}

export interface RccResult {
  areaSqFt: number;
  volumeCft: number;
  volumeCuM: number;
  cementBags: number;
  sandCft: number;
  aggregateCft: number;
  steelKg: number;
  ratio: string;
}

export const RCC_RATIOS = [
  { v: "1:1.5:3", l: "M20 (1:1.5:3)" },
  { v: "1:1:2", l: "M25 (1:1:2)" },
  { v: "1:2:4", l: "M15 (1:2:4)" },
];

export function calcRcc({
  length, width, thicknessIn, unit, ratio,
  wastagePct = 5, steelKgPerCft = 3.5,
}: RccInput): RccResult | null {
  if (!length || !width || !thicknessIn) return null;
  const parts = ratio.split(":").map((s) => parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !n)) return null;
  const [c, s, a] = parts;
  const sum = c + s + a;

  const Lft = unit === "m" ? length * 3.28084 : length;
  const Wft = unit === "m" ? width * 3.28084 : width;
  const Tft = thicknessIn / 12;

  const areaSqFt = Lft * Wft;
  const wetVolCft = areaSqFt * Tft;
  const wetVolCuM = wetVolCft * CU_M_PER_CFT;

  // Dry volume = wet × 1.54 (standard for concrete)
  const dryVolCuM = wetVolCuM * 1.54 * (1 + wastagePct / 100);

  const cementCuM = (dryVolCuM * c) / sum;
  const sandCuM = (dryVolCuM * s) / sum;
  const aggCuM = (dryVolCuM * a) / sum;

  const cementBags = cementCuM / CEMENT_BAG_VOL_CU_M;
  const sandCft = sandCuM / CU_M_PER_CFT;
  const aggCft = aggCuM / CU_M_PER_CFT;
  const steelKg = wetVolCft * steelKgPerCft;

  return {
    areaSqFt: Math.round(areaSqFt * 10) / 10,
    volumeCft: Math.round(wetVolCft * 10) / 10,
    volumeCuM: Math.round(wetVolCuM * 100) / 100,
    cementBags: Math.ceil(cementBags * 10) / 10,
    sandCft: Math.ceil(sandCft * 10) / 10,
    aggregateCft: Math.ceil(aggCft * 10) / 10,
    steelKg: Math.ceil(steelKg),
    ratio,
  };
}
