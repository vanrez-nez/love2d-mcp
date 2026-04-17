import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkForUpdates } from "../services/updater.js";
import { db } from "../services/db.js";
import { UpdateDocsInputSchema, type UpdateDocsInput } from "../schemas/tools.js";

export function registerUpdaterTools(server: McpServer): void {
  server.registerTool(
    "love2d_update_docs",
    {
      title: "Update Love2D Documentation",
      description: `Check for and download the latest Love2D API documentation from GitHub.

The docs DB is versioned by generation timestamp. This tool fetches the remote manifest and, if a newer version exists, downloads the updated database. On next tool call the fresh docs are used automatically.

Args:
  - force (boolean): Re-download even if already at latest version (default: false)

Returns:
  Status message including current version, remote version, and whether an update was applied.

Use this when:
  - You want to ensure docs reflect the latest LÖVE 12.0 API changes
  - The docs seem outdated or missing symbols`,
      inputSchema: UpdateDocsInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: UpdateDocsInput) => {
      try {
        const result = await checkForUpdates(params.force);

        // If an update was downloaded, reload the in-memory DB
        if (result.status === "updated" || result.status === "forced") {
          await db.reload();
        }

        const statusIcon: Record<typeof result.status, string> = {
          "up-to-date": "✅",
          updated: "🔄",
          forced: "🔄",
          unreachable: "⚠️",
        };

        const lines = [
          `${statusIcon[result.status]} **${result.message}**`,
          ``,
          `| | Version |`,
          `|---|---|`,
          `| Local  | ${result.localVersion ?? "none (first run)"} |`,
          `| Remote | ${result.remoteVersion ?? "unreachable"} |`,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error updating docs: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
}
