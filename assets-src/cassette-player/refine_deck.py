# Refines the deck in cassette-player.blend (2026-11-20): real screws (countersunk, domed head, Phillips recess, random turn),
# rolled base edge, satin keys with a dished top and raised glyphs. Edits the .blend in place and saves it; safe to re-run
# (it removes what it made before). A copy of the old .blend is in the scratchpad backup only, so keep a git/Time Machine copy.
#   /Applications/Blender.app/Contents/MacOS/Blender -b assets-src/cassette-player/cassette-player.blend --python assets-src/cassette-player/refine_deck.py
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

random.seed(11)
D = bpy.data
def lin(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1]
def bsdf(m): return next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
def newmat(name, hexcol, rough, metal=0.0, coat=0.0):
    if name in D.materials: D.materials.remove(D.materials[name])
    m = D.materials.new(name); m.use_nodes = True; b = bsdf(m)
    b.inputs['Base Color'].default_value = lin(hexcol); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.18
    return m
def link_obj(o, parent):
    for c in list(o.users_collection): c.objects.unlink(o)
    parent_col = parent.users_collection[0]; parent_col.objects.link(o); o.parent = parent; return o
def smooth(o, angle=40):
    for p in o.data.polygons: p.use_smooth = True
    try:
        D.meshes  # noqa
        o.data.set_sharp_from_angle(angle=math.radians(angle))
    except Exception: pass
def evaluated(o):
    dg = bpy.context.evaluated_depsgraph_get(); me = D.meshes.new_from_object(o.evaluated_get(dg)); return me
def bake_modifiers(o):
    bpy.context.view_layer.update(); mats = list(o.data.materials); me = evaluated(o); o.modifiers.clear(); o.data = me
    o.data.materials.clear()
    for m in mats: o.data.materials.append(m)
def boolean(o, cutter):
    bpy.context.view_layer.update()
    m = o.modifiers.new('b', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter; m.solver = 'EXACT'
    bake_modifiers(o)

player = D.objects['player']
for n in ('led', 'led_ring'):   # user 2026-11-20: no playing-indicator light on the deck
    if n in D.objects: D.objects.remove(D.objects[n], do_unlink=True)
# remove earlier refinement
for o in [o for o in D.objects if o.name.startswith('rf_')]: D.objects.remove(o, do_unlink=True)

# ---------- materials
M_screw = newmat('rf_screw', '#b4b1a2', 0.3, 1.0)      # zinc-plated steel
M_slot = newmat('rf_screw_recess', '#161614', 0.7)
M_key = newmat('rf_key', '#383b3f', 0.34, 0.0, 0.35)    # satin ABS with a light clear coat
M_glyph = newmat('rf_glyph', '#ece5cf', 0.45, 0.0, 0.2)
M_glyph_play = newmat('rf_glyph_play', '#e26f2c', 0.45, 0.0, 0.2)
# keep a fine pebble grain on the keys, but weak
nt = M_key.node_tree; b = bsdf(M_key)
if 'grain_normal' in D.images:
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = D.images['grain_normal']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.9, 0.9, 0.9)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.25
    nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
# brushed radial lines on the screw heads
nt = M_screw.node_tree; b = bsdf(M_screw)
tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 1)
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 40; nz.inputs['Detail'].default_value = 6
nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.15; bp.inputs['Distance'].default_value = 0.01
nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])

# ---------- keys
glyph_scale_z, glyph_z = 1.9, 0.415
for key in ('keyPlay', 'keyPause', 'keyStop', 'keyFlip'):
    e = D.objects[key]; cap = D.objects[key + '_cap']
    # new cap: subdivided slab, rolled edge, dished top
    cap.modifiers.clear()
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(2.7, 1.1, 0.9), verts=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=0)   # placeholder keeps API warm
    bm.to_mesh(cap.data); bm.free()
    # remesh through bevel (rolled edge) then a grid of top points we can dish
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=(2.7, 1.1, 0.9), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.2, segments=5, profile=0.55, affect='EDGES')
    top = [f for f in bm.faces if f.normal.z > 0.9 and f.calc_center_median().z > 0.4]
    bmesh.ops.inset_region(bm, faces=top, thickness=0.02, depth=0.0)
    for _ in range(3):   # subdivide the flat top so it can be dished
        fl = [f for f in bm.faces if f.normal.z > 0.99]
        bmesh.ops.subdivide_edges(bm, edges=list({e_ for f in fl for e_ in f.edges}), cuts=3, use_grid_fill=True); break
    for v in bm.verts:
        if v.co.z > 0.42:
            u = v.co.x / 1.15; w = v.co.y / 0.42
            v.co.z -= 0.05 * max(0.0, 1 - min(1.0, (u * u + w * w) / 1.6))
    bm.to_mesh(cap.data); bm.free()
    cap.data.materials.clear(); cap.data.materials.append(M_key); smooth(cap, 35)
    for c in e.children:
        if c.name.startswith('g_'):
            c.data.materials.clear(); c.data.materials.append(M_glyph_play if key == 'keyPlay' else M_glyph)
            c.location.z = glyph_z; c.scale.z = glyph_scale_z
            bv = c.modifiers.new('bv', 'BEVEL'); bv.width = 0.012; bv.segments = 2; bv.limit_method = 'ANGLE'

# ---------- base: rolled edge catching the light, satin finish
base = D.objects['body_base']
for m in base.modifiers:
    if m.type == 'BEVEL': m.width = 0.4; m.segments = 6
bsdf(base.data.materials[0]).inputs['Roughness'].default_value = 0.5
try: bsdf(base.data.materials[0]).inputs['Coat Weight'].default_value = 0.25
except Exception: pass

# ---------- screws
top = D.objects['body_top']
for o in [o for o in D.objects if o.name.startswith('screw')]: D.objects.remove(o, do_unlink=True)
def cone_obj(name, r1, r2, depth, loc, verts=40):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r1, radius2=r2, depth=depth)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free(); o = D.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.location = loc; return o
def box_obj(name, size, loc, rz):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    me = D.meshes.new(name); bm.to_mesh(me); bm.free(); o = D.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler.z = rz; return o
# countersinks first (all in the top plate), then the screws
spots = [(sx * 6.58, yy) for sx in (-1, 1) for yy in (-4.2, 4.85)]
for i, (x, y) in enumerate(spots):
    cs = cone_obj('rf_cs', 0.36, 0.25, 0.16, (x, y, 2.96), 40)   # wide at the top, narrow below
    boolean(top, cs); D.objects.remove(cs, do_unlink=True)
for i, (x, y) in enumerate(spots):
    rz = math.radians(random.uniform(0, 90))
    head = cone_obj('rf_screw%d' % i, 0.27, 0.27, 0.14, (x, y, 2.97), 40)
    head.data.materials.append(M_screw)
    bv = head.modifiers.new('bv', 'BEVEL'); bv.width = 0.07; bv.segments = 4; bv.limit_method = 'ANGLE'
    bake_modifiers(head); smooth(head, 50)
    # domed top: lift the middle a hair
    for v in head.data.vertices:
        if v.co.z > 0.05: v.co.z += 0.03 * max(0.0, 1 - (v.co.x ** 2 + v.co.y ** 2) / 0.075)
    # Phillips recess: cross plus a small centre cone, cut from the head
    ca = box_obj('rf_ca', (0.36, 0.08, 0.2), (x, y, 3.06), rz); cb = box_obj('rf_cb', (0.08, 0.36, 0.2), (x, y, 3.06), rz)
    cc = cone_obj('rf_cc', 0.09, 0.04, 0.2, (x, y, 3.06), 16)
    for cut in (ca, cb, cc): boolean(head, cut); D.objects.remove(cut, do_unlink=True)
    head.data.materials.clear(); head.data.materials.append(M_screw)
    head.parent = player; head.matrix_parent_inverse = player.matrix_world.inverted()
    head.name = 'rf_screw%d' % i
# the recess interior should read dark: a dark disc under each head sits in the countersink floor
for i, (x, y) in enumerate(spots):
    ring = cone_obj('rf_well%d' % i, 0.24, 0.24, 0.02, (x, y, 2.9), 32); ring.data.materials.append(M_slot)
    ring.parent = player; ring.matrix_parent_inverse = player.matrix_world.inverted()

# =====================================================================================================================
# Door and cassette (2026-11-20): same treatment. Door: satin frame, corner screws, latch grip ribs, glass with a soft diagonal glare.
# Cassette: Phillips screws in a recessed well at all four corners, front and back, and a clear window pane with a glare.
# =====================================================================================================================
def make_screw(name, scale=1.0):
    """Domed pan head with a Phillips recess, built at the origin facing +Z. Returns the object (unparented)."""
    head = cone_obj(name, 0.27, 0.27, 0.14, (0, 0, 0.07), 32); head.data.materials.append(M_screw)
    bv = head.modifiers.new('bv', 'BEVEL'); bv.width = 0.07; bv.segments = 4; bv.limit_method = 'ANGLE'
    bake_modifiers(head); smooth(head, 50)
    for v in head.data.vertices:
        if v.co.z > 0.1: v.co.z += 0.03 * max(0.0, 1 - (v.co.x ** 2 + v.co.y ** 2) / 0.075)
    rz = math.radians(random.uniform(0, 90))
    for cut in (box_obj('rf_ca', (0.36, 0.08, 0.2), (0, 0, 0.17), rz), box_obj('rf_cb', (0.08, 0.36, 0.2), (0, 0, 0.17), rz), cone_obj('rf_cc', 0.09, 0.04, 0.2, (0, 0, 0.17), 16)):
        boolean(head, cut); D.objects.remove(cut, do_unlink=True)
    head.data.materials.clear(); head.data.materials.append(M_screw)
    head.scale = (scale,) * 3
    return head

def place(o, parent, matrix_world):
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_world = matrix_world; o.matrix_parent_inverse = parent.matrix_world.inverted() @ Matrix.Identity(4) if False else o.matrix_parent_inverse
    o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); o.matrix_world = matrix_world

def glare_glass(name, sx, sy, alpha_lo, alpha_hi, tilt=0.6):
    """Clear plastic/glass: nearly invisible, with a soft diagonal band that catches the light. sx, sy = object size in cm."""
    m = D.materials.new(name); m.use_nodes = True; b = bsdf(m)
    nt = m.node_tree
    b.inputs['Base Color'].default_value = (0.92, 0.95, 0.97, 1); b.inputs['Roughness'].default_value = 0.05
    tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sp.inputs['Vector'])
    a = nt.nodes.new('ShaderNodeMath'); a.operation = 'MULTIPLY_ADD'; a.inputs[1].default_value = 1.0 / sx; a.inputs[2].default_value = 0.5
    nt.links.new(sp.outputs['X'], a.inputs[0])
    c = nt.nodes.new('ShaderNodeMath'); c.operation = 'MULTIPLY_ADD'; c.inputs[1].default_value = tilt / sy
    nt.links.new(sp.outputs['Y'], c.inputs[0]); nt.links.new(a.outputs['Value'], c.inputs[2])
    rp = nt.nodes.new('ShaderNodeValToRGB'); cr = rp.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = (alpha_lo,) * 3 + (1,)
    for pos, v in ((0.36, alpha_lo), (0.47, alpha_hi), (0.54, alpha_hi * 0.5), (0.6, alpha_lo)):
        e = cr.elements.new(pos); e.color = (v,) * 3 + (1,)
    cr.elements[-1].color = (alpha_lo,) * 3 + (1,)   # the default last stop is white (alpha 1): keep the pane clear past the band
    nt.links.new(c.outputs['Value'], rp.inputs['Fac'])
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(rp.outputs['Color'], bw.inputs['Color']); nt.links.new(bw.outputs['Val'], b.inputs['Alpha'])
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    return m

# ---------- door
door = D.objects['door']
for n in [o.name for o in door.children if o.name.startswith('rf_')]: D.objects.remove(D.objects[n], do_unlink=True)
fm = D.materials['p_door_frame']; fb = bsdf(fm); fb.inputs['Roughness'].default_value = 0.42; fb.inputs['Coat Weight'].default_value = 0.2; fb.inputs['Coat Roughness'].default_value = 0.2
for o in door.children:
    for m in o.modifiers:
        if m.type == 'BEVEL' and o.name.startswith('door_frame'): m.width = 0.085; m.segments = 4
DW, DD = 11.5, 8.3
for i, (x, y) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
    sx_ = x * (DW / 2 - 0.25); sy_ = -0.25 if y > 0 else -(DD - 0.25)
    sc_ = make_screw('rf_dscrew%d' % i, 0.38)
    sc_.parent = door; sc_.location = (sx_, sy_, 0.085); sc_.matrix_parent_inverse = Matrix.Identity(4); sc_.rotation_euler = (0, 0, math.radians(random.uniform(0, 90)))
# grip ribs on the latch
latch = D.objects['door_latch']
latch.location.y = -DD + 0.05   # user 2026-11-20: the handle must not reach over the keys; it now sits on the frame's front edge
for k in range(9):
    r_ = box_obj('rf_rib%d' % k, (0.05, 0.2, 0.05), (0, 0, 0), 0)
    r_.data.materials.append(D.materials['p_plate']); r_.parent = door
    r_.location = (-0.7 + k * 0.175, latch.location.y, latch.location.z + 0.13)
# glass glare (replaces the flat clear coat; render_layers.py still sets alpha 0.1 on 'door_glass', so keep that material but add the band)
gm = D.materials['door_glass']; gb = bsdf(gm)
nt = gm.node_tree
if not any(n.type == 'VALTORGB' for n in nt.nodes):
    new = glare_glass('rf_door_glass_tmp', 10.6, 7.4, 0.03, 0.2, 0.9)
    # transplant the glare nodes into door_glass so object names and render_layers.py keep working
    for n in new.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED' or n.type == 'OUTPUT_MATERIAL': continue
    src = new.node_tree; mp = {}
    for n in src.nodes:
        if n.type in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'): continue
        c_ = nt.nodes.new(n.bl_idname); mp[n.name] = c_
        for k in ('operation',): 
            if hasattr(n, k): setattr(c_, k, getattr(n, k))
        for i_, inp in enumerate(n.inputs): 
            if hasattr(inp, 'default_value') and hasattr(c_.inputs[i_], 'default_value'):
                try: c_.inputs[i_].default_value = inp.default_value
                except Exception: pass
        if n.type == 'VALTORGB':
            c_.color_ramp.elements[0].color = n.color_ramp.elements[0].color
            while len(c_.color_ramp.elements) < len(n.color_ramp.elements): c_.color_ramp.elements.new(0.5)
            for e_, f_ in zip(c_.color_ramp.elements, n.color_ramp.elements): e_.position = f_.position; e_.color = f_.color
    for l in src.links:
        if l.from_node.name not in mp: continue
        dst = mp[l.to_node.name].inputs[l.to_socket.name] if l.to_node.name in mp else gb.inputs['Alpha']
        nt.links.new(mp[l.from_node.name].outputs[l.from_socket.name], dst)
    D.materials.remove(new)

# ---------- cassette
cas = D.objects['cassette']
for o in [o for o in D.objects if o.name.startswith('screw_f') or o.name.startswith('screw_b') or o.name.startswith('rf_cscrew') or o.name.startswith('rf_cwin')]: D.objects.remove(o, do_unlink=True)
bsdf(D.materials['bone_plastic']).inputs['Coat Weight'].default_value = 0.18
bsdf(D.materials['bone_plastic']).inputs['Coat Roughness'].default_value = 0.3
bpy.context.view_layer.update()
cw = cas.matrix_world
W_, H_, T_ = 10.04, 6.38, 1.2
for side, ly, flipx in (('f', -T_ / 2, False), ('b', T_ / 2, True)):
    for sx in (-1, 1):
        for sz in (-1, 1):
            # a shallow dark well in the shell, then the screw
            lx, lz = sx * (W_ / 2 - 0.5), sz * (H_ / 2 - 0.5)
            wl = cone_obj('rf_cscrew_well', 0.3, 0.3, 0.02, (0, 0, 0), 28); wl.data.materials.append(M_slot)
            sg = 1 if side == 'f' else -1
            loc = cw @ Vector((lx, ly + (-0.003 if side == 'f' else 0.003), lz))
            rotm = Matrix.Rotation(0 if side == 'f' else math.pi, 4, 'X')
            place(wl, cas, Matrix.Translation(loc) @ rotm); wl.name = 'rf_cscrew_well_%s%d%d' % (side, sx, sz)
            sc_ = make_screw('rf_cscrew_%s%d%d' % (side, sx, sz), 0.75)
            sc_.location = (0, 0, 0)
            place(sc_, cas, Matrix.Translation(loc) @ rotm @ Matrix.Rotation(math.radians(random.uniform(0, 90)), 4, 'Z'))
# window panes over the reel slot (stadium), both faces
WXs, rr = 2.5, 0.98
def stadium(name, z, glass):
    bm = bmesh.new(); pts = []
    for i in range(0, 21): a = math.pi / 2 - math.pi * i / 20; pts.append((WXs - rr + math.cos(a) * rr, math.sin(a) * rr))
    for i in range(0, 21): a = -math.pi / 2 - math.pi * i / 20; pts.append((-(WXs - rr) + math.cos(a) * rr, math.sin(a) * rr))
    f = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in pts]); bm.normal_update()
    me = D.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(glass)
    o = D.objects.new(name, me); bpy.context.scene.collection.objects.link(o); return o
wglass = glare_glass('rf_win_glass', 5.0, 2.0, 0.02, 0.14, 1.4)
for side, ly, flipx in (('f', -T_ / 2 - 0.008, False), ('b', T_ / 2 + 0.008, True)):
    wp = stadium('rf_cwin_' + side, 0, wglass)
    loc = cw @ Vector((0, ly, -1.37))
    place(wp, cas, Matrix.Translation(loc) @ Matrix.Rotation(0 if side == 'f' else math.pi, 4, 'X'))

bpy.ops.wm.save_as_mainfile(filepath=D.filepath)
print('REFINED')
