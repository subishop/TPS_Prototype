/* Real wheel input through the whole flight, as a visitor would give it.
   Samples the film time on every animation frame and reports whether it
   ever runs backwards while scrolling forwards, and the largest single
   frame jump (a big jump is a visible stutter). Also records a video.
   Usage: node lab/care-wheel.mjs <outdir> */
import { chromium } from 'playwright-core';
const out = process.argv[2] || 'lab/care-wheel';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: out, size: { width: 1600, height: 900 } } });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/care.html');
await p.waitForFunction(() => window.__care && __care.state().ready, null, { timeout: 30000 });
await p.evaluate(() => {
  window.__trace = [];
  const tick = () => { const s = __care.state(); __trace.push([performance.now(), s.current, s.t]); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await p.mouse.move(800, 450);
const steps = Math.ceil((await p.evaluate(() => __care.T * innerHeight)) / 50);
for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, 50); await p.waitForTimeout(30); }
await p.waitForTimeout(1500);
const tr = await p.evaluate(() => __trace);
let back = 0, maxJump = 0;
for (let i = 1; i < tr.length; i++) {
  const d = tr[i][1] - tr[i - 1][1];
  if (d < -0.01) back++;
  maxJump = Math.max(maxJump, d);
}
console.log(JSON.stringify({ frames: tr.length, endFilm: tr.at(-1)[1].toFixed(2), endT: tr.at(-1)[2].toFixed(2), backwards: back, maxJumpPerFrame: maxJump.toFixed(3) }));
await ctx.close(); await b.close();
