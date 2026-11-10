import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { type Worker } from "@/lib/supabase-helpers";

interface SiteWiseReportProps {
  att: any[];
  cash: { amount: number; site_name: string | null; type: string }[];
  exp: { amount: number; site_name: string | null }[];
  pay: { amount: number; site_name: string | null }[];
  workers: Worker[];
  monthLabel: string;
  siteFilter: string;
  onSiteFilterChange: (site: string) => void;
}

export default function SiteWiseReport({
  att,
  cash,
  exp,
  pay,
  workers,
  monthLabel,
  siteFilter,
  onSiteFilterChange,
}: SiteWiseReportProps) {
  // सभी यूनिक साइटों की सूची निकालें
  const allSitesSet = new Set<string>();
  workers.forEach((w) => {
    if (w.site_name) allSitesSet.add(w.site_name.trim());
  });
  att.forEach((a) => {
    if (a.site_name) allSitesSet.add(a.site_name.trim());
  });
  cash.forEach((c) => {
    if (c.site_name) allSitesSet.add(c.site_name.trim());
  });
  exp.forEach((e) => {
    if (e.site_name) allSitesSet.add(e.site_name.trim());
  });
  pay.forEach((p) => {
    if (p.site_name) allSitesSet.add(p.site_name.trim());
  });

  let sites = Array.from(allSitesSet).filter(Boolean);

  // यदि डेटाबेस से कोई साइट नाम नहीं मिल रहा है, तो डिफ़ॉल्ट रूप से "सरेरी" सेट करें ताकि सारांश दिखे
  if (sites.length === 0) {
    sites = ["सरेरी"];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>साइट-वाइज सारांश ({monthLabel})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sites.map((site) => {
          // इस साइट के मजदूर (केस-इंसेंसिटिव मिलान ताकि नाम की गड़बड़ी न हो)
          const siteWorkers = workers.filter(
            (w) => (w.site_name || "").trim().toLowerCase() === site.toLowerCase() || !w.site_name
          );
          const workerIds = new Set(siteWorkers.map((w) => w.id));

          // हाजिरी गणना (मजदूर की साइट या आईडी के आधार पर सही मिलान)
          const siteAttendance = att.filter((a) => {
            const aSite = (a.site_name || "").trim().toLowerCase();
            const wSite = site.toLowerCase();
            return aSite === wSite || (!a.site_name && workerIds.has(a.worker_id));
          });
          
          const presentCount = siteAttendance.filter((a) => a.status === "present").length;
          const halfCount = siteAttendance.filter((a) => a.status === "half").length;
          const totalAttDays = presentCount + halfCount * 0.5;

          // एडवांस गणना
          const siteAdvances = siteAttendance.reduce((sum, a) => sum + (Number(a.advance) || 0), 0);

          // खर्चे गणना
          const siteExpenses = exp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

          // भुगतान गणना
          const sitePayments = pay.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          const isSelected = siteFilter === site;

          return (
            <Card
              key={site}
              className={`rounded-2xl transition-all cursor-pointer border ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md"
                  : "border-border/60 hover:border-emerald-300"
              }`}
              onClick={() => onSiteFilterChange(isSelected ? "__all__" : site)}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm flex items-center gap-1.5 text-foreground">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    {site}
                  </span>
                  <span className="text-[10px] font-bold bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                    {siteWorkers.length} मजदूर
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div className="bg-background/80 rounded-xl p-2 border border-border/40">
                    <div className="text-muted-foreground text-[10px] font-semibold">कुल हाजिरी</div>
                    <div className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm mt-0.5">
                      {totalAttDays} दिन
                    </div>
                  </div>
                  <div className="bg-background/80 rounded-xl p-2 border border-border/40">
                    <div className="text-muted-foreground text-[10px] font-semibold">एडवांस</div>
                    <div className="font-extrabold text-orange-600 text-sm mt-0.5">
                      ₹{siteAdvances.toLocaleString("hi-IN")}
                    </div>
                  </div>
                  <div className="bg-background/80 rounded-xl p-2 border border-border/40">
                    <div className="text-muted-foreground text-[10px] font-semibold">भुगतान</div>
                    <div className="font-extrabold text-blue-600 text-sm mt-0.5">
                      ₹{sitePayments.toLocaleString("hi-IN")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground font-medium">
                  <span>खर्चे: ₹{siteExpenses.toLocaleString("hi-IN")}</span>
                  <span className="text-emerald-600 font-bold">
                    {isSelected ? "फिल्टर सक्रिय" : "देखने के लिए क्लिक करें"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
