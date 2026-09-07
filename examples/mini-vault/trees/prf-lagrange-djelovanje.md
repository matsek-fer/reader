---
id: prf-lagrange-djelovanje
taxon: proof
title: "Dokaz Lagrangeova teorema slobodnim djelovanjem"
teaches: []
requires: []
depends: [thm-lagrange, def-group-action, exp-orbite-i-stabilizatori]
source:
  ref: "proof/ga-lagrange-djelovanje"
standalone: true
---

Dokazujemo [[thm-lagrange]]: za konačnu grupu $G$ i podgrupu $H \le G$
vrijedi $|G| = [G : H] \cdot |H|$. Umjesto ručnog baratanja kosetima,
pustimo podgrupu da djeluje i pozovemo se na dvije opće činjenice o
djelovanjima iz [[exp-orbite-i-stabilizatori]].

## Djelovanje

Neka $H$ djeluje na skupu $G$ (nosivom skupu grupe) formulom

$$h \cdot g = gh^{-1}.$$

Ovo jest djelovanje u smislu [[def-group-action]]: neutralni element
djeluje trivijalno, $e \cdot g = ge^{-1} = g$, a za $h_1, h_2 \in H$

$$h_1 \cdot (h_2 \cdot g) = (gh_2^{-1})h_1^{-1} = g(h_1h_2)^{-1}
  = (h_1h_2) \cdot g.$$

(Inverz u definiciji upravo je ono što množenje zdesna pretvara u
*lijevo* djelovanje.)

## Orbite su koseti i particioniraju G

Po općoj činjenici, orbite bilo kojeg djelovanja particioniraju skup na
kojem se djeluje; ovdje one particioniraju $G$. Orbita elementa $g$ skup
je $\{gh^{-1} : h \in H\} = gH$ (kad $h$ prolazi kroz $H$, prolazi i
$h^{-1}$): orbite su upravo lijevi koseti podgrupe $H$. Za samo brojanje
ta identifikacija neće ni trebati — ali pokazuje da particija iz
klasičnog dokaza [[prf-lagrange-particija]] ovdje ispada besplatno, kao
instanca opće particije na orbite.

## Djelovanje je slobodno, pa svaka orbita ima |H| elemenata

Djelovanje je **slobodno**: ako je $h \cdot g = g$, tada je $gh^{-1} = g$,
pa kraćenjem $g$ slijedi $h = e$. Po drugoj općoj činjenici, slobodno
djelovanje konačne grupe ima sve orbite jednakobrojne s grupom koja
djeluje: preslikavanje $h \mapsto h \cdot g$ bijekcija je
$H \to \mathrm{Orb}(g)$. Dakle svaka orbita ima točno $|H|$ elemenata.

## Zaključak

Skup $G$ particioniran je na orbite, svaku veličine $|H|$. Ako je $m$
broj orbita, prebrojavanjem

$$|G| = m \cdot |H|,$$

pa $|H|$ dijeli $|G|$. Budući da su orbite upravo lijevi koseti, $m$ je
indeks $[G : H]$, čime dobivamo $|G| = [G:H] \cdot |H|$. $\blacksquare$
