// filter.mjs — the forest view's filter engine: a declarative expression over
// one vault's trees, objects and arrows, evaluated to a set of ids.
//
// WHY a language and not buttons. The two tabs a vault already has are
// themselves filters over one body of material — Redoslijed keeps the
// `depends` DAG, Struktura keeps the arrows — and the canvas of a real vault
// carries more arrows than anyone can read at once. So the primitive is a
// filter, the ready-made chips in the page's top bar are nothing but stored
// expressions, and a natural-language layer later needs no new machinery: it
// emits an expression and calls the same entry point the chips call.
//
// The grammar is JSON, documented in docs/forest-format.md (§ Filters over a
// view). An expression is an object; one key is a predicate or a combinator,
// several keys are their conjunction:
//
//   {"and": [{"level": "instance"}, {"kind-of": "obj-field"}]}
//   {"level": "instance", "kind-of": "obj-field"}          the same thing
//   {"not": {"arrow-kind": "hom"}}
//
// This module is BOTH a Node module (tested by filter.test.mjs) and the page's
// own evaluator: build-views.mjs reads this file, strips its single trailing
// `export` line and inlines the rest, the way it already inlines
// lib/client/forest.js. So: no imports, no top-level await, nothing but
// declarations above the export line, and browser-safe syntax (ES6, no `?.`).

// The closed sets the format defines. A value outside one of these is a
// mistake worth saying out loud rather than a filter that quietly matches
// nothing — the same reason lib/validation.ts guards an enum before it reaches
// a query.
const ARROW_KINDS = [
  "data", "transform", "extract", "property", "instance",
  "generalizes", "construction", "hom",
];
const LEVELS = ["kind", "instance"];
const TAXA = [
  "theorem", "lemma", "proposition", "corollary", "definition", "axiom",
  "proof", "example", "exercise", "exposition", "motivation", "intuition",
  "remark", "connection", "object", "morphism",
];

// The predicate table is also the documentation a natural-language layer gets
// from forestFilter.describe(): name, what the argument is, and one line of
// Croatian saying what it keeps.
const PREDICATES = [
  { name: "level", arg: "kind | instance", hr: "jedna razina: kutije i strelice među njima" },
  { name: "kind-of", arg: "<obj- id>", hr: "primjeri zadane vrste" },
  { name: "arrow-kind", arg: ARROW_KINDS.join(" | "), hr: "strelice jedne vrste" },
  { name: "tied-to", arg: "<obj- ili mor- id>", hr: "sve što visi o jednoj strukturi" },
  { name: "in-data-of", arg: "<obj- id>", hr: "definicijski dijagram jedne vrste" },
  { name: "region", arg: "<token>", hr: "jedno područje platna" },
  { name: "about", arg: "<id bilo kojeg stabla>", hr: "most preko `about`, u oba smjera" },
  { name: "taxon", arg: TAXA.join(" | "), hr: "stabla jednog taksona" },
  { name: "id", arg: "<id>", hr: "točno jedno stablo" },
  { name: "text", arg: "<podniz>", hr: "id ili naslov sadrži tekst" },
  { name: "and", arg: "[izraz, …]", hr: "sve mora vrijediti" },
  { name: "or", arg: "[izraz, …]", hr: "barem jedno mora vrijediti" },
  { name: "not", arg: "izraz", hr: "obrat" },
];

const COMBINATORS = ["and", "or", "not"];
// A filter in the URL hash: #filter=<urlencoded JSON>[&hide=1][&tab=structure].
const HASH_KEY = "filter";
const MAX_DEPTH = 12;

// --------------------------------------------------------------------- graph

// One node table out of the page's two blobs: window.FOREST.nodes (every tree)
// and window.STRUCTURE (the objects and arrows, absent in a 0.1 vault). The
// evaluator sees nothing else, so the same table is what a test builds by hand.
//
// A 0.2 vault's typed object is read as 0.3's instance of its `type` — the
// migration recipe says they are the same thing — so `level` and `kind-of`
// answer on both versions.
function buildGraph(input) {
  const src = input || {};
  const nodes = src.nodes || {};
  const S = src.structure || null;
  const node = {};
  const ids = Object.keys(nodes).sort();
  ids.forEach(function (id) {
    const t = nodes[id] || {};
    node[id] = {
      id: id,
      taxon: t.taxon || "",
      title: String(t.title == null ? "" : t.title),
      region: t.region || "",
      about: [],
      group: t.group == null ? null : t.group,
    };
  });
  // `about` is kept only where it resolves, as the views already do: a dead
  // pointer is the validator's business, not the filter's.
  ids.forEach(function (id) {
    const raw = (nodes[id] || {}).about;
    if (!Array.isArray(raw)) return;
    node[id].about = raw.filter(function (x) {
      return typeof x === "string" && node[x];
    });
  });

  if (S) {
    (S.objects || []).forEach(function (o) {
      const n = node[o.id];
      if (!n) return;
      // 0.3 says the level outright; in 0.2 a `type` is what says it.
      if (o.level === "kind" || o.level === "instance") n.level = o.level;
      else n.level = o.type ? "instance" : "kind";
      const of = o.level ? o.of : o.type;
      if (of && node[of]) n.of = of;
      if (Array.isArray(o.data)) {
        n.data = o.data.filter(function (x) { return !!node[x]; });
      }
      if (!n.region && o.region) n.region = o.region;
    });
    (S.arrows || []).forEach(function (a) {
      const n = node[a.id];
      if (!n) return;
      n.kind = a.kind;
      // `pt` in a 0.2 instance arrow is no tree, so it stays a bare string and
      // every predicate below asks node[...] before it follows an end.
      n.from = a.from;
      n.to = a.to;
    });
  }

  const aboutOf = {};
  ids.forEach(function (id) {
    node[id].about.forEach(function (target) {
      (aboutOf[target] = aboutOf[target] || []).push(id);
    });
  });

  const objects = ids.filter(function (id) { return node[id].taxon === "object"; });
  const arrows = ids.filter(function (id) { return node[id].taxon === "morphism"; });
  const regionIds = [];
  const declared = (S && S.regions) || src.regions || [];
  declared.forEach(function (r) {
    if (r && typeof r.id === "string" && regionIds.indexOf(r.id) < 0) regionIds.push(r.id);
  });
  ids.forEach(function (id) {
    const r = node[id].region;
    if (r && regionIds.indexOf(r) < 0) regionIds.push(r);
  });
  const regionTitle = {};
  declared.forEach(function (r) {
    if (r && typeof r.id === "string") regionTitle[r.id] = String(r.title == null ? r.id : r.title);
  });

  return {
    ids: ids,
    node: node,
    aboutOf: aboutOf,
    objects: objects,
    arrows: arrows,
    trees: ids.filter(function (id) {
      return node[id].taxon !== "object" && node[id].taxon !== "morphism";
    }),
    regions: regionIds.map(function (id) {
      return { id: id, title: regionTitle[id] || id };
    }),
    arrowKinds: ARROW_KINDS.filter(function (k) {
      return arrows.some(function (id) { return node[id].kind === k; });
    }),
    levels: LEVELS.filter(function (l) {
      return objects.some(function (id) { return node[id].level === l; });
    }),
    taxa: TAXA.filter(function (t) {
      return ids.some(function (id) { return node[id].taxon === t; });
    }),
  };
}

// --------------------------------------------------------------- the node sets
// Three predicates answer with a precomputed set rather than a test per node,
// because each is a small walk of the structure graph and the walk is the same
// for every node the expression is asked about.

// tied-to: everything attached to one structure. For an object: itself, its
// arrows in and out, its instances (or, from an instance, its kind), the
// entries of its defining diagram, and then every arrow whose two ends are
// already in the set — which is what makes a kind's whole neighbourhood read
// as a picture and not as a star. For an arrow: itself and its two ends.
function tiedTo(graph, id) {
  const set = {};
  const n = graph.node[id];
  if (!n) return set;
  set[id] = true;
  if (n.taxon === "morphism") {
    if (graph.node[n.from]) set[n.from] = true;
    if (graph.node[n.to]) set[n.to] = true;
    return set;
  }
  if (n.taxon !== "object") return set;
  if (n.of) set[n.of] = true;
  (n.data || []).forEach(function (x) {
    set[x] = true;
    const d = graph.node[x];
    if (d && d.taxon === "morphism") {
      if (graph.node[d.from]) set[d.from] = true;
      if (graph.node[d.to]) set[d.to] = true;
    }
  });
  graph.objects.forEach(function (o) {
    if (graph.node[o].of === id) set[o] = true;
  });
  graph.arrows.forEach(function (a) {
    const e = graph.node[a];
    if (e.from === id || e.to === id) set[a] = true;
  });
  graph.arrows.forEach(function (a) {
    const e = graph.node[a];
    if (set[e.from] && set[e.to]) set[a] = true;
  });
  return set;
}

// in-data-of: one kind's defining diagram — the kind, the ids it lists, and the
// ends of the arrows it lists. The same set the panel's "Prikaži definiciju na
// platnu" button already focuses, so the two agree.
function inDataOf(graph, id) {
  const set = {};
  const n = graph.node[id];
  if (!n) return set;
  set[id] = true;
  (n.data || []).forEach(function (x) {
    set[x] = true;
    const d = graph.node[x];
    if (d && d.taxon === "morphism") {
      if (graph.node[d.from]) set[d.from] = true;
      if (graph.node[d.to]) set[d.to] = true;
    }
  });
  return set;
}

// about: the bridge between the requirements DAG and the structure graph, and
// deliberately SYMMETRIC — the one relation read in both directions. From a
// theorem it gives the objects and arrows the theorem is about; from an object
// it gives the trees that are about it; either way the id itself is in, so a
// picked node is lit on both tabs. One predicate therefore serves both halves
// of the cross-link instead of two that could drift apart.
function aboutSet(graph, id) {
  const set = {};
  if (!graph.node[id]) return set;
  set[id] = true;
  graph.node[id].about.forEach(function (x) { set[x] = true; });
  (graph.aboutOf[id] || []).forEach(function (x) { set[x] = true; });
  return set;
}

// A region keeps the trees and boxes that say they are in it, plus an arrow
// with no region of its own whose two ends are both inside — an arrow drawn
// wholly within one area belongs to it, and saying so is what makes a region
// chip light a subgraph rather than a scatter of boxes.
function inRegion(graph, n, token) {
  if (n.region) return n.region === token;
  if (n.taxon !== "morphism") return false;
  const a = graph.node[n.from], b = graph.node[n.to];
  return !!a && !!b && a.region === token && b.region === token;
}

// -------------------------------------------------------------- the evaluator

function problem(code, detail, fatal) {
  return { code: code, detail: detail == null ? "" : String(detail), fatal: !!fatal };
}

// Croatian, because it is shown in the filter bar. Code is English.
function problemText(p) {
  const d = p.detail;
  switch (p.code) {
    case "not-an-object": return 'filtar mora biti JSON objekt, npr. {"level": "instance"}';
    case "empty": return "prazan filtar";
    case "unknown-predicate": return "nepoznat predikat: " + d;
    case "bad-argument": return "predikat " + d + " je dobio pogrešnu vrstu vrijednosti";
    case "bad-value": return "nedopuštena vrijednost: " + d;
    case "too-deep": return "filtar je ugniježđen predubokо";
    case "unknown-id": return "nijedno stablo nema id " + d;
    case "no-data": return d + " nije vrsta s definicijskim dijagramom";
    case "bad-json": return "neispravan JSON: " + d;
    default: return p.code + (d ? ": " + d : "");
  }
}

function quote(v) { return '"' + String(v) + '"'; }

// Compiles one expression into a node test, collecting every problem it meets
// instead of throwing: a filter with one bad key still says what is wrong with
// it, and the page can refuse to apply it while keeping the view intact.
function compile(expr, graph, problems, depth) {
  const no = function () { return false; };
  if (depth > MAX_DEPTH) {
    problems.push(problem("too-deep", "", true));
    return no;
  }
  if (Array.isArray(expr)) {
    return compile({ and: expr }, graph, problems, depth);
  }
  if (!expr || typeof expr !== "object") {
    problems.push(problem("not-an-object", "", true));
    return no;
  }
  const keys = Object.keys(expr);
  if (!keys.length) {
    problems.push(problem("empty", "", true));
    return no;
  }
  // Several keys in one object are their conjunction — the short form an NL
  // layer reaches for, and it binds tighter than any combinator around it.
  if (keys.length > 1) {
    return compile(
      { and: keys.map(function (k) { const one = {}; one[k] = expr[k]; return one; }) },
      graph, problems, depth
    );
  }

  const key = keys[0], val = expr[key];
  if (COMBINATORS.indexOf(key) >= 0) {
    if (key === "not") {
      const inner = compile(val, graph, problems, depth + 1);
      return function (n) { return !inner(n); };
    }
    if (!Array.isArray(val)) {
      problems.push(problem("bad-argument", quote(key), true));
      return no;
    }
    const parts = val.map(function (e) { return compile(e, graph, problems, depth + 1); });
    // {"and": []} is the identity (everything), {"or": []} the empty set.
    if (key === "and") {
      return function (n) {
        return parts.every(function (p) { return p(n); });
      };
    }
    return function (n) {
      return parts.some(function (p) { return p(n); });
    };
  }

  if (PREDICATES.every(function (p) { return p.name !== key; })) {
    problems.push(problem("unknown-predicate", quote(key), true));
    return no;
  }
  if (typeof val !== "string") {
    problems.push(problem("bad-argument", quote(key), true));
    return no;
  }

  switch (key) {
    case "level": {
      if (LEVELS.indexOf(val) < 0) {
        problems.push(problem("bad-value", "level=" + quote(val) + " (" + LEVELS.join(", ") + ")", true));
        return no;
      }
      // A level is not only a register of boxes: the format's own table of
      // which level each arrow touches makes an arrow belong to the level of
      // its two ends — a construction joins two kinds, a hom two instances.
      // So `level: kind` is the structure layer AND the relationships inside
      // it, which is what "the relationships between the structures, instead
      // of specific instances" asks for; `level: instance` is the named
      // objects and the maps between them.
      return function (n) {
        if (n.taxon === "object") return n.level === val;
        if (n.taxon !== "morphism") return false;
        const a = graph.node[n.from], b = graph.node[n.to];
        return !!a && !!b && a.level === val && b.level === val;
      };
    }
    case "arrow-kind": {
      if (ARROW_KINDS.indexOf(val) < 0) {
        problems.push(problem("bad-value", "arrow-kind=" + quote(val) + " (" + ARROW_KINDS.join(", ") + ")", true));
        return no;
      }
      return function (n) { return n.taxon === "morphism" && n.kind === val; };
    }
    case "taxon": {
      if (TAXA.indexOf(val) < 0) {
        problems.push(problem("bad-value", "taxon=" + quote(val), true));
        return no;
      }
      return function (n) { return n.taxon === val; };
    }
    case "kind-of": {
      if (!graph.node[val]) problems.push(problem("unknown-id", quote(val), false));
      return function (n) { return n.level === "instance" && n.of === val; };
    }
    case "tied-to": {
      if (!graph.node[val]) problems.push(problem("unknown-id", quote(val), false));
      const set = tiedTo(graph, val);
      return function (n) { return !!set[n.id]; };
    }
    case "in-data-of": {
      if (!graph.node[val]) problems.push(problem("unknown-id", quote(val), false));
      else if (!(graph.node[val].data || []).length) problems.push(problem("no-data", quote(val), false));
      const set = inDataOf(graph, val);
      return function (n) { return !!set[n.id]; };
    }
    case "about": {
      if (!graph.node[val]) problems.push(problem("unknown-id", quote(val), false));
      const set = aboutSet(graph, val);
      return function (n) { return !!set[n.id]; };
    }
    case "region":
      return function (n) { return inRegion(graph, n, val); };
    case "id": {
      if (!graph.node[val]) problems.push(problem("unknown-id", quote(val), false));
      return function (n) { return n.id === val; };
    }
    case "text": {
      const needle = val.toLowerCase();
      if (!needle) return function () { return true; };
      return function (n) {
        return n.id.toLowerCase().indexOf(needle) >= 0 ||
          n.title.toLowerCase().indexOf(needle) >= 0;
      };
    }
    default:
      problems.push(problem("unknown-predicate", quote(key), true));
      return no;
  }
}

// The one entry point: a set of matched ids, the problems met on the way, and
// the split the page's counter reads. `fatal` means the expression could not be
// understood — the caller leaves the view alone and shows the message.
function evaluate(expr, graph) {
  const problems = [];
  const test = compile(expr, graph, problems, 0);
  const fatal = problems.some(function (p) { return p.fatal; });
  const ids = {};
  let objects = 0, arrows = 0, trees = 0;
  if (!fatal) {
    graph.ids.forEach(function (id) {
      const n = graph.node[id];
      if (!test(n)) return;
      ids[id] = true;
      if (n.taxon === "object") objects++;
      else if (n.taxon === "morphism") arrows++;
      else trees++;
    });
  }
  return {
    ids: ids,
    problems: problems,
    fatal: fatal,
    count: { objects: objects, arrows: arrows, trees: trees, total: objects + arrows + trees },
  };
}

function parseExpr(text) {
  const s = String(text == null ? "" : text).trim();
  if (!s) return { expr: null, problems: [problem("empty", "", true)] };
  let expr = null;
  try {
    expr = JSON.parse(s);
  } catch (e) {
    return { expr: null, problems: [problem("bad-json", e.message, true)] };
  }
  return { expr: expr, problems: [] };
}

// -------------------------------------------------------------- saying it back

// A Croatian one-liner for the bar and for an NL layer reading describe().
// Titles beat ids where a title exists, because this line is read, not parsed.
function describeExpr(expr, graph) {
  const name = function (id) {
    const n = graph && graph.node[id];
    return n && n.title ? n.title : id;
  };
  if (Array.isArray(expr)) return describeExpr({ and: expr }, graph);
  if (!expr || typeof expr !== "object") return "?";
  const keys = Object.keys(expr);
  if (!keys.length) return "?";
  if (keys.length > 1) {
    return keys.map(function (k) {
      const one = {}; one[k] = expr[k];
      return describeExpr(one, graph);
    }).join(" i ");
  }
  const key = keys[0], val = expr[key];
  if (key === "and" || key === "or") {
    const parts = (Array.isArray(val) ? val : []).map(function (e) {
      const s = describeExpr(e, graph);
      return Object.keys(e || {}).length > 1 ? "(" + s + ")" : s;
    });
    if (!parts.length) return key === "and" ? "sve" : "ništa";
    return parts.join(key === "and" ? " i " : " ili ");
  }
  if (key === "not") return "ne " + describeExpr(val, graph);
  switch (key) {
    case "level": return val === "kind" ? "vrste struktura i odnosi među njima" : "primjeri i preslikavanja među njima";
    case "kind-of": return "primjeri vrste " + name(val);
    case "arrow-kind": return "strelice vrste " + val;
    case "tied-to": return "sve oko " + name(val);
    case "in-data-of": return "definicija vrste " + name(val);
    case "region": {
      const r = graph && graph.regions.filter(function (x) { return x.id === val; })[0];
      return "područje " + (r ? r.title : val);
    }
    case "about": return "oko " + name(val) + " (preko about)";
    case "taxon": return "takson " + val;
    case "id": return name(val);
    case "text": return "tekst „" + val + "”";
    default: return key + "=" + String(val);
  }
}

// The ready-made chips, built from the vault's own data: one per region it
// declares, one per arrow kind it actually uses, the two levels, and one per
// taxon present — so a 0.1 vault with no structure layer still has a useful
// tray. Labels come from the page (it owns the Croatian words for kinds and
// taxa); ids stand in when a label is missing.
function chipsFor(graph, labels) {
  const L = labels || {};
  const kindHr = L.kinds || {};
  const taxonHr = L.taxa || {};
  const out = [];
  // The kind chip is the one the owner asked for by the wrong name: not "all
  // categories" but the structure layer and the relationships inside it, with
  // the named examples dimmed away.
  if (graph.levels.indexOf("kind") >= 0) {
    out.push({
      id: "level-kind", group: "razine",
      label: "strukture i odnosi među njima", expr: { level: "kind" },
    });
  }
  if (graph.levels.indexOf("instance") >= 0) {
    out.push({
      id: "level-instance", group: "razine",
      label: "primjeri i preslikavanja među njima", expr: { level: "instance" },
    });
  }
  if (graph.arrowKinds.indexOf("hom") >= 0) {
    out.push({ id: "only-hom", group: "razine", label: "samo morfizmi", expr: { "arrow-kind": "hom" } });
  }
  graph.regions.forEach(function (r) {
    out.push({ id: "region-" + r.id, group: "područja", label: r.title, expr: { region: r.id } });
  });
  graph.arrowKinds.forEach(function (k) {
    out.push({
      id: "kind-" + k, group: "vrste strelica",
      label: kindHr[k] || k, expr: { "arrow-kind": k },
    });
  });
  graph.taxa.forEach(function (t) {
    out.push({
      id: "taxon-" + t, group: "taksoni",
      label: taxonHr[t] || t, expr: { taxon: t },
    });
  });
  return out;
}

// What an outside caller — a skill, a model — needs in order to write a valid
// expression for THIS vault without reading the vault: the grammar, and the
// vocabulary the grammar's arguments come from.
function vocabulary(graph) {
  return {
    predicates: PREDICATES.map(function (p) {
      return { name: p.name, arg: p.arg, hr: p.hr };
    }),
    levels: graph.levels.slice(),
    arrowKinds: graph.arrowKinds.slice(),
    taxa: graph.taxa.slice(),
    regions: graph.regions.map(function (r) { return { id: r.id, title: r.title }; }),
    objects: graph.objects.map(function (id) {
      const n = graph.node[id];
      return { id: id, title: n.title, level: n.level || null, of: n.of || null, region: n.region || null };
    }),
    arrows: graph.arrows.map(function (id) {
      const n = graph.node[id];
      return { id: id, title: n.title, kind: n.kind || null, from: n.from || null, to: n.to || null };
    }),
    counts: {
      objects: graph.objects.length,
      arrows: graph.arrows.length,
      trees: graph.trees.length,
      total: graph.ids.length,
    },
  };
}

const FOREST_FILTER = {
  buildGraph: buildGraph, evaluate: evaluate, parseExpr: parseExpr,
  describeExpr: describeExpr, problemText: problemText, chipsFor: chipsFor,
  vocabulary: vocabulary, tiedTo: tiedTo, inDataOf: inDataOf, aboutSet: aboutSet,
  PREDICATES: PREDICATES, ARROW_KINDS: ARROW_KINDS, LEVELS: LEVELS, TAXA: TAXA,
  HASH_KEY: HASH_KEY,
};

export { FOREST_FILTER as default, buildGraph, evaluate, parseExpr, describeExpr, problemText, chipsFor, vocabulary, tiedTo, inDataOf, aboutSet, PREDICATES, ARROW_KINDS, LEVELS, TAXA, HASH_KEY };
