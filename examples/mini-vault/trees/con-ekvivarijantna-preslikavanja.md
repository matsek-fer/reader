---
id: con-ekvivarijantna-preslikavanja
taxon: connection
title: "Ekvivarijantna preslikavanja: morfizmi među djelovanjima"
about: [obj-group-action, mor-equivariant-map]
teaches: [group-actions]
requires: [group-homomorphisms]
depends: [obj-group-action, def-group-action]
standalone: true
language: hr
origin: agent
---

Ova veza spaja djelovanja grupe ([[obj-group-action]]) s preslikavanjima među
njima ([[mor-equivariant-map]]). Dva djelovanja iste grupe $G$, na $X$ i na
$Y$, povezuje funkcija $f\colon X\to Y$ koja *poštuje* djelovanje —
**ekvivarijantno preslikavanje**: $f(g\cdot x)=g\cdot f(x)$ za sve $g\in G$,
$x\in X$. Kao dijagram, s $\alpha$ i $\beta$ za dva djelovanja:

```cd
GX @ 0,0 : G\times X
GY @ 1,0 : G\times Y
X  @ 0,1 : X
Y  @ 1,1 : Y
a: GX -> GY : \mathrm{id}_G\times f [above]
b: GX -> X  : \alpha [left]
c: GY -> Y  : \beta [right]
d: X  -> Y  : f [below]
a c = b d : def
```

Gornji put nosi $(g,x)$ u $g\cdot f(x)$, donji u $f(g\cdot x)$; komutiranje
kvadrata točno je ekvivarijantnost.

**Primjer i protuprimjer u $D_4$.** Grupa simetrija kvadrata djeluje na
četiri vrha, četiri stranice i dvije dijagonale. Preslikavanje „vrh $\mapsto$
dijagonala kroz njega” ekvivarijantno je, jer simetrija koja nosi vrh $v$ u
$v'$ nosi i dijagonalu kroz $v$ u dijagonalu kroz $v'$. Preslikavanje „vrh
$\mapsto$ stranica desno od njega” ekvivarijantno je samo za rotacije:
zrcaljenje zamijeni lijevo i desno. Štoviše, ekvivarijantnog preslikavanja
vrhovi $\to$ stranice *uopće nema*: $f(v)$ morala bi biti stranica koju fiksira
cijeli stabilizator vrha $v$ ([[mor-stabilizer]]), a zrcaljenje preko
dijagonale kroz $v$ ne fiksira nijednu stranicu.

Ekvivarijantna preslikavanja strelice su kategorije $G$-skupova
([[mor-g-sets]]); bijektivno ekvivarijantno preslikavanje izomorfizam je
djelovanja — $G/G_x\to Gx$ iz [[thm-orbit-stabilizer]] jedan je takav.
