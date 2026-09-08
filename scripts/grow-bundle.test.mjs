// Tests for grow-bundle.mjs — run with `npm test` (node --test).
// The firewall is the point: a digest-origin tree from a derivative vault is
// refused before anything is written, while member/agent trees and
// non-derivative vaults convert into bundle skeletons.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const cli = path.join(here, "grow-bundle.mjs");
const miniVault = path.join(repoRoot, "examples", "mini-vault");
const shareAlike = path.join(here, "test-fixtures", "share-alike");

function run(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function tmpOut(slug) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "grow-test-")), slug);
}

test("firewall refuses a digest-origin tree from a derivative vault, writing nothing", () => {
  const out = tmpOut("alfa");
  const r = run([
    shareAlike, "def-alfa",
    "--type", "proof", "--out", out, "--created", "2026-09-08", "--difficulty", "2",
  ]);
  assert.equal(r.status, 1, r.stderr);
  assert.ok(r.stderr.includes("ODBIJENO"), r.stderr);
  assert.ok(r.stderr.includes('"def-alfa"'), r.stderr);
  assert.ok(r.stderr.includes("provenance.md"), r.stderr);
  // Refusal must precede any write.
  assert.ok(!fs.existsSync(out), "refusal must not create the out dir");
});

test("firewall lets an agent-origin tree out of the same derivative vault", () => {
  const out = tmpOut("vlastita-biljeska");
  const r = run([
    shareAlike, "rem-vlastita-biljeska",
    "--type", "blog", "--out", out, "--created", "2026-09-08",
  ]);
  assert.equal(r.status, 0, r.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  assert.equal(manifest.id, "blog/vlastita-biljeska");
  assert.equal(manifest.language, "hr");
  assert.equal(manifest.provenance, "ai-assisted");
  const blog = fs.readFileSync(path.join(out, "blog.md"), "utf8");
  assert.ok(!blog.includes("[["), "vault wikilinks must not survive into a bundle");
  assert.match(blog, /x_forest/);
  assert.match(blog, /taxon: remark/);
});

test("problem conversion from mini-vault produces the full skeleton", () => {
  const out = tmpOut("lagrange");
  const r = run([
    miniVault, "thm-lagrange", "prf-lagrange-particija",
    "--type", "problem", "--out", out, "--created", "2026-09-08", "--difficulty", "3",
  ]);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ["problem.md", "solution.md", "annotation-DRAFT.md", "manifest.json"]) {
    assert.ok(fs.existsSync(path.join(out, f)), `${f} missing`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.type, "problem");
  assert.equal(manifest.id, "problem/lagrange");
  assert.equal(manifest.license, "CC-BY-4.0");
  assert.equal(manifest.created, "2026-09-08");
  assert.equal(manifest.difficulty, 3);
  assert.deepEqual(manifest.teaches, ["lagrange"]);
  assert.deepEqual(manifest.x_grown_from, ["thm-lagrange", "prf-lagrange-particija"]);
  const problem = fs.readFileSync(path.join(out, "problem.md"), "utf8");
  const solution = fs.readFileSync(path.join(out, "solution.md"), "utf8");
  assert.ok(!problem.includes("[[") && !solution.includes("[["), "wikilinks must be rewritten");
  // Rewritten to the linked tree's title in italics, noted on stderr.
  assert.ok(problem.includes("*"), problem);
  assert.match(r.stderr, /dropped vault link/);
});

test("proof conversion classifies statement and proof by taxon, not argument order", () => {
  const out = tmpOut("lagrange");
  const r = run([
    miniVault, "prf-lagrange-particija", "thm-lagrange",
    "--type", "proof", "--out", out, "--created", "2026-09-08", "--difficulty", "2",
  ]);
  assert.equal(r.status, 0, r.stderr);
  const statement = fs.readFileSync(path.join(out, "statement.md"), "utf8");
  const proof = fs.readFileSync(path.join(out, "proof.md"), "utf8");
  assert.match(statement, /Teorem \(Lagrange\)/);
  assert.match(proof, /Korak 1/);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  assert.equal(manifest.id, "proof/lagrange");
  assert.equal(manifest.title, "Lagrangeov teorem");
});

test("conversion is deterministic — two runs, identical bytes", () => {
  const args = (out) => [
    miniVault, "thm-lagrange", "prf-lagrange-particija",
    "--type", "proof", "--out", out, "--created", "2026-09-08", "--difficulty", "2",
  ];
  const a = tmpOut("lagrange");
  const b = tmpOut("lagrange");
  assert.equal(run(args(a)).status, 0);
  assert.equal(run(args(b)).status, 0);
  for (const f of fs.readdirSync(a).sort()) {
    assert.equal(
      fs.readFileSync(path.join(a, f), "utf8"),
      fs.readFileSync(path.join(b, f), "utf8"),
      `${f} differs between runs`
    );
  }
});
