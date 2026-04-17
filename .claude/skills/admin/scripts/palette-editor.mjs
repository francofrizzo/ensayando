#!/usr/bin/env node
// Palette editor for a collection. Fetches current main_color + track_colors,
// serves an in-browser oklch editor, prints the new palette JSON to stdout on
// save. The caller (admin.sh / Claude) is responsible for running the UPDATE.
//
// usage: palette-editor.mjs <slug>
// stdout on save: {"main_color": "...", "track_colors": {...}}
// exit 0 on save, 2 on cancel, non-zero on error.

import { spawnSync, exec } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const slug = process.argv[2];
if (!slug) {
  console.error("usage: palette-editor.mjs <slug>");
  process.exit(2);
}

function sqlq(s) {
  return String(s).replace(/'/g, "''");
}

function extractRows(out) {
  // Supabase CLI wraps JSON output in <untrusted-data-NONCE>...</untrusted-data-NONCE> tags.
  const env = out.match(/<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-[^>]+>/);
  const body = env ? env[1] : out;
  const arr = body.match(/\[[\s\S]*\]/);
  if (!arr) throw new Error("Could not locate JSON array in supabase output:\n" + out);
  return JSON.parse(arr[0]);
}

const fetchSql = `SELECT jsonb_build_object(
  'slug', slug,
  'title', title,
  'main_color', main_color,
  'track_colors', COALESCE(track_colors, '{}'::jsonb)
) AS palette
FROM public.collections WHERE slug = '${sqlq(slug)}';`;

process.stderr.write(`fetching palette for '${slug}'...\n`);
const q = spawnSync("npx", ["supabase", "db", "query", "--linked", fetchSql], { encoding: "utf8" });
if (q.status !== 0) {
  process.stderr.write(q.stderr || q.stdout);
  process.exit(1);
}

let palette;
try {
  const rows = extractRows(q.stdout);
  if (rows.length === 0) {
    console.error(`no collection with slug '${slug}'`);
    process.exit(1);
  }
  const raw = rows[0].palette;
  palette = typeof raw === "string" ? JSON.parse(raw) : raw;
} catch (e) {
  console.error("parse error:", e.message);
  process.exit(1);
}

const html = readFileSync(join(__dirname, "palette-editor.html"), "utf8").replace(
  '<script type="module">',
  `<script>window.__PALETTE__ = ${JSON.stringify(palette).replace(/</g, "\\u003c")};</script>\n<script type="module">`
);

let exitCode = 2; // cancel by default (e.g. user closes terminal)
const server = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
    return;
  }
  if (req.method === "POST" && req.url === "/save") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.main_color || typeof parsed.track_colors !== "object") {
          throw new Error("payload must have main_color and track_colors");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
        process.stdout.write(JSON.stringify(parsed) + "\n");
        exitCode = 0;
        setTimeout(() => {
          server.close();
          process.exit(exitCode);
        }, 100);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("bad payload: " + e.message);
      }
    });
    return;
  }
  if (req.method === "POST" && req.url === "/cancel") {
    res.writeHead(200);
    res.end('{"ok":true}');
    exitCode = 2;
    setTimeout(() => {
      server.close();
      process.exit(exitCode);
    }, 100);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  process.stderr.write(`palette editor: ${url}\n`);
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${opener} '${url}'`, (err) => {
    if (err) process.stderr.write(`(could not auto-open browser; visit ${url})\n`);
  });
});

// 15-minute safety timeout so the process doesn't linger if the tab is abandoned.
setTimeout(
  () => {
    process.stderr.write("timeout — no save within 15 minutes\n");
    process.exit(2);
  },
  15 * 60 * 1000
).unref();

process.on("SIGINT", () => {
  process.stderr.write("\ncancelled\n");
  process.exit(2);
});
