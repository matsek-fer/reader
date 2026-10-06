// Tests for the Struktura layout in layout.mjs: the cycle-breaking walk and
// the layering it feeds. Run with `npm test` (node --test).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breakCycles, layoutStructure, objectBoxH, NODE_W, NODE_H, SGAP_X, INST_H, INST_GAP,
  layoutStructure2D, buildGroups, segHitsRect, edgePoint,
  INST_BOX_W, INST_BOX_H, REG_PAD, REG_TITLE_H, REG_GAP,
} from "./layout.mjs";

const A = "obj-group-action", P = "obj-perm-rep", M = "obj-monoid-action", S = "obj-set";
const arrows = [
  { id: "mor-curry", from: A, to: P, kind: "transform" },
  { id: "mor-uncurry", from: P, to: A, kind: "transform" },
  { id: "mor-monoid-action", from: A, to: M, kind: "generalizes" },
  { id: "mor-action-set", from: A, to: S, kind: "data" },
  { id: "mor-example", from: "pt", to: A, kind: "instance" },
];

// Every kept edge must climb to a higher layer and every reversed one fall
// to a lower one, or the drawing is not left-to-right.
function assertLayered(out, edges) {
  const rev = new Set(out.reversed);
  for (const e of edges) {
    if (!out.edges.includes(e.id)) continue;
    const d = out.layer[e.to] - out.layer[e.from];
    if (rev.has(e.id)) assert.ok(d < 0, `${e.id} reversed but not descending`);
    else assert.ok(d > 0, `${e.id} kept but not ascending`);
  }
}

test("curry/uncurry: exactly one of the pair is reversed, instances are not edges", () => {
  const { reversed, edges } = breakCycles([A, P, M, S], arrows);
  const pair = ["mor-curry", "mor-uncurry"].filter((id) => reversed.has(id));
  assert.equal(pair.length, 1);
  assert.deepEqual([...reversed], pair);
  assert.ok(!edges.some((e) => e.id === "mor-example"));
});

test("layers: the action is the source, everything it feeds sits one column right", () => {
  const out = layoutStructure([A, P, M, S], arrows);
  assert.equal(out.layer[A], 0);
  assert.equal(out.layer[P], 1);
  assert.equal(out.layer[M], 1);
  assert.equal(out.layer[S], 1);
  assertLayered(out, arrows);
  assert.equal(out.pos[A].x, 0);
  assert.equal(out.pos[P].x, NODE_W + SGAP_X);
  const ys = [P, M, S].map((id) => out.pos[id].y);
  assert.equal(new Set(ys).size, 3, "three boxes in one column have three distinct rows");
  assert.equal(out.w, 2 * NODE_W + SGAP_X);
});

test("a 3-cycle is broken at the arrow that runs against the grain", () => {
  const cyc = [
    { id: "mor-a", from: "obj-a", to: "obj-b", kind: "data" },
    { id: "mor-b", from: "obj-b", to: "obj-c", kind: "construction" },
    { id: "mor-c", from: "obj-c", to: "obj-a", kind: "generalizes" },
  ];
  const out = layoutStructure(["obj-a", "obj-b", "obj-c"], cyc);
  assert.deepEqual(out.reversed, ["mor-c"]);
  assert.deepEqual([out.layer["obj-a"], out.layer["obj-b"], out.layer["obj-c"]], [0, 1, 2]);
  assertLayered(out, cyc);
});

test("layer is the longest path, not the shortest", () => {
  const chain = [
    { id: "mor-ab", from: "obj-a", to: "obj-b", kind: "data" },
    { id: "mor-bc", from: "obj-b", to: "obj-c", kind: "data" },
    { id: "mor-ac", from: "obj-a", to: "obj-c", kind: "property" },
  ];
  const out = layoutStructure(["obj-a", "obj-b", "obj-c"], chain);
  assert.equal(out.layer["obj-c"], 2);
});

test("the result does not depend on the order arrows or objects arrive in", () => {
  const a = layoutStructure([A, P, M, S], arrows);
  const b = layoutStructure([S, M, P, A], [...arrows].reverse());
  assert.deepEqual(a, b);
});

test("a box grows by one chip per instance and the column makes room", () => {
  assert.equal(objectBoxH(0), NODE_H);
  assert.equal(objectBoxH(2), NODE_H + 2 * (INST_H + INST_GAP));
  const plain = layoutStructure([A, P, M, S], arrows);
  const tall = layoutStructure([A, P, M, S], arrows, { instances: { [P]: 2 } });
  const col = [P, M, S].sort((x, y) => tall.pos[x].y - tall.pos[y].y);
  const i = col.indexOf(P);
  if (i < col.length - 1) {
    assert.equal(tall.pos[col[i + 1]].y - tall.pos[P].y, plain.pos[col[i + 1]].y - plain.pos[P].y + 2 * (INST_H + INST_GAP));
  }
  assert.equal(tall.h, plain.h + 2 * (INST_H + INST_GAP));
});

test("index.md order breaks ties inside a column", () => {
  const rank = new Map([[S, 0], [M, 1], [P, 2]]);
  const out = layoutStructure([A, P, M, S], arrows, { rank });
  const col = [P, M, S].sort((x, y) => out.pos[x].y - out.pos[y].y);
  assert.deepEqual(col, [S, M, P]);
});

test("a hom between two boxes is layered like any edge; a loop moves nothing", () => {
  const T = "obj-group-action-target";
  const more = [
    ...arrows,
    { id: "mor-equivariant-map", from: A, to: T, kind: "hom" },
    { id: "mor-act-by-element", from: S, to: S, kind: "hom" },
  ];
  const out = layoutStructure([A, P, M, S, T], more);
  assert.ok(out.edges.includes("mor-equivariant-map"));
  assert.equal(out.layer[T], out.layer[A] + 1);
  assertLayered(out, more);
  assert.ok(!out.edges.includes("mor-act-by-element"));
  assert.deepEqual(out, layoutStructure([A, P, M, S, T], more.filter((a) => a.from !== a.to)));
});

// ---------------------------------------------------- the 0.3 two-level plane

// A kind, two instances of it in a defining diagram, and the arrow between
// them — the shape every 0.3 vault is built out of.
const K = "obj-valuation", F = "obj-field", G1 = "obj-gamma", V = "mor-v";
const two = {
  objectIds: [K, F, G1, "obj-group"],
  arrows: [
    { id: V, from: F, to: G1, kind: "hom" },
    { id: "mor-value-group", from: K, to: "obj-group", kind: "data" },
  ],
  regions: [{ id: "valuation", title: "Valuacije" }, { id: "primjeri", title: "Instance" }],
  regionOf: { [K]: "valuation", "obj-group": "valuation", [F]: "primjeri", [G1]: "primjeri" },
  size: { [F]: [INST_BOX_W, INST_BOX_H], [G1]: [INST_BOX_W, INST_BOX_H] },
};
const run = (extra = {}) =>
  layoutStructure2D(two.objectIds, two.arrows, {
    regions: two.regions, regionOf: two.regionOf, size: two.size, ...extra,
  });

test("an authored position is honoured exactly, in its own region's frame", () => {
  const out = run({ pos: { [K]: [0, 0], "obj-group": [300, 120] } });
  const frame = out.regions.find((r) => r.id === "valuation");
  assert.deepEqual(out.pos[K], { x: frame.x + REG_PAD, y: frame.y + REG_TITLE_H + REG_PAD });
  assert.equal(out.pos["obj-group"].x - out.pos[K].x, 300);
  assert.equal(out.pos["obj-group"].y - out.pos[K].y, 120);
});

test("regions come in the declared order, side by side, and do not overlap", () => {
  const out = run();
  assert.deepEqual(out.regions.map((r) => r.id), ["valuation", "primjeri"]);
  const [a, b] = out.regions;
  assert.ok(a.x + a.w <= b.x || a.y + a.h <= b.y, "frames overlap");
  // Every box sits inside the frame of its own region.
  for (const id of two.objectIds) {
    const r = out.regions.find((f) => f.id === two.regionOf[id]);
    const [w, h] = two.size[id] ?? [NODE_W, NODE_H];
    assert.ok(out.pos[id].x >= r.x && out.pos[id].x + w <= r.x + r.w, `${id} outside ${r.id} in x`);
    assert.ok(out.pos[id].y >= r.y && out.pos[id].y + h <= r.y + r.h, `${id} outside ${r.id} in y`);
  }
});

test("an undeclared region follows the declared ones, the unassigned boxes last", () => {
  const out = layoutStructure2D([...two.objectIds, "obj-x", "obj-y"], two.arrows, {
    regions: two.regions, size: two.size,
    regionOf: { ...two.regionOf, "obj-x": "ostalo" },
  });
  assert.deepEqual(out.regions.map((r) => r.id), ["valuation", "primjeri", "ostalo", ""]);
  assert.equal(out.regions.find((r) => r.id === "ostalo").title, "ostalo");
  assert.equal(out.regions.find((r) => r.id === "").title, "");
});

test("the plane is seeded, not random: two runs and two input orders agree", () => {
  assert.deepEqual(run(), run());
  const flipped = layoutStructure2D([...two.objectIds].reverse(), [...two.arrows].reverse(), {
    regions: two.regions, regionOf: two.regionOf, size: two.size,
  });
  assert.deepEqual(flipped, run());
});

test("no two boxes of a region overlap, and no arrow crosses a third box", () => {
  const out = run();
  const box = (id) => {
    const [w, h] = two.size[id] ?? [NODE_W, NODE_H];
    return { id, x: out.pos[id].x, y: out.pos[id].y, w, h };
  };
  const boxes = two.objectIds.map(box);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const over = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!over, `${a.id} overlaps ${b.id}`);
    }
  }
  assert.deepEqual(out.blocked, []);
});

// Consecutive regions stay neighbours across a row break: the shelf ploughs
// back along the next row, so the region declared after the last one of a row
// sits under it instead of at the far side of the canvas.
test("every other row of frames is laid backwards", () => {
  const ids = ["obj-1", "obj-2", "obj-3", "obj-4"];
  const regions = ids.map((id, i) => ({ id: "r" + (i + 1), title: "R" + (i + 1) }));
  const regionOf = Object.fromEntries(ids.map((id, i) => [id, "r" + (i + 1)]));
  // Three frames fill the first row, so r4 opens the second one.
  const out = layoutStructure2D(ids, [], {
    regions, regionOf, shelfWidth: 3 * (NODE_W + 2 * REG_PAD) + 2 * REG_GAP,
  });
  const f = (id) => out.regions.find((r) => r.id === id);
  assert.deepEqual([f("r1").y, f("r2").y, f("r3").y], [0, 0, 0]);
  assert.ok(f("r1").x < f("r2").x && f("r2").x < f("r3").x);
  assert.ok(f("r4").y > f("r3").y, "r4 starts a second row");
  assert.equal(f("r4").x, f("r3").x, "r4 sits under r3, not at the left margin");
});

// The per-region walk never sees an arrow whose two ends are in two regions, so
// a second walk over the whole plane pushes the boxes the author left free off
// those corridors. Here the free box is seeded on the line between two pinned
// ones in the next region and has to step off it.
test("a cross-region arrow pushes a free box out of its corridor", () => {
  const arrows = [{ id: "mor-ac", from: "obj-a", to: "obj-c", kind: "data" }];
  const opts = {
    regions: [{ id: "left", title: "L" }, { id: "right", title: "R" }],
    regionOf: { "obj-a": "left", "obj-b": "right", "obj-c": "right" },
    pos: { "obj-a": [0, 0], "obj-c": [400, 0] },
  };
  const out = layoutStructure2D(["obj-a", "obj-b", "obj-c"], arrows, opts);
  assert.deepEqual(out.blocked, []);
  // The walk moved obj-b and left the two authored boxes where `pos` put them,
  // which is read against their own frame's corner.
  const right = out.regions.find((r) => r.id === "right");
  assert.deepEqual(out.pos["obj-c"], { x: right.origin[0] + 400, y: right.origin[1] });
  assert.deepEqual(out, layoutStructure2D(["obj-c", "obj-b", "obj-a"], arrows, opts), "and it is deterministic");
});

test("a box standing on an arrow is reported, never bent around", () => {
  // Three boxes pinned in a row: the middle one sits on the arrow that skips it.
  const out = layoutStructure2D(["obj-a", "obj-b", "obj-c"], [{ id: "mor-ac", from: "obj-a", to: "obj-c", kind: "data" }], {
    pos: { "obj-a": [0, 0], "obj-b": [260, 0], "obj-c": [520, 0] },
  });
  assert.deepEqual(out.blocked, [{ id: "mor-ac", boxes: ["obj-b"] }]);
});

test("the straight-arrow geometry: a border point, and the crossing test", () => {
  const b = { x: 0, y: 0, w: 100, h: 40 };
  assert.deepEqual(edgePoint(b, [50, 20], [250, 20]), [100, 20]);
  assert.deepEqual(edgePoint(b, [50, 20], [50, 220]), [50, 40]);
  assert.ok(segHitsRect([-10, 20], [110, 20], b));
  assert.ok(!segHitsRect([-10, 60], [110, 60], b));
});

// --------------------------------------------------------- groups, 0.3 rules

test("an instance joins the group of the kind it is an instance of", () => {
  const trees = new Map([
    ["obj-group", { fm: { id: "obj-group", taxon: "object" } }],
    ["obj-acting-group", { fm: { id: "obj-acting-group", taxon: "object", instance_of: "obj-group" } }],
    ["mor-rho", { fm: { id: "mor-rho", taxon: "morphism", kind: "hom", from: "obj-acting-group", to: "obj-acting-group" } }],
    ["def-group", { fm: { id: "def-group", taxon: "definition" } }],
  ]);
  const groups = buildGroups([{ title: "Struktura", links: ["obj-group"] }, { title: "Temelji", links: ["def-group"] }], trees);
  assert.equal(groups.groupOf.get("obj-acting-group"), groups.groupOf.get("obj-group"));
  assert.equal(groups.groupOf.get("mor-rho"), groups.groupOf.get("obj-group"));
  assert.ok(!groups.some((g) => g.title === "Ostalo"), "nothing is left over");
});
