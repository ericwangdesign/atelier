/* A scene: what plays on the screens. Copy this file to make a new one, then add its name to index.js next to it.

   steps     One entry per step: a label for the timeline and how long it plays, in seconds.
   html      What the screen shows. Built once, then driven by the timeline.
   css       Styles for the html. They apply only inside this scene's screens.
   controls  Knobs for the panel (optional). css sets a variable on the scene, attr a data-attribute.

   Animate the html with attributes. A position is a step number plus a fraction: 1.5 is halfway through step 1.
   data-in="1.5"           gets class .on from 1.5 on (transition it in with CSS)
   data-out="3"            loses .on again at 3
   data-type="0-0.8"       types its text out between 0 and 0.8
   data-state="2:a 2.5:b"  sets data-s to the last state reached
   data-focus="card"       names a part, so Focus finds the same one in every design

   The scene root also carries data-step (the current step) and --p (progress through it, 0 to 1).

   On a phone or tablet the design runs the full height, under the status bar and home indicator, like the real
   thing. Keep content clear of them with var(--safe-top) and var(--safe-bottom) (0 on desktop sizes). */

{ // a block, so each scene's helpers stay its own
SCENES.push({
  id: 'first',
  title: 'First design',
  version: 'v1',
  note: 'The starter scene. Replace it with your own.',
  controls: [
    { key: 'radius', label: 'Corners', type: 'range', min: 0, max: 32, step: 1, value: 16, unit: 'px', css: '--radius' },
    { key: 'accent', label: 'Accent', type: 'color', value: '#5b7cfa', css: '--accent' },
  ],
  steps: [
    { label: 'Start', dur: 1.5 },
    { label: 'Card', dur: 2.5 },
    { label: 'Press', dur: 2 },
    { label: 'Done', dur: 2.5 },
  ],

  html: `
  <div class="page">
    <h1 data-in="0" data-type="0.1-0.9">Hello, atelier</h1>
    <div class="card" data-in="1" data-focus="card">
      <p class="k">Step 2</p>
      <p>A card rises in. Press the button on the next step.</p>
      <span class="btn" data-state="2:idle 2.4:press 2.7:idle" data-focus="button">Continue</span>
    </div>
    <div class="toast" data-in="3" data-focus="toast">Done. Now make it yours in scenes/first.js.</div>
  </div>`,

  css: `
  .scene { --bg: #141414; --fg: #f5f2ed; --sub: #8b8984; --card: #212121; --radius: 16px; --accent: #5b7cfa;
    background: var(--bg); color: var(--fg); font: 15px/1.6 "Inter Tight", system-ui, sans-serif; }
  .page { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 24px; padding: calc(var(--safe-top, 0px) + 32px) 32px calc(var(--safe-bottom, 0px) + 32px); }
  h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -.01em; min-height: 1.3em; }
  p { margin: 0; } .k { color: var(--sub); font-size: 13px; }
  .card { width: min(420px, 100%); display: flex; flex-direction: column; gap: 12px; padding: 20px; border-radius: var(--radius); background: var(--card); }
  .btn { align-self: flex-start; padding: 8px 16px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 500; transition: transform .15s, filter .15s; }
  .btn[data-s=press] { transform: scale(.94); filter: brightness(.85); }
  .toast { padding: 10px 16px; border-radius: 999px; background: var(--card); color: var(--sub); }
  [data-in] { opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .45s cubic-bezier(.23, 1, .32, 1); }
  [data-in].on { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { [data-in] { transform: none; } }
  `,
});
}
