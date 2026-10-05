# Lagrangeov teorem — karta vaulta

Bilješke iz MatSek knjižnice, probavljene u forest vault: put od
definicije grupe do Lagrangeova teorema, njegova dva dokaza i posljedica.
Redoslijed ispod poštuje ovisnosti — svako stablo čita se uz ona iznad
sebe, a svako se može čitati i samostalno. Uz redoslijed, vault nosi i
strukturni graf: objekte (vrste struktura) i strelice među njima.

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
- [[thm-orbit-stabilizer]] — $|Gx| \cdot |G_x| = |G|$: bijekcija $G/G_x \to Gx$; duljina orbite dijeli red grupe
- [[prf-orbit-stabilizer]] — dokaz: koseti stabilizatora su vlakna preslikavanja $g \mapsto g \cdot x$
- [[thm-burnside]] — broj orbita je prosječan broj fiksnih točaka elementa grupe
- [[prf-burnside]] — dokaz dvostrukim prebrojavanjem parova $(g, x)$ s $g \cdot x = x$

## 4 · Primjer i veza

- [[exm-koseti-u-z6]] — svih šest koseta podgrupe $\{0,3\}$ u $\mathbb{Z}_6$, izračunato do kraja
- [[con-slobodna-djelovanja]] — Lagrange kao specijalan slučaj principa "slobodno djelovanje dijeli"; isti kalup za Cauchyja i Malog Fermata
- [[con-ekvivarijantna-preslikavanja]] — preslikavanja koja poštuju djelovanje: komutativni kvadrat, primjer i protuprimjer u $D_4$

## Struktura

Objekti strukturnog grafa — vrste struktura; strelice (`mor-`) stoje uz
svoj izvorni objekt i ovdje se ne popisuju.

- [[obj-set]] — skup: odredište strelica koje zaboravljaju
- [[obj-nat]] — prirodni broj: odredište svakog brojanja
- [[obj-group]] — grupa; iz nje Cayleyjevo djelovanje na sebi
- [[obj-subgroup]] — podgrupa kao par $H \le G$; iz nje djelovanje na kosetima
- [[obj-group-action]] — djelovanje grupe na skupu $(G, X, \rho)$: središnji objekt, s orbitama, fiksnim točkama, stabilizatorom i ogrlicama
- [[obj-perm-rep]] — isti podaci kao homomorfizam $G \to \mathrm{Sym}(X)$
- [[obj-monoid-action]] — poopćenje: djelovanje monoida, bez inverza
- [[obj-g-sets]] — konstrukcija: kategorija $G$-skupova, u kojoj su orbite kolimes
