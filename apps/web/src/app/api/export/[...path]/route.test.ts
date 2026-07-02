import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/server-api", () => ({ callInternalApi: vi.fn() }));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { callInternalApi } from "../../../../lib/server-api";

function req(): NextRequest {
  return new NextRequest("http://localhost/api/export/reports/r1");
}

function ctx(path: string[]): { params: Promise<{ path?: string[] }> } {
  return { params: Promise.resolve({ path }) };
}

afterEach(() => vi.clearAllMocks());

describe("GET /api/export/[...path]", () => {
  it("returns the export content with a download disposition on success", async () => {
    vi.mocked(callInternalApi).mockResolvedValue({
      status: 200,
      body: { data: { content: "id,score\n1,90", contentType: "text/csv; charset=utf-8", filename: "report.csv" } },
    } as never);
    const res = await GET(req(), ctx(["reports", "r1", "export"]));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="report.csv"');
    expect(await res.text()).toBe("id,score\n1,90");
  });

  it("forwards an upstream error status", async () => {
    vi.mocked(callInternalApi).mockResolvedValue({
      status: 404,
      body: { error: { code: "not_found", message: "nope" } },
    } as never);
    const res = await GET(req(), ctx(["reports", "missing", "export"]));
    expect(res.status).toBe(404);
  });

  it("returns 502 when the export payload has no content", async () => {
    vi.mocked(callInternalApi).mockResolvedValue({ status: 200, body: { data: {} } } as never);
    const res = await GET(req(), ctx(["reports", "r1", "export"]));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("invalid_export");
  });
});
