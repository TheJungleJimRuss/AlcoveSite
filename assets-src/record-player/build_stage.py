exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
sc = scene()
bpy.context.window.scene = sc
for o in list(sc.objects):
    if o.name == 'TexHolder': bpy.data.objects.remove(o, do_unlink=True)
r = sc.render
r.engine = 'CYCLES'
r.film_transparent = True
cy = sc.cycles
cy.samples = 160; cy.use_denoising = True; cy.preview_samples = 32
cy.max_bounces = 6; cy.diffuse_bounces = 3; cy.glossy_bounces = 4; cy.transmission_bounces = 2
cy.sample_clamp_indirect = 8
sc.view_settings.view_transform = 'AgX'
try: sc.view_settings.look = 'AgX - Base Contrast'
except Exception as e: print('look', e)
sc.view_settings.exposure = 0.0
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
# world: neutral studio HDRI
w = bpy.data.worlds.get('RP_World') or bpy.data.worlds.new('RP_World')
w.use_nodes = True; nt = w.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
out = N(nt, 'ShaderNodeOutputWorld'); bg = N(nt, 'ShaderNodeBackground')
env = N(nt, 'ShaderNodeTexEnvironment', image=img(TEX + 'pav_studio_03_2k.hdr', 'Linear Rec.709'))
tc = N(nt, 'ShaderNodeTexCoord'); mp = N(nt, 'ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(200))
L(nt, tc.outputs['Generated'], mp.inputs['Vector']); L(nt, mp.outputs['Vector'], env.inputs['Vector'])
L(nt, env.outputs['Color'], bg.inputs['Color']); L(nt, bg.outputs['Background'], out.inputs['Surface'])
bg.inputs['Strength'].default_value = 0.55
sc.world = w
# ground shadow catcher for the turntable group
if 'RP_Ground' not in bpy.data.objects:
    bpy.ops.mesh.primitive_plane_add(size=3000, location=(0, 0, 0)); g = bpy.context.object; g.name = 'RP_Ground'
    g.is_shadow_catcher = True
    link(g, 'RP_Env')
# key light: soft, top-left
if 'RP_Key' not in bpy.data.objects:
    ld = bpy.data.lights.new('RP_Key', 'AREA'); ld.shape = 'DISK'; ld.size = 700; ld.energy = 5.5e6
    lo = bpy.data.objects.new('RP_Key', ld); link(lo, 'RP_Env')
lo = bpy.data.objects['RP_Key']
lo.location = (-700, 800, 1300)
d = Vector((0, 0, 0)) - lo.location
lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
# camera
if 'RP_Cam' not in bpy.data.objects:
    cd = bpy.data.cameras.new('RP_Cam'); cd.type = 'ORTHO'; cd.clip_start = 10; cd.clip_end = 6000
    co = bpy.data.objects.new('RP_Cam', cd); link(co, 'RP_Env')
cam = bpy.data.objects['RP_Cam']; cam.location = (0, 0, 2000); cam.rotation_euler = (0, 0, 0)
cam.data.ortho_scale = 500; sc.camera = cam
r.resolution_x = 700; r.resolution_y = 560; r.resolution_percentage = 100
print('stage ok')
