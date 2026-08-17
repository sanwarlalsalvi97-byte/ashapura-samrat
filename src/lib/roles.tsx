import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "worker" | "staff";

const PENDING_ROLE_KEY = "pending_signup_role";

export function setPendingSignupRole(role: "admin" | "worker") {
  try { localStorage.setItem(PENDING_ROLE_KEY, role); } catch { /* ignore */ }
}

function readPendingRole(): "admin" | "worker" | null {
  try {
    const v = localStorage.getItem(PENDING_ROLE_KEY);
    return v === "admin" || v === "worker" ? v : null;
  } catch { return null; }
}

interface RoleCtx {
  role: AppRole;
  isAdmin: boolean;
  isWorker: boolean;
  /** Worker accounts are strictly read-only. */
  readOnly: boolean;
  loading: boolean;
  reload: () => void;
}

const Ctx = createContext<RoleCtx>({
  role: "admin",
  isAdmin: true,
  isWorker: false,
  readOnly: false,
  loading: true,
  reload: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole>("admin");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) { setRole("admin"); setLoading(false); } return; }

      let { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      let roles = (data || []).map((r) => r.role as AppRole);

      // First login after signup: claim the role the user picked.
      if (roles.length === 0) {
        const pending = readPendingRole() ?? "admin";
        const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: pending });
        if (!error) {
          roles = [pending];
          try { localStorage.removeItem(PENDING_ROLE_KEY); } catch { /* ignore */ }
        }
      }

      if (cancelled) return;
      setRole(roles.includes("worker") && !roles.includes("admin") ? "worker" : roles.includes("admin") ? "admin" : roles[0] ?? "admin");
      setLoading(false);
    };

    void load();

    // Re-resolve the role whenever the auth session changes (sign-in / sign-out),
    // otherwise a worker signing in keeps the default admin (editable) UI.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (!cancelled) { setRole("admin"); setLoading(false); }
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        // defer to avoid calling supabase inside the auth callback
        setTimeout(() => { if (!cancelled) void load(); }, 0);
      }
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [tick]);


  const isWorker = role === "worker";
  return (
    <Ctx.Provider
      value={{
        role,
        isAdmin: !isWorker,
        isWorker,
        readOnly: isWorker,
        loading,
        reload: () => setTick((t) => t + 1),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRole() {
  return useContext(Ctx);
}
