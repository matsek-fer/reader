#!/usr/bin/env node
// build-views.mjs — regenerates a Forest vault's views/ from its trees.
//
// Usage: node scripts/build-views.mjs <vault-dir>
//
// Writes three files:
//   views/forest.html   self-contained interactive reading map (works from
//                       file://, no network): groups from index.md sections
//                       collapse and expand, proofs fold under their
//                       statements, exercises toggle globally, clicking a
//                       node opens the tree's full content with math
//                       pre-rendered, and every node wears one of three
//                       reading states (savladano / spremno / nije spremno)
//                       computed at runtime from the full depends lists and
//                       the reader's own marks (localStorage).
//   views/dag.md        mermaid fallback for Obsidian — one group overview
//                       plus one small per-section diagram, never one giant
//                       tangled graph.
//   views/by-concept.md the vault inverted through `teaches`.
//
// All layout is computed HERE, at build time: transitive reduction of the
// depends DAG first (used for layering only — the page draws no arrows;
// the DAG lives on as readiness logic over the FULL, unreduced depends
// lists), then longest-path layering, then four barycenter ordering
// passes, then x/y coordinates per group and per toggle state. The page's
// JavaScript only applies precomputed coordinates and stacks the group
// bands; it never lays anything out.
//
// Deterministic by construction: stable sorts everywhere, no Date.now — the
// only date in the output is forest.json's `created`.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import yaml from "js-yaml";
import katex from "katex";
import { marked } from "marked";

const require = createRequire(import.meta.url);

const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;

const TAXON_HR = {
  theorem: "teorem",
  lemma: "lema",
  proposition: "propozicija",
  corollary: "korolar",
  definition: "definicija",
  axiom: "aksiom",
  proof: "dokaz",
  example: "primjer",
  exercise: "zadatak",
  exposition: "izlaganje",
  motivation: "motivacija",
  intuition: "intuicija",
  remark: "napomena",
  connection: "poveznica",
};

// One accent per taxon family, muted enough to sit on a dark card.
const TAXON_COLOR = {
  definition: "#5b9dd9",
  axiom: "#5b9dd9",
  theorem: "#e0a458",
  lemma: "#c9a45c",
  proposition: "#c9a45c",
  corollary: "#d9b36a",
  proof: "#8a8f98",
  example: "#6fbf73",
  exercise: "#a678c8",
  exposition: "#4fb3a9",
  motivation: "#4fb3a9",
  intuition: "#4fb3a9",
  remark: "#7f9aae",
  connection: "#d97b8f",
};

const PROVABLE = new Set(["theorem", "lemma", "proposition", "corollary"]);

// Card geometry (shared by layout and rendering).
const NODE_W = 176;
const NODE_H = 56;
const PRF_W = 150;
const PRF_H = 30;
const GAP_X = 72;
const GAP_Y = 16;
const PAD = 16;
const HEADER_H = 34;
const COLLAPSED_W = 380;

function main() {
  const vaultDir = process.argv[2];
  if (!vaultDir) {
    console.error("usage: node scripts/build-views.mjs <vault-dir>");
    process.exit(2);
  }
  const vault = loadVault(vaultDir);
  const { trees, forest, sections } = vault;

  // ---- graph: depends edges, prerequisite -> dependent -------------------
  const ids = [...trees.keys()].sort();
  const rawEdges = [];
  for (const id of ids) {
    const deps = trees.get(id).fm.depends ?? [];
    for (const d of [...deps].sort()) {
      if (trees.has(d)) rawEdges.push([d, id]);
    }
  }
  const edges = transitiveReduction(ids, rawEdges);
  console.log(
    `${path.basename(path.resolve(vaultDir))}: ${ids.length} nodes, ` +
      `${rawEdges.length} edges -> ${edges.length} after transitive reduction`
  );

  // ---- groups from index.md sections ------------------------------------
  const groups = buildGroups(sections, trees);
  console.log(
    `groups: ${groups.map((g) => `${g.title} (${g.members.length})`).join(" · ")}`
  );

  const proofsOf = new Map();
  for (const id of ids) {
    const t = trees.get(id);
    if (t.fm.taxon !== "proof") continue;
    const stmt =
      (t.fm.proves && trees.has(t.fm.proves) ? t.fm.proves : undefined) ??
      (t.fm.depends ?? []).find((d) => PROVABLE.has(trees.get(d)?.fm.taxon));
    if (stmt) {
      if (!proofsOf.has(stmt)) proofsOf.set(stmt, []);
      proofsOf.get(stmt).push(id);
    }
  }
  for (const v of proofsOf.values()) v.sort();

  const viewsDir = path.join(vaultDir, "views");
  fs.mkdirSync(viewsDir, { recursive: true });

  const html = buildHtml(vaultDir, vault, ids, edges, groups, proofsOf);
  fs.writeFileSync(path.join(viewsDir, "forest.html"), html);
  console.log(
    `views/forest.html: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`
  );

  fs.writeFileSync(
    path.join(viewsDir, "dag.md"),
    buildDagMd(vault, edges, groups)
  );
  fs.writeFileSync(
    path.join(viewsDir, "by-concept.md"),
    buildByConceptMd(vault, groups, proofsOf)
  );
  console.log("views/dag.md and views/by-concept.md regenerated");
}

// --------------------------------------------------------------- vault input

function loadVault(vaultDir) {
  const forest = JSON.parse(
    fs.readFileSync(path.join(vaultDir, "forest.json"), "utf8")
  );
  const treesDir = path.join(vaultDir, "trees");
  const trees = new Map();
  for (const f of fs.readdirSync(treesDir).filter((f) => f.endsWith(".md")).sort()) {
    const text = fs.readFileSync(path.join(treesDir, f), "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) continue;
    const fm = yaml.load(m[1]);
    trees.set(f.slice(0, -3), { fm, body: m[2].trim(), file: `trees/${f}` });
  }

  const indexText = fs.readFileSync(path.join(vaultDir, "index.md"), "utf8");
  const title = (/^#\s+(.+)$/m.exec(indexText)?.[1] ?? "Forest vault").trim();
  const sections = [];
  let current = null;
  for (const line of indexText.split("\n")) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) {
      current = { title: h[1].trim(), links: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    for (const m of line.matchAll(WIKILINK)) current.links.push(m[1].trim());
  }
  return { forest, trees, sections, title, vaultDir };
}

// Sections become groups; proofs follow their statement's group; everything
// else unlisted goes to "Ostalo".
function buildGroups(sections, trees) {
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
function transitiveReduction(ids, edges) {
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
function layoutGroup(memberIds, trees, edges, proofsOf, { showExr, showPrf }) {
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

// -------------------------------------------------------------- markdown/math

function renderMath(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

// Protect math from marked, turn wikilinks into panel-opening anchors,
// then let marked do the rest and splice the KaTeX back in.
function renderBody(body, trees) {
  const chunks = [];
  const stash = (html) => {
    chunks.push(html);
    return `%%KTX${chunks.length - 1}%%`;
  };
  let text = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) =>
    stash(renderMath(tex.trim(), true))
  );
  // Inline math survives a hard line-wrap (digest bodies wrap ~72 cols) —
  // but a blank line still terminates, so an unpaired $ can't eat a paragraph.
  text = text.replace(/(^|[^\\$])\$((?:[^$\n]|\n(?!\n))+?)\$/g, (m, pre, tex) =>
    pre + stash(renderMath(tex.replace(/\n/g, " "), false))
  );
  text = text.replace(WIKILINK, (_, target, label) => {
    target = target.trim();
    const t = trees.get(target);
    const shown = label ?? (t ? target : target);
    if (!t) return escapeHtml(shown);
    return stash(
      `<a href="#" class="treelink" data-open="${escapeHtml(target)}">${escapeHtml(shown)}</a>`
    );
  });
  let html = marked.parse(text, { async: false });
  html = html.replace(/%%KTX(\d+)%%/g, (_, i) => chunks[Number(i)]);
  return html;
}

function renderTitle(title) {
  const chunks = [];
  let text = title.replace(/\$([^$]+?)\$/g, (_, tex) => {
    chunks.push(renderMath(tex, false));
    return `%%KTX${chunks.length - 1}%%`;
  });
  return escapeHtml(text).replace(/%%KTX(\d+)%%/g, (_, i) => chunks[Number(i)]);
}

// Plain-text title for SVG labels: math stripped down to its bones.
function plainTitle(title) {
  return title
    .replace(/\$\$?/g, "")
    .replace(/\\(mathbb|mathrm|mathcal|text|operatorname)\{([^}]*)\}/g, "$2")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapLabel(text, maxChars, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > maxChars) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && line && lines[maxLines - 1] !== line) {
    lines[maxLines - 1] =
      lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1)) + "…";
  }
  return lines;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// KaTeX's stylesheet with every woff2 face inlined as a data: URI (woff/ttf
// sources dropped). All twenty faces cost ~350 KB base64 — comfortably
// inside the 1.5 MB budget, so the math renders pixel-identical offline.
function katexCss() {
  const dist = path.dirname(require.resolve("katex/dist/katex.min.css"));
  let css = fs.readFileSync(path.join(dist, "katex.min.css"), "utf8");
  css = css.replace(
    /url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\)/g,
    (_, file) => {
      const b64 = fs.readFileSync(path.join(dist, "fonts", file)).toString("base64");
      return `url(data:font/woff2;base64,${b64}) format("woff2")`;
    }
  );
  // Drop the non-woff2 fallback sources; the data: woff2 always loads.
  css = css.replace(/,url\(fonts\/[^)]+\) format\("[^"]+"\)/g, "");
  return css;
}

// ----------------------------------------------------------------- forest.html

function buildHtml(vaultDir, vault, ids, edges, groups, proofsOf) {
  const { trees, forest, title } = vault;
  const absVault = path.resolve(vaultDir);
  const exrCount = ids.filter((id) => trees.get(id).fm.taxon === "exercise").length;
  const showExrDefault = exrCount <= 8;

  // Per-group layouts for all four toggle states.
  const proofsOfObj = {};
  for (const [k, v] of proofsOf) proofsOfObj[k] = v;
  const groupData = groups.map((g) => {
    const variants = {};
    for (const showExr of [false, true]) {
      for (const showPrf of [false, true]) {
        variants[`${showExr ? 1 : 0}${showPrf ? 1 : 0}`] = layoutGroup(
          g.members,
          trees,
          edges,
          proofsOf,
          { showExr, showPrf }
        );
      }
    }
    return { id: g.id, title: g.title, members: g.members, variants };
  });

  const nodeInfo = {};
  const contentHtml = {};
  // Full per-tree depends (NOT the transitively-reduced set). Readiness
  // means "every real prerequisite is savladano", and the reader may mark
  // out of order — so an edge implied by a longer path still gates.
  const depsOf = {};
  for (const id of ids) {
    const t = trees.get(id);
    depsOf[id] = (t.fm.depends ?? []).filter((d) => trees.has(d)).sort();
    nodeInfo[id] = {
      taxon: t.fm.taxon,
      language: t.fm.language,
      title: plainTitle(t.fm.title),
      group: groups.groupOf.get(id) ?? null,
    };
    const src = t.fm.source
      ? [t.fm.source.ref, t.fm.source.pages && `str. ${t.fm.source.pages}`]
          .filter(Boolean)
          .join(" · ")
      : "";
    contentHtml[id] =
      `<div class="panel-head"><span class="chip" style="--c:${TAXON_COLOR[t.fm.taxon]}">` +
      `${TAXON_HR[t.fm.taxon]}</span><h2>${renderTitle(t.fm.title)}</h2>` +
      `<div class="panel-id">${escapeHtml(id)}${src ? " · " + escapeHtml(src) : ""}</div></div>` +
      renderBody(t.body, trees) +
      `<p class="obsidian"><a href="obsidian://open?path=${encodeURIComponent(
        path.join(absVault, t.file)
      )}">Otvori u Obsidianu</a> <span class="obs-hint">· radi tek kad mapu trezora jednom otvoriš kao vault (<em>Open folder as vault</em>)</span></p>`;
  }

  // SVG bodies for every node card, emitted once; JS positions them.
  const groupSvgs = groupData
    .map((g) => {
      const nodes = g.members
        .map((id) => {
          const t = trees.get(id);
          const tx = t.fm.taxon;
          const isPrf = tx === "proof";
          const w = isPrf ? PRF_W : NODE_W;
          const h = isPrf ? PRF_H : NODE_H;
          const lines = isPrf
            ? []
            : wrapLabel(plainTitle(t.fm.title), 27, 2);
          const hasBadge = !isPrf && proofsOf.has(id);
          const idMax = hasBadge ? 21 : 27;
          const shortId = id.length > idMax ? id.slice(0, idMax - 1) + "…" : id;
          const label = isPrf
            ? `<text class="nid" x="10" y="${h / 2 + 4}">${escapeHtml(shortId)}</text>`
            : lines
                .map(
                  (l, i) =>
                    `<text class="ntitle" x="10" y="${18 + i * 14}">${escapeHtml(l)}</text>`
                )
                .join("") +
              `<text class="nid" x="10" y="${h - 8}">${escapeHtml(shortId)}</text>`;
          const badge =
            !isPrf && proofsOf.has(id)
              ? `<text class="prfbadge" data-prf="${escapeHtml(proofsOf.get(id)[0])}" x="${w - 8}" y="${h - 8}" text-anchor="end">▸ dokaz</text>`
              : "";
          return (
            `<g class="node${isPrf ? " prfnode" : ""}" data-id="${escapeHtml(id)}">` +
            `<rect width="${w}" height="${h}" rx="6" style="--c:${TAXON_COLOR[tx]}"/>` +
            `<rect class="accent" width="4" height="${h}" rx="2" style="--c:${TAXON_COLOR[tx]}"/>` +
            label +
            badge +
            `</g>`
          );
        })
        .join("\n");
      return (
        `<g class="group" id="grp-${g.id}">` +
        `<rect class="grp-box"/>` +
        `<g class="grp-header" data-g="${g.id}"><rect class="grp-hrect"/>` +
        `<text class="grp-arrow" x="12" y="${HEADER_H / 2 + 5}">▸</text>` +
        `<text class="grp-title" x="30" y="${HEADER_H / 2 + 5}">${escapeHtml(g.title)}</text>` +
        `<text class="grp-count" x="0" y="${HEADER_H / 2 + 5}">${g.members.length} stabala</text>` +
        `</g><g class="grp-content">${nodes}</g></g>`
      );
    })
    .join("\n");

  const legend = [...new Set(ids.map((id) => trees.get(id).fm.taxon))]
    .sort((a, b) => TAXON_HR[a].localeCompare(TAXON_HR[b], "hr"))
    .map(
      (tx) =>
        `<span class="lg"><i style="background:${TAXON_COLOR[tx]}"></i>${TAXON_HR[tx]}</span>`
    )
    .join("");

  // Reading-state legend — the three outlines every node can wear.
  const stateLegend =
    `<span class="lg"><i class="lgs lgs-done"></i>savladano</span>` +
    `<span class="lg"><i class="lgs lgs-ready"></i>spremno za čitanje</span>` +
    `<span class="lg"><i class="lgs lgs-not"></i>nije spremno</span>` +
    `<span class="lgsep"></span>`;

  const data = {
    vaultPath: path.resolve(vaultDir),
    language: forest.language === "en" ? "en" : "hr",
    groups: groupData.map(({ id, title, members, variants }) => ({
      id,
      title,
      members,
      variants,
    })),
    nodes: nodeInfo,
    deps: depsOf,
    proofsOf: proofsOfObj,
    geom: { NODE_W, NODE_H, PRF_W, PRF_H, HEADER_H, PAD, COLLAPSED_W },
    showExrDefault,
    exrCount,
    // Progress is runtime-only; the key ties it to this digest so two
    // vaults opened on the same machine never share marks.
    progressKey:
      "forest-progress:" +
      (forest.source?.title ?? "") +
      "|" +
      (forest.created ?? ""),
  };
  const dataJson = JSON.stringify(data).replace(/</g, "\\u003c");
  const contentJson = JSON.stringify(contentHtml).replace(/</g, "\\u003c");

  const srcLine = `${forest.source?.title ?? ""}${
    forest.source?.authors?.length ? " — " + forest.source.authors.join(", ") : ""
  }`;

  return `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${katexCss()}
:root {
  --bg: #14161a; --panel: #1a1d23; --card: #21252d; --card-hi: #2a2f3a;
  --border: #343a46; --fg: #e4e6ea; --fg-muted: #9aa1ad; --accent: #5b9dd9;
  --st-done: #6fbf73; --st-ready: #6fb1e8;
}
* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; }
body { background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; overflow: hidden; }
#topbar { position: fixed; inset: 0 0 auto 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; padding: 10px 14px; background: var(--panel); border-bottom: 1px solid var(--border); }
#topbar h1 { font-size: 15px; font-weight: 600; margin-right: 6px; white-space: nowrap; }
#topbar .sub { color: var(--fg-muted); font-size: 12px; }
#search { background: var(--card); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; width: 220px; }
#topbar label { display: flex; gap: 5px; align-items: center; color: var(--fg-muted); font-size: 13px; cursor: pointer; user-select: none; white-space: nowrap; }
#topbar button { background: var(--card); color: var(--fg-muted); border: 1px solid var(--border); border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer; }
#topbar button:hover { color: var(--fg); }
#legend { display: flex; flex-wrap: wrap; gap: 8px 12px; font-size: 12px; color: var(--fg-muted); }
#legend .lg { display: inline-flex; align-items: center; gap: 4px; }
#legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
#legend .lgs { background: var(--card); border: 2px solid var(--border); }
#legend .lgs-done { border-color: var(--st-done); background: color-mix(in srgb, var(--st-done) 12%, var(--card)); }
#legend .lgs-ready { border-color: var(--st-ready); background: color-mix(in srgb, var(--st-ready) 8%, var(--card)); }
#legend .lgs-not { opacity: 0.55; }
#legend .lgsep { width: 1px; align-self: stretch; background: var(--border); }
#canvas { position: absolute; inset: 0; cursor: grab; }
#canvas.panning { cursor: grabbing; }
svg { width: 100%; height: 100%; display: block; }
.grp-box { fill: var(--panel); stroke: var(--border); rx: 10; }
.grp-hrect { fill: transparent; cursor: pointer; }
.grp-header text { fill: var(--fg); font-size: 13px; font-weight: 600; pointer-events: none; }
.grp-header .grp-count { fill: var(--fg-muted); font-weight: 400; font-size: 12px; }
.grp-header .grp-arrow { fill: var(--fg-muted); }
.node rect:first-of-type { fill: var(--card); stroke: var(--border); }
.node { cursor: pointer; }
.node:hover rect:first-of-type { fill: var(--card-hi); }
.node .accent { fill: var(--c); stroke: none; }
.node .ntitle { fill: var(--fg); font-size: 11px; pointer-events: none; }
.node .nid { fill: var(--fg-muted); font-size: 10px; font-family: ui-monospace, monospace; pointer-events: none; }
.obs-hint { color: var(--muted, #888); font-size: .78em; }
.node .prfbadge { fill: var(--fg-muted); font-size: 10px; }
.node.st-done rect:first-of-type { stroke: var(--st-done); stroke-width: 1.6; fill: color-mix(in srgb, var(--st-done) 10%, var(--card)); }
.node.st-done:hover rect:first-of-type { fill: color-mix(in srgb, var(--st-done) 18%, var(--card)); }
.node.st-ready rect:first-of-type { stroke: var(--st-ready); stroke-width: 1.6; fill: color-mix(in srgb, var(--st-ready) 8%, var(--card)); }
.node.st-ready:hover rect:first-of-type { fill: color-mix(in srgb, var(--st-ready) 16%, var(--card)); }
.node.st-not { opacity: 0.55; }
.group.g-done .grp-box { stroke: var(--st-done); stroke-width: 1.6; }
.group.g-ready .grp-box { stroke: var(--st-ready); stroke-width: 1.6; }
.group.g-muted { opacity: 0.65; }
/* Search hit is white so it never reads as a state colour. */
.node.hit rect:first-of-type { stroke: var(--fg); stroke-width: 2; }
.node.dim { opacity: 0.18; }
.node.sel rect:first-of-type { stroke: #e0a458; stroke-width: 2; }
#panel { position: fixed; top: 0; right: 0; bottom: 0; width: min(480px, 90vw); background: var(--panel); border-left: 1px solid var(--border); padding: 18px 20px; overflow-y: auto; z-index: 20; transform: translateX(105%); transition: transform 0.15s ease; }
#panel.open { transform: none; }
#panel .panel-head h2 { font-size: 17px; margin: 6px 0 2px; }
#panel .panel-id { color: var(--fg-muted); font-size: 12px; font-family: ui-monospace, monospace; margin-bottom: 10px; }
#panel .chip { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--c) 25%, transparent); color: var(--c); border: 1px solid var(--c); }
#panel p { margin: 10px 0; }
#panel a { color: var(--accent); }
#panel .obsidian { margin-top: 18px; border-top: 1px solid var(--border); padding-top: 12px; }
#panel .katex-display { overflow-x: auto; padding: 2px 0; }
#close { position: absolute; top: 10px; right: 12px; background: none; border: none; color: var(--fg-muted); font-size: 20px; cursor: pointer; }
#close:hover { color: var(--fg); }
#footer { position: fixed; left: 12px; bottom: 8px; color: var(--fg-muted); font-size: 11px; z-index: 5; display: flex; gap: 10px; align-items: center; }
#footer button { background: none; border: none; color: var(--fg-muted); font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0; }
#footer button:hover { color: var(--fg); }
#storage-note { color: #e0a458; }
#panel-mark { margin: 12px 0 14px; }
.mark-btn { background: var(--card); color: var(--fg); border: 1px solid var(--st-ready); border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.mark-btn:hover { background: var(--card-hi); }
.mark-btn.is-done { border-color: var(--border); color: var(--fg-muted); }
.mark-state { font-size: 12px; color: var(--fg-muted); margin-bottom: 6px; }
.mark-hint { margin-top: 8px; font-size: 12px; color: #e0a458; }
.mark-prompt { margin-top: 10px; position: relative; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 10px 32px 10px 12px; font-size: 13px; }
.mark-prompt code { background: var(--bg); padding: 1px 5px; border-radius: 4px; }
.mark-prompt .mp-close { position: absolute; top: 4px; right: 6px; background: none; border: none; color: var(--fg-muted); font-size: 15px; cursor: pointer; }
.mark-prompt .mp-close:hover { color: var(--fg); }
.mp-actions { margin-top: 8px; display: flex; gap: 8px; }
.mp-actions button { background: var(--bg); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.mp-actions button:hover { background: var(--card-hi); }
</style>
</head>
<body>
<div id="topbar">
  <h1>${escapeHtml(title)}</h1>
  <span class="sub">${escapeHtml(srcLine)}</span>
  <input id="search" type="search" placeholder="Traži po naslovu ili id…">
  <label><input type="checkbox" id="tglPrf"> Prikaži dokaze</label>
  <label${exrCount ? "" : ' style="display:none"'}><input type="checkbox" id="tglExr"${showExrDefault ? " checked" : ""}> Prikaži zadatke${exrCount ? ` (${exrCount})` : ""}</label>
  <button id="expandAll">Proširi sve</button>
  <button id="collapseAll">Sažmi sve</button>
  <div id="legend">${stateLegend}${legend}</div>
</div>
<div id="canvas">
<svg id="svg">
  <g id="world"><g id="glayer">${groupSvgs}</g></g>
</svg>
</div>
<aside id="panel"><button id="close" title="Zatvori">×</button><div id="panel-body"></div></aside>
<div id="footer"><span>Generirano ${escapeHtml(forest.created ?? "")} · forest-digest · klik na grupu otvara/zatvara, klik na karticu otvara sadržaj</span><button id="resetProg">Poništi napredak</button><span id="storage-note"></span></div>
<script>window.FOREST = ${dataJson};</script>
<script>window.TREES = ${contentJson};</script>
<script>
${clientJs()}
</script>
</body>
</html>
`;
}

// The page's runtime: applies build-time coordinates, stacks group bands,
// computes the three reading states from the full depends lists and the
// reader's marks, pan/zoom, search, side panel. No layout happens here.
// Single-quoted strings only — this file lives inside a template literal.
function clientJs() {
  return String.raw`(function () {
  'use strict';
  var F = window.FOREST, G = F.geom;
  var svg = document.getElementById('svg');
  var world = document.getElementById('world');
  var expanded = {};
  F.groups.forEach(function (g, i) { expanded[g.id] = i === 0; });
  var showPrf = false;
  var showExr = F.showExrDefault;
  var selected = null;

  // Each group's frame, recomputed from the precomputed variant
  // coordinates on every toggle; nodes carry their own transforms.
  var frames = {};
  function variantKey() { return (showExr ? '1' : '0') + (showPrf ? '1' : '0'); }
  function vk(prf, exr) { return (exr ? '1' : '0') + (prf ? '1' : '0'); }

  function nodeSize(id) {
    var prf = F.nodes[id].taxon === 'proof';
    return prf ? [G.PRF_W, G.PRF_H] : [G.NODE_W, G.NODE_H];
  }

  function relayout() {
    frames = {};
    var y = 20, x = 20;
    var key = variantKey();
    F.groups.forEach(function (g) {
      var el = document.getElementById('grp-' + g.id);
      var v = g.variants[key];
      var open = expanded[g.id] && v.w > 0;
      var w = open ? v.w + 2 * G.PAD : G.COLLAPSED_W;
      var h = open ? G.HEADER_H + v.h + 2 * G.PAD : G.HEADER_H;
      frames[g.id] = { x: x, y: y, w: w, h: h, open: open };
      el.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      var box = el.querySelector('.grp-box');
      box.setAttribute('width', w); box.setAttribute('height', h);
      var hrect = el.querySelector('.grp-hrect');
      hrect.setAttribute('width', w); hrect.setAttribute('height', G.HEADER_H);
      el.querySelector('.grp-arrow').textContent = open ? '▾' : '▸';
      el.querySelector('.grp-count').setAttribute('x', w - 12);
      el.querySelector('.grp-count').setAttribute('text-anchor', 'end');
      var content = el.querySelector('.grp-content');
      content.setAttribute('transform', 'translate(' + G.PAD + ',' + (G.HEADER_H + G.PAD) + ')');
      content.style.display = open ? '' : 'none';
      content.querySelectorAll('.node').forEach(function (n) {
        var id = n.getAttribute('data-id');
        var p = v.pos[id];
        var isPrf = F.nodes[id].taxon === 'proof';
        var hidden = !p || (isPrf && !showPrf) ||
          (F.nodes[id].taxon === 'exercise' && !showExr);
        n.style.display = hidden ? 'none' : '';
        if (!hidden) {
          n.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ')');
        }
        var badge = n.querySelector('.prfbadge');
        if (badge) badge.style.display = showPrf ? 'none' : '';
      });
      y += h + 26;
    });
    applyStates();
    applySearch();
  }

  // --- reading states -----------------------------------------------------
  // savladano: the reader marked it. spremno: every id in its FULL depends
  // list is savladano (vacuously true for roots). nije spremno: otherwise.
  var done = {};
  var storageOk = true;
  function stateOf(id) {
    if (done[id]) return 'done';
    var deps = F.deps[id] || [];
    for (var i = 0; i < deps.length; i++) {
      if (!done[deps[i]]) return 'not';
    }
    return 'ready';
  }
  function loadProgress() {
    var raw = null;
    try { raw = localStorage.getItem(F.progressKey); }
    catch (e) { storageOk = false; }
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      if (p && p.v === 1 && p.done && p.done.forEach) {
        p.done.forEach(function (id) { if (F.nodes[id]) done[id] = true; });
      }
    } catch (e) { /* corrupt entry: start clean, overwritten on next save */ }
  }
  function saveProgress() {
    if (!storageOk) return;
    try {
      localStorage.setItem(F.progressKey,
        JSON.stringify({ v: 1, done: Object.keys(done).sort() }));
    } catch (e) { storageOk = false; storageNotice(); }
  }
  function storageNotice() {
    document.getElementById('storage-note').textContent =
      'Napredak se ne može trajno spremiti — vrijedi samo dok je stranica otvorena.';
  }

  function applyStates() {
    document.querySelectorAll('.node').forEach(function (n) {
      var st = stateOf(n.getAttribute('data-id'));
      n.classList.toggle('st-done', st === 'done');
      n.classList.toggle('st-ready', st === 'ready');
      n.classList.toggle('st-not', st === 'not');
    });
    F.groups.forEach(function (g) {
      var nDone = 0, anyReady = false;
      g.members.forEach(function (id) {
        var st = stateOf(id);
        if (st === 'done') nDone++;
        else if (st === 'ready') anyReady = true;
      });
      var el = document.getElementById('grp-' + g.id);
      el.querySelector('.grp-count').textContent =
        nDone + '/' + g.members.length + ' savladano';
      // The state outline belongs to the collapsed bar; an open group
      // shows its members' own outlines instead.
      var closed = frames[g.id] ? !frames[g.id].open : true;
      var allDone = g.members.length > 0 && nDone === g.members.length;
      el.classList.toggle('g-done', closed && allDone);
      el.classList.toggle('g-ready', closed && !allDone && anyReady);
      el.classList.toggle('g-muted', closed && !allDone && !anyReady);
    });
  }

  // --- interactions -------------------------------------------------------
  document.getElementById('glayer').addEventListener('click', function (ev) {
    var badge = ev.target.closest('.prfbadge');
    if (badge) {
      // "▸ dokaz" means "show me the proof": reveal proofs, open this one.
      if (!showPrf) {
        showPrf = true;
        document.getElementById('tglPrf').checked = true;
        relayout();
      }
      openPanel(badge.getAttribute('data-prf'));
      return;
    }
    var hdr = ev.target.closest('.grp-header');
    if (hdr) {
      var g = +hdr.getAttribute('data-g');
      if (!expanded[g]) {
        // Expanding a group whose current variant is empty (e.g. all
        // exercises while the exercise toggle is off) would show nothing —
        // flip the toggle that gives it content instead of a dead click.
        var grp = F.groups[g];
        if (grp.variants[variantKey()].w === 0) {
          if (!showExr && grp.variants[vk(showPrf, true)].w > 0) {
            showExr = true;
            document.getElementById('tglExr').checked = true;
          } else if (!showPrf && grp.variants[vk(true, showExr)].w > 0) {
            showPrf = true;
            document.getElementById('tglPrf').checked = true;
          }
        }
      }
      expanded[g] = !expanded[g];
      relayout();
      return;
    }
    var node = ev.target.closest('.node');
    if (node) openPanel(node.getAttribute('data-id'));
  });

  var panel = document.getElementById('panel');
  var panelBody = document.getElementById('panel-body');
  var markBox = document.createElement('div');
  markBox.id = 'panel-mark';
  function openPanel(id) {
    if (selected) {
      var prev = document.querySelector('.node.sel');
      if (prev) prev.classList.remove('sel');
    }
    selected = id;
    var el = document.querySelector('.node[data-id="' + id + '"]');
    if (el) el.classList.add('sel');
    panelBody.innerHTML = window.TREES[id] || '';
    // The mark control sits right under the head so the panel's primary
    // action is visible without scrolling.
    var head = panelBody.querySelector('.panel-head');
    if (head) head.after(markBox); else panelBody.prepend(markBox);
    renderMarkUI(id);
    panel.classList.add('open');
    panel.scrollTop = 0;
  }

  function escText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stateLabel(st) {
    return st === 'done' ? 'savladano'
      : st === 'ready' ? 'spremno za čitanje' : 'nije spremno';
  }
  function testPhrase(id) {
    // This phrase becomes MODEL INPUT and seeds the session's language —
    // it must match the vault, not the club's UI chrome. A member copied
    // the Croatian version into an English vault and got a Croatian
    // session about English category theory; never again.
    var lang = (F.nodes[id] && F.nodes[id].language) || F.language;
    return lang === "en"
      ? '/tutor — check how well I understand: "' + F.nodes[id].title + '". Vault: ' + F.vaultPath + ' — keep the whole session note in English, saved under sessions/ inside this vault.'
      : '/tutor — provjeri koliko razumijem: "' + F.nodes[id].title + '". Trezor: ' + F.vaultPath + ' — cijelu sesijsku bilješku piši na hrvatskom, spremi je u sessions/ unutar trezora.';
  }
  function renderMarkUI(id, opts) {
    opts = opts || {};
    var st = stateOf(id);
    var h = '<div class="mark-state">Stanje: ' + stateLabel(st) + '</div>';
    h += st === 'done'
      ? '<button class="mark-btn is-done" data-act="unmark">Vrati na nesavladano</button>'
      : '<button class="mark-btn" data-act="mark">Označi kao savladano ✓</button>';
    if (opts.prompt) {
      h += '<div class="mark-prompt">' +
        '<button class="mp-close" data-act="dismiss" title="Odbaci">×</button>' +
        '<p>Želiš li se prvo provjeriti? Otvori <code>/tutor</code> u Claude Codeu i zatraži:</p>' +
        '<p><code>' + escText(testPhrase(id)) + '</code></p>' +
        '<div class="mp-actions">' +
        '<button data-act="copy">Kopiraj</button>' +
        '<button data-act="confirm">Samo označi</button>' +
        '</div></div>';
    }
    if (opts.note) h += '<div class="mark-hint">' + escText(opts.note) + '</div>';
    markBox.innerHTML = h;
  }
  function markDone(id) {
    var wasNotReady = stateOf(id) === 'not';
    done[id] = true;
    saveProgress();
    applyStates();
    renderMarkUI(id, wasNotReady
      ? { note: 'Napomena: preduvjeti ovog stabla još nisu savladani.' }
      : null);
  }
  // execCommand fallback for file:// contexts where the async clipboard
  // API is unavailable or denied.
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  markBox.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]');
    if (!b || !selected) return;
    var act = b.getAttribute('data-act');
    if (act === 'unmark') {
      delete done[selected];
      saveProgress();
      applyStates();
      renderMarkUI(selected);
    } else if (act === 'mark') {
      // A merely-ready tree earns the self-test nudge first; a not-ready
      // one is allowed straight through — the reader outranks the DAG.
      if (stateOf(selected) === 'ready') renderMarkUI(selected, { prompt: true });
      else markDone(selected);
    } else if (act === 'confirm') {
      markDone(selected);
    } else if (act === 'dismiss') {
      renderMarkUI(selected);
    } else if (act === 'copy') {
      var text = testPhrase(selected);
      var fb = function (ok) {
        b.textContent = ok ? 'Kopirano ✓' : 'Kopiranje nije uspjelo';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { fb(true); },
          function () { fb(legacyCopy(text)); }
        );
      } else {
        fb(legacyCopy(text));
      }
    }
  });
  document.getElementById('resetProg').addEventListener('click', function () {
    if (!confirm('Poništiti sav napredak? Sve oznake savladanosti bit će obrisane.')) return;
    done = {};
    try { localStorage.removeItem(F.progressKey); } catch (e) {}
    applyStates();
    if (selected) renderMarkUI(selected);
  });
  document.getElementById('close').addEventListener('click', function () {
    panel.classList.remove('open');
  });
  panelBody.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-open]');
    if (a) { ev.preventDefault(); openPanel(a.getAttribute('data-open')); }
  });

  document.getElementById('tglPrf').addEventListener('change', function (ev) {
    showPrf = ev.target.checked; relayout();
  });
  document.getElementById('tglExr').addEventListener('change', function (ev) {
    showExr = ev.target.checked; relayout();
  });
  document.getElementById('expandAll').addEventListener('click', function () {
    F.groups.forEach(function (g) { expanded[g.id] = true; }); relayout();
  });
  document.getElementById('collapseAll').addEventListener('click', function () {
    F.groups.forEach(function (g) { expanded[g.id] = false; }); relayout();
  });

  // --- search -------------------------------------------------------------
  var term = '';
  document.getElementById('search').addEventListener('input', function (ev) {
    term = ev.target.value.trim().toLowerCase();
    applySearch();
  });
  function applySearch() {
    document.querySelectorAll('.node').forEach(function (n) {
      var id = n.getAttribute('data-id');
      var info = F.nodes[id];
      var hit = term && (id.indexOf(term) >= 0 || info.title.toLowerCase().indexOf(term) >= 0);
      n.classList.toggle('hit', !!hit);
      n.classList.toggle('dim', !!term && !hit);
    });
    F.groups.forEach(function (g) {
      var any = term && g.members.some(function (id) {
        return id.indexOf(term) >= 0 || F.nodes[id].title.toLowerCase().indexOf(term) >= 0;
      });
      var t = document.querySelector('#grp-' + g.id + ' .grp-title');
      t.style.fill = any ? 'var(--accent)' : '';
    });
  }

  // --- pan / zoom ---------------------------------------------------------
  var view = { x: 0, y: 0, k: 1 };
  function applyView() {
    world.setAttribute('transform',
      'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')');
  }
  var canvas = document.getElementById('canvas');
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    var k2 = Math.min(4, Math.max(0.1, view.k * factor));
    var r = svg.getBoundingClientRect();
    var px = ev.clientX - r.left, py = ev.clientY - r.top;
    view.x = px - ((px - view.x) / view.k) * k2;
    view.y = py - ((py - view.y) / view.k) * k2;
    view.k = k2;
    applyView();
  }, { passive: false });
  var pan = null;
  canvas.addEventListener('mousedown', function (ev) {
    if (ev.target.closest('.node') || ev.target.closest('.grp-header')) return;
    pan = { x: ev.clientX - view.x, y: ev.clientY - view.y };
    canvas.classList.add('panning');
  });
  window.addEventListener('mousemove', function (ev) {
    if (!pan) return;
    view.x = ev.clientX - pan.x; view.y = ev.clientY - pan.y;
    applyView();
  });
  window.addEventListener('mouseup', function () {
    pan = null; canvas.classList.remove('panning');
  });

  loadProgress();
  if (!storageOk) storageNotice();
  relayout();
  // Start fitted to width, below the toolbar.
  var topbarH = document.getElementById('topbar').offsetHeight;
  var maxW = 0, maxY = 0;
  Object.keys(frames).forEach(function (k) {
    maxW = Math.max(maxW, frames[k].x + frames[k].w);
    maxY = Math.max(maxY, frames[k].y + frames[k].h);
  });
  var r = svg.getBoundingClientRect();
  view.k = Math.min(1, (r.width - 40) / (maxW + 40));
  view.x = 20; view.y = topbarH + 12;
  applyView();
})();`;
}

// --------------------------------------------------------------------- dag.md

function mermaidId(id) {
  return id.replace(/-/g, "_");
}

function buildDagMd(vault, edges, groups) {
  const { trees, forest } = vault;
  const lines = [];
  lines.push("# Graf ovisnosti");
  lines.push("");
  lines.push(
    "> [!TIP] Ovo je statični Obsidian-prikaz. **Interaktivni prikaz** — sklopive cjeline, označavanje napretka (savladano / spremno / nije spremno), pretraga — je `views/forest.html`: otvori ga **u pregledniku** (dvoklik u file manageru), ne u Obsidianu."
  );
  lines.push("");
  lines.push(
    "Bridovi su `depends` veze: strelica vodi od preduvjeta prema stablu",
    "koje ga treba. Graf je tranzitivno reduciran — brid koji slijedi iz",
    "duljeg puta je izostavljen. Dokazi (`prf-`) i zadatci (`exr-`) su",
    "izostavljeni radi čitljivosti; potpuni interaktivni prikaz je",
    "`views/forest.html`."
  );
  lines.push("");
  lines.push(`*(Generirano ${forest.created ?? ""} alatom forest-digest.)*`);

  const shown = (id) =>
    !["proof", "exercise"].includes(trees.get(id).fm.taxon);

  // Group overview: aggregated, deduplicated edges between sections.
  lines.push("", "## Pregled po cjelinama", "");
  lines.push("```mermaid", "graph TD");
  for (const g of groups) {
    lines.push(`    g${g.id}["${g.title} (${g.members.length})"]`);
  }
  const agg = new Set();
  for (const [u, v] of edges) {
    const gu = groups.groupOf.get(u);
    const gv = groups.groupOf.get(v);
    if (gu !== undefined && gv !== undefined && gu !== gv) agg.add(`${gu}>${gv}`);
  }
  for (const k of [...agg].sort()) {
    const [gu, gv] = k.split(">");
    lines.push(`    g${gu} --> g${gv}`);
  }
  lines.push("```");

  // One small TB diagram per section, statements only, ≤ ~15 nodes each.
  for (const g of groups) {
    const members = g.members.filter(shown);
    lines.push("", `## ${g.title}`, "");
    if (members.length === 0) {
      lines.push("*(samo dokazi/zadatci — vidi forest.html)*");
      continue;
    }
    const chunks = [];
    for (let i = 0; i < members.length; i += 15) {
      chunks.push(members.slice(i, i + 15));
    }
    for (const chunk of chunks) {
      const inChunk = new Set(chunk);
      lines.push("```mermaid", "graph TD");
      for (const id of chunk) {
        lines.push(`    ${mermaidId(id)}["${id}"]`);
      }
      for (const [u, v] of edges) {
        if (inChunk.has(u) && inChunk.has(v)) {
          lines.push(`    ${mermaidId(u)} --> ${mermaidId(v)}`);
        }
      }
      lines.push("```", "");
    }
    for (const id of members) {
      lines.push(`- [[${id}]] — ${trees.get(id).fm.title}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// -------------------------------------------------------------- by-concept.md

function buildByConceptMd(vault, groups, proofsOf) {
  const { trees } = vault;
  const lines = [];
  lines.push("# Stabla po konceptima");
  lines.push("");
  lines.push(
    "Vault izvrnut kroz registar koncepata (`library/concepts/concepts.yaml`):",
    "pod svakim konceptom stoje stabla koja ga *uče* (`teaches`). Dokazi ne",
    "uče nove koncepte pa stoje uz svoje teoreme."
  );

  // Concepts in order of first appearance walking the groups (index order),
  // so the view reads in the book's own progression.
  const order = [];
  const byConcept = new Map();
  const walk = [];
  for (const g of groups) walk.push(...g.members);
  for (const id of walk) {
    const t = trees.get(id);
    for (const c of t.fm.teaches ?? []) {
      if (!byConcept.has(c)) {
        byConcept.set(c, []);
        order.push(c);
      }
      byConcept.get(c).push(id);
    }
  }
  for (const c of order) {
    lines.push("", `## ${c}`, "");
    for (const id of byConcept.get(c)) {
      const t = trees.get(id);
      let line = `- [[${id}]] (${t.fm.taxon})`;
      const prfs = proofsOf.get(id);
      if (prfs?.length) {
        line += ` — dokazi: ${prfs.map((p) => `[[${p}]]`).join(", ")}`;
      }
      lines.push(line);
    }
  }
  lines.push("");
  return lines.join("\n");
}

main();
