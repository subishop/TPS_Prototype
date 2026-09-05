/* Which layer is drawing the band?
   Park at one scroll position, then re-shoot with each candidate hidden and
   report how the worst full-width step changes. The layer whose removal
   collapses the step is the one drawing it.

   node lab/bisect.mjs --at 0.27 */

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
const AT = parseFloat(arg('at', '0.27'));
const OUT = path.join(process.env.TEMP || '.', 'tps-bisect');

const CASES = [
  ['baseline', ''],
  ['no-veil', '.fog__veil{display:none!important}'],
  ['no-plate-a', '.fog__plate--a{display:none!important}'],
  ['no-plate-b', '.fog__plate--b{display:none!important}'],
  ['no-plate-c', '.fog__plate--c{display:none!important}'],
  ['no-plates', '.fog__plate{display:none!important}'],
  ['no-fog', '.fog{display:none!important}'],
  ['no-bathsection', '.act--bath{visibility:hidden!important}'],
  ['no-plate-mask', '.fog__plate{-webkit-mask-image:none!important;mask-image:none!important}']
];

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
].find(p => existsSync(p));

const browser = await chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const [name, css] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(pathToFileURL(path.join(ROOT, 'v1.html')).href, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.classList.contains('sc-ready'), { timeout: 20000 });
  if (css) await page.addStyleTag({ content: css });
  await page.waitForTimeout(400);
  await page.evaluate(v => window.scrollTo(0, window.innerHeight * v), AT);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  await page.close();
  process.stdout.write(name + ' ');
}

console.log('\n-> ' + OUT);
await browser.close();
