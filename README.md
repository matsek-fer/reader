# reader — the MatSek Knowledge Forest

This is where the Mathematics Section's **Knowledge Forest** grows: a tool
that *digests* a book, a paper or lecture notes into a forest of small,
independently readable objects — definitions, theorems, proofs, examples —
linked by a graph of prerequisites. Instead of reading a book cover to
cover, you walk the forest in whatever order your prerequisites allow, and
the tutor can ask you about the same trees. Digest → learn → grow.

Concretely, this repo is the home of the pipeline that digests a work into
a **vault** of addressable teaching objects (**trees**), stores it locally,
and lets a reader or tutor walk the dependency DAG instead of the page
order. The earlier "standalone paper reader" idea grew into this;
selecting-and-asking over a source becomes one step of digestion rather
than the product. The member-facing guide to the whole toolset is on the
[organisation profile](https://github.com/matsek-fer).

## The pieces

| Piece | What it is | Status |
|---|---|---|
| Vault format | The on-disk contract: `forest.json`, `trees/`, `index.md`, `views/` — [docs/forest-format.md](docs/forest-format.md) | **Draft 0.1, normative** |
| Reference vault | A real CC BY vault built from the library's Lagrange material — [examples/mini-vault/](examples/mini-vault/) | **Done, 12 trees** |
| Digester | The skill that turns a source into a vault — [skills/digest/](skills/digest/SKILL.md) (slice 1) | **Done** |
| Vault search | Hybrid retrieval over a vault's trees — `scripts/index-vault.mjs` writes `index/` per the library's D-003 embedding convention, `scripts/search-vault.mjs` fuses lexical + semantic (slice 2) | **Done** |
| Ask skill | A studying member's question, answered from the vault first with clickable tree ids — [skills/ask/](skills/ask/SKILL.md) (slice 2) | **Done** |
| Grow skill | A member's own trees become library bundles, through the provenance firewall — `scripts/grow-bundle.mjs` + [skills/grow/](skills/grow/SKILL.md) (slice 3) | **Done** |
| Forest view | `views/forest.html` — an interactive map of the vault with readiness states, built by `scripts/build-views.mjs`; a custom highlight-and-ask UI (slice 4) | **View done**, UI planned |
| Tutor integration | `/tutor` sessions live inside the vault (`sessions/`); the view's self-check prompt hands a tree to the tutor | **Done** |
| Spec promotion | Format hardened into the `spec` repo once stable | When the Forest stabilizes |

Obsidian is the interim UI — every vault renders there by construction
(wikilinks, mermaid, `$` math), so the Forest is usable before any reader
tool exists.

## Quickstart (Obsidian)

1. Open Obsidian → *Open folder as vault* → pick
   `examples/mini-vault/`.
2. Start at `index.md` — the work's map. Click through
   `thm-lagrange` and fold its two proofs open or shut.
3. `views/dag.md` draws the dependency graph (enable default Mermaid
   rendering, which is on out of the box); `views/by-concept.md` inverts
   the vault through the concept registry.

No plugins required; math uses Obsidian's built-in `$…$` rendering.

## Copyright, up front

A vault digested from a copyrighted book is a **derivative work**: it is
marked `derivative: true`, carries the notice *"LOKALNO — izvedeno
djelo, ne šalje se u knjižnicu"*, and **stays on your machine — its digested content never
enters the library**, whole or in parts. The one door out is growth:
a tree the member (or an agent, for them) authored *inside* the vault —
`origin: member`/`agent` — may become a library bundle via `/grow`,
after a provenance interview affirming it is genuinely original. Openly-licensed sources record
their license; GFDL/CC BY-SA material (Wikipedia, math.StackExchange) is
still barred from the library because share-alike is incompatible with
its CC BY license. Only CC BY-or-freer material — like the reference
vault here — may ever flow back into library bundles. The full rules:
[docs/forest-format.md](docs/forest-format.md#copyright--the-hard-rules).

## Relation to the rest of the ecosystem

- **`spec`** — bundle format v1 governs library artifacts; vaults are a
  new, local-first artifact family defined here until promotion.
- **`library`** — supplies the concept registry every tree's
  `teaches`/`requires` resolves against, and the CC BY content the
  reference vault is built from.
- **`blog-writer`** — its forest-readiness convention
  (`docs/forest-readiness.md`) pioneered the standalone discipline and
  the soft taxa; the vault format imports both, with credit, and
  supersedes the `x_forest` bridge for vaults.
