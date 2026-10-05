---
id: thm-orbit-stabilizer
taxon: theorem
title: "Teorem o orbiti i stabilizatoru"
about: [mor-orbits, mor-stabilizer]
fields: [algebra, geometrija]
teaches: [orbit-stabilizer-theorem]
requires: []
depends: [exp-orbite-i-stabilizatori, mor-stabilizer, def-coset]
standalone: true
language: hr
origin: agent
---

**Teorem.** Neka grupa $G$ djeluje na skupu $X$ i neka je $x\in X$. Orbita
$Gx=\{g\cdot x : g\in G\}$ ([[exp-orbite-i-stabilizatori]]) i stabilizator
$G_x=\{g\in G : g\cdot x=x\}$ ([[mor-stabilizer]]) povezani su bijekcijom

$$G/G_x\longrightarrow Gx,\qquad gG_x\longmapsto g\cdot x,$$

sa skupa lijevih koseta ([[def-coset]]) na orbitu. Ako je $G$ konačna,

$$|Gx|\cdot|G_x|=|G|;$$

posebno, duljina svake orbite dijeli red grupe.

Bijekcija je i ekvivarijantna za djelovanje $G$ na kosetima
([[mor-coset-action]]), pa je svako djelovanje s jednom orbitom izomorfno
nekom $G/H$ ([[con-ekvivarijantna-preslikavanja]]). Dokaz:
[[prf-orbit-stabilizer]]. Geometrijski: orbita broji *koliko položaja* točka
može zauzeti, stabilizator *koliko simetrija* je ostavlja na miru; produkt je
uvijek red grupe. Posljedica za brojanje orbita: [[thm-burnside]]; na
ogrlicama, [[mor-ogrlice-z6]].
