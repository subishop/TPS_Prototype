"""Contrast stretch a band of rows so a sub-1% step becomes obvious.

  python lab/zoom.py <image> <centre-y> [span] [out.png]
"""
import sys
from PIL import Image

src = sys.argv[1]
cy = int(sys.argv[2])
span = int(sys.argv[3]) if len(sys.argv) > 3 else 150
out = sys.argv[4] if len(sys.argv) > 4 else "zoom.png"

im = Image.open(src).convert("L")
w, h = im.size
top, bot = max(0, cy - span // 2), min(h, cy + span // 2)
crop = im.crop((0, top, w, bot))

px = crop.load()
cw, ch = crop.size
lo, hi = 255, 0
for y in range(ch):
    for x in range(0, cw, 4):
        v = px[x, y]
        lo = min(lo, v)
        hi = max(hi, v)

rng = max(1, hi - lo)
print(f"rows {top}-{bot}   luma {lo}-{hi}  range {rng}  (stretched to full scale)")

stretched = crop.point(lambda v: max(0, min(255, int((v - lo) * 255 / rng))))
stretched = stretched.resize((cw // 2, ch * 3), Image.NEAREST)
stretched.save(out)
print("->", out)
