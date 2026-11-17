/* Gym Tracker, v4 (Nov 15): v3's structure and behaviour in the reference's visual language.
   Urbanist, medium for words and semibold for the title. Fine dot numbers (light points with air between them).
   One lit panel per screen: a big squircle that is colour at the rim and near-black in the middle, with a thin
   bright line along its top edge, so the number sits on darkness with light around it.
   Buttons are raised dark-glass lozenges: a soft top-to-bottom gradient, a 1px light line on the top edge, a soft
   shadow under. The main action is a dark glass pill with a solid white circle nested at its right end.
   Selected small things (the day, the reps-left rating) are a solid white circle with dark ink.
   Thin lines and dotted tracks carry data: the rest countdown, where the reps sit in their range, the set dots,
   the weight chart, the 12 weeks. A faint dot grid lies over the ground.
   Still: all text starts at 24 and ends at 378, gaps 8 / 16 / 24 / 32, type 28 / 17 / 13, controls 44+. */
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
  if (p > 4 && String(text).length >= 5) p -= 2; // 112.5 would run into the reps column at full size
  let x = 0, c = '';
  for (const ch of String(text)) {
    // Each digit is as wide as its lit columns, so a 1 does not carry empty space and the first dot sits on the text edge.
    if (ch === '/') x += 1;
    const g = DOTS[ch] || DOTS[0], lit = [...g[0]].map((_, i) => g.some((row) => row[i] === '1')), a = lit.indexOf(true), z = lit.lastIndexOf(true);
    g.forEach((row, r) => [...row].forEach((b, i) => { if (b === '1') c += `<circle cx="${(x + i - a + .3) * p}" cy="${(r + .3) * p}" r="${p * .36}"/>`; }));
    x += z - a + (ch === '/' ? 3 : 2);
  }
  return `<span class="num ${p > 4 ? 'big' : ''} ${dim ? 'dim' : ''}" aria-label="${dim ? 'Not set' : text}"><svg class="dots" width="${(x - 1.4) * p}" height="${Math.round(6.6 * p)}" fill="currentColor" aria-hidden="true">${c}</svg><b class="plain">${text}</b></span>`;
};
const IC = {
  today: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="1" y="9" width="2.5" height="6" rx="1.2"/><rect x="4.5" y="6" width="3.5" height="12" rx="1.6"/><rect x="9" y="10.6" width="6" height="2.8" rx="1"/><rect x="16" y="6" width="3.5" height="12" rx="1.6"/><rect x="20.5" y="9" width="2.5" height="6" rx="1.2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="2.5" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="8" width="5" height="13" rx="1.6"/><rect x="16.5" y="3" width="5" height="18" rx="1.6"/></svg>',
  you: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="7.5" r="4.5"/><path d="M3.5 21c0-4.4 3.8-7 8.5-7s8.5 2.6 8.5 7z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 6 6-6 6M13 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  rules: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h9M19 8h1M4 16h1M11 16h9"/><circle cx="16" cy="8" r="2.4"/><circle cx="8" cy="16" r="2.4"/></svg>',
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
// The weight chart: 12 weeks along the bottom with their numbers, a dotted baseline at the starting weight so one
// weigh-in already reads as a chart, then a thin line with a small dot per logged week.
const line = (pts) => {
  const w = 354, h = 96, v = pts.map((p) => p[1]), lo = Math.min(...v) - .6, hi = Math.max(...v) + .6;
  const X = (wk) => 4 + (wk - 1) * (w - 8) / 11, Y = (kg) => 52 - (kg - lo) / (hi - lo) * 44;
  const P = pts.map(([wk, kg]) => [X(wk), Y(kg)]), d = P.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' '), end = P[P.length - 1];
  return `<svg class="line" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" fill="none" aria-hidden="true">
    <path d="M1 ${Y(pts[0][1]).toFixed(1)} H${w - 1}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="0.1 6" opacity=".45"/>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${X(i + 1)}" cy="66" r="1.5" fill="currentColor" opacity="${pts.some((p) => p[0] === i + 1) ? 1 : .3}"/><text x="${i === 0 ? 0 : i === 11 ? w : X(i + 1)}" y="92" text-anchor="${i === 0 ? 'start' : i === 11 ? 'end' : 'middle'}" font-size="13" font-weight="500" fill="currentColor" opacity=".6">${i + 1}</text>`).join('')}
    <path d="${d}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="currentColor"/>`).join('')}
    <circle cx="${end[0]}" cy="${end[1]}" r="4" fill="currentColor"/></svg>`;
};

SCENES.push({
  id: 'gym-v8',
  title: 'Gym Tracker',
  version: 'v8',
  size: [402, 874],
  note: 'v7 with notes 14 to 23: one colour through every stage, the set you just did is logged while you rest, last time sits on the dial, the plan sheet has a way back, thicker dots, more air in lists, and a lit hero on You and on the finished exercise.',
  controls: [
    { type: 'group', label: 'Look' },
    { key: 'look', label: 'Panel', type: 'seg', options: [['veil', 'Veil'], ['tint', 'Tint'], ['smoke', 'Smoke'], ['lit', 'Lit']], value: 'lit', attr: 'look' },
    { key: 'cardk', label: 'Card strength', type: 'range', min: 0, max: 2.5, step: .05, value: 1, css: '--card-k' },
    { key: 'colour', label: 'Colour', type: 'seg', options: [['graphite', 'Graphite'], ['cobalt', 'Cobalt'], ['moss', 'Moss']], value: 'cobalt', attr: 'colour' },
    { key: 'glow', label: 'Glow reach', type: 'range', min: 30, max: 130, step: 1, value: 112, unit: '%', css: '--glow' },
    { key: 'radius', label: 'Corners', type: 'range', min: 16, max: 44, step: 1, value: 24, unit: 'px', css: '--r' },
    { key: 'rim', label: 'Rim light', type: 'range', min: 0, max: 2, step: .05, value: 1, css: '--rim' },
    { key: 'grid', label: 'Dot grid', type: 'range', min: 0, max: 2, step: .05, value: 0, css: '--grid' },
    { key: 'ground', label: 'Background glow', type: 'range', min: 0, max: 1, step: .02, value: .46, css: '--gk' },
    { key: 'bevel', label: 'Button depth', type: 'range', min: 0, max: 1, step: .05, value: .25, css: '--bev' },
    { type: 'group', label: 'Type' },
    { key: 'face', label: 'Typeface', type: 'select', options: [['urbanist', 'Urbanist'], ['geist', 'Geist']], value: 'urbanist', attr: 'face' },
    { key: 'weight', label: 'Weight', type: 'seg', options: [['regular', 'Regular'], ['medium', 'Medium'], ['bold', 'Bold']], value: 'medium', attr: 'weight' },
    { key: 'track', label: 'Letter spacing', type: 'range', min: -.06, max: .03, step: .002, value: 0, unit: 'em', css: '--track' },
    { key: 'nums', label: 'Numbers', type: 'seg', options: [['dots', 'Dots'], ['type', 'Type']], value: 'dots', attr: 'nums' },
  ],
  steps: [{ label: 'Today', dur: 1.5 }, { label: 'Shape the plan', dur: 4 }, { label: 'Start', dur: 2.5 }, { label: 'Dial', dur: 3 }, { label: 'Log set', dur: 2.5 }, { label: 'Rest', dur: 3.5 }, { label: 'Next set', dur: 2.5 }, { label: 'Next time', dur: 4 }, { label: 'Rules', dur: 4 }],

  html: `
  <div class="app">
    <div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="grain"></div><div class="grid14"></div>
    <main class="pg"></main>
    <section class="work" aria-hidden="true"><div class="ground"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div><div class="grid14"></div><div class="wpg"></div></section>
    <div class="top"></div>
    <div class="scrim"></div>
    <section class="sheet" aria-hidden="true"></section>
    <div class="dock"></div>
  </div>`,

  css: `
  .scene { --s: 8px; --m: 16px; --l: 24px; --x: 32px; --tap: 48px; --r: 24px; --card-k: 1; --rim: 1; --grid: 0; --gk: .46; --bev: .25; --glow: 112%; --track: 0em;
    --base: #0E1840; --c1: #2E6FE0; --c: #4A63E8; --c3: #1FA3B8; --font: "Urbanist", "Geist", system-ui, sans-serif; --w: 500; --wt: 600;
    --text: #fff; --text2: rgba(255,255,255,.8); --text3: rgba(255,255,255,.6); --ink: #0B0B10; --deep: color-mix(in srgb, var(--c) 10%, #04040A);
    background: #000; color: var(--text); font: var(--w) 17px/1.3 var(--font); letter-spacing: var(--track); -webkit-font-smoothing: antialiased; }
  .scene[data-colour=ember] { --base: #1B2550; --c1: #D9541F; --c: #F28A30; --c3: #B8401C; }
  .scene[data-colour=moss] { --base: #0F2A22; --c1: #3F9A3A; --c: #A6C63A; --c3: #1F7A58; }
  .scene[data-colour=gold] { --base: #1E1A14; --c1: #C98A1E; --c: #F2C14A; --c3: #A8641A; }
  .scene[data-colour=graphite] { --base: #1D2233; --c1: #5B6C8F; --c: #8A8FA8; --c3: #4A6480; }
  .scene[data-face=geist] { --font: "Geist", system-ui, sans-serif; }



  .scene[data-weight=regular] { --w: 400; } .scene[data-weight=bold] { --w: 700; --wt: 700; }
  * { box-sizing: border-box; margin: 0; } button { font: inherit; letter-spacing: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; -webkit-tap-highlight-color: transparent; }
  .app { position: relative; height: 100%; overflow: hidden; }

  /* The ground: black, the colour glowing down from the top and drifting slowly, a faint dot grid over it. */
  .ground { position: absolute; inset: 0; background: linear-gradient(var(--base), color-mix(in srgb, var(--c1) 55%, #000) 60%, #000);
    -webkit-mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); mask-image: linear-gradient(#000, rgba(0,0,0,.6) 35%, transparent var(--glow)); overflow: hidden; }
  .ground i { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .8; animation: drift 26s ease-in-out infinite alternate; }
  .ground .b1 { width: 70%; height: 34%; left: -10%; top: 26%; background: var(--c1); }
  .ground .b2 { width: 60%; height: 30%; left: 30%; top: 14%; background: var(--c); animation-duration: 31s; animation-direction: alternate-reverse; }
  .ground .b3 { width: 55%; height: 36%; left: 55%; top: 34%; background: var(--c3); animation-duration: 37s; }
  @keyframes drift { to { transform: translate(14%, 10%) scale(1.15); } }
  .grain { position: absolute; inset: 0; opacity: .06; mix-blend-mode: soft-light; pointer-events: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"); }
  .grid14 { position: absolute; inset: 0; pointer-events: none; opacity: calc(.42 * var(--grid)); background: radial-gradient(circle, rgba(255,255,255,.22) .8px, transparent 1.1px) 5px 5px / 14px 14px; }

  /* Type: 28 semibold (screen title, the set line), 17 and 13 medium. Big numbers are dots, or 64 when plain. */
  .t { font-size: 28px; font-weight: var(--wt); letter-spacing: calc(var(--track) - .01em); line-height: 1.15; text-wrap: balance; }
  .l { font-size: 13px; color: var(--text2); } .l3 { font-size: 13px; color: var(--text3); font-variant-numeric: tabular-nums; }
  .b2 { color: var(--text2); font-variant-numeric: tabular-nums; }
  .num { display: inline-flex; flex: none; } .num.dim { opacity: .3; } .num .dots { display: block; overflow: visible; } .num .plain { display: none; font-size: 28px; font-weight: var(--wt); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.big .plain { font-size: 64px; letter-spacing: calc(var(--track) - .02em); line-height: .8; }
  .scene[data-nums=type] .num .dots { display: none; } .scene[data-nums=type] .num .plain { display: block; }
  /* A line that says something with a big number in it: words sit on the baseline of the dots. */
  .say { display: flex; align-items: baseline; gap: var(--s); min-width: 0; height: 59px; } .scene[data-nums=type] .say { height: 56px; }
  .say .quiet60 { opacity: .6; } .say .strut { width: 0; height: 100%; margin-left: calc(var(--s) * -1); } .say > span:not(.num):not(.t):not(.quiet60) { color: var(--text2); }

  /* Screens. Everything starts at 24 and ends at 378. */
  .pg, .wpg { position: absolute; inset: 0; overflow-y: auto; scrollbar-width: none; padding: calc(var(--safe-top, 0px) + var(--m)) var(--l) calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--l)); display: flex; flex-direction: column; gap: var(--l); }
  .pg::-webkit-scrollbar, .wpg::-webkit-scrollbar, .sheet::-webkit-scrollbar { display: none; }
  /* Content fades out under the status bar and above the bottom row, so nothing readable sits behind the glass. */
  .pg, .wpg { --fade: linear-gradient(transparent calc(var(--safe-top, 0px) * .55), #000 calc(var(--safe-top, 0px) + var(--s)), #000 calc(100% - var(--safe-bottom, 0px) - 88px), transparent calc(100% - var(--safe-bottom, 0px) - 72px)); -webkit-mask-image: var(--fade); mask-image: var(--fade); }
  .head { display: flex; flex-direction: column; gap: var(--s); }
  .sec { display: flex; flex-direction: column; gap: var(--m); }
  .list { display: flex; flex-direction: column; gap: var(--m); } .list.tight { gap: var(--s); }
  .blk { display: flex; flex-direction: column; gap: var(--m); } .blk.tight { gap: var(--s); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--m); } .row.mid { align-items: center; } .row.end { align-items: flex-end; }
  .row > :first-child { min-width: 0; } .clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* The lit panel, one per screen: colour at the rim, near-black in the middle, the top edge brightest, and a thin
     line of light along the top that fades down the sides. It sits 12 in from the screen with 12 inside, so its
     text is still on the 24 edge. */
  .panel { position: relative; isolation: isolate; margin: 0 -12px; padding: var(--l) 12px; border-radius: var(--r); background: var(--deep); box-shadow: 0 18px 40px -18px rgba(0,0,0,.9); }
  .panel::before { content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; opacity: min(1, calc(.92 * var(--card-k)));
    background: radial-gradient(ellipse 84% 78% at 50% 64%, var(--deep) 0%, var(--deep) 36%, color-mix(in srgb, var(--deep) 60%, transparent) 62%, transparent 100%),
      linear-gradient(180deg, color-mix(in srgb, var(--c) 62%, #fff) 0%, color-mix(in srgb, var(--c) 92%, #fff) 10%, var(--c) 26%, color-mix(in srgb, var(--c) 70%, var(--c1)) 62%, color-mix(in srgb, var(--c1) 62%, var(--c3)) 100%); }
  .panel::after { content: ''; position: absolute; inset: 0; z-index: -1; border-radius: inherit; padding: 1px; pointer-events: none; opacity: min(1, var(--rim));
    background: linear-gradient(180deg, rgba(255,255,255,.75) 0%, rgba(255,255,255,.22) 22%, rgba(255,255,255,.04) 56%, transparent 80%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); }
  .scene[data-look=tint] .panel::before { background: linear-gradient(180deg, color-mix(in srgb, var(--c) 62%, transparent), color-mix(in srgb, var(--c) 18%, transparent)); }
  .scene[data-look=veil] .panel::before { background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.03)); }
  .scene[data-look=smoke] .panel::before { background: none; }

  /* Buttons: raised lozenges of dark glass. A soft gradient (lighter at the top), a line of light on the top edge
     that thins out down the sides, a soft shadow under. Never a colour. */
  .pill, .circ, .glass { background: linear-gradient(180deg, rgba(255,255,255,.17), rgba(255,255,255,.035)), rgba(22,22,30,.62);
    box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.34 * var(--rim))), inset 0 0 0 1px rgba(255,255,255, calc(.05 * var(--rim))), inset 0 -8px 12px -8px rgba(0,0,0,.5), 0 8px 16px -8px rgba(0,0,0,.75);
 }
  .pill, .circ { height: var(--tap); border-radius: 99px; display: inline-grid; place-items: center; flex: none; white-space: nowrap; font-variant-numeric: tabular-nums; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s, color .2s; }
  .pill { padding: 0 var(--m); } .circ { width: var(--tap); }
  /* Chosen: a segment brightens; a small round thing (the day, the rating) turns solid white with dark ink. */
  .pill.on { background: linear-gradient(180deg, rgba(255,255,255,.42), rgba(255,255,255,.2)), rgba(22,22,30,.62); }
  .circ.on, .day.on .dot { background: linear-gradient(180deg, #fff, #DCDCE4); color: var(--ink); box-shadow: inset 0 -6px 10px -6px rgba(0,0,0,.25), 0 8px 18px -8px rgba(0,0,0,.8); }
  .pill:active, .circ:active, .day:active .dot, .dock button:active { transform: scale(.97); } .exh:active, .rowb:active, .txt:active { opacity: .7; }
  .keys { display: flex; gap: var(--s); } .keys .pill { flex: 1; padding: 0; min-width: 0; }
  .pair { display: flex; gap: var(--s); flex: none; }
  /* The one stepper: minus, value, plus. In a row it fills the control slot, 178 to 378. */
  .slot { width: 200px; flex: none; } .stp { display: flex; align-items: center; } .stp .v { flex: 1; text-align: center; font-variant-numeric: tabular-nums; }
  .line { min-height: var(--tap); } .why { min-height: var(--l); }
  .txt { height: 44px; margin: -10px 0; padding-left: var(--m); color: var(--text2); display: inline-grid; place-items: center; flex: none; transition: opacity .16s; }
  .chev { display: grid; place-items: center; flex: none; color: var(--text3); }
  /* Lines as data: a dotted track, a solid part, a bright dot where things stand. */
  .dotline { flex: 1; align-self: center; height: 2px; min-width: var(--m); background: radial-gradient(circle, rgba(255,255,255,.34) .8px, transparent 1.1px) 0 50% / 8px 2px repeat-x; }
  .track { position: relative; height: var(--s); --p: 0; background: radial-gradient(circle, rgba(255,255,255,.42) .8px, transparent 1.1px) 0 50% / 8px 8px repeat-x; }
  .track.none { background: none; }
  .track i { position: absolute; left: 0; top: 50%; height: 1.5px; margin-top: -.75px; border-radius: 2px; width: calc(var(--p) * (100% - 8px) + 4px); background: linear-gradient(90deg, rgba(255,255,255,.25), #fff); }
  .track b { position: absolute; top: 0; left: calc(var(--p) * (100% - 8px)); width: var(--s); height: var(--s); border-radius: 50%; background: #fff; box-shadow: 0 0 12px 3px color-mix(in srgb, var(--c) 80%, transparent); }

  /* Today: the week in the panel, then the run of exercises as plain rows. */
  .week { display: flex; justify-content: space-between; } .day { width: 44px; display: flex; flex-direction: column; align-items: center; gap: var(--s); }
  .day .dot { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .25s, color .25s;
    background: linear-gradient(180deg, rgba(255,255,255,.17), rgba(255,255,255,.035)), rgba(22,22,30,.62); box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.34 * var(--rim))), inset 0 0 0 1px rgba(255,255,255, calc(.05 * var(--rim))), 0 8px 16px -8px rgba(0,0,0,.75); }
  .day .l { color: var(--text3); white-space: nowrap; } .day.on .l { color: var(--text); }
  .run { display: flex; flex-direction: column; gap: var(--s); }
  .exh { display: block; width: 100%; padding: var(--s) 0; transition: opacity .16s; } .exh > span { display: flex; }
  .tail { display: flex; align-items: center; gap: var(--s); flex: none; }
  .marks { display: flex; gap: var(--s); flex: none; align-items: center; } .marks i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .marks i.on { background: #fff; }

  /* Progress and You */
  .grid12 { display: flex; justify-content: space-between; padding: 0 2px; } .wk { display: flex; flex-direction: column; gap: var(--l); }
  .wk i { width: var(--s); height: var(--s); border-radius: 50%; background: rgba(255,255,255,.22); } .wk i.on { background: #fff; }
  svg.line { display: block; overflow: visible; font-family: var(--font); }
  /* The 12 weeks: a thin line, a point per week, a marker where you are. */
  .wtrack { display: flex; justify-content: space-between; align-items: center; height: var(--m); background: linear-gradient(rgba(255,255,255,.2), rgba(255,255,255,.2)) 0 50% / 100% 1px no-repeat; }
  .wtrack i { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,.4); } .wtrack i.on { background: #fff; }
  .wtrack i.cur { width: 2px; height: var(--m); border-radius: 2px; background: #fff; box-shadow: 0 0 12px 3px color-mix(in srgb, var(--c) 80%, transparent); }
  .phases { display: flex; gap: var(--s); } .ph { min-width: 0; white-space: nowrap; } .ph.on { color: var(--text); }
  .rowb { width: 100%; min-height: var(--tap); align-items: center; transition: opacity .16s; }
  [data-scrub] { touch-action: none; cursor: ew-resize; user-select: none; -webkit-user-select: none; }

  /* The bottom row, the same on every screen: a glass bar on the left, the main action on the right. */
  .dock { position: absolute; left: var(--l); right: var(--l); bottom: calc(var(--safe-bottom, 0px) + var(--s)); height: 64px; display: flex; justify-content: space-between; z-index: 9; pointer-events: none; }
  .dock > * { pointer-events: auto; }
  .bar, .act { background: linear-gradient(180deg, rgba(72,72,88,.5), rgba(20,20,28,.5)), rgba(14,14,20,.86); box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.3 * var(--rim))), inset 0 0 0 1px rgba(255,255,255, calc(.06 * var(--rim))), 0 14px 28px -10px rgba(0,0,0,.9); -webkit-backdrop-filter: blur(24px) saturate(1.5); backdrop-filter: blur(24px) saturate(1.5); }
  .bar { width: 194px; flex: none; border-radius: 99px; padding: 4px; display: flex; align-items: center; }
  .bar button { height: 56px; border-radius: 99px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 13px; transition: transform .16s cubic-bezier(.23, 1, .32, 1), background .2s; }
  .bar .tab { flex: 1; min-width: 0; color: var(--text2); }
  /* The chosen tab: a raised lozenge inside the bar, lit faintly from below with the palette colour. */
  .bar .tab.on { color: var(--text); background: radial-gradient(ellipse 90% 80% at 50% 118%, color-mix(in srgb, var(--c) 78%, transparent), transparent 72%), linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.05));
    box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.36 * var(--rim))), inset 0 0 0 1px rgba(255,255,255, calc(.06 * var(--rim))), 0 6px 12px -6px rgba(0,0,0,.8); }
  .bar .nav { width: 56px; flex: none; background: linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.05)); box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.36 * var(--rim))), inset 0 0 0 1px rgba(255,255,255, calc(.06 * var(--rim))), 0 6px 12px -6px rgba(0,0,0,.8); }
  .bar .nav[disabled] { opacity: .35; pointer-events: none; }
  .where { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--s); white-space: nowrap; } .where .marks { gap: 4px; } .where .marks i { width: 4px; height: 4px; } .where .marks i.cur { width: var(--s); border-radius: 99px; }
  /* The main action: a dark glass pill with a solid white circle nested at its right end, 8 in from the edge all round. */
  .act { width: 152px; flex: none; height: 64px; border-radius: 99px; padding: 0 var(--s) 0 var(--m); display: flex; align-items: center; justify-content: space-between; gap: var(--s); white-space: nowrap; transition: transform .16s cubic-bezier(.23, 1, .32, 1); }
  .knob { width: var(--tap); height: var(--tap); border-radius: 50%; flex: none; display: grid; place-items: center; color: var(--ink); background: linear-gradient(180deg, #fff, #DCDCE4); box-shadow: inset 0 -6px 10px -6px rgba(0,0,0,.25), 0 6px 14px -6px rgba(0,0,0,.8); }

  /* The workout covers everything, rising from the plan. It reads top down. */
  .work { position: absolute; inset: 0; z-index: 5; background: #000; opacity: 0; transform: translateY(24px) scale(.98); pointer-events: none; transition: opacity .28s, transform .42s cubic-bezier(.32, .72, 0, 1); }
  .app.open .work { opacity: 1; transform: none; pointer-events: auto; }
  .wpg { padding-top: calc(var(--safe-top, 0px) + var(--s) + var(--tap) + var(--m)); }
  .top { position: absolute; left: var(--l); right: var(--l); top: calc(var(--safe-top, 0px) + var(--s)); display: flex; justify-content: space-between; z-index: 6; opacity: 0; pointer-events: none; transition: opacity .25s; }
  .app.open .top { opacity: 1; pointer-events: auto; }
  .dial { display: flex; gap: var(--m); } .col { flex: 1; min-width: 0; }
  .rate { display: flex; justify-content: space-between; }

  /* The sheet: where editing happens, the same way everywhere. */
  .scrim { position: absolute; inset: 0; z-index: 7; background: rgba(0,0,0,.56); opacity: 0; pointer-events: none; transition: opacity .28s; }
  .sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; max-height: calc(100% - var(--safe-top, 0px) - var(--l)); overflow-y: auto; scrollbar-width: none; border-radius: var(--r) var(--r) 0 0;
    background: radial-gradient(ellipse 120% 60% at 50% 0%, color-mix(in srgb, var(--c) calc(22% * var(--card-k)), transparent), transparent 70%), linear-gradient(180deg, #1B1C26, #101117 40%);
    box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.3 * var(--rim))), 0 -20px 50px -10px rgba(0,0,0,.8);
    padding: var(--s) var(--l) calc(var(--safe-bottom, 0px) + var(--s) + 64px + var(--l)); display: flex; flex-direction: column; gap: var(--m); transform: translateY(100%); transition: transform .36s cubic-bezier(.32, .72, 0, 1); }
  .app.sheeted .scrim { opacity: 1; pointer-events: auto; } .app.sheeted .sheet { transform: none; }
  .grab { width: 32px; height: 4px; border-radius: 99px; background: rgba(255,255,255,.3); align-self: center; flex: none; }
  .swap { animation: swap .28s cubic-bezier(.23, 1, .32, 1); } @keyframes swap { from { opacity: 0; transform: translateY(8px); } }

  /* Eric, Nov 15: "Do not overdo it. Do it only on one element. If the card is gradient, the background should be
     more chill." The lit panel is the one gradient on a screen. The ground is near-black (Background glow), and
     controls are flat dark fills with at most a faint top line (Button depth), no under-light, no glow dots. */
  .ground { opacity: var(--gk); }
  .pill, .circ, .glass, .day .dot, .bar .nav { background: rgba(255,255,255, calc(.08 + .04 * var(--bev))); box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.22 * var(--bev))); }
  /* Eric, Nov 15: "The padding should always be at least equal to the corner rounding." A rounded container's
     content never sits closer to its edge than its corner radius. The panel pads by its radius on every side
     (so its text is at 12 + r, the card's own edge, while text on the ground stays at 24); the sheet's corner
     is its padding. */
  .panel { padding: var(--r); }
  .sheet { border-radius: var(--l) var(--l) 0 0; }
  .panel .day .dot { width: 40px; height: 40px; }
  /* Eric, Nov 15, the principle: "We're using the gradient because we want to invoke energy: this is live, this is
     dynamic. Every element related to that should have a similar treatment. Stuff that's not related will be more
     still. That's how we create hierarchy and rhythm." So the lit treatment marks what is live, and only that:
     today's session, the dial, the rest clock, the running timer. Records and settings (the week, weight history,
     the 12 weeks, profile, what was lifted) are still, on the ground. In a workout the lit panel breathes; nothing
     else moves. */
  .work .panel::before { animation: breathe 6s ease-in-out infinite alternate; }
  @keyframes breathe { from { filter: brightness(.92) saturate(.95); } to { filter: brightness(1.12) saturate(1.1); } }
  .clockup { background: linear-gradient(180deg, color-mix(in srgb, var(--c) 46%, transparent), color-mix(in srgb, var(--c) 10%, transparent)), rgba(20,20,26,.7); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--c) 70%, #fff); }
  /* Eric, Nov 15: the bottom bar's spacing was off, it did not need the text, and it was trying to do too much.
     Tabs are icons only. In a workout the bar is two arrows around the exercise dots, no "1 of 5". Every gap in
     the bar is 8: capsule edge to item, item to item, knob to the action's edge. Items are 48. The dial loses
     the reps track: a label, the number, minus and plus. */
  .bar { width: auto; padding: var(--s); gap: var(--s); }
  .bar button { height: var(--tap); }
  .bar .tab, .bar .nav { flex: none; width: var(--tap); }
  .where { flex: none; padding: 0 var(--s); }
  .act { width: auto; padding: 0 var(--s) 0 var(--l); gap: var(--m); }
  .dial .track { display: none; }
  .dotline { visibility: hidden; }
  /* Eric, Nov 15: "Give us some space." The workout header was three lines 8 apart, and the tall dot digits rose
     into the exercise name. Now: 16 under the top buttons, 24 from the name to the set line, the set line is as
     tall as its digits (64) so nothing overlaps, 16 down to the set dots, 32 before the panel. */
  .say { height: 64px; }
  /* Same note, the tab screens: sections sit 32 apart, not 24, and the title gets 8 more under it. */
  .pg { gap: var(--x); } .pg > .head { margin-bottom: calc(var(--s) * -1); }
  .whead { gap: var(--l); padding-top: var(--m); padding-bottom: var(--s); }
  .whead > .row.mid { margin-top: calc(var(--s) * -1); }
  .circ.on, .day.on .dot, .knob { background: #F2F2F5; box-shadow: none; }
  .pill.on { background: rgba(255,255,255,.3); }
  .bar, .act { background: rgba(26,26,32,.72); box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.2 * var(--bev))); }
  .bar .tab.on { background: rgba(255,255,255,.14); box-shadow: none; }
  .track b, .wtrack i.cur { box-shadow: none; }
  /* v5, note 1: the sheet is a solid surface. Nothing behind it shows through. */
  .sheet { background: #14151B; }
  /* v5, note 2: a little more of the Halo in the ground, reaching lower, still calm (Background glow, Glow reach). */
  .ground { -webkit-mask-image: linear-gradient(#000, rgba(0,0,0,.72) 40%, rgba(0,0,0,.34) 72%, transparent var(--glow)); mask-image: linear-gradient(#000, rgba(0,0,0,.72) 40%, rgba(0,0,0,.34) 72%, transparent var(--glow)); }
  .ground i { filter: blur(72px); }
  /* v5, note 3: each stage has its own hue, so the lit thing never looks like the same content twice. About to
     start is the palette's own colour; lifting is warmer and hotter; resting is cooler and calmer; done is settled.
     Each palette brings its own four, so it still reads as one family. No pinks or violets: Eric does not like pink
     gradients, so effort is orange or red and rest is blue or teal. */
  .scene { --st-today: #4A63E8; --st-lift: #1FA8E0; --st-rest: #22A88E; --st-done: #5D6C9E; }
  .scene[data-colour=ember] { --st-today: #F29A3A; --st-lift: #EE4A2A; --st-rest: #3F78D8; --st-done: #9A7B62; }
  .scene[data-colour=moss] { --st-today: #8FC23E; --st-lift: #2FB5A0; --st-rest: #3F8FD0; --st-done: #7D8F5A; }
  .scene[data-colour=gold] { --st-today: #F2C14A; --st-lift: #F0572A; --st-rest: #2F9FA6; --st-done: #A89668; }
  .scene[data-colour=graphite] { --st-today: #8A8FA8; --st-lift: #7AA2CC; --st-rest: #6FA89C; --st-done: #7A7F8C; }
  .app { --h: var(--st-today); } .app[data-stage=lift] { --h: var(--st-lift); } .app[data-stage=rest] { --h: var(--st-rest); } .app[data-stage=done] { --h: var(--st-done); }
  .panel { --deep: color-mix(in srgb, var(--h) 10%, #04040A); }
  .panel::before { background: radial-gradient(ellipse 84% 78% at 50% 64%, var(--deep) 0%, var(--deep) 36%, color-mix(in srgb, var(--deep) 60%, transparent) 62%, transparent 100%),
      linear-gradient(180deg, color-mix(in srgb, var(--h) 62%, #fff) 0%, color-mix(in srgb, var(--h) 92%, #fff) 10%, var(--h) 26%, color-mix(in srgb, var(--h) 76%, #000) 62%, color-mix(in srgb, var(--h) 50%, #000) 100%); }
  .clockup { background: linear-gradient(180deg, color-mix(in srgb, var(--h) 46%, transparent), color-mix(in srgb, var(--h) 10%, transparent)), rgba(20,20,26,.7); box-shadow: inset 0 1px 0 color-mix(in srgb, var(--h) 70%, #fff); transition: background .4s, box-shadow .4s; }
  .app[data-stage=rest] .work .panel::before { animation-duration: 10s; } .app[data-stage=done] .work .panel::before { animation: none; }
  /* v5, note 4: nothing selected is solid white (only the knob in the main action). The chosen day is the live
     thing, so it carries a small version of the lit treatment in the about-to-start hue; a chosen rating takes
     the hue of the stage it is in. White letters. */
  .day.on .dot, .circ.on { color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255, calc(.5 * var(--rim)));
    background: linear-gradient(180deg, color-mix(in srgb, var(--hs) 62%, #fff) 0%, var(--hs) 34%, color-mix(in srgb, var(--hs) 46%, #06060C) 100%); }
  .day.on .dot { --hs: var(--st-today); } .circ.on { --hs: var(--h); }
  /* v5, note 8: the whole plan in one sheet. A row is the exercise (press its name for all its numbers) and its sets. */
  .exn { flex: 1; min-width: 0; min-height: var(--tap); display: grid; align-content: center; transition: opacity .16s; } .exn > span { display: block; } .exn:active { opacity: .7; }
  .stp.mini { width: 136px; flex: none; }
  .bar { transition: opacity .2s, transform .28s cubic-bezier(.32, .72, 0, 1); } .app.sheeted .bar { opacity: 0; pointer-events: none; transform: translateY(8px); }
  /* v6: the plan sheet's names wrap, never clip, and end in the chevron that marks anything that opens. */
  .exn { text-align: left; white-space: normal; } .exn .nm { display: block; } .exn .chev { display: inline-block; vertical-align: -3px; margin-left: var(--s); opacity: .5; font-style: normal; }
  /* v7, notes 9 to 13: cool stage colours only; the plan is Push, Pull, Legs; the rules page is paced in sections;
     today's exercises live inside the lit card. */
  .sheet { gap: var(--l); padding-top: var(--s); } .sheet > .head { margin-top: var(--s); } .sheet .sec { gap: var(--s); } .sheet .sec > .l, .sheet .sec > .row:first-child { margin-top: var(--s); }
  .sheet .slot { width: 176px; }
  .panel .inl { margin-top: var(--m); } .exn .nm .nb { display: inline; white-space: nowrap; }
  /* v8, notes 14 to 23. One hue through every stage. Sections sit 32 apart, rows 16. A pill has 24 at each end.
     A sheet one step deeper slides in sideways and has a way back. */
  .app[data-stage=lift], .app[data-stage=rest], .app[data-stage=done] { --h: var(--st-today); }
  .pill { padding: 0 var(--l); } .keys .pill { padding: 0; }
  .pill.back { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; padding: 0 var(--m) 0 var(--s); margin-top: var(--s); }
  .sheet .list.plist { gap: var(--m); } .sheet .sec + .sec { margin-top: var(--s); }
  .sheet[data-nav=push] > :not(.grab) { animation: navpush .32s cubic-bezier(.32, .72, 0, 1) both; } .sheet[data-nav=pop] > :not(.grab) { animation: navpop .32s cubic-bezier(.32, .72, 0, 1) both; }
  @keyframes navpush { from { opacity: 0; transform: translateX(40px); } } @keyframes navpop { from { opacity: 0; transform: translateX(-40px); } }
  .list.flush { gap: 0; } .wpg { gap: var(--x); } .panel > .say { margin-top: var(--s); } .panel .row.end > .say { flex: 1; }
  @media (prefers-reduced-motion: reduce) { .sheet[data-nav] > * { animation: none !important; } }
  @media (prefers-reduced-motion: reduce) { .swap, .ground i, .work .panel::before { animation: none; } .sheet, .scrim, .work { transition: none; } }
  `,

  live(root) {
    const $ = (s) => root.querySelector(s);
    const app = $('.app'), pg = $('.pg'), dock = $('.dock'), work = $('.work'), wpg = $('.wpg'), top = $('.top'), sheet = $('.sheet');
    let S;
    const fresh = () => ({
      tab: 'today', week: 1, day: 0, open: false, ex: 0, sheet: null, planDay: 0,
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
    const fseg = (k, opts) => `<div class="keys">${opts.map(([v, n]) => `<button class="pill ${S.rules[k] === v ? 'on' : ''}" data-rule="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
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
      if (S.sheet) return ['Done', 'done', 'check'];
      if (S.open) { const full = sets().length >= need(S.ex), lastEx = S.ex === W().items.length - 1;
        const l = resting() ? (full ? 'Next' : 'Skip rest') : !full ? 'Log set' : lastEx ? 'Finish' : 'Next';
        return [l, 'go', l === 'Skip rest' ? 'skip' : l === 'Next' ? 'arrow' : 'check']; }
      if (S.tab === 'today') { if (W() && !(sess() && sess().end)) return [sess() && sess().start ? 'Resume' : 'Start', 'start', 'arrow']; const n = nextUp(); return n ? [PLAN[n.day].day, 'nextup', 'arrow'] : null; }
      return S.tab === 'progress' ? ['Weigh in', 'weigh', 'plus'] : ['Rules', 'rules', 'rules'];
    }
    function drawDock() {
      const a = action(), n = S.open ? W().items.length : 0;
      const bar = S.open
        ? `<button class="nav" data-move="-1" aria-label="Previous exercise" ${S.ex === 0 ? 'disabled' : ''}>${IC.prev}</button><div class="where" aria-label="Exercise ${S.ex + 1} of ${n}"><span class="marks">${W().items.map((_, i) => `<i class="${done(i) >= need(i) ? 'on' : ''} ${i === S.ex ? 'cur' : ''}"></i>`).join('')}</span></div><button class="nav" data-move="1" aria-label="Next exercise" ${S.ex === n - 1 ? 'disabled' : ''}>${IC.next}</button>`
        : [['today', 'Today'], ['progress', 'Progress'], ['you', 'You']].map(([k, t]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-tab="${k}" aria-label="${t}">${IC[k]}</button>`).join('');
      dock.innerHTML = `<nav class="bar">${bar}</nav>${a ? `<button class="act" data-act="${a[1]}"><span>${a[0]}</span><span class="knob">${IC[a[2]]}</span></button>` : ''}`;
    }

    /* ---------- The sheet ---------- */
    function drawSheet() {
      const k = S.sheet, R = S.rules; app.classList.toggle('sheeted', !!k); if (!k) { sheet.style.minHeight = ''; return; }
      const dy = k.day != null ? k.day : S.day, x = k.kind === 'plan' ? S.plan[dy].items[k.i] : null, wk = S.plan[S.planDay], days = S.plan.map((q, i) => i).filter((i) => S.plan[i].day === wk.day);
      sheet.dataset.nav = nav; nav = '';
      sheet.innerHTML = '<i class="grab"></i>' + (k.kind === 'plan' ? `
        ${k.back ? `<button class="pill back" data-act="back">${IC.prev}<span>Plan</span></button>` : ''}
        <header class="head"><span class="l">${S.plan[dy].day}, ${DAYS[dy]}</span><h1 class="t">${x.name}</h1></header>
        <div class="list tight">${stp('p.sets', 'Sets', x.sets)}${stp('p.lo', 'Reps from', x.lo)}${stp('p.hi', 'Reps to', x.hi)}${stp('p.step', 'Step', f(x.step) + ' lb')}${stp('p.rest', 'Rest', mmss(x.rest))}</div>`
      : k.kind === 'whole' ? `
        <header class="head"><span class="l">${days.length === 1 ? 'Once a week' : 'Twice a week'}</span><h1 class="t">Plan</h1></header>
        <div class="keys">${['Push', 'Pull', 'Legs'].map((g) => `<button class="pill ${g === wk.day ? 'on' : ''}" data-pday="${S.plan.findIndex((q) => q.day === g)}">${g}</button>`).join('')}</div>
        ${days.map((dd) => `<div class="sec"><div class="row"><span class="l">${DAYS[dd]}</span><span class="l3">${S.plan[dd].items.length} exercises, ${S.plan[dd].items.reduce((t, y) => t + y.sets, 0)} sets</span></div>
        <div class="list plist">${S.plan[dd].items.map((y, i) => `<div class="row mid line"><button class="exn" data-open="${i}" data-oday="${dd}"><span class="nm">${y.name.replace(/\S+$/, (w) => `<span class="nb">${w}<i class="chev">${IC.next}</i></span>`)}</span><span class="l3">${y.lo}–${y.hi} reps, ${y.basis ? f(y.step) + ' lb' : 'bodyweight'}</span></button>
          <span class="stp mini"><button class="circ" data-st="q.${dd}.${i}" data-d="-1" aria-label="${y.name}, fewer sets">−</button><span class="v">${y.sets}</span><button class="circ" data-st="q.${dd}.${i}" data-d="1" aria-label="${y.name}, more sets">+</button></span></div>`).join('')}</div></div>`).join('')}`
      : k.kind === 'rules' ? `
        <header class="head"><span class="l">Every exercise</span><h1 class="t">Progression</h1></header>
        ${fseg('method', [['double', 'Double'], ['linear', 'Linear'], ['manual', 'Manual']])}
        ${R.method === 'manual' ? '<span class="l">You set every weight</span>' : `
        <div class="sec"><span class="l">Go up</span>
          ${R.method === 'double' ? fseg('top', [['every', 'Every set at the top'], ['first', 'First set at the top']]) + stp('r.left', 'Reps left', R.left ? R.left + ' or more' : 'Any') : ''}
          ${stp('r.jump', 'By', steps())}</div>
        <div class="sec"><span class="l">Missed set</span>
          ${fseg('miss', [['repeat', 'Repeat'], ['drop', 'Drop']])}
          ${R.miss === 'drop' ? stp('r.drop', 'By', R.drop + '%') : ''}</div>
        <div class="sec"><span class="l">Stall</span>
          ${stp('r.stall', 'After', R.stall + (R.stall === 1 ? ' week' : ' weeks'))}
          ${stp('r.deload', 'Deload to', R.deload + '% sets')}</div>`}`
      : `
        <div class="row"><span>Weigh in</span><span class="l3">Week ${S.week}</span></div>
        <div class="blk"><div class="blk tight"><span class="l">Weight, kg</span><div class="say" data-scrub="kg">${num(S.scale.toFixed(1), BIG)}</div></div>${steppers('kg', 'Weight')}</div>`);
    }
    // A sheet opened from inside another keeps its height and slides in sideways, so it reads as one step deeper.
    let nav = '';
    const openSheet = (k) => { if (k.back) { sheet.style.minHeight = sheet.offsetHeight + 'px'; nav = 'push'; } S.sheet = k; sheet.scrollTop = 0; drawSheet(); drawDock(); };
    const backSheet = () => { nav = 'pop'; S.sheet = { kind: 'whole' }; sheet.scrollTop = 0; drawSheet(); drawDock(); };
    function closeSheet(save) {
      if (save && S.sheet && S.sheet.kind === 'weigh') S.weights[S.week] = S.scale;
      // An exercise opened from the whole plan goes back to the whole plan.
      S.sheet = null; drawSheet(); if (S.open) drawWork(); else { drawPage(); drawDock(); }
    }

    /* ---------- Pages ---------- */
    function drawPage(toTop) {
      const w = W();
      const pages = {
        today: () => {
          const over = sess() && sess().end;
          const total = w ? w.items.reduce((t, _, i) => t + need(i), 0) : 0, mins = w ? Math.round(w.items.reduce((t, x, i) => t + need(i) * (x.rest + 40), 0) / 60) : 0;
          app.dataset.stage = over ? 'done' : 'today';
          return `
          <header class="head"><span class="l">${DAYS[S.day]}</span><h1 class="t">${w ? w.day : 'Rest day'}</h1></header>
          <section class="blk"><div class="row"><span class="l">Week ${S.week} of 12, ${doneDays(S.week).length} of 5 done</span><span class="l3">${phase()[0]}</span></div>
          <div class="week">${LETTERS.map((d, i) => `<button class="day ${i === S.day ? 'on' : ''}" data-day="${i}"><span class="dot">${d}</span><span class="l">${doneDays(S.week).includes(i) ? 'Done' : i < 5 ? PLAN[i].day : 'Rest'}</span></button>`).join('')}</div></section>
          ${w ? `<section class="panel blk"><div class="row"><span class="l clip">${w.focus}</span><span class="l3">${over ? 'Done' : mins + ' min'}</span></div>
            <div class="say">${num(w.items.reduce((t, _, i) => t + Math.min(done(i), need(i)), 0) + '/' + total, BIG)}<span>sets</span></div>
          <div class="row mid inl"><span class="l">${w.items.length} exercises</span><button class="pill" data-act="whole">Plan</button></div>
            <div class="run">${w.items.map((x, i) => `<button class="exh" data-edit="${i}">
                <span class="row mid"><span class="clip">${x.name}</span><span class="tail">${marks(need(i), done(i))}<span class="chev">${IC.next}</span></span></span>
                <span class="l3">${meta(x, i)}</span></button>`).join('')}</div></section>`
            : (() => { const nd = [1, 2, 3, 4, 5, 6, 7].map((k) => (S.day + k) % 7).find((d) => d < 5), nw = S.plan[nd];
                const ns = nw.items.reduce((t, y) => t + y.sets, 0), nm = Math.round(nw.items.reduce((t, y) => t + y.sets * (y.rest + 40), 0) / 60);
                return `<section class="sec"><div class="row"><span class="l">Next, ${DAYS[nd]}</span><span class="l3">${ns} sets, ${nm} min</span></div>
                  <div class="list">${nw.items.map((y) => `<div class="row"><span class="clip">${y.name}</span><span class="b2">${y.sets} × ${y.lo}–${y.hi}</span></div>`).join('')}</div></section>`; })()}`;
        },
        progress: () => {
          app.dataset.stage = 'today'; const pts = Object.entries(S.weights).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]), first = pts[0][1], last = pts[pts.length - 1][1], dd = doneDays(S.week).length;
          const all = {}; Object.entries(S.sess).forEach(([k, s]) => { const d = +k.split('.')[1]; s.logs.forEach((l, i) => l.forEach((st) => { const x = S.plan[d].items[i], o = all[x.name]; if (!o || st.w > o.w || (st.w === o.w && st.r > o.r)) all[x.name] = { ...st, x }; })); });
          const olds = S.plan.flatMap((p) => p.items).filter((x, i, a) => x.old && !all[x.name] && a.findIndex((y) => y.name === x.name) === i);
          return `
          <header class="head"><span class="l">Week ${S.week} of 12</span><h1 class="t">Progress</h1></header>
          <section class="blk"><div class="row"><span class="l">Weight, kg</span><span class="l3">${pts.length > 1 ? `${(last - first).toFixed(1).replace('-', '−')} since the start` : `${pts.length} weigh-in`}</span></div>
            <div class="say">${num(last.toFixed(1), BIG)}</div>
            ${line(pts)}</section>
          <section class="sec"><div class="row"><span class="l">Showing up</span><span class="l3">${dd} of 5 so far</span></div>
            <div class="grid12">${Array.from({ length: 12 }, (_, wk) => `<div class="wk">${[0, 1, 2, 3, 4].map((d) => `<i class="${doneDays(wk + 1).includes(d) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div></section>
          <section class="sec"><div class="row"><span class="l">Lifts</span><span class="l3">${Object.keys(all).length ? 'Best set' : 'Last numbers'}</span></div><div class="list">
            ${Object.values(all).map((o) => `<div class="row"><span class="clip">${o.x.name}</span><span class="b2">${one(o, o.x)}</span></div>`).join('')}
            ${olds.map((x) => `<div class="row"><span class="clip">${x.name}</span><span class="b2">${x.old.split(',')[0].replace(/ per.*/, '')}</span></div>`).join('')}</div></section>`;
        },
        you: () => {
          const ph = phase(); app.dataset.stage = 'today';
          return `
          <header class="head"><span class="l">Push Pull Legs Push Pull</span><h1 class="t">Eric</h1></header>
          <section class="panel blk"><div class="row"><span class="l">${ph[0]}</span><span class="l3">${ph[1] === ph[2] ? 'Week ' + ph[1] : `Weeks ${ph[1]}–${ph[2]}`}</span></div>
            <div class="row end"><div class="say">${num(S.week + '/12', BIG)}<span>week</span></div>${steppers('wk', 'Week')}</div>
            <div class="blk tight"><div class="wtrack">${Array.from({ length: 12 }, (_, i) => `<i class="${i + 1 < S.week ? 'on' : i + 1 === S.week ? 'cur' : ''}"></i>`).join('')}</div>
              <div class="phases">${PHASES.map(([n, a, b]) => `<span class="ph l3 ${ph[0] === n ? 'on' : ''}" style="flex:${b - a + 1}">${a === b ? a : a + '–' + b}</span>`).join('')}</div></div></section>
          <section class="sec"><span class="l">Training</span><div class="list flush"><button class="rowb row" data-act="whole"><span>Plan</span><span class="tail"><span class="b2">Push, Pull, Legs</span><span class="chev">${IC.next}</span></span></button>
            <button class="rowb row" data-act="rules"><span>Progression</span><span class="tail"><span class="b2">${{ double: 'Double', linear: 'Linear', manual: 'Manual' }[S.rules.method]}</span><span class="chev">${IC.next}</span></span></button></div></section>
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
      const colTop = (k, label, val, dim, track) => `<div class="col blk"><div class="blk tight"><span class="l">${label}</span><div class="say" data-scrub="${k}">${num(val, BIG, dim)}</div></div>${track}${steppers(k, label)}</div>`;
      // The set line is the one heavy thing. While resting it says so, and names the set just finished.
      const setLine = rest ? `<span class="t">Rest</span><span>${full ? (lastEx ? 'then finish' : 'then next exercise') : `then set ${s.length + 1} of ${n}`}</span><i class="strut"></i>`
        : full ? `<span class="t">All</span>${num(n, BIG)}<span class="t">done</span>`
        : `<span class="t">Set</span>${num(s.length + 1, BIG)}<span class="t quiet60">of</span><span class="quiet60">${num(n, BIG)}</span>`;
      // The dial and the rest clock share one skeleton: a number row, then the same two circles under it.
      const frac = Math.min(1, Math.max(0, 1 - (S.restEnd - Date.now()) / 1000 / (S.restLen || 1))), spot = x.hi > x.lo ? Math.min(1, Math.max(0, (e.r - x.lo) / (x.hi - x.lo))) : 1;
      const lastLine = lt ? `${x.basis && ltw ? f(ltw) + ' lb × ' : ''}${lt.sets.map((d) => d.r).join(' · ')}` : x.old ? x.old : 'First time';
      const then = full ? (lastEx ? 'then finish' : 'then next exercise') : `then set ${s.length + 1} of ${n}`;
      const rate = () => `<div class="blk tight"><span class="l">Reps left</span><div class="rate">${[0, 1, 2, 3, 4].map((k) => `<button class="circ ${last.rir === k ? 'on' : ''}" data-rir="${k}">${k === 4 ? '4+' : k}</button>`).join('')}</div></div>`;
      // Resting: the clock is the one lit thing; under it, the set just done, still open to correct and rate.
      const core = rest ? `<div class="panel blk"><div class="row end"><div class="clock say">${num(mmss((S.restEnd - Date.now()) / 1000), BIG)}</div>
          <div class="pair"><button class="circ" data-rest="-15" aria-label="15 seconds less">−15</button><button class="circ" data-rest="15" aria-label="15 seconds more">+15</button></div></div>
          <div class="track resttrack" style="--p:${frac.toFixed(4)}"><i></i><b></b></div></div>
          <div class="blk"><span class="l">Set ${s.length}</span><div class="list tight">${x.basis ? stp('lw', 'Weight', f(last.w) + ' lb') : ''}${stp('lr', 'Reps', last.r)}</div></div>${rate()}`
        : full ? ''
        : `<div class="panel blk"><div class="row"><span class="l">Last time</span><span class="l3 clip">${lastLine}</span></div><div class="dial">${x.basis ? colTop('w', e.w ? `${x.basis}, lb` : 'Set a weight', e.w ? f(e.w) : 0, !e.w, '<div class="track none"></div>') : ''}${colTop('r', `Reps, ${x.lo}–${x.hi}`, e.r, false, `<div class="track" style="--p:${spot.toFixed(4)}" aria-label="Where the reps sit in the range"><i></i><b></b></div>`)}${blank}</div></div>`;
      app.dataset.stage = rest ? 'rest' : full ? 'done' : 'lift';
      // Reps left is one optional row on the summary, once every set is in.
      const under = !(full && last) || rest ? '' : rate() + `<div class="blk"><span class="l">Lifted</span><div class="list">${s.map((d, i) => `<div class="row"><span>Set ${i + 1}</span><span class="b2">${one(d, x)}${d.rir != null ? `, ${d.rir === 4 ? '4+' : d.rir} left` : ''}</span></div>`).join('')}</div></div>`;
      // Next time: the number the rule gives, lit, with minus and plus to make it yours. When it is yours, the rule's number stays beside Reset.
      const nx = full && last && !rest ? nextTime() : null, nxw = nx && x.basis && (nx.w || nx.mine);
      const next = !nx ? '' : `<div class="panel blk"><div class="row"><span class="l">Next time</span><span class="l3 clip">${nx.mine ? `Rule ${f(nx.rule)} lb` : nx.why}</span></div>
          <div class="row end"><div class="say">${nxw ? num(f(nx.w), BIG) + '<span>lb</span>' : x.basis ? num(0, BIG, true) : num(nx.reps, BIG) + '<span>reps</span>'}</div>${nxw ? steppers('nx', 'Next time') : ''}</div>
          ${nx.mine ? `<div class="row mid why"><span class="l3">Yours</span><button class="txt" data-act="auto">Reset</button></div>` : ''}</div>`;
      // What is coming, and how far there is to go.
      const left = W().items.map((y, i) => Math.max(0, need(i) - done(i))), setsLeft = left.reduce((t, k) => t + k, 0), minsLeft = Math.round(W().items.reduce((t, y, i) => t + left[i] * (y.rest + 40), 0) / 60);
      const upnext = `<div class="blk"><div class="row"><span class="l">To go</span><span class="l3">${setsLeft} ${setsLeft === 1 ? 'set' : 'sets'}, ${minsLeft} min</span></div>
          ${(() => { const ids = W().items.map((_, i) => i).filter((i) => i !== S.ex && left[i] > 0), order = [...ids.filter((i) => i > S.ex), ...ids.filter((i) => i < S.ex)];
            return order.length ? `<div class="list">${order.map((i) => { const y = W().items[i]; return `<div class="row"><span class="clip">${y.name}</span><span class="b2">${left[i]} × ${y.lo}–${y.hi}</span></div>`; }).join('')}</div>` : ''; })()}</div>`;
      wpg.innerHTML = `
        <div class="blk whead ${swap === 'ex' ? 'swap' : ''}"><span>${x.name}</span>
          <div class="row end"><span class="say">${setLine}</span>${rest ? '' : '<button class="pill" data-act="edit">Edit</button>'}</div>
          <div class="row mid">${marks(n, s.length)}<span class="dotline"></span><span class="l3">${s.length ? s.slice(-3).map((d) => one(d, x)).join(', ') : `${x.lo}–${x.hi} reps, rest ${mmss(x.rest)}`}</span></div></div>
        ${core}${rest ? '' : next + under + upnext}`;
      top.innerHTML = `<button class="circ" data-act="close" aria-label="Close">${IC.down}</button><span class="pill clockup">${mmss(elapsed())}</span>`;
      drawDock(); tick();
    }
    const elapsed = () => { const s = sess(); return s && s.start ? ((s.end || Date.now()) - s.start) / 1000 : 0; };
    function tick() {
      if (!S.open) return;
      const up = top.querySelector('.clockup'), t = mmss(Math.floor(elapsed())); if (up && up.textContent !== t) up.textContent = t;
      if (!resting()) return;
      const c = wpg.querySelector('.clock'), left = mmss(Math.ceil((S.restEnd - Date.now()) / 1000));
      if (c && c.dataset.t !== left) { c.dataset.t = left; c.innerHTML = num(left, BIG); }
      const tr = wpg.querySelector('.resttrack'); if (tr) tr.style.setProperty('--p', Math.min(1, Math.max(0, 1 - (S.restEnd - Date.now()) / 1000 / (S.restLen || 1))).toFixed(4));
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
      if (k === 'lw' || k === 'lr') { const l = sets()[sets().length - 1]; if (!l) return; if (k === 'lw') l.w = Math.max(0, l.w + d * item().step); else l.r = Math.max(1, l.r + d); return drawWork(); }
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
      else if (k[0] === 'q') { const [, qd, qi] = k.split('.'), i = +qi, x = S.plan[+qd].items[i], s = S.sess[S.week + '.' + qd]; x.sets = cl(x.sets + d, 1, 8); if (s && !s.end) s.need[i] = Math.max(x.sets, s.logs[i].length); }
      else if (k[0] === 'p' && S.sheet && S.sheet.kind === 'plan') { const i = S.sheet.i, dy = S.sheet.day != null ? S.sheet.day : S.day, x = S.plan[dy].items[i], s = S.sess[S.week + '.' + dy];
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
      else if (d.edit) openSheet({ kind: 'plan', i: +d.edit, day: S.day });
      else if (d.pday) { S.planDay = +d.pday; sheet.scrollTop = 0; drawSheet(); }
      else if (d.open) openSheet({ kind: 'plan', i: +d.open, day: +d.oday, back: true });
      else if (d.act === 'whole') { S.planDay = S.day < 5 ? S.day : 0; openSheet({ kind: 'whole' }); }
      else if (d.st) bump(d.st, +d.d);
      else if (d.rule) { S.rules[d.rule] = d.v; redraw(); }
      else if (d.act === 'start') openWork();
      else if (d.act === 'nextup') { const n = nextUp(); if (n) { S.week = n.week; S.day = n.day; openWork(); } }
      else if (d.act === 'weigh') openSheet({ kind: 'weigh' });
      else if (d.act === 'rules') openSheet({ kind: 'rules' });
      else if (d.act === 'edit') openSheet({ kind: 'plan', i: S.ex, day: S.day });
      else if (d.act === 'done') closeSheet(true);
      else if (d.act === 'back') backSheet();
      else if (d.act === 'export') { const out = JSON.stringify({ plan: S.plan, rules: S.rules, sessions: S.sess, weights: S.weights }, null, 1); try { navigator.clipboard.writeText(out).catch(() => {}); } catch (e) {} S.copied = true; drawPage(); setTimeout(() => { if (root.isConnected) { S.copied = false; if (S.tab === 'you' && !S.open) drawPage(); } }, 1600); }
      else if (d.act === 'close') closeWork();
      else if (d.act === 'go') go();
      else if (d.act === 'auto') { delete S.pin[item().name]; drawWork(); }
      else if (d.move) { S.sheet = null; drawSheet(); move(+d.move); drawDock(); }
      else if (d.rest) { S.restEnd += +d.rest * 1000; S.restLen = Math.max(15, S.restLen + +d.rest); if (!resting()) endRest(); else tick(); }
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
    const reset = () => { tourN++; S = fresh(); app.dataset.stage = 'today'; pg.style.display = ''; app.classList.remove('open'); drawSheet(); drawPage(true); drawDock(); };
    const inWork = (setup) => { reset(); sess(true).start = Date.now(); if (setup) setup(); openWork(true); };
    const dialled = () => { S.entry['1.0.0'] = { w: 30, r: 9 }; };
    const logged = (...sets) => { dialled(); sets.forEach(([r, rir]) => S.sess['1.0'].logs[0].push({ w: 30, r, rir })); };
    const TOUR = [
      () => { reset(); },
      () => { reset(); later(() => { S.planDay = 0; openSheet({ kind: 'whole' }); }, 500); later(() => bump('q.0.0', 1), 1300); later(() => bump('q.0.2', -1), 2000); later(() => openSheet({ kind: 'plan', i: 0, day: 0, back: true }), 2800); later(() => bump('p.rest', 1), 3500); },
      () => { reset(); later(() => openWork(), 500); },
      () => { inWork(); [500, 750, 1000, 1250, 1500, 1750].forEach((ms) => later(() => bump('w', 1), ms)); later(() => bump('r', 1), 2300); },
      () => { inWork(dialled); later(() => go(), 900); },
      () => { inWork(() => { logged([9, null]); S.restLen = 120; S.restEnd = Date.now() + 120000; }); later(() => { S.restEnd += 15000; S.restLen += 15; tick(); }, 1000); later(() => bump('lr', -1), 1800); later(() => { sets()[0].rir = 2; drawWork(); }, 2600); },
      () => { inWork(() => { logged([9, 2]); S.restLen = 120; S.restEnd = Date.now() + 40000; }); later(() => go(), 900); },
      () => { inWork(() => { logged([12, 2], [12, 2], [12, 1]); S.entry['1.0.0'] = { w: 30, r: 12 }; }); S.ex = 0; drawWork(); later(() => bump('nx', 1), 1500); },
      () => { reset(); S.tab = 'you'; drawPage(true); drawDock(); later(() => openSheet({ kind: 'rules' }), 500); later(() => { S.rules.miss = 'drop'; redraw(); }, 1400); later(() => bump('r.left', 1), 2200); later(() => bump('r.stall', 1), 3000); },
    ];
    reset();
    return (i) => TOUR[Math.min(i, TOUR.length - 1)]();
  },
});
}
