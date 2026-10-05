---
id: mor-orbit-count
taxon: morphism
title: "Broj orbita"
kind: property
from: obj-group-action
to: obj-nat
statement: '(G,X,\rho)\mapsto |X/G|\in\mathbb{N}'
label: '|X/G|'
acts_on: all
needs: ['$X$ konačan']
on_homomorphisms: 'Ekvivarijantno $f\colon X\to Y$ inducira $X/G\to Y/G$, surjektivno kad je $f$ surjektivno i injektivno kad je $f$ injektivno; općenito ne čuva ni $\le$ ni $\ge$, pa brojanje nije funktor.'
functorial: false
teaches: [orbits-stabilizers]
requires: []
depends: [mor-orbits]
standalone: true
language: hr
origin: agent
---

Broj klasa particije $X$ na orbite ([[mor-orbits]]); konačan čim je $X$
konačan, jer orbita ima najviše koliko i točaka. Ovo je pravo *mjerenje*: od
cijelog djelovanja ostaje jedan prirodni broj ([[obj-nat]]), i različita
djelovanja mogu dati isti broj.

Računa se bez popisivanja orbita, prebrojavanjem fiksnih točaka pojedinih
elemenata — Burnsideova lema [[thm-burnside]]:
$|X/G|=\frac1{|G|}\sum_{g\in G}|\mathrm{Fix}(g)|$ kad je i $G$ konačna. Za
ogrlice od šest perli u dvije boje izlazi $14$ ([[mor-ogrlice-z6]]).
