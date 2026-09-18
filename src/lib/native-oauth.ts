import { Browser } from "@capacitor/browser";

export const NATIVE_GOOGLE_REDIRECT_URI = "ashapurasamrat://google-auth";
export const NATIVE_GOOGLE_OAUTH_STATE_KEY = "ashapura-native-google-oauth-state";

function createOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function openNativeGoogleSignIn(): Promise<void> {
  const state = createOAuthState();
  sessionStorage.setItem(NATIVE_GOOGLE_OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    provider: "google",
    redirect_uri: NATIVE_GOOGLE_REDIRECT_URI,
    state,
    prompt: "select_account",
  });

  await Browser.open({
    url: `https://ashapurapro.com/~oauth/initiate?${params.toString()}`,
  });
}