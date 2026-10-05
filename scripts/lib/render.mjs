// The one markdown+math renderer for tree bodies, shared by build-views.mjs
// (tree panels) and serve-vault.mjs (bridge answers). Two copies of the
// math-placeholder dance drifted once before — the line-wrap fix landed in
// one and not the other — so it lives here exactly once.
import katex from "katex";
import { marked } from "marked";

export const WIKILINK = /\[\[([^\[\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderMath(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

function wikilinkHtml(target, label, has) {
  target = target.trim();
  const shown = label ?? target;
  if (!has(target)) return escapeHtml(shown);
  return `<a href="#" class="treelink" data-open="${escapeHtml(target)}">${escapeHtml(shown)}</a>`;
}

// A fenced block tagged `cd`, closing fence on its own line.
const CD_FENCE = /^[ \t]{0,3}```[ \t]*cd[ \t]*\r?\n([\s\S]*?)^[ \t]{0,3}```[ \t]*$/gm;

// Protect math from marked, turn wikilinks into panel-opening anchors when
// their target exists (`has(id)`), then let marked do the rest and splice the
// KaTeX back in. `opts.lang` ("hr" | "en") picks the language of diagram
// captions; it defaults to Croatian like every other UI string here.
export function renderBody(body, has, opts = {}) {
  const chunks = [];
  const blocks = new Set();
  const stash = (html, block) => {
    chunks.push(html);
    if (block) blocks.add(chunks.length - 1);
    return `%%KTX${chunks.length - 1}%%`;
  };
  // Diagrams go first: their corners are bare KaTeX that the $-protection
  // below must not see, and marked must not turn the fence into <pre>. The
  // blank lines make the placeholder its own paragraph, which is unwrapped
  // after marked so the <figure> never sits inside a <p>.
  let text = body.replace(CD_FENCE, (_, src) =>
    `\n\n${stash(renderCd(src, { has, lang: opts.lang }), true)}\n\n`
  );
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) =>
    stash(renderMath(tex.trim(), true))
  );
  // Inline math survives a hard line-wrap (digest bodies wrap ~72 cols) —
  // but a blank line still terminates, so an unpaired $ can't eat a paragraph.
  text = text.replace(/(^|[^\\$])\$((?:[^$\n]|\n(?!\n))+?)\$/g, (m, pre, tex) =>
    pre + stash(renderMath(tex.replace(/\n/g, " "), false))
  );
  text = text.replace(WIKILINK, (_, target, label) => {
    const html = wikilinkHtml(target, label, has);
    return html.startsWith("<a ") ? stash(html) : html;
  });
  let html = marked.parse(text, { async: false });
  html = html.replace(/<p>%%KTX(\d+)%%<\/p>\n?/g, (m, i) =>
    blocks.has(Number(i)) ? chunks[Number(i)] : m
  );
  html = html.replace(/%%KTX(\d+)%%/g, (_, i) => chunks[Number(i)]);
  return html;
}

// ─── Commutative diagrams: the ```cd fence ──────────────────────────────────
//
// One statement per line:
//   % title: <text>                              figure title (data-title), first line only
//   % <comment>
//   NAME @ COL,ROW : KATEX                       a corner
//   [ARROW:] NAME -> NAME : KATEX [opt, opt]     an arrow
//   PATH = PATH : def | [[wikilink]]             an equation; PATH = arrow names, `id` allowed
// Options: above|below|left|right (label side), dashed|dotted (line),
// mono|epi|iso|equal|mapsto|hook|none (head), bend=<-1..1>, shift=<integer>.
//
// Output: <figure class="cd"> > <div class="cd-grid"> (CSS grid of KaTeX
// corners, plus an absolutely positioned <svg class="cd-arrows"> and
// <span class="cd-label"> children) + <figcaption> (equations, errors).
// Geometry is in units of 1/100 em so the SVG viewBox lines up with the em-sized
// grid at any font size: a cell is 700 × 360. No JavaScript is needed to show it.

const CELL_W = 700, CELL_H = 360;
const NODE_HH = 85;
const LABEL_GAP = 20;
const SHIFT_STEP = 35;
const HEAD_L = 30, HEAD_W = 19;
const EQUAL_GAP = 9;
const SIDES = new Set(["above", "below", "left", "right"]);
const LINES = new Set(["dashed", "dotted"]);
const HEADS = new Set(["mono", "epi", "iso", "equal", "mapsto", "hook", "none"]);
const NAME = "[A-Za-z_][\\w']*";
const RE_CORNER = new RegExp(`^(${NAME})\\s*@\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*(?::\\s*(.*))?$`);
const RE_ARROW = new RegExp(`^(?:(${NAME})\\s*:\\s*)?(${NAME})\\s*->\\s*(${NAME})\\s*(?::\\s*(.*))?$`);
const RE_EQUATION = /^([\w'\s]+?)\s*=\s*([\w'\s]+?)\s*(?::\s*(.*))?$/;
// A trailing [...] is an option list only when it cannot be TeX: no
// backslash or dollar inside. `{[a,b]}` keeps a bracket in a label.
const RE_OPTS = /^(.*?)\s*\[([^\[\]\\$]*)\]$/;

const CD_T = {
  hr: {
    commutes: "komutira", byDef: "po definiciji",
    badLine: (l) => `nerazumljiv redak: „${l}”`,
    badOption: (o, a) => `nepoznata opcija „${o}” na strelici ${a}`,
    badBend: (a) => `bend na strelici ${a} mora biti broj između -1 i 1`,
    badShift: (a) => `shift na strelici ${a} mora biti cijeli broj`,
    dupCorner: (n) => `vrh ${n} je zadan dvaput`,
    badCoord: (n) => `vrh ${n}: stupac i red broje se od 0, negativni nisu dopušteni`,
    dupArrow: (n) => `strelica ${n} je zadana dvaput`,
    noCorner: (a, n) => `strelica ${a} spominje nepoznati vrh ${n}`,
    loop: (a, n) => `strelica ${a} ide iz ${n} u ${n}; petlje se ne crtaju`,
    eqArrow: (n) => `jednakost spominje nepoznatu strelicu ${n}`,
    eqChain: (u, v, ut, vf) => `strelice ${u} i ${v} se ne nastavljaju (${u} završava u ${ut}, ${v} počinje u ${vf})`,
    eqEnds: (p, pe, q, qe) => `putovi „${p}” (${pe}) i „${q}” (${qe}) ne dijele krajeve`,
    eqWhy: () => "obrazloženje jednakosti mora biti def ili [[wikilink]]",
  },
  en: {
    commutes: "commutes", byDef: "by definition",
    badLine: (l) => `cannot parse line: "${l}"`,
    badOption: (o, a) => `unknown option "${o}" on arrow ${a}`,
    badBend: (a) => `bend on arrow ${a} must be a number between -1 and 1`,
    badShift: (a) => `shift on arrow ${a} must be an integer`,
    dupCorner: (n) => `corner ${n} is declared twice`,
    badCoord: (n) => `corner ${n}: column and row count from 0, negatives are not allowed`,
    dupArrow: (n) => `arrow ${n} is declared twice`,
    noCorner: (a, n) => `arrow ${a} refers to unknown corner ${n}`,
    loop: (a, n) => `arrow ${a} goes from ${n} to ${n}; loops are not drawn`,
    eqArrow: (n) => `equation names unknown arrow ${n}`,
    eqChain: (u, v, ut, vf) => `arrows ${u} and ${v} do not compose (${u} ends at ${ut}, ${v} starts at ${vf})`,
    eqEnds: (p, pe, q, qe) => `paths "${p}" (${pe}) and "${q}" (${qe}) do not share endpoints`,
    eqWhy: () => "an equation's justification must be def or a [[wikilink]]",
  },
};

export function parseCd(source, lang = "hr") {
  const T = CD_T[lang] ?? CD_T.hr;
  const d = { title: "", corners: [], arrows: [], equations: [], errors: [] };
  const cornerByName = new Map(), arrowByName = new Map();
  let first = true;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const isFirst = first;
    first = false;
    if (line.startsWith("%")) {
      const t = isFirst && /^%\s*title\s*:\s*(.*)$/.exec(line);
      if (t) d.title = t[1].trim();
      continue;
    }
    let m;
    if ((m = RE_CORNER.exec(line))) {
      const [, name, col, row, tex] = m;
      if (cornerByName.has(name)) { d.errors.push(T.dupCorner(name)); continue; }
      if (col.startsWith("-") || row.startsWith("-")) { d.errors.push(T.badCoord(name)); continue; }
      const c = { name, col: Number(col), row: Number(row), tex: (tex ?? "").trim() };
      cornerByName.set(name, c);
      d.corners.push(c);
    } else if ((m = RE_ARROW.exec(line))) {
      const [, name, from, to, rest] = m;
      const a = { name: name ?? null, from, to, tex: (rest ?? "").trim(),
        side: null, line: null, head: null, bend: 0, shift: 0 };
      const shown = name ?? `${from}->${to}`;
      const o = RE_OPTS.exec(a.tex);
      if (o) {
        a.tex = o[1];
        for (const opt of o[2].split(",").map((s) => s.trim()).filter(Boolean)) {
          const kv = /^([a-z]+)\s*=\s*(-?\d+(?:\.\d+)?)$/.exec(opt);
          if (SIDES.has(opt)) a.side = opt;
          else if (LINES.has(opt)) a.line = opt;
          else if (HEADS.has(opt)) a.head = opt;
          else if (kv && kv[1] === "bend") {
            const v = Number(kv[2]);
            if (v < -1 || v > 1) d.errors.push(T.badBend(shown)); else a.bend = v;
          } else if (kv && kv[1] === "shift") {
            if (!Number.isInteger(Number(kv[2]))) d.errors.push(T.badShift(shown)); else a.shift = Number(kv[2]);
          } else d.errors.push(T.badOption(opt, shown));
        }
      }
      if (name && arrowByName.has(name)) { d.errors.push(T.dupArrow(name)); continue; }
      if (name) arrowByName.set(name, a);
      d.arrows.push(a);
    } else if ((m = RE_EQUATION.exec(line))) {
      const [, lhs, rhs, why] = m;
      d.equations.push({
        lhs: lhs.trim().split(/\s+/), rhs: rhs.trim().split(/\s+/), why: (why ?? "").trim(),
      });
    } else d.errors.push(T.badLine(line));
  }
  // Resolve endpoints; an arrow that cannot be placed is dropped with its error.
  d.arrows = d.arrows.filter((a) => {
    const shown = a.name ?? `${a.from}->${a.to}`;
    for (const end of [a.from, a.to]) {
      if (!cornerByName.has(end)) { d.errors.push(T.noCorner(shown, end)); return false; }
    }
    if (a.from === a.to) { d.errors.push(T.loop(shown, a.from)); return false; }
    return true;
  });
  for (const eq of d.equations) checkEquation(eq, arrowByName, T);
  return d;
}

function pathEnds(names, arrowByName, T) {
  let start = null, end = null, prev = null;
  for (const n of names) {
    if (n === "id") continue;
    const a = arrowByName.get(n);
    if (!a) return { error: T.eqArrow(n) };
    if (prev && prev.to !== a.from) return { error: T.eqChain(prev.name, n, prev.to, a.from) };
    if (!prev) start = a.from;
    end = a.to;
    prev = a;
  }
  return { start, end };
}

function checkEquation(eq, arrowByName, T) {
  const L = pathEnds(eq.lhs, arrowByName, T), R = pathEnds(eq.rhs, arrowByName, T);
  const lhs = eq.lhs.join(" "), rhs = eq.rhs.join(" ");
  if (L.error || R.error) { eq.error = L.error ?? R.error; return; }
  // A path of identities alone has no endpoints of its own; it then asks
  // the other side to be a loop.
  const ok = L.start == null ? R.start === R.end
    : R.start == null ? L.start === L.end
    : L.start === R.start && L.end === R.end;
  if (!ok) {
    const span = (p) => (p.start == null ? "id" : `${p.start}→${p.end}`);
    eq.error = T.eqEnds(lhs, span(L), rhs, span(R));
    return;
  }
  if (eq.why !== "def" && !new RegExp(`^${WIKILINK.source}$`).test(eq.why)) eq.error = T.eqWhy();
}

// KaTeX is not measured at build time, so the box an arrow stops at is sized
// from the TeX source: a slot per visible glyph at KaTeX's 1.21 em scale,
// two for a binary operator and its spacing, half for a sub- or superscript.
const BINARY = /\\(times|otimes|oplus|to|rightarrow|mapsto|cong|simeq|circ|cdot|pm|cup|cap|le|leq|ge|geq|in|subset|subseteq)\b|[+\-=<>]/g;
function halfWidth(tex) {
  const s = tex
    .replace(/\\(left|right|quad|qquad|displaystyle|textstyle|mathrm|mathbf|mathcal|mathbb|mathit|operatorname|text|,|;|!)\b/g, "")
    .replace(BINARY, "xx")
    .replace(/\\[A-Za-z]+/g, "x")
    .replace(/[{}\s]/g, "");
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "^" || s[i] === "_") continue;
    n += i > 0 && (s[i - 1] === "^" || s[i - 1] === "_") ? 0.5 : 1;
  }
  return Math.max(85, Math.min(320, 42 * n + 35));
}

const fmt = (v) => String(Math.round(v * 10) / 10);
const pt = (p) => `${fmt(p[0])},${fmt(p[1])}`;
const add = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
const unit = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
// Left of the direction of travel, in screen coordinates (y grows downward):
// for a rightward arrow this is up, as in tikz-cd's "bend left" / "shift left".
const leftOf = (u) => [u[1], -u[0]];

function hitBox(c, u) {
  const tx = u[0] ? c.hw / Math.abs(u[0]) : Infinity;
  const ty = u[1] ? c.hh / Math.abs(u[1]) : Infinity;
  return add([c.x, c.y], u, Math.min(tx, ty));
}

function layoutArrow(a, A, B) {
  const chord = [B.x - A.x, B.y - A.y];
  const u = unit(...chord);
  const nl = leftOf(u);
  let p0, p2;
  if (a.bend) {
    const sag0 = a.bend * 0.25 * Math.hypot(...chord);
    const c0 = add([(A.x + B.x) / 2, (A.y + B.y) / 2], nl, 2 * sag0);
    p0 = hitBox(A, unit(c0[0] - A.x, c0[1] - A.y));
    p2 = hitBox(B, unit(c0[0] - B.x, c0[1] - B.y));
  } else {
    p0 = hitBox(A, u);
    p2 = hitBox(B, [-u[0], -u[1]]);
  }
  p0 = add(p0, nl, a.shift * SHIFT_STEP);
  p2 = add(p2, nl, a.shift * SHIFT_STEP);
  const mid = [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
  const sag = a.bend * 0.25 * Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
  // Quadratic Bézier: the curve's midpoint is (p0 + 2c + p2) / 4, so the
  // control point sits at twice the wanted sagitta.
  const c = add(mid, nl, 2 * sag);
  return {
    p0, p2, c, bent: !!a.bend,
    mid: add(mid, nl, sag),
    u0: a.bend ? unit(c[0] - p0[0], c[1] - p0[1]) : u,
    u2: a.bend ? unit(p2[0] - c[0], p2[1] - c[1]) : u,
  };
}

function shaftD(g, offset = 0) {
  const nl = leftOf(g.u0);
  const o = (p) => (offset ? add(p, nl, offset) : p);
  return g.bent
    ? `M${pt(o(g.p0))} Q${pt(o(g.c))} ${pt(o(g.p2))}`
    : `M${pt(o(g.p0))} L${pt(o(g.p2))}`;
}

// Open barbs meeting at `tip`, `back` units behind the shaft's end.
function barbs(tip, u, back = 0) {
  const t = add(tip, u, -back);
  const n = leftOf(u);
  const b1 = add(add(t, u, -HEAD_L), n, HEAD_W);
  const b2 = add(add(t, u, -HEAD_L), n, -HEAD_W);
  return `M${pt(b1)} L${pt(t)} L${pt(b2)}`;
}

function arrowSvg(a, g) {
  const parts = [];
  const dash = a.line === "dashed" ? ' stroke-dasharray="18 12"' : a.line === "dotted" ? ' stroke-dasharray="0.1 14"' : "";
  if (a.head === "equal") {
    parts.push(`<path class="cd-shaft" d="${shaftD(g, EQUAL_GAP)}"${dash}/>`);
    parts.push(`<path class="cd-shaft" d="${shaftD(g, -EQUAL_GAP)}"${dash}/>`);
  } else {
    parts.push(`<path class="cd-shaft" d="${shaftD(g)}"${dash}/>`);
  }
  if (a.head !== "equal" && a.head !== "none") parts.push(`<path class="cd-head" d="${barbs(g.p2, g.u2)}"/>`);
  if (a.head === "epi") parts.push(`<path class="cd-head" d="${barbs(g.p2, g.u2, 16)}"/>`);
  const n0 = leftOf(g.u0);
  if (a.head === "mapsto") {
    parts.push(`<path class="cd-tail" d="M${pt(add(g.p0, n0, HEAD_W))} L${pt(add(g.p0, n0, -HEAD_W))}"/>`);
  } else if (a.head === "mono") {
    // ↣: a barb at the tail pointing the way the arrow goes.
    const apex = add(g.p0, g.u0, HEAD_L);
    parts.push(`<path class="cd-tail" d="M${pt(add(g.p0, n0, HEAD_W))} L${pt(apex)} L${pt(add(g.p0, n0, -HEAD_W))}"/>`);
  } else if (a.head === "hook") {
    // ↪: a half-circle curling back and to the right of travel (below a
    // rightward arrow); one cubic with 4/3·r handles is close enough.
    const r = 15, nr = [-n0[0], -n0[1]];
    const end = add(g.p0, nr, 2 * r);
    const h1 = add(g.p0, g.u0, -r * 4 / 3), h2 = add(end, g.u0, -r * 4 / 3);
    parts.push(`<path class="cd-tail" d="M${pt(g.p0)} C${pt(h1)} ${pt(h2)} ${pt(end)}"/>`);
  } else if (a.head === "iso") {
    // A tilde on the shaft at its midpoint, over a halo in the page colour so
    // the shaft reads as interrupted.
    const um = unit(g.p2[0] - g.p0[0], g.p2[1] - g.p0[1]);
    const nm = [-um[1], um[0]];
    const loc = (x, y) => add(add(g.mid, um, x), nm, y);
    const d = `M${pt(loc(-18, 3))} C${pt(loc(-12, -11))} ${pt(loc(-5, -11))} ${pt(loc(0, 0))} C${pt(loc(5, 11))} ${pt(loc(12, 11))} ${pt(loc(18, -3))}`;
    parts.push(`<path class="cd-halo" d="${d}"/>`, `<path class="cd-mark" d="${d}"/>`);
  }
  return `<g class="cd-arrow"${a.name ? ` data-name="${escapeHtml(a.name)}"` : ""}>${parts.join("")}</g>`;
}

// The label's anchor sits off the arrow along its normal, so a label beside
// a diagonal clears the line; the CSS transform then hangs the box off the
// anchor on the chosen side. A side along the arrow's own direction is left
// to the CSS alone.
function labelAnchor(g, side) {
  const t = unit(g.p2[0] - g.p0[0], g.p2[1] - g.p0[1]);
  let n = leftOf(t);
  const want = side === "above" ? [0, -1] : side === "below" ? [0, 1] : side === "left" ? [-1, 0] : [1, 0];
  const dot = n[0] * want[0] + n[1] * want[1];
  if (Math.abs(dot) < 1e-6) return g.mid;
  if (dot < 0) n = [-n[0], -n[1]];
  return add(g.mid, n, LABEL_GAP);
}

function defaultSide(u) {
  if (Math.abs(u[0]) >= Math.abs(u[1])) return u[0] > 0 ? "above" : "below";
  return u[1] > 0 ? "right" : "left";
}

// The reader sees the arrows' labels, never their names in the source, so a
// caption states its equation in labels, composed right to left as written
// mathematics does. An arrow drawn without a label has only its name to
// print, and then the whole equation falls back to names.
const COMPOUND_LABEL = /\s|[+\-=<>,]|\\(?:times|circ|otimes|oplus|cdot|to|mapsto|colon)(?![a-zA-Z])/;
function compositeTex(path, arrowByName) {
  const labels = [];
  for (const name of path) {
    if (name === "id") continue;
    const tex = arrowByName.get(name)?.tex;
    if (!tex) return null;
    labels.push(tex);
  }
  if (!labels.length) return "\\mathrm{id}";
  if (labels.length === 1) return labels[0];
  return labels.reverse().map((l) => (COMPOUND_LABEL.test(l) ? `(${l})` : l)).join(" \\circ ");
}
function equationHtml(eq, arrowByName) {
  const lhs = compositeTex(eq.lhs, arrowByName), rhs = compositeTex(eq.rhs, arrowByName);
  return lhs == null || rhs == null ? null : renderMath(`${lhs} = ${rhs}`, false);
}

export function renderCd(source, { has = () => false, lang = "hr" } = {}) {
  const T = CD_T[lang] ?? CD_T.hr;
  const d = parseCd(source, lang);
  const cols = Math.max(1, ...d.corners.map((c) => c.col + 1));
  const rows = Math.max(1, ...d.corners.map((c) => c.row + 1));
  const W = cols * CELL_W, H = rows * CELL_H;
  const byName = new Map();
  const cells = d.corners.map((c) => {
    const { col, row } = c;
    byName.set(c.name, { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H, hw: halfWidth(c.tex), hh: NODE_HH });
    return `<div class="cd-corner" data-name="${escapeHtml(c.name)}" style="grid-area:${row + 1}/${col + 1}">${renderMath(c.tex, false)}</div>`;
  });
  const svg = [], labels = [];
  for (const a of d.arrows) {
    const g = layoutArrow(a, byName.get(a.from), byName.get(a.to));
    svg.push(arrowSvg(a, g));
    if (a.tex) {
      const side = a.side ?? defaultSide(g.u0);
      const at = labelAnchor(g, side);
      const style = `left:${fmt((at[0] / W) * 100)}%;top:${fmt((at[1] / H) * 100)}%`;
      labels.push(`<span class="cd-label cd-${side}"${a.name ? ` data-arrow="${escapeHtml(a.name)}"` : ""} style="${style}">${renderMath(a.tex, false)}</span>`);
    }
  }
  const arrowByName = new Map(d.arrows.filter((a) => a.name).map((a) => [a.name, a]));
  const caption = [];
  if (d.title) caption.push(`<span class="cd-title">${escapeHtml(d.title)}</span>`);
  for (const eq of d.equations) {
    const names = escapeHtml(`${eq.lhs.join(" ")} = ${eq.rhs.join(" ")}`);
    if (eq.error) { caption.push(`<div class="cd-error"><span class="cd-eq-paths">${names}</span>: ${escapeHtml(eq.error)}</div>`); continue; }
    const paths = `<span class="cd-eq-paths" title="${names}">${equationHtml(eq, arrowByName) ?? names}</span>`;
    const why = eq.why === "def"
      ? escapeHtml(T.byDef)
      : eq.why.replace(WIKILINK, (_, target, label) => wikilinkHtml(target, label, has));
    caption.push(`<div class="cd-eq">${escapeHtml(T.commutes)}: ${paths} (${why})</div>`);
  }
  for (const e of d.errors) caption.push(`<div class="cd-error">${escapeHtml(e)}</div>`);
  return `<figure class="cd" data-title="${escapeHtml(d.title)}">` +
    `<div class="cd-grid" style="grid-template-columns:repeat(${cols},7em);grid-template-rows:repeat(${rows},3.6em)">` +
    cells.join("") +
    `<svg class="cd-arrows" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${svg.join("")}</svg>` +
    labels.join("") +
    `</div>` +
    (caption.length ? `<figcaption>${caption.join("")}</figcaption>` : "") +
    `</figure>`;
}

// The figure's stylesheet, for every page that shows a diagram. Colours come
// from the host page's tokens when it has them (the views' --fg, --fg-muted,
// --panel) and fall back to a light theme otherwise.
export function cdCss() {
  return `
.cd { --cd-fg: var(--fg, #1f2328); --cd-muted: var(--fg-muted, #6a737d); --cd-bg: var(--panel, #fff); --cd-error: var(--danger, #d1483b);
  margin: 1em 0; padding: .4em 2em; overflow-x: auto; color: var(--cd-fg); }
.cd-grid { position: relative; display: grid; width: max-content; margin: .3em auto; }
.cd-corner { display: flex; align-items: center; justify-content: center; overflow: visible; white-space: nowrap; }
.cd-arrows { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.cd-arrows path { fill: none; stroke: currentColor; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
.cd-arrows .cd-halo { stroke: var(--cd-bg); stroke-width: 22; }
.cd-label { position: absolute; font-size: .85em; line-height: 1; white-space: nowrap; pointer-events: none; }
.cd-above { transform: translate(-50%, calc(-100% - .12em)); }
.cd-below { transform: translate(-50%, .12em); }
.cd-left { transform: translate(calc(-100% - .15em), -50%); }
.cd-right { transform: translate(.15em, -50%); }
.cd figcaption { font-size: .85em; line-height: 1.5; color: var(--cd-muted); text-align: center; }
.cd-title { display: block; font-weight: 600; color: var(--cd-fg); margin-bottom: .1em; }
.cd-eq-paths { font-family: KaTeX_Math, "Times New Roman", serif; font-style: italic; font-size: 1.1em; }
.cd-error { color: var(--cd-error); }
`;
}
