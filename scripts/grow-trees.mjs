#!/usr/bin/env node
// Tree-level merge into the library forest (spec D-007). The mechanical half:
// firewall, id collision handling, edge rewriting, attribution. The judgment
// half — which trees are worth merging, which existing tree an edge should
// point at, whether something is a duplicate — belongs to the /grow skill
// reading match-trees.mjs output, and is expressed here only as --remap.
//
// usage: node scripts/grow-trees.mjs <vault-dir> <forest-dir> --trees id[,id…]
//        --out <scratch-dir> [--remap vaultId=forestId[,…]] [--prefix p]
//        [--attribution "<citation>"]
//
// Writes candidate trees to <scratch-dir>/ for review; it never touches the
// forest itself — placing files is the skill's stage, after the member has
// affirmed provenance on the exact bytes.
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

const args = process.argv.slice(2);
const flag = (name, fallback = null) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (args.length < 2 || !flag("--trees") || !flag("--out")) {
  console.error("usage: node scripts/grow-trees.mjs <vault-dir> <forest-dir> --trees id[,id…] --out <dir> [--remap a=b,…] [--prefix p] [--attribution \"…\"]");
  process.exit(2);
}
const [vaultDir, forestDir] = args;
const picked = flag("--trees").split(",").map((s) => s.trim()).filter(Boolean);
const outDir = flag("--out");
const prefix = flag("--prefix", "");
const attribution = flag("--attribution");
const remap = new Map(
  (flag("--remap", "") || "").split(",").filter(Boolean).map((pair) => {
    const [from, to] = pair.split("=");
    return [from.trim(), to.trim()];
  })
);

const FM_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
function loadTrees(dir) {
  const trees = new Map();
  const base = path.join(dir, "trees");
  if (!fs.existsSync(base)) return trees;
  for (const f of fs.readdirSync(base).filter((f) => f.endsWith(".md")).sort()) {
    const m = FM_RE.exec(fs.readFileSync(path.join(base, f), "utf8"));
    if (!m) continue;
    trees.set(f.replace(/\.md$/, ""), { fm: load(m[1]) ?? {}, body: m[2].trim() });
  }
  return trees;
}

const vault = loadTrees(vaultDir);
const forest = loadTrees(forestDir);
const forestJson = JSON.parse(fs.readFileSync(path.join(vaultDir, "forest.json"), "utf8"));

// ------------------------------------------------------------- firewall
// The same rule grow-bundle.mjs enforces, enforced again here rather than
// shared by trust: a second entry point into the library must not be a second
// way around the gate. Quoted short — grow-bundle.mjs carries the full text.
if (typeof forestJson.derivative !== "boolean") {
  console.error(`ODBIJENO: forest.json ima neispravan "derivative" (${JSON.stringify(forestJson.derivative)}) — mora biti boolean. Ništa nije zapisano.`);
  process.exit(1);
}
if (forestJson.derivative === true) {
  for (const id of picked) {
    const t = vault.get(id);
    if (!t) continue;
    const origin = t.fm.origin ?? "digest";
    if (origin !== "member" && origin !== "agent") {
      console.error(`ODBIJENO: stablo "${id}" ima origin "${origin}" u izvedenom trezoru — njegov sadržaj potječe iz izvornog djela i ne smije ući u knjižničnu šumu (docs/forest-format.md, Copyright; spec/policies/provenance.md). Odluka je konačna; ništa nije zapisano.`);
      process.exit(1);
    }
    if (t.fm.source && t.fm.source.pages !== undefined) {
      console.error(`ODBIJENO: stablo "${id}" tvrdi origin "${origin}" ali nosi source.pages — zbunjena provenijencija se ne izvozi. Ništa nije zapisano.`);
      process.exit(1);
    }
  }
}

// Attribution is not optional when the vault digests someone else's licensed
// work: a tree in the forest has no forest.json of its own to carry it.
const srcLicense = forestJson.source?.license;
const ownWork = !srcLicense || /^(CC0|own|member)/i.test(String(srcLicense));
const needsAttribution = picked.some((id) => (vault.get(id)?.fm.origin ?? "digest") === "digest") && !ownWork;
if (needsAttribution && !attribution) {
  const s = forestJson.source ?? {};
  console.error(
    `ODBIJENO: stabla s origin "digest" potječu iz djela "${s.title ?? "?"}" (${srcLicense}) — proslijedi --attribution s citatom, npr.\n` +
    `  --attribution ${JSON.stringify(`${(s.authors ?? []).join(", ")}, ${s.title ?? ""}${s.ref ? ", " + s.ref : ""}, ${srcLicense}`)}\n` +
    `Ništa nije zapisano.`
  );
  process.exit(1);
}

// --------------------------------------------------------- id resolution
// A vault id that already names a different tree in the forest cannot keep it.
// Renaming is mechanical; choosing the remap targets for EDGES is not, which
// is why --remap is an input rather than a guess.
const idMap = new Map();
for (const id of picked) {
  if (!vault.has(id)) {
    console.error(`error: "${id}" is not a tree in ${vaultDir}`);
    process.exit(1);
  }
  let target = prefix ? id.replace(/^([a-z]+-)/, `$1${prefix}`) : id;
  if (forest.has(target)) {
    const taxonPrefix = /^([a-z]+-)/.exec(target)?.[1] ?? "";
    let n = 2;
    while (forest.has(target)) target = `${taxonPrefix}${id.slice(taxonPrefix.length)}-${n++}`;
    console.error(`note: "${id}" collides with an existing forest tree — writing as "${target}"`);
  }
  idMap.set(id, target);
}

const resolve = (ref) => idMap.get(ref) ?? remap.get(ref) ?? (forest.has(ref) ? ref : null);

// ------------------------------------------------------------- emission
fs.mkdirSync(path.join(outDir, "trees"), { recursive: true });
const yq = (s) => JSON.stringify(s);
const notes = [];

for (const id of picked) {
  const t = vault.get(id);
  const newId = idMap.get(id);
  const fm = { ...t.fm, id: newId };

  // Vault-local bookkeeping that means nothing in the forest.
  delete fm.x_library;
  if (forestJson.derivative === true) delete fm.source;
  if (attribution) fm.adapted_from = attribution;
  if (fm.language === undefined && forestJson.language) fm.language = forestJson.language;

  // Edges: keep what resolves (to a co-grown tree, an explicit remap, or an
  // existing forest tree — that last case is how a member's subgraph attaches
  // to the communal one), drop what dangles, and say which.
  if (Array.isArray(fm.depends)) {
    const kept = [];
    for (const d of fm.depends) {
      const r = resolve(d);
      if (r) kept.push(r);
      else notes.push(`dropped depends edge ${newId} → ${d} (not grown, not remapped, not in forest)`);
    }
    fm.depends = kept;
  }
  if (Array.isArray(fm.depends)) {
    // Two vault ids can remap onto one forest tree; the edge is still one edge.
    fm.depends = [...new Set(fm.depends)];
  }
  if (fm.proves) {
    const r = resolve(fm.proves);
    if (r) { fm.proves = r; if (Array.isArray(fm.depends) && !fm.depends.includes(r)) fm.depends.push(r); }
    else { notes.push(`dropped proves ${newId} → ${fm.proves} (unresolvable)`); delete fm.proves; }
  } else if (fm.taxon === "proof" && Array.isArray(fm.depends)) {
    // Trees written before `proves` existed carry no anchor, and an exercise
    // is not a heuristic-provable taxon — such a proof would fail validation
    // on arrival. Infer only when exactly one dependency could be the anchor;
    // ambiguity stays the skill's call, not a guess made here.
    const ANCHORABLE = ["theorem", "lemma", "proposition", "corollary", "exercise"];
    // `fm.depends` already holds post-resolution ids: each is either an
    // existing forest tree or one of the trees being grown alongside this one.
    const taxonOf = (newRef) => {
      if (forest.has(newRef)) return forest.get(newRef).fm.taxon;
      for (const [vaultId, mapped] of idMap) {
        if (mapped === newRef) return vault.get(vaultId)?.fm.taxon;
      }
      return undefined;
    };
    const anchorable = fm.depends.filter((d) => ANCHORABLE.includes(taxonOf(d)));
    if (anchorable.length === 1) {
      fm.proves = anchorable[0];
      notes.push(`inferred proves ${newId} → ${anchorable[0]} (sole anchorable dependency)`);
    } else if (anchorable.length > 1) {
      notes.push(`${newId}: ${anchorable.length} anchorable dependencies (${anchorable.join(", ")}) — set proves: by hand before merging`);
    }
  }

  // Body wikilinks follow the same resolution; an unresolvable one becomes
  // plain text rather than a dead link in the communal graph.
  const body = t.body.replace(/\[\[([^\[\]|#]+)(\|[^\]]*)?\]\]/g, (m, target, label) => {
    const r = resolve(target.trim());
    if (r) return `[[${r}${label ?? ""}]]`;
    notes.push(`flattened wikilink [[${target.trim()}]] in ${newId}`);
    return (label ? label.slice(1) : target.trim());
  });

  const order = ["id", "taxon", "title", "teaches", "requires", "depends", "proves", "language", "origin", "adapted_from", "standalone"];
  const lines = ["---"];
  for (const k of [...order, ...Object.keys(fm).filter((k) => !order.includes(k))]) {
    const v = fm[k];
    if (v === undefined) continue;
    lines.push(Array.isArray(v) ? `${k}: [${v.join(", ")}]` : `${k}: ${typeof v === "string" ? yq(v) : typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  lines.push("---", "", body, "");
  fs.writeFileSync(path.join(outDir, "trees", `${newId}.md`), lines.join("\n"));
}

for (const n of notes) console.error(`note: ${n}`);
console.log(`grown: ${picked.length} tree(s) → ${path.join(outDir, "trees")} as ${[...idMap.values()].join(", ")}`);
