/* Gym Tracker, v2 ledger (Nov 15): typographic, almost no containers. Everything starts on one left edge (24) and
   values end on one right edge (378) on the Halo ground; space alone separates sections (8 inside a group, 16 between
   rows, 24 between two-line rows, 32 between sections). Type is 13 / 17 / 28 (and 64 when Numbers is set to Type), regular everywhere, one
   heavier weight for the screen title and the big numbers. The workout is a short ledger: one row per set, the
   current row is the one being dialled, tapping a number moves the stepper to it. The plan and the overload rules
   are settings rows with steppers and segmented choices. The only surfaces are floating glass: the bottom bar (tabs
   and one main action, always bottom right) and the workout's two top buttons.
   Every number is computed from state: the week, the plan, the rules, the logged sets, the clock. */
{
const DOTS = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '.': ['0', '0', '0', '0', '0', '0', '1'], ':': ['0', '0', '1', '0', '1', '0', '0'],
};
// A number as lit dots (with the plain text beside it, shown instead when Numbers is set to Type). Big is 56 tall, small 28.
const num = (text, big) => {
  const p = big ? 8 : 4; let x = 0, c = '';
  for (const ch of String(text)) {
    const g = DOTS[ch] || DOTS[0];
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i + .5) * p}" cy="${(r + .5) * p}" r="${p * .4}"/>`; }));
    x += g[0].length + 1;
  }
  return `<span class="num ${big ? 'big' : ''}" aria-label="${text}"><svg class="dots" width="${(x - 1) * p}" height="${7 * p}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
};
const svg = (d, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  today: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="1" y="9" width="2.5" height="6" rx="1.2"/><rect x="4.5" y="6" width="3.5" height="12" rx="1.6"/><rect x="9" y="10.6" width="6" height="2.8" rx="1"/><rect x="16" y="6" width="3.5" height="12" rx="1.6"/><rect x="20.5" y="9" width="2.5" height="6" rx="1.2"/></svg>',
  plan: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="3" y="4" width="18" height="3.6" rx="1.8"/><rect x="3" y="10.2" width="18" height="3.6" rx="1.8"/><rect x="3" y="16.4" width="11" height="3.6" rx="1.8"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="2.5" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="8" width="5" height="13" rx="1.6"/><rect x="16.5" y="3" width="5" height="18" rx="1.6"/></svg>',
  you: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7z"/></svg>',
  down: svg('<path d="m6 9 6 6 6-6"/>'), up: svg('<path d="m6 15 6-6 6 6"/>'), check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  minus: svg('<path d="M6 12h12"/>'), plus: svg('<path d="M6 12h12M12 6v12"/>'),
};
// Eric's program (GymCore/Seed.swift). Each exercise: name, sets, rep range, what the number means, starting number, step.
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
const PHASES = [['Baseline', 1, 3, 'Find working weights. Leave 2 to 3 reps in every set.'], ['Overload', 4, 7, 'Add reps, then weight. Leave 1 to 2 reps.'], ['Check-in', 8, 8, 'Recovering well, carry on. If not, halve the sets.'], ['Consolidate', 9, 12, 'Keep progressing. Compare photos and waist.']];
const PROFILE = { name: 'Eric', height: 185, start: 73, goal: 'Build muscle while slowly losing fat', order: ['Side and rear delts', 'Lats and upper back', 'Abs', 'Upper chest', 'Arms', 'Legs'], targets: [['Protein', '130–160 g'], ['Fat', '55–75 g'], ['Steps', '8,000–10,000']] };
// The weight line: one point per weigh-in, placed on its week, joined left to right. The 12 weeks are the faint dots.
const line = (pts) => {
  const w = 354, h = 64, v = pts.map((p) => p[1]), lo = Math.min(...v) - .6, hi = Math.max(...v) + .6;
  const P = pts.map(([wk, x]) => [4 + (wk - 1) * (w - 8) / 11, h - 12 - (x - lo) / (hi - lo) * (h - 20)]);
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<circle cx="${4 + i * (w - 8) / 11}" cy="${h - 4}" r="2" fill="currentColor" opacity=".3"/>`).join('')}
    <path d="${P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="currentColor"/>`).join('')}</svg>`;
};

SCENES.push({
  id: 'gym-v2-ledger',
  title: 'Gym Tracker',
  version: 'v2 ledger',
  size: [402, 874],
  note: 'Ledger: type on one left edge, no cards. Sets are rows, the current row is dialled in place. Plan and overload rules are stepper rows. Glass only for the bottom bar and top buttons.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Card', type: 'seg', options: [['none', 'None'], ['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'none', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['ember', 'Ember'], ['cobalt', 'Cobalt'], ['moss', 'Moss'], ['gold', 'Gold'], ['graphite', 'Graphite']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 110, step: 1, value: 75, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 24, unit: 'px', css: '--r' },
    { type: 'group', label: 'Type' },
    { key: 'weight', label: 'Title weight', type: 'seg', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']], value: 'bold', attr: 'weight' },
    { key: 'track', label: 'Letter spacing', type: 'range', min: -.06, max: .03, step: .002, value: -.012, unit: 'em', css: '--track' },
    { key: 'nums', label: 'Numbers', type: 'seg', options: [['dots', 'Dots'], ['type', 'Type']], value: 'dots', attr: 'nums' },
  ],
  steps: [{ label: 'Today', dur: 1.5 }, { label: 'Start', dur: 2.5 }, { label: 'Dial', dur: 3.5 }, { label: 'Log set', dur: 2.5 }, { label: 'Rest', dur: 3.5 }, { label: 'Next set', dur: 2.5 }, { label: 'Plan', dur: 3.5 }, { label: 'Overload', dur: 3.5 }],

  html: `
  <div class="app">
    <div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="grain"></div>
    <main class="pg"></main>
    <section class="work" aria-hidden="true"></section>
    <div class="bar"></div>
  </div>`,

  css: `
  .scene { --r: 24px; --card-k: 1; --glow: 75%; --track: -.012em;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Geist", system-ui, sans-serif; --wt: 700;
    --text: #fff; --text2: rgba(255,255,255,.6); --fill: rgba(255,255,255,.1); --on: rgba(255,255,255,.28);
    background: #000; color: var(--text); font: 400 17px/24px var(--font); letter-spacing: var(--track); -webkit-font-smoothing: antialiased; }
  .scene[data-colour=ember] { --base: #1B2550; --c1: #D9541F; --c: #F28A30; --c3: #B8401C; }
  .scene[data-colour=moss] { --base: #0F2A22; --c1: #3F9A3A; --c: #A6C63A; --c3: #1F7A58; }
  .scene[data-colour=gold] { --base: #1E1A14; --c1: #C98A1E; --c: #F2C14A; --c3: #A8641A; }
  .scene[data-colour=graphite] { --base: #1D2233; --c1: #5B6C8F; --c: #8A8FA8; --c3: #4A6480; }
  .scene[data-face=geist] { --font: "Geist", system-ui, sans-serif; }



  .scene[data-weight=regular] { --wt: 400; } .scene[data-weight=medium] { --wt: 500; }
  * { box-sizing: border-box; margin: 0; }
  button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; -webkit-tap-highlight-color: transparent; }
  .app { position: relative; height: 100%; overflow: hidden; }

  /* The ground: black, with the colour glowing down from the top and drifting slowly. */
  .ground { position: absolute; inset: 0; background: linear-gradient(var(--base), color-mix(in srgb, var(--c1) 55%, #000) 60%, #000);
    -webkit-mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); overflow: hidden; pointer-events: none; }
  .ground i { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .8; animation: drift 26s ease-in-out infinite alternate; }
  .ground .b1 { width: 70%; height: 34%; left: -10%; top: 26%; background: var(--c1); }
  .ground .b2 { width: 60%; height: 30%; left: 30%; top: 14%; background: var(--c); animation-duration: 31s; animation-direction: alternate-reverse; }
  .ground .b3 { width: 55%; height: 36%; left: 55%; top: 34%; background: var(--c3); animation-duration: 37s; }
  @keyframes drift { to { transform: translate(14%, 10%) scale(1.15); } }
  .grain { position: absolute; inset: 0; opacity: .06; mix-blend-mode: soft-light; pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }

  /* Type: 13, 17, 28 (and 64 for plain big numbers). Regular, except the title and the big numbers. */
  .t { font-size: 28px; line-height: 32px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .02em); }
  .s { font-size: 13px; line-height: 16px; color: var(--text2); }
  .dim { color: var(--text2); }
  .val { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .num { display: inline-flex; } .dots { display: block; }
  .num .plain { display: none; font-size: 28px; line-height: 28px; font-weight: var(--wt); font-variant-numeric: tabular-nums; }
  .num.big .plain { font-size: 64px; line-height: 56px; letter-spacing: calc(var(--track) - .03em); }
  .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }

  /* Screens: one left edge at 24, one right edge at 378. Gaps are 8 (inside a group), 16 (rows), 24 (two-line rows), 32 (sections). */
  .pg, .work { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + 16px) 24px calc(var(--safe-bottom, 0px) + 96px); display: flex; flex-direction: column; gap: 32px; }
  .pg::-webkit-scrollbar, .work::-webkit-scrollbar { display: none; }
  .pg, .work { --fade: #000 calc(100% - var(--safe-bottom, 0px) - 96px), transparent calc(100% - var(--safe-bottom, 0px) - 64px); }
  .pg { -webkit-mask-image: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + 8px), var(--fade)); mask-image: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + 8px), var(--fade)); }
  .work { -webkit-mask-image: linear-gradient(#000, var(--fade)); mask-image: linear-gradient(#000, var(--fade)); }
  .pg > *, .work > * { flex: none; }
  .sec { display: flex; flex-direction: column; gap: 16px; }
  .grp { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .row.ctl { min-height: 48px; } .row.top { align-items: baseline; } .sec.two { gap: 24px; } .row.end { align-items: flex-end; }
  .lbl { display: block; min-width: 0; } .lbl > * { display: block; }

  /* The optional backing (Card control). Off by default: nothing on the ground but type. It never moves the text. */
  .blk { position: relative; isolation: isolate; }
  .blk::before { content: ''; position: absolute; inset: -16px; border-radius: var(--r); z-index: -1; pointer-events: none; }
  .scene:not([data-look=none]) .sec > .blk, .scene:not([data-look=none]) .sec > .blk + * { margin-top: 16px; }
  .scene[data-look=veil] .blk::before { background: rgba(255,255,255, calc(.07 * var(--card-k))); }
  .scene[data-look=tint] .blk::before { background: color-mix(in srgb, var(--c) calc(18% * var(--card-k)), transparent); }
  .scene[data-look=smoke] .blk::before { background: rgba(0,0,0, calc(.46 * var(--card-k))); }
  .scene[data-look=lit] .blk::before { background: linear-gradient(color-mix(in srgb, var(--c) calc(36% * var(--card-k)), transparent), color-mix(in srgb, var(--c) calc(4% * var(--card-k)), transparent)); }

  /* Controls: 48 tall capsules and circles, white at two opacities, never coloured. */
  .pill { height: 48px; padding: 0 24px; border-radius: 99px; background: var(--fill); display: grid; place-items: center; white-space: nowrap; font-variant-numeric: tabular-nums; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .c { width: 48px; height: 48px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; flex: none; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .pill.on, .day.on { background: var(--on); }
  .pill:active, .c:active, .day:active, .act:active, .tabs button:active { transform: scale(.96); }
  .seg { display: flex; gap: 8px; } .seg > * { flex: 1; padding: 0; min-width: 0; }
  .stp { display: flex; align-items: center; flex: none; } .stp .v:empty { width: 8px; } .stp .v { width: 64px; text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .off { opacity: .3; pointer-events: none; }
  .week { display: flex; justify-content: space-between; }
  .day { width: 44px; height: 44px; border-radius: 50%; background: var(--fill); display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .day.rest { color: var(--text2); }

  /* Big numbers with their unit sitting on the dots' bottom row. */
  .dig { display: flex; align-items: flex-end; gap: 8px; height: 56px; transition: opacity .2s; } .dig .s { margin-bottom: -1px; }
  .dig.unsel { opacity: .5; }
  .setn { display: flex; align-items: center; gap: 8px; height: 32px; }

  /* Data marks */
  .line { display: block; overflow: visible; }
  .grid12 { display: flex; justify-content: space-between; } .wk { display: flex; flex-direction: column; gap: 8px; }
  .wk i { width: 16px; height: 16px; border-radius: 50%; background: var(--fill); } .wk i.on { background: #fff; } .wk.now i:not(.on) { background: var(--on); }
  .phases { display: flex; gap: 8px; } .ph { display: flex; flex-direction: column; gap: 8px; min-width: 0; } .ph i { height: 8px; border-radius: 99px; background: var(--fill); } .ph.on i { background: #fff; } .ph.on .s { color: var(--text); }

  /* Floating glass: the bottom bar (tabs and the one main action, always bottom right) and the workout's top buttons. */
  .glass { background: rgba(44,44,52,.5); -webkit-backdrop-filter: blur(24px) saturate(1.6); backdrop-filter: blur(24px) saturate(1.6); }
  .bar { position: absolute; left: 24px; right: 24px; bottom: calc(var(--safe-bottom, 0px) + 8px); height: 56px; display: flex; gap: 8px; z-index: 6; pointer-events: none; }
  .bar > * { pointer-events: auto; }
  .tabs { display: flex; padding: 4px; border-radius: 99px; }
  .tabs button { width: 60px; height: 48px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; line-height: 16px; transition: transform .16s, background .2s; }
  .tabs button.on { background: rgba(255,255,255,.16); }
  .tabs.keys button { font-size: 17px; line-height: 24px; font-variant-numeric: tabular-nums; }
  .act { height: 56px; min-width: 98px; padding: 0 24px; border-radius: 99px; margin-left: auto; display: grid; place-items: center; white-space: nowrap; background: rgba(255,255,255,.24); transition: transform .16s cubic-bezier(.23, 1, .32, 1); }

  /* The workout covers everything, rising from the plan. */
  .work { z-index: 5; padding-top: calc(var(--safe-top, 0px) + 8px); opacity: 0; visibility: hidden; transform: translateY(24px); pointer-events: none; transition: opacity .2s, transform .3s cubic-bezier(.32, .72, 0, 1), visibility 0s .3s; }
  .app.open .work { opacity: 1; visibility: visible; transform: none; pointer-events: auto; transition: opacity .24s .08s, transform .36s cubic-bezier(.32, .72, 0, 1); }
  .pg { transition: opacity .16s; } .app.open .pg { opacity: 0; visibility: hidden; transition: opacity .16s, visibility 0s .16s; }
  .top { display: flex; justify-content: space-between; margin-bottom: -16px; position: sticky; top: 0; z-index: 2; }
  .top .pill, .top .c { background: rgba(44,44,52,.5); }
  @media (prefers-reduced-motion: reduce) { .ground i { animation: none; } .work { transition: none; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), bar = $('.bar'), work = $('.work');
    let S;
    const fresh = () => ({
      tab: 'today', seg: 'lifts', week: 1, day: 0, open: false, ex: 0, sel: 'w', openEx: 0,
      plan: PLAN.map((w) => ({ ...w, items: w.items.map((x) => ({ ...x, rest: x.lo <= 6 ? 120 : x.lo >= 12 ? 60 : 90 })) })),
      // The overload rules. Everything the suggestion does reads from here.
      R: { method: 'double', need: 'all', rir: 1, mul: 1, miss: 'repeat', drop: 10, stall: 2, deload: 50 },
      logs: {}, delta: {}, entry: {}, over: {}, done: {}, t0: {}, restEnd: 0, weights: { 1: PROFILE.start },
    });
    const W = (d = S.day) => S.plan[d], item = () => W().items[S.ex];
    const peek = (wk, d, i) => S.logs[wk + '.' + d + '.' + i] || [];
    const sets = () => (S.logs[S.week + '.' + S.day + '.' + S.ex] ||= []);
    const ord = (wk, d) => wk * 10 + d;
    const doneDays = (wk = S.week) => S.done[wk] || [];
    const resting = () => S.restEnd > Date.now();
    const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
    const fix = (n) => +n.toFixed(2);
    const phase = () => PHASES.find((p) => S.week >= p[1] && S.week <= p[2]);

    /* ---------- Progression: follows S.R, says why in a few words ---------- */
    // Every earlier session of this lift (any day it appears on), oldest first. incl adds the session on (wk, d) itself.
    function past(x, wk, d, incl) {
      const out = [];
      for (let w = 1; w <= wk; w++) for (let dd = 0; dd < 5; dd++) {
        if (ord(w, dd) > ord(wk, d) || (!incl && ord(w, dd) === ord(wk, d))) continue;
        S.plan[dd].items.forEach((y, i) => { const s = peek(w, dd, i); if (y.name === x.name && s.length) out.push({ week: w, sets: s, target: y.sets + (S.delta[w + '.' + dd + '.' + i] || 0) }); });
      }
      return out;
    }
    function suggest(x, hist) {
      const R = S.R;
      if (!hist.length) return { w: x.start, why: x.old ? 'Old number, check it' : `Find ${x.lo} clean reps`, first: true };
      const last = hist[hist.length - 1], s = last.sets, w = Math.max(...s.map((a) => a.w)), full = s.length >= last.target;
      if (R.method === 'manual') return { w, why: 'Manual, your call' };
      if (s.some((a) => a.r < x.lo)) return R.miss === 'repeat' ? { w, why: 'Missed a set, repeat' } : { w: Math.max(0, fix(Math.round(w * (1 - R.drop / 100) / (x.step || 1)) * (x.step || 1))), why: `Missed a set, down ${R.drop}%` };
      const up = fix(w + x.step * R.mul);
      if (R.method === 'linear') return full ? { w: up, why: 'Every session, go up' } : { w, why: 'Finish every set first' };
      const top = R.need === 'all' ? full && s.every((a) => a.r >= x.hi) : s[0].r >= x.hi;
      const rated = s.filter((a) => a.rir != null), easy = !rated.length || rated.reduce((n, a) => n + a.rir, 0) / rated.length >= R.rir;
      if (top && easy) return x.basis ? { w: up, why: `${R.need === 'all' ? 'All sets' : 'First set'} at ${x.hi}, go up` } : { w, why: `At ${x.hi}, add load` };
      if (top) return { w, why: `Under ${R.rir} left, repeat` };
      const marks = hist.map((h) => ({ wk: h.week, w: Math.max(...h.sets.map((a) => a.w)), r: h.sets.reduce((n, a) => n + a.r, 0) }));
      let best = marks[0]; for (const m of marks) if (m.w > best.w || (m.w === best.w && m.r > best.r)) best = m;
      const stalled = last.week - best.wk;
      if (stalled >= R.stall) return { w, why: `Stalled ${stalled} wk, ${R.deload}% of sets`, deload: true };
      return { w, why: 'Same weight, add a rep' };
    }
    // What to lift today: the suggestion from history, unless he set his own number in an earlier session.
    function today(x, d = S.day) {
      const g = suggest(x, past(x, S.week, d, false)), o = S.over[x.name];
      return o && o.ord < ord(S.week, d) ? { ...g, w: o.w, why: 'Your number' } : g;
    }
    // What to lift next time: the same rules, counting the sets logged so far today. His own number wins.
    function nextTime(x) {
      const g = suggest(x, past(x, S.week, S.day, true)), o = S.over[x.name];
      return o && o.ord === ord(S.week, S.day) ? { ...g, w: o.w, why: 'Your number' } : g;
    }
    const target = (d = S.day, i = S.ex) => { const x = S.plan[d].items[i], base = x.sets + (S.delta[S.week + '.' + d + '.' + i] || 0); return today(x, d).deload ? Math.max(1, Math.round(base * S.R.deload / 100)) : base; };
    function entry() {
      const k = S.week + '.' + S.day + '.' + S.ex; if (S.entry[k]) return S.entry[k];
      const x = item(), h = past(x, S.week, S.day, false), g = today(x), prev = h.length && h[h.length - 1].sets[0];
      return (S.entry[k] = { w: g.w, r: prev && prev.w === g.w ? Math.min(x.hi, prev.r + 1) : x.lo });
    }
    const lastSet = () => { const s = sets(); return s[s.length - 1] || (S.ex > 0 ? peek(S.week, S.day, S.ex - 1).slice(-1)[0] : null); };

    /* ---------- Pieces ---------- */
    const stp = (k, v, off) => `<span class="stp ${off ? 'off' : ''}"><button class="c" data-st="${k}:-1" aria-label="Less">${IC.minus}</button><span class="v">${v}</span><button class="c" data-st="${k}:1" aria-label="More">${IC.plus}</button></span>`;
    const seg = (k, cur, opts, off) => `<div class="seg ${off ? 'off' : ''}">${opts.map(([v, n]) => `<button class="pill ${v === cur ? 'on' : ''}" data-set="${k}:${v}">${n}</button>`).join('')}</div>`;
    const ctl = (label, control, off, sub) => `<div class="row ctl"><span class="lbl ${off ? 'off' : ''}"><span>${label}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>${control}</div>`;
    const head = (label, title) => `<header class="grp"><span class="s">${label}</span><h1 class="t">${title}</h1></header>`;
    const week = () => `<div class="week">${LETTERS.map((L, i) => `<button class="day ${i === S.day ? 'on' : ''} ${i > 4 ? 'rest' : ''}" data-day="${i}" aria-label="${DAYS[i]}${doneDays().includes(i) ? ', done' : ''}">${doneDays().includes(i) ? IC.check : L}</button>`).join('')}</div>`;

    /* ---------- Tabs ---------- */
    const PAGES = {
      today() {
        const w = W(), d = S.day;
        return `${head(`${DAYS[d]} · Week ${S.week} of 12`, w ? w.name : 'Rest day')}
          <section class="sec blk"><div class="dig">${num(doneDays().length + '/5', true)}<span class="s">done this week</span></div>${week()}</section>
          ${w ? `<section class="sec two"><span class="s">${w.focus}</span>${w.items.map((x, i) => { const g = today(x, d), n = peek(S.week, d, i).length, t = target(d, i);
            return `<div class="row top"><span class="lbl"><span>${x.name}</span><span class="s">${n ? `${n} of ${t} sets logged` : (x.basis ? g.w + ' lb · ' : '') + g.why}</span></span><span class="s val">${t} × ${x.lo}–${x.hi}</span></div>`; }).join('')}</section>`
            : `<section class="grp"><span>Walk, stretch, sleep.</span><span class="s">Next: ${S.plan[0].name}, Monday</span></section>`}`;
      },
      plan() {
        const w = W(), d = S.day, R = S.R, dbl = R.method === 'double', man = R.method === 'manual';
        const top = `${head(S.seg === 'lifts' ? (w ? `${w.name} · ${DAYS[d]}` : DAYS[d]) : 'Progressive overload', 'Plan')}${seg('seg', S.seg, [['lifts', 'Lifts'], ['rules', 'Overload']])}`;
        if (S.seg === 'lifts') return `${top}${week()}${w ? `<section class="sec">${w.items.map((x, i) => i === S.openEx
          ? `<div class="grp blk"><div class="row ctl" data-open="${i}"><span>${x.name}</span><button class="c" data-open="${i}" aria-label="Close">${IC.up}</button></div>
              ${ctl('Sets', stp('p.sets', x.sets))}${ctl('Reps from', stp('p.lo', x.lo))}${ctl('Reps to', stp('p.hi', x.hi))}${ctl('Step', stp('p.step', x.step + ' lb'), !x.basis)}${ctl('Rest', stp('p.rest', x.rest + ' s'))}</div>`
          : `<div class="row ctl" data-open="${i}"><span class="lbl"><span>${x.name}</span><span class="s val">${x.sets} × ${x.lo}–${x.hi}${x.basis ? ` · ${x.step} lb` : ''} · ${x.rest} s</span></span><button class="c" data-open="${i}" aria-label="Edit">${IC.down}</button></div>`).join('')}</section>`
          : '<span class="dim">Rest day. Nothing to plan.</span>'}`;
        // A worked example with the first lift of the day, run through the same rules as the real suggestion.
        const x = (w || S.plan[0]).items[0], w0 = x.start || 30, g = suggest(x, [{ week: 1, target: x.sets, sets: Array.from({ length: x.sets }, () => ({ w: w0, r: x.hi, rir: 2 })) }]);
        return `${top}
          <section class="grp"><span class="s">Method</span>${seg('method', R.method, [['double', 'Double'], ['linear', 'Linear'], ['manual', 'Manual']])}
            <span class="s">${dbl ? 'Reps first, then weight' : man ? 'You set every weight' : 'More weight every session'}</span></section>
          <section class="grp"><span class="s">Go up when</span>${seg('need', R.need, [['all', 'Every set at top'], ['first', 'First set at top']], !dbl)}
            ${ctl('Reps left, at least', stp('rir', R.rir, !dbl), !dbl)}${ctl('Go up by', stp('mul', R.mul + (R.mul === 1 ? ' step' : ' steps'), man), man)}</section>
          <section class="grp"><span class="s">A missed set</span>${seg('miss', R.miss, [['repeat', 'Repeat'], ['drop', 'Drop']], man)}
            ${ctl('Drop by', stp('drop', R.drop + '%', man || R.miss !== 'drop'), man || R.miss !== 'drop')}</section>
          <section class="grp"><span class="s">A stall</span>${ctl('Called after', stp('stall', R.stall + ' wk', !dbl), !dbl)}${ctl('Deload to', stp('deload', R.deload + '%', !dbl), !dbl, 'of the sets')}</section>
          <section class="grp"><span class="s">Example</span><span>${x.sets} × ${x.hi} at ${x.basis ? w0 + ' lb' : 'bodyweight'}, 2 left</span><span class="s">Next time ${x.basis ? g.w + ' lb' : 'the same'} · ${g.why}</span></section>`;
      },
      progress() {
        const pts = Object.keys(S.weights).map(Number).filter((k) => k <= S.week).sort((a, b) => a - b).map((k) => [k, S.weights[k]]), now = pts[pts.length - 1][1], diff = fix(now - pts[0][1]);
        const all = Object.values(S.done).reduce((n, a) => n + a.length, 0);
        const seen = new Set(), lifts = [];
        S.plan.forEach((p, d) => p.items.forEach((x) => { if (seen.has(x.name)) return; seen.add(x.name); const h = past(x, S.week, 6, true); if (!h.length) return; const s = h[h.length - 1].sets, b = s.reduce((m, a) => (a.w > m.w || (a.w === m.w && a.r > m.r) ? a : m)); const g = suggest(x, h), o = S.over[x.name];
          lifts.push(`<div class="row top"><span class="lbl"><span>${x.name}</span><span class="s">Next ${x.basis ? (o ? o.w : g.w) + ' lb · ' : ''}${o ? 'Your number' : g.why}</span></span><span class="s val">${x.basis ? b.w + ' lb × ' : ''}${b.r}</span></div>`); }));
        return `${head(`Week ${S.week} of 12`, 'Progress')}
          <section class="sec blk"><span class="s">Weight</span><div class="row end"><div class="dig">${num(now.toFixed(1), true)}<span class="s">kg</span></div>${stp('kg', '')}</div>
            ${line(pts)}<span class="s">${pts.length > 1 ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff).toFixed(1)} kg since week ${pts[0][0]} · ${pts.length} weigh-ins` : `${pts.length} weigh-in · the line starts with the second`}</span></section>
          <section class="sec"><span class="s">Showing up</span><div class="grid12">${Array.from({ length: 12 }, (_, k) => `<div class="wk ${k + 1 === S.week ? 'now' : ''}">${[0, 1, 2, 3, 4].map((d) => `<i class="${doneDays(k + 1).includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>
            <div class="row"><span>${doneDays().length} of 5 this week</span><span class="s val">${all} of 60 in 12 weeks</span></div></section>
          <section class="sec two"><span class="s">Lifts</span>${lifts.join('') || '<span class="dim">No sets logged yet.</span>'}</section>`;
      },
      you() {
        const p = phase();
        return `${head('Push Pull Legs Push Pull', PROFILE.name)}
          <section class="sec blk"><span class="s">Week · ${p[0]}</span><div class="row end"><div class="dig">${num(S.week + '/12', true)}</div>${stp('week', '')}</div>
            <div class="phases">${PHASES.map((q) => `<div class="ph ${q === p ? 'on' : ''}" style="flex:${q[2] - q[1] + 1}"><i></i><span class="s">${q[1] === q[2] ? q[1] : q[1] + '–' + q[2]}</span></div>`).join('')}</div>
            <span class="s">${p[3]}</span></section>
          <section class="sec"><span class="s">Each day</span>${PROFILE.targets.map(([a, b]) => `<div class="row"><span>${a}</span><span class="val dim">${b}</span></div>`).join('')}</section>
          <section class="sec"><span class="s">Body</span><div class="row"><span>Height</span><span class="val dim">${PROFILE.height} cm</span></div><div class="row"><span>Start weight</span><span class="val dim">${PROFILE.start} kg</span></div><div class="row"><span>Goal</span><span class="dim">${PROFILE.goal}</span></div></section>
          <section class="sec"><span class="s">Building, in order</span>${PROFILE.order.map((n, i) => `<div class="row"><span>${n}</span><span class="val dim">${i + 1}</span></div>`).join('')}</section>`;
      },
    };
    function drawPage(top) { pg.innerHTML = PAGES[S.tab](); if (top) pg.scrollTop = 0; }

    /* ---------- The bottom bar: tabs, or the rest keys in a workout; the one main action always bottom right ---------- */
    function drawBar() {
      if (S.open) {
        const all = sets().length >= target(), last = S.ex === W().items.length - 1, rest = resting();
        bar.innerHTML = `${rest ? '<div class="tabs keys glass"><button data-rest="-15" aria-label="15 seconds less">−15</button><button data-rest="15" aria-label="15 seconds more">+15</button></div>' : ''}
          <button class="act glass" data-act="go">${all ? (last ? 'Finish' : 'Next') : rest ? 'Skip rest' : 'Log set'}</button>`;
        return;
      }
      const w = W(), any = w && w.items.some((_, i) => peek(S.week, S.day, i).length), fin = w && w.items.every((_, i) => peek(S.week, S.day, i).length >= target(S.day, i));
      bar.innerHTML = `<nav class="tabs glass">${[['today', 'Today'], ['plan', 'Plan'], ['progress', 'Progress'], ['you', 'You']].map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-tab="${k}">${IC[k]}${n}</button>`).join('')}</nav>
        ${w ? `<button class="act glass" data-act="go">${fin ? 'View' : any ? 'Resume' : 'Start'}</button>` : ''}`;
    }

    /* ---------- The workout: a ledger, one row per set ---------- */
    function drawWork() {
      const x = item(), done = sets(), t = target(), e = entry(), rest = resting(), n = W().items.length, sel = x.basis ? S.sel : 'r', g = nextTime(x);
      const left = Math.max(0, (S.restEnd - Date.now()) / 1000);
      const dial = () => `<div class="row end">${x.basis ? `<button class="dig ${sel === 'w' ? '' : 'unsel'}" data-sel="w" aria-label="Weight">${num(e.w, true)}<span class="s">lb</span></button>` : ''}<button class="dig ${sel === 'r' ? '' : 'unsel'}" data-sel="r" aria-label="Reps">${num(e.r, true)}<span class="s">reps</span></button></div>
        <div class="grp"><span class="s">${sel === 'w' ? `${x.basis}, ${x.step} lb steps` : `Reps, aim for ${x.lo} to ${x.hi}`}</span>
          <div class="seg"><button class="pill" data-st="${sel}:-1">−${sel === 'w' ? x.step : 1}</button><button class="pill" data-st="${sel}:1">+${sel === 'w' ? x.step : 1}</button></div></div>`;
      const ls = lastSet();
      const pause = () => `<div class="row end"><div class="dig"><span class="clock">${num(clock(Math.ceil(left)), true)}</span><span class="s">rest</span></div></div>
        <div class="grp"><span class="s">Reps left in ${done.length ? 'set ' + done.length : 'the last set'}</span>
          <div class="seg">${[0, 1, 2, 3, 4].map((k) => `<button class="pill ${ls && ls.rir === k ? 'on' : ''}" data-rir="${k}">${k === 4 ? '4+' : k}</button>`).join('')}</div></div>`;
      const rows = Array.from({ length: Math.max(t, done.length) }, (_, i) => { const d = done[i];
        if (d) return `<div class="row dim"><span>Set ${i + 1}</span><span class="val">${x.basis ? d.w + ' lb × ' : ''}${d.r}${d.rir != null ? ` · ${d.rir === 4 ? '4+' : d.rir} left` : ''}</span></div>`;
        if (i === done.length) return `<div class="sec blk"><div class="setn"><span>Set</span>${num(`${i + 1}/${t}`)}</div>${rest ? pause() : dial()}</div>`;
        return `<div class="row dim"><span>Set ${i + 1}</span></div>`; }).join('');
      work.innerHTML = `<div class="top"><button class="c glass" data-act="close" aria-label="Close">${IC.down}</button><button class="pill glass" data-act="plan">Plan</button></div>
        ${head(`Exercise ${S.ex + 1} of ${n} · <span class="el val">${clock((Date.now() - S.t0[S.week + '.' + S.day]) / 1000)}</span>`, x.name)}
        <section class="sec">${rows}${done.length >= t && rest ? `<div class="sec blk"><div class="setn"><span>All ${done.length} sets done</span></div>${pause()}</div>` : ''}</section>
        <section class="grp">${ctl('Sets', stp('sets', t))}
          ${ctl(done.length ? 'Next time' : 'Today', done.length && x.basis ? stp('next', g.w + ' lb') : `<span class="val dim">${x.basis ? g.w + ' lb' : 'Bodyweight'}</span>`, false, g.why)}</section>`;
      drawBar();
    }
    const timer = setInterval(() => {
      if (!root.isConnected) return clearInterval(timer);
      if (!S.open) return;
      if (S.restEnd && !resting()) { S.restEnd = 0; return drawWork(); }
      const el = work.querySelector('.el'), c = work.querySelector('.clock');
      if (el) { const t = clock((Date.now() - S.t0[S.week + '.' + S.day]) / 1000); if (el.textContent !== t) el.textContent = t; }
      if (c) { const t = clock(Math.ceil((S.restEnd - Date.now()) / 1000)); if (c.dataset.t !== t) { c.dataset.t = t; c.innerHTML = num(t, true); } }
    }, 250);

    const draw = (top) => { drawPage(top); S.open ? drawWork() : drawBar(); };
    function openWork(instant) {
      S.open = true; S.t0[S.week + '.' + S.day] ||= Date.now();
      const n = W().items.findIndex((_, i) => peek(S.week, S.day, i).length < target(S.day, i)); S.ex = n < 0 ? 0 : n; S.sel = 'w';
      drawWork(); if (instant) { work.style.transition = 'none'; requestAnimationFrame(() => work.style.transition = ''); }
      app.classList.add('open'); work.setAttribute('aria-hidden', 'false'); work.scrollTop = 0;
    }
    function closeWork() { S.open = false; S.restEnd = 0; app.classList.remove('open'); work.setAttribute('aria-hidden', 'true'); draw(); }
    function go() {
      if (!S.open) return openWork();
      const x = item(), done = sets(), last = S.ex === W().items.length - 1;
      if (done.length >= target()) { if (last) { const a = (S.done[S.week] ||= []); if (!a.includes(S.day)) a.push(S.day); return closeWork(); } S.ex++; S.sel = 'w'; drawWork(); work.scrollTop = 0; return; }
      if (resting()) { S.restEnd = 0; return drawWork(); }
      const e = entry(); done.push({ w: e.w, r: e.r, rir: null });
      if (!(done.length >= target() && last)) S.restEnd = Date.now() + x.rest * 1000;
      drawWork();
    }
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    function bump(k, dir) {
      const R = S.R;
      if (k === 'w' || k === 'r' || k === 'sets' || k === 'next') {
        const x = item(), e = entry(), dk = S.week + '.' + S.day + '.' + S.ex;
        if (k === 'w') e.w = Math.max(0, fix(e.w + dir * x.step)); else if (k === 'r') e.r = clamp(e.r + dir, 1, 50);
        else if (k === 'sets') { const t = target(), nt = clamp(t + dir, Math.max(1, sets().length), 10); S.delta[dk] = (S.delta[dk] || 0) + nt - t; }
        else S.over[x.name] = { w: Math.max(0, fix(nextTime(x).w + dir * x.step)), ord: ord(S.week, S.day) };
        return drawWork();
      }
      if (k[0] === 'p') { const x = W().items[S.openEx];
        if (k === 'p.sets') x.sets = clamp(x.sets + dir, 1, 10); else if (k === 'p.lo') x.lo = clamp(x.lo + dir, 1, x.hi); else if (k === 'p.hi') x.hi = clamp(x.hi + dir, x.lo, 50);
        else if (k === 'p.step') x.step = clamp(fix(x.step + dir * .5), .5, 25); else x.rest = clamp(x.rest + dir * 15, 15, 300); }
      else if (k === 'rir') R.rir = clamp(R.rir + dir, 0, 4); else if (k === 'mul') R.mul = clamp(R.mul + dir, 1, 4); else if (k === 'drop') R.drop = clamp(R.drop + dir * 5, 5, 50);
      else if (k === 'stall') R.stall = clamp(R.stall + dir, 1, 8); else if (k === 'deload') R.deload = clamp(R.deload + dir * 10, 10, 100);
      else if (k === 'week') S.week = clamp(S.week + dir, 1, 12);
      else if (k === 'kg') { const ks = Object.keys(S.weights).map(Number).filter((n) => n <= S.week); S.weights[S.week] = fix((S.weights[S.week] ?? S.weights[Math.max(...ks)]) + dir * .1); }
      drawPage(); drawBar();
    }
    function rate(k) { const l = lastSet(); if (l) l.rir = l.rir === k ? null : k; drawWork(); }
    function addRest(s) { S.restEnd += s * 1000; if (!resting()) S.restEnd = 0; drawWork(); }

    /* ---------- Hands ---------- */
    app.onclick = (ev) => {
      const b = ev.target.closest('button, [data-open]'); if (!b) return;
      const d = b.dataset;
      if (d.tab) { S.tab = d.tab; draw(true); }
      else if (d.day) { S.day = +d.day; S.openEx = 0; draw(); }
      else if (d.open != null) { S.openEx = S.openEx === +d.open ? -1 : +d.open; drawPage(); }
      else if (d.set) { const [k, v] = d.set.split(':'); if (k === 'seg') S.seg = v; else S.R[k] = v; drawPage(k === 'seg'); }
      else if (d.st) { const [k, v] = d.st.split(':'); bump(k, +v); }
      else if (d.sel) { S.sel = d.sel; drawWork(); }
      else if (d.rir) rate(+d.rir);
      else if (d.rest) addRest(+d.rest);
      else if (d.act === 'go') go();
      else if (d.act === 'close') closeWork();
      else if (d.act === 'plan') { const i = S.ex; S.tab = 'plan'; S.seg = 'lifts'; S.openEx = i; closeWork(); pg.scrollTop = 0; }
    };

    /* ---------- The tour: each step sets up what came before at once, then plays its own move. ---------- */
    let tourN = 0;
    const later = (fn, ms = 700) => { const n = tourN; setTimeout(() => { if (n === tourN && root.isConnected) fn(); }, ms); };
    const reset = () => { tourN++; S = fresh(); app.classList.remove('open'); draw(true); };
    const inWork = (setup) => { reset(); if (setup) setup(); openWork(true); };
    const dialled = () => { S.entry['1.0.0'] = { w: 30, r: 9 }; };
    const one = (rir, ago) => { dialled(); S.logs['1.0.0'] = [{ w: 30, r: 9, rir }]; S.t0['1.0'] = Date.now() - ago * 1000; };
    const TOUR = [
      () => reset(),
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 800, 1100, 1400, 1700, 2000].forEach((ms) => later(() => bump('w', 1), ms)); later(() => { S.sel = 'r'; drawWork(); }, 2400); later(() => bump('r', 1), 2800); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { one(null, 95); S.restEnd = Date.now() + 90000; }); later(() => addRest(15), 1000); later(() => rate(2), 2000); },
      () => { inWork(() => { one(2, 180); S.restEnd = Date.now() + 40000; }); later(() => { S.restEnd = 0; drawWork(); }, 900); },
      () => { reset(); S.tab = 'plan'; draw(true); later(() => bump('p.sets', 1), 900); later(() => bump('p.hi', -1), 1700); later(() => bump('p.rest', 1), 2500); },
      () => { reset(); S.tab = 'plan'; S.seg = 'rules'; draw(true); later(() => bump('rir', 1), 900); later(() => { S.R.miss = 'drop'; drawPage(); }, 1700); later(() => bump('stall', 1), 2500); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
