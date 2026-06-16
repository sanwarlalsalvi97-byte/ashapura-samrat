import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import logoUrl from "@/assets/logo.png";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [tab, setTab] = useState<"email" | "phone">("email");

  // Email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "ईमेल भेज दिया!", description: "अपना ईमेल चेक करें और लिंक पर क्लिक करें।" });
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

  const normalizePhone = (p: string) => {
    let v = p.replace(/[\s-]/g, "");
    if (!v.startsWith("+")) {
      // assume India if 10 digits
      if (/^\d{10}$/.test(v)) v = "+91" + v;
    }
    return v;
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!/^\+\d{10,15}$/.test(p)) {
      toast({ title: "नंबर सही डालें", description: "उदा. 9876543210 या +919876543210", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: p });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "OTP भेज दिया!", description: `${p} पर SMS चेक करें` });
    } catch (err: any) {
      toast({ title: "OTP नहीं भेजा जा सका", description: err.message, variant: "destructive" });
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      toast({ title: "OTP डालें", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      toast({ title: "लॉगिन सफल!" });
    } catch (err: any) {
      toast({ title: "गलत OTP", description: err.message, variant: "destructive" });
    } finally {
      setOtpLoading(false);
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="email" className="gap-1"><Mail className="w-3.5 h-3.5" /> ईमेल</TabsTrigger>
              <TabsTrigger value="phone" className="gap-1"><Phone className="w-3.5 h-3.5" /> मोबाइल OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleAuth} className="space-y-4">
                <Input type="email" placeholder="ईमेल" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {mode !== "forgot" && (
                  <Input type="password" placeholder="पासवर्ड" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "रुकें..." : buttonText}
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
                    <ArrowLeft className="w-4 h-4" /> लॉगिन पर वापस जाएं
                  </button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="phone">
              {!otpSent ? (
                <form onSubmit={sendOtp} className="space-y-4">
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="मोबाइल नंबर (10 अंक)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    भारत के लिए 10 अंक डालें या देश कोड के साथ +91XXXXXXXXXX
                  </p>
                  <Button type="submit" className="w-full" disabled={otpLoading}>
                    {otpLoading ? "भेज रहे हैं..." : "OTP भेजें"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifyOtp} className="space-y-4">
                  <div className="text-sm text-muted-foreground text-center">
                    {normalizePhone(phone)} पर OTP भेजा गया
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="6 अंक का OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    maxLength={6}
                    required
                  />
                  <Button type="submit" className="w-full" disabled={otpLoading}>
                    {otpLoading ? "जाँच रहे हैं..." : "लॉगिन करें"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(""); }}
                    className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> नंबर बदलें
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
