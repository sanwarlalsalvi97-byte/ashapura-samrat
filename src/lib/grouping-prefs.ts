// Preference for how rows are grouped/labelled as "ठेकेदार/साइट" in exports.
// - "site": use worker.site_name (current behaviour)
// - "contractor": use the linked contractor's name from the Contractors table
//   (matched by worker.site_name === contractor.site_name OR contractor.name);
//   falls back to site_name when no contractor matches.

export type GroupingMode = "site" | "contractor";

const KEY = "hajiri-grouping-mode";

export function getGroupingMode(): GroupingMode {
  if (typeof localStorage === "undefined") return "site";
  const v = localStorage.getItem(KEY);
  return v === "contractor" ? "contractor" : "site";
}

export function setGroupingMode(mode: GroupingMode) {
  localStorage.setItem(KEY, mode);
}

export function resolveGroupLabel(
  worker: { site_name?: string | null; name?: string },
  contractors: { name: string; site_name?: string | null }[],
  mode: GroupingMode
): string {
  const site = worker.site_name?.trim() || "";
  if (mode === "site") return site || "—";
  // contractor mode: match by site_name first, then by exact name
  const match =
    contractors.find((c) => c.site_name && site && c.site_name.trim() === site) ||
    contractors.find((c) => c.name.trim() === site);
  return match?.name || site || "—";
}
