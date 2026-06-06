import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { addSite, getSites } from "@/lib/sites";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Site-name input with a dropdown of previously-used sites (HTML <datalist>).
 * - User can pick an existing site from the dropdown, OR type a new one.
 * - On blur, a new typed site is saved so it appears in future dropdowns
 *   without overwriting earlier entries.
 */
export default function SiteNameInput({ value, onChange, placeholder = "साइट का नाम चुनें या लिखें", className }: Props) {
  const listId = useId();
  const [sites, setSites] = useState<string[]>(() => getSites());

  useEffect(() => {
    const refresh = () => setSites(getSites());
    window.addEventListener("sites-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("sites-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value.trim()) addSite(value); }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {sites.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
