import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function GoogleDriveOAuthReturn() {
  const [message, setMessage] = useState("Google Drive से जुड़ रहा है…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const finish = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", reason?: string) => {
      window.opener?.postMessage({ type, connectorId: "google_drive", reason }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      const reason = params.get("error") || "Google Drive connection cancelled.";
      setMessage(reason);
      finish("appUserConnectorOAuthFailed", reason);
      return;
    }
    const code = params.get("code");
    if (!code) {
      const reason = "Google Drive connection code नहीं मिला।";
      setMessage(reason);
      finish("appUserConnectorOAuthFailed", reason);
      return;
    }
    void supabase.functions.invoke("google-drive-backup", { body: { action: "complete", code } }).then(({ error }) => {
      if (error) throw error;
      setMessage("Google Drive जुड़ गया। यह पेज बंद हो जाएगा।");
      finish("appUserConnectorOAuthComplete");
    }).catch(() => {
      const reason = "Google Drive connection पूरा नहीं हुआ।";
      setMessage(reason);
      finish("appUserConnectorOAuthFailed", reason);
    });
  }, []);
  return <main className="min-h-screen grid place-items-center bg-background text-foreground p-6"><p>{message}</p></main>;
}
