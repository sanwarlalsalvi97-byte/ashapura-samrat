/**
 * Central Date Utility — Asia/Kolkata safe.
 *
 * The single source of truth for date handling across the app.
 * NEVER use `new Date().toISOString().slice(0, 10)` for calendar dates —
 * that returns UTC, which is off-by-one in India between 00:00 and 05:30 IST.
 *
 * Use `todayISO()` for "today's calendar date" and `toISODate(d)` for any Date.
 */

const IST_TIME_ZONE = "Asia/Kolkata";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Calendar date (YYYY-MM-DD) in Asia/Kolkata, independent of browser/UTC timezone. */
export function toISODate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's local calendar date in YYYY-MM-DD. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** First day of the given month in YYYY-MM-DD. */
export function monthStartISO(year: number, monthIndex0: number): string {
  return isoDateFromParts(year, monthIndex0, 1);
}

/** Last day of the given month in YYYY-MM-DD. */
export function monthEndISO(year: number, monthIndex0: number): string {
  return isoDateFromParts(year, monthIndex0, daysInMonth(year, monthIndex0));
}

/** ISO bounds for a given (year, monthIndex0). */
export function monthBoundsISO(year: number, monthIndex0: number) {
  return { startISO: monthStartISO(year, monthIndex0), endISO: monthEndISO(year, monthIndex0) };
}

/** Inclusive month bounds for date-string database columns. */
export function monthDateRangeISO(year: number, monthIndex0: number) {
  const { startISO, endISO } = monthBoundsISO(year, monthIndex0);
  return { startISO, endISO, startDateTimeIST: `${startISO}T00:00:00.000+05:30`, endDateTimeIST: `${endISO}T23:59:59.999+05:30` };
}

/** Number of days in a Gregorian month, independent of local timezone. */
export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0, 12)).getUTCDate();
}

/** Build YYYY-MM-DD directly from calendar parts. */
export function isoDateFromParts(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

/** Weekday for a Gregorian date in India: 0=Sunday ... 6=Saturday. */
export function weekdayOfISO(year: number, monthIndex0: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex0, day, 12)).getUTCDay();
}

/** Parse YYYY-MM-DD into a local Date at midnight (safe for calendar display). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) - 330 * 60_000);
}
