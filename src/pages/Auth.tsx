import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Smartphone, HardHat, UserRound } from "lucide-react";
import { isNative } from "@/lib/native";
import { setPendingSignupRole } from "@/lib/roles";
import logoUrl from "@/assets/logo.png";

type Mode = "login" | "signup" | "forgot" | "phone" | "otp";

const RESEND_SECONDS = 60;

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [signupRole, setSignupRole] = useState<"admin" | "worker">("admin");
  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [resendIn]);

  const e164 = `+91${phone}`;

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "गलत नंबर", description: "10 अंकों का सही मोबाइल नंबर डालें।", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) throw error;
      setMode("otp");
      setResendIn(RESEND_SECONDS);
      toast({ title: "OTP भेज दिया", description: `${e164} पर 6 अंकों का कोड भेजा गया।` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OTP नहीं भेजा जा सका";
      toast({
        title: "OTP नहीं भेजा जा सका",
        description: /provider|not enabled|unsupported|sms/i.test(msg)
          ? "SMS सेवा अभी चालू नहीं है। कृपया ईमेल/पासवर्ड से लॉगिन करें।"
          : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      toast({ title: "गलत OTP", description: "6 अंकों का कोड डालें।", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: "sms" });
      if (error) throw error;
      toast({ title: "लॉगिन हो गया ✅" });
    } catch (err: unknown) {
      toast({
        title: "OTP गलत या एक्सपायर",
        description: err instanceof Error ? err.message : "दोबारा कोशिश करें।",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  const consentNext = (() => {
    try { return sessionStorage.getItem("mcp_oauth_consent_next") || ""; } catch { return ""; }
  })();
  const redirectTarget = window.location.origin + "/";
  const PUBLISHED_URL = "https://ashapurapro.com";





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
    : mode === "phone" ? "मोबाइल से लॉगिन"
    : mode === "otp" ? "OTP डालें"
    : "Ashapura Samrat";
  const subtitle =
    mode === "forgot" ? "ईमेल डालें, हम लिंक भेजेंगे"
    : mode === "phone" ? "10 अंकों का मोबाइल नंबर डालें"
    : mode === "otp" ? `${e164} पर भेजा गया 6 अंकों का कोड`
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
          {mode === "phone" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-md border border-input text-sm text-muted-foreground">+91</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="मोबाइल नंबर"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              <Button className="w-full" onClick={sendOtp} disabled={loading || phone.length !== 10}>
                {loading ? "रुकें..." : "OTP भेजें"}
              </Button>
              <button type="button" onClick={() => setMode("login")} className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> ईमेल से लॉगिन करें
              </button>
            </div>
          )}

          {mode === "otp" && (
            <div className="space-y-3">
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 अंकों का OTP"
                className="text-center text-lg tracking-[0.4em]"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <Button className="w-full" onClick={verifyOtp} disabled={loading || otp.length !== 6}>
                {loading ? "जाँच रहे हैं..." : "वेरिफाई करें"}
              </Button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={sendOtp}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {resendIn > 0 ? `दोबारा भेजें (${resendIn}s)` : "OTP दोबारा भेजें"}
              </button>
              <button type="button" onClick={() => { setMode("phone"); setOtp(""); }} className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> नंबर बदलें
              </button>
            </div>
          )}

          {mode !== "phone" && mode !== "otp" && (<>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setMode("phone")}
            disabled={loading}
          >
            <Smartphone className="w-4 h-4 mr-2" />
            मोबाइल OTP से लॉगिन
          </Button>

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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "रुकें..."
                : mode === "forgot"
                ? "लिंक भेजें"
                : mode === "signup"
                ? "अकाउंट बनाएं"
                : "लॉगिन करें"}
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
          </>)}



        </CardContent>
      </Card>
    </div>
  );
}
