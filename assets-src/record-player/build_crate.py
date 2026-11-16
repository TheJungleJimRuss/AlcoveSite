exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
clear('RP_Crate'); coll('RP_Crate')
CR = 'RP_Crate'
CX, CY = 6000.0, 0.0     # crate group offset in world
W, DP, H = 427.0, 215.0, 200.0   # outer width, depth, height
WT = 7.0                          # wall thickness
RR = 22.0                         # corner radius (plan)
M_CR = mat('RP_Crate', base=(0.075, 0.095, 0.13, 1), rough=0.42, Specular_IOR_Level=0.45)[0]
m, b, nt = mat('RP_Crate', base=(0.13, 0.16, 0.21, 1), rough=0.42)
# faint plastic mottling + micro-roughness
tc = N(nt, 'ShaderNodeTexCoord'); nz = N(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.05; nz.inputs['Detail'].default_value = 6
L(nt, tc.outputs['Object'], nz.inputs['Vector'])
mx = N(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD'); L(nt, nz.outputs['Fac'], mx.inputs[0]); mx.inputs[1].default_value = 0.18; mx.inputs[2].default_value = 0.34
L(nt, mx.outputs['Value'], b.inputs['Roughness'])
bp = N(nt, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.08
n2 = N(nt, 'ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3.0; n2.inputs['Detail'].default_value = 10
L(nt, tc.outputs['Object'], n2.inputs['Vector']); L(nt, n2.outputs['Fac'], bp.inputs['Height']); L(nt, bp.outputs['Normal'], b.inputs['Normal'])
M_CR = m

def wall(name, w, h, loc, plane, slot=False):
    """grid wall built from ribs (no booleans): frame + rows/cols of square holes; slot=True merges 3 holes mid-upper row into a handle slot"""
    bm = bmesh.new()
    th = WT
    def add(cx, cz, sx, sz):
        r = bmesh.ops.create_cube(bm, size=1)
        for v in r['verts']:
            if plane == 'xz': v.co = (cx + v.co.x * sx, v.co.y * th, cz + v.co.z * sz)
            else: v.co = (v.co.x * th, cx + v.co.y * sx, cz + v.co.z * sz)
    rail_t, rail_b = 34.0, 26.0
    hole_w, hole_h, rib = 31.0, 20.0, 8.0
    inner_h = h - rail_t - rail_b
    rows = int((inner_h + rib) // (hole_h + rib))
    rows_h = rows * hole_h + (rows - 1) * rib
    rail_b += (inner_h - rows_h) / 2; rail_t = h - rail_b - rows_h
    cols = int(((w - 2 * 14) + rib) // (hole_w + rib))
    cols_w = cols * hole_w + (cols - 1) * rib
    side = (w - cols_w) / 2
    add(0, rail_b / 2, w, rail_b); add(0, h - rail_t / 2, w, rail_t)
    add(-w / 2 + side / 2, h / 2, side, h); add(w / 2 - side / 2, h / 2, side, h)
    z0 = rail_b
    # slot: skip ribs between cols in the top row for the middle 3 holes
    mid = cols // 2
    for j in range(rows - 1):   # horizontal ribs
        zc = z0 + (j + 1) * hole_h + j * rib + rib / 2
        add(0, zc, cols_w, rib)
    for i in range(cols - 1):   # vertical ribs
        xc = -cols_w / 2 + (i + 1) * hole_w + i * rib + rib / 2
        for j in range(rows):
            if slot and j == rows - 1 and mid - 2 <= i <= mid + 0: continue
            if slot and j == rows - 2 and mid - 2 <= i <= mid + 0 and False: continue
            zc = z0 + j * (hole_h + rib) + hole_h / 2
            add(xc, zc, rib, hole_h)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = (loc[0], loc[1], 0); link(o, CR)
    smooth(o, 30); bevel(o, 1.0, 2, 40)
    return o

front = wall('WallFront', W - 2 * WT, H, (CX, CY - DP / 2 + WT / 2), 'xz', slot=True); assign(front, M_CR)
back = wall('WallBack', W - 2 * WT, H, (CX, CY + DP / 2 - WT / 2), 'xz'); assign(back, M_CR)
left = wall('WallL', DP - 2 * WT, H, (CX - W / 2 + WT / 2, CY), 'yz'); assign(left, M_CR)
right = wall('WallR', DP - 2 * WT, H, (CX + W / 2 - WT / 2, CY), 'yz'); assign(right, M_CR)
# grid floor (seen through from above): border frame + ribs, square holes; no bevel (overlapping ribs speckle with one)
def grid_floor(name, w, d, th=6.0, border=14.0, rib=6.0, hole=20.0):
    bm = bmesh.new()
    def add(cx, cy, sx, sy):
        r = bmesh.ops.create_cube(bm, size=1)
        for v in r['verts']: v.co = (cx + v.co.x * sx, cy + v.co.y * sy, th / 2 + v.co.z * th)
    cols = int((w - 2 * border + rib) // (hole + rib)); rows = int((d - 2 * border + rib) // (hole + rib))
    cw = cols * hole + (cols - 1) * rib; rh = rows * hole + (rows - 1) * rib
    bx = (w - cw) / 2; by = (d - rh) / 2
    add(0, -d / 2 + by / 2, w, by); add(0, d / 2 - by / 2, w, by); add(-w / 2 + bx / 2, 0, bx, rh); add(w / 2 - bx / 2, 0, bx, rh)
    for i in range(cols - 1): add(-cw / 2 + (i + 1) * hole + i * rib + rib / 2, 0, rib, rh)
    for j in range(rows - 1): add(0, -rh / 2 + (j + 1) * hole + j * rib + rib / 2, cw, rib)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); o.location = (CX, CY, 0); link(o, CR); smooth(o, 30)
    return o
floor = grid_floor('Floor', W - 2, DP - 2); assign(floor, M_CR)
# corner posts (rounded)
for sx in (-1, 1):
    for sy in (-1, 1):
        pp = box('Post%d%d' % (sx, sy), WT * 1.6, WT * 1.6, 0, H - 2, CR, loc=(CX + sx * (W / 2 - WT * 0.8), CY + sy * (DP / 2 - WT * 0.8)))
        smooth(pp, 30); assign(pp, M_CR)
# rolled rim: rounded-rectangle loop with a round section
def rim(name, w, d, r, z, rad, scale_z=0.8):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = rad; cu.bevel_resolution = 5; cu.resolution_u = 8
    pts = rrect_pts(w, d, r, 10)
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu); o.location = (CX, CY, z); o.scale = (1, 1, scale_z); link(o, CR); assign(o, M_CR); return o
rim('Rim', W - 8, DP - 8, RR - 4, H - 3, 9.0, 0.85)
# handle grip pad: a rounded bar behind the slot
print('crate built', len(coll(CR).objects))
