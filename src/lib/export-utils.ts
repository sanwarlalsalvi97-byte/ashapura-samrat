// Lightweight export helpers — CSV download + print-to-PDF (works with Devanagari)

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
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  // BOM for Excel UTF-8 (Hindi support)
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportPDF(title: string, headers: string[], rows: (string | number)[][], subtitle?: string) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { font-family: 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>${title}</h1>${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
<table>
  <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
</table>
<script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}
