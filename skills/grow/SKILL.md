---
name: grow
description: Grow a member's own vault trees into a CC BY library bundle — firewall check, mechanical skeleton, polish, provenance interview, validation, PR hand-off. Use when a member wants to contribute a tree to the library ("uzgoji ovo u bundle", "pošalji u knjižnicu", "ovo stablo bi bilo dobro za library", "pretvori moje stablo u zadatak/dokaz/blog") or asks what from their vault could be published.
---

# Grow — a tree leaves the vault

You are the growth half of the MatSek Knowledge Forest: a member has
material in a vault that deserves to become a public library bundle
(problem, proof or blog under CC BY 4.0), and you shepherd it out —
through the provenance firewall, never around it. The mechanical
conversion is `scripts/grow-bundle.mjs`; your job is everything the
script cannot do: choosing well, polishing honestly, and running the
provenance interview that the library's legal footing rests on.

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

Digest-origin trees from a derivative vault are refused — by the script,
mechanically, before a byte is written. The rule it quotes
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

## Stage 1 · PICK — trees and type

If the invocation names a vault, trees and `--type`, verify and move on.
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

Then agree on the bundle type and its trees:

- **problem** — the statement tree (`exr-`/`exm-` or a formal statement
  taxon) plus its solution/proof tree; statement first.
- **proof** — the statement tree plus the proof tree.
- **blog** — a cluster of exposition/connection trees, in reading order;
  each becomes one section.

Agree on a kebab-case slug (it becomes the bundle id
`<type>/<slug>`), and, for problem/proof, discuss difficulty honestly:
1 is a warm-up any member can do, 5 the hardest thing the library asks
of anyone. Anchor the guess in what the member needed to solve it, not
in politeness.

## Stage 2 · CONVERT — the script runs the firewall

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/grow-bundle.mjs" <vault-dir> <tree-id> [<tree-id>…] \
  --type problem|proof|blog --out <scratch>/<slug> \
  --created <today YYYY-MM-DD> [--difficulty 1-5]
```

The script's first act is the firewall; if it refuses, relay its message
and stop — see above, the refusal is final. On success it emits a
**skeleton**: content files with vault-local `[[wikilinks]]` resolved to
italic plain text, `annotation-DRAFT.md`, and a `manifest.json` whose
`author` is a TODO and whose `provenance` is an `ai-assisted`
*placeholder* the interview must confirm or change. Capture stderr: the
`dropped … link` notes tell you where prose lost a link and may now need
a clause of context.

## Stage 3 · POLISH

The skeleton is not a bundle yet. In the scratch copy:

- **Write `annotation.md`** (English) from `annotation-DRAFT.md`, then
  delete the draft. Per `spec/bundles.md` it is retrieval text: name
  what the item teaches or tests, the techniques, the **abstract
  principle it instantiates**, and the common failure modes. Write for
  the retriever, not the member; it is never shown as content.
- **Proofread the Croatian** content files: the standalone discipline
  still applies (no "kao što smo vidjeli gore"), dropped links may need
  an added clause, math must be valid `$…$` KaTeX.
- **Set `author`** to `"Ime Prezime <github-handle>"` — ask the member.
- **Check `teaches`/`requires`/`difficulty`** with the member — the
  script unioned them from the trees; the bundle may warrant different.

## Stage 3½ · DUPLICATE SCAN — the model's duty, before any interview

The script cannot judge originality; you can, and you must, BEFORE asking
the member to affirm anything:

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

## Stage 4 · PROVENANCE INTERVIEW — unskippable

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
   Set the value in `manifest.json`; the script's placeholder is not a
   finished claim.
2. **Show the member the exact final files** — `manifest.json` and every
   Markdown file, verbatim — and ask, verbatim:

   > Potvrđuješ li: (1) ovaj sadržaj je izvorno tvoj — nije prijepis ni
   > bliska parafraza izvornog djela, udžbenika ili natjecateljskog
   > zadatka — i (2) neopozivo ga licenciraš pod CC BY 4.0?

   Only an explicit yes to both proceeds. Hesitation, "mislim da je",
   or a revelation that the content tracks a source closely means stop:
   thank them, do not persuade, leave the scratch files unsubmitted.
3. **Any edit after the affirmation voids it** — your own validator
   fixes and concept-minting touch-ups included. Show the changed file
   again and re-ask the same question before proceeding.

## Stage 5 · CONCEPTS — mint in the same changeset

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

## Stage 6 · VALIDATE — zero errors

```
node <spec-checkout>/validator/bin/matsek-validate.js <bundle-dir> \
  --concepts <library-checkout>/concepts/concepts.yaml
```

(Run `npm ci` in `spec/validator` first if needed.) Fix and re-validate
until there are zero errors — never hand the member a bundle that
fails. Every fix re-triggers stage 4's re-affirmation.

## Stage 7 · HAND OFF — prepare files, never run git

Place the bundle in the member's `matsek-fer/library` checkout (ask for
its path; clone into the scratch directory if they have none). Repo
folders are **plural**: `problems/<slug>/`, `proofs/<slug>/`,
`blogs/<slug>/` — the bundle folder plus the `concepts.yaml` edit are
one changeset.

Then tell the member, in Croatian, exactly how to submit — **you
prepare the files; you never run git or `gh` yourself**:

- **Maintainer (push access):** branch `grow/<slug>` off `main`, commit
  the bundle folder and `concepts.yaml` together, open a PR.
- **Member (no push access):** fork `matsek-fer/library`, same
  branch/commit, PR from the fork.
- Either way the PR template asks for a provenance statement — it must
  match the manifest's `provenance` value, and English is the
  repo-facing language for commit and PR text.

## Stage 8 · BACKLINK — the vault remembers

Write into each source tree's frontmatter:

```yaml
x_library: "<type>/<slug>"
```

so the vault remembers what it seeded (and stage 1 stops re-suggesting
it). Then regenerate the derived artifacts —

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/index-vault.mjs" <vault-dir>
```

— and close with one reminder: the bundle is now on its way to the CC BY
library, but the vault itself, if derivative, still stays local, all of
it.
