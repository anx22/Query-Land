import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createStore } from "@seo-tool/api";
import { callTool } from "./dispatch.js";
import { createSeoMcpTools } from "./tools.js";

/**
 * Start the MCP server using the official @modelcontextprotocol/sdk over stdio.
 * The database location is read from DATABASE_URL (same env var as the rest of
 * the app); createStore falls back to apiDefaults.databaseUrl when unset.
 */
export async function startServer(): Promise<void> {
  const store = await createStore(process.env.DATABASE_URL);
  const tools = createSeoMcpTools(store);

  const server = new Server(
    { name: "@seo-tool/mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  // tools/list — return our existing JSON-Schema inputSchema descriptors directly.
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  });

  // tools/call — dispatch to our handler and wrap the result as MCP content.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    try {
      const result = await callTool(tools, name, args);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: message }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    // Connected; the server will run until the transport closes.
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`MCP server connection error: ${message}\n`);
    process.exit(1);
  });
}

// Run as a binary when executed directly.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`MCP server startup error: ${message}\n`);
    process.exit(1);
  });
}
