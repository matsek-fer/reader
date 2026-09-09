#!/usr/bin/env node
// The mechanical half of tree-level merging (spec D-007): compare candidate
// trees from a member's vault against the library forest and report, per
// candidate, its nearest existing trees with the raw signals — cosine
// (passage-to-passage: both sides are indexed content, so no "query: "
// prefix), concept overlap, title overlap — plus a labeled HINT. The hint is
// a hint: the standing rule since slice 2 is that signals narrow the search
// and reading decides, and nothing here is an eligibility check — export
// rights are grow-bundle.mjs's firewall, not this file's business.
//
// usage: node scripts/match-trees.mjs <candidate-vault> <forest-dir>
//        [--trees id,id,…] [--k 5]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const readerRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EMBED_MODEL = "Xenova/multilingual-e5-small";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: node scripts/match-trees.mjs <candidate-vault> <forest-dir> [--trees id,id] [--k 5]");
  process.exit(2);
}
const [vaultDir, forestDir] = args;
const k = args.includes("--k") ? Number(args[args.indexOf("--k") + 1]) : 5;
const only = args.includes("--trees") ? args[args.indexOf("--trees") + 1].split(",") : null;

function loadTrees(dir) {
  const trees = new Map();
  const base = path.join(dir, "trees");
  for (const f of fs.readdirSync(base).filter((f) => f.endsWith(".md")).sort()) {
    const text = fs.readFileSync(path.join(base, f), "utf8");
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!m) continue;
    trees.set(f.replace(/\.md$/, ""), { fm: load(m[1]) ?? {}, body: m[2].trim() });
  }
  return trees;
}

const fold = (s) =>
  s.toLowerCase().replace(/[čć]/g, "c").replace(/š/g, "s").replace(/ž/g, "z").replace(/đ/g, "d");
const tokens = (s) => new Set(fold(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));

function overlap(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.min(a.size, b.size);
}

function jaccard(a, b) {
  const A = new Set(a ?? []), B = new Set(b ?? []);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

const stripMath = (s) => s.replace(/\$\$[\s\S]*?\$\$/g, " ").replace(/\$[^$]*\$/g, " ");
const passageText = (t) =>
  `passage: ${t.fm.title} — ${stripMath(t.body).replace(/\s+/g, " ").slice(0, 2000)}` +
  (typeof t.fm.x_annotation === "string" ? ` — ${t.fm.x_annotation}` : "");

// ---------------------------------------------------------------- main
const candidates = loadTrees(vaultDir);
const forestIndexPath = path.join(forestDir, "index", "index.json");
if (!fs.existsSync(forestIndexPath)) {
  console.error(`error: ${forestIndexPath} missing — run index-vault.mjs on the forest first`);
  process.exit(1);
}
const forestIndex = JSON.parse(fs.readFileSync(forestIndexPath, "utf8"));
const forestTrees = loadTrees(forestDir);
const vecPath = path.join(forestDir, "index", "vectors.i8.bin");
const vecBytes = fs.existsSync(vecPath) ? fs.readFileSync(vecPath) : null;
const dims = forestIndex.dims ?? 384;

let embed = null;
try {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = path.join(readerRoot, ".model-cache");
  embed = await pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
  process.stderr.write("mode: hybrid (concepts + titles + cosine)\n");
} catch {
  process.stderr.write("mode: lexical-only (no embedding model) — cosine column absent\n");
}

function itemVector(item) {
  if (vecBytes && Number.isInteger(item.offset) && typeof item.scale === "number") {
    const v = new Array(dims);
    for (let i = 0; i < dims; i++) v[i] = vecBytes.readInt8(item.offset + i) * item.scale;
    return v;
  }
  return null;
}

const picked = only ?? [...candidates.keys()];
for (const id of picked) {
  const cand = candidates.get(id);
  if (!cand) { console.error(`warning: candidate "${id}" not in ${vaultDir}`); continue; }
  let qVec = null;
  if (embed) {
    const out = await embed(passageText(cand), { pooling: "mean", normalize: true });
    qVec = Array.from(out.data);
  }
  const candTitle = tokens(cand.fm.title ?? id);
  const scored = forestIndex.items.map((item) => {
    const ft = forestTrees.get(item.id);
    const cos = qVec ? (() => {
      const v = itemVector(item);
      if (!v) return null;
      let dot = 0, nv = 0;
      for (let i = 0; i < dims; i++) { dot += qVec[i] * v[i]; nv += v[i] * v[i]; }
      return nv > 0 ? dot / Math.sqrt(nv) : 0;
    })() : null;
    const concepts = jaccard(cand.fm.teaches, item.teaches);
    const title = overlap(candTitle, tokens(item.title ?? item.id));
    // Blend for ORDERING only; the emitted raw signals are what a reader
    // (human or model) should actually judge by.
    const order = (cos ?? 0) + concepts * 0.5 + title * 0.3;
    return { item, cos, concepts, title, order };
  }).sort((a, b) => b.order - a.order).slice(0, k);

  const top = scored[0];
  // Calibrated on the grown-problem pair (an original tree vs. the forest's
  // converted copy of its own bundle): true near-duplicates sit far above
  // ordinary same-topic neighbours. Hints, not verdicts.
  const hint =
    top && ((top.cos ?? 0) >= 0.92 || (top.title >= 0.9 && top.concepts >= 0.5))
      ? "likely-duplicate"
      : top && ((top.cos ?? 0) >= 0.86 || top.concepts >= 0.5)
        ? "related"
        : "novel";
  process.stdout.write(JSON.stringify({
    candidate: id,
    taxon: cand.fm.taxon,
    hint,
    matches: scored.map((s) => ({
      id: s.item.id, taxon: s.item.taxon, title: s.item.title,
      ...(s.cos !== null ? { cosine: Number(s.cos.toFixed(4)) } : {}),
      concepts: Number(s.concepts.toFixed(3)),
      title_overlap: Number(s.title.toFixed(3)),
    })),
  }) + "\n");
}
