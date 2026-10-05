---
id: obj-g-sets
taxon: object
title: "Kategorija G-skupova"
symbol: 'G\text{-}\mathbf{Set}'
hom: 'Funktor između dviju takvih kategorija; npr. svaki homomorfizam $\varphi\colon G\to H$ daje restrikciju $H\text{-}\mathbf{Set}\to G\text{-}\mathbf{Set}$, $g\cdot y=\varphi(g)\cdot y$.'
teaches: []
requires: [categories-functors]
depends: [obj-group-action, con-ekvivarijantna-preslikavanja]
standalone: true
language: hr
origin: agent
---

## Ideja
Umjesto jednog djelovanja gledamo *sva* djelovanja iste grupe odjednom, zajedno
s preslikavanjima među njima. Tada pitanja o jednom djelovanju — što su orbite,
što su fiksne točke — postaju univerzalne konstrukcije u toj kategoriji.

## Definicija
Objekti su skupovi s djelovanjem grupe $G$ ([[obj-group-action]] uz fiksiran
$G$), strelice su ekvivarijantna preslikavanja
([[con-ekvivarijantna-preslikavanja]]), kompozicija je kompozicija funkcija.
Ekvivalentno: $G\text{-}\mathbf{Set}$ je kategorija funktora $BG\to\mathbf{Set}$,
gdje je $BG$ kategorija s jednim objektom čije su strelice elementi od $G$.

## Podaci
Sama grupa $G$: kategorija je njome određena.

## Svojstva
Izomorfizmi su bijektivna ekvivarijantna preslikavanja. Orbite su kolimes, a
fiksne točke limes funktora $X\colon BG\to\mathbf{Set}$; kolimes se može zapisati
i kao koegalizator para $G\times X\rightrightarrows X$, $(g,x)\mapsto g\cdot x$ i
$(g,x)\mapsto x$ ([[mor-orbits]], [[mor-fixed-points]]). Svaki $G$-skup
disjunktna je unija tranzitivnih, a svaki tranzitivni izomorfan je nekom $G/H$
([[thm-orbit-stabilizer]]).

## Primjeri
$\mathbb{Z}_6\text{-}\mathbf{Set}$ sadrži ogrlice ([[mor-ogrlice-z6]]); za
trivijalnu grupu $\{e\}\text{-}\mathbf{Set}$ obični je $\mathbf{Set}$.

## Povezano
Djelovanje kao objekt ove kategorije: [[mor-g-sets]].
