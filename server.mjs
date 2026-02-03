// Minimal static server for Next.js `output: "export"` output in `out/`.
// Designed for Railway (listens on process.env.PORT).
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, "out");

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function isProbablyImmutableAsset(urlPath) {
  // Next export emits hashed assets under /_next/static/
  return urlPath.startsWith("/_next/static/");
}

function safeResolveOutPath(urlPath) {
  // Strip query/hash already removed earlier; ensure leading slash.
  const p = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
  const decoded = decodeURIComponent(p);
  const normalized = path.posix.normalize(decoded);
  if (!normalized.startsWith("/")) return null;
  if (normalized.includes("\0")) return null;

  let rel = normalized.slice(1); // remove leading "/"
  if (rel === "") rel = "index.html";
  if (rel.endsWith("/")) rel += "index.html";

  // Prevent path traversal
  const abs = path.join(OUT_DIR, rel);
  if (!abs.startsWith(OUT_DIR + path.sep) && abs !== OUT_DIR) return null;
  return abs;
}

async function fileExists(filePath) {
  try {
    const st = await fsp.stat(filePath);
    return st.isFile();
  } catch {
    return false;
  }
}

function sendError(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(message);
}

async function serveFile(req, res, filePath, urlPath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = statusCode;
  res.setHeader("content-type", MIME_BY_EXT[ext] || "application/octet-stream");
  res.setHeader("x-content-type-options", "nosniff");

  if (isProbablyImmutableAsset(urlPath)) {
    res.setHeader("cache-control", "public, max-age=31536000, immutable");
  } else {
    // HTML/CSV should be revalidated so updates deploy quickly.
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
  }

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      sendError(res, 405, "Method Not Allowed");
      return;
    }

    const rawUrl = req.url || "/";
    const urlPath = rawUrl.split("?")[0].split("#")[0] || "/";
    const absPath = safeResolveOutPath(urlPath);
    if (!absPath) {
      sendError(res, 400, "Bad Request");
      return;
    }

    if (await fileExists(absPath)) {
      await serveFile(req, res, absPath, urlPath, 200);
      return;
    }

    // Fall back to exported 404 page if present.
    const notFoundPath = path.join(OUT_DIR, "404.html");
    if (await fileExists(notFoundPath)) {
      await serveFile(req, res, notFoundPath, "/404.html", 404);
      return;
    }

    sendError(res, 404, "Not Found");
  } catch (e) {
    sendError(res, 500, e instanceof Error ? e.message : "Internal Server Error");
  }
});

const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";
server.listen(port, host, () => {
  console.log(`Static site serving ${OUT_DIR} on http://${host}:${port}`);
});

