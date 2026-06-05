import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Shield, UserCog } from "lucide-react";

export default function RolesSection() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setRoles((data || []).map((r: any) => r.role));
    setLoading(false);
  }

  async function claim(role: "admin" | "staff") {
    if (!userId) return;
    if (role === "admin") {
      const { data, error } = await supabase.rpc("claim_initial_admin");
      if (error) {
        toast({ title: "गलती", description: error.message, variant: "destructive" });
      } else if (data === true) {
        toast({ title: "एडमिन रोल सेट हो गया" });
        load();
      } else {
        toast({
          title: "अनुमति नहीं",
          description: "एडमिन पहले से मौजूद है। केवल पहला यूज़र एडमिन बन सकता है।",
          variant: "destructive",
        });
      }
      return;
    }
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast({ title: "गलती", description: error.message, variant: "destructive" });
    else { toast({ title: "रोल सेट हो गया" }); load(); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4" /> रोल (Admin / Staff)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-xs text-muted-foreground">लोड हो रहा है...</div>
        ) : roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span key={r} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
                {r === "admin" ? "एडमिन" : "स्टाफ"}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">अभी कोई रोल नहीं</div>
        )}
        <div className="flex gap-2">
          {!roles.includes("admin") && (
            <Button size="sm" variant="outline" onClick={() => claim("admin")}>
              <UserCog className="w-4 h-4 mr-1" /> एडमिन बनें
            </Button>
          )}
          {!roles.includes("staff") && (
            <Button size="sm" variant="outline" onClick={() => claim("staff")}>
              स्टाफ बनें
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          पहली बार साइनअप करने वाला यूज़र खुद को एडमिन बना सकता है।
        </p>
      </CardContent>
    </Card>
  );
}
