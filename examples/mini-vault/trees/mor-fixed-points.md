---
id: mor-fixed-points
taxon: morphism
title: "Fiksne točke"
kind: extract
from: obj-group-action
to: obj-set
statement: '(G,X,\rho)\mapsto X^G=\{\,x\in X : g\cdot x=x\ \text{za sve } g\in G\,\}'
label: 'X^G'
acts_on: all
needs: []
on_homomorphisms: 'Funktor na $G\text{-}\mathbf{Set}$ ($\varphi=\mathrm{id}$): ekvivarijantno $f$ šalje $X^G$ u $Y^G$, jer iz $g\cdot x=x$ slijedi $g\cdot f(x)=f(g\cdot x)=f(x)$. Za promjenjiv $\varphi$ nije funktor: dobije se samo $f(X^G)\subseteq Y^{\varphi(G)}$, što je $Y^H$ tek kad je $\varphi$ surjektivan — fiksne točke su kontravarijantne u grupi, orbite kovarijantne.'
functorial: true
teaches: [orbits-stabilizers]
requires: []
depends: [obj-group-action, exp-orbite-i-stabilizatori]
standalone: true
language: hr
origin: agent
---

Fiksna točka cijele grupe jest točka čija je orbita jednočlana: $X^G$ je
unija svih jednočlanih orbita ([[mor-orbits]]), skup onoga što nijedna
simetrija ne pomiče. To je drugi kraj spektra od slobodnog djelovanja, u kojem
jedino $e$ fiksira bilo što ([[con-slobodna-djelovanja]]).

Oznaku treba razlikovati od fiksnih točaka *jednog elementa*,
$\mathrm{Fix}(g)=\{x : g\cdot x=x\}$: vrijedi $X^G=\bigcap_{g\in G}\mathrm{Fix}(g)$, a
$\mathrm{Fix}(g)$ je $X^{\langle g\rangle}$, fiksne točke podgrupe koju $g$
generira. Burnsideova lema ([[thm-burnside]]) zbraja upravo $|\mathrm{Fix}(g)|$
po svim $g$. U kategoriji $G$-skupova $X^G$ je limes ([[obj-g-sets]]).

Funktorijalnost vrijedi za fiksiranu grupu; za promjenjivu ne. Trivijalna grupa
na $X=\{a,b\}$ ima $X^G=\{a,b\}$, a $\mathbb{Z}_2$ koja na $Y=\{a,b\}$
zamjenjuje $a$ i $b$ ima $Y^H=\varnothing$, iako je par
$(\varphi,\mathrm{id})$, s jedinim homomorfizmom $\varphi\colon\{e\}\to\mathbb{Z}_2$,
morfizam djelovanja — nema preslikavanja $X^G\to Y^H$. Orbite taj problem
nemaju ([[mor-orbits]]).
