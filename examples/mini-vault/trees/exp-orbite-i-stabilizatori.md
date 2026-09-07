---
id: exp-orbite-i-stabilizatori
taxon: exposition
title: "Orbite: kako djelovanje particionira skup"
teaches: [orbits-stabilizers]
requires: []
depends: [def-group-action]
standalone: true
---

Neka grupa $G$ djeluje na skupu $X$ (vidi [[def-group-action]]). *Orbita*
točke $x \in X$ skup je svih točaka do kojih djelovanje može doći iz $x$:

$$\mathrm{Orb}(x) = \{g \cdot x : g \in G\}.$$

**Orbite čine particiju skupa $X$.** Relacija "leži u orbiti od" —
$y \sim x$ ako je $y = g \cdot x$ za neki $g \in G$ — relacija je
ekvivalencije, a njezine klase upravo su orbite:

- *Refleksivnost:* $x = e \cdot x$, po aksiomu neutralnog elementa.
- *Simetričnost:* iz $y = g \cdot x$ slijedi
  $g^{-1} \cdot y = g^{-1} \cdot (g \cdot x) = (g^{-1}g) \cdot x = x$ —
  inverz vraća natrag.
- *Tranzitivnost:* iz $y = g \cdot x$ i $z = g' \cdot y$ slijedi
  $z = (g'g) \cdot x$ — kompozicija djelovanja jest djelovanje produkta.

Svaki aksiom grupe pokreće točno jedno svojstvo relacije; to nije
slučajnost nego razlog zašto se particije u teoriji grupa pojavljuju
posvuda.

**Slobodna djelovanja imaju jednakobrojne orbite.** Ako je djelovanje
slobodno (samo $e$ fiksira točke) i $G$ konačna, tada za svaki $x$
preslikavanje $g \mapsto g \cdot x$ bijekcija je $G \to \mathrm{Orb}(x)$:
surjektivno po definiciji orbite, a injektivno jer iz
$g_1 \cdot x = g_2 \cdot x$ slijedi da $g_2^{-1}g_1$ fiksira $x$, pa je
$g_2^{-1}g_1 = e$, tj. $g_1 = g_2$. Dakle svaka orbita ima točno $|G|$
elemenata — činjenica koju dokaz [[prf-lagrange-djelovanje]] pretvara u
Lagrangeov teorem, a veza [[con-slobodna-djelovanja]] u opći princip.
