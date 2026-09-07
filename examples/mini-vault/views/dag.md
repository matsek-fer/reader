# Graf ovisnosti

Bridovi su `depends` veze među stablima: strelica od preduvjeta prema
stablu koje ga treba. Dokazi (`prf-`) su izostavljeni radi čitljivosti —
svaki visi o svom teoremu; vidi [[thm-lagrange]] za oba.

```mermaid
graph TD
    def_group["def-group"] --> def_subgroup["def-subgroup"]
    def_group --> def_group_action["def-group-action"]
    def_subgroup --> def_coset["def-coset"]
    def_subgroup --> cor_red_elementa["cor-red-elementa"]
    def_coset --> def_index["def-index"]
    def_coset --> thm_lagrange["thm-lagrange"]
    def_coset --> exm_koseti["exm-koseti-u-z6"]
    def_index --> thm_lagrange
    def_group_action --> exp_orbite["exp-orbite-i-stabilizatori"]
    thm_lagrange --> cor_red_elementa
    thm_lagrange --> con_slobodna["con-slobodna-djelovanja"]
    exp_orbite --> con_slobodna
```

Dva ulaza bez preduvjeta: [[def-group]] je korijen svega, a graf se
odmah grana u dva motora — kosete (lijeva grana) i djelovanja (desna) —
koji se ponovno sastaju u [[con-slobodna-djelovanja]].
