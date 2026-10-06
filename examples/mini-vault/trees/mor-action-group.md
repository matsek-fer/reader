---
id: mor-action-group
taxon: morphism
title: "Grupa koja djeluje"
kind: data
from: obj-group-action
to: obj-group
statement: '(G,X,\rho)\mapsto G'
label: 'G'
acts_on: all
needs: []
on_homomorphisms: '$(\varphi,f)\mapsto\varphi$: zaboravlja preslikavanje skupova i pamti homomorfizam grupa.'
functorial: true
region: strukture
teaches: [group-actions]
requires: []
depends: [obj-group-action]
standalone: true
language: hr
origin: agent
---

Projekcija na prvi podatak: od djelovanja ostaje samo grupa, bez skupa i bez
pravila kako ga miče. Dva vrlo različita djelovanja iste grupe — $\mathbb{Z}_6$
na sebi ([[mor-cayley]]) i $\mathbb{Z}_6$ na nizovima perli ([[obj-ogrlice-z6]])
— ova strelica šalje u isti objekt. Druga komponenta je [[mor-action-set]];
pravilo $\rho$ nije samostalan objekt, nego način na koji su $G$ i $X$
spojeni ([[mor-curry]]).
