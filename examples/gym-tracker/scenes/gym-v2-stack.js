/* Gym Tracker, v2 stack (Nov 15): the session as a sequence.
   Today is the workout as an ordered run of exercises, each with its sets as counted marks that fill as they are
   done; the next one is the brightest. Press an exercise and its numbers (sets, rep range, step, rest) open as
   steppers in place. Inside the workout one exercise fills the screen: its name, "Set 2 of 3" in dot numbers, the
   dial, and a "next time" line that says the progression rule in plain words and can be overridden.
   The system: text starts on one edge (32), surfaces and glass sit on the margin (16). Spacing is 8 / 16 / 24 / 32.
   Type is 28 / 17 / 13 (64 when numbers are plain type), regular everywhere, one heavier weight for the title and
   the big numbers. One corner for surfaces; controls are capsules and circles, 48 tall. What floats is glass: the
   bar at the bottom (tabs, or where you are in the sequence), the one main action beside it (always bottom right),
   and the top buttons. A surface is used only where a thing is pressed as a whole.
   Every number is computed from state: the elapsed clock runs, counts add up, weights come from the rules in You. */
{
const DOTS = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '.': ['0', '0', '0', '0', '0', '0', '1'], ':': ['0', '0', '1', '0', '1', '0', '0'],
};
// A number as lit dots, p pixels per dot (4 small, 7 big, 12 for the rest clock). The plain text sits beside it,
// shown instead when Numbers is set to Type.
const num = (text, p = 4) => {
  let x = 0, c = '';
  for (const ch of String(text)) {
    // Each digit is as wide as its lit columns, so a 1 does not carry empty space and the first dot sits on the text edge.
    const g = DOTS[ch] || DOTS[0], lit = [...g[0]].map((_, i) => g.some((row) => row[i] === '1')), a = lit.indexOf(true), z = lit.lastIndexOf(true);
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i - a + .4) * p}" cy="${(r + .4) * p}" r="${p * .4}"/>`; }));
    x += z - a + 2;
  }
  return `<span class="num ${p > 4 ? 'big' : ''}" aria-label="${text}"><svg class="dots" width="${(x - 1.2) * p}" height="${Math.round(6.8 * p)}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
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
// The weight line: one point per logged week, joined left to right. The 12 marks under it are the 12 weeks.
const line = (pts) => {
  const w = 338, h = 72, v = pts.map((p) => p[1]), lo = Math.min(...v) - .6, hi = Math.max(...v) + .6;
  const xy = ([wk, kg]) => [4 + (wk - 1) * (w - 8) / 11, h - 16 - (kg - lo) / (hi - lo) * (h - 24)];
  const P = pts.map(xy), d = P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" fill="none" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<circle cx="${4 + i * (w - 8) / 11}" cy="${h - 4}" r="2" fill="currentColor" opacity="${pts.some((p) => p[0] === i + 1) ? 1 : .3}"/>`).join('')}
    <path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"/>`).join('')}</svg>`;
};

SCENES.push({
  id: 'gym-v2-stack',
  title: 'Gym Tracker',
  version: 'v2 stack',
  size: [402, 874],
  note: 'The session as a sequence: Today is the run of exercises with their sets as marks, press one to edit its numbers in place. One exercise fills the workout screen. The rules for going up are in You. Glass bar and one glass action, bottom right, on every screen.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Card', type: 'seg', options: [['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'veil', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['ember', 'Ember'], ['cobalt', 'Cobalt'], ['moss', 'Moss'], ['gold', 'Gold'], ['graphite', 'Graphite']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 110, step: 1, value: 75, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 24, unit: 'px', css: '--r' },
    { key: 'act', label: 'Main action', type: 'seg', options: [['light', 'Light glass'], ['dark', 'Dark glass']], value: 'light', attr: 'act' },
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
    <div class="dock"></div>
  </div>`,

  css: `
  .scene { --s: 8px; --m: 16px; --l: 24px; --x: 32px; --tap: 48px; --r: 24px; --card-k: 1; --glow: 75%; --track: -.012em;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Geist", system-ui, sans-serif; --w: 400; --wt: 700;
    --text: #fff; --text2: rgba(255,255,255,.8); --text3: rgba(255,255,255,.6); --fill: rgba(255,255,255,.1); --on: rgba(255,255,255,.92); --ink: #0B0B10;
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

  /* Type: 28 title (heavier), 17 body, 13 label, all regular. Big numbers are dots, or 64 / 28 heavier when plain. */
  .t { font-size: 28px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .02em); line-height: 1.15; text-wrap: balance; }
  .l { font-size: 13px; color: var(--text2); } .l3 { font-size: 13px; color: var(--text3); font-variant-numeric: tabular-nums; }
  .b2 { color: var(--text2); font-variant-numeric: tabular-nums; }
  .num { display: inline-flex; flex: none; } .num .dots { display: block; overflow: visible; } .num .plain { display: none; font-size: 28px; font-weight: var(--wt); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.big .plain { font-size: 64px; letter-spacing: calc(var(--track) - .03em); line-height: .8; }
  .scene[data-nums=type] .say.h12 { height: 56px; } .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }

  /* Screens. Surfaces sit on the 16 margin; text on the ground is inset to 32, the same edge as text inside a surface. */
  .pg, .wpg { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + var(--m)) var(--m) calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--l)); display: flex; flex-direction: column; gap: var(--x); }
  .pg::-webkit-scrollbar, .wpg::-webkit-scrollbar { display: none; }
  /* Content fades out under the status bar and under the dock, so nothing readable sits behind the glass. */
  .pg, .wpg { --fade: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s)), #000 calc(100% - var(--safe-bottom, 0px) - 80px), transparent calc(100% - var(--safe-bottom, 0px) - 24px)); -webkit-mask-image: var(--fade); mask-image: var(--fade); }
  .in { padding-left: var(--m); padding-right: var(--m); }
  .head { display: flex; flex-direction: column; gap: var(--s); }
  .sec { display: flex; flex-direction: column; gap: var(--m); }
  .list { display: flex; flex-direction: column; gap: var(--m); } .list.tight { gap: var(--s); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--m); } .row.mid { align-items: center; }
  .row > :first-child { min-width: 0; } .clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .grow { flex: 1; min-height: 0; }
  .card { border-radius: var(--r); --e: 1; background: rgba(255,255,255, calc(.07 * var(--card-k) * var(--e))); }
  .card.now { --e: 2; }
  .scene[data-look=tint] .card { background: color-mix(in srgb, var(--c) calc(16% * var(--card-k) * var(--e)), transparent); }
  .scene[data-look=smoke] .card { background: rgba(0,0,0, calc(.4 * var(--card-k) * var(--e))); }
  .scene[data-look=lit] .card { background: linear-gradient(color-mix(in srgb, var(--c) calc(30% * var(--card-k) * var(--e)), transparent), color-mix(in srgb, var(--c) calc(6% * var(--card-k) * var(--e)), transparent)); }

  /* Controls: 48 tall, capsule or circle, white when chosen, faint otherwise. */
  .pill, .circ { height: var(--tap); border-radius: 99px; background: var(--fill); display: inline-grid; place-items: center; flex: none; white-space: nowrap; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s, color .2s; }
  .pill { padding: 0 var(--m); } .circ { width: var(--tap); } .pill.on { background: var(--on); color: var(--ink); }
  .pill:active, .circ:active, .day:active .dot, .exh:active, .nxh:active, .dock button:active { transform: scale(.97); }
  .keys { display: flex; gap: var(--s); } .keys .pill { flex: 1; padding: 0; min-width: 0; }
  .stp { display: flex; align-items: center; flex: none; } .stp .v { width: 88px; text-align: center; font-variant-numeric: tabular-nums; }
  .line { min-height: var(--tap); }
  .glass { background: rgba(30,30,38,.74); -webkit-backdrop-filter: blur(32px) saturate(1.6); backdrop-filter: blur(32px) saturate(1.6); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px rgba(255,255,255,.06); }

  /* Today: the week, then the run of exercises. */
  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--s); } .day { display: flex; flex-direction: column; align-items: center; gap: var(--s); }
  .day .dot { width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .25s, color .25s; }
  .day.on .dot { background: var(--on); color: var(--ink); } .day .l { color: var(--text3); } .day.on .l { color: var(--text); }
  .run { display: flex; flex-direction: column; gap: var(--s); }
  .exh { display: block; width: 100%; padding: var(--m); border-radius: var(--r); transition: transform .16s cubic-bezier(.23, 1, .32, 1); }
  .exh > span { display: flex; } .exh .nm { color: var(--text2); } .card.now .nm, .card.open .nm { color: var(--text); }
  .marks { display: flex; gap: var(--s); flex: none; align-items: center; } .marks i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .marks i.on { background: #fff; }
  .ed { padding: 0 var(--m) var(--m); display: flex; flex-direction: column; gap: var(--s); }

  /* Progress and You */
  .grid12 { display: flex; justify-content: space-between; } .wk { display: flex; flex-direction: column; gap: var(--m); }
  .wk i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .wk i.on { background: #fff; }
  .line-wrap { color: var(--text); } svg.line { display: block; overflow: visible; }
  .phases { display: flex; gap: var(--s); } .ph { display: flex; flex-direction: column; gap: var(--s); min-width: 0; } .ph i { height: var(--s); border-radius: 99px; background: var(--fill); } .ph.on i { background: var(--on); }
  .ph .l3 { white-space: nowrap; } .ph.on .l3 { color: var(--text); }
  .pair { display: flex; gap: var(--s); flex: none; }
  .say { display: flex; align-items: baseline; gap: var(--s); min-width: 0; } .say > span:not(.num):not(.t) { color: var(--text2); } .say > .t { color: var(--text); } .say.h7 { height: 48px; } .say.h12 { height: 82px; }
  .setrow { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--m); }
  [data-scrub] { touch-action: none; cursor: ew-resize; user-select: none; -webkit-user-select: none; }

  /* The dock: a glass bar (tabs, or where you are in the sequence) and the one main action, always bottom right. */
  .dock { position: absolute; left: var(--m); right: var(--m); bottom: calc(var(--safe-bottom, 0px) + var(--s)); height: 64px; display: flex; gap: var(--s); z-index: 6; }
  .bar { flex: 1; min-width: 0; border-radius: 99px; padding: 4px; display: flex; align-items: center; }
  .bar button { height: 56px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .bar .tab { flex: 1; min-width: 0; } .bar .tab.on { background: rgba(255,255,255,.16); }
  .bar .nav { width: 56px; flex: none; background: rgba(255,255,255,.1); } .bar .nav[disabled] { opacity: .35; pointer-events: none; }
  .where { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s); } .where .marks i.cur { width: var(--m); border-radius: 99px; }
  .act { width: 128px; flex: none; height: 64px; border-radius: 99px; display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), opacity .2s; background: linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,.22)), rgba(30,30,38,.6); }
  .scene[data-act=dark] .act { background: rgba(30,30,38,.74); }
  .scene .act[disabled] { color: var(--text3); background: rgba(30,30,38,.74); pointer-events: none; }

  /* The workout covers everything, rising from the plan. One exercise fills it. */
  .work { position: absolute; inset: 0; z-index: 5; background: #000; opacity: 0; transform: translateY(24px) scale(.98); pointer-events: none; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1); }
  .app.open .work { opacity: 1; transform: none; pointer-events: auto; }
  .wpg { padding-top: calc(var(--safe-top, 0px) + var(--s) + var(--tap) + var(--l)); padding-bottom: calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--m)); gap: var(--l); }
  .top { position: absolute; left: var(--m); right: var(--m); top: calc(var(--safe-top, 0px) + var(--s)); display: flex; justify-content: space-between; z-index: 6; opacity: 0; pointer-events: none; transition: opacity .25s; }
  .app.open .top { opacity: 1; pointer-events: auto; } .top .pill { font-variant-numeric: tabular-nums; }
  .grp { display: flex; flex-direction: column; gap: var(--l); } .blk { display: flex; flex-direction: column; gap: var(--m); } .blk.tight { gap: var(--s); }
  .dial { display: flex; gap: var(--m); } .col { flex: 1; min-width: 0; } .col.wide { flex: 1.25; }
  
  .nxh { display: block; width: 100%; padding: var(--m); border-radius: var(--r); transition: transform .16s cubic-bezier(.23, 1, .32, 1); } .nxh > span { display: flex; }
  .swap { animation: swap .28s cubic-bezier(.23, 1, .32, 1); } @keyframes swap { from { opacity: 0; transform: translateY(8px); } }
  @media (prefers-reduced-motion: reduce) { .swap, .ground i { animation: none; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), dock = $('.dock'), work = $('.work'), wpg = $('.wpg'), top = $('.top');
    let S;
    const fresh = () => ({
      tab: 'today', week: 1, day: 0, open: false, ex: 0, edit: -1, over: false, copied: false,
      plan: PLAN.map((w) => ({ ...w, items: w.items.map((x) => ({ ...x, rest: x.lo <= 6 ? 150 : x.lo <= 8 ? 120 : 90 })) })),
      // How progressive overload works. Everything the app suggests is computed from these.
      rules: { method: 'double', top: 'every', left: 1, jump: 1, miss: 'repeat', drop: 10, stall: 2, deload: 50 },
      sess: {}, pin: {}, entry: {}, restEnd: 0, restLen: 0, rated: null, weights: { 1: 73 }, scale: 73,
    });
    const key = () => S.week + '.' + S.day;
    const W = () => S.plan[S.day];
    const sess = (make) => S.sess[key()] || (make ? (S.sess[key()] = { start: 0, end: 0, logs: W().items.map(() => []), need: W().items.map((x) => begin(x).sets || x.sets) }) : null);
    const item = () => W().items[S.ex], sets = () => sess(true).logs[S.ex];
    const done = (i) => (sess() ? sess().logs[i].length : 0);
    const need = (i) => (sess() ? sess().need[i] : begin(W().items[i]).sets || W().items[i].sets);
    const resting = () => S.restEnd > Date.now();
    const snap = (w, step) => (step > 0 ? Math.round(w / step) * step : w);

    /* ---------- Progression: the rules in You, applied ---------- */
    // Every earlier session that logged this exercise, oldest first.
    const hist = (name) => Object.entries(S.sess).map(([k, s]) => { const [wk, d] = k.split('.').map(Number), i = S.plan[d].items.findIndex((x) => x.name === name);
      return i >= 0 && s.logs[i].length && wk * 7 + d < S.week * 7 + S.day ? { at: wk * 7 + d, wk, x: S.plan[d].items[i], sets: s.logs[i], need: s.need[i] } : null; }).filter(Boolean).sort((a, b) => a.at - b.at);
    // The rule for this exercise in a few words, before the sets are in.
    function ruleLine(x, n) {
      const R = S.rules, up = x.basis ? `Up ${f(x.step * R.jump)} lb` : 'Add load';
      if (R.method === 'manual') return 'Manual, you set it';
      if (R.method === 'linear') return `${up} every session`;
      return `${up} when ${R.top === 'every' ? (n === 1 ? 'the set hits' : `all ${n} sets hit`) : 'set 1 hits'} ${x.hi}${R.left ? `, ${R.left} left` : ''}`;
    }
    // What a session's sets mean for next time: the weight, the reps to aim for, and why.
    function after(x, logged, n, wk, prior) {
      const R = S.rules;
      if (logged.length < n) return { pending: true, w: null, why: ruleLine(x, n) };
      const w = Math.max(...logged.map((s) => s.w)), amt = x.step * R.jump, up = x.basis ? `up ${f(amt)} lb` : 'add load';
      if (R.method === 'manual') return { w, reps: x.lo, tag: 'manual', why: 'Manual, same as today' };
      if (logged.some((s) => s.r < x.lo)) return R.miss === 'repeat' ? { w, reps: x.lo, tag: 'repeat', why: `A set under ${x.lo}, repeat` } : { w: snap(w * (1 - R.drop / 100), x.step), reps: x.lo, tag: `down ${R.drop}%`, why: `A set under ${x.lo}, drop ${R.drop}%` };
      const sum = (a) => a.reduce((t, s) => t + s.r, 0);
      const marks = [...prior.map((h) => ({ wk: h.wk, w: Math.max(...h.sets.map((s) => s.w)), r: sum(h.sets) })), { wk, w, r: sum(logged) }];
      let best = marks[0]; for (const m of marks.slice(1)) if (m.w > best.w || (m.w === best.w && m.r > best.r)) best = m;
      if (wk - best.wk >= R.stall) { const k = Math.max(1, Math.round(x.sets * R.deload / 100)); return { w, reps: x.lo, sets: k, tag: 'deload', why: `No gain in ${wk - best.wk} weeks, deload to ${k} ${k === 1 ? 'set' : 'sets'}` }; }
      if (R.method === 'linear') return { w: w + (x.basis ? amt : 0), reps: x.lo, tag: up, why: `Every session, ${up}` };
      const judged = R.top === 'every' ? logged : logged.slice(0, 1), rated = judged.filter((s) => s.rir != null);
      const topped = judged.every((s) => s.r >= x.hi), easy = !R.left || !rated.length || Math.min(...rated.map((s) => s.rir)) >= R.left;
      if (topped && easy) return { w: w + (x.basis ? amt : 0), reps: x.lo, tag: up, why: `${R.top === 'every' ? (n === 1 ? 'The set' : `All ${n} sets`) : 'Set 1'} hit ${x.hi}, ${up}` };
      if (topped) return { w, reps: x.hi, tag: 'repeat', why: `Hit ${x.hi}, under ${R.left} left, repeat` };
      return { w, reps: Math.min(x.hi, Math.min(...logged.map((s) => s.r)) + 1), tag: 'one more rep', why: 'Same weight, one more rep' };
    }
    // What to load today: from the last session through the rules, or the old number, or your own override.
    function begin(x) {
      const h = hist(x.name), last = h[h.length - 1], pin = S.pin[x.name];
      let o = last ? after(last.x, last.sets, last.need, last.wk, h.slice(0, -1)) : { w: x.start, reps: x.lo, tag: x.old ? 'old number' : 'find a weight', why: x.old ? 'Old number' : 'Find a weight' };
      if (o.pending) o = { w: Math.max(...last.sets.map((s) => s.w)), reps: x.lo, tag: 'repeat', why: 'Cut short, repeat' };
      if (pin && pin.from !== key()) o = { ...o, w: pin.w, tag: 'your number', why: 'Your number' };
      return o;
    }
    const entry = () => (S.entry[key() + '.' + S.ex] ||= ((b) => ({ w: b.w, r: b.reps || item().lo }))(begin(item())));
    // The "next time" line for the exercise on screen.
    function nextTime() {
      const x = item(), s = sets(), pin = S.pin[x.name];
      const a = after(x, s, need(S.ex), S.week, hist(x.name));
      return pin && pin.from === key() ? { ...a, pending: false, w: pin.w, why: a.w != null ? `The rule says ${f(a.w)} lb` : 'Your number', mine: true } : a;
    }

    /* ---------- Small pieces ---------- */
    const stp = (k, label, val) => `<div class="row mid line"><span>${label}</span><span class="stp"><button class="circ" data-st="${k}" data-d="-1" aria-label="${label} down">−</button><span class="v">${val}</span><button class="circ" data-st="${k}" data-d="1" aria-label="${label} up">+</button></span></div>`;
    const seg = (k, label, opts) => `<div class="row mid line"><span>${label}</span><span class="pair">${opts.map(([v, n]) => `<button class="pill ${S.rules[k] === v ? 'on' : ''}" data-rule="${k}" data-v="${v}">${n}</button>`).join('')}</span></div>`;
    const marks = (n, d, cur) => `<span class="marks">${Array.from({ length: n }, (_, i) => `<i class="${i < d ? 'on' : ''} ${i === cur ? 'cur' : ''}"></i>`).join('')}</span>`;
    const doneDays = (wk) => [0, 1, 2, 3, 4].filter((d) => S.sess[wk + '.' + d] && S.sess[wk + '.' + d].end);
    const phase = () => PHASES.find(([, a, b]) => S.week >= a && S.week <= b);

    /* ---------- The dock: tabs or the sequence, and the main action ---------- */
    function action() {
      if (S.open) { const full = sets().length >= need(S.ex), lastEx = S.ex === W().items.length - 1;
        return [resting() ? (full ? 'Next' : 'Skip rest') : !full ? 'Log set' : lastEx ? 'Finish' : 'Next', 'go']; }
      if (S.tab === 'today') return !W() ? ['Rest day', ''] : sess() && sess().end ? ['Done', ''] : [sess() && sess().start ? 'Resume' : 'Start', 'start'];
      if (S.tab === 'progress') return S.weights[S.week] === S.scale ? ['Logged', ''] : ['Log weight', 'weigh'];
      return [S.copied ? 'Copied' : 'Export', 'export'];
    }
    function drawDock() {
      const [label, act] = action(), n = S.open ? W().items.length : 0;
      const bar = S.open
        ? `<button class="nav" data-move="-1" aria-label="Previous exercise" ${S.ex === 0 ? 'disabled' : ''}>${IC.prev}</button><div class="where"><span class="l">Exercise ${S.ex + 1} of ${n}</span><span class="marks">${W().items.map((_, i) => `<i class="${done(i) >= need(i) ? 'on' : ''} ${i === S.ex ? 'cur' : ''}"></i>`).join('')}</span></div><button class="nav" data-move="1" aria-label="Next exercise" ${S.ex === n - 1 ? 'disabled' : ''}>${IC.next}</button>`
        : [['today', 'Today'], ['progress', 'Progress'], ['you', 'You']].map(([k, t]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}">${IC[k]}${t}</button>`).join('');
      dock.innerHTML = `<nav class="bar glass">${bar}</nav><button class="act glass" data-act="${act}" ${act ? '' : 'disabled'}>${label}</button>`;
    }

    /* ---------- Pages ---------- */
    function drawPage(toTop) {
      const w = W();
      const pages = {
        today: () => {
          const now = w && !(sess() && sess().end) ? w.items.findIndex((_, i) => done(i) < need(i)) : -1;
          const total = w ? w.items.reduce((t, _, i) => t + need(i), 0) : 0, mins = w ? Math.round(w.items.reduce((t, x, i) => t + need(i) * (x.rest + 40), 0) / 60) : 0;
          return `
          <header class="head in"><span class="l">${DAYS[S.day]}, week ${S.week} of 12</span><h1 class="t">${w ? w.name : 'Rest day'}</h1></header>
          <div class="week">${LETTERS.map((d, i) => `<button class="day ${i === S.day ? 'on' : ''}" data-day="${i}"><span class="dot">${d}</span><span class="l">${doneDays(S.week).includes(i) ? 'Done' : i < 5 ? PLAN[i].day : 'Rest'}</span></button>`).join('')}</div>
          ${w ? `<section class="sec"><div class="row in"><span class="l clip">${w.focus}</span><span class="l3">${total} sets, ${mins} min</span></div>
            <div class="run">${w.items.map((x, i) => { const b = begin(x), open = S.edit === i;
              return `<div class="card ${i === now ? 'now' : ''} ${open ? 'open' : ''}"><button class="exh" data-edit="${i}" aria-expanded="${open}">
                <span class="row mid"><span class="nm clip">${x.name}</span>${marks(need(i), done(i))}</span>
                <span class="l3">${need(i)} × ${x.lo}–${x.hi}${x.basis && b.w ? ` · ${f(b.w)} lb, ${b.tag}` : ` · ${b.tag}`}</span></button>
                ${open ? `<div class="ed">${stp('p.sets', 'Sets', x.sets)}${stp('p.lo', 'Reps from', x.lo)}${stp('p.hi', 'Reps to', x.hi)}${stp('p.step', 'Step', f(x.step) + ' lb')}${stp('p.rest', 'Rest', mmss(x.rest))}</div>` : ''}</div>`; }).join('')}</div></section>`
            : `<section class="sec in"><span>Walk, stretch, sleep.</span><span class="l">Next is ${PLAN[0].name}, Monday</span></section>`}`;
        },
        progress: () => {
          const pts = Object.entries(S.weights).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]), first = pts[0][1], last = pts[pts.length - 1][1], dd = doneDays(S.week).length;
          const all = {}; Object.entries(S.sess).forEach(([k, s]) => { const d = +k.split('.')[1]; s.logs.forEach((l, i) => l.forEach((st) => { const x = S.plan[d].items[i], o = all[x.name]; if (!o || st.w > o.w || (st.w === o.w && st.r > o.r)) all[x.name] = { ...st, x }; })); });
          const olds = S.plan.flatMap((p) => p.items).filter((x, i, a) => x.old && !all[x.name] && a.findIndex((y) => y.name === x.name) === i);
          return `
          <header class="head in"><span class="l">Week ${S.week} of 12</span><h1 class="t">Progress</h1></header>
          <section class="sec in"><div class="row"><span class="l">Weight</span><span class="l3">${pts.length} of 12 weeks</span></div>
            <div class="setrow"><span class="say h7" data-scrub="kg">${num(S.scale.toFixed(1), 7)}<span>kg</span></span><span class="pair"><button class="circ" data-st="kg" data-d="-1" aria-label="Lighter">−</button><button class="circ" data-st="kg" data-d="1" aria-label="Heavier">+</button></span></div>
            <div class="line-wrap">${line(pts)}</div>
            <div class="row"><span class="l3">Week 1</span><span class="l3">${pts.length > 1 ? `${(last - first).toFixed(1).replace('-', '−')} kg since week ${pts[0][0]}` : '12'}</span></div></section>
          <section class="sec in"><div class="row"><span class="l">Showing up</span><span class="l3">${dd} of 5 this week</span></div>
            <div class="grid12">${Array.from({ length: 12 }, (_, wk) => `<div class="wk">${[0, 1, 2, 3, 4].map((d) => `<i class="${doneDays(wk + 1).includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>
            <div class="row"><span class="l3">Week 1</span><span class="l3">12</span></div></section>
          <section class="sec in"><div class="row"><span class="l">Lifts</span><span class="l3">${Object.keys(all).length ? 'Best set' : 'Old numbers'}</span></div><div class="list">
            ${Object.values(all).map((o) => `<div class="row"><span class="clip">${o.x.name}</span><span class="b2">${o.x.basis && o.w ? f(o.w) + ' lb × ' + o.r : o.r + ' reps'}</span></div>`).join('')}
            ${olds.map((x) => `<div class="row"><span class="clip">${x.name}</span><span class="b2">${x.old.split(',')[0].replace(/ per.*/, '')}</span></div>`).join('')}</div></section>`;
        },
        you: () => {
          const R = S.rules, ph = phase();
          return `
          <header class="head in"><span class="l">Push Pull Legs Push Pull</span><h1 class="t">Eric</h1></header>
          <section class="sec in"><div class="row"><span class="l">Going up</span><span class="l3">${{ double: 'Reps first, then weight', linear: 'Weight every session', manual: 'You set every number' }[R.method]}</span></div>
            <div class="keys">${[['double', 'Double'], ['linear', 'Linear'], ['manual', 'Manual']].map(([v, n]) => `<button class="pill ${R.method === v ? 'on' : ''}" data-rule="method" data-v="${v}">${n}</button>`).join('')}</div>
            ${R.method === 'manual' ? '' : `<div class="list tight">
              ${R.method === 'double' ? seg('top', 'At the top', [['every', 'Every set'], ['first', 'Set 1']]) + stp('r.left', 'Reps left', R.left ? R.left + '+' : 'Any') : ''}
              ${stp('r.jump', 'Add', R.jump === 1 ? '1 step' : R.jump + ' steps')}
              ${seg('miss', 'Missed set', [['repeat', 'Repeat'], ['drop', 'Drop']])}
              ${R.miss === 'drop' ? stp('r.drop', 'Drop by', R.drop + '%') : ''}
              ${stp('r.stall', 'Stall after', R.stall + (R.stall === 1 ? ' week' : ' weeks'))}
              ${stp('r.deload', 'Deload sets', R.deload + '%')}</div>`}</section>
          <section class="sec in"><div class="row"><span class="l">12 weeks</span><span class="l3">${ph[0]}, weeks ${ph[1] === ph[2] ? ph[1] : ph[1] + '–' + ph[2]}</span></div>
            <div class="phases">${PHASES.map(([n, a, b]) => `<div class="ph ${ph[0] === n ? 'on' : ''}" style="flex:${b - a + 1}"><i></i><span class="l3">${a === b ? a : a + '–' + b}</span></div>`).join('')}</div>
            <span>${ph[3]}</span>
            ${stp('wk', 'Week', S.week + ' of 12')}</section>
          <section class="sec in"><span class="l">Each day</span><div class="list">${[['Protein', '130–160 g'], ['Fat', '55–75 g'], ['Steps', '8,000–10,000'], ['Sleep', '7–9 h']].map(([a, b]) => `<div class="row"><span>${a}</span><span class="b2">${b}</span></div>`).join('')}</div></section>
          <section class="sec in"><span class="l">Profile</span><div class="list">
            <div class="row"><span>Height</span><span class="b2">185 cm</span></div><div class="row"><span>Start weight</span><span class="b2">73 kg</span></div>
            <div class="row"><span>Goal</span><span class="b2">Muscle up, fat down</span></div><div class="row"><span>Priority</span><span class="b2">Side and rear delts</span></div></div></section>`;
        },
      };
      pg.innerHTML = pages[S.tab]();
      if (toTop) pg.scrollTop = 0;
    }

    /* ---------- The workout: one exercise fills the screen ---------- */
    function drawWork(swap) {
      const x = item(), s = sets(), n = need(S.ex), e = entry(), rest = resting(), full = s.length >= n, nx = nextTime();
      const col = (k, label, val, unit, wide) => `<div class="col blk ${wide ? 'wide' : ''}"><div class="blk tight"><span class="l">${label}</span><div class="val say h7" data-scrub="${k}">${num(val, 7)}${unit ? `<span>${unit}</span>` : ''}</div></div>
        <div class="keys"><button class="pill" data-st="${k}" data-d="-1" aria-label="${label} down">−</button><button class="pill" data-st="${k}" data-d="1" aria-label="${label} up">+</button></div></div>`;
      const dial = `<div class="dial">${x.basis ? col('w', x.basis, f(e.w), 'lb', true) : ''}${col('r', `Reps, ${x.lo}–${x.hi}`, e.r, '')}${x.basis ? '' : '<div class="col"></div>'}</div>`;
      const rt = S.rated && sess().logs[S.rated.ex][S.rated.i];
      const restPanel = `<div class="blk"><div class="blk tight"><span class="l">Rest</span><div class="clock">${num(mmss((S.restEnd - Date.now()) / 1000), 12)}</div></div>
          <div class="keys"><button class="pill" data-rest="-15">−15</button><button class="pill" data-rest="15">+15</button></div></div>
        ${rt ? `<div class="blk tight"><span class="l">Reps left, set ${S.rated.i + 1}</span><div class="keys">${[0, 1, 2, 3, 4].map((k) => `<button class="pill ${rt.rir === k ? 'on' : ''}" data-rir="${k}">${k === 4 ? '4+' : k}</button>`).join('')}</div></div>` : ''}`;
      const can = x.basis && S.rules;
      wpg.innerHTML = `
        <div class="grp in ${swap === 'ex' ? 'swap' : ''}"><h1 class="t">${x.name}</h1>
          <div class="blk"><div class="setrow"><span class="say h12">${full ? `<span class="t">All</span>${num(n, 12)}<span class="t">done</span>` : `<span class="t">Set</span>${num(s.length + 1, 12)}<span class="t">of</span>${num(n, 12)}`}</span>
            <span class="pair"><button class="circ" data-need="-1" aria-label="Remove a set">−</button><button class="circ" data-need="1" aria-label="Add a set">+</button></span></div>
            <div class="row mid">${marks(n, s.length)}<span class="l3">${s.length ? s.slice(-3).map((d) => (x.basis ? f(d.w) + ' × ' : '') + d.r).join(', ') : 'No sets yet'}</span></div></div></div>
        <div class="grow"></div>
        <div class="grp in ${swap ? 'swap' : ''}">${rest ? restPanel : dial}</div>
        <div class="card ${S.over ? 'open' : ''}"><button class="nxh" data-act="over" aria-expanded="${S.over}">
          <span class="row"><span class="clip"><span class="b2">Next time</span>${nx.w != null && x.basis ? ` ${f(nx.w)} lb` : ''}${nx.sets ? `, ${nx.sets} sets` : ''}</span>${can ? `<span class="l3">${nx.mine ? 'Yours' : 'Auto'}</span>` : ''}</span>
          <span class="l3">${nx.why}</span></button>
          ${nx.mine ? `<div class="ed">${stp('nx', 'Weight', f(nx.w) + ' lb')}</div>` : ''}</div>`;
      top.innerHTML = `<button class="circ glass" data-act="close" aria-label="Close">${IC.down}</button><span class="pill glass clockup">${mmss(elapsed())}</span>`;
      drawDock(); tick();
    }
    const elapsed = () => { const s = sess(); return s && s.start ? ((s.end || Date.now()) - s.start) / 1000 : 0; };
    function tick() {
      if (!S.open) return;
      const up = top.querySelector('.clockup'), t = mmss(Math.floor(elapsed())); if (up && up.textContent !== t) up.textContent = t;
      if (!resting()) return;
      const c = wpg.querySelector('.clock'), left = mmss(Math.ceil((S.restEnd - Date.now()) / 1000));
      if (c && c.dataset.t !== left) { c.dataset.t = left; c.innerHTML = num(left, 12); }
    }
    const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (S.open && S.restEnd && !resting()) endRest(); else tick(); }, 250);
    // Rest is over (or skipped): if the exercise is finished, the sequence moves on by itself.
    function endRest() { S.restEnd = 0; const full = sets().length >= need(S.ex); if (full && S.ex < W().items.length - 1) { S.ex++; S.over = false; drawWork('ex'); wpg.scrollTop = 0; } else drawWork(true); }

    function openWork(instant) {
      const s = sess(true); if (!s.start) s.start = Date.now();
      const n = W().items.findIndex((_, i) => done(i) < need(i)); S.ex = n < 0 ? 0 : n; S.open = true; S.over = false; S.edit = -1;
      drawWork(); if (instant) { work.style.transition = 'none'; requestAnimationFrame(() => (work.style.transition = '')); }
      app.classList.add('open'); wpg.scrollTop = 0;
      const n2 = tourN; setTimeout(() => { if (S.open && n2 === tourN) pg.style.display = 'none'; }, instant ? 0 : 420);
    }
    function closeWork() { pg.style.display = ''; S.open = false; S.restEnd = 0; app.classList.remove('open'); drawPage(); drawDock(); }
    function finish() {
      const s = sess(); s.end = Date.now();
      // An override made in an earlier session has now been used.
      W().items.forEach((x, i) => { const p = S.pin[x.name]; if (p && p.from !== key() && s.logs[i].length) delete S.pin[x.name]; });
      closeWork();
    }
    function go() {
      const x = item(), s = sets(), n = need(S.ex), lastEx = S.ex === W().items.length - 1;
      if (resting()) return endRest();
      if (s.length >= n) { if (lastEx) return finish(); S.ex++; S.over = false; drawWork('ex'); wpg.scrollTop = 0; return; }
      const e = entry(); s.push({ w: e.w, r: e.r, rir: null }); S.rated = { ex: S.ex, i: s.length - 1 };
      if (!(s.length >= n && lastEx)) { S.restLen = x.rest; S.restEnd = Date.now() + x.rest * 1000; }
      drawWork(true);
    }
    function move(d) { const n = Math.min(W().items.length - 1, Math.max(0, S.ex + d)); if (n === S.ex) return; S.ex = n; S.over = false; drawWork('ex'); wpg.scrollTop = 0; }
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    // Every stepper in the app comes through here.
    function bump(k, d) {
      const R = S.rules;
      if (k === 'w' || k === 'r') { const e = entry(); if (k === 'w') e.w = Math.max(0, e.w + d * item().step); else e.r = Math.max(1, e.r + d); return drawWork(); }
      if (k === 'nx') { const p = S.pin[item().name]; if (p) p.w = Math.max(0, p.w + d * item().step); return drawWork(); }
      if (k === 'kg') S.scale = +(S.scale + d * .1).toFixed(1);
      else if (k === 'wk') { S.week = cl(S.week + d, 1, 12); const ks = Object.keys(S.weights).map(Number).filter((n) => n <= S.week); S.scale = S.weights[S.week] ?? (ks.length ? S.weights[Math.max(...ks)] : 73); }
      else if (k === 'r.left') R.left = cl(R.left + d, 0, 4);
      else if (k === 'r.jump') R.jump = cl(R.jump + d, 1, 3);
      else if (k === 'r.drop') R.drop = cl(R.drop + d * 5, 5, 30);
      else if (k === 'r.stall') R.stall = cl(R.stall + d, 1, 8);
      else if (k === 'r.deload') R.deload = cl(R.deload + d * 10, 10, 100);
      else if (k[0] === 'p' && S.edit >= 0) { const x = W().items[S.edit], s = sess();
        if (k === 'p.sets') { x.sets = cl(x.sets + d, 1, 8); if (s && !s.end) s.need[S.edit] = Math.max(x.sets, s.logs[S.edit].length); }
        else if (k === 'p.lo') x.lo = cl(x.lo + d, 1, x.hi);
        else if (k === 'p.hi') x.hi = cl(x.hi + d, x.lo, 30);
        else if (k === 'p.step') x.step = STEPS[cl((STEPS.indexOf(x.step) < 0 ? 2 : STEPS.indexOf(x.step)) + d, 0, STEPS.length - 1)];
        else if (k === 'p.rest') x.rest = cl(x.rest + d * 15, 15, 300); }
      drawPage(); drawDock();
    }

    /* ---------- Hands ---------- */
    app.onclick = (ev) => {
      const b = ev.target.closest('button'); if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.tab) { S.tab = d.tab; S.edit = -1; drawPage(true); drawDock(); }
      else if (d.day) { S.day = +d.day; S.edit = -1; drawPage(); drawDock(); }
      else if (d.edit) { S.edit = S.edit === +d.edit ? -1 : +d.edit; drawPage(); const c = pg.querySelector('.card.open'); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      else if (d.st) bump(d.st, +d.d);
      else if (d.rule) { S.rules[d.rule] = d.v; drawPage(); }
      else if (d.act === 'start') openWork();
      else if (d.act === 'weigh') { S.weights[S.week] = S.scale; drawPage(); drawDock(); }
      else if (d.act === 'export') { const out = JSON.stringify({ plan: S.plan, rules: S.rules, sessions: S.sess, weights: S.weights }, null, 1); try { navigator.clipboard.writeText(out).catch(() => {}); } catch (e) {} S.copied = true; drawDock(); setTimeout(() => { if (root.isConnected) { S.copied = false; drawDock(); } }, 1600); }
      else if (d.act === 'close') closeWork();
      else if (d.act === 'go') go();
      else if (d.act === 'over') { const x = item(), p = S.pin[x.name]; if (!x.basis) return; if (p && p.from === key()) { delete S.pin[x.name]; S.over = false; } else { const a = nextTime(); S.pin[x.name] = { w: a.w != null ? a.w : entry().w, from: key() }; S.over = true; } drawWork(); }
      else if (d.move) move(+d.move);
      else if (d.need) { const s = sess(), i = S.ex; s.need[i] = cl(s.need[i] + +d.need, Math.max(1, s.logs[i].length), 8); drawWork(); }
      else if (d.rest) { S.restEnd += +d.rest * 1000; if (!resting()) endRest(); else tick(); }
      else if (d.rir && S.rated) { sess().logs[S.rated.ex][S.rated.i].rir = +d.rir; drawWork(); }
    };
    // Drag across a big number to scrub it (one step every 14px); swipe anywhere else in the workout to move
    // along the sequence.
    let drag = null;
    app.onpointerdown = (e) => {
      const v = e.target.closest('[data-scrub]');
      if (v) { drag = { k: v.dataset.scrub, x: e.clientX, n: 0 }; app.setPointerCapture(e.pointerId); }
      else if (S.open && !e.target.closest('button')) drag = { swipe: true, x: e.clientX, y: e.clientY };
    };
    app.onpointermove = (e) => { if (!drag || drag.swipe) return; const sc = app.getBoundingClientRect().width / app.offsetWidth || 1, n = Math.trunc((e.clientX - drag.x) / sc / 14);
      while (drag.n < n) { bump(drag.k, 1); drag.n++; } while (drag.n > n) { bump(drag.k, -1); drag.n--; } };
    app.onpointerup = app.onpointercancel = (e) => { if (drag && drag.swipe && S.open) { const sc = app.getBoundingClientRect().width / app.offsetWidth || 1, dx = (e.clientX - drag.x) / sc, dy = (e.clientY - drag.y) / sc; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); } drag = null; };

    /* ---------- The tour: each step sets up what came before at once, then plays its own move. ---------- */
    let tourN = 0;
    const later = (fn, ms = 700) => { const n = tourN; setTimeout(() => { if (n === tourN && root.isConnected) fn(); }, ms); };
    const reset = () => { tourN++; S = fresh(); pg.style.display = ''; app.classList.remove('open'); drawPage(true); drawDock(); };
    const inWork = (setup) => { reset(); sess(true).start = Date.now(); if (setup) setup(); openWork(true); };
    const dialled = () => { S.entry['1.0.0'] = { w: 30, r: 9 }; };
    const logged = (...sets) => { dialled(); sets.forEach(([r, rir]) => S.sess['1.0'].logs[0].push({ w: 30, r, rir })); S.rated = { ex: 0, i: sets.length - 1 }; };
    const TOUR = [
      () => { reset(); },
      () => { reset(); later(() => { S.edit = 0; drawPage(); }, 500); later(() => bump('p.sets', 1), 1300); later(() => bump('p.hi', -1), 2000); later(() => bump('p.rest', 1), 2700); },
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 750, 1000, 1250, 1500, 1750].forEach((ms) => later(() => bump('w', 1), ms)); later(() => bump('r', 1), 2300); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { logged([9, null]); S.restLen = 120; S.restEnd = Date.now() + 120000; }); later(() => { S.restEnd += 15000; tick(); }, 1000); later(() => { const b = wpg.querySelector('[data-rir="2"]'); if (b) b.click(); }, 2000); },
      () => { inWork(() => { logged([9, 2]); S.restLen = 120; S.restEnd = Date.now() + 40000; }); later(() => go(), 900); },
      () => { inWork(() => { logged([12, 2], [12, 2], [12, 1]); S.entry['1.0.0'] = { w: 30, r: 12 }; }); S.ex = 0; drawWork(); later(() => { const b = wpg.querySelector('[data-act=over]'); if (b) b.click(); }, 1500); later(() => bump('nx', 1), 2500); },
      () => { reset(); S.tab = 'you'; drawPage(true); drawDock(); later(() => { S.rules.miss = 'drop'; drawPage(); }, 1200); later(() => bump('r.left', 1), 2200); later(() => bump('r.stall', 1), 3000); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
