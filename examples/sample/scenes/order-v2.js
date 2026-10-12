/* The second version of the sample: the same order as a grid of cards, and the size picked on the card itself.
   Same step labels as v1, so the two play in step when compared. */

{
SCENES.push({
  id: 'order-v2',
  title: 'Coffee order',
  version: 'v2',
  note: 'Cards, size on the card',
  size: [1440, 900], // the screen this project opens on, until you pick another
  controls: [
    { key: 'accent', label: 'Accent', type: 'color', value: '#c8693c', css: '--accent' },
    { key: 'radius', label: 'Corners', type: 'range', min: 4, max: 28, step: 1, value: 20, unit: 'px', css: '--radius' },
    { key: 'mode', label: 'Mode', type: 'seg', options: [['dark', 'Dark'], ['light', 'Light']], value: 'dark', attr: 'mode' },
  ],
  steps: [
    { label: 'Menu', dur: 2 },
    { label: 'Pick', dur: 2 },
    { label: 'Size', dur: 2.2 },
    { label: 'Pay', dur: 2 },
    { label: 'Ready', dur: 2.6 },
  ],

  html: `
  <div class="page">
    <aside class="hero" data-focus="hero">
      <h2>Rosso</h2>
      <p class="lede">Coffee for the walk to work. Order on the way, pick it up without stopping.</p>
      <div class="facts"><span><b>6</b> min</span><span><b>2</b> blocks</span><span>Open till <b>6</b></span></div>
    </aside>
    <div class="phone">
      <header data-focus="header">
        <h1>What are we having?</h1>
        <p class="k" data-in="0.05">Rosso · ready in about 6 min</p>
      </header>
      <div class="grid" data-focus="menu">
        <div class="card" data-in="0" data-state="1.2:pick" data-focus="item" style="--c:#d9a25f"><span class="cup"></span><b>Flat white</b><em>4.80</em>
          <div class="sizes" data-in="2" data-focus="size" data-state="2:m 2.6:l"><span data-v="s">S</span><span data-v="m">M</span><span data-v="l">L</span></div></div>
        <div class="card" data-in="0.05" style="--c:#8a5a3c"><span class="cup"></span><b>Long black</b><em>4.20</em></div>
        <div class="card" data-in="0.1" style="--c:#efe2cf"><span class="cup"></span><b>Oat cortado</b><em>5.10</em></div>
        <div class="card" data-in="0.15" style="--c:#6f7d4f"><span class="cup"></span><b>Matcha</b><em>5.60</em></div>
      </div>
      <button class="pay" data-in="1.4" data-focus="pay" data-state="3:idle 3.4:press 3.7:busy 4:done"><span class="t">Pay 5.40</span><span class="spin"></span><span class="ok">Paid</span></button>
      <div class="ready" data-in="4.1" data-focus="ready"><b>8:42</b><span>Your flat white will be on the shelf by the window.</span></div>
    </div>
  </div>`,

  css: `
  .scene { --accent: #c8693c; --radius: 20px; --bg: #0f0e0d; --panel: #1a1816; --line: rgb(255 255 255 / .08); --fg: #f4efe8; --sub: #9a9289;
    background: var(--bg); color: var(--fg); font: 15px/1.45 -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .scene[data-mode=light] { --bg: #f4f1ec; --panel: #ffffff; --line: rgb(0 0 0 / .07); --fg: #1b1915; --sub: #7a7268; }
  .scene { container-type: inline-size; }
  .page { position: absolute; inset: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 430px); align-items: center; gap: 56px; padding: 48px 72px; overflow: hidden; }
  .hero { justify-self: end; max-width: 520px; display: flex; flex-direction: column; gap: 20px; }
  .hero h2 { margin: 0; font-size: 120px; line-height: .9; font-weight: 700; letter-spacing: -.05em; color: var(--accent); }
  .lede { margin: 0; max-width: 22em; color: var(--sub); font-size: 18px; line-height: 1.45; }
  .facts { display: flex; gap: 8px; flex-wrap: wrap; }
  .facts span { padding: 8px 14px; border-radius: 999px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--line); color: var(--sub); font-size: 14px; }
  .facts b { color: var(--fg); font-weight: 600; }
  @container (max-width: 760px) { .page { grid-template-columns: minmax(0, 1fr); justify-items: center; padding: var(--safe-top, 24px) 24px var(--safe-bottom, 24px); } .page .phone { height: 100%; } .hero { display: none; } }
  .phone { position: relative; width: min(390px, 100%); height: min(760px, 100%); display: flex; flex-direction: column; gap: 18px; padding: 28px 20px; }
  h1 { margin: 0; font-size: 26px; line-height: 1.15; font-weight: 650; letter-spacing: -.02em; min-height: 1.15em; }
  header .k { margin: 6px 0 0; color: var(--sub); font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 14px; aspect-ratio: 1 / 1.08; border-radius: var(--radius); background: var(--panel);
    box-shadow: inset 0 0 0 1px var(--line); transition: box-shadow .3s, transform .35s cubic-bezier(.23, 1, .32, 1), opacity .35s; }
  .card[data-s=pick] { box-shadow: inset 0 0 0 1.5px var(--accent); transform: scale(1.03); z-index: 1; }
  .cup { flex: 1; margin-bottom: 8px; border-radius: calc(var(--radius) - 8px); background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--c) 75%, #fff) 0 22%, var(--c) 23% 34%, transparent 35%), color-mix(in srgb, var(--c) 14%, var(--panel)); }
  .card b { font-weight: 560; } .card em { font-style: normal; color: var(--sub); font-size: 13px; font-variant-numeric: tabular-nums; }
  .sizes { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 4px; }
  .sizes span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--bg); color: var(--sub); font-size: 12px; font-weight: 600; transition: background .25s, color .25s; }
  .sizes[data-s=m] [data-v=m], .sizes[data-s=l] [data-v=l] { background: var(--accent); color: #fff; }
  .pay { position: relative; margin-top: auto; height: 52px; border: 0; border-radius: calc(var(--radius) - 4px); background: var(--accent); color: #fff;
    font: 600 16px/1 -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif; transition: transform .15s, filter .15s, background .3s; }
  .pay[data-s=press] { transform: scale(.97); filter: brightness(.9); }
  .pay .spin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; border-radius: 50%; border: 2px solid rgb(255 255 255 / .35); border-top-color: #fff; opacity: 0; animation: spin .8s linear infinite; }
  .pay .ok { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; }
  .pay[data-s=busy] .t, .pay[data-s=done] .t { opacity: 0; } .pay[data-s=busy] .spin { opacity: 1; } .pay[data-s=done] .ok { opacity: 1; }
  @keyframes spin { to { transform: rotate(1turn); } }
  .ready { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 32px; background: var(--bg); }
  .ready b { font-size: 64px; line-height: 1; font-weight: 650; letter-spacing: -.04em; color: var(--accent); font-variant-numeric: tabular-nums; }
  .ready span { font-size: 18px; max-width: 16em; color: var(--fg); }
  [data-in] { opacity: 0; transform: translateY(10px); transition: opacity .35s, transform .5s cubic-bezier(.23, 1, .32, 1); }
  .sizes[data-in] { transform: scale(.8); }
  [data-in].on { opacity: 1; transform: none; }
  .card[data-in].on[data-s=pick] { transform: scale(1.03); }
  @media (prefers-reduced-motion: reduce) { [data-in] { transform: none; } }
  `,
});
}
