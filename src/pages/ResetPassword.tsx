import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { KeyRound, AlertTriangle, Mail } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    const fail = (msg: string) => {
      setErrorMsg(msg);
      setFailed(true);
    };

    (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      // 0) Supabase returned an explicit error in the link
      const linkError = hash.get("error") || query.get("error");
      const errorCode = hash.get("error_code") || query.get("error_code");
      if (linkError) {
        fail(
          errorCode === "otp_expired"
            ? "यह लिंक समाप्त हो चुका है (एक्सपायर्ड)। कृपया नया रीसेट लिंक मंगवाएं।"
            : "यह लिंक अमान्य है या पहले ही इस्तेमाल हो चुका है। कृपया नया रीसेट लिंक मंगवाएं।"
        );
        return;
      }

      // 1) Implicit flow: #access_token=...&refresh_token=...
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }
        fail("यह लिंक अमान्य या समाप्त हो चुका है। कृपया नया रीसेट लिंक मंगवाएं।");
        return;
      }

      // 2) PKCE flow: ?code=...
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }
        fail("यह लिंक अमान्य या समाप्त हो चुका है। कृपया नया रीसेट लिंक मंगवाएं।");
        return;
      }

      // 3) OTP token link: ?token_hash=...&type=recovery
      const token_hash = query.get("token_hash") || hash.get("token_hash");
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });
        if (!error) {
          setReady(true);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }
        fail("यह लिंक समाप्त हो चुका है या पहले इस्तेमाल हो चुका है। कृपया नया रीसेट लिंक मंगवाएं।");
        return;
      }

      // 4) Already-authenticated recovery session
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else fail("रीसेट लिंक नहीं मिला या वह समाप्त हो चुका है। कृपया नया रीसेट लिंक मंगवाएं।");
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResent(true);
      toast({
        title: "नया लिंक भेज दिया!",
        description: "अपना ईमेल चेक करें और नए लिंक पर क्लिक करें।",
      });
    } catch (err: any) {
      toast({ title: "गलती हुई", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "पासवर्ड मेल नहीं खाते", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "पासवर्ड कम से कम 6 अक्षर का होना चाहिए", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "पासवर्ड बदल गया!", description: "अब लॉगिन करें।" });
      await supabase.auth.signOut();
      navigate("/");
    } catch (err: any) {
      toast({ title: "गलती हुई", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm animate-slide-up">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            {failed ? (
              <AlertTriangle className="w-9 h-9 text-primary-foreground" />
            ) : (
              <KeyRound className="w-9 h-9 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {failed ? "लिंक अमान्य या एक्सपायर" : "नया पासवर्ड सेट करें"}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {failed ? "नीचे ईमेल डालकर नया लिंक मंगवाएं" : "अपना नया पासवर्ड डालें"}
          </p>
        </CardHeader>
        <CardContent>
          {failed ? (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive text-center">
                  {errorMsg || "यह लिंक अमान्य या समाप्त हो चुका है।"}
                </p>
              </div>

              {resent ? (
                <p className="text-sm text-center text-muted-foreground">
                  नया रीसेट लिंक <span className="font-medium text-foreground">{resendEmail}</span> पर भेज दिया गया है। ईमेल चेक करें।
                </p>
              ) : (
                <form onSubmit={handleResend} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="ईमेल"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={resending}>
                    <Mail className="w-4 h-4 mr-2" />
                    {resending ? "भेज रहे हैं..." : "नया रीसेट लिंक भेजें"}
                  </Button>
                </form>
              )}

              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                लॉगिन पर वापस जाएं
              </Button>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              लिंक सत्यापित हो रहा है...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="नया पासवर्ड"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <Input
                type="password"
                placeholder="पासवर्ड फिर से डालें"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "रुकें..." : "पासवर्ड बदलें"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
