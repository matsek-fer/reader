// Tests for the view's filter engine in filter.mjs: every predicate, every
// combinator, how several keys in one object bind, what happens to an
// expression nobody can read, and the `about` bridge in both directions.
// Run with `npm test` (node --test).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGraph, evaluate, parseExpr, describeExpr, problemText, chipsFor, vocabulary,
  PREDICATES, ARROW_KINDS,
} from "./filter.mjs";

// A vault in miniature, shaped like the Monsky one: a valuation kind defined by
// a diagram over a field and an ordered group, three instances of the field,
// one map between two of them, and trees pointing at the structure with
// `about`. Regions are set on the boxes, not on the arrows, so the region rule
// for an arrow drawn inside one area is exercised.
const NODES = {
  "obj-valuation": { taxon: "object", title: "A valuation", region: "valuations" },
  "obj-field": { taxon: "object", title: "A field" },
  "obj-ordered-group": { taxon: "object", title: "An ordered abelian group" },
  "obj-nat": { taxon: "object", title: "The naturals" },
  "obj-a-field": { taxon: "object", title: "A field K", region: "valuations" },
  "obj-k-prime": { taxon: "object", title: "An extension K'", region: "valuations" },
  "obj-gamma": { taxon: "object", title: "The value group", region: "valuations" },
  "obj-reals": { taxon: "object", title: "The reals", region: "colouring" },
  "mor-v": { taxon: "morphism", title: "The valuation map" },
  "mor-embed": { taxon: "morphism", title: "The embedding" },
  "mor-value-group": { taxon: "morphism", title: "Its value group" },
  "mor-forget": { taxon: "morphism", title: "Forget the valuation" },
  "mor-units": { taxon: "morphism", title: "The units index" },
  "thm-chevalley": { taxon: "theorem", title: "Chevalley's theorem", about: ["obj-valuation", "mor-value-group"] },
  "lem-sperner": { taxon: "lemma", title: "Sperner's lemma", about: ["obj-nat"] },
  "prf-chevalley": { taxon: "proof", title: "Proof of Chevalley" },
  "def-valuation": { taxon: "definition", title: "Valuation, defined", region: "valuations" },
  "exm-two-adic": { taxon: "example", title: "The 2-adic valuation" },
};
const STRUCTURE = {
  regions: [
    { id: "valuations", title: "Valuations and their instances" },
    { id: "colouring", title: "From the valuation to the colouring" },
  ],
  objects: [
    { id: "obj-valuation", level: "kind", region: "valuations", data: ["obj-a-field", "obj-gamma", "mor-v"] },
    { id: "obj-field", level: "kind" },
    { id: "obj-ordered-group", level: "kind" },
    { id: "obj-nat", level: "kind" },
    { id: "obj-a-field", level: "instance", of: "obj-field", region: "valuations" },
    { id: "obj-k-prime", level: "instance", of: "obj-field", region: "valuations" },
    { id: "obj-gamma", level: "instance", of: "obj-ordered-group", region: "valuations" },
    { id: "obj-reals", level: "instance", of: "obj-field", region: "colouring" },
  ],
  arrows: [
    { id: "mor-v", kind: "hom", from: "obj-a-field", to: "obj-gamma" },
    { id: "mor-embed", kind: "hom", from: "obj-a-field", to: "obj-k-prime" },
    { id: "mor-value-group", kind: "data", from: "obj-valuation", to: "obj-ordered-group" },
    { id: "mor-forget", kind: "generalizes", from: "obj-valuation", to: "obj-field" },
    { id: "mor-units", kind: "property", from: "obj-field", to: "obj-nat" },
  ],
};
const G = buildGraph({ nodes: NODES, structure: STRUCTURE });

// Every assertion below is on the whole matched set, sorted: a predicate that
// quietly picks up one extra id is the failure mode worth catching.
function hit(expr, graph) {
  const r = evaluate(expr, graph || G);
  return Object.keys(r.ids).sort();
}

test("the graph is read off the page's two blobs, levels and kinds included", () => {
  assert.equal(G.ids.length, Object.keys(NODES).length);
  assert.deepEqual(G.levels, ["kind", "instance"]);
  assert.deepEqual(G.arrowKinds, ["data", "property", "generalizes", "hom"]);
  assert.deepEqual(G.regions.map((r) => r.id), ["valuations", "colouring"]);
  assert.equal(G.objects.length, 8);
  assert.equal(G.arrows.length, 5);
  assert.equal(G.trees.length, 5);
});

// The chip the owner wanted when he said "categories": one level's boxes AND
// the arrows between them — the relationships between the structures — with the
// named instances and the maps between those left out.
test("level: a level is its boxes and the arrows whose two ends sit on it", () => {
  assert.deepEqual(hit({ level: "kind" }), [
    "mor-forget", "mor-units", "mor-value-group",
    "obj-field", "obj-nat", "obj-ordered-group", "obj-valuation",
  ]);
  assert.deepEqual(hit({ level: "instance" }),
    ["mor-embed", "mor-v", "obj-a-field", "obj-gamma", "obj-k-prime", "obj-reals"]);
  const r = evaluate({ level: "kind" }, G);
  assert.deepEqual(r.count, { objects: 4, arrows: 3, trees: 0, total: 7 });
  // No tree is on a level, and the two levels never share a node.
  const kinds = hit({ level: "kind" }), insts = hit({ level: "instance" });
  assert.deepEqual(kinds.filter((id) => insts.indexOf(id) >= 0), []);
  assert.deepEqual(hit({ and: [{ level: "kind" }, { taxon: "theorem" }] }), []);
});

test("kind-of: the instances of one kind, and nothing of another", () => {
  assert.deepEqual(hit({ "kind-of": "obj-field" }),
    ["obj-a-field", "obj-k-prime", "obj-reals"]);
  assert.deepEqual(hit({ "kind-of": "obj-ordered-group" }), ["obj-gamma"]);
  // A kind with no instances is not itself one.
  assert.deepEqual(hit({ "kind-of": "obj-nat" }), []);
});

test("arrow-kind: one kind of arrow, never a box", () => {
  assert.deepEqual(hit({ "arrow-kind": "hom" }), ["mor-embed", "mor-v"]);
  assert.deepEqual(hit({ "arrow-kind": "data" }), ["mor-value-group"]);
  assert.deepEqual(hit({ "arrow-kind": "construction" }), []);
});

test("tied-to a kind: its arrows, its diagram, and the arrows inside the set", () => {
  // obj-field has three instances; mor-embed joins two of them, so it is tied
  // to the kind even though neither of its ends IS the kind.
  assert.deepEqual(hit({ "tied-to": "obj-field" }), [
    "mor-embed", "mor-forget", "mor-units",
    "obj-a-field", "obj-field", "obj-k-prime", "obj-reals",
  ]);
  // The valuation's own neighbourhood: its defining diagram plus the two
  // arrows out of it. mor-embed stays out — obj-k-prime is not in the set.
  assert.deepEqual(hit({ "tied-to": "obj-valuation" }), [
    "mor-forget", "mor-v", "mor-value-group",
    "obj-a-field", "obj-gamma", "obj-valuation",
  ]);
});

test("tied-to an instance reaches its kind; tied-to an arrow is the arrow and its ends", () => {
  assert.deepEqual(hit({ "tied-to": "obj-reals" }), ["obj-field", "obj-reals"]);
  assert.deepEqual(hit({ "tied-to": "mor-v" }), ["mor-v", "obj-a-field", "obj-gamma"]);
});

test("in-data-of: one kind's defining diagram, the kind with it", () => {
  assert.deepEqual(hit({ "in-data-of": "obj-valuation" }),
    ["mor-v", "obj-a-field", "obj-gamma", "obj-valuation"]);
  // A primitive kind keeps only itself, and says why.
  const r = evaluate({ "in-data-of": "obj-field" }, G);
  assert.deepEqual(Object.keys(r.ids), ["obj-field"]);
  assert.equal(r.fatal, false);
  assert.deepEqual(r.problems.map((p) => p.code), ["no-data"]);
});

test("region: boxes and trees that say so, plus an arrow drawn wholly inside", () => {
  assert.deepEqual(hit({ region: "valuations" }), [
    "def-valuation", "mor-embed", "mor-v",
    "obj-a-field", "obj-gamma", "obj-k-prime", "obj-valuation",
  ]);
  // mor-value-group leaves the region (obj-ordered-group has none), so it is
  // not swept in by its ends.
  assert.ok(hit({ region: "valuations" }).indexOf("mor-value-group") < 0);
  assert.deepEqual(hit({ region: "colouring" }), ["obj-reals"]);
  assert.deepEqual(hit({ region: "nema-takvog" }), []);
});

test("about, forwards: from a tree to the structure it concerns", () => {
  assert.deepEqual(hit({ about: "thm-chevalley" }),
    ["mor-value-group", "obj-valuation", "thm-chevalley"]);
  assert.deepEqual(hit({ about: "lem-sperner" }), ["lem-sperner", "obj-nat"]);
});

test("about, backwards: from an object or arrow to the trees that name it", () => {
  assert.deepEqual(hit({ about: "obj-valuation" }), ["obj-valuation", "thm-chevalley"]);
  assert.deepEqual(hit({ about: "mor-value-group" }), ["mor-value-group", "thm-chevalley"]);
  assert.deepEqual(hit({ about: "obj-nat" }), ["lem-sperner", "obj-nat"]);
  // A tree nobody is about and that is about nothing keeps only itself.
  assert.deepEqual(hit({ about: "prf-chevalley" }), ["prf-chevalley"]);
});

test("taxon, id and text", () => {
  assert.deepEqual(hit({ taxon: "theorem" }), ["thm-chevalley"]);
  assert.deepEqual(hit({ taxon: "object" }).length, 8);
  assert.deepEqual(hit({ id: "obj-reals" }), ["obj-reals"]);
  // text reads the id and the title, case-blind.
  assert.deepEqual(hit({ text: "SPERNER" }), ["lem-sperner"]);
  assert.deepEqual(hit({ text: "valuation" }).includes("def-valuation"), true);
  assert.deepEqual(hit({ text: "field K" }), ["obj-a-field"]);
});

test("and, or, not", () => {
  assert.deepEqual(hit({ and: [{ level: "instance" }, { "kind-of": "obj-field" }] }),
    ["obj-a-field", "obj-k-prime", "obj-reals"]);
  assert.deepEqual(hit({ or: [{ taxon: "theorem" }, { taxon: "lemma" }] }),
    ["lem-sperner", "thm-chevalley"]);
  assert.deepEqual(hit({ and: [{ "arrow-kind": "hom" }, { not: { region: "valuations" } }] }), []);
  assert.deepEqual(hit({ and: [{ level: "instance" }, { not: { region: "valuations" } }] }), ["obj-reals"]);
  // An empty conjunction is the identity, an empty disjunction the empty set.
  assert.equal(hit({ and: [] }).length, G.ids.length);
  assert.deepEqual(hit({ or: [] }), []);
});

test("precedence: several keys in one object are their conjunction, and bind tighter", () => {
  const short = { level: "instance", "kind-of": "obj-field" };
  assert.deepEqual(hit(short), hit({ and: [{ level: "instance" }, { "kind-of": "obj-field" }] }));
  // {A, B} inside an `or` stays one branch: (instance AND of-field) OR theorem.
  assert.deepEqual(hit({ or: [short, { taxon: "theorem" }] }),
    ["obj-a-field", "obj-k-prime", "obj-reals", "thm-chevalley"]);
  // Nesting is what decides, and the two nestings differ.
  const a = { and: [{ or: [{ taxon: "theorem" }, { taxon: "lemma" }] }, { about: "obj-nat" }] };
  const b = { or: [{ taxon: "theorem" }, { and: [{ taxon: "lemma" }, { about: "obj-nat" }] }] };
  assert.deepEqual(hit(a), ["lem-sperner"]);
  assert.deepEqual(hit(b), ["lem-sperner", "thm-chevalley"]);
  // A bare array is a conjunction too.
  assert.deepEqual(hit([{ level: "instance" }, { region: "colouring" }]), ["obj-reals"]);
});

test("an expression nobody can read is refused, not half-applied", () => {
  const r = evaluate({ frobnicate: "obj-field" }, G);
  assert.equal(r.fatal, true);
  assert.deepEqual(Object.keys(r.ids), []);
  assert.deepEqual(r.problems.map((p) => p.code), ["unknown-predicate"]);
  assert.match(problemText(r.problems[0]), /nepoznat predikat/);
  // A good predicate beside a bad one does not rescue the expression: the
  // page leaves the view alone rather than showing a half-truth.
  const mixed = evaluate({ and: [{ level: "kind" }, { frobnicate: "x" }] }, G);
  assert.equal(mixed.fatal, true);
  assert.deepEqual(Object.keys(mixed.ids), []);
  for (const bad of [null, 42, "obj-field", true]) {
    assert.equal(evaluate(bad, G).fatal, true, JSON.stringify(bad) + " is not an expression");
  }
  assert.equal(evaluate({}, G).fatal, true);
  assert.equal(evaluate({ and: { level: "kind" } }, G).fatal, true);
  assert.equal(evaluate({ level: 3 }, G).fatal, true);
});

test("a value outside a closed set is refused; an unknown id only noted", () => {
  const bad = evaluate({ level: "instanca" }, G);
  assert.equal(bad.fatal, true);
  assert.deepEqual(bad.problems.map((p) => p.code), ["bad-value"]);
  assert.equal(evaluate({ "arrow-kind": "hom-ish" }, G).fatal, true);
  assert.equal(evaluate({ taxon: "strelica" }, G).fatal, true);
  // A typo'd id is a filter that matches nothing, and says which id it was.
  const miss = evaluate({ "tied-to": "obj-nope" }, G);
  assert.equal(miss.fatal, false);
  assert.deepEqual(Object.keys(miss.ids), []);
  assert.deepEqual(miss.problems.map((p) => p.code), ["unknown-id"]);
  assert.match(problemText(miss.problems[0]), /obj-nope/);
  assert.equal(evaluate({ about: "obj-nope" }, G).problems[0].code, "unknown-id");
  assert.equal(evaluate({ "kind-of": "obj-nope" }, G).problems[0].code, "unknown-id");
});

test("nesting has a floor, so a cyclic or absurd expression cannot hang the page", () => {
  let deep = { level: "kind" };
  for (let i = 0; i < 40; i++) deep = { not: deep };
  const r = evaluate(deep, G);
  assert.equal(r.fatal, true);
  assert.deepEqual(r.problems.map((p) => p.code).slice(-1), ["too-deep"]);
});

test("parseExpr reads the text box and the URL hash, and complains in Croatian", () => {
  assert.deepEqual(parseExpr('{"level":"kind"}').expr, { level: "kind" });
  assert.deepEqual(parseExpr("  ").problems.map((p) => p.code), ["empty"]);
  const bad = parseExpr("{level: kind}");
  assert.equal(bad.expr, null);
  assert.equal(bad.problems[0].code, "bad-json");
  assert.match(problemText(bad.problems[0]), /neispravan JSON/);
});

test("a 0.1 vault has no structure half, and nothing breaks", () => {
  const flat = buildGraph({
    nodes: {
      "thm-a": { taxon: "theorem", title: "A" },
      "prf-a": { taxon: "proof", title: "Proof of A" },
    },
  });
  assert.deepEqual(flat.objects, []);
  assert.deepEqual(flat.arrowKinds, []);
  assert.deepEqual(flat.regions, []);
  // The structure predicates answer honestly instead of throwing.
  assert.deepEqual(hit({ level: "kind" }, flat), []);
  assert.deepEqual(hit({ "arrow-kind": "hom" }, flat), []);
  assert.deepEqual(hit({ region: "valuations" }, flat), []);
  assert.deepEqual(hit({ about: "thm-a" }, flat), ["thm-a"]);
  // The predicates that do not need a structure layer still work.
  assert.deepEqual(hit({ taxon: "proof" }, flat), ["prf-a"]);
  assert.deepEqual(hit({ text: "proof of" }, flat), ["prf-a"]);
  assert.deepEqual(chipsFor(flat).map((c) => c.group), ["taksoni", "taksoni"]);
});

test("a 0.2 vault's typed object answers as the instance it became in 0.3", () => {
  const g = buildGraph({
    nodes: {
      "obj-k": { taxon: "object", title: "A field" },
      "obj-k2": { taxon: "object", title: "A second field" },
      "mor-f": { taxon: "morphism", title: "A homomorphism" },
      "mor-ex": { taxon: "morphism", title: "An example" },
    },
    structure: {
      objects: [{ id: "obj-k" }, { id: "obj-k2", type: "obj-k" }],
      arrows: [
        { id: "mor-f", kind: "hom", from: "obj-k", to: "obj-k2" },
        { id: "mor-ex", kind: "instance", from: "pt", to: "obj-k" },
      ],
    },
  });
  assert.deepEqual(hit({ level: "instance" }, g), ["obj-k2"]);
  assert.deepEqual(hit({ "kind-of": "obj-k" }, g), ["obj-k2"]);
  // `pt` is no tree, so an instance arrow's missing end swallows nothing.
  assert.deepEqual(hit({ "tied-to": "mor-ex" }, g), ["mor-ex", "obj-k"]);
  assert.deepEqual(hit({ "arrow-kind": "instance" }, g), ["mor-ex"]);
});

test("the chips are built from the vault's own data", () => {
  const chips = chipsFor(G, { kinds: { hom: "morfizam", data: "podaci" }, taxa: { theorem: "teorem" } });
  const byId = {};
  chips.forEach((c) => { byId[c.id] = c; });
  assert.deepEqual(byId["level-kind"].expr, { level: "kind" });
  assert.equal(byId["level-kind"].label, "strukture i odnosi među njima");
  assert.equal(byId["level-instance"].label, "primjeri i preslikavanja među njima");
  assert.deepEqual(byId["only-hom"].expr, { "arrow-kind": "hom" });
  assert.equal(byId["region-valuations"].label, "Valuations and their instances");
  assert.equal(byId["kind-hom"].label, "morfizam");
  assert.equal(byId["taxon-theorem"].label, "teorem");
  // No chip for an arrow kind the vault does not use.
  assert.equal(byId["kind-construction"], undefined);
  // Every chip is a filter that parses and evaluates.
  for (const c of chips) assert.equal(evaluate(c.expr, G).fatal, false, c.id);
});

test("describe() hands an outside caller the grammar and this vault's vocabulary", () => {
  const v = vocabulary(G);
  assert.deepEqual(v.predicates.map((p) => p.name), PREDICATES.map((p) => p.name));
  assert.deepEqual(v.counts, { objects: 8, arrows: 5, trees: 5, total: 18 });
  assert.deepEqual(v.arrowKinds, G.arrowKinds);
  assert.ok(ARROW_KINDS.indexOf(v.arrows[0].kind) >= 0);
  const val = v.objects.filter((o) => o.id === "obj-valuation")[0];
  assert.deepEqual(val, { id: "obj-valuation", title: "A valuation", level: "kind", of: null, region: "valuations" });
});

test("describeExpr says the filter back in Croatian, with titles not ids", () => {
  assert.equal(describeExpr({ level: "kind" }, G), "vrste struktura i odnosi među njima");
  assert.equal(describeExpr({ "kind-of": "obj-field" }, G), "primjeri vrste A field");
  assert.equal(describeExpr({ region: "valuations" }, G), "područje Valuations and their instances");
  assert.equal(describeExpr({ about: "thm-chevalley" }, G), "oko Chevalley's theorem (preko about)");
  assert.equal(describeExpr({ not: { "arrow-kind": "hom" } }, G), "ne strelice vrste hom");
  assert.equal(
    describeExpr({ or: [{ level: "kind" }, { and: [{ taxon: "theorem" }, { text: "x" }] }] }, G),
    "vrste struktura i odnosi među njima ili takson theorem i tekst „x”"
  );
});
