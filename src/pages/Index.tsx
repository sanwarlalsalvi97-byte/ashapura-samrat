import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Auth from "./Auth";
import AttendancePage from "@/components/AttendancePage";
import AdvancePage from "@/components/AdvancePage";
import WorkersPage from "@/components/WorkersPage";
import ContractorsPage from "@/components/ContractorsPage";
import BricksPage from "@/components/BricksPage";
import ReportPage from "@/components/ReportPage";
import SettingsPage from "@/components/SettingsPage";
import BottomNav, { type TabId } from "@/components/BottomNav";
import { HardHat } from "lucide-react";

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("attendance");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <HardHat className="w-10 h-10 text-primary animate-pulse" />
      </div>
    );
  }

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto flex items-center px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <HardHat className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold">हाजिरी ऐप</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "attendance" && <AttendancePage />}
        {tab === "advance" && <AdvancePage />}
        {tab === "workers" && <WorkersPage />}
        {tab === "report" && <ReportPage />}
        {tab === "settings" && <SettingsPage />}
      </main>

      <BottomNav active={tab} onNavigate={setTab} />
    </div>
  );
}
