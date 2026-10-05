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
  // Morphisms are never listed in index.md; each sits with the object it
  // leaves (an instance with the object it exemplifies).
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
// under their object instead. The first four say which way a construction
// "reads" — from a structure to what you take from it — so the cycle walk
// follows them first and reverses the others when it must.
export const EDGE_KINDS = ["data", "extract", "property", "transform", "construction", "generalizes"];
const KIND_RANK = Object.fromEntries(EDGE_KINDS.map((k, i) => [k, i]));
const isForward = (kind) => KIND_RANK[kind] <= KIND_RANK.transform;

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
