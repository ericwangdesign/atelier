/* A built scene: steps drive it (data-in, data-step, --p), CSS does the motion. For tests/stage.test.mjs. */
{
SCENES.push({
  id: 'built-v1', title: 'Built', version: 'v1', note: 'Test scene',
  steps: [{ label: 'Start', dur: 1 }, { label: 'Grow', dur: 3 }, { label: 'End', dur: 1 }],
  html: `
    <div class="card"><span class="tag">Tag</span><p class="words">Card words</p></div>
    <div class="box" data-in="1"></div>
    <div class="list">${Array.from({ length: 40 }, (_, i) => `<p>Row ${i + 1}</p>`).join('')}</div>
    <label class="tick"><input type="checkbox"> Tick</label>
    <div class="veil"></div>`,
  css: `
    .scene { background: #fff; font: 16px system-ui; }
    .card { position: absolute; left: 40px; top: 40px; width: 300px; height: 120px; background: #eee; }
    .tag { position: absolute; left: 12px; top: 12px; padding: 4px 8px; background: #0071e3; color: #fff; pointer-events: none; }
    .words { position: absolute; left: 12px; top: 60px; margin: 0; }
    .box { position: absolute; left: 400px; top: 40px; width: 200px; height: 120px; background: #0071e3; opacity: 0; transition: opacity 2s linear; }
    .box.on { opacity: 1; }
    .list { position: absolute; left: 40px; top: 200px; width: 300px; height: 300px; overflow: auto; background: #fafafa; }
    .tick { position: absolute; left: 400px; top: 220px; }
    .veil { position: absolute; inset: 0; background: linear-gradient(transparent, rgb(0 0 0 / .05)); pointer-events: none; }`,
});
}
