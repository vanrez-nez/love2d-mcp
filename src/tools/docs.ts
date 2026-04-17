import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../services/db.js";
import {
  SearchDocsInputSchema,
  LookupSymbolInputSchema,
  ResponseFormat,
  type SearchDocsInput,
  type LookupSymbolInput,
} from "../schemas/tools.js";
import { formatRecordToMarkdown, formatSearchSnippet } from "../utils.js";
import { ApiRecord } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";

export function registerDocsTools(server: McpServer): void {
  // ─── love2d_search_docs ──────────────────────────────────────────────────

  server.registerTool(
    "love2d_search_docs",
    {
      title: "Search Love2D Documentation",
      description: `Search the Love2D 12.0 API documentation across modules, functions, callbacks, types, enums, and constants.

Returns a ranked list of matching symbols with a one-line description each. Use love2d_lookup_symbol for full detail on a specific result.

Args:
  - query (string): Keywords to search for (e.g. 'graphics draw', 'audio source', 'Body')
  - top_n (integer 1-50): Maximum results to return (default: 10)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns (markdown):
  Numbered list of results: fullname (kind): description

Returns (json):
  { total: number, results: [{ fullname, kind, module, description }] }

Examples:
  - "How do I draw a sprite?" → query="graphics draw"
  - "Find keyboard constants" → query="KeyConstant"
  - "Audio playback" → query="audio source play"`,
      inputSchema: SearchDocsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: SearchDocsInput) => {
      try {
        const results = (await db.search(params.query, params.top_n)).filter(
          (r): r is ApiRecord => r !== undefined
        );

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No results found for "${params.query}". Try broader keywords or check spelling.`,
              },
            ],
          };
        }

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            total: results.length,
            results: results.map((r) => ({
              fullname: r.fullname,
              kind: r.kind,
              module: r.module ?? null,
              description: r.description?.split("\n")[0] ?? "",
            })),
          };
          let text = JSON.stringify(output, null, 2);
          if (text.length > CHARACTER_LIMIT) {
            const trimmed = results.slice(0, Math.ceil(results.length / 2));
            text = JSON.stringify({ ...output, results: trimmed, truncated: true }, null, 2);
          }
          return { content: [{ type: "text", text }] };
        }

        // Markdown (default)
        const lines = [
          `**Love2D search results for "${params.query}"** (${results.length} matches)\n`,
          ...results.map((r, i) => `${i + 1}. ${formatSearchSnippet(r)}`),
          `\nUse \`love2d_lookup_symbol\` with the full name for complete details.`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error searching docs: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );

  // ─── love2d_lookup_symbol ────────────────────────────────────────────────

  server.registerTool(
    "love2d_lookup_symbol",
    {
      title: "Lookup Love2D Symbol",
      description: `Get complete documentation for a specific Love2D API symbol by its full name.

Includes description, function signatures, arguments, return values, examples, notes, and see-also links.

Args:
  - name (string): Exact full name of the symbol (e.g. 'love.graphics.draw', 'Body:applyForce', 'KeyConstant')
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns full API documentation. If the exact name is not found, the closest fuzzy match is returned.

Examples:
  - love2d_lookup_symbol({ name: "love.graphics.draw" })
  - love2d_lookup_symbol({ name: "love.audio.newSource" })
  - love2d_lookup_symbol({ name: "Body:applyForce" })`,
      inputSchema: LookupSymbolInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: LookupSymbolInput) => {
      try {
        let record = await db.getRecordByFullname(params.name);
        let usingFuzzy = false;

        if (!record) {
          const fuzzyResults = await db.search(params.name, 1);
          record = fuzzyResults[0];
          usingFuzzy = true;
        }

        if (!record) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Symbol "${params.name}" not found. Try love2d_search_docs to discover matching symbols.`,
              },
            ],
          };
        }

        const prefix = usingFuzzy
          ? `> Note: Exact match for "${params.name}" not found. Showing closest match:\n\n`
          : "";

        if (params.response_format === ResponseFormat.JSON) {
          const text = JSON.stringify({ fuzzy: usingFuzzy, record }, null, 2);
          return { content: [{ type: "text", text: prefix + text }] };
        }

        const detail = formatRecordToMarkdown(record);
        return { content: [{ type: "text", text: prefix + detail }] };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error looking up symbol: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
}
