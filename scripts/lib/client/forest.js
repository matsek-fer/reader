(function () {
  'use strict';
  var F = window.FOREST, G = F.geom;
  var S = window.STRUCTURE || null;
  var FF = window.FOREST_FILTER || null;
  // Two graphs, two panes, one working area. In the split arrangement each pane
  // owns an <svg> and its own pan/zoom, because the two are separate graphs and
  // a shared zoom would be wrong for both. In the one-plane arrangement the
  // structure layer and its label overlay move into the order pane's world and
  // the two are carried by one pan.
  var svg = document.getElementById('svg');
  var world = document.getElementById('world');
  var svg2 = document.getElementById('svg2');
  var world2 = document.getElementById('world2');
  var slayer = document.getElementById('slayer');
  var slabels = document.getElementById('slabels');
  var sdefs = document.getElementById('sdefs');
  var pareas = document.getElementById('pareas');
  // Up here, not beside the painter that uses them: init paints once before
  // execution reaches the middle of this file, and a `var` assigned further
  // down is hoisted but still undefined — which turned every plane-area
  // coordinate into NaN on a reload straight into plane mode.
  var AREA_PAD = 46, AREA_TITLE = 48;
  // The same trap, reached a second way: that first paint runs the filter,
  // which draws the on-demand type layer, which reads the structure index, the
  // built edges, what is highlighted and whether a definition is in focus —
  // all of it set up in the Structure section far below. So the state it reads
  // is declared here with the rest of the state, and `structureReady` is the
  // honest answer to "is there anything to draw yet". See "the two levels".
  var defFocus = { on: false, id: null, view: null };
  var hover = { box: null, edge: null, type: null };
  var typeSel = null;
  var edgeByArrow = {};
  var structureReady = false;
  var canvas = document.getElementById('canvas');
  var topbar = document.getElementById('topbar');
  var PANE = {
    order: { key: 'order', el: document.getElementById('pane-order'), box: document.getElementById('view-order') },
    structure: { key: 'structure', el: document.getElementById('pane-structure'), box: document.getElementById('view-structure') },
  };
  var views = { order: { x: 20, y: 20, k: 1 }, structure: { x: 20, y: 20, k: 1 }, plane: { x: 20, y: 20, k: 1 } };
  var mode = 'split';
  var folded = { order: false, structure: false };
  var split = 0.46;
  // The gap between the two graphs on the shared plane: wide enough that the
  // eye reads two areas, narrow enough that one zoom-out holds both.
  var PLANE_GAP = 160;
  var planeOff = { x: 0, y: 0 };
  var expanded = {};
  F.groups.forEach(function (g, i) { expanded[g.id] = i === 0; });
  var showPrf = false;
  var showExr = F.showExrDefault;
  var selected = null;
  // The reader's own trail through the vault — see "a step back" below. Declared
  // up here with the rest of the state because the first paint records into it.
  var navLine = [], navIdx = -1, navSeq = 0, navQuiet = 0, navPush = true;

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
      // A section the filter hides whole is hidden whole, and takes no room:
      // a column of sections with holes in it reads as a broken page.
      var gone = fHide && fset && !g.members.some(function (id) { return fLit(id); });
      el.style.display = gone ? 'none' : '';
      if (gone) {
        frames[g.id] = { x: x, y: y, w: 0, h: 0, open: false, gone: true };
        return;
      }
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
    planeLayout();
    // Expanding a section changes how far the requirements graph reaches, which
    // is where the structure half BEGINS on the shared plane — so the layer has
    // to be moved in the same breath. Without this the areas were redrawn at
    // their new places while the boxes stayed behind, and an open section ran
    // straight over material that never got out of the way.
    applyView();
    paintFilter();
  }

  // --- reading states -----------------------------------------------------
  // mastered: the reader marked it. ready: every id in its FULL depends list is
  // mastered (vacuously true for roots). not ready: otherwise.
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
      'Progress cannot be saved for good — it lasts only while this page is open.';
  }

  // The count text ("12/21 mastered") is right-anchored at the bar's edge and
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

  // Readiness belongs to the ORDER graph alone. A box on the structure canvas
  // is a structure, not a reading assignment: the canvas shows everything the
  // vault holds at full strength and only a filter quietens it. The selector is
  // what enforces that — a structure box carries .node too, because an object
  // is a card in both graphs, so the unscoped query this used to run dimmed and
  // outlined half the canvas by how far the reader had got.
  function applyStates() {
    document.querySelectorAll('#glayer .node').forEach(function (n) {
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
        nDone + '/' + g.members.length + ' mastered';
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
      // "▸ proof" means "show me the proof": reveal proofs, open this one.
      if (!showPrf) {
        showPrf = true;
        document.getElementById('tglPrf').checked = true;
        relayout();
      }
      openPanel(badge.getAttribute('data-prf'), { toggle: true });
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
    if (node) openPanel(node.getAttribute('data-id'), { toggle: true });
  });

  var panel = document.getElementById('panel');
  var panelBody = document.getElementById('panel-body');
  var markBox = document.createElement('div');
  markBox.id = 'panel-mark';
  // `toggle` is for a click on the graph: the card IS the control, and a
  // control that only ever opens has no off switch. A link in the panel or in
  // the strip always opens, because following a link to the page you are on
  // and having it vanish is not an answer to anything.
  function openPanel(id, opts) {
    opts = opts || {};
    if (opts.toggle && selected === id && panel.classList.contains('open')) {
      closePanel();
      return;
    }
    // An object is a node on both tabs, so every card with the id is marked.
    document.querySelectorAll('.node.sel').forEach(function (n) { n.classList.remove('sel'); });
    selected = id;
    typeSel = null;
    document.querySelectorAll('.node[data-id="' + id + '"]').forEach(function (n) { n.classList.add('sel'); });
    // Picking in one graph lights the other: the trees a box is named by, the
    // boxes and arrows a tree is about. The filter's own match is untouched.
    setLink(id);
    panelBody.innerHTML = window.TREES[id] || '';
    var slot = panelBody.querySelector('.struct-sections');
    if (slot && S) slot.innerHTML = structureSections(id);
    updateStrip(id);
    // The mark control sits right under the head so the panel's primary
    // action is visible without scrolling. It is here for every tree, however
    // the panel was reached — including a click on a structure box. Readiness
    // belongs to the TREE, not to the graph the click came from: an object is a
    // card in the order graph too, listed in an index.md section, and one id
    // must not open two different panels depending on which pane the reader
    // happened to be in (the trail and the address restore a tree, not a
    // pane). What left the structure side is readiness PAINT on the canvas,
    // which applyStates no longer applies.
    var head = panelBody.querySelector('.panel-head');
    if (head) head.after(markBox); else panelBody.prepend(markBox);
    renderMarkUI(id);
    if (BRIDGE && BRIDGE.on) mountAsk(id);
    panel.classList.add('open');
    panel.scrollTop = 0;
    navRecord();
  }
  // Closing deselects as well: the orange outline and the violet link
  // highlight were both the open panel's shadow, and leaving either behind
  // says something is picked when nothing is.
  function closePanel() {
    var was = panel.classList.contains('open') || selected;
    panel.classList.remove('open');
    document.querySelectorAll('.node.sel').forEach(function (n) { n.classList.remove('sel'); });
    selected = null;
    typeSel = null;
    if (lset) { lset = null; paintFilter(); updateFbar(); }
    else if (S && S.twoLevel) drawOverlay();
    if (was) navRecord();
  }

  // A type edge opens the panel under a synthetic id, "type:<kindA>|<kindB>",
  // so the trail, the address, Escape and the close button need no special
  // case for it. It is not a tree: it gets no reading mark and no ask box,
  // because there is nothing here to master and nothing to ask that is not one
  // of the arrows it lists.
  function openTypePanel(key, opts) {
    if (!S || !S.twoLevel || !key) return;
    var ends = typeEnds(key);
    if (!objById[ends[0]] || !objById[ends[1]]) return;
    var id = 'type:' + key;
    if (opts && opts.toggle && selected === id && panel.classList.contains('open')) {
      closePanel();
      return;
    }
    document.querySelectorAll('.node.sel').forEach(function (n) { n.classList.remove('sel'); });
    selected = id;
    typeSel = key;
    setLink(id);
    panelBody.innerHTML = typePanelHtml(key);
    if (markBox.parentNode) markBox.parentNode.removeChild(markBox);
    updateStrip(id);
    panel.classList.add('open');
    panel.scrollTop = 0;
    drawOverlay();
    navRecord();
  }
  // The one door the address, the trail and a link all come through.
  function openAny(id, opts) {
    if (!id) return;
    if (id.indexOf('type:') === 0) openTypePanel(id.slice(5), opts);
    else if (F.nodes[id]) openPanel(id, opts);
  }

  function escText(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // A reference to a tree, built by the page rather than by the renderer: the
  // structure panel's rows and the type edge's page point at trees no wikilink
  // ever wrote. It is the SAME affordance as a wikilink's — underline, a
  // marker saying what waits on the other side, the taxon in the tooltip —
  // and the glyph table and the dead wording come from the renderer itself in
  // `window.FOREST_REF`, so the two builders cannot drift. A reference whose
  // target this vault does not hold is a dead one here too, not plain prose.
  var REF = window.FOREST_REF || { glyph: {}, dead: '%s' };
  function treeRef(id, label) {
    var t = F.nodes[id];
    var inner = escText(label || (t && t.title) || id);
    if (!t) {
      return '<span class="treelink tl-dead" title="' +
        escText(REF.dead.replace('%s', function () { return id; })) + '">' +
        '<span class="tl-mark" aria-hidden="true">⊘</span>' + inner + '</span>';
    }
    var word = (F.taxa && F.taxa[t.taxon]) || t.taxon;
    return '<a href="#" class="treelink' + (t.taxon ? ' tl-' + escText(t.taxon) : '') +
      '" data-open="' + escText(id) + '"' +
      (t.taxon ? ' data-taxon="' + escText(t.taxon) + '"' : '') +
      ' title="' + escText(word ? word + ' · ' + id : id) + '">' +
      '<span class="tl-mark" aria-hidden="true">' + (REF.glyph[t.taxon] || '◦') +
      '</span>' + inner + '</a>';
  }

  function stateLabel(st) {
    return st === 'done' ? 'mastered'
      : st === 'ready' ? 'ready to read' : 'not ready';
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
    var h = '<div class="mark-state">State: ' + stateLabel(st) + '</div>';
    h += st === 'done'
      ? '<button class="mark-btn is-done" data-act="unmark">Unmark as mastered</button>'
      : '<button class="mark-btn" data-act="mark">Mark as mastered ✓</button>';
    if (opts.prompt) {
      h += '<div class="mark-prompt">' +
        '<button class="mp-close" data-act="dismiss" title="Dismiss">×</button>' +
        '<p>Want to test yourself first? Open <code>/tutor</code> in Claude Code and ask:</p>' +
        '<p><code>' + escText(testPhrase(id)) + '</code></p>' +
        '<div class="mp-actions">' +
        '<button data-act="copy">Copy</button>' +
        '<button data-act="confirm">Just mark it</button>' +
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
      ? { note: "Note: this tree's prerequisites are not mastered yet." }
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
        b.textContent = ok ? 'Copied ✓' : 'Copying failed';
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
    if (!confirm('Reset all progress? Every mastered mark will be erased.')) return;
    done = {};
    try { localStorage.removeItem(F.progressKey); } catch (e) {}
    applyStates();
    if (selected) renderMarkUI(selected);
  });
  document.getElementById('close').addEventListener('click', function () {
    closePanel();
  });
  panelBody.addEventListener('click', function (ev) {
    var f = ev.target.closest('button[data-focus]');
    if (f) {
      // Unfolding the pane is the means, not a destination: the two land as
      // one step, so one Back leaves the diagram AND the fold behind.
      navQuiet++;
      try { revealStructure(); } finally { navQuiet--; }
      focusDefinition(f.getAttribute('data-focus'));
      return;
    }
    var a = ev.target.closest('a[data-open]');
    if (a) { ev.preventDefault(); openAny(a.getAttribute('data-open')); }
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

  // --- pan / zoom, one view per pane --------------------------------------
  // The working area sits below the top bar in the page's own flow, so a view's
  // numbers are its pane's pixels and no toolbar height enters the arithmetic.
  // Each arrangement keeps its own views: fold a pane, switch to the plane and
  // back, and every graph is where the reader left it.
  function viewOfLayer(which) { return mode === 'plane' ? views.plane : views[which]; }
  function sview() { return viewOfLayer('structure'); }
  function paneView(p) { return viewOfLayer(p.key); }
  function paneBox() { return mode === 'plane' ? PANE.order.box : PANE.structure.box; }
  function barTop() { return topbar.offsetHeight + 10; }
  function applyView() {
    var vo = viewOfLayer('order');
    world.setAttribute('transform',
      'translate(' + vo.x + ',' + vo.y + ') scale(' + vo.k + ')');
    if (slayer) {
      // On the shared plane the structure layer carries its own place inside the
      // one world; in the split it is the whole of its own world.
      if (mode === 'plane') slayer.setAttribute('transform', 'translate(' + planeOff.x + ',' + planeOff.y + ')');
      else slayer.removeAttribute('transform');
    }
    if (world2 && mode === 'split') {
      var vs = views.structure;
      world2.setAttribute('transform',
        'translate(' + vs.x + ',' + vs.y + ') scale(' + vs.k + ')');
    }
    if (slabels) {
      // The HTML label overlay wears the matrix of whichever view carries the
      // structure layer, plus that layer's offset on the plane.
      var v = sview();
      var ox = mode === 'plane' ? planeOff.x : 0, oy = mode === 'plane' ? planeOff.y : 0;
      slabels.style.transform =
        'matrix(' + v.k + ',0,0,' + v.k + ',' + (v.x + ox * v.k) + ',' + (v.y + oy * v.k) + ')';
    }
  }
  var pan = null;
  ['order', 'structure'].forEach(function (key) {
    var p = PANE[key];
    if (!p.box) return;
    p.box.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var v = paneView(p);
      var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      var k2 = Math.min(4, Math.max(0.05, v.k * factor));
      var r = p.box.getBoundingClientRect();
      var px = ev.clientX - r.left, py = ev.clientY - r.top;
      v.x = px - ((px - v.x) / v.k) * k2;
      v.y = py - ((py - v.y) / v.k) * k2;
      v.k = k2;
      applyView();
    }, { passive: false });
    p.box.addEventListener('mousedown', function (ev) {
      if (ev.target.closest('.node, .grp-header, .inst, .sedge, .slabel, .sbox, .stag, .stype, .stype-lbl')) return;
      var v = paneView(p);
      pan = { v: v, box: p.box, x: ev.clientX - v.x, y: ev.clientY - v.y };
      p.box.classList.add('panning');
    });
  });
  window.addEventListener('mousemove', function (ev) {
    if (!pan) return;
    pan.v.x = ev.clientX - pan.x; pan.v.y = ev.clientY - pan.y;
    applyView();
  });
  window.addEventListener('mouseup', function () {
    if (pan) pan.box.classList.remove('panning');
    pan = null;
  });

  // How far the requirements graph reaches, which is both its own fit and where
  // the structure graph starts on the shared plane.
  function orderSize() {
    var w = 0, h = 0;
    Object.keys(frames).forEach(function (k) {
      if (frames[k].gone) return;
      w = Math.max(w, frames[k].x + frames[k].w);
      h = Math.max(h, frames[k].y + frames[k].h);
    });
    return { w: w, h: h };
  }
  // The diagram strip and the footer float over the working area, so a fit
  // against the whole pane would put the graph's lowest rows under them.
  function bottomChrome() {
    var strip = document.getElementById('strip');
    return (strip ? strip.offsetHeight : 0) + 30;
  }
  function fitOrder() {
    var box = PANE.order.box, r = box.getBoundingClientRect();
    if (!r.width) return;
    var v = views.order, sz = orderSize();
    v.k = Math.min(1, (r.width - 40) / (sz.w + 40));
    v.x = 20; v.y = 20;
  }

  // How the reader last arranged this vault: which arrangement, where the
  // divider sat, which pane was folded. Per vault, because the right split
  // depends on how wide that vault's structure canvas is — and in a try/catch,
  // because a private window hands out no storage and the page must still open.
  function restoreViewState() {
    var raw = null;
    try { raw = localStorage.getItem(F.viewKey); } catch (e) { storageOk = false; }
    if (!raw) return;
    try {
      var v = JSON.parse(raw);
      if (!v || v.v !== 1) return;
      if (S && v.mode === 'plane') mode = 'plane';
      if (typeof v.split === 'number' && v.split > 0.1 && v.split < 0.9) split = v.split;
      if (v.folded) {
        folded.order = !!v.folded.order;
        folded.structure = !!v.folded.structure;
        if (folded.order && folded.structure) folded.order = folded.structure = false;
      }
      if (!S) { mode = 'split'; folded.order = folded.structure = false; }
    } catch (e) { /* corrupt entry: the defaults are a fine page */ }
  }
  function saveViewState() {
    if (!storageOk) return;
    try {
      localStorage.setItem(F.viewKey, JSON.stringify({
        v: 1, mode: mode, split: Math.round(split * 1000) / 1000, folded: folded,
      }));
    } catch (e) { storageOk = false; storageNotice(); }
  }

  loadProgress();
  if (!storageOk) storageNotice();
  restoreViewState();
  applyArrangement(true);
  relayout();
  fitOrder();
  applyView();
  // A resized window changes what a fraction of the working area means, and the
  // panes are already flex; only the fixed bars have to be told.
  window.addEventListener('resize', function () {
    if (lbar && !lbar.hidden) lbar.style.top = barTop() + 'px';
    var fb = document.getElementById('focusbar');
    if (fb && !fb.hidden) fb.style.top = barTop() + 'px';
    placeTray();
  });

  // ---- Structure ------------------------------------------------------------
  // Boxes come positioned from the build; the page draws the arrows between
  // them and places their KaTeX labels, since only the browser knows how
  // wide a rendered label is (as fitGroupTitle already does for SVG text).
  var KIND_COLOR = {}, KIND_LABEL = {}, objById = {}, arrowById = {};
  var sedges = [];
  // A loop is an arc 20 high and about as wide on the top side of its box:
  // small enough to stay in the gap between two rows.
  var LOOP_H = 20, LOOP_W = 16, LOOP_FLARE = 12, LOOP_PITCH = 44;
  var sTop = 0;
  var structureFitted = false;

  // ---- the arrangement: side by side, or one plane -------------------------
  // The switch is one function: it moves the structure layer, its arrow markers
  // and its label overlay between the two panes' worlds and sets the pane
  // widths. Everything else — the filter, the selection, the reading marks, a
  // dragged layout — lives in JS and is untouched by the move, which is why
  // folding a pane or changing arrangement loses nothing.
  function applyArrangement(firstTime) {
    var plane = mode === 'plane';
    document.body.classList.toggle('one-plane', plane);
    document.body.classList.toggle('has-struct', !!S);
    if (S) {
      if (plane) {
        if (slayer.parentNode !== world) world.appendChild(slayer);
        if (sdefs && sdefs.parentNode !== svg) svg.insertBefore(sdefs, svg.firstChild);
        if (slabels.parentNode !== PANE.order.box) PANE.order.box.appendChild(slabels);
      } else {
        if (slayer.parentNode !== world2) world2.appendChild(slayer);
        if (sdefs && sdefs.parentNode !== svg2) svg2.insertBefore(sdefs, svg2.firstChild);
        if (slabels.parentNode !== PANE.structure.box) PANE.structure.box.appendChild(slabels);
      }
    }
    // Without a structure layer there is one graph and it takes the window.
    // Every width is set here, because a folded pane's rail has to beat both
    // #pane-structure's own flex and the split's inline one.
    // Folding one pane gives the window to the other, which is the whole point
    // of folding: the split only means something while both are open.
    PANE.order.el.style.flex = (plane || !S || folded.structure) ? '1 1 auto'
      : folded.order ? '0 0 28px' : '0 0 ' + (split * 100).toFixed(2) + '%';
    if (PANE.structure.el) {
      PANE.structure.el.style.flex = (!plane && folded.structure) ? '0 0 28px' : '1 1 0';
    }
    ['order', 'structure'].forEach(function (k) {
      if (!PANE[k].el) return;
      var off = !plane && folded[k];
      PANE[k].el.classList.toggle('folded', off);
      document.body.classList.toggle('fold-' + k, plane ? false : folded[k]);
    });
    document.querySelectorAll('#modes .mode').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mode') === mode);
    });
    document.querySelectorAll('.pane-fold').forEach(function (b) {
      b.textContent = folded[b.getAttribute('data-pane')] ? '▸' : '▾';
    });
    if (!firstTime) {
      relayout();
      if (S) {
        if (plane) fitPlane();
        else if (!folded.structure) { if (!structureFitted) { fitStructure(); structureFitted = true; } }
        drawStructure();
        measureStructure();
      }
      applyView();
    }
  }

  // A pane that was hidden had no sizes, so anything measured in pixels — a
  // KaTeX label's width, a symbol's scale — is measured when it comes back.
  function measureStructure() {
    if (!S) return;
    var box = paneBox();
    if (!box || !box.offsetWidth) return;
    placeLabels();
    fitSymbols();
  }

  function setMode(next) {
    if (!S || next === mode) return;
    // Leaving a focused diagram is part of changing arrangement, not a stop of
    // its own, so the two are recorded as one step.
    navQuiet++;
    try { unfocus(); } finally { navQuiet--; }
    mode = next;
    applyArrangement(false);
    saveViewState();
    navRecord();
  }
  function setFold(key, off) {
    if (!S || mode === 'plane' || !PANE[key].el) return;
    if (folded[key] === off) return;
    folded[key] = off;
    // Both folded would leave an empty window; the other one opens instead.
    var other = key === 'order' ? 'structure' : 'order';
    if (off && folded[other]) folded[other] = false;
    applyArrangement(false);
    saveViewState();
    navRecord();
  }
  // The panel's "show this definition on the canvas" button needs the structure
  // visible, whatever the reader last folded away.
  function revealStructure() {
    if (!S) return;
    if (mode === 'split' && folded.structure) setFold('structure', false);
  }

  if (document.getElementById('modes')) {
    document.getElementById('modes').addEventListener('click', function (ev) {
      var b = ev.target.closest('.mode');
      if (b) setMode(b.getAttribute('data-mode'));
    });
  }
  document.querySelectorAll('.pane-fold').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-pane');
      setFold(key, !folded[key]);
    });
  });

  // The divider: a fraction of the working area, not a pixel count, so the
  // split survives a resized window.
  var divider = document.getElementById('divider');
  if (divider) {
    var dragSplit = null;
    divider.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      dragSplit = canvas.getBoundingClientRect();
      divider.classList.add('dragging');
    });
    window.addEventListener('mousemove', function (ev) {
      if (!dragSplit) return;
      folded.order = folded.structure = false;
      split = Math.min(0.85, Math.max(0.15, (ev.clientX - dragSplit.left) / dragSplit.width));
      applyArrangement(true);
      applyView();
    });
    window.addEventListener('mouseup', function () {
      if (!dragSplit) return;
      dragSplit = null;
      divider.classList.remove('dragging');
      measureStructure();
      saveViewState();
    });
  }

  // Where the structure graph sits on the shared plane: to the right of the
  // requirements graph, which is the same left-to-right order the two panes
  // have, so switching arrangement does not flip the reader's mental map.
  function planeLayout() {
    if (!S) return;
    planeOff.x = orderSize().w + PLANE_GAP;
    planeOff.y = 0;
    drawPlaneAreas();
  }

  // The two graphs, each in a faintly tinted area with a quiet title: the same
  // treatment a region of the structure canvas and a section of the
  // requirements graph get, so one visual language says "these belong together"
  // at all three scales.
  function drawPlaneAreas() {
    if (!pareas) return;
    if (mode !== 'plane' || !S) { pareas.innerHTML = ''; return; }
    var sz = orderSize();
    var top = Math.min(0, sTop || 0);
    var boxes = [
      { x: 0, y: 0, w: sz.w, h: sz.h, t: 'Order', s: 'trees and prerequisites' },
      { x: planeOff.x, y: planeOff.y + top, w: S.size.w, h: S.size.h - top,
        t: 'Structure', s: 'kinds, instances and arrows' },
    ];
    pareas.innerHTML = boxes.map(function (b) {
      // Before the graphs are measured a frame has no size yet; skip it and
      // let the next paint draw it.
      if (!(b.w > 0 && b.h > 0) || !isFinite(b.x) || !isFinite(b.y)) return '';
      var x = b.x - AREA_PAD, y = b.y - AREA_PAD - AREA_TITLE;
      return '<g class="parea"><rect class="parea-box" x="' + r1(x) + '" y="' + r1(y) +
        '" width="' + r1(b.w + 2 * AREA_PAD) + '" height="' + r1(b.h + 2 * AREA_PAD + AREA_TITLE) +
        '" rx="18"/><text class="parea-title" x="' + r1(x + 22) + '" y="' + r1(y + 34) + '">' +
        escText(b.t) + '</text><text class="parea-sub" x="' + r1(x + 22) + '" y="' + r1(y + 34) +
        '" dx="' + Math.round(b.t.length * 14.5 + 24) + '">' + escText(b.s) + '</text></g>';
    }).join('');
  }

  // sTop is how far a loop on a top-row box, and its label, reach over the
  // top of the layout.
  //
  // A canvas of several regions does not open fitted. At the zoom that holds
  // seven frames on one screen a box title renders at four pixels and the
  // picture is shapes and nothing else, so the fit has a floor — READ_K, the
  // zoom at which a title is still a word. When the whole canvas will not go
  // that large, the view opens on the first region and the reader pans to the
  // rest, which is what regions are for.
  // The floor is for the two-level canvas, which is a plane of regions; a 0.2
  // canvas is one column of boxes and still opens fitted, as it always has.
  var READ_K = 0.75;
  function fitStructure() {
    if (!S || !PANE.structure.box) return;
    var r = PANE.structure.box.getBoundingClientRect();
    if (!r.width) return;
    var aw = r.width - 40, ah = r.height - 30 - bottomChrome();
    var k = Math.min(1.2, aw / (S.size.w + 40), ah / (S.size.h - sTop + 40));
    var floor = S.twoLevel ? READ_K : 0.2;
    var first = S.twoLevel && (S.regions || [])[0];
    if (k < floor && first) {
      k = Math.max(floor, Math.min(1.2, aw / (first.w + 40), ah / (first.h + 40)));
      views.structure.k = k;
      views.structure.x = 20 - first.x * k;
      views.structure.y = 20 - Math.min(first.y, sTop) * k;
      return;
    }
    views.structure.k = Math.max(floor, k);
    views.structure.x = 20;
    views.structure.y = 20 - sTop * views.structure.k;
  }

  // The shared plane opens on the whole of both graphs, floor and all: seeing
  // the two at once is the only reason to choose this arrangement, so here the
  // fit wins over the readable-title zoom and the reader zooms into whichever
  // half they want.
  function fitPlane() {
    var box = PANE.order.box, r = box.getBoundingClientRect();
    if (!r.width || !S) return;
    var sz = orderSize(), top = Math.min(0, sTop);
    var w = planeOff.x + S.size.w + 80;
    var h = Math.max(sz.h, S.size.h) - top + 80;
    var k = Math.min(1, (r.width - 40) / w, (r.height - 30 - bottomChrome()) / h);
    views.plane.k = Math.max(0.06, k);
    views.plane.x = 20 + AREA_PAD * views.plane.k;
    views.plane.y = 20 + (AREA_PAD + AREA_TITLE - top) * views.plane.k;
  }

  function boxOf(id) {
    var p = S.pos[id];
    if (S.twoLevel) { var o = objById[id]; return { x: p.x, y: p.y, w: o.w, h: o.h }; }
    var n = (S.instances[id] || []).length;
    return { x: p.x, y: p.y, w: G.NODE_W, h: G.NODE_H + n * (S.geom.INST_H + S.geom.INST_GAP) };
  }
  function unit(x, y) { var l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  // Where a ray from inside a box leaves it: the nearer of the two sides it
  // can cross.
  function exitPoint(b, from, to) {
    var dx = to[0] - from[0], dy = to[1] - from[1], t = 1, s;
    if (dx) { s = ((dx > 0 ? b.x + b.w : b.x) - from[0]) / dx; if (s >= 0) t = Math.min(t, s); }
    if (dy) { s = ((dy > 0 ? b.y + b.h : b.y) - from[1]) / dy; if (s >= 0) t = Math.min(t, s); }
    return [from[0] + dx * t, from[1] + dy * t];
  }
  // A straight run, written as a cubic whose controls sit on the line, so the
  // label placement samples and measures it like any other edge.
  function straight(p, q) {
    return [p, [p[0] + (q[0] - p[0]) / 3, p[1] + (q[1] - p[1]) / 3],
      [p[0] + 2 * (q[0] - p[0]) / 3, p[1] + 2 * (q[1] - p[1]) / 3], q];
  }
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
    // On a two-level canvas every arrow is straight, border to border. Two
    // arrows between one pair of boxes step aside by a small offset; nothing
    // bends, because placement is what keeps an arrow clear of a third box and
    // a curve would only hide a layout that failed.
    if (S.twoLevel) {
      var pairs = {};
      list.forEach(function (e) {
        if (e.loop) return;
        var k = e.from < e.to ? e.from + '|' + e.to : e.to + '|' + e.from;
        (pairs[k] = pairs[k] || []).push(e);
      });
      Object.keys(pairs).sort().forEach(function (k) {
        var g = pairs[k];
        g.forEach(function (e, n) {
          var A = boxOf(e.from), B = boxOf(e.to);
          var ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
          var u = unit(cb[0] - ca[0], cb[1] - ca[1]);
          // The offset has to keep both ends inside their boxes, so the
          // shallowest box in the pair caps it.
          var lim = Math.max(0, Math.min(A.w, B.w, A.h, B.h) / 2 - 9);
          var off = Math.max(-lim, Math.min(lim, (n - (g.length - 1) / 2) * 15));
          var p = [ca[0] - u[1] * off, ca[1] + u[0] * off];
          var q = [cb[0] - u[1] * off, cb[1] + u[0] * off];
          e.p0 = exitPoint(A, p, q);
          e.p2 = exitPoint(B, q, p);
          e.segs = [straight(e.p0, e.p2)];
        });
      });
      return list;
    }
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
    edgeByArrow = {};
    sedges.forEach(function (e) { e.ids.forEach(function (x) { edgeByArrow[x] = e; }); });
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
      var dy = o.level === 'instance' ? 20 : 24;
      lh += '<span class="ssym" data-id="' + escText(o.id) + '" style="left:' + (p.x + 10) + 'px;top:' + (p.y + dy) + 'px">' + o.symbol_html + '</span>';
      if (S.twoLevel && o.level === 'instance' && objById[o.of]) {
        // The tag hangs just under the box, outside it: inside, it would have
        // to share a 42px card with the title and the author's symbol, and the
        // kind names it carries run to 46 characters. The gap below an instance
        // box is 28px at its tightest in Monsky, 48 in mini, so a 13px line
        // sitting 2px down clears whatever stands below it.
        var name = objTitle(o.of);
        lh += '<span class="stag" data-inst="' + escText(o.id) + '" data-of="' + escText(o.of) +
          '" title="an instance of: ' + escText(name) + '" style="left:' + r1(p.x) + 'px;top:' + r1(p.y + o.h + 2) + 'px">' +
          '<span class="stag-in">∈</span>' + escText(name) + '</span>';
      }
    });
    document.getElementById('sedges').innerHTML = eh;
    slabels.innerHTML = lh;
    slabels.appendChild(overlayBox);
    if (S.twoLevel) drawRegions();
    fitSymbols();
    // Edges, labels and tags were just replaced wholesale, so whatever the
    // filter and the selection had lit has to be lit again — and paintFilter
    // ends by redrawing the on-demand layer, which the new geometry needs.
    paintFilter();
  }

  // --- the two levels: a tag at rest, a line one hover away ----------------
  //
  // An instance used to be joined to its kind by a drawn tie, one per instance.
  // Fifteen kinds and thirty-eight instances made every kind a hub of
  // converging dashed lines — and the lines said only "these boxes share a
  // type", which is the one thing a word can say better. The owner's verdict:
  // "definitely use a tag instead of a line. Only when user highlight an
  // instance it would be good to then highlight the line to its type object."
  //
  // So the kind's name is a tag on the box (drawn with the labels, above), and
  // NOTHING of the type level is on the canvas at rest. Highlight an instance
  // and the line to its kind appears. Highlight an arrow between two instances
  // and the TYPE-LEVEL EDGE behind it appears between their two kinds, with
  // both ties, so the whole path — this box, its kind, the shape of the
  // relationship, the other kind, that box — reads in one glance. Let go and
  // the canvas is quiet again.
  //
  // `hover` is what the pointer is on, `selected` what the panel holds, and
  // `typeSel` a type edge whose own panel is open; the overlay is the union, so
  // a reader can pin a relationship by clicking it and then let the mouse go.
  // Those three and `edgeByArrow` are declared with the state at the top.
  //
  // The label overlay is rebuilt wholesale by drawStructure, so the type
  // edge's own chip lives in a box of its own that is re-appended after.
  var overlayBox = document.createElement('div');
  overlayBox.id = 'stypelabels';

  function kindOfObj(id) {
    var o = objById[id];
    return o && o.level === 'instance' && objById[o.of] ? o.of : null;
  }
  // The type edge behind an arrow: the kinds of its two ends. An arrow whose
  // ends are already kinds has nothing above it — it IS the type level — so it
  // raises no edge, and an arrow that lost an end to a layout has none either.
  function typeKeyOf(e) {
    if (!e) return null;
    var a = kindOfObj(e.from), b = kindOfObj(e.to);
    return a && b && S.pos[a] && S.pos[b] ? a + '|' + b : null;
  }
  function typeEnds(key) {
    var i = key.indexOf('|');
    return [key.slice(0, i), key.slice(i + 1)];
  }
  // Every instance-level arrow that projects onto one type edge. Several
  // sharing an edge is information, not noise: three of Monsky's homs are maps
  // between two fields, and that the vault needs three of them is the point.
  function arrowsOfType(key) {
    var ends = typeEnds(key);
    return S.arrows.filter(function (a) {
      return kindOfObj(a.from) === ends[0] && kindOfObj(a.to) === ends[1];
    });
  }
  // Constructions the vault draws between the same two kinds. Not the same
  // arrows — these live a level up — but a reader who sees "a map from a ring
  // to a field" will ask whether the vault's fraction field is that map, and
  // the answer belongs on the page rather than in their head.
  function kindArrowsOfType(key) {
    var ends = typeEnds(key);
    return S.arrows.filter(function (a) {
      return a.from === ends[0] && a.to === ends[1] && !kindOfObj(a.from);
    });
  }

  function tieGeom(id) {
    var o = objById[id], A = boxOf(id), B = boxOf(o.of);
    var ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
    return [exitPoint(A, ca, cb), exitPoint(B, cb, ca)];
  }
  // A type edge between two different kinds is a straight run border to
  // border. Between one kind and itself — "a map between two structures of
  // this sort", which is what most of them are — it is an arc on the BOTTOM
  // side, because the top side is where a real loop is drawn and the two
  // levels must never be mistaken for each other.
  var TYPE_LOOP_H = 34;
  function typeGeom(key) {
    var ends = typeEnds(key), A = boxOf(ends[0]);
    if (ends[0] === ends[1]) {
      var x1 = A.x + A.w * 0.32, x2 = A.x + A.w * 0.68, y = A.y + A.h;
      var c = y + TYPE_LOOP_H * 4 / 3;
      return {
        d: 'M' + r1(x1) + ',' + r1(y) + ' C' + r1(x1 - 18) + ',' + r1(c) + ' ' + r1(x2 + 18) + ',' + r1(c) + ' ' + r1(x2) + ',' + r1(y),
        mid: [(x1 + x2) / 2, y + TYPE_LOOP_H],
        // The arc runs flat under the box, so its chip slides sideways along
        // it and, away from the box, downwards.
        dir: [1, 0], norm: [0, 1],
      };
    }
    var B = boxOf(ends[1]);
    var ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
    var p = exitPoint(A, ca, cb), q = exitPoint(B, cb, ca);
    var u = unit(q[0] - p[0], q[1] - p[1]);
    return {
      d: 'M' + r1(p[0]) + ',' + r1(p[1]) + ' L' + r1(q[0]) + ',' + r1(q[1]),
      mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
      dir: u, norm: [-u[1], u[0]],
    };
  }

  // What the overlay should be showing, from the three sources at once.
  function overlayWanted() {
    var ties = {}, types = {};
    if (defFocus.on) return { ties: ties, types: types };
    var tie = function (id) { if (kindOfObj(id)) ties[id] = true; };
    var edge = function (arrowId) {
      var k = typeKeyOf(edgeByArrow[arrowId]);
      if (!k) return;
      types[k] = true;
      tie(arrowById[arrowId] ? arrowById[arrowId].from : null);
      tie(arrowById[arrowId] ? arrowById[arrowId].to : null);
    };
    tie(hover.box);
    tie(selected);
    if (hover.edge) edge(hover.edge);
    if (selected && arrowById[selected]) edge(selected);
    // Hovering the raised edge or its chip must not make it vanish under the
    // cursor, and a pinned one stays until the panel it opened is closed.
    if (hover.type) types[hover.type] = true;
    if (typeSel) types[typeSel] = true;
    return { ties: ties, types: types };
  }
  // Dimming for the on-demand layer is decided here rather than in
  // paintFilter: these elements do not exist until the moment they are drawn,
  // so there is nothing for a later paint to find.
  // '' for an element the filter leaves standing, ' fdim' for one it leaves
  // out, and null for one `hide` takes away — which here means not emitting
  // it, since nothing exists to hide until the moment it is drawn.
  function fPair(a, b) {
    if (!fset || (fLit(a) && fLit(b))) return '';
    return fHide ? null : ' fdim';
  }
  function drawOverlay() {
    if (!structureReady || !S.twoLevel) return;
    var want = overlayWanted();
    var th = '', lh = '';
    Object.keys(want.ties).sort().forEach(function (id) {
      var of = objById[id].of, cls = fPair(id, of);
      if (cls === null) return;
      var g = tieGeom(id);
      th += '<line class="stie' + cls + '" data-inst="' + escText(id) + '" data-of="' + escText(of) +
        '" x1="' + r1(g[0][0]) + '" y1="' + r1(g[0][1]) + '" x2="' + r1(g[1][0]) + '" y2="' + r1(g[1][1]) + '"/>';
    });
    var yh = '', geo = {};
    Object.keys(want.types).sort().forEach(function (key) {
      var ends = typeEnds(key), cls = fPair(ends[0], ends[1]);
      if (cls === null) return;
      var g = typeGeom(key), n = arrowsOfType(key).length;
      geo[key] = g;
      yh += '<g class="stype' + cls + (typeSel === key ? ' stype-on' : '') + '" data-type="' + escText(key) + '">' +
        '<path class="hit" d="' + g.d + '"/>' +
        '<path class="line" d="' + g.d + '" marker-end="url(#ah-type)"/></g>';
      lh += '<span class="stype-lbl' + cls + (typeSel === key ? ' stype-on' : '') + '" data-type="' + escText(key) +
        '" title="' + escText(objTitle(ends[0]) + ' → ' + objTitle(ends[1]) + ' — click for both types’ context') +
        '" style="left:' + r1(g.mid[0]) + 'px;top:' + r1(g.mid[1]) + 'px">type level · ' +
        n + (n === 1 ? ' arrow' : ' arrows') + ' ▸</span>';
    });
    document.getElementById('sties').innerHTML = th;
    document.getElementById('stypes').innerHTML = yh;
    overlayBox.innerHTML = lh;
    placeTypeChips(geo);
    // Both kinds of a raised edge, and the kind a raised tie points at, are
    // lit on the canvas: the instance "contributes its type" to the level
    // above, which is only legible if the box up there answers.
    var litKinds = {};
    Object.keys(want.ties).forEach(function (id) { litKinds[objById[id].of] = true; });
    Object.keys(want.types).forEach(function (k) { typeEnds(k).forEach(function (e) { litKinds[e] = true; }); });
    document.querySelectorAll('#slayer .sbox').forEach(function (b) {
      b.classList.toggle('tlit', !!litKinds[b.getAttribute('data-box')]);
    });
  }

  // An edge's midpoint is where its chip belongs and also, routinely, where a
  // box is: two kinds a region apart have a straight run between them that
  // passes over everything in the way, and the chip's background is opaque, so
  // three of Monsky's raised chips covered a box — twice one of the two the
  // edge itself runs between, which is exactly what the reader is being told
  // about. So the chip gets the same escape placeLabels gives an arrow's own
  // label: the midpoint first, then along its own line, then out to the side,
  // nearest spot that costs nothing, else the cheapest.
  //
  // BOTH directions are needed, not just the perpendicular. A vertical edge's
  // perpendicular is horizontal, and sliding a 121px chip sideways along a row
  // of 176px boxes never leaves one — the mini vault's group→set chip was
  // still on `obj-nat` after 80px of it. Along the line is also the better
  // first move: the chip stays on the edge it names.
  //
  // Chips keep off each other too, because a pinned edge and a hovered one are
  // up at once. Never more than a handful, so the sweep is cheap enough to
  // redo on every hover.
  var CHIP_STEPS = [0, 1, -1, 2, -2, 3, -3];
  function chipSpots(g, w, h) {
    var along = w / 2 + 10, out = h + 6, spots = [];
    CHIP_STEPS.forEach(function (t) {
      CHIP_STEPS.forEach(function (o) {
        spots.push({
          d: Math.abs(t) + 1.2 * Math.abs(o),
          m: [g.mid[0] + g.dir[0] * t * along + g.norm[0] * o * out,
              g.mid[1] + g.dir[1] * t * along + g.norm[1] * o * out],
        });
      });
    });
    spots.sort(function (a, b) { return a.d - b.d; });
    return spots;
  }
  function placeTypeChips(geo) {
    var boxes = S.objects.map(function (o) { return boxOf(o.id); });
    var placed = [];
    overlayBox.querySelectorAll('.stype-lbl').forEach(function (sp) {
      var g = geo[sp.getAttribute('data-type')];
      if (!g) return;
      var w = sp.offsetWidth, h = sp.offsetHeight;
      if (!w) return;
      var spots = chipSpots(g, w, h), best = null;
      for (var i = 0; i < spots.length; i++) {
        var m = spots[i].m;
        var r = { x: m[0] - w / 2, y: m[1] - h / 2, w: w, h: h }, cost = 0;
        boxes.forEach(function (b) { cost += overlap(r, b); });
        placed.forEach(function (b) { cost += overlap(r, b); });
        if (!best || cost < best.cost) best = { cost: cost, m: m, r: r };
        if (!best.cost) break;
      }
      sp.style.left = r1(best.m[0]) + 'px';
      sp.style.top = r1(best.m[1]) + 'px';
      placed.push(best.r);
    });
  }

  // A region's frame is its boxes' bounding box plus the margin and the title
  // strip, recomputed here so a dragged box takes its area with it.
  function drawRegions() {
    (S.regions || []).forEach(function (r) {
      var g = document.querySelector('#sregions .sregion[data-region="' + r.id + '"]');
      if (!g) return;
      var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, n = 0;
      S.objects.forEach(function (o) {
        if ((o.region || '') !== r.id) return;
        var b = boxOf(o.id);
        x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
        x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
        n++;
      });
      if (!n) return;
      var pad = S.reg.pad, th = S.reg.title_h;
      var box = g.querySelector('rect'), txt = g.querySelector('text');
      box.setAttribute('x', r1(x1 - pad)); box.setAttribute('y', r1(y1 - pad - th));
      box.setAttribute('width', r1(x2 - x1 + 2 * pad));
      box.setAttribute('height', r1(y2 - y1 + 2 * pad + th));
      txt.setAttribute('x', r1(x1 - pad + 16)); txt.setAttribute('y', r1(y1 - pad - th + 20));
    });
  }

  // A symbol is the author's mathematics, so none of it is dropped: one too
  // wide for its box is scaled down from its left edge until it fits.
  function fitSymbols() {
    slabels.querySelectorAll('.ssym').forEach(function (s) {
      s.style.transform = '';
      var box = document.querySelector('#slayer .snode[data-id="' + s.getAttribute('data-id') + '"] rect');
      if (!box) return;
      // Both rectangles are read on screen, so the view's own pan and zoom
      // cancel and the ratio is the scale the symbol needs.
      var sr = s.getBoundingClientRect(), br = box.getBoundingClientRect();
      var room = br.right - 8 - sr.left;
      if (sr.width > room && room > 0) s.style.transform = 'scale(' + (room / sr.width).toFixed(3) + ')';
    });
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
    // Beside the line, then further beside it: a label whose cheapest spot on
    // the line still costs box area has somewhere to go, because an arrow with
    // a box close on both sides offers no free spot within one half-height.
    [1, 2.1, 3.4].forEach(function (ring) {
      ts.forEach(function (t) {
        var m = bez(e, t), tg = tangent(e, t);
        [1, -1].forEach(function (side) {
          var d = side * ring * (h / 2 + 3);
          spots.push([m[0] - tg[1] * d, m[1] + tg[0] * d]);
        });
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
    placeTags();
  }

  // A kind tag hangs under its box and is usually wider than it — kind names
  // run to 46 characters against a 148px box. One pair in Monsky stands close
  // enough that the tag under the left box reached 13px into the right one, so
  // a tag gives up the characters it has no room for and keeps the whole name
  // in its tooltip. Nothing is moved: a tag that drifted off its own box would
  // stop saying which box it is about, which is its only job.
  function placeTags() {
    if (!S || !S.twoLevel) return;
    var all = S.objects.map(function (o) { var b = boxOf(o.id); b.id = o.id; return b; });
    slabels.querySelectorAll('.stag').forEach(function (t) {
      t.style.maxWidth = '';
      var id = t.getAttribute('data-inst'), b = boxOf(id);
      var h = t.offsetHeight, w = t.offsetWidth;
      if (!w) return;
      var y = b.y + b.h + 2, room = Infinity;
      all.forEach(function (q) {
        if (q.id === id || y > q.y + q.h || q.y > y + h || q.x + q.w <= b.x) return;
        room = Math.min(room, q.x - 6 - b.x);
      });
      if (w > room) t.style.maxWidth = Math.max(70, Math.floor(room)) + 'px';
    });
  }

  // --- editing the layout --------------------------------------------------
  // Panning belongs to the empty background, so a box is free to carry the
  // drag: press one and travel more than a few pixels and it moves; press and
  // let go without travelling and it is the click that opens the tree. The
  // picture is live — arrows, ties and region frames follow the box — and the
  // arrangement is only written to the vault when the author says so.
  var DRAG_SLOP = 4;
  var basePos = null, drag = null, dragged = false, raf = null, dirty = false;
  function snapshot() {
    var out = {};
    Object.keys(S.pos).forEach(function (id) { out[id] = { x: S.pos[id].x, y: S.pos[id].y }; });
    return out;
  }
  function scheduleRedraw() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; drawStructure(); });
  }
  if (S && S.twoLevel) {
    slayer.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0 || defFocus.on) return;
      var box = ev.target.closest('.sbox');
      if (!box) return;
      ev.preventDefault();
      var id = box.getAttribute('data-box');
      drag = { id: id, el: box, cx: ev.clientX, cy: ev.clientY, x0: S.pos[id].x, y0: S.pos[id].y, live: false };
    });
    window.addEventListener('mousemove', function (ev) {
      if (!drag) return;
      if (!drag.live && Math.abs(ev.clientX - drag.cx) + Math.abs(ev.clientY - drag.cy) < DRAG_SLOP) return;
      drag.live = true;
      var p = S.pos[drag.id];
      var dk = sview().k;
      p.x = Math.round(drag.x0 + (ev.clientX - drag.cx) / dk);
      p.y = Math.round(drag.y0 + (ev.clientY - drag.cy) / dk);
      drag.el.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      scheduleRedraw();
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      if (drag.live) { dragged = true; dirty = true; drawStructure(); placeLabels(); showLayoutBar(); }
      drag = null;
    });
  }

  // The whole arrangement is saved, not only the boxes that moved: the file is
  // the picture the author sees, and a box left to the algorithm would drift
  // the next time a neighbour changes. Positions go back in the coordinates
  // `pos` is written in — each box's own region.
  function regionOrigin(id) {
    var rs = S.regions || [];
    for (var i = 0; i < rs.length; i++) if (rs[i].id === (id || '')) return rs[i].origin;
    return [0, 0];
  }
  function layoutPos() {
    var out = {};
    S.objects.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }).forEach(function (o) {
      var org = regionOrigin(o.region);
      out[o.id] = [Math.round(S.pos[o.id].x - org[0]), Math.round(S.pos[o.id].y - org[1])];
    });
    return out;
  }
  function layoutJson() { return JSON.stringify({ pos: layoutPos() }, null, 2) + '\n'; }
  var lbar = document.getElementById('layoutbar');
  function showLayoutBar(msg, err) {
    if (!lbar) return;
    lbar.hidden = false;
    lbar.style.top = barTop() + 'px';
    lbar.classList.toggle('err', !!err);
    var save = document.getElementById('lb-save');
    save.hidden = !BRIDGE.on;
    document.getElementById('lb-msg').textContent = msg || (BRIDGE.on
      ? 'The arrangement changed — save it to ' + S.layoutFile + ' so it survives a rebuild.'
      : 'The arrangement changed. A page opened from disk cannot write to the vault — copy or download it and save it as ' + S.layoutFile + ' in the vault root.');
    var json = document.getElementById('lb-json');
    json.value = layoutJson();
    document.getElementById('lb-dl').href =
      'data:application/json;charset=utf-8,' + encodeURIComponent(json.value);
  }
  if (lbar) {
    lbar.addEventListener('click', function (ev) {
      var b = ev.target.closest('button, a');
      if (!b) return;
      if (b.id === 'lb-save') {
        b.disabled = true;
        api('/api/layout', { method: 'POST', body: { pos: layoutPos() } }).then(function (r) {
          b.disabled = false;
          if (r.error) throw new Error(r.error);
          dirty = false;
          showLayoutBar('Saved to ' + S.layoutFile + ' (' + r.count + ' boxes) — a rebuild will keep this arrangement.');
        }).catch(function (e) { b.disabled = false; showLayoutBar('Saving failed: ' + e.message, true); });
      } else if (b.id === 'lb-copy') {
        var text = layoutJson();
        var done = function (ok) { b.textContent = ok ? 'Copied ✓' : 'Copying failed'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
        } else { done(legacyCopy(text)); }
        document.getElementById('lb-json').hidden = false;
      } else if (b.id === 'lb-undo') {
        Object.keys(basePos).forEach(function (id) {
          S.pos[id] = { x: basePos[id].x, y: basePos[id].y };
        });
        S.objects.forEach(function (o) {
          var el = document.querySelector('#slayer .sbox[data-box="' + o.id + '"]');
          if (el) el.setAttribute('transform', 'translate(' + S.pos[o.id].x + ',' + S.pos[o.id].y + ')');
        });
        dirty = false;
        drawStructure(); placeLabels();
        lbar.hidden = true;
      }
    });
  }
  window.addEventListener('beforeunload', function (ev) {
    if (!dirty) return;
    ev.preventDefault();
    ev.returnValue = '';
  });

  // --- one level lower: a kind's defining diagram on the canvas ------------
  // The panel already typesets the diagram; this shows it in place, with the
  // rest of the canvas out of the way and one way back. `defFocus` itself is
  // declared with the rest of the state at the top of the file.
  function focusDefinition(id) {
    var o = objById[id];
    if (!o || !o.data || !o.data.length) return;
    var keep = {}, arrows = {};
    keep[id] = true;
    o.data.forEach(function (x) {
      var a = arrowById[x];
      if (a) { arrows[x] = true; keep[a.from] = true; keep[a.to] = true; } else keep[x] = true;
    });
    var view = sview();
    if (!defFocus.on) defFocus.view = { x: view.x, y: view.y, k: view.k };
    defFocus.on = true;
    defFocus.id = id;
    document.body.classList.add('sfocus');
    document.querySelectorAll('#slayer .sbox').forEach(function (b) {
      b.classList.toggle('off', !keep[b.getAttribute('data-box')]);
    });
    sedges.forEach(function (e, i) {
      var g = document.querySelector('#sedges .sedge[data-id="' + e.ids[0] + '"]');
      var on = e.ids.some(function (x) { return arrows[x]; });
      if (g) g.classList.toggle('off', !on);
      var l = slabels.querySelector('.slabel[data-i="' + i + '"]');
      if (l) l.classList.toggle('off', !on);
    });
    slabels.querySelectorAll('.ssym').forEach(function (s) {
      s.classList.toggle('off', !keep[s.getAttribute('data-id')]);
    });
    slabels.querySelectorAll('.stag').forEach(function (t) {
      t.classList.toggle('off', !keep[t.getAttribute('data-inst')]);
    });
    // A focused diagram is one way of looking at one definition; the type
    // level is another, and showing both at once says neither. drawOverlay
    // reads defFocus and empties itself.
    drawOverlay();
    document.getElementById('sregions').classList.add('off');
    var bar = document.getElementById('focusbar');
    bar.hidden = false;
    bar.style.top = barTop() + 'px';
    document.getElementById('fb-what').textContent = 'Defining diagram: ' + objTitle(id);
    // Fit the diagram: its boxes' bounding box, with room for the labels.
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    Object.keys(keep).forEach(function (k) {
      if (!S.pos[k]) return;
      var b = boxOf(k);
      x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
      x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h);
    });
    var r = paneBox().getBoundingClientRect(), m = 70;
    var ox = mode === 'plane' ? planeOff.x : 0, oy = mode === 'plane' ? planeOff.y : 0;
    view.k = Math.max(0.2, Math.min(1.6, (r.width - 2 * m) / (x2 - x1), (r.height - 2 * m) / (y2 - y1)));
    view.x = (r.width - (x2 - x1) * view.k) / 2 - (x1 + ox) * view.k;
    view.y = (r.height - (y2 - y1) * view.k) / 2 - (y1 + oy) * view.k;
    applyView();
    navRecord();
  }
  function unfocus(opts) {
    if (!defFocus.on) return;
    defFocus.on = false;
    defFocus.id = null;
    document.body.classList.remove('sfocus');
    document.querySelectorAll('#slayer .off, #slabels .off').forEach(function (el) { el.classList.remove('off'); });
    document.getElementById('focusbar').hidden = true;
    drawOverlay();
    // "Back to the whole graph" means the graph as it was, so the bar's own way
    // out restores the pan and zoom it took away. Leaving BY clicking something
    // faded does not: the box the reader just aimed at has to stay under the
    // cursor that chose it.
    if (defFocus.view && !(opts && opts.keepView)) {
      var view = sview();
      view.x = defFocus.view.x; view.y = defFocus.view.y; view.k = defFocus.view.k;
      applyView();
    }
    navRecord();
  }
  // A click on something the focused diagram faded out. The diagram is a way of
  // looking, never a lock: faded material answers a click here exactly as
  // filtered-out material does — it comes back, and what was clicked opens.
  // Recorded with the panel as one step, the way leaving a diagram always has
  // been, so one Back returns both the diagram and the tree that was open.
  function leaveFocusIfOff(el) {
    if (!defFocus.on || !el.closest('.off')) return;
    navQuiet++;
    try { unfocus({ keepView: true }); } finally { navQuiet--; }
  }
  if (document.getElementById('focusbar')) {
    document.getElementById('fb-back').addEventListener('click', function () { unfocus(); });
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    // One key, the innermost way out first: the focused diagram, then the panel.
    if (defFocus.on) { unfocus(); return; }
    // Escape inside a field belongs to the field. A half-written question in
    // the ask box must not cost the reader the panel it is being written in.
    var t = ev.target;
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
    closePanel();
  });

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
      return '<div class="skind"><span class="kind-chip" style="--c:' + k.color + '">' + escText(k.label) + '</span></div>' +
        list.map(function (a) { return arrowRow(a, dir); }).join('');
    }).join('');
  }
  function theoremGroups(list) {
    var seen = {}, byField = {}, order = [];
    list.forEach(function (t) {
      if (seen[t.id]) return;
      seen[t.id] = true;
      (t.fields && t.fields.length ? t.fields : ['other']).forEach(function (f) {
        if (!byField[f]) { byField[f] = []; order.push(f); }
        byField[f].push(t);
      });
    });
    order.sort(function (a, b) { return a === 'other' ? 1 : b === 'other' ? -1 : a.localeCompare(b, 'en'); });
    return order.map(function (f) {
      return '<div class="sfield">' + escText(f) + '</div>' + byField[f].map(function (t) {
        var via = t.via ? 'holds via the generalization: ' + t.via
          : t.ofKind ? 'theorem about the kind: ' + t.ofKind : '';
        return '<a href="#" class="srow" data-open="' + escText(t.id) + '">' + escText(t.title) +
          (via ? '<span class="srow-via">' + escText(via) + '</span>' : '') + '</a>';
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
      return '<dt><span class="sh-lbl">' + (a ? a.label_html : '') + '</span>' + treeRef(k, a ? a.title : null) + '</dt>' +
        '<dd>' + inst.values_html[k] + '</dd>';
    }).join('') + '</dl>';
  }
  // An instance's page reads from its kind downwards: what the kind's arrows
  // give on any structure of that sort (this one included), then the maps that
  // start or end at this very structure, then the definitions it is part of.
  function instanceSections(id, o) {
    var kind = S.arrows.filter(function (a) { return a.from === o.of; });
    var out = S.arrows.filter(function (a) { return a.from === id; });
    var inn = S.arrows.filter(function (a) { return a.to === id && a.from !== id; });
    var h = '<h3 class="ssec">Arrows of the kind ' + escText(objTitle(o.of)) + ' (' + kind.length + ')</h3>' +
      (kind.length
        ? '<p class="smuted">They hold for every structure of that kind, this one included.</p>' + kindGroups(kind, 'out')
        : '<p class="smuted">The kind has no arrows of its own.</p>');
    h += '<h3 class="ssec">Maps out of this instance (' + out.length + ')</h3>' +
      (out.length ? kindGroups(out, 'out') : '<p class="smuted">No maps out of this instance.</p>');
    if (inn.length) {
      h += '<h3 class="ssec">Maps into this instance (' + inn.length + ')</h3>' + kindGroups(inn, 'in');
    }
    var defines = S.objects.filter(function (x) { return x.data && x.data.indexOf(id) >= 0; });
    if (defines.length) {
      h += '<h3 class="ssec">Part of the definition of (' + defines.length + ')</h3>' +
        defines.map(function (x) {
          return '<a href="#" class="srow" data-open="' + escText(x.id) + '">' + escText(x.title) + '</a>';
        }).join('');
    }
    var thms = (S.theorems[id] || []).slice();
    (S.theorems[o.of] || []).forEach(function (t) {
      thms.push({ id: t.id, title: t.title, fields: t.fields, ofKind: objTitle(o.of) });
    });
    h += '<h3 class="ssec">Theorems (' + countUnique(thms) + ')</h3>' +
      (thms.length ? theoremGroups(thms) : '<p class="smuted">No theorem is about this instance.</p>');
    return h;
  }
  function structureSections(id) {
    var h = '';
    if (objById[id] && S.twoLevel && objById[id].level === 'instance') {
      return instanceSections(id, objById[id]);
    }
    if (objById[id]) {
      var out = S.arrows.filter(function (a) { return a.from === id && a.kind !== 'instance'; });
      var inn = S.arrows.filter(function (a) { return a.to === id && a.kind !== 'instance'; });
      h += '<h3 class="ssec">Arrows out of this object (' + out.length + ')</h3>' +
        (out.length ? kindGroups(out, 'out') : '<p class="smuted">No arrows out of this object.</p>');
      // A typed object is another box of its type's kind, so what can be
      // built from that kind can be built from it. The type's own maps (hom)
      // are particular arrows between particular boxes and do not carry over.
      var type = objById[id].type;
      if (type && objById[type]) {
        var tout = S.arrows.filter(function (a) { return a.from === type && a.kind !== 'instance' && a.kind !== 'hom'; });
        h += '<h3 class="ssec">Arrows of the type (' + tout.length + ')</h3>' +
          (tout.length ? kindGroups(tout, 'out') : '<p class="smuted">The type has no arrows of its own.</p>');
      }
      // Examples travel up a generalizes arrow: an example of the special
      // kind is an example of the general one.
      var inst = (S.instances[id] || []).map(function (i) { return { i: i, via: null }; });
      S.arrows.forEach(function (a) {
        if (a.kind !== 'generalizes' || a.to !== id) return;
        (S.instances[a.from] || []).forEach(function (i) { inst.push({ i: i, via: objTitle(a.from) }); });
      });
      h += '<h3 class="ssec">Instances (' + inst.length + ')</h3>' + (inst.length ? inst.map(function (x) {
        return '<div class="sinst"><a href="#" class="srow" data-open="' + escText(x.i.id) + '">' + escText(x.i.title) +
          (x.via ? '<span class="srow-via">via the generalization from: ' + escText(x.via) + '</span>' : '') + '</a>' + valuesDl(x.i) + '</div>';
      }).join('') : '<p class="smuted">No instances.</p>');
      // Theorems about the object or any arrow touching it; a theorem about
      // the general kind holds for the special one, so it travels down.
      var thms = (S.theorems[id] || []).slice();
      out.concat(inn).forEach(function (a) { (S.theorems[a.id] || []).forEach(function (t) { thms.push(t); }); });
      S.arrows.forEach(function (a) {
        if (a.kind !== 'generalizes' || a.from !== id) return;
        (S.theorems[a.to] || []).forEach(function (t) { thms.push({ id: t.id, title: t.title, fields: t.fields, via: objTitle(a.to) }); });
      });
      h += '<h3 class="ssec">Theorems (' + countUnique(thms) + ')</h3>' +
        (thms.length ? theoremGroups(thms) : '<p class="smuted">No theorem is about this object.</p>');
      h += '<h3 class="ssec">Arrows into this object (' + inn.length + ')</h3>' +
        (inn.length ? kindGroups(inn, 'in') : '<p class="smuted">No arrows into this object.</p>');
      return h;
    }
    var a = arrowById[id];
    if (!a) return '';
    // The type edge behind this arrow, in words. The canvas raises it on
    // hover, but a kind can sit a region away from its instances, so at a
    // readable zoom the raised edge is often off screen; this row is the way
    // to it that no layout can take away.
    var tk = S.twoLevel && typeKeyOf(edgeByArrow[id]);
    if (tk) {
      var te = typeEnds(tk), tn = arrowsOfType(tk).length;
      h += '<h3 class="ssec">One level up</h3>' +
        '<a href="#" class="srow" data-open="' + escText('type:' + tk) + '">' +
        escText(objTitle(te[0])) + (te[0] === te[1] ? ' \u21bb' : ' \u2192 ' + escText(objTitle(te[1]))) +
        '<span class="srow-via">the type edge behind this arrow \u2014 ' + tn +
        (tn === 1 ? ' arrow of this shape' : ' arrows of this shape') + '</span></a>';
    }
    if (a.kind !== 'instance') {
      var ex = (S.instances[a.from] || []).filter(function (i) { return i.values_html[id]; });
      if (ex.length) {
        h += '<h3 class="ssec">On instances</h3>' + ex.map(function (i) {
          return '<div class="sinst"><a href="#" class="srow" data-open="' + escText(i.id) + '">' + escText(i.title) + '</a>' +
            '<div class="sval">' + i.values_html[id] + '</div></div>';
        }).join('');
      }
    }
    var th = S.theorems[id] || [];
    if (th.length) h += '<h3 class="ssec">Theorems (' + th.length + ')</h3>' + theoremGroups(th);
    return h;
  }

  // --- the type edge's page ------------------------------------------------
  //
  // NO TREE AUTHORS THIS PAGE. A type edge is not a thing in the vault: it is
  // what the concrete arrows between instances have in common once their ends
  // are read one level up. The owner asked for "the overview of the both
  // context (what is additional contents assumed about the types that make the
  // relationship possible) and what the relationship is", and every piece of
  // that is already written somewhere in the vault:
  //
  //   what the two types are      each kind's title, symbol and `hom`
  //   what is assumed beyond them each projecting arrow's `needs` (and
  //                               `assumes`) — the format's own words for
  //                               "extra data that is NOT part of the source"
  //   what the relationship is    each projecting arrow's statement, and for
  //                               a construction its on_homomorphisms and
  //                               whether it is functorial
  //   how each type is built      the kind's defining diagram, lifted out of
  //                               its own panel rather than stored twice
  //
  // The page says so at the bottom, in one line, because a page that reads
  // like authored prose and is not would be worse than no page.
  function needsList(a) {
    if (!a.needs_html) return '';
    if (!a.needs_html.length) {
      return '<div class="te-needs te-none">nothing beyond the two types</div>';
    }
    return '<ul class="te-needs">' + a.needs_html.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>';
  }
  // A kind's defining diagram is already typeset in its own panel; lifting the
  // figure out of there keeps one copy of it in the page.
  function defFigureOf(id) {
    var tpl = document.createElement('template');
    tpl.innerHTML = window.TREES[id] || '';
    var fig = tpl.content.querySelector('figure.cd');
    return fig ? fig.outerHTML : '';
  }
  function typeSide(kid) {
    var o = objById[kid];
    if (!o) return '';
    var h = '<div class="te-side"><div class="te-side-head">' + treeRef(kid, objTitle(kid)) +
      '<span class="level-chip lvl-kind">kind</span></div>';
    if (o.symbol_html) h += '<div class="te-sym">' + o.symbol_html + '</div>';
    if (o.hom_html) h += '<div class="te-row"><span class="te-k">A map of these is</span><span class="te-v">' + o.hom_html + '</span></div>';
    if (o.data && o.data.length) {
      h += '<div class="te-row"><span class="te-k">Defined by</span><span class="te-v">' +
        o.data.map(function (x) { return treeRef(x); }).join(', ') + '</span></div>';
      var fig = defFigureOf(kid);
      if (fig) h += '<div class="te-def">' + fig + '</div>';
    } else {
      h += '<div class="te-row"><span class="te-k">Defined by</span><span class="te-v te-none">no diagram — the vault takes this kind as primitive</span></div>';
    }
    var examples = (S.objects || []).filter(function (x) { return x.of === kid; });
    h += '<div class="te-row"><span class="te-k">Instances here</span><span class="te-v">' +
      (examples.length ? examples.map(function (x) { return treeRef(x.id, x.title); }).join(', ')
        : '<span class="te-none">none in this vault</span>') + '</span></div>';
    return h + '</div>';
  }
  function typeArrowRow(a, kindLevel) {
    var h = '<div class="te-arrow"><div class="te-arrow-head">' +
      '<span class="srow-lbl" style="color:' + KIND_COLOR[a.kind] + '">' + a.label_html + '</span>' +
      treeRef(a.id, a.title) + ' <span class="kind-chip" style="--c:' + KIND_COLOR[a.kind] + '">' +
      escText(KIND_LABEL[a.kind] || a.kind) + '</span></div>';
    h += '<div class="te-stm">' + a.statement_html + '</div>';
    if (!kindLevel) {
      h += '<div class="te-row"><span class="te-k">Between</span><span class="te-v">' +
        treeRef(a.from) + ' <span class="sep">→</span> ' + treeRef(a.to) + '</span></div>';
    }
    h += '<div class="te-row"><span class="te-k">Assumes</span><span class="te-v">' + (needsList(a) ||
      '<span class="te-none">the vault states no extra data</span>') + '</span></div>';
    if (a.on_hom_html) {
      h += '<div class="te-row"><span class="te-k">On maps</span><span class="te-v">' + a.on_hom_html + '</span></div>';
    }
    if (typeof a.functorial === 'boolean') {
      h += '<div class="te-row"><span class="te-k">Functorial</span><span class="te-v">' + (a.functorial ? 'yes' : 'no') + '</span></div>';
    }
    if (typeof a.invertible === 'boolean') {
      h += '<div class="te-row"><span class="te-k">Isomorphism</span><span class="te-v">' + (a.invertible ? 'yes' : 'no') + '</span></div>';
    }
    if (a.assumes && a.assumes.length) {
      h += '<div class="te-row"><span class="te-k">Principles</span><span class="te-v">' +
        a.assumes.map(function (x) { return '<code>' + escText(x) + '</code>'; }).join(', ') + '</span></div>';
    }
    return h + '</div>';
  }
  function typePanelHtml(key) {
    var ends = typeEnds(key), loop = ends[0] === ends[1];
    var list = arrowsOfType(key), up = kindArrowsOfType(key);
    var h = '<div class="panel-head"><span class="chip" style="--c:#e9d66b">type level</span>' +
      '<h2>' + escText(objTitle(ends[0])) + (loop ? ' ↻' : ' → ' + escText(objTitle(ends[1]))) + '</h2>' +
      '<div class="panel-id">' + escText(ends[0]) + (loop ? '' : ' → ' + escText(ends[1])) + '</div></div>';
    h += '<div class="struct-head"><div class="sh-row"><span class="sh-k">What this is</span><span class="sh-v">' +
      (loop
        ? 'A relationship the vault draws between two structures of one kind — ' + list.length +
          (list.length === 1 ? ' arrow' : ' arrows') + ' of this shape.'
        : 'A relationship the vault draws between a structure of the first kind and one of the second — ' +
          list.length + (list.length === 1 ? ' arrow' : ' arrows') + ' of this shape.') +
      '</span></div></div>';
    h += '<h3 class="ssec">The two types</h3>' + typeSide(ends[0]) + (loop ? '' : typeSide(ends[1]));
    h += '<h3 class="ssec">What the relationship is, arrow by arrow (' + list.length + ')</h3>';
    h += list.length
      ? list.map(function (a) { return typeArrowRow(a, false); }).join('')
      : '<p class="smuted">No arrow of this shape is drawn any more.</p>';
    if (up.length) {
      h += '<h3 class="ssec">At the kind level, between the same two kinds (' + up.length + ')</h3>' +
        '<p class="smuted">Constructions out of the first kind into the second. They are arrows of the level ' +
        'above the maps listed before — not the same arrows — and they apply to every instance of their source.</p>' +
        up.map(function (a) { return typeArrowRow(a, true); }).join('');
    }
    h += '<p class="te-made">Assembled by this page out of the arrows above — the vault holds no tree for the ' +
      'type edge itself, so what you see is their <code>needs</code>, their statements and the two kinds’ own ' +
      'definitions, and nothing beyond them.</p>';
    return h;
  }

  if (S) {
    S.kinds.forEach(function (k) { KIND_COLOR[k.id] = k.color; KIND_LABEL[k.id] = k.label; });
    S.objects.forEach(function (o) { objById[o.id] = o; });
    S.arrows.forEach(function (a) { arrowById[a.id] = a; });
    structureReady = true;
    basePos = snapshot();
    planeLayout();
    drawStructure();
    if (mode === 'plane') fitPlane();
    else if (!folded.structure) { fitStructure(); structureFitted = true; }
    applyView();
    placeLabels();
    fitSymbols();
    // A label's width is a KaTeX measurement, so the first pass can land before
    // the fonts do; the second one is what the reader actually sees.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureStructure);
    slayer.addEventListener('click', function (ev) {
      if (dragged) { dragged = false; return; }
      var y = ev.target.closest('.stype');
      if (y) { openTypePanel(y.getAttribute('data-type'), { toggle: true }); return; }
      var n = ev.target.closest('.node, .inst, .sedge');
      if (!n) return;
      leaveFocusIfOff(n);
      openPanel(n.getAttribute('data-id'), { toggle: true });
    });
    slabels.addEventListener('click', function (ev) {
      var y = ev.target.closest('.stype-lbl');
      if (y) { openTypePanel(y.getAttribute('data-type'), { toggle: true }); return; }
      // The tag IS the way to the kind: a word that names a box and does not
      // open it would be the worst of both answers.
      var t = ev.target.closest('.stag');
      if (t) { leaveFocusIfOff(t); openPanel(t.getAttribute('data-of'), { toggle: true }); return; }
      var l = ev.target.closest('.slabel');
      if (!l) return;
      leaveFocusIfOff(l);
      openPanel(l.getAttribute('data-open'), { toggle: true });
    });
    // Highlighting is hovering, and hovering is delegated: the elements that
    // answer it are rebuilt on every drag and every filter, so nothing here
    // may hold a reference to one. A box, its tag, an arrow and an arrow's
    // label all raise the same thing; the raised edge and its own chip count
    // as hovering themselves, or the picture would vanish under the cursor
    // that reached for it.
    if (S.twoLevel) {
      var sense = function (el) {
        var box = el && el.closest('.sbox, .stag');
        var edge = el && el.closest('.sedge, .slabel');
        var type = el && el.closest('.stype, .stype-lbl');
        var next = {
          box: box ? (box.getAttribute('data-box') || box.getAttribute('data-inst')) : null,
          edge: edge ? (edge.getAttribute('data-id') || edge.getAttribute('data-open')) : null,
          type: type ? type.getAttribute('data-type') : null,
        };
        // Reaching for the raised edge's chip means leaving the arrow that
        // raised it, and the two ties would go with it — so a type element
        // under the pointer keeps whatever was under it a moment ago.
        if (next.type && !next.box && !next.edge) { next.box = hover.box; next.edge = hover.edge; }
        if (next.box === hover.box && next.edge === hover.edge && next.type === hover.type) return;
        hover = next;
        drawOverlay();
      };
      [slayer, slabels].forEach(function (host) {
        host.addEventListener('mouseover', function (ev) { sense(ev.target); });
        host.addEventListener('mouseout', function (ev) {
          var to = ev.relatedTarget;
          sense(to && to.closest ? to : null);
        });
      });
    }
  }

  // ---- filters: one expression over both graphs ----------------------------
  // The two panes are themselves filters over one body of material — one keeps
  // the depends DAG, the other the arrows — so a filter is the primitive, and
  // every chip in the tray is nothing but a stored expression. The engine is
  // lib/filter.mjs, inlined by the build and unit-tested in Node; this section
  // is only the painting, the bar and the two ways in from outside.
  //
  // Two channels, never mixed: `fset` is the filter's match, `lset` is what the
  // selected tree's `about` ties it to. A filter dims (or hides) what it leaves
  // out; a link answers a click, so it beats dimming.
  var fgraph = FF ? FF.buildGraph({ nodes: F.nodes, structure: S }) : null;
  var fexpr = null, fset = null, lset = null, fHide = false, fcount = null;
  var ftray = document.getElementById('ftray');
  var fnone = document.getElementById('f-none');

  function fLit(id) {
    if (lset && lset[id]) return true;
    return fset ? !!fset[id] : true;
  }
  // A filter about structure says nothing about the requirements graph, and
  // vice versa. Dimming the half it never spoke of leaves that side of the
  // window looking dead, so a half with no match keeps its ordinary paint.
  function fHalfLive(tree) {
    if (!fcount) return true;
    return tree ? fcount.trees > 0 : (fcount.objects + fcount.arrows) > 0;
  }
  function fStateOf(id, tree) {
    if (lset && lset[id]) return 'link';
    if (!fset || !fHalfLive(tree)) return 'plain';
    return fset[id] ? 'match' : 'out';
  }
  function paintEl(el, st, hid) {
    if (!el) return;
    el.classList.toggle('fmatch', st === 'match');
    el.classList.toggle('flink', st === 'link');
    el.classList.toggle('fdim', st === 'out' && !hid);
    el.classList.toggle('fhide', st === 'out' && hid);
  }
  function paintFilter() {
    var hid = fHide && !!fset;
    var treeHalf = fHalfLive(true);
    document.querySelectorAll('#glayer .node').forEach(function (n) {
      paintEl(n, fStateOf(n.getAttribute('data-id'), true), hid);
    });
    F.groups.forEach(function (g) {
      var el = document.getElementById('grp-' + g.id);
      if (!el) return;
      var any = !fset || !treeHalf || g.members.some(fLit);
      el.classList.toggle('g-fdim', !any && !hid);
    });
    if (!S) return;
    document.querySelectorAll('#slayer .sbox').forEach(function (b) {
      var st = fStateOf(b.getAttribute('data-box'));
      b.classList.toggle('fdim', st === 'out' && !hid);
      b.classList.toggle('fhide', st === 'out' && hid);
      var n = b.querySelector('.snode');
      if (n) {
        n.classList.toggle('fmatch', st === 'match');
        n.classList.toggle('flink', st === 'link');
      }
    });
    slabels.querySelectorAll('.ssym').forEach(function (s) {
      paintEl(s, fStateOf(s.getAttribute('data-id')), hid);
    });
    // The kind tag belongs to its instance's box and fades with it.
    slabels.querySelectorAll('.stag').forEach(function (t) {
      paintEl(t, fStateOf(t.getAttribute('data-inst')), hid);
    });
    // An edge may stand for an inverse pair, so it is lit if either arrow is.
    // The first paint can land before the edges are built, hence the guard.
    (sedges || []).forEach(function (e, i) {
      var st = 'plain';
      if (lset && e.ids.some(function (x) { return lset[x]; })) st = 'link';
      else if (fset) st = e.ids.some(function (x) { return fset[x]; }) ? 'match' : 'out';
      paintEl(document.querySelector('#sedges .sedge[data-id="' + e.ids[0] + '"]'), st, hid);
      paintEl(slabels.querySelector('.slabel[data-i="' + i + '"]'), st, hid);
    });
    // The frames last, and they obey `hide` like everything above them: a frame
    // fades while dimming, because knowing WHERE on the map the lit things sit
    // is most of the value when only two boxes survive — but `hide` is the mode
    // that means gone, and six empty outlines on an otherwise empty canvas is
    // not what it promised.
    document.querySelectorAll('#sregions .sregion').forEach(function (r) {
      var id = r.getAttribute('data-region');
      var any = !fset || S.objects.some(function (o) {
        return (o.region || '') === id && fLit(o.id);
      });
      r.classList.toggle('fdim', !any && !hid);
      r.classList.toggle('fhide', !any && hid);
    });
    // Last: the layer that is drawn on demand. A tie and a type edge are
    // statements about two boxes, so each survives only with both — and since
    // neither exists until it is raised, the filter is applied as they are
    // drawn rather than found afterwards.
    if (S.twoLevel) drawOverlay();
  }

  function countText(c) {
    var parts = [];
    if (fgraph && fgraph.objects.length) parts.push('boxes ' + c.objects);
    if (fgraph && fgraph.arrows.length) parts.push('arrows ' + c.arrows);
    parts.push('trees ' + c.trees);
    return parts.join(' · ');
  }
  // The count and the description are two fields, because the count is the one
  // thing that must survive a narrow bar: a long filter description would
  // otherwise elide the very number the reader is filtering to find.
  function updateFbar(msg, cls) {
    var el = document.getElementById('f-state');
    var cnt = document.getElementById('f-count');
    var clear = document.getElementById('f-clear');
    if (!el) return;
    if (cnt && fgraph) {
      var c = fexpr && fcount ? fcount : {
        objects: fgraph.objects.length, arrows: fgraph.arrows.length, trees: fgraph.trees.length,
      };
      cnt.textContent = countText(c) + (lset ? ' · linked ' + (Object.keys(lset).length - 1) : '');
      cnt.className = fexpr ? 'lit' : '';
      // A pair of inverse arrows is drawn as ONE edge, so the canvas can show
      // fewer arrows than this number. Said on the count itself, where the
      // question gets asked, rather than in the footer, where it would be noise
      // for every reader who never counts.
      if (fgraph.arrows.length) {
        cnt.title = 'An inverse pair shares one drawn arrow, so the canvas can show fewer arrows than the count.';
      }
    }
    el.textContent = msg || (fexpr ? FF.describeExpr(fexpr, fgraph) : '');
    el.className = msg ? (cls || '') : (fexpr ? 'lit' : '');
    if (clear) clear.hidden = !fexpr && !lset;
    var open = document.getElementById('f-open');
    if (open) open.classList.toggle('on', !!fexpr);
  }
  function noMatch(what) {
    if (!fnone) return;
    fnone.hidden = false;
    fnone.style.top = barTop() + 'px';
    fnone.textContent = 'Nothing matches the filter (' + what + ') — the view is left untouched.';
  }
  function hideNoMatch() { if (fnone) fnone.hidden = true; }

  // The one way in. Returns the engine's own verdict, so a caller — the bar, the
  // hash, a model through window.forestFilter — learns what happened.
  function applyFilter(expr, opts) {
    opts = opts || {};
    if (!FF || !fgraph) return null;
    var r = FF.evaluate(expr, fgraph);
    if (r.fatal) {
      var first = r.problems.filter(function (p) { return p.fatal; })[0];
      updateFbar('Filter: ' + FF.problemText(first), 'warn');
      return r;
    }
    if (!r.count.total) {
      // Nothing matched: say so and leave the view alone. An empty canvas reads
      // as a broken page, not as an answer.
      noMatch(FF.describeExpr(expr, fgraph));
      return r;
    }
    hideNoMatch();
    fexpr = expr; fset = r.ids; fcount = r.count;
    if (fHide) relayout(); else paintFilter();
    updateFbar();
    markChips();
    if (!opts.quiet) navRecord();
    return r;
  }
  function clearFilter(opts) {
    fexpr = null; fset = null; fcount = null;
    hideNoMatch();
    if (fHide) relayout(); else paintFilter();
    updateFbar();
    markChips();
    if (!(opts && opts.quiet)) navRecord();
  }
  // `quiet` is for the hash reader and for a replayed state: recording a step
  // in the middle of arriving at one would record the half-built state.
  function setHide(on, quiet) {
    if (fHide === !!on) return;
    fHide = !!on;
    var cb = document.getElementById('f-hide');
    if (cb) cb.checked = fHide;
    relayout();
    if (!quiet) navRecord();
  }

  // The cross-link, both ways, out of one symmetric predicate: picking a tree
  // lights the objects and arrows its `about` names, and picking an object or
  // arrow lights the trees that name it. It survives folding a pane and
  // changing arrangement, because it is a set of ids and not a drawing.
  function setLink(id) {
    if (!FF || !fgraph || !fgraph.node[id]) { lset = null; paintFilter(); updateFbar(); return; }
    var r = FF.evaluate({ about: id }, fgraph);
    // A tree that is about nothing, and that nothing is about, lights only
    // itself — no reason to paint the page for it.
    lset = r.count.total > 1 ? r.ids : null;
    paintFilter();
    updateFbar();
  }

  // ---- the filter bar and its tray ----------------------------------------
  function placeTray() {
    if (ftray) ftray.style.top = barTop() + 'px';
    if (fnone && !fnone.hidden) fnone.style.top = barTop() + 'px';
  }
  function sameExpr(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; }
  }
  function markChips() {
    if (!ftray) return;
    ftray.querySelectorAll('.fchip').forEach(function (b) {
      var i = +b.getAttribute('data-chip');
      b.classList.toggle('on', !!fchips[i] && sameExpr(fchips[i].expr, fexpr));
    });
  }
  var fchips = [];
  function buildTray() {
    if (!ftray || !FF || !fgraph) return;
    fchips = FF.chipsFor(fgraph, { kinds: KIND_LABEL, taxa: F.taxa || {} });
    var groups = [], seen = {};
    fchips.forEach(function (c) {
      if (!seen[c.group]) { seen[c.group] = []; groups.push(c.group); }
      seen[c.group].push(c);
    });
    var h = groups.map(function (g) {
      return '<h4>' + escText(g) + '</h4>' + seen[g].map(function (c) {
        return '<button class="fchip" data-chip="' + fchips.indexOf(c) + '">' + escText(c.label) + '</button>';
      }).join('');
    }).join('');
    h += '<h4>Your own expression (JSON)</h4>' +
      '<textarea id="f-json" spellcheck="false" placeholder=\'{"tied-to": "obj-valuation"}\'></textarea>' +
      '<div class="frow"><button id="f-run">Apply</button><button id="f-clear2">Clear</button>' +
      '<span class="fhint" id="f-msg"></span></div>' +
      '<div class="frow"><span class="fhint">Predicates: ' +
      FF.PREDICATES.map(function (p) { return '<code>' + escText(p.name) + '</code>'; }).join(' ') +
      ' · join them with <code>and</code>, <code>or</code>, <code>not</code> · the same expression goes in the page address, as <code>#filter=…</code></span></div>';
    ftray.innerHTML = h;
    ftray.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.fchip');
      if (chip) {
        var c = fchips[+chip.getAttribute('data-chip')];
        if (!c) return;
        if (sameExpr(c.expr, fexpr)) clearFilter();
        else {
          document.getElementById('f-json').value = JSON.stringify(c.expr);
          applyFilter(c.expr);
        }
        return;
      }
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.id === 'f-run') runJson();
      else if (b.id === 'f-clear2') { document.getElementById('f-json').value = ''; clearFilter(); }
    });
    ftray.addEventListener('keydown', function (ev) {
      // Enter applies, so a pasted expression needs no reach for the mouse;
      // shift-enter is still a newline, since an expression may be pretty.
      if (ev.key === 'Enter' && !ev.shiftKey && ev.target.id === 'f-json') {
        ev.preventDefault();
        runJson();
      }
    });
  }
  function runJson() {
    var ta = document.getElementById('f-json'), msg = document.getElementById('f-msg');
    var p = FF.parseExpr(ta.value);
    if (!p.expr) {
      msg.textContent = FF.problemText(p.problems[0]);
      return;
    }
    var r = applyFilter(p.expr);
    msg.textContent = r && r.problems.length
      ? r.problems.map(FF.problemText).join(' · ')
      : (r ? 'Matches: ' + r.count.total : '');
  }
  if (document.getElementById('f-open')) {
    document.getElementById('f-open').addEventListener('click', function () {
      placeTray();
      ftray.hidden = !ftray.hidden;
    });
  }
  if (document.getElementById('f-clear')) {
    document.getElementById('f-clear').addEventListener('click', function () {
      lset = null;
      var ta = document.getElementById('f-json');
      if (ta) ta.value = '';
      clearFilter();
    });
  }
  if (document.getElementById('f-hide')) {
    document.getElementById('f-hide').addEventListener('change', function (ev) {
      setHide(ev.target.checked);
    });
  }

  // ---- the two ways in from outside ---------------------------------------
  // The URL hash, so a skill can open the page already filtered, and a small
  // documented object on the page, so a natural-language layer can drive the
  // same engine without touching the DOM. Both are described in
  // docs/forest-format.md beside the grammar.
  function hashParts() {
    var out = {};
    location.hash.replace(/^#/, '').split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('=');
      if (i < 0) return;
      try {
        out[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1));
      } catch (e) { /* a half-encoded hash is simply not a filter */ }
    });
    return out;
  }
  // Reading the address is one function, and it never records a step of its
  // own: whoever asked for the read says afterwards whether arriving here was
  // navigation (a pasted link, a traversal) or merely the page opening.
  function readHash() {
    navQuiet++;
    try {
      var p = hashParts();
      if (p.mode && S) {
        mode = p.mode === 'plane' ? 'plane' : 'split';
        applyArrangement(false);
      }
      if (S && mode === 'split') {
        var off = p.pane === 'order' ? 'structure' : p.pane === 'structure' ? 'order' : null;
        setFold('order', off === 'order');
        setFold('structure', off === 'structure');
      }
      if ((p.hide === '1') !== fHide) setHide(p.hide === '1', true);
      if (p[FF.HASH_KEY]) {
        var parsed = FF.parseExpr(p[FF.HASH_KEY]);
        if (!parsed.expr) updateFbar('Filter from the address: ' + FF.problemText(parsed.problems[0]), 'warn');
        else {
          var ta = document.getElementById('f-json');
          if (ta) ta.value = JSON.stringify(parsed.expr);
          applyFilter(parsed.expr, { quiet: true });
        }
      } else if (fexpr) {
        var ta2 = document.getElementById('f-json');
        if (ta2) ta2.value = '';
        clearFilter({ quiet: true });
      }
      if (p.tree && (F.nodes[p.tree] || p.tree.indexOf('type:') === 0)) openAny(p.tree);
      else closePanel();
      if (p.focus && S && objById[p.focus]) { revealStructure(); focusDefinition(p.focus); }
      else unfocus();
    } finally { navQuiet--; }
  }

  // ---- a step back: the viewer's own history -------------------------------
  // WHAT COUNTS AS ONE STEP. Six things, and they are exactly the ones that
  // change what the page is SHOWING rather than how it is being looked at: the
  // tree open in the panel, the filter expression, the `hide` switch, the
  // arrangement, which pane is folded, and the focused definition diagram. The
  // link highlight is not among them because it is not independent — it is
  // whatever the open tree's `about` names, so it follows the tree for free.
  //
  // Deliberately NOT steps: panning, zooming, the search box, the proof and
  // exercise toggles, expanding a section, dragging a box, marking a tree
  // mastered. Those are either continuous, or a way of looking at one state,
  // or an edit — and a Back button that undid a reading mark would be a
  // different and much more dangerous promise.
  //
  // A step that lands on the state we are already in is dropped, so clicking
  // the same chip twice, or re-picking the open tree, leaves one entry.
  //
  // The browser's own Back walks the same list: each step is pushed as a
  // history entry carrying its sequence number and popstate looks that number
  // up, which is why the address bar and the bar's own button can never
  // disagree. A file:// page may refuse pushState outright — then navPush goes
  // false, the array stays the truth, and the button in the bar still steps.
  function navState() {
    return {
      tree: panel.classList.contains('open') && selected ? selected : null,
      filter: fexpr || null,
      hide: !!fHide,
      mode: mode,
      fold: folded.order ? 'order' : folded.structure ? 'structure' : null,
      focus: defFocus.on ? defFocus.id : null,
    };
  }
  function sameState(a, b) {
    return !!a && !!b && a.tree === b.tree && a.hide === b.hide && a.mode === b.mode &&
      a.fold === b.fold && a.focus === b.focus && sameExpr(a.filter, b.filter);
  }
  function navHash(st) {
    var parts = [];
    if (st.filter) parts.push(FF.HASH_KEY + '=' + encodeURIComponent(JSON.stringify(st.filter)));
    if (st.hide) parts.push('hide=1');
    if (S && st.mode === 'plane') parts.push('mode=plane');
    if (S && st.fold) parts.push('pane=' + (st.fold === 'order' ? 'structure' : 'order'));
    if (st.tree) parts.push('tree=' + encodeURIComponent(st.tree));
    if (st.focus) parts.push('focus=' + encodeURIComponent(st.focus));
    return parts.length ? '#' + parts.join('&') : '';
  }
  function navUrl(st, push) {
    var url = location.pathname + location.search + navHash(st);
    try {
      if (push) history.pushState({ forestSeq: st.seq }, '', url);
      else history.replaceState({ forestSeq: st.seq }, '', url);
    } catch (e) {
      // No history writing here (some browsers on file://): the trail still
      // works, it simply stops showing in the address bar.
      navPush = false;
    }
  }
  function navButtons() {
    var b = document.getElementById('nav-back'), f = document.getElementById('nav-fwd');
    if (b) b.disabled = navIdx <= 0;
    if (f) f.disabled = navIdx < 0 || navIdx >= navLine.length - 1;
  }
  function navRecord() {
    if (navQuiet) return;
    var st = navState();
    if (sameState(st, navLine[navIdx])) return;
    st.seq = ++navSeq;
    // Stepping back and then somewhere new drops what was ahead, as a browser
    // does: the trail is where the reader has been, not a tree of might-haves.
    navLine = navLine.slice(0, navIdx + 1);
    navLine.push(st);
    navIdx = navLine.length - 1;
    navUrl(st, navIdx > 0 && navPush);
    navButtons();
  }
  // Putting the page INTO a recorded state. Every branch is guarded by a
  // comparison, so replaying a state only touches what actually differs — and
  // nothing in here records, or stepping back would be a step forward.
  function navApply(st) {
    navQuiet++;
    try {
      if (S && st.mode !== mode) { mode = st.mode; applyArrangement(false); }
      if (S && mode === 'split') {
        setFold('order', st.fold === 'order');
        setFold('structure', st.fold === 'structure');
      }
      if (!sameExpr(st.filter, fexpr)) {
        var ta = document.getElementById('f-json');
        if (ta) ta.value = st.filter ? JSON.stringify(st.filter) : '';
        if (st.filter) applyFilter(st.filter, { quiet: true });
        else clearFilter({ quiet: true });
      }
      if (!!st.hide !== fHide) setHide(st.hide, true);
      if (st.focus) { if (st.focus !== defFocus.id) { revealStructure(); focusDefinition(st.focus); } }
      else unfocus();
      // Re-rendering the panel it already shows would only make it flicker.
      if (st.tree) { if (st.tree !== selected || !panel.classList.contains('open')) openAny(st.tree); }
      else closePanel();
    } finally { navQuiet--; }
    navButtons();
  }
  function navTo(i) {
    if (i < 0 || i >= navLine.length) return;
    navIdx = i;
    navApply(navLine[i]);
    navUrl(navLine[i], false);
  }
  // The bar's button moves the BROWSER's pointer when the browser has one, so
  // the two never drift apart; popstate then lands in navTo.
  function navGo(d) {
    var i = navIdx + d;
    if (i < 0 || i >= navLine.length) return;
    if (navPush) history.go(d);
    else navTo(i);
  }
  window.addEventListener('popstate', function (ev) {
    var seq = ev.state && ev.state.forestSeq;
    for (var i = 0; i < navLine.length; i++) {
      if (navLine[i].seq === seq) { navIdx = i; navApply(navLine[i]); return; }
    }
    // An entry this page never wrote — a hand-edited address, or history from
    // before a reload. Read it, and record where it put us.
    readHash();
    navRecord();
  });
  window.addEventListener('hashchange', function () {
    // Our own pushes and traversals have already left the page in this state;
    // only an address somebody typed is news.
    if (navIdx >= 0 && location.hash === navHash(navLine[navIdx])) return;
    readHash();
    navRecord();
  });
  if (document.getElementById('nav-back')) {
    document.getElementById('nav-back').addEventListener('click', function () { navGo(-1); });
    document.getElementById('nav-fwd').addEventListener('click', function () { navGo(1); });
  }

  if (FF && fgraph) {
    buildTray();
    updateFbar();
    // The address is read at the very bottom of this file, not here: it can now
    // open a tree, and a tree's panel wants the diagram strip and the bridge,
    // which are built below.
    // A tiny, documented surface for whoever drives this from outside — today a
    // skill opening the page, later the natural-language layer. `describe()` is
    // the important half: it hands back the grammar AND this vault's own
    // vocabulary, so a model can write a valid expression without the vault.
    window.forestFilter = {
      version: 1,
      apply: function (expr) {
        var e = typeof expr === 'string' ? FF.parseExpr(expr) : { expr: expr, problems: [] };
        if (!e.expr) return { ok: false, errors: e.problems.map(FF.problemText) };
        var r = applyFilter(e.expr);
        if (!r) return { ok: false, errors: ['filter engine missing'] };
        return {
          ok: !r.fatal && r.count.total > 0,
          matched: Object.keys(r.ids).sort(),
          count: r.count,
          describe: FF.describeExpr(e.expr, fgraph),
          errors: r.problems.map(FF.problemText),
        };
      },
      clear: function () { lset = null; clearFilter(); return { ok: true }; },
      hide: function (on) { setHide(on); return { hide: fHide }; },
      link: function (id) { setLink(id); return { linked: lset ? Object.keys(lset).sort() : [] }; },
      // `openAny`, not `openPanel`: a type edge is addressable as
      // "type:<kindA>|<kindB>" and the hash already opens one, so the API a
      // tutor drives the page through must reach it too.
      select: function (id) { openAny(id); return { selected: selected }; },
      close: function () { closePanel(); return { selected: selected }; },
      back: function () { navGo(-1); return { at: navIdx, depth: navLine.length }; },
      forward: function () { navGo(1); return { at: navIdx, depth: navLine.length }; },
      arrangement: function (next) {
        if (next === 'plane' || next === 'split') setMode(next);
        return { mode: mode, folded: { order: folded.order, structure: folded.structure }, split: split };
      },
      describe: function () {
        return {
          filter: fexpr,
          hide: fHide,
          count: fcount,
          selected: selected,
          linked: lset ? Object.keys(lset).sort() : [],
          focus: defFocus.on ? defFocus.id : null,
          // The trail, newest last, with `at` saying where in it the reader
          // stands: enough for an outside caller to know whether back() has
          // anywhere to go, and what it would go to.
          history: { at: navIdx, depth: navLine.length, states: navLine.map(navHash) },
          arrangement: { mode: mode, split: split, folded: { order: folded.order, structure: folded.structure } },
          chips: fchips.map(function (c) { return { label: c.label, group: c.group, expr: c.expr }; }),
          hash: 'open the page with #filter=<urlencoded JSON>[&hide=1][&mode=plane][&pane=structure][&tree=<id>, where <id> is a tree id or "type:<kindA>|<kindB>" for a type edge, urlencoded][&focus=<obj- id>]',
          grammar: FF.vocabulary(fgraph),
        };
      },
    };
  }

  // ---- Diagrams: the bottom strip -----------------------------------------
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
      return '<button class="strip-tab" data-i="' + i + '"' + (fg.src ? ' title="from: ' + escText(fg.src) + '"' : '') + '>' +
        escText(fg.title || ('Diagram ' + (i + 1))) + '</button>';
    }).join('');
    showFigure(0);
  }
  if (strip) {
    document.getElementById('strip-toggle').addEventListener('click', function () {
      if (strip.classList.contains('empty')) return;
      strip.classList.toggle('collapsed');
      this.firstChild.textContent = (strip.classList.contains('collapsed') ? '▸' : '▾') + ' Diagrams ';
    });
    document.getElementById('strip-tabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('.strip-tab');
      if (b) showFigure(+b.getAttribute('data-i'));
    });
    document.getElementById('strip-body').addEventListener('click', function (ev) {
      var a = ev.target.closest('a[data-open]');
      if (a) { ev.preventDefault(); openAny(a.getAttribute('data-open')); }
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
  var ASK_WAIT = 'Waiting for Claude Code — run /ask --watch in the vault.';
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
      '<textarea id="ask-q" placeholder="Select a passage above and ask — or just ask about this tree."></textarea>' +
      '<div class="ask-sel" id="ask-sel"></div>' +
      '<div class="ask-row"><button class="primary" id="ask-send">Ask</button>' +
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
    if (el) el.textContent = '\u201c' + (txt.length > 160 ? txt.slice(0, 160) + '…' : txt) + '\u201d';
  });

  function setStatus(msg, err) {
    var el = document.getElementById('ask-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('err', !!err);
  }

  function sendAsk(kind, replyTo) {
    var q = (document.getElementById('ask-q') || {}).value || '';
    if (kind === 'ask' && !q.trim()) { setStatus('Write a question.', true); return; }
    var btns = askBox.querySelectorAll('button');
    btns.forEach(function (b) { b.disabled = true; });
    setStatus('Sending…');
    api('/api/ask', { method: 'POST', body: { kind: kind, tree: askTree, selection: askSelection, question: q, reply_to: replyTo || null } })
      .then(function (r) {
        if (r.error) throw new Error(r.error);
        askLastId = r.id;
        setStatus(r.watcher.alive ? 'Thinking…' : ASK_WAIT);
        listen(r.id, kind);
      })
      .catch(function (e) { setStatus('Error: ' + e.message, true); btns.forEach(function (b) { b.disabled = false; }); });
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
      if (st.state === 'error') h.status('Error: ' + (st.message || 'unknown'), true);
      else if (st.message) h.status(st.message);
      else if (st.state === 'writing') h.status('Writing a tree…');
      else if (st.state !== 'done') h.status('Thinking…');
    });
    es.addEventListener('answer', function (ev) { h.answer(JSON.parse(ev.data)); });
    es.addEventListener('done', function () { es.close(); h.done(); });
    es.onerror = function () { es.close(); h.status('Connection lost.', true); h.done(); };
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
          b.textContent = 'New tree: ' + a.trees_added.join(', ') + ' — reload';
          b.onclick = function () { location.reload(); };
          acts.appendChild(b);
        } else if (kind === 'ask' && /\bponud|\boffer|\buzgoj|\bgrow\b/i.test(a.markdown)) {
          var g = document.createElement('button');
          g.textContent = 'Yes, grow it into a tree';
          g.onclick = function () { sendAsk('grow', id); };
          acts.appendChild(g);
        }
      },
    });
  }

  // ---- the tutor section: served-mode only, one session per vault ---------
  // The conversation lives on disk under sessions/<slug>/ and the page keeps
  // only the slug, so closing the tab loses nothing and a reload resumes.
  var TUTOR_WAIT = 'Waiting for Claude Code — run /forest:tutor in the vault.';
  var tutorBox = document.createElement('div');
  tutorBox.id = 'panel-tutor';
  tutorBox.innerHTML =
    '<div class="tutor-head">Tutor</div>' +
    '<div id="tutor-live" hidden>' +
    '<div class="tutor-reply" id="tutor-reply"></div>' +
    '<div class="tutor-note" id="tutor-note" hidden></div>' +
    '<div id="tutor-answer"><textarea id="tutor-a" placeholder="answer…"></textarea>' +
    '<div class="ask-row"><button class="primary" id="tutor-send">Send</button>' +
    '<button id="tutor-pause">Pause</button>' +
    '<span class="ask-status" id="tutor-status"></span></div></div>' +
    '<details><summary>Notes</summary><div class="tutor-notes" id="tutor-notes"></div></details>' +
    '</div>' +
    '<div id="tutor-idle"><button class="primary" id="tutor-start">Start the tutor</button>' +
    '<div class="tutor-hint">The tutor will ask its questions here; answer in the field below.</div></div>';
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
      ? 'The session is closed — the notes stay below.'
      : 'The tutor noted where we stopped — carry on whenever you like.';
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
    if (action === 'answer' && !q) { tutorStatus('Write an answer.', true); return; }
    if (action === 'start') {
      tutor.slug = proposeSlug(); rememberSlug(tutor.slug);
      tutor.status = 'active'; tutor.lastId = null; tutor.rev = null;
      tEl('tutor-reply').innerHTML = ''; setNotes('');
      renderTutor();
    }
    setTutorBusy(true);
    tutorStatus('Sending…');
    api('/api/ask', { method: 'POST', body: {
      kind: 'tutor', action: action, session: tutor.slug, tree: selected,
      question: q, reply_to: tutor.lastId, progress: Object.keys(done).sort(),
    } }).then(function (r) {
      if (r.error) throw new Error(r.error);
      tutor.lastId = r.id;
      tutorStatus(r.watcher.alive ? 'Thinking…' : TUTOR_WAIT);
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
    }).catch(function (e) { tutorStatus('Error: ' + e.message, true); setTutorBusy(false); });
  }

  if (BRIDGE.on) {
    var pill = document.createElement('div'); pill.id = 'bridge-pill';
    document.body.appendChild(pill);
    var poll = function () {
      api('/api/state').then(function (s) {
        pill.classList.toggle('on', !!s.watcher.alive);
        pill.textContent = s.watcher.alive ? '● Claude Code connected' : '○ Claude Code not connected — /forest:tutor';
      }).catch(function () { pill.textContent = '○ bridge unreachable'; pill.classList.remove('on'); });
    };
    poll(); setInterval(poll, 5000);
    restoreTutor(); setInterval(pollSession, 2000);
  }

  // Last of all: the address. A hash may ask for a filter, an arrangement, a
  // folded pane, an open tree or a focused diagram, so it is read once the
  // whole page — strip, bridge and all — exists to be put into that state.
  // Whatever it asks for becomes the first entry in the trail, written with
  // replaceState, so Back can never walk out of the page.
  if (FF && fgraph) {
    readHash();
    navRecord();
  }
})();
