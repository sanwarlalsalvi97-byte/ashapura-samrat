// Lightweight export helpers — CSV download + print-to-PDF (works with Devanagari)
export const APP_NAME = "Ashapura Samrat";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: any): string {
  let s = v == null ? "" : String(v);
  // Prevent CSV formula injection (Excel/LibreOffice/Numbers)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  // BOM for Excel UTF-8 (Hindi support)
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

function htmlEscape(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportPDF(title: string, headers: string[], rows: (string | number)[][], subtitle?: string) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const safeTitle = htmlEscape(title);
  const safeSubtitle = subtitle ? htmlEscape(subtitle) : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  body { font-family: 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  tr:nth-child(even) td { background: #fafafa; }
  .brand { font-size: 12px; color: #888; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px; }
  @media print { body { padding: 12px; } }
</style></head><body>
<div class="brand">${htmlEscape(APP_NAME)}</div>
<h1>${safeTitle}</h1>${safeSubtitle ? `<div class="sub">${safeSubtitle}</div>` : ""}
<table>
  <thead><tr>${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`).join("")}</tbody>
</table>
<script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}
