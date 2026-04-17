import fs from "fs/promises";
import MiniSearch from "minisearch";
import { DB_PATH, VERSION_PATH } from "../constants.js";
import { LoveApiDb, ApiRecord, DumpVersion } from "../types.js";

const INDEXABLE_KINDS = [
  "module",
  "function",
  "callback",
  "method",
  "type",
  "enum",
  "constant",
] as const;

export class Database {
  private db: LoveApiDb | null = null;
  private miniSearch: MiniSearch<ApiRecord> | null = null;
  private version: DumpVersion | null = null;
  private loading: Promise<void> | null = null;

  // ─── Lazy initialisation ────────────────────────────────────────────────

  /** Ensure the database is loaded. Idempotent — safe to call multiple times. */
  async ensureLoaded(): Promise<void> {
    if (this.db) return; // already loaded
    if (this.loading) return this.loading; // in-flight load — reuse the promise
    this.loading = this._load();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async _load(): Promise<void> {
    try {
      const [dbContent, versionContent] = await Promise.all([
        fs.readFile(DB_PATH, "utf-8"),
        fs.readFile(VERSION_PATH, "utf-8"),
      ]);
      this.db = JSON.parse(dbContent) as LoveApiDb;
      this.version = JSON.parse(versionContent) as DumpVersion;
      this._buildIndex();
      console.error(
        `[love2d-mcp] Database loaded: ${this._indexedCount()} indexable records (v${this.version?.version ?? "?"})`
      );

      // Fire-and-forget background update check.
      // Never awaited — never blocks the calling tool.
      // If offline or response is malformed the catch swallows the error silently.
      this._backgroundUpdateCheck();
    } catch (error) {
      console.error("[love2d-mcp] Failed to load database:", error);
      throw error;
    }
  }

  private _backgroundUpdateCheck(): void {
    import("./updater.js")
      .then(({ checkForUpdates }) => checkForUpdates())
      .then((result) => {
        if (result.status === "updated") {
          console.error(
            `[love2d-mcp] Docs updated to v${result.remoteVersion} in background. Restart to apply.`
          );
        }
      })
      .catch(() => {
        // Silently ignore — offline, rate-limited, malformed response, etc.
      });
  }

  private _buildIndex(): void {
    this.miniSearch = new MiniSearch({
      fields: ["fullname", "name", "description", "kind", "module"],
      storeFields: ["id", "fullname", "name", "kind", "description", "module"],
      searchOptions: {
        boost: { fullname: 3, name: 2, description: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
    const records = (this.db?.records ?? []).filter((r) =>
      (INDEXABLE_KINDS as readonly string[]).includes(r.kind)
    );
    this.miniSearch.addAll(records);
  }

  private _indexedCount(): number {
    return this.miniSearch?.documentCount ?? 0;
  }

  /** Reload from disk (called after an update). */
  async reload(): Promise<void> {
    this.db = null;
    this.version = null;
    this.miniSearch = null;
    await this.ensureLoaded();
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  async getRecordById(id: string): Promise<ApiRecord | undefined> {
    await this.ensureLoaded();
    const index = this.db!.by_id[id];
    return index !== undefined ? this.db!.records[index] : undefined;
  }

  async getRecordByFullname(fullname: string): Promise<ApiRecord | undefined> {
    await this.ensureLoaded();
    const index = this.db!.by_fullname[fullname];
    return index !== undefined ? this.db!.records[index] : undefined;
  }

  async search(query: string, limit = 10): Promise<Array<ApiRecord | undefined>> {
    await this.ensureLoaded();
    const results = this.miniSearch!.search(query);
    return Promise.all(
      results.slice(0, limit).map((r) => this.getRecordById(r.id))
    );
  }

  async getVersion(): Promise<DumpVersion | null> {
    await this.ensureLoaded();
    return this.version;
  }

  async getModules(): Promise<ApiRecord[]> {
    await this.ensureLoaded();
    return (this.db?.records ?? []).filter((r) => r.kind === "module");
  }
}

export const db = new Database();
