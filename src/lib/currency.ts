/** Parse decimal rupees without multiplying a floating-point fraction. */
export function parseRupeesToPaise(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function formatPaise(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error("Invalid currency amount");
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}