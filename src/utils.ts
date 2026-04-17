import { ApiRecord } from "./types.js";

// ─── Types for structured API data ──────────────────────────────────────────

interface ApiArgument {
  name: string;
  type?: string;
  description?: string;
}

interface ApiReturn {
  name?: string;
  type?: string;
  description?: string;
}

interface ApiSignature {
  name?: string;
  arguments?: ApiArgument[];
  returns?: ApiReturn[];
}

interface ApiExample {
  title?: string;
  code?: string;
  language?: string;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

export function formatRecordToMarkdown(record: ApiRecord): string {
  const lines: string[] = [];

  lines.push(`# ${record.fullname}`, "");
  lines.push(`**Kind:** ${record.kind}`);
  if (record.module) lines.push(`**Module:** ${record.module}`);
  lines.push("");

  if (record.introduced_from) lines.push(`*Introduced in LÖVE ${record.introduced_from}*`, "");
  if (record.deprecated_from) lines.push(`⚠️ *Deprecated since LÖVE ${record.deprecated_from}*`, "");
  if (record.removed_from) lines.push(`🚫 *Removed in LÖVE ${record.removed_from}*`, "");

  if (record.description) {
    lines.push(record.description, "");
  }

  const signatures = record.signatures as ApiSignature[] | undefined;
  if (signatures && signatures.length > 0) {
    lines.push("## Signatures", "");
    for (const sig of signatures) {
      const argNames = (sig.arguments ?? []).map((a) => a.name).join(", ");
      lines.push(`\`\`\`lua`, `${sig.name ?? record.fullname}(${argNames})`, `\`\`\``, "");

      if (sig.arguments && sig.arguments.length > 0) {
        lines.push("### Arguments", "");
        for (const arg of sig.arguments) {
          lines.push(`- **${arg.name}** (${arg.type ?? "any"}): ${arg.description ?? ""}`);
        }
        lines.push("");
      }

      if (sig.returns && sig.returns.length > 0) {
        lines.push("### Returns", "");
        for (const ret of sig.returns) {
          lines.push(`- **${ret.name ?? "result"}** (${ret.type ?? "any"}): ${ret.description ?? ""}`);
        }
        lines.push("");
      }
    }
  }

  if (record.examples && record.examples.length > 0) {
    lines.push("## Examples", "");
    for (const raw of record.examples) {
      const example = raw as unknown as ApiExample;
      if (example.title) lines.push(`### ${example.title}`, "");
      if (example.code) {
        const lang = example.language ?? "lua";
        lines.push(`\`\`\`${lang}`, example.code, "```", "");
      } else if (typeof raw === "string") {
        // fallback for plain string examples
        lines.push(raw as string, "");
      }
    }
  }

  if (record.notes && record.notes.length > 0) {
    lines.push("## Notes", "");
    for (const note of record.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  if (record.see_also && record.see_also.length > 0) {
    lines.push("## See Also", "");
    for (const ref of record.see_also) {
      lines.push(`- ${ref}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatSearchSnippet(record: ApiRecord): string {
  const tag = `[${record.fullname}] (${record.kind})`;
  if (!record.description) return tag;
  const firstLine = record.description.split("\n")[0];
  const truncated = firstLine.length > 100 ? `${firstLine.substring(0, 97)}...` : firstLine;
  return `${tag}: ${truncated}`;
}
