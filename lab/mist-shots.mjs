import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto('http://localhost:4500/v1.html',{waitUntil:'networkidle'});
await p.waitForSelector('html.sc-ready'); await p.waitForTimeout(1000);
for (const f of [0.35, 0.7, 1.0, 1.25, 1.55, 1.9, 2.3]) {
  await p.evaluate(y => window.scrollTo(0, y), Math.round(900*f));
  await p.waitForTimeout(650);
  await p.screenshot({ path: `lab/mist-${String(f).replace('.','_')}.png` });
}
await p.close(); await b.close();
