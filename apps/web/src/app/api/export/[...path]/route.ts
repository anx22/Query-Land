import { NextResponse, type NextRequest } from "next/server";
import { callInternalApi } from "../../../../lib/server-api";

// Liefert Report-Exporte als echte Datei: ruft den internen Export-Endpunkt (JSON-Envelope mit
// content/contentType/filename) und gibt den Inhalt mit korrektem Content-Type + Download-Header
// zurück, statt das JSON-Envelope durchzureichen.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path = [] } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const apiResponse = await callInternalApi("GET", `/${path.join("/")}${request.nextUrl.search}`, undefined, {
    headers: {
      authorization: request.headers.get("authorization") ?? undefined,
      "x-request-id": requestId
    }
  });

  if (apiResponse.status >= 400) {
    return NextResponse.json(apiResponse.body, { status: apiResponse.status });
  }

  const data = (apiResponse.body as { data?: { content?: string; contentType?: string; filename?: string } }).data;
  if (!data || typeof data.content !== "string") {
    return NextResponse.json({ error: { code: "invalid_export", message: "Export payload missing content" } }, { status: 502 });
  }

  return new Response(data.content, {
    status: 200,
    headers: {
      "content-type": data.contentType ?? "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${(data.filename ?? "export").replace(/"/g, "")}"`
    }
  });
}
