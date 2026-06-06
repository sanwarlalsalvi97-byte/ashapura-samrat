// Simple site-name list shared across forms.
// Stores user-entered site names in localStorage so they appear in dropdowns
// elsewhere without deleting the previous one.

const KEY = "ashapura-samrat-sites";

export function getSites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function addSite(name: string) {
  const n = name.trim();
  if (!n) return;
  const cur = getSites();
  if (cur.some((s) => s.toLowerCase() === n.toLowerCase())) return;
  const next = [...cur, n];
  localStorage.setItem(KEY, JSON.stringify(next));
  try { window.dispatchEvent(new Event("sites-updated")); } catch {}
}

export function removeSite(name: string) {
  const cur = getSites().filter((s) => s.toLowerCase() !== name.trim().toLowerCase());
  localStorage.setItem(KEY, JSON.stringify(cur));
  try { window.dispatchEvent(new Event("sites-updated")); } catch {}
}

// Merge stored sites with any site names found on workers/contractors so the
// dropdown is always populated.
export function mergeSitesFrom(extra: (string | null | undefined)[]) {
  const set = new Set(getSites().map((s) => s.toLowerCase()));
  const cur = getSites();
  const additions: string[] = [];
  for (const v of extra) {
    const n = (v || "").trim();
    if (!n) continue;
    if (!set.has(n.toLowerCase())) {
      set.add(n.toLowerCase());
      additions.push(n);
    }
  }
  if (additions.length) {
    localStorage.setItem(KEY, JSON.stringify([...cur, ...additions]));
    try { window.dispatchEvent(new Event("sites-updated")); } catch {}
  }
}
