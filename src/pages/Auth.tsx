import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, HardHat, UserRound } from "lucide-react";
import { isNative } from "@/lib/native";
import { setPendingSignupRole } from "@/lib/roles";
import logoUrl from "@/assets/logo.png";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [signupRole, setSignupRole] = useState<"admin" | "worker">("admin");

  const consentNext = (() => {
    try { return sessionStorage.getItem("mcp_oauth_consent_next") || ""; } catch { return ""; }
  })();
  const redirectTarget = window.location.origin + "/";
  const PUBLISHED_URL = "https://ashapurapro.com";

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // In the native Capacitor app window.location.origin is capacitor://localhost,
      // which Google rejects / can't redirect back to. Always use the absolute
      // published HTTPS origin there (App Links open the app from that domain).
      const oauthRedirect = isNative() ? PUBLISHED_URL : window.location.origin;
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: oauthRedirect,
      });
      if (result.error) {
        toast({
          title: "Google लॉगिन नहीं हो सका",
          description: result.error instanceof Error ? result.error.message : "दोबारा कोशिश करें।",
          variant: "destructive",
        });
        return;
      }
      if (result.redirected) return; // browser redirecting to Google
      // Session is set — Index will pick it up via onAuthStateChange.
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: isNative()
            ? `${PUBLISHED_URL}/reset-password`
            : `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "ईमेल भेज दिया!",
          description: "अपना ईमेल चेक करें और लिंक पर क्लिक करें।",
        });
        setMode("login");
      } else if (mode === "signup") {
        setPendingSignupRole(signupRole);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: isNative() ? `${PUBLISHED_URL}/` : redirectTarget },
        });
        if (error) throw error;
        toast({ title: "अकाउंट बन गया!", description: "ईमेल चेक करें।" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (consentNext && consentNext.startsWith("/")) {
          try { sessionStorage.removeItem("mcp_oauth_consent_next"); } catch {}
          window.location.href = consentNext;
        }
      }
    } catch (err: any) {
      toast({ title: "गलती हुई", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "forgot" ? "पासवर्ड भूल गए?"
    : mode === "signup" ? "नया अकाउंट"
    : "Ashapura Samrat";
  const subtitle =
    mode === "forgot" ? "ईमेल डालें, हम लिंक भेजेंगे"
    : "मजदूरों की हाजिरी और हिसाब रखें";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm animate-slide-up">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 flex items-center justify-center shadow-sm">
            <img src={logoUrl} alt="Ashapura Samrat लोगो" width={64} height={64} className="w-14 h-14 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
            </svg>
            {googleLoading ? "Google खुल रहा है..." : "Google से लॉगिन"}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            या ईमेल से
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">मैं हूँ</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "admin" as const, label: "ठेकेदार", sub: "पूरा कंट्रोल", Icon: HardHat },
                    { id: "worker" as const, label: "मजदूर", sub: "सिर्फ देखें", Icon: UserRound },
                  ]).map(({ id, label, sub, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSignupRole(id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        signupRole === id
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1 text-primary" />
                      <div className="text-sm font-bold">{label}</div>
                      <div className="text-[11px] text-muted-foreground">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              type="email"
              placeholder="ईमेल"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== "forgot" && (
              <Input
                type="password"
                placeholder="पासवर्ड"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            )}
            <Button type="submit" variant="outline" className="w-full" disabled={loading}>
              {loading
                ? "रुकें..."
                : mode === "forgot"
                ? "लिंक भेजें"
                : mode === "signup"
                ? "अकाउंट बनाएं"
                : "ईमेल से लॉगिन करें"}
            </Button>

            {mode === "login" && (
              <div className="space-y-2">
                <button type="button" onClick={() => setMode("forgot")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                  पासवर्ड भूल गए?
                </button>
                <button type="button" onClick={() => setMode("signup")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                  नया अकाउंट बनाएं
                </button>
              </div>
            )}

            {mode === "signup" && (
              <button type="button" onClick={() => setMode("login")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                पहले से अकाउंट है? लॉगिन करें
              </button>
            )}

            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("login")} className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                लॉगिन पर वापस जाएं
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
