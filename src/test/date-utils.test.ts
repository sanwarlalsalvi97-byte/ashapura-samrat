import { describe, expect, it } from "vitest";
import { daysInMonth, isoDateFromParts, monthBoundsISO } from "@/lib/date-utils";

describe("Asia/Kolkata month bounds", () => {
  it.each([
    [2026, 0, 31],
    [2026, 1, 28],
    [2024, 1, 29],
    [2026, 3, 30],
    [2026, 4, 31],
    [2026, 5, 30],
    [2026, 6, 31],
    [2026, 7, 31],
    [2026, 8, 30],
    [2026, 9, 31],
    [2026, 10, 30],
    [2026, 11, 31],
  ])("includes final day for %d-%d", (year, monthIndex0, lastDay) => {
    const { startISO, endISO } = monthBoundsISO(year, monthIndex0);
    expect(startISO).toBe(isoDateFromParts(year, monthIndex0, 1));
    expect(endISO).toBe(isoDateFromParts(year, monthIndex0, lastDay));
    expect(daysInMonth(year, monthIndex0)).toBe(lastDay);
    expect(isoDateFromParts(year, monthIndex0, lastDay) <= endISO).toBe(true);
  });
});