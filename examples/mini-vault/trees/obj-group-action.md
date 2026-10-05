---
id: obj-group-action
taxon: object
title: "Djelovanje grupe na skupu"
symbol: '(G, X, \rho)'
hom: 'Par $(\varphi, f)$: $\varphi\colon G\to H$ homomorfizam, $f\colon X\to Y$, uz $f(g\cdot x)=\varphi(g)\cdot f(x)$; za $G=H$ i $\varphi=\mathrm{id}$ to su ekvivarijantna preslikavanja, i na njima se sudi je li strelica iz ovog objekta funktorijalna.'
teaches: [group-actions]
requires: [functions]
depends: [def-group-action, obj-group, obj-set]
standalone: true
language: hr
origin: agent
---

## Ideja
Grupa je stroj simetrija; djelovanje kaže *na čemu* te simetrije rade. Svaki
$g$ postaje preslikavanje $X\to X$, a množenje u $G$ odgovara slaganju tih
preslikavanja, pa svaki $g$ djeluje bijekcijom — $g^{-1}$ ga poništava.

## Definicija
Preslikavanje $\rho\colon G\times X\to X$, $(g,x)\mapsto g\cdot x$, uz
$e\cdot x=x$ i $g\cdot(h\cdot x)=(gh)\cdot x$; točan iskaz je
[[def-group-action]].

## Podaci
Grupa $G$ ([[mor-action-group]]), skup $X$ ([[mor-action-set]]) i pravilo
$\rho$. Isti podaci drugim riječima: homomorfizam
$\hat\rho\colon G\to\mathrm{Sym}(X)$ ([[mor-curry]]).

## Svojstva
Orbite particioniraju $X$ ([[mor-orbits]]); koliko ih je, [[mor-orbit-count]];
što sve simetrije ostavljaju na miru, [[mor-fixed-points]]; stabilizator točke
je podgrupa ([[mor-stabilizer]]) i $|Gx|\cdot|G_x|=|G|$
([[thm-orbit-stabilizer]]). Preslikavanja među djelovanjima:
[[con-ekvivarijantna-preslikavanja]].

## Primjeri
Rotacije ogrlice ([[mor-ogrlice-z6]]); $G$ na sebi lijevim množenjem
([[mor-cayley]]); $G$ na kosetima podgrupe ([[mor-coset-action]]).

## Povezano
Poopćenje: [[mor-monoid-action]]. Konstrukcija: [[mor-g-sets]]. Specijalan
slučaj slobodnih djelovanja: [[con-slobodna-djelovanja]].
