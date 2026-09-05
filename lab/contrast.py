# Reads the ground crops from lab/contrast.mjs and reports the worst contrast
# ratio each line has to survive as it travels across the drifting field.
#
# WCAG AA is 4.5 for body text and 3.0 for large text. The interesting number
# here is not the average, which a gradient will always flatter, but the
# darkest patch under any one line at any one scroll position.
#
#   python lab/contrast.py

import json, os, sys
from PIL import Image

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('TEMP', '.'), 'tps-contrast')
rows = json.load(open(os.path.join(d, 'index.json')))

def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)

def parse(css):
    n = [int(float(x)) for x in css[css.index('(') + 1:css.index(')')].split(',')[:3]]
    return tuple(n)

worst = {}
for r in rows:
    im = Image.open(os.path.join(d, r['file'])).convert('RGB')
    ink = lum(parse(r['color']))
    lums = sorted(lum(p) for p in im.convert('RGB').getdata())
    # A percentile rather than the outright extreme. One stray antialiased
    # pixel from a rule or a card corner inside the box is not the ground a
    # reader is looking at, and letting it decide the number means the metric
    # reports on whatever happened to clip the crop.
    n = len(lums)
    lo = lums[max(0, int(n * 0.02))]
    hi = lums[min(n - 1, int(n * 0.98))]
    cr = min(ratio(ink, lo), ratio(ink, hi))
    key = r['sel']
    if key not in worst or cr < worst[key][0]:
        worst[key] = (cr, r['at'], r['file'])

print('worst contrast each line meets anywhere on the drifting field\n')
print(f"{'selector':32} {'ratio':>7}  {'at':>6}   verdict")
for sel, (cr, at, f) in sorted(worst.items(), key=lambda kv: kv[1][0]):
    v = 'fails AA body (4.5)' if cr < 4.5 else ('passes AA body' if cr >= 4.5 else '')
    if cr < 3.0:
        v = 'fails even large text (3.0)'
    print(f'{sel:32} {cr:7.2f}  {at:6.2f}   {v}')
