---
name: structure
description: Draft the structure graph of a Forest vault for the member to approve — the kinds of mathematical structure the work is about as obj- trees, the constructions between them and the maps inside one kind as mor- arrows, proposed as one table in chat and written only after a yes, then validated as forest-0.2. Use when a member wants the Struktura tab filled ("napravi strukturu ove šume", "koji su objekti i strelice", "nacrtaj strukturni graf", "dodaj objekt za djelovanja"), or when a vault has trees but no obj-/mor- files yet.
---

# Structure — the vault's objects and arrows

You are the structure half of the MatSek Knowledge Forest: a vault
already has one graph — trees joined by `depends`, saying what to read
first — and you draft the second: boxes for *kinds* of structure (a
group, a set, a group acting on a set) and labelled arrows of two sorts —
what one can build, extract or measure from one kind to get another, and
the maps between two structures of one kind. The picture stays made of
boxes and single-source arrows; depth sits behind it. Both are
ordinary trees of two new taxa, `object` (`obj-`) and `morphism`
(`mor-`), so everything that works on trees — search, marks, views,
`grow` — works on them unchanged. The on-disk contract is
`${CLAUDE_PLUGIN_ROOT}/docs/forest-format.md` (forest-0.2); the keys are
restated once below because they are the whole of this job, but the doc
wins where they disagree.

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

An **object** is a kind of structure, not one particular structure: "a
group", never "$\mathbb{Z}_6$". Beyond the usual tree keys it carries
`symbol` (LaTeX for the data, no `$`: `(G, X, \rho)`), `hom` (one
sentence with inline `$…$`: what a map between two structures of this
kind is), and optionally `same_as` (an `obj-` id in the library forest,
shape-checked only) and `nlab: {title, revision}`. Its body has six
sections — `## Ideja`, `## Definicija`, `## Podaci`, `## Svojstva`,
`## Primjeri`, `## Povezano` (`Idea, Definition, Data, Properties,
Examples, Related` in an `en` vault); the validator warns when
`Definicija`/`Definition` is missing.

A **typed object** is a second box of a kind the vault already has: it
carries `type` (the id of the kind's own box, which must have no `type`
itself), its own `symbol`, no `hom` (inherited), and a body of a
sentence or two. It exists so that a map between two structures of one
kind has two ends to be drawn between.

A **morphism** is an arrow, of one of two sorts. A *construction* takes
any structure of `from` to a structure of `to`, after supplying the
extra data its hypotheses name. A *hom* (`kind: hom`) is one map between
two structures of the same kind — a morphism in that kind's category,
remembered as such. Keys: `kind` in `data | transform | extract |
property | instance | generalizes | construction | hom`; `from`, `to`
(object ids; `from` is the pseudo-id `pt` exactly when `kind` is
`instance`; on a hom the two are of one type, and on any kind but
`instance` they may be the same object — a loop); `statement` (LaTeX, no
`$`); optional `label` (short LaTeX for the graph edge, the page falls
back to `title`); `acts_on` (`all`, or a list of `data` arrows out of
the same `from` — which components it reads); `needs` (list of sentences
naming data not part of the source, may be empty); `on_homomorphisms`
(one sentence: what it does to a map between two source structures, or
what it forgets); `functorial` (boolean). The last four are required on
every construction. An `instance` has none of them but `needs`, and may
carry `values`: a map from ids of arrows out of `to` to one sentence
each — what that arrow yields on this example. A `hom` has `needs` and
none of the other three, nor `values`, and may carry `invertible`
(boolean: is the map an isomorphism). Optional on any arrow: `inverse`
(symmetric), `up_to` (beside `inverse` only: the id of the tree stating
the canonical isomorphism the inverse holds up to) and `generalized_by`
(list of `mor-` ids).

Any tree may carry `about` (list of `obj-`/`mor-` ids), `fields`
(kebab-case words in the vault's language: `algebra`, `kombinatorika`,
`geometrija`) and `assumes` (kebab-case tokens for what it assumes about
the formal system: `axiom-of-choice`, `excluded-middle`,
`continuum-hypothesis`, or another named principle). `depends` stays the
only prerequisite relation and stays acyclic; `from`/`to` are not
prerequisites and may form cycles (curry/uncurry) and loops.

The eight kinds, with the group-action instance of each:

| kind | meaning | example |
|---|---|---|
| `data` | projection to a component that is itself an object | `(G,X,\rho)\mapsto G` |
| `transform` | a structure of another kind built from the whole; `inverse` marks an isomorphism of kinds | `\rho\mapsto\hat\rho\colon G\to\mathrm{Sym}(X)` |
| `extract` | a sub- or quotient structure of a component | `X\mapsto X/G` |
| `property` | a measurement, usually with extra data in `needs`; a bare count ends in `obj-nat` | `(G,X,\rho),\,x\mapsto G_x\le G` |
| `instance` | one concrete example the work computes; `from: pt` | `(\{0,3\},\ \mathbb{Z}_6,\ h\cdot g=g-h)` |
| `generalizes` | every structure of this kind is one of the wider kind, nothing forgotten; `functorial: true` always | group action → monoid action |
| `construction` | a standard categorical home or a (co)limit built from the kind | `(G,X,\rho)\mapsto` an object of `G\text{-}\mathbf{Set}` |
| `hom` | one map between two structures of one kind, or from a structure to itself; never a construction | `f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)` |

## Stage 1 · LOCATE

The working directory if it holds `forest.json`, else the path the
invocation names, else one short question. Read `forest.json`:
`language` decides every sentence you write; `schema_version` tells you
whether this is a first draft (`forest-0.1`, bumped at write time) or an
extension (`forest-0.2`: read the existing `obj-`/`mor-` trees first and
propose additions only — a member-origin structure tree is never
rewritten without being asked); `derivative` decides the closing
sentence of stage 7. A `library/forest` checkout is not a target: the
library gets structure through `grow`, never by this skill writing into
it.

## Stage 2 · READ — the whole vault, no sampling

Read `index.md` and every file in `trees/`. A vault is small by design
and the proposal is only as good as this read; a sampled vault yields
arrows about things the work never does. For each tree note four things:

- which **kind of structure** its statement quantifies over — a
  candidate object ("za svaku konačnu grupu i podgrupu" → a group, a
  subgroup);
- what it **builds from what** — a candidate arrow (orbits from an
  action, a coset space from a subgroup, a count from a finite set);
- which **maps between two structures of one kind** it works with — a
  homomorphism between two groups, a map from a set to itself — candidate
  hom arrows, each needing a second box or a loop;
- which **examples it computes to the end**, with numbers — candidate
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
that is not categorical, "product", "functor", "natural isomorphism" and
their relatives stay out of every body you write unless the member asks
for them — the kinds, types and keys already carry those notions.

If `library/structure/nlab-seed.json` exists beside a library checkout,
use its titles and aliases to match your objects to library ones
(`same_as`, `nlab`) and its link lists as a *suggestion* feed for arrows
you may have missed — suggestions only, since nLab links are see-also,
not constructions, and no nLab prose ever enters a file. When the seed
or the library objects are absent, leave `same_as` and `nlab` out; a
wrong pointer is worse than none.

## Stage 3 · DRAFT, against the precision rules

**Objects first.** One per kind of structure the work quantifies over —
not one per definition. The test is `hom`: if you cannot say in one
sentence what a map between two of these is, it is not a kind, and the
`def-` tree stays what it is (a coset is a subset, not a kind; a
subgroup `H\le G` is a kind, its maps are homomorphisms carrying $H$ into
$H'$). `symbol` is the data as a tuple. `depends` is the `def-` tree that
defines the kind and nothing else unless a reader genuinely must hold it
first. A measurement that ends in a number needs `obj-nat` (`symbol:
"n \\in \\mathbb{N}"`, `hom: "$m \\le n$"`) — one for the whole vault,
only if an arrow ends there.

Two more objects are proposed only when an arrow calls for them. A
**second box of a kind** — a typed object, `type` naming the kind's own
box — when the work has a map between two structures of that kind to
draw. A **pair object** when an arrow needs a second structure that is
itself an object of the vault: its `symbol` is the pair, `(G, H)`, it
gets one `data` arrow to each of the two, and the arrow starts there, so
every arrow keeps a single source. Say *par*; do not say "product"
unless the member asks.

**Arrows per object, in this order,** so the easy ones anchor the hard
ones:

1. `data` — one per component of `symbol` that is itself an object in
   the vault; `acts_on: all`, `needs: []`, `functorial: true`,
   `on_homomorphisms` names the component of the map. A component that
   is not an object (the rule $\rho$) gets no arrow.
2. `extract` — the sub- and quotient structures the work actually forms.
3. `property` — the measurements the work actually makes; extra data in
   `needs` (default) or in a dedicated object (advanced); the target is a
   kind, a count ends in `obj-nat`.
4. `transform` — another presentation of the whole, or a structure of
   another kind built from it; `inverse` only when the work shows both
   directions and they compose to the identity.
5. `instance` — one per example the work computes, from the work's own
   trees (`exm-`, worked proofs); `values` only for what the work states
   or you have verified by hand.
6. `generalizes` / `construction` — only when the work, or standard
   mathematics the member will recognise, genuinely supports them, and
   both objects exist in the vault. Not to make the graph look complete.
7. `hom` — the maps inside the kind that the work actually uses: from
   the kind's box to a second, typed box of it, `statement` the map with
   the condition that makes it a morphism, `needs` what it depends on
   beyond its two ends. Record `invertible` when it is known — `true` for
   an isomorphism, `false` for a map shown not to be one, absent for a
   general map. When a way back exists but is not unique, there is no
   `inverse`: the body says so, and the tree `assumes` choice if picking
   one needs it.

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

Run the whole draft through the precision rules below before showing
it. An arrow you are unsure of is dropped from the table and named in
one line under it as a candidate.

## Stage 4 · PROPOSE — one table, then wait

Show the proposal in chat as a compact table in the vault's language and
stop. One row per object (bold, with its `symbol`), then one row per
arrow out of it, marked `↳`; an instance is marked `← pt` in the target
column because it enters the object, a loop `⟲` because it returns to
it, and a typed object names its type beside *objekt*. Below it, a
second small table of existing trees that gain `about`/`fields`/
`assumes`, a line stating the style chosen (light or strict) and the
one-line reply forms:

```
| stablo                              | vrsta    | →            | iskaz (LaTeX)                           | treba / napomena                      |
|-------------------------------------|----------|--------------|-----------------------------------------|---------------------------------------|
| **obj-group-action** · (G, X, \rho) | objekt   | —            | Djelovanje grupe na skupu               | ovisi o def-group-action              |
| ↳ mor-action-group                  | data     | obj-group    | (G,X,\rho) \mapsto G                    | funkt.                                |
| ↳ mor-action-set                    | data     | obj-set      | (G,X,\rho) \mapsto X                    | funkt.                                |
| ↳ mor-orbits                        | extract  | obj-set      | (G,X,\rho) \mapsto X/G                  | funkt.; iz exp-orbite-i-stabilizatori |
| ↳ mor-stabilizer                    | property | obj-subgroup | (G,X,\rho),\,x \mapsto G_x \le G        | treba x \in X; nije funkt.            |
| ↳ mor-koseti-z6                     | instance | ← pt         | (\{0,3\},\ \mathbb{Z}_6,\ h\cdot g=g-h) | values za 4 strelice; iz exm-koseti-u-z6 |
| ↳ mor-equivariant-map               | hom      | obj-group-action-target | f\colon X\to Y,\ f(g\cdot x)=g\cdot f(x) | ne mora biti izomorfizam |
| **obj-group-action-target** · (G, Y, \sigma) | objekt, tip obj-group-action | — | Drugo djelovanje iste grupe | kraj strelice mor-equivariant-map |
| **obj-subgroup** · H \le G          | objekt   | —            | Podgrupa                                | ovisi o def-subgroup                  |
| **obj-set** · X                     | objekt   | —            | Skup                                    |                                       |
| ↳ mor-act-by-element                | hom      | ⟲ obj-set    | x \mapsto g\cdot x                      | treba djelovanje i g \in G; izomorfizam; petlja |
| …                                   |          |              |                                         |                                       |

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
writes. A typed object gets `type`, its own `symbol`, no `hom` and a
body of a sentence or two instead of the six headings.

Then, in this order:

- `forest.json`: `schema_version` becomes `"forest-0.2"`. Nothing else
  changes, and no existing tree changes meaning — a 0.1 vault is a 0.2
  vault with no structure.
- `index.md`: a section `## Struktura` (`## Structure` in `en`) after
  the work's own sections, one wikilink per object with a one-line
  gloss. Morphisms are not listed; the views attach each to its `from`
  object.
- `about`/`fields`/`assumes` on the approved existing trees: frontmatter
  keys added, body and `origin` untouched. A new loop is appended to the
  `about` of the vault's loop-as-chain tree, when it has one.

## Stage 6 · VALIDATE — until clean

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-forest.mjs" <vault-dir> --concepts <path-to-concepts.yaml>
```

Every structure error names the file and the key; fix that file, rerun,
until there is no error. The two structure warnings are judgments, not
chores, and a typed object draws neither: *an object with no instance arrow* means the work computes no
example of it — add the instance if a tree does, and otherwise leave the
warning and say so, never invent an example; *no `generalizes` arrow in
either direction* is normal for most vaults and is reported as such. A
missing `## Definicija` is a real gap: write it.

## Stage 7 · REBUILD and REPORT

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-vault.mjs" <vault-dir>
```

Then tell the member, in their language and in a few sentences: how many
objects and which, how many arrows by kind, which existing trees gained
`about`, that `views/forest.html` now has a *Struktura* tab — where a
loop is drawn on its box and, on its own page, unrolled into a chain —
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
stage 4 shows for its `obj-group-action` block, and this example is
illustrative — it picks `mor-koseti-z6`, the coset action from
`exm-koseti-u-z6`, as the instance. The vault on disk already carries its
structure layer (42 trees: nine objects, one of them typed, fifteen
arrows, two theorems with proofs, one connection, one exposition) and
instantiates the object with
`mor-ogrlice-z6`, the necklace rotations, instead; read it as the
finished shape, this section as the path there. The object:

```markdown
---
id: obj-group-action
taxon: object
title: "Djelovanje grupe na skupu"
symbol: "(G, X, \\rho)"
hom: "Par $(\\varphi, f)$: homomorfizam $\\varphi\\colon G\\to H$ i funkcija $f\\colon X\\to Y$ uz $f(g\\cdot x)=\\varphi(g)\\cdot f(x)$; za $G=H$ i $\\varphi=\\mathrm{id}$ to su ekvivarijantna preslikavanja, i na njima se sudi je li strelica iz ovog objekta funktorijalna."
teaches: [group-actions]
requires: [functions]
depends: [def-group-action]
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
Grupa $G$ ([[mor-action-group]]), skup $X$ ([[mor-action-set]]) i
pravilo $\rho$.

## Svojstva
Orbite particioniraju $X$ ([[mor-orbits]], [[exp-orbite-i-stabilizatori]]);
stabilizator točke je podgrupa ([[mor-stabilizer]]); slobodno djelovanje
ima jednakobrojne orbite ([[con-slobodna-djelovanja]]).

## Primjeri
Podgrupa $H\le G$ na nosivom skupu $G$ formulom $h\cdot g=gh^{-1}$ —
motor dokaza [[prf-lagrange-djelovanje]]; izračunato za
$\{0,3\}\le\mathbb{Z}_6$ u [[mor-koseti-z6]].

## Povezano
Lagrangeov teorem kao slučaj načela „slobodno djelovanje dijeli”:
[[con-slobodna-djelovanja]].
```

The instance carries the work's own numbers and nothing more — the
cosets `exm-koseti-u-z6` computes, the freeness `prf-lagrange-djelovanje`
proves:

```yaml
values:
  mor-action-group: "$\\{0,3\\}\\cong\\mathbb{Z}_2$"
  mor-action-set: "$\\mathbb{Z}_6$, šest elemenata"
  mor-orbits: "koseti $\\{0,3\\},\\{1,4\\},\\{2,5\\}$; ima ih $3=[\\mathbb{Z}_6:H]$"
  mor-stabilizer: "trivijalan za svaku točku: iz $g-h=g$ slijedi $h=0$, djelovanje je slobodno"
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
`mor-stabilizer` on `mor-koseti-z6` is no longer legal, because that
arrow now leaves `obj-pointed-group-action`, not the object the instance
picks; the example either gains a pointed instance (`x_0=0`) or the
value is dropped.

**Two actions of one group and a map between them.** The work talks
about equivariant maps, so the graph needs somewhere for one to land: a
second box of the same type, and a `hom` between the two. Both are in
the vault on disk.

```yaml
# trees/obj-group-action-target.md — frontmatter; the body is three sentences
id: obj-group-action-target
taxon: object
title: "Drugo djelovanje iste grupe"
symbol: '(G, Y, \sigma)'
type: obj-group-action
teaches: []
requires: []
depends: [obj-group-action]

# trees/mor-equivariant-map.md — frontmatter
id: mor-equivariant-map
taxon: morphism
title: "Ekvivarijantno preslikavanje"
kind: hom
from: obj-group-action
to: obj-group-action-target
statement: 'f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)\ \text{za sve } g\in G,\ x\in X'
label: 'f'
needs: []
depends: [obj-group-action, obj-group-action-target]
```

No `invertible`: a general equivariant map need not be a bijection, and
the key is a claim either way. The body says what the arrow is, that a
bijective one is an isomorphism of actions and why its inverse is
equivariant for free, and gives the one the work proves —
$G/G_x\to Gx$ from `thm-orbit-stabilizer`. The typed box has no `hom`,
no six headings and draws no coverage warnings; `con-` and `thm-` trees
about equivariant maps list the arrow in `about`.

**A loop.** Each element of an acting group moves the set by a
bijection: a map from the set to itself, so `from` and `to` are the same
object.

```yaml
# trees/mor-act-by-element.md — frontmatter
id: mor-act-by-element
taxon: morphism
title: "Djelovanje jednog elementa"
kind: hom
from: obj-set
to: obj-set
statement: 'x\mapsto g\cdot x'
label: 'g\cdot'
needs: ['djelovanje grupe $G$ na skupu $X$', 'element $g\in G$']
invertible: true
depends: [obj-set, def-group-action]
```

The page draws it as a loop on `obj-set` and, on the arrow's own page,
as the chain $X\to X\to X\to\cdots$ with $g\cdot$ on every arrow; the
body says what the chain lists — $x, g\cdot x, g^2\cdot x,\dots$, points
of the orbit of $x$ under $\langle g\rangle$: the whole orbit when $g$
has finite order, possibly only part of it otherwise. Why a loop and a chain are the
same thing is told once, in `exp-petlja-kao-lanac`, whose `about` lists
this loop; the next loop the vault gains is added to that list, not
explained again.

**An arrow that needs a second structure** (not in the vault on disk).
The disjoint union of two actions of one group consumes both, and both
are objects, so it starts from a pair with a `data` arrow to each:

```yaml
# trees/obj-group-action-pair.md — frontmatter
id: obj-group-action-pair
taxon: object
title: "Par djelovanja iste grupe"
symbol: '\bigl((G,X,\rho),\ (G,Y,\sigma)\bigr)'
hom: 'Par ekvivarijantnih preslikavanja $(f, h)$: $f\colon X\to X_1$ i $h\colon Y\to Y_1$.'
depends: [obj-group-action, obj-group-action-target]

# trees/mor-pair-first.md, trees/mor-pair-second.md — frontmatter of the first
id: mor-pair-first
taxon: morphism
kind: data
from: obj-group-action-pair
to: obj-group-action          # the second one ends in obj-group-action-target
statement: '\bigl((G,X,\rho),\ (G,Y,\sigma)\bigr)\mapsto(G,X,\rho)'
acts_on: all
needs: []
on_homomorphisms: '$(f,h)\mapsto f$.'
functorial: true

# trees/mor-disjoint-union.md — frontmatter
id: mor-disjoint-union
taxon: morphism
kind: transform
from: obj-group-action-pair
to: obj-group-action
statement: '\bigl((G,X,\rho),\ (G,Y,\sigma)\bigr)\mapsto(G,\ X\sqcup Y,\ \rho\sqcup\sigma)'
label: 'X\sqcup Y'
acts_on: all
needs: []
on_homomorphisms: '$(f,h)\mapsto f\sqcup h$, ekvivarijantno jer je takvo na svakom dijelu.'
functorial: true
```

In the table and in every body it is a *par djelovanja*; the member who
wants the categorical name asks for it.

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

The `index.md` section the write adds:

```markdown
## Struktura

- [[obj-set]] — skup $X$: ono na čemu grupe djeluju
- [[obj-group]] — grupa $G$
- [[obj-subgroup]] — podgrupa $H \le G$: par kojem Lagrange mjeri indeks
- [[obj-group-action]] — $(G, X, \rho)$: grupa koja miče skup; orbite, stabilizatori, primjer $\{0,3\}$ na $\mathbb{Z}_6$
- [[obj-group-action-target]] — $(G, Y, \sigma)$: drugo djelovanje iste grupe, da ekvivarijantno preslikavanje ima kamo stići
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
5. **The target is a kind.** An arrow ends in an object of the vault; a
   count ends in `obj-nat`; never in a `def-` tree, never in a theorem.
6. **Instances are the work's own examples.** One per example the work
   computes; a `values` entry only when the work states it or you have
   verified it by hand and could show the computation. An example you
   made up is not an instance of this work.
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
10. **Data arrows exhaust the components that are objects.** Every
    component of `symbol` that is itself an object in the vault gets
    exactly one `data` arrow; a component that is not an object gets
    none and is read through `acts_on: all`.
11. **`about` is what a statement is about, not what it mentions.** The
    objects it quantifies over and the arrows it computes; a theorem
    that mentions a group in passing is not about `obj-group`.
12. **Standalone, like every tree.** Six headings in the vault's
    language on every object that is a kind — a typed object gets a
    sentence or two — no scrollback, every wikilink resolving, the
    `def-` tree linked from `## Definicija` rather than restated at
    length.
13. **One source per construction.** A *construction* that consumes a
    second structure which is itself an object of the vault starts from
    a pair object with `data` arrows to both — not from one of the two
    with the other tucked into `needs`. It is a *par*; "product" is not
    said unless the member asks. A `hom` is exempt: it is one map, and
    its `needs` may name the structure the map is read from
    ($x\mapsto g\cdot x$ needs an action of $G$ on $X$).
14. **Two structures of one kind are two boxes of one type.** The second
    is an object with `type`; the map between them is a `hom`. For a
    general map the `statement` carries the condition that makes it a
    morphism of the kind; for one specific map it is the formula, and
    the body says why it is a morphism. `invertible` is a claim you can defend: `true`, `false`, or
    absent for a general map. A way back that exists but is not unique
    is not an `inverse` — the body says so, and the tree `assumes` what
    choosing one needs.
15. **Loops stay loops.** A construction or a map from an object to
    itself has `from` equal to `to`; never a duplicate box to straighten
    it. The chain is drawn for you, and when the vault has a tree on
    loops as chains the new loop joins its `about`.
16. **`assumes` whenever choice is used.** Zorn's lemma, well-ordering,
    "pick a representative of every class" over an infinite family with
    no rule that singles one out: `axiom-of-choice`. Least elements in
    $\mathbb N$, or $[0,1)\cap\mathbb Q$ for $\mathbb Q/\mathbb Z$,
    need no choice and are not tagged. Any other named principle likewise. It goes on
    the tree whose statement, proof or example depends on it, not on its
    neighbours.
17. **Categorical words stay in the structure.** For a work that is not
    categorical, no body says "product", "functor", "natural
    isomorphism" or the like unless the member asks; `type`, `hom`,
    `functorial` and `up_to` already say it.

## Honest limits

- The validator checks shape, never mathematics: a vague or wrong arrow
  with every key present passes. It checks that a hom's two ends share a
  type, not that `statement` is a morphism of that kind; that `up_to`
  names a tree, not that the tree states the isomorphism; and it cannot
  know what a proof assumes. The precision rules and the member's
  reading at the table are the whole quality gate, which is why the
  table comes before any file.
- Croatian terminology for categorical notions (*kolimes, vjeran
  funktor, ekvivarijantno*) is thin; the object pages you write set it
  for the vault, so pick one term and keep it.
- `fields` is an open vocabulary; reuse the exact string the vault
  already uses, since the page groups by it.
- Without `nlab-seed.json` or library objects, `same_as` and `nlab` stay
  empty, and that is correct — `grow` resolves them when the tree is
  offered.
