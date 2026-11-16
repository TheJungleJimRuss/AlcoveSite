exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
for n in ('RP_Turntable', 'RP_Arm'):
    clear(n); coll(n)
C = lambda x, y, z=0: (x - 250, 200 - y, z)
T = 43.0  # plinth top

# ---------- materials ----------
def wood():
    m, b, nt = mat('RP_Walnut', rough=0.45)
    tc = N(nt, 'ShaderNodeTexCoord'); mp = N(nt, 'ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (0.0012, 0.0012, 0.0012)
    mp.inputs['Rotation'].default_value = (0, 0, math.radians(90))
    L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    d = N(nt, 'ShaderNodeTexImage', image=img(TEX + 'walnut_veneer_02_diff_2k.jpg'))
    r = N(nt, 'ShaderNodeTexImage', image=img(TEX + 'walnut_veneer_02_rough_2k.jpg', 'Non-Color'))
    nr = N(nt, 'ShaderNodeTexImage', image=img(TEX + 'walnut_veneer_02_nor_gl_2k.jpg', 'Non-Color'))
    for t in (d, r, nr): L(nt, mp.outputs['Vector'], t.inputs['Vector'])
    nm = N(nt, 'ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.6
    L(nt, nr.outputs['Color'], nm.inputs['Color'])
    mx = N(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY'); mx.inputs['Factor'].default_value = 1.0; mx.inputs[7].default_value = (0.62, 0.52, 0.46, 1)
    L(nt, d.outputs['Color'], mx.inputs[6]); L(nt, mx.outputs[2], b.inputs['Base Color'])
    L(nt, r.outputs['Color'], b.inputs['Roughness'])
    L(nt, nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Coat Weight'].default_value = 0.25; b.inputs['Coat Roughness'].default_value = 0.35
    return m

def alu(name='RP_Alu', rough=0.32, tint=(0.82, 0.82, 0.84, 1), radial=False, scale=900):
    m, b, nt = mat(name, base=tint, rough=rough, metal=1.0)
    tc = N(nt, 'ShaderNodeTexCoord')
    # fine brushed streaks: stretched noise bump
    mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, 6 if not radial else scale, scale)
    L(nt, tc.outputs['Object'], mp.inputs['Vector'])
    nz = N(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 3
    L(nt, mp.outputs['Vector'], nz.inputs['Vector'])
    bp = N(nt, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.06; bp.inputs['Distance'].default_value = 0.02
    L(nt, nz.outputs['Fac'], bp.inputs['Height'])
    L(nt, bp.outputs['Normal'], b.inputs['Normal'])
    if radial:
        tg = N(nt, 'ShaderNodeTangent', direction_type='RADIAL', axis='Z')
        L(nt, tg.outputs['Tangent'], b.inputs['Tangent'])
        b.inputs['Anisotropic'].default_value = 0.65
    return m

def chrome(name='RP_Chrome'):
    m, b, nt = mat(name, base=(0.9, 0.9, 0.92, 1), rough=0.08, metal=1.0)
    return m

def rubber(name='RP_Rubber', col=(0.018, 0.018, 0.02, 1), rough=0.8, rings=True):
    m, b, nt = mat(name, base=col, rough=rough)
    tc = N(nt, 'ShaderNodeTexCoord')
    nz = N(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 90; nz.inputs['Detail'].default_value = 6
    L(nt, tc.outputs['Object'], nz.inputs['Vector'])
    bp = N(nt, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.1
    if rings:
        wv = N(nt, 'ShaderNodeTexWave', wave_type='RINGS'); wv.inputs['Scale'].default_value = 0.9; wv.inputs['Distortion'].default_value = 0.6
        wv.inputs['Detail'].default_value = 1
        L(nt, tc.outputs['Object'], wv.inputs['Vector'])
        mx = N(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD'); mx.inputs[1].default_value = 0.5
        L(nt, wv.outputs['Fac'], mx.inputs[0]); L(nt, nz.outputs['Fac'], mx.inputs[2])
        L(nt, mx.outputs['Value'], bp.inputs['Height'])
    else:
        L(nt, nz.outputs['Fac'], bp.inputs['Height'])
    L(nt, bp.outputs['Normal'], b.inputs['Normal'])
    return m

def plastic(name, col, rough=0.38):
    m, b, nt = mat(name, base=col, rough=rough)
    b.inputs['Specular IOR Level'].default_value = 0.5
    return m

M_WOOD = wood(); M_ALU = alu(); M_ALU_R = alu('RP_AluPlatter', 0.28, (0.8, 0.8, 0.82, 1), True, 0.6)
M_CHROME = chrome(); M_MAT = rubber(); M_BLACK = plastic('RP_BlackPlastic', (0.012, 0.012, 0.014, 1), 0.34)
M_DARKWELL = plastic('RP_Well', (0.006, 0.006, 0.007, 1), 0.7)
M_PAINT = plastic('RP_WhitePaint', (0.85, 0.83, 0.78, 1), 0.5)
M_LED = mat('RP_Led', base=(1, 0.25, 0.05, 1), rough=0.15)[0]
M_BTN = plastic('RP_BtnPlastic', (0.05, 0.05, 0.055, 1), 0.28)

TT = 'RP_Turntable'
# ---------- plinth ----------
plinth = prism('Plinth', rrect_pts(480, 380, 14), 3, T, TT, loc=(0, 0))
smooth(plinth, 30)
bevel(plinth, 2.2, 3)
assign(plinth, M_WOOD)
# platter well (boolean cut) centred at the platter
cut = cyl('WellCut', 173, T - 12, T + 5, TT, loc=C(190, 200)[:2], seg=128)
bm = plinth.modifiers.new('Well', 'BOOLEAN'); bm.object = cut; bm.operation = 'DIFFERENCE'; bm.solver = 'EXACT'
cut.hide_render = True; cut.hide_viewport = True
# bevel after boolean: reorder
plinth.modifiers.move(len(plinth.modifiers) - 1, 0)
bev2 = plinth.modifiers.new('Bevel2', 'BEVEL'); bev2.width = 1.0; bev2.segments = 2; bev2.limit_method = 'ANGLE'
well = cyl('WellFloor', 172, T - 14, T - 12, TT, loc=C(190, 200)[:2], seg=128); assign(well, M_DARKWELL)
# ---------- platter, mat, strobe ring ----------
px, py = C(190, 200)[:2]
platter = cyl('Platter', 168, T - 11, T + 3, TT, loc=(px, py), seg=160); smooth(platter, 50); bevel(platter, 1.2, 3); assign(platter, M_ALU_R)
ring = cyl('PlatterRing', 160.2, T + 2.9, T + 3.0, TT, loc=(px, py), seg=160)
matt = cyl('Mat', 153, T + 3, T + 5, TT, loc=(px, py), seg=160); smooth(matt, 40); bevel(matt, 0.6, 2); assign(matt, M_MAT)
# strobe dots: two rows of small dark dimples on the platter top rim
bmd = bmesh.new()
for row, (rad, cnt) in enumerate(((165.2, 150), (162.6, 150))):
    for i in range(cnt):
        a = 2 * math.pi * (i + 0.5 * row) / cnt
        x, y = rad * math.cos(a), rad * math.sin(a)
        bmesh.ops.create_cone(bmd, cap_ends=True, segments=8, radius1=0.62, radius2=0.62, depth=0.5,
                              matrix=Matrix.Translation((x, y, T + 3.05)))
me = bpy.data.meshes.new('Strobe'); bmd.to_mesh(me); bmd.free()
strobe = bpy.data.objects.new('Strobe', me); strobe.location = (px, py, 0); link(strobe, TT); assign(strobe, M_DARKWELL)
# spindle
sp = cyl('Spindle', 3.6, T + 5, T + 17, TT, loc=(px, py), seg=48, r_top=3.2); smooth(sp, 40); bevel(sp, 0.5, 2); assign(sp, M_CHROME)
# ---------- pivot base, arm rest ----------
pvx, pvy = C(435, 60)[:2]
pb = cyl('PivotBase', 30, T, T + 9, TT, loc=(pvx, pvy), seg=96); smooth(pb, 40); bevel(pb, 1.2, 3); assign(pb, M_ALU)
pc = cyl('PivotRing', 21, T + 9, T + 12, TT, loc=(pvx, pvy), seg=96); smooth(pc, 40); bevel(pc, 0.8, 2); assign(pc, M_BLACK)
pc2 = cyl('PivotCap', 14, T + 12, T + 15, TT, loc=(pvx, pvy), seg=96); smooth(pc2, 40); bevel(pc2, 0.6, 2); assign(pc2, M_CHROME)
rx, ry = C(435, 298)[:2]
rp0 = cyl('RestBase', 11, T, T + 3, TT, loc=(rx, ry), seg=48); smooth(rp0, 40); bevel(rp0, 0.5, 2); assign(rp0, M_ALU)
rp1 = cyl('RestPost', 3.4, T + 3, T + 22, TT, loc=(rx, ry), seg=32); smooth(rp1, 40); assign(rp1, M_CHROME)
rp2 = box('RestCradle', 20, 9, T + 22, T + 26, TT, loc=(rx, ry)); smooth(rp2, 30); bevel(rp2, 1.2, 3); assign(rp2, M_BLACK)
# ---------- controls ----------
def knob(name, cx, cy, r, h, m, ring=None):
    x, y = C(cx, cy)[:2]
    o = cyl(name, r, T, T + h, TT, loc=(x, y), seg=64, r_top=r * 0.96); smooth(o, 40); bevel(o, 0.9, 3); assign(o, m)
    return o
for nm, cx in (('Btn33', 388), ('Btn45', 418)):
    o = knob(nm, cx, 356, 9, 6, M_BTN)
    x, y = C(cx, cy := 356)[:2]
    inner = cyl(nm + 'Cap', 6.4, T + 6, T + 6.4, TT, loc=(x, y), seg=48); assign(inner, M_ALU)
# start/stop (rect key)
ssx, ssy = C(452, 356)[:2]
ss = box('StartStop', 26, 16, T, T + 6, TT, loc=(ssx, ssy)); smooth(ss, 30); bevel(ss, 1.4, 3); assign(ss, M_BTN)
ssc = box('StartStopCap', 20, 10, T + 6, T + 6.5, TT, loc=(ssx, ssy)); assign(ssc, M_ALU)
# strobe lamp + LED
lx, ly = C(366, 322)[:2]
lamp = cyl('Lamp', 3.4, T, T + 3, TT, loc=(lx, ly), seg=32, r_top=2.6); smooth(lamp, 60); assign(lamp, M_LED)
# cue lever: slot + chrome lever
cx0, cy0 = C(392, 112)[:2]
slot = box('CueSlot', 8, 50, T - 0.2, T + 0.1, TT, loc=(cx0, cy0)); assign(slot, M_DARKWELL)
lev = box('CueLever', 16, 9, T + 0.1, T + 13, TT, loc=(cx0, cy0 + 10)); smooth(lev, 30); bevel(lev, 1.6, 3); assign(lev, M_ALU)
# pitch slider: slot, fader cap, tick marks
sx0, sy0 = C(471, 205)[:2]
pslot = box('PitchSlot', 5, 110, T - 0.2, T + 0.1, TT, loc=(sx0, sy0)); assign(pslot, M_DARKWELL)
pcap = box('PitchCap', 16, 9, T + 0.1, T + 9, TT, loc=(sx0, sy0 + 6)); smooth(pcap, 30); bevel(pcap, 1.3, 3); assign(pcap, M_BTN)
pline = box('PitchLine', 15, 1.1, T + 9, T + 9.3, TT, loc=(sx0, sy0 + 6)); assign(pline, M_PAINT)
for i in range(11):
    t = box('Tick%d' % i, 8 if i % 5 == 0 else 4.5, 0.9, T, T + 0.2, TT, loc=(sx0 + 12, sy0 - 55 + i * 11)); assign(t, M_PAINT)
# printed legends
def label(txt, cx, cy, size):
    cu = bpy.data.curves.new('L_' + txt, 'FONT'); cu.body = txt; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.15
    o = bpy.data.objects.new('L_' + txt, cu); o.location = C(cx, cy, T + 0.05); link(o, TT); assign(o, M_PAINT)
label('33', 388, 336, 6); label('45', 418, 336, 6); label('START / STOP', 452, 338, 3.6); label('PITCH', 471, 138, 4)
label('ALCOVE', 405, 386, 5)
print('turntable built', len(coll(TT).objects))
