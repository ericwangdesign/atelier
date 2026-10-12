/* The sample design: ordering a coffee ahead, in four steps. A list, a size, a pay button, a pickup time.
   Try it: press Space to play, N to pin a note, then Send to Claude. Or open the Agent tab and Explore. */

{ // a block, so each scene's helpers stay its own
SCENES.push({
  id: 'order-v1',
  title: 'Coffee order',
  version: 'v1',
  note: 'A list, then a sheet',
  size: [1440, 900], // the screen this project opens on, until you pick another
  controls: [
    { key: 'accent', label: 'Accent', type: 'color', value: '#c8693c', css: '--accent' },
    { key: 'radius', label: 'Corners', type: 'range', min: 4, max: 28, step: 1, value: 16, unit: 'px', css: '--radius' },
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
      <p class="k">Rosso · Mission St</p>
      <h2>Coffee, ordered ahead.</h2>
      <p class="lede">Skip the line. Your cup is on the shelf when you walk in.</p>
      <div class="cup" aria-hidden="true"><i></i></div>
    </aside>
    <div class="phone">
      <header data-focus="header">
        <p class="k">Rosso · 4 min walk</p>
        <h1>Good morning</h1>
      </header>
      <ul class="menu" data-focus="menu">
        <li data-in="0" data-state="1.2:pick" data-focus="item"><span class="dot" style="--c:#d9a25f"></span><span><b>Flat white</b><small>Double shot, whole milk</small></span><em>4.80</em></li>
        <li data-in="0.05"><span class="dot" style="--c:#8a5a3c"></span><span><b>Long black</b><small>Ethiopia, washed</small></span><em>4.20</em></li>
        <li data-in="0.1"><span class="dot" style="--c:#efe2cf"></span><span><b>Oat cortado</b><small>Half and half</small></span><em>5.10</em></li>
        <li data-in="0.15"><span class="dot" style="--c:#6f7d4f"></span><span><b>Matcha</b><small>Ceremonial, iced</small></span><em>5.60</em></li>
      </ul>
      <section class="sheet" data-in="1.5" data-out="4" data-focus="sheet">
        <div class="grab"></div>
        <p class="sheet-t">Flat white</p>
        <div class="sizes" data-focus="size" data-state="2:m 2.6:l">
          <span data-v="s">Small</span><span data-v="m">Regular</span><span data-v="l">Large</span><i></i>
        </div>
        <button class="pay" data-focus="pay" data-state="3:idle 3.4:press 3.7:busy 4:idle"><span class="t">Pay 5.40</span><span class="spin"></span></button>
      </section>
      <div class="ready" data-in="4.1" data-focus="ready">
        <span class="tick">✓</span>
        <span><b>Ready at 8:42</b><small>Pickup shelf, by the window</small></span>
      </div>
    </div>
  </div>`,

  css: `
  .scene { --accent: #c8693c; --radius: 16px; --bg: #0f0e0d; --panel: #1a1816; --line: rgb(255 255 255 / .08); --fg: #f4efe8; --sub: #9a9289;
    background: var(--bg); color: var(--fg); font: 15px/1.45 -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .scene[data-mode=light] { --bg: #f4f1ec; --panel: #ffffff; --line: rgb(0 0 0 / .07); --fg: #1b1915; --sub: #7a7268; }
  .scene { container-type: inline-size; }
  .page { position: absolute; inset: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 430px); align-items: center; gap: 56px; padding: 48px 72px; overflow: hidden; }
  .hero { justify-self: end; max-width: 520px; display: flex; flex-direction: column; gap: 16px; }
  .hero .k { margin: 0; color: var(--sub); font-size: 14px; }
  .hero h2 { margin: 0; font-size: 60px; line-height: 1; font-weight: 650; letter-spacing: -.035em; }
  .lede { margin: 0; max-width: 24em; color: var(--sub); font-size: 18px; line-height: 1.45; }
  .cup { position: relative; width: 240px; aspect-ratio: 1; margin-top: 24px; border-radius: 50%; background: var(--panel); box-shadow: inset 0 0 0 1px var(--line), 0 30px 80px rgb(0 0 0 / .35); }
  .cup i { position: absolute; inset: 22px; border-radius: 50%;
    background: radial-gradient(circle at 50% 52%, #f1dcc0 0 18%, transparent 19%), radial-gradient(circle at 50% 45%, #f1dcc0 0 26%, transparent 27%),
      radial-gradient(circle, #c99566 0 58%, #8a5a3c 70%, #3a271c 100%); }
  @container (max-width: 760px) { .page { grid-template-columns: minmax(0, 1fr); justify-items: center; padding: var(--safe-top, 24px) 24px var(--safe-bottom, 24px); } .page .phone { height: 100%; } .hero { display: none; } }
  .phone { position: relative; width: min(390px, 100%); height: min(760px, 100%); display: flex; flex-direction: column; gap: 20px; padding: 28px 20px; }
  header .k { margin: 0; color: var(--sub); font-size: 13px; }
  h1 { margin: 4px 0 0; font-size: 30px; line-height: 1.1; font-weight: 650; letter-spacing: -.02em; min-height: 1.1em; }
  .menu { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .menu li { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: var(--radius); background: var(--panel); box-shadow: inset 0 0 0 1px var(--line);
    transition: box-shadow .3s, transform .3s cubic-bezier(.23, 1, .32, 1), opacity .35s; }
  .menu li[data-s=pick] { box-shadow: inset 0 0 0 1.5px var(--accent); transform: scale(1.015); }
  .menu li > span:nth-child(2) { flex: 1; display: flex; flex-direction: column; }
  .menu b { font-weight: 560; } .menu small, .ready small { color: var(--sub); font-size: 13px; }
  .menu em { font-style: normal; color: var(--sub); font-variant-numeric: tabular-nums; }
  .dot { width: 36px; height: 36px; flex: none; border-radius: 50%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 70%, #fff), var(--c)); }
  .sheet { position: absolute; left: 8px; right: 8px; bottom: 8px; padding: 10px 16px 16px; border-radius: calc(var(--radius) + 8px); background: var(--panel);
    box-shadow: 0 -12px 40px rgb(0 0 0 / .35), inset 0 0 0 1px var(--line); display: flex; flex-direction: column; gap: 14px; }
  .grab { width: 36px; height: 4px; margin: 0 auto; border-radius: 9px; background: var(--line); }
  .sheet-t { margin: 0; font-weight: 600; font-size: 17px; }
  .sizes { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); padding: 3px; border-radius: 999px; background: var(--bg); }
  .sizes span { position: relative; z-index: 1; text-align: center; padding: 8px 0; font-size: 14px; color: var(--sub); transition: color .25s; }
  .sizes i { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 3); border-radius: 999px; background: var(--panel); box-shadow: 0 1px 4px rgb(0 0 0 / .25);
    transition: transform .4s cubic-bezier(.23, 1, .32, 1); }
  .sizes[data-s=m] i { transform: translateX(100%); } .sizes[data-s=l] i { transform: translateX(200%); }
  .sizes[data-s=m] [data-v=m], .sizes[data-s=l] [data-v=l], .sizes:not([data-s]) [data-v=s] { color: var(--fg); }
  .pay { position: relative; height: 50px; border: 0; border-radius: 999px; background: var(--accent); color: #fff; font: 600 16px/1 -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif;
    transition: transform .15s, filter .15s; }
  .pay[data-s=press] { transform: scale(.97); filter: brightness(.9); }
  .pay .spin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px; border-radius: 50%; border: 2px solid rgb(255 255 255 / .35); border-top-color: #fff;
    opacity: 0; animation: spin .8s linear infinite; }
  .pay[data-s=busy] .t { opacity: 0; } .pay[data-s=busy] .spin { opacity: 1; }
  @keyframes spin { to { transform: rotate(1turn); } }
  .ready { position: absolute; left: 20px; right: 20px; bottom: 28px; display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: var(--radius);
    background: var(--panel); box-shadow: inset 0 0 0 1px var(--line); }
  .ready > span:last-child { display: flex; flex-direction: column; }
  .tick { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; }
  [data-in] { opacity: 0; transform: translateY(10px); transition: opacity .35s, transform .5s cubic-bezier(.23, 1, .32, 1); }
  .sheet[data-in] { transform: translateY(110%); opacity: 1; transition: transform .55s cubic-bezier(.32, .72, 0, 1); }
  [data-in].on { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { [data-in], .sheet[data-in] { transform: none; } }
  `,
});
}
