// Simple PIN lock. PIN is hashed (SHA-256) with a device salt and stored in localStorage.
// Not a security boundary against a determined attacker — a convenience gate on top of auth.

const PIN_HASH_KEY = "app-pin-hash-v1";
const PIN_SALT_KEY = "app-pin-salt-v1";
const PIN_UNLOCKED_KEY = "app-pin-unlocked-v1";

function getSalt(): string {
  let s = localStorage.getItem(PIN_SALT_KEY);
  if (!s) {
    s = crypto.getRandomValues(new Uint8Array(16)).join("-");
    localStorage.setItem(PIN_SALT_KEY, s);
  }
  return s;
}

async function hash(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(getSalt() + ":" + pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPinEnabled(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4-8 digits");
  const h = await hash(pin);
  localStorage.setItem(PIN_HASH_KEY, h);
  sessionStorage.setItem(PIN_UNLOCKED_KEY, "1");
}

export function removePin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return true;
  const h = await hash(pin);
  const ok = h === stored;
  if (ok) sessionStorage.setItem(PIN_UNLOCKED_KEY, "1");
  return ok;
}

export function isUnlocked(): boolean {
  if (!isPinEnabled()) return true;
  return sessionStorage.getItem(PIN_UNLOCKED_KEY) === "1";
}

export function lock(): void {
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
}
