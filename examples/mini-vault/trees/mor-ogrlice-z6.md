---
id: mor-ogrlice-z6
taxon: morphism
title: "Rotacije ogrlice od šest perli"
kind: instance
from: pt
to: obj-group-action
statement: '(\mathbb{Z}_6,\ B^6,\ k\cdot(x_i)_{i\in\mathbb{Z}_6}=(x_{i+k})_{i\in\mathbb{Z}_6}),\quad |B|=2'
label: '\mathbb{Z}_6\curvearrowright B^6'
needs: []
values:
  mor-action-group: '$\mathbb{Z}_6$, rotacije za $k$ mjesta'
  mor-action-set: '$B^6$, svih $2^6=64$ nizova od šest perli u dvije boje'
  mor-orbits: 'ogrlice — nizovi do rotacije; ima ih $14$'
  mor-orbit-count: '$14$'
  mor-fixed-points: '$X^{\mathbb{Z}_6}$: dva jednobojna niza; za pojedinu rotaciju $k$ skup $\mathrm{Fix}(k)$ ima $2^{\gcd(k,6)}$ nizova'
  mor-stabilizer: 'jednobojan niz: $\mathbb{Z}_6$; $(0,1,0,1,0,1)$: $\{0,2,4\}$; $(0,0,1,0,0,1)$: $\{0,3\}$; niz bez simetrije: $\{0\}$'
teaches: [group-actions]
requires: [cyclic-groups]
depends: [obj-group-action]
standalone: true
language: hr
origin: agent
---

Niz od šest perli u dvije boje, $x=(x_0,\dots,x_5)\in B^6$, postaje *ogrlica*
kad zaboravimo gdje počinje: rotacija za $k$ mjesta, $k\in\mathbb{Z}_6$, šalje
$x$ u $(x_k,x_{k+1},\dots,x_{k+5})$ s indeksima modulo $6$. To je djelovanje
([[def-group-action]]): rotacija za $0$ ne radi ništa, a rotacija za $k$ pa za
$l$ jest rotacija za $k+l$.

Ogrlica je točno **orbita** niza, a njezina rotacijska simetrija
**stabilizator**: niz $(0,1,0,1,0,1)$ fiksiraju rotacije za $0,2,4$, pa mu
orbita ima $6/3=2$ elementa ([[thm-orbit-stabilizer]]). Rotaciju za $k$
fiksiraju nizovi koje određuje prvih $\gcd(k,6)$ perli, njih
$2^{\gcd(k,6)}$: za $k=0,\dots,5$ redom $64,2,4,8,4,2$. Burnsideova lema
([[thm-burnside]]) daje

$$\frac{64+2+4+8+4+2}{6}=\frac{84}{6}=14$$

ogrlica.
