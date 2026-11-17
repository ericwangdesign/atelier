/* Pictures of Atelier's own screens at desktop width, in light and dark, for checking a visual change by eye:
   `node tests/shots.mjs [out-dir] [only]`. Needs Atelier running on :4321 (`atelier`). Prints every console error
   and page error it sees, so a run with no errors listed is a clean one. Never writes to a project: it only looks. */
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.ATELIER || 'http://localhost:4321';
const OUT = process.argv[2] || '/tmp/atelier-shots';
const ONLY = process.argv[3] || '';
await mkdir(OUT, { recursive: true });

const SHOTS = [
  { name: 'home', url: '/#/' },
  { name: 'home-grid', url: '/#/', before: async (p) => { const b = await p.$('[data-view="grid"], #vgrid'); if (b) await b.click(); await p.waitForTimeout(300); } },
  { name: 'project', url: '/#/p/gym-tracker' },
  { name: 'stage', url: '/stage.html?project=gym-tracker', tab: 'Design', wait: 1600 },
  { name: 'stage-notes', url: '/stage.html?project=gym-tracker', tab: 'Notes', wait: 1600 },
  { name: 'stage-proto', url: '/stage.html?project=gym-tracker', tab: 'Prototype', wait: 1600 },
  { name: 'stage-taste', url: '/stage.html?project=gym-tracker', tab: 'Taste', wait: 1600 },
  { name: 'stage-stagetab', url: '/stage.html?project=gym-tracker', tab: 'Stage', wait: 1600 },
  { name: 'stage-compare', url: '/stage.html?project=gym-tracker', compare: true, wait: 1600 },
  { name: 'stage-noteopen', url: '/stage.html?project=gym-tracker', tab: 'Notes', wait: 1600, before: async (p) => {
    await p.evaluate(() => { const li = [...document.querySelectorAll('#notelist li')].find((x) => !x.classList.contains('sit')); if (li) li.click(); });
    await p.waitForTimeout(700);
    await p.evaluate(() => { const pin = [...document.querySelectorAll('.pin')].find((x) => x.offsetParent); if (pin) pin.click(); });
    await p.waitForTimeout(600); } },
  { name: 'home-today', url: '/#/p/Side%20Projects-today-everywhere', wait: 2500 },
  { name: 'stage-vault', url: '/stage.html?project=Side%20Projects-vault-reader', wait: 2000 },
];

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
for (const mode of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 945 }, deviceScaleFactor: 1, colorScheme: mode });
  for (const s of SHOTS) {
    if (ONLY && !s.name.includes(ONLY)) continue;
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${mode} ${s.name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR_ABORTED/.test(m.text())) errors.push(`${mode} ${s.name}: console ${m.text()}`); });
    await page.goto(BASE + s.url, { waitUntil: 'load' });
    await page.waitForTimeout(s.wait || 900);
    if (s.tab) {
      await page.evaluate((t) => { const b = [...document.querySelectorAll('button, [role=tab]')].find((x) => x.textContent.trim() === t); if (b) b.click(); }, s.tab);
      await page.waitForTimeout(500);
    }
    if (s.before) await s.before(page);
    if (s.compare) { await page.keyboard.press('c'); await page.waitForTimeout(900); }
    await page.screenshot({ path: `${OUT}/${s.name}-${mode}.png` });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
console.log(OUT);
