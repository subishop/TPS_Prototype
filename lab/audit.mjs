/* Layout and act audit for the whole page.
   Reports where every act actually sits after the pins have been built,
   flags overlaps and acts that never get a viewport to themselves, and
   walks the full document looking for stretches where nothing changes.

   node lab/audit.mjs */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const vh = window.innerHeight;
  const acts = [...document.querySelectorAll('[data-act]')].map(el => {
    const r = el.getBoundingClientRect();
    const m = el.className.match(/act--([a-z]+)/);
    return {
      name: m ? m[1] : el.className,
      top: +( (r.top + window.scrollY) / vh ).toFixed(2),
      h: +( r.height / vh ).toFixed(2),
      time: el.dataset.time || '',
      away: el.hasAttribute('data-clock-away')
    };
  });
  return {
    vh,
    docH: +(document.documentElement.scrollHeight / vh).toFixed(2),
    acts,
    triggers: (window.ScrollTrigger ? ScrollTrigger.getAll().length : -1)
  };
});

console.log('viewport', info.vh, 'px   document', info.docH, 'viewport-heights   scrolltriggers', info.triggers);
console.log('\nact              top     height   ends    time   clock');
let prevEnd = null;
info.acts.forEach(a => {
  const end = +(a.top + a.h).toFixed(2);
  const gap = prevEnd === null ? '' : (a.top < prevEnd - 0.01 ? `  OVERLAPS previous by ${(prevEnd - a.top).toFixed(2)}` : '');
  console.log(
    `${a.name.padEnd(14)} ${String(a.top).padStart(6)}  ${String(a.h).padStart(6)}  ${String(end).padStart(6)}   ${a.time.padEnd(5)}  ${a.away ? 'away' : '    '}${gap}`
  );
  prevEnd = end;
});

// Walk the document and look for stretches where the frame does not change.
// Frames go out as PNG so lab/deadscroll.py can measure how much actually
// moved. Byte equality on a quality-40 JPEG only ever answered "bit for bit
// identical", which misses a stretch that changes by two levels of grey and
// reads to the eye as just as stalled.
const FRAMES = path.join(process.env.TEMP || process.env.TMPDIR || '.', 'tps-audit');
await rm(FRAMES, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });

const STEPS = 60;
for (let i = 0; i <= STEPS; i++) {
  const y = (info.docH - 1) * (i / STEPS);
  await page.evaluate(v => window.scrollTo(0, window.innerHeight * v), y);
  await page.waitForTimeout(320);
  await page.screenshot({
    path: path.join(FRAMES, String(i).padStart(2, '0') + '_' + y.toFixed(2) + 'vh.png')
  });
}
console.log('\n' + (STEPS + 1) + ' walk frames to ' + FRAMES);

console.log('\nconsole errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
await browser.close();
