// Hindu calendar helpers — Tithi + Vaar (weekday) + Masa (lunar month) + Festival.
// Offline approximate; optional remote API attempted with cache.

const TITHI = [
  "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी",
  "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
  "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा/अमावस्या",
];

const VAAR = [
  "रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार",
];

// Approximate mapping of Gregorian month → dominant Hindu (Purnimanta) masa.
const MASA_BY_MONTH = [
  "पौष",     // Jan
  "माघ",     // Feb
  "फाल्गुन", // Mar
  "चैत्र",   // Apr
  "वैशाख",   // May
  "ज्येष्ठ", // Jun
  "आषाढ़",   // Jul
  "श्रावण",   // Aug
  "भाद्रपद", // Sep
  "आश्विन",  // Oct
  "कार्तिक", // Nov
  "मार्गशीर्ष", // Dec
];

export type TithiKind = "ekadashi" | "purnima" | "amavasya" | "normal";

export interface TithiInfo {
  paksha: string;    // शुक्ल / कृष्ण
  name: string;      // तिथि नाम
  full: string;      // "शुक्ल एकादशी"
  vaar: string;      // सोमवार
  masa: string;      // आषाढ़
  panchang: string;  // "सोमवार, आषाढ़ शुक्ल पंचमी"
  kind: TithiKind;
  festival?: string;
}

const FIXED_FESTIVALS: Record<string, string> = {
  "01-01": "नव वर्ष",
  "01-14": "मकर संक्रांति",
  "01-26": "गणतंत्र दिवस",
  "08-15": "स्वतंत्रता दिवस",
  "10-02": "गांधी जयंती",
  "12-25": "क्रिसमस",
};

export function approxTithi(d: Date): TithiInfo {
  // Reference: New Moon ~ 2000-01-06 18:14 UTC
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
  const days = (d.getTime() - ref) / 86400000;
  const phase = ((days % 29.53) + 29.53) % 29.53;
  const paksha = phase < 14.765 ? "शुक्ल" : "कृष्ण";
  const idx = Math.floor((phase % 14.765) / (14.765 / 15));
  const tIdx = Math.min(idx, 14);
  const name = TITHI[tIdx];

  let kind: TithiKind = "normal";
  let festival: string | undefined;

  if (tIdx === 10) {
    kind = "ekadashi";
    festival = paksha === "शुक्ल" ? "शुक्ल एकादशी" : "कृष्ण एकादशी";
  } else if (tIdx === 14) {
    if (paksha === "शुक्ल") { kind = "purnima"; festival = "पूर्णिमा"; }
    else { kind = "amavasya"; festival = "अमावस्या"; }
  }

  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (FIXED_FESTIVALS[mmdd]) {
    festival = festival ? `${FIXED_FESTIVALS[mmdd]} • ${festival}` : FIXED_FESTIVALS[mmdd];
  }

  const vaar = VAAR[d.getDay()];
  const masa = MASA_BY_MONTH[d.getMonth()];
  const full = `${paksha} ${name}`;
  const panchang = `${vaar}, ${masa} ${full}`;

  return { paksha, name, full, vaar, masa, panchang, kind, festival };
}

/* ---------------- API + cache layer ---------------- */

const CACHE_KEY = "tithi-cache-v2";

type CacheMap = Record<string, TithiInfo>;

function readCache(): CacheMap {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeCache(c: CacheMap) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getTithi(d: Date): Promise<TithiInfo> {
  const key = isoDate(d);
  const cache = readCache();
  if (cache[key]) return cache[key];

  const offline = approxTithi(d);
  cache[key] = offline;
  writeCache(cache);

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch(`https://api.drk7.in/vedic-calendar/tithi?date=${key}`, { signal: ctl.signal });
    clearTimeout(t);
    if (res.ok) {
      const j: any = await res.json();
      const tName: string | undefined = j?.tithi || j?.data?.tithi;
      const fest: string | undefined = j?.festival || j?.data?.festival;
      if (tName) {
        const merged: TithiInfo = {
          ...offline,
          name: tName,
          full: `${offline.paksha} ${tName}`,
          panchang: `${offline.vaar}, ${offline.masa} ${offline.paksha} ${tName}`,
          festival: fest || offline.festival,
        };
        cache[key] = merged;
        writeCache(cache);
        return merged;
      }
    }
  } catch {}
  return offline;
}
