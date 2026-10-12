/* Export what's on the stage as a PNG, GIF or MP4. serve.py runs this for /api/capture.

     echo '{"url": "...", "storage": {...}, "format": "mp4", "outs": ["/path/a.mp4", "/path/b.mp4"]}' | node capture.mjs

   It opens the stage in a hidden Chrome with the same settings as the page that asked (its localStorage), in
   capture mode (?capture=1): no panel, bar or labels, every screen at 100%. Each screen's content becomes its own
   file (outs, in screen order): just the design, without the wallpaper or the device frame around it.
   PNG: the step you were on, at 2×. GIF and MP4: the flow played once from the start, in real time (the scenes
   animate with CSS transitions, so it records rather than steps), all screens at once, then cut apart.

   Needs playwright-core and ffmpeg-static: run npm install in the atelier folder once. $ATELIER_DEPS can point at
   another node_modules that has them. Chrome itself is the system one. */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOTS = [process.env.ATELIER_DEPS || process.env.WORKSPACE_DEPS, join(here, 'node_modules')].filter(Boolean);
function need(name) {
  for (const r of ROOTS) try { return require(require.resolve(name, { paths: [r] })); } catch {}
  throw new Error(`${name} not found (looked in ${ROOTS.join(', ')}). Run npm install in the atelier folder`);
}
const { chromium } = need('playwright-core');
const ffmpeg = need('ffmpeg-static');

const job = JSON.parse(readFileSync(0, 'utf8'));
const PAD = 48;              // room around the screens while laying them out, px (not exported)

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const scale = job.format === 'png' ? 2 : 1;
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: scale });
  await context.addInitScript(storage => { for (const [k, v] of Object.entries(storage)) if (v != null) localStorage.setItem(k, v); }, job.storage || {});
  const page = await context.newPage();
  await page.goto(job.url);
  await page.waitForFunction(() => window.__capture && window.__capture.ready);
  // make the window exactly as big as the screens plus the margin, so nothing is scaled
  const need = await page.evaluate(pad => window.__capture.size(pad), PAD);
  // Headless Chrome records frames 87px shorter than the window (from the top), so videos get 200px to spare below
  await page.setViewportSize({ width: need.w, height: need.h + (job.format === 'png' ? 0 : 200) });
  await page.evaluate(() => window.__capture.layout());
  await page.waitForTimeout(400);
  const boxes = (await page.evaluate(() => window.__capture.boxes())).slice(0, job.outs.length);

  if (job.format === 'png') {
    await page.evaluate(() => window.__capture.still());
    await page.waitForTimeout(900); // transitions into the step settle
    for (const [i, box] of boxes.entries()) await page.screenshot({ path: job.outs[i], clip: box });
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'ws-capture-'));
    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', f => {
      const file = join(dir, String(frames.length).padStart(5, '0') + '.jpg');
      writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, at: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, maxWidth: need.w, maxHeight: need.h + 200 }); // full size, never scaled down
    await page.waitForTimeout(300);           // the first frame, before anything moves
    const secs = await page.evaluate(() => window.__capture.play());
    await page.waitForTimeout(secs * 1000 + 800); // the whole flow, and its last step held a moment
    const end = Date.now() / 1000; // Chrome sends nothing while nothing moves, so the last frame lasts until here
    await cdp.send('Page.stopScreencast');
    if (frames.length < 2) throw new Error('Nothing was recorded');

    // each frame lasts until the next one arrived, so the video keeps real time however unevenly Chrome sent them
    const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1] ? frames[i + 1].at : Math.max(end, f.at + 0.1)) - f.at).toFixed(4)}`);
    writeFileSync(join(dir, 'list.txt'), list.join('\n') + `\nfile '${frames.at(-1).file}'\n`);
    const [fw, fh] = jpegSize(frames[0].file), k = fw / need.w; // frames may arrive scaled, the same both ways
    if (process.env.CAPTURE_DEBUG) console.error(JSON.stringify({ need, boxes, fw, fh, n: frames.length }));
    const fit = 'setsar=1'; // full size: the design's own pixels
    const run = args => { try { execFileSync(ffmpeg, args, { stdio: 'pipe' }); } catch (e) { throw new Error('ffmpeg: ' + String(e.stderr || e.message).trim().split('\n').slice(-3).join(' ')); } };
    const input = ['-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt')];
    for (const [i, box] of boxes.entries()) {
      if ((box.y + box.height) * k > fh + 1) throw new Error(`Recorded frames are too short (${fh}px for ${Math.round((box.y + box.height) * k)})`);
      const cw = Math.round(box.width * k) & ~1, ch = Math.round(box.height * k) & ~1;
      const crop = `crop=${cw}:${ch}:${Math.round(box.x * k)}:${Math.round(box.y * k)}`;
      if (job.format === 'mp4') run([...input, '-vf', `${crop},${fit},fps=30`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', job.outs[i]]);
      else run([...input, '-vf', `${crop},${fit},fps=20,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, job.outs[i]]);
    }
    rmSync(dir, { recursive: true, force: true });
  }
  process.stdout.write(JSON.stringify({ ok: true, outs: job.outs.slice(0, boxes.length) }));
} finally {
  await browser.close();
}

/* a JPEG's [width, height], from its start-of-frame marker */
function jpegSize(file) {
  const b = readFileSync(file);
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}
