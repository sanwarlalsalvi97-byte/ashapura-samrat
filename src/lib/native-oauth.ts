import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/integrations/supabase/client";

const GOOGLE_WEB_CLIENT_ID =
  "1006500502499-rd8ma3ki17eb9lgbt3srqvmthftlq4id.apps.googleusercontent.com";

let googleAuthReady = false;

async function ensureNativeGoogleAuth(): Promise<void> {
  if (googleAuthReady) return;
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    },
  });
  googleAuthReady = true;
}

export async function openNativeGoogleSignIn(): Promise<void> {
  await ensureNativeGoogleAuth();
  const login = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["email", "profile"],
      style: "bottom",
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  });

  if (login.provider !== "google" || login.result.responseType !== "online") {
    throw new Error("Google लॉगिन का जवाब अधूरा मिला। दोबारा कोशिश करें।");
  }
  const idToken = login.result.idToken;
  if (!idToken) {
    throw new Error("Google पहचान टोकन नहीं मिला। दोबारा कोशिश करें।");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;

  window.location.replace("/app");
}