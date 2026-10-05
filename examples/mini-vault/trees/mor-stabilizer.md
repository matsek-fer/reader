---
id: mor-stabilizer
taxon: morphism
title: "Stabilizator točke"
kind: property
from: obj-group-action
to: obj-subgroup
statement: '(G,X,\rho),\ x\mapsto G_x=\{\,g\in G : g\cdot x=x\,\}\le G'
label: 'G_x'
acts_on: all
needs: ['odabrana točka $x \in X$']
on_homomorphisms: 'Uz $\varphi=\mathrm{id}$ i $f(x)=y$ vrijedi $G_x\subseteq G_y$, jer $g\cdot x=x$ povlači $g\cdot y=f(g\cdot x)=y$; ovisi o točki, pa nije funktor na golim djelovanjima.'
functorial: false
teaches: [orbits-stabilizers]
requires: [subgroups]
depends: [obj-group-action, def-subgroup]
standalone: true
language: hr
origin: agent
---

$G_x$ je podgrupa ([[def-subgroup]]): $e$ fiksira $x$, a iz $g\cdot x=x$ i
$h\cdot x=x$ slijedi $(gh)\cdot x=g\cdot(h\cdot x)=x$ i
$g^{-1}\cdot x=g^{-1}\cdot(g\cdot x)=x$. **Nije** nužno normalna: za $h\in G$
vrijedi

$$G_{h\cdot x}=hG_xh^{-1},$$

jer $g\cdot(h\cdot x)=h\cdot x$ točno kad $(h^{-1}gh)\cdot x=x$; točke iste
orbite imaju dakle konjugirane stabilizatore. Normalan je presjek svih
stabilizatora — jezgra od $\hat\rho$ ([[mor-curry]]). Djelovanje je slobodno kad
je svaki $G_x$ trivijalan ([[con-slobodna-djelovanja]]); koliko je $G_x$
velik, mjeri veličinu orbite: $|Gx|\cdot|G_x|=|G|$ ([[thm-orbit-stabilizer]]).
