import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { MapPin, LogIn, LogOut, RefreshCw, ShieldCheck, ShieldAlert, ScanFace, Check } from "lucide-react";
import { fmtDistance, getCurrentCoords, haversineMeters, type Coords } from "@/lib/geo";
import { calcHours, fmt12, fmtHours, splitOT } from "@/lib/work-hours";
import { todayISO } from "@/lib/date-utils";
import FaceScanDialog from "@/components/FaceScanDialog";


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
  const faceRequired = !!office?.face_scan_enabled;
  const faceOK = !faceRequired || faceVerified || !!facePhoto;
  const canPunch = !!workerId && !!office && inside && !saving && faceOK;

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
    if (distance > radius) {
      toast({
        title: "परिधि के बाहर",
        description: `You are outside the allowed ${radius}m office perimeter.`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const worker = workers.find((w) => w.id === workerId);
      const t = nowTime();
      const shot = photo ?? facePhoto;
      const photoPath = shot ? await uploadFace(uid, shot, type) : null;

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
        face_verified: !!shot || faceVerified,
        photo_url: photoPath,
        site_name: worker?.site_name ?? null,
      });
      if (logErr) throw logErr;
      setFacePhoto(null);


      // Mirror into the main हाजिरी sheet
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
        title: type === "in" ? "पंच इन हो गया ✅" : "पंच आउट हो गया ✅",
        description: `${fmt12(t)} • ${fmtDistance(distance)} ऑफिस से`,
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
              checked={useFaceScan || faceRequired}
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
              disabled={!workerId || !office || !inside || saving}
              onClick={() => {
                if ((useFaceScan || faceRequired) && !facePhoto) { setPendingType("in"); setFaceOpen(true); }
                else void punch("in");
              }}
            >
              <LogIn className="w-5 h-5 mr-2" /> पंच इन
            </Button>
            <Button
              className="h-14 text-base"
              variant="secondary"
              disabled={!workerId || !office || !inside || saving}
              onClick={() => {
                if ((useFaceScan || faceRequired) && !facePhoto) { setPendingType("out"); setFaceOpen(true); }
                else void punch("out");
              }}
            >
              <LogOut className="w-5 h-5 mr-2" /> पंच आउट
            </Button>
          </div>
          {!inside && office && (
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

        </CardContent>
      </Card>
    </div>
  );
}
