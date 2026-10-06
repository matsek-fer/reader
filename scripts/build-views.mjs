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
// A forest-0.2 vault with objects gets a second tab, Struktura: object boxes
// placed by lib/layout.mjs (cycles broken, then layered like a group), with
// arrows drawn and labelled by the page from build-time positions, and a
// bottom strip collecting the picked tree's commutative diagrams. An arrow
// from an object to itself is drawn as a loop, and its panel also shows it
// unrolled into a chain.
//
// Deterministic by construction: stable sorts everywhere, no Date.now — the
// only date in the output is forest.json's `created`.
//
// The layout lives in lib/layout.mjs; the page's runtime and stylesheet in
// lib/client/, inlined verbatim. This file reads the vault, renders panels
// and writes the three files.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import yaml from "js-yaml";
import { renderBody as renderBodyShared, renderMath as renderMathShared, renderCd, cdCss } from "./lib/render.mjs";
import {
  PROVABLE, NODE_W, NODE_H, PRF_W, PRF_H, HEADER_H, PAD, COLLAPSED_W, INST_H, INST_GAP,
  INST_BOX_W, INST_BOX_H, REG_TITLE_H, REG_PAD,
  buildGroups, transitiveReduction, layoutGroup, layoutStructure, layoutStructure2D,
} from "./lib/layout.mjs";

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
  object: "objekt",
  morphism: "strelica",
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
  object: "#e9d66b",
  morphism: "#8d93ea",
};

// Arrow kinds of the structure graph, in the order panels list them. The
// colours reuse the taxon palette: they are edge colours, never node colours,
// so the two never sit side by side.
const KIND_HR = {
  data: "podaci",
  transform: "pretvorba",
  extract: "izvlači",
  property: "svojstvo",
  instance: "primjer",
  generalizes: "poopćenje",
  construction: "konstrukcija",
  hom: "morfizam",
};
const KIND_COLOR = {
  data: "#5b9dd9",
  transform: "#e0a458",
  extract: "#6fbf73",
  property: "#a678c8",
  instance: "#9aa1ad",
  generalizes: "#d97b8f",
  construction: "#4fb3a9",
  hom: "#c3d65c",
};

// The two levels of a forest-0.3 vault, in the words the page shows.
const LEVEL_HR = { kind: "struktura", instance: "primjer" };

// Principles of the formal system a tree may assume; any other token is
// shown as written.
const ASSUMES_HR = {
  "axiom-of-choice": "aksiom izbora",
  "excluded-middle": "zakon isključenja trećeg",
  "continuum-hypothesis": "hipoteza kontinuuma",
};

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

  const structure = buildStructure(vault, groups);
  if (structure && !structure.twoLevel) {
    const nInst = Object.values(structure.instances).reduce((n, l) => n + l.length, 0);
    console.log(
      `structure: ${structure.objects.length} objects, ${structure.arrows.length} arrows ` +
        `(${nInst} instances), ${structure.layout.w}×${structure.layout.h}`
    );
  } else if (structure) {
    const kinds = structure.objects.filter((o) => o.level === "kind").length;
    const a = structure.authored;
    console.log(
      `structure: ${kinds} kinds, ${structure.objects.length - kinds} instances, ` +
        `${structure.arrows.length} arrows, ${structure.regions.length} regions, ` +
        `${structure.layout.w}×${structure.layout.h}`
    );
    console.log(
      `positions: ${a.fromTrees} authored in trees, ${a.saved} from structure-layout.json` +
        (a.ignored ? `, ${a.ignored} ignored` : "")
    );
    const blocked = structure.layout.blocked;
    console.log(blocked.length
      ? `blocked arrows: ${blocked.length} — ${blocked.map((b) => `${b.id} over ${b.boxes.join(", ")}`).join(" · ")}`
      : "blocked arrows: none — every arrow reaches its target without crossing a box");
  }

  const viewsDir = path.join(vaultDir, "views");
  fs.mkdirSync(viewsDir, { recursive: true });

  const html = buildHtml(vaultDir, vault, ids, edges, groups, proofsOf, structure);
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

// -------------------------------------------------------------- markdown/math

const renderMath = renderMathShared;
// Delegates to the shared renderer; `trees` here is a Map, the shared
// function takes a membership predicate.
function renderBody(body, trees, lang) {
  return renderBodyShared(body, (id) => trees.has(id), { lang });
}

// A frontmatter sentence (hom, needs, on_homomorphisms, values) rendered
// like a body but without the paragraph marked wraps it in.
function renderInline(text, trees, lang) {
  const html = renderBody(String(text), trees, lang).trim();
  const m = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return m ? m[1] : html;
}

function vaultLang(forest) {
  return forest.language === "en" ? "en" : "hr";
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

// ------------------------------------------------------------------ structure

// Everything the Struktura tab needs beyond the trees themselves, computed
// once: objects with their symbols, arrows with their labels and statements,
// instances under their object, theorems indexed by what they are about, and
// the boxes' positions. Null for a vault without objects, so a 0.1 page has
// no second tab.
function buildStructure(vault, groups) {
  const { trees, forest, vaultDir } = vault;
  const lang = vaultLang(forest);
  // The two levels are read only from a vault that says 0.3; a 0.2 vault keeps
  // its typed boxes and its instance arrows.
  const twoLevel = forest.schema_version === "forest-0.3";
  const ids = [...trees.keys()].sort();
  const objectIds = ids.filter((id) => trees.get(id).fm.taxon === "object");
  if (!objectIds.length) return null;
  const inline = (text) => renderInline(text, trees, lang);

  const objects = objectIds.map((id) => {
    const fm = trees.get(id).fm;
    const o = { id, title: plainTitle(fm.title), symbol_html: renderMath(String(fm.symbol ?? ""), false) };
    if (!twoLevel) {
      if (typeOf(fm, trees)) o.type = fm.type;
      return o;
    }
    const kind = kindOf(fm, trees);
    o.level = kind ? "instance" : "kind";
    if (kind) o.of = fm.instance_of;
    else if (Array.isArray(fm.data)) o.data = fm.data.filter((x) => trees.has(x));
    o.region = typeof fm.region === "string" ? fm.region : "";
    o.w = kind ? INST_BOX_W : NODE_W;
    o.h = kind ? INST_BOX_H : NODE_H;
    return o;
  });

  const arrows = [];
  const instances = {};
  for (const id of ids) {
    const fm = trees.get(id).fm;
    if (fm.taxon !== "morphism") continue;
    const a = {
      id,
      from: String(fm.from),
      to: String(fm.to),
      kind: String(fm.kind),
      title: plainTitle(fm.title),
      label_html: fm.label ? renderMath(String(fm.label), false) : renderTitle(fm.title),
      statement_html: renderMath(String(fm.statement ?? ""), false),
    };
    if (fm.inverse && trees.has(fm.inverse)) a.inverse = fm.inverse;
    if (fm.up_to && trees.has(fm.up_to)) a.up_to = fm.up_to;
    arrows.push(a);
    if (!twoLevel && fm.kind === "instance" && trees.has(fm.to)) {
      const values_html = {};
      for (const [k, v] of Object.entries(fm.values ?? {})) {
        if (trees.has(k)) values_html[k] = inline(v);
      }
      (instances[fm.to] ??= []).push({ id, title: a.title, values_html });
    }
  }
  // In 0.3 an example is an object of its own, so what the panel calls the
  // examples of a kind are the instance objects that name it.
  if (twoLevel) {
    for (const o of objects) {
      if (o.level !== "instance") continue;
      const values_html = {};
      for (const [k, v] of Object.entries(trees.get(o.id).fm.values ?? {})) {
        if (trees.has(k)) values_html[k] = inline(v);
      }
      (instances[o.of] ??= []).push({ id: o.id, title: o.title, values_html });
    }
  }

  const theorems = {};
  for (const id of ids) {
    const fm = trees.get(id).fm;
    if (!PROVABLE.has(fm.taxon) || !Array.isArray(fm.about)) continue;
    const entry = {
      id,
      title: plainTitle(fm.title),
      fields: Array.isArray(fm.fields) ? fm.fields.map(String) : [],
    };
    for (const target of fm.about) {
      if (trees.has(target)) (theorems[target] ??= []).push(entry);
    }
  }

  // index.md order breaks ties inside a column, as in the Redoslijed tab.
  const rank = new Map();
  let i = 0;
  for (const g of groups) for (const m of g.members) rank.set(m, i++);
  if (!twoLevel) {
    const counts = Object.fromEntries(Object.entries(instances).map(([k, v]) => [k, v.length]));
    const layout = layoutStructure(objectIds, arrows, { rank, instances: counts });
    return { twoLevel, objects, arrows, instances, theorems, pos: layout.pos, layout, regions: [] };
  }

  const authored = authoredPositions(vaultDir, trees, objectIds);
  const regionOf = {}, size = {};
  for (const o of objects) {
    regionOf[o.id] = o.region;
    size[o.id] = [o.w, o.h];
  }
  const declared = Array.isArray(forest.regions)
    ? forest.regions
        .filter((r) => r && typeof r.id === "string")
        .map((r) => ({ id: r.id, title: String(r.title ?? r.id) }))
    : [];
  const layout = layoutStructure2D(objectIds, arrows, {
    regions: declared, regionOf, size, rank, pos: authored.pos,
  });
  return {
    twoLevel, objects, arrows, instances, theorems,
    pos: layout.pos, layout, regions: layout.regions, authored,
  };
}

// The frontmatter of the kind a typed object is another object of, or null.
function typeOf(fm, trees) {
  const type = typeof fm.type === "string" ? trees.get(fm.type)?.fm : null;
  return type && type.taxon === "object" ? type : null;
}

// The frontmatter of the kind an instance is an instance of, or null — the
// 0.3 reading of the same question.
function kindOf(fm, trees) {
  const kind = typeof fm.instance_of === "string" ? trees.get(fm.instance_of)?.fm : null;
  return kind && kind.taxon === "object" ? kind : null;
}

const isXY = (p) =>
  Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));

// Authored positions, in the coordinates of each box's own region: the trees'
// own `pos`, with structure-layout.json laid over it — that file is what the
// page writes back when the author drags a box, and reading it here is what
// makes a dragged layout survive this rebuild.
function authoredPositions(vaultDir, trees, objectIds) {
  const pos = {};
  for (const id of objectIds) {
    const p = trees.get(id).fm.pos;
    if (isXY(p)) pos[id] = [p[0], p[1]];
  }
  const fromTrees = Object.keys(pos).length;
  let saved = 0, ignored = 0;
  const file = path.join(vaultDir, "structure-layout.json");
  if (fs.existsSync(file)) {
    let doc = null;
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      console.warn("structure-layout.json: not valid JSON — ignored");
    }
    const known = new Set(objectIds);
    for (const [id, p] of Object.entries(doc?.pos ?? {})) {
      if (!known.has(id) || !isXY(p)) { ignored++; continue; }
      pos[id] = [p[0], p[1]];
      saved++;
    }
  }
  return { pos, fromTrees, saved, ignored };
}

// Links inside the structure head: a tree by its title, an arrow by its title.
function treeLink(id, trees) {
  return trees.has(id)
    ? `<a href="#" class="treelink" data-open="${escapeHtml(id)}">${renderTitle(trees.get(id).fm.title)}</a>`
    : `<code>${escapeHtml(id)}</code>`;
}

function kindChip(kind) {
  return `<span class="kind-chip" style="--c:${KIND_COLOR[kind] ?? "#888"}">${escapeHtml(KIND_HR[kind] ?? kind)}</span>`;
}

const headRow = (k, v) => `<div class="sh-row"><span class="sh-k">${k}</span><span class="sh-v">${v}</span></div>`;

function assumesRow(fm) {
  if (!Array.isArray(fm.assumes) || !fm.assumes.length) return [];
  const names = fm.assumes.map((a) => (ASSUMES_HR[a] ? escapeHtml(ASSUMES_HR[a]) : `<code>${escapeHtml(a)}</code>`));
  return [headRow("Pretpostavlja", names.join(", "))];
}

// What a tree that is neither object nor arrow says in its head: what it is
// about, for which fields, and what it assumes. Needs no structure graph, so
// a 0.2 vault without objects still shows it.
function aboutHead(fm, trees) {
  const rows = [];
  if (Array.isArray(fm.about) && fm.about.length) {
    rows.push(headRow("Govori o", fm.about.map((target) => treeLink(target, trees)).join(", ")));
  }
  if (Array.isArray(fm.fields) && fm.fields.length) {
    rows.push(headRow("Područja", fm.fields.map((x) => `<span class="field-chip">${escapeHtml(x)}</span>`).join(" ")));
  }
  rows.push(...assumesRow(fm));
  return rows.length ? `<div class="struct-head struct-about">${rows.join("")}</div>` : "";
}

// The frontmatter of an object or morphism, laid out above its body: the
// symbol or statement as display math, then one row per key. Everything
// here is static per tree, so it is rendered once at build time; the
// sections that cross trees (arrows out of an object, its examples and
// theorems) are assembled by the page from window.STRUCTURE.
function structHead(id, fm, trees, structure, lang) {
  const inline = (text) => renderInline(text, trees, lang);
  const row = headRow;
  const link = (target) => treeLink(target, trees);
  const rows = [];
  if (fm.taxon === "object" && structure.twoLevel) {
    return objectHead03(id, fm, trees, structure, lang);
  }
  if (fm.taxon === "object") {
    // A typed object is another box of its type's kind and inherits its maps.
    const type = typeOf(fm, trees);
    if (type) rows.push(row("Isti tip kao", link(fm.type)));
    const hom = fm.hom ?? type?.hom;
    if (hom) rows.push(row("Preslikavanja", inline(hom)));
    if (fm.nlab && fm.nlab.title) {
      const rev = fm.nlab.revision != null ? `, rev. ${escapeHtml(fm.nlab.revision)}` : "";
      rows.push(row("Prema nLab", `${escapeHtml(fm.nlab.title)}${rev}`));
    }
    if (fm.same_as) rows.push(row("U knjižnici", `<code>${escapeHtml(fm.same_as)}</code>`));
    rows.push(...assumesRow(fm));
    const math = fm.symbol ? `<div class="sh-math">${renderMath(String(fm.symbol), true)}</div>` : "";
    return `<div class="struct-head">${math}${rows.join("")}</div>`;
  }
  if (fm.taxon === "morphism") {
    const kind = fm.kind;
    rows.push(row("Vrsta", kindChip(kind)));
    if (kind === "instance") rows.push(row("Primjer za", link(fm.to)));
    else rows.push(row("Iz → u", `${link(fm.from)} <span class="sh-arrow">→</span> ${link(fm.to)}`));
    if (kind !== "instance") {
      if (fm.acts_on === "all") rows.push(row("Čita", "sve podatke izvora"));
      else if (Array.isArray(fm.acts_on)) {
        rows.push(row("Čita", fm.acts_on.length ? fm.acts_on.map(link).join(", ") : "ništa od izvora"));
      }
      if (Array.isArray(fm.needs)) {
        rows.push(row("Treba još", fm.needs.length
          ? `<ul class="sh-list">${fm.needs.map((n) => `<li>${inline(n)}</li>`).join("")}</ul>`
          : kind === "hom" ? "ništa osim dvaju krajeva" : "ništa izvan izvora"));
      }
      if (fm.on_homomorphisms) rows.push(row("Na preslikavanjima", inline(fm.on_homomorphisms)));
      if (typeof fm.functorial === "boolean") rows.push(row("Funktorijalno", fm.functorial ? "da" : "ne"));
      if (kind === "hom" && typeof fm.invertible === "boolean") rows.push(row("Izomorfizam", fm.invertible ? "da" : "ne"));
    }
    if (fm.inverse) {
      // Either side of the pair may name the tree stating the isomorphism.
      const upTo = [fm.up_to, trees.get(fm.inverse)?.fm.up_to].find((t) => t && trees.has(t));
      rows.push(upTo
        ? row("Inverz (do na kanonski izomorfizam)", `${link(fm.inverse)} — vidi ${link(upTo)}`)
        : row("Inverz", link(fm.inverse)));
    }
    if (Array.isArray(fm.generalized_by) && fm.generalized_by.length) {
      rows.push(row("Poopćenje", fm.generalized_by.map(link).join(", ")));
    }
    const special = structure.arrows
      .filter((a) => (trees.get(a.id).fm.generalized_by ?? []).includes(id))
      .map((a) => a.id);
    if (special.length) rows.push(row("Poseban slučaj", special.map(link).join(", ")));
    if (kind === "instance" && fm.values && typeof fm.values === "object") {
      const labelOf = (k) => structure.arrows.find((a) => a.id === k)?.label_html ?? "";
      const dl = Object.entries(fm.values)
        .filter(([k]) => trees.has(k))
        .map(([k, v]) => `<dt><span class="sh-lbl">${labelOf(k)}</span> ${link(k)}</dt><dd>${inline(v)}</dd>`)
        .join("");
      if (dl) rows.push(`<div class="sh-row"><span class="sh-k">Vrijednosti</span><dl class="sh-dl">${dl}</dl></div>`);
    }
    rows.push(...assumesRow(fm));
    const math = fm.statement ? `<div class="sh-math">${renderMath(String(fm.statement), true)}</div>` : "";
    return `<div class="struct-head">${math}${rows.join("")}</div>`;
  }
  return aboutHead(fm, trees);
}

const levelChip = (level) =>
  `<span class="level-chip lvl-${level}">${LEVEL_HR[level]}</span>`;

// An object's head in a 0.3 vault. The level comes first, because every row
// under it reads differently on the two: a kind states what a map between two
// of its structures is and may be defined by a diagram; an instance inherits
// that sentence and carries what the arrows out of its kind yield on it.
function objectHead03(id, fm, trees, structure, lang) {
  const inline = (text) => renderInline(text, trees, lang);
  const link = (target) => treeLink(target, trees);
  const o = structure.objects.find((x) => x.id === id) ?? { level: "kind" };
  const kind = kindOf(fm, trees);
  const rows = [headRow("Razina", levelChip(o.level))];
  if (kind) rows.push(headRow("Primjer vrste", link(fm.instance_of)));
  const hom = fm.hom ?? kind?.hom;
  if (hom) rows.push(headRow(kind ? "Preslikavanja (iz vrste)" : "Preslikavanja", inline(hom)));
  if (o.data?.length) {
    rows.push(headRow("Definiran dijagramom", o.data.map(link).join(", ")));
  }
  if (fm.nlab && fm.nlab.title) {
    const rev = fm.nlab.revision != null ? `, rev. ${escapeHtml(fm.nlab.revision)}` : "";
    rows.push(headRow("Prema nLab", `${escapeHtml(fm.nlab.title)}${rev}`));
  }
  if (fm.same_as) rows.push(headRow("U knjižnici", `<code>${escapeHtml(fm.same_as)}</code>`));
  if (o.level === "instance" && fm.values && typeof fm.values === "object") {
    const labelOf = (k) => structure.arrows.find((a) => a.id === k)?.label_html ?? "";
    const dl = Object.entries(fm.values)
      .filter(([k]) => trees.has(k))
      .map(([k, v]) => `<dt><span class="sh-lbl">${labelOf(k)}</span> ${link(k)}</dt><dd>${inline(v)}</dd>`)
      .join("");
    if (dl) rows.push(`<div class="sh-row"><span class="sh-k">Vrijednosti</span><dl class="sh-dl">${dl}</dl></div>`);
  }
  rows.push(...assumesRow(fm));
  const math = fm.symbol ? `<div class="sh-math">${renderMath(String(fm.symbol), true)}</div>` : "";
  return `<div class="struct-head">${math}${rows.join("")}</div>` +
    (o.data?.length ? defFigure(id, o.data, trees, lang) : "");
}

// A kind's defining diagram — the instances it is drawn over and the arrows
// between them — through the cd renderer, so going one level lower reads like
// a figure from a body and the Dijagrami strip picks it up like one. The
// button beside it asks the canvas for the same diagram in place.
function defFigure(id, data, trees, lang) {
  const oneLine = (v) => String(v).replace(/\s+/g, " ").trim();
  const objs = data.filter((x) => trees.get(x).fm.taxon === "object");
  const mors = data.filter((x) => trees.get(x).fm.taxon === "morphism");
  const at = new Map(objs.map((x, i) => [x, [i % 3, Math.floor(i / 3)]]));
  const name = (x) => `C${objs.indexOf(x)}`;
  const lines = [`% title: ${lang === "en" ? "Defining diagram" : "Definicijski dijagram"}`];
  for (const x of objs) {
    lines.push(`${name(x)} @ ${at.get(x)[0]},${at.get(x)[1]} : ${oneLine(trees.get(x).fm.symbol ?? x)}`);
  }
  for (const m of mors) {
    const f = trees.get(m).fm;
    if (!at.has(f.from) || !at.has(f.to)) continue;
    const lbl = oneLine(f.label ?? f.statement ?? "");
    lines.push(`${name(f.from)} -> ${name(f.to)}${lbl ? ` : ${lbl} [above]` : ""}`);
  }
  const btn = `<button class="def-focus" data-focus="${escapeHtml(id)}">Prikaži definiciju na platnu</button>`;
  return `<div class="struct-def">${renderCd(lines.join("\n"), { has: (x) => trees.has(x), lang })}${btn}</div>`;
}

// An arrow from an object to itself, unrolled: three copies of the object and
// an ellipsis in a row, joined by the arrow. It goes through the cd renderer,
// so the panel and the Dijagrami strip treat it like a figure from a body.
function chainFigure(fm, trees, lang) {
  const oneLine = (v) => String(v).replace(/\s+/g, " ").trim();
  const symbol = oneLine(trees.get(fm.from)?.fm.symbol ?? "X");
  const label = oneLine(fm.label ?? "f");
  const source = [
    `% title: ${lang === "en" ? "As a chain" : "Kao lanac"}`,
    ...["A", "B", "C"].map((name, col) => `${name} @ ${col},0 : ${symbol}`),
    "D @ 3,0 : \\cdots",
    ...["A -> B", "B -> C", "C -> D"].map((ends) => `${ends} : ${label} [above]`),
  ].join("\n");
  return `<div class="struct-chain"><h3 class="ssec">Odmotana petlja</h3>${renderCd(source, { has: (id) => trees.has(id), lang })}</div>`;
}

// The 0.3 canvas: a region frame per labelled area, then one box per object in
// the register of its level — a kind as before, an instance smaller, filled and
// tagged, with the tie to its kind drawn by the page. Arrows, ties and the live
// region frames are the page's, since a dragged box moves all three.
function structureSvg03(structure, trees) {
  const regions = structure.regions
    .filter((r) => r.title)
    .map((r) =>
      `<g class="sregion" data-region="${escapeHtml(r.id)}">` +
      `<rect class="sreg-box" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12"/>` +
      `<text class="sreg-title" x="${r.x + 16}" y="${r.y + 20}">${escapeHtml(r.title)}</text></g>`
    )
    .join("\n");
  const boxes = structure.objects
    .map((o) => {
      const p = structure.pos[o.id];
      const inst = o.level === "instance";
      const w = o.w, h = o.h;
      // The tag shares the instance box's only text line, so the title stops short of it.
      const title = wrapLabel(o.title, inst ? 14 : 24, 1)[0] ?? "";
      const level = `<text class="nlevel" x="${w - 6}" y="${inst ? 13 : h - 8}" text-anchor="end">${LEVEL_HR[o.level]}</text>`;
      // The id and the level tag share the bottom line of a kind box, so the
      // id gets only the room the longer of the two tag words leaves it.
      const idMax = inst ? 18 : 14;
      const shortId = o.id.length > idMax ? o.id.slice(0, idMax - 1) + "…" : o.id;
      return (
        `<g class="sbox" data-box="${escapeHtml(o.id)}" transform="translate(${p.x},${p.y})">` +
        `<g class="node snode ${inst ? "sinst" : "skind"}" data-id="${escapeHtml(o.id)}">` +
        `<rect width="${w}" height="${h}" rx="6" style="--c:${TAXON_COLOR.object}"/>` +
        (inst ? "" : `<rect class="accent" width="4" height="${h}" rx="2" style="--c:${TAXON_COLOR.object}"/>`) +
        `<text class="ntitle" x="10" y="${inst ? 14 : 18}">${escapeHtml(title)}</text>` +
        (inst ? "" : `<text class="nid" x="10" y="${h - 8}">${escapeHtml(shortId)}</text>`) +
        level +
        `<title>${escapeHtml(trees.get(o.id).fm.title)}</title></g></g>`
      );
    })
    .join("\n");
  return `<g id="sregions">${regions}</g><g id="sties"></g><g id="sedges"></g>\n${boxes}`;
}

// Object boxes for the Struktura layer, positioned at build time; instance
// chips hang under their object. Arrows and labels are drawn by the page.
function structureSvg(structure, trees) {
  if (structure.twoLevel) return structureSvg03(structure, trees);
  return `<g id="sedges"></g>` + structure.objects
    .map((o) => {
      const p = structure.pos[o.id];
      const title = wrapLabel(o.title, 30, 1)[0] ?? "";
      const shortId = o.id.length > 27 ? o.id.slice(0, 26) + "…" : o.id;
      const chips = (structure.instances[o.id] ?? [])
        .map((inst, k) => {
          const y = NODE_H + INST_GAP + k * (INST_H + INST_GAP);
          const label = `▸ ${inst.title}`;
          const shown = label.length > 30 ? label.slice(0, 29) + "…" : label;
          return (
            `<g class="inst" data-id="${escapeHtml(inst.id)}" transform="translate(0,${y})">` +
            `<rect width="${NODE_W}" height="${INST_H}" rx="4"/>` +
            `<text x="8" y="${INST_H / 2 + 4}">${escapeHtml(shown)}</text>` +
            `<title>${escapeHtml(inst.title)}</title></g>`
          );
        })
        .join("");
      return (
        `<g transform="translate(${p.x},${p.y})">` +
        `<g class="node snode" data-id="${escapeHtml(o.id)}">` +
        `<rect width="${NODE_W}" height="${NODE_H}" rx="6" style="--c:${TAXON_COLOR.object}"/>` +
        `<rect class="accent" width="4" height="${NODE_H}" rx="2" style="--c:${TAXON_COLOR.object}"/>` +
        `<text class="ntitle" x="10" y="18">${escapeHtml(title)}</text>` +
        `<text class="nid" x="10" y="${NODE_H - 8}">${escapeHtml(shortId)}</text>` +
        `<title>${escapeHtml(trees.get(o.id).fm.title)}</title></g>${chips}</g>`
      );
    })
    .join("\n");
}

// ----------------------------------------------------------------- forest.html

function buildHtml(vaultDir, vault, ids, edges, groups, proofsOf, structure) {
  const { trees, forest, title } = vault;
  const absVault = path.resolve(vaultDir);
  const lang = vaultLang(forest);
  // The structure keys are read only from a vault that says 0.2 or 0.3, so a
  // 0.1 page is byte for byte what it was.
  const twoLevel = forest.schema_version === "forest-0.3";
  const structured = twoLevel || forest.schema_version === "forest-0.2";
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
    // The strip reads diagrams from the trees about the picked one.
    const about = Array.isArray(t.fm.about) ? t.fm.about.filter((a) => trees.has(a)) : [];
    if (about.length) nodeInfo[id].about = about;
    const isStruct = t.fm.taxon === "object" || t.fm.taxon === "morphism";
    const isLoop = t.fm.taxon === "morphism" && t.fm.from === t.fm.to && trees.get(t.fm.from)?.fm.taxon === "object";
    const src = t.fm.source
      ? [t.fm.source.ref, t.fm.source.pages && `str. ${t.fm.source.pages}`]
          .filter(Boolean)
          .join(" · ")
      : "";
    contentHtml[id] =
      `<div class="panel-head"><span class="chip" style="--c:${TAXON_COLOR[t.fm.taxon]}">` +
      `${TAXON_HR[t.fm.taxon]}</span><h2>${renderTitle(t.fm.title)}</h2>` +
      `<div class="panel-id">${escapeHtml(id)}${src ? " · " + escapeHtml(src) : ""}</div></div>` +
      (structure ? structHead(id, t.fm, trees, structure, lang) : structured ? aboutHead(t.fm, trees) : "") +
      renderBody(t.body, trees, lang) +
      (structure && isLoop ? chainFigure(t.fm, trees, lang) : "") +
      (isStruct ? `<div class="struct-sections" data-id="${escapeHtml(id)}"></div>` : "") +
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
        `<text class="grp-title" x="30" y="${HEADER_H / 2 + 5}" data-full="${escapeHtml(g.title)}">${escapeHtml(g.title)}</text>` +
        `<title>${escapeHtml(g.title)}</title>` +
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

  const kindsPresent = structure
    ? Object.keys(KIND_HR).filter((k) => structure.arrows.some((a) => a.kind === k))
    : [];
  // On a two-level canvas the registers come first: what a box is before what
  // an arrow is.
  const levelLegend = structure?.twoLevel
    ? `<span class="lg"><i class="lgb lgb-kind"></i>${LEVEL_HR.kind}</span>` +
      `<span class="lg"><i class="lgb lgb-inst"></i>${LEVEL_HR.instance}</span>` +
      `<span class="lgsep"></span>`
    : "";
  const kindLegend = levelLegend + kindsPresent
    .map((k) => `<span class="lg"><i style="background:${KIND_COLOR[k]}"></i>${KIND_HR[k]}</span>`)
    .join("");
  const markers = Object.keys(KIND_HR)
    .map(
      (k) =>
        `<marker id="ah-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${KIND_COLOR[k]}"/></marker>`
    )
    .join("");
  const hasCd = Object.values(contentHtml).some((h) => h.includes('<figure class="cd"'));

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
    // The tutor session's slug is remembered under the same pair, so a
    // reload or a second tab of this vault resumes the same conversation.
    sessionKey:
      "forest-session:" +
      (forest.source?.title ?? "") +
      "|" +
      (forest.created ?? ""),
  };
  const dataJson = JSON.stringify(data).replace(/</g, "\\u003c");
  const contentJson = JSON.stringify(contentHtml).replace(/</g, "\\u003c");
  const structureJson = structure
    ? JSON.stringify({
        objects: structure.objects,
        arrows: structure.arrows,
        instances: structure.instances,
        theorems: structure.theorems,
        pos: structure.pos,
        kinds: Object.keys(KIND_HR).map((k) => ({ id: k, hr: KIND_HR[k], color: KIND_COLOR[k] })),
        geom: { INST_H, INST_GAP },
        size: { w: structure.layout.w, h: structure.layout.h },
        ...(structure.twoLevel
          ? {
              twoLevel: true,
              levels: LEVEL_HR,
              reg: { title_h: REG_TITLE_H, pad: REG_PAD },
              // Each region's own origin: a dragged box is saved in the
              // coordinates `pos` is written in, which are its region's.
              regions: structure.regions.map((r) => ({
                id: r.id, title: r.title, x: r.x, y: r.y, w: r.w, h: r.h, origin: r.origin,
              })),
              layoutFile: "structure-layout.json",
            }
          : {}),
      }).replace(/</g, "\\u003c")
    : "";

  const srcLine = `${forest.source?.title ?? ""}${
    forest.source?.authors?.length ? " — " + forest.source.authors.join(", ") : ""
  }`;

  return `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<link rel="icon" href="data:,">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${katexCss()}
${cdCss()}
${clientCss()}</style>
</head>
<body>
<div id="topbar">
  <h1>${escapeHtml(title)}</h1>
  <span class="sub">${escapeHtml(srcLine)}</span>
${structure ? `  <div id="tabs"><button class="tab on" data-tab="order">Redoslijed</button><button class="tab" data-tab="structure">Struktura</button></div>
` : ""}  <input id="search" type="search" placeholder="Traži po naslovu ili id…">
  <label><input type="checkbox" id="tglPrf"> Prikaži dokaze</label>
  <label${exrCount ? "" : ' style="display:none"'}><input type="checkbox" id="tglExr"${showExrDefault ? " checked" : ""}> Prikaži zadatke${exrCount ? ` (${exrCount})` : ""}</label>
  <button id="expandAll">Proširi sve</button>
  <button id="collapseAll">Sažmi sve</button>
  <div id="legend">${stateLegend}${legend}</div>
${structure ? `  <div id="slegend">${kindLegend}</div>
` : ""}</div>
<div id="canvas">
<svg id="svg">
${structure ? `  <defs>${markers}</defs>
` : ""}  <g id="world"><g id="glayer">${groupSvgs}</g>${structure ? `<g id="slayer" style="display:none">${structureSvg(structure, trees)}</g>` : ""}</g>
</svg>
${structure ? `<div id="slabels"></div>
` : ""}</div>
<aside id="panel"><button id="close" title="Zatvori">×</button><div id="panel-body"></div></aside>${hasCd ? `
<div id="strip" class="empty"><div class="strip-bar"><button id="strip-toggle" class="strip-title">▾ Dijagrami <span id="strip-count"></span></button><div id="strip-tabs"></div></div><div id="strip-body"></div></div>` : ""}${twoLevel ? `
<div id="focusbar" hidden><span id="fb-what"></span><button id="fb-back">Natrag na cijeli graf</button></div>
<div id="layoutbar" hidden><span id="lb-msg"></span><button id="lb-save" hidden>Spremi razmještaj</button><button id="lb-copy">Kopiraj</button><a id="lb-dl" download="structure-layout.json">Preuzmi</a><button id="lb-undo">Poništi pomake</button><textarea id="lb-json" readonly hidden></textarea></div>` : ""}
<div id="footer"><span>Generirano ${escapeHtml(forest.created ?? "")} · forest-digest · klik na grupu otvara/zatvara, klik na karticu otvara sadržaj</span>${twoLevel ? `<span id="shint">Struktura: povuci kutiju da je premjestiš · klik na kutiju otvara sadržaj · klik na vrstu pokazuje njezin definicijski dijagram · prazna podloga pomiče platno</span>` : ""}<button id="resetProg">Poništi napredak</button><span id="storage-note"></span></div>
<script>window.FOREST = ${dataJson};</script>
<script>window.TREES = ${contentJson};</script>
${structure ? `<script>window.STRUCTURE = ${structureJson};</script>
` : ""}<script>
${clientJs()}</script>
</body>
</html>
`;
}

// The page's runtime and stylesheet live beside each other in lib/client/ and
// are inlined verbatim, so the page still works from file:// with no network.
const CLIENT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), "lib", "client");
function clientJs() {
  return fs.readFileSync(path.join(CLIENT_DIR, "forest.js"), "utf8");
}
function clientCss() {
  return fs.readFileSync(path.join(CLIENT_DIR, "forest.css"), "utf8");
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
