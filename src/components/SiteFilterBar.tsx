import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { listSites } from "@/lib/sites";

interface SiteFilterBarProps {
  value: string;
  onChange: (val: string) => void;
}

export default function SiteFilterBar({ value, onChange }: SiteFilterBarProps) {
  const [sites, setSites] = useState<string[]>([]);

  useEffect(() => {
    // ✅ चूँकि listSites() एक synchronous फंक्शन है, इसे सीधे कॉल करें (.then की कोई जरूरत नहीं)
    try {
      const res = listSites();
      if (res && Array.isArray(res)) {
        setSites(res.map((s) => s.name));
      }
    } catch (err) {
      console.error("Failed to load sites:", err);
    }
  }, []);

  return (
    <div className="flex items-center gap-2 bg-card rounded-2xl p-2 border border-border/60 shadow-sm">
      <div className="flex items-center gap-2 pl-2 text-muted-foreground text-xs font-bold">
        <Building2 className="w-4 h-4 text-emerald-600" />
        <span>साइट फ़िल्टर:</span>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 border-0 bg-background shadow-none font-semibold text-sm">
          <SelectValue placeholder="सभी साइट" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">सभी साइट (All Sites)</SelectItem>
          {sites.map((site) => (
            <SelectItem key={site} value={site}>{site}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
