---
id: prf-burnside
taxon: proof
title: "Dokaz Burnsideove leme"
teaches: []
requires: []
depends: [thm-burnside, thm-orbit-stabilizer, mor-stabilizer]
proves: thm-burnside
standalone: true
language: hr
origin: agent
---

Dokazujemo [[thm-burnside]]: za konačnu grupu $G$ koja djeluje na konačnom
skupu $X$ vrijedi $|X/G|=\frac1{|G|}\sum_{g\in G}|\mathrm{Fix}(g)|$, gdje je
$\mathrm{Fix}(g)=\{x : g\cdot x=x\}$. Ideja: prebrojati skup

$$S=\{(g,x)\in G\times X : g\cdot x=x\}$$

na dva načina.

## Po elementima grupe

Za fiksiran $g$ parova je $|\mathrm{Fix}(g)|$, pa je
$|S|=\sum_{g\in G}|\mathrm{Fix}(g)|$.

## Po točkama skupa

Za fiksiran $x$ parova je $|G_x|$, red stabilizatora ([[mor-stabilizer]]), pa
je $|S|=\sum_{x\in X}|G_x|$. Teorem o orbiti i stabilizatoru
([[thm-orbit-stabilizer]]) daje $|G_x|=|G|/|Gx|$, dakle

$$|S|=\sum_{x\in X}\frac{|G|}{|Gx|}=|G|\sum_{x\in X}\frac{1}{|Gx|}.$$

Grupiramo pribrojnike po orbitama: svaka orbita $O$ pridonosi
$\sum_{x\in O}\frac{1}{|O|}=|O|\cdot\frac{1}{|O|}=1$, pa je unutarnja suma točno
broj orbita i $|S|=|G|\cdot|X/G|$.

## Zaključak

Izjednačavanjem dvaju prebrojavanja, $|G|\cdot|X/G|=\sum_{g\in G}|\mathrm{Fix}(g)|$,
što je tvrdnja. $\blacksquare$
