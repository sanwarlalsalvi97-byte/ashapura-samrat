// Hindu calendar helpers — backed by the same no-cache Panchang engine as the Home widget.

import { computePanchang } from "@/lib/panchang";

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

export function approxTithi(d: Date): TithiInfo {
  const p = computePanchang(d);
  const paksha = p.paksha.replace(" पक्ष", "");
  const name = p.tithi;
  let kind: TithiKind = "normal";
  if (p.isEkadashi) kind = "ekadashi";
  else if (p.isPurnima) kind = "purnima";
  else if (p.isAmavasya) kind = "amavasya";
  const festival = p.festival;
  const vaar = p.vaar;
  const masa = p.masa;
  const full = `${paksha} ${name}`;
  const panchang = `${vaar}, ${masa} ${full}`;

  return { paksha, name, full, vaar, masa, panchang, kind, festival };
}

/* ---------------- No cache: always recompute from selected date ---------------- */

// Purge any legacy cache the app previously wrote.
try { localStorage.removeItem("tithi-cache-v2"); localStorage.removeItem("tithi-cache-v1"); } catch {}

export async function getTithi(d: Date): Promise<TithiInfo> {
  // Deterministic, timezone-safe, no network, no cache.
  return approxTithi(d);
}
