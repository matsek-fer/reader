---
id: mor-act-by-element
taxon: morphism
title: "Djelovanje jednog elementa"
kind: hom
from: obj-set
to: obj-set
statement: 'x\mapsto g\cdot x'
label: 'g\cdot'
needs: ['djelovanje grupe $G$ na skupu $X$', 'element $g\in G$']
invertible: true
teaches: [group-actions]
requires: [cyclic-groups]
depends: [obj-set, def-group-action]
standalone: true
language: hr
origin: agent
---

Kad grupa $G$ djeluje na skupu $X$ ([[def-group-action]]), svaki pojedini
element $g\in G$ daje funkciju $X\to X$, $x\mapsto g\cdot x$: strelicu iz skupa
u taj isti skup, dakle petlju na objektu [[obj-set]]. Ta je funkcija bijekcija,
a inverz joj je $x\mapsto g^{-1}\cdot x$, jer je po aksiomima djelovanja
$g^{-1}\cdot(g\cdot x)=(g^{-1}g)\cdot x=e\cdot x=x$ i jednako
$g\cdot(g^{-1}\cdot x)=x$.

Oprez: ta funkcija općenito **nije ekvivarijantna**. Da bi bila, trebalo bi
$g\cdot(h\cdot x)=h\cdot(g\cdot x)$ za sve $h$ i $x$, a to vrijedi tek kad $gh$
i $hg$ djeluju jednako na svaku točku — primjerice kad je $g$ u centru grupe.
Zato petlja stoji na skupu ([[obj-set]]), a ne na djelovanju.

Petlja se može primjenjivati uzastopce, pa je korisno odmotati je u lanac
([[exp-petlja-kao-lanac]]). Krenuvši iz točke $x$, lanac redom posjećuje

$$x,\quad g\cdot x,\quad g^2\cdot x,\quad g^3\cdot x,\ \dots$$

jer je $g\cdot(g^k\cdot x)=g^{k+1}\cdot x$. Sve te točke leže u orbiti točke $x$
pod cikličkom podgrupom $\langle g\rangle=\{g^k : k\in\mathbb{Z}\}$, to jest u
orbiti djelovanja suženog s $G$ na $\langle g\rangle$ ([[mor-orbits]]).

Ako $g$ ima konačan red $n$ — najmanji $n\ge 1$ s $g^n=e$
([[cor-red-elementa]]) — lanac obiđe cijelu tu orbitu, jer je svaka potencija
od $g$ jednaka nekoj $g^k$ s $0\le k<n$, i vrati se u $x$: $g^n\cdot x=e\cdot x=x$.
Prvi put se vrati nakon $d$ koraka, gdje je $d$ najmanji broj $d\ge 1$ s
$g^d\cdot x=x$, i taj $d$ dijeli $n$: skup svih $k\in\mathbb{Z}$ za koje je
$g^k\cdot x=x$ podgrupa je od $\mathbb{Z}$, pa se sastoji točno od višekratnika
svog najmanjeg pozitivnog elementa $d$, a $n$ je jedan od njih. Isto kaže
[[thm-orbit-stabilizer]] primijenjen na grupu $\langle g\rangle$ reda $n$:
duljina orbite dijeli red grupe. Element beskonačnog reda ne mora se vratiti:
kad $\mathbb{Z}$ djeluje na sebi zbrajanjem, element $1$ daje pomak
$x\mapsto x+1$, koji se ne vraća nikad, i tada lanac iz $x$ obiđe samo dio
orbite.
