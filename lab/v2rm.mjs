import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport:{width:1280,height:860}, reducedMotion:'reduce' });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://localhost:4500',{waitUntil:'networkidle'});
await p.waitForSelector('html.sc-ready'); await p.waitForTimeout(800);
const r = await p.evaluate(()=>({
  scenesVisible: [...document.querySelectorAll('[data-scene]')].filter(s=>+getComputedStyle(s).opacity>0.5).length,
  beatsVisible: [...document.querySelectorAll('[data-beat]')].filter(s=>+getComputedStyle(s).opacity>0.5).length,
  heroCopyVisible: +getComputedStyle(document.querySelector('.hero .lede')).opacity,
  docVh: +(document.documentElement.scrollHeight/innerHeight).toFixed(1)
}));
console.log(JSON.stringify(r), 'errors:', errs.slice(0,3));
await p.screenshot({path:'lab/v2-reduced.png', fullPage:false});
await b.close();
