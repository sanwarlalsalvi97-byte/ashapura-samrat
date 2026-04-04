import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { HardHat } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (isSignUp) {
        toast({ title: "अकाउंट बन गया!", description: "ईमेल चेक करें।" });
      }
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
            <HardHat className="w-9 h-9 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">हाजिरी ऐप</CardTitle>
          <p className="text-muted-foreground text-sm">
            मजदूरों की हाजिरी और हिसाब रखें
          </p>
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
            <Input
              type="password"
              placeholder="पासवर्ड"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "रुकें..." : isSignUp ? "अकाउंट बनाएं" : "लॉगिन करें"}
            </Button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "पहले से अकाउंट है? लॉगिन करें" : "नया अकाउंट बनाएं"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
