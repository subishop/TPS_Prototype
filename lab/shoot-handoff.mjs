/* Capture the mist handoff densely across its scroll window.
   node lab/shoot-handoff.mjs [--out lab/handoff] [--to 2.0] [--n 22] [--width 1600] */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > -1 ? process.argv[i + 1] : d;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = arg('page', 'v1.html');

// Default the captures outside the project, because the project lives in a
// synced Drive folder and a run is about 22MB. Pass --out lab/whatever to
// keep a set deliberately.
const DEFAULT_OUT = path.join(process.env.TEMP || process.env.TMPDIR || '.', 'tps-handoff');
const OUT = path.resolve(ROOT, arg('out', DEFAULT_OUT));
const TO = parseFloat(arg('to', '2.0'));      // viewport-heights to walk
const N = parseInt(arg('n', '22'), 10);
const W = parseInt(arg('width', '1600'), 10);
const H = parseInt(arg('height', '900'), 10);

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];

const exe = CHROME.find(p => existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });

const page = await browser.newPage({ viewport: { width: W, height: H } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(pathToFileURL(path.join(ROOT, PAGE)).href, { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });

// The fog plate drifts on a 47s wall clock keyframe loop, so two runs started
// at different moments never produce the same pixels. Freeze it when the point
// of the run is to compare one capture against another.
if (process.argv.includes('--freeze')) {
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; }' });
  // The mesh drift is a shader on its own clock, so CSS cannot stop it.
  await page.evaluate(() => window.__drift && window.__drift.freeze(6));
}

await page.waitForTimeout(600);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (let i = 0; i < N; i++) {
  const vhs = (TO * i) / (N - 1);
  await page.evaluate(v => window.scrollTo(0, window.innerHeight * v), vhs);
  // The scrub eases toward its target, so a frame grabbed immediately is a
  // frame the page never actually holds.
  await page.waitForTimeout(850);
  const name = String(i).padStart(2, '0') + '_' + vhs.toFixed(2) + 'vh.png';
  await page.screenshot({ path: path.join(OUT, name) });
  process.stdout.write('.');
}

console.log('\n' + N + ' frames to ' + OUT);
if (errors.length) console.log('console errors:\n  ' + errors.join('\n  '));
else console.log('no console errors');

await browser.close();
