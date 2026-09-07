#!/usr/bin/env node
// validate-forest.mjs — checks a Forest vault against docs/forest-format.md
// (draft forest-0.1). The doc is normative; where it and this file disagree,
// the doc wins and this file has a bug.
//
// Usage: node scripts/validate-forest.mjs <vault-dir> [--concepts <concepts.yaml>] [--lenient]
//
// Prints "error:" / "warning:" lines; exits 1 iff there are errors.
// --lenient downgrades unknown teaches/requires concept ids from error to
// warning (useful while the registry lags behind a fresh digest).

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const SCHEMA_VERSION = "forest-0.1";
const NOTICE = "LOKALNO — izvedeno djelo, ne šalje se u knjižnicu";
// Share-alike sources (GFDL, CC BY-SA): the vault MAY be shared under the
// source's terms, but still never enters the CC BY library (D-001).
const NOTICE_SA = "IZVEDENO — smije se dijeliti samo pod licencom izvora (share-alike); ne ide u knjižnicu";
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const PREFIX_TO_TAXON = {
  thm: "theorem",
  lem: "lemma",
  prp: "proposition",
  cor: "corollary",
  def: "definition",
  axm: "axiom",
  prf: "proof",
  exm: "example",
  exr: "exercise",
  exp: "exposition",
  mot: "motivation",
  int: "intuition",
  rem: "remark",
  con: "connection",
};
const TAXA = new Set(Object.values(PREFIX_TO_TAXON));

// The taxa a proof can prove. Axioms are assumed, not proved, so they are
// deliberately not here even though they are formal statements.
const PROVABLE_TAXA = new Set(["theorem", "lemma", "proposition", "corollary"]);

// Scrollback phrases (hr + en) that betray a tree still leaning on its book's
// page order. Matched on letter boundaries, case-insensitively, so "iznad"
// inside a longer word never fires but a bare "ranije" does.
// Phrase-level only: bare words like "above" fire on innocent
// mathematics ("bounded above by |G|"), which the review demonstrated.
const SCROLLBACK_PHRASES = [
  "kao što smo vidjeli",
  "vidjeli smo",
  "ranije smo",
  "u prethodnom",
  "u prethodnome",
  "istim trikom",
  "as we saw",
  "as shown earlier",
  "as seen above",
  "in the previous section",
];

// [[target]] or [[target#anchor]] or [[target|label]] — capture the target.
const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

function main() {
  const args = process.argv.slice(2);
  let vaultDir = null;
  let conceptsPath = null;
  let lenient = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--concepts") {
      conceptsPath = args[++i];
      if (!conceptsPath) usage("--concepts needs a path");
    } else if (args[i] === "--lenient") {
      lenient = true;
    } else if (args[i].startsWith("-")) {
      usage(`unknown flag ${args[i]}`);
    } else if (vaultDir === null) {
      vaultDir = args[i];
    } else {
      usage("more than one vault directory given");
    }
  }
  if (!vaultDir) usage("no vault directory given");

  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  if (!fs.existsSync(vaultDir) || !fs.statSync(vaultDir).isDirectory()) {
    err(`${vaultDir}: not a directory`);
    return report(errors, warnings);
  }

  const registry = conceptsPath ? loadRegistry(conceptsPath, err) : null;
  const forest = checkForestJson(vaultDir, err);
  const derivative = forest?.derivative === true;
  const trees = loadTrees(vaultDir, err);
  checkTrees(trees, { derivative, registry, lenient }, err, warn);
  checkDag(trees, err);
  checkIndex(vaultDir, trees, err, warn);
  checkViews(vaultDir, trees, err, warn);

  return report(errors, warnings);
}

function usage(msg) {
  console.error(`error: ${msg}`);
  console.error(
    "usage: node scripts/validate-forest.mjs <vault-dir> [--concepts <concepts.yaml>] [--lenient]"
  );
  process.exit(2);
}

function report(errors, warnings) {
  for (const e of errors) console.log(`error: ${e}`);
  for (const w of warnings) console.log(`warning: ${w}`);
  console.log(
    `${errors.length} error(s), ${warnings.length} warning(s)`
  );
  process.exit(errors.length > 0 ? 1 : 0);
}

// Unknown keys: ^x_ is sanctioned scratch space everywhere; anything else
// unknown is an error, never a tolerated extra (bundle-spec rule, verbatim).
function checkKeys(obj, allowed, ctx, err) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith("x_")) continue;
    if (!allowed.has(k)) {
      err(`${ctx}: unknown key "${k}" (only ^x_ extras are allowed)`);
    }
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// ---------------------------------------------------------------- forest.json

function checkForestJson(vaultDir, err) {
  const file = path.join(vaultDir, "forest.json");
  const ctx = "forest.json";
  if (!fs.existsSync(file)) {
    err(`${ctx}: missing`);
    return null;
  }
  let forest;
  try {
    forest = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    err(`${ctx}: invalid JSON — ${e.message}`);
    return null;
  }
  if (!isPlainObject(forest)) {
    err(`${ctx}: must be a single JSON object`);
    return null;
  }

  checkKeys(
    forest,
    new Set([
      "schema_version",
      "source",
      "language",
      "created",
      "tool",
      "tool_version",
      "derivative",
      "notice",
    ]),
    ctx,
    err
  );

  if (forest.schema_version !== SCHEMA_VERSION) {
    err(
      `${ctx}: schema_version must be "${SCHEMA_VERSION}", got ${JSON.stringify(forest.schema_version)}`
    );
  }

  if (!isPlainObject(forest.source)) {
    err(`${ctx}: source must be an object`);
  } else {
    const s = forest.source;
    const sctx = `${ctx}: source`;
    checkKeys(
      s,
      new Set(["title", "authors", "year", "kind", "file", "license", "pages", "redistribution"]),
      sctx,
      err
    );
    if (typeof s.title !== "string" || s.title.length === 0) {
      err(`${sctx}.title must be a non-empty string`);
    }
    if (!isStringArray(s.authors)) {
      err(`${sctx}.authors must be an array of strings (may be empty)`);
    }
    if (!Number.isInteger(s.year)) {
      err(`${sctx}.year must be an integer`);
    }
    if (!["book", "paper", "notes"].includes(s.kind)) {
      err(`${sctx}.kind must be "book", "paper" or "notes", got ${JSON.stringify(s.kind)}`);
    }
    if (s.file !== undefined && (typeof s.file !== "string" || s.file.length === 0)) {
      err(`${sctx}.file must be a non-empty string when present`);
    }
    if (typeof s.license !== "string" || s.license.length === 0) {
      err(`${sctx}.license must be a license identifier or "copyrighted"`);
    }
    if (s.pages !== undefined && typeof s.pages !== "string") {
      err(`${sctx}.pages must be a string like "1-374"`);
    }
    // The format makes pages optional only when there is no single source
    // document; with a file recorded, the digested range must be too.
    if (s.file !== undefined && s.pages === undefined) {
      err(`${sctx}.pages is required when source.file is present`);
    }
  }

  if (!["hr", "en"].includes(forest.language)) {
    err(`${ctx}: language must be "hr" or "en", got ${JSON.stringify(forest.language)}`);
  }
  if (typeof forest.created !== "string" || !DATE.test(forest.created)) {
    err(`${ctx}: created must be an ISO date YYYY-MM-DD`);
  }
  if (forest.tool !== "forest-digest") {
    err(`${ctx}: tool must be exactly "forest-digest"`);
  }
  if (typeof forest.tool_version !== "string" || forest.tool_version.length === 0) {
    err(`${ctx}: tool_version must be a non-empty string`);
  }
  if (typeof forest.derivative !== "boolean") {
    err(`${ctx}: derivative must be a boolean`);
  }

  // derivative/notice coupling: the notice is required, verbatim, exactly when
  // the vault is derivative — a stray notice is a confused provenance claim.
  const redistribution = forest.source?.redistribution;
  if (redistribution !== undefined && !["none", "share-alike-only"].includes(redistribution)) {
    err(`${ctx}: source.redistribution must be "none" or "share-alike-only"`);
  }
  if (forest.derivative === true) {
    const expected = redistribution === "share-alike-only" ? NOTICE_SA : NOTICE;
    if (forest.notice !== expected) {
      err(`${ctx}: derivative vault must carry notice exactly "${expected}"`);
    }
  } else if (forest.notice !== undefined) {
    err(`${ctx}: notice is forbidden unless derivative is true`);
  }

  return forest;
}

// --------------------------------------------------------------------- trees/

function loadTrees(vaultDir, err) {
  const dir = path.join(vaultDir, "trees");
  const trees = new Map(); // id -> { file, stem, fm, body }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    err("trees/: missing directory");
    return trees;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length === 0) err("trees/: no tree files");

  for (const f of files) {
    const rel = `trees/${f}`;
    const stem = f.slice(0, -3);
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) {
      err(`${rel}: missing YAML frontmatter block`);
      continue;
    }
    let fm;
    try {
      fm = yaml.load(m[1]);
    } catch (e) {
      err(`${rel}: invalid YAML frontmatter — ${e.message}`);
      continue;
    }
    if (!isPlainObject(fm)) {
      err(`${rel}: frontmatter must be a YAML mapping`);
      continue;
    }
    trees.set(stem, { file: rel, stem, fm, body: m[2] });
  }
  return trees;
}

function checkTrees(trees, { derivative, registry, lenient }, err, warn) {
  const conceptProblem = lenient ? warn : err;

  for (const t of trees.values()) {
    const { file, stem, fm, body } = t;
    checkKeys(
      fm,
      new Set(["id", "taxon", "title", "teaches", "requires", "depends", "source", "standalone"]),
      file,
      err
    );

    if (fm.id !== stem) {
      err(`${file}: id ${JSON.stringify(fm.id)} must equal the filename stem "${stem}"`);
    }

    const dash = stem.indexOf("-");
    const prefix = dash > 0 ? stem.slice(0, dash) : stem;
    const slug = dash > 0 ? stem.slice(dash + 1) : "";
    if (!(prefix in PREFIX_TO_TAXON) || !KEBAB.test(slug)) {
      err(`${file}: id must be <taxon-prefix>-<kebab-slug> (prefixes: ${Object.keys(PREFIX_TO_TAXON).join(", ")})`);
    }

    if (!TAXA.has(fm.taxon)) {
      err(`${file}: invalid taxon ${JSON.stringify(fm.taxon)}`);
    } else if (prefix in PREFIX_TO_TAXON && PREFIX_TO_TAXON[prefix] !== fm.taxon) {
      err(`${file}: taxon "${fm.taxon}" does not match id prefix "${prefix}-" (expected "${PREFIX_TO_TAXON[prefix]}")`);
    }

    if (typeof fm.title !== "string" || fm.title.length === 0) {
      err(`${file}: title must be a non-empty string`);
    }
    for (const field of ["teaches", "requires"]) {
      if (!isStringArray(fm[field])) {
        err(`${file}: ${field} must be an array of concept ids (may be empty)`);
      } else if (registry) {
        for (const c of fm[field]) {
          if (!registry.has(c)) {
            conceptProblem(`${file}: ${field} id "${c}" not in the concept registry`);
          }
        }
      }
    }
    if (!isStringArray(fm.depends)) {
      err(`${file}: depends must be an array of tree ids (may be empty)`);
    }
    if (typeof fm.standalone !== "boolean") {
      err(`${file}: standalone must be a boolean`);
    }

    if (fm.source !== undefined) {
      if (!isPlainObject(fm.source)) {
        err(`${file}: source must be an object`);
      } else {
        checkKeys(fm.source, new Set(["pages", "ref"]), `${file}: source`, err);
        if (fm.source.pages !== undefined && typeof fm.source.pages !== "string") {
          err(`${file}: source.pages must be a string like "12-14"`);
        }
        if (fm.source.ref !== undefined && typeof fm.source.ref !== "string") {
          err(`${file}: source.ref must be a string`);
        }
      }
    }
    // In a derivative vault the per-tree pointer is the provenance trail —
    // without pages a reader with the book cannot find the original.
    if (derivative) {
      if (!isPlainObject(fm.source)) {
        err(`${file}: source is required in a derivative vault (missing source.pages)`);
      } else if (typeof fm.source.pages !== "string" || fm.source.pages.length === 0) {
        err(`${file}: source.pages is required in a derivative vault`);
      }
    }

    // depends targets must be trees in this vault.
    if (isStringArray(fm.depends)) {
      for (const d of fm.depends) {
        if (!trees.has(d)) {
          err(`${file}: depends on unknown tree "${d}" (depends is intra-vault; background goes in requires)`);
        }
      }
    }

    // A proof proves exactly one statement; with zero it is an orphan, with
    // several the proved statement is ambiguous (the doc's uses-a-lemma case),
    // so zero is an error and more than one only a warning.
    if (fm.taxon === "proof" && isStringArray(fm.depends)) {
      const statements = fm.depends.filter((d) =>
        PROVABLE_TAXA.has(trees.get(d)?.fm?.taxon)
      );
      if (statements.length === 0) {
        err(`${file}: proof tree must depend on exactly one statement tree (theorem/lemma/proposition/corollary); found none`);
      } else if (statements.length > 1) {
        warn(`${file}: proof depends on ${statements.length} statement trees (${statements.join(", ")}) — ambiguous which one it proves`);
      }
    }

    // Body wikilinks are pointers into this vault's trees.
    for (const target of wikilinkTargets(body)) {
      if (!trees.has(target)) {
        err(`${file}: wikilink [[${target}]] does not resolve — the vault graph must have no dead links`);
      }
    }

    // Standalone discipline: a walk has no "above", no "previous".
    if (fm.standalone === true) {
      for (const phrase of scrollbackPhrases(body)) {
        warn(`${file}: standalone tree uses scrollback language "${phrase}" — link a tree instead`);
      }
    }
  }
}

function wikilinkTargets(body) {
  const targets = [];
  for (const m of body.matchAll(WIKILINK)) targets.push(m[1].trim());
  return targets;
}

function scrollbackPhrases(body) {
  const found = [];
  for (const phrase of SCROLLBACK_PHRASES) {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, "iu");
    if (re.test(body)) found.push(phrase);
  }
  return found;
}

// ------------------------------------------------------------------------ DAG

function checkDag(trees, err) {
  const edges = new Map();
  for (const t of trees.values()) {
    const deps = isStringArray(t.fm.depends) ? t.fm.depends : [];
    edges.set(t.stem, deps.filter((d) => trees.has(d)));
  }
  const state = new Map(); // 0/undefined unvisited, 1 in stack, 2 done
  const stack = [];
  let cycle = null;

  function dfs(n) {
    state.set(n, 1);
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      if (cycle) return;
      const s = state.get(m) ?? 0;
      if (s === 1) {
        cycle = [...stack.slice(stack.indexOf(m)), m];
        return;
      }
      if (s === 0) dfs(m);
    }
    if (!cycle) {
      stack.pop();
      state.set(n, 2);
    }
  }

  for (const n of edges.keys()) {
    if (!state.get(n)) dfs(n);
    if (cycle) break;
  }
  if (cycle) {
    err(`trees/: depends cycle: ${cycle.join(" -> ")} — the intra-work DAG must be acyclic`);
  }
}

// ------------------------------------------------------------ index and views

function checkIndex(vaultDir, trees, err, warn) {
  const file = path.join(vaultDir, "index.md");
  if (!fs.existsSync(file)) {
    err("index.md: missing — the vault has no root map");
    return;
  }
  const body = fs.readFileSync(file, "utf8");
  for (const target of wikilinkTargets(body)) {
    if (!trees.has(target)) {
      err(`index.md: wikilink [[${target}]] does not resolve — the vault graph must have no dead links`);
    }
  }
}

function checkViews(vaultDir, trees, err, warn) {
  // views/forest.html is optional-but-recommended (generated by
  // scripts/build-views.mjs); old vaults without it stay valid. When it does
  // exist it must not be an empty husk.
  const forestHtml = path.join(vaultDir, "views", "forest.html");
  if (fs.existsSync(forestHtml)) {
    if (fs.readFileSync(forestHtml, "utf8").trim().length === 0) {
      err("views/forest.html: exists but is empty — regenerate it with scripts/build-views.mjs or delete it");
    }
  }
  for (const v of ["views/dag.md", "views/by-concept.md"]) {
    const file = path.join(vaultDir, v);
    if (!fs.existsSync(file)) {
      err(`${v}: missing — views are part of the format; the vault must render without tooling`);
      continue;
    }
    for (const target of wikilinkTargets(fs.readFileSync(file, "utf8"))) {
      if (!trees.has(target)) {
        warn(`${v}: wikilink [[${target}]] does not resolve to a tree in this vault`);
      }
    }
  }
}

// ----------------------------------------------------------- concept registry

function loadRegistry(conceptsPath, err) {
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(conceptsPath, "utf8"));
  } catch (e) {
    err(`${conceptsPath}: cannot read concepts registry — ${e.message}`);
    return new Set();
  }
  if (!Array.isArray(doc)) {
    err(`${conceptsPath}: concepts registry must be a YAML list of { id, ... } entries`);
    return new Set();
  }
  const ids = new Set();
  for (const entry of doc) {
    if (isPlainObject(entry) && typeof entry.id === "string") ids.add(entry.id);
  }
  return ids;
}

main();
