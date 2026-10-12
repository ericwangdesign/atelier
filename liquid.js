/* Liquid glass, after Apple's, shared by home and the stage, with a tuner to iterate on it.

   What's behind a glass shape bends near its rim, as through a lens, and splits a little into colour at the edge.
   look   glass or flat: the surface of every control (ui.css --surf), lens and all, or plain translucent white
   Seven more values set the glass. They live in localStorage (KEY below), so home and the stage always match (and an
   open tab updates when another one changes them):
     fill   white in the glass          blur   frost behind it, px      light  brightness of the top rim
     edge   the hairline around it      bend   how far the lens pulls, px
     reach  how far in from the rim the bend goes, px                   split  colour split at the rim

   Liquid.watch(selector, g => options)   gives every matching element the lens, now and as they appear.
                                          options: { bezel, bend, split, frost } worked out from the values g,
                                          or null for no lens (e.g. controls when the look is flat)
   Liquid.tuner(el)                       draws the sliders into el (classes .lbl, .range, .acts, .btn)

   How the lens works: for each element size a displacement map is drawn on a canvas (red = sideways, green = up/down,
   grey = still), strongest at the rim and fading to nothing by the bezel, pointing out along the rim's normal. An SVG
   filter displaces the backdrop by it three times (red, green, blue, each a little more) and screens them together.
   backdrop-filter: url() works in Chrome; elsewhere only the CSS values (fill, blur, light, edge) apply. */
window.Liquid = (() => {
  const KEY = 'workspace.glass.3'; // a new key when the defaults are re-baked, so old tuner values don't hide them
  const DEFAULTS = { look: 'flat', fill: .03, blur: 1, light: .2, edge: .04, bend: 4, reach: 8, split: .3 }; // picked 2026-10-09 (flat controls)
  const SLIDERS = [['fill', 'Fill', 0, .2, .01, ''], ['blur', 'Blur', 0, 12, .5, 'px'], ['light', 'Light', 0, .6, .02, ''], ['edge', 'Edge', 0, .4, .02, ''],
    ['bend', 'Bend', 0, 20, .5, 'px'], ['reach', 'Reach', 2, 30, 1, 'px'], ['split', 'Split', 0, .3, .01, '']];
  let G = { ...DEFAULTS };
  const load = () => { try { Object.assign(G, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {} };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch {} };
  load();

  /* the CSS half: ui.css builds the buttons' fill, frost and lit edge from these */
  function css() {
    const r = document.documentElement.style;
    document.documentElement.dataset.look = G.look;
    r.setProperty('--g-fill', G.fill); r.setProperty('--g-blur', G.blur + 'px'); r.setProperty('--g-light', G.light); r.setProperty('--g-edge', G.edge);
  }
  css();

  /* the lens half */
  const ok = /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent);
  const NS = 'http://www.w3.org/2000/svg';
  let svg = null, n = 0;
  const made = new Map(), uses = new Map(), live = new Set(), groups = []; // filter id by size; how many elements use each
  const defs = () => {
    if (!svg) { svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; document.body.append(svg); }
    return svg;
  };
  function sdf(x, y, w, h, r) { // signed distance to a rounded rectangle w × h, corner r; negative inside
    const qx = Math.abs(x - w / 2) - (w / 2 - r), qy = Math.abs(y - h / 2) - (h / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function map(w, h, r, bezel) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + .5, py = y + .5, s = sdf(px, py, w, h, r), i = (y * w + x) * 4;
      let dx = 0, dy = 0;
      if (s < 0) {
        const t = Math.max(0, 1 - -s / bezel), m = t * t * (3 - 2 * t); // smooth falloff from the rim inward
        if (m > 0) {
          const nx = sdf(px + .5, py, w, h, r) - sdf(px - .5, py, w, h, r), ny = sdf(px, py + .5, w, h, r) - sdf(px, py - .5, w, h, r);
          const len = Math.hypot(nx, ny) || 1;
          dx = nx / len * m; dy = ny / len * m;
        }
      }
      d[i] = 128 + dx * 127; d[i + 1] = 128 + dy * 127; d[i + 2] = 128; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }
  function filter(w, h, r, o) {
    const bezel = Math.max(2, Math.min(o.bezel, h / 2, w / 2)), key = [w, h, r, bezel, o.bend, o.split].join('|');
    if (made.has(key)) return [made.get(key), key];
    const id = 'liquid' + ++n, f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    for (const [k, v] of Object.entries({ x: 0, y: 0, width: w, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) f.setAttribute(k, v);
    const keep = { r: '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0', g: '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0', b: '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0' };
    const pass = (k, ch) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(o.bend * 2 * (1 + o.split * k)).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="d${ch}"/>`
      + `<feColorMatrix in="d${ch}" type="matrix" values="${keep[ch]} 0 0 0 1 0" result="${ch}"/>`;
    f.innerHTML = `<feImage href="${map(w, h, r, bezel)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`
      + pass(0, 'r') + pass(.5, 'g') + pass(1, 'b') + `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`;
    defs().append(f); made.set(key, id);
    return [id, key];
  }
  /* an element moves to another size's filter (or none): the old one goes once nothing uses it, so resizing
     doesn't leave a filter and its map behind for every size passed through */
  function use(el, key) {
    if (el._key === key) return;
    if (el._key) {
      const left = (uses.get(el._key) || 1) - 1;
      if (left) uses.set(el._key, left);
      else { uses.delete(el._key); const id = made.get(el._key); made.delete(el._key); if (id) svg?.querySelector('#' + id)?.remove(); }
    }
    el._key = key; if (key) uses.set(key, (uses.get(key) || 0) + 1);
  }
  function apply(el, make) {
    if (el._liquid) return;
    const update = () => {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) return;
      const m = make(G);
      if (!m) { use(el, null); el.style.backdropFilter = el.style.webkitBackdropFilter = ''; return; }
      const o = { bezel: 12, bend: 8, split: .05, frost: '', ...m }, w = Math.round(b.width), h = Math.round(b.height);
      const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      const [id, key] = o.bend > 0 ? filter(w, h, r, o) : [null, null]; use(el, key);
      const value = (id ? `url(#${id})` : '') + (o.frost ? ' ' + o.frost : '') || 'none';
      el.style.backdropFilter = value; el.style.webkitBackdropFilter = value;
    };
    el._liquid = update; live.add(el);
    update(); (el._ro = new ResizeObserver(update)).observe(el);
  }
  function watch(selector, make) {
    if (!ok) return;
    const scan = () => {
      for (const el of live) if (!el.isConnected) { use(el, null); el._ro.disconnect(); live.delete(el); el._liquid = null; } // gone from the page: let go of it (it starts over if it comes back)
      document.querySelectorAll(selector).forEach(el => apply(el, make));
    };
    groups.push(scan); scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }
  /* new values: rebuild every lens (old filters go, so dragging a slider doesn't pile them up) */
  let pending = 0;
  function retune() {
    css();
    if (!ok || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0; made.clear(); uses.clear(); if (svg) svg.replaceChildren();
      for (const el of live) { el._key = null; if (el.isConnected) el._liquid(); else { live.delete(el); el._ro.disconnect(); } }
    });
  }
  const reload = () => { G = { ...DEFAULTS }; load(); retune(); syncTuners(); };
  addEventListener('storage', e => { if (e.key === KEY) reload(); });
  addEventListener('pageshow', e => { if (e.persisted) reload(); }); // back to a page kept in the back/forward cache, which missed the storage events

  /* ---------- the tuner ---------- */
  const tuners = new Set();
  const fmt = (v, unit) => (unit ? v + unit : Math.round(v * 100) + '%');
  function syncTuners() {
    for (const t of tuners) t.querySelectorAll('[data-look]').forEach(b => b.setAttribute('aria-pressed', b.dataset.look === G.look));
    for (const t of tuners) for (const [k, , , , , unit] of SLIDERS) {
      const input = t.querySelector(`[data-g="${k}"]`); input.value = G[k]; input.previousElementSibling.querySelector('output').textContent = fmt(G[k], unit);
    }
  }
  function tuner(el) {
    el.innerHTML = `<div class="lbl">Controls</div><div class="seg" role="group" aria-label="Controls">`
      + [['glass', 'Glass'], ['flat', 'Flat']].map(([v, t]) => `<button class="pill" data-look="${v}" aria-pressed="${G.look === v}">${t}</button>`).join('') + '</div>'
      + SLIDERS.map(([k, label, min, max, step, unit]) =>
      `<div class="lbl">${label}<output>${fmt(G[k], unit)}</output></div><input class="range" type="range" data-g="${k}" min="${min}" max="${max}" step="${step}" value="${G[k]}" aria-label="${label}">`).join('')
      + `<div class="acts"><button class="btn" data-a="copy">Copy values</button><button class="btn" data-a="reset">Reset</button></div>`;
    el.addEventListener('input', e => {
      const k = e.target.dataset.g; if (!k) return;
      G[k] = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = fmt(G[k], SLIDERS.find(s => s[0] === k)[5]);
      save(); retune();
    });
    el.addEventListener('click', async e => {
      const l = e.target.closest('[data-look]');
      if (l) { G.look = l.dataset.look; save(); retune(); syncTuners(); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'reset') { G = { ...DEFAULTS }; save(); retune(); syncTuners(); return; }
      const text = 'Make these the liquid glass defaults (DEFAULTS in workspace/liquid.js):\n' + JSON.stringify(G);
      const was = a.dataset.label ||= a.textContent, say = window.UI ? UI.say : (b, t) => { b.textContent = t; };
      try { await navigator.clipboard.writeText(text); say(a, 'Copied'); } catch { say(a, 'Not copied'); }
      clearTimeout(a._back); a._back = setTimeout(() => say(a, was, -1), 1400);
    });
    tuners.add(el);
  }
  return { watch, tuner, supported: ok, values: () => ({ ...G }) };
})();
