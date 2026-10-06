---
id: mor-cayley
taxon: morphism
title: "Grupa djeluje na sebi: Cayleyjevo djelovanje"
kind: transform
from: obj-group
to: obj-group-action
statement: 'G\mapsto(G,\ G,\ \lambda),\quad \lambda(g,x)=gx'
label: 'G\curvearrowright G'
acts_on: all
needs: []
on_homomorphisms: '$\varphi\colon G\to H$ ide u par $(\varphi,\varphi)$: uvjet $\varphi(gx)=\varphi(g)\varphi(x)$ upravo je homomorfnost.'
functorial: true
generalized_by: [mor-coset-action]
region: strukture
teaches: [group-actions]
requires: []
depends: [obj-group, obj-group-action, def-group-action]
standalone: true
language: hr
origin: agent
---

Lijevo množenje $g\cdot x=gx$ jest djelovanje ([[def-group-action]]): $ex=x$ i
$g(hx)=(gh)x$ aksiomi su grupe. Djelovanje je *slobodno* i ima *jednu orbitu*
— iz $gx=x$ kraćenjem slijedi $g=e$, a iz $x$ se do $y$ stiže s $g=yx^{-1}$ —
pa su svi stabilizatori trivijalni ([[mor-stabilizer]]) i $X/G$ je jednočlan
([[mor-orbits]]).

Curryjevanjem ([[mor-curry]]) dobije se **Cayleyjev teorem**:
$\hat\lambda\colon G\to\mathrm{Sym}(G)$ injektivan je, jer
$\hat\lambda(g)=\mathrm{id}$ znači $gx=x$ za sve $x$, pa $g=e$; svaka je grupa
dakle izomorfna nekoj grupi permutacija. Ovo je slučaj $H=\{e\}$ djelovanja
na kosetima ([[mor-coset-action]]): $G/\{e\}$ je $G$ sam.
