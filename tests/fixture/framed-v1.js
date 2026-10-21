/* A scene that frames a live page from our own server, the way the Sunday canvas does. For tests/stage.test.mjs. */
{
SCENES.push({
  id: 'framed-v1', title: 'Framed', version: 'v1', note: 'Test scene',
  steps: [{ label: 'One', dur: 1 }, { label: 'Two', dur: 3 }, { label: 'Three', dur: 1 }],
  html: '<iframe class="live" src="/p/fixture/page/index.html" title="Live page"></iframe>',
  css: '.live { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #fff; }',
});
}
