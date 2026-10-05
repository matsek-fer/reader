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
//        --port 0 lets the OS choose; the real port lands in .ask/server.json.
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
// Diagram captions in served answers and notes follow the vault's language,
// as they do in the built page.
const LANG = JSON.parse(fs.readFileSync(path.join(vault, "forest.json"), "utf8")).language === "en" ? "en" : "hr";
const askDir = path.join(vault, ".ask");
const sessionsDir = path.join(vault, "sessions");
fs.mkdirSync(askDir, { recursive: true });

// One token per launch, carried in the URL the server prints. Anything on
// this machine can reach 127.0.0.1 — a browser tab from any site included —
// so the token, not the loopback address, is what makes a request the
// member's own.
const TOKEN = crypto.randomBytes(24).toString("hex");
const STARTED = new Date().toISOString();
// Both known only after listen: with --port 0 the OS picks the port.
let realPort = port;
let ORIGIN = `http://127.0.0.1:${port}`;
const WATCHER_STALE_MS = 90_000;
// A session slug becomes a directory name under sessions/ in the skill's
// hands, so it is validated here, at the door, with one regex both ends use.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const TRAIL_MAX = 12;
const PROGRESS_MAX = 200;

// Read per request, not once: a tree grown during a session has to be a
// known id for the next request's `tree` and for the answer's wikilinks.
function treeIds() {
  const dir = path.join(vault, "trees");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)));
}

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
// Absent and vanished-mid-read look the same to the caller: the skill rewrites
// these files while the page polls them, and an editor may replace rather
// than overwrite.
function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}
function mtimeOf(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return null; }
}

function watcherState() {
  const w = readJson(path.join(askDir, "watcher.json"));
  const seen = w?.ts ? Date.parse(w.ts) : 0;
  return { alive: Date.now() - seen < WATCHER_STALE_MS, seen: w?.ts ?? null };
}

// server.json is how /forest:tutor finds a bridge that is already up and
// reuses it, token included. Written after bind, removed on exit — but only
// while it is still ours: a newer launch may have replaced it meanwhile.
const serverFile = path.join(askDir, "server.json");
function writeServerFile() {
  const tmp = path.join(askDir, ".server.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify({ port: realPort, token: TOKEN, pid: process.pid, started: STARTED }, null, 2) + "\n");
  fs.renameSync(tmp, serverFile);
}
function removeServerFile() {
  if (readJson(serverFile)?.pid !== process.pid) return;
  try { fs.unlinkSync(serverFile); } catch { /* already gone */ }
}

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// A thrown fs call — a file replaced under us, a full disk — must not take
// the bridge down: Node exits on an unhandled rejection, and with it every
// open stream and the token the member's tab holds.
const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (e) {
    console.error(`request ${req.method} ${req.url} failed: ${e.message}`);
    if (!res.headersSent) json(res, 500, { error: "internal" });
    else res.end();
  }
});

async function handle(req, res) {
  const url = new URL(req.url, ORIGIN);

  // The page itself. No auth: it is the entry point, and it is only ever the
  // member's own vault view — the secret is the token it needs to do anything.
  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, fs.readFileSync(forestHtml), "text/html; charset=utf-8");
  }

  if (!url.pathname.startsWith("/api/")) return json(res, 404, { error: "not found" });
  if (!authorized(req, url)) return json(res, 403, { error: "forbidden" });

  if (req.method === "GET" && url.pathname === "/api/state") {
    return json(res, 200, {
      vault,
      watcher: watcherState(),
      server: { port: realPort, pid: process.pid, started: STARTED },
    });
  }

  if (req.method === "POST" && url.pathname === "/api/ask") {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: "bad json" }); }
    const known = treeIds();
    const kind = ["ask", "grow", "tutor"].includes(body.kind) ? body.kind : "ask";
    const tree = typeof body.tree === "string" && known.has(body.tree) ? body.tree : null;
    const question = String(body.question ?? "").slice(0, 4000).trim();
    const selection = String(body.selection ?? "").slice(0, 4000);
    const action = kind === "tutor"
      ? (["start", "answer", "pause"].includes(body.action) ? body.action : "answer")
      : null;
    let session = null;
    if (body.session != null) {
      if (typeof body.session !== "string" || !SLUG_RE.test(body.session)) return json(res, 400, { error: "bad session" });
      session = body.session;
    }
    if (kind === "tutor" && !session) return json(res, 400, { error: "tutor turn needs a session" });
    if (!question && (kind === "ask" || (kind === "tutor" && action === "answer"))) return json(res, 400, { error: "empty question" });
    const idList = (v, max) =>
      Array.isArray(v) ? v.filter((x) => typeof x === "string" && known.has(x)).slice(0, max) : [];
    const id = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + crypto.randomBytes(3).toString("hex");
    const dir = path.join(askDir, id);
    fs.mkdirSync(dir);
    // Written atomically (rename) so a watcher polling mid-write never sees a
    // half-serialized request.
    const tmp = path.join(dir, ".request.json.tmp");
    fs.writeFileSync(tmp, JSON.stringify({
      id, kind, tree, selection, question,
      reply_to: typeof body.reply_to === "string" && ID_RE.test(body.reply_to) ? body.reply_to : null,
      session, action,
      trail: idList(body.trail, TRAIL_MAX),
      progress: idList(body.progress, PROGRESS_MAX),
      created: new Date().toISOString(),
    }, null, 2) + "\n");
    fs.renameSync(tmp, path.join(dir, "request.json"));
    return json(res, 200, { id, watcher: watcherState() });
  }

  // The tutor section polls this: the session's state plus its notes already
  // rendered, so the page needs no markdown or math of its own. The slug
  // regex is the whole path check — it admits no separator and no dot.
  const sm = /^\/api\/session\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && sm) {
    if (!SLUG_RE.test(sm[1])) return json(res, 400, { error: "bad slug" });
    const dir = path.join(sessionsDir, sm[1]);
    let isDir = false;
    try { isDir = fs.statSync(dir).isDirectory(); } catch { /* no such session */ }
    if (!isDir) return json(res, 404, { exists: false, error: "no such session" });
    const stateFile = path.join(dir, "state.json");
    const notesFile = path.join(dir, "notes.md");
    const mtimes = [stateFile, notesFile].map(mtimeOf);
    const present = mtimes.filter((t) => t != null);
    const updated = present.length ? new Date(Math.max(...present)).toISOString() : null;
    // `rev` keeps the raw mtimes: two writes inside one millisecond would
    // share an ISO stamp, and the page polls this every 2 s, so a poll that
    // echoes the last rev back as ?since= is answered without rendering.
    const rev = mtimes.map((t) => (t == null ? "-" : String(t))).join("/");
    if (present.length && url.searchParams.get("since") === rev) return json(res, 200, { exists: true, unchanged: true, rev, updated });
    const notes = readText(notesFile);
    const known = treeIds();
    return json(res, 200, {
      exists: true,
      state: readJson(stateFile),
      notes_html: notes == null ? "" : renderBody(notes, (id) => known.has(id), { lang: LANG }),
      rev,
      updated,
    });
  }

  // Server-sent events: status changes, then the rendered answer. Polling a
  // single directory every half second is boring and works on every platform
  // fs.watch does not.
  const m = /^\/api\/answer\/([A-Za-z0-9-]{1,64})$/.exec(url.pathname);
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
    const finish = () => { clearInterval(tick); res.end(); };
    const tick = setInterval(() => {
      try {
        const st = readJson(path.join(dir, "status.json"));
        const stKey = JSON.stringify(st);
        if (st && stKey !== lastStatus) { lastStatus = stKey; emit("status", st); }
        if (!sentAnswer && st?.state === "done") {
          sentAnswer = true;
          const md = readText(path.join(dir, "answer.md")) ?? "";
          const known = treeIds();
          emit("answer", { html: renderBody(md, (id) => known.has(id), { lang: LANG }), markdown: md, trees_added: st.trees_added ?? [] });
          emit("done", {});
          finish();
        } else if (!sentAnswer && st?.state === "error") {
          emit("done", {});
          finish();
        } else {
          emit("watcher", watcherState());
        }
      } catch (e) {
        // The timer runs outside the handler's try, so a throw here would be
        // an uncaught exception — the same process exit, by another road.
        console.error(`answer stream ${m[1]} failed: ${e.message}`);
        emit("status", { state: "error", message: "most nije uspio pročitati odgovor" });
        emit("done", {});
        finish();
      }
    }, 500);
    req.on("close", () => clearInterval(tick));
    return;
  }

  return json(res, 404, { error: "not found" });
}

server.on("error", (e) => {
  console.error(e.code === "EADDRINUSE"
    ? `error: port ${port} is taken (another vault's bridge?) — pass --port 0 to let the OS choose`
    : `error: ${e.message}`);
  process.exit(3);
});

server.listen(port, "127.0.0.1", () => {
  realPort = server.address().port;
  ORIGIN = `http://127.0.0.1:${realPort}`;
  writeServerFile();
  const link = `${ORIGIN}/?t=${TOKEN}`;
  console.log(`forest bridge for ${vault}`);
  console.log(`open: ${link}`);
  console.log(`then, in Claude Code inside the vault: /forest:tutor (or /ask --watch)`);
  if (args.includes("--open")) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const argv = process.platform === "win32" ? ["/c", "start", "", link] : [link];
    spawn(opener, argv, { stdio: "ignore", detached: true }).unref();
  }
});

// SIGINT and SIGTERM would otherwise kill the process without the 'exit'
// event, leaving a server.json that points at nothing.
process.on("exit", removeServerFile);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
