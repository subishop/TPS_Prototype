/* ============================================================
   THE POSTPARTUM SUITE — v2
   GSAP + ScrollTrigger.

   The centrepiece is one pinned frame holding eight scenes. Scroll
   cross-dissolves them while a caption and a clock change beneath,
   so the whole service is explained by looking rather than reading.
   ============================================================ */

document.documentElement.classList.add('js');
gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'power2.out';

/* ------------------------------------------------------------
   Split a heading into real line boxes, measured after the
   display face has loaded.
   ------------------------------------------------------------ */
function splitLines(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const probes = words.map(w => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.display = 'inline-block';
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });

  const rows = [];
  let top = null;
  probes.forEach((s, i) => {
    if (top === null || Math.abs(s.offsetTop - top) > 4) { rows.push([]); top = s.offsetTop; }
    rows[rows.length - 1].push(words[i]);
  });

  el.textContent = '';
  return rows.map(row => {
    const mask = document.createElement('span');
    mask.className = 'kin-line';
    const inner = document.createElement('span');
    inner.textContent = row.join(' ');
    mask.appendChild(inner);
    el.appendChild(mask);
    return inner;
  });
}

/* ------------------------------------------------------------
   NAVIGATION
   Centred lockup. Transparent over the opening frame, solid once
   the page has moved under it.
   ------------------------------------------------------------ */
function nav() {
  const root = document.querySelector('[data-nav]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('.tab[data-tab]')];
  const menu = root.querySelector('[data-menu]');
  const panels = [...root.querySelectorAll('.menu__panel')];
  const veil = document.querySelector('[data-veil]');
  const burger = root.querySelector('[data-burger]');
  let open = null;

  // The logo morph: full lockup at the very top, mark alone once the
  // reader has scrolled a little. A small, fixed threshold rather than
  // anything tied to the hero's own height, so it reads as "you started
  // scrolling" and not as a hero-specific effect.
  const SCROLLED_AT = 48;
  const updateScrolled = () => root.classList.toggle('is-scrolled', window.scrollY > SCROLLED_AT);
  window.addEventListener('scroll', updateScrolled, { passive: true });
  updateScrolled();

  // The bar turns solid a little before the opening frame ends, so the
  // switch lands while there is still dark film behind it rather than
  // flipping to white type on a white section.
  const hero = document.querySelector('[data-hero]');
  if (hero) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top-=40',
      end: 'bottom top+=120',
      onUpdate: self => root.classList.toggle('is-solid', self.scroll() > window.innerHeight * 0.7),
      onLeave: () => root.classList.add('is-solid'),
      onEnterBack: () => root.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.7)
    });
  }

  const close = ({ focusTab = false } = {}) => {
    if (!open) return;
    const was = tabs.find(t => t.dataset.tab === open);
    tabs.forEach(t => t.setAttribute('aria-expanded', 'false'));
    open = null;
    const done = () => {
      menu.hidden = true;
      veil.hidden = true;
      if (burger) burger.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
    };
    if (REDUCED) { gsap.set(menu, { height: 0 }); gsap.set(veil, { opacity: 0 }); done(); }
    else {
      gsap.to(veil, { opacity: 0, duration: 0.2, ease: EASE });
      gsap.to(menu, { height: 0, duration: 0.28, ease: EASE, onComplete: done });
    }
    if (focusTab && was) was.focus();
  };

  const openPanel = name => {
    const tab = tabs.find(t => t.dataset.tab === name);
    if (!tab) return;
    panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
    tabs.forEach(t => t.setAttribute('aria-expanded', String(t.dataset.tab === name)));
    const first = open === null;
    open = name;

    menu.hidden = false;
    veil.hidden = false;
    root.classList.add('is-solid');
    const h = menu.scrollHeight;
    if (REDUCED) { gsap.set(menu, { height: 'auto' }); gsap.set(veil, { opacity: 1 }); return; }
    // Only the first open animates its height, so switching tabs swaps the
    // contents without the panel concertinaing each time.
    if (first) {
      gsap.fromTo(menu, { height: 0 }, { height: h, duration: 0.34, ease: EASE });
      gsap.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: 0.26, ease: EASE });
    } else {
      gsap.to(menu, { height: h, duration: 0.26, ease: EASE });
    }
    gsap.fromTo(menu.querySelectorAll('.menu__group'),
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: EASE, delay: first ? 0.08 : 0 });
  };

  tabs.forEach(tab => tab.addEventListener('click', () => {
    if (open === tab.dataset.tab) close({ focusTab: true });
    else openPanel(tab.dataset.tab);
  }));

  veil.addEventListener('click', () => close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) close({ focusTab: true }); });
  root.addEventListener('focusout', e => { if (open && !root.contains(e.relatedTarget)) close(); });

  if (burger) {
    burger.addEventListener('click', () => {
      const isOpen = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!isOpen));
      root.classList.toggle('is-open', !isOpen);
      if (isOpen) close();
      else { openPanel(tabs[0].dataset.tab); tabs[0].focus(); }
    });
  }
}

/* ------------------------------------------------------------
   OPENING FRAME
   Focus pull, plus a CSS-driven entrance so the landing headline
   can never be left stalled by a throttled frame loop.
   ------------------------------------------------------------ */
function hero() {
  const act = document.querySelector('[data-hero]');
  if (!act) return;

  const img = act.querySelector('[data-focus]');
  const heading = act.querySelector('[data-kinetic]');
  const fades = act.querySelectorAll('[data-fade]');

  if (!REDUCED && img) {
    // Sharp on arrival, softening on the way out. See the note in v1.js:
    // a blurred landing frame reads as a failed image load.
    gsap.set(img, { filter: 'blur(0px)', scale: 1 });
    gsap.to(img, {
      filter: 'blur(7px)', scale: 1.06, ease: 'none',
      scrollTrigger: { trigger: act, start: 'top top', end: 'bottom 25%', scrub: 0.6 }
    });
  }

  const lines = heading ? splitLines(heading) : [];
  lines.forEach((l, i) => l.style.setProperty('--i', i));
  fades.forEach((el, i) => el.style.setProperty('--i', i + lines.length));
  act.classList.add('is-ready');
}

/* ------------------------------------------------------------
   THE DAY, the sequence
   Eight scenes under one pinned frame.

   Each scene gets an equal share of the scroll. Within its share it
   holds for most of the way and hands over quickly at the end: a
   scrubbed cross-fade parks the reader at the midpoint most of the
   time, and a 50/50 blend of two different rooms reads as a fault
   rather than a transition. Same lesson the treatment frame taught
   in v1, applied from the start here.
   ------------------------------------------------------------ */
function theDay() {
  const day = document.querySelector('[data-day]');
  if (!day) return;

  const stage = day.querySelector('[data-day-stage]');
  const scenes = [...day.querySelectorAll('[data-scene]')];
  const beats = [...day.querySelectorAll('[data-beat]')];
  const clockEl = day.querySelector('[data-day-clock]');
  const fillEl = day.querySelector('[data-day-fill]');
  const noEl = day.querySelector('[data-day-no]');
  const n = scenes.length;
  if (!n) return;

  const times = beats.map(b => b.dataset.time || '');

  const show = i => {
    scenes.forEach((s, k) => s.classList.toggle('is-on', k === i));
    beats.forEach((b, k) => b.classList.toggle('is-on', k === i));
    if (clockEl) clockEl.textContent = times[i] || '';
    if (noEl) noEl.textContent = String(i + 1).padStart(2, '0');
  };

  if (REDUCED) {
    // No pin and no dissolve: the eight scenes become a plain stacked
    // sequence so every beat is still reachable and readable.
    stage.style.height = 'auto';
    day.querySelector('.day__bar').style.display = 'none';
    scenes.forEach(s => { s.style.position = 'relative'; s.style.opacity = 1; s.style.height = 'auto'; });
    beats.forEach(b => { b.style.opacity = 1; });
    day.querySelector('.day__copy').style.position = 'relative';
    day.querySelector('.day__slot').style.display = 'block';
    return;
  }

  // One viewport-height of scroll per scene, plus a little to land on.
  const total = () => window.innerHeight * (n * 1.05);

  gsap.set(scenes, { opacity: 0 });
  gsap.set(scenes[0], { opacity: 1 });
  gsap.set(beats, { opacity: 0, y: 18 });
  gsap.set(beats[0], { opacity: 1, y: 0 });
  if (fillEl) fillEl.style.width = '0%';

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: day,
      start: 'top top',
      end: () => '+=' + total(),
      pin: stage,
      scrub: 0.7,
      invalidateOnRefresh: true,
      onUpdate: self => {
        const p = self.progress;
        if (fillEl) fillEl.style.width = (p * 100).toFixed(2) + '%';
        const i = Math.min(n - 1, Math.floor(p * n + 0.0001));
        if (clockEl) clockEl.textContent = times[i] || '';
        if (noEl) noEl.textContent = String(i + 1).padStart(2, '0');
      }
    }
  });

  // HOLD is the share of each segment the scene sits still for.
  // 0.87 leaves roughly an eighth of each segment as the actual dissolve.
  // Wider than that and the reader spends real scroll distance looking at
  // two different rooms superimposed, which reads as a fault.
  const HOLD = 0.87;
  for (let i = 1; i < n; i++) {
    tl.to({}, { duration: HOLD })
      .to(scenes[i], { opacity: 1, duration: 1 - HOLD, ease: 'power1.inOut' }, '<' + HOLD)
      // The incoming caption starts well before the outgoing one has
      // cleared. Without a real overlap there is a scroll position where
      // neither is lit and the frame carries no words at all.
      .to(beats[i - 1], { opacity: 0, y: -14, duration: (1 - HOLD) * 0.5, ease: 'power1.in' }, '<')
      .to(beats[i], { opacity: 1, y: 0, duration: (1 - HOLD) * 0.9, ease: EASE }, '<' + (1 - HOLD) * 0.18);
  }
  tl.to({}, { duration: HOLD });

  // A slow drift on the live scene. Small: past a couple of percent it
  // stops reading as a camera and starts reading as a wobble.
  scenes.forEach(s => {
    gsap.fromTo(s, { scale: 1.05 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: day, start: 'top top', end: () => '+=' + total(), scrub: 1.2 }
    });
  });

  show(0);
}

/* ------------------------------------------------------------
   Flow sections
   Fires once on entry, never re-hides.
   ------------------------------------------------------------ */
function flow() {
  gsap.utils.toArray('[data-in]').forEach(block => {
    const kids = block.children.length ? block.children : [block];
    gsap.set(kids, { opacity: 0, y: REDUCED ? 0 : 16 });
    gsap.to(kids, {
      opacity: 1, y: 0,
      duration: REDUCED ? 0.01 : 0.68,
      stagger: 0.08,
      ease: EASE,
      scrollTrigger: { trigger: block, start: 'top 88%', once: true }
    });
  });
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
function boot() {
  nav();
  hero();
  theDay();
  flow();
  ScrollTrigger.refresh();

  // Verification hooks for the scroll-craft harness.
  document.querySelectorAll('.hero, .day, .pillars, .programmes, .close').forEach(el => {
    el.setAttribute('data-sc-act', el.className.split(' ')[0]);
  });
  document.documentElement.classList.add('sc-ready');
}

if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
else window.addEventListener('load', boot);
