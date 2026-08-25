import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Crosshair, MapPin, Save } from "lucide-react";
import { getCurrentCoords } from "@/lib/geo";
import { fmt12, fmtHours, calcHours } from "@/lib/work-hours";
import { todayISO } from "@/lib/date-utils";

interface Office {
  id?: string;
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  face_scan_enabled: boolean;
}

interface LogRow {
  id: string;
  worker_id: string;
  attendance_type: string;
  logged_at: string;
  log_date: string;
  distance_meters: number | null;
  face_verified: boolean;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

const empty: Office = {
  name: "मुख्य ऑफिस",
  latitude: "",
  longitude: "",
  radius_meters: "50",
  face_scan_enabled: false,
};

export default function GeoAdminPage() {
  const [office, setOffice] = useState<Office>(empty);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [viewLog, setViewLog] = useState<LogRow | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("office_locations")
        .select("*").eq("is_active", true).order("created_at").limit(1);
      const o = data?.[0];
      if (o) {
        setOffice({
          id: o.id,
          name: o.name,
          latitude: String(o.latitude),
          longitude: String(o.longitude),
          radius_meters: String(o.radius_meters),
          face_scan_enabled: o.face_scan_enabled,
        });
      }
      const { data: w } = await supabase.from("workers").select("id, name");
      setNames(Object.fromEntries((w ?? []).map((x) => [x.id, x.name])));
    })();
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("attendance_logs")
      .select("id, worker_id, attendance_type, logged_at, log_date, distance_meters, face_verified, photo_url, latitude, longitude")
      .eq("log_date", date)
      .order("logged_at", { ascending: true });
    const rows = (data as LogRow[]) ?? [];
    setLogs(rows);

    const paths = rows.map((r) => r.photo_url).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("attendance-photos")
        .createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setPhotoUrls(map);
    } else {
      setPhotoUrls({});
    }
  }, [date]);


  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const useMyLocation = async () => {
    try {
      const c = await getCurrentCoords();
      setOffice((o) => ({ ...o, latitude: c.latitude.toFixed(6), longitude: c.longitude.toFixed(6) }));
      toast({ title: "लोकेशन ले ली गई", description: "यही आपकी वर्तमान जगह है।" });
    } catch (e) {
      toast({ title: "गलती", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const save = async () => {
    const lat = Number(office.latitude);
    const lng = Number(office.longitude);
    const rad = Number(office.radius_meters);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      toast({ title: "गलत coordinates", description: "सही latitude/longitude डालें।", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(rad) || rad < 10 || rad > 5000) {
      toast({ title: "गलत परिधि", description: "10 से 5000 मीटर के बीच डालें।", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const payload = {
        user_id: uid,
        name: office.name.trim() || "मुख्य ऑफिस",
        latitude: lat,
        longitude: lng,
        radius_meters: Math.round(rad),
        face_scan_enabled: office.face_scan_enabled,
        is_active: true,
      };
      if (office.id) {
        const { error } = await supabase.from("office_locations").update(payload).eq("id", office.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("office_locations").insert(payload).select("id").single();
        if (error) throw error;
        setOffice((o) => ({ ...o, id: data.id }));
      }
      toast({ title: "सेव हो गया ✅", description: "ऑफिस लोकेशन अपडेट हो गई।" });
    } catch (e) {
      toast({ title: "गलती हुई", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group logs per worker → first IN, last OUT, total hours
  const byWorker = new Map<string, { in?: string; out?: string; dist?: number | null }>();
  for (const l of logs) {
    const t = new Date(l.logged_at);
    const hhmm = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    const cur = byWorker.get(l.worker_id) ?? {};
    if (l.attendance_type === "in") { if (!cur.in) cur.in = hhmm; }
    else cur.out = hhmm;
    cur.dist = l.distance_meters;
    byWorker.set(l.worker_id, cur);
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="text-lg font-bold">लोकेशन एडमिन</h2>
        <p className="text-xs text-muted-foreground">ऑफिस/शॉप GPS और हाजिरी परिधि सेट करें</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> ऑफिस लोकेशन</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">नाम</Label>
            <Input value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Latitude</Label>
              <Input inputMode="decimal" value={office.latitude}
                onChange={(e) => setOffice({ ...office, latitude: e.target.value })} placeholder="23.022505" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude</Label>
              <Input inputMode="decimal" value={office.longitude}
                onChange={(e) => setOffice({ ...office, longitude: e.target.value })} placeholder="72.571362" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">अनुमत परिधि (मीटर)</Label>
            <Input inputMode="numeric" value={office.radius_meters}
              onChange={(e) => setOffice({ ...office, radius_meters: e.target.value })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">फेस स्कैन ज़रूरी करें</p>
              <p className="text-[11px] text-muted-foreground">बंद रहने पर सिर्फ GPS से हाजिरी लगेगी</p>
            </div>
            <Switch checked={office.face_scan_enabled}
              onCheckedChange={(v) => setOffice({ ...office, face_scan_enabled: v })} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={useMyLocation}>
              <Crosshair className="w-4 h-4 mr-2" /> यहीं की लोकेशन लें
            </Button>
            <Button className="flex-1" onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" /> सेव करें
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">दैनिक हाजिरी लॉग</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {byWorker.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">इस दिन कोई पंच रिकॉर्ड नहीं।</p>
          ) : (
            <div className="divide-y divide-border">
              {[...byWorker.entries()].map(([wid, v]) => (
                <div key={wid} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{names[wid] ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      IN {fmt12(v.in)} • OUT {fmt12(v.out)}
                      {v.dist != null ? ` • ${Math.round(v.dist)}m` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{fmtHours(calcHours(v.in, v.out))}</span>
                </div>
              ))}
            </div>
          )}

          {logs.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">पंच एंट्री (फोटो सहित)</p>
              {logs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setViewLog(l)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border px-2 py-2 text-left hover:bg-muted/50"
                >
                  {l.photo_url && photoUrls[l.photo_url] ? (
                    <img
                      src={photoUrls[l.photo_url]}
                      alt={`${names[l.worker_id] ?? "मजदूर"} की फेस स्कैन फोटो`}
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <ImageOff className="w-4 h-4 text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {names[l.worker_id] ?? "—"} • {l.attendance_type.toUpperCase()}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(l.logged_at).toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" })}
                      {l.distance_meters != null ? ` • ${Math.round(l.distance_meters)}m` : ""}
                      {l.face_verified ? " • फेस ✓" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewLog} onOpenChange={(v) => !v && setViewLog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {viewLog ? `${names[viewLog.worker_id] ?? "—"} • ${viewLog.attendance_type.toUpperCase()}` : ""}
            </DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-3">
              {viewLog.photo_url && photoUrls[viewLog.photo_url] ? (
                <img
                  src={photoUrls[viewLog.photo_url]}
                  alt="फेस वेरिफिकेशन फोटो (पूरा आकार)"
                  className="w-full rounded-xl object-cover"
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">इस एंट्री में फोटो नहीं है।</p>
              )}
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">समय: </span>{new Date(viewLog.logged_at).toLocaleString("hi-IN")}</p>
                <p>
                  <span className="text-muted-foreground">GPS: </span>
                  {viewLog.latitude != null && viewLog.longitude != null
                    ? `${Number(viewLog.latitude).toFixed(6)}, ${Number(viewLog.longitude).toFixed(6)}`
                    : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">ऑफिस से दूरी: </span>
                  {viewLog.distance_meters != null ? `${Math.round(viewLog.distance_meters)} m` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">फेस वेरिफिकेशन: </span>
                  {viewLog.face_verified ? "हो गया ✓" : "नहीं"}
                </p>
              </div>
              {viewLog.latitude != null && viewLog.longitude != null && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={`https://www.google.com/maps?q=${viewLog.latitude},${viewLog.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="w-4 h-4 mr-2" /> मैप पर देखें
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

}
