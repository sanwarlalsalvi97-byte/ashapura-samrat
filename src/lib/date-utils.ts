/**
 * Central Date Utility — Asia/Kolkata safe.
 *
 * The single source of truth for date handling across the app.
 * NEVER use `new Date().toISOString().slice(0, 10)` for calendar dates —
 * that returns UTC, which is off-by-one in India between 00:00 and 05:30 IST.
 *
 * Use `todayISO()` for "today's calendar date" and `toISODate(d)` for any Date.
 */

/** Local calendar date (YYYY-MM-DD) using the browser's local timezone. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's local calendar date in YYYY-MM-DD. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** First day of the given month in YYYY-MM-DD. */
export function monthStartISO(year: number, monthIndex0: number): string {
  return toISODate(new Date(year, monthIndex0, 1));
}

/** Last day of the given month in YYYY-MM-DD. */
export function monthEndISO(year: number, monthIndex0: number): string {
  return toISODate(new Date(year, monthIndex0 + 1, 0));
}

/** ISO bounds for a given (year, monthIndex0). */
export function monthBoundsISO(year: number, monthIndex0: number) {
  return { startISO: monthStartISO(year, monthIndex0), endISO: monthEndISO(year, monthIndex0) };
}

/** Parse YYYY-MM-DD into a local Date at midnight (safe for calendar display). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
