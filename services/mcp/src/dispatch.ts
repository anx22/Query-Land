import type { McpTool } from "./tools.js";
import { ToolError } from "./tools.js";

/**
 * Look up a tool by name and invoke its handler with the supplied args.
 * Throws ToolError("unknown_tool") when no tool matches.
 */
export function callTool(tools: McpTool[], name: string, args: Record<string, unknown> = {}): unknown {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new ToolError("unknown_tool", `Tool ${name} is not registered`);
  }
  return tool.handler(args);
}
