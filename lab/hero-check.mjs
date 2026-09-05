import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('http://localhost:4500/', { waitUntil: 'networkidle' });
await p.waitForSelector('html.sc-ready'); await p.waitForTimeout(900);
await p.screenshot({ path: 'lab/hero-handoff.png' });
const info = await p.evaluate(() => {
  const img = document.querySelector('.hero__media img');
  return { src: img.getAttribute('src'), natW: img.naturalWidth, natH: img.naturalHeight,
    displayed: img.getBoundingClientRect() };
});
console.log(JSON.stringify(info));
console.log('errors:', errs);
await b.close();
