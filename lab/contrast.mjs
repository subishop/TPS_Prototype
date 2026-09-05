/* Contrast of copy against the ground it actually lands on.

   A mesh gradient is not one colour, it is a field, and the text travels
   across it as you scroll. So the question is never "does this pass on the
   average" but "does it pass at the worst pixel under the worst line at the
   worst scroll position". This hides the copy, photographs the ground that
   was behind it, and reports the darkest patch each line has to survive.

   node lab/contrast.mjs [--from 2.4] [--to 5.0] [--n 12]

   Writes ground crops next to a JSON dump; lab/contrast.py reads them. */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 ? process.argv[i + 1] : d;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = parseFloat(arg('from', '2.4'));
const TO = parseFloat(arg('to', '5.0'));
const N = parseInt(arg('n', '12'), 10);
const OUT = path.join(process.env.TEMP || process.env.TMPDIR || '.', 'tps-contrast');

// Every run of copy that sits on the drifting field.
const TARGETS = [
  '.act--rest .say',
  '.act--rest .caption',
  '.act--treatment .display',
  '.act--treatment .body',
  '.act--treatment .body--mute'
];

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });
// Hold the field still so a reading can be reproduced and argued with.
await page.evaluate(() => window.__drift && window.__drift.freeze(6));

// --nodrift puts the old cream and white grounds back, so a reading can be
// compared against what the page did before the field went in. Without that
// baseline a failing number is just a number, not a regression.
if (process.argv.includes('--nodrift')) {
  await page.addStyleTag({ content: '.drift { opacity: 0 !important } html.drift-on .act--treatment { background: #FFFFFF !important }' });
}
await page.waitForTimeout(600);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const shots = [];
for (let i = 0; i < N; i++) {
  const vhs = FROM + (TO - FROM) * (i / (N - 1));
  await page.evaluate(v => window.scrollTo(0, window.innerHeight * v), vhs);
  await page.waitForTimeout(500);

  const found = await page.evaluate(sels => {
    // The nav is fixed and paints over everything, so any part of a text box
    // that has scrolled up behind it is not ground the copy is being read
    // against. Sampling it made the darkest pixel the "Book a call" button
    // and reported a contrast failure that had nothing to do with the field.
    const nav = document.querySelector('[data-nav]');
    const floor = nav ? Math.ceil(nav.getBoundingClientRect().bottom) : 0;

    const out = [];
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, n) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || +cs.opacity < 0.9) return;
        const top = Math.max(floor, r.top);
        const bottom = Math.min(window.innerHeight, r.bottom);
        const lefT = Math.max(0, r.left);
        const right = Math.min(window.innerWidth, r.right);
        // Only what is genuinely on screen and clear of the bar.
        if (bottom - top < 10 || right - lefT < 10) return;
        out.push({
          sel, n, color: cs.color,
          x: Math.round(lefT), y: Math.round(top),
          w: Math.round(right - lefT), h: Math.round(bottom - top)
        });
      });
    });
    return out;
  }, TARGETS);

  if (!found.length) continue;

  // Take the copy away and photograph what was underneath it.
  await page.evaluate(sels => {
    window.__hidden = [];
    sels.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      window.__hidden.push([el, el.style.visibility]);
      el.style.visibility = 'hidden';
    }));
  }, TARGETS);
  await page.waitForTimeout(120);

  for (const f of found) {
    if (f.w < 8 || f.h < 8) continue;
    const name = `${vhs.toFixed(2)}_${f.sel.replace(/[^a-z]+/gi, '-')}_${f.n}.png`;
    await page.screenshot({ path: path.join(OUT, name), clip: { x: f.x, y: f.y, width: f.w, height: f.h } });
    shots.push({ file: name, at: +vhs.toFixed(2), sel: f.sel, color: f.color });
  }

  await page.evaluate(() => {
    window.__hidden.forEach(([el, v]) => { el.style.visibility = v; });
  });
  process.stdout.write('.');
}

await writeFile(path.join(OUT, 'index.json'), JSON.stringify(shots, null, 2));
console.log('\n' + shots.length + ' ground samples to ' + OUT);
await browser.close();
