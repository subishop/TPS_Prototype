/* Walk v1 and read every parallax plane's transform at each stop.
   node lab/v1-planes.mjs [--w 1600] [--h 900] [--shots] [--mobile] [--reduced] */
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const SHOTS = process.argv.includes('--shots');
const MOBILE = process.argv.includes('--mobile');
const REDUCED = process.argv.includes('--reduced');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = MOBILE ? 390 : +arg('w', 1600), H = MOBILE ? 844 : +arg('h', 900);
const TAG = MOBILE ? 'mobile' : REDUCED ? 'reduced' : 'desktop';

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: W, height: H },
  ...(MOBILE ? { isMobile: true, hasTouch: true } : {}),
  ...(REDUCED ? { reducedMotion: 'reduce' } : {})
});
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 30000 });
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });

const height = await page.evaluate(() => document.documentElement.scrollHeight);
console.log(`${TAG} ${W}x${H}: ${height}px = ${(height / H).toFixed(1)}vh`);
const dir = path.join(ROOT, 'lab/v1-planes-' + TAG);
if (SHOTS) mkdirSync(dir, { recursive: true });

// Every plane, plus one element that must never move: the copy each plane is
// read against. A plane with no static reference beside it is just a zoom.
const SEL = {
  a2plane: '.act--rest .frame__clip img',
  a2caption: '.act--rest .caption',
  a3plane: '.act--treatment .xfade__img',
  a3copy: '.act--treatment .stage__side .body',
  a4img1: '.rail__item:nth-of-type(2) .card__media img',
  a4img3: '.rail__item:nth-of-type(4) .card__media img',
  a6plane: '.nightframe__media img',
  a6line: '.nightframe__line'
};

// Overhang audit: a plane must never expose the ground of the box clipping it.
const bleed = await page.evaluate(() => {
  const rows = [];
  for (const [sel, box] of [['.act--rest .frame__clip img', '.act--rest .frame__clip'],
                            ['.act--treatment .xfade__img', '.act--treatment .stage__frame'],
                            ['.rail__item .card__media img', '.rail__item .card__media'],
                            ['.nightframe__media img', '.nightframe__media']]) {
    const el = document.querySelector(sel), b = document.querySelector(box);
    if (!el || !b) continue;
    rows.push({ sel, overhangY: +(((el.offsetHeight - b.clientHeight) / 2)).toFixed(1),
                overhangX: +(((el.offsetWidth - b.clientWidth) / 2)).toFixed(1) });
  }
  return rows;
});
console.log('overhang px (half, each side):', JSON.stringify(bleed));

const stops = [0, 0.10, 0.18, 0.26, 0.34, 0.45, 0.58, 0.68, 0.80, 0.92, 0.99];
for (const f of stops) {
  await page.evaluate(v => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * v), f);
  await page.waitForTimeout(1100);
  const row = await page.evaluate(sel => {
    const t = s => {
      const el = document.querySelector(s); if (!el) return '-';
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return `${m.e.toFixed(0)},${m.f.toFixed(0)}`;
    };
    const o = { y: Math.round(scrollY) };
    for (const k in sel) o[k] = t(sel[k]);
    return o;
  }, SEL);
  console.log(JSON.stringify(row));
  if (SHOTS) await page.screenshot({ path: path.join(dir, `${String(Math.round(f * 100)).padStart(3, '0')}.png`) });
}
console.log('page errors:', errs.length ? errs.join(' | ') : 'none');
await browser.close();
