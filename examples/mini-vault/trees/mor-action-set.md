---
id: mor-action-set
taxon: morphism
title: "Skup na kojem se djeluje"
kind: data
from: obj-group-action
to: obj-set
statement: '(G,X,\rho)\mapsto X'
label: 'X'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto f$: zaboravlja homomorfizam grupa i pamti preslikavanje skupova.'
functorial: true
teaches: [group-actions]
requires: []
depends: [obj-group-action]
standalone: true
language: hr
origin: agent
---

Projekcija na drugi podatak: nosivi skup $X$, bez ikakvog traga simetrija koje
su na njemu radile. Usporedi s [[mor-orbits]] i [[mor-fixed-points]], koje
također završavaju u skupu, ali *koriste* djelovanje prije nego što ga
zaborave: $X/G$ i $X^G$ općenito su manji od $X$ i pamte što je $G$ radio.
Prva komponenta je [[mor-action-group]].
