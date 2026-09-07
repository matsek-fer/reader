// Tests for validate-forest.mjs — run with `npm test` (node --test).
// The reference mini-vault must pass clean; each crafted fixture under
// scripts/test-fixtures/ must fail on its one expected diagnostic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const cli = path.join(here, "validate-forest.mjs");
const miniVault = path.join(repoRoot, "examples", "mini-vault");
// The registry lives in the sibling library checkout; the concepts test
// skips rather than fails when this machine does not have it.
const registry = path.resolve(
  repoRoot,
  "..",
  "library",
  "concepts",
  "concepts.yaml"
);

function run(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

test("mini-vault passes clean", () => {
  const { status, out } = run([miniVault]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(!out.includes("warning:"), out);
});

test("mini-vault passes clean against the concept registry", (t) => {
  if (!existsSync(registry)) {
    t.skip(`registry not found at ${registry}`);
    return;
  }
  const { status, out } = run([miniVault, "--concepts", registry]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(!out.includes("warning:"), out);
});

const fixtures = [
  ["cycle", "depends cycle"],
  ["orphan-proof", "must depend on exactly one statement tree"],
  ["bad-taxon", "invalid taxon"],
  ["unresolved-depend", 'depends on unknown tree "def-nema"'],
  ["derivative-no-pages", "source.pages is required in a derivative vault"],
];

for (const [name, expected] of fixtures) {
  test(`fixture ${name} fails on "${expected}"`, () => {
    const { status, out } = run([
      path.join(here, "test-fixtures", name),
    ]);
    assert.equal(status, 1, out);
    assert.ok(out.includes(`error: `), out);
    assert.ok(out.includes(expected), out);
  });
}

test("unknown concept id is an error, and only a warning under --lenient", (t) => {
  if (!existsSync(registry)) {
    t.skip(`registry not found at ${registry}`);
    return;
  }
  const vault = path.join(here, "test-fixtures", "unknown-concept");
  const strict = run([vault, "--concepts", registry]);
  assert.equal(strict.status, 1, strict.out);
  assert.ok(
    strict.out.includes('error: trees/def-alfa.md: teaches id "koncept-koji-ne-postoji" not in the concept registry'),
    strict.out
  );
  const lenient = run([vault, "--concepts", registry, "--lenient"]);
  assert.equal(lenient.status, 0, lenient.out);
  assert.ok(lenient.out.includes("warning:"), lenient.out);
  // Without --concepts the registry check is off entirely.
  const off = run([vault]);
  assert.equal(off.status, 0, off.out);
});

test('fixture broken-wikilink fails on "does not resolve"', () => {
  const { status, out } = run(["scripts/test-fixtures/broken-wikilink"]);
  assert.notEqual(status, 0);
  assert.match(out, /does not resolve/);
});

test('fixture missing-views fails on "views are part of the format"', () => {
  const { status, out } = run(["scripts/test-fixtures/missing-views"]);
  assert.notEqual(status, 0);
  assert.match(out, /views are part of the format/);
});

test("share-alike derivative vault with the SA notice passes clean", () => {
  const { status, out } = run(["scripts/test-fixtures/share-alike"]);
  assert.equal(status, 0, out);
});

