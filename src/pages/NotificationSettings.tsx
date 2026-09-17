import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, Globe2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  loadNotificationSettings,
  saveNotificationSettings,
  syncScheduledReminders,
  type ReminderId,
  type ReminderSetting,
} from "@/lib/notification-settings";

const REMINDER_COPY: Record<ReminderId, { title: string; subtitle: string }> = {
  morning: {
    title: "सुबह की हाज़िरी रिमाइंडर",
    subtitle: "सुबह हाज़िरी दर्ज करने की याद दिलाएं",
  },
  evening: {
    title: "शाम की हाज़िरी रिमाइंडर",
    subtitle: "शाम में हाज़िरी जांचने की याद दिलाएं",
  },
  summary: {
    title: "हाज़िरी सारांश",
    subtitle: "मज़दूरों की रोजाना हाज़िरी का सारांश",
  },
  cashbook: {
    title: "कैश एंट्री रिमाइंडर",
    subtitle: "दिन के नकद लेनदेन दर्ज करने की याद दिलाएं",
  },
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const displayHour = hour % 12 || 12;
  return { value, label: `${displayHour}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}` };
});

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<ReminderSetting[]>(loadNotificationSettings);
  const [saving, setSaving] = useState(false);

  const updateReminder = async (id: ReminderId, patch: Partial<ReminderSetting>) => {
    const next = reminders.map((item) => (item.id === id ? { ...item, ...patch } : item));
    setReminders(next);
    saveNotificationSettings(next);
    setSaving(true);
    try {
      const result = await syncScheduledReminders(next);
      if (result === "denied") {
        const reverted = next.map((item) => (item.id === id ? { ...item, enabled: false } : item));
        setReminders(reverted);
        saveNotificationSettings(reverted);
        toast({
          title: "सूचना की अनुमति आवश्यक है",
          description: "फ़ोन सेटिंग्स में Ashapura Samrat के लिए सूचनाएं चालू करें।",
        });
      } else if (result === "web" && patch.enabled) {
        toast({
          title: "रिमाइंडर सेव हो गया",
          description: "निर्धारित सूचना Android ऐप में सक्रिय होगी।",
        });
      }
    } catch {
      toast({
        title: "रिमाइंडर सेव नहीं हुआ",
        description: "कृपया सूचना अनुमति जाँचकर दोबारा प्रयास करें।",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background safe-top safe-bottom">
      <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="वापस जाएं">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">सूचना सेटिंग्स</h1>
            <p className="text-sm text-muted-foreground">Notification Settings</p>
          </div>
        </header>

        <section aria-labelledby="reminders-heading" className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 id="reminders-heading" className="font-semibold">रिमाइंडर</h2>
          </div>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {reminders.map((reminder) => {
                const copy = REMINDER_COPY[reminder.id];
                return (
                  <div key={reminder.id} className="space-y-3 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-6">{copy.title}</h3>
                        <p className="text-xs leading-5 text-muted-foreground">{copy.subtitle}</p>
                      </div>
                      <Switch
                        checked={reminder.enabled}
                        disabled={saving}
                        onCheckedChange={(enabled) => void updateReminder(reminder.id, { enabled })}
                        aria-label={`${copy.title} ${reminder.enabled ? "बंद करें" : "चालू करें"}`}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">समय</span>
                      <Select
                        value={reminder.time}
                        disabled={saving}
                        onValueChange={(time) => void updateReminder(reminder.id, { time })}
                      >
                        <SelectTrigger className="w-32" aria-label={`${copy.title} का समय`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time.value} value={time.value}>{time.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="timezone-heading" className="mb-6">
          <h2 id="timezone-heading" className="mb-3 text-xs font-bold text-muted-foreground">DEVICE TIMEZONE</h2>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-sm">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Globe2 className="h-5 w-5" />
                </span>
                <span className="flex flex-1 items-center justify-between gap-3">
                  <span>Timezone</span>
                  <span className="font-medium text-muted-foreground">Asia/Calcutta</span>
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>सूचनाएं आपके डिवाइस पर स्थानीय रूप से भेजी जाती हैं। सुनिश्चित करें कि ऐप को आपके फ़ोन सेटिंग्स में सूचना की अनुमति है।</p>
        </div>
      </div>
    </main>
  );
}