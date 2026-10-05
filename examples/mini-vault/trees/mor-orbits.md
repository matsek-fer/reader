---
id: mor-orbits
taxon: morphism
title: "Skup orbita"
kind: extract
from: obj-group-action
to: obj-set
statement: '(G,X,\rho)\mapsto X/G=\{\,Gx : x\in X\,\},\quad Gx=\{g\cdot x : g\in G\}'
label: 'X/G'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto(Gx\mapsto Hf(x))$; dobro definirano jer $f(g\cdot x)=\varphi(g)\cdot f(x)\in Hf(x)$.'
functorial: true
teaches: [orbits-stabilizers]
requires: []
depends: [obj-group-action, exp-orbite-i-stabilizatori]
standalone: true
language: hr
origin: agent
---

Relacija „$y=g\cdot x$ za neki $g\in G$” relacija je ekvivalencije — po jedan
aksiom djelovanja za svako od tri svojstva ([[exp-orbite-i-stabilizatori]]) —
pa orbite $Gx=\{g\cdot x : g\in G\}$ čine particiju skupa $X$, a $X/G$ je skup
klasa. Strelica zaboravlja *kako* $G$ miče točke i pamti samo *koje su
dostižne jedna iz druge*. Koliko orbita ima računa [[thm-burnside]]; kolika je
jedna, [[thm-orbit-stabilizer]]. Za $\mathbb{Z}_6$ na nizovima perli orbite su
ogrlice, njih $14$ ([[mor-ogrlice-z6]]); za Cayleyjevo djelovanje $G$ na sebi
orbita je jedna ([[mor-cayley]]). U kategoriji $G$-skupova $X/G$ je kolimes
([[obj-g-sets]]).
