---
id: def-coset
taxon: definition
title: "Koset"
teaches: [cosets]
requires: []
depends: [def-subgroup]
standalone: true
---

**Definicija.** Neka je $G$ grupa i $H \le G$ podgrupa (vidi
[[def-subgroup]]). Za $g \in G$, *lijevi koset* od $H$ određen elementom
$g$ skup je

$$gH = \{gh : h \in H\},$$

dakle "kopija" podgrupe $H$ pomaknuta množenjem s $g$ slijeva. Analogno je
$Hg = \{hg : h \in H\}$ *desni koset*.

Dvije činjenice vrijedi zapamtiti odmah:

- Koset $eH = H$ jest sama podgrupa, ali ostali koseti **nisu** podgrupe —
  ne sadrže neutralni element.
- Različiti elementi mogu odrediti isti koset: $gH = g'H$ čim je
  $g^{-1}g' \in H$. Koset je skup, ne par $(g, H)$.

Koseti nisu tek notacija: oni čine particiju grupe, a to je srce teorema
[[thm-lagrange]]. Konkretan izračun: [[exm-koseti-u-z6]].
