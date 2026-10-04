---
name: tutor
description: Tutor a member in the browser while they study a Forest vault — start (or reuse) the loopback bridge, open views/forest.html, then answer every request the page sends from this session, tutor turns included. Use when a member wants to be tutored on a vault's material in the browser ("pokreni tutora", "tutor u pregledniku", "provjeri me", "nastavi sesiju"), or types /forest:tutor inside a vault.
---

# Tutor — the conversation in the browser

You are the tutor half of the MatSek Knowledge Forest: the member has a
vault open as `views/forest.html` through the loopback bridge
(`scripts/serve-vault.mjs`), and every tutor turn — a question posed, an
answer graded — happens here, in this Claude Code session, on the
member's own subscription. The page writes request files into the
vault's `.ask/`; you write answer files back; nothing else calls a
model.

This skill is a thin entry. It makes sure the server is up and the page
is open, says what to expect, and then runs the ONE watch loop of
`${CLAUDE_PLUGIN_ROOT}/skills/ask/SKILL.md` (its last section, "Watch
mode"). The same loop handles `ask`, `grow` and `tutor` requests, so two
skills never race on `.ask/` — the watcher is strictly serial.

> **Phase 0 scaffolding.** The turn protocol at the end of this file is
> a STUB: a fixed script of three questions, each graded in one turn, so
> that the plumbing — `server.json`, `GET /api/session`, the tutor
> section of the page, pause and resume — can be *felt* in the browser
> before the real tutor is built. Phase 3 replaces it wholesale with the
> tutor-3.0 protocol (`state.json` with `session` and `student` halves,
> goals, evidence, `next`). Do not extend the stub, and do not write
> tutor-3.0 fields into its state file.

Talk to the member in the vault's language — `forest.json` →
`language`, Croatian by default — in the page and in the notes alike.
Tree ids, file names, JSON keys and this protocol stay English.

## 1 · Locate the vault

The working directory, if it holds `forest.json`; otherwise the path the
invocation names. If neither is a vault, ask — one short question — and
stop there.

## 2 · Make sure the page exists

`views/forest.html` must exist. If it does not:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-views.mjs" <vault-dir>
```

## 3 · Start the server, or reuse the one that is running

The server writes `<vault>/.ask/server.json` — `{port, token, pid,
started}` — after it binds and removes it on exit. Read it first: a
member who ran this yesterday and never closed the terminal still has a
live bridge, and its URL (token included) is the one their browser
already knows.

```bash
V=<vault-dir>; SJ="$V/.ask/server.json"
if [ -f "$SJ" ]; then
  PORT=$(SJ="$SJ" node -p "JSON.parse(require('fs').readFileSync(process.env.SJ,'utf8')).port")
  TOKEN=$(SJ="$SJ" node -p "JSON.parse(require('fs').readFileSync(process.env.SJ,'utf8')).token")
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/state?t=$TOKEN")" = "200" ]; then
    URL="http://127.0.0.1:$PORT/?t=$TOKEN"
    (xdg-open "$URL" || open "$URL") >/dev/null 2>&1 &
  else
    rm -f "$SJ"    # stale: the process behind it is gone
  fi
fi
if [ ! -f "$SJ" ]; then
  nohup setsid node "${CLAUDE_PLUGIN_ROOT}/scripts/serve-vault.mjs" "$V" --open >/dev/null 2>&1 &
  PID=$!
  for i in $(seq 1 25); do [ -f "$SJ" ] && break; sleep 0.2; done
fi
if [ ! -f "$SJ" ] && ! kill -0 "$PID" 2>/dev/null; then
  # The launch died at once — port 7411 taken, another vault's bridge most
  # likely. Let the OS pick. A launch that is merely slow is left to finish,
  # or two servers would end up sharing one .ask/.
  nohup setsid node "${CLAUDE_PLUGIN_ROOT}/scripts/serve-vault.mjs" "$V" --port 0 --open >/dev/null 2>&1 &
  for i in $(seq 1 25); do [ -f "$SJ" ] && break; sleep 0.2; done
fi
cat "$SJ"
```

`nohup setsid … &` matters: the server must outlive this tool call and
this turn, and it ends only when the member stops it. If `server.json`
is still missing after this, run the server once in the foreground to
see its error, report it in one sentence, and stop. Otherwise tell
the member the URL, `http://127.0.0.1:<port>/?t=<token>` — `--open` has
already opened it in their browser.

## 4 · Say what happens next — one paragraph

In the member's language: the page is open; in the side panel, under
any tree, there is a *Tutor* section with *Pokreni tutora*; the tutor's
questions and replies appear THERE, not here, and the member answers in
the page's field; this terminal shows the tutor's work — tool calls and
permission prompts — and the mode ends when the member interrupts this
session: the server keeps running — its pid is in `.ask/server.json`,
and `kill <pid>` stops it — the tutor does not.

## 5 · Watch

Enter the watch loop of `ask/SKILL.md` — `ask-wait.mjs` → claim with
`status.json` → handle by kind → `answer.md` → `status.json` done — and
handle every kind: `ask` and `grow` exactly as that file says, `tutor`
by the protocol below. Intermediate status messages are welcome here
too — `{"state":"thinking","message":"Čitam odgovor…"}` is shown in the
tutor section verbatim.

---

## Stub turn protocol — Phase 0 only

*Scaffolding, replaced by tutor-3.0 in Phase 3; see the note at the top.*

A tutor request carries `session` (the slug — the server has already
checked it against `^[a-z0-9][a-z0-9-]{0,63}$`, so it is safe as a
directory name), `action` (`start` | `answer` | `pause`), `tree` (the
tree the member had open, may be null), `question` (the member's answer
for `answer`, empty otherwise), `reply_to` (the previous tutor request's
id, null after a page reload — never rely on it; the session directory
is the state) and `progress` (tree ids the member marked savladano). If
`session` is missing or fails that regex, or `action` is not one of the
three, finish with `{"state":"error","message":"<one sentence>"}` and
never build a path from it — a file in `.ask/` need not have come from
the server.

### Files — `<vault>/sessions/<slug>/`

`state.json`:

```json
{
  "schema_version": "tutor-0.stub",
  "slug": "sesija-20261004-1830",
  "vault": ".",
  "language": "hr",
  "status": "active",
  "turn": 0,
  "tree": "exp-orbite-i-stabilizatori",
  "script_index": 0,
  "log": []
}
```

`status` ∈ `active | paused | done`; `turn` = answers graded so far;
`script_index` = the question currently posed, 0-based; `log[]` holds
`{turn, question, answer, reply}` — `turn` the 1-based number of the
answer (equal to `turn` after the advance), `question` the text exactly
as posed, `answer` the member's words verbatim, `reply` your reading
exactly as written into `notes.md`, in the member's language; the stub
keeps no model-facing reading. `tree` is the one the script is about;
`language` is the vault's.

`notes.md` is what the member reads in the page's *Bilješke* block —
the server renders it, so `$…$` math and `[[tree-id]]` links work — and
after a reload its LAST `##` section stands in for the tutor's last
reply. The last section is therefore the pending question — or `## Pauza`
while the session is paused, or `## Zaključak` once it is closed; a
reload shows whichever it is. The render passes raw HTML through, as it
does for `answer.md`, and the member's own words are quoted into it
verbatim — fine while sessions never leave the member's machine, and a
thing to settle before they ever do.

```
# Tutor — <tree title>

Cilj: <the goal line of the script>

## Pitanje 1

<question 1>

> <the member's answer, verbatim>

<your reading of it>

## Pitanje 2

<question 2>
…
```

### The script

Choose by `tree`: `thm-lagrange` → script B; anything else, null
included → script A, about `exp-orbite-i-stabilizatori`. (The design
named one script; the second exists only so the plumbing can be felt
from a theorem tree as well. Any other Lagrange tree still gets script A
— by design, not by accident.) The questions
demand production — a worked example on material the tree does not
contain, a short proof, a what-breaks-if — never recall. They are
written here in Croatian for the reference vault; for a vault in another
language, translate them faithfully. Solve each one yourself before you
grade an answer to it — in your head, never in the notes.

**Script A — `exp-orbite-i-stabilizatori`**

Cilj: pokazati da razumiješ orbite i stabilizatore na materijalu kojeg u
stablu nema — računom, dokazom i kontraprimjerom.

1. Neka $S_3$ djeluje na skupu parova $X=\{1,2,3\}\times\{1,2,3\}$ po
   pravilu $\sigma\cdot(a,b)=(\sigma(a),\sigma(b))$. Odredi sve orbite i
   njihove veličine, pa za jednu točku iz svake orbite izračunaj njezin
   stabilizator $G_x=\{\sigma\in S_3 : \sigma\cdot x=x\}$ — skup
   permutacija koje tu točku fiksiraju. Što primjećuješ kad pomnožiš
   veličinu orbite s redom stabilizatora?
2. Dokaži da je stabilizator $G_x=\{g\in G : g\cdot x=x\}$ podgrupa od
   $G$ i da za svaki $h\in G$ vrijedi $G_{h\cdot x}=hG_xh^{-1}$. Uz
   svaki korak navedi koji aksiom djelovanja ili grupe koristiš.
3. Što se slomi ako iz definicije djelovanja izbacimo aksiom
   $e\cdot x=x$, a zadržimo $g\cdot(h\cdot x)=(gh)\cdot x$? Konstruiraj
   konkretno takvo „djelovanje" na skupu s dva elementa i pokaži koje od
   triju svojstava relacije „leži u orbiti od" otkaže — ili dokaži da ne
   otkaže nijedno i objasni čemu onda aksiom služi.

**Script B — `thm-lagrange`**

Cilj: pokazati da Lagrangeov teorem znaš upotrijebiti, iz njega dokazati
posljedicu i vidjeti gdje mu je granica.

1. U diedarskoj grupi $D_4$ (simetrije kvadrata, red 8) neka je $H$
   podgrupa generirana jednom osnom refleksijom. Ispiši sve lijeve kosete
   $gH$, element po element, i provjeri da čine particiju od $D_4$ s
   $[D_4:H]=4$. Zatim ispiši desne kosete $Hg$: razlikuju li se od
   lijevih, i za koji $g$?
2. Dokaži: ako je $|G|=p$ prost, onda je $G$ ciklička i svaki njezin
   element osim $e$ generira cijelu grupu. Označi točno korak u kojem
   koristiš Lagrangeov teorem i što bi bez njega ostalo nedokazano.
3. Obrat Lagrangeova teorema ne vrijedi. Pronađi grupu $G$ i djelitelj
   $d$ od $|G|$ za koji $G$ nema podgrupu reda $d$, i dokaži da je nema.
   Koji se korak dokaza Lagrangea ne može „okrenuti" da bi se iz
   djelitelja konstruirala podgrupa?

The tree never names the stabilizer; question 1 of script A defines it,
so the script stands on the tree alone.

### Actions

`answer` or `pause` for a slug with no `sessions/<slug>/` directory —
the start was never handled, or the folder is gone — grades nothing and
creates nothing: finish with `{"state":"error","message":"<one sentence
in the member's language: the session does not exist, start the tutor
again>"}`. The page falls back to *Pokreni tutora* on its next poll.

`start` — if `sessions/<slug>/` already exists, change nothing on disk:
if its `status` is `done`, `answer.md` is the one closed-session line
(as for `answer`); otherwise re-pose the question at `script_index` in
`answer.md`. Finish. Otherwise create the directory, write `state.json`
(`turn` 0, `script_index` 0, `status` active, `tree` = the script's
tree), write `notes.md` with the heading, the goal line, `## Pitanje 1`
and question 1, and write `answer.md` as one line of welcome plus
question 1.

`answer` — `question` is the member's answer. If `status` is `paused`,
set it `active` and delete the trailing `## Pauza` section from
`notes.md` — it was a bookmark, and the question it pointed at is again
the last section — then continue as below. If `status` is `done`, write
a one-line `answer.md` saying the session is closed and a new one can be
started, and finish. Otherwise grade the answer to the question at
`script_index` genuinely, in one turn: say what is right and what is
missing, in the member's language. A slip — a sign, an index, a word
used loosely — is named in one sentence and never triggers re-teaching;
a real gap gets at most one short paragraph pointing at what the
argument needs, never a lecture. Append to `notes.md`, under the current
`## Pitanje n`: the answer verbatim as a blockquote, then your reading.
Push `{turn, question, answer, reply}` onto `log` and advance `turn`.
Then:

- while a question remains (`script_index < 2`): advance
  `script_index`, append `## Pitanje n+1` and the next question to
  `notes.md`, and write `answer.md` = your reading + the next question;
- after the third answer: append `## Zaključak` with a short honest
  paragraph — what the three answers showed, what stayed thin — set
  `status` `done`, and write `answer.md` = your reading + that
  paragraph.

`pause` — on a `done` session, the closed-session line and nothing
else. Otherwise set `status` `paused`; append `## Pauza` to `notes.md`
with a paragraph saying which questions were answered and which one
waits; `answer.md` is one line saying you wrote down where you stopped.
`## Pauza` is the last section for as long as the session is paused; the
resuming `answer` removes it.

Every turn, whatever happened, ends with `status.json`
`{"state":"done","session":"<slug>"}` — optionally with
`"show":{"focus":"<tree>","trees":["<tree>", …its depends]}`, which the
page honours by outlining the focus and brightening the rest. On any
failure, `{"state":"error","message":"<one plain sentence>"}`. Never
leave a request at `thinking`.
