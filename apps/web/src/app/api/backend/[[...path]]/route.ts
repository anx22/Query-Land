import { NextResponse, type NextRequest } from "next/server";
import { callInternalApi } from "../../../../lib/server-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const invalidJsonBody = Symbol("invalid-json-body");

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { path = [] } = await context.params;
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const body = await parseJsonBody(request).catch(() => invalidJsonBody);
  if (body === invalidJsonBody) {
    return NextResponse.json({ error: { code: "invalid_json", message: "Request body must be valid JSON", requestId } }, { status: 400 });
  }

  const apiResponse = await callInternalApi(request.method, `/${path.join("/")}`, body, {
    headers: {
      authorization: request.headers.get("authorization") ?? undefined,
      "x-request-id": requestId
    }
  });

  return NextResponse.json(apiResponse.body, { status: apiResponse.status });
}

async function parseJsonBody(request: NextRequest): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const rawBody = await request.text();
  return rawBody ? JSON.parse(rawBody) as unknown : undefined;
}

export const GET = handle;
export const POST = handle;
