# Renders every layer to PNG (scratch), post-processes with numpy and writes WebP into images/record-player/. Run inside Blender.
exec(open('/Users/alex/AlcoveSite/assets-src/record-player/render.py').read())
import numpy as np, json
S = '/private/tmp/claude-503/-Users-alex--claude-spares-spare-HeD4dH/4fc0e785-0681-4c39-8eb9-26d178ba1649/scratchpad/rp/'
OUT = '/Users/alex/AlcoveSite/images/record-player/'
os.makedirs(S, exist_ok=True); os.makedirs(OUT, exist_ok=True)
sc = scene()
T = 43.0
sc.view_settings.view_transform = 'AgX'

def load(path):
    im = bpy.data.images.load(path, check_existing=False)
    im.colorspace_settings.name = 'Non-Color'
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32); im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)[::-1]   # top row first

SV = None
def save(name, a, q=80):
    """a: (h,w,4) straight float, top row first. Writes name-2x.webp and name-1x.webp."""
    global SV
    if SV is None:
        SV = bpy.data.scenes.new('RP_Save'); SV.view_settings.view_transform = 'Standard'; SV.view_settings.look = 'None'
        SV.display_settings.display_device = 'sRGB'
        SV.render.image_settings.file_format = 'WEBP'; SV.render.image_settings.color_mode = 'RGBA'; SV.render.image_settings.quality = q
    SV.render.image_settings.quality = q
    sizes = {}
    for tag, arr in (('2x', a), ('1x', half(a))):
        h, w = arr.shape[:2]
        im = bpy.data.images.new('tmp', w, h, alpha=True); im.colorspace_settings.name = 'Non-Color'; im.alpha_mode = 'STRAIGHT'
        flat = np.ascontiguousarray(arr[::-1]).reshape(-1)
        im.pixels.foreach_set(flat); im.update()
        p = OUT + '%s-%s.webp' % (name, tag)
        im.save_render(p, scene=SV)
        bpy.data.images.remove(im)
        sizes[tag] = os.path.getsize(p)
    print(name, sizes)
    return sizes

def half(a):
    h, w = a.shape[:2]
    p = a.copy(); p[..., :3] *= p[..., 3:4]
    p = p[:h // 2 * 2, :w // 2 * 2].reshape(h // 2, 2, w // 2, 2, 4).mean(axis=(1, 3))
    al = p[..., 3:4]; p[..., :3] = np.where(al > 1e-4, p[..., :3] / np.maximum(al, 1e-4), 0)
    return p

def crop(a, x0, y0, x1, y1): return a[y0:y1, x0:x1]
meta = {}
# ---------- turntable base (500x400 canvas, 2x) ----------
render(S + 'base.png', 1000, 800, (0, 0, 0), 500, ['RP_Turntable'], samples=160)
base = load(S + 'base.png'); meta['base'] = save('turntable-base', base)
# ---------- tonearm: shadow lands on the plinth top (z=T) ----------
render(S + 'arm.png', 1000, 800, (0, 0, T), 500, ['RP_Arm'], samples=160, ground_z=T)
arm = load(S + 'arm.png')
ys, xs = np.where(arm[..., 3] > 0.02)
ax0, ax1, ay0, ay1 = max(xs.min() - 4, 0), min(xs.max() + 5, 1000), max(ys.min() - 4, 0), min(ys.max() + 5, 800)
ax0 -= ax0 % 2; ay0 -= ay0 % 2; ax1 += ax1 % 2; ay1 += ay1 % 2
meta['arm'] = save('tonearm', crop(arm, ax0, ay0, ax1, ay1))
meta['arm_box'] = [ax0 / 2, ay0 / 2, (ax1 - ax0) / 2, (ay1 - ay0) / 2]   # canvas units (500x400)
# ---------- vinyl (even light, rotation-invariant) ----------
VX, VY = 0.0, 3000.0
render(S + 'vinyl.png', 652, 652, (VX, VY, 0), 326, ['RP_Vinyl'], samples=200, world='RP_WorldEven', ground=False)
meta['vinyl'] = save('vinyl', load(S + 'vinyl.png'), 82)
# ---------- vinyl sheen (white, alpha = highlight), fixed overlay ----------
disc = bpy.data.objects['Vinyl']
d2 = disc.copy(); d2.data = disc.data.copy(); link(d2, 'RP_Vinyl'); d2.name = 'VinylSheenObj'
d2.data.materials.clear(); d2.data.materials.append(bpy.data.materials['RP_VinylSheen']); d2.data.materials.append(bpy.data.materials['RP_VinylSheen'])
for o in bpy.data.objects:
    if o.name in ('Vinyl', 'SpindleHole', 'SpindleRim'): o.hide_render = True
render(S + 'sheen.png', 652, 652, (VX, VY, 0), 326, ['RP_Vinyl'], samples=200, ground=False)
sh = load(S + 'sheen.png'); lum = sh[..., :3].mean(axis=2)
alpha = np.clip(lum * 2.6, 0, 0.85) * (sh[..., 3] > 0.5)
out = np.ones_like(sh); out[..., 3] = alpha
meta['sheen'] = save('vinyl-sheen', out, 82)
bpy.data.objects.remove(d2, do_unlink=True)
for o in bpy.data.objects:
    if o.name in ('Vinyl', 'SpindleHole', 'SpindleRim'): o.hide_render = False
# ---------- disc shadow: raised disc invisible to camera, casts onto the ground catcher ----------
disc.location.z = 16; disc.hide_render = False; disc.visible_camera = False
for n in ('SpindleHole', 'SpindleRim'): bpy.data.objects[n].hide_render = True
render(S + 'dshadow.png', 720, 720, (VX, VY, 0), 360, ['RP_Vinyl'], samples=96)
disc.location.z = 0; disc.visible_camera = True
for n in ('SpindleHole', 'SpindleRim'): bpy.data.objects[n].hide_render = False
meta['disc_shadow'] = save('disc-shadow', load(S + 'dshadow.png'), 80)
# ---------- crate: top-down, see render_crate_top.py (run after this script) ----------
# ---------- sleeve card and edge (paper: normalised so multiply-printing looks right) ----------
sc.view_settings.exposure = 0.0
def paper(a, target=0.94, amp=2.4):
    solid = a[..., 3] > 0.99
    m = a[..., :3][solid].mean()
    b = a.copy()
    rgb = (b[..., :3] - m) * amp + target
    b[..., :3] = np.where(solid[..., None], np.clip(rgb, 0, 1), b[..., :3])
    return b
render(S + 'card.png', 760, 798, (9000, 0, 0), 399, ['RP_Sleeve'], samples=128, key=(-250, 350, 1300))
meta['sleeve_flat'] = save('sleeve-flat', paper(load(S + 'card.png')), 85)
render(S + 'edge.png', 760, 200, (9000, 802, 0), 380, ['RP_Sleeve'], samples=128, key=(-250, 350, 1300))
meta['sleeve_edge'] = save('sleeve-edge', paper(load(S + 'edge.png')), 85)
sc.view_settings.exposure = 0.0
meta['sizes_note'] = 'bytes per 1x/2x file'
meta['canvas'] = {'turntable': [500, 400], 'platter_centre': [190, 200], 'platter_r': 168, 'pivot': [435, 60], 'rest_stylus': [435, 314], 'record_r': 161}
json.dump(meta, open(OUT + 'layout.json', 'w'), indent=1)
print(json.dumps(meta))
