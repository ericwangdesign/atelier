/* Notes on words. Select some words in a design and press N (or C, as in the vault), or the Note button that comes up
   by them: the note is pinned to those words, the way a Doc comments, and the brief quotes them, so Claude knows
   exactly which line you mean.

   Designs live in shadow roots and re-render all the time (a step types a line out, a saved file mounts the scene
   again), so nothing is ever written into a scene. The note keeps the words with a little of what's before and after
   them; every time the pins are drawn, the words are found again by their text and the pin and a highlight are drawn
   over the screen, in the pins layer. If the words aren't on screen (another step, a line still typing, the text
   changed), the pin stays where it was left and the brief still quotes the words.

   Loaded by stage.html after its own script, and uses its functions (screens, S, newNote, openEditor, renderPins...). */
(() => {
  if (typeof screens === 'undefined' || typeof renderPins !== 'function') return;

  const style = document.createElement('style');
  style.textContent = `
  .pins .qhl { position: absolute; border-radius: 2px; background: rgb(250 204 21 / .09); box-shadow: 0 1px 0 rgb(250 204 21 / .35); pointer-events: none; }
  .pins .qhl.on { background: rgb(250 204 21 / .15); box-shadow: 0 1px 0 rgb(250 204 21 / .6); }
  .pins .qhl.sent { background: rgb(255 255 255 / .16); box-shadow: 0 1.5px 0 rgb(255 255 255 / .5); }
  .tnpop { position: fixed; z-index: 58; display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border: 0; border-radius: 8px;
    color: #fff; font: 500 12px/1 var(--c-font); cursor: pointer; animation: tnin .14s cubic-bezier(.23, 1, .32, 1); }
  .tnpop .key { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 4px; background: rgb(255 255 255 / .14); font-size: 11px; color: rgb(255 255 255 / .8); }
  @keyframes tnin { from { opacity: 0; transform: translateY(4px); } }
  @media (prefers-reduced-motion: reduce) { .tnpop { animation: none; } }
  .nq { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; color: #f7c948; font-size: 12px; line-height: 16px; }
  .nq::before { content: "“"; }
  .nq::after { content: "”"; }
  .notes .nq { margin-bottom: 2px; }
  .notepop .nq { margin-top: 8px; }
  `;
  document.head.append(style);

  const pop = document.createElement('button');
  pop.type = 'button'; pop.className = 'tnpop glass'; pop.hidden = true;
  pop.innerHTML = 'Note<span class="key">N</span>';
  document.body.append(pop);

  /* ---------- the words in one design ---------- */

  // What isn't readable text: hidden steps, styles, scripts, or anything hidden from layout.
  const SKIP_SEL = 'style, script, noscript, template, [hidden], [aria-hidden="true"], [inert], [data-in]:not(.on)';
  // The box a piece of text sits in: its nearest ancestor that isn't laid out inline. Text in two different boxes (a
  // title and its body, two cells of a row) reads as two lines, so the index puts a line break between them, as it
  // does at a <br>; without it a quote across them runs the words together ("TitleBody"). The break belongs to no
  // node, so ranges map around it.
  const INLINE = new Set(['inline', 'contents', 'ruby', 'ruby-base', 'ruby-text']);
  function textIndex(rootEl) {
    const out = [], parts = []; let pos = 0, prevBox = null, br = false;
    const boxes = new Map(), hidden = new Map();
    const isHidden = el => {
      if (!el || el === rootEl || el.nodeType !== 1) return false;
      if (hidden.has(el)) return hidden.get(el);
      const cs = getComputedStyle(el);
      const v = cs.display === 'none' || cs.visibility === 'hidden' || isHidden(el.parentElement);
      hidden.set(el, v);
      return v;
    };
    const skip = el => !el || !!el.closest(SKIP_SEL) || isHidden(el);
    const boxOf = el => {
      const seen = [];
      while (el && el !== rootEl && !boxes.has(el) && INLINE.has(getComputedStyle(el).display)) { seen.push(el); el = el.parentElement; }
      const b = !el || el === rootEl ? rootEl : (boxes.get(el) || el);
      if (el && el !== rootEl && !boxes.has(el)) boxes.set(el, el);
      seen.forEach(x => boxes.set(x, b));
      return b;
    };
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n =>
      n.nodeType === 1 ? (skip(n) ? NodeFilter.FILTER_REJECT : n.localName === 'br' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
        : skip(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) { br = true; continue; }
      if (!n.data) continue;
      const box = boxOf(n.parentElement);
      if (out.length && (br || box !== prevBox) && !/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(n.data)) { parts.push('\n'); pos += 1; }
      out.push({ node: n, start: pos }); parts.push(n.data); pos += n.data.length;
      prevBox = box; br = false;
    }
    return { nodes: out, text: parts.join('') };
  }
  function offsetIn(ix, container, off) {
    if (container.nodeType === 3) { const x = ix.nodes.find(x => x.node === container); return x ? x.start + off : null; }
    const child = container.childNodes[off];
    for (const x of ix.nodes) {
      if (child) { if (child === x.node || child.contains(x.node) || (child.compareDocumentPosition(x.node) & Node.DOCUMENT_POSITION_FOLLOWING)) return x.start; }
      else if (!container.contains(x.node) && (container.compareDocumentPosition(x.node) & Node.DOCUMENT_POSITION_FOLLOWING)) return x.start;
    }
    return ix.text.length;
  }
  function rangeFor(ix, s, e) {
    const at = p => { for (let i = ix.nodes.length - 1; i >= 0; i--) if (ix.nodes[i].start <= p) return [ix.nodes[i].node, Math.min(p - ix.nodes[i].start, ix.nodes[i].node.data.length)]; return null; };
    const a = at(s), b = at(e); if (!a || !b) return null;
    const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); return r;
  }
  const near = (have, want, fromEnd) => { let n = 0; const a = have.length, b = want.length; while (n < a && n < b && (fromEnd ? have[a - 1 - n] === want[b - 1 - n] : have[n] === want[n])) n++; return n; };
  function squash(t) { let s = ''; const map = []; let ws = false; for (let i = 0; i < t.length; i++) { if (/\s/.test(t[i])) { if (!ws) { s += ' '; map.push(i); } ws = true; } else { s += t[i]; map.push(i); ws = false; } } return { s, map }; }
  // The words again: exact text first, the occurrence whose neighbours match best; then ignoring how spaces run.
  function locateIn(L, q) {
    if (!L || !L.root || !q || !q.text) return null;
    const ix = textIndex(L.root), t = ix.text;
    let best = -1, top = -1;
    for (let i = t.indexOf(q.text); i >= 0; i = t.indexOf(q.text, i + 1)) {
      const sc = near(t.slice(Math.max(0, i - q.prefix.length), i), q.prefix, true) + near(t.slice(i + q.text.length, i + q.text.length + q.suffix.length), q.suffix, false);
      if (sc > top) { top = sc; best = i; }
    }
    if (best >= 0) return rangeFor(ix, best, best + q.text.length);
    const T = squash(t), Q = squash(q.text.trim()).s, P = squash(q.prefix).s, X = squash(q.suffix).s;
    if (!Q) return null;
    for (let j = T.s.indexOf(Q); j >= 0; j = T.s.indexOf(Q, j + 1)) {
      const sc = near(T.s.slice(Math.max(0, j - P.length), j), P, true) + near(T.s.slice(j + Q.length, j + Q.length + X.length), X, false);
      if (sc > top) { top = sc; best = j; }
    }
    return best < 0 ? null : rangeFor(ix, T.map[best], T.map[best + Q.length - 1] + 1);
  }

  // The words selected in a design right now, if any: which screen, which layer, and the range.
  function selected() {
    const sel = getSelection();
    for (const sc of screens) for (let k = 0; k < (sc.layers || []).length; k++) {
      const L = sc.layers[k]; if (!L || !L.root) continue;
      const sr = L.root.getRootNode();
      let r = null;
      if (sel && sel.getComposedRanges) { // the standard way to see into a shadow root
        const s = sel.getComposedRanges({ shadowRoots: [sr] })[0];
        if (s && !s.collapsed && L.root.contains(s.startContainer) && L.root.contains(s.endContainer)) { r = document.createRange(); r.setStart(s.startContainer, s.startOffset); r.setEnd(s.endContainer, s.endOffset); }
      }
      if (!r && sr.getSelection) { // older Chrome
        const s = sr.getSelection();
        if (s && s.rangeCount && !s.isCollapsed) { const x = s.getRangeAt(0); if (L.root.contains(x.commonAncestorContainer)) r = x; }
      }
      if (r && r.toString().trim()) return { sc, k, L, range: r };
    }
    return null;
  }
  function quoteOf(L, range) {
    const ix = textIndex(L.root);
    let s = offsetIn(ix, range.startContainer, range.startOffset), e = offsetIn(ix, range.endContainer, range.endOffset);
    if (s == null || e == null || e <= s) return null;
    while (s < e && /\s/.test(ix.text[s])) s++;
    while (e > s && /\s/.test(ix.text[e - 1])) e--;
    const text = ix.text.slice(s, Math.min(e, s + 500));
    if (!text.trim()) return null;
    return { text, prefix: ix.text.slice(Math.max(0, s - 32), s), suffix: ix.text.slice(e, e + 32) };
  }

  /* ---------- making the note ---------- */

  function noteOnWords() {
    const at = selected(); if (!at) return false;
    const { sc, k, L, range } = at, q = quoteOf(L, range); if (!q) return false;
    const rects = [...range.getClientRects()].filter(r => r.width && r.height); if (!rects.length) return false;
    const first = rects[0], last = rects[rects.length - 1], box = sc.screen.getBoundingClientRect();
    const e = { clientX: last.right, clientY: last.top + last.height / 2 };
    const where = { k, L, d: sc.designs[k], x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
    let el = range.commonAncestorContainer; if (el.nodeType !== 1) el = el.parentElement;
    if (editing) closeEditor(true);
    if (noting) setNoting(false);
    const note = newNote(sc, e, where, el);
    note.quote = q;
    getSelection().removeAllRanges(); pop.hidden = true;
    S.notes.push(note); touch(note); renderNotes();
    openEditor(note, e.clientX + 12, e.clientY, true, { left: first.left, right: last.right + 24 });
    snapNote(note, L, e.clientX, e.clientY);
    return true;
  }

  /* ---------- pins on the words ---------- */

  let drawn = '';
  function decorate() {
    const marks = [];
    screens.forEach(sc => {
      const box = sc.screen.getBoundingClientRect(); if (!box.width || !box.height) return;
      sc.pins.querySelectorAll('.pin').forEach(p => {
        const n = noteById(p.dataset.id); if (!n || !n.quote) return;
        const k = Math.max(0, sc.designs.findIndex(d => d.id === n.design));
        const r = locateIn(sc.layers[k], n.quote);
        const rects = r ? [...r.getClientRects()].filter(x => x.width && x.height && x.right > box.left && x.left < box.right && x.bottom > box.top && x.top < box.bottom) : [];
        if (!rects.length) return; // not on screen now: the pin stays where it was left
        const last = rects[rects.length - 1];
        const pct = (v, a, w) => ((v - a) / w * 100).toFixed(3) + '%';
        // The pin sits on the top right corner of the last word, like a footnote mark: the words stay readable.
        marks.push({ sc, p, left: pct(last.right + 10, box.left, box.width), top: pct(last.top - 2, box.top, box.height),
          hl: rects.map(x => `left:${pct(x.left, box.left, box.width)};top:${pct(x.top, box.top, box.height)};width:${(x.width / box.width * 100).toFixed(3)}%;height:${(x.height / box.height * 100).toFixed(3)}%`),
          cls: 'qhl' + (n.sent ? ' sent' : '') + (editing === n ? ' on' : '') });
      });
    });
    const sig = marks.map(m => m.p.dataset.id + m.left + m.top + m.cls + m.hl.join()).join('|') + '#' + screens.map(sc => sc.pins.childElementCount).join();
    if (sig === drawn) return;
    screens.forEach(sc => sc.pins.querySelectorAll('.qhl').forEach(x => x.remove()));
    marks.forEach(m => {
      m.p.style.left = m.left; m.p.style.top = m.top;
      m.hl.forEach(css => { const i = document.createElement('i'); i.className = m.cls; i.style.cssText = css; m.sc.pins.prepend(i); });
    });
    drawn = marks.map(m => m.p.dataset.id + m.left + m.top + m.cls + m.hl.join()).join('|') + '#' + screens.map(sc => sc.pins.childElementCount).join();
  }
  const base = renderPins;
  renderPins = function () { base.apply(this, arguments); drawn = ''; decorate(); };
  // A scene that re-renders or reflows (a line typing out, a resize, a saved file) moves its words: keep up.
  setInterval(() => { if (!document.hidden && S.notes.some(n => n.quote && !n.done)) decorate(); }, 600);
  // A pin on words belongs to them: it isn't dragged off (the stage's drag starts on pointerdown; a click still opens it).
  $('frames').addEventListener('pointerdown', e => {
    const p = e.target.closest && e.target.closest('.pin'); if (!p) return;
    const n = noteById(p.dataset.id); if (n && n.quote) e.stopPropagation();
  }, true);

  /* ---------- the Note button and the keys ---------- */

  function placePop() {
    const at = selected();
    if (!at || noting || cutting || picking) { pop.hidden = true; return; }
    const rects = [...at.range.getClientRects()].filter(r => r.width); if (!rects.length) { pop.hidden = true; return; }
    const first = rects[0], last = rects[rects.length - 1];
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let y = first.top - h - 8; if (y < 8) y = last.bottom + 8;
    pop.style.left = Math.min(Math.max(8, first.left), innerWidth - w - 8) + 'px';
    pop.style.top = y + 'px';
  }
  pop.addEventListener('mousedown', e => e.preventDefault()); // keep the selection
  pop.addEventListener('click', () => noteOnWords());
  addEventListener('mouseup', e => { if (e.target !== pop) setTimeout(placePop, 0); });
  addEventListener('keyup', e => { if (e.key === 'Shift' || e.shiftKey) placePop(); });
  document.addEventListener('selectionchange', () => { if (!pop.hidden && !selected()) pop.hidden = true; });
  addEventListener('wheel', () => { pop.hidden = true; }, { passive: true });

  // N or C with words selected in a design notes them. Ahead of the stage's own keys (N: note mode, C: compare),
  // which still work when nothing is selected.
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.isComposing) return;
    if (!/^[nNcC]$/.test(e.key)) return;
    if (e.target.matches?.('input, textarea, select, [contenteditable]') || e.target.isContentEditable) return;
    if (!selected()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    noteOnWords();
  }, true);

  window.TextNotes = { noteOnWords, decorate, locateIn };
})();
