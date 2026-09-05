/* What element has an edge at this y, at this scroll position?
   node lab/probe.mjs --at 0.62 --y 843 */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 ? process.argv[i + 1] : d;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AT = parseFloat(arg('at', '0.62'));
const Y = parseFloat(arg('y', '843'));

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });
await page.evaluate(v => window.scrollTo(0, window.innerHeight * v), AT);
await page.waitForTimeout(900);

const hits = await page.evaluate(y => {
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    for (const [name, v] of [['top', r.top], ['bottom', r.bottom]]) {
      if (Math.abs(v - y) <= 6) {
        const cs = getComputedStyle(el);
        out.push({
          sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
          edge: name,
          at: Math.round(v),
          w: Math.round(r.width),
          opacity: cs.opacity,
          bg: cs.backgroundColor,
          pos: cs.position
        });
      }
    }
  });
  return out;
}, Y);

console.log('scroll', AT + 'vh   looking for an edge at y=' + Y);
if (!hits.length) console.log('  no element boundary within 6px');
hits.forEach(h => console.log(' ', JSON.stringify(h)));

const state = await page.evaluate(() => {
  const g = s => { const e = document.querySelector(s); if (!e) return null;
    const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), op: getComputedStyle(e).opacity }; };
  return {
    heroStage: g('.act--hero .stage'),
    bath: g('.bath'),
    bathImg: g('.bath__img'),
    veil: g('.fog__veil'),
    plate: g('.fog__plate'),
    actBath: g('.act--bath'),
    innerH: window.innerHeight
  };
});
console.log('\nstate:', JSON.stringify(state, null, 2));

await browser.close();
