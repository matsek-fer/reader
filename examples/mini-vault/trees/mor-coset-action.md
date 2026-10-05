---
id: mor-coset-action
taxon: morphism
title: "Djelovanje na kosetima"
kind: transform
from: obj-subgroup
to: obj-group-action
statement: '(H\le G)\mapsto(G,\ G/H,\ g\cdot xH=gxH)'
label: 'G\curvearrowright G/H'
acts_on: all
needs: []
on_homomorphisms: '$\varphi\colon G_1\to G_2$ s $\varphi(H_1)\subseteq H_2$ ide u $(\varphi,\ xH_1\mapsto\varphi(x)H_2)$; dobro definirano jer iz $x^{-1}y\in H_1$ slijedi $\varphi(x)^{-1}\varphi(y)\in H_2$.'
functorial: true
teaches: [action-on-cosets]
requires: []
depends: [obj-subgroup, def-coset, obj-group-action]
standalone: true
language: hr
origin: agent
---

$G/H$ je skup lijevih koseta $xH$ ([[def-coset]]). Pravilo $g\cdot xH=gxH$ dobro
je definirano: ako je $xH=yH$, tj. $x^{-1}y\in H$, onda je i
$(gx)^{-1}(gy)=x^{-1}y\in H$, pa $gxH=gyH$. Aksiomi djelovanja aksiomi su grupe.

Djelovanje ima jednu orbitu (iz $eH$ se do $xH$ stiže s $g=x$), a stabilizator
koseta $xH$ je $xHx^{-1}$ ([[mor-stabilizer]]): $gxH=xH$ točno kad
$x^{-1}gx\in H$. Posebno je stabilizator od $eH$ sama podgrupa $H$ — svaka
podgrupa je stabilizator. Jezgra pripadne reprezentacije ([[mor-curry]]),
$\bigcap_{x\in G} xHx^{-1}$, najveća je normalna podgrupa sadržana u $H$.

Za $H=\{e\}$ ovo je Cayleyjevo djelovanje ([[mor-cayley]]). Obrat: svako
djelovanje s jednom orbitom izomorfno je nekom $G/H$ — to je sadržaj
[[thm-orbit-stabilizer]].
