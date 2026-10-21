/* The colour picker, as in Figma. Opens from any colour swatch in the controls: a saturation and brightness square,
   a hue bar, an opacity bar, an eyedropper (where the browser has one), and the value as Hex, RGB or HSB with the
   opacity in %. Every change is sent back at once, so the design changes while you drag.

   ColorPick.open(anchor, '#rrggbb' | '#rrggbbaa', value => {...})   values come back as hex, with alpha only below 100%
   ColorPick.close()

   Needs nothing from the stage but the tokens in tokens.css. */
window.ColorPick = (() => {
  const css = `
  .cpick { position: fixed; z-index: 60; width: 240px; padding: 12px; border-radius: var(--c-r-lg); display: grid; gap: 10px; }
  .cpick[hidden] { display: none; }
  .cp-sv { position: relative; height: 150px; border-radius: var(--c-r-sm); cursor: crosshair; touch-action: none;
    background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(var(--h) 100% 50%)); }
  .cp-dot, .cp-knob { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgb(0 0 0 / .3); pointer-events: none; }
  .cp-row { display: flex; align-items: center; gap: 10px; }
  .cp-bars { flex: 1; display: grid; gap: 8px; }
  .cp-hue, .cp-alpha { position: relative; height: 10px; border-radius: var(--c-r-pill); cursor: pointer; touch-action: none; }
  .cp-hue { background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
  .cp-alpha { background: linear-gradient(to right, transparent, var(--rgb)), repeating-conic-gradient(#888 0 25%, #ccc 0 50%) 0 0 / 8px 8px; }
  .cp-knob { top: 50%; }
  .cp-drop { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: var(--c-r-pill); background: var(--surf-on); color: var(--c-text-2); cursor: pointer; }
  .cp-drop:hover { color: var(--c-text); } .cp-drop svg { width: 14px; height: 14px; }
  .cp-fields { display: flex; gap: 4px; }
  .cp-fields select, .cp-fields input { min-width: 0; height: 28px; padding: 0 6px; border: 0; border-radius: var(--c-r-sm); background: var(--surf); box-shadow: var(--surf-edge); color: var(--c-text); font: inherit; font-size: var(--c-t-sm); }
  .cp-fields select { flex: none; width: 58px; }
  .cp-in { flex: 1; display: flex; gap: 4px; min-width: 0; } .cp-in input { flex: 1; width: 100%; }
  .cp-fields .cp-a { flex: none; width: 48px; }
  .cp-fields input:focus, .cp-fields select:focus { outline: none; box-shadow: inset 0 0 0 1px var(--c-line-2); }`;
  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));

  const pop = document.createElement('div');
  pop.className = 'cpick glass'; pop.hidden = true;
  pop.innerHTML = `<div class="cp-sv"><i class="cp-dot"></i></div>
    <div class="cp-row"><button class="cp-drop" type="button" title="Pick a colour from the screen" aria-label="Eyedropper"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3-1.5 1.5-3-3z"/><path d="M9 4l3 3-6.5 6.5H2.5v-3z"/></svg></button>
      <div class="cp-bars"><div class="cp-hue"><i class="cp-knob"></i></div><div class="cp-alpha"><i class="cp-knob"></i></div></div></div>
    <div class="cp-fields"><select class="cp-mode" aria-label="Format"><option>Hex</option><option>RGB</option><option>HSB</option></select><div class="cp-in"></div><input class="cp-a" aria-label="Opacity"></div>`;
  document.body.append(pop);
  const q = s => pop.querySelector(s);
  if (!window.EyeDropper) q('.cp-drop').hidden = true;
  pop.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); }); // the stage's keys stay out
  pop.addEventListener('pointerdown', e => e.stopPropagation());

  let h = 0, s = 0, v = 0, a = 1, send = null, anchor = null, mode = 'Hex';
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  function hsvToRgb(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    const hh = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hh * 60 + 360) % 360, mx === 0 ? 0 : d / mx, mx];
  }
  const hex2 = n => n.toString(16).padStart(2, '0');
  const hex = () => '#' + hsvToRgb(h, s, v).map(hex2).join('') + (a < 1 ? hex2(Math.round(a * 255)) : '');
  function parse(val) {
    const t = String(val || '').trim();
    let m = t.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let x = m[1]; if (x.length <= 4) x = [...x].map(c => c + c).join('');
      const n = [0, 2, 4, 6].map(i => parseInt(x.slice(i, i + 2), 16));
      return [n[0], n[1], n[2], x.length === 8 ? n[3] / 255 : 1];
    }
    m = t.match(/^rgba?\(([^)]+)\)$/i);
    if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3] > 1 ? p[3] / 100 : p[3]]; }
    return [0, 0, 0, 1];
  }
  function set(val) { const [r, g, b, al] = parse(val); [h, s, v] = rgbToHsv(r, g, b); a = clamp(al, 0, 1); }

  function fields() {
    const [r, g, b] = hsvToRgb(h, s, v), box = q('.cp-in');
    const vals = mode === 'Hex' ? [hex().slice(1, 7).toUpperCase()] : mode === 'RGB' ? [r, g, b] : [Math.round(h), Math.round(s * 100), Math.round(v * 100)];
    if (box.dataset.mode !== mode) { box.dataset.mode = mode; box.innerHTML = vals.map((_, i) => `<input aria-label="${mode === 'Hex' ? 'Hex' : mode[i]}">`).join(''); }
    box.querySelectorAll('input').forEach((el, i) => { if (document.activeElement !== el) el.value = vals[i]; });
    if (document.activeElement !== q('.cp-a')) q('.cp-a').value = Math.round(a * 100) + '%';
  }
  function paint(emit = true) {
    const [r, g, b] = hsvToRgb(h, s, v);
    pop.style.setProperty('--h', h); pop.style.setProperty('--rgb', `rgb(${r} ${g} ${b})`);
    Object.assign(q('.cp-dot').style, { left: s * 100 + '%', top: (1 - v) * 100 + '%', background: `rgb(${r} ${g} ${b})` });
    Object.assign(q('.cp-hue .cp-knob').style, { left: h / 360 * 100 + '%', background: `hsl(${h} 100% 50%)` });
    Object.assign(q('.cp-alpha .cp-knob').style, { left: a * 100 + '%', background: `rgb(${r} ${g} ${b} / ${a})` });
    fields();
    if (emit && send) send(hex());
  }

  // drag in the square and on the bars: the value follows the pointer, also outside the box
  function drag(el, at) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const move = ev => { const r = el.getBoundingClientRect(); at(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); paint(); };
      move(e);
      el.onpointermove = move;
      el.onpointerup = el.onpointercancel = () => { el.onpointermove = el.onpointerup = el.onpointercancel = null; };
    });
  }
  drag(q('.cp-sv'), (x, y) => { s = x; v = 1 - y; });
  drag(q('.cp-hue'), x => { h = x * 360; });
  drag(q('.cp-alpha'), x => { a = Math.round(x * 100) / 100; });

  q('.cp-mode').onchange = e => { mode = e.target.value; paint(false); };
  q('.cp-in').addEventListener('change', () => {
    const vals = [...q('.cp-in').querySelectorAll('input')].map(el => el.value.trim());
    if (mode === 'Hex') { const x = vals[0].replace(/^#/, ''); if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x)) { const al = a; set('#' + x); a = al; } }
    else if (mode === 'RGB') { const [r, g, b] = vals.map(n => clamp(Math.round(+n || 0), 0, 255)); [h, s, v] = rgbToHsv(r, g, b); }
    else { const [hh, ss, vv] = vals.map(n => +n || 0); h = clamp(hh, 0, 360); s = clamp(ss / 100, 0, 1); v = clamp(vv / 100, 0, 1); }
    paint();
  });
  q('.cp-a').addEventListener('change', e => { a = clamp((parseFloat(e.target.value) || 0) / 100, 0, 1); paint(); });
  q('.cp-drop').onclick = async () => {
    try { const r = await new EyeDropper().open(); const al = a; set(r.sRGBHex); a = al; paint(); } catch {}
  };

  function place() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, ht = pop.offsetHeight;
    // to the left of the panel the swatch sits in, level with it
    pop.style.left = clamp(r.left - w - 24, 12, innerWidth - w - 12) + 'px';
    pop.style.top = clamp(r.top - 40, 12, innerHeight - ht - 12) + 'px';
  }
  function open(el, val, cb) {
    anchor = el; send = null; set(val); pop.hidden = false; paint(false); place(); send = cb;
  }
  function close() { pop.hidden = true; send = null; anchor = null; }
  addEventListener('pointerdown', e => { if (!pop.hidden && e.target !== anchor && !pop.contains(e.target)) close(); }, { capture: true });
  addEventListener('resize', place);
  return { open, close, isOpen: () => !pop.hidden };
})();
