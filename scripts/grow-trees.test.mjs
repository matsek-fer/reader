// Tests for grow-trees.mjs — run with `npm test` (node --test).
// The frontmatter writer is the point: a `needs` sentence holding a comma or
// a colon must come back as the same YAML value, which the hand-joined
// `[a, b]` this writer replaced could not promise.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dump, load } from "js-yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "grow-trees.mjs");

const FM_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function run(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// A member's own non-derivative vault: nothing the firewall or the
// attribution rule would stop, so only the writer is under test.
function makeVault(trees) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grow-trees-test-"));
  fs.mkdirSync(path.join(dir, "trees"));
  fs.writeFileSync(path.join(dir, "forest.json"), JSON.stringify({
    schema_version: "forest-0.2",
    source: { title: "Vlastite bilješke", authors: ["Član"], year: 2026, kind: "notes", license: "own" },
    language: "hr",
    created: "2026-10-05",
    tool: "forest-digest",
    tool_version: "0.2.0",
    derivative: false,
  }));
  for (const [fm, body] of trees) {
    fs.writeFileSync(path.join(dir, "trees", `${fm.id}.md`), `---\n${dump(fm)}---\n\n${body}\n`);
  }
  return dir;
}

function grown(outDir, id) {
  const m = FM_RE.exec(fs.readFileSync(path.join(outDir, "trees", `${id}.md`), "utf8"));
  assert.ok(m, `${id}.md has no frontmatter block`);
  return { raw: m[1], fm: load(m[1]), body: m[2].trim() };
}

const stabilizer = {
  id: "mor-stabilizer",
  taxon: "morphism",
  title: "Stabilizator točke: podgrupa",
  kind: "property",
  from: "obj-group-action",
  to: "obj-subgroup",
  statement: "(G,X,\\rho),\\ x\\mapsto G_x=\\{\\,g\\in G : g\\cdot x=x\\,\\}\\le G",
  acts_on: "all",
  needs: ["odabrana točka $x \\in X$", "a, b: c"],
  on_homomorphisms: "Uz $\\varphi=\\mathrm{id}$ i $f(x)=y$ vrijedi $G_x\\subseteq G_y$.",
  functorial: false,
  teaches: ["orbits-stabilizers"],
  requires: ["subgroups"],
  depends: [],
  standalone: true,
  language: "hr",
  origin: "member",
};

test("a mor- tree with needs holding a comma and a colon round-trips deep-equal", () => {
  const vault = makeVault([[stabilizer, "Podgrupa: $e$ fiksira $x$."]]);
  const forest = fs.mkdtempSync(path.join(os.tmpdir(), "grow-trees-forest-"));
  const out = path.join(vault, "out");
  const r = run([vault, forest, "--trees", "mor-stabilizer", "--out", out]);
  assert.equal(r.status, 0, r.stderr);
  const { raw, fm, body } = grown(out, "mor-stabilizer");
  assert.deepEqual(fm, stabilizer);
  assert.equal(body, "Podgrupa: $e$ fiksira $x$.");
  // The customary keys come first, in the customary order; arrays stay flow.
  assert.match(raw, /^id: mor-stabilizer\ntaxon: morphism\ntitle: /);
  assert.match(raw, /^needs: \[.*\]$/m);
  // The endpoints are not in the (empty) forest and were not grown alongside:
  // the script says so instead of guessing or dropping a required key.
  assert.match(r.stderr, /from mor-stabilizer → obj-group-action does not resolve/);
});

test("an object with nlab and an instance with values round-trip, and id remaps reach structure keys", () => {
  const action = {
    id: "obj-group-action",
    taxon: "object",
    title: "Djelovanje grupe na skupu",
    symbol: "(G, X, \\rho)",
    hom: "Par $(\\varphi, f)$: $f(g\\cdot x)=\\varphi(g)\\cdot f(x)$.",
    nlab: { title: "action", revision: 85 },
    teaches: ["group-actions"],
    requires: [],
    depends: [],
    standalone: true,
    language: "hr",
    origin: "member",
  };
  const necklace = {
    id: "mor-ogrlice-z6",
    taxon: "morphism",
    title: "Rotacije ogrlice od šest perli",
    kind: "instance",
    from: "pt",
    to: "obj-group-action",
    statement: "(\\mathbb{Z}_6,\\ B^6,\\ \\text{rotacija}),\\quad |B|=2",
    needs: [],
    values: { "mor-orbits": "ogrlice; ima ih $14$", "mor-stabilizer": "jednobojna: $\\mathbb{Z}_6$; bez simetrije: $\\{0\\}$" },
    teaches: ["group-actions"],
    requires: [],
    depends: ["obj-group-action"],
    standalone: true,
    language: "hr",
    origin: "member",
  };
  const vault = makeVault([[action, "## Definicija\nTočan iskaz."], [necklace, "Ogrlica je orbita."]]);
  // The forest already holds an obj-group-action, so the grown one is renamed
  // and every structure key pointing at it must follow.
  const forest = fs.mkdtempSync(path.join(os.tmpdir(), "grow-trees-forest-"));
  fs.mkdirSync(path.join(forest, "trees"));
  fs.writeFileSync(path.join(forest, "trees", "obj-group-action.md"), `---\n${dump({ ...action, hom: "Nešto drugo." })}---\n\nDrugo stablo.\n`);
  const out = path.join(vault, "out");
  const r = run([vault, forest, "--trees", "obj-group-action,mor-ogrlice-z6", "--out", out]);
  assert.equal(r.status, 0, r.stderr);

  const obj = grown(out, "obj-group-action-2").fm;
  assert.deepEqual(obj, { ...action, id: "obj-group-action-2" });

  const inst = grown(out, "mor-ogrlice-z6").fm;
  assert.equal(inst.to, "obj-group-action-2");
  assert.equal(inst.from, "pt");
  assert.deepEqual(inst.depends, ["obj-group-action-2"]);
  assert.equal(inst.statement, necklace.statement);
  // values keys not grown and not in the forest are dropped, with a note.
  assert.deepEqual(inst.values, {});
  assert.match(r.stderr, /dropped values entry mor-ogrlice-z6 → mor-orbits/);
});

test("type and up_to are ids: they follow a rename, and up_to goes when it cannot", () => {
  const base = { teaches: [], requires: [], depends: [], standalone: true, language: "hr", origin: "member" };
  const group = { id: "obj-group", taxon: "object", title: "Grupa", symbol: "(G, \\cdot)", hom: "Homomorfizam $\\varphi\\colon G\\to H$.", ...base };
  const second = { id: "obj-group-second", taxon: "object", title: "Druga grupa", symbol: "(H, \\ast)", type: "obj-group", ...base, depends: ["obj-group"] };
  const map = {
    id: "mor-homomorphism", taxon: "morphism", title: "Homomorfizam grupa", kind: "hom",
    from: "obj-group", to: "obj-group-second", statement: "\\varphi\\colon G\\to H", needs: [], invertible: false, ...base,
  };
  const dual = {
    id: "mor-dual", taxon: "morphism", title: "Dualna grupa", kind: "transform",
    from: "obj-group", to: "obj-group", statement: "G\\mapsto\\widehat G", acts_on: "all",
    needs: ["$G$ konačna i komutativna"], on_homomorphisms: "Smjer se obrće.", functorial: true,
    inverse: "mor-dual", up_to: "thm-double-dual", ...base,
  };
  const thm = { id: "thm-double-dual", taxon: "theorem", title: "Dvostruki dual", about: ["mor-dual"], ...base };
  const vault = makeVault([[group, "## Definicija\nGrupa."], [second, "Još jedna."], [map, "Čuva operaciju."], [dual, "Karakteri."], [thm, "Kanonski izomorfizam."]]);

  // The forest already holds other trees under two of the ids, so both are
  // renamed and every key that names them must follow.
  const forest = fs.mkdtempSync(path.join(os.tmpdir(), "grow-trees-forest-"));
  fs.mkdirSync(path.join(forest, "trees"));
  fs.writeFileSync(path.join(forest, "trees", "obj-group.md"), `---\n${dump({ ...group, hom: "Nešto drugo." })}---\n\nDrugo stablo.\n`);
  fs.writeFileSync(path.join(forest, "trees", "thm-double-dual.md"), `---\n${dump({ ...thm, title: "Drugi teorem" })}---\n\nDrugo stablo.\n`);
  const out = path.join(vault, "out");
  const r = run([vault, forest, "--trees", "obj-group,obj-group-second,mor-homomorphism,mor-dual,thm-double-dual", "--out", out]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(grown(out, "obj-group-second").fm.type, "obj-group-2");
  const hom = grown(out, "mor-homomorphism").fm;
  assert.deepEqual([hom.from, hom.to, hom.invertible], ["obj-group-2", "obj-group-second", false]);
  const pair = grown(out, "mor-dual").fm;
  assert.deepEqual([pair.inverse, pair.up_to], ["mor-dual", "thm-double-dual-2"]);

  // Into an empty forest, without the theorem and without the type: up_to has
  // nothing to point at and is dropped; the type is kept and flagged.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "grow-trees-forest-"));
  const out2 = path.join(vault, "out2");
  const r2 = run([vault, empty, "--trees", "obj-group-second,mor-dual", "--out", out2]);
  assert.equal(r2.status, 0, r2.stderr);
  const alone = grown(out2, "mor-dual").fm;
  assert.equal(alone.inverse, "mor-dual");
  assert.ok(!("up_to" in alone));
  assert.match(r2.stderr, /dropped up_to mor-dual → thm-double-dual \(unresolvable\)/);
  assert.equal(grown(out2, "obj-group-second").fm.type, "obj-group");
  assert.match(r2.stderr, /type obj-group-second → obj-group does not resolve/);
});
