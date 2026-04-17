#!/usr/bin/env node
/**
 * postinstall.mjs
 *
 * Runs automatically on `npm install`. Tries to download the latest Love2D
 * documentation DB from GitHub and caches it locally. If offline or the
 * request fails for any reason, exits cleanly — the bundled snapshot in
 * data/ is the fallback and the package still works fully offline.
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const RAW_BASE = "https://raw.githubusercontent.com/vanrez-nez/love2d-docs-search/main/dist";
const REMOTE_VERSION_URL = `${RAW_BASE}/dump_version.json`;
const REMOTE_DB_URL = `${RAW_BASE}/love-api-merged-db.json`;

const CACHE_DIR = path.join(PROJECT_ROOT, ".love2d-mcp-cache");
const CACHED_VERSION_PATH = path.join(CACHE_DIR, "dump_version.json");
const CACHED_DB_PATH = path.join(CACHE_DIR, "love-api-merged-db.json");

const BUNDLED_VERSION_PATH = path.join(PROJECT_ROOT, "data", "dump_version.json");

// ─── helpers ────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[love2d-mcp] postinstall: checking for latest docs...");

  // Fetch remote version manifest
  let remoteVersion;
  try {
    remoteVersion = JSON.parse(await httpsGet(REMOTE_VERSION_URL));
  } catch (err) {
    console.log(`[love2d-mcp] postinstall: could not reach GitHub (${err.message}). Using bundled docs.`);
    return; // exit cleanly — bundle is the fallback
  }

  // Compare with whatever we already have (cache or bundle)
  const localVersion = readJSON(CACHED_VERSION_PATH) ?? readJSON(BUNDLED_VERSION_PATH);
  const localDate = localVersion?.generated_at ?? null;
  const remoteDate = remoteVersion?.generated_at ?? null;

  if (localDate && remoteDate && remoteDate <= localDate) {
    console.log(`[love2d-mcp] postinstall: docs are up-to-date (v${remoteVersion.version}).`);
    return;
  }

  // Download updated DB
  console.log(`[love2d-mcp] postinstall: newer docs available (v${remoteVersion.version}), downloading...`);
  let dbRaw;
  try {
    dbRaw = await httpsGet(REMOTE_DB_URL);
  } catch (err) {
    console.log(`[love2d-mcp] postinstall: download failed (${err.message}). Using bundled docs.`);
    return;
  }

  // Validate it's valid JSON before writing
  try {
    JSON.parse(dbRaw);
  } catch {
    console.log("[love2d-mcp] postinstall: remote DB is malformed JSON. Using bundled docs.");
    return;
  }

  // Write to cache
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHED_DB_PATH, dbRaw, "utf-8");
    fs.writeFileSync(CACHED_VERSION_PATH, JSON.stringify(remoteVersion, null, 2), "utf-8");
    console.log(`[love2d-mcp] postinstall: docs cached successfully (v${remoteVersion.version}).`);
  } catch (err) {
    console.log(`[love2d-mcp] postinstall: could not write cache (${err.message}). Using bundled docs.`);
  }
}

main().catch(() => {
  // Unconditional fallback — postinstall must never fail npm install
  console.log("[love2d-mcp] postinstall: unexpected error. Using bundled docs.");
});
