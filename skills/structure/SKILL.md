---
name: structure
description: Draft the structure graph of a Forest vault for the member to approve — the kinds of mathematical structure the work is about and the instances of them as obj- trees, the constructions between kinds and the maps between instances as mor- arrows, proposed as one table in chat and written only after a yes, then validated as forest-0.3. Use when a member wants the Struktura tab filled ("napravi strukturu ove šume", "koji su objekti i strelice", "nacrtaj strukturni graf", "dodaj objekt za djelovanja"), or when a vault has trees but no obj-/mor- files yet.
---

# Structure — the vault's objects and arrows

You are the structure half of the MatSek Knowledge Forest: a vault
already has one graph — trees joined by `depends`, saying what to read
first — and you draft the second, on **two levels**: boxes for *kinds* of
structure (a field, a valuation, a group acting on a set), boxes for
*instances* of a kind (a field $K$, the field of real numbers, one group
action), and labelled arrows — what one can build, extract or measure from
one kind to get another, and the maps between two instances. The picture
stays made of boxes and single-source arrows; depth sits behind it. All of
them are ordinary trees of two taxa, `object` (`obj-`) and `morphism`
(`mor-`), so everything that works on trees — search, marks, views,
`grow` — works on them unchanged. The on-disk contract is
`${CLAUDE_PLUGIN_ROOT}/docs/forest-format.md` (forest-0.3); the keys are
restated once below because they are the whole of this job, but the doc
wins where they disagree.

**The two levels are the whole of the format, so get them right first.** A
*kind* is what statements quantify over ("for every valuation…"); an
*instance* is one structure of a kind, which one can point at and draw a map
out of. A kind is **defined by a diagram over instances of other kinds** — a
valuation is a field $K$, an ordered group $\Gamma$ and a map $v$ between
them — and that diagram is the kind's `data`. Modelling both levels is what
lets a proof be told one level lower than the kinds, naming the objects it
actually works with: $K$, and then $\mathbb{R}$, are two instances of one
kind, and every arrow out of the kind applies to both.

Talk to the member in the vault's language (`forest.json` → `language`,
Croatian by default). Tree bodies, `title`, `hom`, `needs`,
`on_homomorphisms` and `values` are in that language; ids, keys, kinds
and this protocol are English. The proposal table is read in a terminal,
so it carries LaTeX as source — exactly the text that will go into
`symbol` and `statement`.

Two rules outrank everything else here:

1. **Nothing is written before the member approves the table.** Not a
   tree, not `forest.json`. The member reads ten arrows for precision
   before any arrow exists on disk.
2. **An arrow is a formula or it is not an arrow.** If `statement` cannot
   be written in LaTeX — `A \mapsto B` for a construction, the map with
   its condition, `f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)`, for a
   hom — what you have is a theorem, a remark or nothing — never a `mor-`
   tree.

## The keys, once

A **kind** is a sort of structure, not one particular structure: "a group",
never "$\mathbb{Z}_6$". It carries no `instance_of`. Beyond the usual tree
keys it has `symbol` (LaTeX for the data, no `$`: `(G, X, \rho)`), `hom`
(one sentence with inline `$…$`: what a map between two structures of this
kind is), optionally `data` (its defining diagram, below), `region`, `pos`,
`same_as` (an `obj-` id in the library forest, shape-checked only) and
`nlab: {title, revision}`. Its body has six sections — `## Ideja`,
`## Definicija`, `## Podaci`, `## Svojstva`, `## Primjeri`, `## Povezano`
(`Idea, Definition, Data, Properties, Examples, Related` in an `en` vault);
the validator warns when `Definicija`/`Definition` is missing.

An **instance** is one structure of a kind: it carries `instance_of` (the id
of a kind, which must itself have no `instance_of`), its own `symbol`, no
`hom` (inherited), optionally `values` and `pos` and `region`, and a body of
two or three sentences. An instance may be generic ("a group $G$") or named
("the field of real numbers"); the format does not distinguish them. Two
instances are what a map between two structures is drawn between, and what a
kind's defining diagram is drawn over.

`values` on an instance is a map from ids of arrows **out of its kind** to
one sentence each — what that arrow yields here (`mor-orbit-count: "$14$"`).
That is how an example carries its numbers without a single new arrow.

A **kind is defined by a diagram**: `data: [<ids>]`, listing the instance
objects and the arrows between them that constitute it. A valuation is a
field $K$, an ordered group $\Gamma$ and the map $v$ from the first to the
second; a group action is a group $G$, a set $X$ and the rule $\rho$. Every
id must resolve, every object listed must be an instance **of another kind**
— a definition drawn over an instance of the kind being defined is circular,
and the validator refuses it — and every arrow listed must have both ends
among the listed ids. A kind with no `data` is primitive and valid (a set
usually is). **Never give an arrow a pair object to start from**: a structure
made of two things and a map between them is a kind with a diagram, and the
arrows out of the kind reach each piece. And `data` is only ever a
definition: it is not a place to list an arrow so that the levels will accept
it (rule 19).

A **morphism** is an arrow, of one of two sorts, and the sort fixes the level
of its ends. A *construction* takes any structure of the kind `from` to a
structure of the kind `to`, after supplying the extra data its hypotheses
name; both ends are kinds, and the arrow applies to every instance of its
source. A *hom* (`kind: hom`) is one map, so both ends are **instances**.
Keys: `kind` in `data | transform | extract | property | generalizes |
construction | hom`; `from`, `to` (object ids; they may be the same object —
a loop); `statement` (LaTeX, no `$`); optional `label` (short LaTeX for the
graph edge, the page falls back to `title`); `acts_on` (`all`, or a list of
`data` arrows out of the same `from` — which components it reads); `needs`
(list of sentences naming data not part of the source, may be empty);
`on_homomorphisms` (one sentence: what it does to a map between two source
structures, or what it forgets); `functorial` (boolean). The last four are
required on every construction. A `hom` has `needs`, none of the other
three, no `values`, and may carry `invertible` (boolean: is the map an
isomorphism). Optional on any arrow: `inverse` (symmetric), `up_to` (beside
`inverse` only: the id of the tree stating the canonical isomorphism the
inverse holds up to) and `generalized_by` (list of `mor-` ids).

A hom has two readings, and its ends say which:

- **two instances of one kind** — the equivariant map between two actions of
  one group, a homomorphism $K\to K'$: a morphism in that kind's category.
  `invertible` is a claim worth recording when it is known.
- **two instances of different kinds** — the valuation $v\colon K\to\Gamma$,
  the rule $\rho$ from a group to a set: a **component of a definition**.
  Legal exactly when the `data` of some kind — a third one, neither end's own
  — lists it, so draft the kind and the arrow together. There is no other
  cross-kind hom: a step of a proof is not one (rule 19).

Any tree may carry `about` (list of `obj-`/`mor-` ids), `fields`
(kebab-case words in the vault's language: `algebra`, `kombinatorika`,
`geometrija`), `assumes` (kebab-case tokens for what it assumes about
the formal system: `axiom-of-choice`, `excluded-middle`,
`continuum-hypothesis`, or another named principle) and `region` (one
kebab-case token: which labelled area of the canvas it belongs to, declared
in `forest.json` as `regions: [{id, title}]`). `depends` stays the
only prerequisite relation and stays acyclic; `from`/`to` are not
prerequisites and may form cycles (curry/uncurry) and loops.

The seven kinds, with a group-action example of each ("instance" is a level
word from here on, never a synonym for "example"):

| kind | meaning | ends | example |
|---|---|---|---|
| `data` | projection to a component that is itself a kind | kinds | `(G,X,\rho)\mapsto G` |
| `transform` | a structure of another kind built from the whole; `inverse` marks an isomorphism of kinds | kinds | `\rho\mapsto\hat\rho\colon G\to\mathrm{Sym}(X)` |
| `extract` | a sub- or quotient structure of a component | kinds | `X\mapsto X/G` |
| `property` | a measurement, usually with extra data in `needs`; a bare count ends in `obj-nat` | kinds | `(G,X,\rho),\,x\mapsto G_x\le G` |
| `generalizes` | every structure of this kind is one of the wider kind, nothing forgotten; `functorial: true` always | kinds | group action → monoid action |
| `construction` | a standard categorical home or a (co)limit built from the kind | kinds | `(G,X,\rho)\mapsto` an object of `G\text{-}\mathbf{Set}` |
| `hom` | one map between two instances — of one kind, or a component of a definition | instances | `f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)` |

There is no `instance` kind and no `pt`: an example is an **instance
object**, and `values` sits on it. A 0.2 vault keeps both for ever; a 0.3
vault has neither.

## Stage 1 · LOCATE

The working directory if it holds `forest.json`, else the path the
invocation names, else one short question. Read `forest.json`:
`language` decides every sentence you write; `derivative` decides the
closing sentence of stage 7; `schema_version` tells you which job this is.

- `forest-0.1` — a first draft. Bumped to `forest-0.3` at write time.
- `forest-0.3` — an extension. Read the existing `obj-`/`mor-` trees
  first and propose additions only; a member-origin structure tree is never
  rewritten without being asked.
- `forest-0.2` — a vault with the one-level layer. Say so at the table, and
  propose the migration (`docs/forest-format.md`, *Migrating a 0.2 vault to
  0.3*) together with the additions: `type` becomes `instance_of`, each
  `instance` arrow becomes an instance object carrying its `values`, each
  hom is re-pointed at instances, each pair object is replaced by the
  defining diagram of the kind it was propping up. The member may also
  decline and stay on 0.2, which stays valid; then propose 0.2 keys only.

A `library/forest` checkout is not a target: the library gets structure
through `grow`, never by this skill writing into it.

## Stage 2 · READ — the whole vault, no sampling

Read `index.md` and every file in `trees/`. A vault is small by design
and the proposal is only as good as this read; a sampled vault yields
arrows about things the work never does. For each tree note four things:

- which **kind of structure** its statement quantifies over — a
  candidate kind ("za svaku konačnu grupu i podgrupu" → a group, a
  subgroup);
- **what that kind is made of** — the pieces a reader would have to name to
  write the definition down, and the map between them: the candidate
  defining diagram, so the instances it needs become candidate boxes too;
- which **objects the proof actually names and works with** — the group that
  acts, the field being valued, the set being coloured: candidate instances,
  generic or named;
- what it **builds from what** — a candidate arrow (orbits from an
  action, a coset space from a subgroup, a count from a finite set);
- which **maps between two structures** it works with — a
  homomorphism between two groups, a map from a set to itself — candidate
  hom arrows, each needing two instances or a loop on one;
- which **examples it computes to the end**, with numbers — candidate named
  instances, and the only legitimate source of `values`;
- what it **assumes** beyond ZF with classical logic: a proof that picks
  arbitrary representatives out of infinitely many classes, calls on
  Zorn's lemma or well-orders a set uses choice, and the tree says so;
- which **field** it belongs to, in the vault's language.

Judge the **audience** here, because it decides the default style
(Decision 2 of the design): a vault whose trees `require`
`categories-functors`, or whose work states things categorically, is
advanced; the rest are not. For an advanced vault the extra datum of a
measurement becomes a dedicated object joined by a `data` arrow
(`obj-pointed-group-action`, and the stabilizer starts there with
`needs: []` and `functorial: true`); for everyone else the arrow names
what it reads (`acts_on`) and what it needs (`needs`). The member can
flip this at the table. The same judgment governs vocabulary: for a work
that is not categorical, "product", "functor", "natural", "category" and
their relatives stay out of every body you write unless the member asks
for them — the levels, the diagrams and the keys already carry those
notions.

If `library/structure/nlab-seed.json` exists beside a library checkout,
use its titles and aliases to match your objects to library ones
(`same_as`, `nlab`) and its link lists as a *suggestion* feed for arrows
you may have missed — suggestions only, since nLab links are see-also,
not constructions, and no nLab prose ever enters a file. When the seed
or the library objects are absent, leave `same_as` and `nlab` out; a
wrong pointer is worse than none.

## Stage 3 · DRAFT, against the precision rules

**Kinds first.** One per kind of structure the work quantifies over —
not one per definition. The test is `hom`: if you cannot say in one
sentence what a map between two of these is, it is not a kind, and the
`def-` tree stays what it is (a coset is a subset, not a kind; a
subgroup `H\le G` is a kind, its maps are homomorphisms carrying $H$ into
$H'$). `symbol` is the data as a tuple. `depends` is the `def-` tree that
defines the kind and nothing else unless a reader genuinely must hold it
first. A measurement that ends in a number needs `obj-nat` (`symbol:
"n \\in \\mathbb{N}"`, `hom: "$m \\le n$"`) — one for the whole vault,
only if an arrow ends there.

**Then each kind's defining diagram.** Write the definition out as pieces
and a map: "a valuation is a field $K$, an ordered group $\Gamma$ with
$\infty$, and $v\colon K\to\Gamma\cup\{\infty\}$ with two axioms". Each
piece that is a structure becomes an **instance** of its kind; the map
becomes a `hom` between those instances; the axioms stay in the kind's body;
`data` lists all of them. A kind whose definition is not a diagram — a set,
a natural number — simply has no `data`, and that is right. **No pair
object, ever**: if an arrow seemed to need two sources, what it really needs
is the kind whose diagram has both, and the arrow starts from that kind.

**Then the instances the proof names.** One per role the work actually
works in — the group that acts, the group a subgroup sits inside, the field
being valued — plus one per example it computes to the end. Generic ones get
a generic title and symbol ("Grupa koja djeluje", `G`); named ones get the
name ("Podgrupa $\{0,3\}$ u $\mathbb{Z}_6$"). Two roles stay two instances
even when both are "a group $G$". An instance's body is two or three
sentences: what it is, what it is there for, which arrow starts or ends at
it. The mathematics lives on the kind.

**Arrows per kind, in this order,** so the easy ones anchor the hard
ones. Every one of 1–6 runs between kinds:

1. `data` — one per component of `symbol` that is itself a kind in
   the vault; `acts_on: all`, `needs: []`, `functorial: true`,
   `on_homomorphisms` names the component of the map. A component that
   is not a kind (the rule $\rho$) gets no arrow — it is in the defining
   diagram instead.
2. `extract` — the sub- and quotient structures the work actually forms.
3. `property` — the measurements the work actually makes; extra data in
   `needs` (default) or in a dedicated kind (advanced); the target is a
   kind, a count ends in `obj-nat`.
4. `transform` — another presentation of the whole, or a structure of
   another kind built from it; `inverse` only when the work shows both
   directions and they compose to the identity.
5. `generalizes` / `construction` — only when the work, or standard
   mathematics the member will recognise, genuinely supports them, and
   both kinds exist in the vault. Not to make the graph look complete.
6. `hom` — between **instances**, never kinds, and of two sorts. Inside one
   kind: the maps the work actually uses, `statement` the map with the
   condition that makes it a morphism of that kind, `needs` what it depends
   on beyond its two ends. Across two kinds: a component of a defining
   diagram, drafted with the kind whose `data` lists it. Record
   `invertible` when it is known — `true` for an isomorphism, `false` for a
   map shown not to be one, absent for a general map. When a way back
   exists but is not unique, there is no `inverse`: the body says so, and
   the tree `assumes` choice if picking one needs it.

**`values`, not more arrows.** What an arrow yields on one example is a
sentence in that instance's `values`, keyed by the arrow's id — one per
arrow out of its kind that the work actually computes there, and only for
what the work states or you have verified by hand.

**Loops.** A construction that returns the kind it started from
(`G\mapsto[G,G]`) and a map from a structure to itself (`x\mapsto g\cdot
x`) are arrows with `from` equal to `to`. Keep them as loops — never a
duplicate box to avoid one. The page draws the loop and, on the arrow's
page, the same arrow unrolled into a chain, with no authoring. When the
vault has a tree on loops as chains (`exp-petlja-kao-lanac` in the
example vault), add the new loop's id to that tree's `about`.

**Inverses.** `inverse` on both arrows when the two compose to the
identity. When they do so only up to a canonical isomorphism — there and
back gives a structure isomorphic to the first in a way one can write
down — both keep `inverse` and the arrow gains `up_to`, the id of the
tree that states that isomorphism for this instance. If the vault lacks
that tree, it is part of the proposal: a `thm-` or `con-` you draft with
the arrows.

**Assumptions.** `assumes` on every tree — arrow, object, theorem,
proof, example — whose statement, proof or computation depends on the
axiom of choice (Zorn's lemma and well-ordering included:
`axiom-of-choice`) or on another named principle (`excluded-middle`,
`continuum-hypothesis`, or a kebab-case token of your own for one not on
the list).

**Then the work's statement trees.** `about` on each `thm-`/`lem-`/
`prp-`/`cor-` lists the objects it quantifies over and the arrows it
computes; `fields` names its areas; `assumes` names what its proof leans
on. A `con-` tree's `about` lists both of its ends as `obj-`/`mor-` ids —
the structured form of the rule that a connection names its ends.

**Then the regions, and any positions worth fixing.** Group the boxes into
areas a member can read one at a time — in a long proof, one region per
stage of the argument; in a small vault, the kinds, the defining diagrams
and the instances. Propose the list for `forest.json` (`regions: [{id,
title}]`, ids kebab-case, titles in the vault's language) and a `region`
token per structure tree. Give `pos` only where the computed layout gets a
picture wrong and you can say what the right picture is; everything without
`pos` is placed in the gaps.

Run the whole draft through the precision rules below before showing
it. An arrow you are unsure of is dropped from the table and named in
one line under it as a candidate.

## Stage 4 · PROPOSE — one table, then wait

Show the proposal in chat as a compact table in the vault's language and
stop. One row per kind (bold, with its `symbol`), then its defining diagram
and the arrows out of it, marked `↳`; then the instances of that kind,
marked `·`, each with the `values` it will carry. A loop is marked `⟲`. The
*vrsta* column says `vrsta` for a kind and `instanca` for an instance, and
the *regija* column the region each box goes to. Below it, a second small
table of existing trees that gain `about`/`fields`/`assumes`, a line stating
the style chosen (light or strict) and the one-line reply forms:

```
| stablo                              | vrsta    | →            | iskaz (LaTeX)                           | regija     | treba / napomena                  |
|-------------------------------------|----------|--------------|-----------------------------------------|------------|-----------------------------------|
| **obj-group-action** · (G, X, \rho) | vrsta    | —            | Djelovanje grupe na skupu               | strukture  | data: obj-acting-group, obj-acted-set, mor-rho |
| ↳ mor-rho                           | hom      | obj-acted-set | \rho\colon G\times X\to X              | definicije | dio definicije; iz obj-acting-group |
| ↳ mor-action-group                  | data     | obj-group    | (G,X,\rho) \mapsto G                    | strukture  | funkt.                            |
| ↳ mor-orbits                        | extract  | obj-set      | (G,X,\rho) \mapsto X/G                  | strukture  | funkt.; iz exp-orbite-i-stabilizatori |
| ↳ mor-stabilizer                    | property | obj-subgroup | (G,X,\rho),\,x \mapsto G_x \le G        | strukture  | treba x \in X; nije funkt.        |
| · obj-group-action-source · (G, X, \rho) | instanca | obj-group-action | Djelovanje na skupu X              | primjeri   | izvor strelice mor-equivariant-map |
| · obj-group-action-target · (G, Y, \sigma) | instanca | obj-group-action | Drugo djelovanje iste grupe      | primjeri   | odredište mor-equivariant-map     |
| · obj-ogrlice-z6 · (\mathbb{Z}_6, B^6, \text{rotacija}) | instanca | obj-group-action | Rotacije ogrlice | primjeri | values za 6 strelica; iz exm/thm-burnside |
| ↳ mor-equivariant-map               | hom      | obj-group-action-target | f\colon X\to Y,\ f(g\cdot x)=g\cdot f(x) | primjeri | iz obj-group-action-source; ne mora biti izomorfizam |
| **obj-acted-set** · X               | instanca | obj-set      | Skup na kojem se djeluje                | definicije | u dijagramu obj-group-action      |
| ↳ mor-act-by-element                | hom      | ⟲ obj-acted-set | x \mapsto g\cdot x                   | primjeri   | treba djelovanje i g \in G; izomorfizam; petlja |
| …                                   |          |              |                                         |            |                                   |

regije u forest.json: strukture „Vrste struktura” · definicije
„Definicijski dijagrami” · primjeri „Instance i preslikavanja među njima”

about / fields / assumes na postojećim stablima:

| stablo                  | about                    | fields  | assumes |
|-------------------------|--------------------------|---------|---------|
| thm-lagrange            | obj-subgroup             | algebra | —       |
| con-slobodna-djelovanja | obj-subgroup, mor-orbits | algebra | —       |

Stil: lagani (acts_on/needs). Reci *strogo* za istaknute objekte umjesto needs.
Odgovori: **u redu** · **izbaci <id>** · **dodaj <što>** · **promijeni <id>: <što>**
```

Then wait. On *izbaci*, drop the rows; on *dodaj* or *promijeni*, draft
the change against the same rules and show only the changed rows; an
arrow or object the member dictates — symbol, statement, hypotheses in
their words — is written with `origin: member`, everything you drafted
with `origin: agent`. Only an explicit *u redu* on the final table
proceeds. If the member wants to see a file before approving, show the
file as text in chat; still write nothing.

## Stage 5 · WRITE

For every approved object and arrow, `trees/<id>.md` with the keys above
plus the usual ones: `teaches`/`requires` resolved against the concept
registry (never invented), honest `depends`, `standalone: true`,
`language` equal to the vault's, `origin` as decided in stage 4, and
**no `source` block** — structure trees are not from the work's pages,
and in a derivative vault a tree claiming both would fail validation.
YAML strings that hold LaTeX are quoted: single quotes with the
backslashes as they are (`'(G, X, \rho)'`, as the example vault writes
them) or double quotes with every backslash doubled (`"(G, X, \\rho)"`);
sentence fields may hold commas and colons freely inside the quotes.
Wikilinks in bodies point only at trees that exist or that this batch
writes. An instance gets `instance_of`, its own `symbol`, no `hom`, its
`values` where the work computes them, and a body of two or three sentences
instead of the six headings.

Then, in this order:

- `forest.json`: `schema_version` becomes `"forest-0.3"`, and `regions`
  gets the approved list. Nothing else changes, and no existing tree changes
  meaning — a 0.1 vault is a 0.3 vault with no structure. A 0.2 vault being
  migrated applies the recipe in `docs/forest-format.md` in the same pass,
  including the deletion of every `instance` arrow whose content has moved
  to an instance object.
- `index.md`: a section `## Struktura` (`## Structure` in `en`) after
  the work's own sections, one wikilink per **kind** with a one-line
  gloss. Instances and morphisms are not listed; the views attach each
  instance to its kind and each arrow to its `from`.
- `about`/`fields`/`assumes` on the approved existing trees: frontmatter
  keys added, body and `origin` untouched. A new loop is appended to the
  `about` of the vault's loop-as-chain tree, when it has one.

## Stage 6 · VALIDATE — until clean

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-forest.mjs" <vault-dir> --concepts <path-to-concepts.yaml>
```

Every structure error names the file and the key; fix that file, rerun,
until there is no error. The structure warnings are judgments, not chores,
and an instance draws none of them: *a kind with no instance* means the
vault names no structure of that sort — add the instance if a tree works
with one, and otherwise leave the warning and say so, never invent an
example; *no `generalizes` arrow in either direction* is normal for most
vaults and is reported as such. A missing `## Definicija` is a real gap:
write it. A *region not among forest.json regions* is a typo in one of the
two places; fix whichever is wrong.

## Stage 7 · REBUILD and REPORT

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-vault.mjs" <vault-dir>
```

Then tell the member, in their language and in a few sentences: how many
kinds and which, how many instances and of what, which kinds got a defining
diagram, how many arrows by kind, which existing trees gained `about`, that
`views/forest.html` now has a *Struktura* tab — divided into the regions,
with a loop drawn on its box and, on its own page, unrolled into a chain —
and the candidates you left out and why. Close with the locality sentence that
fits: in a derivative vault the structure trees stay local like
everything else under that roof; in a CC BY vault (`derivative: false`)
they are library-eligible through `/forest:grow`, where an
`origin: agent` tree is marked `ai-assisted` in the provenance interview
after the member has read it. You prepare files; you never run git.

## Worked example — group actions in `examples/mini-vault`

The reference vault's twelve base trees (`def-group-action`,
`exp-orbite-i-stabilizatori`, `con-slobodna-djelovanja`,
`exm-koseti-u-z6`, two proofs of Lagrange, …) quantify over sets,
groups, subgroups and group actions; the proposal table above is what
stage 4 shows for its `obj-group-action` block. The vault on disk carries
the finished layer (50 trees: eight kinds, two of them with defining
diagrams, eight instances of them, sixteen arrows, theorems with proofs, a
connection, an exposition); read it as the finished shape and this section
as the path there.

**The kind, with its defining diagram.** The definition is read out as
pieces and a map — "a group $G$, a set $X$, and the rule $\rho$ between
them" — and that *is* `data`:

```markdown
---
id: obj-group-action
taxon: object
title: "Djelovanje grupe na skupu"
symbol: "(G, X, \\rho)"
hom: "Par $(\\varphi, f)$: homomorfizam $\\varphi\\colon G\\to H$ i funkcija $f\\colon X\\to Y$ uz $f(g\\cdot x)=\\varphi(g)\\cdot f(x)$; za $G=H$ i $\\varphi=\\mathrm{id}$ to su ekvivarijantna preslikavanja, i na njima se sudi je li strelica iz ovog objekta funktorijalna."
data: [obj-acting-group, obj-acted-set, mor-rho]
region: strukture
pos: [320, 0]
teaches: [group-actions]
requires: [functions]
depends: [def-group-action, obj-group, obj-set, obj-acting-group, obj-acted-set, mor-rho]
standalone: true
language: hr
origin: agent
---

## Ideja
Grupa je zaliha simetrija; djelovanje kaže *na čemu* one rade. Svaki
$g\in G$ postaje bijekcija $X\to X$, a množenje u $G$ odgovara slaganju
tih bijekcija.

## Definicija
Funkcija $\rho\colon G\times X\to X$, $(g,x)\mapsto g\cdot x$, uz
$e\cdot x=x$ i $g\cdot(h\cdot x)=(gh)\cdot x$; točan iskaz i aksiomi su
u [[def-group-action]].

## Podaci
Dijagram nad instancama drugih vrsta: grupa [[obj-acting-group]], skup
[[obj-acted-set]] i pravilo [[mor-rho]] među njima. Strelice koje iz vrste
*izlaze* na te podatke su [[mor-action-group]] i [[mor-action-set]].

## Svojstva
Orbite particioniraju $X$ ([[mor-orbits]], [[exp-orbite-i-stabilizatori]]);
stabilizator točke je podgrupa ([[mor-stabilizer]]); slobodno djelovanje
ima jednakobrojne orbite ([[con-slobodna-djelovanja]]).

## Primjeri
Rotacije ogrlice ([[obj-ogrlice-z6]]); podgrupa $H\le G$ na nosivom skupu
$G$ formulom $h\cdot g=gh^{-1}$ — motor dokaza
[[prf-lagrange-djelovanje]].

## Povezano
Lagrangeov teorem kao slučaj načela „slobodno djelovanje dijeli”:
[[con-slobodna-djelovanja]].
```

The diagram's three trees are two instances and a hom between them. Note
that `mor-rho`'s ends are instances of two *different* kinds — a group and a
set — which is legal because `obj-group-action`'s `data` lists it; that is
the shape every defining diagram has, a valuation $v\colon K\to\Gamma$
included:

```yaml
# trees/obj-acting-group.md — a generic instance; body is two sentences
id: obj-acting-group
taxon: object
title: "Grupa koja djeluje"
symbol: 'G'
instance_of: obj-group
region: definicije

# trees/obj-acted-set.md
id: obj-acted-set
taxon: object
title: "Skup na kojem se djeluje"
symbol: 'X'
instance_of: obj-set
region: definicije

# trees/mor-rho.md — the component map
id: mor-rho
taxon: morphism
title: "Pravilo djelovanja"
kind: hom
from: obj-acting-group
to: obj-acted-set
statement: '\rho\colon G\times X\to X,\quad e\cdot x=x,\ g\cdot(h\cdot x)=(gh)\cdot x'
label: '\rho'
needs: []
region: definicije
```

**A named instance** carries the work's own numbers and nothing more — the
orbits and stabilizers `thm-burnside` and `thm-orbit-stabilizer` compute —
one sentence per arrow out of its kind:

```yaml
# trees/obj-ogrlice-z6.md
id: obj-ogrlice-z6
taxon: object
title: "Rotacije ogrlice od šest perli"
symbol: '(\mathbb{Z}_6,\ B^6,\ k\cdot(x_i)=(x_{i+k})),\quad |B|=2'
instance_of: obj-group-action
region: primjeri
values:
  mor-action-group: '$\mathbb{Z}_6$, rotacije za $k$ mjesta'
  mor-action-set: '$B^6$, svih $2^6=64$ nizova od šest perli u dvije boje'
  mor-orbits: 'ogrlice — nizovi do rotacije; ima ih $14$'
  mor-orbit-count: '$14$'
```

**`mor-stabilizer`, light style** (the default: the chosen point is a
hypothesis on the arrow, and the arrow is honestly not functorial):

```markdown
---
id: mor-stabilizer
taxon: morphism
title: "Stabilizator točke"
kind: property
from: obj-group-action
to: obj-subgroup
statement: "(G,X,\\rho),\\ x\\mapsto G_x=\\{\\,g\\in G : g\\cdot x=x\\,\\}\\le G"
label: "G_x"
acts_on: all
needs: ["odabrana točka $x \\in X$"]
on_homomorphisms: "Uz $\\varphi=\\mathrm{id}_G$ i $f(x)=y$ vrijedi $G_x\\subseteq G_y$, jer iz $g\\cdot x=x$ slijedi $g\\cdot y=f(g\\cdot x)=y$. Ovisi o izboru točke, pa na golim djelovanjima nije funktor."
functorial: false
teaches: [orbits-stabilizers]
requires: []
depends: [obj-group-action, def-subgroup]
standalone: true
language: hr
origin: agent
---

$G_x$ je podgrupa: $e$ fiksira $x$, a produkt i inverz elemenata koji
fiksiraju $x$ opet fiksiraju $x$, po aksiomima iz [[def-group-action]].
Djelovanje je slobodno točno kad je svaki $G_x$ trivijalan
([[con-slobodna-djelovanja]]); tada je $g\mapsto g\cdot x$ bijekcija
$G\to\mathrm{Orb}(x)$ ([[exp-orbite-i-stabilizatori]]).
```

**`mor-stabilizer`, strict style** (advanced vault, or the member said
*strogo*): the chosen point becomes part of a new object, joined to the
bare action by a `data` arrow, and the stabilizer becomes functorial
because a map of pointed actions carries one stabilizer into the other.

```yaml
# trees/obj-pointed-group-action.md — frontmatter
id: obj-pointed-group-action
taxon: object
title: "Djelovanje s istaknutom točkom"
symbol: "(G, X, \\rho, x_0)"
hom: "Par $(\\varphi,f)$ homomorfizma i ekvivarijantne funkcije koji čuva istaknutu točku: $f(x_0)=y_0$."
depends: [obj-group-action]

# trees/mor-pointed-underlying.md — frontmatter
id: mor-pointed-underlying
taxon: morphism
kind: data
from: obj-pointed-group-action
to: obj-group-action
statement: "(G,X,\\rho,x_0)\\mapsto (G,X,\\rho)"
acts_on: all
needs: []
on_homomorphisms: "$(\\varphi,f)\\mapsto(\\varphi,f)$; zaboravlja se samo uvjet $f(x_0)=y_0$."
functorial: true
```

```markdown
---
id: mor-stabilizer
taxon: morphism
title: "Stabilizator istaknute točke"
kind: property
from: obj-pointed-group-action
to: obj-subgroup
statement: "(G,X,\\rho,x_0)\\mapsto G_{x_0}=\\{\\,g\\in G : g\\cdot x_0=x_0\\,\\}\\le G"
label: "G_{x_0}"
acts_on: all
needs: []
on_homomorphisms: "$(\\varphi,f)\\mapsto\\varphi|_{G_{x_0}}\\colon G_{x_0}\\to H_{y_0}$; dobro definirano jer $\\varphi(g)\\cdot y_0=f(g\\cdot x_0)=f(x_0)=y_0$, a slaganje se čuva jer je riječ o restrikciji."
functorial: true
teaches: [orbits-stabilizers]
requires: []
depends: [obj-pointed-group-action, def-subgroup]
standalone: true
language: hr
origin: agent
---

Isti skup kao stabilizator gole točke, ali sada je točka dio podatka, pa
preslikavanje istaknutih djelovanja nosi $G_{x_0}$ u $H_{y_0}$ —
stabilizator je funktor. Podgrupa je po aksiomima iz [[def-group-action]];
trivijalan za svaku točku točno kad je djelovanje slobodno
([[con-slobodna-djelovanja]]).
```

The cost of the strict style, say it when offering it: the cached value
`mor-stabilizer` on `obj-ogrlice-z6` is no longer legal, because that
arrow now leaves `obj-pointed-group-action`, which is not the kind the
instance is an instance of; the example either becomes an instance of the
pointed kind ($x_0$ a named bead) or the value is dropped.

**Two actions of one group and a map between them.** The work talks
about equivariant maps, so the graph needs two structures for one to run
between: two **instances** of the kind, and a `hom` between them. All three
are in the vault on disk.

```yaml
# trees/obj-group-action-source.md — frontmatter; the body is three sentences
id: obj-group-action-source
taxon: object
title: "Djelovanje na skupu X"
symbol: '(G, X, \rho)'
instance_of: obj-group-action
region: primjeri
depends: [obj-group-action]

# trees/obj-group-action-target.md
id: obj-group-action-target
taxon: object
title: "Drugo djelovanje iste grupe"
symbol: '(G, Y, \sigma)'
instance_of: obj-group-action
region: primjeri
depends: [obj-group-action]

# trees/mor-equivariant-map.md — frontmatter
id: mor-equivariant-map
taxon: morphism
title: "Ekvivarijantno preslikavanje"
kind: hom
from: obj-group-action-source
to: obj-group-action-target
statement: 'f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)\ \text{za sve } g\in G,\ x\in X'
label: 'f'
needs: []
region: primjeri
depends: [obj-group-action-source, obj-group-action-target]
```

No `invertible`: a general equivariant map need not be a bijection, and
the key is a claim either way. The body says what the arrow is, that a
bijective one is an isomorphism of actions and why its inverse is
equivariant for free, and gives the one the work proves —
$G/G_x\to Gx$ from `thm-orbit-stabilizer`. Neither instance has a `hom`,
six headings or any coverage warning; `con-` and `thm-` trees about
equivariant maps list the arrow in `about`.

**A loop.** Each element of an acting group moves the set by a
bijection: a map from the set to itself, so `from` and `to` are the same
instance — the set in the defining diagram, not the kind.

```yaml
# trees/mor-act-by-element.md — frontmatter
id: mor-act-by-element
taxon: morphism
title: "Djelovanje jednog elementa"
kind: hom
from: obj-acted-set
to: obj-acted-set
statement: 'x\mapsto g\cdot x'
label: 'g\cdot'
needs: ['djelovanje grupe $G$ na skupu $X$', 'element $g\in G$']
invertible: true
region: primjeri
depends: [obj-acted-set, def-group-action]
```

The page draws it as a loop on `obj-acted-set` and, on the arrow's own page,
as the chain $X\to X\to X\to\cdots$ with $g\cdot$ on every arrow; the
body says what the chain lists — $x, g\cdot x, g^2\cdot x,\dots$, points
of the orbit of $x$ under $\langle g\rangle$: the whole orbit when $g$
has finite order, possibly only part of it otherwise. Why a loop and a chain are the
same thing is told once, in `exp-petlja-kao-lanac`, whose `about` lists
this loop; the next loop the vault gains is added to that list, not
explained again.

**A structure that is two things and a map — never a pair object.** A
subgroup looks like a candidate for a box whose symbol is a pair, and in 0.2
it was one. It is not: it is a **kind**, and what a reader would say to
define it — "a group $H$, a group $G$, and an injective homomorphism
$H\to G$" — is its defining diagram. In the vault on disk:

```yaml
# trees/obj-subgroup.md — the keys that matter here
id: obj-subgroup
taxon: object
symbol: 'H \le G'
hom: 'Homomorfizam $\varphi\colon G_1\to G_2$ s $\varphi(H_1)\subseteq H_2$: podgrupa $H_1$ u $G_1$ nosi se u podgrupu $H_2$ u $G_2$.'
data: [obj-subgroup-as-group, obj-ambient-group, mor-inclusion]

# trees/obj-subgroup-as-group.md, trees/obj-ambient-group.md — two instances of
# ONE kind in two roles, so two boxes even though both are "a group"
instance_of: obj-group        # symbol 'H' / 'G'

# trees/mor-inclusion.md — the component map, a morphism in obj-group
kind: hom
from: obj-subgroup-as-group
to: obj-ambient-group
statement: '\iota\colon H\to G,\quad \iota(h)=h'
needs: []
```

The same move answers every arrow that seemed to need two sources. The
disjoint union of two actions of one group starts from a kind — "dva
djelovanja iste grupe", defined by a diagram holding two instances of
`obj-group-action`, with the shared $G$ stated in its body as an axiom —
and `data` arrows out of *that kind* reach each action. What is never
written is a box introduced only to hold a pair, and no body says
"product".

**Inverse up to a canonical isomorphism** (not in the vault on disk; the
strict style, with `obj-pointed-transitive-action` — a pointed action as
above that has one orbit, `symbol: '(G, X, \rho, x_0),\quad Gx_0=X'`).
From a subgroup to the action on its cosets with base point $eH$, and
from a pointed transitive action to the stabilizer of its point:

```yaml
# trees/mor-pointed-coset-action.md — the keys that matter here
kind: transform
from: obj-subgroup
to: obj-pointed-transitive-action
statement: '(H\le G)\mapsto(G,\ G/H,\ g\cdot xH=gxH,\ eH)'
inverse: mor-pointed-stabilizer

# trees/mor-pointed-stabilizer.md — the keys that matter here
kind: property
from: obj-pointed-transitive-action
to: obj-subgroup
statement: '(G,X,\rho,x_0)\mapsto G_{x_0}\le G'
inverse: mor-pointed-coset-action
up_to: thm-orbit-stabilizer
```

Subgroup, cosets, stabilizer of $eH$ returns $H$ itself. Pointed action,
stabilizer, cosets returns $G/G_{x_0}$, which is not $X$ — but
$gG_{x_0}\mapsto g\cdot x_0$ is an isomorphism of pointed actions
between them, and `thm-orbit-stabilizer` is the tree that states it. So
the pair is `inverse`, and the arrow whose round trip needs the
isomorphism carries `up_to`.

**An assumption.** The work's Lagrange is for finite groups and assumes
nothing. Its extension to infinite groups, $|G|=[G:H]\cdot|H|$ as
cardinals, picks one representative from each of infinitely many cosets:

```yaml
# trees/thm-lagrange-beskonacne-grupe.md — the keys that matter here
id: thm-lagrange-beskonacne-grupe
taxon: theorem
about: [obj-subgroup]
assumes: [axiom-of-choice]
```

The `index.md` section the write adds — the **kinds** only:

```markdown
## Struktura

Vrste struktura o kojima šuma govori. Instance tih vrsta (`instance_of`) i
strelice (`mor-`) ovdje se ne popisuju: instanca stoji uz svoju vrstu,
strelica uz svoj izvor.

- [[obj-set]] — skup $X$: ono na čemu grupe djeluju
- [[obj-group]] — grupa $G$
- [[obj-subgroup]] — podgrupa $H \le G$: dijagram grupe, okolne grupe i inkluzije; Lagrange joj mjeri indeks
- [[obj-group-action]] — $(G, X, \rho)$: grupa koja miče skup, zadana dijagramom grupe, skupa i pravila; orbite, stabilizatori, ogrlice
```

## Precision rules — the drafter obeys all of them

1. **Every hypothesis named.** Finiteness, a chosen point, a chosen
   subgroup — each is an entry of `needs` (or a component of a dedicated
   object), never implied by the notation of `statement`. If the
   statement only makes sense for finite $X$, `needs` says
   `"$X$ konačan"`.
2. **`functorial: true` only when a map between results exists and
   composes.** Write that map in `on_homomorphisms` as a formula,
   `(\varphi,f)\mapsto …`, and check it respects composition. If you had
   to choose anything along the way — a point, a representative — it is
   `false`, and the sentence says what is forgotten instead. When the
   object's `hom` lets the group vary, its `hom` says which maps the
   flag is judged on; the example vault judges it on equivariant maps
   ($\varphi=\mathrm{id}$), so fixed points are functorial there while
   for a varying group they are not, and the sentence says both.
3. **No arrow whose statement cannot be written as a formula.** `A
   \mapsto B` in LaTeX — for a hom, the map and the condition that makes
   it a morphism — or it is not an arrow: what you can only say in
   words is a `thm-` with `about`, or a remark.
4. **Prefer fewer, correct arrows.** Ten the member can defend beat
   thirty that look complete; a kind you are unsure of is left out and
   named as a candidate in the report.
5. **A construction's two ends are kinds; a hom's two ends are
   instances.** A count ends in `obj-nat`; nothing ends in a `def-` tree
   or a theorem. An arrow out of a kind needs no copy per instance — it
   already applies to all of them.
6. **Named instances are the work's own examples.** One per example the
   work computes; a `values` entry only when the work states it or you have
   verified it by hand and could show the computation. An example you
   made up is not an instance of this work. Generic instances are different
   and always allowed: they are the objects a proof names.
7. **`generalizes` forgets nothing; `construction` is standard.** Both
   only when the work or mathematics the member will recognise supports
   them and both objects exist in the vault. A `generalizes` arrow is
   `functorial: true` by definition — if `on_homomorphisms` is not the
   identity on maps, it is not `generalizes`.
8. **`inverse` is mutual, and says how exactly.** Only when both arrows
   exist, each names the other, and the two compose to the identity in
   both directions — on the nose, or up to a canonical isomorphism, and
   then the arrow whose round trip needs it carries `up_to`, pointing at
   the tree that states that isomorphism for this instance (draft the
   tree if the vault lacks it). "Isomorphic, by no particular map" is
   not an inverse.
9. **Two field types, never mixed.** `symbol`, `statement`, `label` are
   LaTeX with no `$` and no words of the vault's language (they would
   typeset as a string of italic variables); `hom`, `needs`,
   `on_homomorphisms`, `values` are sentences with inline `$…$`.
10. **Data arrows exhaust the components that are kinds.** Every
    component of `symbol` that is itself a kind in the vault gets
    exactly one `data` arrow; a component that is not a kind gets
    none and is read through `acts_on: all`. Those arrows are not the
    defining diagram: `data` on the kind names the instances the
    definition is drawn over, the arrows named `kind: data` go the other
    way, out of the kind onto its components.
11. **`about` is what a statement is about, not what it mentions.** The
    objects it quantifies over and the arrows it computes; a theorem
    that mentions a group in passing is not about `obj-group`.
12. **Standalone, like every tree.** Six headings in the vault's
    language on every kind — an instance gets two or three sentences —
    no scrollback, every wikilink resolving, the `def-` tree linked from
    `## Definicija` rather than restated at length.
13. **No pair object, ever.** A structure that is two things and a map
    between them is a **kind** with a defining diagram (`data`), and the
    arrows out of that kind reach each piece. A construction never takes
    a second structure through `needs` either. A `hom` is exempt: it is
    one map, and its `needs` may name the structure the map is read from
    ($x\mapsto g\cdot x$ needs an action of $G$ on $X$).
14. **Two structures of one kind are two instances of it.** Each carries
    `instance_of`; the map between them is a `hom`. For a general map the
    `statement` carries the condition that makes it a morphism of the
    kind; for one specific map it is the formula, and the body says why it
    is a morphism. `invertible` is a claim you can defend: `true`, `false`,
    or absent for a general map. A way back that exists but is not unique
    is not an `inverse` — the body says so, and the tree `assumes` what
    choosing one needs.
15. **Loops stay loops.** A construction from a kind to itself, or a map
    from an instance to itself, has `from` equal to `to`; never a
    duplicate box to straighten it. The chain is drawn for you, and when
    the vault has a tree on loops as chains the new loop joins its `about`.
16. **`assumes` whenever choice is used.** Zorn's lemma, well-ordering,
    "pick a representative of every class" over an infinite family with
    no rule that singles one out: `axiom-of-choice`. Least elements in
    $\mathbb N$, or $[0,1)\cap\mathbb Q$ for $\mathbb Q/\mathbb Z$,
    need no choice and are not tagged. Any other named principle likewise. It goes on
    the tree whose statement, proof or example depends on it, not on its
    neighbours.
17. **Categorical words stay in the structure.** For a work that is not
    categorical, no body says "product", "functor", "natural" or
    "category" unless the member asks; `instance_of`, `data`, `hom`,
    `functorial` and `up_to` already say it.
18. **Regions are read, not decorative.** Each region is a subgraph a
    member can read on its own, named in the vault's language; a box
    belongs to the region whose story it is part of, and every token a
    tree uses is declared in `forest.json`.
19. **A chain of named instances is written, not drawn.** A proof that
    walks through named objects — the real field, a valuation on it, the
    valuation that induces on the plane, the colouring that affords — is a
    chain of constructions applied to instances, and a construction is
    already an arrow between the kinds, applying to every instance of its
    source. So there is no new arrow. On the earlier instance put `values`
    keyed by that construction, the sentence naming what it yields here
    (`mor-extend: "a 2-adic valuation on $\mathbb{R}$, the instance
    obj-v-reals"`); on the later instance put `about: [<the earlier
    instance>, <that construction>]`; and let its body state the identity
    in one sentence. **Never** a `hom` between the two named instances, and
    **never** a link of the chain in a kind's `data` — both collapse the two
    levels, and the second would make a definition out of a step of a proof.
    The reader follows the chain up each box's tie to its kind, along the
    construction, and back down; the panel shows both ends.
20. **Determined inside a diagram is not a chain.** One case wears rule 19's
    clothes and is right: a component of a kind's defining diagram that is
    determined by *another component of that same diagram* — the vertex set
    in the definition of a coloured dissection, which is what `mor-vertices`
    yields on the dissection the diagram already names. Give it the same
    `values`/`about` pair and list it in `data`: a diagram over "a
    dissection, some set, three colours" would define nothing, since nothing
    would tie the set to the dissection. The validator draws the line by
    where the `about` points — inside the diagram, kept; outside it, refused
    — so the question to ask of a box is whether what determines it is part
    of the definition or part of the proof.

## Honest limits

- The validator checks shape, never mathematics: a vague or wrong arrow
  with every key present passes. It checks that a hom's two ends are
  instances of one kind, or that a different-kinds hom is listed in a third
  kind's `data` — not that `statement` is really that component or that
  morphism; that a kind's `data` entries are instances of other kinds, not
  that they are the right instances; that `up_to` names a tree, not that
  the tree states
  the isomorphism; and it cannot know what a proof assumes. The precision
  rules and the member's reading at the table are the whole quality gate,
  which is why the table comes before any file.
- No key says that an instance is the value of an arrow on another
  instance: that `\mathrm{Sym}(X)` is what `mor-sym` yields on $X$ is
  written in `values`, `about` and the body, by rule 19, and the canvas
  shows no edge between the two named boxes. That is deliberate — the arrow
  lives one level up — but it means a long chain reads as a list of ties to
  kinds, and the temptation to draw it with a `hom` or to park it in a
  kind's `data` is a mistake the validator now catches: a `hom` between
  instances of two kinds needs a third kind's `data` to anchor it, and a
  `data` component whose `about` leaves the diagram is refused by name.
- Croatian terminology for categorical notions (*kolimes, vjeran
  funktor, ekvivarijantno*) is thin; the object pages you write set it
  for the vault, so pick one term and keep it.
- `fields` is an open vocabulary; reuse the exact string the vault
  already uses, since the page groups by it.
- Without `nlab-seed.json` or library objects, `same_as` and `nlab` stay
  empty, and that is correct — `grow` resolves them when the tree is
  offered.
