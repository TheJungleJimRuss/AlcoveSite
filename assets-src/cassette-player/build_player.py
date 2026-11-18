# Cassette PLAYER (cassette seated in a top-loading player) for Work "Cassette A/B". Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python assets-src/cassette-player/build_player.py
# The cassette part is the same code as assets-src/cassette/build_cassette.py (node names reelL/reelR/packL/packR/sideA/sideB per ADR 0007).
# Units: 1 Blender unit = 1 cm. Real cassette 10.04 x 6.38 x 1.2 cm. Width = X, height = Z, depth = Y.
# Front (side A) faces -Y; the glTF exporter (+Y up) turns that into +Z, so in three.js the front looks at the camera.
import bpy, bmesh, math, os
from mathutils import Vector

OUT = '/Users/alex/AlcoveSite/'
W, H, T = 10.04, 6.38, 1.2
HUB_X, HUB_Z = 1.4, -1.37           # reel centres (+-HUB_X)
PACK_R = 1.0                          # pack mesh radius at scale 1; integration scales it 0.5 (empty) to 0.9 (full)

def lin(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1]

def mat(name, hexcol, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = lin(hexcol)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

# fresh scene
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.data.collections.new('Cassette'); bpy.context.scene.collection.children.link(col)
M = dict(shell=mat('bone_plastic', '#c9c2ad', 0.78), hub=mat('hub_white', '#f2efe4', 0.7), dark=mat('hub_dark', '#1a1b1a', 0.8),
         tape=mat('tape_brown', '#4a3a2a', 0.45), screw=mat('screw_grey', '#8e8870', 0.5, 0.4), paper=mat('label_paper', '#ece4cf', 0.9),
         trim=mat('trim_dark', '#3a3a38', 0.8))

def put(o, parent=None):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    if parent: o.parent = parent
    return o

def mesh_obj(name, bm, material, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(material)
    o = bpy.data.objects.new(name, me); o.location = loc
    return put(o)

def cyl_bm(bm, r, depth, verts, x=0, z=0, r2=None):
    """Cylinder with its axis along Y, centred at x,z."""
    r2 = r if r2 is None else r2
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r, radius2=r2, depth=depth)
    rot = bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(90), 3, 'X'), verts=res['verts'])
    bmesh.ops.translate(bm, vec=(x, 0, z), verts=res['verts'])

def smooth(o, angle=35):
    for p in o.data.polygons: p.use_smooth = True
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects: s.select_set(False)
    o.select_set(True)
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception: bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))

root = put(bpy.data.objects.new('cassette', None))

# ---- shell: rounded box with a stadium window through both faces ----
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
bmesh.ops.scale(bm, vec=(W, T, H), verts=bm.verts)
shell = mesh_obj('shell', bm, M['shell'])
bv = shell.modifiers.new('bevel', 'BEVEL'); bv.width = 0.16; bv.segments = 3; bv.limit_method = 'ANGLE'

def cutter(name, build):
    b = bmesh.new(); build(b)
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free()
    o = bpy.data.objects.new(name, me); put(o); return o
WX, WZ0, WZ1 = 2.5, -2.35, -0.39
r = (WZ1 - WZ0) / 2; zc = (WZ0 + WZ1) / 2
cutters = [
    cutter('cut_box', lambda b: (bmesh.ops.create_cube(b, size=1), bmesh.ops.scale(b, vec=(2 * (WX - r), T * 3, 2 * r), verts=b.verts), bmesh.ops.translate(b, vec=(0, 0, zc), verts=b.verts))),
    cutter('cut_l', lambda b: cyl_bm(b, r, T * 3, 40, x=-(WX - r), z=zc)),
    cutter('cut_r', lambda b: cyl_bm(b, r, T * 3, 40, x=(WX - r), z=zc)),
    cutter('cut_notch', lambda b: (bmesh.ops.create_cube(b, size=1), bmesh.ops.scale(b, vec=(7.8, 0.92, 0.7), verts=b.verts), bmesh.ops.translate(b, vec=(0, -0.34, -2.97), verts=b.verts))),
]
bpy.context.view_layer.update()
for c in cutters:
    mod = shell.modifiers.new('b_' + c.name, 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = c; mod.solver = 'EXACT'
dg = bpy.context.evaluated_depsgraph_get()
ev = shell.evaluated_get(dg); new = bpy.data.meshes.new_from_object(ev)
shell.modifiers.clear(); shell.data = new; shell.data.materials.clear(); shell.data.materials.append(M['shell'])
for c in cutters: bpy.data.objects.remove(c, do_unlink=True)
smooth(shell, 30); shell.parent = root

# bottom trim plate (both faces), screws
for side, y in (('f', -T / 2), ('b', T / 2)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=(6.4, 0.04, 0.7), verts=bm.verts)
    o = mesh_obj('trim_' + side, bm, M['trim'], (0, y + (-0.015 if side == 'f' else 0.015), -H / 2 + 0.5)); o.parent = root
    if side == 'f': bpy.data.objects.remove(o, do_unlink=True)
    for sx in (-1, 1):
        for sz in (-1, 1):
            bm = bmesh.new(); cyl_bm(bm, 0.22, 0.05, 14)
            o = mesh_obj('screw_%s%d%d' % (side, sx, sz), bm, M['screw'], (sx * (W / 2 - 0.5), y + (-0.01 if side == 'f' else 0.01), sz * (H / 2 - 0.5))); smooth(o); o.parent = root

# ---- labels: paper planes, UV 0..1 with the image top at the top (viewed from each side) ----
LX0, LX1, LZ0, LZ1 = -4.2, 4.2, -0.2, 2.75
def label(name, y, nrm_y, flip):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((LX0, y, LZ0), (LX1, y, LZ0), (LX1, y, LZ1), (LX0, y, LZ1))]
    f = bm.faces.new(vs if nrm_y < 0 else vs[::-1]); bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')
    for l in f.loops:
        v = l.vert.co
        u = (v.x - LX0) / (LX1 - LX0)
        if flip: u = 1 - u
        l[uv].uv = (u, (v.z - LZ0) / (LZ1 - LZ0))
    return mesh_obj(name, bm, M['paper'])
for yy_, nn in ((-T / 2 - 0.004, -1), (T / 2 + 0.004, 1)):   # recessed label border (dark frame around the paper)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(LX1 - LX0 + 0.3, 0.01, LZ1 - LZ0 + 0.3), verts=bm.verts)
    lb = mesh_obj('labelBorder%d' % nn, bm, M['trim'], ((LX0 + LX1) / 2, yy_, (LZ0 + LZ1) / 2)); lb.parent = root
sa = label('sideA', -T / 2 - 0.012, -1, False); sa.parent = root
sb = label('sideB', T / 2 + 0.012, +1, True); sb.parent = root

# ---- reels (origin on the reel centre; spin about glTF Z) and tape packs (scale in glTF X/Y) ----
for tag, sx in (('L', -1), ('R', 1)):
    loc = (sx * HUB_X, 0, HUB_Z)
    bm = bmesh.new()
    # white ring + 6 inward teeth, 0.8 deep
    ro, ri = 0.42, 0.30
    bm = bmesh.new()
    for i in range(32):
        a0, a1 = 2 * math.pi * i / 32, 2 * math.pi * (i + 1) / 32
        pts = []
        for y in (-0.4, 0.4):
            for a in (a0, a1):
                pts.append((bm.verts.new((math.cos(a) * ro, y, math.sin(a) * ro)), bm.verts.new((math.cos(a) * ri, y, math.sin(a) * ri))))
        # outer wall
        o00, i00 = pts[0]; o01, i01 = pts[1]; o10, i10 = pts[2]; o11, i11 = pts[3]
        bm.faces.new((o00, o01, o11, o10))      # outer
        bm.faces.new((i00, i10, i11, i01))      # inner
        bm.faces.new((o00, i00, i01, o01))      # front annulus
        bm.faces.new((o10, o11, i11, i10))      # back annulus
    for k in range(6):
        a = k * math.pi / 3
        t = bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(0.1, 0.8, 0.16), verts=t['verts'])
        bmesh.ops.translate(bm, vec=(0, 0, 0.23), verts=t['verts'])
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(a, 3, 'Y'), verts=t['verts'])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    reel = mesh_obj('reel' + tag, bm, M['hub'], loc); reel.parent = root; smooth(reel, 40)
    # dark disc inside hub (child mesh part of the same reel: separate object so it can have its own material, parented to reel)
    bm = bmesh.new(); cyl_bm(bm, 0.3, 0.56, 24)
    disc = mesh_obj('reelCore' + tag, bm, M['dark'], (0, 0, 0)); disc.parent = reel; smooth(disc)
    bm = bmesh.new(); cyl_bm(bm, PACK_R, 0.5, 48)
    pack = mesh_obj('pack' + tag, bm, M['tape'], loc); pack.parent = root; smooth(pack)


# ======================= PLAYER (build_player.py) =======================
# ---- cassette internals: inner back wall with hub holes, hub flanges and rims, slip sheets, guide posts (tape ribbon is built in cassette-3d.js) ----
GUIDE_X, GUIDE_Z, GUIDE_R = 3.6, -2.9, 0.22      # keep in sync with cassette-3d.js (TAPE_GUIDE)
def bool_ops(o, ops, material):
    bpy.context.view_layer.update()
    for i, (op, c) in enumerate(ops):
        m = o.modifiers.new('b%d' % i, 'BOOLEAN'); m.operation = op; m.object = c; m.solver = 'EXACT'
    dg = bpy.context.evaluated_depsgraph_get(); new = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear(); o.data = new; o.data.materials.clear(); o.data.materials.append(material)
    for _, c in ops: bpy.data.objects.remove(c, do_unlink=True)
    smooth(o, 35)
def cyl_at(name, rad, depth, x, y, z, verts=40):
    def f(b): cyl_bm(b, rad, depth, verts, x=x, z=z); bmesh.ops.translate(b, vec=(0, y, 0), verts=b.verts)
    return cutter(name, f)
BY0, BT = 0.5, 0.06
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(2 * (WX - r), BT, 2 * r + 0.08), verts=bm.verts)
back = mesh_obj('cassette_back_wall', bm, M['dark'], (0, BY0, zc))
bool_ops(back, [('UNION', cyl_at('bw_l', r + 0.04, BT, -(WX - r), BY0, zc)), ('UNION', cyl_at('bw_r', r + 0.04, BT, (WX - r), BY0, zc)),
                ('DIFFERENCE', cyl_at('bh_l', 0.46, 0.5, -HUB_X, BY0, HUB_Z)), ('DIFFERENCE', cyl_at('bh_r', 0.46, 0.5, HUB_X, BY0, HUB_Z))], M['dark'])
back.location = (0, 0, 0); back.parent = root
def ring_bm(ri, ro, y0, y1, n=40):
    bm = bmesh.new()
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        v = lambda a, rad, y: bm.verts.new((math.cos(a) * rad, y, math.sin(a) * rad))
        o0, o1, i0, i1 = v(a0, ro, y0), v(a1, ro, y0), v(a0, ri, y0), v(a1, ri, y0)
        p0, p1, q0, q1 = v(a0, ro, y1), v(a1, ro, y1), v(a0, ri, y1), v(a1, ri, y1)
        bm.faces.new((o0, o1, p1, p0)); bm.faces.new((i0, q0, q1, i1)); bm.faces.new((o0, i0, i1, o1)); bm.faces.new((p0, p1, q1, q0))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm
for tag, sx in (('L', -1), ('R', 1)):
    rl = bpy.data.objects['reel' + tag]
    fl = mesh_obj('hubFlange' + tag, ring_bm(0.3, 0.68, 0.30, 0.36), M['hub'], (0, 0, 0)); fl.parent = rl; smooth(fl, 40)
    rim = mesh_obj('hubRim' + tag, ring_bm(0.3, 0.5, -0.43, -0.37), M['hub'], (0, 0, 0)); rim.parent = rl; smooth(rim, 40)
    sl = mesh_obj('slipSheet' + tag, ring_bm(0.5, 1.05, 0.26, 0.285), M['trim'], (sx * HUB_X, 0, HUB_Z)); sl.parent = root
    bm = bmesh.new(); cyl_bm(bm, GUIDE_R, 1.0, 16)
    gp = mesh_obj('guidePost' + tag, bm, M['screw'], (sx * GUIDE_X, 0, GUIDE_Z)); smooth(gp); gp.parent = root

# Reference (not copied): top-loading portable cassette recorder in the style of the Sony TC-D5M / Panasonic RQ-series:
# flat slab body, silver-grey upper shell over a dark base (visible seam), cassette bay on top with a hinged clear door,
# a row of 4 chunky keys in a recessed channel at the front, stereo speaker slots either side, screws, rubber feet.
# Units cm. Blender: X right, Y back (front = -Y), Z up. glTF export turns -Y into +Z (towards the camera).
def rgba(h, a=1.0): c = lin(h); c[3] = a; return c
P = dict(
    top=mat('p_shell_silver', '#a4a69f', 0.62), base=mat('p_base_dark', '#2b2c2b', 0.75), key=mat('p_key', '#34373a', 0.7),
    floor=mat('p_bay_floor', '#161716', 0.9), glyph=mat('p_glyph', '#e6dfc9', 0.7), glyph_play=mat('p_glyph_play', '#d8692b', 0.7),
    accent=mat('p_accent', '#c8642e', 0.7), rubber=mat('p_rubber', '#0f0f0f', 0.95), metal=mat('p_metal', '#85857e', 0.5, 0.4),
    frame=mat('p_door_frame', '#2e3133', 0.7), slot=mat('p_slot', '#1c1d1c', 0.9), led=mat('p_led', '#7a1d14', 0.6), plate=mat('p_plate', '#4a4c4a', 0.7))
glass = mat('door_glass', '#d4dbd9', 0.55); gb = next(n for n in glass.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
gb.inputs['Alpha'].default_value = 0.14
try: glass.blend_method = 'BLEND'
except Exception: pass
try: glass.surface_render_method = 'BLENDED'
except Exception: pass
P['glass'] = glass

def box(name, size, loc, material, parent=None, bevel=0.0, seg=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = mesh_obj(name, bm, material, loc)
    if bevel:
        m = o.modifiers.new('bv', 'BEVEL'); m.width = bevel; m.segments = seg; m.limit_method = 'ANGLE'
        smooth(o, 40)
    if parent: o.parent = parent
    return o

def cyl(name, r, depth, loc, material, axis='Z', parent=None, verts=20):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r, radius2=r, depth=depth)
    if axis == 'X': bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(math.radians(90), 3, 'Y'), verts=bm.verts)
    o = mesh_obj(name, bm, material, loc); smooth(o)
    if parent: o.parent = parent
    return o

def prism(name, pts, h, loc, material, parent=None):
    bm = bmesh.new(); vs = [bm.verts.new((x, y, 0)) for x, y in pts]; f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, vec=(0, 0, h), verts=[v for v in r['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, material, loc)
    if parent: o.parent = parent
    return o

def apply_booleans(o, cutters, keep_mat):
    bpy.context.view_layer.update()
    for c in cutters:
        m = o.modifiers.new('b_' + c.name, 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'
    dg = bpy.context.evaluated_depsgraph_get(); ev = o.evaluated_get(dg); new = bpy.data.meshes.new_from_object(ev)
    o.modifiers.clear(); o.data = new; o.data.materials.clear(); o.data.materials.append(keep_mat)
    for c in cutters: bpy.data.objects.remove(c, do_unlink=True)
    smooth(o, 35)

def cutbox(name, x0, x1, y0, y1, z0, z1):
    b = bmesh.new(); bmesh.ops.create_cube(b, size=1); bmesh.ops.scale(b, vec=(x1 - x0, y1 - y0, z1 - z0), verts=b.verts)
    bmesh.ops.translate(b, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=b.verts)
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free()
    o = bpy.data.objects.new(name, me); put(o); return o

player = put(bpy.data.objects.new('player', None))
BX, BY = 14.4, 10.8
# lower body + upper shell (the gap between their bevels is the seam)
box('body_base', (BX, BY, 1.5), (0, 0, 0.75), P['base'], player, bevel=0.28, seg=3)
up = box('body_top', (BX - 0.2, BY - 0.2, 1.5), (0, 0, 2.25), P['top'], player, bevel=0.3, seg=3)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get(); up.data = bpy.data.meshes.new_from_object(up.evaluated_get(dg)); up.modifiers.clear()
up.data.materials.clear(); up.data.materials.append(P['top'])
SLOT_CUTS = [cutbox('slot%d_%d' % (sx, i), sx * 6.2 - 0.5, sx * 6.2 + 0.5, -2.4 + i * 0.85 - 0.08, -2.4 + i * 0.85 + 0.08, 1.52, 3.3) for sx in (-1, 1) for i in range(9)]
apply_booleans(up, [cutbox('bay', -5.3, 5.3, -3.45, 4.35, 1.6, 3.3), cutbox('chan', -6.3, 6.3, -4.9, -3.55, 2.6, 3.3)] + SLOT_CUTS + [cutbox('line_front', -6.95, 6.95, -3.30, -3.24, 2.93, 3.3), cutbox('line_back', -6.95, 6.95, 4.93, 4.99, 2.93, 3.3)], P['top'])

# bay: dark floor, tape head, pinch rollers, capstans
box('bay_floor', (10.4, 7.8, 0.06), (0, 0.45, 1.63), P['floor'], player)
box('head_block', (1.2, 0.5, 0.7), (0, -3.07, 1.98), P['metal'], player, bevel=0.06)
box('head_gap', (0.5, 0.52, 0.2), (0, -3.07, 2.1), P['base'], player)
for sx in (-1, 1):
    cyl('roller%d' % sx, 0.3, 0.8, (sx * 2.3, -3.04, 1.98), P['rubber'], parent=player)
    cyl('capstan%d' % sx, 0.08, 1.0, (sx * 3.2, -3.04, 2.1), P['metal'], parent=player, verts=10)
box('deck_plate', (7.4, 4.6, 0.03), (0, 0.5, 1.675), P['plate'], player)
for sx in (-1, 1):  # reel spindles (the cassette hubs sit on them)
    cyl('spindle%d' % sx, 0.3, 0.5, (sx * 1.4, -1.02, 1.9), P['metal'], parent=player, verts=18)
    cyl('spindle_core%d' % sx, 0.16, 0.54, (sx * 1.4, -1.02, 1.9), P['base'], parent=player, verts=14)
    for k in range(3):
        a = k * math.pi * 2 / 3
        box('spindle_tooth%d_%d' % (sx, k), (0.07, 0.2, 0.5), (sx * 1.4 + math.cos(a) * 0.3, -1.02 + math.sin(a) * 0.3, 1.9), P['metal'], player)
for sx in (-1, 1):  # spindle collars: dark recess rings around each drive hub on the deck plate
    cyl('collar%d' % sx, 0.62, 0.05, (sx * 1.4, -1.02, 1.7), P['base'], parent=player, verts=28)
    cyl('collar_ring%d' % sx, 0.5, 0.07, (sx * 1.4, -1.02, 1.72), P['plate'], parent=player, verts=28)
for sx in (-1, 1):  # cassette seating posts
    for sy in (-1, 1):
        box('post_%d%d' % (sx, sy), (0.5, 0.5, 0.1), (sx * 4.7, 0.35 + sy * 3.0, 1.71), P['base'], player)

# keys: empty (node, pressed by script) -> body + glyph
KEYS = [('keyPlay', -4.5), ('keyPause', -1.5), ('keyStop', 1.5), ('keyFlip', 4.5)]
def glyph(kind, par, mat_g):
    z = 0.452
    if kind == 'keyPlay': prism('g_play', [(-0.25, -0.32), (-0.25, 0.32), (0.34, 0)], 0.04, (0, 0, z), mat_g, par)
    elif kind == 'keyPause':
        for sx in (-1, 1): prism('g_pause%d' % sx, [(sx * 0.17 - 0.08, -0.3), (sx * 0.17 + 0.08, -0.3), (sx * 0.17 + 0.08, 0.3), (sx * 0.17 - 0.08, 0.3)], 0.04, (0, 0, z), mat_g, par)
    elif kind == 'keyStop': prism('g_stop', [(-0.27, -0.27), (0.27, -0.27), (0.27, 0.27), (-0.27, 0.27)], 0.04, (0, 0, z), mat_g, par)
    else:
        prism('g_eject_tri', [(-0.34, -0.02), (0.34, -0.02), (0, 0.34)], 0.04, (0, 0, z), mat_g, par)
        prism('g_eject_bar', [(-0.34, -0.3), (0.34, -0.3), (0.34, -0.16), (-0.34, -0.16)], 0.04, (0, 0, z), mat_g, par)
for name, x in KEYS:
    e = put(bpy.data.objects.new(name, None)); e.location = (x, -4.2, 3.05); e.parent = player
    box(name + '_cap', (2.7, 1.1, 0.9), (0, 0, 0), P['key'], e, bevel=0.14, seg=3)
    glyph(name, e, P['glyph_play'] if name == 'keyPlay' else P['glyph'])

# speaker slots (stereo): real cuts through the upper shell (see apply_booleans on body_top), the dark base shows at the bottom
box('stripe', (BX - 1.2, 0.06, 0.22), (0, -(BY - 0.2) / 2 - 0.02, 2.2), P['accent'], player)
box('plate_front', (2.6, 0.05, 0.42), (-4.2, -(BY - 0.2) / 2 - 0.02, 1.8), P['plate'], player, bevel=0.03)
for sx in (-1, 1):
    for sy, yy in ((0, -4.2), (1, 4.85)):
        sc = cyl('screw%d%d' % (sx, sy), 0.2, 0.08, (sx * 6.75, yy, 3.0), P['metal'], parent=player, verts=14)
        box('screw_slot_a%d%d' % (sx, sy), (0.3, 0.05, 0.03), (sx * 6.75, yy, 3.045), P['slot'], player)
        box('screw_slot_b%d%d' % (sx, sy), (0.05, 0.3, 0.03), (sx * 6.75, yy, 3.045), P['slot'], player)
cyl('led', 0.13, 0.06, (0, 4.85, 3.02), P['led'], parent=player, verts=14)
cyl('led_ring', 0.2, 0.05, (0, 4.85, 3.0), P['plate'], parent=player, verts=14)
for sx in (-1, 1):
    for sy in (-1, 1): cyl('foot%d%d' % (sx, sy), 0.55, 0.16, (sx * 5.8, sy * 4.2, -0.08), P['rubber'], parent=player, verts=18)
cyl('jack_ring', 0.34, 0.06, (BX / 2 + 0.02, -3.4, 0.75), P['metal'], axis='X', parent=player, verts=18)
cyl('jack_hole', 0.2, 0.08, (BX / 2 + 0.04, -3.4, 0.75), P['rubber'], axis='X', parent=player, verts=14)
cyl('jack2_ring', 0.3, 0.06, (BX / 2 + 0.02, -1.9, 0.75), P['metal'], axis='X', parent=player, verts=18)
cyl('jack2_hole', 0.16, 0.08, (BX / 2 + 0.04, -1.9, 0.75), P['rubber'], axis='X', parent=player, verts=14)

# door: origin on the hinge axis (X axis at the back); closed it extends toward the front (-Y)
HY, HZ = 4.85, 3.17
for sx in (-1, 1):
    box('hinge_bracket%d' % sx, (1.0, 0.5, 0.2), (sx * 3.8, HY, 3.08), P['frame'], player, bevel=0.04)
    cyl('hinge_barrel%d' % sx, 0.15, 0.9, (sx * 3.8, HY, HZ), P['metal'], axis='X', parent=player, verts=12)
door = put(bpy.data.objects.new('door', None)); door.location = (0, HY, HZ); door.parent = player
DW, DD, FR = 11.5, 8.3, 0.5
box('door_frame_back', (DW, FR, 0.18), (0, -FR / 2, 0), P['frame'], door, bevel=0.05)
box('door_frame_front', (DW, FR, 0.18), (0, -DD + FR / 2, 0), P['frame'], door, bevel=0.05)
for sx in (-1, 1): box('door_frame_side%d' % sx, (FR, DD, 0.18), (sx * (DW - FR) / 2, -DD / 2, 0), P['frame'], door, bevel=0.05)
box('door_glass', (DW - 2 * FR + 0.1, DD - 2 * FR + 0.1, 0.04), (0, -DD / 2, 0), P['glass'], door)
box('door_latch', (1.8, 0.3, 0.26), (0, -DD - 0.12, -0.02), P['frame'], door, bevel=0.06)
for i in range(4): box('door_grip%d' % i, (0.9, 0.04, 0.03), (0, -DD - 0.28, 0.0 + (i - 1.5) * 0.0), P['plate'], door) if False else None

# seat the cassette in the bay (label up, bottom/head edge toward the front)
root.parent = player
root.location = (0, 0.35, 2.3); root.rotation_euler = (math.radians(-90), 0, 0)
bpy.context.view_layer.update()

# ======================= TEXTURES (procedural, numpy; no third-party sources) =======================
import numpy as np
TEXDIR = OUT + 'assets-src/cassette-player/tex/'
os.makedirs(TEXDIR, exist_ok=True)
rng = np.random.default_rng(7)

def blur_axis(a, sigma, axis):
    n = a.shape[axis]; f = np.fft.fftfreq(n)
    k = np.exp(-2 * (np.pi * f * sigma) ** 2)
    sh = [1, 1]; sh[axis] = n
    return np.real(np.fft.ifft(np.fft.fft(a, axis=axis) * k.reshape(sh), axis=axis))

def norm01(a): return (a - a.min()) / (a.max() - a.min() + 1e-9)

def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5; dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5

def save_img(name, rgb, srgb):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    a = np.ones((h, w, 4), np.float32); a[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(a.ravel())
    img.filepath_raw = TEXDIR + name + '.png'; img.file_format = 'PNG'; img.save()
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    return img

def hexrgb(h): return np.array([int(h[i:i+2], 16) / 255 for i in (1, 3, 5)])

N = 1024
s1 = blur_axis(rng.standard_normal((N, N)), 70, 1); s2 = blur_axis(rng.standard_normal((N, N)), 16, 1); s3 = blur_axis(rng.standard_normal((N, N)), 3.5, 1)
streak = blur_axis(s1 / s1.std() + 0.6 * s2 / s2.std() + 0.35 * s3 / s3.std(), 0.55, 0)
hm = norm01(streak); mott = norm01(blur_axis(blur_axis(rng.standard_normal((N, N)), 90, 0), 90, 1))
smudge = norm01(blur_axis(blur_axis(rng.standard_normal((N, N)), 14, 0), 22, 1))      # fingerprint / dust patches
scr = np.zeros((N, N))                                                                  # fine scratches (mostly along the brushing)
for _ in range(90):
    r0 = int(rng.integers(0, N)); c0 = int(rng.integers(0, N)); ln = int(rng.integers(40, 380)); sl = rng.normal(0, 0.03); amp = rng.uniform(0.3, 1.0)
    for k in range(ln): scr[(r0 + int(k * sl)) % N, (c0 + k) % N] = amp
scr = blur_axis(scr, 0.6, 0)
mcol = hexrgb("#a4a69f")[None, None, :] * (0.86 + 0.22 * hm[..., None] + 0.05 * (mott[..., None] - 0.5)) * (1 - 0.07 * smudge[..., None]) + 0.10 * scr[..., None]
metal_c = save_img("metal_color", mcol, True)
metal_n = save_img("metal_normal", normal_from_height(hm + 0.9 * np.clip(scr, 0, 1), 5.5), False)
orm = np.stack([np.ones((N, N)), np.clip(0.40 + 0.20 * smudge + 0.10 * (1 - hm) - 0.06 * scr, 0.3, 0.8), np.clip(0.82 - 0.10 * smudge, 0.5, 1)], -1)
metal_orm = save_img("metal_orm", orm, False)
# leather-like pebble grain for rubber and plastic
pg = blur_axis(blur_axis(rng.standard_normal((512, 512)), 2.2, 0), 2.2, 1)
pebble = norm01(np.abs(pg) / pg.std()) ** 0.7 + 0.18 * rng.standard_normal((512, 512))
grain_n = save_img('grain_normal', normal_from_height(norm01(pebble), 4.5), False)
M_ = 256; yy, xx = np.mgrid[0:M_, 0:M_] / (M_ - 1) * 2 - 1
rr = np.sqrt(xx ** 2 + yy ** 2); ang = np.arctan2(yy, xx)
turns = rr * 46 + 0.25 * np.sin(ang * 3)
ring = 0.5 + 0.5 * np.sin(turns * 2 * np.pi) + 0.35 * blur_axis(blur_axis(rng.standard_normal((M_, M_)), 2.5, 0), 2.5, 1)
ring = norm01(ring)
pcol = hexrgb('#4a3a2a')[None, None, :] * (0.7 + 0.55 * ring[..., None])
pack_c = save_img('pack_color', pcol, True)
pack_n = save_img('pack_normal', normal_from_height(ring, 2.2), False)

def tex_mat(m, color=None, normal=None, strength=1.0, rough=None, metal=None, orm=None):
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    if color is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = color; t.interpolation = 'Linear'
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if normal is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = normal; t.interpolation = 'Linear'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = strength
        nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    if orm is not None:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = orm
        sp = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t.outputs['Color'], sp.inputs['Color']); nt.links.new(sp.outputs['Green'], b.inputs['Roughness']); nt.links.new(sp.outputs['Blue'], b.inputs['Metallic'])
    if rough is not None: b.inputs['Roughness'].default_value = rough
    if metal is not None: b.inputs['Metallic'].default_value = metal
tex_mat(P['top'], metal_c, metal_n, 0.9, orm=metal_orm)
for k in ('base', 'key', 'rubber'): tex_mat(P[k], None, grain_n, 0.8)
tex_mat(M['shell'], None, grain_n, 0.5)
tex_mat(M['tape'], pack_c, pack_n, 0.8)

TILE = {'p_shell_silver': 6.0, 'p_base_dark': 1.6, 'p_key': 1.6, 'p_rubber': 1.6, 'bone_plastic': 1.6}
bpy.context.view_layer.update()
for o in col.objects:
    if o.type != 'MESH' or not o.data.materials: continue
    mname = o.data.materials[0].name; me = o.data
    if mname not in TILE and mname != 'tape_brown': continue
    for k in list(me.uv_layers): me.uv_layers.remove(k)
    uv = me.uv_layers.new(name='UVMap')
    mw = o.matrix_world; t = TILE.get(mname, 1)
    for poly in me.polygons:
        nrm = mw.to_3x3() @ poly.normal; ax = max(range(3), key=lambda i: abs(nrm[i]))
        for li in poly.loop_indices:
            if mname == 'tape_brown':
                v = me.vertices[me.loops[li].vertex_index].co
                uv.data[li].uv = (v.x / PACK_R * 0.5 + 0.5, v.z / PACK_R * 0.5 + 0.5); continue
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            a, b = (w.x, w.y) if ax == 2 else ((w.y, w.z) if ax == 0 else (w.x, w.z))
            uv.data[li].uv = (a / t, b / t)

tris = 0
for o in col.objects:
    if o.type == 'MESH':
        dg = bpy.context.evaluated_depsgraph_get(); me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
print('TRIS', tris)
for o in bpy.data.objects: o.select_set(o.name in col.objects)
bpy.ops.wm.save_as_mainfile(filepath=OUT + 'assets-src/cassette-player/cassette-player.blend')
os.makedirs(OUT + 'models', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT + 'models/cassette-player.glb', export_format='GLB', use_selection=False, export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_image_format='JPEG', export_image_quality=80)
print('EXPORTED', os.path.getsize(OUT + 'models/cassette-player.glb'))
