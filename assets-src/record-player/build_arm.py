exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
clear('RP_Arm'); coll('RP_Arm')
AR = 'RP_Arm'
T = 43.0
PX, PY = 185.0, 140.0   # pivot in world (canvas 435,60)
M_ALU = bpy.data.materials['RP_Alu']; M_CHROME = bpy.data.materials['RP_Chrome']; M_BLACK = bpy.data.materials['RP_BlackPlastic']
def plastic_mat(name, col, rough):
    return mat(name, base=col, rough=rough)[0]
M_ANOD = mat('RP_Anodised', base=(0.05, 0.05, 0.055, 1), rough=0.3, metal=0.9)[0]
M_ORANGE = plastic_mat('RP_Orange', (0.9, 0.28, 0.04, 1), 0.35)
M_WHITE = plastic_mat('RP_WhiteMark', (0.9, 0.9, 0.88, 1), 0.4)

# gimbal housing + rear stub + counterweight (rear points +y, away from the platter)
h = cyl('ArmHousing', 10.5, T + 15, T + 30, AR, loc=(PX, PY), seg=64); smooth(h, 40); bevel(h, 0.9, 3); assign(h, M_ALU)
hc = cyl('ArmHousingTop', 7, T + 30, T + 32, AR, loc=(PX, PY), seg=64); smooth(hc, 40); bevel(hc, 0.6, 2); assign(hc, M_CHROME)
hr = cyl('ArmHousingRing', 11.2, T + 22.5, T + 24.5, AR, loc=(PX, PY), seg=64); assign(hr, M_ANOD)
def along_y(name, r, y0, y1, z, m, seg=48):
    o = cyl(name, r, 0, y1 - y0, AR, loc=(PX, PY + (y0 + y1) / 2), seg=seg)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = (PX, PY + (y0 + y1) / 2, T + z)
    smooth(o, 40); assign(o, m); return o
along_y('RearStub', 3.2, 6, 30, 24, M_CHROME)
cw = along_y('Counterweight', 10.8, 16, 38, 24, M_ANOD); bevel(cw, 0.7, 2)
for i, y in enumerate((19, 27, 35)):
    along_y('CwRing%d' % i, 11.05, y, y + 1.1, 24, M_ALU)
along_y('CwMark', 11.0, 37, 37.6, 24, M_WHITE)
# S tube
cu = bpy.data.curves.new('ArmTube', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 3.1; cu.bevel_resolution = 6; cu.resolution_u = 24
sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
pts = [((0, -6, 0), (0, -2, 0), (0, -34, 0)), ((15, -150, 0), (13, -112, 0), (16.5, -186, 0)), ((11.9, -222, 0), (14.5, -204, 0), (10.3, -240, 0))]
for bp, (co, hl, hr_) in zip(sp.bezier_points, pts):
    bp.co = co; bp.handle_left = hl; bp.handle_right = hr_
    bp.handle_left_type = 'FREE'; bp.handle_right_type = 'FREE'
tube = bpy.data.objects.new('ArmTube', cu); tube.location = (PX, PY, T + 24); link(tube, AR); assign(tube, M_CHROME)
# collar at the headshell end
cl = cyl('Collar', 4.6, 0, 7, AR, loc=(PX + 11.9, PY - 222), seg=32); cl.rotation_euler = (math.radians(90), 0, math.radians(-20.5)); cl.location = (PX + 11.9, PY - 222 - 1, T + 24)
smooth(cl, 40); assign(cl, M_ALU)
# headshell: local frame at the stylus tip, +y points back along the arm, rotated -20.5deg
root = bpy.data.objects.new('HeadshellRoot', None); root.location = (PX, PY - 254, T); root.rotation_euler = (0, 0, math.radians(-20.5)); link(root, AR)
def child(o, loc):
    o.parent = root; o.location = loc; return o
plate = box('Headshell', 17, 34, 0, 3.2, AR); smooth(plate, 30); bevel(plate, 1.1, 3); assign(plate, M_ANOD); child(plate, (0, 18, 21.5))
stripe = box('HeadshellStripe', 3, 28, 0, 0.25, AR); assign(stripe, M_ORANGE); child(stripe, (0, 20, 24.7))
cart = box('Cartridge', 13, 20, 0, 6, AR); smooth(cart, 30); bevel(cart, 0.9, 3); assign(cart, M_BLACK); child(cart, (0, 9.5, 15.5))
nose = box('CartridgeNose', 11.6, 6, 0, 5.8, AR); smooth(nose, 30); bevel(nose, 0.7, 2); assign(nose, M_ORANGE); child(nose, (0, 2.6, 15.6))
# stylus cantilever + tip (visible just past the cartridge nose)
canti = box('Cantilever', 1.1, 9, 0, 0.9, AR); assign(canti, M_CHROME); child(canti, (0, -0.8, 15.2))
# finger lift: bent rod on the right side
fc = bpy.data.curves.new('FingerLift', 'CURVE'); fc.dimensions = '3D'; fc.bevel_depth = 0.9; fc.bevel_resolution = 4; fc.resolution_u = 16
fs = fc.splines.new('BEZIER'); fs.bezier_points.add(2)
for bp, (co, hl, hr_) in zip(fs.bezier_points, [((8, 24, 22), (7.5, 24, 22), (11, 24, 22)), ((15, 20, 22.5), (13, 24, 22.2), (17, 15, 22.8)), ((17, 10, 28), (16.5, 14, 25), (17, 6, 30))]):
    bp.co = co; bp.handle_left = hl; bp.handle_right = hr_; bp.handle_left_type = 'FREE'; bp.handle_right_type = 'FREE'
fl = bpy.data.objects.new('FingerLift', fc); fl.parent = root; fl.location = (0, 0, 0); link(fl, AR); assign(fl, M_CHROME)
print('arm built', len(coll(AR).objects))
