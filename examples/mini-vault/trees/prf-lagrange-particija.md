---
id: prf-lagrange-particija
taxon: proof
title: "Dokaz Lagrangeova teorema particijom na kosete"
teaches: []
requires: []
depends: [thm-lagrange, def-coset]
source:
  ref: "proof/ga-lagrange-particija"
standalone: true
---

Dokazujemo [[thm-lagrange]]: za konačnu grupu $G$ i podgrupu $H \le G$
vrijedi $|G| = [G : H] \cdot |H|$. Lijevi koset je skup
$gH = \{gh : h \in H\}$ (vidi [[def-coset]]). Dokaz ima dva koraka:
koseti čine particiju od $G$, i svi su jednakobrojni s $H$.

## Korak 1: koseti čine particiju

Definirajmo relaciju na $G$: $x \sim y$ ako i samo ako je
$x^{-1}y \in H$. Ona je relacija ekvivalencije:

- *Refleksivnost:* $x^{-1}x = e \in H$.
- *Simetričnost:* ako je $x^{-1}y \in H$, tada je i inverz
  $(x^{-1}y)^{-1} = y^{-1}x \in H$, jer je $H$ zatvorena na inverze.
- *Tranzitivnost:* ako su $x^{-1}y \in H$ i $y^{-1}z \in H$, njihov je
  produkt $(x^{-1}y)(y^{-1}z) = x^{-1}z \in H$, jer je $H$ zatvorena na
  množenje.

Klasa ekvivalencije elementa $x$ upravo je koset $xH$: vrijedi
$x \sim y \iff x^{-1}y \in H \iff y = xh$ za neki $h \in H \iff
y \in xH$. Klase ekvivalencije bilo koje relacije ekvivalencije čine
particiju skupa, pa lijevi koseti čine particiju od $G$: svaki element
grupe leži u točno jednom kosetu.

## Korak 2: svi koseti imaju |H| elemenata

Fiksirajmo $g \in G$ i promotrimo preslikavanje

$$\varphi : H \to gH, \qquad \varphi(h) = gh.$$

Ono je surjektivno po definiciji skupa $gH$. Injektivno je zbog
kraćenja: iz $gh_1 = gh_2$ množenjem s $g^{-1}$ slijeva slijedi
$h_1 = h_2$. Dakle, $\varphi$ je bijekcija i $|gH| = |H|$.

## Zaključak

Grupa $G$ rastavljena je na $[G : H]$ međusobno disjunktnih koseta, a
svaki od njih ima točno $|H|$ elemenata. Prebrojavanjem:

$$|G| = [G : H] \cdot |H|.$$

Posebno, $|H|$ dijeli $|G|$. $\blacksquare$
