---
id: obj-subgroup
taxon: object
title: "Podgrupa"
symbol: 'H \le G'
hom: 'Homomorfizam $\varphi\colon G_1\to G_2$ s $\varphi(H_1)\subseteq H_2$: par $(H_1\le G_1)$ nosi se u par $(H_2\le G_2)$.'
teaches: [subgroups]
requires: []
depends: [def-subgroup, obj-group]
standalone: true
language: hr
origin: agent
---

## Ideja
Podgrupa je grupa unutar grupe. Kao objekt ona je *par* $(H\le G)$, ne sam $H$:
ista grupa $\mathbb{Z}_2$ podgrupa je i od $\mathbb{Z}_6$ i od $D_4$, a to su
različiti objekti, jer se $G$ oko njih razlikuje.

## Definicija
Podskup $H\subseteq G$ koji sadrži $e$ i zatvoren je na produkt i inverz;
točan iskaz je [[def-subgroup]].

## Podaci
Grupa $G$ i podskup $H$. Operacija na $H$ nije novi podatak — naslijeđena je.

## Svojstva
$H$ dijeli $G$ na kosete $gH$ ([[def-coset]]), kojih je $[G:H]$
([[def-index]]); za konačnu grupu $|G|=[G:H]\,|H|$ ([[thm-lagrange]]).
Podgrupa je *normalna* kad je $gHg^{-1}=H$ za svaki $g\in G$; općenito nije.

## Primjeri
$\{0,3\}\le\mathbb{Z}_6$ ([[exm-koseti-u-z6]]); stabilizator točke u bilo kojem
djelovanju ([[mor-stabilizer]]); jezgra homomorfizma.

## Povezano
Iz podgrupe se gradi djelovanje $G$ na kosetima $G/H$ ([[mor-coset-action]]);
svaki stabilizator je podgrupa ([[mor-stabilizer]]), a svaka podgrupa je
stabilizator koseta $eH$ u tom djelovanju.
