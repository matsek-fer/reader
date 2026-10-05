---
id: obj-monoid-action
taxon: object
title: "Djelovanje monoida na skupu"
symbol: '(M, X, \rho)'
hom: 'Par $(\varphi,f)$: $\varphi\colon M\to N$ homomorfizam monoida (čuva produkt i jedinicu), $f\colon X\to Y$, uz $f(m\cdot x)=\varphi(m)\cdot f(x)$.'
teaches: []
requires: []
depends: [def-group, obj-group-action]
standalone: true
language: hr
origin: agent
---

## Ideja
Isti aksiomi kao za djelovanje grupe, ali bez inverza: monoid može stvari
*raditi*, a ne nužno i poništavati. Zato se dio svojstava djelovanja grupe
gubi — upravo onaj dio koji je zapravo koristio $g^{-1}$.

## Definicija
Monoid je skup $M$ s asocijativnom operacijom i neutralnim elementom $1$ (grupa
iz [[def-group]] bez trećeg aksioma). Djelovanje monoida $M$ na skupu $X$
preslikavanje je $M\times X\to X$ uz $1\cdot x=x$ i $m\cdot(n\cdot x)=(mn)\cdot x$.

## Podaci
Monoid $M$, skup $X$ i pravilo $\rho$; ekvivalentno, homomorfizam monoida
$M\to\mathrm{End}(X)$ u monoid svih funkcija $X\to X$ — ne nužno bijekcija.

## Svojstva
Relacija „$y=m\cdot x$ za neki $m$” refleksivna je i tranzitivna, ali ne i
simetrična: dostižnost nije relacija ekvivalencije, pa „orbite” općenito ne
particioniraju $X$. Fiksne točke $X^M$ i dalje imaju smisla.

## Primjeri
$(\mathbb{N},+)$ na $\mathbb{N}$ pomakom, $n\cdot x=n+x$: iz $0$ se stiže
svugdje, natrag nikamo. $(\mathbb{N},\cdot)$ na $\mathbb{Z}_n$ množenjem,
$k\cdot x=kx$: $1\cdot x=x$ i $k\cdot(l\cdot x)=(kl)\cdot x$, ali $0\cdot x=0$
za svaki $x$ — kraćenje je izgubljeno. Slobodni monoid riječi nad abecedom
$\Sigma$ djeluje na stanjima determinističkog automata, ali *zdesna*:
$q\cdot w=\delta(q,w)$ čita riječ od prvog slova, pa je
$(q\cdot u)\cdot v=q\cdot uv$, a ne $q\cdot vu$.

## Povezano
Svako djelovanje grupe jest djelovanje monoida ([[mor-monoid-action]]); obrat ne
vrijedi, jer $m\cdot x=m\cdot y$ više ne povlači $x=y$.
