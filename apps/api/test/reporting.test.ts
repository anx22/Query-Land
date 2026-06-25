import assert from "node:assert/strict";
import test from "node:test";
import { compareAlert, reportToCsv, reportToHtml, reportToPdf, type Report } from "@seo-tool/domain-model";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

// WP-5.1..5.4: Reporting & Alerts (Welle 6). Report-Generierung/Export/Versand/Schedules und
// Alert-Regeln/Auswertung. Export-Funktionen sind reine, dependency-freie Serialisierer.
//
// Lokaler Lauf:
//   npm run build && NODE_ENV=test node --test apps/api/dist/test/reporting.test.js

type ApiResponse = { status: number; body: unknown };

async function testApp() {
  const store = await createStore("sqlite::memory:");
  return { app: createApp(store), store };
}

function data<T>(response: ApiResponse): T {
  return (response.body as { data: T }).data;
}

const SAMPLE_REPORT: Report = {
  id: "rep-1",
  projectId: "proj-x",
  type: "weekly_summary",
  title: "Wochenreport · X",
  generatedAt: "2026-06-06T00:00:00.000Z",
  sections: [
    { title: "Übersicht", rows: [{ label: "Sites", value: 2 }, { label: "Notiz, mit Komma", value: "a\"b" }] }
  ]
};

async function seedProject(app: Awaited<ReturnType<typeof testApp>>["app"], slug: string) {
  const projectId = data<{ id: string }>(await app("POST", "/projects", { name: `Report ${slug}`, slug })).id;
  await app("POST", `/projects/${projectId}/sites`, { baseUrl: "https://acme.example.com", scopeType: "domain" });
  return projectId;
}

async function seedOpportunity(app: Awaited<ReturnType<typeof testApp>>["app"], projectId: string) {
  await app("POST", `/projects/${projectId}/opportunities`, {
    type: "money_page", affectedUrls: ["https://acme.example.com/x"],
    currentState: "x", recommendedAction: "y",
    expectedImpact: 3, effort: 2, confidence: 0.6, businessValue: 50, urgency: 3,
    validationMetric: "ctr",
    evidence: [{ source: "gsc", sourceConfidence: "B", metric: "ctr", beforeValue: 0.01, currentValue: 0.01, timeWindow: "2026-06-06", affectedEntity: "https://acme.example.com/x" }]
  });
}

test("reportToCsv/reportToHtml serialize sections (pure, escaped)", () => {
  const csv = reportToCsv(SAMPLE_REPORT);
  assert.equal(csv.split("\n")[0], "section,label,value");
  assert.ok(csv.includes('"Notiz, mit Komma"'));
  assert.ok(csv.includes('"a""b"'));
  const html = reportToHtml(SAMPLE_REPORT);
  assert.ok(html.includes("<h1>Wochenreport · X</h1>"));
  assert.ok(html.includes("<h2>Übersicht</h2>"));
});

test("reportToPdf emits a valid dependency-free PDF (pure)", () => {
  const pdf = reportToPdf(SAMPLE_REPORT);
  assert.ok(pdf.startsWith("%PDF-1.4"), "has a PDF header");
  assert.ok(pdf.includes("/Type /Catalog"));
  assert.ok(pdf.trimEnd().endsWith("%%EOF"), "has a PDF trailer");
  // Non-ASCII (the section title "Übersicht") is transliterated so /Length stays byte-accurate.
  assert.ok(pdf.includes("Uebersicht"));
});

test("compareAlert covers all comparators (pure)", () => {
  assert.equal(compareAlert(5, "lt", 10), true);
  assert.equal(compareAlert(10, "lt", 10), false);
  assert.equal(compareAlert(10, "lte", 10), true);
  assert.equal(compareAlert(11, "gt", 10), true);
  assert.equal(compareAlert(10, "gte", 10), true);
});

test("weekly report aggregates four sections and exports/delivers", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await seedProject(app, "weekly");
    await seedOpportunity(app, projectId);

    const report = data<Report>(await app("POST", `/projects/${projectId}/reports`, { type: "weekly_summary" }));
    assert.deepEqual(report.sections.map((section) => section.title), ["Übersicht", "Opportunities", "Sichtbarkeit & Keywords", "Authority"]);

    const fetched = data<Report>(await app("GET", `/reports/${report.id}`));
    assert.equal(fetched.id, report.id);
    const list = data<Report[]>(await app("GET", `/projects/${projectId}/reports`));
    assert.equal(list.length, 1);

    const csv = data<{ contentType: string; content: string }>(await app("GET", `/reports/${report.id}/export?format=csv`));
    assert.equal(csv.contentType, "text/csv");
    assert.ok(csv.content.startsWith("section,label,value"));
    const html = data<{ contentType: string }>(await app("GET", `/reports/${report.id}/export?format=html`));
    assert.equal(html.contentType, "text/html");
    const pdf = data<{ contentType: string; content: string }>(await app("GET", `/reports/${report.id}/export?format=pdf`));
    assert.equal(pdf.contentType, "application/pdf");
    assert.ok(pdf.content.startsWith("%PDF-1.4"));

    const delivery = data<{ status: string; channel: string }>(await app("POST", `/reports/${report.id}/deliver`, { channel: "email", target: "team@acme.test" }));
    assert.equal(delivery.status, "sent");
    assert.equal(delivery.channel, "email");
    const deliveries = data<unknown[]>(await app("GET", `/reports/${report.id}/deliveries`));
    assert.equal(deliveries.length, 1);
  } finally {
    await store.close();
  }
});

test("a weekly schedule runs once when due and is idempotent until next cadence", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await seedProject(app, "sched");
    await app("POST", `/projects/${projectId}/report-schedules`, { type: "weekly_summary", cadence: "weekly", channel: "slack" });

    const firstRun = data<{ generated: number }>(await app("POST", `/projects/${projectId}/report-schedules/run-due`, {}));
    assert.equal(firstRun.generated, 1, "a fresh schedule is due immediately");

    const secondRun = data<{ generated: number }>(await app("POST", `/projects/${projectId}/report-schedules/run-due`, {}));
    assert.equal(secondRun.generated, 0, "not due again within the cadence window");
  } finally {
    await store.close();
  }
});

test("alert rule evaluation records triggered events against current metrics", async () => {
  const { app, store } = await testApp();
  try {
    const projectId = await seedProject(app, "alerts");
    await seedOpportunity(app, projectId);
    await app("POST", `/projects/${projectId}/alert-rules`, { metric: "open_opportunities", comparator: "gte", threshold: 1 });
    await app("POST", `/projects/${projectId}/alert-rules`, { metric: "visibility_score", comparator: "lt", threshold: 10 });

    const events = data<Array<{ metric: string; triggered: boolean; observedValue: number }>>(await app("POST", `/projects/${projectId}/alerts/evaluate`, {}));
    assert.equal(events.length, 2);
    const open = events.find((event) => event.metric === "open_opportunities");
    assert.ok(open && open.triggered, "1 open opportunity >= threshold 1 triggers");
    const visibility = events.find((event) => event.metric === "visibility_score");
    assert.ok(visibility && visibility.triggered, "visibility 0 < 10 triggers");

    const history = data<unknown[]>(await app("GET", `/projects/${projectId}/alert-events`));
    assert.equal(history.length, 2);
  } finally {
    await store.close();
  }
});

test("report generation rejects unknown project and invalid type", async () => {
  const { app, store } = await testApp();
  try {
    const missing = await app("POST", `/projects/proj-nope/reports`, { type: "weekly_summary" });
    assert.equal(missing.status, 404);
    const projectId = await seedProject(app, "bad");
    const badType = await app("POST", `/projects/${projectId}/reports`, { type: "nonsense" });
    assert.equal(badType.status, 400);
  } finally {
    await store.close();
  }
});
