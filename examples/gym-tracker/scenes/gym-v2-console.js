/* Gym Tracker, v2 console (Nov 15): an instrument. Each screen has one lit panel holding the thing you act on, with
   very large dot numbers; everything else sits plain on the ground on the panel's own text edge (40). In the workout
   the panel is the dial, then the rest countdown; the sets are numbered tiles that share the panel's edges.
   The plan (sets, rep range, step, rest, next time) and the progression rules open as a bottom sheet with steppers.
   Floating actions are glass in one bottom row: the tab bar or the arrows on the left, one main capsule on the right.
   System: spacing 8 / 16 / 24 (32 once, the sheet top), type 64 / 28 / 17 / 13, regular everywhere and one heavier
   weight for titles and numbers, one corner radius, controls 48 or 64, white at different opacities. */
{
const DOTS = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '.': ['0', '0', '0', '0', '0', '0', '1'], ':': ['0', '0', '1', '0', '1', '0', '0'],
};
// A number as lit dots (with the plain text beside it, shown instead when Numbers is set to Type).
const num = (text, big) => {
  const p = big ? 8 : 4, s = String(text), lit = (g) => g.map((r) => [r.indexOf('1'), r.lastIndexOf('1')]).filter(([a]) => a >= 0);
  // The first and last glyphs give up their empty columns, so the dots themselves sit on the text edge.
  const gl = (i) => DOTS[s[i]] || DOTS[0], lead = Math.min(...lit(gl(0)).map(([a]) => a)), g9 = gl(s.length - 1), trail = g9[0].length - 1 - Math.max(...lit(g9).map(([, b]) => b));
  let x = -lead, c = '';
  for (const ch of s) {
    const g = DOTS[ch] || DOTS[0];
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i + .5) * p}" cy="${(r + .5) * p}" r="${p * .4}" style="animation-delay:${(r + i) * 18}ms"/>`; }));
    x += g[0].length + 1;
  }
  return `<span class="num ${big ? 'big' : ''}" aria-label="${text}"><svg class="dots" width="${(x - 1 - trail) * p}" height="${7 * p}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
};
const ico = (d, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = {
  today: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="1" y="9" width="2.5" height="6" rx="1.2"/><rect x="4.5" y="6" width="3.5" height="12" rx="1.6"/><rect x="9" y="10.6" width="6" height="2.8" rx="1"/><rect x="16" y="6" width="3.5" height="12" rx="1.6"/><rect x="20.5" y="9" width="2.5" height="6" rx="1.2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="2.5" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="8" width="5" height="13" rx="1.6"/><rect x="16.5" y="3" width="5" height="18" rx="1.6"/></svg>',
  you: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7z"/></svg>',
  down: ico('m6 9 6 6 6-6'), prev: ico('m15 6-6 6 6 6'), next: ico('m9 6 6 6-6 6'), minus: ico('M6 12h12'), plus: ico('M12 6v12M6 12h12'),
};
// Eric's program. Each exercise: name, sets, rep range, what the number means, starting number, step, the old entry.
const X = (name, sets, lo, hi, basis, start = 0, step = 5, old = '') => ({ name, sets, lo, hi, basis, start, step, old, rest: lo <= 6 ? 150 : lo <= 8 ? 120 : 90 });
const PLAN = [
  { name: 'Push A', day: 'Push', focus: 'Upper chest, shoulder width', items: [X('Incline dumbbell press', 3, 8, 12, 'Per hand'), X('Flat barbell bench press', 3, 6, 10, 'Per side', 45, 2.5, '45 lb per side, 4 × 8'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Seated dumbbell shoulder press', 2, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Rope triceps pushdown', 3, 10, 15, 'Machine')] },
  { name: 'Pull A', day: 'Pull', focus: 'Lat width, upper back', items: [X('Pull-up', 3, 6, 10, ''), X('Chest-supported row', 3, 8, 12, 'Machine'), X('Lat pulldown', 3, 10, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Incline dumbbell curl', 3, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
  { name: 'Legs', day: 'Legs', focus: 'Athletic, proportionate legs', items: [X('Barbell squat', 3, 6, 10, 'Per side', 45, 5, '45 lb per side, 4 × 6'), X('Romanian deadlift', 3, 8, 10, 'Per side'), X('Leg extension', 2, 12, 15, 'Machine', 70, 5, '70 lb'), X('Leg curl', 3, 10, 15, 'Machine', 60, 5, '60 lb, 2 × 10'), X('Standing calf raise', 3, 10, 15, 'Machine'), X('Hanging knee or leg raise', 3, 8, 15, '')] },
  { name: 'Push B', day: 'Push', focus: 'Rounded shoulders, chest definition', items: [X('Seated dumbbell shoulder press', 3, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Incline machine press', 3, 8, 12, 'Machine'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Pec deck fly', 3, 10, 15, 'Machine'), X('Overhead cable triceps extension', 3, 10, 15, 'Machine')] },
  { name: 'Pull B', day: 'Pull', focus: 'V-taper, arms', items: [X('Neutral-grip lat pulldown', 3, 8, 12, 'Machine'), X('Seated cable row', 3, 8, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Preacher curl', 3, 10, 15, 'Machine'), X('Hammer curl', 2, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PHASES = [['Baseline', 1, 3, 'Find working weights, 2 to 3 reps left'], ['Overload', 4, 7, 'Add reps, then weight'], ['Check', 8, 8, 'Recovering well, carry on'], ['Consolidate', 9, 12, 'Compare photos and waist']];
const METHODS = { double: ['Reps first', 'Fill the rep range, then add weight'], linear: ['Each time', 'Add weight every session'], manual: ['Manual', 'You set every weight'] };
const STEPS = [1, 2.5, 5, 10];
const fmt = (n) => String(+(+n).toFixed(1));
const mmss = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// The weight line: one slot per week, the weigh-ins as points joined by a line.
const line = (byWeek) => {
  const w = 322, h = 72, v = Object.values(byWeek), lo = Math.min(...v) - .6, hi = Math.max(...v) + .6, px = (wk) => 4 + (wk - 1) * (w - 8) / 11;
  const P = Object.entries(byWeek).map(([wk, x]) => [px(+wk), h - 16 - (x - lo) / (hi - lo) * (h - 24)]), d = P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" fill="none" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<circle cx="${px(i + 1)}" cy="${h - 4}" r="2" fill="currentColor" opacity=".3"/>`).join('')}
    <path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>${P.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="4" fill="currentColor" style="animation-delay:${i * 60}ms"/>`).join('')}</svg>`;
};
const blobs = '<div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>';

SCENES.push({
  id: 'gym-v2-console',
  title: 'Gym Tracker',
  version: 'v2 console',
  size: [402, 874],
  note: 'An instrument: one lit panel per screen with the dial or the countdown in it, set tiles on the panel\'s edges, the plan and the progression rules in a sheet of steppers, glass for everything that floats.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Card', type: 'seg', options: [['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'lit', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['ember', 'Ember'], ['cobalt', 'Cobalt'], ['moss', 'Moss'], ['gold', 'Gold'], ['graphite', 'Graphite']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 110, step: 1, value: 75, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 32, unit: 'px', css: '--r' },
    { key: 'glass', label: 'Glass', type: 'range', min: .04, max: .3, step: .01, value: .12, css: '--glass' },
    { type: 'group', label: 'Type' },
    { key: 'weight', label: 'Title weight', type: 'seg', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']], value: 'bold', attr: 'weight' },
    { key: 'track', label: 'Letter spacing', type: 'range', min: -.06, max: .03, step: .002, value: -.012, unit: 'em', css: '--track' },
    { key: 'nums', label: 'Numbers', type: 'seg', options: [['dots', 'Dots'], ['type', 'Type']], value: 'dots', attr: 'nums' },
  ],
  steps: [{ label: 'Today', dur: 1.5 }, { label: 'Start', dur: 2.5 }, { label: 'Dial', dur: 3 }, { label: 'Log set', dur: 2.5 }, { label: 'Rest', dur: 3.5 }, { label: 'Next set', dur: 2.5 }, { label: 'Plan', dur: 3.5 }, { label: 'Rules', dur: 3.5 }],

  html: `
  <div class="app">
    ${blobs}
    <div class="grain"></div>
    <main class="pg"></main>
    <section class="work">${blobs}<div class="body"></div></section>
    <div class="scrim"></div>
    <section class="sheet"></section>
    <nav class="dock"></nav>
  </div>`,

  css: `
  .scene { --s: 8px; --m: 16px; --l: 24px; --tap: 48px; --big: 64px; --r: 32px; --card-k: 1; --glow: 75%; --track: -.012em; --glass: .12;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Geist", system-ui, sans-serif; --wt: 700;
    --text: #fff; --dim: rgba(255,255,255,.6); --fill: rgba(255,255,255,.1); --on: rgba(255,255,255,.92); --ink: #0B0B10;
    --card: linear-gradient(color-mix(in srgb, var(--c) calc(36% * var(--card-k)), transparent), color-mix(in srgb, var(--c) calc(4% * var(--card-k)), transparent));
    background: #000; color: var(--text); font: 400 17px/24px var(--font); letter-spacing: var(--track); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
  .scene[data-look=veil] { --card: linear-gradient(rgba(255,255,255, calc(.07 * var(--card-k))), rgba(255,255,255, calc(.07 * var(--card-k)))); }
  .scene[data-look=tint] { --card: linear-gradient(color-mix(in srgb, var(--c) calc(18% * var(--card-k)), transparent), color-mix(in srgb, var(--c) calc(18% * var(--card-k)), transparent)); }
  .scene[data-look=smoke] { --card: linear-gradient(rgba(0,0,0, calc(.46 * var(--card-k))), rgba(0,0,0, calc(.46 * var(--card-k)))); }
  .scene[data-colour=ember] { --base: #1B2550; --c1: #D9541F; --c: #F28A30; --c3: #B8401C; }
  .scene[data-colour=moss] { --base: #0F2A22; --c1: #3F9A3A; --c: #A6C63A; --c3: #1F7A58; }
  .scene[data-colour=gold] { --base: #1E1A14; --c1: #C98A1E; --c: #F2C14A; --c3: #A8641A; }
  .scene[data-colour=graphite] { --base: #1D2233; --c1: #5B6C8F; --c: #8A8FA8; --c3: #4A6480; }
  .scene[data-face=geist] { --font: "Geist", system-ui, sans-serif; }



  .scene[data-weight=regular] { --wt: 400; } .scene[data-weight=medium] { --wt: 500; }
  * { box-sizing: border-box; margin: 0; } button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .app { position: relative; height: 100%; overflow: hidden; }

  /* The ground: black, with the colour glowing down from the top and drifting slowly. */
  .ground { position: absolute; inset: 0; background: linear-gradient(var(--base), color-mix(in srgb, var(--c1) 55%, #000) 60%, #000);
    -webkit-mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); overflow: hidden; }
  .ground i { position: absolute; border-radius: 999px; filter: blur(60px); opacity: .8; animation: drift 26s ease-in-out infinite alternate; }
  .ground .b1 { width: 70%; height: 34%; left: -10%; top: 26%; background: var(--c1); }
  .ground .b2 { width: 60%; height: 30%; left: 30%; top: 14%; background: var(--c); animation-duration: 31s; animation-direction: alternate-reverse; }
  .ground .b3 { width: 55%; height: 36%; left: 55%; top: 34%; background: var(--c3); animation-duration: 37s; }
  @keyframes drift { to { transform: translate(14%, 10%) scale(1.15); } }
  .grain { position: absolute; inset: 0; opacity: .06; mix-blend-mode: soft-light; pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }

  /* Type: four sizes (64 only when numbers are plain type), regular; the title and the numbers carry the one heavier weight. */
  .t { display: block; font-size: 28px; line-height: 32px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .02em); }
  .l { font-size: 13px; line-height: 16px; color: var(--dim); }
  .num { display: inline-flex; align-items: flex-end; height: 32px; } .num.big { height: 56px; }
  .num .plain { display: none; font-size: 28px; line-height: 32px; font-weight: var(--wt); }
  .num.big .plain { font-size: 64px; line-height: 56px; letter-spacing: calc(var(--track) - .03em); }
  .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }
  .dots { display: block; flex: none; }
  .swap .dots circle, .rise .dots circle, .rise .line circle[style] { animation: lit .5s cubic-bezier(.3, 1.4, .5, 1) backwards; transform-box: fill-box; transform-origin: center; }
  @keyframes lit { from { opacity: 0; transform: scale(.4); } }

  /* Screens. Surfaces sit on the 16 margin; every line of text starts 24 inside that, at 40. */
  .pg, .work .body { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + var(--m)) var(--m) calc(var(--safe-bottom, 0px) + 96px + var(--l)); display: flex; flex-direction: column; gap: var(--l); }
  .pg::-webkit-scrollbar, .work .body::-webkit-scrollbar, .sheet::-webkit-scrollbar { display: none; }
  /* Content fades out under the status bar and under the dock, so nothing reads through the glass. */
  .pg, .work .body { --fade: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s)), #000 calc(100% - var(--safe-bottom, 0px) - 96px), rgba(0,0,0,.1) calc(100% - var(--safe-bottom, 0px) - 48px)); -webkit-mask-image: var(--fade); mask-image: var(--fade); }
  .head { padding: 0 var(--l); display: flex; flex-direction: column; gap: var(--s); }
  .sec { padding: 0 var(--l); display: flex; flex-direction: column; gap: var(--s); }
  .card { border-radius: var(--r); background: var(--card); padding: var(--l); display: flex; flex-direction: column; gap: var(--l); }
  .card.close { gap: var(--m); }
  .row { display: flex; align-items: center; gap: var(--m); width: 100%; text-align: left; } .tall { min-height: var(--tap); }
  .grow { flex: 1; min-width: 0; } .unit { display: flex; align-items: flex-end; gap: var(--s); }
  .rows { display: flex; flex-direction: column; } .col { display: flex; flex-direction: column; gap: var(--s); min-width: 0; }
  .off { opacity: .35; pointer-events: none; }

  /* Controls: circles and capsules, 48 (64 on the dial and in the dock), white at different opacities. */
  .pill { height: var(--tap); padding: 0 var(--l); border-radius: 99px; background: var(--fill); display: inline-grid; place-items: center; white-space: nowrap; flex: none; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s, color .2s; }
  .pill.on, .day.on .dot { background: var(--on); color: var(--ink); }
  .circ { width: var(--tap); height: var(--tap); border-radius: 50%; background: var(--fill); display: grid; place-items: center; flex: none; transition: transform .16s cubic-bezier(.23, 1, .32, 1); }
  .circ.big { width: var(--big); height: var(--big); }
  .keys { display: flex; gap: var(--s); flex: none; } .keys.fill { width: 100%; } .keys.fill .pill { flex: 1; padding: 0; } .keys.pair .pill { width: 96px; padding: 0; }
  .chip { font-size: 13px; line-height: 16px; min-width: 96px; text-align: center; padding: var(--s) var(--m); border-radius: 99px; background: var(--fill); white-space: nowrap; flex: none; }
  .pill:active, .circ:active, .day:active .dot, .dock button:active, .row:active .chip { transform: scale(.96); }
  button[disabled] { opacity: .35; pointer-events: none; }
  .glass { background: rgba(255,255,255, var(--glass)); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); }
  .glass.main { background: rgba(255,255,255, calc(var(--glass) * 2.2)); }

  /* Today: the week. Seven circles whose outer edges sit on the text edges. */
  .week { display: flex; margin: 0 -4px; } .day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--s); }
  .day .dot { width: calc(100% - 8px); aspect-ratio: 1; border-radius: 50%; background: var(--fill); display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .25s, color .25s; }
  .day.on .l { color: var(--text); }

  /* Progress and You */
  .grid12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--s); } .wk { display: flex; flex-direction: column; gap: var(--s); }
  .wk i { width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); } .wk i.on { background: var(--on); }
  .line { display: block; overflow: visible; } .rise .line path { stroke-dasharray: 1; animation: draw .9s cubic-bezier(.23, 1, .32, 1) backwards .15s; }
  @keyframes draw { from { stroke-dashoffset: 1; } }
  .phases { display: flex; gap: var(--s); } .ph { display: flex; flex-direction: column; gap: var(--s); min-width: 0; } .ph i { height: var(--s); border-radius: 99px; background: var(--fill); } .ph.on i { background: var(--on); }
  .ph.on .l { color: var(--text); }

  /* The dock: everything that floats, in one row at the bottom. Tabs or arrows on the left, the main action on the right. */
  .dock { position: absolute; left: var(--m); right: var(--m); bottom: calc(var(--safe-bottom, 0px) + var(--s)); height: var(--big); display: flex; justify-content: space-between; z-index: 9; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .tabs { display: flex; padding: 4px; border-radius: 99px; }
  .tabs button { width: 72px; height: 56px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; line-height: 16px; color: var(--dim); transition: transform .16s, background .2s, color .2s; }
  .tabs button.on { background: rgba(255,255,255,.14); color: var(--text); }
  .act { height: var(--big); min-width: 138px; padding: 0 var(--l); border-radius: 99px; display: grid; place-items: center; white-space: nowrap; transition: transform .16s cubic-bezier(.23, 1, .32, 1); }

  /* The workout covers everything, rising from the plan. */
  .work { position: absolute; inset: 0; z-index: 5; background: #000; opacity: 0; visibility: hidden; transform: translateY(24px) scale(.98); pointer-events: none; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1), visibility 0s .42s; }
  .app.open .work { opacity: 1; visibility: visible; transform: none; pointer-events: auto; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1), visibility 0s; }
  .app.open .pg { visibility: hidden; transition: visibility 0s .42s; }
  .work .body { gap: var(--m); }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .top .pill { padding: 0 var(--m); }
  .inst { display: flex; flex-direction: column; gap: var(--s); }
  .sets { display: flex; gap: var(--s); }
  .tile { flex: 1; min-width: 0; padding: var(--m) var(--l); border-radius: var(--r); background: var(--fill); display: flex; flex-direction: column; gap: var(--s); transition: background .3s, color .3s; }
  .tile .l { white-space: nowrap; } .tile.now { background: var(--on); color: var(--ink); } .tile.now .l { color: var(--ink); } .tile.next .num { opacity: .5; }
  .dial { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--m); }
  .dial .unit { touch-action: none; user-select: none; } [data-scrub] { cursor: ew-resize; }
  .col.rate { gap: var(--m); }
  .after { margin-top: var(--s); }
  .swap { animation: swap .32s cubic-bezier(.23, 1, .32, 1); } @keyframes swap { from { opacity: 0; filter: blur(6px); transform: scale(.98); } }

  /* The sheet: the lit panel of its screen, from the bottom. Its text keeps the same 40 edge. */
  .scrim { position: absolute; inset: 0; z-index: 7; background: rgba(0,0,0,.6); opacity: 0; pointer-events: none; transition: opacity .28s; }
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; max-height: calc(100% - var(--safe-top, 0px) - var(--m)); overflow-y: auto; scrollbar-width: none; border-radius: var(--r) var(--r) 0 0; background: var(--card), #0B0B10;
    padding: 32px 40px calc(var(--safe-bottom, 0px) + 96px + var(--l)); display: flex; flex-direction: column; gap: var(--l); transform: translateY(102%); transition: transform .42s cubic-bezier(.32, .72, 0, 1); }
  .app.sheeted .scrim { opacity: 1; pointer-events: auto; } .app.sheeted .sheet { transform: none; }
  .sheet .head { padding: 0; } .sheet .rows { gap: var(--s); } .sheet .val { text-align: right; white-space: nowrap; }
  .app.now-anim .work, .app.now-anim .sheet, .app.now-anim .scrim, .app.now-anim .pg { transition: none; }

  .rise > * { animation: rise .5s cubic-bezier(.23, 1, .32, 1) backwards; } .rise > :nth-child(2) { animation-delay: 60ms; } .rise > :nth-child(3) { animation-delay: 120ms; } .rise > :nth-child(4) { animation-delay: 180ms; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } }
  @media (prefers-reduced-motion: reduce) { .rise > *, .swap, .dots circle, .ground i { animation: none !important; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), work = $('.work .body'), sheet = $('.sheet'), dock = $('.dock');
    let S;
    const fresh = () => ({ tab: 'today', day: 0, week: 1, open: false, ex: 0, sheet: null, panel: '',
      plan: PLAN.map((w) => ({ ...w, items: w.items.map((x) => ({ ...x })) })),
      logs: {}, entry: {}, over: {}, done: {}, t0: {}, t1: {}, restEnd: 0, weights: { 1: 73 },
      rules: { method: 'double', rir: 1, jump: 1, miss: 'repeat', drop: 10, stall: 2, deload: 50 } });
    const key = () => S.week + '.' + S.day;
    const W = () => S.plan[S.day], item = () => W().items[S.ex];
    const dayLogs = (k = key(), d = S.day) => (S.logs[k] ||= S.plan[d].items.map(() => []));
    const sets = () => dayLogs()[S.ex];
    const doneDays = (wk = S.week) => S.done[wk] || [];
    const phase = () => PHASES.find(([, a, b]) => S.week >= a && S.week <= b);
    const resting = () => S.restEnd > Date.now();
    const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

    /* ---------- Progression: what the next session should be, from what was logged and the rules ---------- */
    function sessions(name, skipToday) {
      const out = [];
      for (let wk = 1; wk <= 12; wk++) for (let d = 0; d < 5; d++) {
        const L = S.logs[wk + '.' + d], cur = wk === S.week && d === S.day; if (!L || (skipToday && cur)) continue;
        S.plan[d].items.forEach((x, i) => { if (x.name === name && L[i].length) out.push({ week: wk, cur, sets: L[i] }); });
      }
      return out;
    }
    function suggest(x, ss) {
      const R = S.rules, bw = !x.basis, ov = S.over[x.name]; let g;
      if (!ss.length) g = { w: x.start, r: x.lo, why: x.old ? 'Old number, check it fits' : `Find a weight for ${x.lo} clean reps` };
      else {
        const last = ss[ss.length - 1], L = last.sets, w = Math.max(...L.map((s) => s.w)), reps = clamp(Math.min(...L.map((s) => s.r)), x.lo, x.hi);
        const full = L.length >= x.sets, missed = L.some((s) => s.r < x.lo), topped = full && L.every((s) => s.r >= x.hi);
        const rated = L.filter((s) => s.rir != null), left = rated.length ? rated.reduce((a, s) => a + s.rir, 0) / rated.length : null;
        const score = (s) => Math.max(...s.sets.map((q) => q.w)) * 1000 + s.sets.reduce((a, q) => a + q.r, 0);
        let best = 0; ss.forEach((s, i) => { if (score(s) > score(ss[best])) best = i; });
        const stalled = last.week - ss[best].week, up = bw ? 0 : +(w + x.step * R.jump).toFixed(2), togo = x.sets - L.length;
        if (R.method === 'manual') g = { w, r: reps, why: 'Manual, your call' };
        else if (missed) g = R.miss === 'drop' ? { w: Math.round(w * (1 - R.drop / 100) / (x.step || 1)) * (x.step || 1), r: x.lo, why: `Under ${x.lo} reps, drop ${R.drop}%` } : { w, r: x.lo, why: `Under ${x.lo} reps, repeat` };
        else if (!full) g = { w, r: reps, why: last.cur ? `${togo} ${togo === 1 ? 'set' : 'sets'} to go` : 'Finish every set first' };
        else if (R.method === 'linear') g = { w: up, r: reps, why: bw ? 'Every session, add load' : 'Every session, go up' };
        else if (topped && (left == null || left >= R.rir)) g = { w: up, r: x.lo, why: `All sets hit ${x.hi}, ${bw ? 'add load' : 'go up'}` };
        else if (topped) g = { w, r: x.hi, why: `Hit ${x.hi}, under ${R.rir} left, repeat` };
        else if (stalled >= R.stall) g = { w, r: reps, sets: Math.max(1, Math.round(x.sets * R.deload / 100)), why: `Stalled ${stalled} weeks, deload` };
        else g = { w, r: Math.min(x.hi, reps + 1), why: bw ? 'Add a rep' : 'Same weight, add a rep' };
      }
      if (ov != null && !bw) { g.w = ov; g.why = 'Your number'; g.over = true; }
      return g;
    }
    const say = (x, g) => (g.sets ? g.sets + ' sets, ' : '') + (x.basis ? `${fmt(g.w)} lb × ${g.r}` : `${g.r} reps`);
    const entry = () => (S.entry[key() + '.' + S.ex] ||= (() => { const g = suggest(item(), sessions(item().name, true)); return { w: g.w, r: g.r }; })());

    /* ---------- The dock ---------- */
    const arrows = (i, n) => `<div class="keys"><button class="circ big glass" data-ex="-1" aria-label="Previous" ${i <= 0 ? 'disabled' : ''}>${IC.prev}</button><button class="circ big glass" data-ex="1" aria-label="Next" ${i >= n - 1 ? 'disabled' : ''}>${IC.next}</button></div>`;
    const act = (a, label) => `<button class="act glass main" data-act="${a}">${label}</button>`;
    function drawDock() {
      let left = '<span></span>', main = '';
      if (S.sheet) { if (S.sheet.kind === 'plan') left = arrows(S.sheet.ex, S.plan[S.sheet.day].items.length); main = act('done', 'Done'); }
      else if (S.open) { const all = sets().length >= item().sets, last = S.ex === W().items.length - 1;
        left = arrows(S.ex, W().items.length); main = act('go', resting() ? 'Skip rest' : !all ? 'Log set' : last ? 'Finish' : 'Next'); }
      else {
        left = `<div class="tabs glass">${[['today', 'Today'], ['progress', 'Progress'], ['you', 'You']].map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${IC[k]}${n}</button>`).join('')}</div>`;
        if (S.tab === 'today' && S.day < 5) main = act('start', doneDays().includes(S.day) ? 'Open' : dayLogs().some((l) => l.length) ? 'Resume' : 'Start');
        if (S.tab === 'progress') main = act('weigh', 'Weigh in');
        if (S.tab === 'you') main = act('rules', 'Rules');
      }
      dock.innerHTML = left + main;
    }

    /* ---------- Today, Progress, You ---------- */
    const keys = (attr, k, big, a = IC.minus, b = IC.plus) => `<div class="keys"><button class="circ ${big ? 'big' : ''}" data-${attr}="${k}-" aria-label="Less">${a}</button><button class="circ ${big ? 'big' : ''}" data-${attr}="${k}+" aria-label="More">${b}</button></div>`;
    function drawPage(animate) {
      const w = S.day < 5 ? W() : null, dn = doneDays();
      const pages = {
        today: () => `
          <header class="head"><span class="l">${DAYS[S.day]}</span><h1 class="t">${w ? w.name : 'Rest day'}</h1></header>
          <section class="card close"><div class="row"><span class="l grow">Week ${S.week} of 12</span><span class="l">${phase()[0]}</span></div>
            <div class="unit">${num(dn.length + '/5', true)}<span class="l">workouts</span></div>
            <div class="week">${LETTERS.map((d, i) => `<button class="day ${i === S.day ? 'on' : ''}" data-day="${i}"><span class="dot">${d}</span><span class="l">${dn.includes(i) ? 'Done' : i < 5 ? S.plan[i].day : 'Rest'}</span></button>`).join('')}</div></section>
          ${w ? `<section class="sec"><span class="l">${w.focus}</span><div class="rows">${w.items.map((x, i) => `<button class="row tall" data-plan="${i}"><span class="grow">${x.name}</span><span class="chip">${x.sets} × ${x.lo}–${x.hi}</span></button>`).join('')}</div></section>`
            : `<section class="sec"><span class="l">Recover</span><span>Walk, stretch, sleep</span></section>`}`,
        progress: () => { const wk = Object.keys(S.weights).map(Number), first = S.weights[Math.min(...wk)], now = S.weights[Math.max(...wk)], total = Object.values(S.done).reduce((a, d) => a + d.length, 0);
          const lifts = S.plan.flatMap((p) => p.items).filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i).map((x) => [x, sessions(x.name)]).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
          return `
          <header class="head"><span class="l">Week ${S.week} of 12</span><h1 class="t">Progress</h1></header>
          <section class="card close"><div class="row"><span class="l grow">Weight</span><span class="l">${wk.length} of 12 weeks</span></div>
            <div class="unit">${num(fmt(now), true)}<span class="l">kg</span></div>
            ${line(S.weights)}
            <span class="l">${wk.length > 1 ? `${fmt(now - first).replace('-', '−')} kg since week ${Math.min(...wk)}` : 'One more weigh-in draws the line'}</span></section>
          <section class="sec"><span class="l">Showing up</span>
            <div class="grid12">${Array.from({ length: 12 }, (_, i) => `<div class="wk">${Array.from({ length: 5 }, (_, d) => `<i class="${doneDays(i + 1).includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>
            <div class="row tall"><span class="grow">${dn.length} of 5 this week</span><span class="l">${total} in 12 weeks</span></div></section>
          <section class="sec"><span class="l">Lifts</span><div class="rows">${lifts.map(([x, ss]) => { const L = ss.length ? ss[ss.length - 1].sets : null, b = L && L.reduce((a, s) => (s.w > a.w || (s.w === a.w && s.r > a.r) ? s : a));
            return `<div class="row tall"><span class="grow">${x.name}</span><span class="l">${b ? (x.basis ? fmt(b.w) + ' lb × ' : '') + b.r : x.old ? x.old.split(',')[0].replace(/ per.*/, '') : 'No sets yet'}</span></div>`; }).join('')}</div></section>`; },
        you: () => `
          <header class="head"><span class="l">Push Pull Legs</span><h1 class="t">Eric</h1></header>
          <section class="card"><div class="dial"><div class="col"><span class="l">Week</span><div class="unit">${num(S.week, true)}<span class="l">of 12</span></div></div>${keys('week', '', true)}</div>
            <div class="phases">${PHASES.map((p, i) => `<div class="ph ${p === phase() ? 'on' : ''}" style="flex:${p[2] - p[1] + 1}"><i></i><span class="l">${p[1] === p[2] ? p[1] : p[1] + '–' + p[2]}</span></div>`).join('')}</div>
            <div class="col"><span>${phase()[0]}</span><span class="l">${phase()[3]}</span></div></section>
          <section class="sec"><span class="l">Plan</span><div class="rows">
            ${S.plan.map((p, d) => `<button class="row tall" data-planday="${d}"><span class="grow">${p.name}</span><span class="chip">${p.items.reduce((a, x) => a + x.sets, 0)} sets</span></button>`).join('')}
            <button class="row tall" data-act="rules"><span class="grow">Progression</span><span class="chip">${METHODS[S.rules.method][0]}</span></button></div></section>
          <section class="sec"><span class="l">Each day</span><div class="rows">${[['Protein', '130–160 g'], ['Fat', '55–75 g'], ['Steps', '8–10 k'], ['Sleep', '7–9 h']].map(([a, b]) => `<div class="row tall"><span class="grow">${a}</span><span class="l">${b}</span></div>`).join('')}</div></section>
          <section class="sec"><span class="l">Profile</span><div class="rows">${[['Height', '185 cm'], ['Start weight', '73 kg'], ['Goal', 'Muscle up, fat down']].map(([a, b]) => `<div class="row tall"><span class="grow">${a}</span><span class="l">${b}</span></div>`).join('')}</div></section>`,
      };
      pg.innerHTML = pages[S.tab]();
      pg.classList.toggle('rise', !!animate);
      if (animate) pg.scrollTop = 0;
    }

    /* ---------- The workout ---------- */
    function drawWork(swap) {
      const x = item(), done = sets(), e = entry(), rest = resting(), all = done.length >= x.sets, n = Math.max(x.sets, done.length), many = n > 3;
      const kind = S.ex + (rest ? 'rest' : all ? 'done' : 'dial'), moved = swap || kind !== S.panel; S.panel = kind;
      const tiles = Array.from({ length: n }, (_, i) => { const d = done[i], now = i === done.length;
        return `<div class="tile ${now ? 'now' : d ? '' : 'next'}">${num(i + 1)}<span class="l">${d ? (x.basis && !many ? fmt(d.w) + ' × ' : many ? '× ' : '') + d.r : now ? (rest ? 'Next' : 'Now') : many ? x.lo + '+' : x.lo + '–' + x.hi}</span></div>`; }).join('');
      const last = done[done.length - 1];
      const setRow = `<div class="dial"><div class="col"><span class="l">${all ? 'Done' : rest ? 'Next set' : 'Set'}</span><b class="t">${all ? done.length : done.length + 1} of ${n}</b></div>${keys('sets', '', true)}</div>`;
      const rate = last ? `<div class="col rate"><span class="l">Reps left, set ${done.length}</span><div class="keys fill">${[0, 1, 2, 3, 4].map((k) => `<button class="pill ${last.rir === k ? 'on' : ''}" data-rir="${k}">${k === 4 ? '4+' : k}</button>`).join('')}</div></div>` : '';
      const dialRow = (k, label, val, unit) => `<div class="dial"><div class="col"><span class="l">${label}</span><div class="unit" data-scrub="${k}">${num(val, true)}${unit ? `<span class="l">${unit}</span>` : ''}</div></div>${keys('step', k, true)}</div>`;
      const panel = rest ? `${setRow}<div class="dial"><div class="col"><span class="l">Rest</span><div class="unit clock">${num(mmss((S.restEnd - Date.now()) / 1000), true)}</div></div>${keys('rest', '', true, '−15', '+15')}</div>${rate}`
        : all ? `${setRow}<div class="dial"><div class="col"><span class="l">Total reps</span><div class="unit">${num(done.reduce((a, s) => a + s.r, 0), true)}${x.basis ? `<span class="l">at ${fmt(Math.max(...done.map((s) => s.w)))} lb</span>` : ''}</div></div></div>${rate}`
        : `${setRow}${x.basis ? dialRow('w', x.basis, fmt(e.w), 'lb') : ''}${dialRow('r', 'Reps', e.r, x.basis ? '' : 'bodyweight')}`;
      const g = suggest(x, sessions(x.name));
      work.innerHTML = `
        <div class="top"><button class="circ glass" data-act="close" aria-label="Close">${IC.down}</button><span class="pill glass clockup">${mmss(elapsed())}</span></div>
        <header class="head"><span class="l">${W().name}, ${S.ex + 1} of ${W().items.length}</span><h1 class="t">${x.name}</h1></header>
        <div class="inst"><div class="sets">${tiles}</div><section class="card ${moved ? 'swap' : ''}">${panel}</section></div>
        <section class="sec after"><div class="row"><div class="col grow"><span class="l">${done.length ? 'Next time' : 'Today'}</span><span>${say(x, g)}</span><span class="l">${g.why}</span></div><button class="pill" data-act="plan">Plan</button></div></section>`;
      drawDock();
    }
    const elapsed = () => S.t0[key()] ? ((S.t1[key()] || Date.now()) - S.t0[key()]) / 1000 : 0;
    function tick() {
      if (!S.open) return;
      const up = work.querySelector('.clockup'), t = mmss(Math.floor(elapsed())); if (up && up.textContent !== t) up.textContent = t;
      const c = work.querySelector('.clock'); if (!c || !resting()) return;
      const left = mmss((S.restEnd - Date.now()) / 1000); if (c.dataset.t !== left) { c.dataset.t = left; c.closest('.card').classList.remove('swap'); c.innerHTML = num(left, true); }
    }
    const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (S.open && S.restEnd && !resting()) { S.restEnd = 0; drawWork(); } else tick(); }, 250);

    const instant = (fn) => { app.classList.add('now-anim'); fn(); void app.offsetWidth; requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('now-anim'))); };
    const openWork = () => { S.open = true; S.t0[key()] ||= Date.now(); const n = W().items.findIndex((x, i) => dayLogs()[i].length < x.sets); S.ex = n < 0 ? 0 : n; S.panel = ''; drawWork(); app.classList.add('open'); work.scrollTop = 0; };
    const closeWork = () => { S.open = false; S.restEnd = 0; app.classList.remove('open'); drawPage(); drawDock(); };
    function go() {
      const x = item(), last = S.ex === W().items.length - 1;
      if (resting()) { S.restEnd = 0; return drawWork(); }
      if (sets().length >= x.sets) {
        if (last) { (S.done[S.week] ||= []).includes(S.day) || S.done[S.week].push(S.day); S.t1[key()] ||= Date.now(); closeWork(); } else { S.ex++; drawWork(); work.scrollTop = 0; }
        return;
      }
      const e = entry(); if (!sets().length) delete S.over[x.name];
      sets().push({ w: x.basis ? e.w : 0, r: e.r, rir: null });
      if (!(sets().length >= x.sets && last)) S.restEnd = Date.now() + x.rest * 1000;
      drawWork();
    }
    function step(code) { const e = entry(), up = code.endsWith('+') ? 1 : -1; if (code[0] === 'w') e.w = Math.max(0, +(e.w + up * (item().step || 2.5)).toFixed(2)); else e.r = Math.max(1, e.r + up); drawWork(); }

    /* ---------- The sheet: the plan for one exercise, the progression rules, the weigh-in ---------- */
    const srow = (label, val, attr, k, off) => `<div class="row tall ${off ? 'off' : ''}"><span class="grow">${label}</span><span class="val">${val}</span>${keys(attr, k)}</div>`;
    function drawSheet() {
      const s = S.sheet, R = S.rules; if (!s) return;
      if (s.kind === 'plan') { const p = S.plan[s.day], x = p.items[s.ex], g = suggest(x, sessions(x.name));
        sheet.innerHTML = `<header class="head"><span class="l">${p.name}, ${s.ex + 1} of ${p.items.length}</span><h1 class="t">${x.name}</h1></header>
          <div class="rows">
            ${srow('Sets', x.sets, 'p', 'sets')}${srow('Low reps', x.lo, 'p', 'lo')}${srow('High reps', x.hi, 'p', 'hi')}
            ${srow('Step', x.basis ? fmt(x.step) + ' lb' : 'None', 'p', 'step', !x.basis)}${srow('Rest', mmss(x.rest), 'p', 'rest')}
            ${srow('Next time', x.basis ? fmt(g.w) + ' lb' : g.r + ' reps', 'p', 'next', !x.basis)}
            <div class="row tall"><span class="l grow">${g.why}</span>${g.over ? '<button class="pill" data-act="auto">Auto</button>' : '<button class="pill" data-act="rules">Rules</button>'}</div>
          </div>`; }
      if (s.kind === 'rules') { const m = R.method, man = m === 'manual';
        sheet.innerHTML = `<header class="head"><span class="l">Every exercise</span><h1 class="t">Progression</h1></header>
          <div class="col"><div class="keys fill">${Object.entries(METHODS).map(([k, v]) => `<button class="pill ${m === k ? 'on' : ''}" data-method="${k}">${v[0]}</button>`).join('')}</div><span class="l">${METHODS[m][1]}</span></div>
          <div class="rows">
            ${srow('Go up by', R.jump + (R.jump === 1 ? ' step' : ' steps'), 'r', 'jump', man)}
            ${srow('Reps left', R.rir + ' or more', 'r', 'rir', m !== 'double')}
            <div class="row tall ${man ? 'off' : ''}"><span class="grow">Missed set</span><div class="keys pair"><button class="pill ${R.miss === 'repeat' ? 'on' : ''}" data-miss="repeat">Repeat</button><button class="pill ${R.miss === 'drop' ? 'on' : ''}" data-miss="drop">Drop</button></div></div>
            ${srow('Drop by', R.drop + '%', 'r', 'drop', man || R.miss !== 'drop')}
            ${srow('Stall after', R.stall + (R.stall === 1 ? ' week' : ' weeks'), 'r', 'stall', m !== 'double')}
            ${srow('Deload to', R.deload + '% sets', 'r', 'deload', m !== 'double')}
          </div>`; }
      if (s.kind === 'weigh') sheet.innerHTML = `<header class="head"><span class="l">Week ${S.week} of 12</span><h1 class="t">Weigh in</h1></header>
          <div class="dial"><div class="col"><span class="l">This week</span><div class="unit">${num(fmt(S.weights[S.week]), true)}<span class="l">kg</span></div></div>${keys('kg', '', true)}</div>`;
      drawDock();
    }
    const openSheet = (s) => { S.sheet = s; drawSheet(); sheet.scrollTop = 0; app.classList.add('sheeted'); };
    const closeSheet = () => { const back = S.sheet && S.sheet.back; S.sheet = null; if (back) return openSheet(back); app.classList.remove('sheeted'); drawPage(); if (S.open) drawWork(); else drawDock(); };
    const refresh = () => { drawPage(); if (S.open) drawWork(); drawSheet(); };
    function editPlan(code) {
      const s = S.sheet, x = S.plan[s.day].items[s.ex], up = code.endsWith('+') ? 1 : -1, k = code.slice(0, -1);
      if (k === 'sets') x.sets = clamp(x.sets + up, 1, 6);
      if (k === 'lo') x.lo = clamp(x.lo + up, 1, x.hi);
      if (k === 'hi') x.hi = clamp(x.hi + up, x.lo, 30);
      if (k === 'step') x.step = STEPS[clamp(STEPS.indexOf(x.step) + up, 0, STEPS.length - 1)];
      if (k === 'rest') x.rest = clamp(x.rest + up * 15, 15, 600);
      if (k === 'next') S.over[x.name] = Math.max(0, +(suggest(x, sessions(x.name)).w + up * x.step).toFixed(2));
      // An exercise not started yet takes its dial from the plan again.
      Object.keys(S.logs).concat(key()).forEach((lk) => { const d = +lk.split('.')[1]; S.plan[d].items.forEach((y, i) => { if (y.name === x.name && !dayLogs(lk, d)[i].length) delete S.entry[lk + '.' + i]; }); });
      refresh();
    }
    function editRules(code) {
      const R = S.rules, up = code.endsWith('+') ? 1 : -1, k = code.slice(0, -1);
      if (k === 'rir') R.rir = clamp(R.rir + up, 0, 4);
      if (k === 'jump') R.jump = clamp(R.jump + up, 1, 3);
      if (k === 'drop') R.drop = clamp(R.drop + up * 5, 5, 30);
      if (k === 'stall') R.stall = clamp(R.stall + up, 1, 8);
      if (k === 'deload') R.deload = clamp(R.deload + up * 10, 30, 90);
      refresh();
    }

    /* ---------- Hands ---------- */
    app.onclick = (ev) => {
      if (ev.target.classList.contains('scrim')) return closeSheet();
      const b = ev.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.tab) { S.tab = d.tab; drawPage(true); drawDock(); }
      else if (d.day) { S.day = +d.day; drawPage(); drawDock(); }
      else if (d.plan) openSheet({ kind: 'plan', day: S.day, ex: +d.plan });
      else if (d.planday) openSheet({ kind: 'plan', day: +d.planday, ex: 0 });
      else if (d.ex) { if (S.sheet) { S.sheet.ex += +d.ex; drawSheet(); } else { S.ex += +d.ex; drawWork(); work.scrollTop = 0; } }
      else if (d.act === 'start') openWork();
      else if (d.act === 'close') closeWork();
      else if (d.act === 'go') go();
      else if (d.act === 'plan') openSheet({ kind: 'plan', day: S.day, ex: S.ex });
      else if (d.act === 'rules') openSheet({ kind: 'rules', back: S.sheet });
      else if (d.act === 'weigh') { S.weights[S.week] ??= S.weights[Math.max(...Object.keys(S.weights).filter((k) => +k < S.week).map(Number))] ?? 73; openSheet({ kind: 'weigh' }); }
      else if (d.act === 'auto') { const s = S.sheet; delete S.over[S.plan[s.day].items[s.ex].name]; editPlan('none+'); }
      else if (d.act === 'done') closeSheet();
      else if (d.p) editPlan(d.p);
      else if (d.r) editRules(d.r);
      else if (d.method) { S.rules.method = d.method; refresh(); }
      else if (d.miss) { S.rules.miss = d.miss; refresh(); }
      else if (d.kg) { S.weights[S.week] = +(S.weights[S.week] + (d.kg === '+' ? .1 : -.1)).toFixed(1); refresh(); }
      else if (d.week) { S.week = clamp(S.week + (d.week === '+' ? 1 : -1), 1, 12); drawPage(); }
      else if (d.sets) { const x = item(); x.sets = clamp(x.sets + (d.sets === '+' ? 1 : -1), Math.max(1, sets().length), 6); drawWork(); }
      else if (d.step) step(d.step);
      else if (d.rest) { S.restEnd += (d.rest === '+' ? 15 : -15) * 1000; if (!resting()) { S.restEnd = 0; drawWork(); } else tick(); }
      else if (d.rir) { const l = sets()[sets().length - 1]; if (l) l.rir = l.rir === +d.rir ? null : +d.rir; drawWork(); }
    };
    // Drag across a dial number to scrub it, one step every 14px.
    let scrub = null;
    work.onpointerdown = (e) => { const v = e.target.closest('[data-scrub]'); if (!v) return; scrub = { k: v.dataset.scrub, x: e.clientX, n: 0 }; work.setPointerCapture(e.pointerId); };
    work.onpointermove = (e) => { if (!scrub) return; const s = work.getBoundingClientRect().width / work.offsetWidth || 1, n = Math.trunc((e.clientX - scrub.x) / s / 14);
      while (scrub.n < n) { step(scrub.k + '+'); scrub.n++; } while (scrub.n > n) { step(scrub.k + '-'); scrub.n--; } };
    work.onpointerup = work.onpointercancel = () => { scrub = null; };

    /* ---------- The tour: each step sets up what came before at once, then plays its own move. ---------- */
    let tourN = 0;
    const later = (fn, ms = 700) => { const n = tourN; setTimeout(() => { if (n === tourN && root.isConnected) fn(); }, ms); };
    const tap = (sel) => { const b = root.querySelector(sel); if (b) b.click(); };
    const reset = () => { tourN++; S = fresh(); instant(() => { app.classList.remove('open', 'sheeted'); drawPage(); drawDock(); }); };
    const inWork = (setup) => { reset(); if (setup) setup(); instant(openWork); };
    const dialled = () => { S.entry['1.0.0'] = { w: 30, r: 9 }; };
    const one = (rir) => () => { dialled(); S.logs['1.0'] = S.plan[0].items.map(() => []); S.logs['1.0'][0].push({ w: 30, r: 9, rir }); };
    const TOUR = [
      () => reset(),
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 750, 1000, 1250, 1500, 1750].forEach((ms) => later(() => step('w+'), ms)); later(() => step('r+'), 2300); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { one(null)(); S.restEnd = Date.now() + 120000; }); later(() => tap('[data-rest="+"]'), 1000); later(() => tap('[data-rir="2"]'), 2000); },
      () => { inWork(() => { one(2)(); S.restEnd = Date.now() + 40000; }); later(() => go(), 900); },
      () => { inWork(one(2)); later(() => tap('[data-act=plan]'), 600); later(() => tap('[data-p="sets+"]'), 1700); later(() => tap('[data-p="rest+"]'), 2500); },
      () => { inWork(one(2)); instant(() => openSheet({ kind: 'plan', day: 0, ex: 0 })); later(() => tap('[data-act=rules]'), 600); later(() => tap('[data-method=linear]'), 1700); later(() => tap('[data-method=double]'), 2700); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
