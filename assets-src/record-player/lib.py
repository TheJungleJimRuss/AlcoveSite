# Shared helpers for the record player scene. Run inside Blender (exec). 1 Blender unit = 1 canvas unit of the 500x400 turntable view.
import bpy, bmesh, math, os
from mathutils import Vector, Matrix

D = '/Users/alex/AlcoveSite/assets-src/record-player/'
TEX = D + 'tex/'

def scene():
    return bpy.data.scenes['RecordPlayer']

def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        scene().collection.children.link(c)
    return c

def clear(name):
    c = bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)

def link(o, cname):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll(cname).objects.link(o)
    return o

def smooth(o, angle=35):
    for p in o.data.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = o
        for s in bpy.context.selected_objects: s.select_set(False)
        o.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception as e:
        print('smooth', e)

def bevel(o, w=1.0, seg=3, angle=35):
    m = o.modifiers.new('Bevel', 'BEVEL')
    m.width = w; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
    return m

def mesh_obj(name, verts, faces, cname):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    link(o, cname)
    return o

def cyl(name, r, z0, z1, cname, loc=(0, 0), seg=96, r_top=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=(r if r_top is None else r_top), depth=z1 - z0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (loc[0], loc[1], (z0 + z1) / 2)
    link(o, cname)
    return o

def box(name, w, h, z0, z1, cname, loc=(0, 0), rot=0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.scale = (w, h, z1 - z0)
    o.location = (loc[0], loc[1], (z0 + z1) / 2)
    o.rotation_euler[2] = math.radians(rot)
    link(o, cname)
    bpy.context.view_layer.update()
    # bake scale so modifiers use real units
    me.transform(Matrix.Diagonal((w, h, z1 - z0, 1)))
    o.scale = (1, 1, 1)
    return o

def rrect_pts(w, h, r, seg=10):
    pts = []
    cx, cy = w / 2 - r, h / 2 - r
    for (sx, sy, a0) in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((sx * cx + r * math.cos(a), sy * cy + r * math.sin(a)))
    return pts

def prism(name, pts, z0, z1, cname, loc=(0, 0)):
    n = len(pts)
    v = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    f = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        f.append([i, j, n + j, n + i])
    o = mesh_obj(name, v, f, cname)
    o.location = (loc[0], loc[1], 0)
    return o

def mat(name, base=(0.5, 0.5, 0.5, 1), rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    def setp(k, v):
        if k in b.inputs: b.inputs[k].default_value = v
    setp('Base Color', base); setp('Roughness', rough); setp('Metallic', metal)
    for k, v in kw.items(): setp(k.replace('_', ' '), v)
    return m, b, nt

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def N(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n

def L(nt, a, b):
    nt.links.new(a, b)

def img(path, cs='sRGB'):
    i = bpy.data.images.load(path, check_existing=True)
    i.colorspace_settings.name = cs
    return i

def paper_mat(name, tone=(0.93, 0.91, 0.86, 1), fibre=1.0, scale=1.0):
    m, b, nt = mat(name, base=tone, rough=0.86)
    b.inputs['Specular IOR Level'].default_value = 0.25
    tc = N(nt, 'ShaderNodeTexCoord')
    # paper fibres: two stretched noises at different angles + fine grain
    mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (60 * scale, 14 * scale, 60 * scale)
    L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    n1 = N(nt, 'ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.0; n1.inputs['Detail'].default_value = 8; n1.inputs['Roughness'].default_value = 0.65
    L(nt, mp.outputs['Vector'], n1.inputs['Vector'])
    mp2 = N(nt, 'ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (14 * scale, 60 * scale, 60 * scale)
    L(nt, tc.outputs['Object'], mp2.inputs['Vector'])
    n2 = N(nt, 'ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 1.0; n2.inputs['Detail'].default_value = 8; n2.inputs['Roughness'].default_value = 0.65
    L(nt, mp2.outputs['Vector'], n2.inputs['Vector'])
    ad = N(nt, 'ShaderNodeMath', operation='ADD'); L(nt, n1.outputs['Fac'], ad.inputs[0]); L(nt, n2.outputs['Fac'], ad.inputs[1])
    bp = N(nt, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.22 * fibre; bp.inputs['Distance'].default_value = 0.06
    L(nt, ad.outputs['Value'], bp.inputs['Height']); L(nt, bp.outputs['Normal'], b.inputs['Normal'])
    # large soft mottling of the tone
    n3 = N(nt, 'ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 0.012; n3.inputs['Detail'].default_value = 3
    L(nt, tc.outputs['Object'], n3.inputs['Vector'])
    mx = N(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY'); mx.inputs['Factor'].default_value = 0.0
    return m, b, nt, n3
