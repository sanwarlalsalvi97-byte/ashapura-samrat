import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
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
  useEffect(() => {
    // Chrome ब्राउज़र से ashapurasamrat://google-auth वापस ऐप में आने पर टोकन सेट करता है
    const listener = CapacitorApp.addListener("appUrlOpen", async (data) => {
      if (data.url.includes("ashapurasamrat") || data.url.includes("google-auth")) {
        const url = new URL(data.url);
        const hash = url.hash || url.search;
        if (hash) {
          const params = new URLSearchParams(hash.replace("#", "?"));
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

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

