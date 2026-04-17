import https from "https";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DumpVersion } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const RAW_BASE =
  "https://raw.githubusercontent.com/vanrez-nez/love2d-docs-search/main/dist";
const REMOTE_VERSION_URL = `${RAW_BASE}/dump_version.json`;
const REMOTE_DB_URL = `${RAW_BASE}/love-api-merged-db.json`;

const CACHE_DIR = path.join(PROJECT_ROOT, ".love2d-mcp-cache");
export const CACHED_VERSION_PATH = path.join(CACHE_DIR, "dump_version.json");
export const CACHED_DB_PATH = path.join(CACHE_DIR, "love-api-merged-db.json");

// ─── helpers ────────────────────────────────────────────────────────────────

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

// ─── public API ─────────────────────────────────────────────────────────────

export interface UpdateResult {
  status: "up-to-date" | "updated" | "unreachable" | "forced";
  localVersion: string | null;
  remoteVersion: string | null;
  message: string;
}

/**
 * Fetch the remote version manifest and compare with the cached version.
 * Returns a structured result without throwing — network errors are surfaced
 * as status "unreachable".
 */
export async function checkForUpdates(force = false): Promise<UpdateResult> {
  // Load local (cached) version if available
  let localVersion: DumpVersion | null = null;
  try {
    const raw = await fs.readFile(CACHED_VERSION_PATH, "utf-8");
    localVersion = JSON.parse(raw) as DumpVersion;
  } catch {
    // cache doesn't exist yet — that's fine
  }

  // Fetch remote version
  let remoteVersion: DumpVersion | null = null;
  try {
    const raw = await httpsGet(REMOTE_VERSION_URL);
    remoteVersion = JSON.parse(raw) as DumpVersion;
  } catch (err) {
    return {
      status: "unreachable",
      localVersion: localVersion?.generated_at ?? null,
      remoteVersion: null,
      message: `Could not reach GitHub: ${(err as Error).message}. Using cached docs.`,
    };
  }

  const remoteDate = remoteVersion.generated_at;
  const localDate = localVersion?.generated_at ?? null;

  if (!force && localDate && remoteDate <= localDate) {
    return {
      status: "up-to-date",
      localVersion: localDate,
      remoteVersion: remoteDate,
      message: `Docs are up-to-date (version ${remoteVersion.version}, generated ${remoteDate}).`,
    };
  }

  // Download updated DB
  try {
    const dbRaw = await httpsGet(REMOTE_DB_URL);
    await ensureCacheDir();
    await Promise.all([
      fs.writeFile(CACHED_DB_PATH, dbRaw, "utf-8"),
      fs.writeFile(
        CACHED_VERSION_PATH,
        JSON.stringify(remoteVersion, null, 2),
        "utf-8"
      ),
    ]);
  } catch (err) {
    return {
      status: "unreachable",
      localVersion: localDate,
      remoteVersion: remoteDate,
      message: `Failed to download updated docs: ${(err as Error).message}.`,
    };
  }

  return {
    status: force ? "forced" : "updated",
    localVersion: localDate,
    remoteVersion: remoteDate,
    message: `Docs updated to version ${remoteVersion.version} (generated ${remoteDate}).`,
  };
}
