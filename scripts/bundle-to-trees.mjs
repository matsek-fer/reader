#!/usr/bin/env node
// Mechanical bootstrap of the library forest (spec D-007): problem and proof
// bundles become tree pairs, deterministically, carrying their bundle's
// author/provenance and a digested_from pointer. Blogs are NOT converted here
// — re-authoring narrative prose into standalone trees is judgment work for
// an agent, not string surgery. Two proof bundles of the same theorem yield
// two statement trees; that duplication is known bootstrap debt the tree-level
// merge tooling exists to pay down, and hiding it here would just launder it.
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: node scripts/bundle-to-trees.mjs <library-dir> <forest-dir> [--bundle <id>]");
  process.exit(2);
}
const [libDir, forestDir] = args;
const onlyBundle = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
const treesDir = path.join(forestDir, "trees");
fs.mkdirSync(treesDir, { recursive: true });

const read = (f) => fs.readFileSync(f, "utf8").trim();
const yq = (s) => JSON.stringify(s); // YAML-safe double-quoted scalar for our charset

// Re-running the bootstrap must not destroy hand-wiring. Mechanical fields are
// re-derived from the bundle; the graph edges and any tool-private keys a
// digestion added afterwards are the forest's work, not this script's, and are
// carried over. Found the hard way: the first blog digestion attached six
// edges to converted trees that a second bootstrap run would have erased.
const MECHANICAL = new Set(["id", "taxon", "title", "teaches", "requires", "language", "digested_from", "standalone", "x_annotation"]);
let preserved = 0;
function existingFrontmatter(id) {
  const f = path.join(treesDir, `${id}.md`);
  if (!fs.existsSync(f)) return null;
  const m = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(f, "utf8"));
  return m ? load(m[1]) ?? {} : null;
}

function treeFile(id, fm, body) {
  const prior = existingFrontmatter(id);
  if (prior) {
    let kept = false;
    for (const [k, v] of Object.entries(prior)) {
      const mechanicalDefault = k === "depends" && Array.isArray(fm.depends) && fm.depends.length === 0;
      if (!MECHANICAL.has(k) || mechanicalDefault) {
        if (JSON.stringify(fm[k]) !== JSON.stringify(v)) kept = true;
        fm[k] = v;
      }
    }
    if (kept) preserved++;
  }
  const lines = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined) continue;
    lines.push(Array.isArray(v) ? `${k}: [${v.join(", ")}]` : `${k}: ${typeof v === "string" ? yq(v) : v}`);
  }
  lines.push("---", "", body, "");
  fs.writeFileSync(path.join(treesDir, `${id}.md`), lines.join("\n"));
  return id;
}

const made = [];
for (const type of ["problems", "proofs"]) {
  const base = path.join(libDir, type);
  if (!fs.existsSync(base)) continue;
  for (const slug of fs.readdirSync(base).sort()) {
    const dir = path.join(base, slug);
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    const m = JSON.parse(read(manifestPath));
    if (onlyBundle && m.id !== onlyBundle) continue;
    const common = {
      teaches: m.teaches ?? [],
      requires: m.requires ?? [],
      language: m.language,
      digested_from: m.id,
      standalone: true,
    };
    // x_annotation keeps the bundle's retrieval prose without polluting the
    // tree body; index-vault embeds it alongside title + body.
    const ann = fs.existsSync(path.join(dir, "annotation.md")) ? read(path.join(dir, "annotation.md")) : undefined;
    if (type === "problems") {
      const stmtId = `exr-${slug}`;
      const prfId = `prf-${slug}`;
      treeFile(stmtId, { id: stmtId, taxon: "exercise", title: m.title, ...common, depends: [], x_annotation: ann }, read(path.join(dir, "problem.md")));
      treeFile(prfId, {
        id: prfId, taxon: "proof", title: `Rješenje: ${m.title}`, teaches: common.teaches,
        requires: common.requires, language: m.language, digested_from: m.id, standalone: true,
        depends: [stmtId], proves: stmtId,
      }, read(path.join(dir, "solution.md")));
      made.push(stmtId, prfId);
    } else {
      const stmtId = `thm-${slug}`;
      const prfId = `prf-${slug}`;
      treeFile(stmtId, { id: stmtId, taxon: "theorem", title: m.title, ...common, depends: [], x_annotation: ann }, read(path.join(dir, "statement.md")));
      treeFile(prfId, {
        id: prfId, taxon: "proof", title: `Dokaz: ${m.title}`, teaches: common.teaches,
        requires: common.requires, language: m.language, digested_from: m.id, standalone: true,
        depends: [stmtId], proves: stmtId,
      }, read(path.join(dir, "proof.md")));
      made.push(stmtId, prfId);
    }
  }
}

// index.md: regenerate the mechanical sections between markers so agent-added
// sections (digested blogs) survive reruns.
const indexPath = path.join(forestDir, "index.md");
const BEGIN = "<!-- bundle-to-trees:begin -->", END = "<!-- bundle-to-trees:end -->";
const exr = made.filter((i) => i.startsWith("exr-"));
const thm = made.filter((i) => i.startsWith("thm-"));
const block = [BEGIN,
  "", "## Zadatci iz zbirke", "", ...exr.map((i) => `- [[${i}]]`),
  "", "## Dokazi iz zbirke", "", ...thm.map((i) => `- [[${i}]]`), "", END].join("\n");
let idx = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "# MatSek šuma\n\nZajednička šuma knjižnice (spec D-007): stabla su sloj u koji se spaja.\n\n";
idx = idx.includes(BEGIN)
  ? idx.slice(0, idx.indexOf(BEGIN)) + block + idx.slice(idx.indexOf(END) + END.length)
  : idx.trimEnd() + "\n\n" + block + "\n";
fs.writeFileSync(indexPath, idx);
console.log(`bundle-to-trees: ${made.length} tree(s) from ${made.length / 2} bundle(s)` + (preserved ? `; preserved hand-added frontmatter on ${preserved}` : ""));
