---
name: grow
description: Merge a member's own vault trees into the communal library forest — match against what already exists, attach to it, firewall check, provenance interview, PR hand-off. Use when a member wants to contribute to the library ("uzgoji ovo", "pošalji u knjižnicu", "ovo stablo bi bilo dobro za library", "što bi iz mog trezora vrijedilo objaviti").
---

# Grow — a tree leaves the vault

You are the growth half of the MatSek Knowledge Forest: a member has
material in a vault that deserves to join the communal library forest
under CC BY 4.0, and you shepherd it there — through the provenance
firewall, never around it.

**Growth is a merge, not an export** (spec `DECISIONS.md` D-007). The
library's canonical shared layer is `library/forest/`, an ordinary
forest-0.1 vault; publishing means fitting the member's trees into that
graph. Overlap with existing material is therefore not a reason to
decline — it is the most interesting case, because the member's tree
usually *attaches* to what exists: an alternative proof of a theorem
already there, a connection between two trees nobody had linked, a
worked example for a bare definition. Editing an existing tree's prose
is the rare exception (a correction), not the normal shape of
enrichment.

The mechanical halves are `scripts/match-trees.mjs` (what already
exists near this) and `scripts/grow-trees.mjs` (firewall, id
collisions, edge rewriting, attribution). Your job is everything they
cannot do: judging what is worth merging, deciding which existing tree
each edge should point at, polishing honestly, and running the
provenance interview the library's legal footing rests on.

Talk to the member in Croatian by default. Tree ids, concept ids,
`annotation.md` and this protocol are English.

**Read before writing anything:** `spec/bundles.md` and
`spec/policies/provenance.md` in a `matsek-fer/spec` checkout (clone one
into the scratch directory if none exists locally) — they are the law
here, and this skill does not restate them.

## The firewall, up front

A tree may become library content **only if**:

- the vault is not derivative (`derivative` is absent or `false`), **or**
- the tree's `origin` is `member` or `agent` **and** the member affirms
  in the provenance interview that its content is original.

Digest-origin trees from a derivative vault are refused — mechanically,
before a byte is written, by **both** `grow-trees.mjs` and
`grow-bundle.mjs`; a second entrance to the library is not a second way
around the gate. The rule it quotes
(`docs/forest-format.md`, Copyright — the hard rules):

> A vault of a copyrighted source is `derivative: true`, carries the
> `notice`, **stays local, and never enters the library** — not as a
> vault, not tree-by-tree, not "just the definitions". Re-authoring does
> not launder provenance.

and (`spec/policies/provenance.md`, Banned, regardless of intent):

> Transcriptions or close paraphrases of **textbook, coursebook or
> competition problems** […] This is not caution, it is precedent: the
> MIT-labeled Hendrycks MATH dataset was DMCA'd off Hugging Face in
> January 2025 by AoPS at 95% text similarity.

**The refusal is final.** Do not rephrase the tree, split it, retitle
it, flip its `origin`, or otherwise help the member get a refused tree
past the firewall — a re-authored copyrighted theorem in the CC BY
library is exactly the failure this slice exists to prevent. Relay the
script's Croatian refusal, explain the rule once, and offer the honest
alternative: the member writes their *own* treatment as a new
`origin: member` tree (via `/ask`'s growth path or by hand), and that
tree can grow.

## Stage 1 · PICK — which trees

If the invocation names a vault and trees, verify and move on.
Otherwise interview, and **suggest candidates first**:

- Scan `trees/*.md` frontmatter for `origin: member` or `origin: agent`
  (in a non-derivative vault every tree qualifies, digest trees
  included). Skip trees that already carry `x_library` — they have been
  grown.
- Savladano marks live in the browser's `localStorage`
  (`views/forest.html`), not on disk, so you cannot read them: ask the
  member which of the candidates they have mastered, or have them paste
  the side panel's savladano list. Prefer mastered trees — a member
  should not publish what they have not yet made their own.

Carry the whole unit, not a fragment: a solution travels with its
exercise, a proof with its statement. Trees the candidates depend on
need not come along — stage 3 decides whether each such edge attaches
to something already in the forest or is dropped.

## Stage 2 · MATCH — what does the forest already hold?

Never merge blind. For the candidates, against a `matsek-fer/library`
checkout (clone one into the scratch directory if the member has none;
its `forest/index/` must exist — run `index-vault.mjs` on it if not):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/match-trees.mjs" <vault-dir> <library-checkout>/forest \
  --trees <id>[,<id>…] --k 5
```

Each line reports a candidate's nearest forest trees with raw signals —
`cosine`, `concepts` (jaccard over `teaches`), `title_overlap` — and a
`hint` of `likely-duplicate` / `related` / `novel`.

**The hint is a hint.** Its thresholds were calibrated on one pair whose
answer was known by construction, and the rule that has held since
slice 2 holds here: signals narrow the field, reading decides. Open the
top matches (`<library-checkout>/forest/trees/<id>.md`) and read them
before concluding anything.

## Stage 3 · DECIDE — per candidate, one of four

Tell the member what you found and agree on each:

- **Attach** *(the common case)* — the candidate is new material that
  belongs beside existing trees. Merge it, and record which forest tree
  each of its dangling `depends` edges should point at. An alternative
  proof of a theorem already in the forest sets `proves:` to that
  theorem's tree; a connection depends on both trees it bridges.
- **Skip** — a `likely-duplicate` that reading confirms says the same
  thing no better. Say so plainly; a member who read the existing tree
  and still prefers theirs may argue, and "mine is clearer" is a real
  argument to settle in the PR, not here.
- **Edit** *(rare)* — the existing tree is wrong or incomplete in a way
  a new tree cannot fix. Prepare a minimal diff to that tree's file and
  say in the PR exactly what changed and why. Never rewrite someone's
  tree to taste.
- **Defer** — worth having, but its prerequisites are not in the forest
  yet; growing it now would strand it. Note what would have to exist.

Work out the `--remap` pairs here: for every dependency of a candidate
that is *not* being grown, either a forest tree it should attach to, or
nothing (the edge is dropped, which the script reports).

## Stage 4 · MERGE — the script runs the firewall

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/grow-trees.mjs" <vault-dir> <library-checkout>/forest \
  --trees <id>[,<id>…] --out <scratch>/grown \
  [--remap vaultId=forestId,…] [--prefix <short>] [--attribution "<citation>"]
```

Its first act is the firewall; if it refuses, relay the message and stop
— the refusal is final. On success it writes candidate trees to the
scratch directory (never into the forest: placement waits for the
member's affirmation) with ids de-collided, edges resolved, vault-local
`x_library` stripped, and `adapted_from` stamped when the vault digests
someone else's licensed work — attribution has to travel with the tree.

Read its stderr. Three notes matter: a **dropped depends edge** means a
prerequisite went unattached (revisit stage 3), a **flattened wikilink**
means prose lost a pointer and may need a clause, and an **anchorable
dependencies** note means a proof has several plausible anchors and you
must set `proves:` by hand — the script refuses to guess which theorem
a proof proves, and so should you: ask the member.

Use `--prefix` when a candidate's id is generic enough to collide
conceptually rather than literally (`def-koset` from two different
vaults are two different trees; neither should silently win).

## Stage 5 · POLISH

In the scratch copy, before anyone is asked to affirm anything:

- **Standalone discipline is stricter in the forest than in a vault.**
  A tree there sits among strangers' trees with no chapter around it:
  every "kao što smo vidjeli" must become a link or a restated clause,
  and a flattened wikilink usually needs the missing context spelled
  out in a few words.
- **Set `proves:`** where stage 4 flagged ambiguity, and check that
  every `depends` edge is one the member would defend.
- **Check `teaches`/`requires`** against `concepts/concepts.yaml` — the
  forest's retrieval leans on them harder than a vault's, since they
  are how a stranger's search finds this tree at all.
- **Math must be valid `$…$` KaTeX** — the library's CI renders every
  segment and a failure blocks the PR.

## Stage 6 · ORIGINALITY SCAN — the model's duty, before any interview

The script cannot judge originality; you can, and you must, BEFORE asking
the member to affirm anything:

Stage 2 asked *does the forest already have this?*; this stage asks the
different and harder question *is this the member's to give?*

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-forest.mjs" <vault-dir>`
   first — an origin/`source.pages` contradiction anywhere in the vault
   stops the flow until fixed.
2. Compare each candidate tree against the vault's OWN digest trees
   (titles, then a lexical skim of bodies): a near-match means the
   candidate IS digested content wearing a fresh `origin` — stop, per
   Stage 2's refusal, and tell the member plainly.
3. When `forest.json` names a `source.file` that exists on disk, search it
   for the candidate's key phrases and specific numbers/setting. An
   exercise that mirrors the source with renamed symbols is a close
   paraphrase — `policies/provenance.md` bans it "regardless of intent".
A clean scan is not proof of originality — the member's affirmation and
the maintainer's review remain the human gates — but a dirty scan is
proof of the opposite, and catching it here is cheapest.

## Stage 7 · PROVENANCE INTERVIEW — unskippable

This stage cannot be skipped, shortened to a yes/no in passing, or
inferred from enthusiasm earlier in the conversation — it is the
tool-side half of the enforcement in `spec/policies/provenance.md`, and
the precedent is the submit skill's consent protocol: **the affirmation
refers to final bytes, never to an earlier version.**

1. Establish the true `provenance` value with the member:
   - `original` — the member wrote it themselves. Typically
     `origin: member` trees that were genuinely their own writing.
   - `ai-assisted` — a model drafted any of it, even if heavily edited.
     **Mandatory** for `origin: agent` trees and for member trees the
     model helped draft; there is no talking a model-drafted tree into
     `original`.
   - `adapted` — only with a **named, CC BY-or-freer** source recorded
     in `adapted_from` (mind: math.StackExchange is CC BY-SA —
     incompatible; the vault's source work is not a valid
     `adapted_from` in a derivative vault — that is the firewall again).
   For trees the value is not a frontmatter field but the claim the PR
   makes: record it in the PR description, and note that `origin` on
   each tree must already tell the same story (`agent` and `original`
   cannot both be true).
2. **Show the member the exact final files** — every tree file,
   verbatim, frontmatter included — and ask, verbatim:

   > Potvrđuješ li: (1) ovaj sadržaj je izvorno tvoj — nije prijepis ni
   > bliska parafraza izvornog djela, udžbenika ili natjecateljskog
   > zadatka — i (2) neopozivo ga licenciraš pod CC BY 4.0?

   Only an explicit yes to both proceeds. Hesitation, "mislim da je",
   or a revelation that the content tracks a source closely means stop:
   thank them, do not persuade, leave the scratch files unsubmitted.
3. **Any edit after the affirmation voids it** — your own validator
   fixes and concept-minting touch-ups included. Show the changed file
   again and re-ask the same question before proceeding.

## Stage 8 · CONCEPTS — mint in the same changeset

Every `teaches`/`requires` id must exist in the library's
`concepts/concepts.yaml`. For each missing id, per the library README's
rule ("ako koncept nedostaje, dodaj ga u istom PR-u"): add an entry —
`id`, English `title`, one–two sentence `description`, honest
`requires` edges, optional `msc` — to the checkout's `concepts.yaml`,
then prove the registry still forms a DAG:

```
node <spec-checkout>/validator/bin/matsek-validate.js --registry-only <library-checkout>/concepts/concepts.yaml
```

A cycle means a wrong `requires` edge — fix the edge, never delete a
pre-existing concept.

## Stage 9 · VALIDATE — zero errors

Copy the grown trees into `<library-checkout>/forest/trees/`, add them
to `forest/index.md` in reading order (a `## Iz trezora` section keeps
merged trees legible against the digested ones), then:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-forest.mjs" <library-checkout>/forest \
  --concepts <library-checkout>/concepts/concepts.yaml
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <library-checkout>/forest
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-vault.mjs" <library-checkout>/forest
```

Zero errors, or it does not go. A dangling `depends`, a cycle through an
existing tree, or a proof with no anchor are all merge errors — they
mean stage 3's attachment decisions were wrong, not that the validator
is fussy. Every fix re-triggers stage 7's re-affirmation.

The regenerated `forest/views/` and `forest/index/` belong in the same
commit: they are derived, but the library commits them so the forest
renders and searches without anyone running tooling first.

## Stage 10 · HAND OFF — prepare files, never run git

The changeset is: the new tree files under `forest/trees/`, the
`forest/index.md` edit, the regenerated `forest/views/` and
`forest/index/`, and any `concepts.yaml` addition — together, one
commit.

Then tell the member, in Croatian, exactly how to submit — **you
prepare the files; you never run git or `gh` yourself**:

- **Maintainer (push access):** branch `grow/<slug>` off `main`, commit
  the changeset, open a PR.
- **Member (no push access):** fork `matsek-fer/library`, same
  branch/commit, PR from the fork.
- Either way the PR template asks for a provenance statement — it must
  match what the member affirmed in stage 7, and English is the
  repo-facing language for commit and PR text.
- **Say what the merge did**: which trees are new, which existing trees
  they attach to and how, and — if stage 3 chose *edit* — exactly what
  changed in someone else's tree and why. A reviewer should not have to
  reconstruct the graph surgery from a diff.

## Stage 11 · BACKLINK — the vault remembers

Write into each source tree's frontmatter:

```yaml
x_library: "<forest-tree-id>"
```

so the vault remembers what it seeded (and stage 1 stops re-suggesting
it). Then regenerate the derived artifacts —

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-vault.mjs" <vault-dir>
```

— and close with one reminder: those trees are now on their way to the
CC BY forest, but the vault itself, if derivative, still stays local,
all of it.

## When the member wants it on the website too

The forest is the merge layer; the site still renders bundles
(`problems/ proofs/ blogs/`) and the `problemset` skill searches their
index. A member who wants their problem *visible there as well* can
additionally emit a bundle with `grow-bundle.mjs` (same firewall, same
interview) — and then the bundle is a **presentation view of the
trees**, so record `x_forest_trees: ["<id>", …]` in its manifest and
say so in the PR. Do not do this silently: two copies that can drift
are a cost, and it is the member's call whether visibility is worth
it.
