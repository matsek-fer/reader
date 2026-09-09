#!/usr/bin/env node
// index-vault.mjs — writes <vault>/index/ (index.json + vectors.i8.bin) for
// a forest-0.1 vault, so search-vault.mjs can retrieve trees the way the
// library's search retrieves bundles.
//
// Usage: node scripts/index-vault.mjs <vault-dir>
//        SKIP_EMBED=1 node scripts/index-vault.mjs <vault-dir>
//
// The embedding convention is the library's (spec DECISIONS.md D-003),
// mirrored deliberately so vault vectors and library vectors live in the
// same space and are mutually comparable: Xenova/multilingual-e5-small at
// dtype q8, 384 dims, mean pooling, L2-normalized, "passage: " prefix on
// what is indexed, symmetric int8 with a per-item scale in the sidecar
// vectors.i8.bin. Change any of that here and cross-corpus cosine stops
// meaning anything.
//
// SKIP_EMBED=1 — and any model failure — still writes a full index.json
// (marked `unembedded: true`, top-level, as the library writes it) so the
// lexical half of search works offline and CI never depends on Hugging
// Face being up.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const MODEL = "Xenova/multilingual-e5-small";
const DIMS = 384;
const readerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const vaultDir = process.argv[2];
if (!vaultDir || !fs.existsSync(path.join(vaultDir, "forest.json"))) {
  process.stderr.write("usage: index-vault.mjs <vault-dir>   (needs forest.json)\n");
  process.exit(2);
}

const forest = JSON.parse(fs.readFileSync(path.join(vaultDir, "forest.json"), "utf8"));
if (forest.schema_version !== "forest-0.1") {
  process.stderr.write(`error: schema_version ${forest.schema_version}, expected forest-0.1\n`);
  process.exit(1);
}

/* ---------------- vault input ---------------- */

const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;

// Item order is the sorted tree ids (filename stems) — byte-identical
// output for the same vault, whatever the filesystem returns, and the
// order a reader of index.json would predict.
const treesDir = path.join(vaultDir, "trees");
const trees = [];
const stems = fs.readdirSync(treesDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -3))
  .sort();
for (const stem of stems) {
  const f = stem + ".md";
  const text = fs.readFileSync(path.join(treesDir, f), "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) continue;
  trees.push({ fm: yaml.load(m[1]), body: m[2].trim() });
}

// group = the index.md section (## heading) that lists the tree; a proof
// unlisted there follows the statement it proves, the same attachment rule
// build-views.mjs uses, so search results and the forest view agree on
// where a tree lives. Anything still unplaced gets "Ostalo".
function groupsOf(trees) {
  const indexText = fs.readFileSync(path.join(vaultDir, "index.md"), "utf8");
  const groupOf = new Map();
  let current = null;
  for (const line of indexText.split("\n")) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) { current = h[1].trim(); continue; }
    if (!current) continue;
    for (const m of line.matchAll(WIKILINK)) {
      const id = m[1].trim();
      if (!groupOf.has(id)) groupOf.set(id, current);
    }
  }
  const byId = new Map(trees.map((t) => [t.fm.id, t]));
  for (const t of trees) {
    if (groupOf.has(t.fm.id) || t.fm.taxon !== "proof") continue;
    const home = (t.fm.depends ?? []).find((d) => groupOf.has(d) && byId.has(d));
    if (home) groupOf.set(t.fm.id, groupOf.get(home));
  }
  return (id) => groupOf.get(id) ?? "Ostalo";
}
const groupOf = groupsOf(trees);

/* ---------------- what gets embedded ---------------- */

// The embedded text is the title plus the body reduced to prose: math kept
// as its raw TeX tokens (delimiters dropped — "$|G| = [G:H]|H|$" still
// carries |G| and [G:H] as searchable text, an image-of-nothing helps no
// one), wikilinks reduced to their label or id, markdown syntax stripped.
function bodyToText(md) {
  return md
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => ` ${tex} `)
    .replace(/(?<![\\$])\$([^$\n]+?)(?<!\\)\$/g, (_, tex) => ` ${tex} `)
    .replace(WIKILINK, (_, id, label) => label ?? id)
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function embedText(t) {
  const ann = typeof t.fm.x_annotation === "string" ? ` — ${t.fm.x_annotation}` : "";
  return `passage: ${t.fm.title} — ${bodyToText(t.body)}${ann}`;
}

/* ---------------- index output ---------------- */

const outDir = path.join(vaultDir, "index");
fs.mkdirSync(outDir, { recursive: true });

function itemOf(t, i, scale) {
  const fm = t.fm;
  return {
    id: fm.id,
    taxon: fm.taxon,
    title: fm.title,
    teaches: fm.teaches ?? [],
    requires: fm.requires ?? [],
    depends: fm.depends ?? [],
    group: groupOf(fm.id),
    standalone: fm.standalone !== false,
    // Byte offset of this item's DIMS int8 values in vectors.i8.bin —
    // the library's addressing scheme, kept so one consumer reads both.
    offset: i * DIMS,
    ...(scale != null ? { scale } : {}),
  };
}

function writeIndex(items, vectors, unembedded) {
  const index = {
    schema_version: "forest-index-0.1",
    model: MODEL,
    dims: DIMS,
    quantization: "int8-per-item-scale",
    ...(unembedded ? { unembedded: true } : {}),
    items,
  };
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "vectors.i8.bin"), vectors);
}

async function embedAll() {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = path.join(readerRoot, ".model-cache");
  const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
  const vectors = Buffer.alloc(trees.length * DIMS);
  const items = [];
  for (let i = 0; i < trees.length; i++) {
    const out = await extractor(embedText(trees[i]), { pooling: "mean", normalize: true });
    const v = out.data;
    if (v.length !== DIMS) throw new Error(`model returned ${v.length} dims, expected ${DIMS}`);
    // Per-item scale: symmetric int8, one float multiply per item to
    // dequantize on the consumer side (same as library build.mjs).
    let maxAbs = 0;
    for (const x of v) maxAbs = Math.max(maxAbs, Math.abs(x));
    const scale = maxAbs > 0 ? maxAbs / 127 : 1;
    for (let d = 0; d < DIMS; d++) {
      vectors.writeInt8(Math.max(-127, Math.min(127, Math.round(v[d] / scale))), i * DIMS + d);
    }
    items.push(itemOf(trees[i], i, Number(scale.toPrecision(8))));
  }
  writeIndex(items, vectors, false);
  console.log(`index: embedded ${items.length} tree(s), ${vectors.length} bytes of vectors.`);
}

if (process.env.SKIP_EMBED === "1") {
  writeIndex(trees.map((t, i) => itemOf(t, i, null)), Buffer.alloc(0), true);
  console.log(`index: SKIP_EMBED=1 — wrote ${trees.length} tree(s) unembedded.`);
} else {
  try {
    await embedAll();
  } catch (err) {
    console.warn(`index: embedding failed (${err.message}); writing unembedded index.`);
    writeIndex(trees.map((t, i) => itemOf(t, i, null)), Buffer.alloc(0), true);
  }
}
