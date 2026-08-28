import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { MapPin, LogIn, LogOut, RefreshCw, ShieldCheck, ShieldAlert, ScanFace, Check } from "lucide-react";
import { fmtDistance, getCurrentCoords, haversineMeters, type Coords } from "@/lib/geo";
import { calcHours, fmt12, fmtHours, splitOT } from "@/lib/work-hours";
import { todayISO } from "@/lib/date-utils";
import FaceScanDialog from "@/components/FaceScanDialog";

/** GPS readings less precise than this are treated as unreliable. */
const ACCURACY_LIMIT_M = 50;

interface Worker { id: string; name: string; worker_code: string | null; site_name: string | null }
interface Office {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  face_scan_enabled: boolean;
}
interface TodayRow { id: string; in_time: string | null; out_time: string | null }

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function PunchAttendancePage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [office, setOffice] = useState<Office | null>(null);
  const [workerId, setWorkerId] = useState<string>("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState<TodayRow | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);
  const [useFaceScan, setUseFaceScan] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [facePhoto, setFacePhoto] = useState<Blob | null>(null);
  const [pendingType, setPendingType] = useState<"in" | "out" | null>(null);
  const [warnType, setWarnType] = useState<"in" | "out" | null>(null);

  const date = todayISO();

  const loadBase = useCallback(async () => {
    const [{ data: w }, { data: o }] = await Promise.all([
      supabase.from("workers").select("id, name, worker_code, site_name").eq("is_active", true).order("name"),
      supabase.from("office_locations").select("*").eq("is_active", true).order("created_at").limit(1),
    ]);
    setWorkers((w as Worker[]) ?? []);
    const off = (o as unknown as Office[])?.[0] ?? null;
    setOffice(off);
    if (!workerId && w?.length) setWorkerId(w[0].id);
  }, [workerId]);

  useEffect(() => { void loadBase(); }, [loadBase]);

  const loadToday = useCallback(async () => {
    if (!workerId) { setToday(null); return; }
    const { data } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("worker_id", workerId)
      .eq("date", date)
      .maybeSingle();
    setToday((data as TodayRow) ?? null);
  }, [workerId, date]);

  useEffect(() => { void loadToday(); }, [loadToday]);

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      setCoords(await getCurrentCoords());
    } catch (e) {
      setCoords(null);
      setLocError(e instanceof Error ? e.message : "Location error");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => { void refreshLocation(); }, [refreshLocation]);

  const distance = useMemo(() => {
    if (!coords || !office) return null;
    return haversineMeters(coords.latitude, coords.longitude, Number(office.latitude), Number(office.longitude));
  }, [coords, office]);

  const radius = office?.radius_meters ?? 50;
  const inside = distance != null && distance <= radius;
  const accuracy = coords?.accuracy ?? null;
  const accuracyPoor = accuracy != null && accuracy > ACCURACY_LIMIT_M;
  const faceRequired = !!office?.face_scan_enabled;
  const scanOn = useFaceScan || faceRequired;

  /** Reasons that make this punch questionable. */
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (distance != null && distance > radius) {
      list.push(`ऑफिस से दूरी ${fmtDistance(distance)} है — अनुमत ${radius}m परिधि के बाहर।`);
    }
    if (accuracyPoor && accuracy != null) {
      list.push(`GPS सटीकता कमज़ोर है (±${Math.round(accuracy)}m) — ${ACCURACY_LIMIT_M}m से ज़्यादा।`);
    }
    if (faceRequired && !facePhoto && !faceVerified) {
      list.push("फेस स्कैन ज़रूरी है, पर वेरिफाई नहीं हुआ।");
    }
    return list;
  }, [distance, radius, accuracyPoor, accuracy, faceRequired, facePhoto, faceVerified]);

  const uploadFace = async (uid: string, blob: Blob, type: "in" | "out") => {
    const path = `${uid}/${workerId}/${date}-${type}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("attendance-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  };

  const punch = async (type: "in" | "out", photo?: Blob | null) => {
    if (!office || !coords || distance == null) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const worker = workers.find((w) => w.id === workerId);
      const t = nowTime();
      const shot = photo ?? facePhoto;
      const photoPath = shot ? await uploadFace(uid, shot, type) : null;

      const reasons: string[] = [];
      if (distance > radius) reasons.push(`GPS out of range (${Math.round(distance)}m > ${radius}m)`);
      if (accuracyPoor && accuracy != null) reasons.push(`Low GPS accuracy (±${Math.round(accuracy)}m)`);
      if (faceRequired && !shot && !faceVerified) reasons.push("Face scan required but not verified");
      const suspicious = reasons.length > 0;

      const { error: logErr } = await supabase.from("attendance_logs").insert({
        user_id: uid,
        worker_id: workerId,
        office_location_id: office.id,
        attendance_type: type,
        log_date: date,
        logged_at: new Date().toISOString(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        distance_meters: Math.round(distance),
        accuracy_meters: accuracy != null ? Math.round(accuracy) : null,
        face_verified: !!shot || faceVerified,
        photo_url: photoPath,
        site_name: worker?.site_name ?? null,
        is_suspicious: suspicious,
        suspicious_reason: suspicious ? reasons.join(" • ") : null,
        review_status: suspicious ? "pending" : "approved",
      });
      if (logErr) throw logErr;
      setFacePhoto(null);

      // Mirror into the main हाजिरी sheet immediately — attendance is never blocked.
      // Suspicious punches are still flagged so admins can audit/reject them later.
      if (type === "in") {


        if (today) {
          const total = calcHours(t, today.out_time);
          const { overtime } = splitOT(total);
          await supabase.from("attendance").update({
            in_time: t, total_hours: total, overtime_hours: overtime,
          }).eq("id", today.id);
        } else {
          await supabase.from("attendance").insert({
            user_id: uid, worker_id: workerId, date, status: "Present",
            in_time: t, site_name: worker?.site_name ?? null,
          });
        }
      } else {
        const inT = today?.in_time ?? null;
        const total = calcHours(inT, t);
        const { overtime } = splitOT(total);
        if (today) {
          await supabase.from("attendance").update({
            out_time: t, total_hours: total, overtime_hours: overtime,
          }).eq("id", today.id);
        } else {
          await supabase.from("attendance").insert({
            user_id: uid, worker_id: workerId, date, status: "Present",
            out_time: t, site_name: worker?.site_name ?? null,
          });
        }
      }

      toast({
        title: suspicious
          ? (type === "in" ? "पंच इन सेव — फ्लैग किया गया ⚠️" : "पंच आउट सेव — फ्लैग किया गया ⚠️")
          : (type === "in" ? "पंच इन हो गया ✅" : "पंच आउट हो गया ✅"),
        description: suspicious
          ? `हाजिरी लग गई • ${fmt12(t)} — एडमिन बाद में समीक्षा करेगा।`
          : `${fmt12(t)} • ${fmtDistance(distance)} ऑफिस से`,
      });

      await loadToday();
    } catch (e) {
      toast({
        title: "गलती हुई",
        description: e instanceof Error ? e.message : "Punch save नहीं हुआ",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /** Entry point for the buttons: warn first, then face scan, then save. */
  const startPunch = (type: "in" | "out") => {
    if (warnings.length) { setWarnType(type); return; }
    if (scanOn && !facePhoto) { setPendingType(type); setFaceOpen(true); return; }
    void punch(type);
  };

  const proceedAfterWarning = () => {
    const type = warnType;
    setWarnType(null);
    if (!type) return;
    if (scanOn && !facePhoto) { setPendingType(type); setFaceOpen(true); return; }
    void punch(type);
  };

  const worked = calcHours(today?.in_time, today?.out_time);

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-lg font-bold">पंच इन / पंच आउट</h2>
        <p className="text-xs text-muted-foreground">GPS आधारित हाजिरी — ऑफिस की {radius}m परिधि के अंदर ही</p>
      </div>

      {!office && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            ऑफिस लोकेशन सेट नहीं है। सेटिंग्स → लोकेशन एडमिन में जाकर शॉप/ऑफिस GPS सेट करें।
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4" /> आपकी लोकेशन
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {locating ? (
            <p className="text-sm text-muted-foreground">लोकेशन ली जा रही है…</p>
          ) : locError ? (
            <p className="text-sm text-destructive">{locError}</p>
          ) : coords ? (
            <div className="space-y-1 text-sm">
              <p className="font-mono text-xs text-muted-foreground">
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                {coords.accuracy ? ` (±${Math.round(coords.accuracy)}m)` : ""}
              </p>
              {accuracyPoor && (
                <p className="text-xs text-destructive font-medium">
                  GPS सटीकता कमज़ोर (±{Math.round(accuracy!)}m) — खुली जगह पर जाकर रिफ्रेश करें।
                </p>
              )}
              {office && distance != null && (
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 font-semibold ${
                    inside ? "bg-accent/15 text-accent" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {inside ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  <span>
                    {office.name} से {fmtDistance(distance)}
                    {inside ? " — अंदर" : ` — You are outside the allowed ${radius}m office perimeter.`}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          <Button variant="outline" size="sm" onClick={refreshLocation} disabled={locating}>
            <RefreshCw className={`w-4 h-4 mr-2 ${locating ? "animate-spin" : ""}`} />
            लोकेशन रिफ्रेश करें
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">मजदूर चुनें</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={workerId} onValueChange={setWorkerId}>
            <SelectTrigger><SelectValue placeholder="मजदूर चुनें" /></SelectTrigger>
            <SelectContent>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}{w.worker_code ? ` (${w.worker_code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-muted/50 py-2">
              <p className="text-muted-foreground">IN</p>
              <p className="font-semibold">{fmt12(today?.in_time)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 py-2">
              <p className="text-muted-foreground">OUT</p>
              <p className="font-semibold">{fmt12(today?.out_time)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 py-2">
              <p className="text-muted-foreground">कुल</p>
              <p className="font-semibold">{fmtHours(worked)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <ScanFace className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">फेस स्कैन हाजिरी {faceRequired ? "(ज़रूरी)" : "(वैकल्पिक)"}</p>
                <p className="text-[11px] text-muted-foreground">फोटो + GPS + समय एक साथ सेव</p>
              </div>
            </div>
            <Switch
              checked={scanOn}
              disabled={faceRequired}
              onCheckedChange={(v) => { setUseFaceScan(v); if (!v) setFacePhoto(null); }}
              aria-label="फेस स्कैन हाजिरी चालू करें"
            />
          </div>

          {facePhoto && (
            <p className="flex items-center gap-2 text-xs text-accent font-medium">
              <Check className="w-4 h-4" /> फोटो तैयार है — पंच करते ही सेव होगी
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              className="h-14 text-base"
              disabled={!workerId || !office || !coords || saving}
              onClick={() => startPunch("in")}
            >
              <LogIn className="w-5 h-5 mr-2" /> पंच इन
            </Button>
            <Button
              className="h-14 text-base"
              variant="secondary"
              disabled={!workerId || !office || !coords || saving}
              onClick={() => startPunch("out")}
            >
              <LogOut className="w-5 h-5 mr-2" /> पंच आउट
            </Button>
          </div>
          {!inside && office && distance != null && (
            <p className="text-center text-xs text-destructive font-medium">
              You are outside the allowed {radius}m office perimeter.
            </p>
          )}

          <FaceScanDialog
            open={faceOpen}
            onOpenChange={(v) => { setFaceOpen(v); if (!v) setPendingType(null); }}
            onCaptured={(blob) => {
              setFacePhoto(blob);
              setFaceVerified(true);
              const type = pendingType;
              setPendingType(null);
              if (type) void punch(type, blob);
            }}
          />

          <AlertDialog open={!!warnType} onOpenChange={(v) => !v && setWarnType(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-destructive" /> पंच पर चेतावनी
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-left">
                    <ul className="list-disc pl-4 space-y-1">
                      {warnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                    <p>
                      फिर भी पंच करने पर यह एंट्री <strong>संदिग्ध (Suspicious)</strong> मार्क होगी और
                      एडमिन की समीक्षा में जाएगी।
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>रद्द करें</AlertDialogCancel>
                <AlertDialogAction onClick={proceedAfterWarning}>फिर भी पंच करें</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
