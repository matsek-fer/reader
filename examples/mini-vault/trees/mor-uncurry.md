---
id: mor-uncurry
taxon: morphism
title: "Homomorfizam u Sym(X) kao djelovanje"
kind: transform
from: obj-perm-rep
to: obj-group-action
statement: '\bigl(\hat\rho\colon G\to\mathrm{Sym}(X)\bigr)\mapsto(G,X,\rho),\quad g\cdot x=\hat\rho(g)(x)'
label: '\hat\rho\mapsto\rho'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto(\varphi,f)$: uvjet $f\circ\hat\rho(g)=\hat\sigma(\varphi(g))\circ f$, primijenjen na točku $x$, jest $f(g\cdot x)=\varphi(g)\cdot f(x)$.'
functorial: true
inverse: mor-curry
teaches: [group-actions]
requires: [permutation-groups, group-homomorphisms]
depends: [obj-perm-rep, obj-group-action]
standalone: true
language: hr
origin: agent
---

Homomorfizam $\hat\rho$ raspakiramo u pravilo dviju varijabli
$g\cdot x=\hat\rho(g)(x)$. Aksiomi djelovanja iz [[def-group-action]] padaju
izravno iz svojstava homomorfizma: $\hat\rho(e)=\mathrm{id}_X$ daje
$e\cdot x=x$, a $\hat\rho(gh)=\hat\rho(g)\circ\hat\rho(h)$ daje
$(gh)\cdot x=g\cdot(h\cdot x)$. Strelica je inverz od [[mor-curry]]: prijelaz
tamo i natrag vraća isto $\rho$, odnosno isto $\hat\rho$. Zato su
[[obj-group-action]] i [[obj-perm-rep]] jedan te isti pojam u dva zapisa — koji
ćemo odabrati ovisi o tome želimo li gledati točke ili permutacije.
