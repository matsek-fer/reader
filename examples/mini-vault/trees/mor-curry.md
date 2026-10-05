---
id: mor-curry
taxon: morphism
title: "Djelovanje kao homomorfizam u Sym(X)"
kind: transform
from: obj-group-action
to: obj-perm-rep
statement: '(G,X,\rho)\mapsto\bigl(\hat\rho\colon G\to\mathrm{Sym}(X)\bigr),\quad \hat\rho(g)(x)=g\cdot x'
label: '\rho\mapsto\hat\rho'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto(\varphi,f)$: isti par, jer uvjet $f(g\cdot x)=\varphi(g)\cdot f(x)$ glasi upravo $f\circ\hat\rho(g)=\hat\sigma(\varphi(g))\circ f$.'
functorial: true
inverse: mor-uncurry
teaches: [group-actions]
requires: [permutation-groups, group-homomorphisms]
depends: [obj-group-action, obj-perm-rep]
standalone: true
language: hr
origin: agent
---

Fiksiramo $g$ i gledamo što radi s točkama: $\hat\rho(g)=(x\mapsto g\cdot x)$.
To je bijekcija, jer je $\hat\rho(g^{-1})$ njezin inverz s obje strane — po
aksiomu $g\cdot(h\cdot x)=(gh)\cdot x$ s $h=g^{-1}$ i aksiomu $e\cdot x=x$. Isti
aksiom daje $\hat\rho(gh)=\hat\rho(g)\circ\hat\rho(h)$, pa je $\hat\rho$
homomorfizam $G\to\mathrm{Sym}(X)$. Postupak je *curryjevanje* (engl.
currying) funkcije dviju varijabli $\rho(g,x)$ u funkciju jedne varijable s
vrijednostima u funkcijama; natrag vodi [[mor-uncurry]], i ta su dva prijelaza
jedno drugom inverz.

Jezgra $\ker\hat\rho$ skup je elemenata koji fiksiraju *svaku* točku — presjek
svih stabilizatora ([[mor-stabilizer]]). Djelovanje je **vjerno** kad je jezgra
trivijalna; tada je $G$ izomorfna podgrupi od $\mathrm{Sym}(X)$.
