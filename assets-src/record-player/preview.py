exec(open('/Users/alex/AlcoveSite/assets-src/record-player/lib.py').read())
# preview(group_collections, cam_loc, ortho, w, h, out, samples)
def preview(show, cam_loc, ortho, w, h, out, samples=48, light=None, region=None):
    sc = scene()
    allc = ['RP_Turntable', 'RP_Arm', 'RP_Vinyl', 'RP_Crate', 'RP_Sleeve', 'RP_Env']
    for c in allc:
        if c in bpy.data.collections:
            lc = [x for x in sc.view_layers[0].layer_collection.children if x.name == c]
            if lc: lc[0].exclude = c not in show and c != 'RP_Env'
    cam = bpy.data.objects['RP_Cam']; cam.location = cam_loc; cam.data.ortho_scale = ortho
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.cycles.samples = samples
    if light:
        lo = bpy.data.objects['RP_Key']
        lo.location = (cam_loc[0] + light[0], cam_loc[1] + light[1], light[2])
        lo.rotation_euler = (Vector((cam_loc[0], cam_loc[1], 0)) - lo.location).to_track_quat('-Z', 'Y').to_euler()
        # ground follows the group
        g = bpy.data.objects['RP_Ground']; g.location = (cam_loc[0], cam_loc[1], 0)
    sc.render.filepath = out
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    for lc in sc.view_layers[0].layer_collection.children: lc.exclude = False
    print('rendered', out)
