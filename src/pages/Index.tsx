import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Auth from "./Auth";
import HomePage from "@/components/HomePage";
import AttendancePage from "@/components/AttendancePage";
import AdvancePage from "@/components/AdvancePage";
import CashbookPage from "@/components/CashbookPage";
import WorkersPage from "@/components/WorkersPage";
import BricksPage from "@/components/BricksPage";
import ContractorsPage from "@/components/ContractorsPage";
import RoofPage from "@/components/RoofPage";
import ReportPage from "@/components/ReportPage";
import SettingsPage from "@/components/SettingsPage";
import SubscriptionPage from "@/components/SubscriptionPage";
import ManageSubscriptionPage from "@/components/ManageSubscriptionPage";
import SitesPage from "@/components/SitesPage";
import PendingPaymentsPage from "@/components/PendingPaymentsPage";
import WorkerExpensesPage from "@/components/WorkerExpensesPage";
import PaymentHistoryPage from "@/components/PaymentHistoryPage";
import PunchAttendancePage from "@/components/PunchAttendancePage";
import GeoAdminPage from "@/components/GeoAdminPage";
import logoUrl from "@/assets/logo.png";
import BottomNav, { type TabId } from "@/components/BottomNav";
import { HardHat, Bell, UserCircle2, MapPin, Eye, Lock } from "lucide-react";
import { useAttendanceAlarm } from "@/hooks/use-attendance-alarm";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useAutoBackup } from "@/hooks/use-auto-backup";
import { RoleProvider, useRole } from "@/lib/roles";
import WorkerLinkPage from "@/components/WorkerLinkPage";
import { getLinkedWorker } from "@/lib/worker-link";

/** Tabs a मजदूर (worker) account may open — all read-only screens. */
const WORKER_TABS: TabId[] = ["home", "attendance", "report", "punch", "payment_history", "settings"];

export default function Index() {
  return (
    <RoleProvider>
      <IndexInner />
    </RoleProvider>
  );
}

function IndexInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("home");
  const [gpsOn, setGpsOn] = useState<boolean | null>(null);
  const { isWorker, loading: roleLoading } = useRole();
  const [linkChecked, setLinkChecked] = useState(false);
  const [linkedWorkerId, setLinkedWorkerId] = useState<string | null>(null);

  useAttendanceAlarm();
  useOfflineSync();
  useAutoBackup(!!session);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT" || !s) {
        setTab("home");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // After OAuth/email sign-in, resume an intended destination (e.g. OAuth consent)
  useEffect(() => {
    if (!session) return;
    let next = "";
    try { next = sessionStorage.getItem("mcp_oauth_consent_next") || ""; } catch { /* ignore */ }
    if (next.startsWith("/") && !next.startsWith("//")) {
      try { sessionStorage.removeItem("mcp_oauth_consent_next"); } catch { /* ignore */ }
      window.location.replace(next);
    }
  }, [session]);

  // GPS status check
  useEffect(() => {
    if (!navigator.geolocation) { setGpsOn(false); return; }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      () => { if (!cancelled) setGpsOn(true); },
      () => { if (!cancelled) setGpsOn(false); },
      { timeout: 5000, maximumAge: 60000 }
    );
    return () => { cancelled = true; };
  }, [session]);


  // Worker accounts must be linked to a worker record created by their contractor,
  // otherwise every screen is scoped to an empty tenant.
  useEffect(() => {
    if (!session || !isWorker) { setLinkChecked(true); setLinkedWorkerId(null); return; }
    let cancelled = false;
    setLinkChecked(false);
    getLinkedWorker().then((w) => {
      if (cancelled) return;
      setLinkedWorkerId(w?.id ?? null);
      setLinkChecked(true);
    });
    return () => { cancelled = true; };
  }, [session, isWorker]);

  if (loading || (session && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <HardHat className="w-10 h-10 text-primary animate-pulse" />
      </div>
    );
  }

  if (!session) return <Auth />;

  if (isWorker && !linkChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <HardHat className="w-10 h-10 text-primary animate-pulse" />
      </div>
    );
  }

  if (isWorker && !linkedWorkerId) {
    return <WorkerLinkPage onLinked={() => { setLinkChecked(false); setLinkedWorkerId(null); getLinkedWorker().then((w) => { setLinkedWorkerId(w?.id ?? null); setLinkChecked(true); }); }} />;
  }


  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoUrl} alt="Ashapura Samrat लोगो" width={32} height={32} className="w-8 h-8 object-contain drop-shadow-sm" />
          </div>
          <h1 className="text-base font-bold tracking-tight truncate">Ashapura Samrat</h1>
          <div className="flex items-center gap-1.5">
            <span
              className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                gpsOn ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"
              }`}
              title={gpsOn ? "GPS चालू" : "GPS बंद"}
            >
              <MapPin className="w-3 h-3" />
              {gpsOn ? "ON" : "OFF"}
            </span>
            <button
              onClick={() => alert("कोई नई सूचना नहीं")}
              className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted active:scale-95 transition"
              aria-label="सूचनाएं"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => setTab("settings")}
              className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted active:scale-95 transition"
              aria-label="प्रोफाइल"
            >
              <UserCircle2 className="w-6 h-6 text-primary" />
            </button>
          </div>
        </div>
        {gpsOn === false && (
          <div className="bg-destructive/10 text-destructive text-[10px] text-center py-1 px-3 font-semibold">
            <MapPin className="w-3 h-3 inline mr-1" />
            GPS बंद है — Location ON करें
          </div>
        )}
      </header>

      {isWorker && (
        <div className="bg-primary/10 text-primary text-[11px] text-center py-1.5 px-3 font-semibold flex items-center justify-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          मजदूर व्यू — सिर्फ देखने के लिए (Read-only)
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-4">
        {isWorker && !WORKER_TABS.includes(tab) ? (
          <div className="text-center py-16 space-y-2">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-bold">यह सेक्शन सिर्फ ठेकेदार (Admin) के लिए है</p>
            <p className="text-sm text-muted-foreground">आप अपनी हाजिरी और मजदूरी देख सकते हैं।</p>
          </div>
        ) : (
        <>
        {tab === "home" && <HomePage onNavigate={setTab} />}
        {tab === "attendance" && <AttendancePage />}
        {tab === "advance" && <AdvancePage />}
        {tab === "cashbook" && <CashbookPage />}
        {tab === "workers" && <WorkersPage onNavigate={setTab} />}
        {tab === "bricks" && <BricksPage />}
        {tab === "contractors" && <ContractorsPage />}
        {tab === "roof" && <RoofPage />}
        {tab === "report" && <ReportPage />}
        {tab === "settings" && <SettingsPage onNavigate={setTab} />}
        {tab === "sites" && <SitesPage />}
        {tab === "pending" && <PendingPaymentsPage />}
        {tab === "worker_expense" && <WorkerExpensesPage />}
        {tab === "payment_history" && <PaymentHistoryPage />}
        {tab === "punch" && <PunchAttendancePage />}
        {tab === "geo_admin" && <GeoAdminPage />}
        {tab === "subscription" && <SubscriptionPage onNavigate={setTab} />}
        {tab === "manage_subscription" && <ManageSubscriptionPage onNavigate={setTab} />}
        </>
        )}
      </main>

      {/* FAB removed — use Quick Actions / Workers page header instead */}


      <BottomNav active={tab} onNavigate={setTab} allowed={isWorker ? WORKER_TABS : undefined} />
    </div>
  );
}
