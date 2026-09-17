#!/usr/bin/env node
// The watcher's blocking primitive: keep the heartbeat fresh and return the
// next unhandled request from <vault>/.ask/, or "none" after the timeout so
// the /ask skill can loop without ever tripping a tool timeout. A request is
// unhandled when it has request.json and no status.json — the skill writes
// status first, so a crash mid-answer leaves a visible half-state rather
// than a request that silently re-runs forever.
//
// usage: node scripts/ask-wait.mjs <vault-dir> [--timeout 480]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (!args[0]) { console.error("usage: node scripts/ask-wait.mjs <vault-dir> [--timeout 480]"); process.exit(2); }
const askDir = path.join(path.resolve(args[0]), ".ask");
const timeoutS = Number(args.includes("--timeout") ? args[args.indexOf("--timeout") + 1] : 480);
fs.mkdirSync(askDir, { recursive: true });

const heartbeat = () =>
  fs.writeFileSync(path.join(askDir, "watcher.json"), JSON.stringify({ ts: new Date().toISOString(), pid: process.pid }) + "\n");

function nextUnhandled() {
  const dirs = fs.readdirSync(askDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // ids are timestamp-prefixed, so lexical order is arrival order
  for (const name of dirs) {
    const dir = path.join(askDir, name);
    if (fs.existsSync(path.join(dir, "request.json")) && !fs.existsSync(path.join(dir, "status.json"))) return dir;
  }
  return null;
}

const deadline = Date.now() + timeoutS * 1000;
for (;;) {
  heartbeat();
  const hit = nextUnhandled();
  if (hit) { console.log(hit); process.exit(0); }
  if (Date.now() >= deadline) { console.log("none"); process.exit(0); }
  await new Promise((r) => setTimeout(r, 2000));
}
