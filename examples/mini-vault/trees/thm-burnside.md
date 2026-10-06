---
id: thm-burnside
taxon: theorem
title: "Burnsideova lema"
about: [mor-orbit-count, mor-fixed-points]
fields: [kombinatorika]
teaches: [orbits-stabilizers]
requires: []
depends: [mor-orbit-count, mor-fixed-points, thm-orbit-stabilizer]
standalone: true
language: hr
origin: agent
---

**Lema (Burnside).** Neka konačna grupa $G$ djeluje na konačnom skupu $X$ i
neka je $\mathrm{Fix}(g)=\{x\in X : g\cdot x=x\}$ skup točaka koje $g$
fiksira. Tada je broj orbita ([[mor-orbit-count]])

$$|X/G|=\frac{1}{|G|}\sum_{g\in G}|\mathrm{Fix}(g)|$$

— prosječan broj fiksnih točaka elementa grupe.

Zbrajaju se fiksne točke *pojedinih elemenata*, ne fiksne točke cijele grupe:
$\mathrm{Fix}(g)$ je $X^{\langle g\rangle}$, skup fiksnih točaka
([[mor-fixed-points]]) djelovanja podgrupe $\langle g\rangle$, dok je
$X^G=\bigcap_{g}\mathrm{Fix}(g)$ općenito mnogo manji od svakog pribrojnika.
Dokaz dvostrukim prebrojavanjem parova $(g,x)$ s $g\cdot x=x$, uz
[[thm-orbit-stabilizer]]: [[prf-burnside]]. Tipična primjena je brojanje
ogrlica — $14$ ogrlica od šest perli u dvije boje ([[obj-ogrlice-z6]]). Lema
nije Burnsideova (poznavali su je Cauchy i Frobenius), ali ime je ostalo.
