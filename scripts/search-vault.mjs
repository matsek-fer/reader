#!/usr/bin/env node
// search-vault.mjs — retrieval over one vault's index/ (written by
// index-vault.mjs). Recall-oriented, like the library's search.mjs it is
// adapted from: whoever consumes this reranks; this script errs toward
// returning candidates, never toward silent precision tricks.
//
// Usage: node scripts/search-vault.mjs <vault-dir> "<query>" [--k 8]
// Output: JSON lines {id, score, taxon, title}, best first.
//
// Two signals, fused by reciprocal rank: a diacritic-folded lexical score
// over title + id + teaches, and cosine against the D-003 int8 vectors when
// both vectors.i8.bin and @huggingface/transformers are available. Without
// the model (or on an unembedded index) it degrades to lexical-only —
// hence the dynamic import: this script must run on a machine that only
// ever ran SKIP_EMBED=1.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const EMBED_MODEL = "Xenova/multilingual-e5-small"; // D-003; q8, 384-d
// Standard reciprocal-rank-fusion damping: rank 1 and rank 10 stay close
// enough that one strong signal cannot erase the other list entirely.
const RRF_K = 60;
const readerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { k: 8 };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--k") args.k = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  args.vaultDir = positional.shift();
  args.query = positional.join(" ").trim();
  if (!args.vaultDir || !args.query || !Number.isInteger(args.k) || args.k < 1) {
    process.stderr.write('usage: search-vault.mjs <vault-dir> "<query>" [--k 8]\n');
    process.exit(2);
  }
  return args;
}

// Croatian queries against ASCII ids and mixed-language titles: NFD
// stripping folds č/ć/š/ž, but đ carries a stroke, not a combining mark,
// so it needs its own rule. (Same folding as the library's search.)
function fold(s) {
  return String(s)
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(s) {
  return fold(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
}

function lexScore(qTokens, qPhrase, item) {
  const hay = fold(`${item.id ?? ""} ${item.title ?? ""} ${(item.teaches ?? []).join(" ")}`);
  const hayTokens = new Set(hay.split(/[^a-z0-9]+/).filter(Boolean));
  let s = 0;
  for (const t of qTokens) {
    if (hayTokens.has(t)) s += 3;
    // Substring catches Croatian inflection ("koset" in "koseti") and
    // id fragments; worth less than an exact token.
    else if (hay.includes(t)) s += 1;
  }
  if (qPhrase.length > 3 && hay.includes(qPhrase)) s += 5;
  return s;
}

async function tryEmbedQuery(query) {
  try {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = path.join(readerRoot, ".model-cache");
    const embed = await pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
    // The "query: " prefix is mandatory per D-003 and added here, never
    // by callers — asymmetric e5 embeddings are wrong without it.
    const out = await embed("query: " + query, { pooling: "mean", normalize: true });
    return Array.from(out.data);
  } catch {
    return null;
  }
}

function itemVector(item, vecBytes, dims) {
  if (
    vecBytes &&
    Number.isInteger(item.offset) &&
    typeof item.scale === "number" &&
    item.offset + dims <= vecBytes.length
  ) {
    const v = new Array(dims);
    for (let i = 0; i < dims; i++) v[i] = vecBytes.readInt8(item.offset + i) * item.scale;
    return v;
  }
  return null;
}

function cosine(q, v) {
  let dot = 0, nv = 0;
  const n = Math.min(q.length, v.length);
  for (let i = 0; i < n; i++) { dot += q[i] * v[i]; nv += v[i] * v[i]; }
  return nv > 0 ? dot / Math.sqrt(nv) : 0; // query is already normalized
}

// Rank map for RRF: ties share the rank of their first member so equal
// scores contribute equally.
function ranks(indices, scoreOf) {
  const order = [...indices].sort((a, b) => scoreOf(b) - scoreOf(a));
  const rank = new Map();
  for (let i = 0; i < order.length; i++) {
    const prev = i > 0 ? order[i - 1] : null;
    rank.set(order[i], prev !== null && scoreOf(prev) === scoreOf(order[i]) ? rank.get(prev) : i + 1);
  }
  return rank;
}

const args = parseArgs(process.argv.slice(2));
const indexPath = path.join(args.vaultDir, "index", "index.json");

let index;
try {
  index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
} catch (e) {
  process.stderr.write(`cannot load ${indexPath}: ${e.message} — run index-vault.mjs first\n`);
  process.exit(1);
}
const items = index.items ?? [];
if (items.length === 0) {
  process.stderr.write("index holds no items\n");
  process.exit(0);
}

const qTokens = tokens(args.query);
const qPhrase = fold(args.query);
const lex = items.map((it) => lexScore(qTokens, qPhrase, it));

const dims = Number(index.dims) || 384;
let vecBytes = null;
if (!index.unembedded && items.some((it) => it.scale != null)) {
  try {
    vecBytes = fs.readFileSync(path.join(args.vaultDir, "index", "vectors.i8.bin"));
  } catch { /* lexical-only below */ }
}
const qVec = vecBytes ? await tryEmbedQuery(args.query) : null;

const idx = items.map((_, i) => i);
let scored;
if (qVec) {
  const cos = items.map((it) => {
    const v = itemVector(it, vecBytes, dims);
    return v ? cosine(qVec, v) : -1;
  });
  const lexRank = ranks(idx, (i) => lex[i]);
  const vecRank = ranks(idx, (i) => cos[i]);
  // The fused score orders results but says nothing about absolute relevance
  // — an off-topic query produces near-identical RRF values. The raw cosine
  // and lexical signals ride along so a caller can judge "not in this vault".
  scored = idx.map((i) => [i, 1 / (RRF_K + lexRank.get(i)) + 1 / (RRF_K + vecRank.get(i)), cos[i], lex[i]]);
  process.stderr.write(`mode: hybrid (lexical + ${EMBED_MODEL})\n`);
} else {
  // No model or no vectors: raw lexical scores, zero-hit items dropped —
  // an empty result is more honest than the whole vault in id order.
  scored = idx.filter((i) => lex[i] > 0).map((i) => [i, lex[i]]);
  process.stderr.write("mode: lexical-only\n");
}

scored.sort((a, b) => b[1] - a[1]);
for (const [i, score, cosRaw, lexRaw] of scored.slice(0, args.k)) {
  const it = items[i];
  const row = { id: it.id, score: Number(score.toFixed(6)), taxon: it.taxon, title: it.title };
  if (cosRaw !== undefined) row.cosine = Number(cosRaw.toFixed(4));
  if (lexRaw !== undefined) row.lexical = Number(lexRaw.toFixed(4));
  process.stdout.write(JSON.stringify(row) + "\n");
}
