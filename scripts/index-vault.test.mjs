// Tests for index-vault.mjs + search-vault.mjs — run with `npm test`.
// They work on a temp copy of the mini-vault under SKIP_EMBED=1: the happy
// paths and determinism must hold on a machine with no model and no
// network. The real embedded path is exercised by hand (see slice 2 notes),
// not here, because a model download in CI is exactly what SKIP_EMBED
// exists to avoid.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const miniVault = path.join(repoRoot, "examples", "mini-vault");

function run(script, args, env = {}) {
  const r = spawnSync(process.execPath, [path.join(here, script), ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// A vault copy per test file, indexed once: search tests then read what the
// indexer actually wrote, not a hand-made fixture.
const vault = fs.mkdtempSync(path.join(os.tmpdir(), "forest-index-test-"));
fs.cpSync(miniVault, vault, { recursive: true });
fs.rmSync(path.join(vault, "index"), { recursive: true, force: true });

test("index-vault SKIP_EMBED writes a well-formed forest-index-0.1", () => {
  const { status, stderr } = run("index-vault.mjs", [vault], { SKIP_EMBED: "1" });
  assert.equal(status, 0, stderr);
  const index = JSON.parse(fs.readFileSync(path.join(vault, "index", "index.json"), "utf8"));
  assert.equal(index.schema_version, "forest-index-0.1");
  assert.equal(index.model, "Xenova/multilingual-e5-small");
  assert.equal(index.dims, 384);
  assert.equal(index.quantization, "int8-per-item-scale");
  assert.equal(index.unembedded, true);
  assert.equal(index.items.length, 12);
  // Deterministic order: sorted tree filenames.
  const ids = index.items.map((it) => it.id);
  assert.deepEqual(ids, [...ids].sort());
  const thm = index.items.find((it) => it.id === "thm-lagrange");
  assert.equal(thm.taxon, "theorem");
  assert.deepEqual(thm.depends, ["def-coset", "def-index"]);
  assert.equal(thm.group, "2 · Teorem i dokazi");
  assert.equal(thm.standalone, true);
  // Unembedded still carries the vector offset, but no scale.
  assert.equal(typeof thm.offset, "number");
  assert.ok(!("scale" in thm));
  assert.equal(fs.readFileSync(path.join(vault, "index", "vectors.i8.bin")).length, 0);
});

test("index-vault output is byte-identical across runs", () => {
  const first = fs.readFileSync(path.join(vault, "index", "index.json"), "utf8");
  const { status, stderr } = run("index-vault.mjs", [vault], { SKIP_EMBED: "1" });
  assert.equal(status, 0, stderr);
  assert.equal(fs.readFileSync(path.join(vault, "index", "index.json"), "utf8"), first);
});

test("search-vault finds Lagrange lexically on an unembedded index", () => {
  const { status, stdout, stderr } = run("search-vault.mjs", [vault, "Lagrangeov teorem", "--k", "3"]);
  assert.equal(status, 0, stderr);
  assert.match(stderr, /lexical-only/);
  const lines = stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].id, "thm-lagrange");
  assert.equal(lines[0].taxon, "theorem");
  assert.ok(lines.every((l) => typeof l.score === "number" && l.title));
});

test("search-vault returns nothing for a query the vault does not hold", () => {
  const { status, stdout } = run("search-vault.mjs", [vault, "kvantna kromodinamika"]);
  assert.equal(status, 0);
  assert.equal(stdout.trim(), "");
});
