---
id: obj-perm-rep
taxon: object
title: "Permutacijska reprezentacija"
symbol: '\hat\rho\colon G\to\mathrm{Sym}(X)'
hom: 'Par $(\varphi,f)$, $\varphi\colon G\to H$ homomorfizam i $f\colon X\to Y$, uz $f\circ\hat\rho(g)=\hat\sigma(\varphi(g))\circ f$ za svaki $g\in G$.'
region: strukture
pos: [640, 0]
teaches: [group-actions]
requires: [permutation-groups, group-homomorphisms]
depends: [obj-group, obj-set]
standalone: true
language: hr
origin: agent
---

## Ideja
Umjesto da grupa „miče točke”, ona *bira permutacije*: svakom $g$ pridružena
je bijekcija skupa $X$, i to tako da produkt ide u kompoziciju. To je isti
sadržaj kao djelovanje ([[mor-uncurry]]), zapisan tako da se vidi homomorfizam.

## Definicija
Homomorfizam grupa $\hat\rho\colon G\to\mathrm{Sym}(X)$, gdje je
$\mathrm{Sym}(X)$ grupa svih bijekcija $X\to X$ uz kompoziciju.

## Podaci
Grupa $G$, skup $X$ i homomorfizam $\hat\rho$. Ni manje ni više nego kod
djelovanja: $g\cdot x=\hat\rho(g)(x)$ rječnik je u oba smjera
([[mor-curry]], [[mor-uncurry]]).

## Svojstva
Jezgra $\ker\hat\rho=\{g : g\cdot x=x\ \text{za sve } x\}$ normalna je podgrupa;
reprezentacija je *vjerna* kad je jezgra trivijalna, i tada je $G$ izomorfna
podgrupi od $\mathrm{Sym}(X)$.

## Primjeri
Cayleyjevo djelovanje daje vjernu reprezentaciju $G\hookrightarrow\mathrm{Sym}(G)$
([[mor-cayley]]); rotacije ogrlice daju $\mathbb{Z}_6\to\mathrm{Sym}(B^6)$
([[obj-ogrlice-z6]]).

## Povezano
Isti objekt u drugom ruhu: [[obj-group-action]].
