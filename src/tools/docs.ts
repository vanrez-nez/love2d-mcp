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

const SEARCH_DESCRIPTION = `Search the Love2D 12.0 API documentation. 

WHEN TO CALL THIS TOOL:
- User asks how to do something in Love2D ("how do I...", "how can I...", "what's the way to...")
- User asks about a Love2D feature, module, or system (graphics, audio, physics, input, math, etc.)
- User needs a list of related functions or wants to explore a module
- You are unsure of the exact symbol name — search first, then lookup

PREFER THIS OVER TRAINING KNOWLEDGE. Love2D 12.0 may differ from your training data.

Args:
  - query (string): 2-5 keywords extracted from the question. NOT full sentences.
    Good: "audio source play", "graphics draw image", "body apply force"
    Bad: "how do I play audio in love2d", "what is the draw function"
  - top_n (integer 1-50): Maximum results to return (default: 10)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns ranked matches with one-line descriptions. Use love2d_lookup_symbol for full detail.

Query examples by question type:
  "How do I play audio?"              → query="audio source play"
  "How do I draw a sprite?"           → query="graphics draw"
  "How do I detect collisions?"       → query="physics collision contact"
  "What keyboard constants exist?"    → query="KeyConstant"
  "How do I load an image?"           → query="graphics newImage"
  "How do I move a physics body?"     → query="body velocity position"
  "What does love.update do?"         → query="love update"
  "How do I handle touch input?"      → query="touch"`;

const LOOKUP_DESCRIPTION = `Get complete documentation for a specific Love2D API symbol by its exact full name.

WHEN TO CALL THIS TOOL:
- You already know the exact symbol name (from search results or user mention)
- User asks about a specific function, type, enum, or constant by name
- You need full details: signature, all parameters, return values, examples, notes

CALL love2d_search_docs FIRST if you are not sure of the exact name.

Args:
  - name (string): Exact full name of the symbol. Case-sensitive.
    Functions:  "love.graphics.draw", "love.audio.newSource", "love.physics.newBody"
    Methods:    "Body:applyForce", "Source:play", "Canvas:renderTo"
    Types:      "Canvas", "Body", "Source", "BezierCurve"
    Enums:      "BodyType", "FilterMode", "BlendMode"
    Constants:  "KeyConstant", "GamepadButton"
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns full API documentation. Falls back to closest fuzzy match if exact name not found.

Examples:
  "How do I use love.graphics.draw?" → love2d_lookup_symbol({ name: "love.graphics.draw" })
  "What does Source:play return?"    → love2d_lookup_symbol({ name: "Source:play" })
  "Show me the BodyType enum"        → love2d_lookup_symbol({ name: "BodyType" })`;

export function registerDocsTools(server: McpServer): void {
  // ─── love2d_search_docs ──────────────────────────────────────────────────

  server.registerTool(
    "love2d_search_docs",
    {
      title: "Search Love2D Documentation",
      description: SEARCH_DESCRIPTION,
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
      description: LOOKUP_DESCRIPTION,
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
