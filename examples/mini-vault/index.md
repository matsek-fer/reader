# Lagrangeov teorem — karta vaulta

Bilješke iz MatSek knjižnice, probavljene u forest vault: put od
definicije grupe do Lagrangeova teorema, njegova dva dokaza i posljedica.
Redoslijed ispod poštuje ovisnosti — svako stablo čita se uz ona iznad
sebe, a svako se može čitati i samostalno.

## 1 · Temelji

- [[def-group]] — što je grupa: operacija, asocijativnost, neutralni, inverzi; red grupe i elementa
- [[def-subgroup]] — podskup koji je i sam grupa; tri uvjeta zatvorenosti
- [[def-coset]] — pomaknuta kopija podgrupe $gH$; koseti nisu podgrupe
- [[def-index]] — $[G : H]$, broj koseta: koliko kopija popločava grupu

## 2 · Teorem i dokazi

- [[thm-lagrange]] — $|G| = [G : H] \cdot |H|$: red podgrupe dijeli red grupe
- [[prf-lagrange-particija]] — klasični dokaz: relacija ekvivalencije, particija, bijekcija translacijom
- [[prf-lagrange-djelovanje]] — dokaz slobodnim djelovanjem: ista particija kao instanca orbita
- [[cor-red-elementa]] — red elementa dijeli red grupe; $a^{|G|} = e$

## 3 · Djelovanja: drugi motor

- [[def-group-action]] — grupa koja miče skup; slobodna djelovanja
- [[exp-orbite-i-stabilizatori]] — orbite particioniraju skup; slobodne orbite su jednakobrojne

## 4 · Primjer i veza

- [[exm-koseti-u-z6]] — svih šest koseta podgrupe $\{0,3\}$ u $\mathbb{Z}_6$, izračunato do kraja
- [[con-slobodna-djelovanja]] — Lagrange kao specijalan slučaj principa "slobodno djelovanje dijeli"; isti kalup za Cauchyja i Malog Fermata
