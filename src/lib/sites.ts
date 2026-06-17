// Site management — stored in localStorage as rich objects.
// Backward compatible string API (getSites/addSite) for existing form dropdowns.

const KEY = "ashapura-samrat-sites-v2";
const LEGACY_KEY = "ashapura-samrat-sites";

export interface Site {
  id: string;
  name: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function uid() {
  return `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let version = 0;
const listeners = new Set<() => void>();

export function subscribeSites(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function getSitesVersion() {
  return version;
}

function emit() {
  version++;
  listeners.forEach((cb) => { try { cb(); } catch {} });
  try { window.dispatchEvent(new Event("sites-updated")); } catch {}
}

// Cross-tab sync: when another tab writes, bump version + notify subscribers.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === LEGACY_KEY) {
      version++;
      listeners.forEach((cb) => { try { cb(); } catch {} });
    }
  });
}

function read(): Site[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((s) => s && s.id && s.name) : [];
    }
    // Migrate from legacy string list.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const names = JSON.parse(legacy) as string[];
      if (Array.isArray(names) && names.length) {
        const now = new Date().toISOString();
        const sites: Site[] = names.filter(Boolean).map((n, i) => ({
          id: uid(),
          name: n,
          location: "",
          isActive: i === 0,
          createdAt: now,
          updatedAt: now,
        }));
        localStorage.setItem(KEY, JSON.stringify(sites));
        return sites;
      }
    }
  } catch {}
  return [];
}

function write(sites: Site[]) {
  localStorage.setItem(KEY, JSON.stringify(sites));
  // Mirror names to legacy key for any old readers.
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(sites.map((s) => s.name))); } catch {}
  emit();
}

// ===== Rich API =====
export function listSites(): Site[] {
  return read().sort((a, b) => a.name.localeCompare(b.name));
}

export function getActiveSite(): Site | null {
  const all = read();
  return all.find((s) => s.isActive) || all[0] || null;
}

export function createSite(input: { name: string; location?: string }): Site | null {
  const name = input.name.trim();
  if (!name) return null;
  const cur = read();
  if (cur.some((s) => s.name.toLowerCase() === name.toLowerCase())) return null;
  const now = new Date().toISOString();
  const site: Site = {
    id: uid(),
    name,
    location: input.location?.trim() || "",
    isActive: cur.length === 0, // first one auto-active
    createdAt: now,
    updatedAt: now,
  };
  write([...cur, site]);
  return site;
}

export function updateSite(id: string, patch: { name?: string; location?: string }): boolean {
  const cur = read();
  const idx = cur.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return false;
    if (cur.some((s, i) => i !== idx && s.name.toLowerCase() === n.toLowerCase())) return false;
    cur[idx].name = n;
  }
  if (patch.location !== undefined) cur[idx].location = patch.location.trim();
  cur[idx].updatedAt = new Date().toISOString();
  write(cur);
  return true;
}

export function deleteSite(id: string) {
  const cur = read();
  const wasActive = cur.find((s) => s.id === id)?.isActive;
  const next = cur.filter((s) => s.id !== id);
  if (wasActive && next.length && !next.some((s) => s.isActive)) {
    next[0].isActive = true;
  }
  write(next);
}

export function setActiveSite(id: string) {
  const cur = read().map((s) => ({ ...s, isActive: s.id === id, updatedAt: s.id === id ? new Date().toISOString() : s.updatedAt }));
  if (!cur.some((s) => s.isActive) && cur.length) cur[0].isActive = true;
  write(cur);
}

// ===== Legacy string API (used by AddWorkerDialog / EditWorkerDialog / SiteNameInput) =====
export function getSites(): string[] {
  return read().map((s) => s.name);
}

export function addSite(name: string) {
  const n = name.trim();
  if (!n) return;
  const cur = read();
  if (cur.some((s) => s.name.toLowerCase() === n.toLowerCase())) return;
  createSite({ name: n });
}

export function removeSite(name: string) {
  const cur = read();
  const target = cur.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  if (target) deleteSite(target.id);
}

export function mergeSitesFrom(extra: (string | null | undefined)[]) {
  const cur = read();
  const set = new Set(cur.map((s) => s.name.toLowerCase()));
  const now = new Date().toISOString();
  const additions: Site[] = [];
  for (const v of extra) {
    const n = (v || "").trim();
    if (!n) continue;
    if (!set.has(n.toLowerCase())) {
      set.add(n.toLowerCase());
      additions.push({
        id: uid(),
        name: n,
        location: "",
        isActive: cur.length === 0 && additions.length === 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (additions.length) write([...cur, ...additions]);
}
