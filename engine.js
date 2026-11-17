/* The scene engine, shared by the stage (stage.html) and the gallery (index.html).

   Engine.mount(host, scene)      builds the scene inside host, in its own shadow root, so its styles stay its own
   Engine.drive(layer, pos)       shows the scene at a step position (2.5 = halfway through step 2)
   Engine.controls(layer, vals)   applies control values (missing ones fall back to each control's default)
   Engine.posAt(steps, seconds)   turns seconds into a step position
   Engine.duration(steps)         how long the scene plays, in seconds

   The attributes a scene animates with (data-in, data-out, data-type, data-state) are explained in starter/first.js.
   A scene with live(root) is a prototype: mount runs it once with the scene's root (inside its shadow root) and the
   design is used, not played. It can also have a tour: steps, and live() returns at(i), which drive calls when the step
   changes, to put the prototype in that step's state and play its move. A tap while it plays stops it (stage.html). Taps, swipes and typing are its own; the clock never drives it (Eric, Oct 18:
   "everything in the atelier workspace should be 100% interactable like a prototype, not just a motion replay"). */
window.Engine = (() => {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function mount(host, sc) {
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>:host { all: initial; } .scene { position: absolute; inset: 0; overflow: hidden; } ${sc.css}</style><div class="scene">${sc.html}</div>`;
    const root = sh.querySelector('.scene');
    if (typeof sc.live === 'function') {
      root.dataset.live = '';
      let at = null;
      try { at = sc.live(root); } catch (e) { console.error(sc.id, 'live', e); }
      return { host, scene: sc, root, live: true, at: typeof at === 'function' ? at : null, step: -1, jobs: [], seq: 0, clock: 0 };
    }
    return { host, scene: sc, root, els: {
      in: [...sh.querySelectorAll('[data-in]')].map(el => ({ el, a: +el.dataset.in, b: el.dataset.out == null ? Infinity : +el.dataset.out })),
      type: [...sh.querySelectorAll('[data-type]')].map(el => { const [a, b] = el.dataset.type.split('-').map(Number); return { el, a, b: b ?? a + 1, full: el.textContent }; }),
      state: [...sh.querySelectorAll('[data-state]')].map(el => ({ el, list: el.dataset.state.trim().split(/\s+/).map(x => { const [p, s] = x.split(':'); return [+p, s]; }) })),
    } };
  }
  /* A tour's moves run on the timeline's clock, not the wall clock. A tour plays its moves on its own timers
     ("later(() => tap(...), 900)"). Every timer a tour starts, in at(i) or in a move that at(i) started, is kept
     with the moment in the step it is due, and runs when the timeline reaches that moment. So pause stops a tour at
     once (Eric, Nov 16), and dragging the timeline always shows the step as it is at that moment, paused or not
     (Eric, Nov 16: "why sometimes dragging the timeline doesn't trigger": paused, a step's moves were held and never
     ran; inside one step, nothing moved). Dragging back inside a step starts the step again and plays up to there.
     Timers the prototype starts when it is used by hand (a tap, a countdown) are not touched. */
  function held(L, base, fn) {
    const prev = window.setTimeout;
    window.setTimeout = (f, ms = 0, ...a) => { if (typeof f !== 'function') return prev(f, ms, ...a); L.jobs.push({ f, a, due: base + (+ms || 0), n: L.seq++ }); return 0; };
    try { fn(); } catch (e) { console.error(L.scene.id, 'tour', e); } finally { window.setTimeout = prev; }
  }
  function runTo(L, clock) {
    for (let guard = 0; guard < 2000; guard++) {
      let j = null; for (const k of L.jobs) if (k.due <= clock && (!j || k.due < j.due || (k.due === j.due && k.n < j.n))) j = k;
      if (!j) break;
      L.jobs.splice(L.jobs.indexOf(j), 1); held(L, j.due, () => j.f(...j.a));
    }
    L.clock = clock;
  }
  // into: seconds into the step, from the stage's own clock. Without it, the share of the step's own length.
  function drive(L, pos, into) {
    // A prototype with a tour: live() returned at(i), which puts it in step i's state and plays that step's move.
    if (L.live) {
      const i = Math.min(Math.floor(pos), L.scene.steps.length - 1);
      L.root.dataset.step = i;
      if (L.at) {
        const clock = Math.floor(pos) > i ? Infinity : (into ?? (pos - i) * (L.scene.steps[i].dur || 1)) * 1000; // past its last step, a shorter design holds it finished
        if (L.step !== i || clock < L.clock) { L.step = i; L.jobs = []; L.clock = 0; held(L, 0, () => L.at(i)); }
        runTo(L, clock);
      }
      return;
    }
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
