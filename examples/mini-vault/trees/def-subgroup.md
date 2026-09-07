---
id: def-subgroup
taxon: definition
title: "Podgrupa"
teaches: [subgroups]
requires: []
depends: [def-group]
standalone: true
---

**Definicija.** Neka je $G$ grupa (vidi [[def-group]]). Podskup
$H \subseteq G$ je *podgrupa*, u oznaci $H \le G$, ako je i sam grupa uz
operaciju naslijeđenu iz $G$. Ekvivalentno, $H$ je podgrupa ako:

1. $e \in H$ (sadrži neutralni element),
2. $a, b \in H \implies ab \in H$ (zatvorenost na množenje),
3. $a \in H \implies a^{-1} \in H$ (zatvorenost na inverze).

Ta tri uvjeta točno su ono što dokazi o podgrupama troše: svaki od njih
pokreće po jedno svojstvo relacije iz dokaza [[prf-lagrange-particija]].

Primjeri: $\{e\}$ i cijeli $G$ uvijek su podgrupe; parni brojevi u
$(\mathbb{Z}, +)$; skup $\{0, 3\}$ u $(\mathbb{Z}_6, +)$.
