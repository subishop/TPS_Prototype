/* ============================================================
   THE POSTPARTUM SUITE — scroll narrative
   GSAP + ScrollTrigger. Seven acts, five device families,
   no family twice in a row.

   Motion rule inherited from the brand: calm before persuasive.
   Nothing here bounces, overshoots, or asks for attention.
   ============================================================ */

document.documentElement.classList.add('js');

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'power2.out';

// The mist handoff's total scroll length, in viewport-heights, and how long
// the hero stays pinned within it. Shared with nav() so the wordmark's own
// scroll-triggered change waits until this has fully resolved instead of
// firing mid-illusion.
//
// The pin ends exactly where the bath section's own sticky takes over,
// which is what the -100svh margin on .act--bath buys. See mistHandoff()
// for the rest of the arithmetic.
// The hero is pinned for almost the whole handoff now, because it is
// consumed from below by the rising scene rather than sliding out from
// under it. A pinned hero has no moving edge, which is what lets the veil
// stay light enough that the screen never goes blank.
const MIST_VH = 1.5;
const MIST_PIN_VH = 1.46;

/* ------------------------------------------------------------
   Kinetic type: split a heading into real line boxes.
   Measured after fonts load, because line boxes move when the
   display face swaps in.
   ------------------------------------------------------------ */
function splitLines(el) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.textContent = '';

  // Lay every word out individually so we can read its offsetTop.
  const probes = words.map(w => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.display = 'inline-block';
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });

  const rows = [];
  let currentTop = null;
  probes.forEach((s, i) => {
    const top = s.offsetTop;
    if (currentTop === null || Math.abs(top - currentTop) > 4) {
      rows.push([]);
      currentTop = top;
    }
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
   ACT 1 · 07:00 · Arrival
   pin + focus pull + kinetic lines
   ------------------------------------------------------------ */
function actHero() {
  const act = document.querySelector('.act--hero');
  if (!act) return;

  const img = act.querySelector('[data-focus]');
  const heading = act.querySelector('[data-kinetic]');
  const fades = act.querySelectorAll('[data-fade]');

  // A slow push in, and only a trace of softening. This used to run to
  // 7px of blur, which on top of the fog left the hero looking degraded
  // rather than obscured: the photograph has to stay intact and simply be
  // buried, or the whole handoff reads as an image failing rather than as
  // weather. The fog does the hiding now, so this only has to keep the
  // frame from sitting still.
  if (!REDUCED) {
    gsap.set(img, { filter: 'blur(0px)', scale: 1 });
    gsap.to(img, {
      filter: 'blur(2px)',
      scale: 1.05,
      ease: 'none',
      scrollTrigger: {
        trigger: act,
        start: 'top top',
        end: () => '+=' + window.innerHeight * MIST_PIN_VH,
        scrub: 0.6
      }
    });
  }

  // The landing screen is the one screen every visitor sees, so its headline
  // must never depend on a JS animation finishing. This entrance is CSS
  // keyframes with fill-mode both: a throttled or stalled rAF cannot leave
  // the hero parked at a fraction of full opacity, and with JS disabled
  // entirely the copy is simply there. JS only measures the line boxes.
  const lines = heading ? splitLines(heading) : [];
  lines.forEach((line, i) => line.style.setProperty('--i', i));
  fades.forEach((el, i) => el.style.setProperty('--i', i));
  act.classList.add('is-ready');
}

/* ------------------------------------------------------------
   ACT 2 · 09:30 · Rest
   reveal. A wipe up a full-bleed frame.
   ------------------------------------------------------------ */
function actRest() {
  const act = document.querySelector('.act--rest');
  if (!act) return;

  const say = act.querySelector('[data-fade]');
  const frame = act.querySelector('[data-reveal]');

  gsap.set(say, { opacity: 0, y: REDUCED ? 0 : 16 });
  gsap.to(say, {
    opacity: 1, y: 0, duration: 0.8, ease: EASE,
    scrollTrigger: { trigger: say, start: 'top 82%', once: true }
  });

  if (REDUCED) return;

  gsap.set(frame, { clipPath: 'inset(100% 0% 0% 0%)' });
  gsap.to(frame, {
    clipPath: 'inset(0% 0% 0% 0%)',
    ease: 'none',
    scrollTrigger: {
      trigger: frame,
      start: 'top 88%',
      end: 'top 32%',
      scrub: 0.5
    }
  });
}

/* ------------------------------------------------------------
   ACT 3 · 11:00 · The treatment
   parallax drift + cross-fade across three stills
   ------------------------------------------------------------ */
function actTreatment() {
  const act = document.querySelector('.act--treatment');
  if (!act) return;

  const imgs = gsap.utils.toArray('.xfade__img', act);
  const heading = act.querySelector('[data-kinetic]');
  const copy = act.querySelectorAll('.stage__side .body');

  if (heading) {
    const lines = splitLines(heading);
    gsap.set(lines, { yPercent: 108, opacity: 0 });
    gsap.to(lines, {
      yPercent: 0, opacity: 1,
      duration: REDUCED ? 0.01 : 0.9,
      stagger: REDUCED ? 0 : 0.08,
      ease: EASE,
      scrollTrigger: { trigger: act, start: 'top 68%', once: true }
    });
  }

  gsap.set(copy, { opacity: 0, y: REDUCED ? 0 : 14 });
  gsap.to(copy, {
    opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: EASE,
    scrollTrigger: { trigger: act, start: 'top 62%', once: true }
  });

  if (REDUCED || imgs.length < 2) return;

  // Drift closer as the act crosses the viewport. Attention being paid.
  gsap.fromTo(imgs,
    { scale: 1.1 },
    {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: act, start: 'top bottom', end: 'bottom top', scrub: 0.7 }
    }
  );

  // Cross-fade. Each still fades up over the one before it and then holds.
  // Sequential positions matter: overlapping them put all three part-way at
  // once, and three stacked semi-transparent photographs read as a double
  // exposure rather than as a transition.
  // Hold long, hand over fast. Under a scrub the reader's most likely
  // position is the middle of whatever is running, so a slow cross-fade
  // means they mostly see a half-and-half blend of two unrelated
  // compositions, which reads as a rendering fault rather than a
  // transition. Roughly a fifth of each segment is the actual fade.
  gsap.set(imgs.slice(1), { opacity: 0 });
  const tl = gsap.timeline({
    scrollTrigger: { trigger: act, start: 'top 76%', end: 'bottom 30%', scrub: 0.8 }
  });
  tl.to({}, { duration: 1.1 });
  imgs.slice(1).forEach(img => {
    tl.to(img, { opacity: 1, duration: 0.38, ease: 'power1.inOut' })
      .to({}, { duration: 1.1 });
  });
}

/* ------------------------------------------------------------
   ACT 4 · 13:00 · Four kinds of care
   pan. Vertical scroll, lateral travel.
   ------------------------------------------------------------ */
function actPan() {
  const act = document.querySelector('.act--pan');
  if (!act) return;

  const rail = act.querySelector('[data-rail]');
  const stage = act.querySelector('[data-stage]');
  if (!rail || !stage) return;

  if (REDUCED) {
    // The rail is navigation, not decoration, so it cannot simply be frozen.
    stage.style.overflowX = 'auto';
    stage.style.height = 'auto';
    stage.style.paddingBlock = '64px';
    rail.style.scrollSnapType = 'x proximity';
    return;
  }

  const measure = () => Math.max(0, rail.scrollWidth - window.innerWidth);

  // Measure the overflow rather than assuming it. A rail narrower than the
  // viewport travels zero and the act becomes a motionless pinned screen.
  ScrollTrigger.create({
    trigger: act,
    start: 'top top',
    // Only a short beat past the end of the travel, enough to read the
    // closing note. A larger buffer leaves the rail finished and the stage
    // pinned on a motionless screen, which reads as the page having stalled.
    end: () => '+=' + (measure() + window.innerHeight * 0.22),
    pin: stage,
    scrub: 0.8,
    refreshPriority: 2,
    invalidateOnRefresh: true,
    animation: gsap.to(rail, { x: () => -measure(), ease: 'none' })
  });

  // Items settle in sequence, so the rail reads as a drawer being pulled
  // rather than a slideshow. The first item is exempt: a pan act needs its
  // opening content already present.
  const items = gsap.utils.toArray('.rail__item', rail).slice(1);
  items.forEach(item => {
    gsap.fromTo(item,
      { opacity: 0.55, y: 18 },
      {
        opacity: 1, y: 0, duration: 0.6, ease: EASE,
        scrollTrigger: {
          trigger: item,
          containerAnimation: null,
          start: 'top 92%',
          once: true
        }
      }
    );
  });
}

/* ------------------------------------------------------------
   ACT 5 · 15:00 to 19:00 · The dissolve. THE PEAK.
   pin + cross-dissolve. The frame does not move. The light leaves it.
   Largest span on the page.
   ------------------------------------------------------------ */
function actPeak() {
  const act = document.querySelector('.act--peak');
  if (!act) return;

  const stage = act.querySelector('[data-stage]');
  const night = act.querySelector('.dissolve__night');
  const plate = act.querySelector('.plate');
  const cues = {
    a: act.querySelector('[data-cue="a"]'),
    b: act.querySelector('[data-cue="b"]'),
    c: act.querySelector('[data-cue="c"]')
  };

  if (REDUCED) {
    gsap.set([cues.a, cues.b, cues.c], { opacity: 1, y: 0 });
    return;
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: act,
      start: 'top top',
      // A function, not a string. Computed once, this froze the peak's span at
      // whatever the viewport was on first paint, so every later refresh, a
      // resize, a rotation, an address bar collapsing, left the pin running
      // to a stale pixel value while everything around it had re-measured.
      end: () => '+=' + window.innerHeight * 3.2,
      pin: stage,
      scrub: 0.9,
      // Pins are refreshed highest priority first. Giving them explicit
      // descending values in document order means each one measures its own
      // start after every pin above it has already claimed its spacer.
      refreshPriority: 1,
      invalidateOnRefresh: true
    }
  });

  // "Three in the afternoon" is already on screen when the act begins,
  // so the pinned stage is never a frame of empty photograph.
  gsap.set(cues.a, { opacity: 1, y: 0 });
  gsap.set([cues.b, cues.c], { opacity: 0, y: 12 });

  // The dissolve is the act. It used to run 0.7 to 3.1 of a six unit
  // timeline, so the light had finished leaving barely half way through and
  // the remaining scroll was carried by two lines of text fading, which move
  // about a third of one percent of the screen. Measured, that was a full
  // viewport-height of scrolling with nothing visibly happening, in the one
  // act built to be the thing people remember. Running it 0.25 to 5.15
  // instead means the room is still darkening under every line, and the
  // closing frame is unchanged: night full, plate gone.
  tl.to(cues.a, { opacity: 0, y: -10, duration: 0.8 }, 0.9)
    .to(night,   { opacity: 1, duration: 4.9, ease: 'none' }, 0.25)
    .to(cues.b,  { opacity: 1, y: 0, duration: 0.8 }, 1.5)
    .to(cues.b,  { opacity: 0, y: -10, duration: 0.7 }, 2.9)
    .to(cues.c,  { opacity: 1, y: 0, duration: 0.9 }, 3.3)
    // This is not the last act on the page, so its closing line must not
    // hold. A held cue stays lit through the whole un-pin slide, travelling
    // a full viewport upward and overlapping the section that follows.
    // The plate goes with it: fading only the line leaves an empty canvas
    // box sitting on the photograph, which reads as a rendering fault.
    .to(plate,   { opacity: 0, duration: 0.6 }, 5.4);
}

/* ------------------------------------------------------------
   ACT 6 · 22:00 · Night, then stillness
   ------------------------------------------------------------ */
function actNight() {
  const act = document.querySelector('.act--night');
  if (!act) return;
  const items = act.querySelectorAll('.say, .script');
  gsap.set(items, { opacity: 0, y: REDUCED ? 0 : 18 });
  gsap.to(items, {
    opacity: 1, y: 0, duration: 0.9, stagger: 0.22, ease: EASE,
    scrollTrigger: { trigger: act, start: 'top 72%', once: true }
  });
}

/* ------------------------------------------------------------
   ACT 7 · Programmes
   flow + in. Fires once on entry, never re-hides.
   ------------------------------------------------------------ */
function actFlow() {
  gsap.utils.toArray('[data-in]').forEach(block => {
    const kids = block.children.length ? block.children : [block];
    gsap.set(kids, { opacity: 0, y: REDUCED ? 0 : 14 });
    gsap.to(kids, {
      opacity: 1, y: 0,
      duration: REDUCED ? 0.01 : 0.62,
      stagger: 0.07,
      ease: EASE,
      scrollTrigger: { trigger: block, start: 'top 88%', once: true }
    });
  });
}

/* ------------------------------------------------------------
   THE DAY-CLOCK RAIL — signature move
   One hairline. The time advances with scroll across the narrative,
   07:00 to 22:00. A tick travels the rule. The label names the act.
   ------------------------------------------------------------ */
function dayClock() {
  const clock = document.querySelector('[data-clock]');
  if (!clock) return;

  const timeEl = clock.querySelector('[data-clock-time]');
  const tickEl = clock.querySelector('[data-clock-tick]');
  const labelEl = clock.querySelector('[data-clock-label]');
  const acts = gsap.utils.toArray('[data-act][data-time]');
  if (!acts.length) return;

  const first = acts[0];
  const last = document.querySelector('.act--night') || acts[acts.length - 1];

  const toMinutes = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  // Round the whole figure, then split it. Rounding the minutes on their own
  // and taking them modulo 60 threw the carry away, so every value from :57.5
  // to :59 printed as the top of the hour it had just left. Scrolling through
  // the afternoon the readout went 13:45, 13:00, 14:10: the one number on the
  // page whose only job is to always move forward, going backwards.
  const fmt = mins => {
    const t = Math.round(mins / 5) * 5;
    const h = Math.floor(t / 60) % 24;
    return String(h).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  const END = toMinutes('22:00');

  // The clock has to agree with the copy. A single linear ramp across the
  // whole page put 17:40 on screen beside a line reading "Seven in the
  // evening", so the time is interpolated act by act instead: each act
  // declares the hour it opens on, and the readout travels between them.
  // An act's document position is normally the same thing as the scroll
  // position it takes the screen at. The bath is the exception: it is dragged
  // up underneath the hero by a negative margin so it can rise out of the fog,
  // which puts its measured top half a viewport down the page while the hero
  // is still pinned and filling the frame. Reading the band boundary off the
  // DOM there announces 08:30 over the bedroom. So an overlapped act declares
  // where its band really starts, in viewport heights, and the clock uses that
  // instead of its position in the document.
  const BAND_START = { bath: MIST_PIN_VH };
  const actKey = el => (el.className.match(/act--([a-z]+)/) || [])[1];
  const bandTop = el => {
    const declared = BAND_START[actKey(el)];
    return declared != null
      ? window.innerHeight * declared
      : el.getBoundingClientRect().top + window.scrollY;
  };

  let bands = [];
  const measure = () => {
    const tops = acts.map(bandTop);
    bands = acts.map((el, i) => ({
      top: tops[i],
      bottom: i + 1 < acts.length ? tops[i + 1] : tops[i] + el.offsetHeight,
      from: toMinutes(el.dataset.time),
      el
    }));
    bands.forEach((b, i) => { b.to = bands[i + 1] ? bands[i + 1].from : END; });
    ruleH = clock.querySelector('.clock__rule').getBoundingClientRect().height;
  };

  let ruleH = 0;
  measure();

  ScrollTrigger.create({
    trigger: first,
    start: 'top top',
    endTrigger: last,
    // Until the night act has actually left the top of the screen, not until
    // its foot reaches the bottom of it. Ending at "bottom bottom" stopped the
    // rail a full viewport early, which switched it off before the night act
    // was read and froze the readout at 21:25. The arc the rail exists to draw
    // is 07:00 to 22:00, so it has to be allowed to arrive.
    end: 'bottom top',
    onRefresh: measure,
    onUpdate: self => {
      const y = self.scroll();
      let band = bands[0];
      for (const b of bands) { if (y >= b.top - 1) band = b; }
      const span = Math.max(1, band.bottom - band.top);
      const local = Math.min(1, Math.max(0, (y - band.top) / span));
      timeEl.textContent = fmt(band.from + (band.to - band.from) * local);
      tickEl.style.transform = 'translateY(' + (self.progress * ruleH) + 'px)';
      if (band.el.dataset.label) labelEl.textContent = band.el.dataset.label;
    },
    onToggle: self => clock.classList.toggle('is-on', self.isActive),
    // Measures where everything else ended up, so it goes last.
    refreshPriority: -1,
    invalidateOnRefresh: true
  });

  // The rail is ink on a multiply blend, which disappears against the dark
  // night photograph. Rather than invert it mid-dissolve, it steps aside for
  // the peak entirely: that act's plate already names the time in prose, so
  // the readout is redundant exactly there, and the one moment the page is
  // built around is better with nothing competing in the margin.
  // Both full-bleed acts run edge to edge, so the rail would sit on top of
  // a rail card or a photograph rather than in a margin. It steps aside for
  // them and returns for the document-like acts either side.
  // Same correction as the bands, but not the same number. The bath's
  // document top sits above the fold, so "top 70%" is already behind us at
  // scroll zero and the rail hid itself over the hero, where it belongs on
  // screen. It then has to leave again before the fog thins, not when the
  // bath section formally begins: the rail is opaque and the bath is
  // full bleed, so a late exit means a white chip sitting on the
  // photograph. Half a viewport in, the veil is at its peak and covering
  // the rail, so the 400ms fade underneath it is never seen.
  const AWAY_START = { bath: 0.5 };
  let away = 0;
  document.querySelectorAll('[data-clock-away]').forEach(section => {
    const declared = AWAY_START[actKey(section)];
    ScrollTrigger.create({
      trigger: section,
      start: declared != null ? () => window.innerHeight * declared : 'top 70%',
      end: 'bottom 30%',
      onToggle: self => {
        away += self.isActive ? 1 : -1;
        clock.classList.toggle('is-away', away > 0);
      }
    });
  });

  window.addEventListener('resize', measure);
}

/* ------------------------------------------------------------
   NAVIGATION, centred lockup
   Tab group left, mark centre, tab group right. One panel open at a
   time, the open tab carries the accent, the page behind goes back
   under a veil.

   The bar itself is transparent, so legibility is the chips' job plus
   one theme flip: this page is light almost everywhere, and the only
   dark ground is the night half of the peak dissolve.
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

  // The logo morph: full lockup through the mist handoff, mark alone once
  // it has fully resolved. Originally a flat 48px, which fired while the
  // fog was still building and read as the header reacting on its own,
  // competing with the dissolve. Waiting out the whole handoff (with a
  // small margin so it does not sit at the exact frame the curtain clears)
  // keeps the bar inert while the one thing that should be noticed is.
  const updateScrolled = () => root.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * MIST_VH * 1.05);
  window.addEventListener('scroll', updateScrolled, { passive: true });
  window.addEventListener('resize', updateScrolled, { passive: true });
  updateScrolled();

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
   THE MIST HANDOFF
   A bank of ground fog climbs the pinned hero, buries it, and the bath is
   standing there when the bank thins.

   Three things this is built to avoid, all of them learned the hard way.

   The hero is never faded and never wiped. A photograph losing opacity
   reads as an image failing to load, not as one being swallowed, and a
   clip-path front puts a ruler-straight line across the frame. The only
   thing that happens to the hero is that fog accumulates in front of it.

   The fog arrives by moving, not by fading. Ramping the opacity of a full
   frame plate is a wash, and a wash is what made the last attempt look
   like a white screen rather than weather.

   And the two sections overlap rather than queue. .act--bath carries a
   -100svh margin so its sticky scene is already in position when the pin
   releases at p 0.57. Without that the page has to spend a full viewport
   scrolling one section out and the next one in with nothing to look at,
   which is where the several screens of blank white came from.
   ------------------------------------------------------------ */
function mistHandoff() {
  const heroStage = document.querySelector('.act--hero .stage');
  const fog = document.querySelector('[data-fog]');
  const bath = document.querySelector('[data-bath]');
  if (!heroStage || !fog || !bath) return;

  const veil = fog.querySelector('[data-fog-veil]');
  const ground = bath.querySelector('[data-bath-ground]');
  const scrim = bath.querySelector('[data-bath-scrim]');
  const bathImg = bath.querySelector('[data-bath-img]');
  const line = bath.querySelector('[data-bath-line]');

  if (REDUCED) {
    gsap.set([ground, scrim, line], { opacity: 1 });
    gsap.set(line, { y: 0 });
    return;
  }

  // The whole handoff is now one photograph moving. The steam and the bath
  // are the same exposure, in the same light, off the same tub, so the
  // relationship between them is not something we have to fake with a fog
  // plate floating over a second picture. It also means there is nothing
  // left to line up: no plate travel to match against a scene travel, no
  // two masks to keep in step. The image goes up, and that is the mechanic.
  //
  // It travels exactly its own height, which puts it entirely below the
  // frame at the start and rested on the bottom at the end. Read as a
  // function so it re-measures on resize, because the height is derived
  // from the window width.
  const RISE_AT = 0.06;
  const RISE_END = 0.97;
  const riseBy = () => bathImg.offsetHeight;

  // Far lighter than it was, and it now only covers the beat before the
  // steam is on screen at all. It used to be load bearing, hiding a join;
  // there is no join any more.
  const VEIL_PEAK = 0.42;

  gsap.set(fog, { opacity: 1 });
  gsap.set(veil, { opacity: 0 });
  gsap.set([ground, scrim], { opacity: 0 });
  gsap.set(bathImg, { y: riseBy });
  gsap.set(line, { opacity: 0, y: 18 });

  const vh = () => window.innerHeight;

  // The hero holds still for the whole of the covering, so it has no moving
  // edge that could enter the frame while it is being buried.
  ScrollTrigger.create({
    trigger: '.act--hero',
    start: 'top top',
    end: () => '+=' + vh() * MIST_PIN_VH,
    pin: heroStage,
    pinSpacing: true,
    refreshPriority: 3,
    invalidateOnRefresh: true
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      start: 0,
      end: () => vh() * MIST_VH,
      scrub: 0.7,
      invalidateOnRefresh: true
    }
  });

  tl
    // The one move. Steam sweeps up the frame, thickening as the denser part
    // of the column arrives, the bath surfaces underneath it, and the spent
    // steam carries on up past the top of the window where .bath clips it.
    .fromTo(bathImg,
      { y: riseBy },
      { y: 0, ease: 'none', duration: RISE_END - RISE_AT }, RISE_AT)

    // Weather before the steam itself is high enough to read, so the room
    // is already softening by the time the column arrives rather than
    // sitting sharp until something crosses it.
    .to(veil, { opacity: VEIL_PEAK, duration: 0.16, ease: 'none' }, 0.08)
    .to(veil, { opacity: 0, duration: 0.28, ease: 'none' }, 0.38)

    // The ground the steam ends up dissolving into. At rest the top of the
    // frame is still steam rather than photograph, so something has to be
    // behind it, and the hero cannot be: the bedroom would show through.
    // It arrives at the end of the climb, when that part of the frame is
    // carrying the densest steam it ever carries, and both grounds are pale
    // enough that the swap is a few levels of grey under all of that.
    .to(ground, { opacity: 1, duration: 0.13, ease: 'none' }, 0.83)
    .to(scrim, { opacity: 1, duration: 0.13, ease: 'none' }, 0.83)
    .to(line, { opacity: 1, y: 0, duration: 0.10, ease: EASE }, 0.88);
}

/* ------------------------------------------------------------
   NAV THEME
   The bar carries no background, so its ink has to flip over the one
   dark ground on the page: the night half of the peak dissolve.

   Measured across the whole peak section, not just its pinned travel.
   A toggle driven off the pin stops updating the moment the pin ends,
   which is precisely when the dark frame is still sliding up past the
   bar. Created after the pin exists so it measures the spacer.
   ------------------------------------------------------------ */
function navTheme() {
  const bar = document.querySelector('[data-nav]');
  const peak = document.querySelector('.act--peak');
  if (!bar || !peak) return;

  ScrollTrigger.create({
    trigger: peak,
    start: 'top top',
    end: 'bottom top',
    invalidateOnRefresh: true,
    onUpdate: self => bar.classList.toggle('is-dark', self.progress > 0.23),
    onLeave: () => bar.classList.remove('is-dark'),
    onLeaveBack: () => bar.classList.remove('is-dark')
  });
}

/* ------------------------------------------------------------
   BLUSH DRIFT
   The shared ground under acts 2 and 3, "You go back to bed" and
   "The care turns toward you". One canvas, one WebGL context, one
   continuous field across both, so the two acts read as one place
   and there is no join between them to see.

   Shader and uniform values are the Blush Drift preset from
   "TPS Mesh Drift Background v2 stronger.html", unchanged. Only the
   palette is named here; everything else is copied so the field on
   the page is the one that was designed, not an approximation of it.

   Two things this does that the source file does not need to.

   It fades. The canvas is behind the whole document, so it has to be
   switched off everywhere else, and the switching itself must not be
   visible. Both fades are therefore timed to run while an opaque
   neighbour is covering the screen: in behind the bath while it is
   still stuck flush, out behind the coral band once it is pinned. By
   the time either edge of the field could be seen, it has finished
   moving.

   It sleeps. A fragment shader running on every frame for the eleven
   viewport-heights where it cannot be seen is heat and battery spent
   on nothing, so the loop runs only across the span it serves.
   ------------------------------------------------------------ */
function meshDrift() {
  const canvas = document.querySelector('[data-drift]');
  const vsEl = document.getElementById('drift-vs');
  const fsEl = document.getElementById('drift-fs');
  const first = document.querySelector('.act--rest');
  const last = document.querySelector('.act--treatment');
  if (!canvas || !vsEl || !fsEl || !first || !last) return;

  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power'
  }) || canvas.getContext('experimental-webgl');

  // No WebGL is not a failure worth a fallback colour here. The two acts
  // already have grounds they look correct on, so leave them alone.
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error(gl.getShaderInfoLog(s));
    return s;
  };

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsEl.textContent));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsEl.textContent));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  // One triangle big enough to cover the clip volume. Cheaper than a quad
  // and there is no seam down the diagonal.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = name => gl.getUniformLocation(prog, name);
  const uColors = U('u_colors[0]');
  const uScene = U('u_scene');

  // Verbatim from the preset. scale/intensity/paramA/warp, then
  // detail/contrast/brightness/saturation, then hue/vignette/blur/grain,
  // then seed/rotate/drift/oklab. Cursor reactivity is off: this is a
  // ground behind reading copy, not something to play with.
  gl.uniform4f(U('u_shape'), 1.16, 0.34, 0.50, 0.00);
  gl.uniform4f(U('u_surface'), 2.40, 1.24, 0.00, 1.00);
  gl.uniform4f(U('u_finish'), 0.00, 0.00, 0.000, 0.09);
  gl.uniform4f(U('u_transform'), 1453.0, 0.00, 0.00, 0.0);
  gl.uniform4f(U('u_space'), 0.00, 0.00, 0.00, 0.00);
  gl.uniform4f(U('u_cursor'), 0.00, 2.00, 0.65, 0.46);

  // Warm paper. The first colour also seeds the field's base weight, so it
  // is the ground the other three bloom through.
  //
  // Blush drift was tried here first and failed two measurements, both from
  // the same cause: it draws its colour from the same corner of the palette
  // as the coral band in the act below. It met that band as warm pink
  // against duller mauve, 240,189,183 against 226,202,198, close enough
  // that the join read as a fault rather than as a change. And it cost
  // about half the contrast on the page, taking the caption under the bleed
  // photo to 3.22 where body text needs 4.5. Warm paper stays in the
  // neutrals, so the meeting with the band is a real change of colour again
  // and the copy keeps its headroom.
  const FIELD = ['#F6F6F6', '#E3D7D3', '#E2CAC6', '#C9B9B5'];
  const colorBuf = new Float32Array(24);
  FIELD.concat(FIELD, FIELD).slice(0, 8).forEach((hex, i) => {
    const n = parseInt(hex.slice(1), 16);
    colorBuf[i * 3] = ((n >> 16) & 255) / 255;
    colorBuf[i * 3 + 1] = ((n >> 8) & 255) / 255;
    colorBuf[i * 3 + 2] = (n & 255) / 255;
  });
  gl.uniform3fv(uColors, colorBuf);

  let w = 0, h = 0;
  const resize = () => {
    // Capped at 2. Past that the shader is paying for pixels nobody can
    // resolve, on exactly the phones least able to afford them.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.round(window.innerWidth * dpr);
    const nh = Math.round(window.innerHeight * dpr);
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  };
  resize();

  let elapsed = 0, prev = 0, raf = 0, frozen = false, running = false;

  const draw = () => {
    resize();
    gl.uniform4f(uScene, w, h, elapsed * 0.73, FIELD.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const tick = now => {
    raf = requestAnimationFrame(tick);
    // Clamped, so a tab that was backgrounded or a frame that took a
    // second does not jump the field forward to somewhere unrelated.
    elapsed += Math.min((now - prev) / 1000, 0.1);
    prev = now;
    draw();
  };

  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  const start = () => {
    if (raf) return;
    // Reduced motion still gets the field, just not the drift. It is a
    // ground, and a still gradient is not the thing anyone was asking to
    // be spared.
    if (frozen || REDUCED) { draw(); return; }
    prev = performance.now();
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener('resize', () => { if (!raf) draw(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (running) start();
  });

  // Expressed against the acts rather than as absolute scroll positions,
  // so it survives the sections changing height. "top bottom+=100%" is a
  // full viewport before this act's top would reach the bottom of the
  // screen, which is well inside the stretch the bath is covering.
  gsap.fromTo(canvas, { opacity: 0 }, {
    opacity: 1, ease: 'none',
    scrollTrigger: {
      trigger: first,
      start: 'top bottom+=100%',
      end: 'top bottom+=20%',
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  gsap.to(canvas, {
    opacity: 0, ease: 'none',
    scrollTrigger: {
      trigger: last,
      start: 'bottom top',
      end: 'bottom top-=40%',
      scrub: true,
      invalidateOnRefresh: true
    }
  });

  // Slightly wider than the fades at both ends, so the field is already
  // being drawn before it is worth anything and stops only once it is
  // worth nothing.
  ScrollTrigger.create({
    trigger: first,
    start: 'top bottom+=110%',
    endTrigger: last,
    end: 'bottom top-=50%',
    invalidateOnRefresh: true,
    onToggle: self => {
      running = self.isActive;
      if (running) start(); else stop();
    }
  });

  document.documentElement.classList.add('drift-on');
  draw();

  // For the capture harness only. A shader on a wall clock never draws the
  // same frame twice, so every before and after comparison would fail for
  // a reason that has nothing to do with the change being tested.
  window.__drift = {
    freeze(t) { frozen = true; stop(); elapsed = t || 0; draw(); }
  };
}

/* ------------------------------------------------------------
   Boot. Line splitting needs real line boxes, so it waits for
   the display face rather than for DOMContentLoaded.
   ------------------------------------------------------------ */
function boot() {
  nav();
  actHero();
  actRest();
  actTreatment();
  actPan();
  actPeak();
  actNight();
  actFlow();
  dayClock();
  mistHandoff();
  navTheme();
  meshDrift();
  ScrollTrigger.refresh();

  // Verification hooks. The scroll-craft harness walks acts by these
  // attributes and waits on this class before it starts shooting. They are
  // read-only markers; nothing on the page behaves differently because of them.
  document.querySelectorAll('[data-act]').forEach(a => {
    const m = a.className.match(/act--([a-z]+)/);
    a.setAttribute('data-sc-act', m ? m[1] : 'act');
  });
  document.documentElement.classList.add('sc-ready');
}

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(boot);
} else {
  window.addEventListener('load', boot);
}
