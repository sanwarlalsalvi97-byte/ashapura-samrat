import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import logoUrl from "@/assets/logo.png";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "ईमेल भेज दिया!",
          description: "अपना ईमेल चेक करें और लिंक पर क्लिक करें।",
        });
        setMode("login");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "अकाउंट बन गया!", description: "ईमेल चेक करें।" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: "गलती हुई", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "forgot" ? "पासवर्ड भूल गए?" : mode === "signup" ? "नया अकाउंट" : "Ashapura Samrat";
  const subtitle =
    mode === "forgot"
      ? "ईमेल डालें, हम लिंक भेजेंगे"
      : "मजदूरों की हाजिरी और हिसाब रखें";
  const buttonText =
    mode === "forgot" ? "लिंक भेजें" : mode === "signup" ? "अकाउंट बनाएं" : "लॉगिन करें";

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
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
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
              {loading ? "रुकें..." : buttonText}
            </Button>

            {mode === "login" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  पासवर्ड भूल गए?
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  नया अकाउंट बनाएं
                </button>
              </div>
            )}

            {mode === "signup" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                पहले से अकाउंट है? लॉगिन करें
              </button>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
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
