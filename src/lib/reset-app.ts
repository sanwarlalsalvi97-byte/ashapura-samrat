import { supabase } from "@/integrations/supabase/client";

/** Delete ALL of the current user's data from every table. */
export async function resetAllUserData(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
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
    if (error) throw new Error(`${t}: ${error.message}`);
  }
}

/** Wipe all cached client-side storage — localStorage, sessionStorage, IndexedDB, Cache Storage. Keeps Supabase auth session unless `signOut` is true. */
export async function clearAllCaches(opts: { keepAuth?: boolean } = { keepAuth: true }): Promise<void> {
  // Preserve auth token if requested
  const preserved: Record<string, string> = {};
  if (opts.keepAuth) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("sb-") || k.includes("supabase.auth.token")) {
        preserved[k] = localStorage.getItem(k) || "";
      }
    }
  }
  localStorage.clear();
  sessionStorage.clear();
  Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v));

  // IndexedDB
  try {
    // @ts-ignore
    const dbs: IDBDatabaseInfo[] = (indexedDB.databases ? await indexedDB.databases() : []) as any;
    await Promise.all(
      dbs.map(
        (db) =>
          new Promise<void>((resolve) => {
            if (!db.name) return resolve();
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
  } catch {}

  // Cache Storage
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
}
