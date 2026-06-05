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
      const parsedBody = rawBody ? JSON.parse(rawBody) as unknown : undefined;
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
