---
id: thm-lagrange
taxon: theorem
title: "Lagrangeov teorem"
teaches: [lagrange]
requires: []
depends: [def-coset, def-index]
source:
  ref: "proof/ga-lagrange-particija (statement)"
standalone: true
---

**Teorem (Lagrange).** Neka je $G$ konačna grupa i $H \le G$ njezina
podgrupa. Tada $|H|$ dijeli $|G|$; preciznije,

$$|G| = [G : H] \cdot |H|,$$

gdje je $[G : H]$ broj lijevih koseta podgrupe $H$ u $G$ (vidi
[[def-coset]] i [[def-index]]).

Dva dokaza, dva pogleda na isti sadržaj:

- [[prf-lagrange-particija]] — klasični: koseti čine particiju grupe i
  svi su jednakobrojni. Prvi susret počinje ovdje.
- [[prf-lagrange-djelovanje]] — preko slobodnog djelovanja podgrupe:
  ista particija, ali dobivena kao instanca opće mašinerije orbita.

Posljedica koja se najčešće koristi: red svakog elementa dijeli red grupe
— [[cor-red-elementa]]. Konkretna provjera na maloj grupi:
[[exm-koseti-u-z6]].
