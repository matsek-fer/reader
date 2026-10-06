// layout.mjs — everything build-views.mjs computes about WHERE a tree goes:
// index.md sections into groups, transitive reduction of the depends DAG,
// and the layered left-to-right placement of one group. Pure functions over
// the parsed vault; nothing here touches the filesystem or HTML.
//
// Deterministic by construction: stable sorts everywhere.

export const PROVABLE = new Set(["theorem", "lemma", "proposition", "corollary"]);

// Card geometry (shared by layout and rendering).
export const NODE_W = 176;
export const NODE_H = 56;
export const PRF_W = 150;
export const PRF_H = 30;
export const GAP_X = 72;
export const GAP_Y = 16;
export const PAD = 16;
export const HEADER_H = 34;
export const COLLAPSED_W = 380;

// Sections become groups; proofs follow their statement's group; everything
// else unlisted goes to "Ostalo".
export function buildGroups(sections, trees) {
  const groups = [];
  const grouped = new Set();
  for (const s of sections) {
    const members = [];
    for (const id of s.links) {
      if (trees.has(id) && !grouped.has(id)) {
        members.push(id);
        grouped.add(id);
      }
    }
    if (members.length) groups.push({ title: s.title, members });
  }
  const groupOf = new Map();
  groups.forEach((g, i) => g.members.forEach((id) => groupOf.set(id, i)));

  // Attach each proof to its statement's group.
  for (const id of [...trees.keys()].sort()) {
    const t = trees.get(id);
    if (t.fm.taxon !== "proof" || grouped.has(id)) continue;
    // Prefer the group of the statement it proves, so the folded proof can
    // unfold beneath that statement; fall back to any grouped dependency.
    const deps = t.fm.depends ?? [];
    const stmt =
      (t.fm.proves && groupOf.has(t.fm.proves) ? t.fm.proves : undefined) ??
      deps.find(
        (d) => PROVABLE.has(trees.get(d)?.fm.taxon) && groupOf.has(d)
      ) ?? deps.find((d) => groupOf.has(d));
    if (stmt !== undefined) {
      groups[groupOf.get(stmt)].members.push(id);
      grouped.add(id);
      groupOf.set(id, groupOf.get(stmt));
    }
  }
  // index.md lists the kinds; an instance sits with the kind it is an
  // instance of, and is settled before the arrows because an arrow may leave
  // an instance and then wants the group the instance has just been given.
  for (const id of [...trees.keys()].sort()) {
    const t = trees.get(id);
    if (t.fm.taxon !== "object" || grouped.has(id)) continue;
    const kind = t.fm.instance_of;
    if (typeof kind === "string" && groupOf.has(kind)) {
      groups[groupOf.get(kind)].members.push(id);
      grouped.add(id);
      groupOf.set(id, groupOf.get(kind));
    }
  }
  // Morphisms are never listed in index.md; each sits with the object it
  // leaves (a 0.2 instance arrow with the object it exemplifies).
  for (const id of [...trees.keys()].sort()) {
    const t = trees.get(id);
    if (t.fm.taxon !== "morphism" || grouped.has(id)) continue;
    const anchor = t.fm.kind === "instance" ? t.fm.to : t.fm.from;
    if (groupOf.has(anchor)) {
      groups[groupOf.get(anchor)].members.push(id);
      grouped.add(id);
      groupOf.set(id, groupOf.get(anchor));
    }
  }
  const rest = [...trees.keys()].filter((id) => !grouped.has(id)).sort();
  if (rest.length) groups.push({ title: "Ostalo", members: rest });
  groups.forEach((g, i) => {
    g.id = i;
    g.members.forEach((id) => groupOf.set(id, i));
  });
  return Object.assign(groups, { groupOf });
}

// ------------------------------------------------------- transitive reduction

// Kill every edge implied by a longer path. For a DAG the transitive
// reduction is unique: keep u->v iff no successor w of u (w != v) still
// reaches v. O(E·(V+E)) — vaults are dozens of trees, not millions.
export function transitiveReduction(ids, edges) {
  const out = new Map(ids.map((id) => [id, new Set()]));
  for (const [u, v] of edges) out.get(u).add(v);
  return edges.filter(([u, v]) => {
    for (const w of out.get(u)) {
      if (w !== v && reaches(out, w, v)) return false;
    }
    return true;
  });
}

function reaches(adj, from, to) {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const n = stack.pop();
    if (n === to) return true;
    for (const m of adj.get(n) ?? []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------- DAG layout

// Layered layout of one group's internal subgraph, left to right:
// column = longest path from the group's local roots, order within a column
// settled by four barycenter passes, then plain grid coordinates. Proofs are
// not layered — each sits directly under its statement when shown.
export function layoutGroup(memberIds, trees, edges, proofsOf, { showExr, showPrf }) {
  const base = memberIds.filter((id) => {
    const tx = trees.get(id).fm.taxon;
    if (tx === "proof") return false;
    if (tx === "exercise" && !showExr) return false;
    return true;
  });
  const inGroup = new Set(base);
  const intra = edges.filter(([u, v]) => inGroup.has(u) && inGroup.has(v));
  const preds = new Map(base.map((id) => [id, []]));
  const succs = new Map(base.map((id) => [id, []]));
  for (const [u, v] of intra) {
    preds.get(v).push(u);
    succs.get(u).push(v);
  }

  // Longest path from roots via topological order (the graph is a DAG —
  // the validator guarantees it).
  const depth = new Map(base.map((id) => [id, 0]));
  const indeg = new Map(base.map((id) => [id, preds.get(id).length]));
  const queue = base.filter((id) => indeg.get(id) === 0);
  const topo = [];
  while (queue.length) {
    queue.sort();
    const n = queue.shift();
    topo.push(n);
    for (const m of succs.get(n)) {
      depth.set(m, Math.max(depth.get(m), depth.get(n) + 1));
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }

  const nCols = base.length ? Math.max(...[...depth.values()]) + 1 : 0;
  let cols = Array.from({ length: nCols }, () => []);
  for (const id of base) cols[depth.get(id)].push(id);
  // Preserve index.md order inside a column before the sweeps: the digester's
  // reading order is the best tiebreak the layout will get.
  const rank = new Map(memberIds.map((id, i) => [id, i]));
  for (const c of cols) c.sort((a, b) => rank.get(a) - rank.get(b));

  // Four barycenter sweeps: down, up, down, up.
  const pos = new Map();
  const setPos = () =>
    cols.forEach((c) => c.forEach((id, i) => pos.set(id, i)));
  setPos();
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    const order = down
      ? [...cols.keys()].slice(1)
      : [...cols.keys()].slice(0, -1).reverse();
    for (const ci of order) {
      const neigh = down ? preds : succs;
      cols[ci] = cols[ci]
        .map((id, i) => {
          const ns = neigh.get(id).filter((n) => pos.has(n));
          const bary = ns.length
            ? ns.reduce((s, n) => s + pos.get(n), 0) / ns.length
            : i;
          return { id, bary, i };
        })
        .sort((a, b) => a.bary - b.bary || a.i - b.i)
        .map((x) => x.id);
      setPos();
    }
  }

  // Coordinates. Proofs slot in right below their statement, inside the
  // same column, so revealing them never collides with a neighbour card.
  const posXY = {};
  let maxColH = 0;
  const colHeights = cols.map((col) => {
    let h = 0;
    for (const id of col) {
      h += NODE_H + GAP_Y;
      if (showPrf) h += (proofsOf.get(id)?.length ?? 0) * (PRF_H + 8);
    }
    h = Math.max(0, h - GAP_Y);
    maxColH = Math.max(maxColH, h);
    return h;
  });
  cols.forEach((col, ci) => {
    let y = (maxColH - colHeights[ci]) / 2;
    for (const id of col) {
      posXY[id] = [ci * (NODE_W + GAP_X), y];
      y += NODE_H;
      if (showPrf) {
        for (const p of proofsOf.get(id) ?? []) {
          y += 8;
          posXY[p] = [ci * (NODE_W + GAP_X) + (NODE_W - PRF_W), y];
          y += PRF_H;
        }
      }
      y += GAP_Y;
    }
  });
  const w = nCols ? nCols * NODE_W + (nCols - 1) * GAP_X : 0;
  return { w, h: maxColH, pos: posXY };
}

// ----------------------------------------------------------- structure graph

// Arrow kinds that become edges of the Struktura tab; instances are listed
// under their object instead. The first five say which way an arrow "reads"
// — a construction from a structure to what you take from it, a hom from its
// source to its target — so the cycle walk follows them first and reverses
// the others when it must. An arrow from a box to itself is drawn as a loop
// and takes no part in the layering.
export const EDGE_KINDS = ["data", "extract", "property", "transform", "hom", "construction", "generalizes"];
const KIND_RANK = Object.fromEntries(EDGE_KINDS.map((k, i) => [k, i]));
const isForward = (kind) => KIND_RANK[kind] <= KIND_RANK.hom;

// Instance chips hang under their object's box.
export const INST_H = 22;
export const INST_GAP = 4;
export const SGAP_X = 170;
export const SGAP_Y = 44;

export function objectBoxH(nInstances) {
  return NODE_H + nInstances * (INST_H + INST_GAP);
}

// Arrows may form cycles (curry/uncurry) and a left-to-right drawing needs
// a direction, so the walk below decides one: a depth-first search that
// treats any arrow closing a loop as if it pointed the other way, for
// layering only — the arrow's data and the drawn head are untouched. The
// search starts at sources, then at the node with the most forward
// arrows leaving it, and leaves a node along forward kinds first, so the
// arrows it reverses are the ones that run against the grain.
export function breakCycles(objectIds, arrows) {
  const ids = [...objectIds].sort();
  const inSet = new Set(ids);
  const edges = arrows
    .filter((a) => EDGE_KINDS.includes(a.kind) && inSet.has(a.from) && inSet.has(a.to) && a.from !== a.to)
    .sort((a, b) => a.id.localeCompare(b.id));
  const out = new Map(ids.map((id) => [id, []]));
  const indeg = new Map(ids.map((id) => [id, 0]));
  const score = new Map(ids.map((id) => [id, 0]));
  for (const e of edges) {
    out.get(e.from).push(e);
    indeg.set(e.to, indeg.get(e.to) + 1);
    if (isForward(e.kind)) {
      score.set(e.from, score.get(e.from) + 1);
      score.set(e.to, score.get(e.to) - 1);
    }
  }
  const edgeOrder = (a, b) =>
    KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.to.localeCompare(b.to) || a.id.localeCompare(b.id);
  for (const list of out.values()) list.sort(edgeOrder);
  const starts = [...ids].sort((a, b) =>
    (indeg.get(a) === 0 ? 0 : 1) - (indeg.get(b) === 0 ? 0 : 1) ||
    score.get(b) - score.get(a) || a.localeCompare(b));

  const state = new Map();
  const reversed = new Set();
  const visit = (u) => {
    state.set(u, "open");
    for (const e of out.get(u)) {
      const s = state.get(e.to);
      if (s === "open") reversed.add(e.id);
      else if (!s) visit(e.to);
    }
    state.set(u, "done");
  };
  for (const s of starts) if (!state.has(s)) visit(s);
  const dag = edges.map((e) => reversed.has(e.id) ? [e.to, e.from] : [e.from, e.to]);
  return { ids, edges, reversed, dag };
}

// Objects are boxes, placed like one group of the Redoslijed tab: column =
// longest path from a source once the cycles are broken, rows within a
// column settled by four barycenter sweeps. `rank` (index.md order) breaks
// ties inside a column; `instances` gives each box the height of its chips.
export function layoutStructure(objectIds, arrows, { rank = new Map(), instances = {} } = {}) {
  const { ids, edges, reversed, dag } = breakCycles(objectIds, arrows);
  const preds = new Map(ids.map((id) => [id, []]));
  const succs = new Map(ids.map((id) => [id, []]));
  for (const [u, v] of dag) {
    preds.get(v).push(u);
    succs.get(u).push(v);
  }
  const depth = new Map(ids.map((id) => [id, 0]));
  const indeg = new Map(ids.map((id) => [id, preds.get(id).length]));
  const queue = ids.filter((id) => indeg.get(id) === 0);
  while (queue.length) {
    queue.sort();
    const n = queue.shift();
    for (const m of succs.get(n)) {
      depth.set(m, Math.max(depth.get(m), depth.get(n) + 1));
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  const nCols = ids.length ? Math.max(...depth.values()) + 1 : 0;
  const cols = Array.from({ length: nCols }, () => []);
  for (const id of ids) cols[depth.get(id)].push(id);
  const r = (id) => (rank.has(id) ? rank.get(id) : Infinity);
  for (const c of cols) c.sort((a, b) => r(a) - r(b) || a.localeCompare(b));

  const pos = new Map();
  const setPos = () => cols.forEach((c) => c.forEach((id, i) => pos.set(id, i)));
  setPos();
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    const order = down ? [...cols.keys()].slice(1) : [...cols.keys()].slice(0, -1).reverse();
    for (const ci of order) {
      const neigh = down ? preds : succs;
      cols[ci] = cols[ci]
        .map((id, i) => {
          const ns = neigh.get(id);
          const bary = ns.length ? ns.reduce((s, n) => s + pos.get(n), 0) / ns.length : i;
          return { id, bary, i };
        })
        .sort((a, b) => a.bary - b.bary || a.i - b.i)
        .map((x) => x.id);
      setPos();
    }
  }

  const boxH = (id) => objectBoxH(instances[id] ?? 0);
  const colHeights = cols.map((col) =>
    col.reduce((h, id) => h + boxH(id) + SGAP_Y, 0) - (col.length ? SGAP_Y : 0));
  const maxColH = Math.max(0, ...colHeights);
  const posXY = {};
  cols.forEach((col, ci) => {
    let y = (maxColH - colHeights[ci]) / 2;
    for (const id of col) {
      posXY[id] = { x: ci * (NODE_W + SGAP_X), y };
      y += boxH(id) + SGAP_Y;
    }
  });
  const layer = {};
  for (const id of ids) layer[id] = depth.get(id);
  return {
    pos: posXY,
    layer,
    reversed: [...reversed].sort(),
    edges: edges.map((e) => e.id),
    w: nCols ? nCols * NODE_W + (nCols - 1) * SGAP_X : 0,
    h: maxColH,
  };
}

// ------------------------------------------- structure graph: the 0.3 plane

// An instance box is smaller than a kind's: the size is half of what tells
// the reader which level a box sits on.
export const INST_BOX_W = 148;
export const INST_BOX_H = 42;

// A region is a labelled area: its title strip, the margin its boxes keep
// inside it, and the gap to the next region. Regions are shelved left to
// right and wrapped, so a vault of several subgraphs reads as a plane.
export const REG_TITLE_H = 30;
export const REG_PAD = 30;
export const REG_GAP = 60;
// Wide enough that seven regions of this vault's size shelve three across:
// a landscape canvas reads on a landscape screen, and it puts three regions
// within one pan of each other instead of two.
export const SHELF_W = 2100;

function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distance from a point to a segment, with the unit normal pointing from the
// segment to the point — what a push away from an arrow needs.
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  const cx = ax + t * dx, cy = ay + t * dy;
  const d = Math.hypot(px - cx, py - cy);
  return { d, nx: d ? (px - cx) / d : 0, ny: d ? (py - cy) / d : -1 };
}

// Does the segment touch the rectangle? Liang–Barsky: the segment's parameter
// window against the four slabs. This is the exact test the drawn picture is
// judged by — a straight arrow is clean only when no third box is on it.
export function segHitsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const slab = (dir, lo, hi) => {
    if (dir === 0) return lo <= 0 && hi >= 0;
    const a = lo / dir, b = hi / dir;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
    return t0 <= t1;
  };
  if (!slab(dx, r.x - p[0], r.x + r.w - p[0])) return false;
  if (!slab(dy, r.y - p[1], r.y + r.h - p[1])) return false;
  return t0 <= t1;
}

// Where a straight arrow between two box centres leaves its source box: the
// same geometry the page draws, so the layout can count its own crossings.
export function edgePoint(box, from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  let t = 1;
  if (dx) {
    const tx = (dx > 0 ? box.x + box.w - from[0] : box.x - from[0]) / dx;
    if (tx >= 0) t = Math.min(t, tx);
  }
  if (dy) {
    const ty = (dy > 0 ? box.y + box.h - from[1] : box.y - from[1]) / dy;
    if (ty >= 0) t = Math.min(t, ty);
  }
  return [from[0] + dx * t, from[1] + dy * t];
}

// One region's own plane. Boxes the author placed by hand stay exactly where
// `pos` puts them; the rest are seeded on a grid and then settled by a force
// walk — springs along the arrows of this region, rectangle repulsion between
// boxes, and a push of every box off the arrows that are not its own, which is
// what keeps a straight arrow from running through a third box. The walk is
// seeded from the region's id and runs a fixed number of steps, so a rebuild
// draws the same picture.
function placeRegion(regionId, memberIds, edges, { pos, dim, rank }) {
  const ITER = 420, SEP = 80, STEP_MAX = 26;
  const inRegion = new Set(memberIds);
  const intra = edges.filter((e) => inRegion.has(e.from) && inRegion.has(e.to));
  const r = (id) => (rank.has(id) ? rank.get(id) : Infinity);
  const free = memberIds.filter((id) => !pos[id]).sort((a, b) => r(a) - r(b) || a.localeCompare(b));
  const P = new Map();
  for (const id of memberIds) if (pos[id]) P.set(id, { x: pos[id][0], y: pos[id][1] });

  const rnd = mulberry32(hash32(regionId || "·"));
  const cols = Math.max(1, Math.ceil(Math.sqrt(free.length)));
  const cellX = NODE_W + 120, cellY = NODE_H + 110;
  free.forEach((id, i) => {
    P.set(id, {
      x: (i % cols) * cellX + (rnd() - 0.5) * 50,
      y: Math.floor(i / cols) * cellY + (rnd() - 0.5) * 50,
    });
  });

  const w = (id) => dim(id)[0], h = (id) => dim(id)[1];
  const cx = (id) => P.get(id).x + w(id) / 2;
  const cy = (id) => P.get(id).y + h(id) / 2;
  // Two boxes keep this much air between them; an arrow keeps half of it from
  // a box it does not end at.
  const AIR = 34;

  const pairPush = (F, strength) => {
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const a = memberIds[i], b = memberIds[j];
        const ox = (w(a) + w(b)) / 2 + AIR - Math.abs(cx(a) - cx(b));
        const oy = (h(a) + h(b)) / 2 + AIR - Math.abs(cy(a) - cy(b));
        if (ox <= 0 || oy <= 0) continue;
        // Push along the axis that needs the shorter move, as two cards on a
        // table slide apart the near way.
        const sx = cx(a) <= cx(b) ? -1 : 1, sy = cy(a) <= cy(b) ? -1 : 1;
        if (ox * h(a) < oy * w(a)) {
          F.x[a] += sx * ox * strength; F.x[b] -= sx * ox * strength;
        } else {
          F.y[a] += sy * oy * strength; F.y[b] -= sy * oy * strength;
        }
      }
    }
  };

  // Every box is pushed off every arrow that is not its own: this, and nothing
  // in the drawing, is what keeps a straight arrow clear of a third box.
  const edgePush = (F, strength) => {
    for (const e of intra) {
      const ax = cx(e.from), ay = cy(e.from), bx = cx(e.to), by = cy(e.to);
      for (const v of memberIds) {
        if (v === e.from || v === e.to) continue;
        const clear = Math.max(w(v), h(v)) / 2 + AIR / 2;
        const s = segDist(cx(v), cy(v), ax, ay, bx, by);
        if (s.d >= clear) continue;
        const f = (clear - s.d) * strength;
        F.x[v] += s.nx * f; F.y[v] += s.ny * f;
        // The arrow gives way too, a quarter as much from each end.
        F.x[e.from] -= s.nx * f * 0.25; F.y[e.from] -= s.ny * f * 0.25;
        F.x[e.to] -= s.nx * f * 0.25; F.y[e.to] -= s.ny * f * 0.25;
      }
    }
  };

  const zero = () => ({
    x: Object.fromEntries(memberIds.map((id) => [id, 0])),
    y: Object.fromEntries(memberIds.map((id) => [id, 0])),
  });
  const apply = (F, scale) => {
    for (const id of free) {
      const p = P.get(id);
      p.x = Math.max(0, p.x + Math.max(-STEP_MAX, Math.min(STEP_MAX, F.x[id] * scale)));
      p.y = Math.max(0, p.y + Math.max(-STEP_MAX, Math.min(STEP_MAX, F.y[id] * scale)));
    }
  };

  // A region the author placed by hand has nothing for the walk to settle.
  for (let it = 0; free.length && it < ITER; it++) {
    const cool = 1 - it / ITER;
    const F = zero();
    for (const e of intra) {
      const dx = cx(e.to) - cx(e.from), dy = cy(e.to) - cy(e.from);
      const d = Math.hypot(dx, dy) || 1;
      const want = (w(e.from) + w(e.to)) / 2 + 110;
      const f = 0.035 * (d - want);
      F.x[e.from] += (dx / d) * f; F.y[e.from] += (dy / d) * f;
      F.x[e.to] -= (dx / d) * f; F.y[e.to] -= (dy / d) * f;
    }
    pairPush(F, 0.5);
    edgePush(F, 0.6);
    if (free.length) {
      let gx = 0, gy = 0;
      for (const id of memberIds) { gx += cx(id); gy += cy(id); }
      gx /= memberIds.length; gy /= memberIds.length;
      for (const id of free) {
        F.x[id] += (gx - cx(id)) * 0.012;
        F.y[id] += (gy - cy(id)) * 0.012;
      }
    }
    apply(F, cool);
  }
  for (let it = 0; free.length && it < SEP; it++) {
    const F = zero();
    pairPush(F, 1);
    if (it < SEP / 2) edgePush(F, 0.5);
    apply(F, 1);
  }

  for (const id of memberIds) {
    const p = P.get(id);
    p.x = Math.round(p.x); p.y = Math.round(p.y);
  }
  // A region with no hand-laid box has no origin to respect, so it closes the
  // slack the walk left on its top and left; one with an authored box keeps
  // its frame, since `pos` is read against the frame's corner.
  if (!memberIds.some((id) => pos[id])) {
    const dx = Math.min(...memberIds.map((id) => P.get(id).x));
    const dy = Math.min(...memberIds.map((id) => P.get(id).y));
    for (const id of memberIds) { P.get(id).x -= dx; P.get(id).y -= dy; }
  }
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const id of memberIds) {
    const p = P.get(id);
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + w(id)); maxY = Math.max(maxY, p.y + h(id));
  }
  return { P, minX, minY, w: maxX - minX, h: maxY - minY };
}

// An arrow between two regions is the one thing a per-region walk cannot see:
// its corridor runs across frames that walk never looked at, so the clearance
// it buys inside a region buys nothing across one. This is that walk once more
// over the whole plane — every arrow, every box, the same push off an arrow
// that is not a box's own — and then the frames are remeasured and reshelved,
// which moves the corridors, which is why it iterates. Only boxes the author
// left free move; a `pos` is an instruction, not a hint. No randomness here:
// the picture is the same on every rebuild.
function clearCorridors(laid, members, edges, posXY, { pos, dim, shelve }) {
  const ROUNDS = 6, WALK = 90, AIR = 34, STEP_MAX = 14;
  const regionOfBox = new Map();
  for (const r of laid) for (const id of members.get(r.id)) regionOfBox.set(id, r);
  const ids = [...regionOfBox.keys()].sort();
  const free = ids.filter((id) => !pos[id]);
  if (!free.length) return;
  const w = (id) => dim(id)[0], h = (id) => dim(id)[1];
  // Global centre of a box, read through its frame's origin: moving a box is
  // moving it in its own region, which is the space `pos` is written in.
  const cx = (id) => posXY[id].x + w(id) / 2;
  const cy = (id) => posXY[id].y + h(id) / 2;

  for (let round = 0; round < ROUNDS; round++) {
    for (let it = 0; it < WALK; it++) {
      const F = { x: Object.create(null), y: Object.create(null) };
      for (const id of free) { F.x[id] = 0; F.y[id] = 0; }
      for (const e of edges) {
        const ax = cx(e.from), ay = cy(e.from), bx = cx(e.to), by = cy(e.to);
        for (const v of free) {
          if (v === e.from || v === e.to) continue;
          const clear = Math.max(w(v), h(v)) / 2 + AIR / 2;
          const s = segDist(cx(v), cy(v), ax, ay, bx, by);
          if (s.d >= clear) continue;
          const f = clear - s.d;
          F.x[v] += s.nx * f; F.y[v] += s.ny * f;
        }
      }
      // Keeping the boxes apart, so clearing one arrow never buys an overlap.
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          if (pos[a] && pos[b]) continue;
          const ox = (w(a) + w(b)) / 2 + AIR - Math.abs(cx(a) - cx(b));
          const oy = (h(a) + h(b)) / 2 + AIR - Math.abs(cy(a) - cy(b));
          if (ox <= 0 || oy <= 0) continue;
          const sx = cx(a) <= cx(b) ? -1 : 1, sy = cy(a) <= cy(b) ? -1 : 1;
          const along = ox * h(a) < oy * w(a);
          for (const [id, sign] of [[a, 1], [b, -1]]) {
            if (pos[id]) continue;
            if (along) F.x[id] += sign * sx * ox; else F.y[id] += sign * sy * oy;
          }
        }
      }
      let moved = 0;
      for (const id of free) {
        const dx = Math.max(-STEP_MAX, Math.min(STEP_MAX, F.x[id] * 0.6));
        const dy = Math.max(-STEP_MAX, Math.min(STEP_MAX, F.y[id] * 0.6));
        if (!dx && !dy) continue;
        posXY[id].x += dx; posXY[id].y += dy;
        moved += Math.abs(dx) + Math.abs(dy);
      }
      if (moved < 1) break;
    }
    // Write the walk back into each region's own coordinates, then reshelve:
    // the frames grow to hold what moved, and the corridors move with them.
    for (const r of laid) {
      for (const id of members.get(r.id)) {
        r.P.get(id).x = Math.round(posXY[id].x - r.origin[0]);
        r.P.get(id).y = Math.round(posXY[id].y - r.origin[1]);
      }
    }
    shelve();
  }
}

// The 0.3 structure canvas: one plane per region, the regions shelved in the
// order forest.json declares them (undeclared ones after, the unassigned last).
// `pos` is read — and written back by the page — in the coordinates of the
// box's own region, so a region that grows above does not move the hand-laid
// boxes below it.
export function layoutStructure2D(objectIds, arrows, opts = {}) {
  const {
    regions = [], regionOf = {}, pos = {}, size = {}, rank = new Map(),
    shelfWidth = SHELF_W,
  } = opts;
  const ids = [...objectIds].sort();
  const inSet = new Set(ids);
  const edges = arrows
    .filter((a) => EDGE_KINDS.includes(a.kind) && inSet.has(a.from) && inSet.has(a.to) && a.from !== a.to)
    .sort((a, b) => a.id.localeCompare(b.id));
  const dim = (id) => size[id] ?? [NODE_W, NODE_H];

  const members = new Map();
  for (const id of ids) {
    const b = typeof regionOf[id] === "string" ? regionOf[id] : "";
    if (!members.has(b)) members.set(b, []);
    members.get(b).push(id);
  }
  const order = [];
  for (const r of regions) if (members.has(r.id)) order.push({ id: r.id, title: String(r.title ?? r.id) });
  const declared = new Set(regions.map((r) => r.id));
  for (const b of [...members.keys()].sort()) {
    if (b !== "" && !declared.has(b)) order.push({ id: b, title: b });
  }
  if (members.has("")) order.push({ id: "", title: "" });

  const laid = order.map((r) => ({
    ...r,
    ...placeRegion(r.id, members.get(r.id), edges, { pos, dim, rank }),
  }));

  // Shelve the frames into rows of at most the target width, and lay every
  // other row backwards — boustrophedon, the way a field is ploughed. Two
  // regions the vault declares one after the other are then always neighbours,
  // including across a row break, where a plain left-to-right shelf would throw
  // them to opposite ends of the canvas; an arrow between consecutive regions
  // is correspondingly short, and a short arrow has little chance of finding a
  // third box on it. Each frame is remeasured from its own boxes first, so a
  // box the clearance walk below has moved takes its region's area with it and
  // no two frames overlap.
  const posXY = {};
  const frames = [];
  const shelve = () => {
    for (const k of Object.keys(posXY)) delete posXY[k];
    frames.length = 0;
    for (const r of laid) {
      const mem = members.get(r.id);
      r.minX = Math.min(0, ...mem.map((id) => r.P.get(id).x));
      r.minY = Math.min(0, ...mem.map((id) => r.P.get(id).y));
      r.w = Math.max(...mem.map((id) => r.P.get(id).x + dim(id)[0])) - r.minX;
      r.h = Math.max(...mem.map((id) => r.P.get(id).y + dim(id)[1])) - r.minY;
      r.fw = r.w + 2 * REG_PAD;
      r.fh = r.h + 2 * REG_PAD + REG_TITLE_H;
    }
    const rows = [];
    let row = [], used = 0;
    for (const r of laid) {
      if (row.length && used + REG_GAP + r.fw > shelfWidth) { rows.push(row); row = []; used = 0; }
      row.push(r);
      used += (row.length > 1 ? REG_GAP : 0) + r.fw;
    }
    if (row.length) rows.push(row);
    let y = 0, prevRight = 0;
    rows.forEach((rw, i) => {
      const rowW = rw.reduce((s, r) => s + r.fw, 0) + (rw.length - 1) * REG_GAP;
      // A backwards row starts where the row above ended, so the turn of the
      // plough keeps the two regions at the fold side by side even when the
      // lower row is the shorter one.
      let x = i % 2 ? Math.max(0, prevRight - rowW) : 0;
      prevRight = x + rowW;
      for (const r of i % 2 ? [...rw].reverse() : rw) {
        const ox = x + REG_PAD - r.minX, oy = y + REG_TITLE_H + REG_PAD - r.minY;
        r.origin = [ox, oy];
        for (const [id, p] of r.P) posXY[id] = { x: p.x + ox, y: p.y + oy };
        frames.push({ id: r.id, title: r.title, x, y, w: r.fw, h: r.fh, origin: [ox, oy] });
        x += r.fw + REG_GAP;
      }
      y += Math.max(...rw.map((r) => r.fh)) + REG_GAP;
    });
  };
  shelve();
  clearCorridors(laid, members, edges, posXY, { pos, dim, shelve });

  // Report, never bend: an arrow with a box on it is the layout's failure and
  // the page draws it straight anyway.
  const boxes = ids.map((id) => ({ id, x: posXY[id].x, y: posXY[id].y, w: dim(id)[0], h: dim(id)[1] }));
  const centre = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const blocked = [];
  for (const e of edges) {
    const A = byId.get(e.from), B = byId.get(e.to);
    const p = edgePoint(A, centre(A), centre(B)), q = edgePoint(B, centre(B), centre(A));
    const hit = boxes.filter((b) => b.id !== e.from && b.id !== e.to && segHitsRect(p, q, b)).map((b) => b.id);
    if (hit.length) blocked.push({ id: e.id, boxes: hit });
  }

  return {
    pos: posXY,
    regions: frames,
    edges: edges.map((e) => e.id),
    blocked,
    w: Math.max(0, ...frames.map((f) => f.x + f.w)),
    h: Math.max(0, ...frames.map((f) => f.y + f.h)),
  };
}
