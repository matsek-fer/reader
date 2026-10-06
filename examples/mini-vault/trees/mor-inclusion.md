---
id: mor-inclusion
taxon: morphism
title: "Inkluzija podgrupe"
kind: hom
from: obj-subgroup-as-group
to: obj-ambient-group
statement: '\iota\colon H\to G,\quad \iota(h)=h'
label: '\iota'
needs: []
region: definicije
teaches: []
requires: []
depends: [obj-subgroup-as-group, obj-ambient-group, def-subgroup]
standalone: true
language: hr
origin: agent
---

Preslikavanje koje element podgrupe ([[obj-subgroup-as-group]]) gleda kao
element okolne grupe ([[obj-ambient-group]]). Homomorfizam je jer je
operacija na $H$ po definiciji suženje operacije na $G$ ([[def-subgroup]]);
injektivan je jer ništa ne mijenja.

Ključa `invertible` nema: $\iota$ je izomorfizam točno kad je $H=G$, a opća
podgrupa to nije, pa bi tvrdnja u bilo koju stranu bila pretvrda.

Obje su instance iste vrste ([[obj-group]]), pa je ovo preslikavanje
morfizam u njoj — i, zajedno s njima, definicijski dijagram vrste
[[obj-subgroup]].
