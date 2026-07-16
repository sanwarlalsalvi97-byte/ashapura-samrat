import { supabase } from "@/integrations/supabase/client";

const TABLES = [
  "workers",
  "attendance",
  "worker_expenses",
  "cashbook",
  "brick_stock",
  "contractors",
  "payment_history",
] as const;

export type BackupPayload = {
  version: 1;
  app: "AshapuraSamrat";
  createdAt: string;
  user: { id: string; email: string | null };
  data: Record<string, any[]>;
  preferences: Record<string, string | null>;
};

const PREF_KEYS = [
  "hajiri-lang",
  "hajiri-default-rate",
  "hajiri-theme",
  "hajiri-font-size",
  "hajiri-work-time",
  "hajiri-grouping",
];

export function backupFilename(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `AshapuraSamrat_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

export async function buildBackup(): Promise<BackupPayload> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const data: Record<string, any[]> = {};
  for (const t of TABLES) {
    const { data: rows, error } = await supabase.from(t as any).select("*").eq("user_id", user.id);
    if (error) throw new Error(`${t}: ${error.message}`);
    data[t] = rows || [];
  }
  const preferences: Record<string, string | null> = {};
  PREF_KEYS.forEach((k) => (preferences[k] = localStorage.getItem(k)));
  return {
    version: 1,
    app: "AshapuraSamrat",
    createdAt: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null },
    data,
    preferences,
  };
}

/* ---------------- AES-GCM encryption with password (PBKDF2) ---------------- */

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}

/**
 * Passwordless backup: writes plain JSON with a stable envelope so future
 * versions can add encryption without breaking existing files. Legacy
 * encrypted files are still readable via `decryptBackup`.
 */
export async function encryptBackup(payload: BackupPayload, _password?: string): Promise<string> {
  const envelope = {
    format: "AshapuraSamrat-Backup-v1",
    createdAt: payload.createdAt,
    counts: Object.fromEntries(Object.entries(payload.data).map(([k, v]) => [k, v.length])),
    encrypted: false,
    payload,
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptBackup(fileText: string, password: string = ""): Promise<BackupPayload> {
  const env = JSON.parse(fileText);
  if (!env) throw new Error("Invalid backup file");

  // New passwordless envelope
  if (env.format === "AshapuraSamrat-Backup-v1" && env.payload?.app === "AshapuraSamrat") {
    return env.payload as BackupPayload;
  }

  // Plain legacy dump
  if (env.app === "AshapuraSamrat" && env.version === 1) {
    return env as BackupPayload;
  }

  // Legacy AES-GCM encrypted backup
  if (env.format === "AshapuraSamrat-EncryptedBackup-v1") {
    if (!password) throw new Error("यह पुराना एन्क्रिप्टेड बैकअप है — पासवर्ड ज़रूरी है / Legacy encrypted backup — password required");
    const salt = fromB64(env.salt);
    const iv = fromB64(env.iv);
    const ct = fromB64(env.ciphertext);
    const key = await deriveKey(password, salt);
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource);
      const text = new TextDecoder().decode(pt);
      const payload = JSON.parse(text) as BackupPayload;
      if (payload?.app !== "AshapuraSamrat") throw new Error("Corrupt backup");
      return payload;
    } catch {
      throw new Error("गलत पासवर्ड या फ़ाइल खराब है / Wrong password or corrupted file");
    }
  }
  throw new Error("Invalid backup file");
}

export function previewEnvelope(fileText: string): { createdAt?: string; counts?: Record<string, number>; encrypted: boolean } {
  try {
    const env = JSON.parse(fileText);
    if (env?.format === "AshapuraSamrat-Backup-v1") {
      return { createdAt: env.createdAt, counts: env.counts, encrypted: false };
    }
    if (env?.format === "AshapuraSamrat-EncryptedBackup-v1") {
      return { createdAt: env.createdAt, counts: env.counts, encrypted: true };
    }
    if (env?.app === "AshapuraSamrat") {
      const counts: Record<string, number> = {};
      Object.entries(env.data || {}).forEach(([k, v]) => (counts[k] = (v as any[]).length));
      return { createdAt: env.createdAt, counts, encrypted: false };
    }
  } catch {}
  return { encrypted: false };
}

/** Deletes the user's rows across all tables, then inserts backup rows. */
export async function restoreBackup(payload: BackupPayload): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  // Delete existing user data (child tables first)
  const order = [
    "payment_history",
    "attendance",
    "worker_expenses",
    "cashbook",
    "brick_stock",
    "contractors",
    "workers",
  ];
  for (const t of order) {
    const { error } = await supabase.from(t as any).delete().eq("user_id", user.id);
    if (error) throw new Error(`${t} delete: ${error.message}`);
  }

  // Insert in dependency-safe order (parents first)
  const insertOrder = [
    "workers",
    "contractors",
    "brick_stock",
    "cashbook",
    "worker_expenses",
    "attendance",
    "payment_history",
  ];
  for (const t of insertOrder) {
    const rows = (payload.data?.[t] || []).map((r: any) => ({ ...r, user_id: user.id }));
    if (rows.length === 0) continue;
    // Insert in batches
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase.from(t as any).insert(batch);
      if (error) throw new Error(`${t} insert: ${error.message}`);
    }
  }

  // Restore preferences
  if (payload.preferences) {
    for (const [k, v] of Object.entries(payload.preferences)) {
      if (v != null) localStorage.setItem(k, v);
    }
  }
}

export function downloadText(filename: string, text: string) {
  // On native (Android app), route through Filesystem + share sheet.
  // Import lazily so web bundle isn't affected.
  import("./native").then(({ isNative, saveTextFile }) => {
    if (isNative()) {
      void saveTextFile(filename, text, "application/json");
      return;
    }
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

/* ---------------- Local backup queue (offline → auto-upload) ---------------- */

const PENDING_KEY = "pending-backup-v1";
export function savePendingBackup(text: string, name: string) {
  localStorage.setItem(PENDING_KEY, JSON.stringify({ text, name, at: Date.now() }));
}
export function readPendingBackup(): { text: string; name: string; at: number } | null {
  try { const v = localStorage.getItem(PENDING_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function clearPendingBackup() { localStorage.removeItem(PENDING_KEY); }
