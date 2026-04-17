import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Project root — one level up from compiled dist/ (or directly from src/ in dev).
 */
export const PROJECT_ROOT = path.resolve(__dirname, "..");

// ─── Bundled snapshot (committed to git, always present) ────────────────────
// This is the floor — the server always works offline from first install.
const BUNDLED_DB = path.join(PROJECT_ROOT, "data", "love-api-merged-db.json");
const BUNDLED_VERSION = path.join(PROJECT_ROOT, "data", "dump_version.json");

// ─── Downloaded cache (written by love2d_update_docs tool) ──────────────────
// This is the ceiling — overrides bundled if a newer version has been fetched.
export const CACHE_DIR = path.join(PROJECT_ROOT, ".love2d-mcp-cache");
const CACHED_DB = path.join(CACHE_DIR, "love-api-merged-db.json");
const CACHED_VERSION = path.join(CACHE_DIR, "dump_version.json");

/**
 * Resolved at startup.
 * Resolution order: downloaded cache → bundled snapshot.
 */
export const DB_PATH: string = fs.existsSync(CACHED_DB) ? CACHED_DB : BUNDLED_DB;
export const VERSION_PATH: string = fs.existsSync(CACHED_VERSION) ? CACHED_VERSION : BUNDLED_VERSION;

export const CHARACTER_LIMIT = 25_000;
