import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { LogOut, User, IndianRupee, Download, Languages, Clock, Bell, BellOff, WifiOff } from "lucide-react";
import { getWorkers, getMonthlyReport } from "@/lib/supabase-helpers";
import { getWorkTime, setWorkTime, formatTime12h } from "@/lib/work-time";
import { requestNotificationPermission } from "@/hooks/use-attendance-alarm";
import { isSimulatedOffline, setSimulatedOffline } from "@/lib/offline-queue";

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultRate, setDefaultRate] = useState("500");
  const [isHindi, setIsHindi] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Work time + alarm
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("18:00");
  const [alarmTime, setAlarmTime] = useState("09:00");
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  const [simOffline, setSimOffline] = useState(isSimulatedOffline());

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const t = (hi: string, en: string) => isHindi ? hi : en;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{t("सेटिंग्स", "Settings")}</h2>

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
