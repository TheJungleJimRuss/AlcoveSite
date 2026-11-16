exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
def render(out, w, h, target, ortho, show, tilt=0.0, samples=64, world='RP_World', key=(-700, 800, 1300), ground=True, ground_z=0.0, fmt='PNG'):
    sc = scene()
    for lc in sc.view_layers[0].layer_collection.children:
        lc.exclude = (lc.name not in show) and lc.name != 'RP_Env'
    cam = bpy.data.objects['RP_Cam']
    t = math.radians(tilt)
    cam.location = (target[0], target[1] - 2000 * math.sin(t), target[2] + 2000 * math.cos(t))
    cam.rotation_euler = (t, 0, 0)
    cam.data.ortho_scale = ortho
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.world = bpy.data.worlds[world]
    lo = bpy.data.objects['RP_Key']
    lo.location = (target[0] + key[0], target[1] + key[1], key[2])
    lo.rotation_euler = (Vector((target[0], target[1], 0)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
    g = bpy.data.objects['RP_Ground']; g.location = (target[0], target[1], ground_z); g.hide_render = not ground
    sc.render.filepath = out
    sc.render.image_settings.file_format = fmt
    sc.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)
    for lc in sc.view_layers[0].layer_collection.children: lc.exclude = False
    sc.world = bpy.data.worlds['RP_World']
    print('rendered', out)
