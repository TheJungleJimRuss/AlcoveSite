# Top-down crate (replaces the tilted crate-back/crate-front pair). Run inside Blender after render_all.py's helpers
# are defined, or on its own: it loads them by exec'ing render.py and the save/load helpers from render_all.py.
# Canvas: 560 world units = 100cqi of .rp-stage; the image covers the top 60cqi (560 x 336 units, 960 x 576 px at 2x).
exec(open('/Users/alex/AlcoveSite/assets-src/record-player/render.py').read())
import numpy as np, json
src = open('/Users/alex/AlcoveSite/assets-src/record-player/render_all.py').read()
exec(src[src.index('def load('):src.index('def crop(')])   # load / save / half only
S = '/private/tmp/claude-503/-Users-alex--claude-spares-spare-HeD4dH/4fc0e785-0681-4c39-8eb9-26d178ba1649/scratchpad/rp/'
OUT = '/Users/alex/AlcoveSite/images/record-player/'
os.makedirs(S, exist_ok=True)
SV = None
sc = scene(); sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.0

def fade_edges(a, frac=0.08):
    """Soft shadow alpha must reach 0 at the image edge, or the page shows a faint box. Only pure-black shadow pixels."""
    h, w = a.shape[:2]
    m = frac * max(h, w)
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]).astype(np.float32)
    t = np.clip(d / m, 0, 1); s = t * t * (3 - 2 * t)
    shadow = (a[..., 3] < 0.98) & (a[..., :3].max(axis=2) < 0.04)
    b = a.copy(); b[..., 3] = np.where(shadow, a[..., 3] * s, a[..., 3])
    return b

for o in bpy.data.collections['RP_Crate'].objects: o.hide_render = False
render(S + 'crate_top.png', 960, 576, (6000, -44.3, 0), 560, ['RP_Crate'], tilt=0, samples=160, key=(-250, 350, 1300))
sizes = save('crate-top', fade_edges(load(S + 'crate_top.png')))
p = OUT + 'layout.json'; meta = json.load(open(p))
for k in ('crate_back', 'crate_front'): meta.pop(k, None)
meta['crate_top'] = sizes
meta['canvas']['crate'] = {'units_per_100cqi': 560, 'image_cqi': [100, 60], 'outer_cqi': [78.0, 40.2], 'top_cqi': 2.0}
json.dump(meta, open(p, 'w'), indent=1)
print('crate-top', sizes)
