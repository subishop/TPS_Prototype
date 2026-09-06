/* Shoot v1 in a real browser.

   node lab/shoot-v1.mjs [outdir] [root]

   Same launch pattern as lab/audit.mjs: real Chrome through
   playwright-core, so requestAnimationFrame actually runs and the
   entrance tweens, the pins and the WebGL field are all live. The
   editor preview pane throttles rAF to nothing and hands back blank
   frames, which is how three commits of visual work once went in
   without anyone seeing them render.

   Structure-agnostic on purpose: it discovers whatever acts the page
   declares rather than naming them, so the same script shoots two
   branches whose act lists have diverged and the stills line up for
   comparison.

   Stills land in lab/shots, which .gitignore already covers. */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'shots'));
const ROOT = path.resolve(process.argv[3] || path.join(HERE, '..'));
await mkdir(OUT, { recursive: true });

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 30000 })
  .catch(() => console.log('note: sc-ready never set, shooting anyway'));
await page.waitForTimeout(1200);

// Deterministic field, where there is one. The shader runs on a wall
// clock, so two runs would never produce comparable frames otherwise.
await page.evaluate(() => { if (window.__drift) window.__drift.freeze(6.5); });

// Scroll in steps rather than jumping: the pins, the scrubs and the
// once-only entrance triggers all read scroll deltas, and a single jump
// past an act leaves its content unfired.
async function travelTo(y) {
  const from = await page.evaluate(() => window.scrollY);
  const steps = Math.max(1, Math.min(80, Math.ceil(Math.abs(y - from) / 260)));
  for (let i = 1; i <= steps; i++) {
    const to = Math.round(from + (y - from) * (i / steps));
    await page.evaluate(v => window.scrollTo({ top: v, behavior: 'instant' }), to);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(700);
}

// Whatever this build calls its acts, in document order, plus how tall
// each one is so the long ones get shot more than once.
const acts = await page.evaluate(() => {
  const vh = window.innerHeight;
  return [...document.querySelectorAll('[data-act], main > section')].map((el, i) => {
    const r = el.getBoundingClientRect();
    const m = el.className.match(/act--([a-z-]+)/);
    return {
      name: (m ? m[1] : (el.id || el.className.split(/\s+/)[0] || 'section' + i)).replace(/[^a-z0-9-]/gi, ''),
      top: Math.round(r.top + window.scrollY),
      height: Math.round(r.height),
      screens: Math.max(1, Math.min(3, Math.round(r.height / vh)))
    };
  });
});

const stops = [];
let n = 0;
for (const a of acts) {
  for (let s = 0; s < a.screens; s++) {
    // An act taller than the window gets shot from inside it, not at its
    // seam, so a pinned act is caught while it is holding the screen. One
    // shorter than the window gets centred instead: shooting a 390px act
    // from 315px into it puts the whole thing above the fold and returns
    // a picture of whatever follows it, which is how the turn went
    // unphotographed the first time.
    const y = a.height < 900
      ? a.top - Math.round((900 - a.height) / 2)
      : a.top + Math.round((s + 0.35) * 900);
    stops.push([String(++n).padStart(2, '0') + '-' + a.name + (a.screens > 1 ? '-' + (s + 1) : ''), y]);
  }
}
stops.push([String(++n).padStart(2, '0') + '-foot', await page.evaluate(() => document.body.scrollHeight)]);

console.log('acts', JSON.stringify(acts.map(a => a.name + '@' + a.top)));

for (const [name, y] of stops) {
  await travelTo(Math.max(0, y));
  const state = await page.evaluate(() => {
    const c = document.querySelector('[data-clock]');
    const cv = document.querySelector('[data-drift]');
    return {
      scrollY: Math.round(window.scrollY),
      clock: c ? (+getComputedStyle(c).opacity).toFixed(2) + ' ' +
        c.querySelector('[data-clock-time]')?.textContent : null,
      field: cv ? +(+getComputedStyle(cv).opacity).toFixed(2) : null
    };
  });
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log(name, JSON.stringify(state));
}

console.log('\nerrors:', errors.length ? errors : 'none');
console.log('out:', OUT);
await browser.close();
