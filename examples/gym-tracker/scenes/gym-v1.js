/* Gym Tracker, v1 (Nov 15): the Halo look as a prototype you can use. Today, the workout loop (dial, log, rest,
   rate the set while resting), Progress and You. It follows the native app's system: 8 / 16 / 24 spacing, one
   32 corner, type at 64 / 28 / 17 / 13 in one family, every control 48 tall, white or dark and never coloured,
   one card per screen with the rest on the ground.
   The panel holds what Eric is still choosing: the card (Veil, Tint, Smoke, Lit, and how strong), colour, typeface,
   weight, letter spacing, how far the glow reaches, and dot or plain numbers. */
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
  const p = big ? 7 : 4; let x = 0, c = '';
  for (const ch of String(text)) {
    const g = DOTS[ch] || DOTS[0];
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i + .5) * p}" cy="${(r + .5) * p}" r="${p * .4}" style="animation-delay:${(r + i) * 18}ms"/>`; }));
    x += g[0].length + 1;
  }
  return `<span class="num ${big ? 'big' : ''}" aria-label="${text}"><svg class="dots" width="${(x - 1) * p}" height="${7 * p}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
};
const IC = {
  today: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="1" y="9" width="2.5" height="6" rx="1.2"/><rect x="4.5" y="6" width="3.5" height="12" rx="1.6"/><rect x="9" y="10.6" width="6" height="2.8" rx="1"/><rect x="16" y="6" width="3.5" height="12" rx="1.6"/><rect x="20.5" y="9" width="2.5" height="6" rx="1.2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="2.5" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="8" width="5" height="13" rx="1.6"/><rect x="16.5" y="3" width="5" height="18" rx="1.6"/></svg>',
  you: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};
// Eric's program. Each exercise: name, sets, rep range, what the number means, unit, starting number, step.
const X = (name, sets, lo, hi, basis, start = 0, step = 5, old = '') => ({ name, sets, lo, hi, basis, start, step, old });
const PLAN = [
  { name: 'Push A', day: 'Push', focus: 'Upper chest, shoulder width', items: [X('Incline dumbbell press', 3, 8, 12, 'Per hand'), X('Flat barbell bench press', 3, 6, 10, 'Per side', 45, 2.5, '45 lb per side, 4 × 8'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Seated dumbbell shoulder press', 2, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Rope triceps pushdown', 3, 10, 15, 'Machine')] },
  { name: 'Pull A', day: 'Pull', focus: 'Lat width, upper back', items: [X('Pull-up', 3, 6, 10, ''), X('Chest-supported row', 3, 8, 12, 'Machine'), X('Lat pulldown', 3, 10, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Incline dumbbell curl', 3, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
  { name: 'Legs', day: 'Legs', focus: 'Athletic, proportionate legs', items: [X('Barbell squat', 3, 6, 10, 'Per side', 45, 5, '45 lb per side, 4 × 6'), X('Romanian deadlift', 3, 8, 10, 'Per side'), X('Leg extension', 2, 12, 15, 'Machine', 70, 5, '70 lb'), X('Leg curl', 3, 10, 15, 'Machine', 60, 5, '60 lb, 2 × 10'), X('Standing calf raise', 3, 10, 15, 'Machine'), X('Hanging knee or leg raise', 3, 8, 15, '')] },
  { name: 'Push B', day: 'Push', focus: 'Rounded shoulders, chest definition', items: [X('Seated dumbbell shoulder press', 3, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Incline machine press', 3, 8, 12, 'Machine'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Pec deck fly', 3, 10, 15, 'Machine'), X('Overhead cable triceps extension', 3, 10, 15, 'Machine')] },
  { name: 'Pull B', day: 'Pull', focus: 'V-taper, arms', items: [X('Neutral-grip lat pulldown', 3, 8, 12, 'Machine'), X('Seated cable row', 3, 8, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Preacher curl', 3, 10, 15, 'Machine'), X('Hammer curl', 2, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PHASES = [['Baseline', 1, 3, 'Find working weights. Leave 2 to 3 reps in every set.'], ['Overload', 4, 7, 'Add reps, then weight.'], ['Check', 8, 8, 'Recovering well, carry on. If not, halve the sets.'], ['Consolidate', 9, 12, 'Keep progressing. Compare photos and waist.']];
// The weight line: the weigh-ins as points joined by a line, drawn left to right. One point is a dot waiting for a second.
const line = (v) => {
  const w = 306, h = 72, lo = Math.min(...v) - .6, hi = Math.max(...v) + .6;
  const pt = (x, i) => [v.length > 1 ? 6 + i * (w - 12) / 11 : 6, h - 8 - (x - lo) / (hi - lo) * (h - 16)];
  const P = v.map(pt), d = P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" fill="none" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<circle cx="${6 + i * (w - 12) / 11}" cy="${h - 3}" r="1.5" fill="currentColor" opacity=".3"/>`).join('')}
    <path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>${P.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === P.length - 1 ? 4.5 : 3}" fill="currentColor" style="animation-delay:${i * 60}ms"/>`).join('')}</svg>`;
};

SCENES.push({
  id: 'gym-v1',
  title: 'Gym Tracker',
  version: 'v1',
  size: [402, 874],
  note: 'Halo, as a prototype: Today, the workout loop with the rest timer, Progress, You. The panel has the open choices.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Card', type: 'seg', options: [['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'lit', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['ember', 'Ember'], ['cobalt', 'Cobalt'], ['moss', 'Moss'], ['gold', 'Gold'], ['graphite', 'Graphite']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 110, step: 1, value: 75, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 32, unit: 'px', css: '--r' },
    { type: 'group', label: 'Type' },
    { key: 'weight', label: 'Weight', type: 'seg', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']], value: 'medium', attr: 'weight' },
    { key: 'track', label: 'Letter spacing', type: 'range', min: -.06, max: .03, step: .002, value: -.012, unit: 'em', css: '--track' },
    { key: 'nums', label: 'Numbers', type: 'seg', options: [['dots', 'Dots'], ['type', 'Type']], value: 'dots', attr: 'nums' },
  ],
  steps: [{ label: 'Today', dur: 1.5 }, { label: 'Start', dur: 2.5 }, { label: 'Dial', dur: 3 }, { label: 'Log set', dur: 2.5 }, { label: 'Rest', dur: 3.5 }, { label: 'Next set', dur: 2.5 }],

  html: `
  <div class="app">
    <div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="grain"></div>
    <main class="pg"></main>
    <nav class="tabs"></nav>
    <section class="work" aria-hidden="true"></section>
  </div>`,

  css: `
  .scene { --s: 8px; --m: 16px; --l: 24px; --tap: 48px; --r: 32px; --card-k: 1; --glow: 75%; --track: -.012em;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Geist", system-ui, sans-serif; --w: 500; --wt: 700;
    --text: #fff; --text2: rgba(255,255,255,.8); --text3: rgba(255,255,255,.6); --fill: rgba(255,255,255,.1); --on: rgba(255,255,255,.92); --ink: #0B0B10;
    background: #000; color: var(--text); font: var(--w) 17px/1.3 var(--font); letter-spacing: var(--track); -webkit-font-smoothing: antialiased; }
  .scene[data-colour=ember] { --base: #1B2550; --c1: #D9541F; --c: #F28A30; --c3: #B8401C; }
  .scene[data-colour=moss] { --base: #0F2A22; --c1: #3F9A3A; --c: #A6C63A; --c3: #1F7A58; }
  .scene[data-colour=gold] { --base: #1E1A14; --c1: #C98A1E; --c: #F2C14A; --c3: #A8641A; }
  .scene[data-colour=graphite] { --base: #1D2233; --c1: #5B6C8F; --c: #8A8FA8; --c3: #4A6480; }
  .scene[data-face=geist] { --font: "Geist", system-ui, sans-serif; }



  .scene[data-weight=regular] { --w: 400; --wt: 500; } .scene[data-weight=bold] { --w: 700; --wt: 700; }
  * { box-sizing: border-box; margin: 0; } button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .app { position: relative; height: 100%; overflow: hidden; }

  /* The ground: black, with the colour glowing down from the top and drifting slowly. */
  .ground { position: absolute; inset: 0; background: linear-gradient(var(--base), color-mix(in srgb, var(--c1) 55%, #000) 60%, #000);
    -webkit-mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); overflow: hidden; }
  .ground i { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .8; animation: drift 26s ease-in-out infinite alternate; }
  .ground .b1 { width: 70%; height: 34%; left: -10%; top: 26%; background: var(--c1); }
  .ground .b2 { width: 60%; height: 30%; left: 30%; top: 14%; background: var(--c); animation-duration: 31s; animation-direction: alternate-reverse; }
  .ground .b3 { width: 55%; height: 36%; left: 55%; top: 34%; background: var(--c3); animation-duration: 37s; }
  @keyframes drift { to { transform: translate(14%, 10%) scale(1.15); } }
  .grain { position: absolute; inset: 0; opacity: .06; mix-blend-mode: soft-light; pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }

  /* Type: four sizes. */
  .t { font-size: 28px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .02em); line-height: 1.15; }
  .l { font-size: 13px; color: var(--text2); } .l3 { font-size: 13px; color: var(--text3); font-variant-numeric: tabular-nums; }
  .num { display: inline-flex; align-items: flex-end; } .num .plain { display: none; font-size: 28px; font-weight: var(--wt); line-height: .9; font-variant-numeric: tabular-nums; }
  .num.big .plain { font-size: 64px; letter-spacing: calc(var(--track) - .03em); }
  .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }
  .dots circle { animation: lit .5s cubic-bezier(.3, 1.4, .5, 1) backwards; transform-box: fill-box; transform-origin: center; }
  @keyframes lit { from { opacity: 0; transform: scale(.4); } }

  /* Screens */
  .pg, .work { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + var(--m)) var(--m) calc(var(--safe-bottom, 0px) + 96px); display: flex; flex-direction: column; gap: var(--s); }
  .pg::-webkit-scrollbar, .work::-webkit-scrollbar { display: none; }
  .pg { -webkit-mask-image: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s))); mask-image: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s))); }
  .head { padding: var(--s) var(--l); display: flex; flex-direction: column; gap: var(--s); }
  .sec { padding: var(--l); display: flex; flex-direction: column; gap: var(--m); }
  .card { border-radius: var(--r); }
  .scene .card { background: linear-gradient(color-mix(in srgb, var(--c) calc(36% * var(--card-k)), transparent), color-mix(in srgb, var(--c) calc(4% * var(--card-k)), transparent)); }
  .scene[data-look=veil] .card { background: rgba(255,255,255, calc(.07 * var(--card-k))); }
  .scene[data-look=tint] .card { background: color-mix(in srgb, var(--c) calc(18% * var(--card-k)), transparent); }
  .scene[data-look=smoke] .card { background: rgba(0,0,0, calc(.46 * var(--card-k))); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s); }
  .row.mid { align-items: center; } .row.end { align-items: flex-end; justify-content: flex-start; }
  .grow { flex: 1; } .right { margin-left: auto; }
  .list { display: flex; flex-direction: column; gap: var(--m); }

  /* Controls: 48 tall, capsule or circle, white when chosen, faint otherwise. */
  .pill { height: var(--tap); padding: 0 var(--l); border-radius: 99px; background: var(--fill); display: inline-grid; place-items: center; white-space: nowrap; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s, color .2s; }
  .pill { flex: none; } .pill.on { background: var(--on); color: var(--ink); } .keys .pill.wide { flex: 1; padding: 0; }
  .pill:active, .day:active .dot, .tile:active, .tabs button:active { transform: scale(.97); }
  .chip { font-size: 13px; padding: var(--s) var(--m); border-radius: 99px; background: var(--fill); }
  .float { background: rgba(40,40,46,.55); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
  .float.on { background: var(--on); box-shadow: none; }
  .week { display: flex; gap: var(--s); } .day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--s); }
  .day .dot { width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .25s, color .25s; }
  .day.on .dot { background: var(--on); color: var(--ink); } .day .l { color: var(--text2); } .day.on .l { color: var(--text); }
  .two { display: flex; } .two > * { flex: 1; }
  .row.tall { min-height: var(--tap); } .list.tight { gap: 0; } .n { display: inline-block; width: var(--l); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--m) var(--l); } .stat { display: flex; flex-direction: column; gap: var(--s); } .stat .row { gap: var(--s); }
  .phases { display: flex; gap: var(--s); } .ph { display: flex; flex-direction: column; gap: var(--s); min-width: 0; } .ph i { height: var(--s); border-radius: 99px; background: var(--fill); } .ph.on i { background: var(--on); }
  .ph .l { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text3); } .ph.on .l { color: var(--text); }
  .grid12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--s); } .wk { display: flex; flex-direction: column; gap: var(--s); align-items: center; }
  .wk i { width: 100%; max-width: 16px; aspect-ratio: 1; border-radius: 50%; background: var(--fill); } .wk i.on { background: var(--on); }
  .line { display: block; overflow: visible; } .line path { stroke-dasharray: 1; animation: draw .9s cubic-bezier(.23, 1, .32, 1) backwards .15s; } .line circle[style] { animation: lit .5s cubic-bezier(.3, 1.4, .5, 1) backwards; transform-box: fill-box; transform-origin: center; }
  @keyframes draw { from { stroke-dashoffset: 1; } }

  /* Tab bar: floating glass. */
  .tabs { position: absolute; left: 50%; bottom: calc(var(--safe-bottom, 0px) + var(--s)); transform: translateX(-50%); display: flex; padding: 4px; border-radius: 99px; z-index: 3; }
  .tabs button { width: 92px; height: 56px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font-size: 11px; font-family: system-ui; letter-spacing: 0; font-weight: 600; transition: transform .16s, background .2s; }
  .tabs button.on { background: rgba(255,255,255,.16); }

  /* The workout covers everything, rising from the plan. */
  .work { z-index: 5; background: #000; padding-bottom: calc(var(--safe-bottom, 0px) + 88px); opacity: 0; transform: translateY(24px) scale(.98); pointer-events: none; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1); }
  .app.open .work { opacity: 1; transform: none; pointer-events: auto; }
  .work .ground { position: absolute; z-index: -1; }
  .top { display: flex; align-items: center; justify-content: space-between; padding-bottom: var(--s); }
  .circ { width: var(--tap); height: var(--tap); border-radius: 50%; display: grid; place-items: center; }
  .prog { display: flex; gap: var(--s); } .prog i { width: var(--s); height: var(--s); border-radius: 99px; background: var(--fill); transition: width .3s cubic-bezier(.23, 1, .32, 1), background .3s; } .prog i.on { width: var(--l); background: #fff; }
  .sets { display: flex; gap: var(--s); }
  .tile { flex: 1; padding: var(--l); border-radius: var(--r); background: var(--fill); display: flex; flex-direction: column; gap: var(--s); align-items: flex-start; transition: background .3s, color .3s, transform .16s; }
  .tile.now { background: var(--on); color: var(--ink); } .tile.now .l { color: var(--ink); } .tile.next { color: var(--text3); } .tile.next .l { color: var(--text3); }
  .dial { display: flex; gap: var(--l); } .col { flex: 1; display: flex; flex-direction: column; gap: var(--s); min-width: 0; }
  .col .val { display: flex; align-items: flex-end; gap: var(--s); height: 49px; touch-action: none; cursor: ew-resize; user-select: none; }
  .keys { display: flex; gap: var(--s); }
  .bar { height: var(--s); border-radius: 99px; background: var(--fill); overflow: hidden; } .bar i { display: block; height: 100%; border-radius: 99px; background: var(--on); }
  .foot { position: absolute; left: var(--m); right: var(--m); bottom: calc(var(--safe-bottom, 0px) + var(--s)); display: flex; justify-content: space-between; z-index: 6; opacity: 0; pointer-events: none; transition: opacity .25s; }
  .app.open .foot { opacity: 1; pointer-events: auto; }
  .swap { animation: swap .32s cubic-bezier(.23, 1, .32, 1); } @keyframes swap { from { opacity: 0; filter: blur(6px); transform: scale(.98); } }
  .rise > * { animation: rise .5s cubic-bezier(.23, 1, .32, 1) backwards; } .rise > :nth-child(2) { animation-delay: 60ms; } .rise > :nth-child(3) { animation-delay: 120ms; } .rise > :nth-child(4) { animation-delay: 180ms; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px); filter: blur(4px); } }
  @media (prefers-reduced-motion: reduce) { .rise > *, .swap, .dots circle, .ground i { animation: none; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), tabs = $('.tabs'), work = $('.work');
    let S;
    const fresh = () => ({ tab: 'today', day: 0, open: false, ex: 0, logs: PLAN.map((w) => w.items.map(() => [])), entry: {}, restEnd: 0, restLen: 90, waist: null, bar: null, weights: [73], done: [] });
    const W = () => PLAN[S.day], item = () => W().items[S.ex], sets = () => S.logs[S.day][S.ex];
    const entry = () => (S.entry[S.day + '.' + S.ex] ||= { w: item().start, r: item().lo });
    const resting = () => S.restEnd > Date.now();
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

    /* ---------- Tabs ---------- */
    function drawTabs() {
      tabs.className = 'tabs float';
      tabs.innerHTML = [['today', 'Today'], ['progress', 'Progress'], ['you', 'You']].map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${IC[k]}${n}</button>`).join('');
    }
    function drawPage(animate) {
      const w = S.day < 5 ? W() : null;
      const week = `<div class="week">${LETTERS.map((d, i) => `<button class="day ${i === S.day ? 'on' : ''}" data-day="${i}"><span class="dot">${d}</span><span class="l">${S.done.includes(i) ? 'Done' : i < 5 ? PLAN[i].day : 'Rest'}</span></button>`).join('')}</div>`;
      const pages = {
        today: () => `
          <header class="head"><span class="l3">${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][S.day]}</span><h1 class="t">${w ? w.name : 'Rest day'}</h1></header>
          <section class="sec card"><div class="row mid"><span class="l">Week 1 of 12</span><span class="chip">Baseline</span></div>
            <div class="row end">${num(S.done.length + '/5', true)}<span class="l">workouts</span></div>${week}</section>
          ${w ? `<section class="sec"><span class="l">${w.focus}</span><div class="list">${w.items.map((x) => `<div class="row"><span>${x.name}</span><span class="l3">${x.sets} × ${x.lo}–${x.hi}</span></div>`).join('')}</div>
            <div class="row"><span class="right"></span><button class="pill on" data-act="start">${S.logs[S.day].some((l) => l.length) ? 'Resume' : 'Start'}</button></div></section>`
            : '<section class="sec"><span>Walk, stretch, sleep.</span><span class="l">Next: Push A, Monday</span></section>'}
          <section class="two"><div class="sec"><span class="l">Weight</span><div class="row end" style="height:var(--tap)">${num(73)}<span class="l">kg</span></div></div>
            <div class="sec"><span class="l">Waist</span><div class="row end" style="height:var(--tap)">${S.waist ? num(S.waist) + '<span class="l">cm</span>' : '<button class="pill" data-act="waist">Add</button>'}</div></div></section>`,
        progress: () => `
          <header class="head"><span class="l3">Week 1 of 12</span><h1 class="t">Progress</h1></header>
          <section class="sec card"><div class="row mid"><span class="l">Weight</span><span class="chip">${S.weights.length} of 12 weeks</span></div>
            <div class="row end">${num(S.weights[S.weights.length - 1], true)}<span class="l">kg</span></div>
            ${line(S.weights)}
            <div class="row mid"><span class="l3">${S.weights.length > 1 ? `${(S.weights[S.weights.length - 1] - S.weights[0]).toFixed(1).replace('-', '−')} kg since week 1` : 'One more weigh-in draws the line'}</span><button class="pill" data-act="weigh">Add</button></div></section>
          <section class="sec"><span class="l">Showing up</span>
            <div class="grid12">${Array.from({ length: 12 }, (_, wk) => `<div class="wk">${Array.from({ length: 5 }, (_, d) => `<i class="${wk === 0 && S.done.includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>
            <div class="row"><span>${S.done.length} of 5 this week</span><span class="l3">Week 1 of 12</span></div></section>
          <section class="sec"><span class="l">Lifts</span><div class="list">${PLAN.flatMap((p, d) => p.items.map((x, i) => [x, S.logs[d][i]])).filter(([x], i, a) => a.findIndex(([y]) => y.name === x.name) === i)
            .sort((a, b) => b[1].length - a[1].length).slice(0, 10)
            .map(([x, l]) => `<div class="row"><span>${x.name}</span><span class="l3">${l.length ? (x.basis ? l[l.length - 1].w + ' × ' : '') + l[l.length - 1].r : x.old ? 'Old: ' + x.old.split(',')[0] : 'No sets yet'}</span></div>`).join('')}</div></section>`,
        // You: where the 12 weeks stand (the one card), then what the plan asks of each day, the body numbers
        // (blanks are things to add, not "Not set"), what the training is for, and the data.
        you: () => `
          <header class="head"><span class="l3">Push Pull Legs Push Pull</span><h1 class="t">Eric</h1></header>
          <section class="sec card"><div class="row mid"><span class="l">12 weeks</span><span class="chip">Week 1</span></div>
            <div class="phases">${PHASES.map(([n, a, b], i) => `<div class="ph ${i === 0 ? 'on' : ''}" style="flex:${b - a + 1}"><i></i><span class="l3">${a === b ? a : a + '–' + b}</span></div>`).join('')}</div>
            <div class="list tight" style="gap:var(--s)"><span>${PHASES[0][0]}</span><span class="l">${PHASES[0][3]}</span></div></section>
          <section class="sec"><span class="l">Each day</span><div class="grid">${[['Protein', '130–160', 'g'], ['Fat', '55–75', 'g'], ['Steps', '8–10', 'k'], ['Sleep', '7–9', 'h']].map(([a, b, u]) => `<div class="stat"><span class="l">${a}</span><span class="row end"><b class="t">${b}</b><span class="l">${u}</span></span></div>`).join('')}</div></section>
          <section class="sec"><span class="l">Body</span><div class="list tight">
            <div class="row mid tall"><span>Height</span><span class="l3">185 cm</span></div>
            <div class="row mid tall"><span>Start weight</span><span class="l3">73 kg</span></div>
            <div class="row mid tall"><span>Waist</span>${S.waist ? `<span class="l3">${S.waist} cm</span>` : '<button class="pill" data-act="waist">Add</button>'}</div>
            <div class="row mid tall"><span>Bar</span>${S.bar ? `<span class="l3">${S.bar} lb</span>` : '<button class="pill" data-act="bar">Add</button>'}</div></div></section>
          <section class="sec"><span class="l">Building, in order</span><div class="list">${['Side and rear delts', 'Lats and upper back', 'Abs', 'Upper chest', 'Arms', 'Legs'].map((p, i) => `<div class="row"><span><span class="l3 n">${i + 1}</span>${p}</span></div>`).join('')}</div></section>
          <section class="sec"><span class="l">Data</span><div class="keys"><button class="pill wide">Export</button><button class="pill wide">Start blank</button></div></section>`,
      };
      pg.innerHTML = pages[S.tab]();
      pg.classList.toggle('rise', !!animate);
      if (animate) pg.scrollTop = 0;
    }

    /* ---------- Workout ---------- */
    function drawWork(swap) {
      const x = item(), done = sets(), e = entry(), rest = resting(), all = done.length >= x.sets, last = S.ex === W().items.length - 1;
      const tiles = Array.from({ length: Math.max(x.sets, done.length) }, (_, i) => { const d = done[i], now = i === done.length;
        return `<div class="tile ${now ? 'now' : d ? '' : 'next'}">${num(i + 1)}<span class="l">${d ? (x.basis ? d.w + ' × ' : '') + d.r : now ? 'Now' : 'Next'}</span></div>`; }).join('');
      const col = (k, label, val, unit) => `<div class="col"><span class="l">${label}</span><div class="val" data-scrub="${k}">${num(val, true)}${unit ? `<span class="l">${unit}</span>` : ''}</div>
        <div class="keys"><button class="pill wide" data-step="${k}-">−</button><button class="pill wide" data-step="${k}+">+</button></div></div>`;
      const dial = `<div class="dial">${x.basis ? col('w', x.basis, e.w, 'lb') : ''}${col('r', 'Reps', e.r, x.basis ? '' : 'bodyweight')}</div>`;
      const lastSet = done[done.length - 1];
      const restPanel = `<span class="l">Rest</span><div class="clock">${num(mmss((S.restEnd - Date.now()) / 1000), true)}</div><div class="bar"><i></i></div>
        <div class="keys"><button class="pill wide" data-rest="-15">−15</button><button class="pill wide" data-rest="15">+15</button></div>
        ${lastSet ? `<span class="l">Reps left in that set</span><div class="keys">${[0, 1, 2, 3, 4].map((n) => `<button class="pill wide ${lastSet.rir === n ? 'on' : ''}" data-rir="${n}">${n === 4 ? '4+' : n}</button>`).join('')}</div>` : ''}`;
      work.innerHTML = `<div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
        <div class="top"><button class="circ float" data-act="close" aria-label="Close">${IC.down}</button><div class="prog">${W().items.map((_, i) => `<i class="${i === S.ex ? 'on' : ''}"></i>`).join('')}</div><span class="pill float" style="padding:0 var(--m)">12:40</span></div>
        <header class="head"><h1 class="t">${x.name}</h1><span class="l">${x.lo}–${x.hi} reps</span></header>
        <div class="sets">${tiles}</div>
        <section class="sec card ${swap ? 'swap' : ''}">${rest ? restPanel : dial}</section>
        <section class="sec" style="gap:var(--s)">${x.old ? `<div class="row"><span class="l">Old number</span><span class="l3">July 27</span></div><span>${x.old}</span>` : ''}<span class="l3">${x.old ? 'Old number, check it still fits' : `Find a weight for ${x.lo} clean reps`}</span></section>`;
      foot.innerHTML = rest ? '<span></span><button class="pill float" data-act="skip">Skip rest</button>'
        : `${all ? '<span></span>' : '<button class="pill float" data-act="rest">Rest</button>'}<button class="pill float on" data-act="go">${!all ? 'Log set' : last ? 'Finish' : 'Next'}</button>`;
      tick();
    }
    const foot = document.createElement('div'); foot.className = 'foot'; app.appendChild(foot);
    function tick() {
      if (!S.open || !resting()) return;
      const left = (S.restEnd - Date.now()) / 1000, c = work.querySelector('.clock'), b = work.querySelector('.bar i');
      if (c && c.dataset.t !== mmss(left)) { c.dataset.t = mmss(left); c.innerHTML = num(mmss(left), true); c.querySelectorAll('circle').forEach((d) => d.style.animation = 'none'); }
      if (b) b.style.width = Math.max(2, Math.min(100, left / S.restLen * 100)) + '%';
    }
    const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (S.open && S.restEnd && !resting()) { S.restEnd = 0; drawWork(true); } else tick(); }, 250);

    const openWork = (instant) => { S.open = true; const n = W().items.findIndex((x, i) => S.logs[S.day][i].length < x.sets); S.ex = n < 0 ? 0 : n; drawWork(); if (instant) { work.style.transition = 'none'; requestAnimationFrame(() => work.style.transition = ''); } app.classList.add('open'); work.scrollTop = 0; };
    const closeWork = () => { S.open = false; S.restEnd = 0; app.classList.remove('open'); drawPage(); };
    function go() {
      const x = item();
      if (sets().length >= x.sets) { if (S.ex === W().items.length - 1) { if (!S.done.includes(S.day)) S.done.push(S.day); closeWork(); } else { S.ex++; drawWork(true); work.scrollTop = 0; } return; }
      const e = entry(); sets().push({ w: e.w, r: e.r, rir: null });
      const lastOfAll = sets().length >= x.sets && S.ex === W().items.length - 1;
      if (!lastOfAll) S.restEnd = Date.now() + S.restLen * 1000;
      drawWork(true);
    }
    function step(code) { const e = entry(), up = code.endsWith('+') ? 1 : -1; if (code[0] === 'w') e.w = Math.max(0, e.w + up * item().step); else e.r = Math.max(1, e.r + up); drawWork(); }

    /* ---------- Hands ---------- */
    app.onclick = (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.tab) { S.tab = d.tab; drawTabs(); drawPage(true); }
      else if (d.day) { S.day = +d.day; drawPage(); }
      else if (d.act === 'start') openWork();
      else if (d.act === 'waist') { S.waist = 82; drawPage(); }
      else if (d.act === 'bar') { S.bar = 45; drawPage(); }
      else if (d.act === 'weigh') { if (S.weights.length < 12) S.weights.push(+(S.weights[S.weights.length - 1] - .1 - Math.random() * .3).toFixed(1)); drawPage(); }
      else if (d.act === 'close') closeWork();
      else if (d.act === 'go') go();
      else if (d.act === 'rest') { S.restEnd = Date.now() + S.restLen * 1000; drawWork(true); }
      else if (d.act === 'skip') { S.restEnd = 0; drawWork(true); }
      else if (d.step) step(d.step);
      else if (d.rest) { S.restLen = Math.max(15, S.restLen + +d.rest); S.restEnd += +d.rest * 1000; if (!resting()) { S.restEnd = 0; drawWork(true); } else tick(); }
      else if (d.rir) { const l = sets()[sets().length - 1] || (S.ex > 0 && S.logs[S.day][S.ex - 1].slice(-1)[0]); if (l) l.rir = +d.rir; work.querySelectorAll('[data-rir]').forEach((p) => p.classList.toggle('on', +p.dataset.rir === +d.rir)); }
    };
    // Drag across a big number to scrub it, one step every 14px.
    let scrub = null;
    work.onpointerdown = (e) => { const v = e.target.closest('[data-scrub]'); if (!v) return; scrub = { k: v.dataset.scrub, x: e.clientX, n: 0 }; work.setPointerCapture(e.pointerId); };
    work.onpointermove = (e) => { if (!scrub) return; const s = work.getBoundingClientRect().width / work.offsetWidth || 1, n = Math.trunc((e.clientX - scrub.x) / s / 14);
      while (scrub.n < n) { step(scrub.k + '+'); scrub.n++; } while (scrub.n > n) { step(scrub.k + '-'); scrub.n--; } };
    work.onpointerup = work.onpointercancel = () => { scrub = null; };

    /* ---------- The tour: each step sets up what came before at once, then plays its own move. ---------- */
    let tourN = 0;
    const later = (fn, ms = 700) => { const n = tourN; setTimeout(() => { if (n === tourN && root.isConnected) fn(); }, ms); };
    const reset = () => { tourN++; S = fresh(); app.classList.remove('open'); drawTabs(); drawPage(); };
    const inWork = (setup) => { reset(); if (setup) setup(); openWork(true); };
    const dialled = () => { S.entry['0.0'] = { w: 30, r: 9 }; };
    const TOUR = [
      () => { reset(); drawPage(true); },
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 800, 1100, 1400, 1700, 2000].forEach((ms, i) => later(() => step(i < 6 ? 'w+' : 'r+'), ms)); later(() => step('r+'), 2400); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { dialled(); S.logs[0][0].push({ w: 30, r: 9, rir: null }); S.restEnd = Date.now() + 90000; }); later(() => { S.restLen += 15; S.restEnd += 15000; tick(); }, 1000); later(() => { const b = work.querySelector('[data-rir="2"]'); if (b) b.click(); }, 2000); },
      () => { inWork(() => { dialled(); S.logs[0][0].push({ w: 30, r: 9, rir: 2 }); S.restEnd = Date.now() + 40000; }); later(() => { S.restEnd = 0; drawWork(true); }, 900); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
