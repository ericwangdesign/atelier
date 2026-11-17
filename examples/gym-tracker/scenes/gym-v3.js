/* Gym Tracker, v3 (Nov 15): the Stack version carried forward.
   No cards. Everything sits on the ground between ONE left edge (24) and ONE right edge (378): text, values, the
   week circles, the dial, the dock. The dial and rest clock have a soft borderless halo behind them, nothing more.
   Today is the workout as plain rows: name, sets × range and today's weight, set dots, a disclosure chevron.
   The workout reads top down: name, the set line (the only heavy thing), set dots, the dial (which becomes the
   rest clock), reps left, next time, last time.
   Editing happens one way everywhere: a bottom sheet (the one surface) for an exercise's numbers, for the
   progression rules, and for the weigh-in. Nothing expands in place.
   The bottom row is the same on every screen: a dark glass bar on the left (tabs, or where you are in the
   sequence) and the main action on the right, a brighter glass capsule, 64 tall, always there.
   One stepper everywhere: minus, value, plus, 48 circles. Spacing 8 / 16 / 24 / 32. Type 28 / 17 / 13, regular,
   heavy only for the screen title and the set line and big numbers. Every number is computed from state. */
{
const DOTS = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '00100'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '.': ['0', '0', '0', '0', '0', '0', '1'], ':': ['0', '0', '1', '0', '1', '0', '0'],
};
// A number as lit dots, p pixels per dot: 4 small (inline) or 9 big. The plain text sits beside it, shown instead
// when Numbers is set to Type. dim is for a number that is not set yet.
const BIG = 9;
const num = (text, p = 4, dim = false) => {
  let x = 0, c = '';
  for (const ch of String(text)) {
    // Each digit is as wide as its lit columns, so a 1 does not carry empty space and the first dot sits on the text edge.
    const g = DOTS[ch] || DOTS[0], lit = [...g[0]].map((_, i) => g.some((row) => row[i] === '1')), a = lit.indexOf(true), z = lit.lastIndexOf(true);
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i - a + .4) * p}" cy="${(r + .4) * p}" r="${p * .4}"/>`; }));
    x += z - a + 2;
  }
  return `<span class="num ${p > 4 ? 'big' : ''} ${dim ? 'dim' : ''}" aria-label="${dim ? 'Not set' : text}"><svg class="dots" width="${(x - 1.2) * p}" height="${Math.round(6.8 * p)}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
};
const IC = {
  today: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="1" y="9" width="2.5" height="6" rx="1.2"/><rect x="4.5" y="6" width="3.5" height="12" rx="1.6"/><rect x="9" y="10.6" width="6" height="2.8" rx="1"/><rect x="16" y="6" width="3.5" height="12" rx="1.6"/><rect x="20.5" y="9" width="2.5" height="6" rx="1.2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="2.5" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="8" width="5" height="13" rx="1.6"/><rect x="16.5" y="3" width="5" height="18" rx="1.6"/></svg>',
  you: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
};
// Eric's program. Each exercise: name, sets, rep range, what the number means, starting number, step, old entry.
const X = (name, sets, lo, hi, basis, start = 0, step = 5, old = '') => ({ name, sets, lo, hi, basis, start, step, old });
const PLAN = [
  { name: 'Push A', day: 'Push', focus: 'Upper chest, shoulder width', items: [X('Incline dumbbell press', 3, 8, 12, 'Per hand'), X('Flat barbell bench press', 3, 6, 10, 'Per side', 45, 2.5, '45 lb per side, 4 × 8'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Seated dumbbell shoulder press', 2, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Rope triceps pushdown', 3, 10, 15, 'Machine')] },
  { name: 'Pull A', day: 'Pull', focus: 'Lat width, upper back', items: [X('Pull-up', 3, 6, 10, ''), X('Chest-supported row', 3, 8, 12, 'Machine'), X('Lat pulldown', 3, 10, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Incline dumbbell curl', 3, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
  { name: 'Legs', day: 'Legs', focus: 'Athletic, proportionate legs', items: [X('Barbell squat', 3, 6, 10, 'Per side', 45, 5, '45 lb per side, 4 × 6'), X('Romanian deadlift', 3, 8, 10, 'Per side'), X('Leg extension', 2, 12, 15, 'Machine', 70, 5, '70 lb'), X('Leg curl', 3, 10, 15, 'Machine', 60, 5, '60 lb, 2 × 10'), X('Standing calf raise', 3, 10, 15, 'Machine'), X('Hanging knee or leg raise', 3, 8, 15, '')] },
  { name: 'Push B', day: 'Push', focus: 'Rounded shoulders, chest definition', items: [X('Seated dumbbell shoulder press', 3, 8, 12, 'Per hand', 35, 5, '35 lb per dumbbell, 3 × 12'), X('Incline machine press', 3, 8, 12, 'Machine'), X('Cable lateral raise', 4, 12, 20, 'Machine', 0, 2.5), X('Pec deck fly', 3, 10, 15, 'Machine'), X('Overhead cable triceps extension', 3, 10, 15, 'Machine')] },
  { name: 'Pull B', day: 'Pull', focus: 'V-taper, arms', items: [X('Neutral-grip lat pulldown', 3, 8, 12, 'Machine'), X('Seated cable row', 3, 8, 12, 'Machine'), X('Reverse pec deck', 3, 12, 20, 'Machine'), X('Preacher curl', 3, 10, 15, 'Machine'), X('Hammer curl', 2, 10, 15, 'Per hand', 0, 2.5), X('Weighted cable crunch', 3, 10, 15, 'Machine')] },
];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PHASES = [['Baseline', 1, 3, 'Find working weights. Leave 2 to 3 reps.'], ['Overload', 4, 7, 'Add reps, then weight. Leave 1 to 2.'], ['Check-in', 8, 8, 'Recovering well, carry on. If not, halve the sets.'], ['Consolidate', 9, 12, 'Keep progressing. Compare photos and waist.']];
const STEPS = [1, 2.5, 5, 10];
const f = (n) => String(+(+n).toFixed(1));
const mmss = (s) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
// The weight chart: 12 weeks along the bottom with their numbers, a faint line at the starting weight so one
// weigh-in already reads as a chart, then one point per logged week joined left to right.
const line = (pts) => {
  const w = 354, h = 96, v = pts.map((p) => p[1]), lo = Math.min(...v) - .6, hi = Math.max(...v) + .6;
  const X = (wk) => 4 + (wk - 1) * (w - 8) / 11, Y = (kg) => 52 - (kg - lo) / (hi - lo) * 44;
  const P = pts.map(([wk, kg]) => [X(wk), Y(kg)]), d = P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" fill="none" aria-hidden="true">
    <path d="M0 ${Y(pts[0][1]).toFixed(1)} H${w}" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".16"/>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${X(i + 1)}" cy="66" r="2" fill="currentColor" opacity="${pts.some((p) => p[0] === i + 1) ? 1 : .3}"/><text x="${i === 0 ? 0 : i === 11 ? w : X(i + 1)}" y="92" text-anchor="${i === 0 ? 'start' : i === 11 ? 'end' : 'middle'}" font-size="13" fill="currentColor" opacity=".6">${i + 1}</text>`).join('')}
    <path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"/>`).join('')}</svg>`;
};

SCENES.push({
  id: 'gym-v3',
  title: 'Gym Tracker',
  version: 'v3',
  size: [402, 874],
  note: 'No cards: everything on the ground between 24 and 378, a soft halo behind the dial. One bottom row on every screen (bar left, action right). Editing is a bottom sheet everywhere: an exercise, the rules, the weigh-in. One stepper pattern.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Halo', type: 'seg', options: [['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'lit', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['ember', 'Ember'], ['cobalt', 'Cobalt'], ['moss', 'Moss'], ['gold', 'Gold'], ['graphite', 'Graphite']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 110, step: 1, value: 75, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 32, unit: 'px', css: '--r' },
    { key: 'act', label: 'Main action', type: 'seg', options: [['light', 'Bright glass'], ['dark', 'Dark glass']], value: 'light', attr: 'act' },
    { type: 'group', label: 'Type' },
    { key: 'weight', label: 'Weight', type: 'seg', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']], value: 'regular', attr: 'weight' },
    { key: 'track', label: 'Letter spacing', type: 'range', min: -.06, max: .03, step: .002, value: -.012, unit: 'em', css: '--track' },
    { key: 'nums', label: 'Numbers', type: 'seg', options: [['dots', 'Dots'], ['type', 'Type']], value: 'dots', attr: 'nums' },
  ],
  steps: [{ label: 'Today', dur: 1.5 }, { label: 'Edit the plan', dur: 3.5 }, { label: 'Start', dur: 2.5 }, { label: 'Dial', dur: 3 }, { label: 'Log set', dur: 2.5 }, { label: 'Rest', dur: 3.5 }, { label: 'Next set', dur: 2.5 }, { label: 'Next time', dur: 4 }, { label: 'Rules', dur: 4 }],

  html: `
  <div class="app">
    <div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="grain"></div>
    <main class="pg"></main>
    <section class="work" aria-hidden="true"><div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div><div class="wpg"></div></section>
    <div class="top"></div>
    <div class="scrim"></div>
    <section class="sheet" aria-hidden="true"></section>
    <div class="dock"></div>
  </div>`,

  css: `
  .scene { --s: 8px; --m: 16px; --l: 24px; --x: 32px; --tap: 48px; --r: 32px; --card-k: 1; --glow: 75%; --track: -.012em;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Geist", system-ui, sans-serif; --w: 400; --wt: 700;
    --text: #fff; --text2: rgba(255,255,255,.8); --text3: rgba(255,255,255,.6); --fill: rgba(255,255,255,.1); --on: rgba(255,255,255,.3);
    background: #000; color: var(--text); font: var(--w) 17px/1.3 var(--font); letter-spacing: var(--track); -webkit-font-smoothing: antialiased; }
  .scene[data-colour=ember] { --base: #1B2550; --c1: #D9541F; --c: #F28A30; --c3: #B8401C; }
  .scene[data-colour=moss] { --base: #0F2A22; --c1: #3F9A3A; --c: #A6C63A; --c3: #1F7A58; }
  .scene[data-colour=gold] { --base: #1E1A14; --c1: #C98A1E; --c: #F2C14A; --c3: #A8641A; }
  .scene[data-colour=graphite] { --base: #1D2233; --c1: #5B6C8F; --c: #8A8FA8; --c3: #4A6480; }
  .scene[data-face=geist] { --font: "Geist", system-ui, sans-serif; }



  .scene[data-weight=medium] { --w: 500; } .scene[data-weight=bold] { --w: 700; }
  * { box-sizing: border-box; margin: 0; } button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; -webkit-tap-highlight-color: transparent; }
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

  /* Type: 28 heavy (screen title, the set line), 17 body, 13 label, all regular. Big numbers are dots, or 64 heavy when plain. */
  .t { font-size: 28px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .02em); line-height: 1.15; text-wrap: balance; }
  .l { font-size: 13px; color: var(--text2); } .l3 { font-size: 13px; color: var(--text3); font-variant-numeric: tabular-nums; }
  .b2 { color: var(--text2); font-variant-numeric: tabular-nums; }
  .num { display: inline-flex; flex: none; } .num.dim { opacity: .3; } .num .dots { display: block; overflow: visible; } .num .plain { display: none; font-size: 28px; font-weight: var(--wt); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.big .plain { font-size: 64px; letter-spacing: calc(var(--track) - .03em); line-height: .8; }
  .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }
  /* A line that says something with a big number in it: words sit on the baseline of the dots. */
  .say { display: flex; align-items: baseline; gap: var(--s); min-width: 0; height: 61px; } .scene[data-nums=type] .say { height: 56px; }
  .say .quiet60 { opacity: .6; } .say .strut { width: 0; height: 100%; margin-left: calc(var(--s) * -1); } .say > span:not(.num):not(.t):not(.quiet60) { color: var(--text2); }

  /* Screens. Everything starts at 24 and ends at 378. */
  .pg, .wpg { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + var(--m)) var(--l) calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--l)); display: flex; flex-direction: column; gap: var(--x); }
  .pg::-webkit-scrollbar, .wpg::-webkit-scrollbar, .sheet::-webkit-scrollbar { display: none; }
  /* Content fades out under the status bar and under the bottom row, so nothing readable sits behind the glass. */
  .pg, .wpg { --fade: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s)), #000 calc(100% - var(--safe-bottom, 0px) - 112px), transparent calc(100% - var(--safe-bottom, 0px) - 72px)); -webkit-mask-image: var(--fade); mask-image: var(--fade); }
  .head { display: flex; flex-direction: column; gap: var(--s); }
  .sec { display: flex; flex-direction: column; gap: var(--m); }
  .list { display: flex; flex-direction: column; gap: var(--m); } .list.tight { gap: var(--s); }
  .blk { display: flex; flex-direction: column; gap: var(--m); } .blk.tight { gap: var(--s); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--m); } .row.mid { align-items: center; } .row.end { align-items: flex-end; }
  .row > :first-child { min-width: 0; } .clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Controls: 48, capsule or circle, a faint fill; a brighter fill (never solid white) when chosen. */
  .pill, .circ { height: var(--tap); border-radius: 99px; background: var(--fill); display: inline-grid; place-items: center; flex: none; white-space: nowrap; font-variant-numeric: tabular-nums; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .pill { padding: 0 var(--m); } .circ { width: var(--tap); } .pill.on, .circ.on { background: var(--on); }
  .pill:active, .circ:active, .day:active .dot, .dock button:active { transform: scale(.97); } .exh:active, .rowb:active, .txt:active { opacity: .7; }
  .keys { display: flex; gap: var(--s); } .keys .pill { flex: 1; padding: 0; min-width: 0; }
  .pair { display: flex; gap: var(--s); flex: none; }
  /* The one stepper: minus, value, plus. In a row it fills the control slot, 178 to 378. */
  .slot { width: 200px; flex: none; } .stp { display: flex; align-items: center; } .stp .v { flex: 1; text-align: center; font-variant-numeric: tabular-nums; }
  .line { min-height: var(--tap); }
  .txt { height: var(--tap); padding-left: var(--m); color: var(--text2); display: inline-grid; place-items: center; flex: none; transition: opacity .16s; }
  .glass { background: rgba(30,30,38,.74); -webkit-backdrop-filter: blur(32px) saturate(1.6); backdrop-filter: blur(32px) saturate(1.6); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.06); }
  .chev { display: grid; place-items: center; flex: none; color: var(--text3); }

  /* Today: the week, then the run of exercises as plain rows. */
  .week { display: flex; justify-content: space-between; } .day { width: 44px; display: flex; flex-direction: column; align-items: center; gap: var(--s); }
  .day .dot { width: 44px; height: 44px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .25s; }
  .day.on .dot { background: var(--on); } .day .l { color: var(--text3); white-space: nowrap; } .day.on .l { color: var(--text); }
  .run { display: flex; flex-direction: column; gap: var(--s); }
  .exh { display: block; width: 100%; padding: var(--s) 0; transition: opacity .16s; } .exh > span { display: flex; }
  .tail { display: flex; align-items: center; gap: var(--s); flex: none; }
  .marks { display: flex; gap: var(--s); flex: none; align-items: center; } .marks i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .marks i.on { background: #fff; }

  /* Progress and You */
  .grid12 { display: flex; justify-content: space-between; padding: 0 2px; } .wk { display: flex; flex-direction: column; gap: var(--l); }
  .wk i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .wk i.on { background: #fff; }
  svg.line { display: block; overflow: visible; font-family: var(--font); }
  .phases { display: flex; gap: var(--s); } .ph { display: flex; flex-direction: column; gap: var(--s); min-width: 0; } .ph i { height: var(--s); border-radius: 99px; background: var(--fill); } .ph.on i { background: #fff; }
  .ph .l3 { white-space: nowrap; } .ph.on .l3 { color: var(--text); }
  .rowb { width: 100%; min-height: var(--tap); align-items: center; transition: opacity .16s; }
  [data-scrub] { touch-action: none; cursor: ew-resize; user-select: none; -webkit-user-select: none; }

  /* The bottom row, the same on every screen: a dark glass bar on the left, the main action on the right. */
  .dock { position: absolute; left: var(--l); right: var(--l); bottom: calc(var(--safe-bottom, 0px) + var(--s)); height: 64px; display: flex; justify-content: space-between; z-index: 9; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .bar { width: 218px; flex: none; border-radius: 99px; padding: 4px; display: flex; align-items: center; }
  .bar button { height: 56px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .bar .tab { flex: 1; min-width: 0; } .bar .tab.on { background: rgba(255,255,255,.16); }
  .bar .nav { width: 56px; flex: none; background: rgba(255,255,255,.1); } .bar .nav[disabled] { opacity: .35; pointer-events: none; }
  .where { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s); white-space: nowrap; } .where .marks i.cur { width: var(--m); border-radius: 99px; }
  /* The main action: brighter glass than the bar, white words. */
  .act { width: 128px; flex: none; height: 64px; border-radius: 99px; display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1); background: rgba(255,255,255,.32); -webkit-backdrop-filter: blur(32px) saturate(1.6); backdrop-filter: blur(32px) saturate(1.6); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), inset 0 0 0 1px rgba(255,255,255,.08); }
  .scene[data-act=dark] .act { background: rgba(30,30,38,.74); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.06); }

  /* The workout covers everything, rising from the plan. It reads top down. */
  .work { position: absolute; inset: 0; z-index: 5; background: #000; opacity: 0; transform: translateY(24px) scale(.98); pointer-events: none; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1); }
  .app.open .work { opacity: 1; transform: none; pointer-events: auto; }
  .wpg { padding-top: calc(var(--safe-top, 0px) + var(--s) + var(--tap) + var(--l)); gap: var(--l); }
  .top { position: absolute; left: var(--l); right: var(--l); top: calc(var(--safe-top, 0px) + var(--s)); display: flex; justify-content: space-between; z-index: 6; opacity: 0; pointer-events: none; transition: opacity .25s; }
  .app.open .top { opacity: 1; pointer-events: auto; }
  .dial { display: flex; gap: var(--m); } .col { flex: 1; min-width: 0; }
  .rate { display: flex; justify-content: space-between; }
  /* The halo: a soft glow behind the dial and the rest clock. No edge, no corner; it is not a surface. */
  .core { position: relative; isolation: isolate; } .core::before { content: ''; position: absolute; inset: -48px -24px; z-index: -1; pointer-events: none;
    background: radial-gradient(closest-side ellipse at 42% 50%, color-mix(in srgb, var(--c) calc(46% * var(--card-k)), transparent), transparent); }
  .scene[data-look=tint] .core::before { background: radial-gradient(closest-side ellipse at 50% 50%, color-mix(in srgb, var(--c) calc(28% * var(--card-k)), transparent), transparent); }
  .scene[data-look=veil] .core::before { background: radial-gradient(closest-side ellipse at 42% 50%, rgba(255,255,255, calc(.12 * var(--card-k))), transparent); }
  .scene[data-look=smoke] .core::before { background: radial-gradient(closest-side ellipse at 50% 50%, rgba(0,0,0, calc(.55 * var(--card-k))), transparent); }

  /* The sheet: the one surface. Editing happens here, the same way everywhere. */
  .scrim { position: absolute; inset: 0; z-index: 7; background: rgba(0,0,0,.5); opacity: 0; pointer-events: none; transition: opacity .28s; }
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; max-height: calc(100% - var(--safe-top, 0px) - var(--l)); overflow-y: auto; scrollbar-width: none; background: #17181F; border-radius: var(--r) var(--r) 0 0;
    padding: var(--s) var(--l) calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--l)); display: flex; flex-direction: column; gap: var(--m); transform: translateY(100%); transition: transform .36s cubic-bezier(.32, .72, 0, 1); }
  .app.sheeted .scrim { opacity: 1; pointer-events: auto; } .app.sheeted .sheet { transform: none; }
  /* With a sheet open the bar steps away: only Done stays, so nothing floats over the sheet's rows. */
  .bar { transition: opacity .2s, transform .28s cubic-bezier(.32, .72, 0, 1); } .app.sheeted .bar { opacity: 0; pointer-events: none; transform: translateY(8px); }
  .grab { width: 32px; height: 4px; border-radius: 99px; background: rgba(255,255,255,.3); align-self: center; flex: none; }
  .swap { animation: swap .28s cubic-bezier(.23, 1, .32, 1); } @keyframes swap { from { opacity: 0; transform: translateY(8px); } }
  @media (prefers-reduced-motion: reduce) { .swap, .ground i { animation: none; } .sheet, .scrim, .work { transition: none; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), dock = $('.dock'), work = $('.work'), wpg = $('.wpg'), top = $('.top'), sheet = $('.sheet');
    let S;
    const fresh = () => ({
      tab: 'today', week: 1, day: 0, open: false, ex: 0, sheet: null,
      plan: PLAN.map((w) => ({ ...w, items: w.items.map((x) => ({ ...x, rest: x.lo <= 6 ? 150 : x.lo <= 8 ? 120 : 90 })) })),
      // How progressive overload works. Everything the app suggests is computed from these.
      rules: { method: 'double', top: 'every', left: 1, jump: 1, miss: 'repeat', drop: 10, stall: 2, deload: 50 },
      sess: {}, pin: {}, entry: {}, restEnd: 0, restLen: 0, weights: { 1: 73 }, scale: 73, copied: false,
    });
    const key = () => S.week + '.' + S.day;
    const W = () => S.plan[S.day];
    const sess = (make) => S.sess[key()] || (make ? (S.sess[key()] = { start: 0, end: 0, logs: W().items.map(() => []), need: W().items.map((x) => begin(x).sets || x.sets) }) : null);
    const item = () => W().items[S.ex], sets = () => sess(true).logs[S.ex];
    const done = (i) => (sess() ? sess().logs[i].length : 0);
    const need = (i) => (sess() ? sess().need[i] : begin(W().items[i]).sets || W().items[i].sets);
    const resting = () => S.restEnd > Date.now();
    const snap = (w, step) => (step > 0 ? Math.round(w / step) * step : w);
    const one = (d, x) => (x.basis && d.w ? f(d.w) + ' lb × ' + d.r : d.r + ' reps');

    /* ---------- Progression: the rules, applied ---------- */
    // Every earlier session that logged this exercise, oldest first.
    const hist = (name) => Object.entries(S.sess).map(([k, s]) => { const [wk, d] = k.split('.').map(Number), i = S.plan[d].items.findIndex((x) => x.name === name);
      return i >= 0 && s.logs[i].length && wk * 7 + d < S.week * 7 + S.day ? { at: wk * 7 + d, wk, x: S.plan[d].items[i], sets: s.logs[i], need: s.need[i] } : null; }).filter(Boolean).sort((a, b) => a.at - b.at);
    const steps = () => (S.rules.jump === 1 ? '1 step' : S.rules.jump + ' steps');
    // The rule as one line, with the current numbers.
    function ruleText() {
      const R = S.rules, miss = R.miss === 'repeat' ? 'Miss: repeat.' : `Miss: drop ${R.drop}%.`;
      if (R.method === 'manual') return 'You set every weight. Nothing changes on its own.';
      if (R.method === 'linear') return `Every session: up ${steps()}. ${miss}`;
      return `${R.top === 'every' ? 'Every set' : 'First set'} at top${R.left ? `, ${R.left} left` : ''}: up ${steps()}. ${miss}`;
    }
    // What a session's sets mean for next time: the weight, the reps to aim for, and why.
    function after(x, logged, n, wk, prior) {
      const R = S.rules, w = Math.max(...logged.map((s) => s.w)), amt = x.step * R.jump, up = x.basis ? `up ${f(amt)} lb` : 'add load';
      if (x.basis && !w) return { w: 0, reps: x.lo, tag: 'no weight yet', why: 'No weight logged yet' };
      if (R.method === 'manual') return { w, reps: x.lo, tag: 'manual', why: 'Manual, same as today' };
      if (logged.some((s) => s.r < x.lo)) return R.miss === 'repeat' ? { w, reps: x.lo, tag: 'repeat', why: `A set under ${x.lo}, repeat` } : { w: snap(w * (1 - R.drop / 100), x.step), reps: x.lo, tag: `down ${R.drop}%`, why: `A set under ${x.lo}, drop ${R.drop}%` };
      const sum = (a) => a.reduce((t, s) => t + s.r, 0);
      const marks = [...prior.map((h) => ({ wk: h.wk, w: Math.max(...h.sets.map((s) => s.w)), r: sum(h.sets) })), { wk, w, r: sum(logged) }];
      let best = marks[0]; for (const m of marks.slice(1)) if (m.w > best.w || (m.w === best.w && m.r > best.r)) best = m;
      if (wk - best.wk >= R.stall) { const k = Math.max(1, Math.round(x.sets * R.deload / 100)); return { w, reps: x.lo, sets: k, tag: 'deload', why: `No gain in ${wk - best.wk} weeks, deload to ${k} ${k === 1 ? 'set' : 'sets'}` }; }
      // Going up needs the whole session: until every planned set is in, the weight holds and the line says how far along.
      const part = logged.length < n, wait = (k) => ({ w, reps: x.lo, tag: 'repeat', why: `${k} of ${n} sets in, ${n - logged.length} to go` });
      if (R.method === 'linear') return part ? wait(logged.length) : { w: w + (x.basis ? amt : 0), reps: x.lo, tag: up, why: `Every session, ${up}` };
      const judged = R.top === 'every' ? logged : logged.slice(0, 1), rated = judged.filter((s) => s.rir != null);
      const topped = judged.every((s) => s.r >= x.hi), easy = !R.left || !rated.length || Math.min(...rated.map((s) => s.rir)) >= R.left;
      if (topped && easy) return part ? { w, reps: x.lo, tag: 'repeat', why: `${logged.length} of ${n} sets at ${x.hi}, ${n - logged.length} to go` } : { w: w + (x.basis ? amt : 0), reps: x.lo, tag: up, why: `${R.top === 'every' ? (n === 1 ? 'The set' : `All ${n} sets`) : 'Set 1'} hit ${x.hi}, ${up}` };
      if (topped) return { w, reps: x.hi, tag: 'repeat', why: `Hit ${x.hi}, under ${R.left} left, repeat` };
      return { w, reps: Math.min(x.hi, Math.min(...logged.map((s) => s.r)) + 1), tag: 'one more rep', why: 'Same weight, one more rep' };
    }
    // What to load today: from the last session through the rules, or the old number, or your own override.
    // A weight of 0 means not set yet.
    function begin(x) {
      const h = hist(x.name), last = h[h.length - 1], pin = S.pin[x.name];
      let o = last ? after(last.x, last.sets, last.need, last.wk, h.slice(0, -1))
        : { w: x.start, reps: x.lo, old: !!x.old, tag: !x.basis ? 'bodyweight' : 'no weight yet', why: !x.basis ? `Bodyweight, aim for ${x.lo} to ${x.hi}` : x.old ? 'Last number, check it still fits' : `First time, find ${x.lo} clean reps` };
      if (pin && pin.from !== key()) o = { ...o, old: false, w: pin.w, tag: 'your number', why: 'Your number from last time' };
      return o;
    }
    const entry = () => (S.entry[key() + '.' + S.ex] ||= ((b) => ({ w: b.w, r: b.reps || item().lo }))(begin(item())));
    // The "next time" line for the exercise on screen: what the rule gives, or your override shown against it.
    function nextTime() {
      const x = item(), pin = S.pin[x.name], a = after(x, sets(), need(S.ex), S.week, hist(x.name));
      return pin && pin.from === key() ? { ...a, rule: a.w, w: pin.w, why: `Yours. Rule says ${f(a.w)} lb`, mine: true } : a;
    }

    /* ---------- Small pieces ---------- */
    const stp = (k, label, val) => `<div class="row mid line"><span>${label}</span><span class="stp slot"><button class="circ" data-st="${k}" data-d="-1" aria-label="${label} down">−</button><span class="v">${val}</span><button class="circ" data-st="${k}" data-d="1" aria-label="${label} up">+</button></span></div>`;
    const seg = (k, label, opts) => `<div class="row mid line"><span>${label}</span><span class="keys slot">${opts.map(([v, n]) => `<button class="pill ${S.rules[k] === v ? 'on' : ''}" data-rule="${k}" data-v="${v}">${n}</button>`).join('')}</span></div>`;
    const steppers = (k, label) => `<div class="pair"><button class="circ" data-st="${k}" data-d="-1" aria-label="${label} down">−</button><button class="circ" data-st="${k}" data-d="1" aria-label="${label} up">+</button></div>`;
    const marks = (n, d) => `<span class="marks">${Array.from({ length: n }, (_, i) => `<i class="${i < d ? 'on' : ''}"></i>`).join('')}</span>`;
    const doneDays = (wk) => [0, 1, 2, 3, 4].filter((d) => S.sess[wk + '.' + d] && S.sess[wk + '.' + d].end);
    const phase = () => PHASES.find(([, a, b]) => S.week >= a && S.week <= b);
    // The next workout that has not been done, after the day on screen.
    function nextUp() {
      for (let d = S.day + 1; d < 5; d++) if (!doneDays(S.week).includes(d)) return { week: S.week, day: d };
      if (S.week < 12) for (let d = 0; d < 5; d++) if (!doneDays(S.week + 1).includes(d)) return { week: S.week + 1, day: d };
      return null;
    }
    const meta = (x, i) => { const b = begin(x); return `${need(i)} × ${x.lo}–${x.hi} · ${!x.basis ? b.tag : !b.w ? 'no weight yet' : b.old ? `last ${f(b.w)} lb` : `${f(b.w)} lb, ${b.tag}`}`; };

    /* ---------- The bottom row: tabs or the sequence, and the main action ---------- */
    function action() {
      if (S.sheet) return ['Done', 'done'];
      if (S.open) { const full = sets().length >= need(S.ex), lastEx = S.ex === W().items.length - 1;
        return [resting() ? (full ? 'Next' : 'Skip rest') : !full ? 'Log set' : lastEx ? 'Finish' : 'Next', 'go']; }
      if (S.tab === 'today') { if (W() && !(sess() && sess().end)) return [sess() && sess().start ? 'Resume' : 'Start', 'start']; const n = nextUp(); return n ? [PLAN[n.day].name, 'nextup'] : null; }
      return S.tab === 'progress' ? ['Weigh in', 'weigh'] : ['Rules', 'rules'];
    }
    function drawDock() {
      const a = action(), n = S.open ? W().items.length : 0;
      const bar = S.open
        ? `<button class="nav" data-move="-1" aria-label="Previous exercise" ${S.ex === 0 ? 'disabled' : ''}>${IC.prev}</button><div class="where"><span class="l">Exercise ${S.ex + 1} of ${n}</span><span class="marks">${W().items.map((_, i) => `<i class="${done(i) >= need(i) ? 'on' : ''} ${i === S.ex ? 'cur' : ''}"></i>`).join('')}</span></div><button class="nav" data-move="1" aria-label="Next exercise" ${S.ex === n - 1 ? 'disabled' : ''}>${IC.next}</button>`
        : [['today', 'Today'], ['progress', 'Progress'], ['you', 'You']].map(([k, t]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}">${IC[k]}${t}</button>`).join('');
      dock.innerHTML = `<nav class="bar glass">${bar}</nav>${a ? `<button class="act" data-act="${a[1]}">${a[0]}</button>` : ''}`;
    }

    /* ---------- The sheet ---------- */
    function drawSheet() {
      const k = S.sheet, R = S.rules; app.classList.toggle('sheeted', !!k); if (!k) return;
      const x = k.kind === 'plan' ? W().items[k.i] : null;
      sheet.innerHTML = '<i class="grab"></i>' + (k.kind === 'plan' ? `
        <div><div>${x.name}</div><span class="l3">${meta(x, k.i)}</span></div>
        <div class="list tight">${stp('p.sets', 'Sets', x.sets)}${stp('p.lo', 'Reps from', x.lo)}${stp('p.hi', 'Reps to', x.hi)}${stp('p.step', 'Step', f(x.step) + ' lb')}${stp('p.rest', 'Rest', mmss(x.rest))}</div>`
      : k.kind === 'rules' ? `
        <div><div>Progression</div><span class="l3">${ruleText()}</span></div>
        <div class="blk tight"><span class="l">Method</span><div class="keys">${[['double', 'Double'], ['linear', 'Linear'], ['manual', 'Manual']].map(([v, n]) => `<button class="pill ${R.method === v ? 'on' : ''}" data-rule="method" data-v="${v}">${n}</button>`).join('')}</div></div>
        ${R.method === 'manual' ? '' : `<div class="list tight">
          ${R.method === 'double' ? seg('top', 'Go up when', [['every', 'Every set'], ['first', 'First set']]) + stp('r.left', 'With reps left', R.left ? R.left + ' or more' : 'Any') : ''}
          ${stp('r.jump', 'Go up by', steps())}
          ${seg('miss', 'Missed set', [['repeat', 'Repeat'], ['drop', 'Drop']])}
          ${R.miss === 'drop' ? stp('r.drop', 'Drop by', R.drop + '%') : ''}
          ${stp('r.stall', 'Stall after', R.stall + (R.stall === 1 ? ' week' : ' weeks'))}
          ${stp('r.deload', 'Deload to', R.deload + '% sets')}</div>`}`
      : `
        <div><div>Weigh in</div><span class="l3">${S.weights[S.week] != null ? `Logged ${f(S.weights[S.week])} kg this week` : 'Nothing logged this week'}</span></div>
        <div class="blk"><div class="blk tight"><span class="l">Weight, kg</span><div class="say" data-scrub="kg">${num(S.scale.toFixed(1), BIG)}</div></div>${steppers('kg', 'Weight')}</div>`);
    }
    const openSheet = (k) => { S.sheet = k; sheet.scrollTop = 0; drawSheet(); drawDock(); };
    function closeSheet(save) {
      if (save && S.sheet && S.sheet.kind === 'weigh') S.weights[S.week] = S.scale;
      S.sheet = null; drawSheet(); if (S.open) drawWork(); else { drawPage(); drawDock(); }
    }

    /* ---------- Pages ---------- */
    function drawPage(toTop) {
      const w = W();
      const pages = {
        today: () => {
          const over = sess() && sess().end;
          const total = w ? w.items.reduce((t, _, i) => t + need(i), 0) : 0, mins = w ? Math.round(w.items.reduce((t, x, i) => t + need(i) * (x.rest + 40), 0) / 60) : 0;
          return `
          <header class="head"><span class="l">${DAYS[S.day]}, week ${S.week} of 12</span><h1 class="t">${w ? w.name : 'Rest day'}</h1></header>
          <div class="week">${LETTERS.map((d, i) => `<button class="day ${i === S.day ? 'on' : ''}" data-day="${i}"><span class="dot">${d}</span><span class="l">${doneDays(S.week).includes(i) ? 'Done' : i < 5 ? PLAN[i].day : 'Rest'}</span></button>`).join('')}</div>
          ${w ? `<section class="sec"><div class="row"><span class="l clip">${w.focus}</span><span class="l3">${over ? 'Done, ' : ''}${total} sets, ${mins} min</span></div>
            <div class="run">${w.items.map((x, i) => `<button class="exh" data-edit="${i}">
                <span class="row mid"><span class="clip">${x.name}</span><span class="tail">${marks(need(i), done(i))}<span class="chev">${IC.next}</span></span></span>
                <span class="l3">${meta(x, i)}</span></button>`).join('')}</div></section>`
            : `<section class="sec"><span>Walk, stretch, sleep.</span></section>`}`;
        },
        progress: () => {
          const pts = Object.entries(S.weights).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]), first = pts[0][1], last = pts[pts.length - 1][1], dd = doneDays(S.week).length;
          const all = {}; Object.entries(S.sess).forEach(([k, s]) => { const d = +k.split('.')[1]; s.logs.forEach((l, i) => l.forEach((st) => { const x = S.plan[d].items[i], o = all[x.name]; if (!o || st.w > o.w || (st.w === o.w && st.r > o.r)) all[x.name] = { ...st, x }; })); });
          const olds = S.plan.flatMap((p) => p.items).filter((x, i, a) => x.old && !all[x.name] && a.findIndex((y) => y.name === x.name) === i);
          return `
          <header class="head"><span class="l">Week ${S.week} of 12</span><h1 class="t">Progress</h1></header>
          <section class="sec"><div class="row"><span class="l">Weight, kg</span><span class="l3">${pts.length > 1 ? `${(last - first).toFixed(1).replace('-', '−')} since the start` : `${pts.length} weigh-in`}</span></div>
            <div class="say">${num(last.toFixed(1), BIG)}</div>
            ${line(pts)}</section>
          <section class="sec"><div class="row"><span class="l">Showing up</span><span class="l3">${dd} of 5 so far</span></div>
            <div class="grid12">${Array.from({ length: 12 }, (_, wk) => `<div class="wk">${[0, 1, 2, 3, 4].map((d) => `<i class="${doneDays(wk + 1).includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div></section>
          <section class="sec"><div class="row"><span class="l">Lifts</span><span class="l3">${Object.keys(all).length ? 'Best set' : 'Last numbers'}</span></div><div class="list">
            ${Object.values(all).map((o) => `<div class="row"><span class="clip">${o.x.name}</span><span class="b2">${one(o, o.x)}</span></div>`).join('')}
            ${olds.map((x) => `<div class="row"><span class="clip">${x.name}</span><span class="b2">${x.old.split(',')[0].replace(/ per.*/, '')}</span></div>`).join('')}</div></section>`;
        },
        you: () => {
          const ph = phase();
          return `
          <header class="head"><span class="l">Push Pull Legs Push Pull</span><h1 class="t">Eric</h1></header>
          <section class="sec"><div class="row"><span class="l">12 weeks</span><span class="l3">${ph[0]}</span></div>
            <div class="phases">${PHASES.map(([n, a, b]) => `<div class="ph ${ph[0] === n ? 'on' : ''}" style="flex:${b - a + 1}"><i></i><span class="l3">${a === b ? a : a + '–' + b}</span></div>`).join('')}</div>
            <span>${ph[3]}</span>
            ${stp('wk', 'Week', S.week + ' of 12')}</section>
          <section class="sec"><span class="l">Each day</span><div class="list">${[['Protein', '130–160 g'], ['Fat', '55–75 g'], ['Steps', '8,000–10,000'], ['Sleep', '7–9 h']].map(([a, b]) => `<div class="row"><span>${a}</span><span class="b2">${b}</span></div>`).join('')}</div></section>
          <section class="sec"><span class="l">Body</span><div class="list">
            <div class="row"><span>Height</span><span class="b2">185 cm</span></div><div class="row"><span>Start weight</span><span class="b2">73 kg</span></div>
            <div class="row"><span>Goal</span><span class="b2">Muscle up, fat down</span></div><div class="row"><span>Priority</span><span class="b2">Side and rear delts</span></div></div></section>
          <section class="sec"><span class="l">Data</span><button class="rowb row" data-act="export"><span>Export</span><span class="b2">${S.copied ? 'Copied' : 'Copy'}</span></button></section>`;
        },
      };
      pg.innerHTML = pages[S.tab]();
      if (toTop) pg.scrollTop = 0;
    }

    /* ---------- The workout: one exercise, read top down ---------- */
    function drawWork(swap) {
      const x = item(), s = sets(), n = need(S.ex), e = entry(), rest = resting(), full = s.length >= n, lastEx = S.ex === W().items.length - 1;
      const b = begin(x), blank = x.basis ? '' : '<div class="col"></div>', last = s[s.length - 1], h = hist(x.name), lt = h[h.length - 1], ltw = lt ? Math.max(...lt.sets.map((d) => d.w)) : 0;
      const colTop = (k, label, val, dim) => `<div class="col blk tight"><span class="l">${label}</span><div class="say" data-scrub="${k}">${num(val, BIG, dim)}</div></div>`;
      // The set line is the one heavy thing. While resting it says so, and names the set just finished.
      const setLine = rest ? `<span class="t">Rest</span><span>Set ${s.length} done</span><i class="strut"></i>`
        : full ? `<span class="t">All</span>${num(n, BIG)}<span class="t">done</span>`
        : `<span class="t">Set</span>${num(s.length + 1, BIG)}<span class="t quiet60">of</span><span class="quiet60">${num(n, BIG)}</span>`;
      // The dial and the rest clock share one skeleton: a number row, then the same two circles under it.
      const core = rest ? `<div class="core blk"><div class="blk tight"><span class="l">${full ? (lastEx ? 'Then finish' : `Then ${W().items[S.ex + 1].name}`) : `Then set ${s.length + 1} of ${n}`}</span><div class="clock say">${num(mmss((S.restEnd - Date.now()) / 1000), BIG)}</div></div>
          <div class="pair"><button class="circ" data-rest="-15" aria-label="15 seconds less">−15</button><button class="circ" data-rest="15" aria-label="15 seconds more">+15</button></div></div>`
        : full ? `<div class="blk tight"><span class="l">Lifted</span><div class="list">${s.map((d, i) => `<div class="row"><span>Set ${i + 1}</span><span class="b2">${one(d, x)}${d.rir != null ? `, ${d.rir === 4 ? '4+' : d.rir} left` : ''}</span></div>`).join('')}</div></div>`
        : `<div class="core blk"><div class="dial">${x.basis ? colTop('w', e.w ? `${x.basis}, lb` : 'Set a weight', e.w ? f(e.w) : 0, !e.w) : ''}${colTop('r', `Reps, ${x.lo}–${x.hi}`, e.r)}${blank}</div>
          <div class="dial">${x.basis ? `<div class="col">${steppers('w', 'Weight')}</div>` : ''}<div class="col">${steppers('r', 'Reps')}</div>${blank}</div></div>`;
      // Under it: a hint before the first set; once a set is in, how many reps were left in it.
      const under = !last ? `<span class="l">${b.why}</span>`
        : `<div class="blk tight"><span class="l">Reps left, set ${s.length}</span><div class="rate">${[0, 1, 2, 3, 4].map((k) => `<button class="circ ${last.rir === k ? 'on' : ''}" data-rir="${k}">${k === 4 ? '4+' : k}</button>`).join('')}</div></div>`;
      // Next time appears once there is something to judge. The slot for Reset is always there, so the row never changes height.
      const nx = last ? nextTime() : null;
      const next = !nx ? '' : `<div>${x.basis && (nx.w || nx.mine) ? stp('nx', 'Next time', f(nx.w) + ' lb') : `<div class="row mid line"><span>Next time</span><span class="b2">${x.basis ? 'No weight' : nx.reps + ' reps'}</span></div>`}
          <div class="row mid line"><span class="l3">${nx.why}${nx.sets ? `, ${nx.sets} sets` : ''}</span>${nx.mine ? '<button class="txt" data-act="auto">Reset</button>' : ''}</div></div>`;
      const before = lt ? `<div><div class="row"><span>Last time</span><span class="b2">${x.basis && ltw ? f(ltw) + ' lb, ' : ''}${lt.sets.map((d) => d.r).join(' · ')}</span></div><span class="l3">${DAYS[lt.at - lt.wk * 7]}, week ${lt.wk}</span></div>`
        : x.old ? `<div class="row"><span>Last number</span><span class="b2">${x.old}</span></div>` : '';
      wpg.innerHTML = `
        <div class="blk ${swap === 'ex' ? 'swap' : ''}"><span>${x.name}</span>
          <div class="row end"><span class="say">${setLine}</span><button class="pill" data-act="edit">Edit</button></div>
          <div class="row mid">${marks(n, s.length)}<span class="l3">${s.length ? s.slice(-3).map((d) => one(d, x)).join(', ') : `${x.lo}–${x.hi} reps, rest ${mmss(x.rest)}`}</span></div></div>
        ${core}${under}${next}${before}`;
      top.innerHTML = `<button class="circ glass" data-act="close" aria-label="Close">${IC.down}</button><span class="pill glass clockup">${mmss(elapsed())}</span>`;
      drawDock(); tick();
    }
    const elapsed = () => { const s = sess(); return s && s.start ? ((s.end || Date.now()) - s.start) / 1000 : 0; };
    function tick() {
      if (!S.open) return;
      const up = top.querySelector('.clockup'), t = mmss(Math.floor(elapsed())); if (up && up.textContent !== t) up.textContent = t;
      if (!resting()) return;
      const c = wpg.querySelector('.clock'), left = mmss(Math.ceil((S.restEnd - Date.now()) / 1000));
      if (c && c.dataset.t !== left) { c.dataset.t = left; c.innerHTML = num(left, BIG); }
    }
    const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (S.open && S.restEnd && !resting()) endRest(); else tick(); }, 250);
    const toEx = (n) => { S.ex = n; drawWork('ex'); wpg.scrollTop = 0; };
    // Rest is over (or skipped): if the exercise is finished, the sequence moves on by itself.
    function endRest() { S.restEnd = 0; const full = sets().length >= need(S.ex); if (full && S.ex < W().items.length - 1) toEx(S.ex + 1); else drawWork(true); }

    function openWork(instant) {
      const s = sess(true); if (!s.start) s.start = Date.now();
      const n = W().items.findIndex((_, i) => done(i) < need(i)); S.ex = n < 0 ? 0 : n; S.open = true; S.sheet = null; drawSheet();
      drawWork(); if (instant) { work.style.transition = 'none'; requestAnimationFrame(() => (work.style.transition = '')); }
      app.classList.add('open'); wpg.scrollTop = 0;
      const n2 = tourN; setTimeout(() => { if (S.open && n2 === tourN) pg.style.display = 'none'; }, instant ? 0 : 420);
    }
    function closeWork() { pg.style.display = ''; S.open = false; S.restEnd = 0; S.sheet = null; drawSheet(); app.classList.remove('open'); drawPage(); drawDock(); }
    function finish() {
      const s = sess(); s.end = Date.now();
      // An override made in an earlier session has now been used.
      W().items.forEach((x, i) => { const p = S.pin[x.name]; if (p && p.from !== key() && s.logs[i].length) delete S.pin[x.name]; });
      closeWork();
    }
    function go() {
      const x = item(), s = sets(), n = need(S.ex), lastEx = S.ex === W().items.length - 1;
      if (resting()) return endRest();
      if (s.length >= n) return lastEx ? finish() : toEx(S.ex + 1);
      const e = entry(); s.push({ w: e.w, r: e.r, rir: null });
      if (!(s.length >= n && lastEx)) { S.restLen = x.rest; S.restEnd = Date.now() + x.rest * 1000; }
      drawWork(true);
    }
    function move(d) { const n = Math.min(W().items.length - 1, Math.max(0, S.ex + d)); if (n !== S.ex) toEx(n); }
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    const redraw = () => { drawSheet(); if (S.open) drawWork(); else { drawPage(); drawDock(); } };
    // Every stepper in the app comes through here.
    function bump(k, d) {
      const R = S.rules;
      if (k === 'w' || k === 'r') { const e = entry(); if (k === 'w') e.w = Math.max(0, e.w + d * item().step); else e.r = Math.max(1, e.r + d); return drawWork(); }
      if (k === 'nx') { // Stepping the next-time weight makes it yours; stepping back onto the rule's number hands it back.
        const x = item(), a = after(x, sets(), need(S.ex), S.week, hist(x.name)), p = S.pin[x.name] && S.pin[x.name].from === key() ? S.pin[x.name] : (S.pin[x.name] = { w: a.w, from: key() });
        p.w = Math.max(0, p.w + d * x.step); if (p.w === a.w) delete S.pin[x.name]; return drawWork(); }
      if (k === 'kg') S.scale = +(S.scale + d * .1).toFixed(1);
      else if (k === 'wk') { S.week = cl(S.week + d, 1, 12); const ks = Object.keys(S.weights).map(Number).filter((n) => n <= S.week); S.scale = S.weights[S.week] ?? (ks.length ? S.weights[Math.max(...ks)] : 73); }
      else if (k === 'r.left') R.left = cl(R.left + d, 0, 4);
      else if (k === 'r.jump') R.jump = cl(R.jump + d, 1, 3);
      else if (k === 'r.drop') R.drop = cl(R.drop + d * 5, 5, 30);
      else if (k === 'r.stall') R.stall = cl(R.stall + d, 1, 8);
      else if (k === 'r.deload') R.deload = cl(R.deload + d * 10, 10, 100);
      else if (k[0] === 'p' && S.sheet && S.sheet.kind === 'plan') { const i = S.sheet.i, x = W().items[i], s = sess();
        if (k === 'p.sets') { x.sets = cl(x.sets + d, 1, 8); if (s && !s.end) s.need[i] = Math.max(x.sets, s.logs[i].length); }
        else if (k === 'p.lo') x.lo = cl(x.lo + d, 1, x.hi);
        else if (k === 'p.hi') x.hi = cl(x.hi + d, x.lo, 30);
        else if (k === 'p.step') x.step = STEPS[cl((STEPS.indexOf(x.step) < 0 ? 2 : STEPS.indexOf(x.step)) + d, 0, STEPS.length - 1)];
        else if (k === 'p.rest') x.rest = cl(x.rest + d * 15, 15, 300); }
      redraw();
    }

    /* ---------- Hands ---------- */
    app.onclick = (ev) => {
      if (ev.target.classList.contains('scrim')) return closeSheet(false);
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.tab) { S.tab = d.tab; S.sheet = null; drawSheet(); drawPage(true); drawDock(); }
      else if (d.day) { S.day = +d.day; drawPage(); drawDock(); }
      else if (d.edit) openSheet({ kind: 'plan', i: +d.edit });
      else if (d.st) bump(d.st, +d.d);
      else if (d.rule) { S.rules[d.rule] = d.v; redraw(); }
      else if (d.act === 'start') openWork();
      else if (d.act === 'nextup') { const n = nextUp(); if (n) { S.week = n.week; S.day = n.day; openWork(); } }
      else if (d.act === 'weigh') openSheet({ kind: 'weigh' });
      else if (d.act === 'rules') openSheet({ kind: 'rules' });
      else if (d.act === 'edit') openSheet({ kind: 'plan', i: S.ex });
      else if (d.act === 'done') closeSheet(true);
      else if (d.act === 'export') { const out = JSON.stringify({ plan: S.plan, rules: S.rules, sessions: S.sess, weights: S.weights }, null, 1); try { navigator.clipboard.writeText(out).catch(() => {}); } catch (e) {} S.copied = true; drawPage(); setTimeout(() => { if (root.isConnected) { S.copied = false; if (S.tab === 'you' && !S.open) drawPage(); } }, 1600); }
      else if (d.act === 'close') closeWork();
      else if (d.act === 'go') go();
      else if (d.act === 'auto') { delete S.pin[item().name]; drawWork(); }
      else if (d.move) { S.sheet = null; drawSheet(); move(+d.move); drawDock(); }
      else if (d.rest) { S.restEnd += +d.rest * 1000; if (!resting()) endRest(); else tick(); }
      else if (d.rir) { const s = sets(); if (s.length) { s[s.length - 1].rir = +d.rir; drawWork(); } }
    };
    // Drag across a big number to scrub it (one step every 14px); swipe anywhere else in the workout to move
    // along the sequence.
    let drag = null;
    app.onpointerdown = (e) => {
      const v = e.target.closest('[data-scrub]');
      if (v) { drag = { k: v.dataset.scrub, x: e.clientX, n: 0 }; app.setPointerCapture(e.pointerId); }
      else if (S.open && !S.sheet && !e.target.closest('button')) drag = { swipe: true, x: e.clientX, y: e.clientY };
    };
    app.onpointermove = (e) => { if (!drag || drag.swipe) return; const sc = app.getBoundingClientRect().width / app.offsetWidth || 1, n = Math.trunc((e.clientX - drag.x) / sc / 14);
      while (drag.n < n) { bump(drag.k, 1); drag.n++; } while (drag.n > n) { bump(drag.k, -1); drag.n--; } };
    app.onpointerup = app.onpointercancel = (e) => { if (drag && drag.swipe && S.open) { const sc = app.getBoundingClientRect().width / app.offsetWidth || 1, dx = (e.clientX - drag.x) / sc, dy = (e.clientY - drag.y) / sc; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); } drag = null; };

    /* ---------- The tour: each step sets up what came before at once, then plays its own move. ---------- */
    let tourN = 0;
    const later = (fn, ms = 700) => { const n = tourN; setTimeout(() => { if (n === tourN && root.isConnected) fn(); }, ms); };
    const reset = () => { tourN++; S = fresh(); pg.style.display = ''; app.classList.remove('open'); drawSheet(); drawPage(true); drawDock(); };
    const inWork = (setup) => { reset(); sess(true).start = Date.now(); if (setup) setup(); openWork(true); };
    const dialled = () => { S.entry['1.0.0'] = { w: 30, r: 9 }; };
    const logged = (...sets) => { dialled(); sets.forEach(([r, rir]) => S.sess['1.0'].logs[0].push({ w: 30, r, rir })); };
    const TOUR = [
      () => { reset(); },
      () => { reset(); later(() => openSheet({ kind: 'plan', i: 0 }), 500); later(() => bump('p.sets', 1), 1300); later(() => bump('p.hi', -1), 2000); later(() => bump('p.rest', 1), 2700); },
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 750, 1000, 1250, 1500, 1750].forEach((ms) => later(() => bump('w', 1), ms)); later(() => bump('r', 1), 2300); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { logged([9, null]); S.restLen = 120; S.restEnd = Date.now() + 120000; }); later(() => { S.restEnd += 15000; tick(); }, 1000); later(() => { const b = wpg.querySelector('[data-rir="2"]'); if (b) b.click(); }, 2000); },
      () => { inWork(() => { logged([9, 2]); S.restLen = 120; S.restEnd = Date.now() + 40000; }); later(() => go(), 900); },
      () => { inWork(() => { logged([12, 2], [12, 2], [12, 1]); S.entry['1.0.0'] = { w: 30, r: 12 }; }); S.ex = 0; drawWork(); later(() => bump('nx', 1), 1500); },
      () => { reset(); S.tab = 'you'; drawPage(true); drawDock(); later(() => openSheet({ kind: 'rules' }), 500); later(() => { S.rules.miss = 'drop'; redraw(); }, 1400); later(() => bump('r.left', 1), 2200); later(() => bump('r.stall', 1), 3000); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
