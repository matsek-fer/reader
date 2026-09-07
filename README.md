# reader — the MatSek Knowledge Forest

Ovdje raste **Šuma znanja** Matematičke sekcije: alat koji knjigu, članak
ili bilješke *probavi* u šumu malih, samostalno čitljivih objekata —
definicija, teorema, dokaza, primjera — povezanih grafom preduvjeta.
Umjesto da knjigu čitaš od korice do korice, šumom hodaš onim redom koji
tvoji preduvjeti dopuštaju; tutor istim stablima zna postaviti pitanje.
Probavi → uči → uzgajaj.

In English: this repo is the home of the Knowledge Forest — the pipeline
that digests a work into a **vault** of addressable teaching objects
(**trees**), stores it locally, and lets a reader or tutor walk the
dependency DAG instead of the page order. The earlier "standalone paper
reader" idea grew into this; selecting-and-asking over a source becomes
one step of digestion rather than the product.

## The pieces

| Piece | What it is | Status |
|---|---|---|
| Vault format | The on-disk contract: `forest.json`, `trees/`, `index.md`, `views/` — [docs/forest-format.md](docs/forest-format.md) | **Draft 0.1, normative** |
| Reference vault | A real CC BY vault built from the library's Lagrange material — [examples/mini-vault/](examples/mini-vault/) | **Done, 12 trees** |
| Digester | The skill that turns a source into a vault (slice 1) | In progress |
| Forest reader | Walks vaults by prerequisite instead of page order | Planned |
| Tutor integration | Probe a statement, withhold its proof, ask for it | Planned |
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
djelo, ne šalje se u knjižnicu"*, and **stays on your machine — it never
enters the library**, whole or in parts. Openly-licensed sources record
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
