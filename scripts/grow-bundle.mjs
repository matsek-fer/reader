#!/usr/bin/env node
// grow-bundle.mjs — mechanical conversion of vault trees into a library
// bundle SKELETON (spec/bundles.md, format v1). The /grow skill polishes what
// this script emits: annotation-DRAFT.md must be rewritten into a real
// annotation.md, the author placeholder replaced, provenance confirmed in the
// interview. This script's own non-negotiable job is the FIREWALL: a tree may
// become library content only if the vault is not derivative, or the tree's
// origin is member/agent (docs/forest-format.md "Copyright — the hard rules",
// spec/policies/provenance.md). Digest-origin trees from a derivative vault
// are refused before anything is written — re-authoring does not launder
// provenance, and the refusal is deliberately mechanical so no interview can
// talk its way past it.
//
// Usage:
//   node scripts/grow-bundle.mjs <vault-dir> <tree-id> [<tree-id>…] \
//     --type problem|proof|blog --out <dir> --created YYYY-MM-DD \
//     [--difficulty 1-5]
//
// problem: statement/exercise tree + its solution/proof tree
//          -> problem.md, solution.md, annotation-DRAFT.md, manifest.json
// proof:   statement tree + proof tree
//          -> statement.md, proof.md, annotation-DRAFT.md, manifest.json
// blog:    exposition/connection tree cluster
//          -> blog.md (section_concepts from teaches, x_forest taxa carried
//             over per blog-writer/docs/forest-readiness.md),
//             annotation-DRAFT.md, manifest.json
//
// Deterministic: the same vault, trees and flags produce the same bytes
// (created is an input, never the clock).

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(["problem", "proof", "blog"]);
// Statement-shaped taxa a problem or proof bundle can lead with. An exercise
// or worked example is a legitimate problem statement; the formal statement
// taxa serve both bundle types.
const STATEMENT_TAXA = new Set([
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "exercise",
  "example",
]);

// [[target]] / [[target#anchor]] / [[target|label]] — capture target + label.
const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function usage(msg) {
  console.error(`error: ${msg}`);
  console.error(
    "usage: node scripts/grow-bundle.mjs <vault-dir> <tree-id> [<tree-id>…] --type problem|proof|blog --out <dir> --created YYYY-MM-DD [--difficulty 1-5]"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { vaultDir: null, treeIds: [], type: null, out: null, created: null, difficulty: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") opts.type = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--created") opts.created = argv[++i];
    else if (a === "--difficulty") opts.difficulty = argv[++i];
    else if (a.startsWith("-")) usage(`unknown flag ${a}`);
    else if (opts.vaultDir === null) opts.vaultDir = a;
    else opts.treeIds.push(a);
  }
  if (!opts.vaultDir) usage("no vault directory given");
  if (opts.treeIds.length === 0) usage("no tree ids given");
  if (!TYPES.has(opts.type)) usage(`--type must be problem, proof or blog, got ${JSON.stringify(opts.type)}`);
  if (!opts.out) usage("--out is required");
  if (typeof opts.created !== "string" || !DATE.test(opts.created)) {
    usage("--created must be an ISO date YYYY-MM-DD (pass today's date — the script never reads the clock)");
  }
  if (opts.type === "problem" || opts.type === "proof") {
    const d = Number(opts.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5) {
      usage(`--difficulty 1-5 is required for type ${opts.type}`);
    }
    opts.difficulty = d;
  } else if (opts.difficulty !== null) {
    const d = Number(opts.difficulty);
    if (!Number.isInteger(d) || d < 1 || d > 5) usage("--difficulty must be an integer 1-5");
    opts.difficulty = d;
  }
  return opts;
}

function loadForest(vaultDir) {
  const file = path.join(vaultDir, "forest.json");
  if (!fs.existsSync(file)) fail(`error: ${file}: missing — not a Forest vault`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`error: ${file}: invalid JSON — ${e.message}`);
  }
}

function loadTrees(vaultDir) {
  const dir = path.join(vaultDir, "trees");
  if (!fs.existsSync(dir)) fail(`error: ${dir}: missing`);
  const trees = new Map();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) continue;
    let fm;
    try {
      fm = yaml.load(m[1]);
    } catch {
      continue;
    }
    if (fm && typeof fm === "object") trees.set(f.slice(0, -3), { fm, body: m[2] });
  }
  return trees;
}

// The firewall. Croatian, final, and evaluated before a single byte is
// written: policies/provenance.md is the law it quotes.
function firewall(forest, picked) {
  // Fail CLOSED on a malformed claim: "derivative": "true" (string) must not
  // slip past a strict-equality check into the non-derivative fast path.
  if (typeof forest.derivative !== "boolean") {
    console.error(
      `ODBIJENO: forest.json ima neispravan "derivative" (${JSON.stringify(forest.derivative)}) — mora biti boolean. Provenijencija se ne pogađa; popravi forest.json pa pokušaj ponovno. Ništa nije zapisano.`
    );
    process.exit(1);
  }
  if (forest.derivative !== true) return;
  for (const [id, tree] of picked) {
    const origin = tree.fm.origin ?? "digest";
    if (origin === "member" || origin === "agent") {
      // The validator's contradiction rule, enforced HERE too: the grow path
      // must not depend on anyone remembering to run validate-forest first.
      if (tree.fm.source && tree.fm.source.pages !== undefined) {
        console.error(
          `ODBIJENO: stablo "${id}" tvrdi origin "${origin}" ali nosi source.pages — sadržaj koji pokazuje na stranice izvornog djela JEST izvorni sadržaj, kakav god origin piše. Zbunjena provenijencija se ne izvozi. Ništa nije zapisano.`
        );
        process.exit(1);
      }
      continue;
    }
    console.error(
      [
        `ODBIJENO: stablo "${id}" ima origin "${origin}" u izvedenom trezoru (derivative: true) — njegov sadržaj potječe iz izvornog djela i ne smije postati sadržaj knjižnice.`,
        `Pravilo (docs/forest-format.md, Copyright): izvedeni trezor "stays local, and never enters the library — not as a vault, not tree-by-tree, not 'just the definitions'". Preautoriranje ne pere provenijenciju.`,
        `spec/policies/provenance.md, "Banned, regardless of intent": "Transcriptions or close paraphrases of textbook, coursebook or competition problems (MAA, IMO, državna/županijska natjecanja, AoPS, …). This is not caution, it is precedent: the MIT-labeled Hendrycks MATH dataset was DMCA'd off Hugging Face in January 2025 by AoPS at 95% text similarity."`,
        `U knjižnicu iz izvedenog trezora smije samo stablo s origin "member" ili "agent" čiju izvornost član potvrdi u provenijencijskom razgovoru. Ova odluka je konačna; ništa nije zapisano.`,
      ].join("\n")
    );
    process.exit(1);
  }
}

// Anchor derivation per spec/bundles.md: lowercase, Croatian diacritics to
// ASCII, runs of non-alphanumerics to single hyphens.
function anchorOf(title) {
  const translit = { č: "c", ć: "c", š: "s", ž: "z", đ: "d" };
  const lower = title.toLowerCase().replace(/[čćšžđ]/g, (c) => translit[c]);
  return "#" + lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// A library bundle cannot carry vault-local [[links]] — resolve each to the
// linked tree's title in italics (or the label the author already chose) and
// note the dropped link on stderr so the polishing pass sees what was lost.
function rewriteWikilinks(body, treeId, trees) {
  return body.replace(WIKILINK, (whole, target, label) => {
    const t = target.trim();
    const linked = trees.get(t);
    const text = label !== undefined && label !== "" ? label : linked ? linked.fm.title : t;
    if (linked) {
      console.error(`note: ${treeId}: dropped vault link [[${t}]] -> *${text}*`);
    } else {
      console.error(`note: ${treeId}: dropped unresolved link [[${t}]] -> *${text}*`);
    }
    return `*${text}*`;
  });
}

function unionConcepts(picked, field) {
  const out = new Set();
  for (const [, tree] of picked) {
    for (const c of tree.fm[field] ?? []) out.add(c);
  }
  return [...out].sort();
}

function pickStatementAndSecond(picked, type) {
  if (picked.length !== 2) {
    fail(`error: type ${type} needs exactly two trees (statement + ${type === "proof" ? "proof" : "solution"}), got ${picked.length}`);
  }
  const proofs = picked.filter(([, t]) => t.fm.taxon === "proof");
  const statements = picked.filter(([, t]) => STATEMENT_TAXA.has(t.fm.taxon));
  if (proofs.length === 1 && statements.length === 1) {
    return { statement: statements[0], second: proofs[0] };
  }
  // No clean taxon split: trust the argument order (statement first) — the
  // solution of an exercise pair is often itself an exr-/exm- tree.
  if (statements.length >= 1 && STATEMENT_TAXA.has(picked[0][1].fm.taxon)) {
    return { statement: picked[0], second: picked[1] };
  }
  fail(`error: cannot tell statement from ${type === "proof" ? "proof" : "solution"} — pass the statement tree (theorem/lemma/proposition/corollary/exercise/example) first`);
}

function annotationDraft(title, picked) {
  const ids = picked.map(([id]) => id).join(", ");
  return [
    "DRAFT — this file is a placeholder, not an annotation. Rewrite it in",
    "English and rename it to annotation.md before validation (the /grow",
    "skill does this; see spec/bundles.md, \"annotation.md — why it exists\").",
    "",
    `State what "${title}" teaches or tests, the techniques it uses, the`,
    "abstract principle it instantiates, and the common failure modes.",
    "Write for the retriever, not the member.",
    "",
    `Grown from vault trees: ${ids}.`,
    "",
  ].join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const forest = loadForest(opts.vaultDir);
  const trees = loadTrees(opts.vaultDir);

  const picked = [];
  for (const id of opts.treeIds) {
    const tree = trees.get(id);
    if (!tree) fail(`error: tree "${id}" not found in ${opts.vaultDir}/trees/`);
    picked.push([id, tree]);
  }

  // Nothing below this line runs for a refused tree.
  firewall(forest, picked);

  const slug = path.basename(path.resolve(opts.out));
  if (!KEBAB.test(slug)) {
    fail(`error: --out basename "${slug}" must be a kebab-case slug — it becomes the bundle id ${opts.type}/<slug>`);
  }

  const files = new Map(); // filename -> content
  let title;

  if (opts.type === "problem" || opts.type === "proof") {
    const { statement, second } = pickStatementAndSecond(picked, opts.type);
    title = statement[1].fm.title;
    const stmtBody = rewriteWikilinks(statement[1].body, statement[0], trees).trim() + "\n";
    const secondBody = rewriteWikilinks(second[1].body, second[0], trees).trim() + "\n";
    if (opts.type === "problem") {
      files.set("problem.md", stmtBody);
      files.set("solution.md", secondBody);
    } else {
      files.set("statement.md", stmtBody);
      files.set("proof.md", secondBody);
    }
  } else {
    // blog: each tree becomes one section; the frontmatter binds sections to
    // concepts and carries the trees' taxa as x_forest verdicts — the
    // forest-readiness convention (blog-writer/docs/forest-readiness.md)
    // travelling back out of the vault.
    title = picked[0][1].fm.title;
    const sectionConcepts = {};
    const xForest = {};
    const sections = [];
    for (const [id, tree] of picked) {
      const anchor = anchorOf(tree.fm.title);
      sectionConcepts[anchor] = [...(tree.fm.teaches ?? [])].sort();
      xForest[anchor] = {
        taxon: tree.fm.taxon,
        standalone: tree.fm.standalone === true,
      };
      sections.push(`## ${tree.fm.title}\n\n${rewriteWikilinks(tree.body, id, trees).trim()}`);
    }
    const fm = yaml.dump(
      { schema_version: "1.0", section_concepts: sectionConcepts, x_forest: xForest },
      { lineWidth: -1 }
    );
    files.set("blog.md", `---\n${fm}---\n\n# ${title}\n\n${sections.join("\n\n")}\n`);
  }

  files.set("annotation-DRAFT.md", annotationDraft(title, picked));

  const teaches = unionConcepts(picked, "teaches");
  const manifest = {
    schema_version: "1.0",
    type: opts.type,
    id: `${opts.type}/${slug}`,
    title,
    language: forest.language,
    author: "TODO Ime Prezime <github-handle>",
    license: "CC-BY-4.0",
    // Placeholder the provenance interview must confirm or change — never a
    // finished claim (policies/provenance.md).
    provenance: "ai-assisted",
    created: opts.created,
    teaches,
    // What the bundle itself supplies is no longer a prerequisite.
    requires: unionConcepts(picked, "requires").filter((c) => !teaches.includes(c)),
    ...(opts.difficulty !== null ? { difficulty: opts.difficulty } : {}),
    // Tool-private breadcrumb (^x_ space) so the skill can write the
    // x_library backlink into these trees after submission.
    x_grown_from: picked.map(([id]) => id),
  };
  files.set("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  fs.mkdirSync(opts.out, { recursive: true });
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(opts.out, name), content);
  }
  console.log(`grown: ${manifest.id} -> ${opts.out} (${[...files.keys()].sort().join(", ")})`);
  console.log(
    "skeleton only — polish before validating: annotation-DRAFT.md -> annotation.md, author, provenance interview."
  );
}

main();
