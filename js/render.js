'use strict';
// ===== Three.js renderer: terrain, meshes, fx, fog =====
const R3 = { objs: new Map(), projObjs: new Map(), parts: [], debris: [], scorch: [], markers: [], cam: { x: 12, y: 14, d: 30 }, time: 0 };
let tileH;
function heightAt(x, y) { // bilinear of tile heights at world point
  x -= 0.5; y -= 0.5; const x0 = Math.max(0, Math.min(MW - 1, Math.floor(x))), y0 = Math.max(0, Math.min(MH - 1, Math.floor(y)));
  const x1 = Math.min(MW - 1, x0 + 1), y1 = Math.min(MH - 1, y0 + 1), fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  const h = (a, b) => tileH[b * MW + a];
  return (h(x0, y0) * (1 - fx) + h(x1, y0) * fx) * (1 - fy) + (h(x0, y1) * (1 - fx) + h(x1, y1) * fx) * fy;
}
function r3Init(el) {
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const r = R3.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  el.appendChild(r.domElement);
  const S = R3.scene = new THREE.Scene();
  S.background = new THREE.Color(0x0a0e13); S.fog = new THREE.Fog(0x0a0e13, 50, 95);
  R3.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 220);
  S.add(new THREE.HemisphereLight(0xcfe3ff, 0x3b2c1c, 0.65));
  const sun = R3.sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  S.add(sun); S.add(sun.target);
  R3.raycaster = new THREE.Raycaster(); R3.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  buildMaterials(); buildTerrain(); buildFx();
  window.addEventListener('resize', r3Resize); r3Resize();
}
function r3Resize() { const el = R3.renderer.domElement.parentElement, w = el.clientWidth, h = el.clientHeight; R3.renderer.setSize(w, h); R3.camera.aspect = w / h; R3.camera.updateProjectionMatrix(); }
function noiseTex(size, fn) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), d = x.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const v = fn(i % size, (i / size) | 0); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; } x.putImageData(d, 0, 0); return c; }
function buildMaterials() {
  const M = R3.mat = {};
  const std = (c, m, r, e) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r, emissive: e || 0 });
  M.dark = std(0x2a2f37, 0.6, 0.5); M.mid = std(0x737b86, 0.5, 0.55); M.light = std(0xc5ccd6, 0.35, 0.5); M.track = std(0x18191b, 0.3, 0.9);
  M.concrete = std(0x8a8d90, 0.05, 0.9); M.skin = std(0xd9a37a, 0, 0.8); M.yellow = std(0xd8a21a, 0.4, 0.5); M.ore = std(0xe8b030, 0.7, 0.25, 0x5a3300);
  M.glass = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2288cc, emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85 });
  M.white = std(0xeeeeee, 0, 0.7); M.rubble = std(0x3a3632, 0, 1);
  M.team = TEAMCOL.map(c => std(c, 0.45, 0.42)); M.teamGlow = TEAMCOL.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.4 }));
  M.ghostOk = new THREE.MeshBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.35, depthWrite: false });
  M.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, depthWrite: false });
  M.ring = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.9, depthWrite: false });
  M.ringE = new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.9, depthWrite: false });
  M.scaffold = new THREE.MeshBasicMaterial({ color: 0xffcc33, wireframe: true, transparent: true, opacity: 0.6 });
  const g = R3.geo = {};
  g.box = new THREE.BoxGeometry(1, 1, 1); g.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); g.sph = new THREE.SphereGeometry(0.5, 14, 10);
  g.cone = new THREE.ConeGeometry(0.5, 1, 12); g.ring = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
  g.dome = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.prism = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
}
function buildTerrain() {
  tileH = new Float32Array(MW * MH);
  const R = mkRng(G.opts.seed + 7);
  for (let i = 0; i < MW * MH; i++) { const t = G.map[i]; tileH[i] = t === 1 ? 1.5 + G.elev[i] * 1.2 + R() * 0.25 : t === 2 ? -0.8 : (R() - 0.5) * 0.06; }
  const geo = new THREE.PlaneGeometry(MW, MH, MW * 2, MH * 2); geo.rotateX(-Math.PI / 2); geo.translate(MW / 2, 0, MH / 2);
  const pos = geo.attributes.position, col = [], c = new THREE.Color();
  const grassA = new THREE.Color(0x3f6d2c), grassB = new THREE.Color(0x6a8a3c), rock = new THREE.Color(0x9a8f80), rockD = new THREE.Color(0x6a6055), sand = new THREE.Color(0xa89466), ore = new THREE.Color(0x8a6a2a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z); pos.setY(i, h);
    const tx = Math.min(MW - 1, Math.floor(x)), tz = Math.min(MH - 1, Math.floor(z)), ti = tz * MW + tx;
    const n = (Math.sin(x * 0.7) * Math.cos(z * 0.5) + Math.sin(x * 0.23 + z * 0.31)) * 0.25 + 0.5;
    if (h > 0.5) c.copy(rockD).lerp(rock, Math.min(1, (h - 0.5) / 1.5) * 0.7 + R() * 0.3);
    else if (h < -0.15) c.copy(sand).multiplyScalar(0.6 + Math.max(0, h + 0.8) * 0.5);
    else if (G.ore[ti] > 0) c.copy(grassA).lerp(ore, 0.7);
    else c.copy(grassA).lerp(grassB, n * 0.8 + R() * 0.2);
    if (h > 0.1 && h <= 0.5) c.lerp(rockD, 0.5);
    c.convertSRGBToLinear(); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(noiseTex(256, () => 180 + Math.random() * 75)); tex.encoding = THREE.sRGBEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1);
  // detail repeats via second uv set trick: scale uv
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 16, uv.getY(i) * 16);
  const mesh = R3.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.95, metalness: 0 }));
  mesh.receiveShadow = true; R3.scene.add(mesh);
  // water
  const wg = new THREE.PlaneGeometry(MW, MH).rotateX(-Math.PI / 2);
  R3.water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x1d5f86, metalness: 0.3, roughness: 0.12, transparent: true, opacity: 0.82 }));
  R3.water.position.set(MW / 2, -0.28, MH / 2); R3.water.receiveShadow = true; R3.scene.add(R3.water);
  // fog mesh following terrain
  const fg = new THREE.PlaneGeometry(MW, MH, MW * 2, MH * 2); fg.rotateX(-Math.PI / 2); fg.translate(MW / 2, 0, MH / 2);
  const fp = fg.attributes.position; for (let i = 0; i < fp.count; i++) fp.setY(i, Math.max(-0.2, heightAt(fp.getX(i), fp.getZ(i))) + 0.1);
  R3.fogData = new Uint8Array(MW * MH * 4); R3.fogTex = new THREE.DataTexture(R3.fogData, MW, MH, THREE.RGBAFormat);
  R3.fogTex.magFilter = THREE.LinearFilter; R3.fogTex.minFilter = THREE.LinearFilter;
  R3.fogMesh = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: R3.fogTex, transparent: true, depthWrite: false }));
  R3.fogMesh.renderOrder = 5; R3.scene.add(R3.fogMesh);
  // ore crystals (instanced)
  R3.oreTiles = []; for (let i = 0; i < MW * MH; i++) if (G.ore[i] > 0) R3.oreTiles.push(i);
  R3.oreMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.2, 0), R3.mat.ore, R3.oreTiles.length * 3);
  R3.oreMesh.castShadow = true; R3.scene.add(R3.oreMesh); R3.oreJ = R3.oreTiles.map(() => [0, 1, 2].map(() => [R(), R(), R()]));
  // decor: boulders on cliffs, trees near cliffs
  const bl = [], tr = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (G.map[i] === 1 && R() < 0.35) bl.push([x + R(), y + R(), 0.3 + R() * 0.5]);
    if (G.map[i] === 0 && !G.ore[i] && R() < 0.25 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inb(x + a, y + b) && G.map[(y + b) * MW + x + a] === 1)) tr.push([x + R(), y + R(), 0.4 + R() * 0.35]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const inst = (geo, mat, list, f) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((p, k) => { e.set(R(), R() * 6, R()); q.setFromEuler(e); m4.compose(new THREE.Vector3(p[0], heightAt(p[0], p[1]) + f * p[2], p[1]), q, new THREE.Vector3(p[2], p[2] * (f ? 1.6 : 0.8), p[2])); im.setMatrixAt(k, m4); });
    im.castShadow = true; im.receiveShadow = true; R3.scene.add(im); return im; };
  inst(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: 0x6e655b, roughness: 1, flatShading: true }), bl, 0);
  const treeGeo = new THREE.ConeGeometry(0.35, 1, 7); treeGeo.translate(0, 0.2, 0);
  const tm = inst(treeGeo, new THREE.MeshStandardMaterial({ color: 0x2d5a2a, roughness: 0.9, flatShading: true }), tr, 0.5);
  tm.instanceMatrix.needsUpdate = true;
  R3.oreVer = -1;
}
function updOre() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  R3.oreTiles.forEach((i, k) => { const a = G.ore[i], seen = G.seen[i], x = i % MW, y = (i / MW) | 0;
    for (let j = 0; j < 3; j++) { const r = R3.oreJ[k][j], sc = seen && a > 0 ? Math.max(0.35, Math.sqrt(a / 500)) * (0.7 + r[2] * 0.6) : 0;
      e.set(r[0], r[1] * 6, r[2] * 0.5); q.setFromEuler(e); p.set(x + 0.2 + r[0] * 0.6, 0.12 + sc * 0.15, y + 0.2 + r[1] * 0.6); s.set(sc, sc * 1.6, sc);
      m4.compose(p, q, s); R3.oreMesh.setMatrixAt(k * 3 + j, m4); } });
  R3.oreMesh.instanceMatrix.needsUpdate = true;
}
// ---------- mesh builders ----------
function part(g, geo, mat, sx, sy, sz, x, y, z, noShadow) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (!noShadow) { m.castShadow = true; m.receiveShadow = true; } g.add(m); return m; }
function barrel(g, len, r, x, y, z, mat) { const m = part(g, R3.geo.cyl, mat || R3.mat.dark, r, len, r, x + len / 2, y, z); m.rotation.z = Math.PI / 2; return m; }
function makeUnit(u) {
  const M = R3.mat, gg = R3.geo, tm = M.team[u.team], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  let turret = null, extra = {};
  const hull = (l, w, h, y) => { part(body, gg.box, M.track, l, h * 0.8, w * 0.28, 0, h * 0.4, w * 0.36); part(body, gg.box, M.track, l, h * 0.8, w * 0.28, 0, h * 0.4, -w * 0.36);
    part(body, gg.box, tm, l * 0.92, h * 0.7, w * 0.75, 0, h * 0.75, 0); part(body, gg.box, M.dark, l * 0.3, h * 0.2, w * 0.6, -l * 0.3, h * 1.15, 0); };
  switch (u.t) {
    case 'rifle': case 'rocketeer': case 'engineer': {
      const s = body; part(s, gg.box, M.dark, 0.1, 0.22, 0.16, 0, 0.11, 0); part(s, gg.box, tm, 0.13, 0.2, 0.2, 0, 0.32, 0);
      part(s, gg.sph, u.t === 'engineer' ? M.yellow : M.skin, 0.12, 0.12, 0.12, 0, 0.48, 0);
      if (u.t === 'rifle') part(s, gg.box, M.dark, 0.3, 0.04, 0.04, 0.12, 0.33, 0.08);
      if (u.t === 'rocketeer') { const t = part(s, gg.cyl, M.mid, 0.07, 0.4, 0.07, 0, 0.45, 0.1); t.rotation.z = Math.PI / 2; }
      if (u.t === 'engineer') part(s, gg.box, M.yellow, 0.1, 0.15, 0.14, -0.08, 0.32, 0);
      g.scale.setScalar(1.3); extra.inf = true; break;
    }
    case 'light': case 'heavy': {
      const k = u.t === 'heavy' ? 1.3 : 1; hull(0.9 * k, 0.62 * k, 0.28 * k, 0);
      turret = new THREE.Group(); turret.position.y = 0.38 * k; body.add(turret);
      part(turret, gg.cyl, tm, 0.38 * k, 0.16 * k, 0.38 * k, 0, 0, 0); part(turret, gg.box, M.mid, 0.2 * k, 0.1 * k, 0.3 * k, -0.08 * k, 0.08 * k, 0);
      if (u.t === 'heavy') { barrel(turret, 0.6, 0.06, 0.12, 0.02, 0.08); barrel(turret, 0.6, 0.06, 0.12, 0.02, -0.08); } else barrel(turret, 0.5, 0.06, 0.12, 0.02, 0);
      extra.tip = 0.75 * k; break;
    }
    case 'arty': {
      hull(1.0, 0.62, 0.26); turret = new THREE.Group(); turret.position.y = 0.36; body.add(turret);
      part(turret, gg.box, tm, 0.45, 0.2, 0.42, -0.05, 0.05, 0);
      const bg = new THREE.Group(); bg.rotation.z = 0.5; turret.add(bg); barrel(bg, 0.9, 0.08, 0.05, 0.1, 0); extra.tip = 0.9; break;
    }
    case 'aa': {
      hull(0.86, 0.6, 0.26); turret = new THREE.Group(); turret.position.y = 0.36; body.add(turret);
      part(turret, gg.box, tm, 0.36, 0.16, 0.4, 0, 0.05, 0);
      const bg = new THREE.Group(); bg.rotation.z = 0.8; turret.add(bg); barrel(bg, 0.5, 0.04, 0.05, 0.12, 0.1); barrel(bg, 0.5, 0.04, 0.05, 0.12, -0.1);
      const dish = part(turret, gg.cyl, M.light, 0.18, 0.03, 0.18, -0.15, 0.25, 0); extra.spin = dish; extra.tip = 0.5; break;
    }
    case 'scout': {
      part(body, gg.box, tm, 0.7, 0.16, 0.42, 0, 0.22, 0); part(body, gg.box, M.dark, 0.25, 0.14, 0.34, -0.05, 0.36, 0);
      for (const [x, z] of [[0.24, 0.24], [-0.24, 0.24], [0.24, -0.24], [-0.24, -0.24]]) { const w = part(body, gg.cyl, M.track, 0.2, 0.08, 0.2, x, 0.11, z); w.rotation.x = Math.PI / 2; }
      turret = new THREE.Group(); turret.position.set(-0.05, 0.45, 0); body.add(turret); barrel(turret, 0.35, 0.03, 0, 0, 0); extra.tip = 0.4; break;
    }
    case 'harv': {
      part(body, gg.box, M.track, 1.2, 0.25, 0.22, 0, 0.13, 0.33); part(body, gg.box, M.track, 1.2, 0.25, 0.22, 0, 0.13, -0.33);
      part(body, gg.box, M.yellow, 1.15, 0.38, 0.72, -0.05, 0.42, 0); part(body, gg.box, tm, 0.32, 0.32, 0.68, 0.45, 0.7, 0);
      part(body, gg.box, M.glass, 0.05, 0.14, 0.5, 0.62, 0.74, 0);
      extra.load = part(body, gg.box, M.ore, 0.6, 0.2, 0.55, -0.2, 0.62, 0); extra.load.material = M.ore; break;
    }
    case 'gunship': {
      part(body, gg.sph, tm, 0.9, 0.38, 0.42, 0, 0, 0); part(body, gg.sph, M.glass, 0.35, 0.22, 0.3, 0.3, 0.06, 0);
      part(body, gg.box, M.dark, 0.8, 0.08, 0.08, -0.65, 0.05, 0); part(body, gg.box, tm, 0.1, 0.25, 0.04, -1.0, 0.12, 0);
      part(body, gg.box, M.dark, 0.2, 0.06, 0.9, 0, -0.08, 0);
      const rot = part(body, gg.box, M.dark, 1.8, 0.02, 0.1, 0, 0.26, 0); extra.rotor = rot;
      const rot2 = part(rot, gg.box, M.dark, 0.05, 1, 1, 0, 0, 0); rot2.scale.set(0.06, 1, 18); extra.tip = 0.5; break;
    }
  }
  return { g, body, turret, extra };
}
function makeBuilding(b) {
  const M = R3.mat, gg = R3.geo, tm = M.team[b.team], w = b.w, h = b.h, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ex = {};
  if (b.t !== 'wall') part(body, gg.box, M.concrete, w - 0.1, 0.12, h - 0.1, 0, 0.06, 0);
  switch (b.t) {
    case 'hq':
      part(body, gg.box, M.mid, 2.4, 0.9, 2.2, -0.1, 0.55, -0.1); part(body, gg.box, tm, 2.45, 0.16, 2.25, -0.1, 0.9, -0.1);
      part(body, gg.box, M.light, 1.0, 0.7, 1.0, 0.5, 1.35, 0.4); part(body, gg.box, M.glass, 1.02, 0.12, 1.02, 0.5, 1.5, 0.4);
      ex.spin = new THREE.Group(); ex.spin.position.set(-0.7, 1.15, -0.7); body.add(ex.spin);
      part(ex.spin, gg.cyl, M.dark, 0.06, 0.6, 0.06, 0, 0.3, 0); { const d = part(ex.spin, gg.dome, M.light, 0.7, 0.35, 0.7, 0.1, 0.65, 0); d.rotation.z = -1.2; }
      part(body, gg.box, M.yellow, 0.12, 0.12, 2.4, 1.2, 1.1, -0.1); break;
    case 'power':
      part(body, gg.box, M.mid, 1.7, 0.5, 1.0, 0, 0.35, 0.4);
      for (const x of [-0.45, 0.45]) { part(body, gg.cyl, M.light, 0.6, 1.3, 0.6, x, 0.75, -0.35); part(body, gg.cyl, M.teamGlow[b.team], 0.62, 0.08, 0.62, x, 1.1, -0.35); }
      ex.glow = part(body, gg.box, M.teamGlow[b.team], 1.2, 0.08, 0.2, 0, 0.62, 0.92, true); break;
    case 'refinery':
      part(body, gg.box, M.mid, 1.7, 0.8, 2.0, -0.55, 0.45, -0.3); part(body, gg.box, tm, 1.72, 0.12, 2.02, -0.55, 0.85, -0.3);
      part(body, gg.cyl, M.yellow, 0.9, 1.2, 0.9, 0.8, 0.65, -0.7); part(body, gg.sph, M.light, 0.85, 0.5, 0.85, 0.8, 1.25, -0.7);
      part(body, gg.box, M.dark, 1.2, 0.05, 1.0, 0, 0.13, 1.0); part(body, gg.box, M.yellow, 1.2, 0.06, 0.08, 0, 0.16, 1.45); ex.spin = null; break;
    case 'barracks':
      part(body, gg.box, M.mid, 1.6, 0.6, 1.4, 0, 0.4, 0); { const r = part(body, gg.prism, tm, 0.9, 1.65, 0.6, 0, 0.85, 0); r.rotation.z = Math.PI / 2; r.rotation.x = Math.PI / 2; r.scale.set(0.9, 1.6, 0.9); }
      part(body, gg.box, M.dark, 0.5, 0.4, 0.05, 0, 0.3, 0.72); part(body, gg.cyl, M.light, 0.04, 1.4, 0.04, 0.75, 0.8, 0.7); part(body, gg.box, tm, 0.35, 0.22, 0.02, 0.92, 1.35, 0.7); break;
    case 'factory':
      part(body, gg.box, M.mid, 2.7, 1.1, 2.4, 0, 0.65, -0.2); part(body, gg.box, M.dark, 1.3, 0.8, 0.05, 0, 0.52, 1.02);
      for (const z of [-1.0, -0.2, 0.6]) part(body, gg.box, tm, 2.75, 0.16, 0.3, 0, 1.25, z);
      part(body, gg.cyl, M.dark, 0.25, 1.0, 0.25, 1.0, 1.6, -1.0); ex.smoke = { x: 1.0, y: 2.2, z: -1.0 }; break;
    case 'airpad':
      part(body, gg.cyl, M.dark, 1.8, 0.08, 1.8, 0, 0.16, 0); part(body, gg.box, M.white, 0.12, 0.02, 0.8, -0.3, 0.21, 0); part(body, gg.box, M.white, 0.12, 0.02, 0.8, 0.3, 0.21, 0); part(body, gg.box, M.white, 0.6, 0.02, 0.12, 0, 0.21, 0);
      for (const [x, z] of [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]]) part(body, gg.sph, M.teamGlow[b.team], 0.1, 0.1, 0.1, x, 0.25, z, true); break;
    case 'tech':
      part(body, gg.box, M.light, 1.6, 0.5, 1.6, 0, 0.35, 0); part(body, gg.dome, M.glass, 1.3, 1.1, 1.3, 0, 0.6, 0); part(body, gg.box, tm, 1.62, 0.1, 1.62, 0, 0.6, 0);
      ex.spin = new THREE.Group(); ex.spin.position.set(0, 1.15, 0); body.add(ex.spin); part(ex.spin, gg.box, M.teamGlow[b.team], 0.6, 0.05, 0.05, 0, 0, 0); part(ex.spin, gg.box, M.teamGlow[b.team], 0.05, 0.05, 0.6, 0, 0, 0); break;
    case 'turret': case 'aagun':
      part(body, gg.cyl, M.mid, 0.8, 0.4, 0.8, 0, 0.3, 0);
      ex.head = new THREE.Group(); ex.head.position.y = 0.6; body.add(ex.head); part(ex.head, gg.sph, tm, 0.55, 0.4, 0.55, 0, 0, 0);
      if (b.t === 'turret') barrel(ex.head, 0.6, 0.08, 0.1, 0.05, 0); else { const bg = new THREE.Group(); bg.rotation.z = 0.9; ex.head.add(bg); barrel(bg, 0.5, 0.05, 0, 0, 0.1); barrel(bg, 0.5, 0.05, 0, 0, -0.1); }
      ex.tip = 0.6; break;
    case 'wall': part(body, gg.box, M.concrete, 0.95, 0.7, 0.95, 0, 0.35, 0); part(body, gg.box, tm, 0.97, 0.06, 0.97, 0, 0.66, 0); break;
  }
  ex.scaffold = part(g, gg.box, M.scaffold, w * 0.95, 1.6, h * 0.95, 0, 0.8, 0, true); ex.scaffold.visible = false;
  return { g, body, turret: null, extra: ex };
}
function ensureObj(e) {
  let o = R3.objs.get(e.id);
  if (o) return o;
  o = e.kind === 'b' ? makeBuilding(e) : makeUnit(e);
  o.team = e.team;
  const r = e.kind === 'b' ? Math.max(e.w, e.h) * 0.75 : UT[e.t].r * 1.5 + 0.1;
  o.ring = new THREE.Mesh(R3.geo.ring, e.team === 0 ? R3.mat.ring : R3.mat.ringE); o.ring.scale.setScalar(r); o.ring.visible = false; o.ring.renderOrder = 6; R3.scene.add(o.ring);
  if (e.kind === 'b') { o.g.position.set(e.x, heightAt(e.x, e.y), e.y); }
  else { o.g.position.set(e.x, heightAt(e.x, e.y) + e.z, e.y); o.g.rotation.y = -e.ang; }
  R3.scene.add(o.g); R3.objs.set(e.id, o);
  return o;
}
function disposeObj(id) { const o = R3.objs.get(id); if (!o) return; R3.scene.remove(o.g); R3.scene.remove(o.ring); R3.objs.delete(id); }
// ---------- particles ----------
function buildFx() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  R3.pTex = new THREE.CanvasTexture(c);
  R3.pool = [];
  for (let i = 0; i < 500; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.pTex, transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 8; R3.scene.add(s); R3.pool.push(s); }
  R3.debrisPool = []; for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(R3.geo.box, R3.mat.dark); m.castShadow = true; m.visible = false; R3.scene.add(m); R3.debrisPool.push(m); }
  const sg = new THREE.CircleGeometry(0.5, 16).rotateX(-Math.PI / 2);
  R3.scorchPool = []; for (let i = 0; i < 50; i++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 1; R3.scene.add(m); R3.scorchPool.push({ m, life: 0 }); }
  R3.pIdx = 0; R3.dIdx = 0; R3.sIdx = 0;
  R3.projGeo = { rocket: new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateZ(Math.PI / 2), shell: new THREE.SphereGeometry(0.08, 8, 6) };
  R3.projMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
}
function spawnP(o) {
  const s = R3.pool[R3.pIdx++ % R3.pool.length];
  s.visible = true; s.position.set(o.x, o.z, o.y); s.material.color.set(o.c || 0xffffff);
  s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending; s.material.opacity = o.a == null ? 1 : o.a;
  s.userData = { vx: o.vx || 0, vy: o.vz || 0, vz: o.vy || 0, life: o.life, max: o.life, size: o.size, grow: o.grow || 0, grav: o.grav || 0, a: o.a == null ? 1 : o.a, drag: o.drag || 0 };
  s.scale.setScalar(o.size); R3.parts.push(s);
}
function spawnDebris(x, y, z, n, mat) {
  for (let i = 0; i < n; i++) { const m = R3.debrisPool[R3.dIdx++ % R3.debrisPool.length]; m.visible = true; m.material = mat || R3.mat.dark; const s = 0.06 + Math.random() * 0.12;
    m.scale.set(s, s, s); m.position.set(x, z, y); m.userData = { vx: (Math.random() - 0.5) * 5, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 5, life: 1.5 + Math.random() }; if (!R3.debris.includes(m)) R3.debris.push(m); }
}
function scorch(x, y, s) { const p = R3.scorchPool[R3.sIdx++ % R3.scorchPool.length]; p.m.position.set(x, heightAt(x, y) + 0.03, y); p.m.scale.setScalar(s); p.life = 20; p.m.material.opacity = 0.55; }
function explosion(x, y, z, size) {
  spawnP({ x, y, z, size: size * 1.6, grow: size * 3, life: 0.18, c: 0xffffcc, add: 1 });
  for (let i = 0; i < 6 + size * 6; i++) spawnP({ x, y, z: z + 0.1, vx: (Math.random() - 0.5) * 3 * size, vy: (Math.random() - 0.5) * 3 * size, vz: Math.random() * 2.5 * size, size: 0.3 * size + Math.random() * 0.4 * size, grow: size, life: 0.35 + Math.random() * 0.35, c: Math.random() < 0.5 ? 0xff8a1a : 0xffc040, add: 1, drag: 2 });
  for (let i = 0; i < 3 + size * 4; i++) spawnP({ x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, z: z + 0.2, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 0.6 + Math.random(), size: 0.5 * size, grow: 0.9 * size, life: 1.4 + Math.random() * 1.2, c: 0x3a3836, a: 0.55 });
  if (size >= 0.8) spawnDebris(x, y, z + 0.2, Math.round(size * 4));
  scorch(x, y, size * 1.3);
}
function marker(x, y, attack) { const m = new THREE.Mesh(R3.geo.ring, new THREE.MeshBasicMaterial({ color: attack ? 0xff4433 : 0x55ff77, transparent: true, depthWrite: false })); m.position.set(x, heightAt(x, y) + 0.08, y); m.renderOrder = 7; R3.scene.add(m); R3.markers.push({ m, t: 0.5 }); }
function handleEvents() {
  for (const ev of G.events) {
    switch (ev.e) {
      case 'fire': {
        const s = ev.src, o = R3.objs.get(s.id); if (!o || !o.g.visible) break;
        const tip = (o.extra && o.extra.tip) || 0.3, z = (s.kind === 'u' ? heightAt(s.x, s.y) + s.z : heightAt(s.x, s.y)) + (s.kind === 'b' ? 0.65 : UT[s.t].armor === 'inf' ? 0.42 : 0.45);
        const fx = s.x + Math.cos(s.tang) * tip, fy = s.y + Math.sin(s.tang) * tip, big = ev.w.type === 'cannon' || ev.w.type === 'shell';
        spawnP({ x: fx, y: fy, z, size: big ? 0.7 : 0.3, life: 0.07, c: 0xffe9a0, add: 1 });
        if (big) for (let i = 0; i < 3; i++) spawnP({ x: fx, y: fy, z, vx: Math.cos(s.tang) * 1.5, vy: Math.sin(s.tang) * 1.5, vz: 0.4, size: 0.3, grow: 0.8, life: 0.7, c: 0x8a8580, a: 0.5, drag: 2 });
        if (o.turret) o.recoil = 0.08;
        sfx(ev.w.snd, s.x, s.y); break;
      }
      case 'hit': {
        const vis = !G.opts.fog || G.vis[idx(Math.floor(ev.x), Math.floor(ev.y))]; if (!vis) break;
        const z = ev.z || heightAt(ev.x, ev.y);
        if (ev.kind === 'bullet') spawnP({ x: ev.x, y: ev.y, z: z + 0.3, size: 0.18, life: 0.08, c: 0xffd070, add: 1 });
        else if (ev.kind === 'flak') { spawnP({ x: ev.x, y: ev.y, z, size: 0.6, life: 0.15, c: 0xffc070, add: 1 }); spawnP({ x: ev.x, y: ev.y, z, size: 0.4, grow: 0.8, life: 0.8, c: 0x444444, a: 0.6 }); }
        else { explosion(ev.x, ev.y, z, ev.kind === 'shell' ? 1.1 : 0.6); sfx(ev.kind === 'shell' ? 'boomBig' : 'boom', ev.x, ev.y); }
        break;
      }
      case 'die': {
        const e = ev.ent; if (!visibleTo0(e) && G.opts.fog) { disposeObj(e.id); break; }
        if (e.sold) { disposeObj(e.id); break; }
        const z = heightAt(e.x, e.y) + (e.z || 0) + 0.3;
        if (e.kind === 'b') { const n = Math.max(3, e.w * e.h); for (let i = 0; i < n; i++) setTimeout(() => explosion(e.tx + Math.random() * e.w, e.ty + Math.random() * e.h, 0.5 + Math.random(), 1.2 + Math.random() * 0.6), i * 110);
          spawnDebris(e.x, e.y, 0.8, 12, R3.mat.concrete); sfx('boomBig', e.x, e.y); shake(0.4); }
        else if (UT[e.t].armor === 'inf') { spawnP({ x: e.x, y: e.y, z, size: 0.4, grow: 0.5, life: 0.6, c: 0x777066, a: 0.6 }); sfx('die', e.x, e.y); }
        else { explosion(e.x, e.y, z, 1.3); spawnDebris(e.x, e.y, z, 6, R3.mat.team[e.team]); sfx('boomBig', e.x, e.y); shake(0.15); }
        disposeObj(e.id); break;
      }
      case 'place': for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; spawnP({ x: ev.b.x + Math.cos(a) * ev.b.w * 0.5, y: ev.b.y + Math.sin(a) * ev.b.h * 0.5, z: 0.2, vx: Math.cos(a), vy: Math.sin(a), vz: 0.3, size: 0.6, grow: 1, life: 1.2, c: 0xb8a98a, a: 0.5, drag: 1 }); }
        if (ev.b.team === 0) sfx('place'); break;
      case 'ready': if (ev.team === 0) { sfx('ready'); uiMsg(BT[ev.t].n + ' ready to place'); } break;
      case 'unit': if (ev.team === 0) sfx('unit'); break;
      case 'capture': if (ev.team === 0 || ev.b.team === 0) { sfx('ready'); uiMsg('Structure captured!'); } disposeObj(ev.b.id); break;
    }
  }
  G.events.length = 0;
}
function shake(a) { R3.shake = Math.max(R3.shake || 0, a); }
// ---------- per-frame ----------
function r3Render(dt) {
  R3.time += dt;
  handleEvents();
  const k = 1 - Math.exp(-dt * 18);
  const alive = new Set();
  for (const e of G.ents) {
    alive.add(e.id);
    const vis = !G.opts.fog || visibleTo0(e);
    const o = ensureObj(e);
    if (o.team !== e.team) { disposeObj(e.id); continue; }
    o.g.visible = vis; o.ring.visible = vis && !!e.sel;
    if (!vis) continue;
    if (e.kind === 'u') {
      const tx = e.x, tz = e.y, ty = heightAt(e.x, e.y) * (UT[e.t].air ? 0.3 : 1) + e.z;
      if (o.g.position.distanceToSquared(new THREE.Vector3(tx, ty, tz)) > 4) o.g.position.set(tx, ty, tz);
      else { o.g.position.x += (tx - o.g.position.x) * k; o.g.position.y += (ty - o.g.position.y) * k; o.g.position.z += (tz - o.g.position.z) * k; }
      o.g.rotation.y += angDiff(o.g.rotation.y, -e.ang) * k;
      if (o.turret) { o.turret.rotation.y = -(e.tang - e.ang); if (o.recoil) { o.turret.position.x = -o.recoil; o.recoil = Math.max(0, o.recoil - dt * 0.3); } }
      if (o.extra.inf) { const moving = e.path.length > 0; o.body.position.y = moving ? Math.abs(Math.sin(R3.time * 12 + e.id)) * 0.05 : 0; o.body.rotation.y = -(e.tang - e.ang); }
      if (o.extra.rotor) o.extra.rotor.rotation.y += dt * 25;
      if (o.extra.spin) o.extra.spin.rotation.y += dt * 3;
      if (o.extra.load) { const l = e.load / 700; o.extra.load.scale.y = 0.02 + 0.25 * l; o.extra.load.visible = l > 0.01; }
      if (UT[e.t].air) o.body.rotation.z = e.path.length ? -0.15 : 0;
      if (e.t === 'harv' && e.hst === 'mine' && Math.random() < dt * 8) spawnP({ x: e.x + Math.cos(e.ang) * 0.6, y: e.y + Math.sin(e.ang) * 0.6, z: 0.2, vz: 0.6, size: 0.3, grow: 0.5, life: 0.8, c: 0xb39050, a: 0.5 });
      if (UT[e.t].armor !== 'inf' && !UT[e.t].air && e.path.length && Math.random() < dt * 6) spawnP({ x: e.x - Math.cos(e.ang) * 0.5, y: e.y - Math.sin(e.ang) * 0.5, z: 0.1, size: 0.25, grow: 0.6, life: 0.7, c: 0x9a8c70, a: 0.3 });
      o.ring.position.set(o.g.position.x, heightAt(e.x, e.y) + 0.05, o.g.position.z);
    } else {
      const age = G.time - e.born, cons = Math.min(1, age / 1.5), ease = 1 - Math.pow(1 - cons, 3);
      let sy = 0.02 + 0.98 * ease;
      if (e.sell >= 0) sy = Math.max(0.02, 1 - (G.time - e.sell) / 1.2);
      o.body.scale.y = sy; o.extra.scaffold.visible = cons < 1 || e.sell >= 0;
      if (o.extra.spin) o.extra.spin.rotation.y += dt * 1.5;
      if (o.extra.head) o.extra.head.rotation.y = -e.tang;
      if (o.extra.smoke && Math.random() < dt * 3) spawnP({ x: e.x + o.extra.smoke.x, y: e.y + o.extra.smoke.z, z: o.extra.smoke.y, vz: 0.8, vx: 0.3, size: 0.3, grow: 0.8, life: 2, c: 0x77736c, a: 0.4 });
      if (o.extra.glow) o.extra.glow.material.emissiveIntensity = 1 + Math.sin(R3.time * 3) * 0.5;
      const f = e.hp / e.mhp;
      if (f < 0.5 && Math.random() < dt * (f < 0.25 ? 10 : 4)) spawnP({ x: e.tx + Math.random() * e.w, y: e.ty + Math.random() * e.h, z: 1, vz: 1, vx: 0.3, size: 0.4, grow: 1, life: 2.2, c: 0x2c2a28, a: 0.6 });
      if (f < 0.25 && Math.random() < dt * 8) spawnP({ x: e.tx + Math.random() * e.w, y: e.ty + Math.random() * e.h, z: 0.8, vz: 1.2, size: 0.35, life: 0.5, c: 0xff7a1a, add: 1 });
      if (e.repair && Math.random() < dt * 4) spawnP({ x: e.x, y: e.y, z: 1.5, vz: 1, size: 0.25, life: 0.6, c: 0x66ff66, add: 1 });
      o.ring.position.set(e.x, heightAt(e.x, e.y) + 0.1, e.y);
    }
  }
  for (const id of [...R3.objs.keys()]) if (!alive.has(id)) disposeObj(id);
  // projectiles
  const pAlive = new Set();
  for (const p of G.projs) {
    if (p.delay > 0 || p.kind === 'bullet') continue; pAlive.add(p.id);
    let m = R3.projObjs.get(p.id);
    if (!m) { m = new THREE.Mesh(p.kind === 'rocket' ? R3.projGeo.rocket : R3.projGeo.shell, R3.projMat); R3.scene.add(m); R3.projObjs.set(p.id, m); }
    const gz = heightAt(p.x, p.y);
    m.position.set(p.x, gz + p.z, p.y); m.rotation.y = -Math.atan2(p.ty - p.y, p.tx - p.x);
    m.visible = !G.opts.fog || !!G.vis[idx(Math.floor(p.x), Math.floor(p.y))];
    if (m.visible && Math.random() < 0.8) spawnP({ x: p.x, y: p.y, z: gz + p.z, size: p.kind === 'flak' ? 0.15 : 0.22, grow: 0.5, life: p.kind === 'rocket' ? 0.6 : 0.3, c: p.kind === 'rocket' ? 0xbbbbbb : 0xffaa55, a: 0.5, add: p.kind !== 'rocket' });
  }
  for (const [id, m] of R3.projObjs) if (!pAlive.has(id)) { R3.scene.remove(m); R3.projObjs.delete(id); }
  // bullets as tracers (short sprites)
  for (const p of G.projs) if (p.kind === 'bullet' && p.delay <= 0 && (!G.opts.fog || G.vis[idx(Math.floor(p.x), Math.floor(p.y))])) spawnP({ x: p.x, y: p.y, z: heightAt(p.x, p.y) + p.z, size: 0.12, life: 0.05, c: 0xfff0a0, add: 1 });
  // particles
  for (let i = R3.parts.length - 1; i >= 0; i--) {
    const s = R3.parts[i], u = s.userData; u.life -= dt;
    if (u.life <= 0) { s.visible = false; R3.parts.splice(i, 1); continue; }
    const dr = Math.exp(-u.drag * dt); u.vx *= dr; u.vz *= dr; u.vy -= u.grav * dt;
    s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
    u.size += u.grow * dt; s.scale.setScalar(u.size); s.material.opacity = u.a * Math.min(1, u.life / u.max * 1.6);
  }
  for (let i = R3.debris.length - 1; i >= 0; i--) { const m = R3.debris[i], u = m.userData; u.life -= dt; if (u.life <= 0) { m.visible = false; R3.debris.splice(i, 1); continue; }
    u.vy -= 12 * dt; m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; m.rotation.x += dt * 8; m.rotation.z += dt * 6;
    const gh = heightAt(m.position.x, m.position.z); if (m.position.y < gh) { m.position.y = gh; u.vy *= -0.3; u.vx *= 0.6; u.vz *= 0.6; } }
  for (const s of R3.scorchPool) if (s.life > 0) { s.life -= dt; s.m.material.opacity = Math.min(0.55, s.life / 10); }
  for (let i = R3.markers.length - 1; i >= 0; i--) { const mk = R3.markers[i]; mk.t -= dt; mk.m.scale.setScalar(0.2 + mk.t * 1.4); mk.m.material.opacity = mk.t * 2; if (mk.t <= 0) { R3.scene.remove(mk.m); R3.markers.splice(i, 1); } }
  // fog texture
  if (G.tick !== R3.fogTick) { R3.fogTick = G.tick; const d = R3.fogData;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, j = ((MH - 1 - y) * MW + x) * 4; const a = G.vis[i] ? 0 : G.seen[i] ? 120 : 245; d[j + 3] += (a - d[j + 3]) * 0.35; }
    R3.fogTex.needsUpdate = true; }
  if (G.oreVer !== R3.oreVer || G.tick % 30 === 0) { R3.oreVer = G.oreVer; updOre(); }
  R3.water.material.color.setHSL(0.56, 0.6, 0.3 + Math.sin(R3.time) * 0.02);
  // camera
  const c = R3.cam, pitch = 0.98; c.x = Math.max(4, Math.min(MW - 4, c.x)); c.y = Math.max(2, Math.min(MH + 4, c.y));
  let sx = 0, sz = 0; if (R3.shake > 0) { R3.shake -= dt; sx = (Math.random() - 0.5) * R3.shake; sz = (Math.random() - 0.5) * R3.shake; }
  R3.camera.position.set(c.x + sx, c.d * Math.sin(pitch), c.y + c.d * Math.cos(pitch) + sz);
  R3.camera.lookAt(c.x + sx, 0, c.y + sz);
  R3.sun.position.set(c.x - 18, 34, c.y - 10); R3.sun.target.position.set(c.x, 0, c.y);
  R3.renderer.render(R3.scene, R3.camera);
}
function screenToWorld(sx, sy) {
  const el = R3.renderer.domElement, v = new THREE.Vector2(sx / el.clientWidth * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
  R3.raycaster.setFromCamera(v, R3.camera); const p = new THREE.Vector3();
  if (!R3.raycaster.ray.intersectPlane(R3.ground, p)) return null; return { x: p.x, y: p.z };
}
const _v3 = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function worldToScreen(x, y, z) { const el = R3.renderer.domElement; _v3.set(x, z, y).project(R3.camera); return { x: (_v3.x + 1) / 2 * el.clientWidth, y: (1 - _v3.y) / 2 * el.clientHeight, behind: _v3.z > 1 }; }
function ghost(t, tx, ty, ok) {
  if (!t) { if (R3.ghost) R3.ghost.visible = false; return; }
  if (!R3.ghost) { R3.ghost = new THREE.Mesh(R3.geo.box, R3.mat.ghostOk); R3.ghost.renderOrder = 9; R3.scene.add(R3.ghost); }
  const d = BT[t]; R3.ghost.visible = true; R3.ghost.material = ok ? R3.mat.ghostOk : R3.mat.ghostBad;
  R3.ghost.scale.set(d.w, 0.8, d.h); R3.ghost.position.set(tx + d.w / 2, 0.4 + heightAt(tx + d.w / 2, ty + d.h / 2), ty + d.h / 2);
}
