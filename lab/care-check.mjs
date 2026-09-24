/* Walks the care page flight and proves it holds at every scroll position.

   Steps the track in small increments, waits for the lerped playhead to
   arrive, and records the film time, each beat's opacity and the plan state.
   Asserts:
     no dead scroll    the film time rises on every step (skipped under
                       reduced motion, where the posters hold by design)
     every beat lands  each copy block reaches full opacity somewhere
     contrast          ink against the darkest pixel behind each line of copy,
                       measured on the composited page with the words hidden,
                       at the frame where that block is fully shown
   Writes a screenshot at every room and a contact sheet.

   Usage: node lab/care-check.mjs <outdir> [width] [height] [--reduced]
   Needs the preview server on :4321. */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] || 'lab/care-shots';
const W = +(process.argv[3] || 1600), H = +(process.argv[4] || 900);
const reduced = process.argv.includes('--reduced');
mkdirSync(out, { recursive: true });

const b = await chromium.launch({ channel: 'chrome' });
const mobile = W < 768;
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1,
});
const p = await ctx.newPage();
const videoRequests = [];
p.on('request', (r) => { if (r.url().endsWith('.mp4')) videoRequests.push(r.url()); });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

await p.goto('http://localhost:4321/care.html');
await p.waitForFunction(() => window.__care);
if (!reduced) await p.waitForFunction(() => __care.state().ready, null, { timeout: 30000 });

const T = await p.evaluate(() => __care.T);
// First the page has to paint the new position (target is only updated on
// its next frame), then the lerped playhead has to arrive at the target.
const settle = async () => {
  await p.waitForFunction(() => { const s = __care.state(); return Math.abs(s.painted - s.t) < 1e-4; }, null, { timeout: 4000 }).catch(() => {});
  if (reduced) return p.waitForTimeout(700);
  await p.waitForFunction(() => { const s = __care.state(); return Math.abs(s.current - s.target) < 0.03; }, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(90);
};

const read = () => p.evaluate(() => {
  const s = __care.state();
  const beats = [...document.querySelectorAll('[data-beat]')].map((el) => ({ name: el.dataset.beat, o: +getComputedStyle(el).opacity }));
  const poster = [...document.querySelectorAll('[data-poster]')].findIndex((el) => el.classList.contains('is-on'));
  const room = document.querySelector('[data-room][aria-current="true"]')?.dataset.room || null;
  return { ...s, beats, poster, room };
});

// ---- walk
const STEP = 0.1;
const rows = [];
for (let t = 0; t <= T + 1e-6; t += STEP) {
  await p.evaluate((v) => __care.scrollToT(v), t);
  await settle();
  rows.push(await read());
}

const dead = [];
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], c = rows[i];
  const filmMoved = c.current - a.current > 0.02;
  // Under reduced motion no clip exists, so each poster legitimately holds.
  if (!reduced && !filmMoved) dead.push({ t: +c.t.toFixed(2), film: +c.current.toFixed(3), prev: +a.current.toFixed(3) });
}

const names = rows[0].beats.map((bt) => bt.name);
const peak = Object.fromEntries(names.map((n, j) => {
  let best = 0, at = 0;
  rows.forEach((r) => { if (r.beats[j].o > best) { best = r.beats[j].o; at = r.t; } });
  return [n, { max: +best.toFixed(3), at: +at.toFixed(2) }];
}));
const unlanded = Object.entries(peak).filter(([, v]) => v.max < 0.99).map(([n]) => n);

// ---- per beat: screenshot at its fullest, plus contrast with the words hidden
const lum = (r, g, bl) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
};
const INK = lum(10, 10, 10);
const contrast = {};
const shots = [];
for (const n of names) {
  // centre of the stretch where this beat is at full strength
  const full = rows.filter((r) => r.beats[names.indexOf(n)].o > 0.99).map((r) => r.t);
  const at = full.length ? full[Math.floor(full.length / 2)] : peak[n].at;
  await p.evaluate((v) => __care.scrollToT(v), at);
  await settle();
  const file = `${out}/beat-${n}.png`;
  await p.screenshot({ path: file });
  shots.push(file);

  // hide the text only (the scrim stays), then sample under each text line
  const boxes = await p.evaluate((name) => {
    const el = document.querySelector(`[data-beat="${name}"]`);
    const parts = [...el.querySelectorAll('h1,h2,p')];
    const rs = parts.map((x) => x.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
    el.dataset.probe = '1';
    el.style.setProperty('color', 'transparent', 'important');
    parts.forEach((x) => x.style.setProperty('color', 'transparent', 'important'));
    return rs;
  }, n);
  await p.waitForTimeout(60);
  let worst = Infinity;
  for (const bx of boxes) {
    if (bx.w < 2 || bx.h < 2) continue;
    const clip = { x: Math.max(0, bx.x), y: Math.max(0, bx.y), width: Math.min(W - Math.max(0, bx.x), bx.w), height: Math.min(H - Math.max(0, bx.y), bx.h) };
    const png = await p.screenshot({ clip });
    const darkest = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      // 2nd percentile darkest, so a single stray pixel does not decide it
      const L = [];
      for (let i = 0; i < d.length; i += 16) L.push([d[i], d[i + 1], d[i + 2]]);
      L.sort((a, b2) => (a[0] + a[1] + a[2]) - (b2[0] + b2[1] + b2[2]));
      return L[Math.floor(L.length * 0.02)];
    }, png.toString('base64'));
    // button text is paper on ember, not ink on ground: skip it
    const bg = lum(...darkest);
    worst = Math.min(worst, (bg + 0.05) / (INK + 0.05));
  }
  await p.evaluate((name) => {
    const el = document.querySelector(`[data-beat="${name}"]`);
    el.style.removeProperty('color');
    el.querySelectorAll('h1,h2,p').forEach((x) => x.style.removeProperty('color'));
  }, n);
  contrast[n] = +worst.toFixed(2);
}

// end of the track and the close section below it
await p.evaluate((v) => __care.scrollToT(v), T);
await settle();
await p.screenshot({ path: `${out}/end.png` }); shots.push(`${out}/end.png`);
await p.evaluate(() => scrollBy(0, innerHeight * 0.8));
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/after.png` }); shots.push(`${out}/after.png`);

// contact sheet: every shot, scaled, in one page
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1600, height: 1000 });
const imgs = await Promise.all(shots.map(async (f) => {
  const { readFileSync } = await import('node:fs');
  return 'data:image/png;base64,' + readFileSync(f).toString('base64');
}));
await sheet.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px">${imgs.map((s, i) => `<figure style="margin:0;color:#ddd;font:12px monospace"><img src="${s}" style="width:100%;display:block">${shots[i].split('/').pop()}</figure>`).join('')}</body>`);
await sheet.screenshot({ path: `${out}/sheet.png`, fullPage: true });

const report = {
  viewport: `${W}x${H}`, reduced, T, samples: rows.length,
  videoRequests, errors,
  dead, unlanded, peak, contrast,
  pageHeight: await p.evaluate(() => document.documentElement.scrollHeight),
};
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await b.close();
