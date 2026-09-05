// Verify a Google Play Billing purchase/subscription token server-side.
// Requires two secrets:
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  – full JSON of a service account with
//                                       "androidpublisher" access for the app.
//   PLAY_PACKAGE_NAME                 – e.g. app.lovable.ashapurasamrat
//
// Client calls:
//   supabase.functions.invoke("verify-play-purchase", {
//     body: { productId, purchaseToken, type: "subs" | "inapp" }
//   })
//
// Response: { ok: true, premium: true, expiryTimeMillis?, autoRenewing?, raw }
//        or { ok: false, error }

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  productId?: string;
  purchaseToken?: string;
  type?: "subs" | "inapp";
};

// ---------- JWT (RS256) signing for Google service account ----------
function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
  token_uri?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(
    sa.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );
  const j = await res.json();
  if (!res.ok || !j.access_token) {
    throw new Error(`token exchange failed: ${JSON.stringify(j)}`);
  }
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { productId, purchaseToken, type = "subs" } = (await req.json()) as Body;
    if (!productId || !purchaseToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "productId and purchaseToken are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pkg = Deno.env.get("PLAY_PACKAGE_NAME");
    const saJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
    if (!pkg || !saJson) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Server not configured. Set PLAY_PACKAGE_NAME and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sa: { client_email: string; private_key: string; token_uri?: string };
    try {
      sa = JSON.parse(saJson);
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getAccessToken(sa);
    const endpoint =
      type === "inapp"
        ? `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`
        : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

    const gRes = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await gRes.json();
    if (!gRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "Google verification failed", raw: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let premium = false;
    let expiryTimeMillis: number | undefined;
    let autoRenewing: boolean | undefined;

    if (type === "subs") {
      // paymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred upgrade
      const paid = data.paymentState === 1 || data.paymentState === 2;
      expiryTimeMillis = data.expiryTimeMillis ? Number(data.expiryTimeMillis) : undefined;
      autoRenewing = Boolean(data.autoRenewing);
      const notExpired = !expiryTimeMillis || expiryTimeMillis > Date.now();
      premium = paid && notExpired;
    } else {
      // one-time purchase: purchaseState 0=purchased, 1=cancelled, 2=pending
      premium = data.purchaseState === 0;
    }

    return new Response(
      JSON.stringify({ ok: true, premium, expiryTimeMillis, autoRenewing, raw: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
