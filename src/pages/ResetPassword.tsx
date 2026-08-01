import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

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
      }

      // 4) Already-authenticated recovery session
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else setFailed(true);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

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
            <KeyRound className="w-9 h-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">नया पासवर्ड सेट करें</CardTitle>
          <p className="text-muted-foreground text-sm">
            अपना नया पासवर्ड डालें
          </p>
        </CardHeader>
        <CardContent>
          {!ready ? (
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
