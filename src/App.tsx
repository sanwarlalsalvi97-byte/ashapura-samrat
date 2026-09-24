import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Trust from "./pages/Trust.tsx";
import Privacy from "./pages/Privacy.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import PinLockGate from "./components/PinLockGate";
import AuthRedirectHandler from "./components/AuthRedirectHandler";
import GoogleDriveOAuthReturn from "./pages/GoogleDriveOAuthReturn";
import LandingPage from "./pages/LandingPage";
import Terms from "./pages/Terms";
import NotificationSettings from "./pages/NotificationSettings";

const queryClient = new QueryClient();

const App = () => {
  const [showAppRedirect, setShowAppRedirect] = useState(false);
  const [deepLinkUrl, setDeepLinkUrl] = useState("");

   useEffect(() => {
    // Native App Scheme & Deep Link Interceptor
    const listener = CapacitorApp.addListener("appUrlOpen", async (data) => {
      // 1. ओपन कस्टम टैब/ब्राउज़र को तुरंत बंद करें
      try {
        await Browser.close();
      } catch (e) {}

      // 2. यूआरएल से OAuth टोकन निकालें
      const rawUrl = data.url;
      if (
        rawUrl.includes("ashapurasamrat") ||
        rawUrl.includes("google-auth") ||
        rawUrl.includes("access_token")
      ) {
        const hashIndex = rawUrl.indexOf("#");
        const queryIndex = rawUrl.indexOf("?");
        const hashOrQuery =
          hashIndex !== -1
            ? rawUrl.substring(hashIndex)
            : queryIndex !== -1
            ? rawUrl.substring(queryIndex)
            : "";

        if (hashOrQuery) {
          const params = new URLSearchParams(hashOrQuery.replace("#", "?"));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            window.location.href = "/app";
          }
        }
      }
    });

    // Web Browser Fallback
    const hash = window.location.hash;
    if (!Capacitor.isNativePlatform() && hash && hash.includes("access_token")) {
      const targetAppUri = `ashapurasamrat://google-auth${hash}`;
      setDeepLinkUrl(targetAppUri);
      setShowAppRedirect(true);
      window.location.href = targetAppUri;
    }

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {showAppRedirect && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 text-center">
            <h2 className="text-xl font-bold mb-2">लॉगिन सफल रहा!</h2>
            <p className="text-muted-foreground text-sm mb-6">ऐप में वापस जाने के लिए नीचे दिए गए बटन पर टैप करें।</p>
            <a
              href={deepLinkUrl}
              className="w-full max-w-xs bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl shadow-lg block"
            >
              Ashapura Samrat ऐप खोलें
            </a>
          </div>
        )}
        <BrowserRouter>
          <AuthRedirectHandler />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/app" element={<PinLockGate><Index /></PinLockGate>} />
            <Route path="/notification-settings" element={<PinLockGate><NotificationSettings /></PinLockGate>} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/oauth/google-drive/return" element={<GoogleDriveOAuthReturn />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
        



