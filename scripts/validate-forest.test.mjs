// Tests for validate-forest.mjs — run with `npm test` (node --test).
// The reference mini-vault must pass with no errors; each crafted fixture
// under scripts/test-fixtures/ must fail on its one expected diagnostic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

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

// The mini-vault is forest-0.3 and leaves its foundational kinds (obj-nat,
// obj-perm-rep, ...) without invented examples or generalizations, so the two
// coverage warnings are expected there; any other warning is a fault.
const COVERAGE_WARNING = /^\s*warning: trees\/obj-[\w-]+\.md: object has no (instance|generalizes)\b/;
function unexpectedWarnings(out) {
  return out.split("\n").filter((l) => l.includes("warning:") && !COVERAGE_WARNING.test(l));
}

test("mini-vault passes with no errors and only coverage warnings", () => {
  const { status, out } = run([miniVault]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.deepEqual(unexpectedWarnings(out), [], out);
});

test("mini-vault passes against the concept registry", (t) => {
  if (!existsSync(registry)) {
    t.skip(`registry not found at ${registry}`);
    return;
  }
  const { status, out } = run([miniVault, "--concepts", registry]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.deepEqual(unexpectedWarnings(out), [], out);
});

const fixtures = [
  ["cycle", "depends cycle"],
  ["orphan-proof", "must depend on exactly one statement tree"],
  ["bad-taxon", "invalid taxon"],
  ["unresolved-depend", 'depends on unknown tree "def-nema"'],
  ["derivative-no-pages", "source.pages is required in a derivative vault"],
  // origin enum: only digest/member/agent name an author of a tree.
  ["bad-origin", 'origin must be "digest", "member" or "agent"'],
  // A member/agent tree is not from the source, so claiming source pages is
  // a confused provenance claim — the vault-side stray-adapted_from.
  ["origin-with-pages", 'must not carry source.pages'],
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

// forest-0.2, the structure layer. structure-ok-0.2 is the reference 0.2
// vault, frozen: the 0.2 fixtures below are it plus one mutation each, and it
// must keep passing untouched while 0.3 moves on.
test("fixture structure-ok-0.2 (forest-0.2) passes clean", () => {
  const { status, out } = run(["scripts/test-fixtures/structure-ok-0.2"]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(!out.includes("warning:"), out);
});

const fmOf = (fixture, id) => {
  const text = readFileSync(path.join(here, "test-fixtures", fixture, "trees", `${id}.md`), "utf8");
  return yaml.load(/^---\n([\s\S]*?)\n---/.exec(text)[1]);
};

// The clean pass above only means something for 0.2's own keys if the vault
// really carries them: a typed object without its own hom, a hom between two
// boxes of one type, a hom loop, invertible, up_to, and an instance arrow out
// of `pt` with values — all of which 0.3 replaces and 0.2 must keep.
test("fixture structure-ok-0.2 exercises typed objects, pt instances, hom arrows and loops", () => {
  const fm = (id) => fmOf("structure-ok-0.2", id);
  const typed = fm("obj-druga-grupa");
  assert.equal(typed.type, "obj-grupa");
  assert.equal(typed.hom, undefined);
  const between = fm("mor-homomorfizam");
  assert.deepEqual([between.kind, between.from, between.to], ["hom", "obj-grupa", "obj-druga-grupa"]);
  const loop = fm("mor-konjugacija");
  assert.deepEqual([loop.kind, loop.from, loop.to, loop.invertible], ["hom", "obj-grupa", "obj-grupa", true]);
  const dual = fm("mor-dual");
  assert.deepEqual([dual.inverse, dual.up_to], ["mor-dual", "thm-dvostruki-dual"]);
  const inst = fm("mor-z6");
  assert.deepEqual([inst.kind, inst.from, inst.to], ["instance", "pt", "obj-grupa"]);
  assert.equal(inst.values["mor-nosac"], "skup $\\{0,1,\\dots,5\\}$");
  assert.deepEqual(fm("thm-svaki-skup-nosi-grupu").assumes, ["axiom-of-choice"]);
});

// forest-0.3, the two levels. structure-ok is the reference 0.3 vault; every
// failing 0.3 fixture is structure-ok plus one changed or added file, so each
// must fail on exactly one error, and that error must name the file.
test("fixture structure-ok (forest-0.3) passes clean", () => {
  const { status, out } = run(["scripts/test-fixtures/structure-ok"]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(!out.includes("warning:"), out);
});

test("fixture structure-ok exercises instance_of, defining diagrams, values on an instance, region and pos", () => {
  const fm = (id) => fmOf("structure-ok", id);
  // A kind: a hom sentence, a defining diagram over instances of other kinds,
  // an authored position and a region.
  const kind = fm("obj-grupa");
  assert.equal(kind.instance_of, undefined);
  assert.ok(kind.hom);
  assert.deepEqual(kind.data, ["obj-nosivi-skup", "mor-operacija"]);
  assert.deepEqual(kind.pos, [320, 0]);
  assert.equal(kind.region, "strukture");
  // The diagram's own pieces: an instance of another kind, and an arrow whose
  // ends are both in the diagram.
  assert.equal(fm("obj-nosivi-skup").instance_of, "obj-skup");
  const component = fm("mor-operacija");
  assert.deepEqual([component.kind, component.from, component.to], ["hom", "obj-nosivi-skup", "obj-nosivi-skup"]);
  // An instance: no hom of its own, and values keyed by arrows out of its kind.
  const z6 = fm("obj-z6");
  assert.equal(z6.instance_of, "obj-grupa");
  assert.equal(z6.hom, undefined);
  assert.deepEqual(Object.keys(z6.values), ["mor-nosac", "mor-grupa-je-monoid", "mor-op"]);
  assert.equal(z6.pos, undefined);
  // A hom between two instances of one kind, and a hom loop on one instance.
  const between = fm("mor-homomorfizam");
  assert.deepEqual([between.kind, between.from, between.to], ["hom", "obj-prva-grupa", "obj-druga-grupa"]);
  const loop = fm("mor-konjugacija");
  assert.deepEqual([loop.from, loop.to, loop.invertible], ["obj-prva-grupa", "obj-prva-grupa", true]);
  // Constructions still run between kinds, and up_to/assumes are unchanged.
  const nosac = fm("mor-nosac");
  assert.deepEqual([nosac.kind, nosac.from, nosac.to], ["data", "obj-grupa", "obj-skup"]);
  assert.deepEqual([fm("mor-dual").inverse, fm("mor-dual").up_to], ["mor-dual", "thm-dvostruki-dual"]);
  assert.deepEqual(fm("thm-svaki-skup-nosi-grupu").assumes, ["axiom-of-choice"]);
});

// The mini-vault is where the two-level model is exercised on real content;
// one shape matters enough to pin here, because every later vault copies it:
// a kind defined by a diagram whose component arrow joins instances of two
// DIFFERENT kinds (a group and a set), which is legal exactly because the
// kind's `data` lists it.
test("mini-vault defines a kind by a diagram over instances of two kinds", () => {
  const fm = (id) => {
    const text = readFileSync(path.join(miniVault, "trees", `${id}.md`), "utf8");
    return yaml.load(/^---\n([\s\S]*?)\n---/.exec(text)[1]);
  };
  const action = fm("obj-group-action");
  assert.equal(action.instance_of, undefined);
  assert.deepEqual(action.data, ["obj-acting-group", "obj-acted-set", "mor-rho"]);
  assert.equal(fm("obj-acting-group").instance_of, "obj-group");
  assert.equal(fm("obj-acted-set").instance_of, "obj-set");
  const rho = fm("mor-rho");
  assert.deepEqual([rho.kind, rho.from, rho.to], ["hom", "obj-acting-group", "obj-acted-set"]);
  // And the necklaces are now an instance object carrying the work's numbers.
  const necklaces = fm("obj-ogrlice-z6");
  assert.equal(necklaces.instance_of, "obj-group-action");
  assert.equal(necklaces.values["mor-orbit-count"], "$14$");
});

// forest-0.2 fixtures: structure-ok-0.2 plus one mutation each.
const structureFixtures = [
  ["bad-kind", "trees/mor-op.md: kind must be one of data, transform, extract, property, instance, generalizes, construction, hom"],
  ["instance-not-pt", 'trees/mor-z6.md: from must be "pt" on an instance arrow'],
  ["pt-not-instance", 'trees/mor-konacan-je-skup.md: from is "pt" but kind is "generalizes"'],
  ["acts-on-not-data", 'trees/mor-partitivni-skup-grupe.md: acts_on entry "mor-op" has kind "transform"'],
  ["acts-on-wrong-source", 'trees/mor-partitivni-skup-grupe.md: acts_on entry "mor-monoid-nosac" is an arrow out of "obj-monoid"'],
  ["values-wrong-source", 'trees/mor-z6.md: values key "mor-monoid-nosac" is an arrow out of "obj-monoid"'],
  ["values-on-non-instance", "trees/mor-op.md: values is only allowed on an instance arrow"],
  ["inverse-asymmetric", 'trees/mor-op.md: inverse "mor-nosac" does not point back'],
  ["dollar-in-statement", "trees/mor-nosac.md: statement must be LaTeX without $ delimiters"],
  ["generalizes-not-functorial", "trees/mor-grupa-je-monoid.md: a generalizes arrow must be functorial: true"],
  ["about-unresolved", 'trees/thm-nosac-je-skup.md: about names unknown tree "obj-prsten"'],
  // Typed objects: a second box of a kind names that kind's own box, one level deep.
  ["type-not-object", 'trees/obj-druga-grupa.md: type "def-grupa" must name an object (obj-) tree in this vault'],
  ["type-chain", 'trees/obj-treca-grupa.md: type "obj-druga-grupa" is itself typed'],
  // kind hom: a map inside one kind, so both ends share a type and the keys
  // that describe a construction's effect on maps are refused.
  ["hom-different-types", 'trees/mor-homomorfizam.md: a hom arrow joins two objects of one type, but from "obj-grupa" is of type "obj-grupa" and to "obj-monoid" of type "obj-monoid"'],
  ["hom-with-functorial", "trees/mor-homomorfizam.md: functorial is not allowed on a hom arrow"],
  ["invertible-on-non-hom", "trees/mor-op.md: invertible is only allowed on a hom arrow"],
  ["up-to-without-inverse", "trees/mor-dual.md: up_to needs inverse"],
  ["up-to-unresolved", 'trees/mor-dual.md: up_to "thm-nema" must name a tree in this vault'],
  ["assumes-not-kebab", "trees/thm-svaki-skup-nosi-grupu.md: assumes must be an array of kebab-case tokens"],
];

// forest-0.3 fixtures: structure-ok plus one changed or added file each. One
// per rule of the two-level model, in the order docs/forest-format.md states
// them — the level of an object, the level of each end of an arrow, the
// defining diagram, values, the removals, region and pos.
const twoLevelFixtures = [
  ["instance-of-not-object", 'trees/obj-druga-grupa.md: instance_of "def-grupa" must name an object (obj-) tree in this vault'],
  ["instance-of-chain", 'trees/obj-treca-grupa.md: instance_of "obj-druga-grupa" is itself an instance'],
  ["hom-on-kind", 'trees/mor-konjugacija.md: to "obj-grupa" is a kind — a hom joins two instances'],
  // The whole message, because the kind that anchors a cross-kind hom has to
  // be a third one: that clause is what keeps `data` from legalising an
  // arbitrary arrow between two named instances.
  ["hom-different-kinds", 'trees/mor-homomorfizam.md: a hom joins two instances of one kind, but from "obj-prva-grupa" is an instance of "obj-grupa" and to "obj-rijeci" of "obj-monoid" — an arrow between instances of different kinds is a component of a definition, so list it in the data of the kind it defines, which is a third kind, neither "obj-grupa" nor "obj-monoid"'],
  ["construction-on-instance", 'trees/mor-grupa-je-monoid.md: to "obj-rijeci" is an instance (instance_of: obj-monoid) — a generalizes arrow runs between kinds'],
  ["data-unresolved", 'trees/obj-grupa.md: data names unknown tree "mor-nema"'],
  ["data-entry-not-instance", 'trees/obj-grupa.md: data entry "obj-skup" is a kind'],
  ["data-entry-own-instance", 'trees/obj-grupa.md: data entry "obj-prva-grupa" is an instance of this very kind'],
  ["data-arrow-end-outside", 'trees/obj-monoid.md: data entry "mor-homomorfizam" has to "obj-druga-grupa" outside the diagram'],
  ["data-entry-wrong-taxon", 'trees/obj-grupa.md: data entry "def-grupa" is a definition, not an object or a morphism'],
  // A component may be determined by another component of the same diagram —
  // the vertex set of the dissection the diagram already names — but an
  // `about` reaching an instance outside it is a link of a proof's chain, and
  // a named object a proof builds is part of no definition.
  ["data-about-outside-diagram", 'trees/obj-grupa.md: data entry "obj-nosivi-skup" is about instance "obj-z6", which this diagram does not contain (see trees/obj-nosivi-skup.md: about)'],
  ["values-on-kind", "trees/obj-skup.md: values belongs to an instance"],
  ["values-wrong-kind", 'trees/obj-z6.md: values key "mor-monoid-nosac" is an arrow out of "obj-monoid", not out of this instance\'s kind "obj-grupa"'],
  ["values-on-arrow", "trees/mor-op.md: values moved onto the instance object in forest-0.3"],
  ["type-removed", "trees/obj-druga-grupa.md: type was replaced by instance_of in forest-0.3"],
  ["kind-instance-removed", 'trees/mor-op.md: kind "instance" was removed in forest-0.3'],
  ["pt-removed", 'trees/mor-konacan-je-skup.md: from "pt" was removed in forest-0.3'],
  ["region-not-kebab", "trees/obj-grupa.md: region must be a kebab-case token"],
  ["pos-not-pair", "trees/obj-grupa.md: pos must be [x, y]"],
  ["regions-duplicate-id", 'forest.json: regions[1].id "strukture" is declared twice'],
];

for (const [name, expected] of [...structureFixtures, ...twoLevelFixtures]) {
  test(`fixture ${name} fails on exactly "${expected}"`, () => {
    const { status, out } = run([path.join(here, "test-fixtures", name)]);
    assert.equal(status, 1, out);
    assert.ok(out.includes(`error: ${expected}`), out);
    assert.ok(out.includes("1 error(s)"), out);
  });
}

test("fixture structure-warnings-03: an uncovered kind warns three times and still passes", () => {
  const { status, out } = run(["scripts/test-fixtures/structure-warnings-03"]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(out.includes("warning: trees/obj-prsten.md: object has no instance (an obj- tree with instance_of: obj-prsten)"), out);
  assert.ok(out.includes("warning: trees/obj-prsten.md: object has no generalizes arrow in either direction"), out);
  assert.ok(out.includes('warning: trees/obj-prsten.md: object body has no "## Definicija" / "## Definition" heading'), out);
  assert.ok(out.includes("3 warning(s)"), out);
});

// A 0.2 vault is a 0.3 vault with one level: the two-level keys are errors
// there, so a vault gains them only by changing schema_version.
test("fixture two-level-in-0.2-vault rejects instance_of, data, region and pos", () => {
  const { status, out } = run(["scripts/test-fixtures/two-level-in-0.2-vault"]);
  assert.equal(status, 1, out);
  for (const key of ["instance_of", "data", "region", "pos"]) {
    assert.ok(out.includes(`error: trees/obj-druga-grupa.md: unknown key "${key}"`), out);
  }
  assert.ok(out.includes("4 error(s)"), out);
});

test("fixture regions-in-0.2-vault rejects forest.json regions", () => {
  const { status, out } = run(["scripts/test-fixtures/regions-in-0.2-vault"]);
  assert.equal(status, 1, out);
  assert.ok(out.includes('error: forest.json: unknown key "regions"'), out);
  assert.ok(out.includes("1 error(s)"), out);
});

test("fixture inverse-wrong-ends: a pair whose ends do not swap fails on both sides", () => {
  // Both arrows are wrong, so both complain: inverse is symmetric, and
  // without this rule the views fold the loop into the other edge and it
  // disappears from the picture.
  const { status, out } = run(["scripts/test-fixtures/inverse-wrong-ends"]);
  assert.equal(status, 1, out);
  assert.ok(out.includes('error: trees/mor-dual.md: inverse "mor-homomorfizam" must run the other way'), out);
  assert.ok(out.includes('error: trees/mor-homomorfizam.md: inverse "mor-dual" must run the other way'), out);
  assert.ok(out.includes("2 error(s)"), out);
});

test("fixture hom-inverse-not-invertible: an inverse contradicts invertible: false", () => {
  const { status, out } = run(["scripts/test-fixtures/hom-inverse-not-invertible"]);
  assert.equal(status, 1, out);
  assert.ok(out.includes("error: trees/mor-konjugacija.md: a hom with an inverse cannot be invertible: false"), out);
  assert.ok(out.includes("1 error(s)"), out);
});

test("fixture structure-warnings: an uncovered object warns three times and still passes", () => {
  const { status, out } = run(["scripts/test-fixtures/structure-warnings"]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
  assert.ok(out.includes("warning: trees/obj-prsten.md: object has no instance arrow"), out);
  assert.ok(out.includes("warning: trees/obj-prsten.md: object has no generalizes arrow in either direction"), out);
  assert.ok(out.includes('warning: trees/obj-prsten.md: object body has no "## Definicija" / "## Definition" heading'), out);
  assert.ok(out.includes("3 warning(s)"), out);
});

// A 0.1 vault is a 0.2 vault with no structure layer: the taxon and every
// structure key are errors there, so nothing migrates by accident.
test("fixture structure-in-0.1-vault rejects the taxon and the keys", () => {
  const { status, out } = run(["scripts/test-fixtures/structure-in-0.1-vault"]);
  assert.equal(status, 1, out);
  assert.ok(out.includes('error: trees/obj-alfa.md: taxon "object" (id prefix "obj-") needs forest.json schema_version "forest-0.2"'), out);
  assert.ok(out.includes('error: trees/obj-alfa.md: unknown key "symbol"'), out);
  assert.ok(out.includes('error: trees/obj-alfa.md: unknown key "hom"'), out);
  assert.ok(out.includes('error: trees/def-alfa.md: unknown key "about"'), out);
  assert.ok(out.includes('error: trees/def-alfa.md: unknown key "assumes"'), out);
});

test("share-alike derivative vault with the SA notice passes clean", () => {
  // Also covers origin defaults: def-alfa has no origin (= digest, so its
  // source.pages is required and present) and rem-vlastita-biljeska is
  // origin: agent, valid in a derivative vault precisely without pages.
  const { status, out } = run(["scripts/test-fixtures/share-alike"]);
  assert.equal(status, 0, out);
  assert.ok(!out.includes("error:"), out);
});

