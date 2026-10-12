/* The scene engine, shared by the stage (stage.html) and the gallery (index.html).

   Engine.mount(host, scene)      builds the scene inside host, in its own shadow root, so its styles stay its own
   Engine.drive(layer, pos)       shows the scene at a step position (2.5 = halfway through step 2)
   Engine.controls(layer, vals)   applies control values (missing ones fall back to each control's default)
   Engine.posAt(steps, seconds)   turns seconds into a step position
   Engine.duration(steps)         how long the scene plays, in seconds

   The attributes a scene animates with (data-in, data-out, data-type, data-state) are explained in starter/first.js. */
window.Engine = (() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function mount(host, sc) {
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>:host { all: initial; } .scene { position: absolute; inset: 0; overflow: hidden; } ${sc.css}</style><div class="scene">${sc.html}</div>`;
    return { host, scene: sc, root: sh.querySelector('.scene'), els: {
      in: [...sh.querySelectorAll('[data-in]')].map(el => ({ el, a: +el.dataset.in, b: el.dataset.out == null ? Infinity : +el.dataset.out })),
      type: [...sh.querySelectorAll('[data-type]')].map(el => { const [a, b] = el.dataset.type.split('-').map(Number); return { el, a, b: b ?? a + 1, full: el.textContent }; }),
      state: [...sh.querySelectorAll('[data-state]')].map(el => ({ el, list: el.dataset.state.trim().split(/\s+/).map(x => { const [p, s] = x.split(':'); return [+p, s]; }) })),
    } };
  }
  function drive(L, pos) {
    const E = L.els; if (!E) return;
    const i = Math.min(Math.floor(pos), L.scene.steps.length - 1);
    L.root.dataset.step = i; L.root.style.setProperty('--p', Math.min(1, pos - i).toFixed(3)); // a design with fewer steps holds its last one at 1
    E.in.forEach(o => o.el.classList.toggle('on', pos >= o.a && pos < o.b));
    E.type.forEach(o => { const n = Math.round(o.full.length * clamp((pos - o.a) / (o.b - o.a), 0, 1)); if (o.n !== n) { o.n = n; o.el.textContent = o.full.slice(0, n); } });
    E.state.forEach(o => { let s = ''; for (const [p, v] of o.list) if (pos >= p) s = v; if (o.el.dataset.s !== s) o.el.dataset.s = s; });
  }
  function controls(L, vals = {}) {
    if (!L.scene || !L.scene.controls) return;
    L.scene.controls.forEach(c => {
      const v = vals[c.key] !== undefined ? vals[c.key] : c.value;
      if (c.css) L.root.style.setProperty(c.css, v + (c.unit || ''));
      if (c.attr) L.root.dataset[c.attr] = v;
    });
  }
  const duration = steps => steps.reduce((a, s) => a + s.dur, 0);
  function posAt(steps, sec) {
    let start = 0;
    for (let i = 0; i < steps.length; i++) { if (sec < start + steps[i].dur) return i + (sec - start) / steps[i].dur; start += steps[i].dur; }
    return steps.length;
  }
  return { mount, drive, controls, posAt, duration, clamp };
})();
