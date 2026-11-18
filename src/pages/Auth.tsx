import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, HardHat, UserRound } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { nativeGoogleLogin } from "@/lib/native";
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
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [emailResending, setEmailResending] = useState(false);

  const consentNext = (() => {
    try { return sessionStorage.getItem("mcp_oauth_consent_next") || ""; } catch { return ""; }
  })();
  const redirectTarget = window.location.origin + "/app";
  const PUBLISHED_URL = "https://ashapurapro.com";
  const emailRedirectTo = Capacitor.isNativePlatform() ? `${PUBLISHED_URL}/app` : redirectTarget;

  useEffect(() => {
    if (emailResendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setEmailResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [emailResendCooldown > 0]);

  // --- Google Login ---
  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await nativeGoogleLogin();
        
        const idToken = res?.result?.responseType === "online" ? res.result.idToken : null;
        if (idToken) {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: idToken,
          });

          if (error) throw error;
          const { data: confirmed, error: sessionError } = await supabase.auth.getUser();
          if (sessionError || !confirmed.user) throw new Error("लॉगिन सत्र तैयार नहीं हुआ। दोबारा कोशिश करें।");
          window.location.href = "/app";
        } else {
          throw new Error("गूगल टोकन प्राप्त नहीं हुआ।");
        }
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: redirectTarget },
        });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({
        title: "Google लॉगिन नहीं हो सका",
        description: /28444|developer console|DEVELOPER_ERROR/i.test(error?.message || "")
          ? "Google में इस इंस्टॉल ऐप की पहचान या signing SHA-1 का मिलान नहीं है ([28444])। GoogleProvider वाले Logcat विवरण से जाँच करें।"
          : error?.message || "दोबारा कोशिश करें।",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // --- Email Auth ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: Capacitor.isNativePlatform()
            ? `${PUBLISHED_URL}/reset-password`
            : `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "ईमेल भेज दिया!", description: "अपना ईमेल चेक करें और लिंक पर क्लिक करें।" });
        setMode("login");
      } else if (mode === "signup") {
        setPendingSignupRole(signupRole);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        if (!data.session) {
          setEmailConfirmationPending(true);
          setEmailResendCooldown(60);
          setMode("login");
          toast({
            title: "ईमेल की पुष्टि बाकी है",
            description: "लॉगिन से पहले ईमेल में भेजे गए पुष्टि लिंक पर क्लिक करें।",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setEmailConfirmationPending(false);
        if (consentNext && consentNext.startsWith("/")) {
          try { sessionStorage.removeItem("mcp_oauth_consent_next"); } catch {}
          window.location.href = consentNext;
        }
      }
    } catch (err: unknown) {
      const authError = err as { code?: string; message?: string; status?: number };
      const normalizedMessage = authError.message?.toLowerCase() ?? "";
      const isUnconfirmed = authError.code === "email_not_confirmed" || normalizedMessage.includes("email not confirmed");
      const isRateLimited = authError.status === 429 || authError.code === "over_email_send_rate_limit" || normalizedMessage.includes("after 50 seconds");
      const isInvalidLogin = authError.code === "invalid_credentials" || normalizedMessage.includes("invalid login credentials");

      if (isUnconfirmed) {
        setEmailConfirmationPending(true);
        toast({
          title: "ईमेल की पुष्टि बाकी है",
          description: "ईमेल में भेजे गए लिंक पर क्लिक करें, फिर लॉगिन करें।",
          variant: "destructive",
        });
      } else if (isRateLimited) {
        setEmailConfirmationPending(true);
        setEmailResendCooldown((seconds) => Math.max(seconds, 60));
        toast({
          title: "थोड़ा इंतज़ार करें",
          description: "पुष्टि ईमेल हाल ही में भेजा गया है। 60 सेकंड बाद दोबारा कोशिश करें।",
        });
      } else if (isInvalidLogin) {
        toast({
          title: "लॉगिन नहीं हुआ",
          description: "ईमेल या पासवर्ड सही नहीं है। नया अकाउंट है तो पहले पुष्टि ईमेल का लिंक खोलें।",
          variant: "destructive",
        });
      } else {
        toast({ title: "गलती हुई", description: "अभी अनुरोध पूरा नहीं हुआ। कृपया दोबारा कोशिश करें।", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!email || emailResendCooldown > 0 || emailResending) return;

    setEmailResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      });
      if (error) throw error;
      setEmailResendCooldown(60);
      toast({ title: "पुष्टि ईमेल दोबारा भेजा गया", description: "इनबॉक्स और स्पैम फ़ोल्डर देखें।" });
    } catch (err: unknown) {
      const authError = err as { code?: string; status?: number };
      if (authError.status === 429 || authError.code === "over_email_send_rate_limit") {
        setEmailResendCooldown(60);
        toast({ title: "थोड़ा इंतज़ार करें", description: "60 सेकंड बाद ईमेल दोबारा भेज सकेंगे।" });
      } else {
        toast({ title: "ईमेल नहीं भेजा जा सका", description: "कृपया कुछ देर बाद दोबारा कोशिश करें।", variant: "destructive" });
      }
    } finally {
      setEmailResending(false);
    }
  };

  // --- UI Titles ---
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
            <>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading || loading}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
                  </svg>
                  {googleLoading ? "Google खाता खुल रहा है..." : "Google से लॉगिन"}
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                या ईमेल से
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* ... (पुराना Email फॉर्म वैसे का वैसा ही है) ... */}
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
                  type="text"
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

                {mode === "login" && emailConfirmationPending && (
                  <div className="space-y-2 text-center" role="status" aria-live="polite">
                    <p className="text-sm text-muted-foreground">
                      लॉगिन से पहले ईमेल में भेजे पुष्टि लिंक पर क्लिक करें।
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={resendConfirmationEmail}
                      disabled={!email || emailResending || emailResendCooldown > 0}
                    >
                      {emailResending
                        ? "पुष्टि ईमेल भेज रहे हैं..."
                        : emailResendCooldown > 0
                        ? `ईमेल दोबारा भेजें (${emailResendCooldown} सेकंड)`
                        : "पुष्टि ईमेल दोबारा भेजें"}
                    </Button>
                  </div>
                )}

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
            </>
        </CardContent>
      </Card>
    </div>
  );
}
