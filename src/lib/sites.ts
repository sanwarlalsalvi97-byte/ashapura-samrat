// Site management — Cloud-first (public.sites, RLS: auth.uid() = user_id)
// with a per-user localStorage cache for instant reads and offline display.
// Legacy device-only data ("ashapura-samrat-sites-v2") is only READ here and
// imported to the cloud after explicit user confirmation (see SitesLegacyImportDialog).

import { supabase } from "@/integrations/supabase/client";

export const LEGACY_KEY_V2 = "ashapura-samrat-sites-v2";
export const LEGACY_KEY_V1 = "ashapura-samrat-sites";
const cacheKey = (uid: string) => `ashapura-samrat-sites-cache.${uid}`;
const pendingKey = (uid: string) => `sites-pending.${uid}`;
const importKey = (uid: string) => `sites-legacy-import.${uid}`;

export interface Site {
  id: string;
  name: string;
  location?: string; // shown as "मालिक का नाम"; stored as owner_name
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  pending?: boolean; // saved on this phone, not yet confirmed by cloud
}

export type SitesStatus = "idle" | "loading" | "ready" | "offline" | "error";
export type SaveResult =
  | { ok: true; site: Site; synced: boolean }
  | { ok: false; reason: "blank" | "duplicate" | "offline" | "not_signed_in" | "error"; message?: string };

// ---------- pure helpers (tested) ----------
export function normalizeSiteName(name: string): string {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export interface LegacySite { id: string; name: string; location?: string; isActive?: boolean }

export interface LegacyImportPlan {
  toImport: LegacySite[];
  alreadyInCloud: LegacySite[];
  blank: LegacySite[];
  duplicates: LegacySite[];
  total: number;
}

export function planLegacyImport(local: LegacySite[], cloud: Pick<Site, "name">[]): LegacyImportPlan {
  const cloudSet = new Set(cloud.map((s) => normalizeSiteName(s.name)));
  const seen = new Set<string>();
  const plan: LegacyImportPlan = { toImport: [], alreadyInCloud: [], blank: [], duplicates: [], total: local.length };
  for (const s of local) {
    const n = normalizeSiteName(s.name);
    if (!n) { plan.blank.push(s); continue; }
    if (seen.has(n)) { plan.duplicates.push(s); continue; }
    seen.add(n);
    if (cloudSet.has(n)) plan.alreadyInCloud.push(s);
    else plan.toImport.push({ ...s, name: s.name.trim().replace(/\s+/g, " ") });
  }
  return plan;
}

/** Read legacy device sites WITHOUT modifying localStorage. */
export function readLegacySites(): LegacySite[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY_V2);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .filter((s) => s && typeof s.name === "string")
          .map((s, i) => {
            let name: string = s.name;
            let location: string = s.location || "";
            if (name.includes(" · ")) {
              const [n, ...rest] = name.split(" · ");
              name = n;
              location = location.trim() || rest.join(" · ");
            }
            return { id: String(s.id || `legacy_${i}`), name, location: location.trim(), isActive: !!s.isActive };
          });
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY_V1);
    if (legacy) {
      const names = JSON.parse(legacy);
      if (Array.isArray(names)) {
        return names.filter((x) => typeof x === "string").map((raw: string, i) => {
          const [n, ...rest] = raw.split(" · ");
          return { id: `legacy_v1_${i}_${normalizeSiteName(n)}`, name: n, location: rest.join(" · ").trim(), isActive: i === 0 };
        });
      }
    }
  } catch { /* ignore */ }
  return [];
}

// ---------- state ----------
let currentUserId: string | null = null;
let sites: Site[] = [];
let status: SitesStatus = "idle";
let version = 0;
const listeners = new Set<() => void>();

export function subscribeSites(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getSitesVersion() { return version; }
export function getSitesStatus(): SitesStatus { return status; }
export function getSitesUserId() { return currentUserId; }

function emit() {
  version++;
  listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
  try { window.dispatchEvent(new Event("sites-updated")); } catch { /* ignore */ }
}

type Row = {
  id: string; name: string; owner_name: string; is_active: boolean;
  created_at: string; updated_at: string;
};
const fromRow = (r: Row): Site => ({
  id: r.id, name: r.name, location: r.owner_name || "", isActive: r.is_active,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

type PendingInsert = { id: string; name: string; owner_name: string; is_active: boolean; queuedAt: number };

function readPending(uid: string): PendingInsert[] {
  try { const v = JSON.parse(localStorage.getItem(pendingKey(uid)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writePending(uid: string, items: PendingInsert[]) {
  try {
    if (items.length) localStorage.setItem(pendingKey(uid), JSON.stringify(items));
    else localStorage.removeItem(pendingKey(uid));
  } catch { /* ignore */ }
}

function pendingAsSites(uid: string): Site[] {
  return readPending(uid).map((p) => ({
    id: p.id, name: p.name, location: p.owner_name, isActive: p.is_active,
    createdAt: new Date(p.queuedAt).toISOString(), updatedAt: new Date(p.queuedAt).toISOString(), pending: true,
  }));
}

function setSites(uid: string, cloud: Site[]) {
  if (uid !== currentUserId) return; // account switched meanwhile — drop
  const pend = pendingAsSites(uid).filter((p) => !cloud.some((c) => c.id === p.id));
  sites = [...cloud, ...pend];
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(cloud)); } catch { /* ignore */ }
  emit();
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Load sites for the signed-in user from cloud (cache shown first). */
export async function refreshSites(): Promise<void> {
  const uid = currentUserId;
  if (!uid) return;
  status = "loading"; emit();
  await flushPendingSites();
  const { data, error } = await supabase.from("sites").select("id,name,owner_name,is_active,created_at,updated_at").order("name");
  if (uid !== currentUserId) return;
  if (error) {
    status = isOffline() ? "offline" : "error";
    emit();
    return;
  }
  status = "ready";
  setSites(uid, (data || []).map(fromRow));
}

function switchUser(uid: string | null) {
  if (uid === currentUserId) return;
  currentUserId = uid;
  sites = [];
  status = uid ? "loading" : "idle";
  if (uid) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey(uid)) || "[]");
      if (Array.isArray(cached)) sites = [...cached, ...pendingAsSites(uid)];
    } catch { /* ignore */ }
  }
  emit();
  if (uid) void refreshSites();
}

let initialized = false;
export function initSites() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  supabase.auth.getSession().then(({ data }) => switchUser(data.session?.user?.id ?? null)).catch(() => {});
  supabase.auth.onAuthStateChange((_e, session) => {
    // defer: never call supabase inside the callback synchronously
    setTimeout(() => switchUser(session?.user?.id ?? null), 0);
  });
  window.addEventListener("online", () => { void refreshSites(); });
}
initSites();

// ---------- reads ----------
export function listSites(): Site[] {
  return [...sites].sort((a, b) => a.name.localeCompare(b.name));
}
export function getActiveSite(): Site | null {
  return sites.find((s) => s.isActive) || sites[0] || null;
}
export function getSites(): string[] { return sites.map((s) => s.name); }

// ---------- writes ----------
function isUniqueViolation(err: { code?: string } | null) { return !!err && err.code === "23505"; }

/** Push queued offline inserts. Idempotent: client UUID + unique-name rule. */
export async function flushPendingSites(): Promise<{ synced: number; conflicts: string[] }> {
  const uid = currentUserId;
  const result = { synced: 0, conflicts: [] as string[] };
  if (!uid || isOffline()) return result;
  const items = readPending(uid);
  if (!items.length) return result;
  const remaining: PendingInsert[] = [];
  for (const p of items) {
    if (uid !== currentUserId) return result; // never sync into another account
    const { error } = await supabase.from("sites").insert({
      id: p.id, user_id: uid, name: p.name, owner_name: p.owner_name, is_active: p.is_active,
    });
    if (!error) { result.synced++; continue; }
    if (isUniqueViolation(error)) {
      const { data } = await supabase.from("sites").select("id").eq("id", p.id).maybeSingle();
      if (data) { result.synced++; continue; } // already saved by an earlier retry
      result.conflicts.push(p.name); // same name already in cloud — keep cloud copy, drop duplicate
      continue;
    }
    remaining.push(p);
  }
  writePending(uid, remaining);
  return result;
}

export async function createSiteAsync(input: { name: string; location?: string }): Promise<SaveResult> {
  const uid = currentUserId;
  if (!uid) return { ok: false, reason: "not_signed_in" };
  const name = (input.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, reason: "blank" };
  if (sites.some((s) => normalizeSiteName(s.name) === normalizeSiteName(name))) return { ok: false, reason: "duplicate" };
  const row: PendingInsert = {
    id: crypto.randomUUID(),
    name,
    owner_name: (input.location || "").trim(),
    is_active: sites.length === 0,
    queuedAt: Date.now(),
  };
  if (isOffline()) {
    writePending(uid, [...readPending(uid), row]);
    sites = [...sites, ...pendingAsSites(uid).filter((p) => p.id === row.id)];
    emit();
    return { ok: true, site: sites[sites.length - 1], synced: false };
  }
  const { data, error } = await supabase
    .from("sites")
    .insert({ id: row.id, user_id: uid, name: row.name, owner_name: row.owner_name, is_active: row.is_active })
    .select("id,name,owner_name,is_active,created_at,updated_at")
    .single();
  if (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
    if (isOffline() || /fetch|network/i.test(error.message)) {
      writePending(uid, [...readPending(uid), row]);
      sites = [...sites, ...pendingAsSites(uid).filter((p) => p.id === row.id)];
      emit();
      return { ok: true, site: sites[sites.length - 1], synced: false };
    }
    return { ok: false, reason: "error", message: error.message };
  }
  const site = fromRow(data as Row);
  if (uid === currentUserId) { sites = [...sites, site]; try { localStorage.setItem(cacheKey(uid), JSON.stringify(sites.filter((s) => !s.pending))); } catch { /* ignore */ } emit(); }
  return { ok: true, site, synced: true };
}

export async function updateSiteAsync(id: string, patch: { name?: string; location?: string }): Promise<SaveResult> {
  const uid = currentUserId;
  if (!uid) return { ok: false, reason: "not_signed_in" };
  if (isOffline()) return { ok: false, reason: "offline" };
  const target = sites.find((s) => s.id === id);
  if (!target || target.pending) return { ok: false, reason: target?.pending ? "offline" : "error" };
  const upd: { name?: string; owner_name?: string } = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim().replace(/\s+/g, " ");
    if (!n) return { ok: false, reason: "blank" };
    if (sites.some((s) => s.id !== id && normalizeSiteName(s.name) === normalizeSiteName(n))) return { ok: false, reason: "duplicate" };
    upd.name = n;
  }
  if (patch.location !== undefined) upd.owner_name = patch.location.trim();
  const { data, error } = await supabase.from("sites").update(upd).eq("id", id)
    .select("id,name,owner_name,is_active,created_at,updated_at").single();
  if (error) return { ok: false, reason: isUniqueViolation(error) ? "duplicate" : "error", message: error.message };
  await refreshSites();
  return { ok: true, site: fromRow(data as Row), synced: true };
}

export async function deleteSiteAsync(id: string): Promise<{ ok: boolean; reason?: string }> {
  const uid = currentUserId;
  if (!uid) return { ok: false, reason: "not_signed_in" };
  const target = sites.find((s) => s.id === id);
  if (target?.pending) {
    writePending(uid, readPending(uid).filter((p) => p.id !== id));
    sites = sites.filter((s) => s.id !== id); emit();
    return { ok: true };
  }
  if (isOffline()) return { ok: false, reason: "offline" };
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  if (target?.isActive) {
    const next = sites.find((s) => s.id !== id && !s.pending);
    if (next) await supabase.from("sites").update({ is_active: true }).eq("id", next.id);
  }
  await refreshSites();
  return { ok: true };
}

export async function setActiveSiteAsync(id: string): Promise<{ ok: boolean; reason?: string }> {
  if (!currentUserId) return { ok: false, reason: "not_signed_in" };
  if (isOffline()) return { ok: false, reason: "offline" };
  const { error: e1 } = await supabase.from("sites").update({ is_active: false }).neq("id", id).eq("is_active", true);
  if (e1) return { ok: false, reason: e1.message };
  const { error: e2 } = await supabase.from("sites").update({ is_active: true }).eq("id", id);
  if (e2) return { ok: false, reason: e2.message };
  await refreshSites();
  return { ok: true };
}

/**
 * Synchronous compatibility wrapper for quick "+ नई साइट" prompts
 * (AttendanceCard, WorkersPage). Adds to the list immediately as pending and
 * saves to cloud in the background through the same idempotent queue.
 */
export function createSite(input: { name: string; location?: string }): Site | null {
  const uid = currentUserId;
  if (!uid) return null;
  const name = (input.name || "").trim().replace(/\s+/g, " ");
  if (!name || sites.some((s) => normalizeSiteName(s.name) === normalizeSiteName(name))) return null;
  const row: PendingInsert = { id: crypto.randomUUID(), name, owner_name: (input.location || "").trim(), is_active: sites.length === 0, queuedAt: Date.now() };
  writePending(uid, [...readPending(uid), row]);
  const site = pendingAsSites(uid).find((p) => p.id === row.id)!;
  sites = [...sites, site];
  emit();
  void refreshSites();
  return site;
}

export function addSite(name: string) { createSite({ name }); }

// ---------- legacy import (explicit confirmation required) ----------
export type LegacyImportState = "done" | "declined" | null;
export function getLegacyImportState(uid: string): LegacyImportState {
  try { const v = localStorage.getItem(importKey(uid)); return v === "done" || v === "declined" ? v : null; } catch { return null; }
}
export function setLegacyImportDeclined(uid: string) {
  try { localStorage.setItem(importKey(uid), "declined"); } catch { /* ignore */ }
}

/** Returns an import plan if this device has sites not yet in this account's cloud list. */
export function getLegacyImportPlan(): LegacyImportPlan | null {
  const uid = currentUserId;
  if (!uid || status !== "ready" || getLegacyImportState(uid)) return null;
  const local = readLegacySites();
  if (!local.length) return null;
  const plan = planLegacyImport(local, sites);
  return plan.toImport.length ? plan : null;
}

/**
 * Import confirmed legacy sites for the CURRENT user only. Never deletes or
 * modifies the original localStorage data. Safe to retry.
 */
export async function importLegacySites(plan: LegacyImportPlan): Promise<{ ok: boolean; imported: number; existing: number; missing: number; message?: string }> {
  const uid = currentUserId;
  if (!uid) return { ok: false, imported: 0, existing: 0, missing: plan.toImport.length, message: "not_signed_in" };
  try {
    const original = localStorage.getItem(LEGACY_KEY_V2) ?? localStorage.getItem(LEGACY_KEY_V1);
    if (original) localStorage.setItem(`${LEGACY_KEY_V2}.premigration.${uid}.${Date.now()}`, original);
  } catch { /* ignore */ }
  const hasActive = sites.some((s) => s.isActive);
  let imported = 0, existing = 0;
  for (const s of plan.toImport) {
    if (uid !== currentUserId) break;
    const { error } = await supabase.from("sites").insert({
      user_id: uid, name: s.name, owner_name: s.location || "", legacy_local_id: s.id,
      is_active: !hasActive && !!s.isActive,
    });
    if (!error) imported++;
    else if (isUniqueViolation(error)) existing++;
    else return { ok: false, imported, existing, missing: plan.toImport.length - imported - existing, message: error.message };
  }
  await refreshSites();
  if (uid !== currentUserId) return { ok: false, imported, existing, missing: 0, message: "account_changed" };
  const cloudSet = new Set(sites.filter((x) => !x.pending).map((x) => normalizeSiteName(x.name)));
  const missing = plan.toImport.filter((s) => !cloudSet.has(normalizeSiteName(s.name))).length;
  if (missing === 0) { try { localStorage.setItem(importKey(uid), "done"); } catch { /* ignore */ } }
  console.info("[sites] legacy import", { imported, existing, missing, total: plan.total });
  return { ok: missing === 0, imported, existing, missing };
}

/** Merge site names from a backup into cloud; adds only new names, never deletes. */
export async function mergeSitesIntoCloud(input: { name: string; location?: string }[]): Promise<{ added: number; duplicates: number }> {
  const uid = currentUserId;
  let added = 0, duplicates = 0;
  if (!uid) return { added, duplicates };
  const plan = planLegacyImport(input.map((s, i) => ({ id: `backup_${i}`, name: s.name, location: s.location })), sites);
  duplicates = plan.alreadyInCloud.length + plan.duplicates.length;
  for (const s of plan.toImport) {
    const { error } = await supabase.from("sites").insert({ user_id: uid, name: s.name, owner_name: s.location || "" });
    if (!error) added++; else if (isUniqueViolation(error)) duplicates++;
  }
  await refreshSites();
  return { added, duplicates };
}
