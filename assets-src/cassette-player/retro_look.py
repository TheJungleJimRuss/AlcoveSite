# Retro character for the cassette materials (shared by render_layers.py and render_flip.py, which exec() this file).
# Retro cream plastic with colourful racing lines down both side margins (orange, mustard, teal), faint sun-yellowing and scuffs; ivory hubs, brass screws.
import bpy

def _nodes(m):
    m.use_nodes = True
    return m.node_tree.nodes, m.node_tree.links

def _bsdf(m):
    nodes, _ = _nodes(m)
    return next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')

def _lin(h):
    c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1]

def apply_retro_look():
    # ---- shell: aged cream plastic with scuffs
    m = bpy.data.materials['bone_plastic']; nodes, links = _nodes(m); b = _bsdf(m)
    tc = nodes.new('ShaderNodeTexCoord'); mp = nodes.new('ShaderNodeMapping')
    links.new(tc.outputs['Object'], mp.inputs['Vector'])
    def noise(scale, detail, rough=0.6):
        n = nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
        links.new(mp.outputs['Vector'], n.inputs['Vector']); return n
    def ramp(src, lo, hi):
        r = nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].position = lo; r.color_ramp.elements[1].position = hi
        links.new(src.outputs['Fac'], r.inputs['Fac']); return r
    def mix(a, bcol, fac_out):
        x = nodes.new('ShaderNodeMix'); x.data_type = 'RGBA'
        links.new(fac_out, x.inputs['Factor']); links.new(a, x.inputs['A']); links.new(bcol, x.inputs['B']) if not isinstance(bcol, (tuple, list)) else None
        if isinstance(bcol, (tuple, list)): x.inputs['B'].default_value = bcol
        return x
    cream = nodes.new('ShaderNodeRGB'); cream.outputs[0].default_value = _lin('#ddd0ae')
    yellow = ramp(noise(2.2, 2), 0.35, 0.8)                      # slow yellowing drift
    ybw = nodes.new('ShaderNodeRGBToBW'); links.new(yellow.outputs['Color'], ybw.inputs['Color'])
    ymul = nodes.new('ShaderNodeMath'); ymul.operation = 'MULTIPLY'; ymul.inputs[1].default_value = 0.22   # keep the yellowing gentle
    links.new(ybw.outputs['Val'], ymul.inputs[0])
    x1 = mix(cream.outputs[0], _lin('#c9a45a'), ymul.outputs['Value'])
    scuff = ramp(noise(130, 10, 0.75), 0.66, 0.74)                # sparse fine scuffs
    sbw = nodes.new('ShaderNodeRGBToBW'); links.new(scuff.outputs['Color'], sbw.inputs['Color'])
    smul = nodes.new('ShaderNodeMath'); smul.operation = 'MULTIPLY'; smul.inputs[1].default_value = 0.4
    links.new(sbw.outputs['Val'], smul.inputs[0])
    x2 = mix(x1.outputs['Result'], _lin('#8a7448'), smul.outputs['Value'])
    scratch_n = noise(22, 4); mp.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
    links.new(x2.outputs['Result'], b.inputs['Base Color'])
    # fine scratches: a stretched noise through a hard ramp, lightening the plastic and raising roughness
    mp2 = nodes.new('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (1.0, 0.04, 1.0)
    links.new(tc.outputs['Object'], mp2.inputs['Vector'])
    sn = nodes.new('ShaderNodeTexNoise'); sn.inputs['Scale'].default_value = 90; sn.inputs['Detail'].default_value = 1
    links.new(mp2.outputs['Vector'], sn.inputs['Vector'])
    sr = ramp(sn, 0.66, 0.7)
    rough = nodes.new('ShaderNodeMath'); rough.operation = 'MULTIPLY_ADD'
    links.new(sr.outputs['Color'], rough.inputs[0]) if False else None
    sr_bw = nodes.new('ShaderNodeRGBToBW'); links.new(sr.outputs['Color'], sr_bw.inputs['Color'])
    links.new(sr_bw.outputs['Val'], rough.inputs[0]); rough.inputs[1].default_value = 0.35; rough.inputs[2].default_value = 0.62
    links.new(rough.outputs['Value'], b.inputs['Roughness'])
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.12; bump.inputs['Distance'].default_value = 0.02
    links.new(scratch_n.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs['Normal'], b.inputs['Normal'])
    # ---- smaller parts
    def tint(name, hexcol, rough=None):
        if name in bpy.data.materials:
            bb = _bsdf(bpy.data.materials[name]); bb.inputs['Base Color'].default_value = _lin(hexcol)
            if rough is not None: bb.inputs['Roughness'].default_value = rough
    tint('hub_white', '#eadfbc', 0.62)
    tint('screw_grey', '#a58f58', 0.38)
    tint('label_paper', '#efe6cc', 0.9)

    # ---- colourful retro lines on the side margins, front and back (children of the cassette so they turn with it)
    import bmesh, math
    cas = bpy.data.objects['cassette']; inv = cas.matrix_world.inverted()
    zf, zb = 2.3 + 0.6 + 0.004, 2.3 - 0.6 - 0.004      # just off the front / back faces
    # The site's two colourways (theme-preview.js): Side A = Olive & Orange, Side B = Sage & Coral. Printed flat (emission) so the
    # colours come out exactly as the palette values instead of being lightened by the studio lights.
    cols = [('line_orange', '#FF7A2B'), ('line_gold', '#FFC93C'), ('line_olive', '#8C9A1E')]         # Side A: Olive & Orange
    colsB = [('line_plum', '#B03A5B'), ('line_coral', '#FF5E4D'), ('line_sage', '#B6D98B')]          # Side B: Sage & Coral
    for name, hx in cols + colsB:
        m = bpy.data.materials.new(name); m.use_nodes = True; bb = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bb.inputs['Base Color'].default_value = (0, 0, 0, 1); bb.inputs['Roughness'].default_value = 0.6
        bb.inputs['Emission Color'].default_value = _lin(hx); bb.inputs['Emission Strength'].default_value = 1.0
        bb.inputs['Specular IOR Level'].default_value = 0.0; bb.inputs['Coat Weight'].default_value = 0.0
    # The window is a rounded slot (centre (0, WY), half-length WX, radius WR); stripes run the full width and wrap around it.
    WY, WX, WR, MARGIN, EDGE = -1.0, 2.475, 0.975, 0.14, 4.98
    def win_half(y):          # half-width of the slot (plus margin) at height y, or None if y is outside it
        d = abs(y - WY)
        if d >= WR + MARGIN: return None
        return (WX - WR) + math.sqrt(max(0.0, (WR + MARGIN) ** 2 - d * d))
    meshes = {}
    def add(name, x0, x1, y0, y1, z):
        bm = meshes.setdefault((name, z), bmesh.new())
        bm.faces.new([bm.verts.new((x0, y0, z)), bm.verts.new((x1, y0, z)), bm.verts.new((x1, y1, z)), bm.verts.new((x0, y1, z))])
    DY = 0.04                 # row height; the stepped edge around the slot is under 3 px
    def row_segments(y, x0, x1):   # [x0, x1] minus the slot
        hw = win_half(y)
        if hw is None or x1 <= -hw or x0 >= hw: return [(x0, x1)]
        out = []
        if x0 < -hw: out.append((x0, -hw))
        if x1 > hw: out.append((hw, x1))
        return out
    # Side A (front): three bold bands across the whole width, wrapping the reel window.
    h, gap = 0.34, 0.08
    for k, (name, _) in enumerate(cols):
        top = WY + (1.5 * h + gap) - k * (h + gap)
        for r in range(int(round(h / DY))):
            y0 = top - (r + 1) * DY; y1 = y0 + DY
            for xa, xb in row_segments((y0 + y1) / 2, -EDGE, EDGE): add(name, xa, xb, y0, y1, zf)
    # Side B (back): three big colour blocks, taller than Side A's bands, across the whole width, also wrapping the window.
    hb, gb = 0.42, 0.05
    for k, (name, _) in enumerate(colsB):
        top = WY + (1.5 * hb + gb) - k * (hb + gb)
        for r in range(int(round(hb / DY))):
            y0 = top - (r + 1) * DY; y1 = y0 + DY
            for xa, xb in row_segments((y0 + y1) / 2, -EDGE, EDGE): add(name, xa, xb, y0, y1, zb)
    for (name, z), bm in meshes.items():
        me = bpy.data.meshes.new('retro_line'); bm.to_mesh(me); bm.free(); me.materials.append(bpy.data.materials[name])
        o = bpy.data.objects.new('retro_line', me); bpy.context.scene.collection.objects.link(o)
        o.parent = cas; o.matrix_parent_inverse = inv
