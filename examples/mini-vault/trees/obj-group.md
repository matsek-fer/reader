---
id: obj-group
taxon: object
title: "Grupa"
symbol: '(G, \cdot)'
hom: 'Homomorfizam $\varphi\colon G\to H$, $\varphi(gh)=\varphi(g)\varphi(h)$; iz toga automatski $\varphi(e)=e$ i $\varphi(g^{-1})=\varphi(g)^{-1}$.'
teaches: [groups]
requires: []
depends: [def-group]
standalone: true
language: hr
origin: agent
---

## Ideja
Grupa je skup simetrija koje se mogu slagati i poništavati. Kao objekt u
strukturnom grafu ona je *izvor*: iz nje se gradi djelovanje na njoj samoj, a
djelovanje na bilo kojem skupu ima grupu kao jedan od svojih podataka.

## Definicija
Skup $G$ s asocijativnom operacijom, neutralnim elementom $e$ i inverzom
$g^{-1}$ za svaki $g$; točan iskaz je [[def-group]].

## Podaci
Nosivi skup $G$ i operacija $G\times G\to G$. Neutralni element i inverzi nisu
dodatni podaci — jednoznačno ih određuje operacija.

## Svojstva
Kraćenje: $gx=gy$ povlači $x=y$. Konačna grupa ima red $|G|$, a svaka njezina
podgrupa red koji dijeli $|G|$ ([[thm-lagrange]]).

## Primjeri
$(\mathbb{Z}_6,+)$; permutacije skupa $X$ uz kompoziciju, $\mathrm{Sym}(X)$;
rotacije i zrcaljenja kvadrata, $D_4$.

## Povezano
Podskup koji je i sam grupa: [[obj-subgroup]]. Grupa koja miče skup:
[[obj-group-action]]; svaka grupa miče samu sebe ([[mor-cayley]]). Bez
inverza ostaje monoid ([[obj-monoid-action]]).
