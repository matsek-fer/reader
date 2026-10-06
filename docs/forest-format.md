# The Forest vault format — draft 0.3

**Status: normative draft.** This document defines the on-disk format the
Knowledge Forest tools produce when they *digest* a work — a book, a paper,
a set of notes — into a **vault** of small, independently addressable
teaching objects called **trees**. A second implementation written from
this document alone should agree with the reference tooling on every vault
it accepts or rejects.

Three schema versions are current. `forest-0.1` is the format as first
proven in the field; `forest-0.2` adds the [structure
layer](#forest-02--the-structure-layer) — objects, morphisms between and
inside kinds, the `cd` diagram block — and changes nothing else;
`forest-0.3` splits that layer into [two levels](#forest-03--the-two-levels)
— a *kind* of structure and an *instance* of a kind — and changes nothing
outside it. A 0.1 vault stays valid forever and is read exactly as before;
a 0.2 vault likewise. Only a vault that says `forest-0.2` may use the
layer, only one that says `forest-0.3` may use the two levels, and each
version's own keys are errors one version down, so no vault migrates by
accident.

It is a draft in the precise sense of the [relationship to spec
v1](#relationship-to-bundle-spec-v1) section: vaults are a new, local-first
artifact family, proven here in the field before any of it hardens into the
`spec` repo's contract.

A worked reference vault lives at
[`examples/mini-vault/`](../examples/mini-vault/) — a `forest-0.3` vault in
which most rules below (it is non-derivative, so per-tree provenance is
shown by the fixtures instead) is exercised, and the vault doubles as
documentation. Open it as an Obsidian vault to see the format render. The
frozen 0.2 reference is the fixture
[`scripts/test-fixtures/structure-ok-0.2`](../scripts/test-fixtures/structure-ok-0.2/),
kept passing so the older version stays covered after the mini-vault moved
on.

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
│   └── mor-orbits.md         forest-0.2: an arrow between two objects
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
| `schema_version` | string | `"forest-0.1"`, `"forest-0.2"` for a vault that uses the [structure layer](#forest-02--the-structure-layer), or `"forest-0.3"` for one that uses [the two levels](#forest-03--the-two-levels). Nothing else. |
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
| `regions` | array | **Optional, `forest-0.3` only.** `[{ id, title }, …]` — the labelled areas the structure canvas is divided into, in the order the page lays them out. See [Regions](#regions--subgraphs-that-read-on-their-own). |

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
| `obj-` | `object` | **forest-0.2 and up.** A box of the structure graph. In 0.2: a *kind* of mathematical structure — "a group acting on a set" — never one particular structure; with `type`, a second box of a kind the vault already has. In 0.3: either a kind (no `instance_of`) or an *instance* of one (`instance_of`), generic or named. See [Objects](#objects--obj--taxon-object) and [the two levels](#forest-03--the-two-levels). |
| `mor-` | `morphism` | **forest-0.2 and up.** An arrow of the structure graph: a construction from one kind of structure to another — orbits, the stabilizer of a point, Cayley's action — or, with `kind: hom`, a map between two structures. See [Morphisms](#morphisms--mor--taxon-morphism). |

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
| `about` | array | **Optional, forest-0.2 only.** The `obj-`/`mor-` ids this tree is about. See [`about`, `fields` and `assumes`](#about-fields-and-assumes--any-tree). |
| `fields` | array | **Optional, forest-0.2 only.** Kebab-case field names — `algebra`, `kombinatorika` — the tree matters for. Same section. |
| `assumes` | array | **Optional, forest-0.2 only.** Kebab-case tokens for the principles the tree depends on — `axiom-of-choice`. Same section. |
| `region` | string | **Optional, forest-0.3 only.** One kebab-case token: which labelled area of the structure canvas this tree belongs to. See [Regions](#regions--subgraphs-that-read-on-their-own). |

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
— kinds of mathematical structure — and **morphisms** — the arrows between
them. Arrows come in two sorts: *constructions*, which take a structure of
one kind to a structure of another, and *homs*, which are maps between two
structures of one kind. Both objects and morphisms are ordinary trees.
Frontmatter and body, `depends`, `teaches`/`requires`, `standalone`,
`language`, `origin`, wikilinks, `index.md` membership, readiness in the
views, search — everything this document says about trees holds for them,
and the layer adds two taxa, a handful of frontmatter keys and one
fenced-block grammar.

The picture stays made of boxes and single-source arrows; depth sits
behind it and is reached on demand. A second structure of a kind is a
second box, not a new sort of node; an arrow that needs two structures
starts from a box that holds both; an arrow from a box to itself is drawn
as a loop and can be shown unrolled; what holds only up to an isomorphism,
or only under an axiom, is a noted property of the tree that says so.

**The 0.1/0.2 rule.** A `forest-0.1` vault is a `forest-0.2` vault with no
structure layer. 0.1 vaults stay valid forever and validate, index and
render exactly as they did. In a 0.1 vault the two new taxa and every new
key are **errors**: the version string is the only switch, so no vault
migrates by accident, and a vault that wants the layer says so by changing
`schema_version`. Every tool reads both versions. (`x_about` / `x_fields`
may be trialled on 0.1 trees meanwhile, under the `^x_` rule.)

**Reading this section for a 0.3 vault.** Everything below holds in 0.3 too,
with three replacements that [the two levels](#forest-03--the-two-levels)
state in full: a typed object becomes an *instance* (`instance_of` in place
of `type`), the arrow kind `instance` and the pseudo-id `pt` are gone — an
example is an instance object, which carries the `values` — and a `hom`
joins two instances rather than two boxes of one type. A 0.2 vault keeps
all three for ever.

### Objects — `obj-`, taxon `object`

An object is a *kind* of structure or a way of presenting one — "a
group", "a set", "a group acting on a set", "the category of $G$-sets" —
never one particular group. Beyond the usual keys its frontmatter has:

| Field | Type | Rule |
|---|---|---|
| `symbol` | string | **Required.** LaTeX for the data, **no `$` delimiters** — `(G, X, \rho)`. Typeset whole by the views. |
| `hom` | string | **Required, except on a typed object**, which inherits its type's and may leave it out. One sentence in the vault's language, inline `$…$` math allowed: what a map between two structures of this kind is. For actions, the equivariant maps. |
| `type` | string | **Optional, 0.2 only.** The id of another object tree in this vault: this box is *another object of that kind*. The type must itself have no `type` — one level only. See [Typed objects](#typed-objects--two-boxes-of-one-kind). In 0.3 this is `instance_of`, and `type` is an error. |
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
A typed object is exempt from the skeleton: a sentence or two saying what
the second box is for is its whole body.

#### Typed objects — two boxes of one kind

"In the category of fields, the objects are fields and the morphisms are
field homomorphisms." To draw one such morphism the graph needs two
objects of the kind, so **two structures of the same kind with a map
between them are two boxes of one type**: the kind's own box, and a second
box whose `type` names it.

```yaml
# trees/obj-group-action-target.md
id: obj-group-action-target
taxon: object
title: "Drugo djelovanje iste grupe"
symbol: '(G, Y, \sigma)'
type: obj-group-action
```

- `type` names an object tree of this vault that carries no `type`
  itself. Chains are not allowed, so every box has a **root type**: its
  `type` when it has one, its own id otherwise. Two boxes are *of one
  type* when their root types agree.
- A typed object inherits its type's `hom`; `symbol` stays required,
  because the second box needs letters of its own.
- It is not a new kind. The validator asks it for no example, no
  `generalizes` arrow and no definition heading, and the views list its
  type's constructions on its page — whatever can be built from a
  structure of the kind can be built from this one.
- `index.md` lists it under `## Struktura` like any object.

### Morphisms — `mor-`, taxon `morphism`

A morphism is an arrow of the structure graph, and there are two sorts.

A **construction** goes from one kind to another: given any structure of
the source kind it produces a structure of the target kind, possibly after
supplying extra data. It composes — an arrow out of the target applies to
the result. Orbits, the stabilizer of a point and Cayley's action are
constructions.

A **hom** (`kind: hom`) stays inside one kind: it is a single map between
two structures of the same kind, a morphism in that kind's category — a
field homomorphism between two fields, an equivariant map between two
actions of one group. It is remembered as a morphism *in that category*,
not as a construction between kinds, and whether it is invertible is worth
recording. See [`hom`](#hom--a-morphism-inside-one-kind).

Beyond the usual keys:

| Field | Type | Rule |
|---|---|---|
| `kind` | string | **Required.** One of the eight kinds in the table below. |
| `from`, `to` | string | **Required.** Object ids in this vault. `from` is the reserved pseudo-id **`pt`** if and only if `kind` is `instance`: `pt` ("point") is not a tree, it stands for the empty source of an arrow that only picks one example, and it may appear nowhere else. On every other kind `from` may equal `to`: the arrow is then a [loop](#loops-and-the-chain-view). |
| `statement` | string | **Required.** LaTeX, no `$`: what the arrow does to a structure — `(G,X,\rho)\mapsto X/G` — or, on a hom, the map itself — `f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)`. |
| `label` | string | **Optional.** Short LaTeX, no `$`, for the edge label in the graph; a page falls back to `title`. |
| `acts_on` | `"all"` or array | **Required on a construction; forbidden on `instance` and `hom`.** Which components of the source the arrow reads: the string `all`, or a list of `mor-` ids of kind `data` whose `from` equals this arrow's `from`. |
| `needs` | array of strings | **Required unless `kind: instance`** (then optional); may be empty. Sentences, inline math allowed, naming extra data that is **not** part of the source — `"odabrana točka $x \in X$"`, `"$X$ konačan"`; on a hom, what the map depends on beyond its two ends — `"element $g\in G$"`. |
| `on_homomorphisms` | string | **Required on a construction; forbidden on `instance` and `hom`.** One sentence: what the arrow does to a map between two source structures, or what it forgets. |
| `functorial` | boolean | **Required on a construction; forbidden on `instance` and `hom`.** Whether the construction also carries a map between two source structures to a map between the two results, compatibly with composition. Orbits do — an equivariant $f\colon X\to Y$ gives $X/G\to Y/G$; the stabilizer of a chosen point does not, because the point does not travel with a bare map. `kind: generalizes` requires `true`. A contravariant construction — one that turns a map of sources into a map of results *the other way* — is also `true`, with the reversal stated in `on_homomorphisms`. |
| `invertible` | boolean | **Optional, `kind: hom` only.** Whether the map is an isomorphism in its kind. Left out when the arrow stands for a general map that need not be one. |
| `inverse` | string | **Optional.** A `mor-` id that must point back (`inverse` is symmetric). Marks an isomorphism of kinds — `mor-curry` / `mor-uncurry` — or, between two homs, a map and its inverse. |
| `up_to` | string | **Optional; requires `inverse`.** The id of a tree, of any taxon, stating the canonical isomorphism up to which the inverse holds. See [Inverse up to a canonical isomorphism](#inverse-up-to-a-canonical-isomorphism--up_to). |
| `generalized_by` | array | **Optional.** `mor-` ids of arrows of which this one is a special case: $G$ on itself is $G$ on $G/H$ with $H=\{e\}$. |
| `values` | object | **`kind: instance` only; 0.2 only.** A map from `mor-` ids whose `from` equals this arrow's `to`, to one sentence each — what that arrow yields on this example (`mor-orbits: "ogrlice; ima ih $14$"`). This is how an arrow carries its examples without new authoring. In 0.3 it lives on the instance object. |

Eight kinds, closed — seven sorts of construction (an `instance` being the
degenerate one, from `pt`) and the one kind of arrow inside a kind:

| kind | meaning | group-action example |
|---|---|---|
| `data` | projection to a component that is itself an object | $(G,X,\rho)\mapsto G$ |
| `transform` | builds a structure of another kind from the whole; `inverse` marks an isomorphism of kinds | $\rho\mapsto\hat\rho\colon G\to\mathrm{Sym}(X)$; Cayley $G\mapsto(G,G,\lambda)$ |
| `extract` | a sub- or quotient structure of a component | $X\mapsto X/G$, $X\mapsto X^G$ |
| `property` | a measurement, usually needing extra data named in `needs`; its target is an object like any other, and a bare value such as a count ends in an `obj-nat` | $(G,X,\rho),\,x\mapsto \mathrm{Stab}_G(x)\le G$; $(G,X,\rho)\mapsto\lvert X/G\rvert\in\mathbb N$ |
| `instance` | a concrete example; `from` is `pt` | $(\mathbb Z_6, B^6, \text{rotacija})$ |
| `generalizes` | every structure of this kind is a structure of the wider kind, with nothing forgotten; always functorial | group action $\to$ monoid action |
| `construction` | a categorical construction over the kind: how it sits in a category, or a limit or colimit built from it | $(G,X,\rho)\mapsto$ an object of $G\text{-}\mathbf{Set}$; $X/G$ as a coequaliser |
| `hom` | a morphism in the category of its two ends' common kind: one map between two structures of that kind, or from a structure to itself | an equivariant $f\colon X\to Y$; $x\mapsto g\cdot x$ on the set $X$ (a map of sets — in general not equivariant) |

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
`mor-uncurry`) and loops, they never make one tree a prerequisite of
another, and only `depends` is checked for acyclicity. Objects and
morphisms sit in the `depends` DAG like any tree — an arrow typically
depends on its endpoints and on the prose tree that explains it — and
their readiness on screen is the readiness of their tree.

#### `hom` — a morphism inside one kind

```yaml
# trees/mor-equivariant-map.md
id: mor-equivariant-map
taxon: morphism
title: "Ekvivarijantno preslikavanje"
kind: hom
from: obj-group-action
to: obj-group-action-target
statement: 'f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)\ \text{za sve } g\in G,\ x\in X'
label: 'f'
needs: []
```

- `from` and `to` are objects **of one type** — the kind's own box and a
  [typed](#typed-objects--two-boxes-of-one-kind) one, two typed ones, or
  the same box twice (an endomorphism).
- `statement` is the map: for a general map, with the condition that
  makes it a morphism of the kind; for one specific map, the formula,
  the body saying why it is a morphism. `label` is the letter the graph
  shows.
- `needs` is required and may be empty: what the map depends on beyond
  its two ends. The map $x\mapsto g\cdot x$ on a set needs an action on
  that set and an element $g$.
- `invertible`, when present, says whether the map is an isomorphism.
  `true` and `false` are both claims; a general map that may or may not
  be one leaves the key out. On any other kind the key is an error —
  between kinds, `inverse` marks the isomorphism.
- `inverse` works as on any arrow and names the hom going back. When a
  way back exists but is not unique — a surjection has many sections —
  there is no `inverse`: the body says so, and the tree `assumes` the
  axiom of choice if picking one needs it.
- `acts_on`, `on_homomorphisms`, `functorial` and `values` are forbidden.
  They say how a construction treats maps and examples; a hom is itself a
  map.

#### Loops and the chain view

An arrow whose `from` equals its `to` is a **loop**, legal on every kind
but `instance`: a hom from a structure to itself ($x\mapsto g\cdot x$ on
$X$), or a construction that returns a structure of the kind it started
from ($G\mapsto G^{\mathrm{op}}$, $G\mapsto[G,G]$). Loops stay loops in
the data — there is no key for unrolling one, and `inverse` may name the
arrow itself when it is an involution.

The views draw a loop as a small closed arc on the top side of its box,
and show it a second way on the arrow's own page: unrolled into a chain
$X\to X\to X\to\cdots$. The chain is generated at build time as a
[`cd` figure](#the-cd-block--commutative-diagrams) titled *Kao lanac* (*As
a chain* in an `en` vault) — three copies of the object's `symbol` and a
final $\cdots$ in a row, joined by three arrows carrying the arrow's
`label`, or `f` when it has none — and is collected with the tree's other
diagrams. Nothing is stored: loop and chain are two pictures of one arrow.

*Why* they are the same is mathematics, not format, so it lives in the
vault as a tree of its own — `exp-petlja-kao-lanac` in the example vault —
whose `about` lists the loops that are its examples. A vault that has such
a tree adds every new loop to that list.

#### Inverse up to a canonical isomorphism — `up_to`

Two arrows are often inverse only up to an isomorphism one can name:
going there and back returns not the structure itself but one canonically
isomorphic to it. The pair is still written with `inverse`, symmetric as
always, and `up_to` is the property that says so, pointing at the tree
that states the isomorphism for this instance:

```yaml
# scripts/test-fixtures/structure-ok/trees/mor-dual.md — the dual of a
# finite abelian group: applied twice it returns a group canonically
# isomorphic to the one it started from, so it is its own inverse up to that
kind: transform
from: obj-grupa
to: obj-grupa
statement: (G,\cdot)\mapsto \widehat G=\mathrm{Hom}(G,\mathbb{C}^\times)
needs: ['$G$ konačna i komutativna']
inverse: mor-dual
up_to: thm-dvostruki-dual      # the tree stating g ↦ (χ ↦ χ(g))
```

`up_to` requires `inverse` and must resolve to a tree of this vault, of
any taxon — usually the theorem or connection that writes the isomorphism
down. Either arrow of a pair may carry it, or both, each naming the tree
for its own round trip. A pair that is inverse on the nose
(`mor-curry` / `mor-uncurry`) carries none.

**Arrows that need a second structure.** Every arrow has one source. An
arrow that consumes two structures, each an object of the vault — the
homomorphisms from one group into another — starts from a **pair object**:
an object whose `symbol` is the pair, with one `data` arrow to each of the
two. No key is involved; it is the stricter of the [two ways of stating
what an arrow consumes](#morphisms--mor--taxon-morphism), applied to a
datum that is a whole structure. Bodies call it a pair; the word "product"
is kept for a reader who asks for it.

**This device is gone in 0.3.** The ambient category of such a pair is never
clear, and the box earns nothing: a structure made of two things and a map
between them is a *kind* with a [defining
diagram](#a-kind-is-defined-by-a-diagram--data), and the arrows out of the
kind reach each piece. A 0.3 vault introduces no pair object.

### `about`, `fields` and `assumes` — any tree

Any tree in a 0.2 vault may carry:

| Field | Type | Rule |
|---|---|---|
| `about` | array | `obj-`/`mor-` ids in this vault, all resolving to an object or a morphism. A theorem lists the objects and arrows it is about (Burnside: `[mor-orbit-count, mor-fixed-points]`); a `con-` tree lists its ends here as well as naming them in prose; the tree that explains loops as chains lists its loops. |
| `fields` | array | Kebab-case words — `algebra`, `kombinatorika`, `geometrija` — the fields the tree matters for; the views group an object's theorems by them. |
| `assumes` | array | Kebab-case tokens naming what the tree's statement, proof or example assumes about the formal system beyond ZF with classical logic. The vocabulary is open; the starters are `axiom-of-choice` (Zorn's lemma and well-ordering count as it), `excluded-middle` (for a vault that tracks constructive content) and `continuum-hypothesis`. Absent means nothing worth noting. |

Theorems stay trees, not arrows: a statement and its proof live where they
always did, and `about` is the pointer from the structure graph to them.

### Authoring conventions

What the keys above are for, in the order an author meets the cases:

1. **An arrow needs a second structure** that is itself an object of the
   vault: a pair object with `data` arrows to both, and the arrow starts
   there.
2. **Two structures of one kind with a map between them**: a second
   object with `type`, and a `hom` arrow; `invertible` when it is known;
   a non-unique way back is said in the body.
3. **A construction or map from an object to itself** is a loop and stays
   one. The chain is drawn for free; when the vault has a tree on loops
   as chains, the loop joins its `about`.
4. **Inverse only up to a canonical isomorphism**: `inverse` and `up_to`,
   pointing at the tree that states the isomorphism — written first, if
   the vault lacks it.
5. **A statement, proof or example leans on choice** (Zorn's lemma
   included) or on another named principle: `assumes`.
6. **Categorical vocabulary stays in the structure.** In a vault digested
   from a non-categorical work, bodies do not say "product", "functor" or
   "natural isomorphism" unless the reader asks; the kinds, types and keys
   carry those notions.

### `index.md` — the `## Struktura` section

A 0.2 vault's `index.md` may have a section headed `## Struktura`
(`## Structure` in an `en` vault) listing the objects — typed ones
included — as wikilinks with a one-line gloss, like any other section.
Morphisms are not listed: the views attach each arrow to its `from` object
(an instance to its `to`), as proofs attach to their statements.

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

### What the validator checks — 0.2

In a 0.2 vault, `checkStructure` in `scripts/validate-forest.mjs` adds the
rules below to every 0.1 rule. Each error names the file and the key. A 0.3
vault runs the same function under [its own rules](#what-the-validator-checks--03).

Errors:

- `obj-` ids have taxon `object`, `mor-` ids taxon `morphism` (the usual prefix rule).
- Allowed keys: the base set plus `about`, `fields`, `assumes` on any tree; plus `symbol`, `hom`, `type`, `same_as`, `nlab` on an object; plus `kind`, `from`, `to`, `statement`, `label`, `acts_on`, `needs`, `on_homomorphisms`, `functorial`, `invertible`, `inverse`, `up_to`, `generalized_by`, `values` on a morphism. A structure key on the wrong taxon is an unknown key.
- `symbol` is a non-empty string without `$`; `same_as`, when present, matches `obj-<kebab>`; `nlab`, when present, is `{ title: string, revision: integer }` and nothing else.
- `type`, when present, names an object tree in this vault, other than the object itself, that has no `type` of its own.
- `hom` is a non-empty string; it is required on an object without `type` and optional on a typed one.
- `kind` is one of the eight kinds.
- `to` names an object tree in this vault; `from` names an object tree, or is `pt` — `pt` if and only if `kind` is `instance`. `from` may equal `to`.
- `statement` and `label` are LaTeX strings without `$`.
- An `instance` arrow has no `acts_on`, `on_homomorphisms` or `functorial`; a construction (every kind but `instance` and `hom`) has all of `acts_on`, `needs`, `on_homomorphisms` and `functorial`.
- A `hom` arrow has `needs`, and has none of `acts_on`, `on_homomorphisms`, `functorial`, `values`; its `from` and `to` have the same root type (`type` if present, else the object's own id); `invertible`, when present, is a boolean.
- `invertible` appears only on a `hom` arrow.
- `acts_on` is `all` or a list of `mor-` ids; each names a morphism of kind `data` whose `from` equals this arrow's `from`.
- `needs` is a list of non-empty strings; `on_homomorphisms` a non-empty string; `functorial` a boolean.
- A `generalizes` arrow has `functorial: true`.
- `inverse`, when present, names a morphism whose own `inverse` is this tree.
- `up_to` appears only beside `inverse`, and names a tree in this vault.
- `generalized_by` entries name morphisms.
- `values` appears only on an instance arrow; it is a mapping whose keys name morphisms with `from` equal to this arrow's `to` and whose values are non-empty strings.
- `about` entries name objects or morphisms in this vault; `fields` and `assumes` entries are kebab-case.

Warnings, for every object without `type`:

- No `instance` arrow into it.
- No `generalizes` arrow in either direction.
- A body without a `## Definicija` / `## Definition` heading.

A broken `type` is reported once: a hom arrow touching that box is not
also told its ends differ in type.

In a 0.1 vault: the taxa `object` and `morphism` (prefixes `obj-`, `mor-`)
are an error that names the needed `schema_version`, and every key above
is an unknown key. `depends` keeps its single rule for both versions: a
DAG over all trees, `pt` never among them.

### Other tools

- `scripts/index-vault.mjs` accepts all three versions. A structure tree's
  `symbol` or `statement` joins the embedded text right after the title,
  so a query like `X/G` finds the arrow whose body never spells it out;
  items keep their taxon; the D-003 embedding convention is unchanged. A
  morphism's search group is its `from` object's `index.md` section, for
  a hom and a loop as for any arrow — and in 0.3 an instance's group is its
  kind's, so kinds and instances are indexed alike and land together.
- `scripts/grow-trees.mjs` writes frontmatter with js-yaml, so a `needs`
  sentence holding a comma or a colon round-trips, and resolves `from`,
  `to`, `type`, `instance_of`, `inverse`, `up_to`, `acts_on`, `about`,
  `generalized_by`, the entries of `data` and the keys of `values` the way
  it resolves `depends` when a tree is renamed or remapped on its way into
  the library forest. An endpoint, a level pointer and a `data` entry that
  do not resolve are kept and flagged, since dropping one would silently
  change a definition; an `up_to` that does not, or whose `inverse` was
  dropped, is dropped with a note. `pos` and `region` carry over as they
  are.
- `scripts/build-views.mjs` gives a vault with objects a second tab,
  *Struktura*: objects as boxes, arrows coloured by kind (a hom is
  *morfizam*), an inverse pair as one two-headed edge whose labels are
  joined by ⇄, or by ≅ when either side has `up_to`. A loop is an arc on
  its box and a chain on its page. A typed object's page links its type
  (*Isti tip kao*), shows the inherited `hom` and lists the type's
  constructions (*Strelice tipa*); an arrow's page shows *Izomorfizam* for
  `invertible` and *Inverz (do na kanonski izomorfizam)* with the `up_to`
  tree; any tree's page shows *Pretpostavlja* for `assumes`. In a 0.3 vault
  the same tab draws both levels: a kind's page lists its instances and its
  defining diagram, an instance's page its kind and its `values`, the canvas
  is divided into the declared [regions](#regions--subgraphs-that-read-on-their-own),
  and an authored [`pos`](#layout--authored-positions) is honoured where it
  is given.

## forest-0.3 — the two levels

A vault whose `forest.json` says `"schema_version": "forest-0.3"` draws the
structure graph on **two levels**, and the whole of this version is that one
distinction:

- a **kind** is a sort of structure — *a field*, *a valuation*, *a group
  acting on a set*. Statements quantify over it ("for every valuation…"),
  and the arrows out of it are the things one can build, extract or measure
  from any structure of that sort.
- an **instance** is *one* structure of a kind — *the field of real
  numbers*, *a field $K$*, *the ordered group $\Gamma$*. Between two
  instances it makes sense to draw a map; between two kinds it does not.

Both are `obj-` trees, `taxon: object`, boxes on the canvas. The format does
not distinguish a *named* instance from a *generic* one: "the field of real
numbers" and "a field $K$" are both instances, and a generic one simply has
a generic title and symbol. The point of the generic instance is that a
proof can be told one level lower than the kinds — naming the objects it
actually works with — without inventing anything: $K$, then $\mathbb{R}$,
are two instances of one kind, and what holds of the kind holds of both.

The level a box sits on is one key:

| Field | Type | Rule |
|---|---|---|
| `instance_of` | string | **Optional; its presence is the level.** Absent: this object is a kind. Present: the id of a **kind** object in this vault — this object is one structure of that sort. One level only: the target must itself carry no `instance_of`. Replaces 0.2's `type`, which is an error in a 0.3 vault. |
| `data` | array | **Optional, kinds only.** The ids that make up this kind's *defining diagram* — see [below](#a-kind-is-defined-by-a-diagram--data). A kind with no `data` is primitive and valid. |
| `values` | object | **Optional, instances only.** `{ <mor- id>: "<one sentence>" }` — what each arrow out of this instance's kind yields here. Each key must be an arrow whose `from` is this instance's kind. Replaces 0.2's `values` on an instance arrow, which is an error in a 0.3 vault. |
| `pos` | array | **Optional, objects only.** `[x, y]`, two finite numbers in canvas units — the authored position of this box. See [Layout](#layout--authored-positions). |

`symbol` stays required on every object. `hom` is required on a **kind** and
optional on an **instance**, which inherits its kind's: a map between two
structures of a kind is a property of the kind, stated once.

```yaml
# trees/obj-valuation.md — a kind
id: obj-valuation
taxon: object
symbol: 'v\colon K\to\Gamma\cup\{\infty\}'
hom: 'A field homomorphism $K\to K''$ and a map of ordered groups $\Gamma\to\Gamma''$ that commute with the two valuations.'
data: [obj-a-field, obj-value-group-gamma, mor-v]
region: valuations
pos: [260, 0]

# trees/obj-reals.md — an instance of another kind, named
id: obj-reals
taxon: object
symbol: '\mathbb{R}'
instance_of: obj-field
values:
  mor-field-units: 'every positive real has a square root, so $\mathbb{R}^\times/(\mathbb{R}^\times)^2$ has two elements'
```

### A kind is defined by a diagram — `data`

A kind is not a bare name: it is **a diagram over instances of other
kinds**. A valuation is a field $K$, an ordered abelian group $\Gamma$ with
$\infty$ adjoined, and a map $v$ from the first to the second (plus axioms,
which live in the body). A group action is a group $G$, a set $X$ and the
rule $\rho$ between them. A subgroup is a group $H$, a group $G$ and the
inclusion $H\to G$.

`data` lists exactly that diagram — the instance objects, and the arrows
between them:

- every id in `data` must resolve to a tree of this vault;
- every **object** listed must be an instance (carry `instance_of`): a
  defining diagram is drawn over instances, never over kinds;
- every object listed must be an instance of **another** kind: a valuation
  is defined over a field and an ordered group, never over a valuation. An
  instance of the kind being defined makes the definition circular, and it
  would also turn `data` into a licence for any arrow at all — see the
  chain of named instances below;
- every **arrow** listed must have **both** ends among the listed ids —
  a diagram missing one of an arrow's ends is not the definition it claims;
- a listed object's `about` may name another **component of the same
  diagram** — that is a component saying it is *determined* by another, the
  vertex set of the dissection the diagram already carries — but not an
  instance from outside it. An `about` reaching outward means the box is a
  link of [a proof's chain](#a-chain-of-named-instances), and a named object
  the proof constructs is part of nobody's definition;
- an entry of any other taxon is an error;
- a kind with no `data` is **primitive**: the vault simply does not spell
  its definition out as a diagram, and that is valid. `obj-set` is usually
  one, and so is any kind whose data are not instances of kinds the vault
  carries: a dissection is a polygon and a finite family of triangles, and
  listing the plane it is drawn in would not define it — as "a subgroup" is
  not defined by naming a group.

This is what replaces the pair (product) object of 0.2. **Never introduce an
object whose symbol is a pair in order to give an arrow two sources.** The
ambient category of such a pair is unclear and it buys nothing: if a
structure consists of two things and a map between them, that *is* a kind
with a defining diagram, and the arrows out of the kind reach each piece.

### Which level each arrow touches

| arrow kinds | `from`, `to` |
|---|---|
| `data`, `transform`, `extract`, `property`, `generalizes`, `construction` | **kinds.** A construction out of a kind applies to *every* instance of it — which is why an instance's `values` is keyed by the arrows out of its kind, and why no arrow has to be repeated per example. |
| `hom` | **instances.** A hom is one map between two structures, so each end is one structure. |

A hom comes in two readings, and the format tells them apart by the levels
of its ends:

- **two instances of the same kind** — the equivariant map between two
  actions of one group, a field homomorphism $K\to K'$: a morphism in that
  kind's category. `invertible` says whether it is an isomorphism, as in
  0.2, and is left out for a general map.
- **two instances of different kinds** — the valuation $v\colon K\to\Gamma$,
  the action rule $\rho$ from a group to a set: a **component of a
  definition**. Such an arrow is legal exactly when some kind's `data`
  lists it; otherwise it is an unanchored claim, and the validator says so.
  (The listing also forces both its ends into that diagram.) The kind doing
  the anchoring is a **third** kind, neither end's own: a definition drawn
  over an instance of the kind it defines would be circular, and allowing it
  would make `data` a licence for any arrow between any two named instances.

The kinds `instance` and the pseudo-id `pt` are **removed**. What they
expressed — "this is an example of that kind" — is an instance object, and
what was useful about them, `values`, moved onto it. In a 0.3 vault
`kind: instance` and `from: pt` are errors that name the replacement.

Loops are unchanged: a hom from an instance to itself, or a construction
from a kind to itself, has `from` equal to `to`, and the views draw it as a
loop and, on the arrow's page, unrolled into a chain. `inverse`, `up_to`,
`generalized_by`, `acts_on`, `needs`, `on_homomorphisms`, `functorial`,
`about`, `fields` and `assumes` all keep their 0.2 meanings exactly.

### A chain of named instances

A proof often runs through named objects: the real field $\mathbb{R}$, then a
valuation on it, then the valuation it induces on the plane, then the
colouring that valuation affords. Each link is a construction between kinds
applied to a particular instance — and **that is not an arrow in this
format**. The arrow already exists one level up, between the kinds, and it
applies to every instance of its source; a second copy of it between two
named boxes would say nothing new and would put a construction on the
instance level, where the validator refuses it.

Write the chain like this:

- the **earlier** instance carries `values` keyed by the construction out of
  its kind, and the sentence names what it yields here — on `obj-reals`,
  `mor-extend: "a 2-adic valuation on $\mathbb{R}$, the instance
  obj-v-reals"`;
- the **later** instance carries `about: [<earlier instance>, <that
  construction>]`, so the two boxes and the arrow between their kinds are
  what the tree is about;
- its body states the identity in one sentence: *this is what `mor-extend`
  yields on $\mathbb{R}$.*

What not to do, in both cases because it collapses the two levels the
version exists to keep apart: do **not** invent a `hom` between the two
named instances (they are instances of different kinds, and the hom would
then need a kind to anchor it — it is a step of a proof, not a component of
anybody's definition), and do **not** list a link of the chain in a kind's
`data`. The reader follows the chain from each named box up its tie to its
kind, along the construction, and back down to the next named box; the panel
shows both ends of that path.

The one case that looks like the chain and is not: a component of a defining
diagram that is *determined* by another component of the **same** diagram —
the vertex set $V(\mathcal T)$ in the definition of a coloured dissection,
which is what `mor-vertices` yields on the dissection the diagram already
names. That box carries the same `values`/`about` pair, and it belongs in
`data`, because a diagram over "a dissection, some set, three colours" would
not define a coloured dissection at all: nothing would tie the set to the
dissection. The test, and what the validator applies, is where the `about`
points. Inside the diagram: a component determined by a component, good
authoring. Outside it: a step of a proof, refused.

### Regions — subgraphs that read on their own

One canvas holding every arrow of a long proof is unreadable, and splitting
the vault in two is worse: the pieces share objects. So a vault divides one
canvas into **labelled regions**, each meant to be read on its own, and the
reader pans between them.

Any tree may carry `region: <kebab token>`. `forest.json` may declare the
regions and their order:

```json
"regions": [
  { "id": "valuation", "title": "Valuacije i njihove instance" },
  { "id": "colouring", "title": "Od valuacije do bojanja" }
]
```

Each `id` is a kebab-case token, unique in the list; each `title` is a
non-empty label in the vault's language. `regions` is optional, and a tree's
`region` need not be declared: an unknown or absent region means an
unlabelled area of the canvas. When the vault does declare regions, a tree
naming one that is not declared draws a **warning**, because that is almost
always a typo.

### Layout — authored positions

Positions are authored, not only computed. An object may carry
`pos: [x, y]`, two finite numbers in canvas units — the box's top-left
corner, read against **its own region's frame**, growing right and
down. Objects without `pos` are
placed by the existing algorithm in the gaps the authored ones leave, and
authored positions survive a rebuild of the views, because they live in the
trees and nothing in `views/` is an input. Because `pos` is read against the
frame, a region that grows above does not drag the hand-laid boxes below it.

An arrow is drawn **straight**, border to border, and nothing bends: clearance
is the layout's job. Three things do it, and the build names every arrow left
with a box on it, so the failure is visible rather than hidden in a curve.

1. Inside a region, a seeded force walk pushes every box off the arrows that
   are not its own. Only boxes without `pos` move.
2. The frames are shelved into rows, and **every other row is laid backwards**
   — the way a field is ploughed. Two regions the vault declares one after the
   other are then neighbours even across a row break, where a plain
   left-to-right shelf would throw them to opposite ends of the canvas.
3. A second walk then runs over the whole plane, because the per-region walk
   never sees an arrow whose two ends are in two regions: its corridor crosses
   frames that walk never looked at. The frames are remeasured and reshelved
   after it, so a box that moved takes its region's area with it.

The page opens the canvas at a zoom where a box title is still a word, not
fitted to the whole plane; when the plane will not go that large it opens on
the first declared region and the reader pans. Dragging a box and saving the
arrangement writes `pos` back — see [Regions](#regions--subgraphs-that-read-on-their-own)
and the page's own footer hint.

### `index.md` in a 0.3 vault

`## Struktura` (`## Structure`) lists the **kinds**. Instances and arrows are
not listed: the views attach each instance to its kind and each arrow to its
`from`, so a kind's page gathers its instances the way a statement's page
gathers its proofs. `scripts/index-vault.mjs` uses the same two rules when
it assigns a tree its search group.

### What the validator checks — 0.3

Every 0.1 rule, every 0.2 rule that survives, and:

- `instance_of`, when present, names an object tree of this vault, not the
  object itself, that carries no `instance_of` of its own.
- `hom` is required on an object without `instance_of`, optional on one with.
- `type` on an object is an error naming `instance_of`.
- `data`, on a kind, is an array of ids that all resolve; each object listed
  carries `instance_of`, and that `instance_of` is some *other* kind, not the
  one being defined; each morphism listed has both `from` and `to` among the
  listed ids; every instance a listed object's `about` names is itself listed;
  no other taxon may be listed. `data` on an instance is an error.
- `values`, on an instance, is a mapping whose keys name morphisms whose
  `from` is this instance's kind and whose values are non-empty strings.
  `values` on a kind is an error, and `values` on a morphism is an error
  naming the instance object.
- `pos`, on an object, is `[x, y]`, two finite numbers.
- `region`, on any tree, is a kebab-case token; `forest.json`'s `regions`,
  when present, is an array of `{ id, title }` with kebab-case unique ids
  and non-empty titles.
- `kind: instance` and `from: "pt"` are errors naming the instance object.
- A construction (`data`, `transform`, `extract`, `property`,
  `generalizes`, `construction`) has a kind at each end; a `hom` has an
  instance at each end.
- A `hom` whose two instances are of different kinds must be listed in the
  `data` of some kind that is neither end's kind.

Warnings, for every **kind** (an instance draws none, as a typed object drew
none in 0.2): no instance object of it; no `generalizes` arrow in either
direction; a body without a `## Definicija` / `## Definition` heading. Plus
the undeclared-region warning above.

In a 0.2 vault, `instance_of`, `data`, `pos`, `region` and `forest.json`'s
`regions` are unknown keys — the same one-way switch 0.1 has against 0.2.

### Migrating a 0.2 vault to 0.3

Mechanical, in this order. Nothing outside the structure layer changes, and
no body has to be rewritten except where it names a renamed id.

1. **`forest.json`**: `schema_version` becomes `"forest-0.3"`. Optionally
   add `regions`.
2. **Typed objects become instances**: on every object, `type: K` becomes
   `instance_of: K`. Nothing else about the tree changes — it already had
   its own `symbol` and no `hom`.
3. **Instance arrows become instance objects.** For each `mor-X` with
   `kind: instance` and `to: K`, write `obj-X` with `taxon: object`, the
   same `title`, `symbol` = the arrow's `statement`, `instance_of: K`, the
   arrow's `values` verbatim, and its `teaches` / `requires` / `depends` /
   `standalone` / `language` / `origin` unchanged. Drop `kind`, `from`,
   `to`, `needs` and `label` (if `label` said something the symbol does
   not, the body says it instead). Delete the `mor-X` file and rewrite
   every `[[mor-X]]` wikilink and every `about: [… mor-X …]` to `obj-X`.
4. **Re-point hom arrows at instances.** A `hom` whose `from` or `to` is a
   kind needs an instance of that kind: if the vault has none, add one — a
   generic instance, titled in words ("a group $G$"), `instance_of` the
   kind, no `hom`, a two-sentence body. A 0.2 pair of boxes of one type is
   already two instances of one kind after step 2, so only the kind's own
   box has to move.
5. **Give the kinds their defining diagrams** where the work defines them
   by data: `data: [<instances>, <arrows between them>]`, adding the
   instance objects — of *other* kinds — and the component arrows that
   diagram needs. Optional —
   a kind with no `data` stays valid — but it is where most of 0.3's value
   is. Any pair/product object introduced in 0.2 to give an arrow two
   sources is deleted here and replaced by the kind's diagram.
6. **Add `region` and `pos`** where the canvas wants grouping or a hand-laid
   layout. Both optional.
7. Rerun `scripts/validate-forest.mjs`, then `scripts/build-views.mjs` and
   `scripts/index-vault.mjs`.

`examples/mini-vault` is this recipe applied: it was the reference 0.2 vault
and is now the reference 0.3 one, and
`scripts/test-fixtures/structure-ok-0.2` is its 0.2 counterpart, frozen so
the older version stays covered.

### Authoring rules, 0.3

1. **A kind, or an instance?** If a sentence about it begins "for every…",
   it is a kind. If one can point at it and draw a map out of it, it is an
   instance. A proof that names the objects it works on names instances.
2. **Never a pair object.** A structure made of two things and a map is a
   kind with a defining diagram, not an object whose symbol is a pair. The
   word *product* does not appear in a body for this, and neither does a
   box for the pair.
3. **One instance per role, not per name.** Two instances of one kind in two
   roles — the group that acts and the group that contains a subgroup — stay
   two boxes even when both are "a group $G$"; the roles are what the
   diagram is about.
4. **An instance's body is short.** Two or three sentences: what it is, what
   it is there for, which arrow starts or ends at it. The mathematics is on
   the kind.
5. **`values` only for what is computed.** A `values` sentence restates a
   result the vault actually has — a number the work computes, a set the
   example lists — never a guess.
6. **Categorical vocabulary stays in the structure.** In a vault digested
   from a work that is not categorical, bodies do not say "product",
   "functor", "natural" or "category" unless the member asks. `instance_of`,
   `data`, `hom` and `functorial` already carry those notions, and the
   reader meets the mathematics instead of its name.
7. **A step of a proof is not an arrow.** When one named instance is what a
   construction yields on another, write it as
   [a chain](#a-chain-of-named-instances) — `values`, `about` and the body —
   never as a `hom` between the two, and never by listing a link of that
   chain in a kind's `data`. `data` is the definition of a kind, not a place
   to park an arrow the levels would otherwise refuse. Inside one defining
   diagram the same keys say something else and are welcome: a component
   determined by another component of that diagram.

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
log entry), and `schema_version` graduates from `forest-0.1` /
`forest-0.2` / `forest-0.3` accordingly. Until then, this file is normative and tools pin against it.

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
