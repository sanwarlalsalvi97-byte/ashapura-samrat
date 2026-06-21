import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSites, type Site } from "@/lib/sites";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Site selector — STRICT mode.
 * Only allows picking from sites manually added in the "Sites" page.
 * Never creates new sites and never accepts free text.
 */
export default function SiteNameInput({ value, onChange, placeholder = "साइट चुनें", className }: Props) {
  const [sites, setSites] = useState<Site[]>(() => listSites());

  useEffect(() => {
    const refresh = () => setSites(listSites());
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[100] bg-popover">
        <SelectItem value="__none__">— कोई नहीं —</SelectItem>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.name}>
            {s.name}{s.location ? ` — ${s.location}` : ""}
          </SelectItem>
        ))}
        {sites.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            पहले "साइट" पेज में नई साइट जोड़ें
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
