// Tests for the Struktura layout in layout.mjs: the cycle-breaking walk and
// the layering it feeds. Run with `npm test` (node --test).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  breakCycles, layoutStructure, objectBoxH, NODE_W, NODE_H, SGAP_X, INST_H, INST_GAP,
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
