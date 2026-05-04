// Cement / sand estimator for brick masonry mortar.
//
// Inputs:
//   bricks   - number of bricks
//   ratio    - mortar mix, e.g. "1:6" (cement:sand)
//   wastage  - % wastage to add (default 10)
//
// Standard assumptions (Indian construction practice):
//   - Brick size with mortar: 9.5" x 4.75" x 3.25"  (≈ 0.001436 cu.m / brick)
//   - Brick size without mortar: 9" x 4.5" x 3"     (≈ 0.001215 cu.m / brick)
//   - Mortar volume per brick (wet) = withMortar - withoutMortar
//   - Dry mortar volume = wet * 1.33 (bulking)
//   - 1 bag cement = 50 kg = 0.0347 cu.m
//   - 1 cu.m = 35.3147 cu.ft
//
// Output: cement in 50kg bags, sand in CFT (cubic feet)

const CU_M_PER_CFT = 1 / 35.3147;
const CEMENT_BAG_VOL_CU_M = 0.0347;

export interface MortarInput {
  bricks: number;
  ratio: string; // "1:4" | "1:5" | "1:6"
  wastagePct?: number;
}

export interface MortarResult {
  mortarWetCuM: number;
  mortarDryCuM: number;
  cementBags: number;
  sandCFT: number;
  ratio: string;
}

export function calcMortarForBricks({ bricks, ratio, wastagePct = 10 }: MortarInput): MortarResult | null {
  if (!bricks || bricks <= 0) return null;
  const parts = ratio.split(":").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [c, s] = parts;
  const sumParts = c + s;

  const inchToM = 0.0254;
  const brickWith = 9.5 * inchToM * 4.75 * inchToM * 3.25 * inchToM;
  const brickWithout = 9 * inchToM * 4.5 * inchToM * 3 * inchToM;
  const mortarPerBrickWet = brickWith - brickWithout;

  const wetVol = bricks * mortarPerBrickWet;
  const wetWithWastage = wetVol * (1 + wastagePct / 100);
  const dryVol = wetWithWastage * 1.33;

  const cementVolCuM = (dryVol * c) / sumParts;
  const sandVolCuM = (dryVol * s) / sumParts;

  const cementBags = cementVolCuM / CEMENT_BAG_VOL_CU_M;
  const sandCFT = sandVolCuM / CU_M_PER_CFT;

  return {
    mortarWetCuM: wetWithWastage,
    mortarDryCuM: dryVol,
    cementBags: Math.ceil(cementBags * 10) / 10, // 1 decimal
    sandCFT: Math.ceil(sandCFT * 10) / 10,
    ratio,
  };
}
