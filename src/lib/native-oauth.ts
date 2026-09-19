import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

export const NATIVE_GOOGLE_REDIRECT_URI = "ashapurasamrat://google-auth";

export async function openNativeGoogleSignIn(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_GOOGLE_REDIRECT_URI,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error("Google लॉगिन लिंक नहीं मिला। दोबारा कोशिश करें।");

  await Browser.open({ url: data.url });
}