# The Forest vault format — draft 0.2

**Status: normative draft.** This document defines the on-disk format the
Knowledge Forest tools produce when they *digest* a work — a book, a paper,
a set of notes — into a **vault** of small, independently addressable
teaching objects called **trees**. A second implementation written from
this document alone should agree with the reference tooling on every vault
it accepts or rejects.

Two schema versions are current. `forest-0.1` is the format as first
proven in the field; `forest-0.2` adds the [structure
layer](#forest-02--the-structure-layer) — objects, morphisms, the `cd`
diagram block — and changes nothing else. A 0.1 vault stays valid forever
and is read exactly as before; only a vault that says `forest-0.2` may use
the layer, and in a 0.1 vault its taxa and keys are errors.

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
│   ├── prf-lagrange-particija.md
│   ├── obj-group-action.md   forest-0.2: a kind of structure
│   └── mor-orbits.md         forest-0.2: an arrow between two kinds
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
| `schema_version` | string | `"forest-0.1"`, or `"forest-0.2"` for a vault that uses the [structure layer](#forest-02--the-structure-layer). Nothing else. |
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
| `con-` | `connection` | A bridge between two ideas — an equivalence, a contrast, a generalization. Must name both ends explicitly (from 0.2, also in `about`). |
| `obj-` | `object` | **forest-0.2 only.** A *kind* of mathematical structure — "a group acting on a set" — never one particular structure. See [Objects](#objects--obj--taxon-object). |
| `mor-` | `morphism` | **forest-0.2 only.** A construction from one kind of structure to another — orbits, the stabilizer of a point, Cayley's action. See [Morphisms](#morphisms--mor--taxon-morphism). |

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
| `taxon` | string | One of the sixteen taxa above (the last two only in a `forest-0.2` vault); must match the id's prefix. |
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
| `about` | array | **Optional, forest-0.2 only.** The `obj-`/`mor-` ids this tree is about. See [`about` and `fields`](#about-and-fields--any-tree). |
| `fields` | array | **Optional, forest-0.2 only.** Kebab-case field names — `algebra`, `kombinatorika` — the tree matters for. Same section. |

Objects and morphisms add keys of their own, listed in the [structure
layer](#forest-02--the-structure-layer); every key above applies to them too.

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
- **Commutative diagrams are ` ```cd ` fences** (forest-0.2) — see [the
  `cd` block](#the-cd-block--commutative-diagrams). Obsidian shows the
  source; the Forest's own views draw it.
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

## forest-0.2 — the structure layer

A vault whose `forest.json` says `"schema_version": "forest-0.2"` may
carry, beside the trees it would have anyway, a second graph: **objects**
— kinds of mathematical structure — and **morphisms** — the constructions
that take a structure of one kind to a structure of another. Both are
ordinary trees. Frontmatter and body, `depends`, `teaches`/`requires`,
`standalone`, `language`, `origin`, wikilinks, `index.md` membership,
readiness in the views, search — everything this document says about
trees holds for them, and the layer adds two taxa, a handful of
frontmatter keys and one fenced-block grammar.

**The 0.1/0.2 rule.** A `forest-0.1` vault is a `forest-0.2` vault with no
structure layer. 0.1 vaults stay valid forever and validate, index and
render exactly as they did. In a 0.1 vault the two new taxa and every new
key are **errors**: the version string is the only switch, so no vault
migrates by accident, and a vault that wants the layer says so by changing
`schema_version`. Every tool reads both versions. (`x_about` / `x_fields`
may be trialled on 0.1 trees meanwhile, under the `^x_` rule.)

### Objects — `obj-`, taxon `object`

An object is a *kind* of structure or a way of presenting one — "a
group", "a set", "a group acting on a set", "the category of $G$-sets" —
never one particular group. Beyond the usual keys its frontmatter has:

| Field | Type | Rule |
|---|---|---|
| `symbol` | string | **Required.** LaTeX for the data, **no `$` delimiters** — `(G, X, \rho)`. Typeset whole by the views. |
| `hom` | string | **Required.** One sentence in the vault's language, inline `$…$` math allowed: what a map between two structures of this kind is. For actions, the equivariant maps. |
| `same_as` | string | **Optional.** The id of the object in the library forest that this one is the same as — cross-vault identity, since registry concepts are coarser than objects. The library is another repository, so the validator checks only the shape (`obj-<kebab>`); `/grow` resolves it. |
| `nlab` | object | **Optional.** `{ title, revision }` — the nLab page and revision whose section skeleton and link list were consulted. Credit, not content: no nLab prose enters a tree. |

Two string types run through the whole layer and the validator tells them
apart: **LaTeX fields** (`symbol`, `statement`, `label`) are typeset whole
and must not contain `$`; **sentence fields** (`hom`, `on_homomorphisms`,
each entry of `needs`, each value in `values`) are prose in the vault's
language with inline `$…$` math, rendered like a tree body. Croatian words
inside a LaTeX field would typeset as a string of italic variables.

The body follows a fixed skeleton. Recommended headings in an `hr` vault:
`## Ideja`, `## Definicija`, `## Podaci`, `## Svojstva`, `## Primjeri`,
`## Povezano`; in an `en` vault: `## Idea`, `## Definition`, `## Data`,
`## Properties`, `## Examples`, `## Related`. The validator warns when
`## Definicija` / `## Definition` is missing; the rest is convention. An
object typically `depends` on the `def-` tree that defines it and links it
from *Definicija*; *Podaci* links the `data` arrows, *Primjeri* the
`instance` arrows, *Povezano* the `generalizes` and `construction` arrows.

### Morphisms — `mor-`, taxon `morphism`

A morphism is a construction from one kind to another: given any structure
of the source kind it produces a structure of the target kind, possibly
after supplying extra data. It composes — an arrow out of the target
applies to the result. Beyond the usual keys:

| Field | Type | Rule |
|---|---|---|
| `kind` | string | **Required.** One of the seven kinds in the table below. |
| `from`, `to` | string | **Required.** Object ids in this vault. `from` is the reserved pseudo-id **`pt`** if and only if `kind` is `instance`: `pt` ("point") is not a tree, it stands for the empty source of an arrow that only picks one example, and it may appear nowhere else. |
| `statement` | string | **Required.** LaTeX, no `$`: what the arrow does to a structure — `(G,X,\rho)\mapsto X/G`. |
| `label` | string | **Optional.** Short LaTeX, no `$`, for the edge label in the graph; a page falls back to `title`. |
| `acts_on` | `"all"` or array | **Required unless `kind: instance`** (then forbidden). Which components of the source the arrow reads: the string `all`, or a list of `mor-` ids of kind `data` whose `from` equals this arrow's `from`. |
| `needs` | array of strings | **Required unless `kind: instance`** (then optional); may be empty. Sentences, inline math allowed, naming extra data that is **not** part of the source — `"odabrana točka $x \in X$"`, `"$X$ konačan"`. |
| `on_homomorphisms` | string | **Required unless `kind: instance`** (then forbidden). One sentence: what the arrow does to a map between two source structures, or what it forgets. |
| `functorial` | boolean | **Required unless `kind: instance`** (then forbidden). Whether the construction also carries a map between two source structures to a map between the two results, compatibly with composition. Orbits do — an equivariant $f\colon X\to Y$ gives $X/G\to Y/G$; the stabilizer of a chosen point does not, because the point does not travel with a bare map. `kind: generalizes` requires `true`. |
| `inverse` | string | **Optional.** A `mor-` id that must point back (`inverse` is symmetric). Marks an isomorphism of kinds — `mor-curry` / `mor-uncurry`. |
| `generalized_by` | array | **Optional.** `mor-` ids of arrows of which this one is a special case: $G$ on itself is $G$ on $G/H$ with $H=\{e\}$. |
| `values` | object | **`kind: instance` only.** A map from `mor-` ids whose `from` equals this arrow's `to`, to one sentence each — what that arrow yields on this example (`mor-orbits: "ogrlice; ima ih $14$"`). This is how an arrow carries its examples without new authoring. |

Seven kinds, closed:

| kind | meaning | group-action example |
|---|---|---|
| `data` | projection to a component that is itself an object | $(G,X,\rho)\mapsto G$ |
| `transform` | builds a structure of another kind from the whole; `inverse` marks an isomorphism of kinds | $\rho\mapsto\hat\rho\colon G\to\mathrm{Sym}(X)$; Cayley $G\mapsto(G,G,\lambda)$ |
| `extract` | a sub- or quotient structure of a component | $X\mapsto X/G$, $X\mapsto X^G$ |
| `property` | a measurement, usually needing extra data named in `needs`; its target is an object like any other, and a bare value such as a count ends in an `obj-nat` | $(G,X,\rho),\,x\mapsto \mathrm{Stab}_G(x)\le G$; $(G,X,\rho)\mapsto\lvert X/G\rvert\in\mathbb N$ |
| `instance` | a concrete example; `from` is `pt` | $(\mathbb Z_6, B^6, \text{rotacija})$ |
| `generalizes` | every structure of this kind is a structure of the wider kind, with nothing forgotten; always functorial | group action $\to$ monoid action |
| `construction` | a categorical construction over the kind: how it sits in a category, or a limit or colimit built from it | $(G,X,\rho)\mapsto$ an object of $G\text{-}\mathbf{Set}$; $X/G$ as a coequaliser |

**Two ways of stating what an arrow consumes.** Both validate; the author
chooses by audience. The lighter way keeps the extra datum on the arrow:
`acts_on: all` (or the data arrows it reads), `needs: ["odabrana točka
$x \in X$"]`, and an honest `functorial: false` with the reason in
`on_homomorphisms` — the stabilizer of a point, drawn out of
`obj-group-action`. The cleaner way makes the datum part of a new object:
`obj-pointed-group-action`, a group action with a chosen point, joined to
`obj-group-action` by a `data` arrow, and the stabilizer starts there with
`needs: []` and `functorial: true`, since a map of pointed actions carries
one stabilizer into the other. The first spares a beginner a new kind of
object before meeting stabilizers; the second is what an advanced vault
wants.

**Arrows are not prerequisites.** `from`/`to` edges are a second graph,
separate from `depends`: they may form cycles (`mor-curry` /
`mor-uncurry`), they never make one tree a prerequisite of another, and
only `depends` is checked for acyclicity. Objects and morphisms sit in the
`depends` DAG like any tree — an arrow typically depends on its endpoints
and on the prose tree that explains it — and their readiness on screen is
the readiness of their tree.

### `about` and `fields` — any tree

Any tree in a 0.2 vault may carry:

| Field | Type | Rule |
|---|---|---|
| `about` | array | `obj-`/`mor-` ids in this vault, all resolving to an object or a morphism. A theorem lists the objects and arrows it is about (Burnside: `[mor-orbit-count, mor-fixed-points]`); a `con-` tree lists its ends here as well as naming them in prose. |
| `fields` | array | Kebab-case words — `algebra`, `kombinatorika`, `geometrija` — the fields the tree matters for; the views group an object's theorems by them. |

Theorems stay trees, not arrows: a statement and its proof live where they
always did, and `about` is the pointer from the structure graph to them.

### `index.md` — the `## Struktura` section

A 0.2 vault's `index.md` may have a section headed `## Struktura`
(`## Structure` in an `en` vault) listing the objects as wikilinks with a
one-line gloss, like any other section. Morphisms are not listed: the views
attach each arrow to its `from` object (an instance to its `to`), as proofs
attach to their statements.

### The `cd` block — commutative diagrams

A fenced block with the language tag `cd` is a commutative diagram,
rendered by the shared renderer (`scripts/lib/render.mjs`) for every
consumer: tree bodies at build time, answers and tutor notes by the bridge.
One statement per line:

```
% title: <text>                                  optional, first line only
<name> @ <col>,<row> : <KaTeX>                   a corner
[<arrow>:] <name> -> <name> : <KaTeX> [opt, opt] an arrow
<path> = <path> : <justification>                an equation
% comment
```

- A **corner** has a name, a grid cell — column and row, zero-based,
  growing right and down; a negative coordinate is an error shown in the
  figure — and KaTeX for its label.
- An **arrow** joins two declared corners, optionally named (`a:`) so an
  equation can refer to it, with KaTeX for its label and options from a
  closed set: label side `above | below | left | right`; line `dashed |
  dotted`; head `mono | epi | iso | equal | mapsto | hook | none`;
  `bend=<-1..1>`; `shift=<integer>` for parallel arrows.
- An **equation** has two paths, each a space-separated chain of arrow
  names (`id` is allowed, for the identity), and a justification: `def`,
  or a `[[wikilink]]` to the tree that proves it. The renderer checks that
  both paths are chains of declared arrows with matching endpoints and the
  same start and end; the caption then states the equation in the arrows'
  *labels*, composed right to left — for the square below,
  *komutira: $\beta \circ (\mathrm{id}_G\times f) = f \circ \alpha$ (po
  definiciji)* / *commutes: … (by definition)*, or the wikilink in place of
  the parenthesis. Arrow names are for the source only; a reader never sees
  them, except as the caption's tooltip, and an equation over an arrow
  drawn without a label falls back to names. A failed check prints the
  problem in red.
- `%` begins a comment; `% title:` on the first line names the figure, and
  anywhere later it is an ordinary comment.

The equivariance square, as it appears in a `con-` tree:

````markdown
```cd
GX @ 0,0 : G\times X
GY @ 1,0 : G\times Y
X  @ 0,1 : X
Y  @ 1,1 : Y
a: GX -> GY : \mathrm{id}_G\times f [above]
b: GX -> X  : \alpha [left]
c: GY -> Y  : \beta [right]
d: X  -> Y  : f [below]
a c = b d : def
```
````

An unknown option or a malformed line does not kill the figure: the
renderer draws what it can and shows the error in red inside the figure,
so an author — or a model — learns the vocabulary from its own mistakes. A
wikilink justification is a body wikilink like any other, so the
validator's dead-link rule covers it. KaTeX's native `\begin{CD}` keeps
working for plain rectangles.

**Figure contract.** The views rely on this shape, and no JavaScript is
needed to display it:

- `<figure class="cd" data-title="…">` wraps everything.
- `<div class="cd-grid">` is a CSS grid of fixed-size cells, 7em × 3.6em,
  with the corners KaTeX-rendered inside.
- `<svg class="cd-arrows">` is an absolutely positioned overlay in the
  same em coordinate system — `viewBox` in grid units × 100, width and
  height 100% — drawing straight or bent arrows from cell edge to cell
  edge, with arrowheads per the head option.
- Labels are absolutely positioned HTML spans (KaTeX) at the arrow
  midpoint, offset to the chosen side.
- `<figcaption>` carries the equations and their verdicts.
- The CSS for `.cd-*` is one string exported from `render.mjs` as
  `cdCss()`, so `build-views.mjs` and `serve-vault.mjs` include the same
  rules.

### What the validator checks

In a 0.2 vault, `checkStructure` in `scripts/validate-forest.mjs` adds the
rules below to every 0.1 rule. Each error names the file and the key.

Errors:

- `obj-` ids have taxon `object`, `mor-` ids taxon `morphism` (the usual prefix rule).
- Allowed keys: the base set plus `about`, `fields` on any tree; plus `symbol`, `hom`, `same_as`, `nlab` on an object; plus `kind`, `from`, `to`, `statement`, `label`, `acts_on`, `needs`, `on_homomorphisms`, `functorial`, `inverse`, `generalized_by`, `values` on a morphism. A structure key on the wrong taxon is an unknown key.
- `symbol` is a non-empty string without `$`; `hom` is a non-empty string; `same_as`, when present, matches `obj-<kebab>`; `nlab`, when present, is `{ title: string, revision: integer }` and nothing else.
- `kind` is one of the seven kinds.
- `to` names an object tree in this vault; `from` names an object tree, or is `pt` — `pt` if and only if `kind` is `instance`.
- `statement` and `label` are LaTeX strings without `$`.
- An `instance` arrow has no `acts_on`, `on_homomorphisms` or `functorial`; a non-instance arrow has all of `acts_on`, `needs`, `on_homomorphisms` and `functorial`.
- `acts_on` is `all` or a list of `mor-` ids; each names a morphism of kind `data` whose `from` equals this arrow's `from`.
- `needs` is a list of non-empty strings; `on_homomorphisms` a non-empty string; `functorial` a boolean.
- A `generalizes` arrow has `functorial: true`.
- `inverse`, when present, names a morphism whose own `inverse` is this tree.
- `generalized_by` entries name morphisms.
- `values` appears only on an instance arrow; it is a mapping whose keys name morphisms with `from` equal to this arrow's `to` and whose values are non-empty strings.
- `about` entries name objects or morphisms in this vault; `fields` entries are kebab-case.

Warnings:

- An object with no `instance` arrow into it.
- An object with no `generalizes` arrow in either direction.
- An object body without a `## Definicija` / `## Definition` heading.

In a 0.1 vault: the taxa `object` and `morphism` (prefixes `obj-`, `mor-`)
are an error that names the needed `schema_version`, and every key above
is an unknown key. `depends` keeps its single rule for both versions: a
DAG over all trees, `pt` never among them.

### Other tools

- `scripts/index-vault.mjs` accepts both versions. A structure tree's
  `symbol` or `statement` joins the embedded text right after the title,
  so a query like `X/G` finds the arrow whose body never spells it out;
  items keep their taxon; the D-003 embedding convention is unchanged. A
  morphism's search group is its `from` object's `index.md` section.
- `scripts/grow-trees.mjs` writes frontmatter with js-yaml, so a `needs`
  sentence holding a comma or a colon round-trips, and resolves `from`,
  `to`, `inverse`, `acts_on`, `about`, `generalized_by` and the keys of
  `values` the way it resolves `depends` when a tree is renamed or
  remapped on its way into the library forest.

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
tree in the index was deliberately skipped, not forgotten. A `forest-0.2`
vault may add a [`## Struktura` section](#indexmd--the--struktura-section)
listing its objects.

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
(`sessions/<slug>/state.json` + `notes.md`, written by the tutor skill).
The validator, views and index ignore it — they read only `forest.json`,
`trees/`, `index.md`, `views/` — and the bridge (`serve-vault.mjs`) only
reads `state.json` and `notes.md` from a session directory, never writes
them, to show a browser-tutor session in `forest.html`; the format of
those two files belongs to the tutor skill, not to this spec. Obsidian
shows the folder too, so studying and being tutored happen in ONE vault
window. Session notes are the member's own and stay local like
everything else here.

The same holds for `.ask/`: it is the browser bridge's mailbox
(`serve-vault.mjs` writes requests, `/ask --watch` writes answers),
pure runtime state — gitignored, ignored by the validator, and never
part of any export. Delete it freely; the next bridge launch recreates
it.

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
log entry), and `schema_version` graduates from `forest-0.1` / `forest-0.2`
accordingly. Until then, this file is normative and tools pin against it.

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
