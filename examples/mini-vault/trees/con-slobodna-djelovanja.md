---
id: con-slobodna-djelovanja
taxon: connection
title: "Lagrange kao specijalan slučaj slobodnih djelovanja"
teaches: [lagrange, orbits-stabilizers]
requires: []
depends: [thm-lagrange, exp-orbite-i-stabilizatori]
standalone: true
---

Ova veza spaja dva kraja: teorem [[thm-lagrange]] ($|H|$ dijeli $|G|$) i
opću mašineriju orbita iz [[exp-orbite-i-stabilizatori]].

**Opći princip.** Ako konačna grupa $H$ djeluje *slobodno* na konačnom
skupu $X$, tada $|H|$ dijeli $|X|$: orbite particioniraju $X$, a
slobodnost čini svaku orbitu jednakobrojnom s $H$, pa je
$|X| = (\text{broj orbita}) \cdot |H|$.

**Lagrange je specijalan slučaj** u kojem podgrupa $H \le G$ djeluje na
$X = G$ formulom $h \cdot g = gh^{-1}$ — to djelovanje je slobodno zbog
kraćenja, a njegove orbite upravo su lijevi koseti. Dokaz
[[prf-lagrange-djelovanje]] jest ovaj princip ispisan do kraja.

**Isti kalup nosi i druge teoreme.** Snaga principa je u tome što $X$ ne
mora biti grupa:

- *Cauchyjev teorem* (ako prost $p$ dijeli $|G|$, postoji element reda
  $p$) dobiva se puštanjem cikličke grupe reda $p$ da ciklički pomiče
  $p$-torke elemenata čiji je produkt $e$, pa se broje fiksne točke.
- *Mali Fermatov teorem* ($a^p \equiv a \pmod p$) jest brojanje ogrlica:
  rotacije djeluju na nizove perli duljine $p$, orbite šarenih nizova
  imaju točno $p$ elemenata.

Smjer za pamćenje: kad god treba pokazati da neki broj dijeli neki drugi,
vrijedi potražiti slobodno (ili barem razumljivo) djelovanje čije orbite
obavljaju dijeljenje umjesto nas.
