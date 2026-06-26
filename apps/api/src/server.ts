import { createServer } from "node:http";
import { apiDefaults } from "@seo-tool/shared-config";
import { handleRequest } from "./app.js";

export function createApiServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", async () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      let parsedBody: unknown;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody) as unknown;
        } catch {
          // Malformed JSON must be a clean 400, not an unhandled 500. The web proxy route
          // already returns invalid_json; keep the raw Node server consistent.
          response.writeHead(400, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: { code: "invalid_json", message: "Request body is not valid JSON", requestId: `req-${Buffer.from(url.pathname).toString("hex").slice(0, 8)}` } }));
          return;
        }
      }
      const apiResponse = await handleRequest(request.method ?? "GET", `${url.pathname}${url.search}`, parsedBody, {
        headers: {
          authorization: request.headers.authorization
        }
      });
      response.writeHead(apiResponse.status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(apiResponse.body));
    });
  });
}

if (process.env.NODE_ENV !== "test") {
  createApiServer().listen(apiDefaults.port, () => {
    console.log(`SEO OS API listening on :${apiDefaults.port}`);
  });
}
