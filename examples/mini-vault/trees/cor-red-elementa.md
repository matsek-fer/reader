---
id: cor-red-elementa
taxon: corollary
title: "Red elementa dijeli red grupe"
teaches: [lagrange]
requires: []
depends: [thm-lagrange, def-subgroup]
standalone: true
---

**Korolar.** Neka je $G$ konačna grupa i $a \in G$. Tada red elementa $a$
(najmanji $n \ge 1$ s $a^n = e$) dijeli $|G|$. Posebno, $a^{|G|} = e$ za
svaki $a \in G$.

**Dokaz.** Potencije elementa $a$ čine skup
$\langle a \rangle = \{e, a, a^2, \dots, a^{n-1}\}$, gdje je $n$ red od
$a$. Taj je skup podgrupa od $G$ (vidi [[def-subgroup]]): sadrži $e$,
zatvoren je na množenje jer se eksponenti zbrajaju modulo $n$, i zatvoren
na inverze jer je $(a^k)^{-1} = a^{n-k}$. Ima točno $n$ elemenata, jer bi
jednakost $a^i = a^j$ za $0 \le i < j < n$ dala $a^{j-i} = e$ s
$0 < j - i < n$, protivno minimalnosti reda.

Po teoremu [[thm-lagrange]], $|\langle a \rangle| = n$ dijeli $|G|$.
Pišući $|G| = nk$, slijedi $a^{|G|} = (a^n)^k = e^k = e$.
$\blacksquare$

Ovaj korolar radi najveći dio posla u primjenama: iz njega slijedi da je
svaka grupa prostog reda ciklička, i iz njega ispada Mali Fermatov
teorem primijenjen na multiplikativnu grupu ostataka.
