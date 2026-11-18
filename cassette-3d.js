// Work page: three.js cassette PLAYER for the A/B deck (ticket 04 + 07, ADR 0007 and amendment).
// ab-compare.js stays the source of truth; this file only listens to its events
// (ab:state, ab:flip-start, ab:flip-end) and window.__abDeck, and draws the 3D cassette on a canvas
// inside #cassette-stage. The SVG cassette stays as the fallback (no WebGL, GLB failure,
// reduced motion, ?nogl); data-webgl on the stage hides it once the canvas has rendered.
(function () {
  const stage = document.getElementById('cassette-stage');
  const section = document.querySelector('.ab-compare');
  if (!stage || !section) return;
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const dbg = window.__cassette3d = { ready: false, error: null, rotationY: 0, renders: 0 };

  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }
  if (new URLSearchParams(location.search).has('nogl')) { dbg.error = 'nogl'; return; }
  if (reduceMq.matches) { dbg.error = 'reduced-motion'; return; }
  if (matchMedia('(forced-colors: active)').matches) { dbg.error = 'forced-colors'; return; } // tokens resolve to system colours: the lit 3D body renders as a black slab
  if (!webglOK()) { dbg.error = 'no-webgl'; return; }
  // Lite mode (content-loader.js): weak device, keep the SVG cassette. Checked when loading would start, since the
  // frame probe may switch lite on after this script runs.
  const lite = () => document.documentElement.hasAttribute('data-lite');
  if (lite()) { dbg.error = 'lite'; return; }

  let started = false;
  function start() { if (started) return; if (lite()) { dbg.error = 'lite'; return; } started = true; init().catch(err => fail(err)); }
  let canvas = null;
  function fail(err) {
    dbg.error = String(err && err.message || err);
    stage.removeAttribute('data-webgl');
    canvas?.remove();
    stopLoop();
  }
  let stopLoop = () => {};

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '400px 0px' });
    io.observe(stage);
  } else start();

  async function init() {
    const [THREE, { GLTFLoader }] = await Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]);
    const gltf = await new GLTFLoader().loadAsync('models/cassette-player.glb');

    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    let raf = 0, visible = true, dirty = true;
    const scene = new THREE.Scene();
    // Strictly top down (plan view): a very low field of view looking straight down, screen-up = the back of the deck.
    const camera = new THREE.PerspectiveCamera(14, 16 / 13.5, 1, 400);
    camera.up.set(0, 0, -1);
    const target = new THREE.Vector3(0, 3.0, 0.25);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-7, 24, -5);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(8, 10, 9);
    scene.add(hemi, key, fill);
    // A small procedural environment (dim room + three soft boxes) so the satin shell reads as metal; no HDR file to ship.
    {
      const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x77736d, side: THREE.BackSide })));
      const panel = (w, h, x, y, z, v) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v * 0.96), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
      };
      panel(18, 10, -12, 17, -9, 5); panel(10, 14, 16, 12, 8, 2.4); panel(26, 4, 0, 18, 14, 1.6);
      scene.environment = pm.fromScene(env, 0.05).texture; scene.environmentIntensity = 0.55;
      pm.dispose();
    }

    const model = gltf.scene; scene.add(model);
    const get = n => model.getObjectByName(n);
    const player = get('player'), cassette = get('cassette'), door = get('door');
    const reelL = get('reelL'), reelR = get('reelR'), packL = get('packL'), packR = get('packR');
    const sideA = get('sideA'), sideB = get('sideB');
    const keys = { play: get('keyPlay'), pause: get('keyPause'), stop: get('keyStop'), flip: get('keyFlip') };
    if (!player || !cassette || !door || !reelL || !reelR || !packL || !packR || !sideA || !sideB || Object.values(keys).some(k => !k)) throw new Error('cassette-player.glb nodes missing');
    // Satin, not gloss (ADR 0001 amendment, ticket 08): the brushed shell may be metal (roughness >= 0.45), everything else
    // stays a rough dielectric. The door glass is replaced below.
    model.traverse(o => {
      if (o.isMesh) { o.castShadow = o.name !== 'door_glass'; o.receiveShadow = true; }
      const ms = o.material ? [].concat(o.material) : [];
      ms.forEach(m => {
        if (m.roughnessMap || m.metalnessMap) return; // the ORM map (dust, fingerprints, wear) drives these; its range is already satin
        if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 0.8, m.metalness > 0.3 ? 0.45 : 0.7);
        if ('metalness' in m && m.metalness <= 0.3) m.metalness = 0;
        if (m.normalMap) m.normalScale.set(1, 1);
        if (m.map) m.map.anisotropy = 4;
        if (m.roughnessMap) m.roughnessMap.anisotropy = 4;
      });
    });
    // Per-key cap materials (hover glow) and the play LED (lit while playing)
    const capMats = {};
    Object.entries(keys).forEach(([k, n]) => {
      capMats[k] = [];
      n.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive) { o.material = o.material.clone(); capMats[k].push(o.material); } });
    });
    const ledMesh = get('led');
    if (ledMesh && ledMesh.material) { ledMesh.material = ledMesh.material.clone(); ledMesh.material.emissive = new THREE.Color(0x000000); }
    const ledOn = new THREE.Color(0xff3b1f);
    // Flip rig: player > lift (at the seat, moves and tumbles) > side (0 or PI about the long axis) > cassette
    const seat = cassette.position.clone();
    const lift = new THREE.Group(); lift.position.copy(seat);
    const side = new THREE.Group();
    player.add(lift); lift.add(side); cassette.position.set(0, 0, 0); side.add(cassette);
    const keyBase = Object.fromEntries(Object.entries(keys).map(([k, n]) => [k, n.position.y]));
    const DOOR_OPEN = THREE.MathUtils.degToRad(90), LIFT = 8.5;

    // ---- tape ribbon between the two packs (cassette-local plane; width along the cassette depth, so a top view shows its edge)
    const TAPE_GUIDE = { x: 3.6, y: -2.9, r: 0.22 }, TAPE_T = 0.07, TAPE_W = 0.5;
    const tapeGroup = new THREE.Group(); tapeGroup.name = 'tape'; cassette.add(tapeGroup);
    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x3b2d21, roughness: 0.42, metalness: 0 });
    const tapeSegs = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tapeMat); m.castShadow = true; tapeGroup.add(m); return m; });
    function setSeg(m, a, b) {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.rotation.set(0, 0, Math.atan2(dy, dx)); m.scale.set(len + TAPE_T, TAPE_T, TAPE_W);
    }
    function tapeEnds(sx, pack) { // external tangent between the pack circle and the guide post, tape on the front (bottom) side
      const c = [pack.position.x, pack.position.y], rP = pack.scale.x, gx = sx * TAPE_GUIDE.x, gy = TAPE_GUIDE.y, g = TAPE_GUIDE.r;
      const dx = gx - c[0], dy = gy - c[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, sn = (rP - g) / L, cs = Math.sqrt(1 - sn * sn);
      const px = sx * uy, py = -sx * ux, nx = px * cs + ux * sn, ny = py * cs + uy * sn;
      return { pack: [c[0] + nx * rP, c[1] + ny * rP], guide: [gx + nx * g, gy + ny * g] };
    }
    function updateTape() {
      const l = tapeEnds(-1, packL), r = tapeEnds(1, packR);
      setSeg(tapeSegs[0], l.pack, l.guide); setSeg(tapeSegs[1], l.guide, r.guide); setSeg(tapeSegs[2], r.guide, r.pack);
      dbg.tape = { segments: tapeSegs.length, left: l, right: r, packL: packL.scale.x, packR: packR.scale.x };
    }

    // ---- silkscreen, glass and soft shadow (all canvas drawn, no extra files)
    function canvasTex(w, h, draw, srgb = true) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }
    const DW = 11.5, DD = 8.3;
    const doorPrint = canvasTex(1150, 830, (g, w, h) => {
      g.fillStyle = 'rgba(236,228,205,0.82)'; g.textBaseline = 'middle';
      g.font = `600 26px ${getComputedStyle(section).getPropertyValue('--font-mono').trim() || 'ui-monospace, Menlo, monospace'}`;
      g.textAlign = 'left'; g.fillText('ALCOVE RECORDING', 40, 26); g.textAlign = 'right'; g.fillText('STEREO CASSETTE RECORDER', w - 40, 26);
      g.textAlign = 'left'; g.fillText('TYPE I  NORMAL BIAS', 40, h - 26); g.textAlign = 'right'; g.fillText('SIDE A / SIDE B', w - 40, h - 26);
    });
    const doorDecal = new THREE.Mesh(new THREE.PlaneGeometry(DW, DD), new THREE.MeshBasicMaterial({ map: doorPrint, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    doorDecal.rotation.x = -Math.PI / 2; doorDecal.position.set(0, 0.095, DD / 2); door.add(doorDecal);
    const shellPrint = canvasTex(256, 128, (g, w, h) => { g.fillStyle = 'rgba(28,28,26,0.8)'; g.font = '700 62px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('L', w * 0.25, h / 2); g.fillText('R', w * 0.75, h / 2); });
    const shellDecal = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 0.8), new THREE.MeshBasicMaterial({ map: shellPrint, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    shellDecal.rotation.x = -Math.PI / 2; shellDecal.position.set(0, 3.012, 3.1); player.add(shellDecal);
    // key wells: soft dark pools under each key so they sit in the channel
    const wells = canvasTex(1008, 108, (g, w, h) => {
      g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 16; g.shadowOffsetX = 4000; g.fillStyle = '#000';
      for (const x of [-4.5, -1.5, 1.5, 4.5]) g.fillRect((x + 6.3) * 80 - 124 - 4000, 20, 248, 70);
    }, false);
    const wellDecal = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 1.35), new THREE.MeshBasicMaterial({ alphaMap: wells, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    wellDecal.rotation.x = -Math.PI / 2; wellDecal.position.set(0, 2.612, 4.225); player.add(wellDecal);
    // door glass: faint scratches and a diagonal sheen, still nearly clear (the alpha channel carries it)
    const glass = get('door_glass');
    if (glass) {
      const gb = new THREE.Box3().setFromObject(glass); glass.updateWorldMatrix(true, false);
      const pos = glass.geometry.attributes.position, uv = new Float32Array(pos.count * 2), bb = new THREE.Box3().setFromBufferAttribute(pos);
      for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x); uv[i * 2 + 1] = 1 - (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z); }
      glass.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const rnd = prng(5);
      const glassTex = canvasTex(512, 370, (g, w, h) => {
        g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, w, h);
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0.28, 'rgba(255,255,255,0)'); gr.addColorStop(0.38, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.46, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.1)'); gr.addColorStop(0.64, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.lineWidth = 1;
        for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.2})`; const x = rnd() * w, y = rnd() * h, a = rnd() * 6.28, l = 20 + rnd() * 90; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      });
      glass.material = new THREE.MeshStandardMaterial({ color: 0xe2e9e6, map: glassTex, transparent: true, opacity: 1, depthWrite: false, roughness: 0.5, metalness: 0 });
      glass.castShadow = false;
    }
    // ground: a faint shadow-map catcher (follows the lifted cassette) plus a baked soft contact shadow that fades to 0 at its edges
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.28 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.17; catcher.receiveShadow = true; scene.add(catcher);
    const blobTex = canvasTex(512, 512, (g, w, h) => {
      g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 54; g.shadowOffsetX = 4000; g.fillStyle = '#000';
      const rw = w * 0.56, rh = h * 0.45, x = (w - rw) / 2, y = (h - rh) / 2, rr = 26;
      g.beginPath(); g.roundRect(x - 4000, y, rw, rh, rr); g.fill();
    }, false);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(30, 28), new THREE.MeshBasicMaterial({ alphaMap: blobTex, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(0.5, -0.16, 0.7); scene.add(blob);

    // ---- colours: resolve any CSS colour expression (color-mix, var()) through a probe element
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;inline-size:0;block-size:0';
    stage.appendChild(probe);
    const cx = document.createElement('canvas'); cx.width = cx.height = 1;
    const cctx = cx.getContext('2d', { willReadFrequently: true });
    function colour(expr) { // -> 'rgb(r,g,b)' string and a THREE.Color
      probe.style.color = ''; probe.style.color = expr;
      const computed = getComputedStyle(probe).color;
      cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = '#000'; cctx.fillStyle = computed; cctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = cctx.getImageData(0, 0, 1, 1).data;
      return { css: `rgb(${r},${g},${b})`, three: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace) };
    }
    function tint() {
      hemi.color.copy(colour('var(--bg-surface)').three);
      hemi.groundColor.copy(colour('color-mix(in srgb, var(--bg-page) 55%, #000)').three);
      key.color.copy(colour('color-mix(in srgb, #fff 70%, var(--bg-accent))').three);
      fill.color.copy(colour('color-mix(in srgb, var(--text-muted) 60%, #fff)').three);
    }

    // ---- label canvases (1024 x 360, flipY false, per ADR 0007)
    const sideText = v => ({
      title: (section.querySelector(`th[data-version="${v}"]`)?.textContent || (v === 'memo' ? 'Voice Memo' : 'Finished Master')).trim(),
      note: (section.querySelector(`.cs-side[data-version="${v}"] .cs-hand`)?.textContent || '').trim()
    });
    const mono = getComputedStyle(section).getPropertyValue('--font-mono').trim() || 'ui-monospace, Menlo, monospace';
    function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function drawLabel(v, tex) {
      const { title, note } = sideText(v);
      const c = tex.image, g = c.getContext('2d');
      const paper = colour('var(--tape-paper)').css, ink = colour('var(--tape-ink)').css;
      const stripe = colour(v === 'master' ? 'var(--accent-primary)' : 'var(--text-muted)').css;
      const stripeInk = colour('var(--bg-surface)').css;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = paper; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = stripe; g.fillRect(0, 0, c.width, 70);
      g.fillStyle = stripeInk; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = `700 44px ${mono}`; g.fillText(v === 'memo' ? 'A' : 'B', 30, 36);
      g.textAlign = 'center'; g.font = `600 36px ${mono}`; g.fillText(title.toUpperCase(), c.width / 2, 36);
      g.strokeStyle = ink; g.globalAlpha = 0.3; g.lineWidth = 3;
      for (const y of [160, 230, 300]) { g.beginPath(); g.moveTo(30, y); g.lineTo(c.width - 30, y); g.stroke(); }
      g.globalAlpha = 1;
      g.textAlign = 'left'; g.fillStyle = ink; g.font = "46px 'Bradley Hand','Segoe Print',cursive";
      g.fillText(note, 36, 136, c.width - 72);
      // paper grain: seeded speckle and a few fibres over the whole label (same on every redraw)
      const rnd = prng(v === 'memo' ? 11 : 23);
      for (let i = 0; i < 5200; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)'; g.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 2, 1 + rnd() * 2); }
      g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const x = rnd() * c.width, y = rnd() * c.height, a = rnd() * 6.28, l = 6 + rnd() * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      tex.needsUpdate = true;
    }
    function makeTex() {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 360;
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; return t;
    }
    const texA = makeTex(), texB = makeTex();
    sideA.material = new THREE.MeshStandardMaterial({ map: texA, roughness: 0.9, metalness: 0 });
    sideB.material = new THREE.MeshStandardMaterial({ map: texB, roughness: 0.9, metalness: 0 });
    function restyle() { tint(); drawLabel('memo', texA); drawLabel('master', texB); request(); }
    restyle();

    // redraw on side-text edits (Admin Edit) and on palette / scheme changes
    let restyleQueued = false;
    const queueRestyle = () => { if (restyleQueued) return; restyleQueued = true; requestAnimationFrame(() => { restyleQueued = false; restyle(); }); };
    // Only the side names and handwritten notes feed the labels: the deck rewrites its own status/time text on every
    // Play/Pause/Flip, and redrawing both label canvases for that cost a ~100 ms hitch on each key press.
    const LABEL_SRC = 'th[data-version], .cs-hand';
    const touchesLabel = m => { const n = m.target.nodeType === 1 ? m.target : m.target.parentElement; return !!n && (!!n.closest(LABEL_SRC) || (m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(x => x.nodeType === 1 && (x.matches(LABEL_SRC) || x.querySelector(LABEL_SRC))))); };
    new MutationObserver(ms => { if (ms.some(touchesLabel)) queueRestyle(); }).observe(section, { subtree: true, characterData: true, childList: true });
    new MutationObserver(queueRestyle).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-scheme', 'data-palette', 'data-font'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', queueRestyle);
    matchMedia('(forced-colors: active)').addEventListener('change', queueRestyle);

    // ---- sizing
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const dist = Math.max(6.9 / t, (8 / camera.aspect) / t);
      camera.position.set(target.x, target.y + dist, target.z);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      keysDirty = true;
      request();
    }
    new ResizeObserver(resize).observe(canvas);

    // ---- state from ab-compare.js
    let s = window.__abDeck ? window.__abDeck.state() : { version: 'memo', progress: 0, reel: 0, flipping: false };
    const sideRot = v => (v === 'master' ? Math.PI : 0);
    let flip = null; // {t0, dur, from, to}
    side.rotation.z = sideRot(s.version);
    function applyState() {
      reelL.rotation.z = -s.reel * Math.PI / 180;
      reelR.rotation.z = -s.reel * Math.PI / 180;
      const a = THREE.MathUtils.lerp(0.9, 0.5, s.progress), b = THREE.MathUtils.lerp(0.5, 0.9, s.progress);
      packL.scale.set(a, a, 1); packR.scale.set(b, b, 1); updateTape();
      // Play latches down while the tape runs
      const latched = s.playing && !s.flipping;
      keys.play.position.y = keyBase.play - (latched || held.play ? 0.32 : 0);
      keys.pause.position.y = keyBase.pause - (held.pause ? 0.32 : 0);
      keys.stop.position.y = keyBase.stop - (held.stop ? 0.32 : 0);
      if (!flip) keys.flip.position.y = keyBase.flip - (held.flip ? 0.32 : 0);
      Object.keys(capMats).forEach(k => capMats[k].forEach(m => { m.emissive.setHex(0xffffff).multiplyScalar(0); m.emissive.copy(m.color).multiplyScalar(hover[k] ? 0.35 : 0); }));
      if (ledMesh && ledMesh.material.emissive) { ledMesh.material.emissive.copy(latched ? ledOn : new THREE.Color(0)); ledMesh.material.emissiveIntensity = latched ? 1.6 : 0; }
    }
    // ---- the real buttons laid over the 3D keys: hover glow + press depress, positions projected from the model
    const held = {}, hover = {};
    const deckTop = canvas.closest('.deck-top') || stage.parentElement;
    const keyBtns = {};
    Object.keys(keys).forEach(k => {
      const b = document.getElementById('ab-key-' + k); if (!b) return; keyBtns[k] = b;
      const set = (o, v) => () => { o[k] = v; request(); };
      b.addEventListener('pointerenter', set(hover, true)); b.addEventListener('pointerleave', () => { hover[k] = false; held[k] = false; request(); });
      b.addEventListener('pointerdown', set(held, true));
      ['pointerup', 'pointercancel', 'blur'].forEach(ev => b.addEventListener(ev, set(held, false)));
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { held[k] = true; request(); } });
      b.addEventListener('keyup', set(held, false));
      b.addEventListener('focus', () => { hover[k] = b.matches(':focus-visible'); request(); });
      b.addEventListener('blur', () => { hover[k] = false; request(); });
    });
    const _v = new THREE.Vector3();
    // The key buttons only move when the layout does (canvas or deck resized), so they are placed then, not every frame:
    // reading the rects each frame, right after the deck rewrote its text, forced a full layout per frame (~190 ms/s at
    // 20x CPU throttle during a flip). Pressed keys sink 0.32 units, which projects to well under a pixel from above.
    let keysDirty = true;
    new ResizeObserver(() => { keysDirty = true; request(); }).observe(deckTop);
    function placeKeys() {
      const cr = canvas.getBoundingClientRect(), dr = deckTop.getBoundingClientRect();
      if (!cr.width || !dr.width) return;
      camera.updateMatrixWorld();
      Object.entries(keys).forEach(([k, n]) => {
        const b = keyBtns[k]; if (!b) return;
        n.updateWorldMatrix(true, false); n.getWorldPosition(_v); _v.project(camera);
        const x = cr.left + (_v.x + 1) / 2 * cr.width - dr.left, y = cr.top + (1 - _v.y) / 2 * cr.height - dr.top;
        b.style.setProperty('--kx', (x / dr.width * 100).toFixed(3) + '%');
        b.style.setProperty('--ky', (y / dr.height * 100).toFixed(3) + '%');
      });
    }
    section.addEventListener('ab:state', e => {
      s = e.detail;
      if (!flip) side.rotation.z = sideRot(s.version); // safety net: always show the active side when idle
      request();
    });
    section.addEventListener('ab:flip-start', e => {
      const d = e.detail, dur = d.outMs + d.inMs;
      if (!dur) { side.rotation.z = sideRot(d.to); flip = null; request(); return; }
      flip = { t0: performance.now(), dur, from: sideRot(d.from), to: sideRot(d.to) };
      request();
    });
    section.addEventListener('ab:flip-end', e => { flip = null; rest(sideRot(e.detail.version)); request(); });
    function rest(rz) { lift.position.copy(seat); lift.rotation.set(0, 0, 0); side.rotation.z = rz; door.rotation.x = 0; keys.flip.position.y = keyBase.flip; }
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
    // Eject, lift, flip, insert: the door swings up, the tape rises, turns over (end over end, then a half turn flat so the
    // head edge stays at the front), drops back in and the door closes. Net rotation is a half turn about the long axis.
    function poseFlip(t) {
      door.rotation.x = -DOOR_OPEN * (seg(t, 0, 0.2) - seg(t, 0.8, 1));
      const up = seg(t, 0.14, 0.36) - seg(t, 0.72, 0.92);
      lift.position.set(seat.x, seat.y + up * LIFT, seat.z);
      // seen from above the cassette turns over about its front-back axis like a page, with a small sway so it does not look mechanical
      const roll = seg(t, 0.34, 0.74);
      lift.rotation.set(0.09 * Math.sin(Math.PI * roll) * up, 0.12 * Math.sin(Math.PI * roll) * up, Math.PI * roll);
      side.rotation.z = flip.from;
      keys.flip.position.y = keyBase.flip - 0.32 * (seg(t, 0, 0.05) - seg(t, 0.12, 0.2));
    }

    // ---- render loop: only while visible, only when something changed
    function request() { dirty = true; if (!raf && visible && !document.hidden && canvas) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      if (flip) {
        const t = Math.min(1, (now - flip.t0) / flip.dur);
        poseFlip(t);
        if (t >= 1) { const to = flip.to; flip = null; rest(to); }
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        applyState();
        renderer.render(scene, camera);
        if (keysDirty) { keysDirty = false; placeKeys(); }
        dbg.renders++; dbg.rotationY = side.rotation.z + (flip ? lift.rotation.z : 0); dbg.doorOpen = -door.rotation.x;
        if (!stage.hasAttribute('data-webgl')) stage.setAttribute('data-webgl', '');
      }
      if (flip) request();
    }
    stopLoop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; visible = false; };
    new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) request(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) request(); });
    reduceMq.addEventListener('change', () => {
      if (reduceMq.matches) { stage.removeAttribute('data-webgl'); canvas.hidden = true; visible = false; }
      else { canvas.hidden = false; visible = true; request(); }
    });
    addEventListener('pagehide', () => {
      stopLoop();
      scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); });
      renderer.dispose();
    });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail('context lost'); });

    dbg.ready = true;
    dbg.render = () => { dirty = true; frame(performance.now()); };
    dbg.pose = t => { // test hook: freeze the flip at t (0-1) and render; pose(null) returns to rest
      if (t == null) { flip = null; rest(sideRot(s.version)); } else { flip = { t0: 1e15, dur: 1, from: sideRot(s.version), to: 0 }; poseFlip(t); flip = null; }
      dirty = true; applyState(); renderer.render(scene, camera);
    };
    resize();
    request();
  }
})();
