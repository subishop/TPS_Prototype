/* Does the day-clock agree with what is on screen?

   The rail is the page's signature move and its only factual claim, so a
   readout that disagrees with the copy beside it is worse than no rail. This
   walks the page and prints, at each step, what the clock says against which
   act is actually filling the frame, plus whether the rail is showing.

   node lab/clock.mjs */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });
await page.waitForTimeout(700);

const docH = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);

console.log('scroll   clock   rail      act filling the frame');
for (let v = 0; v < docH - 1; v += 0.25) {
  await page.evaluate(y => window.scrollTo(0, window.innerHeight * y), v);
  await page.waitForTimeout(260);
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-clock]');
    const showing = c.classList.contains('is-on') && !c.classList.contains('is-away');

    // Whichever act covers the most of the viewport is the one being read.
    let best = null, bestArea = 0;
    document.querySelectorAll('[data-act]').forEach(el => {
      const b = el.getBoundingClientRect();
      const seen = Math.min(b.bottom, window.innerHeight) - Math.max(b.top, 0);
      if (seen > bestArea) { bestArea = seen; best = el; }
    });
    return {
      time: c.querySelector('[data-clock-time]').textContent,
      label: c.querySelector('[data-clock-label]').textContent,
      showing,
      act: (best.className.match(/act--([a-z]+)/) || [])[1] || '?',
      declared: best.dataset.time || ''
    };
  });
  console.log(
    String(v.toFixed(2)).padStart(6) + '   ' + r.time + '   ' +
    (r.showing ? 'shown ' : 'away  ') + '    ' +
    r.act.padEnd(11) + (r.declared ? 'opens ' + r.declared : '') +
    '   ' + r.label
  );
}

await browser.close();
