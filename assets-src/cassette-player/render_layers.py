# Renders the Work page cassette deck as stacked top-down image layers (replaces the three.js player, 2026-11-18).
# Run headless (does not save the .blend):
#   /Applications/Blender.app/Contents/MacOS/Blender -b assets-src/cassette-player/cassette-player.blend --python assets-src/cassette-player/render_layers.py
# Writes images/cassette/<layer>-{1x,2x}.webp and images/cassette/layout.json (positions as % of the deck canvas).
# Layers, bottom to top: deck (player + contact shadow, cassette casts shadow only), pack (one tape pack, CSS scales it),
# reel (one hub, CSS rotates it), shell (cassette with a blank label; the window is see-through),
# door-sheet (the door with its glass, shut to open in DOOR_FRAMES frames; frame 0 is the resting door).
import bpy, json, math, os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(bpy.data.filepath), '..', '..'))
OUT = os.path.join(ROOT, 'images', 'cassette') + os.sep
TMP = os.path.join(ROOT, 'assets-src', 'cassette-player', 'renders') + os.sep
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)

W_CM, H_CM = 16.0, 13.5          # deck canvas in cm (matches .cassette-stage aspect-ratio 16 / 13.5)
CX, CY = 0.0, -0.25              # canvas centre in Blender XY
PX = 80                          # px per cm at 2x
SAMPLES = int(os.environ.get('SAMPLES', 96))
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))  # e.g. ONLY=door renders just the door sheet
DOOR_FRAMES, DOOR_MAX_DEG = 10, 70   # door sheet: frame 0 = shut, last = fully open

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.render.resolution_percentage = 100

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'retro_look.py')).read()); apply_retro_look()   # retro character, shared with render_flip.py
for _o in bpy.data.objects:   # the window pane renders as noisy white against the transparent layer; resting and flip renders both skip it
    if _o.name.startswith('rf_cwin_'): _o.hide_render = True

# ---- world, lights, camera, shadow catcher
world = bpy.data.worlds.new('deck_world'); world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links
bg = next(n for n in wn if n.type == 'BACKGROUND')
# studio HDRI (Poly Haven CC0, see assets-src/record-player/LICENSES.md): gives the metal, plastic and glass something to reflect
env = wn.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(ROOT, 'assets-src', 'record-player', 'tex', 'pav_studio_03_2k.hdr'))
rot = wn.new('ShaderNodeMapping'); rot.inputs['Rotation'].default_value[2] = math.radians(float(os.environ.get('ENV_ROT', 200)))
tcw = wn.new('ShaderNodeTexCoord'); wl.new(tcw.outputs['Generated'], rot.inputs['Vector']); wl.new(rot.outputs['Vector'], env.inputs['Vector'])
wl.new(env.outputs['Color'], bg.inputs['Color']); bg.inputs[1].default_value = float(os.environ.get('ENV_STRENGTH', 0.55))
sc.world = world

def light(name, kind, energy, loc, look=(0, 0, 0), **kw):
    d = bpy.data.lights.new(name, kind); d.energy = energy
    for k, v in kw.items(): setattr(d, k, v)
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o
# a low, fairly small key from the upper left: raking light gives the keys, screws and rolled edges real highlights and shadows
light('key', 'SUN', 3.6, (-11, 8, 15), angle=math.radians(5))
light('fill', 'AREA', 260, (10, -12, 14), size=14)
light('rim', 'AREA', 500, (-4, 14, 8), size=6)

cam_d = bpy.data.cameras.new('deck_cam'); cam_d.type = 'ORTHO'
cam = bpy.data.objects.new('deck_cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.rotation_euler = (0, 0, 0)   # looking straight down -Z; image up = +Y = back of the deck

bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.165))
ground = bpy.context.active_object; ground.name = 'catcher'; ground.is_shadow_catcher = True

def frame(cx, cy, w_cm, h_cm):
    cam.location = (cx, cy, 60)
    cam_d.ortho_scale = max(w_cm, h_cm)
    sc.render.resolution_x = round(w_cm * PX); sc.render.resolution_y = round(h_cm * PX)

# ---- object groups
def subtree(name):
    root = bpy.data.objects[name]; out = [root]
    for c in root.children_recursive: out.append(c)
    return out
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'catcher']
door = set(subtree('door'))
cassette = set(subtree('cassette'))
reelL = set(subtree('reelL')); packL = {bpy.data.objects['packL']}
shell_parts = {o for o in cassette if o.type == 'MESH'} - set(subtree('reelL')) - set(subtree('reelR')) \
    - {bpy.data.objects[n] for n in ('packL', 'packR', 'slipSheetL', 'slipSheetR', 'sideB')}

# the glass is a thin clear coat (no transmission, so no noise); the side rails drop a hair so the frame corners do not z-fight
for n in ('door_frame_side-1', 'door_frame_side1'): bpy.data.objects[n].location.z -= 0.004
gm = bpy.data.materials['door_glass']; gb = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
for k, v in (('Base Color', (0.85, 0.9, 0.95, 1)), ('Roughness', 0.04), ('Alpha', 0.1), ('Transmission Weight', 0.0), ('Metallic', 0.0)):
    if k in gb.inputs: gb.inputs[k].default_value = v
gm.blend_method = 'BLEND' if hasattr(gm, 'blend_method') else None

def show(camera_vis, shadow_only=()):
    for o in meshes:
        o.hide_render = (not (o in camera_vis or o in shadow_only)) or o.name.startswith('rf_cwin_')   # the window pane is never rendered (it dimmed the reels)
        o.visible_camera = o in camera_vis
    ground.hide_render = False

def render(name, q=82):
    path = TMP + name + '.png'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    sizes = {}
    for tag, scale in (('2x', 1.0), ('1x', 0.5)):
        img = bpy.data.images.load(path); img.pixels[0]  # force the pixels to load
        if scale != 1.0: img.scale(round(img.size[0] * scale), round(img.size[1] * scale))
        out = OUT + f'{name}-{tag}.webp'
        img.filepath_raw = out; img.file_format = 'WEBP'
        sc.render.image_settings.file_format = 'WEBP'; sc.render.image_settings.quality = q
        img.save_render(out, scene=sc)
        bpy.data.images.remove(img)
        sizes[tag] = os.path.getsize(out)
    print('rendered', name, sizes)
    return sizes

# ---- positions (% of the deck canvas), measured before anything moves
bpy.context.view_layer.update()
def pct(v):
    return [round((v.x - (CX - W_CM / 2)) / W_CM * 100, 3), round(((CY + H_CM / 2) - v.y) / H_CM * 100, 3)]
def wpos(n): return bpy.data.objects[n].matrix_world.translation.copy()
def bbox(n):
    o = bpy.data.objects[n]; pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts)))
    a, b = pct(Vector((lo.x, hi.y, 0))), pct(Vector((hi.x, lo.y, 0)))
    return {'x': a[0], 'y': a[1], 'w': round(b[0] - a[0], 3), 'h': round(b[1] - a[1], 3)}
PACK_CM, REEL_CM = 2.2, 1.6
layout = {
    'canvas_cm': [W_CM, H_CM],
    'keys': {k: pct(wpos('key' + k.capitalize())) for k in ('play', 'pause', 'stop', 'flip')},
    'key_cap': bbox('keyPlay_cap'),
    'label': bbox('sideA'),
    'door': bbox('door_glass') | {'hinge_y': pct(wpos('door'))[1]},
    'door_frame': {'x': pct(Vector((wpos('door_frame_side-1').x - 0.25, 0, 0)))[0], 'y': pct(Vector((0, wpos('door_frame_back').y + 0.25, 0)))[1],
                   'x2': pct(Vector((wpos('door_frame_side1').x + 0.25, 0, 0)))[0], 'y2': pct(Vector((0, wpos('door_latch').y - 0.15, 0)))[1]},
    'packs': [pct(wpos('packL')), pct(wpos('packR'))], 'pack_size': round(PACK_CM / W_CM * 100, 3),
    'reels': [pct(wpos('reelL')), pct(wpos('reelR'))], 'reel_size': round(REEL_CM / W_CM * 100, 3),
    'pack_scale': [0.5, 0.9],
}

# ---- door sheet: the door swinging open on its hinge, DOOR_FRAMES frames stacked top to bottom in one image.
# Writes renders/door_NN.png; `node scripts/make-door-sheet.mjs` stitches them into images/cassette/door-sheet-{1x,2x}.webp.
# CSS shows one frame at a time (translate on the strip); ab-compare.js eases the timing between frames.
DOOR_BOX = (-6.0, 5.25, 12.0, 9.25)   # x, top y, w, h in cm: covers the shut door (the open one only gets shorter)
def render_door_sheet():
    x0, top, w, h = DOOR_BOX
    frame(x0 + w / 2, top - h / 2, w, h)
    cam_d.ortho_scale = max(w, h)
    show({o for o in door if o.type == 'MESH'}); ground.hide_render = True
    hinge = bpy.data.objects['door']; latch = bpy.data.objects['door_latch']
    hinge.rotation_euler.x = math.radians(10); bpy.context.view_layer.update()
    sign = 1 if latch.matrix_world.translation.z > 3.17 else -1   # the front edge must lift toward the camera
    for i in range(DOOR_FRAMES):
        hinge.rotation_euler.x = sign * math.radians(DOOR_MAX_DEG * i / (DOOR_FRAMES - 1))
        bpy.context.view_layer.update()
        path = TMP + f'door_{i:02d}.png'
        sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
        sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    hinge.rotation_euler.x = 0; bpy.context.view_layer.update()
    b0, b1 = pct(Vector((x0, top, 0))), pct(Vector((x0 + w, top - h, 0)))
    return {'frames': DOOR_FRAMES, 'max_deg': DOOR_MAX_DEG, 'x': b0[0], 'y': b0[1], 'w': round(b1[0] - b0[0], 3), 'h': round(b1[1] - b0[1], 3)}

# ---- flip sheet: the cassette shell lifting, turning over its vertical axis and settling,
# FLIP_FRAMES frames top to bottom, frame 0 = resting. Only the shell is rendered; packs, reels and label are HTML that ab-compare.js scales to match.
# Writes renders/flip_NN.png; `SHEET=flip node scripts/make-door-sheet.mjs` stitches them into images/cassette/flip-sheet-{1x,2x}.webp.
FLIP_FRAMES, FLIP_BOX, FLIP_PX = 15, (0.0, 0.35, 11.4, 7.4), 80    # centre x, centre y, w, h in cm; px per cm at 2x
def render_flip_sheet():
    cx, cy, w, h = FLIP_BOX
    global PX
    old_px, PX = PX, FLIP_PX
    frame(cx, cy, w, h); cam_d.ortho_scale = max(w, h)
    # the shell only (same parts as the resting shell layer, plus the back label): packs, reels and label text are live HTML
    show(shell_parts | {bpy.data.objects['sideB']})
    # same lights as the resting shell layers (no softer key here), so frame 0 and the last frame match the resting renders
    pivot = bpy.data.objects.new('flip_pivot', None); sc.collection.objects.link(pivot)
    pivot.location = bpy.data.objects['cassette'].matrix_world.translation.copy()
    bpy.context.view_layer.update()
    cas = bpy.data.objects['cassette']; mw = cas.matrix_world.copy()
    cas.parent = pivot; cas.matrix_parent_inverse = pivot.matrix_world.inverted(); cas.matrix_world = mw
    base_z = pivot.location.z
    for i in range(FLIP_FRAMES):
        t = i / (FLIP_FRAMES - 1); arc = math.sin(math.pi * t)
        pivot.rotation_euler = (0, math.radians(180 * t), 0)
        pivot.location.z = base_z + 3.4 * arc
        pivot.scale = (1 + 0.09 * arc,) * 3        # ortho camera: lifting is shown by growing a little
        bpy.context.view_layer.update()
        sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
        sc.render.filepath = TMP + f'flip_{i:02d}.png'; bpy.ops.render.render(write_still=True)
    b0, b1 = pct(Vector((cx - w / 2, cy + h / 2, 0))), pct(Vector((cx + w / 2, cy - h / 2, 0)))
    PX = old_px
    return {'frames': FLIP_FRAMES, 'x': b0[0], 'y': b0[1], 'w': round(b1[0] - b0[0], 3), 'h': round(b1[1] - b0[1], 3)}

# ---- layers (ONLY=deck,shell,pack,reel,door picks some; layout.json keeps the other entries)
want = lambda n: not ONLY or n in ONLY
if ONLY and os.path.exists(OUT + 'layout.json'):
    layout = json.load(open(OUT + 'layout.json')) | layout
frame(CX, CY, W_CM, H_CM)
# CLOSE="cx,cy,w,h,px,out.png" renders only the deck for that region (cm, Blender XY) to a PNG, for inspecting detail; writes nothing else.
if os.environ.get('CLOSE'):
    cx, cy, cw, ch, cpx, cout = os.environ['CLOSE'].split(',')
    PX = float(cpx); frame(float(cx), float(cy), float(cw), float(ch))
    if os.environ.get('CLOSE_SHOW') == 'all': show(set(meshes))   # CLOSE_SHOW=all: deck, cassette and door together
    else: show(set(meshes) - door - cassette, shadow_only=cassette)
    sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = cout; bpy.ops.render.render(write_still=True)
    raise SystemExit
if want('deck'): show(set(meshes) - door - cassette, shadow_only=cassette); layout['deck'] = render('deck', 80)
if want('shell'): show(shell_parts); ground.hide_render = True; layout['shell'] = render('shell', 84)
if ONLY and 'shellb' in ONLY:   # Side B at rest: the same shell turned over (the back face towards the camera)
    show(shell_parts | {bpy.data.objects['sideB']}); ground.hide_render = True
    cas = bpy.data.objects['cassette']; pivot = bpy.data.objects.new('b_pivot', None); sc.collection.objects.link(pivot)
    pivot.location = cas.matrix_world.translation.copy(); bpy.context.view_layer.update()
    mw = cas.matrix_world.copy(); cas.parent = pivot; cas.matrix_parent_inverse = pivot.matrix_world.inverted(); cas.matrix_world = mw
    pivot.rotation_euler = (0, math.radians(180), 0); bpy.context.view_layer.update()
    layout['shell_b'] = render('shell-b', 84)
if want('pack'):
    pl = wpos('packL'); frame(pl.x, pl.y, PACK_CM, PACK_CM)
    show(packL); ground.hide_render = True; layout['pack'] = render('pack', 82)
if want('reel'):
    rl = wpos('reelL'); frame(rl.x, rl.y, REEL_CM, REEL_CM)
    show({o for o in reelL if o.type == 'MESH'}); ground.hide_render = True; layout['reel'] = render('reel', 85)
if want('door'): layout['door_sheet'] = render_door_sheet()
if ONLY and 'flip' in ONLY: layout['flip_sheet'] = render_flip_sheet()   # opt-in (ONLY=flip), not part of the default run
layout.pop('door_img', None)

with open(OUT + 'layout.json', 'w') as f: json.dump(layout, f, indent=1)
print(json.dumps(layout))
