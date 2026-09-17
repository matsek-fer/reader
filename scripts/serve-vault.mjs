#!/usr/bin/env node
// The bridge between forest.html and the member's own Claude Code session.
//
// This server never calls a model and never holds a key. It serves the vault's
// forest.html from 127.0.0.1, turns the page's "ask" into a request FILE under
// <vault>/.ask/<id>/, and streams back whatever the member's Claude Code —
// running `/ask` in watch mode on their own subscription — writes there. The
// model side of the bridge is therefore an ordinary interactive Claude Code
// session with the member watching its permission prompts, which is both the
// sanctioned way to use a claude.ai login and a better sandbox than anything
// this file could build.
//
// usage: node scripts/serve-vault.mjs <vault-dir> [--port 7411] [--open]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { renderBody } from "./lib/render.mjs";

const args = process.argv.slice(2);
const flag = (n, d = null) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!args[0] || args[0].startsWith("--")) {
  console.error("usage: node scripts/serve-vault.mjs <vault-dir> [--port 7411] [--open]");
  process.exit(2);
}
const vault = path.resolve(args[0]);
const port = Number(flag("--port", "7411"));
const forestHtml = path.join(vault, "views", "forest.html");
if (!fs.existsSync(path.join(vault, "forest.json")) || !fs.existsSync(forestHtml)) {
  console.error(`error: ${vault} is not a built vault (needs forest.json and views/forest.html — run build-views.mjs first)`);
  process.exit(1);
}
const askDir = path.join(vault, ".ask");
fs.mkdirSync(askDir, { recursive: true });

// One token per launch, carried in the URL the server prints. Anything on
// this machine can reach 127.0.0.1 — a browser tab from any site included —
// so the token, not the loopback address, is what makes a request the
// member's own.
const TOKEN = crypto.randomBytes(24).toString("hex");
const ORIGIN = `http://127.0.0.1:${port}`;
const WATCHER_STALE_MS = 90_000;

const treeIds = new Set(
  fs.existsSync(path.join(vault, "trees"))
    ? fs.readdirSync(path.join(vault, "trees")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3))
    : []
);

function send(res, status, body, type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...extra });
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj));

// Both checks, on every API call: the token proves the caller has the URL we
// printed; the Origin/Sec-Fetch-Site check stops a page from some other site
// that somehow learned the token from driving the bridge cross-origin.
function authorized(req, url) {
  const t = req.headers["x-forest-token"] ?? url.searchParams.get("t");
  if (t !== TOKEN) return false;
  const origin = req.headers.origin;
  const sfs = req.headers["sec-fetch-site"];
  if (origin && origin !== ORIGIN) return false;
  if (!origin && sfs && sfs !== "same-origin" && sfs !== "none") return false;
  return true;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function watcherState() {
  const w = readJson(path.join(askDir, "watcher.json"));
  const seen = w?.ts ? Date.parse(w.ts) : 0;
  return { alive: Date.now() - seen < WATCHER_STALE_MS, seen: w?.ts ?? null };
}

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);

  // The page itself. No auth: it is the entry point, and it is only ever the
  // member's own vault view — the secret is the token it needs to do anything.
  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, fs.readFileSync(forestHtml), "text/html; charset=utf-8");
  }

  if (!url.pathname.startsWith("/api/")) return json(res, 404, { error: "not found" });
  if (!authorized(req, url)) return json(res, 403, { error: "forbidden" });

  if (req.method === "GET" && url.pathname === "/api/state") {
    return json(res, 200, { vault, watcher: watcherState() });
  }

  if (req.method === "POST" && url.pathname === "/api/ask") {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "bad json" }); }
    const kind = ["ask", "grow", "tutor"].includes(body.kind) ? body.kind : "ask";
    const tree = typeof body.tree === "string" && treeIds.has(body.tree) ? body.tree : null;
    const question = String(body.question ?? "").slice(0, 4000).trim();
    const selection = String(body.selection ?? "").slice(0, 4000);
    if (kind === "ask" && !question) return json(res, 400, { error: "empty question" });
    const id = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + crypto.randomBytes(3).toString("hex");
    const dir = path.join(askDir, id);
    fs.mkdirSync(dir);
    // Written atomically (rename) so a watcher polling mid-write never sees a
    // half-serialized request.
    const tmp = path.join(dir, ".request.json.tmp");
    fs.writeFileSync(tmp, JSON.stringify({
      id, kind, tree, selection, question,
      reply_to: typeof body.reply_to === "string" ? body.reply_to : null,
      created: new Date().toISOString(),
    }, null, 2) + "\n");
    fs.renameSync(tmp, path.join(dir, "request.json"));
    return json(res, 200, { id, watcher: watcherState() });
  }

  // Server-sent events: status changes, then the rendered answer. Polling a
  // single directory every half second is boring and works on every platform
  // fs.watch does not.
  const m = /^\/api\/answer\/([A-Za-z0-9-]+)$/.exec(url.pathname);
  if (req.method === "GET" && m) {
    const dir = path.join(askDir, m[1]);
    if (!fs.existsSync(dir)) return json(res, 404, { error: "no such request" });
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
    });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    let lastStatus = "";
    let sentAnswer = false;
    const tick = setInterval(() => {
      const st = readJson(path.join(dir, "status.json"));
      const stKey = JSON.stringify(st);
      if (st && stKey !== lastStatus) { lastStatus = stKey; emit("status", st); }
      const answerFile = path.join(dir, "answer.md");
      if (!sentAnswer && st?.state === "done") {
        sentAnswer = true;
        const md = fs.existsSync(answerFile) ? fs.readFileSync(answerFile, "utf8") : "";
        emit("answer", { html: renderBody(md, (id) => treeIds.has(id)), markdown: md, trees_added: st.trees_added ?? [] });
        emit("done", {});
        clearInterval(tick);
        res.end();
      } else if (!sentAnswer && st?.state === "error") {
        emit("done", {});
        clearInterval(tick);
        res.end();
      } else {
        emit("watcher", watcherState());
      }
    }, 500);
    req.on("close", () => clearInterval(tick));
    return;
  }

  return json(res, 404, { error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  const link = `${ORIGIN}/?t=${TOKEN}`;
  console.log(`forest bridge for ${vault}`);
  console.log(`open: ${link}`);
  console.log(`then, in Claude Code inside the vault: /ask --watch`);
  if (args.includes("--open")) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const argv = process.platform === "win32" ? ["/c", "start", "", link] : [link];
    spawn(opener, argv, { stdio: "ignore", detached: true }).unref();
  }
});
