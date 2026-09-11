# The Forest vault format — draft 0.1

**Status: normative draft.** This document defines the on-disk format the
Knowledge Forest tools produce when they *digest* a work — a book, a paper,
a set of notes — into a **vault** of small, independently addressable
teaching objects called **trees**. A second implementation written from
this document alone should agree with the reference tooling on every vault
it accepts or rejects.

It is a draft in the precise sense of the [relationship to spec
v1](#relationship-to-bundle-spec-v1) section: vaults are a new, local-first
artifact family, proven here in the field before any of it hardens into the
`spec` repo's contract.

A worked reference vault lives at
[`examples/mini-vault/`](../examples/mini-vault/) — most rules below (it is non-derivative, so per-tree provenance is shown by the fixtures instead) is
exercised there, and the vault doubles as documentation. Open it as an
Obsidian vault to see the format render.

## The model: one vault per digested work

A vault is a **folder**. It holds one digested work and nothing else;
copying the folder copies the vault.

```
<vault>/
├── forest.json        machine truth about the vault and its source
├── index.md           the work's root: its structure as a map of wikilinks
├── trees/
│   ├── def-coset.md   one tree — one teaching object — per file
│   ├── thm-lagrange.md
│   └── prf-lagrange-particija.md
└── views/
    ├── dag.md         mermaid dependency graph over the trees
    └── by-concept.md  trees grouped under concept-registry headings
```

Obsidian is the interim UI: everything in a vault must render there —
wikilinks, ` ```mermaid ` fences, `$…$` / `$$…$$` math — and the format is
verified by construction against that renderer. When the Forest grows its
own reader, the format does not change; the reader meets it where Obsidian
already does.

## forest.json

A single JSON object:

```json
{
  "schema_version": "forest-0.1",
  "source": {
    "title": "Undergraduate Algebra",
    "authors": ["Serge Lang"],
    "year": 2005,
    "kind": "book",
    "file": "sources/lang-undergraduate-algebra.pdf",
    "license": "copyrighted",
    "pages": "1-374"
  },
  "language": "hr",
  "created": "2026-09-07",
  "tool": "forest-digest",
  "tool_version": "0.1.0",
  "derivative": true,
  "notice": "LOKALNO — izvedeno djelo, ne šalje se u knjižnicu"
}
```

Field by field:

| Field | Type | Rule |
|---|---|---|
| `schema_version` | string | Exactly `"forest-0.1"` for this draft. |
| `source.title` | string | The digested work's title, verbatim. |
| `source.authors` | array of strings | The work's authors. May be empty for anonymous notes. |
| `source.year` | integer | Year of the edition digested. |
| `source.kind` | string | `book`, `paper`, or `notes`. |
| `source.file` | string | Path (vault-relative or as the member keeps it) to the source document. **Optional** when the source is not a single document — e.g. `notes` assembled from several files; then per-tree `source.ref` carries the pointers instead. |
| `source.license` | string | The source's license identifier (e.g. `CC-BY-4.0`, `GFDL-1.3`), or exactly `"copyrighted"` when there is none to record. |
| `source.pages` | string | Page range digested, e.g. `"1-374"` or `"120-158"`. Optional when `source.file` is absent. |
| `language` | string | `hr` or `en` — the language of the tree bodies. One vault, one language: a mixed-language source is re-authored uniformly. |
| `created` | string | ISO date `YYYY-MM-DD` of the digest. |
| `tool` | string | `"forest-digest"` — the producing tool.  Currently `forest-digest` (the digester) or `matsek-library-export` (a vault exported from the library site); a vault must not claim a producer that did not make it. |
| `tool_version` | string | The tool's version, e.g. `"0.1.0"`. |
| `derivative` | boolean | `true` iff the vault's content is a derivative work of a source the member does not hold redistribution rights to. See [Copyright](#copyright--the-hard-rules). |
| `notice` | string | **Required iff `derivative` is `true`**, and then exactly `"LOKALNO — izvedeno djelo, ne šalje se u knjižnicu"`. Forbidden otherwise — a non-derivative vault carrying the notice signals a confused provenance claim, the same way a stray `adapted_from` does in bundle v1. |

Unknown keys follow the bundle-spec rule verbatim: **`^x_` keys are allowed
in every object at every level and must be preserved by every tool that
rewrites the file; every other unknown key is an error.** Forward
compatibility happens through `schema_version`, never through tolerated
extras.

## Trees — `trees/<id>.md`

A tree is **one teaching object**: one theorem, one definition, one proof,
one worked example. One object per file, never two. The file name is the
id plus `.md`.

### Ids

`<taxon-prefix>-<kebab-slug>`, kebab-case ASCII (`[a-z0-9]+(-[a-z0-9]+)*`
after the prefix). The prefix declares the taxon and must agree with the
frontmatter `taxon` field:

| Prefix | Taxon | The tree's job |
|---|---|---|
| `thm-` | `theorem` | A named or load-bearing result, statement only. |
| `lem-` | `lemma` | A stepping-stone result, statement only. |
| `prp-` | `proposition` | A result below theorem weight, statement only. |
| `cor-` | `corollary` | A consequence of another statement tree, statement only. |
| `def-` | `definition` | Introduces an object or property precisely. |
| `axm-` | `axiom` | A postulate the work assumes rather than proves. |
| `prf-` | `proof` | The proof of exactly one statement tree. Always its own tree — see [Proofs are separate trees](#proofs-are-separate-trees). |
| `exm-` | `example` | Works a concrete instance of an already-stated idea. |
| `exr-` | `exercise` | A task for the reader (with or without solution). |
| `exp-` | `exposition` | Defines-and-develops prose — the load-bearing explanation a chapter section gives, when it is not a single formal statement. |
| `mot-` | `motivation` | Why anyone cares — the problem the concept answers, the stakes. |
| `int-` | `intuition` | The mental picture — analogy, visualization, "what it feels like". |
| `rem-` | `remark` | A short aside: a warning, an edge case, a historical note. |
| `con-` | `connection` | A bridge between two ideas — an equivalence, a contrast, a generalization. Must name both ends explicitly. |

Assign the taxon by what the tree *does*, not what it mentions — a
definition wrapped in a story is still `def-` if the definition is what the
reader leaves with. The five soft taxa (`exposition`, `example`,
`intuition`, `motivation`, `connection`) carry their meanings from the
blog-writer's forest-readiness convention
(`blog-writer/docs/forest-readiness.md`), which this format supersedes for
vaults; the formal taxa (`theorem` … `exercise`) are the vault format's
addition, because digested mathematics has formal structure blogs do not.

### Frontmatter

YAML frontmatter, one block per tree:

```yaml
---
id: thm-lagrange
taxon: theorem
title: "Lagrangeov teorem"
teaches: [lagrange]
requires: [cosets, index]
depends: [def-coset, def-index]
source:
  pages: "12-14"
  ref: "Theorem 6.10"
standalone: true
---
```

| Field | Type | Rule |
|---|---|---|
| `id` | string | Equal to the filename stem. Ids are permanent: renaming a tree is a new tree. |
| `taxon` | string | One of the fourteen taxa above; must match the id's prefix. |
| `title` | string | Member-facing title in the vault's `language`. |
| `teaches` | array | Concept-registry ids (from `library/concepts/concepts.yaml`) this tree teaches. May be empty (a `prf-` or `rem-` often teaches nothing new by itself). |
| `requires` | array | Concept-registry ids the reader must already hold to read this tree — background the *vault* does not supply. Concepts supplied by another tree in this vault belong in `depends`, not here. |
| `depends` | array | Ids of trees **in this vault** — the intra-work DAG. See [depends](#depends--the-intra-work-dag). |
| `source` | object | `{ pages: "12-14", ref: "Theorem 6.10" }` — where in the source work this tree comes from, using the work's own labels. **Required when the vault is `derivative: true` and the tree is digest-origin** (see `origin` below) — it is the provenance pointer that lets a reader with the book open to the original. Optional otherwise, but recommended; in a vault digested from open bundles, `ref` may carry the bundle id (e.g. `"proof/ga-lagrange-particija"`). |
| `standalone` | boolean | The author's honest claim that the body passes the [standalone discipline](#the-standalone-discipline). `false` keeps the tree attached to the trees it depends on — a coda, not a node a walk may serve alone. |
| `origin` | string | **Optional.** Who authored this tree's content: `digest`, `member`, or `agent`. **Absent means `digest`** — every tree the digest writes is re-authored from the source work, and every pre-`origin` tree is a digest tree. `member` and `agent` mark trees grown *inside* the vault after the digest: a member's own writing, or content a model drafted for the member. Origin is what the library firewall reads — in a `derivative: true` vault only `member`/`agent` trees may ever be extracted into library bundles (see [Copyright](#copyright--the-hard-rules)), and such a tree must **not** carry `source.pages`: it is not from the source, and claiming both origins at once is a confused provenance claim, the same class of error as a stray `adapted_from` in bundle v1. Consequently the derivative-vault rule that `source.pages` is required applies only to digest-origin trees. Tools that create trees (`/ask`'s growth path, `/grow`) write `origin` explicitly. |
| `language` | string | **Optional.** `hr` or `en`, overriding the vault's `language` for this tree alone. Exists for communal forests (the library's) that hold both languages side by side; single-work vaults should not need it. |
| `digested_from` | string | **Optional.** The library bundle id (`blog/<slug>`, `problem/<slug>`, …) this tree was digested from (spec D-007). While the source bundle stays canonical, this pointer is what makes drift visible; tools that re-digest a bundle replace the trees carrying its id. |
| `adapted_from` | string | **Optional.** Free-text citation of a named CC BY-or-freer work this tree adapts — same meaning as the bundle spec's field of the same name. Required by `/grow` when trees leave a vault whose source is someone else's licensed work: attribution has to travel *with the tree*, since a tree in the library forest has no `forest.json` of its own to carry it. Note the pointer directions differ by canonicity: `digested_from` says *this tree was derived from that still-canonical bundle*, while a derived bundle points the other way with `x_forest_trees`. |
| `proves` | string | **Optional, proof trees only.** The id of the statement *or exercise* this proof proves; must also appear in `depends`. Names the fold anchor explicitly where the one-statement-dependency heuristic is ambiguous — a proof leaning on several theorems, or an exercise solution (exercises are provable anchors only via `proves`, so theorems never fold under drills by accident). |

`^x_` keys are preserved here as everywhere. In particular, a digester
promoting a forest-ready blog's sections into trees carries each section's
`x_forest` verdict forward as the tree's `taxon`/`standalone` and may keep
the original under `x_`.

### depends — the intra-work DAG

`depends: [a, b]` means: **understanding this tree needs those trees.** Not
"is mentioned by", not "comes earlier in the book" — a reader who has not
absorbed `a` and `b` cannot honestly work through this tree. The edges over
all trees in a vault must form a **DAG**: a cycle would make "read
prerequisites first" meaningless, exactly as it would in the concept
registry, and the reference tooling rejects it.

Two clarifications that keep the DAG honest:

- A **proof depends on its statement** (`prf-lagrange-particija` depends on
  `thm-lagrange`), never the reverse. The statement tree's body *links* to
  its proofs with `[[prf-…]]` — a body wikilink is a pointer, **not** a
  `depends` edge, so no cycle arises.
- `depends` is intra-vault only. Cross-vault and background needs are
  expressed through `requires` (concept ids), which the Forest resolves
  against the registry and other vaults at walk time.

### Proofs are separate trees

Every proof is its own tree, `taxon: proof`, depending on the statement it
proves; the statement tree links to it (`Dokaz: [[prf-…]]`), and a
statement may link several (`[[prf-lagrange-particija]]`,
`[[prf-lagrange-djelovanje]]`).

This is the format's one non-negotiable structural rule, for two reasons:

1. **Views can fold proofs away.** A map of a book's results
   (`views/dag.md`, a chapter summary, a revision sheet) shows statements
   with proofs collapsed to links — impossible if proof text lives inside
   statement trees.
2. **The tutor can probe a proof independently.** "State Lagrange" and
   "prove Lagrange" are different competencies; separate trees let a
   session serve the statement, withhold the proof, and ask the member to
   attempt it — the same split bundle v1 makes with `statement.md` /
   `proof.md`.

A work's proof of theorem X that pauses to prove lemma Y inline is
digested as *two* proof trees (`prf-x`, `prf-y`) and a lemma tree, with
`prf-x` depending on `lem-y`.

### The body

The body is the **re-authored** content — the digester writes the tree in
its own words, in the vault's language, at the granularity the tree's taxon
demands. It is never a transcription (see [Copyright](#copyright--the-hard-rules)).

- **Math is clean KaTeX**: `$…$` inline, `$$…$$` display. No source-PDF
  artifacts, no image-of-an-equation.
- **Cross-references are Obsidian wikilinks**: `[[thm-lagrange]]` or
  `[[thm-lagrange|Lagrangeov teorem]]`, targeting tree ids in this vault.
- **No scrollback language in standalone trees** — see next section.

### The standalone discipline

Imported, with credit, from the blog-writer's forest-readiness convention
(`blog-writer/docs/forest-readiness.md` §1), where it was first stated for
blog sections; a tree is a section that has fully left its book:

A tree with `standalone: true` is written to be read **alone**, with no
scrollback: never "as we saw above", "ranije", "u prethodnom poglavlju",
"using the same trick" — a forest walk has no above, no previous, no same.
Every leaned-on term is defined in the tree or wikilinked; notation is
restated, not assumed ("gdje je $H \le G$ podgrupa" costs one clause). The
sentence or two of redundancy per tree is the price of the forest.

A tree that honestly fails this — an intuition that only lands as a coda to
its exposition — says `standalone: false`, and the Forest keeps it attached
to its `depends` targets instead of serving it alone.

## index.md — the work's root

`index.md` is the vault's entry point and the work's map: the source's own
structure (chapters or thematic parts as headings) rendered as an ordered
list of wikilinks, each with a one-line gloss:

```markdown
# Undergraduate Algebra — karta

## 2 · Grupe

- [[def-group]] — što je grupa: operacija, asocijativnost, neutralni, inverzi
- [[thm-lagrange]] — red podgrupe dijeli red grupe
```

Obsidian renders it as the book's clickable table of contents; the Forest
treats it as the digester's claim of coverage — a source section with no
tree in the index was deliberately skipped, not forgotten.

## views/

Views are **derived** files — regenerable from the trees, committed anyway
so the vault renders without tooling. A tool that edits trees regenerates
the views before it is done.

The reference generator is `scripts/build-views.mjs <vault-dir>`; it
rewrites all three views from the trees, deterministically (the only date
in its output is `forest.json`'s `created`).

- **`views/dag.md`** — mermaid fences over the **transitively reduced**
  `depends` graph (an edge implied by a longer path is dropped): first
  ONE small overview diagram of the `index.md` sections as group nodes
  with aggregated, deduplicated edges between them, then one small
  top-down diagram per section (≤ ~15 nodes each; a larger section is
  chunked) showing **statement and prose trees only — `prf-` and `exr-`
  trees are omitted**, along with their edges, for legibility — a book's
  DAG doubles in size and halves in meaning when every proof shadows its
  statement. Under each diagram, the trees it shows as wikilinks. Never
  a single whole-vault graph: one giant diagram is exactly the tangle
  this shape replaced. Node labels are tree ids; edges point from
  prerequisite to dependent (an arrow `def-coset --> thm-lagrange` reads
  "coset feeds Lagrange").
- **`views/by-concept.md`** — the vault inverted through the registry: one
  heading per concept id appearing in any tree's `teaches`, listing that
  concept's trees as wikilinks with their taxa. The view a tutor uses to
  answer "what does this vault hold about `cosets`?".
- **`views/forest.html`** — *generated, optional but recommended*: a
  self-contained interactive rendering of the whole vault (opens from
  `file://`, no network, math pre-rendered with KaTeX and its fonts
  inlined). Layout is computed at generation time — transitive reduction,
  longest-path layering, barycenter crossing-reduction, fixed x/y
  coordinates — never by a client library. The page draws no dependency
  arrows; the `depends` DAG surfaces instead as **reading states**. Every
  tree wears one of three outlines: *savladano* (the reader marked it
  understood, from the side panel), *spremno* (every id in its full,
  unreduced `depends` list is savladano — vacuously true for roots) and
  *nije spremno* (otherwise). Marks live only in the browser's
  `localStorage`, keyed by the vault's `source.title` + `created`, so the
  generated file itself stays deterministic; a footer control resets
  progress, and marking a merely-ready tree first offers a `/tutor`
  self-check. The `index.md` sections are collapsible groups (collapsed:
  one bar with title and "N/M savladano" progress wearing the same three
  outlines; expanded: the trees laid out inside); proofs fold under their
  statements behind a "Prikaži dokaze" toggle, exercises behind "Prikaži
  zadatke" (off by default when the vault has more than 8); clicking a
  tree opens its full content in a side panel with an `obsidian://` link.
  The validator treats `forest.html` as optional — old vaults without it
  remain valid — but when the file exists it must be non-empty.

## Copyright — the hard rules

A vault digested from a copyrighted work is a **derivative work**. The
rules, stated once here and repeated by the digest skill to the member
every time it runs:

1. A vault of a copyrighted source is `derivative: true`, carries the
   `notice`, and its **digested content stays local and never enters the
   library** — not as a vault, not tree-by-tree, not "just the
   definitions". Re-authoring does not launder provenance; per-tree
   `source.pages`/`ref` exists precisely so the derivation is never
   deniable. The one door out of a derivative vault is a tree the digest
   did NOT write — `origin: member`/`agent`, no `source.pages` — through
   `/grow`'s firewall and provenance interview.
2. An openly-licensed source records its actual license in
   `source.license`, and its terms are honored (attribution in
   `forest.json`, at minimum).
3. **GFDL and CC BY-SA sources (Wikipedia, math.StackExchange, …) still
   never enter the library**, even though the vault itself is legal to
   make and share under their terms: share-alike is incompatible with the
   library's CC BY license (spec `DECISIONS.md` D-001, and the provenance
   policy's StackExchange rule). Such a vault is shareable *as a vault*
   under its inherited license — it is the library door that stays closed.
4. Only a vault built from CC BY (or more permissive) material, or from
   the member's own writing, may be `derivative: false`. Extraction into
   library bundles is open to such vaults wholesale — and, from a
   derivative vault, ONLY to its `origin: member`/`agent` trees (rule 1's
   door), never to digested content. Both routes pass through the same
   provenance-gated submission path.

Local-first is therefore not a limitation of slice 1 but the design: the
common case — a member digesting the textbook they are actually studying —
produces a vault that is legally *theirs to use and nobody's to
redistribute*, and the format makes that boundary machine-visible
(`derivative`, `notice`) instead of relying on memory.

## `sessions/` — the member's workspace in the same vault

A vault may hold a `sessions/` folder for tutor sessions ABOUT this work
(`sessions/<slug>/state.json` + `session.md`, the AI_instructor format).
Tooling ignores it entirely — the validator, views and index read only
`forest.json`, `trees/`, `index.md`, `views/` — but Obsidian shows it, so
studying and being tutored happen in ONE vault window. Session notes are
the member's own and stay local like everything else here.

## The retrieval index: `index/`

`scripts/index-vault.mjs` derives `index/index.json` (schema
`forest-index-0.1`: model, dims 384, quantization, one item per tree) and
`index/vectors.i8.bin` (int8, per-item scale) under the ecosystem's D-003
embedding convention, so vault vectors and library vectors are mutually
comparable. Like `views/`, it is a derived artifact: optional, never
required by the validator, rebuilt whenever trees change. Committing it
is a per-vault choice — the repo's example vault commits its ~5 KB index
so it works out of the box; personal vaults typically regenerate.
`scripts/search-vault.mjs` fuses lexical and cosine signals over it and
degrades to lexical-only without the model (the first hybrid run
downloads ~130 MB, once).

## Growth: from vault tree to library bundle

Digestion brings work in; growth sends a member's own work out.
`scripts/grow-bundle.mjs` mechanically converts chosen trees into a
bundle-v1 **skeleton** (problem, proof or blog folder: content files
with vault-local wikilinks resolved to plain text, a prefilled
`manifest.json`, an annotation draft), and the `/grow` skill
(`skills/grow/SKILL.md`) wraps it in the member-facing flow — polish,
the provenance interview, concept minting, spec validation, PR
hand-off. Like `views/` and `index/`, the emitted folder is a derived
artifact of the trees; unlike them it leaves the vault, and from that
moment plays entirely by bundle v1's rules.

Both script and skill enforce the **firewall**, which is `origin`'s
reason to exist: a tree may become library content only if the vault is
not derivative, or the tree's `origin` is `member`/`agent` *and* the
member affirms its originality in the provenance interview. Digest-origin
trees of a `derivative: true` vault are refused mechanically, before
anything is written — re-authoring does not launder provenance (see
[Copyright](#copyright--the-hard-rules) and
`spec/policies/provenance.md`), and the refusal is final by design: no
interview can talk its way past it.

A grown tree gains a backlink in its frontmatter — `x_library:
"<bundle-id>"` (tool-private `x_` space) — so the vault remembers what
it seeded and tools stop offering the tree for growth again.

## Relationship to bundle spec v1

Vaults are a **new artifact family**, not a new bundle type. Bundle format
v1 (`spec/bundles.md`) governs what the *library* accepts — public,
CC BY, one artifact per folder, validated in CI. Vaults are the opposite
end of the pipeline: local-first, usually derivative, one *work* per
folder, many objects inside. The two meet only where the rules above allow
extraction into a bundle, which then plays entirely by v1's rules.

Shared DNA is deliberate: the concept registry is the same vocabulary
(`teaches`/`requires` resolve against `concepts.yaml`), the `^x_`
unknown-key rule is adopted verbatim, ids are permanent kebab-case, and
DAG-acyclicity is enforced the same way. The taxa extend forest-readiness's
five with the formal kinds digested mathematics needs.

**Promotion path:** this document is the draft. When the Forest stabilizes
— the digester has produced real vaults, the reader walks them, the sharp
edges are filed — the format is promoted into the `spec` repo as a
schema-backed contract (its own schema file, validator rules, a decision
log entry), and `schema_version` graduates from `forest-0.1` accordingly.
Until then, this file is normative and tools pin against it.

### `source.redistribution` — the third provenance state

`derivative: true` alone conflates two situations the first real vault
immediately hit. The optional `source.redistribution` field separates
them:

| value | meaning | required `notice` (verbatim) |
|---|---|---|
| `"none"` (default) | copyrighted source; the vault must stay local | `LOKALNO — izvedeno djelo, ne šalje se u knjižnicu` |
| `"share-alike-only"` | GFDL / CC BY-SA source; the vault MAY be shared **as a vault under the source's own terms** | `IZVEDENO — smije se dijeliti samo pod licencom izvora (share-alike); ne ide u knjižnicu` |

Either way the vault never enters the library: D-001 pins the library to
CC BY, and share-alike terms cannot be laundered into it.
