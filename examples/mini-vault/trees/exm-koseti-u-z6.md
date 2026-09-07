---
id: exm-koseti-u-z6
taxon: example
title: "Koseti podgrupe {0, 3} u Z₆"
teaches: [cosets]
requires: [modular-arithmetic]
depends: [def-coset]
standalone: true
---

Promotrimo grupu $\mathbb{Z}_6 = \{0, 1, 2, 3, 4, 5\}$ sa zbrajanjem
modulo $6$ i njezinu podgrupu $H = \{0, 3\}$. Budući da je grupa
aditivna, koset iz [[def-coset]] pišemo $g + H$ umjesto $gH$.

Izračunajmo sve kosete redom:

| $g$ | $g + H$ |
|---|---|
| $0$ | $\{0, 3\}$ |
| $1$ | $\{1, 4\}$ |
| $2$ | $\{2, 5\}$ |
| $3$ | $\{3, 0\} = \{0, 3\}$ |
| $4$ | $\{4, 1\} = \{1, 4\}$ |
| $5$ | $\{5, 2\} = \{2, 5\}$ |

Šest elemenata proizvodi samo **tri različita koseta**:
$\{0,3\}, \{1,4\}, \{2,5\}$ — različiti elementi mogu odrediti isti
koset, a koseti se ili podudaraju ili su disjunktni. Sve troje zajedno
prekriva $\mathbb{Z}_6$ bez preklapanja: particija na djelu.

Brojevi se slažu s teoremom [[thm-lagrange]]:

$$|\mathbb{Z}_6| = [\mathbb{Z}_6 : H] \cdot |H| = 3 \cdot 2 = 6.$$

Uočimo i negativnu stranu istog teorema: $\mathbb{Z}_6$ nema podgrupu s
$4$ elementa, jer $4 \nmid 6$ — Lagrange ne kaže samo koliko koseta ima,
nego i kojih podgrupa uopće ne može biti.
