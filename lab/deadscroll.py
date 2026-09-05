# How much does the frame actually change between one scroll step and the next?
#
# A scroll page fails quietly. Nothing errors, nothing looks broken in any one
# screenshot, and the visitor simply turns the wheel through a stretch where
# the picture is already finished. The only way to catch it is to put a number
# on movement and read the low end of the list.
#
# "changed" is the share of pixels that moved by more than a level or two of
# grey, which ignores compression noise and antialiasing but counts a slow
# opacity ramp. Anything under about half a percent is a frame the page is
# holding still.
#
#   python lab/deadscroll.py %TEMP%\tps-audit

import sys, os
from PIL import Image, ImageChops

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('TEMP', '.'), 'tps-audit')
THRESH = 3          # per-channel level below which a pixel counts as unchanged
DEAD = 0.5          # percent of pixels moving, under which the frame is held

names = sorted(n for n in os.listdir(d) if n.endswith('.png'))
prev = None
rows = []
for n in names:
    at = float(n.split('_')[1].replace('vh.png', ''))
    im = Image.open(os.path.join(d, n)).convert('L')
    if prev is not None:
        diff = ImageChops.difference(im, prev[1])
        moved = diff.point(lambda v: 255 if v > THRESH else 0)
        pct = 100.0 * sum(moved.histogram()[255:]) / (im.width * im.height)
        rows.append((prev[0], at, pct))
    prev = (at, im)

print(f'{len(rows)} steps, {rows[0][1] - rows[0][0]:.2f} viewport-heights apart\n')
print('held frames (under %.1f%% of pixels moving):' % DEAD)
runs, cur = [], None
for a, b, pct in rows:
    if pct < DEAD:
        cur = [a, b, pct] if cur is None else [cur[0], b, max(cur[2], pct)]
    elif cur:
        runs.append(cur); cur = None
if cur: runs.append(cur)

if not runs:
    print('  none')
for a, b, pct in runs:
    span = b - a
    flag = '   <-- a full viewport of it' if span >= 0.9 else ''
    print(f'  {a:5.2f} to {b:5.2f}  ({span:.2f}vh, peak {pct:.2f}% moving){flag}')

print('\nquietest ten steps:')
for a, b, pct in sorted(rows, key=lambda r: r[2])[:10]:
    print(f'  {a:5.2f} to {b:5.2f}   {pct:6.2f}% of pixels moved')
