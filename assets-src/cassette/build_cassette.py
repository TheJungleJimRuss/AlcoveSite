# Cassette model for Work "Cassette A/B". Run headless:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python assets-src/cassette/build_cassette.py
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

# put real origins on parents correctly (parent loc is identity so children keep their loc)
bpy.context.view_layer.update()

# ---- stats + export ----
tris = 0
for o in col.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
print('TRIS', tris, [(o.name, o.type) for o in col.objects])
for o in bpy.data.objects: o.select_set(o.name in col.objects)
bpy.ops.wm.save_as_mainfile(filepath=OUT + 'assets-src/cassette/cassette.blend')
os.makedirs(OUT + 'models', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT + 'models/cassette.glb', export_format='GLB', use_selection=False, export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False, export_texcoords=True, export_normals=True,
                          export_materials='EXPORT', export_image_format='AUTO')
print('EXPORTED', os.path.getsize(OUT + 'models/cassette.glb'))
