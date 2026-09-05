import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('http://localhost:4500/v1.html',{waitUntil:'networkidle'});
await p.waitForSelector('html.sc-ready'); await p.waitForTimeout(1000);

const order = await p.evaluate(() => [...document.querySelectorAll('[data-act]')]
  .map(a => (a.className.match(/act--[a-z]+/)||['?'])[0]));
console.log('act order:', order.join(' > '));

const vh = 900;
const rows = [];
for (const f of [0, .3, .5, .7, .9, 1.1, 1.3, 1.6, 1.9, 2.2, 2.6]) {
  await p.evaluate(y => window.scrollTo(0, y), Math.round(vh * f));
  await p.waitForTimeout(420);
  const s = await p.evaluate(() => {
    const g = el => el ? +(+getComputedStyle(el).opacity).toFixed(2) : null;
    return { fog: g(document.querySelector('[data-fog]')),
      masked: g(document.querySelector('.bath__img--masked')),
      clean: g(document.querySelector('.bath__img--clean')),
      line: g(document.querySelector('[data-bath-line]')) };
  });
  rows.push({ 'scroll(vh)': f, ...s });
}
console.table(rows);
console.log('errors:', errs.slice(0,4));
await p.close(); await b.close();
