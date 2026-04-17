import { z } from "zod";

// ─── Response Format ────────────────────────────────────────────────────────

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const ResponseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for human-readable, 'json' for structured data");

// ─── Tool Input Schemas ──────────────────────────────────────────────────────

export const SearchDocsInputSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query must be at least 1 character")
      .max(200, "Query must not exceed 200 characters")
      .describe("Search query (e.g. 'graphics draw', 'keyboard', 'Body', 'love.audio')"),
    top_n: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of results to return (default: 10, max: 50)"),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type SearchDocsInput = z.infer<typeof SearchDocsInputSchema>;

export const LookupSymbolInputSchema = z
  .object({
    name: z
      .string()
      .min(1, "Symbol name must not be empty")
      .describe(
        "Full name of the Love2D symbol (e.g. 'love.graphics.draw', 'love.keypressed', 'Body:applyForce')"
      ),
    response_format: ResponseFormatSchema,
  })
  .strict();

export type LookupSymbolInput = z.infer<typeof LookupSymbolInputSchema>;

export const UpdateDocsInputSchema = z
  .object({
    force: z
      .boolean()
      .default(false)
      .describe("Force re-download even if the version hash has not changed"),
  })
  .strict();

export type UpdateDocsInput = z.infer<typeof UpdateDocsInputSchema>;
