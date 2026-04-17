#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDocsTools } from "./tools/docs.js";
import { registerUpdaterTools } from "./tools/updater.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "love2d-mcp-server",
    version: "1.0.0",
  });

  // Register tools — DB is lazy-loaded on first call, not here
  registerDocsTools(server);
  registerUpdaterTools(server);
  registerResources(server);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[love2d-mcp] Server running via stdio");
}

main().catch((error: unknown) => {
  console.error("[love2d-mcp] Fatal error:", error);
  process.exit(1);
});
