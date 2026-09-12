import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { authorizeAppUserOAuth, exchangeAppUserOAuthCode, callAsAppUser, appUserReconnectRequired } from "../_shared/appUserConnector.ts";
import { getConnectionKeyForUser, saveConnectionKeyForUser } from "../_shared/appUserConnections.ts";
import { GOOGLE_DRIVE_SCOPES } from "../_shared/appUserScopes.ts";

const GATEWAY = "https://connector-gateway.lovable.dev";
const CONNECTOR = "google_drive";
const FOLDER = "Ashapura Samrat Backup";
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

async function provider(key: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: key, connectorId: CONNECTOR, path, init, requiredScopes: GOOGLE_DRIVE_SCOPES });
  if (await appUserReconnectRequired(res)) return { reconnect: true, res };
  if (!res.ok) throw new Error(`Google Drive request failed (${res.status}): ${await res.text()}`);
  return { reconnect: false, res };
}

async function folderId(key: string) {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`);
  const found = await provider(key, `/drive/v3/files?q=${q}&spaces=drive&fields=files(id)&pageSize=1`);
  if (found.reconnect) throw new Error("RECONNECT_REQUIRED");
  const files = (await found.res.json()).files as Array<{ id: string }>;
  if (files?.[0]?.id) return files[0].id;
  const made = await provider(key, "/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }) });
  if (made.reconnect) throw new Error("RECONNECT_REQUIRED");
  return (await made.res.json()).id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return reply({ error: "Sign in required" }, 401);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);
    const parsed = z.object({ action: z.enum(["start", "complete", "status", "upload", "download"]), origin: z.string().url().optional(), code: z.string().min(1).max(2048).optional(), name: z.string().min(1).max(180).optional(), text: z.string().max(15_000_000).optional() }).safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid request" }, 400);
    const { action } = parsed.data;
    if (action === "start") {
      const origin = parsed.data.origin;
      if (!origin) return reply({ error: "Origin required" }, 400);
      const host = new URL(origin).hostname;
      if (!(host === "ashapurapro.com" || host === "www.ashapurapro.com" || host === "localhost" || host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com"))) return reply({ error: "Origin not allowed" }, 400);
      const clientAPIKey = Deno.env.get("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY");
      if (!clientAPIKey) return reply({ error: "Google Drive is not configured" }, 500);
      const current = await getConnectionKeyForUser(user.id, CONNECTOR);
      const result = await authorizeAppUserOAuth({ gatewayBaseUrl: GATEWAY, connectorId: CONNECTOR, appUserId: user.id, clientAPIKey, returnUrl: new URL("/oauth/google-drive/return", origin).toString(), connectionAPIKey: current ?? undefined, credentialsConfiguration: { scopes: GOOGLE_DRIVE_SCOPES } });
      return reply({ authorizationUrl: result.authorizationUrl });
    }
    if (action === "complete") {
      if (!parsed.data.code) return reply({ error: "Code required" }, 400);
      const exchanged = await exchangeAppUserOAuthCode(GATEWAY, parsed.data.code);
      if (exchanged.connectorId !== CONNECTOR) return reply({ error: "Wrong connector" }, 400);
      await saveConnectionKeyForUser(user.id, CONNECTOR, exchanged.connectionAPIKey);
      return reply({ ok: true });
    }
    const key = await getConnectionKeyForUser(user.id, CONNECTOR);
    if (!key) return reply({ connected: false });
    if (action === "status") return reply({ connected: true });
    const parent = await folderId(key);
    if (action === "upload") {
      if (!parsed.data.name || !parsed.data.text) return reply({ error: "Backup required" }, 400);
      const boundary = `ashapura_${crypto.randomUUID()}`;
      const multipart = [`--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify({ name: parsed.data.name, parents: [parent], mimeType: "application/json", appProperties: { app: "AshapuraSamrat", type: "backup" } }), `--${boundary}`, "Content-Type: application/json; charset=UTF-8", "", parsed.data.text, `--${boundary}--`].join("\r\n");
      const saved = await provider(key, "/upload/drive/v3/files?uploadType=multipart&fields=id,name", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart });
      if (saved.reconnect) return reply({ connected: false, reconnectRequired: true });
      const file = await saved.res.json();
      return reply({ connected: true, id: file.id, name: file.name });
    }
    const q = encodeURIComponent(`'${parent}' in parents and trashed=false and name contains 'AshapuraSamrat_Backup_'`);
    const listed = await provider(key, `/drive/v3/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime)`);
    if (listed.reconnect) return reply({ connected: false, reconnectRequired: true });
    const file = (await listed.res.json()).files?.[0] as { id: string; name: string } | undefined;
    if (!file) return reply({ error: "Google Drive backup not found" }, 404);
    const downloaded = await provider(key, `/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
    if (downloaded.reconnect) return reply({ connected: false, reconnectRequired: true });
    return reply({ connected: true, name: file.name, text: await downloaded.res.text() });
  } catch (error) {
    console.error("google-drive-backup:", error);
    const message = error instanceof Error ? error.message : "Google Drive backup failed";
    if (message === "RECONNECT_REQUIRED") return reply({ connected: false, reconnectRequired: true });
    return reply({ error: message }, 500);
  }
});
