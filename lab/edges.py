"""Find visible bands in the flat fog field of the handoff frames.

The complaint this measures is "I can see the edges of the transitional
layers". Those only ever show up against flat fog, never against photographic
detail, because detail hides them. So the detector first decides which rows
are flat field and then looks only there.

  flat row      -> luma varies little across x, so it is fog, not photograph
  hard step     -> first derivative of the row-mean profile, a layer boundary
  ramp kink     -> second derivative, a gradient that changes slope abruptly
                   and reads as a line through Mach banding even though no
                   single row-to-row step is large

Both are reported in units of 0-255 luma.

  python lab/edges.py [dir]
"""
import os
import sys
from PIL import Image

d = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "lab/handoff"

# Tight on purpose. At 7.0 this let soft out-of-focus photography through as
# "flat", and then reported the bedding and the bath rim as bands. Only
# genuinely featureless fog should qualify, because only fog can show one.
FLAT_SD = 2.5
MIN_RUN = 60       # ignore flat slivers between photographic content
STEP_HIT = 0.5     # a step this big on flat fog is visible
KINK_HIT = 0.35    # curvature over a 12px span, likewise


def analyse(path):
    im = Image.open(path).convert("L")
    w, h = im.size
    px = im.load()
    xs = list(range(0, w, max(1, w // 200)))
    n = len(xs)

    mean, flat = [], []
    for y in range(h):
        vals = [px[x, y] for x in xs]
        m = sum(vals) / n
        sd = (sum((v - m) ** 2 for v in vals) / n) ** 0.5
        mean.append(m)
        flat.append(sd < FLAT_SD)

    # contiguous runs of flat rows
    runs, start = [], None
    for y in range(h):
        if flat[y] and start is None:
            start = y
        elif not flat[y] and start is not None:
            if y - start >= MIN_RUN:
                runs.append((start, y))
            start = None
    if start is not None and h - start >= MIN_RUN:
        runs.append((start, h))

    sm = []
    for y in range(h):
        a, b = max(0, y - 4), min(h, y + 5)
        sm.append(sum(mean[a:b]) / (b - a))

    # Stay well clear of each run's own ends. Where fog gives way to
    # photograph the field stops being flat gradually, and a boundary
    # sampled too close to that reads as a step when it is really just the
    # edge of the region being analysed. That false positive cost a round.
    steps, kinks = [], []
    for a, b in runs:
        for y in range(a + 30, b - 30):
            steps.append((abs(mean[y + 1] - mean[y]), y))
            kinks.append((abs(sm[y - 6] - 2 * sm[y] + sm[y + 6]), y))

    def peak(lst):
        lst.sort(reverse=True)
        out = []
        for v, y in lst:
            if any(abs(y - yy) <= 30 for _, yy in out):
                continue
            out.append((v, y))
            if len(out) >= 2:
                break
        return out

    flat_pct = 100.0 * sum(b - a for a, b in runs) / h
    return peak(steps), peak(kinks), flat_pct


names = sorted(f for f in os.listdir(d) if f.endswith(".png"))
worst_step = worst_kink = 0.0
bad = 0
for name in names:
    steps, kinks, flat_pct = analyse(name and os.path.join(d, name))
    s = steps[0] if steps else (0.0, 0)
    k = kinks[0] if kinks else (0.0, 0)
    worst_step = max(worst_step, s[0])
    worst_kink = max(worst_kink, k[0])
    hit = s[0] >= STEP_HIT or k[0] >= KINK_HIT
    bad += hit
    flag = "BAND " if hit else "  ok "
    print(f"{name:24s} {flag} flat={flat_pct:5.1f}%  "
          f"step y={s[1]:4d}:{s[0]:5.2f}   kink y={k[1]:4d}:{k[0]:5.2f}")

print(f"\nframes with a visible band : {bad} / {len(names)}")
print(f"worst hard step            : {worst_step:.2f} / 255")
print(f"worst ramp kink            : {worst_kink:.2f} / 255")
