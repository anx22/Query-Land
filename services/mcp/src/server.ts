import { createInterface } from "node:readline";
import { createSQLiteStore } from "@seo-tool/api";
import { callTool } from "./dispatch.js";
import { createSeoMcpTools, type McpTool } from "./tools.js";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "@seo-tool/mcp", version: "0.1.0" } as const;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// JSON-RPC 2.0 standard error codes used by the dispatcher.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INTERNAL_ERROR = -32603;

function publicToolDescriptors(tools: McpTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}

/**
 * Route a single JSON-RPC request to a result/error. Notifications (no id)
 * return null so the caller can suppress the reply.
 */
export function handleRpc(tools: McpTool[], request: JsonRpcRequest): JsonRpcResponse | null {
  const id = request.id ?? null;
  const isNotification = request.id === undefined || request.id === null;

  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    if (isNotification) return null;
    return { jsonrpc: "2.0", id, error: { code: INVALID_REQUEST, message: "Invalid JSON-RPC request" } };
  }

  const method = request.method;
  const params = request.params ?? {};

  try {
    switch (method) {
      case "initialize":
        return reply(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        });
      case "notifications/initialized":
      case "initialized":
        // Lifecycle notification, no response expected.
        return null;
      case "ping":
        return reply(id, {});
      case "tools/list":
        return reply(id, { tools: publicToolDescriptors(tools) });
      case "tools/call": {
        const name = typeof params.name === "string" ? params.name : "";
        const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
        if (!name) {
          return reply(id, toolErrorContent("name is required for tools/call"));
        }
        try {
          const result = callTool(tools, name, args);
          return reply(id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
            isError: false
          });
        } catch (error) {
          // Tool-level failures are reported as a successful RPC with isError:true,
          // per MCP convention, so the model can read the message.
          return reply(id, toolErrorContent(errorMessage(error)));
        }
      }
      default:
        if (isNotification) return null;
        return { jsonrpc: "2.0", id, error: { code: METHOD_NOT_FOUND, message: `Unknown method: ${method}` } };
    }
  } catch (error) {
    if (isNotification) return null;
    return { jsonrpc: "2.0", id, error: { code: INTERNAL_ERROR, message: errorMessage(error) } };
  }
}

function reply(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function toolErrorContent(message: string) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Start the newline-delimited JSON-RPC stdio loop. The database location is
 * read from DATABASE_URL (same env var as the rest of the app); createSQLiteStore
 * falls back to apiDefaults.databaseUrl when it is unset.
 */
export function startServer(): void {
  const store = createSQLiteStore(process.env.DATABASE_URL);
  const tools = createSeoMcpTools(store);
  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed === "") return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Parse error" } });
      return;
    }
    const response = handleRpc(tools, request);
    if (response !== null) {
      write(response);
    }
  });

  rl.on("close", () => {
    store.close();
  });
}

function write(response: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

// Run as a binary when executed directly.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
