import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "./services/db.js";
import { formatRecordToMarkdown } from "./utils.js";

export function registerResources(server: McpServer): void {
  // URI template: docs://love2d/{module}/{symbol}
  // e.g. docs://love2d/love.graphics/love.graphics.draw
  const template = new ResourceTemplate("docs://love2d/{module}/{symbol}", {
    list: async () => {
      const modules = await db.getModules();
      return {
        resources: modules.map((m) => ({
          uri: `docs://love2d/${encodeURIComponent(m.name ?? m.fullname)}/${encodeURIComponent(m.fullname)}`,
          name: m.fullname,
          description: m.description?.split("\n")[0] ?? undefined,
          mimeType: "text/markdown",
        })),
      };
    },
  });

  server.registerResource(
    "Love2D Documentation Page",
    template,
    {
      description: "Browse Love2D API documentation by module and symbol. URI format: docs://love2d/{module}/{fullname}",
      mimeType: "text/markdown",
    },
    async (uri: URL) => {
      const raw = uri.toString();
      const match = raw.match(/^docs:\/\/love2d\/([^/]+)\/(.+)$/);
      if (!match) {
        throw new Error(`Invalid docs URI format: ${uri}. Expected: docs://love2d/{module}/{symbol}`);
      }

      const symbol = decodeURIComponent(match[2]);
      const record =
        (await db.getRecordByFullname(symbol)) ?? (await db.getRecordById(symbol));

      if (!record) {
        throw new Error(
          `Symbol "${symbol}" not found. Use love2d_search_docs to discover valid symbol names.`
        );
      }

      return {
        contents: [
          {
            uri: raw,
            mimeType: "text/markdown",
            text: formatRecordToMarkdown(record),
          },
        ],
      };
    }
  );
}
