---
id: mor-g-sets
taxon: morphism
title: "Djelovanje kao objekt kategorije G-skupova"
kind: construction
from: obj-group-action
to: obj-g-sets
statement: '(G,X,\rho)\mapsto X\in\operatorname{Ob}(G\text{-}\mathbf{Set})'
label: '\in G\text{-}\mathbf{Set}'
acts_on: all
needs: []
on_homomorphisms: 'Funktor na $G\text{-}\mathbf{Set}$ ($\varphi=\mathrm{id}$): $(\mathrm{id}_G,f)\mapsto f$, strelica kategorije; za opći $\varphi\colon G\to H$ par $(\varphi,f)$ postaje strelica $X\to\varphi^{*}Y$ u $G\text{-}\mathbf{Set}$ tek nakon restrikcije $Y$ uzduž $\varphi$.'
functorial: true
region: strukture
teaches: []
requires: [categories-functors, limits-colimits]
depends: [obj-group-action, obj-g-sets]
standalone: true
language: hr
origin: agent
---

Jedno djelovanje grupe $G$ postaje *objekt* kategorije $G\text{-}\mathbf{Set}$
([[obj-g-sets]]), čije su strelice ekvivarijantna preslikavanja
([[con-ekvivarijantna-preslikavanja]]). Dobitak je jezik: izomorfizam
djelovanja, podobjekt (invarijantan podskup), produkt $X\times Y$ s
$g\cdot(x,y)=(g\cdot x,g\cdot y)$ i disjunktna unija dobivaju univerzalna
svojstva umjesto ad hoc definicija.

Dvije strelice iz ove šume u tom su jeziku *kolimes* i *limes*: ako djelovanje
čitamo kao funktor $X\colon BG\to\mathbf{Set}$, tada je $X/G$ ([[mor-orbits]])
njegov kolimes, a $X^G$ ([[mor-fixed-points]]) njegov limes. Kolimes se može
izreći i kao koegalizator para $G\times X\rightrightarrows X$ — $(g,x)\mapsto g\cdot x$
i $(g,x)\mapsto x$ — jer je $X/G$ najmanji kvocijent u kojem $g\cdot x$ i $x$
postaju isto.
