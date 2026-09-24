/* ============================================================
   THE POSTPARTUM SUITE, The Care: the flight

   The scroll is the remote control. One continuous film (26.9s) is scrubbed
   by the wheel through a sticky stage, and everything else on the stage is
   derived from the same position along the track:

     LEGS         the single source of truth: film seconds and scroll weight
     mapTime      track position to film time
     playhead     lerped, deadbanded, coalesced seeks on a Blob fetched clip
     beats        copy windows; words drift the way the room does in each pan
     tilt         pointer depth, desktop only
     plan         the house in section, with a dot on the route and room jumps
     focal        on a phone, the crop follows the carer

   Track position t is measured in viewport heights, the unit the weights are
   written in. Film timings were read off a contact sheet of the encoded clip
   (lab/care-encode.mjs); if the film changes, re-read them.
   ============================================================ */
(function () {
  'use strict';

  var section = document.querySelector('[data-flight]');
  if (!section) return;
  var stage = section.querySelector('[data-stage]');
  var video = section.querySelector('[data-video]');

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(pointer: fine)').matches;
  var phoneQuery = matchMedia('(max-width: 767px)');

  /* ---------- LEGS ----------
     kind 'settle' is a room with a service in it; the camera lingers there
     in the film itself and gets the most scroll here. 'move' legs are the
     pans between rooms and run quicker, so each room lands. The film never
     stops anywhere on the track: no dead scroll.
     dir is the camera move INTO that leg: how the world travels on screen.
     fx is where the carer stands in the frame, for the phone crop. */
  var LEGS = [
    { name: 'door',    to: 1.0,   w: 0.60, kind: 'move',   fx: 52 },
    { name: 'hall',    to: 4.0,   w: 0.60, kind: 'move',   fx: 58 },
    { name: 'kitchen', to: 7.8,   w: 1.40, kind: 'settle', fx: 66, dir: 'forward', poster: 1 },
    { name: 'panL',    to: 9.0,   w: 0.30, kind: 'move',   fx: 66 },
    { name: 'living',  to: 12.4,  w: 1.30, kind: 'settle', fx: 78, dir: 'left',    poster: 2 },
    { name: 'tilt',    to: 14.0,  w: 0.35, kind: 'move',   fx: 30 },
    { name: 'nursery', to: 17.1,  w: 1.40, kind: 'settle', fx: 18, dir: 'up',      poster: 3 },
    { name: 'panR',    to: 19.4,  w: 0.45, kind: 'move',   fx: 40 },
    { name: 'bedroom', to: 22.3,  w: 1.20, kind: 'settle', fx: 52, dir: 'right',   poster: 4 },
    { name: 'sky',     to: 26.85, w: 1.10, kind: 'exit',   fx: 50, dir: 'forward', poster: 5 }
  ];

  var T = 0, film = 0;
  LEGS.forEach(function (leg) {
    leg.from = film; leg.s0 = T;
    T += leg.w; film = leg.to;
    leg.s1 = T;
  });
  var byName = {};
  LEGS.forEach(function (leg, i) { leg.i = i; byName[leg.name] = leg; });

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var mix = function (a, b, k) { return a + (b - a) * k; };
  var smooth = function (k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  var ramp = function (t, a, b) { return smooth((t - a) / (b - a)); };

  function legAt(t) {
    for (var i = 0; i < LEGS.length; i++) if (t < LEGS[i].s1) return LEGS[i];
    return LEGS[LEGS.length - 1];
  }

  function mapTime(t) {
    var leg = legAt(t);
    return mix(leg.from, leg.to, clamp((t - leg.s0) / leg.w, 0, 1));
  }

  /* Piecewise keyframes, [t, value...], interpolated with a smoothstep so
     every corner is rounded. Used for the plan dot and the phone crop. */
  function keyed(frames, t) {
    if (t <= frames[0][0]) return frames[0].slice(1);
    for (var i = 1; i < frames.length; i++) {
      var a = frames[i - 1], b = frames[i];
      if (t <= b[0]) {
        var k = smooth((t - a[0]) / (b[0] - a[0]));
        return a.slice(1).map(function (v, j) { return mix(v, b[j + 1], k); });
      }
    }
    return frames[frames.length - 1].slice(1);
  }

  /* ---------- beats ----------
     A room's words come up as the camera arrives and leave as it turns away,
     overlapping the next room's so the stage is never empty mid move. */
  var DIRS = { left: [1, 0], right: [-1, 0], up: [0, 1], forward: [0, 0] };
  var DRIFT_X = 0.06, DRIFT_Y = 0.04;      // of the viewport: 6vw, 4vh caps

  var settles = LEGS.filter(function (l) { return l.kind === 'settle'; });
  var beats = [];

  var introEl = section.querySelector('[data-beat="intro"]');
  if (introEl) beats.push({ el: introEl, win: function (t) { return { a: 1, b: ramp(t, 0.18, 0.5) }; }, vIn: [0, 0], vOut: [0, -0.6], scaleOut: 0 });

  settles.forEach(function (leg, n) {
    var el = section.querySelector('[data-beat="' + leg.name + '"]');
    if (!el) return;
    var next = settles[n + 1] || byName.sky;
    beats.push({
      el: el, room: leg.name, leg: leg,
      win: function (t) { return { a: ramp(t, leg.s0 - 0.25, leg.s0 + 0.1), b: ramp(t, leg.s1 - 0.1, leg.s1 + 0.25) }; },
      vIn: DIRS[leg.dir], vOut: DIRS[next.dir],
      scaleIn: leg.dir === 'forward', scaleOut: next.dir === 'forward'
    });
  });

  var skyEl = section.querySelector('[data-beat="sky"]');
  var sky = byName.sky;
  if (skyEl) beats.push({ el: skyEl, win: function (t) { return { a: ramp(t, sky.s0 + 0.2, sky.s0 + 0.7), b: 0 }; }, vIn: [0, 0], vOut: [0, 0], scaleIn: true });

  beats.forEach(function (bt) { bt.last = { o: -1, tf: '' }; });

  function paintBeats(t, vw, vh) {
    beats.forEach(function (bt) {
      var w = bt.win(t);
      var o = w.a * (1 - w.b);
      var tf = 'none';
      if (!reduced) {
        var inK = 1 - w.a, outK = w.b;
        var x = (-bt.vIn[0] * inK + bt.vOut[0] * outK) * DRIFT_X * vw;
        var y = (-bt.vIn[1] * inK + bt.vOut[1] * outK) * DRIFT_Y * vh;
        var s = 1 - (bt.scaleIn ? inK * 0.06 : 0) + (bt.scaleOut ? outK * 0.08 : 0);
        tf = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(4) + ')';
      }
      var oo = Math.round(o * 1000) / 1000;
      if (oo !== bt.last.o) {
        bt.el.style.opacity = oo;
        bt.el.style.visibility = oo > 0.001 ? 'visible' : 'hidden';
        bt.el.classList.toggle('is-live', oo > 0.5);
        bt.last.o = oo;
      }
      if (tf !== bt.last.tf) { bt.el.style.transform = tf; bt.last.tf = tf; }
    });
  }

  /* ---------- posters ----------
     First paint, the stand in while the clip loads, and the whole film
     under reduced motion. Each one owns the scroll from halfway through the
     move before its room to halfway through the move after it. */
  var posters = [].slice.call(section.querySelectorAll('[data-poster]'));
  var posterEdges = [0];
  [byName.hall, byName.panL, byName.tilt, byName.panR, byName.bedroom].forEach(function (leg) {
    posterEdges.push(leg.name === 'bedroom' ? leg.s1 + 0.2 : leg.s0 + leg.w * 0.5);
  });
  posterEdges.push(T + 1);
  var posterOn = 0;

  function paintPosters(t) {
    var idx = 0;
    for (var i = 1; i < posterEdges.length - 1; i++) if (t >= posterEdges[i]) idx = i;
    if (idx !== posterOn) {
      posters[posterOn] && posters[posterOn].classList.remove('is-on');
      posters[idx] && posters[idx].classList.add('is-on');
      posterOn = idx;
    }
    if (!reduced && !clipReady && posters[idx]) {
      var a = posterEdges[idx], b = posterEdges[idx + 1];
      posters[idx].style.setProperty('--push', (1.03 + clamp((t - a) / (b - a), 0, 1) * 0.08).toFixed(4));
    }
  }

  /* ---------- plan ---------- */
  var plan = section.querySelector('[data-plan]');
  var dot = section.querySelector('[data-plan-dot]');
  var rooms = [].slice.call(section.querySelectorAll('[data-room]'));
  var K = byName;
  var DOT = [
    [0.3, 112, 148],
    [K.kitchen.s0, 140, 120], [K.kitchen.s1, 140, 120],
    [K.living.s0, 60, 120],   [K.living.s1, 60, 120],
    [K.nursery.s0, 60, 80],   [K.nursery.s1, 60, 80],
    [K.bedroom.s0, 140, 80],  [K.bedroom.s1, 140, 80],
    [K.sky.s0 + 0.8, 196, 70]
  ];
  var FOCAL = [[0, 52]];
  LEGS.forEach(function (leg) { FOCAL.push([leg.s0 + leg.w * 0.5, leg.fx]); });
  var roomOn = null;

  function paintPlan(t) {
    var o = ramp(t, 0.45, 0.75) * (1 - ramp(t, K.sky.s0 + 0.1, K.sky.s0 + 0.5));
    stage.style.setProperty('--plan-o', o.toFixed(3));
    stage.style.setProperty('--plan-v', o > 0.01 ? 'visible' : 'hidden');
    if (dot) {
      var p = keyed(DOT, t);
      dot.setAttribute('cx', p[0].toFixed(1));
      dot.setAttribute('cy', p[1].toFixed(1));
    }
    var current = null;
    settles.forEach(function (leg) { if (t >= leg.s0 - 0.2) current = leg.name; });
    if (t >= K.sky.s0 + 0.3) current = null;
    if (current !== roomOn) {
      rooms.forEach(function (r) { r.setAttribute('aria-current', String(r.dataset.room === current)); });
      roomOn = current;
    }
  }

  rooms.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var leg = byName[btn.dataset.room];
      if (!leg) return;
      window.scrollTo({ top: trackTop + (leg.s0 + leg.w * 0.55) * vhPx, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  /* ---------- pointer depth ---------- */
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  var tiltOn = finePointer && !reduced;
  if (tiltOn) {
    addEventListener('pointermove', function (e) {
      tmx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1);
      tmy = clamp(e.clientY / innerHeight * 2 - 1, -1, 1);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { tmx = 0; tmy = 0; });
  }

  /* ---------- the clip ----------
     Fetched as a Blob so it seeks without depending on range requests, and
     never fetched at all under reduced motion. The poster stays up until a
     real decoded frame has painted: iOS leaves a seeked but never played
     muted video blank, so metadata alone is not enough. */
  var clipReady = false;
  var play = 0, target = 0;
  var LERP = 0.12;
  var deadband = (phoneQuery.matches || !finePointer) ? 0.02 : 0.008;

  function markReady() {
    if (clipReady) return;
    clipReady = true;
    stage.classList.add('has-clip');
  }

  function loadClip() {
    if (reduced || !video || !window.fetch) return;
    var mobile = phoneQuery.matches || !finePointer;
    var src = mobile ? video.dataset.srcMobile : video.dataset.src;
    fetch(src).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).then(function (blob) {
      video.addEventListener('loadeddata', function once() {
        video.removeEventListener('loadeddata', once);
        var p = video.play();
        var settle = function () {
          video.pause();
          // A frame callback is the real proof of paint. Some engines never
          // present a frame for a paused clip (headless Chrome among them),
          // so a timer backs it up rather than leaving the poster up forever.
          video.addEventListener('seeked', function first() {
            video.removeEventListener('seeked', first);
            if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(markReady);
            setTimeout(markReady, video.requestVideoFrameCallback ? 800 : 120);
          });
          play = target;
          video.currentTime = Math.max(0.001, play);
        };
        if (p && p.then) p.then(settle, settle); else settle();
      });
      video.preload = 'auto';
      video.src = URL.createObjectURL(blob);
      video.load();
    }).catch(function () { /* the posters carry the page */ });
  }

  function stepPlayhead() {
    if (!video || !video.src || video.readyState < 1) return;
    var d = target - play;
    play = Math.abs(d) < 0.001 ? target : play + d * LERP;
    if (!video.seeking && Math.abs(video.currentTime - play) > deadband) {
      video.currentTime = play;
    }
  }

  /* ---------- layout ---------- */
  var vhPx = innerHeight, vwPx = innerWidth, trackTop = 0;

  function layout() {
    vhPx = stage.offsetHeight || innerHeight;
    vwPx = innerWidth;
    if (vhPx > 0) section.style.height = Math.round((T + 1) * vhPx) + 'px';
    trackTop = section.getBoundingClientRect().top + scrollY;
  }

  function relayout() { layout(); frame(true); }
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  /* ---------- the frame ---------- */
  var lastT = -1, lastFx = '', lastBlend = -1;

  function frame(force) {
    var t = clamp((scrollY - trackTop) / vhPx, 0, T);

    if (force || t !== lastT) {
      target = Math.min(mapTime(t), 26.85);


      var blend = ramp(t, T - 0.6, T);
      if (blend !== lastBlend) { stage.style.setProperty('--blend', blend.toFixed(3)); lastBlend = blend; }

      var fx = phoneQuery.matches ? keyed(FOCAL, t)[0].toFixed(1) + '%' : '50%';
      if (fx !== lastFx) { stage.style.setProperty('--fx', fx); lastFx = fx; }

      paintBeats(t, vwPx, vhPx);
      paintPosters(t);
      paintPlan(t);
      lastT = t;
    }

    if (tiltOn) {
      mx += (tmx - mx) * 0.08;
      my += (tmy - my) * 0.08;
      stage.style.setProperty('--mx', mx.toFixed(3));
      stage.style.setProperty('--my', my.toFixed(3));
    }

    stepPlayhead();
  }

  function loop() { frame(false); requestAnimationFrame(loop); }

  layout();
  frame(true);
  requestAnimationFrame(loop);
  if (document.readyState === 'complete') loadClip();
  else addEventListener('load', loadClip);

  // For lab/care-check.mjs: read only, nothing on the page depends on it.
  window.__care = {
    T: T, legs: LEGS,
    state: function () {
      return { t: clamp((scrollY - trackTop) / vhPx, 0, T), target: target, play: play,
               current: video ? video.currentTime : 0, ready: clipReady, painted: lastT, vh: vhPx, top: trackTop };
    },
    scrollToT: function (t) { window.scrollTo({ top: trackTop + t * vhPx, behavior: 'instant' }); }
  };
})();
