---
id: mor-dual
taxon: morphism
title: Dualna grupa
kind: transform
from: obj-grupa
to: obj-grupa
statement: (G,\cdot)\mapsto \widehat G=\mathrm{Hom}(G,\mathbb{C}^\times)
label: \widehat G
acts_on: all
needs: ['$G$ konačna i komutativna']
functorial: true
on_homomorphisms: '$\varphi\colon G\to H$ ide u $\widehat\varphi\colon\widehat H\to\widehat G$, $\chi\mapsto\chi\circ\varphi$; smjer se obrće, a slaganje se čuva obrnutim redom.'
inverse: mor-homomorfizam
up_to: thm-dvostruki-dual
teaches: []
requires: []
standalone: true
origin: member
depends: [obj-grupa]
---

Karakteri $\chi\colon G\to\mathbb{C}^\times$ uz množenje po točkama opet čine
konačnu komutativnu grupu. Dvaput primijenjena, konstrukcija ne vraća $G$ nego
grupu s njom kanonski izomorfnu ([[thm-dvostruki-dual]]).

Konstrukcija je **kontravarijantna**: homomorfizam $\varphi\colon G\to H$ ne
daje preslikavanje $\hat G\to\hat H$ nego $\hat H\to\hat G$, $\chi\mapsto
\chi\circ\varphi$. Zato je i dvostruki dual kovarijantan, pa se $G$ i $\hat{\hat G}$
uopće mogu uspoređivati.
