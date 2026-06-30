// Reporting (§5 Modul 6, Welle 6). Ein Report ist ein generierter Snapshot aus den vorhandenen
// Domänen (Health, Opportunities, Sichtbarkeit, Authority), strukturiert in generische Sektionen.
// Export (CSV/HTML) sind reine, testbare Funktionen — dependency-frei (echtes Binär-PDF = Follow-up).

export type ReportType = "weekly_summary" | "opportunity_digest" | "authority_report";
export type DeliveryChannel = "email" | "webhook" | "slack";
export type ReportCadence = "weekly" | "monthly";
export type ReportExportFormat = "csv" | "html" | "pdf";

export const REPORT_TYPES: readonly ReportType[] = ["weekly_summary", "opportunity_digest", "authority_report"];
export const DELIVERY_CHANNELS: readonly DeliveryChannel[] = ["email", "webhook", "slack"];
export const REPORT_CADENCES: readonly ReportCadence[] = ["weekly", "monthly"];

export interface ReportSectionRow {
  label: string;
  value: string | number;
}

export interface ReportSection {
  title: string;
  rows: ReportSectionRow[];
}

export interface Report {
  id: string;
  projectId: string;
  type: ReportType;
  title: string;
  sections: ReportSection[];
  generatedAt: string;
}

export interface ReportDelivery {
  id: string;
  reportId: string;
  channel: DeliveryChannel;
  target: string | null;
  status: string;
  deliveredAt: string;
}

export interface ReportSchedule {
  id: string;
  projectId: string;
  type: ReportType;
  cadence: ReportCadence;
  channel: DeliveryChannel | null;
  target: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

export interface ReportExport {
  format: ReportExportFormat;
  contentType: string;
  filename: string;
  content: string;
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportToCsv(report: Report): string {
  const lines = ["section,label,value"];
  for (const section of report.sections) {
    for (const row of section.rows) {
      lines.push([csvEscape(section.title), csvEscape(row.label), csvEscape(row.value)].join(","));
    }
  }
  return lines.join("\n");
}

function htmlEscape(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Druckbares HTML (per Browser nach PDF exportierbar); ein echter Binär-PDF-Renderer ist Follow-up.
export function reportToHtml(report: Report): string {
  const sections = report.sections
    .map((section) => {
      const rows = section.rows.map((row) => `<tr><td>${htmlEscape(row.label)}</td><td>${htmlEscape(row.value)}</td></tr>`).join("");
      return `<section><h2>${htmlEscape(section.title)}</h2><table border="1" cellpadding="4">${rows}</table></section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${htmlEscape(report.title)}</title></head><body><h1>${htmlEscape(report.title)}</h1><p>Generiert: ${htmlEscape(report.generatedAt)}</p>${sections}</body></html>`;
}

export function renderReportExport(report: Report, format: ReportExportFormat): ReportExport {
  if (format === "csv") {
    return { format, contentType: "text/csv", filename: `${report.type}-${report.id}.csv`, content: reportToCsv(report) };
  }
  if (format === "pdf") {
    return { format, contentType: "application/pdf", filename: `${report.type}-${report.id}.pdf`, content: reportToPdf(report) };
  }
  return { format: "html", contentType: "text/html", filename: `${report.type}-${report.id}.html`, content: reportToHtml(report) };
}

// Dependency-freier, gültiger PDF-1.4-Writer (eine Seite, Helvetica). Schließt GAP-REPORT-001 ohne
// externen Renderer. Nicht-ASCII wird transliteriert/entfernt, damit /Length == Byte-Länge bleibt.
function transliterateAscii(value: string): string {
  const map: Record<string, string> = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss", "·": "-", "–": "-", "—": "-", "„": '"', "“": '"', "”": '"', "‚": "'", "‘": "'", "’": "'", "…": "..." };
  return value.replace(/[äöüÄÖÜß·–—„“”‚‘’…]/g, (char) => map[char] ?? char).replace(/[^\x20-\x7e]/g, "");
}

function pdfEscape(value: string): string {
  return transliterateAscii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function reportToPdf(report: Report): string {
  const lines: string[] = [report.title, `Generiert: ${report.generatedAt}`];
  for (const section of report.sections) {
    lines.push("");
    lines.push(section.title);
    for (const row of section.rows) {
      lines.push(`  ${row.label}: ${row.value}`);
    }
  }

  const fontSize = 11;
  const leading = 15;
  let stream = `BT\n/F1 ${fontSize} Tf\n${leading} TL\n50 800 Td\n`;
  stream += lines
    .slice(0, 50)
    .map((line, index) => `${index === 0 ? "" : "T* "}(${pdfEscape(line).slice(0, 110)}) Tj`)
    .join("\n");
  stream += "\nET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}
