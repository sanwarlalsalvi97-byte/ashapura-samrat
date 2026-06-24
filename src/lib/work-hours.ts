// Time helpers for IN/OUT + OT calculation.

export const STANDARD_HOURS = 8;
export const HALF_DAY_HOURS = 4;

/** "HH:MM" -> minutes since midnight. Returns null on bad input. */
export function timeToMinutes(t?: string | null): number | null {
  if (!t || typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** Total hours between in/out (decimal, 2 dp). 0 if invalid or out<=in. */
export function calcHours(inT?: string | null, outT?: string | null): number {
  const a = timeToMinutes(inT);
  const b = timeToMinutes(outT);
  if (a == null || b == null) return 0;
  if (b <= a) return 0;
  return +((b - a) / 60).toFixed(2);
}

/** Split total into { regular, overtime } using 8h standard. */
export function splitOT(totalHours: number): { regular: number; overtime: number } {
  if (totalHours <= 0) return { regular: 0, overtime: 0 };
  if (totalHours <= STANDARD_HOURS) return { regular: totalHours, overtime: 0 };
  return { regular: STANDARD_HOURS, overtime: +(totalHours - STANDARD_HOURS).toFixed(2) };
}

/** Format 24h "HH:MM" -> "9:00 AM". */
export function fmt12(t?: string | null): string {
  const m = timeToMinutes(t);
  if (m == null) return "—";
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(mm).padStart(2, "0")} ${ap}`;
}

/** Format hours decimal "9" or "8.5" -> "9h" or "8h 30m" */
export function fmtHours(h: number): string {
  if (!h || h <= 0) return "0h";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}
