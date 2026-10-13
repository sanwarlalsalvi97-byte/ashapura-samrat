// Verify a Google Play Billing purchase/subscription token server-side.
// Requires two secrets:
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  – full JSON of a service account with
//                                       "androidpublisher" access for the app.
//   PLAY_PACKAGE_NAME                 – must match the installed Android applicationId
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
import { subscriptionEntitlement } from "../_shared/play-entitlement.ts";
import { ownsPlayPurchase } from "../_shared/play-account.ts";

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
    throw new Error("Google authentication failed");
  }
  return j.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require an authenticated user so we know whose subscription to update.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Backend configuration missing");
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { productId, purchaseToken, type = "subs" } = (await req.json()) as Body;
    if (typeof productId !== "string" || typeof purchaseToken !== "string" || !productId || !purchaseToken || !["subs", "inapp"].includes(type)) {
      return new Response(
        JSON.stringify({ ok: false, error: "productId and purchaseToken are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (type === "subs" && !["basic_plan", "standard_plan", "pro_plan"].includes(productId)) {
      return new Response(JSON.stringify({ ok: false, error: "Unsupported subscription product" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        : `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;

    const gRes = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await gRes.json();
    if (!gRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "Google verification failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const googleAccountId = type === "subs"
      ? data.externalAccountIdentifiers?.obfuscatedExternalAccountId
      : data.obfuscatedExternalAccountId;
    // Reject missing legacy binding as well as another account BEFORE any entitlement write.
    if (!await ownsPlayPurchase(user.id, googleAccountId)) {
      return new Response(JSON.stringify({ ok: false, error: "Purchase account ownership could not be verified" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let premium = false;
    let expiryTimeMillis: number | undefined;
    let autoRenewing: boolean | undefined;

    if (type === "subs") {
      const entitlement = subscriptionEntitlement(data, Date.now(), productId);
      expiryTimeMillis = entitlement.expiryTimeMillis;
      autoRenewing = entitlement.autoRenewing;
      premium = entitlement.premium;
    } else {
      // one-time purchase: purchaseState 0=purchased, 1=cancelled, 2=pending
      premium = data.purchaseState === 0;
    }

    // Persist verified premium server-side so the client cannot self-grant it.
    if (premium) {
      const premiumUntil = expiryTimeMillis
        ? new Date(expiryTimeMillis).toISOString()
        : new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString(); // lifetime inapp
      const { error: upErr } = await admin
        .from("subscriptions")
        .upsert(
          { user_id: user.id, premium_until: premiumUntil, plan: "premium" },
          { onConflict: "user_id" },
        );
      if (upErr) {
        console.error("Could not record verified subscription");
        return new Response(
          JSON.stringify({ ok: false, error: "Could not record subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (type === "subs" && expiryTimeMillis) {
      // Revoke non-entitled states, but an old token must not erase newer paid access.
      const { error: clearErr } = await admin
        .from("subscriptions")
        .update({ premium_until: null, plan: "trial" })
        .eq("user_id", user.id)
        .lte("premium_until", new Date(expiryTimeMillis).toISOString());
      if (clearErr) throw new Error("Could not update expired subscription");
    }

    return new Response(
      JSON.stringify({ ok: true, premium, expiryTimeMillis, autoRenewing }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Play purchase verification failed");
    return new Response(
      JSON.stringify({ ok: false, error: "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
