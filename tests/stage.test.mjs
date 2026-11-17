/* The stage's pointer and playback traps, checked in a real (headless) Chrome: `npm test`.
   Each check is a bug Eric hit once (Oct 18). It serves this folder itself and answers every /api call with a stub, so
   it never needs serve.py and never touches a real project: the designs are tests/fixture (built-v1, framed-v1). */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)), FIXTURE = join(ROOT, 'tests', 'fixture');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const json = (res, body, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
let version = 0, stored = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = decodeURIComponent(url.pathname);
  if (p === '/api/projects') return json(res, [{ id: 'fixture', name: 'Fixture', path: 'atelier/tests/fixture/', fonts: false }]);
  if (p === '/api/notes') { // keeps what the page saves, so a poll never takes its notes away
    if (req.method === 'GET') return json(res, { notes: stored, version: String(version) });
    let body = ''; for await (const c of req) body += c; stored = JSON.parse(body).notes || []; return json(res, { version: String(++version) });
  }
  if (p === '/api/state') return json(res, req.method === 'GET' ? { state: {}, version: '0' } : { version: String(++version) });
  if (p === '/api/trail') return json(res, { trail: [] });
  if (p === '/api/taste') return json(res, { on: false, lines: [] });
  if (p === '/api/snap') return json(res, { file: 'snap.png' });
  if (p.startsWith('/api/')) return json(res, {});
  if (p === '/stage.html' && process.env.STAGE) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(await readFile(process.env.STAGE)); } // STAGE=old.html: does the test catch the old bugs?
  const file = p.startsWith('/p/fixture/') ? join(FIXTURE, normalize(p.slice('/p/fixture/'.length))) : join(ROOT, normalize(p === '/' ? 'index.html' : p.slice(1)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
const SERVE = process.argv.includes('--serve'); // just the fixture project on :4399, to look at by hand
await new Promise(ok => server.listen(SERVE ? 4399 : 0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;
if (SERVE) { console.log(`${BASE}/stage.html?project=fixture`); await new Promise(() => {}); }

const browser = await chromium.launch({ channel: 'chrome' });
let failed = 0;
const errors = [];
async function stage(design, init) {
  stored = []; // every page starts with no notes
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  if (init) await ctx.addInitScript(init); // before the stage's own script: stand-ins for what the browser has
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${design}: ${e.message}`));
  // a fresh browser each time: no workspace kept from another check
  await page.goto(`${BASE}/stage.html?project=fixture&design=${design}`);
  await page.waitForFunction(() => typeof screens !== 'undefined' && screens[0] && screens[0].layers[0] && screens[0].layers[0].root);
  if (design === 'framed-v1') await page.waitForFunction(() => { const f = screens[0].layers[0].root.querySelector('iframe'); return f && f.contentDocument && f.contentDocument.querySelector('.row'); });
  // an older stage (STAGE=…) lacks these: stand-ins, so its bugs show up as failed checks rather than a crash
  await page.evaluate(() => {
    if (typeof setPlaying !== 'function') window.setPlaying = on => { playing = on; drive(); };
    if (typeof rectOf !== 'function') window.rectOf = el => { const f = el.ownerDocument.defaultView.frameElement, r = el.getBoundingClientRect(); if (!f) return r; const b = f.getBoundingClientRect(), k = b.width / f.offsetWidth; return { left: b.left + r.left * k, top: b.top + r.top * k, width: r.width * k, height: r.height * k }; };
  });
  await page.evaluate(() => { setPlaying(false, 'land'); seek(0); });
  return { page, ctx };
}
async function check(name, fn) {
  try { await fn(); console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
// a point on the screen, from a point in the design (design pixels)
const at = (page, x, y) => page.evaluate(([x, y]) => { const r = screens[0].layers[0].root.getBoundingClientRect(); return { x: r.left + x * K, y: r.top + y * K }; }, [x, y]);
const frameEl = page => page.frames().find(f => f.url().includes('/p/fixture/page/'));
// centre of an element inside the framed page, on screen
const inFrame = (page, sel) => page.evaluate(sel => { const f = screens[0].layers[0].root.querySelector('iframe'), el = f.contentDocument.querySelector(sel), r = rectOf(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const lastNote = page => page.evaluate(() => S.notes.at(-1) || null);

console.log('Pause holds everything still');
{
  const { page, ctx } = await stage('built-v1');
  await check('a built scene: a step\'s transition stops when paused, and goes on when played', async () => {
    await page.evaluate(() => { seek(0.8); setPlaying(true); });
    await wait(500); // into step 2: the box's 2s fade is under way
    await page.click('#play');
    const op = () => page.evaluate(() => getComputedStyle(screens[0].layers[0].root.querySelector('.box')).opacity);
    await wait(60); const a = await op(); await wait(400); const b = await op();
    expect(+a > 0 && +a < 1, `the fade should be part way when paused, was ${a}`);
    expect(a === b, `the fade kept going while paused: ${a} then ${b}`);
    expect(await page.evaluate(() => screens[0].layers[0].root.hasAttribute('data-paused')), 'the scene root has no data-paused while paused');
    await page.click('#play'); await wait(300);
    expect(+(await op()) > +b, 'the fade did not go on after play');
    expect(!(await page.evaluate(() => screens[0].layers[0].root.hasAttribute('data-paused'))), 'data-paused stayed on while playing');
  });
  await check('a step picked while paused shows that step at rest', async () => {
    await page.evaluate(() => setPlaying(false));
    await page.evaluate(() => { seek(0); }); await page.click('#next');
    expect(await page.evaluate(() => getComputedStyle(screens[0].layers[0].root.querySelector('.box')).opacity) === '1', 'the step\'s fade was left part way');
  });
  await ctx.close();
}
{
  const { page, ctx } = await stage('framed-v1');
  await check('a framed live page: its scene root says paused, its own animations stop, it holds its timers', async () => {
    await page.evaluate(() => setPlaying(true)); await wait(200);
    await page.click('#play'); await wait(60);
    const f = frameEl(page), get = () => f.evaluate(() => ({ paused: document.body.dataset.paused, ticks: document.body.dataset.ticks, bar: getComputedStyle(document.querySelector('.bar')).transform }));
    const a = await get(); await wait(400); const b = await get();
    expect(a.paused === 'true', 'the page never saw data-paused');
    expect(a.ticks === b.ticks, 'the page\'s timers kept going');
    expect(a.bar === b.bar, 'the page\'s CSS animation kept going');
    await page.click('#play'); await wait(300); const c = await get();
    expect(c.paused === 'false' && c.ticks !== b.ticks && c.bar !== b.bar, `the page did not go on after play: ${JSON.stringify([b, c])}`);
  });
  await ctx.close();
}

console.log('Note mode leaves the design usable');
{
  const { page, ctx } = await stage('built-v1');
  await page.keyboard.press('n');
  await check('the wheel scrolls a list in the design', async () => {
    const p = await at(page, 150, 300); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 300); await wait(150);
    expect(await page.evaluate(() => screens[0].layers[0].root.querySelector('.list').scrollTop) > 0, 'the list did not scroll');
  });
  await check('a click pins a note and leaves the design alone', async () => {
    const p = await at(page, 410, 230); const before = await page.evaluate(() => S.notes.length);
    await page.mouse.click(p.x, p.y); await wait(100);
    expect(await page.evaluate(() => S.notes.length) === before + 1, 'no note was pinned');
    expect(!(await page.evaluate(() => screens[0].layers[0].root.querySelector('input').checked)), 'the click went through to the design');
    await page.keyboard.press('Escape'); // close the editor (the empty note goes)
  });
  await check('holding ⌥ hands the click to the design', async () => {
    const p = await at(page, 410, 230), before = await page.evaluate(() => S.notes.length);
    await page.keyboard.down('Alt'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Alt'); await wait(100);
    expect(await page.evaluate(() => screens[0].layers[0].root.querySelector('input').checked), 'the checkbox did not take the click');
    expect(await page.evaluate(() => S.notes.length) === before, 'a note was pinned anyway');
    expect(await page.evaluate(() => noting && !document.body.classList.contains('through')), 'note mode did not come back after ⌥');
  });
  await check('a click on a pin in note mode opens that note, not a new one', async () => {
    const p = await at(page, 200, 100);
    await page.mouse.click(p.x, p.y); await page.keyboard.type('keep'); await page.keyboard.press('Enter'); await wait(100);
    const n = await page.evaluate(() => S.notes.length), pin = await page.evaluate(() => { const r = document.querySelector('.pin').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(pin.x, pin.y); await wait(100);
    expect(await page.evaluate(() => S.notes.length) === n, 'clicking the pin made another note');
    expect(await page.evaluate(() => !!editing && editing.text === 'keep'), 'the pin\'s note did not open');
    await page.keyboard.press('Escape');
  });
  await check('a note picks a click-through label, never a click-through veil over everything', async () => {
    const p = await at(page, 70, 62); await page.mouse.click(p.x, p.y); await wait(100);
    const n = await lastNote(page);
    expect(n && /class="tag"/.test(n.on), `the note is on ${n && n.on}`);
    await page.keyboard.press('Escape');
  });
  await check('Esc leaves no catcher behind', async () => {
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !noting && getComputedStyle(document.querySelector('.catch')).display === 'none' && !/noting|cutting|picking|through/.test(document.body.className)), `a mode is still on: ${await page.evaluate(() => [noting, !!editing, document.activeElement.tagName, document.body.className])}`);
  });
  await ctx.close();
}
{
  const { page, ctx } = await stage('framed-v1');
  await page.keyboard.press('n');
  await check('the wheel scrolls the framed page', async () => {
    const p = await inFrame(page, '.scroll'); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 300); await wait(150);
    expect(await frameEl(page).evaluate(() => document.querySelector('.scroll').scrollTop) > 0, 'the framed page did not scroll');
  });
  await check('a note on a framed page is on the element, not on the frame', async () => {
    const p = await inFrame(page, '.ml'); await page.mouse.click(p.x, p.y); await wait(100);
    const n = await lastNote(page);
    expect(n && /class="ml"/.test(n.on) && /in the framed page/.test(n.on), `the note is on ${n && n.on}`);
    expect(n.anchor && n.anchor.frame, 'the note does not follow what it is on');
    await page.keyboard.type('label'); await page.keyboard.press('Enter');
  });
  await check('a note on a framed page follows it as it scrolls', async () => {
    const r = await inFrame(page, '.scroll .row:nth-child(12)'); await page.mouse.click(r.x, r.y); await wait(100); // in view after the scroll above
    await page.keyboard.type('row'); await page.keyboard.press('Enter'); await wait(100);
    const pinY = () => page.evaluate(() => { const p = [...document.querySelectorAll('.pin')].at(-1); return p.getBoundingClientRect().top; });
    const y0 = await pinY(); await page.mouse.move(r.x, r.y); await page.mouse.wheel(0, -1000); await wait(300);
    expect(Math.abs(await pinY() - y0) > 20, `the pin stayed put while the page scrolled: ${await page.evaluate(() => JSON.stringify([S.notes.map(n => [n.text, n.on.slice(0, 40), !!n.anchor]), screens[0].layers[0].root.querySelector('iframe').contentDocument.querySelector('.scroll').scrollTop]))}`);
  });
  await check('holding ⌥ presses a button in the framed page', async () => {
    const p = await inFrame(page, '.press');
    await page.keyboard.down('Alt'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Alt'); await wait(100);
    expect(await frameEl(page).evaluate(() => document.body.dataset.presses) === '1', 'the button did not take the click');
  });
  await page.keyboard.press('Escape'); await page.evaluate(() => noting && setNoting(false));
  await check('the cut tool outlines framed elements and walks up out of the page', async () => {
    await page.keyboard.press('x');
    const p = await inFrame(page, '.press'); await page.mouse.move(p.x, p.y); await wait(50); await page.mouse.move(p.x + 1, p.y); await wait(50);
    const label = () => page.evaluate(() => document.getElementById('cutlabel').textContent);
    expect(/^button\.press/.test(await label()), `the cut outline is on ${await label()}`);
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
    expect(/^iframe\.live/.test(await label()), `walking up stopped at ${await label()}`);
    await page.keyboard.press('Escape');
  });
  await check('a click into the framed page closes the open note, as a click anywhere else does', async () => {
    await page.keyboard.press('n'); const p = await inFrame(page, '.bar'); await page.mouse.click(p.x, p.y); await page.keyboard.type('draft');
    await page.evaluate(() => setNoting(false)); // the editor stays open, note mode is off
    const q = await inFrame(page, '.press'); await page.mouse.click(q.x, q.y); await wait(100);
    expect(await page.evaluate(() => !editing && S.notes.some(n => n.text === 'draft')), 'the editor stayed open (or lost the draft)');
  });
  await check('keys typed inside the framed page reach the stage', async () => {
    const p = await inFrame(page, '.press'); await page.mouse.click(p.x, p.y); // no mode: the click lands in the page
    await frameEl(page).evaluate(() => document.body.focus());
    await frameEl(page).press('body', 'n');
    expect(await page.evaluate(() => noting), `N inside the page did not start note mode (${await page.evaluate(() => [document.activeElement.tagName, editing && editing.text, cutting, picking, document.body.className])})`);
    await frameEl(page).press('body', 'Escape');
    expect(!(await page.evaluate(() => noting)), 'Esc inside the page did not end note mode');
  });
  await ctx.close();
}

console.log('Notes carry more than words');
{
  const { page, ctx } = await stage('built-v1');
  const snaps = []; page.on('request', r => { if (r.url().includes('/api/snap')) snaps.push(JSON.parse(r.postData()).data); });
  // how many pixels of a picture are the stage's blue
  const blue = data => page.evaluate(async d => { const im = new Image(); im.src = d; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - 77) < 30 && Math.abs(px[i + 1] - 166) < 30 && px[i + 2] > 220) n++; return n; }, data);
  const drag = async (a, b, steps = 8) => { const p = await at(page, ...a), q = await at(page, ...b); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps }); await page.mouse.up(); };
  await page.keyboard.press('n');
  await check('markup: a circle and an arrow are drawn on the note, named by what they are on, and ⌘Z takes one back', async () => {
    const p = await at(page, 200, 100); await page.mouse.click(p.x, p.y); await wait(300);
    await page.click('#poptools [data-tool="ellipse"]');
    expect(await page.evaluate(() => document.body.classList.contains('marking') && document.activeElement.id === 'poptext'), 'the tool did not come up (or the note lost the caret)');
    await drag([44, 90], [160, 130]);
    let n = await page.evaluate(() => editing);
    expect(n && n.marks && n.marks.length === 1 && /^Circled .*class="words"/.test(n.marks[0].on), `the circle is on ${n && JSON.stringify(n.marks)}`);
    expect(await page.evaluate(() => { const m = document.querySelector('.ink.on'); return m && getComputedStyle(m).display !== 'none'; }), 'the markup does not show while the note is open');
    await page.keyboard.press('Meta+z');
    expect(await page.evaluate(() => !editing.marks), '⌘Z did not take the circle back');
    await drag([44, 90], [160, 130]);
    await page.click('#poptools [data-tool="arrow"]'); await drag([70, 62], [420, 232]);
    n = await page.evaluate(() => editing);
    expect(n.marks.length === 2 && /^Arrow from <span class="tag"/.test(n.marks[1].on), `the arrow is ${JSON.stringify(n.marks[1])}`);
    expect(await page.evaluate(() => editing && !!document.querySelector('.pin.open')), 'drawing closed the note');
  });
  await check('markup: kept with the note, in the brief and baked into its snapshot, and off the design once the note closes', async () => {
    await page.keyboard.type('look'); await page.keyboard.press('Enter'); await wait(400);
    const n = await lastNote(page), b = await page.evaluate(() => brief());
    expect(n.text === 'look' && n.marks.length === 2, 'the note lost its markup');
    expect(/Markup \(drawn in blue/.test(b) && /1\. Circled/.test(b) && /2\. Arrow from/.test(b), 'the brief does not name the markup');
    expect(await page.evaluate(() => [...document.querySelectorAll('.ink')].every(m => getComputedStyle(m).display === 'none')), `markup stays on the design after the note closed: ${await page.evaluate(() => [...document.querySelectorAll('.ink')].map(m => m.getAttribute('class') + ' ' + getComputedStyle(m).display).join())}`);
    const pin = await page.evaluate(() => { const r = [...document.querySelectorAll('.pin')].at(-1).getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; });
    await page.mouse.move(pin.x, pin.y); await wait(50);
    expect(await page.evaluate(() => [...document.querySelectorAll('.ink')].some(m => getComputedStyle(m).display !== 'none')), 'pointing at the pin does not show its markup');
    expect(snaps.length >= 2, `the snapshot was not taken again with the markup (${snaps.length})`);
    const [a, z] = [await blue(snaps[0]), await blue(snaps.at(-1))];
    expect(z > a * 2 && z > 400, `the snapshot has no markup in it: ${a} blue pixels before, ${z} after`);
    await page.mouse.move(5, 5);
  });
  await check('markup: Esc puts the tool down first, then cancels what was drawn', async () => {
    await page.keyboard.press('Escape'); // note mode off
    const p = await at(page, 600, 300); await page.keyboard.press('n'); await page.mouse.click(p.x, p.y); await wait(300);
    await page.click('#poptools [data-tool="rect"]'); await drag([560, 260], [640, 340]);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !!editing && !marking && editing.marks.length === 1), 'the first Esc did not just put the tool down');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !editing && !S.notes.some(n => n.marks && n.marks.some(m => m.t === 'rect'))), 'Esc kept the drawing');
    await page.keyboard.press('Escape');
  });
  await check('edit words in place: a double click edits them, Return notes the old and new words, and the screen keeps showing them', async () => {
    await page.keyboard.press('n');
    const before = await page.evaluate(() => S.notes.length), p = await at(page, 70, 108);
    await page.mouse.dblclick(p.x, p.y); await wait(150);
    expect(await page.evaluate(() => !!texting && texting.el.isContentEditable && texting.el.matches('.words')), `no edit on the words (${await page.evaluate(() => texting && texting.el.outerHTML)})`);
    expect(await page.evaluate(() => S.notes.length) === before, 'the double click left a note behind');
    await page.keyboard.type('Fresh words'); await page.keyboard.press('Enter'); await wait(150);
    const n = await lastNote(page), words = () => page.evaluate(() => screens[0].layers[0].root.querySelector('.words').textContent);
    expect(n.edit && n.edit.old === 'Card words' && n.edit.new === 'Fresh words' && /p\.words/.test(n.edit.path), `the note's edit is ${JSON.stringify(n.edit)}`);
    expect(await page.evaluate(() => !!editing && !document.querySelector('#popedit').hidden), 'the note did not open with its edit');
    await page.keyboard.press('Enter'); await wait(100);
    expect((await lastNote(page)).text === 'Text: "Card words" → "Fresh words"', `the note's text is ${(await lastNote(page)).text}`);
    expect(/Text edit on .*p\.words.*from "Card words" to "Fresh words"/.test(await page.evaluate(() => brief())), 'the brief does not carry the edit');
    expect(await words() === 'Fresh words', 'the screen lost the new words');
    await page.evaluate(() => { screens[0].layers[0].root.querySelector('.words').textContent = 'Card words'; }); await wait(450); // the design redraws
    expect(await words() === 'Fresh words', 'the preview did not come back after a redraw');
    await page.evaluate(() => { const n = S.notes.at(-1); dropNote(n); touch(n, true); renderNotes(); });
    expect(await words() === 'Card words', 'deleting the note left its words on screen');
  });
  await check('edit words in place: Esc puts the words back and makes no note', async () => {
    const before = await page.evaluate(() => S.notes.length), p = await at(page, 60, 260);
    await page.mouse.dblclick(p.x, p.y); await wait(150);
    const el = await page.evaluate(() => texting && texting.el.textContent);
    await page.keyboard.type('zzz'); await page.keyboard.press('Escape'); await wait(100);
    expect(await page.evaluate(([t]) => !texting && [...screens[0].layers[0].root.querySelectorAll('.list p')].some(p => p.textContent === t && !p.isContentEditable), [el]), `the words did not come back (${el})`);
    expect(await page.evaluate(() => S.notes.length) === before && await page.evaluate(() => noting), 'Esc made a note or left note mode');
    await page.keyboard.press('Escape');
  });
  await check('Edit CSS: on a cut element, a change shows on that element only and the note carries old → new', async () => {
    await page.keyboard.press('x');
    const p = await at(page, 70, 108); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); await wait(200);
    expect(await page.evaluate(() => editing && editing.cut && !$('popcssbtn').hidden), 'no Edit CSS on the cut');
    await page.click('#popcssbtn');
    const size = '#popcss [data-p="font-size"] input';
    expect(await page.$eval(size, i => i.value) === '16px', 'the size field does not start at the element\'s size');
    await page.fill(size, '24px');
    const css = (sel, prop) => page.evaluate(([sel, prop]) => getComputedStyle(screens[0].layers[0].root.querySelector(sel))[prop], [sel, prop]);
    expect(await css('.words', 'fontSize') === '24px' && await css('.tag', 'fontSize') === '16px', 'the size did not show on the element alone');
    await page.focus(size); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowUp');
    expect(await css('.words', 'fontSize') === '35px', `↑ and ⇧↑ did not step the size: ${await css('.words', 'fontSize')}`);
    await page.click('#popcss [data-p="color"] .swatch');
    expect(await page.evaluate(() => ColorPick.isOpen() && !!editing), 'the colour picker did not open (or closed the note)');
    await page.evaluate(() => { const i = document.querySelector('.cpick .cp-in input'); i.value = 'FF0000'; i.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(await css('.words', 'color') === 'rgb(255, 0, 0)', 'the colour did not show');
    const n = await page.evaluate(() => editing);
    expect(n.css['font-size'][0] === '16px' && n.css['font-size'][1] === '35px' && n.css.color[1] === '#ff0000', `the note's diff is ${JSON.stringify(n.css)}`);
    await page.evaluate(() => ColorPick.close()); await page.focus('#poptext'); await page.keyboard.type('bigger'); await page.keyboard.press('Enter'); await wait(100);
    expect(/CSS edits on .*p\.words.*font-size 16px → 35px; color #000000 → #ff0000/.test(await page.evaluate(() => brief())), `the brief does not carry the CSS: ${await page.evaluate(() => brief().split('\n').find(l => /CSS/.test(l)))}`);
    expect(await css('.words', 'fontSize') === '35px', 'the preview went when the note closed');
  });
  await check('a cut that draws as nothing shows no picture: the blank snapshot is hidden, a real one shows', async () => {
    await page.evaluate(() => screens[0].layers[0].root.insertAdjacentHTML('beforeend', '<div class="blank" style="position:absolute;left:700px;top:420px;width:200px;height:140px;background:#fff"></div>'));
    const p = await at(page, 800, 490); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); await wait(1500);
    let n = await page.evaluate(() => editing && { blank: editing.snapBlank, snap: editing.snap, cut: editing.cut.path, img: $('popsnap').hidden, shot: $('popshot').hidden });
    expect(n && /div\.blank/.test(n.cut) && n.blank && !n.snap && n.img && !n.shot, `the blank cut shows a picture: ${JSON.stringify(n)}`);
    await page.keyboard.press('Escape');
    const q = await at(page, 200, 140); await page.mouse.move(q.x, q.y); await page.mouse.click(q.x, q.y); await wait(1500);
    n = await page.evaluate(() => editing && { blank: editing.snapBlank, snap: editing.snap, cut: editing.cut.path, img: $('popsnap').hidden });
    expect(n && /div\.card/.test(n.cut) && !n.blank && n.snap && !n.img, `the card's cut has no picture: ${JSON.stringify(n)}`);
    await page.keyboard.press('Escape');
  });
  await check('Edit CSS: Esc takes the values back, deleting the note takes the preview off', async () => {
    const pin = await page.evaluate(() => { const r = [...document.querySelectorAll('.pin')].at(-1).getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; });
    await page.mouse.click(pin.x, pin.y); await wait(100); await page.click('#popcssbtn');
    await page.fill('#popcss [data-p="padding"] input', '20px'); await page.keyboard.press('Escape'); await wait(100);
    const css = prop => page.evaluate(prop => getComputedStyle(screens[0].layers[0].root.querySelector('.words'))[prop], prop);
    expect(await css('paddingTop') === '0px' && await css('fontSize') === '35px', 'Esc kept the padding, or lost the earlier edits');
    expect(await page.evaluate(() => !S.notes.at(-1).css.padding), 'Esc kept the padding in the note');
    await page.evaluate(() => { const n = S.notes.at(-1); dropNote(n); touch(n, true); renderNotes(); });
    expect(await css('fontSize') === '16px' && await css('color') === 'rgb(0, 0, 0)', 'deleting the note left its CSS on screen');
    await page.keyboard.press('Escape');
  });
  await ctx.close();
}

{
  const { page, ctx } = await stage('framed-v1');
  await check('edit words in place on a framed page: the element in the page, kept as a preview', async () => {
    await page.keyboard.press('n');
    const p = await inFrame(page, '.ml'), old = await frameEl(page).evaluate(() => document.querySelector('.ml').textContent);
    await page.mouse.dblclick(p.x, p.y); await wait(150);
    expect(await page.evaluate(() => !!texting && !!frameOf(texting.el)), 'no edit in the framed page');
    await page.keyboard.type('Framed words'); await page.keyboard.press('Enter'); await wait(150);
    const n = await lastNote(page);
    expect(n.edit && n.edit.old === old.replace(/\s+/g, ' ').trim() && n.edit.new === 'Framed words' && n.edit.ref.frame, `the note's edit is ${JSON.stringify(n.edit)}`);
    expect(await frameEl(page).evaluate(() => document.querySelector('.ml').textContent) === 'Framed words', 'the page lost the new words');
    await page.keyboard.press('Escape');
  });
  await ctx.close();
}

if (errors.length) { failed++; console.log('  FAIL errors on the page\n       ' + errors.join('\n       ')); }
await browser.close(); server.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
