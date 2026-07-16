import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { LogOut, User, IndianRupee, Download, Languages, Clock, Bell, BellOff, WifiOff, Users, Trash2, Moon, Sun, HardHat, Layers, BookOpen, ChevronRight, Crown, Building2, Type, Lock, Upload, HardDriveDownload, RefreshCw, AlertTriangle, Cloud } from "lucide-react";
import { getTheme, setTheme as persistTheme, type Theme } from "@/lib/theme";
import { getFontSize, setFontSize as persistFontSize, type FontSize } from "@/lib/font-size";
import type { TabId } from "./BottomNav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getWorkers, getMonthlyReport } from "@/lib/supabase-helpers";
import { exportCSV } from "@/lib/export-utils";
import { getWorkTime, setWorkTime, formatTime12h } from "@/lib/work-time";
import { requestNotificationPermission } from "@/hooks/use-attendance-alarm";
import { isSimulatedOffline, setSimulatedOffline } from "@/lib/offline-queue";
import { getGroupingMode, setGroupingMode, type GroupingMode } from "@/lib/grouping-prefs";
import RolesSection from "./RolesSection";
import { isPinEnabled, setPin as savePin, removePin, lock as lockApp } from "@/lib/pin-lock";
import { buildBackup, encryptBackup, decryptBackup, previewEnvelope, restoreBackup, backupFilename, downloadText, savePendingBackup, readPendingBackup, clearPendingBackup, type BackupPayload } from "@/lib/backup";
import { clearAllCaches, resetAllUserData } from "@/lib/reset-app";
import { downloadLatestBackupFromGoogleDrive, uploadBackupToGoogleDrive } from "@/lib/google-drive-backup";
import { AUTO_BACKUP_FREQ_KEY, dispatchAutoBackupSettingsChanged, getAutoBackupPassword, setAutoBackupPassword } from "@/hooks/use-auto-backup";

interface SettingsPageProps {
  onNavigate?: (tab: TabId) => void;
}

export default function SettingsPage({ onNavigate }: SettingsPageProps = {}) {
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [fontSize, setFontSizeState] = useState<FontSize>(getFontSize());
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultRate, setDefaultRate] = useState("500");
  const [isHindi, setIsHindi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dedupeScanning, setDedupeScanning] = useState(false);
  const [dedupeDeleting, setDedupeDeleting] = useState(false);
  const [dupes, setDupes] = useState<{ id: string; name: string; role: string }[]>([]);

  // Work time + alarm
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("18:00");
  const [alarmTime, setAlarmTime] = useState("09:00");
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  const [simOffline, setSimOffline] = useState(isSimulatedOffline());
  const [groupingMode, setGroupingModeState] = useState<GroupingMode>(getGroupingMode());

  // PIN lock
  const [pinEnabled, setPinEnabled] = useState(isPinEnabled());
  const [newPin, setNewPin] = useState("");

  // Backup / Restore
  const [backupPassword, setBackupPassword] = useState(() => getAutoBackupPassword());
  const [busy, setBusy] = useState<null | "backup" | "restore" | "drive-backup" | "drive-restore">(null);
  const [restoreFileText, setRestoreFileText] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restorePreview, setRestorePreview] = useState<ReturnType<typeof previewEnvelope> | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => localStorage.getItem("last-backup-at"));
  const [autoBackup, setAutoBackup] = useState<string>(() => localStorage.getItem(AUTO_BACKUP_FREQ_KEY) || "manual");
  const [pending, setPending] = useState(() => readPendingBackup());

  // Auto-flush pending backup when back online
  useEffect(() => {
    const onOnline = () => {
      const p = readPendingBackup();
      if (!p) return;
      downloadText(p.name, p.text);
      clearPendingBackup();
      setPending(null);
      toast({ title: t("बैकअप डाउनलोड हो गया / Backup downloaded", "Backup downloaded") });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProfile();
    const savedLang = localStorage.getItem("hajiri-lang");
    if (savedLang === "en") setIsHindi(false);
    const savedRate = localStorage.getItem("hajiri-default-rate");
    if (savedRate) setDefaultRate(savedRate);
    const wt = getWorkTime();
    setCheckIn(wt.checkIn);
    setCheckOut(wt.checkOut);
    setAlarmTime(wt.alarmTime);
    setAlarmEnabled(wt.alarmEnabled);
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email || "");
      setDisplayName(user.user_metadata?.display_name || "");
      setPhone(user.user_metadata?.phone || "");
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, phone }
      });
      if (error) throw error;
      toast({ title: isHindi ? "✅ प्रोफाइल सेव हो गई!" : "✅ Profile saved!" });
    } catch (err: any) {
      toast({ title: isHindi ? "गलती" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultRate = () => {
    localStorage.setItem("hajiri-default-rate", defaultRate);
    toast({ title: isHindi ? `✅ डिफ़ॉल्ट दिहाड़ी ₹${defaultRate} सेट हो गई` : `✅ Default rate set to ₹${defaultRate}` });
  };

  const saveWorkTimeHandler = async () => {
    setWorkTime({ checkIn, checkOut, alarmTime, alarmEnabled });
    if (alarmEnabled && notifPerm !== "granted" && notifPerm !== "unsupported") {
      const ok = await requestNotificationPermission();
      setNotifPerm(ok ? "granted" : "denied");
    }
    toast({ title: isHindi ? "✅ समय और अलार्म सेव हो गया" : "✅ Time & alarm saved" });
  };

  const enableAlarm = async (checked: boolean) => {
    setAlarmEnabled(checked);
    if (checked && notifPerm !== "granted" && notifPerm !== "unsupported") {
      const ok = await requestNotificationPermission();
      setNotifPerm(ok ? "granted" : "denied");
      if (!ok) {
        toast({
          title: isHindi ? "नोटिफिकेशन की अनुमति नहीं मिली" : "Notification permission denied",
          description: isHindi ? "Browser settings में जाकर अनुमति दें" : "Please allow in browser settings",
          variant: "destructive",
        });
      }
    }
  };

  const toggleLanguage = (checked: boolean) => {
    setIsHindi(checked);
    localStorage.setItem("hajiri-lang", checked ? "hi" : "en");
    toast({ title: checked ? "भाषा: हिंदी" : "Language: English" });
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const now = new Date();
      await getWorkers();
      const report = await getMonthlyReport(now.getFullYear(), now.getMonth() + 1);

      const headers = ["Worker Name", "Role", "Daily Rate", "Date", "Status", "Advance", "Site", "Notes"];
      const rows = report.map((r: any) => [
        r.workers?.name || "",
        r.workers?.role || "",
        r.workers?.daily_rate || 0,
        r.date,
        r.status,
        r.advance,
        r.site_name || "",
        r.notes || "",
      ]);
      exportCSV(`hajiri-report-${now.getFullYear()}-${now.getMonth() + 1}.csv`, headers, rows);
      toast({ title: isHindi ? "✅ डेटा डाउनलोड हो गया!" : "✅ Data exported!" });
    } catch (err: any) {
      toast({ title: isHindi ? "गलती" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };


  const scanDuplicates = async () => {
    setDedupeScanning(true);
    setDupes([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("लॉगिन ज़रूरी है", "Login required"));

      const { data: workers, error: wErr } = await supabase
        .from("workers")
        .select("id, name, role, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (wErr) throw wErr;
      if (!workers || workers.length === 0) {
        toast({ title: t("कोई वर्कर नहीं मिला", "No workers found") });
        return;
      }

      // Group by trimmed lowercase name
      const groups = new Map<string, typeof workers>();
      workers.forEach((w) => {
        const key = (w.name || "").trim().toLowerCase();
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(w);
      });

      // For names with 2+ entries, find which have zero attendance
      const candidates: { id: string; name: string; role: string }[] = [];
      for (const [, list] of groups) {
        if (list.length < 2) continue;
        // Check attendance count for each
        const ids = list.map((w) => w.id);
        const { data: att, error: aErr } = await supabase
          .from("attendance")
          .select("worker_id")
          .in("worker_id", ids);
        if (aErr) throw aErr;
        const counts = new Map<string, number>();
        ids.forEach((id) => counts.set(id, 0));
        (att || []).forEach((r: any) => {
          counts.set(r.worker_id, (counts.get(r.worker_id) || 0) + 1);
        });
        // Keep at least one per name: prefer one with attendance, else the oldest.
        const withAtt = list.filter((w) => (counts.get(w.id) || 0) > 0);
        const empties = list.filter((w) => (counts.get(w.id) || 0) === 0);
        // If at least one has attendance OR there are multiple empties, all empties are safe to remove
        // (but always keep one row for the name if all are empty)
        let removable = empties;
        if (withAtt.length === 0 && empties.length > 0) {
          // keep the oldest (first) empty, remove the rest
          removable = empties.slice(1);
        }
        removable.forEach((w) => candidates.push({ id: w.id, name: w.name, role: w.role }));
      }

      setDupes(candidates);
      if (candidates.length === 0) {
        toast({ title: t("कोई डुप्लिकेट नहीं मिला ✅", "No duplicates found ✅") });
      } else {
        toast({
          title: t(`${candidates.length} डुप्लिकेट मिले`, `Found ${candidates.length} duplicates`),
          description: t("नीचे देखें और हटाएं", "Review below and delete"),
        });
      }
    } catch (err: any) {
      toast({ title: t("गलती", "Error"), description: err.message, variant: "destructive" });
    } finally {
      setDedupeScanning(false);
    }
  };

  const deleteDuplicates = async () => {
    if (dupes.length === 0) return;
    setDedupeDeleting(true);
    try {
      const ids = dupes.map((d) => d.id);
      const { error } = await supabase.from("workers").delete().in("id", ids);
      if (error) throw error;
      toast({ title: t(`✅ ${ids.length} डुप्लिकेट हटाए गए`, `✅ Deleted ${ids.length} duplicates`) });
      setDupes([]);
    } catch (err: any) {
      toast({ title: t("गलती", "Error"), description: err.message, variant: "destructive" });
    } finally {
      setDedupeDeleting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const t = (hi: string, en: string) => isHindi ? hi : en;

  const createEncryptedBackup = async () => {
    const p = await buildBackup();
    const text = await encryptBackup(p, backupPassword);
    const name = backupFilename();
    const now = new Date().toISOString();
    localStorage.setItem("last-backup-at", now);
    setLastBackupAt(now);
    return { text, name };
  };

  useEffect(() => {
    const onAutoBackupCompleted = (event: Event) => {
      const at = (event as CustomEvent<{ at?: string }>).detail?.at || localStorage.getItem("last-backup-at");
      if (at) setLastBackupAt(at);
      setPending(readPendingBackup());
    };
    window.addEventListener("auto-backup-completed", onAutoBackupCompleted);
    return () => window.removeEventListener("auto-backup-completed", onAutoBackupCompleted);
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("सेटिंग्स", "Settings")}</h2>

      <RolesSection />

      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {t("थीम", "Theme")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("डार्क मोड", "Dark mode")}</span>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(c) => {
                const next: Theme = c ? "dark" : "light";
                setThemeState(next);
                persistTheme(next);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("आपकी पसंद याद रखी जाएगी", "Your choice is remembered")}
          </p>
        </CardContent>
      </Card>

      {/* Font size */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Type className="w-4 h-4" />
            {t("अक्षर का आकार", "Font Size")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "small" as FontSize, hi: "छोटा", en: "Small", cls: "text-xs" },
              { id: "medium" as FontSize, hi: "मध्यम", en: "Medium", cls: "text-sm" },
              { id: "large" as FontSize, hi: "बड़ा", en: "Large", cls: "text-base" },
            ]).map(({ id, hi, en, cls }) => (
              <button
                key={id}
                onClick={() => {
                  setFontSizeState(id);
                  persistFontSize(id);
                  toast({ title: t(`अक्षर का आकार: ${hi}`, `Font size: ${en}`) });
                }}
                className={`py-2 px-2 rounded-lg border-2 font-semibold transition-all ${cls} ${
                  fontSize === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                Aa
                <div className="text-[10px] font-medium mt-0.5">{t(hi, en)}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t("बदलाव तुरंत पूरे ऐप पर लागू होगा", "Change applies instantly across the app")}
          </p>
        </CardContent>
      </Card>

      {/* Tools / Modules */}
      {onNavigate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("टूल्स", "Tools")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {[
              { id: "subscription" as TabId, hi: "Subscription / प्लान", en: "Subscription / Plans", icon: Crown },
              { id: "sites" as TabId, hi: "साइट प्रबंधन", en: "Site Management", icon: Building2 },
              { id: "contractors" as TabId, hi: "ठेकेदार / अनुबंध", en: "Contractor / Agreement", icon: HardHat },
              { id: "cashbook" as TabId, hi: "हिसाब (आय/खर्च)", en: "Cashbook", icon: BookOpen },
              { id: "bricks" as TabId, hi: "ईंट गणना", en: "Brick calculator", icon: Layers },
              { id: "roof" as TabId, hi: "छत / RCC गणना", en: "Roof / RCC calculator", icon: HardHat },
            ].map(({ id, hi, en, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/40 rounded-md px-1 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm flex-1">{t(hi, en)}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      )}


      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="w-4 h-4" />
            {t("प्रोफाइल", "Profile")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">{t("ईमेल", "Email")}</Label>
            <Input value={email} disabled className="mt-1 opacity-60" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("नाम", "Name")}</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("अपना नाम लिखें", "Enter your name")} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("फोन नंबर", "Phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="mt-1" />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full" size="sm">
            {saving ? t("सेव हो रहा है...", "Saving...") : t("प्रोफाइल सेव करें", "Save Profile")}
          </Button>
        </CardContent>
      </Card>

      {/* Default Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            {t("डिफ़ॉल्ट दिहाड़ी", "Default Daily Rate")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="number" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} placeholder="₹500" />
          <Button onClick={saveDefaultRate} variant="secondary" className="w-full" size="sm">
            {t("सेट करें", "Set Rate")}
          </Button>
        </CardContent>
      </Card>

      {/* Work Time + Alarm */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t("समय और अलार्म", "Work Time & Alarm")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t("आने का समय", "Check-in")}</Label>
              <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("जाने का समय", "Check-out")}</Label>
              <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {alarmEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm">{t("हाजिरी अलार्म", "Attendance Alarm")}</span>
            </div>
            <Switch checked={alarmEnabled} onCheckedChange={enableAlarm} />
          </div>

          {alarmEnabled && (
            <div>
              <Label className="text-xs text-muted-foreground">{t("अलार्म का समय", "Alarm time")}</Label>
              <Input type="time" value={alarmTime} onChange={(e) => setAlarmTime(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                {t(`रोज़ ${formatTime12h(alarmTime)} पर याद दिलाएगा`, `Daily reminder at ${formatTime12h(alarmTime)}`)}
              </p>
              {notifPerm === "denied" && (
                <p className="text-xs text-destructive mt-1">
                  {t("⚠ Browser में नोटिफिकेशन की अनुमति दें", "⚠ Allow notifications in browser")}
                </p>
              )}
              {notifPerm === "unsupported" && (
                <p className="text-xs text-warning mt-1">
                  {t("इस ब्राउज़र में नोटिफिकेशन नहीं चलते", "Notifications not supported in this browser")}
                </p>
              )}
            </div>
          )}

          <Button onClick={saveWorkTimeHandler} variant="secondary" className="w-full" size="sm">
            {t("समय सेव करें", "Save Time")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Languages className="w-4 h-4" />
            {t("भाषा", "Language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("हिंदी", "Hindi")}</span>
            <Switch checked={isHindi} onCheckedChange={toggleLanguage} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("बंद करें = English", "Turn on = हिंदी")}
          </p>
        </CardContent>
      </Card>


      {/* Developer / Test: simulate offline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            {t("ऑफलाइन टेस्ट मोड", "Offline Test Mode")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("ऑफलाइन सिम्युलेट करें", "Simulate offline")}</span>
            <Switch
              checked={simOffline}
              onCheckedChange={(c) => {
                setSimOffline(c);
                setSimulatedOffline(c);
                toast({
                  title: c
                    ? t("ऑफलाइन मोड चालू (टेस्ट)", "Offline mode ON (test)")
                    : t("ऑनलाइन — सिंक हो रहा है", "Online — syncing"),
                });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t(
              "इंटरनेट बंद किए बिना ऑफलाइन क्यूइंग और ऑटो-सिंक टेस्ट करें। बंद करते ही पुरानी एंट्री सर्वर पर भेज दी जाएंगी।",
              "Test queuing & auto-sync without turning off Wi-Fi. Disabling will flush queued entries to the server."
            )}
          </p>
        </CardContent>
      </Card>

      {/* Duplicate workers cleanup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            {t("डुप्लिकेट वर्कर साफ करें", "Clean Duplicate Workers")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "एक ही नाम के कई वर्कर ढूंढता है और जिन पर एक भी हाजिरी नहीं है उन्हें हटाने की सुविधा देता है। हाजिरी वाले वर्कर सुरक्षित रहते हैं।",
              "Finds workers with the same name and lets you remove the ones with no attendance. Workers with attendance are kept safe."
            )}
          </p>
          <Button
            onClick={scanDuplicates}
            disabled={dedupeScanning || dedupeDeleting}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {dedupeScanning
              ? t("स्कैन हो रहा है...", "Scanning...")
              : t("डुप्लिकेट खोजें", "Scan for duplicates")}
          </Button>

          {dupes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">
                {t(`हटाने योग्य: ${dupes.length}`, `Removable: ${dupes.length}`)}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                {dupes.map((d) => (
                  <div key={d.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="truncate">{d.name}</span>
                    <span className="text-muted-foreground shrink-0">{d.role}</span>
                  </div>
                ))}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    disabled={dedupeDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                    {dedupeDeleting
                      ? t("हट रहा है...", "Deleting...")
                      : t(`${dupes.length} डुप्लिकेट हटाएं`, `Delete ${dupes.length} duplicates`)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("क्या आप पक्के हैं?", "Are you sure?")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t(
                        `${dupes.length} डुप्लिकेट वर्कर हट जाएंगे (इन पर कोई हाजिरी नहीं है)। यह वापस नहीं आएगा।`,
                        `${dupes.length} duplicate workers will be removed (none have attendance). This cannot be undone.`
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("रद्द करें", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteDuplicates}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("हटाएं", "Delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            {t("डेटा एक्सपोर्ट", "Data Export")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={exportData} disabled={exporting} variant="outline" className="w-full" size="sm">
            {exporting ? t("डाउनलोड हो रहा है...", "Exporting...") : t("इस महीने की CSV डाउनलोड करें", "Download this month's CSV")}
          </Button>
        </CardContent>
      </Card>

      {/* PIN Lock */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t("PIN लॉक", "PIN Lock")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">{t("ऐप खोलने पर PIN मांगें", "Require PIN to open app")}</span>
            <Switch
              checked={pinEnabled}
              onCheckedChange={async (c) => {
                if (!c) { removePin(); setPinEnabled(false); toast({ title: t("PIN हटा दिया गया", "PIN removed") }); }
                else {
                  const p = prompt(t("4-8 अंक का नया PIN", "New PIN (4-8 digits)") || "") || "";
                  try { await savePin(p); setPinEnabled(true); toast({ title: t("PIN सेट हो गया", "PIN set") }); }
                  catch (e: any) { toast({ title: t("गलती", "Error"), description: e.message, variant: "destructive" }); }
                }
              }}
            />
          </div>
          {pinEnabled && (
            <div className="flex gap-2">
              <Input type="password" inputMode="numeric" pattern="\d*" maxLength={8} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder={t("नया PIN बदलें", "Change PIN")} />
              <Button size="sm" variant="secondary" onClick={async () => {
                try { await savePin(newPin); setNewPin(""); toast({ title: t("PIN बदल दिया गया", "PIN updated") }); }
                catch (e: any) { toast({ title: t("गलती", "Error"), description: e.message, variant: "destructive" }); }
              }}>{t("बदलें", "Update")}</Button>
              <Button size="sm" variant="outline" onClick={() => { lockApp(); location.reload(); }}>{t("अभी लॉक", "Lock now")}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup & Restore */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            {t("बैकअप और रीस्टोर", "Backup & Restore")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "JSON बैकअप डाउनलोड करें (Workers, Attendance, Advances, Cashbook, Reports, Settings) — बिना पासवर्ड के, कहीं भी सुरक्षित रखें।",
              "Download a JSON backup (Workers, Attendance, Advances, Cashbook, Reports, Settings) — no password, save anywhere safe."
            )}
          </p>


          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("backup");
                try {
                  const { text, name } = await createEncryptedBackup();
                  if (navigator.onLine) {
                    downloadText(name, text);
                  } else {
                    savePendingBackup(text, name);
                    setPending(readPendingBackup());
                    toast({ title: t("ऑफलाइन: कनेक्शन लौटने पर डाउनलोड होगा", "Offline: will download when back online") });
                  }
                  toast({ title: t("✅ बैकअप तैयार", "✅ Backup ready") });
                } catch (e: any) {
                  toast({ title: t("गलती", "Error"), description: e.message, variant: "destructive" });
                } finally { setBusy(null); }
              }}
              className="gap-2"
            >
              <HardDriveDownload className="w-4 h-4" />
              {busy === "backup" ? t("बना रहा है...", "Building...") : t("बैकअप बनाएँ", "Backup now")}
            </Button>

            <Button asChild size="sm" variant="outline" className="gap-2">
              <label>
                <Upload className="w-4 h-4" />
                {t("फ़ाइल चुनें", "Choose file")}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const text = await f.text();
                    setRestoreFileText(text);
                    setRestoreFileName(f.name);
                    setRestorePreview(previewEnvelope(text));
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null || backupPassword.length < 6}
              onClick={async () => {
                setBusy("drive-backup");
                try {
                  const { text, name } = await createEncryptedBackup();
                  await uploadBackupToGoogleDrive(name, text);
                  toast({ title: t("✅ Google Drive में बैकअप सेव", "✅ Backup saved to Google Drive") });
                } catch (e: any) {
                  toast({ title: t("Google Drive गलती", "Google Drive error"), description: e.message, variant: "destructive" });
                } finally { setBusy(null); }
              }}
              className="gap-2"
            >
              <Cloud className="w-4 h-4" />
              {busy === "drive-backup" ? t("अपलोड हो रहा है...", "Uploading...") : t("Drive बैकअप", "Drive backup")}
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("drive-restore");
                try {
                  const file = await downloadLatestBackupFromGoogleDrive();
                  setRestoreFileText(file.text);
                  setRestoreFileName(file.name);
                  setRestorePreview(previewEnvelope(file.text));
                  toast({ title: t("Google Drive बैकअप मिला", "Google Drive backup loaded") });
                } catch (e: any) {
                  toast({ title: t("Google Drive गलती", "Google Drive error"), description: e.message, variant: "destructive" });
                } finally { setBusy(null); }
              }}
              className="gap-2"
            >
              <HardDriveDownload className="w-4 h-4" />
              {busy === "drive-restore" ? t("लोड हो रहा है...", "Loading...") : t("Drive रीस्टोर", "Drive restore")}
            </Button>
          </div>

          {restorePreview && restoreFileText && (
            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
              <div className="text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {t("रीस्टोर पूर्वावलोकन", "Restore preview")}
              </div>
              <div className="text-xs text-muted-foreground truncate">{restoreFileName}</div>
              {restorePreview.createdAt && (
                <div className="text-xs">{t("बैकअप तारीख", "Backup date")}: <b>{new Date(restorePreview.createdAt).toLocaleString()}</b></div>
              )}
              <div className="text-xs">{t("आकार", "Size")}: {(restoreFileText.length / 1024).toFixed(1)} KB {restorePreview.encrypted ? "🔒" : ""}</div>
              {restorePreview.counts && (
                <div className="text-[11px] text-muted-foreground">
                  {Object.entries(restorePreview.counts).map(([k, v]) => `${k}: ${v}`).join(" • ")}
                </div>
              )}
              {restorePreview.encrypted && (
                <Input type="password" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} placeholder={t("बैकअप पासवर्ड", "Backup password")} />
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="w-full" disabled={busy !== null || (restorePreview.encrypted && restorePassword.length < 1)}>
                    {t("मौजूदा डेटा बदलें और रीस्टोर करें", "Replace data & restore")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("क्या आप पक्के हैं?", "Are you sure?")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("आपका मौजूदा डेटा पूरी तरह बदल दिया जाएगा। यह वापस नहीं आएगा।", "Your current data will be fully replaced. This cannot be undone.")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("रद्द", "Cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setBusy("restore");
                        try {
                          let payload: BackupPayload;
                          try { payload = await decryptBackup(restoreFileText!, restorePassword); }
                          catch (e: any) { throw new Error(e.message); }
                          if (payload.app !== "AshapuraSamrat") throw new Error("Invalid backup");
                          await restoreBackup(payload);
                          setRestoreFileText(null); setRestorePreview(null); setRestorePassword("");
                          toast({ title: t("✅ रीस्टोर पूरा हुआ", "✅ Restore complete") });
                        } catch (e: any) {
                          toast({ title: t("गलती", "Error"), description: e.message, variant: "destructive" });
                        } finally { setBusy(null); }
                      }}
                    >
                      {t("रीस्टोर करें", "Restore")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{t("ऑटो बैकअप", "Auto backup")}</Label>
              <select
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={autoBackup}
                onChange={(e) => {
                  setAutoBackup(e.target.value);
                  localStorage.setItem(AUTO_BACKUP_FREQ_KEY, e.target.value);
                  dispatchAutoBackupSettingsChanged();
                }}
              >
                <option value="manual">{t("केवल मैन्युअल", "Manual only")}</option>
                <option value="daily">{t("रोज़", "Daily")}</option>
                <option value="weekly">{t("साप्ताहिक", "Weekly")}</option>
                <option value="monthly">{t("मासिक", "Monthly")}</option>
              </select>
            </div>
            <div className="text-xs self-end pb-1">
              <div className="text-muted-foreground">{t("अंतिम बैकअप", "Last backup")}</div>
              <div className="font-semibold truncate">{lastBackupAt ? new Date(lastBackupAt).toLocaleString() : "—"}</div>
              {pending && <div className="text-amber-600 mt-1">{t("ऑफलाइन बैकअप लंबित", "Offline backup pending")}</div>}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
            {t(
              "Google Drive बैकअप निजी “Ashapura Samrat Backup” folder में सेव होगा।",
              "Google Drive backups are saved in the private “Ashapura Samrat Backup” folder."
            )}
          </p>
        </CardContent>
      </Card>

      {/* Cache & Reset */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {t("कैश और रीसेट", "Cache & Reset")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                {t("कैश डेटा साफ करें", "Clear cached data")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("कैश साफ करें?", "Clear caches?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("पंचांग, स्थानीय कैश, IndexedDB और Service Worker कैश हटाए जाएंगे। लॉगिन बरकरार रहेगा।", "Panchang, local caches, IndexedDB and service-worker caches will be cleared. Login stays.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("रद्द", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { await clearAllCaches({ keepAuth: true }); location.reload(); }}>
                  {t("साफ करें", "Clear")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full gap-2">
                <AlertTriangle className="w-4 h-4" />
                {t("ऐप डेटा रीसेट करें", "Reset app data")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("पूरा डेटा हटाएँ?", "Erase all data?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("Workers, Attendance, Advances, Reports, Cashbook, स्थानीय स्टोरेज — सब कुछ स्थायी रूप से हट जाएगा। लॉगिन बरकरार रहेगा। कृपया पहले बैकअप बनाएँ।", "Workers, Attendance, Advances, Reports, Cashbook and local storage will be permanently deleted. Login stays. Please take a backup first.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("रद्द", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await resetAllUserData();
                      await clearAllCaches({ keepAuth: true });
                      toast({ title: t("✅ ऐप रीसेट हो गया", "✅ App reset") });
                      setTimeout(() => location.reload(), 400);
                    } catch (e: any) {
                      toast({ title: t("गलती", "Error"), description: e.message, variant: "destructive" });
                    }
                  }}
                >
                  {t("सब हटाएँ", "Delete everything")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Separator />

      {/* Logout */}
      <Button onClick={handleLogout} variant="destructive" className="w-full gap-2">
        <LogOut className="w-4 h-4" />
        {t("लॉगआउट", "Logout")}
      </Button>
    </div>
  );
}
