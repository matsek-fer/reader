// Tests for the ```cd fence in render.mjs — run with
// `node --test scripts/lib/render.test.mjs`. Each test renders one block and
// reads the figure's HTML; nothing here needs a browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cdCss, renderBody, renderCd } from "./render.mjs";

const SQUARE = `% title: ekvivarijantnost
GX @ 0,0 : G\\times X
GY @ 1,0 : G\\times Y
X  @ 0,1 : X
Y  @ 1,1 : Y
a: GX -> GY : \\mathrm{id}_G\\times f [above]
b: GX -> X  : \\alpha [left]
c: GY -> Y  : \\beta [right]
d: X  -> Y  : f [below]
a c = b d : def`;

const COEQUALISER = `GX @ 0,0 : G\\times X
X  @ 1,0 : X
Q  @ 2,0 : X/G
r: GX -> X : \\rho [above, shift=1]
p: GX -> X : \\mathrm{pr}_2 [below, shift=-1]
q: X -> Q : q [above]
r q = p q : def`;

const count = (html, re) => (html.match(re) ?? []).length;
const shaft = (html, name) =>
  new RegExp(`<g class="cd-arrow" data-name="${name}"><path class="cd-shaft" d="([^"]+)"([^>]*)>`).exec(html);

test("the equivariance square: four corners, four arrows, a checked equation, Croatian caption", () => {
  const html = renderCd(SQUARE);
  assert.equal(count(html, /<div class="cd-corner"/g), 4);
  assert.equal(count(html, /<g class="cd-arrow"/g), 4);
  assert.equal(count(html, /<path class="cd-head"/g), 4);
  assert.equal(count(html, /<span class="cd-label/g), 4);
  // The caption speaks in the arrows' labels (β ∘ (id_G × f) = f ∘ α); the
  // source names survive only as the tooltip.
  assert.match(html, /<div class="cd-eq">komutira: <span class="cd-eq-paths" title="a c = b d">.+?∘.+?<\/span> \(po definiciji\)<\/div>/s);
  assert.ok(!html.includes(">a c = b d<"));
  assert.ok(!html.includes("cd-error"));
  assert.ok(html.includes('class="cd-label cd-above" data-arrow="a"'));
  assert.ok(html.includes('class="cd-label cd-left" data-arrow="b"'));
  // The grid is 2 × 2 cells and the overlay's viewBox is the grid in 1/100 em.
  assert.ok(html.includes("grid-template-columns:repeat(2,7em);grid-template-rows:repeat(2,3.6em)"));
  assert.ok(html.includes('viewBox="0 0 1400 720"'));
});

test("the coequaliser: shift=±1 draws two distinct parallel arrows between the same cells", () => {
  const html = renderCd(COEQUALISER);
  assert.equal(count(html, /<g class="cd-arrow"/g), 3);
  const r = shaft(html, "r")[1], p = shaft(html, "p")[1];
  assert.notEqual(r, p);
  const ys = (d) => d.match(/,(-?[\d.]+)/g).map((s) => Number(s.slice(1)));
  // Both are horizontal; r sits 70 units (0.7 em) above p.
  assert.equal(ys(r)[0], ys(r)[1]);
  assert.equal(ys(p)[0], ys(p)[1]);
  assert.equal(ys(p)[0] - ys(r)[0], 70);
  assert.match(html, /komutira: <span class="cd-eq-paths" title="r q = p q">.+?<\/span> \(po definiciji\)/s);
});

test("an unknown option is reported in the figure and the rest still renders", () => {
  const html = renderCd(SQUARE.replace("[above]", "[abov, dashed]"));
  assert.ok(html.includes('<div class="cd-error">nepoznata opcija „abov” na strelici a</div>'));
  assert.equal(count(html, /<div class="cd-corner"/g), 4);
  assert.equal(count(html, /<g class="cd-arrow"/g), 4);
  assert.ok(shaft(html, "a")[2].includes("stroke-dasharray"));
  assert.ok(html.includes("komutira:"));
});

test("an equation whose paths do not share endpoints is reported", () => {
  const html = renderCd(SQUARE.replace("a c = b d : def", "a = b d : def"));
  assert.ok(/<div class="cd-error"><span class="cd-eq-paths">a = b d<\/span>: putovi „a” \(GX→GY\) i „b d” \(GX→Y\) ne dijele krajeve<\/div>/.test(html));
  assert.ok(!html.includes("komutira"));
  const broken = renderCd(SQUARE.replace("a c = b d : def", "a d = b c : def"));
  assert.ok(broken.includes("strelice a i d se ne nastavljaju (a završava u GY, d počinje u X)"));
  const unknown = renderCd(SQUARE.replace("a c = b d : def", "a z = b d : def"));
  assert.ok(unknown.includes("jednakost spominje nepoznatu strelicu z"));
});

test("a wikilink justification becomes a panel anchor when the tree exists", () => {
  const src = SQUARE.replace(": def", ": [[thm-orbit-stabilizer]]");
  const linked = renderCd(src, { has: (id) => id === "thm-orbit-stabilizer" });
  assert.match(linked, /komutira: <span class="cd-eq-paths" title="a c = b d">.+?<\/span> \(<a href="#" class="treelink" data-open="thm-orbit-stabilizer">thm-orbit-stabilizer<\/a>\)/s);
  const plain = renderCd(src);
  assert.ok(plain.includes("(thm-orbit-stabilizer)"));
  const bad = renderCd(SQUARE.replace(": def", ": because"));
  assert.ok(bad.includes("obrazloženje jednakosti mora biti def ili [[wikilink]]"));
});

test("a dashed mono arrow and a bent arrow have distinct path data", () => {
  const html = renderCd(`X @ 0,0 : X
Y @ 1,0 : Y
a: X -> Y : f [dashed, mono]
b: X -> Y : g [bend=0.6, below]`);
  const a = shaft(html, "a"), b = shaft(html, "b");
  assert.ok(a[2].includes('stroke-dasharray="18 12"'));
  assert.ok(!b[2].includes("stroke-dasharray"));
  assert.ok(a[1].startsWith("M") && a[1].includes(" L"));
  assert.ok(b[1].includes(" Q"));
  assert.notEqual(a[1], b[1]);
  assert.ok(/<g class="cd-arrow" data-name="a">.*?<path class="cd-tail"/.test(html));
});

test("every head option renders, equal has no head, epi has two", () => {
  const heads = ["mono", "epi", "iso", "equal", "mapsto", "hook", "none"];
  for (const h of heads) {
    const html = renderCd(`X @ 0,0 : X\nY @ 1,0 : Y\na: X -> Y : f [${h}]`);
    assert.ok(!html.includes("cd-error"), h);
    const n = count(html, /<path class="cd-head"/g);
    assert.equal(n, h === "epi" ? 2 : h === "equal" || h === "none" ? 0 : 1, h);
  }
  assert.equal(count(renderCd("X @ 0,0 : X\nY @ 1,0 : Y\na: X -> Y : [equal]"), /<path class="cd-shaft"/g), 2);
  assert.ok(renderCd("X @ 0,0 : X\nY @ 1,0 : Y\na: X -> Y : [iso]").includes('class="cd-halo"'));
});

test("the title comment lands in data-title", () => {
  assert.ok(renderCd(SQUARE).startsWith('<figure class="cd" data-title="ekvivarijantnost">'));
  assert.ok(renderCd("X @ 0,0 : X").startsWith('<figure class="cd" data-title="">'));
});

test("a title anywhere but the first line is a plain comment", () => {
  const html = renderCd("X @ 0,0 : X\n% title: kasno");
  assert.ok(html.startsWith('<figure class="cd" data-title="">'));
  assert.ok(!html.includes("kasno"));
  assert.ok(renderCd("\n  % title: prvi\nX @ 0,0 : X").startsWith('<figure class="cd" data-title="prvi">'));
});

test("a negative coordinate is an error in the figure; the rest still renders", () => {
  const html = renderCd("A @ -1,0 : A\nB @ 0,0 : B\nC @ 1,0 : C\nf: B -> C : f");
  assert.ok(html.includes("vrh A: stupac i red broje se od 0"));
  assert.equal(count(html, /class="cd-corner"/g), 2);
  assert.ok(html.includes("grid-template-columns:repeat(2,7em)"));
  assert.ok(renderCd("A @ 0,-2 : A", { lang: "en" }).includes("corner A: column and row count from 0"));
});

test("input text never reaches the output as raw markup", () => {
  const html = renderCd(`% title: <script>alert(1)</script>
A @ 0,0 : <script>x</script>
B @ 1,0 : B
f: A -> B : <b>f</b> [<i>]
<script>bad</script>
f = f : [[<x>]]`);
  assert.ok(!html.includes("<script"));
  assert.ok(!html.includes("<b>"));
  assert.ok(!html.includes("<i>"));
  assert.ok(!html.includes("<x>"));
  assert.ok(html.includes('data-title="&lt;script&gt;alert(1)&lt;/script&gt;"'));
});

test("malformed lines, unknown corners, loops and duplicates each name the culprit", () => {
  const html = renderCd(`A @ 0,0 : A
A @ 1,0 : A'
B @ 1,0 : B
f: A -> Z : f
g: A -> A : g
h: A -> B : h [bend=2]
what is this`);
  for (const msg of [
    "vrh A je zadan dvaput",
    "strelica f spominje nepoznati vrh Z",
    "strelica g ide iz A u A; petlje se ne crtaju",
    "bend na strelici h mora biti broj između -1 i 1",
    "nerazumljiv redak: „what is this”",
  ]) assert.ok(html.includes(msg), msg);
  assert.equal(count(html, /<g class="cd-arrow"/g), 1);
});

test("an English vault gets English captions and errors", () => {
  const html = renderCd(SQUARE + "\nz: X -> Y : z [sideways]", { lang: "en" });
  assert.match(html, /commutes: <span class="cd-eq-paths" title="a c = b d">.+?<\/span> \(by definition\)/s);
  assert.ok(html.includes("unknown option &quot;sideways&quot; on arrow z"));
});

test("renderBody splices the figure in, leaves other fences alone and still renders math around it", () => {
  const body = `Prije $x^2$ i [[def-group]].

\`\`\`cd
${SQUARE}
\`\`\`

\`\`\`js
let a = 1;
\`\`\`

Poslije $$\\int f$$.`;
  const html = renderBody(body, (id) => id === "def-group");
  assert.equal(count(html, /<figure class="cd"/g), 1);
  assert.ok(!html.includes("<p><figure"));
  assert.ok(html.includes('<pre><code class="language-js">let a = 1;'));
  assert.ok(html.includes('class="treelink" data-open="def-group"'));
  assert.ok(html.includes("katex-display"));
  assert.ok(html.includes("komutira:"));
  const en = renderBody("```cd\n" + SQUARE + "\n```", () => false, { lang: "en" });
  assert.ok(en.includes("commutes:"));
  // A cd fence directly under a paragraph line still becomes its own figure.
  const tight = renderBody("Tekst\n```cd\nA @ 0,0 : A\n```\n", () => false);
  assert.ok(tight.includes("<p>Tekst</p>"));
  assert.ok(!tight.includes("<p><figure"));
});

test("cdCss covers every class the figure emits", () => {
  const css = cdCss();
  for (const cls of ["cd", "cd-grid", "cd-corner", "cd-arrows", "cd-halo", "cd-label", "cd-above", "cd-below", "cd-left", "cd-right", "cd-title", "cd-eq-paths", "cd-error"]) {
    assert.ok(css.includes(`.${cls}`), cls);
  }
});
