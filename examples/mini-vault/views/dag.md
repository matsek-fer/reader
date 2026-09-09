# Graf ovisnosti

> [!TIP] Ovo je statični Obsidian-prikaz. **Interaktivni prikaz** — sklopive cjeline, označavanje napretka (savladano / spremno / nije spremno), pretraga — je `views/forest.html`: otvori ga **u pregledniku** (dvoklik u file manageru), ne u Obsidianu.

Bridovi su `depends` veze: strelica vodi od preduvjeta prema stablu
koje ga treba. Graf je tranzitivno reduciran — brid koji slijedi iz
duljeg puta je izostavljen. Dokazi (`prf-`) i zadatci (`exr-`) su
izostavljeni radi čitljivosti; potpuni interaktivni prikaz je
`views/forest.html`.

*(Generirano 2026-09-07 alatom forest-digest.)*

## Pregled po cjelinama

```mermaid
graph TD
    g0["1 · Temelji (4)"]
    g1["2 · Teorem i dokazi (4)"]
    g2["3 · Djelovanja: drugi motor (2)"]
    g3["4 · Primjer i veza (2)"]
    g0 --> g1
    g0 --> g2
    g0 --> g3
    g1 --> g3
    g2 --> g1
    g2 --> g3
```

## 1 · Temelji

```mermaid
graph TD
    def_group["def-group"]
    def_subgroup["def-subgroup"]
    def_coset["def-coset"]
    def_index["def-index"]
    def_subgroup --> def_coset
    def_coset --> def_index
    def_group --> def_subgroup
```

- [[def-group]] — Grupa
- [[def-subgroup]] — Podgrupa
- [[def-coset]] — Koset
- [[def-index]] — Indeks podgrupe

## 2 · Teorem i dokazi

```mermaid
graph TD
    thm_lagrange["thm-lagrange"]
    cor_red_elementa["cor-red-elementa"]
    thm_lagrange --> cor_red_elementa
```

- [[thm-lagrange]] — Lagrangeov teorem
- [[cor-red-elementa]] — Red elementa dijeli red grupe

## 3 · Djelovanja: drugi motor

```mermaid
graph TD
    def_group_action["def-group-action"]
    exp_orbite_i_stabilizatori["exp-orbite-i-stabilizatori"]
    def_group_action --> exp_orbite_i_stabilizatori
```

- [[def-group-action]] — Djelovanje grupe
- [[exp-orbite-i-stabilizatori]] — Orbite: kako djelovanje particionira skup

## 4 · Primjer i veza

```mermaid
graph TD
    exm_koseti_u_z6["exm-koseti-u-z6"]
    con_slobodna_djelovanja["con-slobodna-djelovanja"]
```

- [[exm-koseti-u-z6]] — Koseti podgrupe {0, 3} u Z₆
- [[con-slobodna-djelovanja]] — Lagrange kao specijalan slučaj slobodnih djelovanja
