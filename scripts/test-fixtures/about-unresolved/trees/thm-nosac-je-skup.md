---
id: thm-nosac-je-skup
taxon: theorem
title: Nosač grupe je skup
about: [obj-grupa, obj-prsten]
fields: [algebra]
teaches: []
requires: []
standalone: true
origin: member
depends: [obj-grupa, mor-nosac]
---

Trivijalno, ali ima dijagram:

```cd
G @ 0,0 : G
M @ 1,0 : M
X @ 0,1 : X
n: G -> X : \text{nosa\v{c}} [left]
m: G -> M : \iota [above]
k: M -> X : \text{nosa\v{c}} [right]
n = m k : [[def-grupa]]
```
