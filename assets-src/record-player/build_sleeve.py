exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
clear('RP_Sleeve'); coll('RP_Sleeve')
SL = 'RP_Sleeve'
SX, SY = 9000.0, 0.0
SW, SH = 288.0, 307.0
def sleeve_mat(name, tone, ring=False):
    m, b, nt, n3 = paper_mat(name, tone, 1.0, 1.0)
    tc = next(n for n in nt.nodes if n.type == 'TEX_COORD')
    # slight colour mottling + edge/ring wear through a mix to a lighter paper tone
    mx = N(nt, 'ShaderNodeMix', data_type='RGBA'); mx.inputs[6].default_value = tone
    mx.inputs[7].default_value = (min(1, tone[0] * 1.04), min(1, tone[1] * 1.04), min(1, tone[2] * 1.04), 1)
    cr = N(nt, 'ShaderNodeValToRGB'); L(nt, n3.outputs['Fac'], cr.inputs['Fac']); cr.color_ramp.elements[0].position = 0.4; cr.color_ramp.elements[1].position = 0.62
    L(nt, cr.outputs['Color'], mx.inputs[0]); L(nt, mx.outputs[2], b.inputs['Base Color'])
    if ring:
        # faint pale ring where the disc presses (radius ~ 148) plus pale edge wear
        vm = N(nt, 'ShaderNodeVectorMath', operation='LENGTH'); sub = N(nt, 'ShaderNodeVectorMath', operation='SUBTRACT')
        sub.inputs[1].default_value = (0, 4, 0); L(nt, tc.outputs['Object'], sub.inputs[0]); L(nt, sub.outputs['Vector'], vm.inputs[0])
        mr = N(nt, 'ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 140; mr.inputs['From Max'].default_value = 154
        mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 1.0
        L(nt, vm.outputs['Value'], mr.inputs['Value'])
        # triangular profile: 0 at 140, 1 at 147, 0 at 154  => 1 - |2x-1|
        a = N(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD'); L(nt, mr.outputs['Result'], a.inputs[0]); a.inputs[1].default_value = 2; a.inputs[2].default_value = -1
        ab = N(nt, 'ShaderNodeMath', operation='ABSOLUTE'); L(nt, a.outputs['Value'], ab.inputs[0])
        tri = N(nt, 'ShaderNodeMath', operation='SUBTRACT'); tri.inputs[0].default_value = 1.0; L(nt, ab.outputs['Value'], tri.inputs[1])
        mo = N(nt, 'ShaderNodeMath', operation='MULTIPLY'); mo.inputs[1].default_value = 0.35; L(nt, tri.outputs['Value'], mo.inputs[0])
        nz = N(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.08; L(nt, tc.outputs['Object'], nz.inputs['Vector'])
        mm = N(nt, 'ShaderNodeMath', operation='MULTIPLY'); L(nt, mo.outputs['Value'], mm.inputs[0]); L(nt, nz.outputs['Fac'], mm.inputs[1])
        mx2 = N(nt, 'ShaderNodeMix', data_type='RGBA')
        for lk in list(nt.links):
            if lk.to_socket == b.inputs['Base Color']: nt.links.remove(lk)
        L(nt, mx.outputs[2], mx2.inputs[6]); mx2.inputs[7].default_value = (1, 0.99, 0.96, 1); L(nt, mm.outputs['Value'], mx2.inputs[0]); L(nt, mx2.outputs[2], b.inputs['Base Color'])
    return m
M_SL = sleeve_mat('RP_Sleeve', (0.90, 0.88, 0.83, 1), ring=True)
M_LINER = sleeve_mat('RP_Liner', (0.80, 0.79, 0.76, 1))
# flat card: raised 3 units so the ground catches a soft shadow
card = prism('SleeveCard', rrect_pts(SW, SH, 3.0, 4), 3.0, 4.6, SL, loc=(SX, SY)); smooth(card, 30); bevel(card, 0.5, 2, 40); assign(card, M_SL)
# edge strip: card top edge + inner liner peeking out above it (separate position, rendered as its own layer)
EX, EY = SX, SY + 800
ec = prism('EdgeCard', rrect_pts(SW, 34, 3.0, 4), 8.0, 9.6, SL, loc=(EX, EY)); smooth(ec, 30); bevel(ec, 0.5, 2, 40); assign(ec, M_SL)
el = prism('EdgeLiner', rrect_pts(SW - 14, 34, 2.0, 3), 6.4, 7.6, SL, loc=(EX, EY + 5)); smooth(el, 30); assign(el, M_LINER)
print('sleeve built')
