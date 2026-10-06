---
id: mor-monoid-action
taxon: morphism
title: "Djelovanje grupe kao djelovanje monoida"
kind: generalizes
from: obj-group-action
to: obj-monoid-action
statement: '(G,X,\rho)\mapsto(G,X,\rho),\quad G\ \text{kao monoid}'
label: '\text{kao monoid}'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto(\varphi,f)$: homomorfizam grupa čuva produkt i $e$, pa je i homomorfizam monoida.'
functorial: true
region: strukture
teaches: []
requires: []
depends: [obj-group-action, obj-monoid-action]
standalone: true
language: hr
origin: agent
---

Ništa se ne mijenja u podacima: grupa jest monoid, a aksiomi djelovanja monoida
([[obj-monoid-action]]) upravo su aksiomi iz [[def-group-action]]. Mijenja se
što *smijemo zaključiti*. Svaki argument koji je koristio $g^{-1}$ prestaje
vrijediti za opći monoid: simetričnost dostižnosti (pa orbite više ne
particioniraju skup, [[mor-orbits]]), kraćenje $g\cdot x=g\cdot y\Rightarrow x=y$,
bijektivnost svakog $\hat\rho(g)$ ([[mor-curry]]). Ono što preživi — fiksne
točke ([[mor-fixed-points]]), ekvivarijantna preslikavanja — vrijedi i za
monoide, a teorem dokazan za djelovanja monoida vrijedi i za svako djelovanje
grupe.
