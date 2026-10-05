---
id: exp-petlja-kao-lanac
taxon: exposition
title: "Petlja kao lanac"
about: [mor-act-by-element]
teaches: []
requires: [categories-functors]
depends: []
standalone: true
language: hr
origin: agent
---

**Petlja** je strelica koja počinje i završava u istom objektu,
$f\colon X\to X$. Kako joj se kraj poklapa s početkom, može se nastaviti samom
sobom, i to koliko god puta želimo. Isti podatak zato ima dvije slike: petlju
na jednoj kućici, i **lanac** u kojem je kućica prepisana za svaki korak,

$$X\xrightarrow{\ f\ }X\xrightarrow{\ f\ }X\xrightarrow{\ f\ }\cdots$$

U lancu nema ničeg novog: svaka kućica je isti objekt i svaka strelica ista
strelica. Lanac samo odmota ono što petlja drži smotanim — put od početka do
$k$-te sljedeće kućice je $f^k=f\circ\cdots\circ f$ ($k$ puta), a $f^0$ je
identiteta.

**Kada lanac pomaže.** Kad se pita o *ponavljanju*:

- *iteracija*: što se s točkom $x\in X$ dogodi nakon $k$ koraka — niz
  $x, f(x), f^2(x),\dots$ čita se iz lanca slijeva nadesno;
- *orbite*: vraća li se taj niz ikada u $x$, i nakon koliko koraka — za
  bijekciju $x\mapsto g\cdot x$ kojom element grupe djeluje na skup to je
  pitanje o orbiti točke $x$ pod podgrupom $\langle g\rangle$
  ([[mor-act-by-element]]);
- *nizovi struktura*: kad petlja nije funkcija nego konstrukcija koja od
  strukture gradi novu strukturu iste vrste, lanac ispisuje niz koji ona
  proizvodi — konstrukcija $G\mapsto[G,G]$, koja grupi pridružuje njezinu
  komutatorsku podgrupu (generiranu svim elementima $ghg^{-1}h^{-1}$),
  odmotana daje izvedeni (derivirani) niz
  $G=G^{(0)}\supseteq G^{(1)}=[G,G]\supseteq G^{(2)}\supseteq\cdots$, u kojem je
  $G^{(k+1)}=[G^{(k)},G^{(k)}]$.

Kad se pita samo što $f$ radi u jednom koraku, petlja je čitljivija.

**Kategorijsko čitanje.** Petlja $f\colon X\to X$ u kategoriji $\mathcal{C}$
isto je što i funktor $F\colon B\mathbb{N}\to\mathcal{C}$, gdje je
$B\mathbb{N}$ kategorija s jednim objektom $\ast$ čije su strelice prirodni
brojevi $0,1,2,\dots$, a slaganje strelica zbrajanje — monoid $(\mathbb{N},+)$
shvaćen kao kategorija: $F$ šalje objekt $\ast$ u $X$ i strelicu $1$ u $f$, pa
nužno strelicu $k$ u $f^k$, i svaki funktor $B\mathbb{N}\to\mathcal{C}$
nastaje tako iz točno jedne petlje. Uređen skup $(\mathbb{N},\le)$ također je
kategorija — objekti su prirodni brojevi, a od $i$ do $j$ vodi jedna strelica
točno kad je $i\le j$ — i funktor $U\colon(\mathbb{N},\le)\to B\mathbb{N}$
šalje svaki objekt u $\ast$, a strelicu $i\le j$ u broj $j-i$. Lanac je
kompozicija $F\circ U$: svaki $i$ ide u $X$, a strelica $i\le i+1$ u $f$.

Ovo stablo iznosi opću ideju; petlje o kojima govori — popisane u njegovu
zaglavlju (`about`), zasad [[mor-act-by-element]] — njezini su primjeri.
