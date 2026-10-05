---
id: prf-orbit-stabilizer
taxon: proof
title: "Dokaz teorema o orbiti i stabilizatoru"
teaches: []
requires: []
depends: [thm-orbit-stabilizer, thm-lagrange, def-coset]
proves: thm-orbit-stabilizer
standalone: true
language: hr
origin: agent
---

Dokazujemo [[thm-orbit-stabilizer]]: za djelovanje grupe $G$ na $X$ i točku
$x\in X$ pravilo $gG_x\mapsto g\cdot x$ bijekcija je $G/G_x\to Gx$, a za konačnu
$G$ vrijedi $|Gx|\cdot|G_x|=|G|$. Ovdje je $G_x=\{g : g\cdot x=x\}$, a $G/G_x$
skup lijevih koseta ([[def-coset]]).

## Dobro definirano i injektivno

Za $g,h\in G$ računamo:

$$g\cdot x=h\cdot x\iff h^{-1}\cdot(g\cdot x)=x\iff (h^{-1}g)\cdot x=x\iff h^{-1}g\in G_x\iff gG_x=hG_x.$$

Smjer „$\Leftarrow$” kaže da vrijednost $g\cdot x$ ne ovisi o izboru
predstavnika koseta, smjer „$\Rightarrow$” da različiti koseti idu u različite
točke.

## Surjektivno

Svaki element orbite po definiciji je oblika $g\cdot x$, slika koseta $gG_x$.

## Prebrojavanje

Bijekcija daje $|Gx|=|G/G_x|=[G:G_x]$. Za konačnu grupu Lagrangeov teorem
([[thm-lagrange]]) kaže $|G|=[G:G_x]\cdot|G_x|$, dakle $|Gx|\cdot|G_x|=|G|$.
$\blacksquare$

Isti račun prolazi i bez Lagrangea: vlakna preslikavanja $g\mapsto g\cdot x$
upravo su koseti $gG_x$, svako s $|G_x|$ elemenata, pa je $|G|=|Gx|\cdot|G_x|$
izravnim prebrojavanjem. Budući da je svaka podgrupa stabilizator u djelovanju
na kosetima ([[mor-coset-action]]), tako ispada i sam Lagrange.
