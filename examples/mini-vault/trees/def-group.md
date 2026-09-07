---
id: def-group
taxon: definition
title: "Grupa"
teaches: [groups]
requires: [sets, functions]
depends: []
standalone: true
---

**Definicija.** *Grupa* je par $(G, \cdot)$ skupa $G$ i binarne operacije
$\cdot : G \times G \to G$ za koje vrijedi:

1. *Asocijativnost:* $(a \cdot b) \cdot c = a \cdot (b \cdot c)$ za sve
   $a, b, c \in G$.
2. *Neutralni element:* postoji $e \in G$ takav da je
   $e \cdot a = a \cdot e = a$ za svaki $a \in G$.
3. *Inverzi:* za svaki $a \in G$ postoji $a^{-1} \in G$ takav da je
   $a \cdot a^{-1} = a^{-1} \cdot a = e$.

Operaciju obično pišemo kao množenje, $ab$ umjesto $a \cdot b$. Grupa je
*konačna* ako je skup $G$ konačan; broj elemenata $|G|$ zovemo **red
grupe**. **Red elementa** $a \in G$ najmanji je prirodni broj $n$ takav da
je $a^n = e$ (u konačnoj grupi takav $n$ uvijek postoji, jer se potencije
$a, a^2, a^3, \dots$ moraju početi ponavljati).

Primjeri: cijeli brojevi $(\mathbb{Z}, +)$ s neutralnim $0$; ostatci
$(\mathbb{Z}_n, +)$; permutacije skupa uz kompoziciju.
