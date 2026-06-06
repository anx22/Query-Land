// Reporting (§5 Modul 6, Welle 6). Ein Report ist ein generierter Snapshot aus den vorhandenen
// Domänen (Health, Opportunities, Sichtbarkeit, Authority), strukturiert in generische Sektionen.
// Export (CSV/HTML) sind reine, testbare Funktionen — dependency-frei (echtes Binär-PDF = Follow-up).

export type ReportType = "weekly_summary" | "opportunity_digest" | "authority_report";
export type DeliveryChannel = "email" | "slack";
export type ReportCadence = "weekly" | "monthly";
export type ReportExportFormat = "csv" | "html";

export const REPORT_TYPES: readonly ReportType[] = ["weekly_summary", "opportunity_digest", "authority_report"];
export const DELIVERY_CHANNELS: readonly DeliveryChannel[] = ["email", "slack"];
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
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
  return { format: "html", contentType: "text/html", filename: `${report.type}-${report.id}.html`, content: reportToHtml(report) };
}
