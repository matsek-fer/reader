(function () {
  'use strict';
  var F = window.FOREST, G = F.geom;
  var svg = document.getElementById('svg');
  var world = document.getElementById('world');
  var expanded = {};
  F.groups.forEach(function (g, i) { expanded[g.id] = i === 0; });
  var showPrf = false;
  var showExr = F.showExrDefault;
  var selected = null;

  // Each group's frame, recomputed from the precomputed variant
  // coordinates on every toggle; nodes carry their own transforms.
  var frames = {};
  function variantKey() { return (showExr ? '1' : '0') + (showPrf ? '1' : '0'); }
  function vk(prf, exr) { return (exr ? '1' : '0') + (prf ? '1' : '0'); }

  function nodeSize(id) {
    var prf = F.nodes[id].taxon === 'proof';
    return prf ? [G.PRF_W, G.PRF_H] : [G.NODE_W, G.NODE_H];
  }

  function relayout() {
    frames = {};
    var y = 20, x = 20;
    var key = variantKey();
    F.groups.forEach(function (g) {
      var el = document.getElementById('grp-' + g.id);
      var v = g.variants[key];
      var open = expanded[g.id] && v.w > 0;
      var w = open ? v.w + 2 * G.PAD : G.COLLAPSED_W;
      var h = open ? G.HEADER_H + v.h + 2 * G.PAD : G.HEADER_H;
      frames[g.id] = { x: x, y: y, w: w, h: h, open: open };
      el.setAttribute('transform', 'translate(' + x + ',' + y + ')');
      var box = el.querySelector('.grp-box');
      box.setAttribute('width', w); box.setAttribute('height', h);
      var hrect = el.querySelector('.grp-hrect');
      hrect.setAttribute('width', w); hrect.setAttribute('height', G.HEADER_H);
      el.querySelector('.grp-arrow').textContent = open ? '▾' : '▸';
      el.querySelector('.grp-count').setAttribute('x', w - 12);
      el.querySelector('.grp-count').setAttribute('text-anchor', 'end');
      fitGroupTitle(g.id, w);
      var content = el.querySelector('.grp-content');
      content.setAttribute('transform', 'translate(' + G.PAD + ',' + (G.HEADER_H + G.PAD) + ')');
      content.style.display = open ? '' : 'none';
      content.querySelectorAll('.node').forEach(function (n) {
        var id = n.getAttribute('data-id');
        var p = v.pos[id];
        var isPrf = F.nodes[id].taxon === 'proof';
        var hidden = !p || (isPrf && !showPrf) ||
          (F.nodes[id].taxon === 'exercise' && !showExr);
        n.style.display = hidden ? 'none' : '';
        if (!hidden) {
          n.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ')');
        }
        var badge = n.querySelector('.prfbadge');
        if (badge) badge.style.display = showPrf ? 'none' : '';
      });
      y += h + 26;
    });
    applyStates();
    applySearch();
  }

  // --- reading states -----------------------------------------------------
  // savladano: the reader marked it. spremno: every id in its FULL depends
  // list is savladano (vacuously true for roots). nije spremno: otherwise.
  var done = {};
  var storageOk = true;
  function stateOf(id) {
    if (done[id]) return 'done';
    var deps = F.deps[id] || [];
    for (var i = 0; i < deps.length; i++) {
      if (!done[deps[i]]) return 'not';
    }
    return 'ready';
  }
  function loadProgress() {
    var raw = null;
    try { raw = localStorage.getItem(F.progressKey); }
    catch (e) { storageOk = false; }
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      if (p && p.v === 1 && p.done && p.done.forEach) {
        p.done.forEach(function (id) { if (F.nodes[id]) done[id] = true; });
      }
    } catch (e) { /* corrupt entry: start clean, overwritten on next save */ }
  }
  function saveProgress() {
    if (!storageOk) return;
    try {
      localStorage.setItem(F.progressKey,
        JSON.stringify({ v: 1, done: Object.keys(done).sort() }));
    } catch (e) { storageOk = false; storageNotice(); }
  }
  function storageNotice() {
    document.getElementById('storage-note').textContent =
      'Napredak se ne može trajno spremiti — vrijedi samo dok je stranica otvorena.';
  }

  // The count text ("12/21 savladano") is right-anchored at the bar's edge and
  // the title left-anchored at x=30; on a collapsed 380px bar a long group
  // name would run straight through it. getComputedTextLength is the only
  // honest measure of SVG text, so trim against it and keep the full name in
  // the <title> tooltip.
  function fitGroupTitle(gid, w) {
    var el = document.getElementById('grp-' + gid);
    if (!el) return;
    var titleEl = el.querySelector('.grp-title');
    var countEl = el.querySelector('.grp-count');
    var full = titleEl.getAttribute('data-full') || titleEl.textContent;
    var countW = 0;
    try { countW = countEl.getComputedTextLength(); } catch (e) { return; }
    // 30 = title x, 12 = right padding, 14 = gap the eye needs between them.
    var avail = w - 12 - countW - 14 - 30;
    titleEl.textContent = full;
    if (avail <= 0) { titleEl.textContent = ''; return; }
    if (titleEl.getComputedTextLength() <= avail) return;
    var lo = 0, hi = full.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      titleEl.textContent = full.slice(0, mid).trimEnd() + '…';
      if (titleEl.getComputedTextLength() <= avail) lo = mid; else hi = mid - 1;
    }
    titleEl.textContent = lo > 0 ? full.slice(0, lo).trimEnd() + '…' : '…';
  }

  function applyStates() {
    document.querySelectorAll('.node').forEach(function (n) {
      var st = stateOf(n.getAttribute('data-id'));
      n.classList.toggle('st-done', st === 'done');
      n.classList.toggle('st-ready', st === 'ready');
      n.classList.toggle('st-not', st === 'not');
    });
    F.groups.forEach(function (g) {
      var nDone = 0, anyReady = false;
      g.members.forEach(function (id) {
        var st = stateOf(id);
        if (st === 'done') nDone++;
        else if (st === 'ready') anyReady = true;
      });
      var el = document.getElementById('grp-' + g.id);
      el.querySelector('.grp-count').textContent =
        nDone + '/' + g.members.length + ' savladano';
      fitGroupTitle(g.id, frames[g.id] ? frames[g.id].w : G.COLLAPSED_W);
      // The state outline belongs to the collapsed bar; an open group
      // shows its members' own outlines instead.
      var closed = frames[g.id] ? !frames[g.id].open : true;
      var allDone = g.members.length > 0 && nDone === g.members.length;
      el.classList.toggle('g-done', closed && allDone);
      el.classList.toggle('g-ready', closed && !allDone && anyReady);
      el.classList.toggle('g-muted', closed && !allDone && !anyReady);
    });
  }

  // --- interactions -------------------------------------------------------
  document.getElementById('glayer').addEventListener('click', function (ev) {
    var badge = ev.target.closest('.prfbadge');
    if (badge) {
      // "▸ dokaz" means "show me the proof": reveal proofs, open this one.
      if (!showPrf) {
        showPrf = true;
        document.getElementById('tglPrf').checked = true;
        relayout();
      }
      openPanel(badge.getAttribute('data-prf'));
      return;
    }
    var hdr = ev.target.closest('.grp-header');
    if (hdr) {
      var g = +hdr.getAttribute('data-g');
      if (!expanded[g]) {
        // Expanding a group whose current variant is empty (e.g. all
        // exercises while the exercise toggle is off) would show nothing —
        // flip the toggle that gives it content instead of a dead click.
        var grp = F.groups[g];
        if (grp.variants[variantKey()].w === 0) {
          if (!showExr && grp.variants[vk(showPrf, true)].w > 0) {
            showExr = true;
            document.getElementById('tglExr').checked = true;
          } else if (!showPrf && grp.variants[vk(true, showExr)].w > 0) {
            showPrf = true;
            document.getElementById('tglPrf').checked = true;
          }
        }
      }
      expanded[g] = !expanded[g];
      relayout();
      return;
    }
    var node = ev.target.closest('.node');
    if (node) openPanel(node.getAttribute('data-id'));
  });

  var panel = document.getElementById('panel');
  var panelBody = document.getElementById('panel-body');
  var markBox = document.createElement('div');
  markBox.id = 'panel-mark';
  function openPanel(id) {
    // An object is a node on both tabs, so every card with the id is marked.
    document.querySelectorAll('.node.sel').forEach(function (n) { n.classList.remove('sel'); });
    selected = id;
    document.querySelectorAll('.node[data-id="' + id + '"]').forEach(function (n) { n.classList.add('sel'); });
    panelBody.innerHTML = window.TREES[id] || '';
    var slot = panelBody.querySelector('.struct-sections');
    if (slot && S) slot.innerHTML = structureSections(id);
    updateStrip(id);
    // The mark control sits right under the head so the panel's primary
    // action is visible without scrolling.
    var head = panelBody.querySelector('.panel-head');
    if (head) head.after(markBox); else panelBody.prepend(markBox);
    renderMarkUI(id);
    if (BRIDGE.on) mountAsk(id);
    panel.classList.add('open');
    panel.scrollTop = 0;
  }

  function escText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stateLabel(st) {
    return st === 'done' ? 'savladano'
      : st === 'ready' ? 'spremno za čitanje' : 'nije spremno';
  }
  function testPhrase(id) {
    // This phrase becomes MODEL INPUT and seeds the session's language —
    // it must match the vault, not the club's UI chrome. A member copied
    // the Croatian version into an English vault and got a Croatian
    // session about English category theory; never again.
    var lang = (F.nodes[id] && F.nodes[id].language) || F.language;
    return lang === "en"
      ? '/tutor — check how well I understand: "' + F.nodes[id].title + '". Vault: ' + F.vaultPath + ' — keep the whole session note in English, saved under sessions/ inside this vault.'
      : '/tutor — provjeri koliko razumijem: "' + F.nodes[id].title + '". Trezor: ' + F.vaultPath + ' — cijelu sesijsku bilješku piši na hrvatskom, spremi je u sessions/ unutar trezora.';
  }
  function renderMarkUI(id, opts) {
    opts = opts || {};
    var st = stateOf(id);
    var h = '<div class="mark-state">Stanje: ' + stateLabel(st) + '</div>';
    h += st === 'done'
      ? '<button class="mark-btn is-done" data-act="unmark">Vrati na nesavladano</button>'
      : '<button class="mark-btn" data-act="mark">Označi kao savladano ✓</button>';
    if (opts.prompt) {
      h += '<div class="mark-prompt">' +
        '<button class="mp-close" data-act="dismiss" title="Odbaci">×</button>' +
        '<p>Želiš li se prvo provjeriti? Otvori <code>/tutor</code> u Claude Codeu i zatraži:</p>' +
        '<p><code>' + escText(testPhrase(id)) + '</code></p>' +
        '<div class="mp-actions">' +
        '<button data-act="copy">Kopiraj</button>' +
        '<button data-act="confirm">Samo označi</button>' +
        '</div></div>';
    }
    if (opts.note) h += '<div class="mark-hint">' + escText(opts.note) + '</div>';
    markBox.innerHTML = h;
  }
  function markDone(id) {
    var wasNotReady = stateOf(id) === 'not';
    done[id] = true;
    saveProgress();
    applyStates();
    renderMarkUI(id, wasNotReady
      ? { note: 'Napomena: preduvjeti ovog stabla još nisu savladani.' }
      : null);
  }
  // execCommand fallback for file:// contexts where the async clipboard
  // API is unavailable or denied.
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  markBox.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-act]');
    if (!b || !selected) return;
    var act = b.getAttribute('data-act');
    if (act === 'unmark') {
      delete done[selected];
      saveProgress();
      applyStates();
      renderMarkUI(selected);
    } else if (act === 'mark') {
      // A merely-ready tree earns the self-test nudge first; a not-ready
      // one is allowed straight through — the reader outranks the DAG.
      if (stateOf(selected) === 'ready') renderMarkUI(selected, { prompt: true });
      else markDone(selected);
    } else if (act === 'confirm') {
      markDone(selected);
    } else if (act === 'dismiss') {
      renderMarkUI(selected);
    } else if (act === 'copy') {
      var text = testPhrase(selected);
      var fb = function (ok) {
        b.textContent = ok ? 'Kopirano ✓' : 'Kopiranje nije uspjelo';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { fb(true); },
          function () { fb(legacyCopy(text)); }
        );
      } else {
        fb(legacyCopy(text));
      }
    }
  });
  document.getElementById('resetProg').addEventListener('click', function () {
    if (!confirm('Poništiti sav napredak? Sve oznake savladanosti bit će obrisane.')) return;
    done = {};
    try { localStorage.removeItem(F.progressKey); } catch (e) {}
    applyStates();
    if (selected) renderMarkUI(selected);
  });
  document.getElementById('close').addEventListener('click', function () {
    panel.classList.remove('open');
  });
  panelBody.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-open]');
    if (a) { ev.preventDefault(); openPanel(a.getAttribute('data-open')); }
  });

  document.getElementById('tglPrf').addEventListener('change', function (ev) {
    showPrf = ev.target.checked; relayout();
  });
  document.getElementById('tglExr').addEventListener('change', function (ev) {
    showExr = ev.target.checked; relayout();
  });
  document.getElementById('expandAll').addEventListener('click', function () {
    F.groups.forEach(function (g) { expanded[g.id] = true; }); relayout();
  });
  document.getElementById('collapseAll').addEventListener('click', function () {
    F.groups.forEach(function (g) { expanded[g.id] = false; }); relayout();
  });

  // --- search -------------------------------------------------------------
  var term = '';
  document.getElementById('search').addEventListener('input', function (ev) {
    term = ev.target.value.trim().toLowerCase();
    applySearch();
  });
  function applySearch() {
    document.querySelectorAll('.node').forEach(function (n) {
      var id = n.getAttribute('data-id');
      var info = F.nodes[id];
      var hit = term && (id.indexOf(term) >= 0 || info.title.toLowerCase().indexOf(term) >= 0);
      n.classList.toggle('hit', !!hit);
      n.classList.toggle('dim', !!term && !hit);
    });
    F.groups.forEach(function (g) {
      var any = term && g.members.some(function (id) {
        return id.indexOf(term) >= 0 || F.nodes[id].title.toLowerCase().indexOf(term) >= 0;
      });
      var t = document.querySelector('#grp-' + g.id + ' .grp-title');
      t.style.fill = any ? 'var(--accent)' : '';
    });
  }

  // --- pan / zoom ---------------------------------------------------------
  var view = { x: 0, y: 0, k: 1 };
  var slabels = document.getElementById('slabels');
  function applyView() {
    world.setAttribute('transform',
      'translate(' + view.x + ',' + view.y + ') scale(' + view.k + ')');
    if (slabels) {
      slabels.style.transform = 'matrix(' + view.k + ',0,0,' + view.k + ',' + view.x + ',' + view.y + ')';
    }
  }
  var canvas = document.getElementById('canvas');
  canvas.addEventListener('wheel', function (ev) {
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    var k2 = Math.min(4, Math.max(0.1, view.k * factor));
    var r = svg.getBoundingClientRect();
    var px = ev.clientX - r.left, py = ev.clientY - r.top;
    view.x = px - ((px - view.x) / view.k) * k2;
    view.y = py - ((py - view.y) / view.k) * k2;
    view.k = k2;
    applyView();
  }, { passive: false });
  var pan = null;
  canvas.addEventListener('mousedown', function (ev) {
    if (ev.target.closest('.node, .grp-header, .inst, .sedge, .slabel')) return;
    pan = { x: ev.clientX - view.x, y: ev.clientY - view.y };
    canvas.classList.add('panning');
  });
  window.addEventListener('mousemove', function (ev) {
    if (!pan) return;
    view.x = ev.clientX - pan.x; view.y = ev.clientY - pan.y;
    applyView();
  });
  window.addEventListener('mouseup', function () {
    pan = null; canvas.classList.remove('panning');
  });

  loadProgress();
  if (!storageOk) storageNotice();
  relayout();
  // Start fitted to width, below the toolbar.
  var topbarH = document.getElementById('topbar').offsetHeight;
  var maxW = 0, maxY = 0;
  Object.keys(frames).forEach(function (k) {
    maxW = Math.max(maxW, frames[k].x + frames[k].w);
    maxY = Math.max(maxY, frames[k].y + frames[k].h);
  });
  var r = svg.getBoundingClientRect();
  view.k = Math.min(1, (r.width - 40) / (maxW + 40));
  view.x = 20; view.y = topbarH + 12;
  applyView();

  // ---- Struktura: the second tab -------------------------------------------
  // Boxes come positioned from the build; the page draws the arrows between
  // them and places their KaTeX labels, since only the browser knows how
  // wide a rendered label is (as fitGroupTitle already does for SVG text).
  var S = window.STRUCTURE || null;
  var slayer = document.getElementById('slayer');
  var tabsEl = document.getElementById('tabs');
  var tab = 'order';
  var views = { order: view, structure: { x: 20, y: topbarH + 20, k: 1 } };
  var structureFitted = false;
  var KIND_COLOR = {}, KIND_HR = {}, objById = {}, arrowById = {};
  var sedges = [];
  // A loop is an arc 20 high and about as wide on the top side of its box:
  // small enough to stay in the gap between two rows.
  var LOOP_H = 20, LOOP_W = 16, LOOP_FLARE = 12, LOOP_PITCH = 44;
  var sTop = 0;

  function setTab(name) {
    if (!S) return;
    tab = name;
    var st = name === 'structure';
    if (st && !structureFitted) { fitStructure(); structureFitted = true; }
    view = views[name];
    document.getElementById('glayer').style.display = st ? 'none' : '';
    slayer.style.display = st ? '' : 'none';
    slabels.style.visibility = st ? 'visible' : 'hidden';
    document.body.classList.toggle('tab-structure', st);
    tabsEl.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === name);
    });
    applyView();
  }

  // sTop is how far a loop on a top-row box, and its label, reach over the
  // top of the layout.
  function fitStructure() {
    var r = svg.getBoundingClientRect();
    var k = Math.min(1.2, (r.width - 40) / (S.size.w + 40), (r.height - topbarH - 120) / (S.size.h - sTop + 40));
    views.structure.k = Math.max(0.2, k);
    views.structure.x = 20;
    views.structure.y = topbarH + 20 - sTop * views.structure.k;
  }

  function boxOf(id) {
    var p = S.pos[id];
    var n = (S.instances[id] || []).length;
    return { x: p.x, y: p.y, w: G.NODE_W, h: G.NODE_H + n * (S.geom.INST_H + S.geom.INST_GAP) };
  }
  function unit(x, y) { var l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  // An edge is a chain of cubic segments, each [p, c1, c2, q]: one for a
  // direct edge, three when it detours under a box that stands in its way.
  function cubicAt(g, t) {
    var s = 1 - t, a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
    return [a * g[0][0] + b * g[1][0] + c * g[2][0] + d * g[3][0],
            a * g[0][1] + b * g[1][1] + c * g[2][1] + d * g[3][1]];
  }
  function segAt(e, t) {
    var n = e.segs.length, i = Math.min(n - 1, Math.floor(t * n));
    return [e.segs[i], t * n - i];
  }
  function bez(e, t) { var s = segAt(e, t); return cubicAt(s[0], s[1]); }
  function objTitle(id) { return objById[id] ? objById[id].title : id; }

  // One edge per arrow, except that an inverse pair collapses into one
  // two-headed edge. Every edge leaves and enters through the sides of its
  // two boxes that face each other, each on a port of its own, and runs
  // between them with level tangents — so it stays in the gap between the
  // two columns and cannot cross a box that is not one of its ends. Ports
  // on a side are ordered by where the other end sits, which keeps a fan
  // from crossing itself. An arrow from a box to itself is a loop: an arc
  // that leaves and re-enters the top side near the right corner and bulges
  // into the row gap above, several on one box side by side.
  function buildEdges() {
    var list = [], seen = {}, loops = {};
    S.arrows.forEach(function (a) {
      if (seen[a.id] || a.kind === 'instance' || !S.pos[a.from] || !S.pos[a.to]) return;
      var e = { ids: [a.id], from: a.from, to: a.to, kind: a.kind, two: false, loop: a.from === a.to, upTo: !!a.up_to, labels: [a.label_html], titles: [a.title] };
      var b = a.inverse && arrowById[a.inverse];
      if (b && b !== a && b.inverse === a.id && b.kind !== 'instance' && !seen[b.id]) {
        seen[b.id] = true; e.ids.push(b.id); e.two = true; e.upTo = e.upTo || !!b.up_to; e.labels.push(b.label_html); e.titles.push(b.title);
      }
      seen[a.id] = true;
      list.push(e);
      if (e.loop) (loops[e.from] = loops[e.from] || []).push(e);
    });
    Object.keys(loops).forEach(function (id) {
      var b = boxOf(id), g = loops[id], pitch = Math.min(LOOP_PITCH, (b.w - 28) / g.length);
      g.forEach(function (e, n) {
        var xr = b.x + b.w - 12 - n * pitch, xl = xr - LOOP_W, cy = b.y - LOOP_H * 4 / 3;
        e.p0 = [xr, b.y]; e.p2 = [xl, b.y];
        e.segs = [[e.p0, [xr + LOOP_FLARE, cy], [xl - LOOP_FLARE, cy], e.p2]];
      });
    });
    var sides = {};
    function side(id, s) { var k = id + '|' + s; return sides[k] || (sides[k] = []); }
    list.forEach(function (e, i) {
      if (e.loop) return;
      var A = boxOf(e.from), B = boxOf(e.to);
      var ca = A.x + A.w / 2, cb = B.x + B.w / 2;
      // Two boxes in one column both use their right side; the edge loops out.
      e.sa = cb < ca ? 'l' : 'r';
      e.sb = cb > ca ? 'l' : 'r';
      side(e.from, e.sa).push({ e: e, i: i, end: 0, other: B.y + G.NODE_H / 2 });
      side(e.to, e.sb).push({ e: e, i: i, end: 1, other: A.y + G.NODE_H / 2 });
    });
    Object.keys(sides).forEach(function (k) {
      var cut = k.lastIndexOf('|'), b = boxOf(k.slice(0, cut)), right = k.slice(cut + 1) === 'r', g = sides[k];
      g.sort(function (p, q) { return p.other - q.other || p.i - q.i; });
      g.forEach(function (p, n) {
        var pt = [right ? b.x + b.w : b.x, b.y + G.NODE_H * (n + 1) / (g.length + 1)];
        if (p.end) p.e.p2 = pt; else p.e.p0 = pt;
      });
    });
    // To every other edge a box's loops are part of the box: a detour's lane
    // runs clear of them.
    var allBoxes = S.objects.map(function (o) {
      var b = boxOf(o.id);
      b.id = o.id;
      if (loops[o.id]) { b.y -= LOOP_H + 4; b.h += LOOP_H + 4; }
      return b;
    });
    // Level tangents at both ends; sp and sq say which way each end faces.
    function cubic(p, q, sp, sq) {
      var reach = Math.max(40, Math.abs(q[0] - p[0]) * 0.5);
      return [p, [p[0] + sp * reach, p[1]], [q[0] + sq * reach, q[1]], q];
    }
    function blockers(segs, e) {
      return allBoxes.filter(function (b) {
        if (b.id === e.from || b.id === e.to) return false;
        for (var s = 0; s < segs.length; s++) for (var k = 0; k <= 16; k++) {
          var q = cubicAt(segs[s], k / 16);
          if (q[0] > b.x - 6 && q[0] < b.x + b.w + 6 && q[1] > b.y - 6 && q[1] < b.y + b.h + 6) return true;
        }
        return false;
      });
    }
    var lanes = {};
    list.forEach(function (e) {
      if (e.loop) return;
      var da = e.sa === 'r' ? 1 : -1, db = e.sb === 'r' ? 1 : -1;
      if (e.sa === e.sb) {
        var out = 70 + Math.abs(e.p2[1] - e.p0[1]) * 0.25;
        e.segs = [[e.p0, [e.p0[0] + da * out, e.p0[1]], [e.p2[0] + db * out, e.p2[1]], e.p2]];
        return;
      }
      e.segs = [cubic(e.p0, e.p2, da, db)];
      var blocked = blockers(e.segs, e);
      if (!blocked.length) return;
      // An edge that skips a column would cut through the box standing in
      // it. It passes under the lot instead — over, when under is worse —
      // on a level lane of its own, so two detours never share a line.
      var x1 = Math.min.apply(null, blocked.map(function (b) { return b.x; })) - 14;
      var x2 = Math.max.apply(null, blocked.map(function (b) { return b.x + b.w; })) + 14;
      var under = Math.max.apply(null, blocked.map(function (b) { return b.y + b.h; })) + 14;
      var over = Math.min.apply(null, blocked.map(function (b) { return b.y; })) - 14;
      var key = blocked.map(function (b) { return b.id; }).sort().join(',');
      var cand = [['u', under, 1], ['o', over, -1]].map(function (c) {
        var y = c[1] + c[2] * 9 * (lanes[key + c[0]] || 0);
        var a = [da > 0 ? x1 : x2, y], z = [da > 0 ? x2 : x1, y];
        var segs = [cubic(e.p0, a, da, -da), [a, a, z, z], cubic(z, e.p2, da, db)];
        return { k: key + c[0], segs: segs, bad: blockers(segs, e).length };
      });
      var pick = cand[1].bad < cand[0].bad ? cand[1] : cand[0];
      lanes[pick.k] = (lanes[pick.k] || 0) + 1;
      e.segs = pick.segs;
    });
    return list;
  }

  function r1(v) { return Math.round(v * 10) / 10; }
  function drawStructure() {
    sedges = buildEdges();
    sTop = 0;
    var eh = '', lh = '';
    sedges.forEach(function (e, i) {
      if (e.loop) sTop = Math.min(sTop, e.p0[1] - LOOP_H - 6);
      // An inverse pair that holds only up to a canonical isomorphism says so.
      var sep = e.upTo ? '≅' : '⇄';
      var d = 'M' + r1(e.p0[0]) + ',' + r1(e.p0[1]) + e.segs.map(function (g) {
        return ' C' + r1(g[1][0]) + ',' + r1(g[1][1]) + ' ' + r1(g[2][0]) + ',' + r1(g[2][1]) + ' ' + r1(g[3][0]) + ',' + r1(g[3][1]);
      }).join('');
      eh += '<g class="sedge' + (e.loop ? ' sloop' : '') + '" data-id="' + escText(e.ids[0]) + '" data-kind="' + escText(e.kind) + '">' +
        '<path class="hit" d="' + d + '"/>' +
        '<path class="line" d="' + d + '" style="stroke:' + KIND_COLOR[e.kind] + '"' +
        ' marker-end="url(#ah-' + e.kind + ')"' + (e.two ? ' marker-start="url(#ah-' + e.kind + ')"' : '') + '/></g>';
      var m = bez(e, 0.5);
      lh += '<span class="slabel' + (e.loop ? ' loop' : '') + '" data-i="' + i + '" data-open="' + escText(e.ids[0]) + '" title="' + escText(e.titles.join(' ' + sep + ' ')) + '"' +
        ' style="left:' + r1(m[0]) + 'px;top:' + r1(m[1]) + 'px;color:' + KIND_COLOR[e.kind] + '">' +
        e.labels.join('<span class="sep">' + sep + '</span>') + '</span>';
    });
    S.objects.forEach(function (o) {
      var p = S.pos[o.id];
      lh += '<span class="ssym" style="left:' + (p.x + 10) + 'px;top:' + (p.y + 24) + 'px">' + o.symbol_html + '</span>';
    });
    document.getElementById('sedges').innerHTML = eh;
    slabels.innerHTML = lh;
  }

  // A label sits on its own edge. Edges leaving one box take turns at the
  // middle and the two thirds, so neighbours do not line up; a spot that
  // covers a box, an earlier label or another edge's line costs, and the
  // label slides along its edge — off it only as a last resort — to the
  // first free spot or the cheapest one. A loop is too small to carry its
  // label, which stands beside it over the box's top side instead, or above
  // it. Sizes are read from the overlay, which is laid out (only hidden)
  // while the other tab shows.
  var LABEL_T = [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78];
  var LINE_HIT = 60;
  function overlap(a, b) {
    var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function tangent(e, t) {
    var sg = segAt(e, t), g = sg[0], u = sg[1], s = 1 - u, a = 3 * s * s, b = 6 * s * u, c = 3 * u * u;
    var x = a * (g[1][0] - g[0][0]) + b * (g[2][0] - g[1][0]) + c * (g[3][0] - g[2][0]);
    var y = a * (g[1][1] - g[0][1]) + b * (g[2][1] - g[1][1]) + c * (g[3][1] - g[2][1]);
    // A level lane is a cubic with doubled ends: no speed at its two ends.
    return x || y ? unit(x, y) : unit(g[3][0] - g[0][0], g[3][1] - g[0][1]);
  }
  function edgeSpots(e, h) {
    var pref = [0.5, 0.36, 0.64][e.slot % 3];
    var ts = LABEL_T.slice().sort(function (a, b) { return Math.abs(a - pref) - Math.abs(b - pref); });
    var spots = ts.map(function (t) { return bez(e, t); });
    ts.forEach(function (t) {
      var m = bez(e, t), tg = tangent(e, t);
      [1, -1].forEach(function (side) {
        var d = side * (h / 2 + 3);
        spots.push([m[0] - tg[1] * d, m[1] + tg[0] * d]);
      });
    });
    return spots;
  }
  // Beside the loop on the box's top side — to its left when the label fits
  // there — then above it: centred, hanging left, hanging right, and in
  // further rows when a crowd of loops has taken the first. None may reach
  // further left of the box than the margin the view opens with.
  function loopSpots(e, w, h) {
    var b = boxOf(e.from), top = e.p0[1], beside = top - h / 2 - 3;
    var spots = [[e.p0[0] + 7 + w / 2, beside]];
    if (e.p2[0] - 7 - w >= b.x) spots.unshift([e.p2[0] - 7 - w / 2, beside]);
    for (var row = 0; row < 4; row++) {
      var y = top - LOOP_H - 3 - h / 2 - row * (h + 2);
      spots.push([(e.p0[0] + e.p2[0]) / 2, y], [e.p0[0] + 3 - w / 2, y], [e.p2[0] - 3 + w / 2, y]);
    }
    return spots.map(function (m) { return [Math.max(m[0], b.x - 12 + w / 2), m[1]]; });
  }
  function placeLabels() {
    var boxes = S.objects.map(function (o) { return boxOf(o.id); });
    var samples = sedges.map(function (e) {
      var pts = [];
      for (var k = 1; k < 24; k++) pts.push(bez(e, k / 24));
      return pts;
    });
    var slots = {};
    sedges.forEach(function (e) { if (!e.loop) e.slot = slots[e.from] = (slots[e.from] || 0) + 1; });
    var placed = [];
    slabels.querySelectorAll('.slabel').forEach(function (sp) {
      var i = +sp.getAttribute('data-i'), e = sedges[i];
      var w = sp.offsetWidth, h = sp.offsetHeight;
      if (!w) return;
      var spots = e.loop ? loopSpots(e, w, h) : edgeSpots(e, h);
      var best = null;
      for (var ci = 0; ci < spots.length && !(best && best.cost === 0); ci++) {
        var m = spots[ci];
        var r = { x: m[0] - w / 2, y: m[1] - h / 2, w: w, h: h };
        var cost = 0;
        boxes.forEach(function (b) { cost += overlap(r, b); });
        placed.forEach(function (b) { cost += overlap(r, b); });
        samples.forEach(function (pts, j) {
          if (j === i) return;
          pts.forEach(function (p) {
            if (p[0] > r.x && p[0] < r.x + r.w && p[1] > r.y && p[1] < r.y + r.h) cost += LINE_HIT;
          });
        });
        if (!best || cost < best.cost) best = { cost: cost, m: m, r: r };
      }
      sp.style.left = r1(best.m[0]) + 'px';
      sp.style.top = r1(best.m[1]) + 'px';
      if (e.loop) sTop = Math.min(sTop, best.r.y - 6);
      placed.push(best.r);
    });
  }

  // --- the panel's cross-tree sections -------------------------------------
  function arrowRow(a, dir) {
    var other = dir === 'out' ? a.to : a.from;
    return '<a href="#" class="srow" data-open="' + escText(a.id) + '">' +
      '<span class="srow-lbl" style="color:' + KIND_COLOR[a.kind] + '">' + a.label_html + '</span>' +
      '<span class="srow-stm">' + a.statement_html + '</span>' +
      '<span class="srow-to">' + (dir === 'out' ? '→ ' : '← ') + escText(objTitle(other)) + ' · ' + escText(a.title) + '</span></a>';
  }
  function kindGroups(arrows, dir) {
    return S.kinds.map(function (k) {
      var list = arrows.filter(function (a) { return a.kind === k.id; });
      if (!list.length) return '';
      return '<div class="skind"><span class="kind-chip" style="--c:' + k.color + '">' + escText(k.hr) + '</span></div>' +
        list.map(function (a) { return arrowRow(a, dir); }).join('');
    }).join('');
  }
  function theoremGroups(list) {
    var seen = {}, byField = {}, order = [];
    list.forEach(function (t) {
      if (seen[t.id]) return;
      seen[t.id] = true;
      (t.fields && t.fields.length ? t.fields : ['ostalo']).forEach(function (f) {
        if (!byField[f]) { byField[f] = []; order.push(f); }
        byField[f].push(t);
      });
    });
    order.sort(function (a, b) { return a === 'ostalo' ? 1 : b === 'ostalo' ? -1 : a.localeCompare(b, 'hr'); });
    return order.map(function (f) {
      return '<div class="sfield">' + escText(f) + '</div>' + byField[f].map(function (t) {
        return '<a href="#" class="srow" data-open="' + escText(t.id) + '">' + escText(t.title) +
          (t.via ? '<span class="srow-via">vrijedi preko poopćenja: ' + escText(t.via) + '</span>' : '') + '</a>';
      }).join('');
    }).join('');
  }
  function countUnique(list) {
    var seen = {}; list.forEach(function (t) { seen[t.id] = true; }); return Object.keys(seen).length;
  }
  function valuesDl(inst) {
    var keys = Object.keys(inst.values_html);
    if (!keys.length) return '';
    return '<dl class="sdl">' + keys.map(function (k) {
      var a = arrowById[k];
      return '<dt><span class="sh-lbl">' + (a ? a.label_html : '') + '</span><a href="#" data-open="' + escText(k) + '">' + escText(a ? a.title : k) + '</a></dt>' +
        '<dd>' + inst.values_html[k] + '</dd>';
    }).join('') + '</dl>';
  }
  function structureSections(id) {
    var h = '';
    if (objById[id]) {
      var out = S.arrows.filter(function (a) { return a.from === id && a.kind !== 'instance'; });
      var inn = S.arrows.filter(function (a) { return a.to === id && a.kind !== 'instance'; });
      h += '<h3 class="ssec">Strelice iz objekta (' + out.length + ')</h3>' +
        (out.length ? kindGroups(out, 'out') : '<p class="smuted">Nema strelica iz ovog objekta.</p>');
      // A typed object is another box of its type's kind, so what can be
      // built from that kind can be built from it. The type's own maps (hom)
      // are particular arrows between particular boxes and do not carry over.
      var type = objById[id].type;
      if (type && objById[type]) {
        var tout = S.arrows.filter(function (a) { return a.from === type && a.kind !== 'instance' && a.kind !== 'hom'; });
        h += '<h3 class="ssec">Strelice tipa (' + tout.length + ')</h3>' +
          (tout.length ? kindGroups(tout, 'out') : '<p class="smuted">Tip nema svojih strelica.</p>');
      }
      // Examples travel up a generalizes arrow: an example of the special
      // kind is an example of the general one.
      var inst = (S.instances[id] || []).map(function (i) { return { i: i, via: null }; });
      S.arrows.forEach(function (a) {
        if (a.kind !== 'generalizes' || a.to !== id) return;
        (S.instances[a.from] || []).forEach(function (i) { inst.push({ i: i, via: objTitle(a.from) }); });
      });
      h += '<h3 class="ssec">Primjeri (' + inst.length + ')</h3>' + (inst.length ? inst.map(function (x) {
        return '<div class="sinst"><a href="#" class="srow" data-open="' + escText(x.i.id) + '">' + escText(x.i.title) +
          (x.via ? '<span class="srow-via">preko poopćenja iz: ' + escText(x.via) + '</span>' : '') + '</a>' + valuesDl(x.i) + '</div>';
      }).join('') : '<p class="smuted">Nema primjera.</p>');
      // Theorems about the object or any arrow touching it; a theorem about
      // the general kind holds for the special one, so it travels down.
      var thms = (S.theorems[id] || []).slice();
      out.concat(inn).forEach(function (a) { (S.theorems[a.id] || []).forEach(function (t) { thms.push(t); }); });
      S.arrows.forEach(function (a) {
        if (a.kind !== 'generalizes' || a.from !== id) return;
        (S.theorems[a.to] || []).forEach(function (t) { thms.push({ id: t.id, title: t.title, fields: t.fields, via: objTitle(a.to) }); });
      });
      h += '<h3 class="ssec">Teoremi (' + countUnique(thms) + ')</h3>' +
        (thms.length ? theoremGroups(thms) : '<p class="smuted">Nijedan teorem ne govori o ovom objektu.</p>');
      h += '<h3 class="ssec">Strelice u objekt (' + inn.length + ')</h3>' +
        (inn.length ? kindGroups(inn, 'in') : '<p class="smuted">Nema strelica u ovaj objekt.</p>');
      return h;
    }
    var a = arrowById[id];
    if (!a) return '';
    if (a.kind !== 'instance') {
      var ex = (S.instances[a.from] || []).filter(function (i) { return i.values_html[id]; });
      if (ex.length) {
        h += '<h3 class="ssec">Na primjerima</h3>' + ex.map(function (i) {
          return '<div class="sinst"><a href="#" class="srow" data-open="' + escText(i.id) + '">' + escText(i.title) + '</a>' +
            '<div class="sval">' + i.values_html[id] + '</div></div>';
        }).join('');
      }
    }
    var th = S.theorems[id] || [];
    if (th.length) h += '<h3 class="ssec">Teoremi (' + th.length + ')</h3>' + theoremGroups(th);
    return h;
  }

  if (S) {
    S.kinds.forEach(function (k) { KIND_COLOR[k.id] = k.color; KIND_HR[k.id] = k.hr; });
    S.objects.forEach(function (o) { objById[o.id] = o; });
    S.arrows.forEach(function (a) { arrowById[a.id] = a; });
    drawStructure();
    placeLabels();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLabels);
    tabsEl.addEventListener('click', function (ev) {
      var b = ev.target.closest('.tab');
      if (b) setTab(b.getAttribute('data-tab'));
    });
    slayer.addEventListener('click', function (ev) {
      var n = ev.target.closest('.node, .inst, .sedge');
      if (n) openPanel(n.getAttribute('data-id'));
    });
    slabels.addEventListener('click', function (ev) {
      var l = ev.target.closest('.slabel');
      if (l) openPanel(l.getAttribute('data-open'));
    });
  }

  // ---- Dijagrami: the bottom strip ----------------------------------------
  // Every commutative diagram in the picked tree's body, then in the trees
  // about it, one tab each. Absent when no tree in the vault draws one.
  var strip = document.getElementById('strip');
  var stripFigs = [];
  var aboutOf = {};
  Object.keys(F.nodes).forEach(function (id) {
    (F.nodes[id].about || []).forEach(function (t) { (aboutOf[t] = aboutOf[t] || []).push(id); });
  });
  function figuresOf(id, src) {
    var tpl = document.createElement('template');
    tpl.innerHTML = window.TREES[id] || '';
    return Array.prototype.map.call(tpl.content.querySelectorAll('figure.cd'), function (fig) {
      return { html: fig.outerHTML, title: fig.getAttribute('data-title') || '', src: src };
    });
  }
  function showFigure(i) {
    var body = document.getElementById('strip-body');
    body.innerHTML = stripFigs[i] ? stripFigs[i].html : '';
    document.querySelectorAll('#strip-tabs .strip-tab').forEach(function (b, j) { b.classList.toggle('on', i === j); });
  }
  function updateStrip(id) {
    if (!strip) return;
    stripFigs = figuresOf(id, null);
    (aboutOf[id] || []).forEach(function (t) {
      stripFigs = stripFigs.concat(figuresOf(t, F.nodes[t].title));
    });
    strip.classList.toggle('empty', !stripFigs.length);
    document.getElementById('strip-count').textContent = stripFigs.length ? '(' + stripFigs.length + ')' : '';
    document.getElementById('strip-tabs').innerHTML = stripFigs.map(function (fg, i) {
      return '<button class="strip-tab" data-i="' + i + '"' + (fg.src ? ' title="iz: ' + escText(fg.src) + '"' : '') + '>' +
        escText(fg.title || ('Dijagram ' + (i + 1))) + '</button>';
    }).join('');
    showFigure(0);
  }
  if (strip) {
    document.getElementById('strip-toggle').addEventListener('click', function () {
      if (strip.classList.contains('empty')) return;
      strip.classList.toggle('collapsed');
      this.firstChild.textContent = (strip.classList.contains('collapsed') ? '▸' : '▾') + ' Dijagrami ';
    });
    document.getElementById('strip-tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('.strip-tab');
      if (b) showFigure(+b.getAttribute('data-i'));
    });
    document.getElementById('strip-body').addEventListener('click', function (ev) {
      var a = ev.target.closest('a[data-open]');
      if (a) { ev.preventDefault(); openPanel(a.getAttribute('data-open')); }
    });
  }

  // ---- the bridge: served-mode only ---------------------------------------
  // Under file:// there is no server and nothing here runs. Served from
  // serve-vault.mjs, the URL carries a per-launch token; the page never
  // stores it anywhere but memory.
  var BRIDGE = (function () {
    var tok = new URLSearchParams(location.search).get('t');
    return { on: location.protocol === 'http:' && !!tok, tok: tok };
  })();
  var ASK_WAIT = 'Čekam Claude Code — pokreni /ask --watch u trezoru.';
  var askBox = document.createElement('div');
  askBox.id = 'panel-ask';
  var askTree = null, askSelection = '', askLastId = null;

  function api(pathname, opts) {
    opts = opts || {};
    return fetch(pathname, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'X-Forest-Token': BRIDGE.tok }, opts.body ? { 'content-type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) { return r.json(); });
  }

  function mountAsk(id) {
    askTree = id; askSelection = ''; askLastId = null;
    askBox.innerHTML =
      '<textarea id="ask-q" placeholder="Označi dio teksta gore i pitaj — ili samo pitaj o ovom stablu."></textarea>' +
      '<div class="ask-sel" id="ask-sel"></div>' +
      '<div class="ask-row"><button class="primary" id="ask-send">Pitaj</button>' +
      '<span class="ask-status" id="ask-status"></span></div>' +
      '<div class="ask-answer" id="ask-answer" hidden></div>' +
      '<div class="ask-actions" id="ask-actions" hidden></div>';
    markBox.after(askBox);
    askBox.after(tutorBox);
    document.getElementById('ask-send').onclick = function () { sendAsk('ask'); };
  }

  // The highlighted passage IS the question's context: capture it from the
  // panel body only, so a stray selection elsewhere on the page never leaks in.
  document.addEventListener('selectionchange', function () {
    if (!BRIDGE.on || !askBox.isConnected) return;
    var s = window.getSelection();
    var txt = s && s.toString().trim();
    if (!txt) return;
    var anchor = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode);
    if (!anchor || !panelBody.contains(anchor) || askBox.contains(anchor)) return;
    askSelection = txt.slice(0, 4000);
    var el = document.getElementById('ask-sel');
    if (el) el.textContent = '„' + (txt.length > 160 ? txt.slice(0, 160) + '…' : txt) + '”';
  });

  function setStatus(msg, err) {
    var el = document.getElementById('ask-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!err);
  }

  function sendAsk(kind, replyTo) {
    var q = (document.getElementById('ask-q') || {}).value || '';
    if (kind === 'ask' && !q.trim()) { setStatus('Napiši pitanje.', true); return; }
    var btns = askBox.querySelectorAll('button');
    btns.forEach(function (b) { b.disabled = true; });
    setStatus('Šaljem…');
    api('/api/ask', { method: 'POST', body: { kind: kind, tree: askTree, selection: askSelection, question: q, reply_to: replyTo || null } })
      .then(function (r) {
        if (r.error) throw new Error(r.error);
        askLastId = r.id;
        setStatus(r.watcher.alive ? 'Razmišljam…' : ASK_WAIT);
        listen(r.id, kind);
      })
      .catch(function (e) { setStatus('Greška: ' + e.message, true); btns.forEach(function (b) { b.disabled = false; }); });
  }

  // One SSE stream per request: status.json as it changes, then the rendered
  // answer. The handlers belong to whichever box sent the request; a 'show'
  // in the status belongs to the graph, whoever asked.
  function stream(id, h) {
    var es = new EventSource('/api/answer/' + id + '?t=' + encodeURIComponent(BRIDGE.tok));
    es.addEventListener('watcher', function (ev) {
      if (!JSON.parse(ev.data).alive) h.status(h.wait);
    });
    es.addEventListener('status', function (ev) {
      var st = JSON.parse(ev.data);
      if (st.show) applyShow(st.show);
      if (st.state === 'error') h.status('Greška: ' + (st.message || 'nepoznata'), true);
      else if (st.message) h.status(st.message);
      else if (st.state === 'writing') h.status('Pišem stablo…');
      else if (st.state !== 'done') h.status('Razmišljam…');
    });
    es.addEventListener('answer', function (ev) { h.answer(JSON.parse(ev.data)); });
    es.addEventListener('done', function () { es.close(); h.done(); });
    es.onerror = function () { es.close(); h.status('Veza prekinuta.', true); h.done(); };
  }

  // status.json may carry show:{focus, trees[]} — the model's choice of what
  // to look at. Outline the focus, brighten the rest, until the next show.
  function applyShow(show) {
    document.querySelectorAll('.node.show-lit, .node.show-focus').forEach(function (n) {
      n.classList.remove('show-lit', 'show-focus');
    });
    var mark = function (id, cls) {
      if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) return;
      document.querySelectorAll('.node[data-id="' + id + '"]').forEach(function (n) { n.classList.add(cls); });
    };
    (Array.isArray(show.trees) ? show.trees : []).forEach(function (id) { mark(id, 'show-lit'); });
    mark(show.focus, 'show-focus');
  }

  function listen(id, kind) {
    var ans = document.getElementById('ask-answer');
    var acts = document.getElementById('ask-actions');
    stream(id, {
      wait: ASK_WAIT,
      status: setStatus,
      done: function () { askBox.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); },
      answer: function (a) {
        ans.hidden = false; ans.innerHTML = a.html;
        acts.hidden = false; acts.innerHTML = '';
        setStatus('');
        if (a.trees_added && a.trees_added.length) {
          // The forest on disk changed under us: the server hands out the
          // rebuilt page, so a reload is how the new tree appears.
          var b = document.createElement('button'); b.className = 'primary';
          b.textContent = 'Novo stablo: ' + a.trees_added.join(', ') + ' — osvježi';
          b.onclick = function () { location.reload(); };
          acts.appendChild(b);
        } else if (kind === 'ask' && /\bponud|\boffer|\buzgoj|\bgrow\b/i.test(a.markdown)) {
          var g = document.createElement('button');
          g.textContent = 'Da, uzgoji to u stablo';
          g.onclick = function () { sendAsk('grow', id); };
          acts.appendChild(g);
        }
      },
    });
  }

  // ---- the tutor section: served-mode only, one session per vault ---------
  // The conversation lives on disk under sessions/<slug>/ and the page keeps
  // only the slug, so closing the tab loses nothing and a reload resumes.
  var TUTOR_WAIT = 'Čekam Claude Code — pokreni /forest:tutor u trezoru.';
  var tutorBox = document.createElement('div');
  tutorBox.id = 'panel-tutor';
  tutorBox.innerHTML =
    '<div class="tutor-head">Tutor</div>' +
    '<div id="tutor-live" hidden>' +
    '<div class="tutor-reply" id="tutor-reply"></div>' +
    '<div class="tutor-note" id="tutor-note" hidden></div>' +
    '<div id="tutor-answer"><textarea id="tutor-a" placeholder="odgovor…"></textarea>' +
    '<div class="ask-row"><button class="primary" id="tutor-send">Pošalji</button>' +
    '<button id="tutor-pause">Pauza</button>' +
    '<span class="ask-status" id="tutor-status"></span></div></div>' +
    '<details><summary>Bilješke</summary><div class="tutor-notes" id="tutor-notes"></div></details>' +
    '</div>' +
    '<div id="tutor-idle"><button class="primary" id="tutor-start">Pokreni tutora</button>' +
    '<div class="tutor-hint">Tutor će postavljati pitanja ovdje; odgovaraj u polju ispod.</div></div>';
  var tutor = { slug: null, status: null, lastId: null, notesHtml: '', rev: null, busy: false };
  var tEl = function (id) { return tutorBox.querySelector('#' + id); };
  tEl('tutor-start').onclick = function () { sendTutor('start'); };
  tEl('tutor-send').onclick = function () { sendTutor('answer'); };
  tEl('tutor-pause').onclick = function () { sendTutor('pause'); };

  function rememberedSlug() {
    try { return localStorage.getItem(F.sessionKey); } catch (e) { return null; }
  }
  function rememberSlug(slug) {
    try { localStorage.setItem(F.sessionKey, slug); } catch (e) {}
  }
  function proposeSlug() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var base = 'sesija-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    // The stamp has minute resolution: a session started within the minute
    // of the last one would land in its directory and resume it, so the
    // second one in a minute gets a suffix.
    var prev = rememberedSlug();
    if (!prev || prev.indexOf(base) !== 0) return base;
    var m = /^-(\d+)$/.exec(prev.slice(base.length));
    return base + '-' + (m ? Number(m[1]) + 1 : 2);
  }
  function tutorStatus(msg, err) {
    var el = tEl('tutor-status');
    el.textContent = msg || '';
    el.classList.toggle('err', !!err);
  }
  function setTutorBusy(b) {
    tutor.busy = b;
    tutorBox.querySelectorAll('button').forEach(function (x) { x.disabled = b; });
  }
  function renderTutor() {
    var st = tutor.status;
    tEl('tutor-live').hidden = !st;
    tEl('tutor-idle').hidden = !!st && st !== 'done';
    tEl('tutor-answer').hidden = st === 'done';
    var note = tEl('tutor-note');
    note.hidden = !(st === 'paused' || st === 'done');
    note.textContent = st === 'done'
      ? 'Sesija je zaključena — bilješke ostaju ispod.'
      : 'Tutor je zapisao gdje smo stali — nastavi kad želiš.';
  }
  // Replaced wholesale, as the server renders it; the member's own scroll
  // position in the block survives the swap.
  function setNotes(html) {
    if (html === tutor.notesHtml) return;
    tutor.notesHtml = html;
    var el = tEl('tutor-notes');
    var top = el.scrollTop;
    el.innerHTML = html;
    el.scrollTop = top;
  }
  // After a reload the last reply went with the tab; the notes' last section
  // — the pending question, or the closing paragraph — stands in for it.
  function lastSection(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var hs = tmp.querySelectorAll('h2');
    if (!hs.length) return html;
    var out = '', n = hs[hs.length - 1];
    while (n) { out += n.outerHTML; n = n.nextElementSibling; }
    return out;
  }
  // A state.json caught mid-write parses as null; the status it had a poll
  // ago is a better guess than 'active'.
  function takeSession(r) {
    if (r.unchanged) return;
    tutor.rev = r.rev || null;
    tutor.status = (r.state && r.state.status) || tutor.status || 'active';
    setNotes(r.notes_html || '');
    renderTutor();
  }
  function pollSession() {
    if (!tutor.slug || !panel.classList.contains('open') || document.visibilityState !== 'visible') return;
    var since = tutor.rev ? '?since=' + encodeURIComponent(tutor.rev) : '';
    api('/api/session/' + encodeURIComponent(tutor.slug) + since).then(function (r) {
      if (r.exists) { takeSession(r); return; }
      // No directory yet while a start is in flight is normal; a session
      // that vanished otherwise leaves nothing to resume.
      if (tutor.status && !tutor.busy) { tutor.status = null; renderTutor(); }
    }).catch(function () {});
  }
  function restoreTutor() {
    tutor.slug = rememberedSlug();
    if (!tutor.slug) return;
    api('/api/session/' + encodeURIComponent(tutor.slug)).then(function (r) {
      if (!r.exists) return;
      takeSession(r);
      tEl('tutor-reply').innerHTML = lastSection(r.notes_html || '');
      var t = r.state && r.state.tree;
      if (!panel.classList.contains('open') && t && F.nodes[t]) openPanel(t);
    }).catch(function () {});
  }
  function sendTutor(action) {
    var ta = tEl('tutor-a');
    var q = action === 'answer' ? ta.value.trim() : '';
    if (action === 'answer' && !q) { tutorStatus('Napiši odgovor.', true); return; }
    if (action === 'start') {
      tutor.slug = proposeSlug(); rememberSlug(tutor.slug);
      tutor.status = 'active'; tutor.lastId = null; tutor.rev = null;
      tEl('tutor-reply').innerHTML = ''; setNotes('');
      renderTutor();
    }
    setTutorBusy(true);
    tutorStatus('Šaljem…');
    api('/api/ask', { method: 'POST', body: {
      kind: 'tutor', action: action, session: tutor.slug, tree: selected,
      question: q, reply_to: tutor.lastId, progress: Object.keys(done).sort(),
    } }).then(function (r) {
      if (r.error) throw new Error(r.error);
      tutor.lastId = r.id;
      tutorStatus(r.watcher.alive ? 'Razmišljam…' : TUTOR_WAIT);
      stream(r.id, {
        wait: TUTOR_WAIT,
        status: tutorStatus,
        done: function () { setTutorBusy(false); pollSession(); },
        answer: function (a) {
          tEl('tutor-reply').innerHTML = a.html;
          if (action === 'answer') ta.value = '';
          tutorStatus('');
        },
      });
    }).catch(function (e) { tutorStatus('Greška: ' + e.message, true); setTutorBusy(false); });
  }

  if (BRIDGE.on) {
    var pill = document.createElement('div'); pill.id = 'bridge-pill';
    document.body.appendChild(pill);
    var poll = function () {
      api('/api/state').then(function (s) {
        pill.classList.toggle('on', !!s.watcher.alive);
        pill.textContent = s.watcher.alive ? '● Claude Code spojen' : '○ Claude Code nije spojen — /forest:tutor';
      }).catch(function () { pill.textContent = '○ most nedostupan'; pill.classList.remove('on'); });
    };
    poll(); setInterval(poll, 5000);
    restoreTutor(); setInterval(pollSession, 2000);
  }
})();
