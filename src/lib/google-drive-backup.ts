import { supabase } from "@/integrations/supabase/client";

const CONNECTOR_ID = "google_drive";

type DriveResult = {
  connected?: boolean;
  reconnectRequired?: boolean;
  authorizationUrl?: string;
  id?: string;
  name?: string;
  text?: string;
  error?: string;
};

async function invoke(body: Record<string, unknown>): Promise<DriveResult> {
  const { data, error } = await supabase.functions.invoke("google-drive-backup", { body });
  if (error) {
    let detail = error.message;
    try { detail = await error.context.text(); } catch { /* response body unavailable */ }
    throw new Error(detail || "Google Drive सेवा उपलब्ध नहीं है");
  }
  const result = data as DriveResult;
  if (result?.error) throw new Error(result.error);
  return result;
}

function waitForOAuth(popup: Window): Promise<void> {
  return new Promise((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup || event.data?.connectorId !== CONNECTOR_ID) return;
      if (event.data?.type !== "appUserConnectorOAuthComplete" && event.data?.type !== "appUserConnectorOAuthFailed") return;
      cleanup();
      if (event.data.type === "appUserConnectorOAuthComplete") resolve();
      else reject(new Error(event.data?.reason || "Google Drive connection रद्द हो गया"));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Google Drive connection पूरा होने से पहले बंद हो गया"));
    }, 500);
  });
}

export async function connectGoogleDrive(): Promise<void> {
  const popup = window.open("", "ashapura-drive-oauth", "width=600,height=720");
  if (!popup) throw new Error("Google Drive जोड़ने के लिए popup की अनुमति दें");
  try {
    const result = await invoke({ action: "start", origin: window.location.origin });
    if (!result.authorizationUrl) throw new Error("Google Drive connection शुरू नहीं हुआ");
    const completion = waitForOAuth(popup);
    popup.location.href = result.authorizationUrl;
    await completion;
  } catch (error) {
    popup.close();
    throw error;
  }
}

async function ensureConnected(interactive: boolean): Promise<boolean> {
  const status = await invoke({ action: "status" });
  if (status.connected) return true;
  if (!interactive) return false;
  await connectGoogleDrive();
  return true;
}

export async function uploadBackupToGoogleDrive(
  filename: string,
  fileText: string,
  interactive = true,
): Promise<{ id: string; name: string }> {
  if (!(await ensureConnected(interactive))) throw new Error("Google Drive पहले Settings में जोड़ें");
  let result = await invoke({ action: "upload", name: filename, text: fileText });
  if (result.reconnectRequired && interactive) {
    await connectGoogleDrive();
    result = await invoke({ action: "upload", name: filename, text: fileText });
  }
  if (!result.id || !result.name) throw new Error("Google Drive upload पूरा नहीं हुआ");
  return { id: result.id, name: result.name };
}

export async function downloadLatestBackupFromGoogleDrive(): Promise<{ name: string; text: string }> {
  if (!(await ensureConnected(true))) throw new Error("Google Drive नहीं जुड़ा");
  let result = await invoke({ action: "download" });
  if (result.reconnectRequired) {
    await connectGoogleDrive();
    result = await invoke({ action: "download" });
  }
  if (!result.name || typeof result.text !== "string") throw new Error("Google Drive backup नहीं मिला");
  return { name: result.name, text: result.text };
}
