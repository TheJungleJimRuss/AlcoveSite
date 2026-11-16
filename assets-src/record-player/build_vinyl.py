exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
clear('RP_Vinyl'); coll('RP_Vinyl')
VC = 'RP_Vinyl'
VX, VY = 0.0, 3000.0
# ---- lathe the disc profile (r, z): raised lip, flat groove field, label rising slightly ----
prof = [(0, 0), (160.2, 0), (161, 0.45), (161, 1.55), (160.3, 2.25), (158.6, 2.35), (157.0, 2.0), (156.4, 1.95),
        (56.5, 1.95), (55.5, 1.7), (54.6, 1.7), (54.2, 2.45), (0, 2.45)]
bm = bmesh.new()
vs = [bm.verts.new((r, 0, z)) for r, z in prof]
es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=256, use_merge=True)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('Vinyl'); bm.to_mesh(me); bm.free()
disc = bpy.data.objects.new('Vinyl', me); disc.location = (VX, VY, 0); link(disc, VC)
smooth(disc, 25)

# ---- vinyl material (disc layer, even light) ----
def vinyl_mat(name, sheen=False):
    m, b, nt = mat(name, base=(0.012, 0.012, 0.014, 1), rough=0.3)
    tc = N(nt, 'ShaderNodeTexCoord')
    vm = N(nt, 'ShaderNodeVectorMath', operation='MULTIPLY'); vm.inputs[1].default_value = (1, 1, 0)
    L(nt, tc.outputs['Object'], vm.inputs[0])
    ln = N(nt, 'ShaderNodeVectorMath', operation='LENGTH'); L(nt, vm.outputs['Vector'], ln.inputs[0])
    r = ln.outputs['Value']
    def M(op, a=None, b_=None, clamp=False):
        n = N(nt, 'ShaderNodeMath', operation=op); n.use_clamp = clamp
        if a is not None:
            if isinstance(a, (int, float)): n.inputs[0].default_value = a
            else: L(nt, a, n.inputs[0])
        if b_ is not None:
            if isinstance(b_, (int, float)): n.inputs[1].default_value = b_
            else: L(nt, b_, n.inputs[1])
        return n.outputs['Value']
    # music field: 58 < r < 152, with five smooth gaps between tracks
    field = M('MULTIPLY', M('GREATER_THAN', r, 58.0), M('LESS_THAN', r, 152.0))
    gaps = None
    for r0 in (131.0, 112.5, 96.0, 81.0, 68.0):
        g = M('LESS_THAN', M('ABSOLUTE', M('SUBTRACT', r, r0)), 0.85)
        gaps = g if gaps is None else M('ADD', gaps, g, True)
    mask = M('MULTIPLY', field, M('SUBTRACT', 1.0, gaps))
    # fine grooves: sin(r * 2pi / pitch)
    groove = M('MULTIPLY_ADD', M('SINE', M('MULTIPLY', r, 2 * math.pi / 0.62)), 0.5)
    n = nt.nodes[-1]; n.inputs[2].default_value = 0.5
    height = M('MULTIPLY', groove, mask)
    bp = N(nt, 'ShaderNodeBump'); bp.inputs['Distance'].default_value = 0.012; bp.inputs['Strength'].default_value = 0.8
    L(nt, height, bp.inputs['Height']); L(nt, bp.outputs['Normal'], b.inputs['Normal'])
    # albedo: grooved field a touch lighter and rougher than the smooth bands
    mixc = N(nt, 'ShaderNodeMix', data_type='RGBA'); mixc.inputs[6].default_value = (0.005, 0.005, 0.007, 1); mixc.inputs[7].default_value = (0.021, 0.021, 0.024, 1)
    cx = N(nt, 'ShaderNodeCombineXYZ'); L(nt, M('MULTIPLY', r, 1.7), cx.inputs[0])
    nz = N(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.7
    L(nt, cx.outputs['Vector'], nz.inputs['Vector'])
    fm = M('MULTIPLY_ADD', nz.outputs['Fac'], 0.9); nt.nodes[-1].inputs[2].default_value = 0.55
    gm = M('MULTIPLY', mask, fm)
    L(nt, gm, mixc.inputs[0]); L(nt, mixc.outputs[2], b.inputs['Base Color'])
    rough = M('MULTIPLY_ADD', mask, 0.26); nt.nodes[-1].inputs[2].default_value = 0.14
    L(nt, rough, b.inputs['Roughness'])
    if sheen:
        tg = N(nt, 'ShaderNodeTangent', direction_type='RADIAL', axis='Z'); L(nt, tg.outputs['Tangent'], b.inputs['Tangent'])
        b.inputs['Anisotropic'].default_value = 0.92
        b.inputs['Base Color'].default_value = (0, 0, 0, 1)
        for lk in list(nt.links):
            if lk.to_socket == b.inputs['Base Color']: nt.links.remove(lk)
        b.inputs['Specular IOR Level'].default_value = 1.0
        L(nt, M('MULTIPLY_ADD', mask, 0.1), b.inputs['Roughness']); nt.nodes[-1].inputs[2].default_value = 0.2
    return m

M_VINYL = vinyl_mat('RP_Vinyl'); M_SHEEN = vinyl_mat('RP_VinylSheen', True)
m_lab, bl, nt_l, _ = paper_mat('RP_Label', (0.94, 0.92, 0.87, 1), 0.5, 0.8)
disc.data.materials.clear(); disc.data.materials.append(M_VINYL); disc.data.materials.append(m_lab)
for p in disc.data.polygons:
    c = p.center
    p.material_index = 1 if (math.hypot(c.x, c.y) < 54.4 and c.z > 2.3) else 0
# spindle hole mark: a small dark disc with a chrome rim, part of the label render
hole = cyl('SpindleHole', 3.5, 2.4, 2.6, VC, loc=(VX, VY), seg=48)
hole.data.materials.append(mat('RP_HoleDark', base=(0.01, 0.01, 0.012, 1), rough=0.4)[0])
rim = cyl('SpindleRim', 4.6, 2.46, 2.52, VC, loc=(VX, VY), seg=48)
rim.data.materials.append(bpy.data.materials['RP_Chrome'])
# even world for the disc layer
w2 = bpy.data.worlds.get('RP_WorldEven') or bpy.data.worlds.new('RP_WorldEven')
w2.use_nodes = True
nt = w2.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
o = N(nt, 'ShaderNodeOutputWorld'); bgn = N(nt, 'ShaderNodeBackground'); bgn.inputs['Color'].default_value = (1, 1, 1, 1); bgn.inputs['Strength'].default_value = 0.6
L(nt, bgn.outputs['Background'], o.inputs['Surface'])
print('vinyl built')
