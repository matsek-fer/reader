---
id: mor-equivariant-map
taxon: morphism
title: "Ekvivarijantno preslikavanje"
kind: hom
from: obj-group-action-source
to: obj-group-action-target
statement: 'f\colon X\to Y,\quad f(g\cdot x)=g\cdot f(x)\ \text{za sve } g\in G,\ x\in X'
label: 'f'
needs: []
region: primjeri
teaches: [group-actions]
requires: []
depends: [obj-group-action-source, obj-group-action-target]
standalone: true
language: hr
origin: agent
---

Neka ista grupa $G$ djeluje na skupu $X$ i na skupu $Y$
([[obj-group-action-source]] i [[obj-group-action-target]] — dvije instance
iste vrste [[obj-group-action]], pa je ovo preslikavanje morfizam u njoj).
Funkcija $f\colon X\to Y$ **ekvivarijantna** je ako poštuje oba djelovanja:

$$f(g\cdot x)=g\cdot f(x)\qquad\text{za sve } g\in G,\ x\in X,$$

gdje $g$ s lijeve strane jednakosti djeluje na $X$, a s desne na $Y$. Svejedno
je, dakle, hoće li se točka prvo pomaknuti pa preslikati ili prvo preslikati pa
pomaknuti. Isti uvjet kao komutativan kvadrat, uz primjer i protuprimjer u
$D_4$, stoji u [[con-ekvivarijantna-preslikavanja]].

Ekvivarijantno preslikavanje ne mora biti bijekcija: preslikavanje iz $X$ u
jednočlan skup, na kojem $G$ može djelovati samo na jedan način, uvijek je
ekvivarijantno, a bijekcija je samo kad je i $X$ jednočlan. Kad jest bijekcija, ono je **izomorfizam djelovanja**, jer mu
je inverz sam od sebe ekvivarijantan: iz
$f(g\cdot f^{-1}(y))=g\cdot f(f^{-1}(y))=g\cdot y$ primjenom $f^{-1}$ slijedi
$g\cdot f^{-1}(y)=f^{-1}(g\cdot y)$. Dva izomorfna djelovanja razlikuju se samo
imenima točaka.

Takav izomorfizam daje teorem o orbiti i stabilizatoru
([[thm-orbit-stabilizer]]): za točku $x\in X$ preslikavanje

$$G/G_x\longrightarrow Gx,\qquad gG_x\longmapsto g\cdot x,$$

sa skupa lijevih koseta stabilizatora $G_x=\{g\in G : g\cdot x=x\}$
([[mor-stabilizer]]) na orbitu $Gx=\{g\cdot x : g\in G\}$, bijektivno je i
ekvivarijantno: na kosetima $G$ djeluje množenjem slijeva
([[mor-coset-action]]), na orbiti onako kako djeluje na $X$, a
$h\cdot gG_x=hgG_x$ ide u $(hg)\cdot x=h\cdot(g\cdot x)$.
