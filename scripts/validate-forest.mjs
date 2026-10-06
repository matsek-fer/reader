#!/usr/bin/env node
// validate-forest.mjs — checks a Forest vault against docs/forest-format.md
// (forest-0.1, forest-0.2 and forest-0.3). The doc is normative; where it and
// this file disagree, the doc wins and this file has a bug.
//
// Usage: node scripts/validate-forest.mjs <vault-dir> [--concepts <concepts.yaml>] [--lenient]
//
// Prints "error:" / "warning:" lines; exits 1 iff there are errors.
// --lenient downgrades unknown teaches/requires concept ids from error to
// warning (useful while the registry lags behind a fresh digest).

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

// A forest-0.1 vault is a forest-0.2 vault with no structure layer: both
// validate, but the structure taxa and keys are errors under 0.1 so nothing
// migrates silently. forest-0.3 splits the structure layer in two levels —
// kinds and their instances — and the same rule holds one version up: the
// two-level keys are errors in 0.2, and 0.2's own are errors in 0.3.
const SCHEMA_VERSIONS = ["forest-0.1", "forest-0.2", "forest-0.3"];
const STRUCTURE_VERSION = "forest-0.2";
const TWO_LEVEL_VERSION = "forest-0.3";
const STRUCTURE_VERSIONS = new Set([STRUCTURE_VERSION, TWO_LEVEL_VERSION]);
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
  obj: "object",
  mor: "morphism",
};
const TAXA = new Set(Object.values(PREFIX_TO_TAXON));

// The structure layer (forest-0.2 and up): kinds of structure and the arrows
// between them. `pt` is the one id of 0.2 that is not a tree — the empty
// source of an instance arrow; 0.3 has no such id.
const STRUCTURE_TAXA = new Set(["object", "morphism"]);
const POINT = "pt";
// Eight kinds in 0.2, seven in 0.3: `instance`, the degenerate construction
// out of `pt`, becomes an instance object. Insertion order is the order the
// error message lists them in.
const MORPHISM_KINDS = new Set([
  "data",
  "transform",
  "extract",
  "property",
  "instance",
  "generalizes",
  "construction",
  "hom",
]);
const MORPHISM_KINDS_TWO_LEVEL = new Set([...MORPHISM_KINDS].filter((k) => k !== "instance"));
const BASE_KEYS = ["id", "taxon", "title", "teaches", "requires", "depends", "source", "standalone", "origin", "language", "digested_from", "proves", "adapted_from"];
// Any tree may say which objects and arrows it is about, for which fields,
// and which principles of the formal system it assumes; from 0.3, also which
// region of the canvas it belongs to.
const ABOUT_KEYS = ["about", "fields", "assumes"];
const REGION_KEYS = ["region"];
const OBJECT_KEYS = ["symbol", "hom", "type", "same_as", "nlab"];
// `type` and `values` stay listed under 0.3 so a half-migrated vault gets the
// rule that names the replacement instead of a bare "unknown key".
const OBJECT_KEYS_TWO_LEVEL = ["symbol", "hom", "instance_of", "data", "values", "pos", "type", "same_as", "nlab"];
const MORPHISM_KEYS = ["kind", "from", "to", "statement", "label", "acts_on", "needs", "on_homomorphisms", "functorial", "invertible", "inverse", "up_to", "generalized_by", "values"];
const OBJECT_ID = /^obj-[a-z0-9]+(-[a-z0-9]+)*$/;
const DEFINITION_HEADING = /^##\s+(Definicija|Definition)\s*$/m;

// The taxa a proof can prove. Axioms are assumed, not proved, so they are
// deliberately not here even though they are formal statements.
const PROVABLE_TAXA = new Set(["theorem", "lemma", "proposition", "corollary"]);

// Who authored a tree's content. Absent means "digest" — re-authored from the
// source work — so every pre-origin tree keeps its meaning unchanged.
const ORIGINS = new Set(["digest", "member", "agent"]);

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
  const structure = STRUCTURE_VERSIONS.has(forest?.schema_version);
  const twoLevel = forest?.schema_version === TWO_LEVEL_VERSION;
  const regions = new Set(
    Array.isArray(forest?.regions)
      ? forest.regions.filter(isPlainObject).map((r) => r.id)
      : []
  );
  const trees = loadTrees(vaultDir, err);
  checkTrees(trees, { derivative, registry, lenient, structure, twoLevel }, err, warn);
  if (structure) checkStructure(trees, { twoLevel, regions }, err, warn);
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

// An authored position on the canvas, in the same units the computed layout
// uses: [x, y], growing right and down.
function isPos(v) {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
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

  const twoLevel = forest.schema_version === TWO_LEVEL_VERSION;
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
      // Regions group the canvas, so they arrive with the two-level model and
      // are an unknown key before it.
      ...(twoLevel ? ["regions"] : []),
    ]),
    ctx,
    err
  );

  if (twoLevel && forest.regions !== undefined) {
    checkRegions(forest.regions, ctx, err);
  }

  if (!SCHEMA_VERSIONS.includes(forest.schema_version)) {
    err(
      `${ctx}: schema_version must be one of ${SCHEMA_VERSIONS.map((v) => `"${v}"`).join(", ")}, got ${JSON.stringify(forest.schema_version)}`
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
  // Producers of a vault, not a free-text field: an export is not a digest
  // and must not claim to be one, but it is still a vault.
  if (!["forest-digest", "matsek-library-export"].includes(forest.tool)) {
    err(`${ctx}: tool must be one of "forest-digest", "matsek-library-export"`);
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

// The declared regions of the canvas, in the order the page lays them out. A
// tree may carry a region that is not declared — it lands in an unlabelled
// area — so the declaration is checked for shape only.
function checkRegions(regions, ctx, err) {
  if (!Array.isArray(regions)) {
    err(`${ctx}: regions must be an array of { id, title }, in the order the page lays them out`);
    return;
  }
  const seen = new Set();
  regions.forEach((r, i) => {
    const rctx = `${ctx}: regions[${i}]`;
    if (!isPlainObject(r)) {
      err(`${rctx} must be an object { id, title }`);
      return;
    }
    checkKeys(r, new Set(["id", "title"]), rctx, err);
    if (typeof r.id !== "string" || !KEBAB.test(r.id)) {
      err(`${rctx}.id must be a kebab-case token (e.g. "valuation")`);
    } else if (seen.has(r.id)) {
      err(`${rctx}.id "${r.id}" is declared twice — one region per id`);
    } else {
      seen.add(r.id);
    }
    if (typeof r.title !== "string" || r.title.trim() === "") {
      err(`${rctx}.title must be a non-empty label in the vault's language`);
    }
  });
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

function checkTrees(trees, { derivative, registry, lenient, structure, twoLevel }, err, warn) {
  const conceptProblem = lenient ? warn : err;

  for (const t of trees.values()) {
    const { file, stem, fm, body } = t;
    // The allowed keys follow the taxon: a 0.1 vault knows only the base set,
    // so a structure key there is an unknown key, not a half-migrated tree.
    const allowed = [...BASE_KEYS];
    if (structure) {
      allowed.push(...ABOUT_KEYS);
      if (twoLevel) allowed.push(...REGION_KEYS);
      if (fm.taxon === "object") allowed.push(...(twoLevel ? OBJECT_KEYS_TWO_LEVEL : OBJECT_KEYS));
      if (fm.taxon === "morphism") allowed.push(...MORPHISM_KEYS);
    }
    checkKeys(fm, new Set(allowed), file, err);

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
    if (!structure && (STRUCTURE_TAXA.has(fm.taxon) || STRUCTURE_TAXA.has(PREFIX_TO_TAXON[prefix]))) {
      err(`${file}: taxon "${PREFIX_TO_TAXON[prefix] ?? fm.taxon}" (id prefix "${prefix}-") needs forest.json schema_version "${STRUCTURE_VERSION}" or "${TWO_LEVEL_VERSION}" — a forest-0.1 vault has no structure layer`);
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
    // Communal forests (the library) hold hr and en trees side by side —
    // a per-tree language overrides the vault default for that tree only.
    if (fm.language !== undefined && !["hr", "en"].includes(fm.language)) {
      err(`${file}: language must be "hr" or "en" when present`);
    }
    // The canonicity pointer (spec D-007): a tree digested from a library
    // bundle names it, so staleness against the still-canonical blog is
    // visible rather than silent.
    // Attribution for a tree adapted from a named CC BY-or-freer work,
    // same meaning as bundle spec v1's field: a free-text citation, not an
    // id, because the source lives outside every registry we control.
    if (fm.adapted_from !== undefined && (typeof fm.adapted_from !== "string" || fm.adapted_from.trim() === "")) {
      err(`${file}: adapted_from must be a non-empty citation string`);
    }
    if (fm.digested_from !== undefined && (typeof fm.digested_from !== "string" || !/^(problem|proof|blog)\/[a-z0-9-]+$/.test(fm.digested_from))) {
      err(`${file}: digested_from must be a bundle id like "blog/<slug>"`);
    }
    if (fm.origin !== undefined && !ORIGINS.has(fm.origin)) {
      err(`${file}: origin must be "digest", "member" or "agent", got ${JSON.stringify(fm.origin)}`);
    }

    // In a derivative vault the per-tree pointer is the provenance trail —
    // without pages a reader with the book cannot find the original. That
    // applies only to digest-origin trees; a member/agent tree is NOT from
    // the source, so carrying source.pages would be a confused provenance
    // claim (the stray-adapted_from error of bundle v1).
    if (derivative) {
      const origin = ORIGINS.has(fm.origin) ? fm.origin : fm.origin === undefined ? "digest" : null;
      if (origin === "digest") {
        if (!isPlainObject(fm.source)) {
          err(`${file}: source is required in a derivative vault (missing source.pages)`);
        } else if (typeof fm.source.pages !== "string" || fm.source.pages.length === 0) {
          err(`${file}: source.pages is required in a derivative vault`);
        }
      } else if (origin !== null && isPlainObject(fm.source) && fm.source.pages !== undefined) {
        err(`${file}: a tree with origin "${origin}" must not carry source.pages — it is not from the source work`);
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

    // `proves` names a proof's anchor explicitly — required knowledge the
    // depends heuristic cannot recover once a proof leans on several
    // statements, or proves an exercise (solutions are proofs too, but
    // exercise stays outside PROVABLE so theorems don't fold under drills).
    if (fm.proves !== undefined) {
      if (fm.taxon !== "proof") {
        err(`${file}: proves is only meaningful on proof trees`);
      } else {
        const target = trees.get(fm.proves)?.fm;
        if (!target) {
          err(`${file}: proves names unknown tree "${fm.proves}"`);
        } else if (!PROVABLE_TAXA.has(target.taxon) && target.taxon !== "exercise") {
          err(`${file}: proves must name a statement or exercise tree, not a ${target.taxon}`);
        } else if (!(isStringArray(fm.depends) && fm.depends.includes(fm.proves))) {
          err(`${file}: proves target "${fm.proves}" must also appear in depends`);
        }
      }
    }
    // Without proves, the old heuristic stands: exactly one statement-taxon
    // dependency, or the anchor is ambiguous/absent.
    if (fm.taxon === "proof" && fm.proves === undefined && isStringArray(fm.depends)) {
      const statements = fm.depends.filter((d) =>
        PROVABLE_TAXA.has(trees.get(d)?.fm?.taxon)
      );
      if (statements.length === 0) {
        err(`${file}: proof tree must depend on exactly one statement tree (theorem/lemma/proposition/corollary), or name its anchor with proves:; found none`);
      } else if (statements.length > 1) {
        warn(`${file}: proof depends on ${statements.length} statement trees (${statements.join(", ")}) — add proves: to name the one it proves`);
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

// ------------------------------------------------------------------ structure

// forest-0.2 and up. Objects are kinds of structure, morphisms the
// constructions between them — or, for kind hom, the maps inside one kind.
// from/to arrows are not prerequisites and may form cycles (curry/uncurry) and
// loops, so nothing here feeds checkDag — depends still does, and objects and
// morphisms sit in that DAG like any tree.
//
// Under 0.3 an object is either a KIND or an INSTANCE of one, and the level
// decides what may touch it: constructions run between kinds, homs between
// instances. One key names the level in each version, so the resolvers below
// take it as a parameter rather than branching twice.
function checkStructure(trees, { twoLevel, regions }, err, warn) {
  const LEVEL_KEY = twoLevel ? "instance_of" : "type";
  const treeOfTaxon = (id, taxon) => {
    const t = typeof id === "string" ? trees.get(id) : undefined;
    return t && t.fm.taxon === taxon ? t : null;
  };
  // The kind a box belongs to: what it is an instance of (0.2: its type), or
  // itself. Undefined while that key is broken, so a bad pointer is reported
  // once and not again by every hom arrow that touches the box.
  const rootType = (id) => {
    const t = treeOfTaxon(id, "object");
    if (!t) return undefined;
    if (t.fm[LEVEL_KEY] === undefined) return t.stem;
    const kind = treeOfTaxon(t.fm[LEVEL_KEY], "object");
    return kind && kind.fm[LEVEL_KEY] === undefined ? kind.stem : undefined;
  };
  // Instance or kind, for an id that need not be an object at all.
  const isInstance = (id) => {
    const t = treeOfTaxon(id, "object");
    return t ? t.fm[LEVEL_KEY] !== undefined : null;
  };
  // Which kinds each arrow is a defining component of. A hom between instances
  // of two different kinds is legal exactly as a component of such a diagram —
  // the valuation $v\colon K\to\Gamma$ — and this is where that is checked.
  // Keeping the anchoring kinds, not just the arrow ids, is what stops `data`
  // from laundering a particular arrow between two named instances into a
  // "definition": the kind a component arrow defines is a third kind, neither
  // end's own.
  const componentAnchors = new Map();
  if (twoLevel) {
    for (const t of trees.values()) {
      if (t.fm.taxon !== "object" || !isStringArray(t.fm.data)) continue;
      for (const id of t.fm.data) {
        if (!treeOfTaxon(id, "morphism")) continue;
        if (!componentAnchors.has(id)) componentAnchors.set(id, new Set());
        componentAnchors.get(id).add(t.stem);
      }
    }
  }
  const anchoredByThirdKind = (id, a, b) => {
    const anchors = componentAnchors.get(id);
    if (!anchors) return false;
    for (const k of anchors) if (k !== a && k !== b) return true;
    return false;
  };
  // LaTeX fields are typeset whole, so a $ inside them is a stray delimiter
  // that KaTeX would print as an error, not math.
  const latex = (file, key, v) => {
    if (typeof v !== "string" || v.trim() === "") {
      err(`${file}: ${key} must be a non-empty LaTeX string`);
    } else if (v.includes("$")) {
      err(`${file}: ${key} must be LaTeX without $ delimiters — it is typeset whole`);
    }
  };
  const sentence = (file, key, v) => {
    if (typeof v !== "string" || v.trim() === "") {
      err(`${file}: ${key} must be one sentence (a string; inline $…$ math allowed)`);
    }
  };

  // What each arrow out of the kind yields here. The key must be such an
  // arrow, so a value cannot claim a computation the graph does not have.
  const checkValuesAgainst = (file, kindId, label, values) => {
    if (!isPlainObject(values)) {
      err(`${file}: values must be a mapping from mor- ids to one sentence each`);
      return;
    }
    for (const [id, v] of Object.entries(values)) {
      const m = treeOfTaxon(id, "morphism");
      if (!m) {
        err(`${file}: values key "${id}" must name a morphism tree`);
      } else if (kindId !== null && m.fm.from !== kindId) {
        err(`${file}: values key "${id}" is an arrow out of "${m.fm.from}", not out of ${label} "${kindId}" (see ${m.file}: from)`);
      }
      if (typeof v !== "string" || v.trim() === "") {
        err(`${file}: values["${id}"] must be one sentence`);
      }
    }
  };

  // A kind is defined by a diagram over instances of OTHER kinds: the boxes
  // and the arrows between them that constitute it. Both ends of each arrow
  // must be in the diagram, or the picture is not the definition it claims;
  // and an instance of the kind being defined would make the definition
  // circular, besides turning `data` into a way to legalise any arrow at all.
  const checkDataDiagram = (file, stem, data) => {
    if (!isStringArray(data)) {
      err(`${file}: data must be an array of obj-/mor- ids — the instances and the arrows between them that define this kind`);
      return;
    }
    const inside = new Set(data);
    for (const id of data) {
      const t = trees.get(id);
      if (!t) {
        err(`${file}: data names unknown tree "${id}"`);
      } else if (t.fm.taxon === "object") {
        if (t.fm.instance_of === undefined) {
          err(`${file}: data entry "${id}" is a kind — a defining diagram is drawn over instances, so name an instance of it (an obj- tree with instance_of: ${id})`);
        } else if (t.fm.instance_of === stem) {
          err(`${file}: data entry "${id}" is an instance of this very kind — a defining diagram is drawn over instances of OTHER kinds, so what defines this one cannot already be an example of it`);
        }
        // A component may be determined by another component — the vertex set
        // of the dissection the diagram already names — and `about` is how a
        // tree says so. What it may not be is a link of a proof's chain: an
        // `about` reaching an instance OUTSIDE the diagram drops a named object
        // the proof constructs into a definition, which is the level mixing
        // this version exists to keep out.
        if (isStringArray(t.fm.about)) {
          for (const a of t.fm.about) {
            const o = treeOfTaxon(a, "object");
            if (!o || o.fm.instance_of === undefined || inside.has(a)) continue;
            err(`${file}: data entry "${id}" is about instance "${a}", which this diagram does not contain (see ${t.file}: about) — a component may be determined by another component of the same diagram, but an instance on a proof's chain is part of no definition: list "${a}" here too, or leave this kind primitive`);
          }
        }
      } else if (t.fm.taxon === "morphism") {
        for (const end of ["from", "to"]) {
          if (typeof t.fm[end] === "string" && !inside.has(t.fm[end])) {
            err(`${file}: data entry "${id}" has ${end} "${t.fm[end]}" outside the diagram — an arrow of a defining diagram has both ends inside it`);
          }
        }
      } else {
        err(`${file}: data entry "${id}" is a ${t.fm.taxon}, not an object or a morphism`);
      }
    }
  };

  for (const t of trees.values()) {
    const { file, fm } = t;

    if (fm.about !== undefined) {
      if (!isStringArray(fm.about)) {
        err(`${file}: about must be an array of obj-/mor- ids`);
      } else {
        for (const id of fm.about) {
          const target = trees.get(id);
          if (!target) {
            err(`${file}: about names unknown tree "${id}"`);
          } else if (!STRUCTURE_TAXA.has(target.fm.taxon)) {
            err(`${file}: about entry "${id}" is a ${target.fm.taxon}, not an object or morphism`);
          }
        }
      }
    }
    if (fm.fields !== undefined && !(isStringArray(fm.fields) && fm.fields.every((f) => KEBAB.test(f)))) {
      err(`${file}: fields must be an array of kebab-case words (e.g. algebra, kombinatorika)`);
    }
    if (fm.assumes !== undefined && !(isStringArray(fm.assumes) && fm.assumes.every((a) => KEBAB.test(a)))) {
      err(`${file}: assumes must be an array of kebab-case tokens (e.g. axiom-of-choice, excluded-middle)`);
    }
    if (twoLevel && fm.region !== undefined) {
      if (typeof fm.region !== "string" || !KEBAB.test(fm.region)) {
        err(`${file}: region must be a kebab-case token naming a region of the canvas`);
      } else if (regions.size > 0 && !regions.has(fm.region)) {
        warn(`${file}: region "${fm.region}" is not among forest.json regions — the page draws this tree in an unlabelled area`);
      }
    }

    if (fm.taxon === "object") checkObject(t);
    if (fm.taxon === "morphism") checkMorphism(t);
  }

  // Coverage, as warnings: a kind nobody has instantiated or placed among
  // wider/narrower kinds is a box with no example and no context. An instance
  // (0.2: a typed object) is a box of a kind that answers for all three itself.
  const instanced = new Set();
  const generalized = new Set();
  for (const t of trees.values()) {
    // 0.3 counts an instance object; 0.2 counts an instance arrow, and a typed
    // box there is not an example of its type, so the two never mix.
    if (twoLevel && t.fm.taxon === "object" && typeof t.fm.instance_of === "string") {
      instanced.add(t.fm.instance_of);
    }
    if (t.fm.taxon !== "morphism") continue;
    if (!twoLevel && t.fm.kind === "instance") instanced.add(t.fm.to);
    if (t.fm.kind === "generalizes") {
      generalized.add(t.fm.from);
      generalized.add(t.fm.to);
    }
  }
  for (const t of trees.values()) {
    if (t.fm.taxon !== "object" || t.fm[LEVEL_KEY] !== undefined) continue;
    if (!instanced.has(t.stem)) {
      warn(
        twoLevel
          ? `${t.file}: object has no instance (an obj- tree with instance_of: ${t.stem}) — give the kind an example`
          : `${t.file}: object has no instance arrow (a mor- tree with kind: instance, to: ${t.stem}) — give it an example`
      );
    }
    if (!generalized.has(t.stem)) {
      warn(`${t.file}: object has no generalizes arrow in either direction — say what it specializes, or what specializes it`);
    }
    if (!DEFINITION_HEADING.test(t.body)) {
      warn(`${t.file}: object body has no "## Definicija" / "## Definition" heading`);
    }
  }

  function checkObject({ file, stem, fm }) {
    latex(file, "symbol", fm.symbol);
    if (twoLevel && fm.type !== undefined) {
      err(`${file}: type was replaced by instance_of in forest-0.3 — an object is a kind (no instance_of) or an instance of one`);
    }
    if (fm[LEVEL_KEY] === undefined) {
      sentence(file, "hom", fm.hom);
      if (twoLevel) {
        if (fm.values !== undefined) {
          err(`${file}: values belongs to an instance — an arrow out of a kind applies to every instance of it, so there is nothing for the kind itself to yield`);
        }
        if (fm.data !== undefined) checkDataDiagram(file, stem, fm.data);
      }
    } else {
      // One level only: an instance inherits its kind's hom, so what it names
      // must be the kind's own box, the one that states it.
      const kind = treeOfTaxon(fm[LEVEL_KEY], "object");
      if (!kind) {
        err(`${file}: ${LEVEL_KEY} ${JSON.stringify(fm[LEVEL_KEY])} must name an object (obj-) tree in this vault`);
      } else if (fm[LEVEL_KEY] === stem) {
        err(
          twoLevel
            ? `${file}: instance_of names the object itself — an instance names the kind it is an instance of`
            : `${file}: type names the object itself — the kind's own box carries no type`
        );
      } else if (kind.fm[LEVEL_KEY] !== undefined) {
        err(
          twoLevel
            ? `${file}: instance_of "${fm[LEVEL_KEY]}" is itself an instance (see ${kind.file}: instance_of) — one level only, name the kind this is an instance of`
            : `${file}: type "${fm[LEVEL_KEY]}" is itself typed (see ${kind.file}: type) — one level only, name the kind both are objects of`
        );
      }
      if (fm.hom !== undefined) sentence(file, "hom", fm.hom);
      if (twoLevel) {
        if (fm.data !== undefined) {
          err(`${file}: data belongs to a kind — an instance carries values, not a defining diagram`);
        }
        if (fm.values !== undefined) {
          checkValuesAgainst(file, rootType(stem) ?? null, "this instance's kind", fm.values);
        }
      }
    }
    if (twoLevel && fm.pos !== undefined && !isPos(fm.pos)) {
      err(`${file}: pos must be [x, y] — two finite numbers in canvas units`);
    }
    // Cross-vault identity points into the library forest, which is another
    // repository — only the shape is checked here; grow resolves it.
    if (fm.same_as !== undefined && !(typeof fm.same_as === "string" && OBJECT_ID.test(fm.same_as))) {
      err(`${file}: same_as must be a library object id like "obj-group-action"`);
    }
    if (fm.nlab !== undefined) {
      if (!isPlainObject(fm.nlab)) {
        err(`${file}: nlab must be an object {title, revision}`);
      } else {
        checkKeys(fm.nlab, new Set(["title", "revision"]), `${file}: nlab`, err);
        if (typeof fm.nlab.title !== "string" || fm.nlab.title.trim() === "") {
          err(`${file}: nlab.title must be the nLab page title`);
        }
        if (!Number.isInteger(fm.nlab.revision)) {
          err(`${file}: nlab.revision must be an integer`);
        }
      }
    }
  }

  function checkMorphism({ file, stem, fm }) {
    const kinds = twoLevel ? MORPHISM_KINDS_TWO_LEVEL : MORPHISM_KINDS;
    if (!kinds.has(fm.kind)) {
      if (twoLevel && fm.kind === "instance") {
        err(`${file}: kind "instance" was removed in forest-0.3 — an example is an instance object now (taxon object, instance_of: ${JSON.stringify(fm.to)}), and its values go on that object`);
      } else {
        err(`${file}: kind must be one of ${[...kinds].join(", ")}, got ${JSON.stringify(fm.kind)}`);
      }
    }
    const instance = !twoLevel && fm.kind === "instance";
    const hom = fm.kind === "hom";

    if (typeof fm.from !== "string") {
      err(`${file}: from must be an object id${twoLevel ? "" : ` (or "${POINT}" on an instance arrow)`}`);
    } else if (fm.from === POINT) {
      if (twoLevel) {
        err(`${file}: from "${POINT}" was removed in forest-0.3 — the example it stood for is an instance object (taxon object, instance_of: ${JSON.stringify(fm.to)})`);
      } else if (!instance) {
        err(`${file}: from is "${POINT}" but kind is ${JSON.stringify(fm.kind)} — ${POINT} is reserved for instance arrows`);
      }
    } else if (instance) {
      err(`${file}: from must be "${POINT}" on an instance arrow (got "${fm.from}") — an example has no source structure`);
    } else if (!treeOfTaxon(fm.from, "object")) {
      err(`${file}: from "${fm.from}" must name an object (obj-) tree in this vault`);
    }
    if (!treeOfTaxon(fm.to, "object")) {
      err(`${file}: to ${JSON.stringify(fm.to)} must name an object (obj-) tree in this vault`);
    }

    latex(file, "statement", fm.statement);
    if (fm.label !== undefined) latex(file, "label", fm.label);
    if (fm.needs !== undefined && !(isStringArray(fm.needs) && fm.needs.every((s) => s.trim() !== ""))) {
      err(`${file}: needs must be an array of sentences naming extra data (may be empty)`);
    }
    if (twoLevel && fm.values !== undefined) {
      err(`${file}: values moved onto the instance object in forest-0.3 — put it on the obj- tree carrying instance_of, keyed by the arrows out of its kind`);
    }

    // The two levels decide what each end of an arrow may be: a construction
    // out of a kind applies to every instance of it, while a hom is one map
    // between two structures, so its ends are instances.
    if (twoLevel) {
      for (const end of ["from", "to"]) {
        const at = isInstance(fm[end]);
        if (at === null) continue;
        if (hom && at === false) {
          err(`${file}: ${end} "${fm[end]}" is a kind — a hom joins two instances (it is one map between two structures), never two kinds`);
        } else if (!hom && at === true) {
          err(`${file}: ${end} "${fm[end]}" is an instance (instance_of: ${trees.get(fm[end]).fm.instance_of}) — a ${fm.kind} arrow runs between kinds and applies to every instance of its source`);
        }
      }
    }

    if (instance) {
      for (const key of ["acts_on", "on_homomorphisms", "functorial"]) {
        if (fm[key] !== undefined) {
          err(`${file}: ${key} is not allowed on an instance arrow — there is no source structure to act on`);
        }
      }
      if (fm.values !== undefined) {
        checkValuesAgainst(file, fm.to, "this instance's target", fm.values);
      }
    } else if (hom) {
      // A hom is itself a map between two structures of one kind, so the keys
      // that say how a construction treats such maps have nothing to describe.
      for (const key of ["acts_on", "on_homomorphisms", "functorial", ...(twoLevel ? [] : ["values"])]) {
        if (fm[key] !== undefined) {
          err(`${file}: ${key} is not allowed on a hom arrow — it is itself a map, not a construction acting on maps`);
        }
      }
      if (fm.needs === undefined) {
        err(`${file}: needs is required — the extra data the map depends on beyond its two ends (may be [])`);
      }
      const a = rootType(fm.from);
      const b = rootType(fm.to);
      if (a && b && a !== b) {
        if (!twoLevel) {
          err(`${file}: a hom arrow joins two objects of one type, but from "${fm.from}" is of type "${a}" and to "${fm.to}" of type "${b}"`);
        } else if (isInstance(fm.from) && isInstance(fm.to) && !anchoredByThirdKind(stem, a, b)) {
          // Two instances of one kind: a morphism in that kind's category.
          // Two instances of different kinds: a component of a definition —
          // the valuation out of a field — and then some kind's `data` has to
          // say which definition, or the arrow is a claim about nothing. That
          // kind is a third one: a definition drawn over an instance of either
          // end's own kind would be circular, and allowing it would let `data`
          // legalise any arrow between any two named instances.
          err(`${file}: a hom joins two instances of one kind, but from "${fm.from}" is an instance of "${a}" and to "${fm.to}" of "${b}" — an arrow between instances of different kinds is a component of a definition, so list it in the data of the kind it defines, which is a third kind, neither "${a}" nor "${b}"`);
        }
      }
      if (fm.invertible !== undefined && typeof fm.invertible !== "boolean") {
        err(`${file}: invertible must be true or false`);
      }
    } else {
      if (!twoLevel && fm.values !== undefined) {
        err(`${file}: values is only allowed on an instance arrow (kind: instance)`);
      }
      if (fm.acts_on === undefined) {
        err(`${file}: acts_on is required — "all" or a list of data arrows out of ${JSON.stringify(fm.from)}`);
      } else if (fm.acts_on !== "all") {
        if (!isStringArray(fm.acts_on)) {
          err(`${file}: acts_on must be "all" or an array of mor- ids`);
        } else {
          for (const id of fm.acts_on) {
            const m = treeOfTaxon(id, "morphism");
            if (!m) {
              err(`${file}: acts_on entry "${id}" must name a morphism tree`);
            } else if (m.fm.kind !== "data") {
              err(`${file}: acts_on entry "${id}" has kind ${JSON.stringify(m.fm.kind)} — acts_on lists data arrows only`);
            } else if (m.fm.from !== fm.from) {
              err(`${file}: acts_on entry "${id}" is an arrow out of "${m.fm.from}", not out of this arrow's source ${JSON.stringify(fm.from)} (see ${m.file}: from)`);
            }
          }
        }
      }
      if (fm.needs === undefined) {
        err(`${file}: needs is required — the extra data the arrow consumes beyond its source (may be [])`);
      }
      sentence(file, "on_homomorphisms", fm.on_homomorphisms);
      if (typeof fm.functorial !== "boolean") {
        err(`${file}: functorial must be true or false`);
      } else if (fm.kind === "generalizes" && fm.functorial !== true) {
        err(`${file}: a generalizes arrow must be functorial: true — a map of the narrower kind is a map of the wider one`);
      }
    }

    if (!hom && fm.invertible !== undefined) {
      err(`${file}: invertible is only allowed on a hom arrow (kind: hom) — between kinds, inverse marks the isomorphism`);
    }

    if (fm.inverse !== undefined) {
      const m = treeOfTaxon(fm.inverse, "morphism");
      if (!m) {
        err(`${file}: inverse ${JSON.stringify(fm.inverse)} must name a morphism tree`);
      } else if (m.fm.inverse !== stem) {
        err(`${file}: inverse "${fm.inverse}" does not point back — ${m.file} must carry inverse: ${stem}`);
      } else if (m.fm.from !== fm.to || m.fm.to !== fm.from) {
        // Without this an arrow and a loop could call each other inverse;
        // the views then fold the loop into the other edge and it vanishes.
        err(`${file}: inverse "${fm.inverse}" must run the other way — it goes ${m.fm.from} → ${m.fm.to}, not ${fm.to} → ${fm.from}`);
      }
      if (hom && fm.invertible === false) {
        err(`${file}: a hom with an inverse cannot be invertible: false`);
      }
    }
    // The pair stays symmetric; up_to only says the round trip is the
    // identity up to the isomorphism that tree states, on either side or both.
    if (fm.up_to !== undefined) {
      if (fm.inverse === undefined) {
        err(`${file}: up_to needs inverse — it names the tree stating the canonical isomorphism the inverse holds up to`);
      }
      if (typeof fm.up_to !== "string" || !trees.has(fm.up_to)) {
        err(`${file}: up_to ${JSON.stringify(fm.up_to)} must name a tree in this vault`);
      }
    }
    if (fm.generalized_by !== undefined) {
      if (!isStringArray(fm.generalized_by)) {
        err(`${file}: generalized_by must be an array of mor- ids`);
      } else {
        for (const id of fm.generalized_by) {
          if (!treeOfTaxon(id, "morphism")) {
            err(`${file}: generalized_by entry "${id}" must name a morphism tree`);
          }
        }
      }
    }
  }
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
