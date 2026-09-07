---
id: def-group-action
taxon: definition
title: "Djelovanje grupe"
teaches: [group-actions]
requires: []
depends: [def-group]
standalone: true
---

**Definicija.** Neka je $G$ grupa (vidi [[def-group]]) i $X$ skup.
*Djelovanje* grupe $G$ na skupu $X$ funkcija je
$G \times X \to X$, pisana $(g, x) \mapsto g \cdot x$, koja poštuje
strukturu grupe:

1. $e \cdot x = x$ za svaki $x \in X$ (neutralni element ne radi ništa),
2. $g_1 \cdot (g_2 \cdot x) = (g_1 g_2) \cdot x$ za sve
   $g_1, g_2 \in G$, $x \in X$ (kompozicija djelovanja jest djelovanje
   produkta).

Djelovanje je **slobodno** ako nijedan element osim neutralnog ne
fiksira nijednu točku: iz $g \cdot x = x$ slijedi $g = e$.

Primjeri: grupa rotacija kvadrata djeluje na njegova četiri vrha; svaka
grupa djeluje na samoj sebi lijevim množenjem, $g \cdot x = gx$. Oprez
kod formula s množenjem zdesna: da bi $h \cdot g = gh^{-1}$ bilo
(lijevo) djelovanje, inverz je nužan — bez njega aksiom 2 ispadne u
krivom redoslijedu. Upravo to djelovanje nosi dokaz
[[prf-lagrange-djelovanje]].
