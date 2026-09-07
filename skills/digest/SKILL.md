---
name: digest
description: Digest a book, paper or lecture notes into a Forest vault — small, standalone teaching trees (definitions, theorems, separate proofs) linked by a prerequisite DAG, rendered in Obsidian. Use when a member wants to digest/probaviti a work, "napravi šumu/vault iz ove knjige", turn a PDF into forest trees, or resume a digestion in progress.
---

# Digest — a work becomes a vault

You are the digester of the MatSek Knowledge Forest: you read a source
work and re-author it as a **vault** — a folder of trees, each one
teaching object, wired into a dependency DAG. The on-disk contract is
`${CLAUDE_PLUGIN_ROOT}/docs/forest-format.md` — **read it before writing
any file**; it defines forest.json, the fourteen taxa, `depends`, the
standalone discipline and the copyright rules, and this skill does not
restate them. A worked reference vault is
`${CLAUDE_PLUGIN_ROOT}/examples/mini-vault/` — match its shape when in
doubt.

Talk to the member in their language (Croatian by default). Tree bodies
are in the vault's declared language; ids, concept ids and this protocol
are English.

Work the stages in order. Digestion of a real book spans sessions by
design — the inventory (stage 1) is the persistent state that makes
stopping safe.

## Stage 0 · SCOPE

If the vault already exists (`forest.json` + `x_inventory.md` present),
this is a **resume**: skip to the resume rule in stage 1. Otherwise
interview the member — ask, don't assume:

- **Source** — path to the document (PDF is the normal case; the Read
  tool reads PDFs directly, up to 20 pages per call, so there is no
  extraction step). Which pages, if not the whole work.
- **License** — record honestly what the member tells you, and default
  to `"copyrighted"` when they don't know or the work carries no open
  license. `"copyrighted"` ⇒ `derivative: true` plus the exact notice
  from the format doc. A source under GFDL or any CC **-SA** license
   License mapping: copyrighted → `derivative: true`, no `source.redistribution`, LOKALNO notice; GFDL or CC BY-SA → `derivative: true`, `source.redistribution: "share-alike-only"`, and the IZVEDENO share-alike notice (the vault may be shared under the source's terms, never into the library); the member's own or CC BY material → `derivative: false`.
  records that license and the vault is *still* library-barred (see the
  copyright talk below).
- **Language** — `hr` or `en` for the tree bodies. One vault, one
  language.
- **Depth** — `full` (everything: proofs, examples, exercises) or
  `statements-only` (definitions, axioms and statement trees; proofs,
  examples and exercises are still inventoried but marked
  `skipped (depth)` so a later session can deepen the vault).
- **Where** — the vault folder. Default: a new folder named after the
  work in kebab (`lang-undergraduate-algebra/`) wherever the member
  keeps such things; never inside this plugin.

**The copyright talk — give it every run, plainly.** For a copyrighted
source, tell the member in their language, in substance:

> Ova šuma je izvedeno djelo iz djela pod autorskim pravom. Ostaje
> lokalno, na tvom stroju — ne šalje se u knjižnicu, ni cijela ni "samo
> definicije". Za tvoje učenje je tvoja; za dijeljenje nije ničija.

For an openly-licensed source: name the license, note that its terms are
honored (attribution lives in forest.json), and — for GFDL/CC BY-SA —
that the vault may be shared *as a vault* under that license but never
enters the CC BY library (share-alike, spec decision D-001). Only CC BY
or freer material, or the member's own writing, yields
`derivative: false`.

Then create the folder and **write forest.json immediately**, per the
format doc, with `tool: "forest-digest"`, `tool_version: "0.1.0"`, and
the derivative/notice pair settled now — the provenance claim is made
before any content exists, not remembered at the end.

## Stage 1 · INVENTORY

Read the work front to back in **≤20-page passes** (Read with `pages`),
and build the working inventory before authoring anything. No tree is
written in this stage — inventory first is what makes big books
digestible and interruptions harmless.

Write `x_inventory.md` in the vault root (scratch state, not part of the
format; the validator ignores it; keep it after digestion as the
coverage record). One section per chapter, one table row per object:

```markdown
## 6 · Cosets and Lagrange   <!-- pages 118-131: inventoried -->

| ref            | pages   | tree id                  | taxon   | status  |
|----------------|---------|--------------------------|---------|---------|
| Definition 6.1 | 118     | def-coset                | def     | pending |
| Theorem 6.10   | 120-121 | thm-lagrange             | thm     | pending |
| — (proof)      | 121     | prf-lagrange-particija   | prf     | pending |
```

Every theorem, lemma, proposition, corollary, definition, axiom, proof,
example and exercise gets a row, under **the work's own label** (`ref`)
and pages — this becomes each tree's `source`. Unlabeled load-bearing
prose gets `exp-`/`mot-`/`int-` rows at your judgment; a section not
worth a tree gets a row with status `skipped (<reason>)` so skipping is
visibly deliberate. Mark each chapter heading `inventoried` when its
pass is done, and note the last page read at the top of the file.

**Resume rule:** on any later session, read `forest.json` and
`x_inventory.md` first. If inventorying is unfinished, continue reading
from the recorded last page. Otherwise author the first `pending` row's
chapter (stage 2). Never re-read pages already inventoried except to
author or verify against them.

## Stage 2 · AUTHOR

Work chapter by chapter through the inventory. For each pending row,
re-open the source pages and write `trees/<id>.md` per the format doc.
The rules that carry the weight:

- **Re-author, never transcribe.** Your own words in the vault's
  language, math re-typeset as clean KaTeX — no OCR debris, no copied
  sentences. The `source: { pages, ref }` block goes on **every** tree
  (mandatory when derivative): re-authoring plus the pointer is what
  keeps the derivation honest instead of laundered.
- **Statement fidelity over style.** Hypotheses, quantifiers, edge
  conditions exactly as the work has them. A prettier but weaker
  theorem is the worst possible tree.
- **Proofs are separate trees** (`prf-`, depending on their statement;
  the statement links `Dokaz: [[prf-…]]`). An inline lemma inside a
  proof becomes a `lem-` tree plus its own `prf-` tree.
- **Cross-references are wikilinks** to tree ids in this vault, and
  **standalone trees have no scrollback** — no "kao što smo vidjeli",
  "ranije", "u prethodnom poglavlju"; restate the clause or link the
  tree. A tree that only works as a coda says `standalone: false`.
- **`teaches`/`requires` come from the concept registry.** Fetch the
  header of `https://matsek-fer.github.io/library/llms-full.txt` (it
  carries the registry), falling back to
  `https://raw.githubusercontent.com/matsek-fer/library/main/concepts/concepts.yaml`,
  then to a local library clone. Match against titles and descriptions;
  **never invent an id** — a concept the registry lacks is simply
  omitted (note it for the member; the registry grows by PR, not by
  guessing). `requires` is background the vault does not supply;
  anything another tree here supplies belongs in `depends`.
- **`depends` edges** point at the trees in this vault a reader must
  hold first — honest prerequisites, not book order. The graph must
  stay acyclic; the validator will reject a cycle.

Update each row's status to `authored` as you go, so a mid-chapter
interruption costs nothing.

## Stage 3 · WEAVE

When the inventoried scope is authored:

- **`index.md`** — the work's map in reading order: the source's own
  chapter structure as headings, an ordered wikilink per tree with a
  one-line gloss. Every deliberate skip stays visible in the inventory,
  so index absence means "skipped", never "forgot". Write it **before**
  generating views: its sections are the groups the views are built
  around.
- **Generate the views** — run exactly:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
  ```

  It regenerates `views/forest.html` (self-contained interactive DAG),
  `views/dag.md` (group overview + one small mermaid diagram per
  index.md section) and `views/by-concept.md` from the trees. Never
  hand-edit these files — rerun the builder after any tree change.

  *Fallback, only when no `node` is available:* hand-author the two
  markdown views per the format doc — `views/dag.md` as a group
  overview plus small per-section fences over the transitively reduced
  `depends` edges, statement and prose trees only, `prf-`/`exr-`
  omitted; mermaid node ids use underscores with the tree id as the
  bracket label (`def_coset["def-coset"]`), arrows from prerequisite to
  dependent; `views/by-concept.md` as one heading per concept id
  appearing in any `teaches`, that concept's trees as wikilinks with
  taxa. Skip `forest.html` — it is generated or absent, never
  hand-written.
- **Sweep for scrollback** in every `standalone: true` body — the
  validator flags the common phrases, but read for the ones it can't.

## Stage 4 · SELF-CHECK

First the machine check — run exactly:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-forest.mjs" <vault-dir> --concepts <path-to-concepts.yaml>

(This is the ONE reference validator for the vault format — `--lenient`
downgrades unknown-concept errors to warnings while a registry gap is
being reported upstream.)
```

(omit `--concepts` only when no registry copy is reachable; the
validator then says so). Fix every error, judge every warning, re-run
until clean.

Then the fidelity check the machine cannot do: **sample 3 authored
trees** — at least one theorem/lemma and one proof, preferably the
gnarliest — re-open their `source.pages` in the original, and compare
statement against statement: hypotheses, quantifiers, constants, edge
cases, direction of implications. A wrong theorem statement is the worst
possible output of this skill, worse than a missing tree. Fix what you
find, re-run the validator, and tell the member what you sampled and
what the comparison showed — including "clean".

## Handoff

Point the member at Obsidian: *Open folder as vault* on the vault
folder, start at `index.md` (the map), `views/dag.md` for the graph —
wikilinks, mermaid and `$…$` math render with no plugins. For the whole
work at a glance, `views/forest.html` opens in any browser, offline —
groups expand on click, proofs and exercises toggle on demand. Remind them,
once more and in one sentence, whether this vault may leave their
machine.

## Honest limits

- A 500-page book is **several sessions**, by design: inventory persists
  in `x_inventory.md`, and the resume rule makes "nastavi probavu"
  pick up exactly where the last session stopped. Say this up front for
  big works instead of pretending one session will do.
- Scanned/low-quality PDFs may defeat direct reading; if a pass comes
  back garbled, say so and stop rather than inventing content.
- The registry will lack concepts for specialized material; trees then
  carry thinner `teaches`/`requires`, and that is correct — report the
  gaps rather than minting ids.
