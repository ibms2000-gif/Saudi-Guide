#!/usr/bin/env node
// خادم تطوير محلي بسيط بدون أي اعتماديات خارجية
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = process.env.PORT || 8788;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

await build();
console.log("تم البناء. الخادم يعمل الآن...");

http
  .createServer(async (req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    let filePath = path.join(DIST, urlPath);
    try {
      const data = await fs.readFile(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    } catch {
      try {
        const notFound = await fs.readFile(path.join(DIST, "404.html"));
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(notFound);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    }
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
