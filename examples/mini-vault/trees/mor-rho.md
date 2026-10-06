---
id: mor-rho
taxon: morphism
title: "Pravilo djelovanja"
kind: hom
from: obj-acting-group
to: obj-acted-set
statement: '\rho\colon G\times X\to X,\quad e\cdot x=x,\ g\cdot(h\cdot x)=(gh)\cdot x'
label: '\rho'
needs: []
region: definicije
teaches: []
requires: [functions]
depends: [obj-acting-group, obj-acted-set, def-group-action]
standalone: true
language: hr
origin: agent
---

Strelica koja grupu [[obj-acting-group]] veže sa skupom [[obj-acted-set]].
Svakom $g\in G$ pripada bijekcija $x\mapsto g\cdot x$ skupa $X$, pa je
pravilo funkcija iz $G$ u funkcije $X\to X$; nacrtano je kao jedna strelica
$G\to X$, a puni je zapis $\rho\colon G\times X\to X$. Dva uvjeta,
$e\cdot x=x$ i $g\cdot(h\cdot x)=(gh)\cdot x$ ([[def-group-action]]), dio su
ove strelice — ne skupa i ne grupe.

Ta tri podatka — grupa, skup i ovo pravilo — čine **definicijski dijagram**
vrste [[obj-group-action]]; vrsta ih navodi u svom ključu `data`, i upravo
zato nije potreban nikakav objekt „par grupe i skupa”.

Isti podatak ima i drugi zapis: homomorfizam $\hat\rho\colon G\to
\mathrm{Sym}(X)$ ([[obj-perm-rep]]), a prijelaz među zapisima su
[[mor-curry]] i [[mor-uncurry]].
