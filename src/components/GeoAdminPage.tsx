import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Crosshair, MapPin, Save, ImageOff, Search, ShieldAlert, Check, X } from "lucide-react";
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
  accuracy_meters: number | null;
  face_verified: boolean;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  site_name: string | null;
  is_suspicious: boolean;
  suspicious_reason: string | null;
  review_status: string;
}

const empty: Office = {
  name: "मुख्य ऑफिस",
  latitude: "",
  longitude: "",
  radius_meters: "50",
  face_scan_enabled: false,
};

const SELECT_COLS =
  "id, worker_id, attendance_type, logged_at, log_date, distance_meters, accuracy_meters, face_verified, photo_url, latitude, longitude, site_name, is_suspicious, suspicious_reason, review_status";

const statusLabel = (r: LogRow) => {
  if (r.review_status === "rejected") return { text: "अस्वीकृत (Rejected)", cls: "bg-destructive/15 text-destructive" };
  if (r.review_status === "pending") return { text: "फ्लैग — समीक्षा बाकी", cls: "bg-amber-500/15 text-amber-600" };
  return { text: "मंज़ूर (Approved)", cls: "bg-accent/15 text-accent" };
};


export default function GeoAdminPage() {
  const [office, setOffice] = useState<Office>(empty);
  const [saving, setSaving] = useState(false);
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
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
      .select(SELECT_COLS)
      .gte("log_date", fromDate)
      .lte("log_date", toDate)
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
  }, [fromDate, toDate]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const sites = useMemo(
    () => [...new Set(logs.map((l) => l.site_name).filter((s): s is string => !!s))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (q && !(names[l.worker_id] ?? "").toLowerCase().includes(q)) return false;
      if (siteFilter !== "all" && (l.site_name ?? "") !== siteFilter) return false;
      if (statusFilter === "suspicious" && !l.is_suspicious) return false;
      if (["approved", "pending", "rejected"].includes(statusFilter) && l.review_status !== statusFilter) return false;
      if (statusFilter === "in" && l.attendance_type !== "in") return false;
      if (statusFilter === "out" && l.attendance_type !== "out") return false;
      return true;
    });
  }, [logs, search, siteFilter, statusFilter, names]);

  const pending = useMemo(() => logs.filter((l) => l.review_status === "pending"), [logs]);

  /** Apply an approved punch into the main हाजिरी sheet. */
  const applyToAttendance = async (log: LogRow) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const t = new Date(log.logged_at).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("worker_id", log.worker_id)
      .eq("date", log.log_date)
      .maybeSingle();

    if (existing) {
      const inT = log.attendance_type === "in" ? t : existing.in_time;
      const outT = log.attendance_type === "out" ? t : existing.out_time;
      const total = calcHours(inT, outT);
      await supabase.from("attendance").update({
        in_time: inT, out_time: outT,
        total_hours: total,
        overtime_hours: total > 8 ? Number((total - 8).toFixed(2)) : 0,
        status: "Present",
      }).eq("id", existing.id);
    } else {
      await supabase.from("attendance").insert({
        user_id: uid,
        worker_id: log.worker_id,
        date: log.log_date,
        status: "Present",
        site_name: log.site_name,
        in_time: log.attendance_type === "in" ? t : null,
        out_time: log.attendance_type === "out" ? t : null,
      });
    }
  };

  /** Undo a rejected punch from the main हाजिरी sheet. */
  const revertFromAttendance = async (log: LogRow) => {
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, in_time, out_time")
      .eq("worker_id", log.worker_id)
      .eq("date", log.log_date)
      .maybeSingle();
    if (!existing) return;
    const inT = log.attendance_type === "in" ? null : existing.in_time;
    const outT = log.attendance_type === "out" ? null : existing.out_time;
    if (!inT && !outT) {
      await supabase.from("attendance").delete().eq("id", existing.id);
      return;
    }
    const total = calcHours(inT, outT);
    await supabase.from("attendance").update({
      in_time: inT, out_time: outT,
      total_hours: total,
      overtime_hours: total > 8 ? Number((total - 8).toFixed(2)) : 0,
    }).eq("id", existing.id);
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("attendance_logs")
      .update({ review_status: status, reviewed_by: auth.user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "गलती हुई", description: error.message, variant: "destructive" });
      return;
    }
    const log = logs.find((l) => l.id === id);
    if (log) {
      try {
        if (status === "approved") await applyToAttendance(log);
        else await revertFromAttendance(log);
      } catch (e) {
        toast({
          title: "हाजिरी अपडेट नहीं हुई",
          description: e instanceof Error ? e.message : "कृपया दोबारा कोशिश करें",
          variant: "destructive",
        });
      }
    }
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, review_status: status } : l)));
    setViewLog((v) => (v && v.id === id ? { ...v, review_status: status } : v));
    toast({
      title: status === "approved" ? "मंज़ूर हो गया ✅" : "अस्वीकृत — हाजिरी से हटा दिया ❌",
    });
  };



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

  // Group filtered logs per worker → first IN, last OUT, total hours
  const byWorker = new Map<string, { in?: string; out?: string; dist?: number | null }>();
  for (const l of filtered) {
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

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <ShieldAlert className="w-4 h-4" /> संदिग्ध पंच — समीक्षा ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((l) => (
              <div key={l.id} className="rounded-lg border border-border p-2 space-y-2">
                <button type="button" onClick={() => setViewLog(l)} className="w-full text-left">
                  <p className="text-sm font-medium">
                    {names[l.worker_id] ?? "—"} • {l.attendance_type.toUpperCase()} •{" "}
                    {new Date(l.logged_at).toLocaleString("hi-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-[11px] text-destructive">{l.suspicious_reason ?? "संदिग्ध एंट्री"}</p>
                </button>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => review(l.id, "approved")}>
                    <Check className="w-4 h-4 mr-1" /> मंज़ूर
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => review(l.id, "rejected")}>
                    <X className="w-4 h-4 mr-1" /> अस्वीकार
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">हाजिरी लॉग व फ़िल्टर</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">से तारीख़</Label>
              <Input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">तक तारीख़</Label>
              <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="मजदूर का नाम खोजें"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="स्थिति" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सभी स्थिति</SelectItem>
                <SelectItem value="approved">मंज़ूर</SelectItem>
                <SelectItem value="pending">समीक्षा बाकी</SelectItem>
                <SelectItem value="rejected">अस्वीकृत</SelectItem>
                <SelectItem value="suspicious">संदिग्ध</SelectItem>
                <SelectItem value="in">सिर्फ पंच इन</SelectItem>
                <SelectItem value="out">सिर्फ पंच आउट</SelectItem>
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger><SelectValue placeholder="साइट" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">सभी साइट</SelectItem>
                {sites.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {byWorker.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">इस फ़िल्टर में कोई पंच रिकॉर्ड नहीं।</p>
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

          {filtered.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">पंच एंट्री (फोटो सहित)</p>
              {filtered.map((l) => {
                const st = statusLabel(l);
                return (
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
                        {new Date(l.logged_at).toLocaleString("hi-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {l.distance_meters != null ? ` • ${Math.round(l.distance_meters)}m` : ""}
                        {l.face_verified ? " • फेस ✓" : ""}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] border-0 ${st.cls}`}>{st.text}</Badge>
                        <Badge variant="outline" className="text-[10px] border-0 bg-primary/10 text-primary">
                          साइट: {l.site_name || "—"}
                        </Badge>
                      </span>

                    </span>
                  </button>
                );
              })}
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
                  <span className="text-muted-foreground">GPS सटीकता: </span>
                  {viewLog.accuracy_meters != null ? `±${Math.round(viewLog.accuracy_meters)} m` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">साइट: </span>{viewLog.site_name || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">फेस वेरिफिकेशन: </span>
                  {viewLog.face_verified ? "हो गया ✓" : "नहीं"}
                </p>
                <p>
                  <span className="text-muted-foreground">स्थिति: </span>{statusLabel(viewLog).text}
                </p>
                {viewLog.suspicious_reason && (
                  <p className="text-destructive text-xs">{viewLog.suspicious_reason}</p>
                )}
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
              {viewLog.review_status === "pending" && (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => review(viewLog.id, "approved")}>
                    <Check className="w-4 h-4 mr-1" /> मंज़ूर
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => review(viewLog.id, "rejected")}>
                    <X className="w-4 h-4 mr-1" /> अस्वीकार
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
