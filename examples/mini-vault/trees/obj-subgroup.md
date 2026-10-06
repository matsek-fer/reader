---
id: obj-subgroup
taxon: object
title: "Podgrupa"
symbol: 'H \le G'
hom: 'Homomorfizam $\varphi\colon G_1\to G_2$ s $\varphi(H_1)\subseteq H_2$: podgrupa $H_1$ u $G_1$ nosi se u podgrupu $H_2$ u $G_2$.'
data: [obj-subgroup-as-group, obj-ambient-group, mor-inclusion]
region: strukture
pos: [320, 280]
teaches: [subgroups]
requires: []
depends: [def-subgroup, obj-group, obj-subgroup-as-group, obj-ambient-group, mor-inclusion]
standalone: true
language: hr
origin: agent
---

## Ideja
Podgrupa je grupa unutar grupe, i vrsta je *cijeli taj smještaj*, ne sam $H$:
ista grupa $\mathbb{Z}_2$ podgrupa je i od $\mathbb{Z}_6$ i od $D_4$, a to su
različite strukture, jer se $G$ oko njih razlikuje.

## Definicija
Podskup $H\subseteq G$ koji sadrži $e$ i zatvoren je na produkt i inverz;
točan iskaz je [[def-subgroup]].

## Podaci
Dijagram nad instancama vrste [[obj-group]]: grupa za sebe
([[obj-subgroup-as-group]]), okolna grupa ([[obj-ambient-group]]) i
inkluzija [[mor-inclusion]] među njima. Operacija na $H$ nije novi podatak —
naslijeđena je, i upravo zato je inkluzija homomorfizam.

## Svojstva
$H$ dijeli $G$ na kosete $gH$ ([[def-coset]]), kojih je $[G:H]$
([[def-index]]); za konačnu grupu $|G|=[G:H]\,|H|$ ([[thm-lagrange]]).
Podgrupa je *normalna* kad je $gHg^{-1}=H$ za svaki $g\in G$; općenito nije.

## Primjeri
$\{0,3\}\le\mathbb{Z}_6$ ([[obj-podgrupa-z6]], izračunato u
[[exm-koseti-u-z6]]); stabilizator točke u bilo kojem djelovanju
([[mor-stabilizer]]); jezgra homomorfizma.

## Povezano
Iz podgrupe se gradi djelovanje $G$ na kosetima $G/H$ ([[mor-coset-action]]);
svaki stabilizator je podgrupa ([[mor-stabilizer]]), a svaka podgrupa je
stabilizator koseta $eH$ u tom djelovanju.
