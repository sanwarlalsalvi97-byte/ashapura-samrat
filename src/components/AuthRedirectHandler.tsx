import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects password-recovery deep links (email link, native app open, hash or
 * query tokens) and sends the user to the "Create new password" screen.
 */
export default function AuthRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const goToReset = () => {
      if (window.location.pathname === "/reset-password") return;
      // Keep hash/query so ResetPassword can finish the token exchange.
      navigate(`/reset-password${window.location.search}${window.location.hash}`, {
        replace: true,
      });
    };

    const looksLikeRecovery = () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const type = hash.get("type") || query.get("type");
      if (type === "recovery") return true;
      // PKCE style link: ?code=...&type=recovery (type sometimes missing)
      if (query.get("code") && query.get("redirect_to")?.includes("reset-password")) return true;
      return false;
    };

    if (looksLikeRecovery()) goToReset();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") goToReset();
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate, location.key]);

  return null;
}
