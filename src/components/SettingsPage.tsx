import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { LogOut, User, IndianRupee, Download, Languages, Clock, Bell, BellOff, WifiOff, Users, Trash2 } from "lucide-react";
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
import { getWorkTime, setWorkTime, formatTime12h } from "@/lib/work-time";
import { requestNotificationPermission } from "@/hooks/use-attendance-alarm";
import { isSimulatedOffline, setSimulatedOffline } from "@/lib/offline-queue";
import { getGroupingMode, setGroupingMode, type GroupingMode } from "@/lib/grouping-prefs";
import RolesSection from "./RolesSection";

export default function SettingsPage() {
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
      const workers = await getWorkers();
      const report = await getMonthlyReport(now.getFullYear(), now.getMonth() + 1);

      let csv = "Worker Name,Role,Daily Rate,Date,Status,Advance,Site,Notes\n";
      report.forEach((r: any) => {
        csv += `"${r.workers?.name || ""}","${r.workers?.role || ""}",${r.workers?.daily_rate || 0},"${r.date}","${r.status}",${r.advance},"${r.site_name || ""}","${r.notes || ""}"\n`;
      });

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hajiri-report-${now.getFullYear()}-${now.getMonth() + 1}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("सेटिंग्स", "Settings")}</h2>

      <RolesSection />

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

      {/* Grouping for exports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t("शीट में ठेकेदार/साइट का आधार", "Sheet grouping field")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={groupingMode === "site" ? "default" : "outline"}
              onClick={() => { setGroupingModeState("site"); setGroupingMode("site"); toast({ title: t("✅ साइट के नाम से grouping", "✅ Grouped by site name") }); }}
            >
              {t("साइट का नाम", "Site name")}
            </Button>
            <Button
              size="sm"
              variant={groupingMode === "contractor" ? "default" : "outline"}
              onClick={() => { setGroupingModeState("contractor"); setGroupingMode("contractor"); toast({ title: t("✅ ठेकेदार के नाम से grouping", "✅ Grouped by contractor") }); }}
            >
              {t("ठेकेदार", "Contractor")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {groupingMode === "site"
              ? t("एक्सपोर्ट में मजदूर की साइट के नाम से group होगा।", "Workers grouped by site name in exports.")
              : t("एक्सपोर्ट में Contractors टैब से जुड़े ठेकेदार के नाम से group होगा (मिलान न मिले तो साइट के नाम से)।", "Workers grouped by contractor from Contractors tab (falls back to site name).")}
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

      <Separator />

      {/* Logout */}
      <Button onClick={handleLogout} variant="destructive" className="w-full gap-2">
        <LogOut className="w-4 h-4" />
        {t("लॉगआउट", "Logout")}
      </Button>
    </div>
  );
}
