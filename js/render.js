'use strict';
// ===== Renderer orchestrator: quality, lighting/env, instanced units, buildings, events, camera, picking =====
const QUALITY = {
  low:   { pr: 0.75, shadows: false, shadowSize: 1024, bloom: false, fxaa: false, msaa: 0, grass: 0, fx: 0.5, label: 'Low' },
  med:   { pr: 1.25, sharpen: 0.2, shadows: true, shadowSize: 1024, bloom: true, fxaa: true, msaa: 0, grass: 0.3, fx: 0.75, label: 'Medium' },
  high:  { pr: 2.0, sharpen: 0.25, shadows: true, shadowSize: 2048, bloom: true, fxaa: false, msaa: 2, grass: 0.55, fx: 1, label: 'High' },
  quiet: { pr: 1.0, shadows: true, shadowSize: 1024, bloom: false, fxaa: true, msaa: 0, grass: 0.12, fx: 0.4, label: 'Quiet', quiet: 1 },
  ultra: { pr: 2.0, sharpen: 0.3, shadows: true, shadowSize: 4096, bloom: true, fxaa: false, msaa: 4, grass: 0.85, fx: 1.2, label: 'Ultra' },
};
const R3 = { corpses: [], objs: new Map(), rs: new Map(), uiMesh: new Map(), markers: [], cam: { x: 12, y: 14, d: 30, tx: 12, ty: 14, td: 30 }, time: 0, uTime: { value: 0 }, sunDir: null, fps: 60, frames: 0, fpsT: 0, view: { x0: 0, y0: 0, x1: MW, y1: MH } };
function detectQuality() {
  if (QS.get('q') && QUALITY[QS.get('q')]) return QS.get('q');
  const saved = localStorage.getItem('if_quality'); if (saved && saved !== 'auto' && QUALITY[saved]) return saved;
  try { const gl = R3.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    R3.gpu = s; if (/swiftshader|llvmpipe|software/i.test(s)) return 'low'; if (/intel/i.test(s) && !/iris xe|arc/i.test(s)) return 'med'; return 'high'; } catch (e) { return 'high'; }
}
function r3Init(el) {
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const r = R3.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true, preserveDrawingBuffer: !!QS.get('shot') });
  r.outputEncoding = THREE.LinearEncoding; r.toneMapping = THREE.NoToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.info.autoReset = false; el.insertBefore(r.domElement, el.firstChild);
  const S = R3.scene = new THREE.Scene();
  const fogC = new THREE.Color(0x8fa6b8); S.background = fogC; S.fog = new THREE.FogExp2(fogC, 0.0065);
  R3.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 260);
  R3.sunDir = new THREE.Vector3(-0.45, 0.78, -0.42).normalize();
  R3.hemi = new THREE.HemisphereLight(0xc8dcff, 0x40351f, 0.15); S.add(R3.hemi);
  const sun = R3.sun = new THREE.DirectionalLight(0xffe2bc, 3.0); sun.castShadow = true; sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
  S.add(sun); S.add(sun.target);
  buildEnv();
  postInit(r);
  R3.raycaster = new THREE.Raycaster(); R3.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  buildTerrain3(); buildFx3(); buildMarkers();
  R3.qName = detectQuality(); R3.auto = !QS.get('q') && (localStorage.getItem('if_quality') || 'auto') === 'auto';
  applyQuality(R3.qName);
  window.addEventListener('resize', r3Resize);
  makePortraits();
}
function buildEnv() {
  const sky = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uSun: { value: R3.sunDir } }, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){ float h = vD.y; vec3 zen = vec3(0.16,0.32,0.65), hor = vec3(0.75,0.82,0.9), gnd = vec3(0.22,0.2,0.16);
      vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.6)) : mix(hor*0.8, gnd, pow(-h, 0.4)); float s = max(dot(vD, uSun), 0.0); c += vec3(1.0,0.85,0.6) * (pow(s, 700.0) * 30.0 + pow(s, 12.0) * 0.5); gl_FragColor = vec4(c, 1.0); }` });
  sky.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(R3.renderer); R3.scene.environment = pm.fromScene(sky, 0.02).texture; pm.dispose();
}
function applyQuality(name) {
  const q = QUALITY[name]; R3.qName = name; R3.q = q;
  R3.sun.castShadow = q.shadows;
  if (R3.sun.shadow.mapSize.x !== q.shadowSize) { R3.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (R3.sun.shadow.map) { R3.sun.shadow.map.dispose(); R3.sun.shadow.map = null; } }
  if (R3.grass) { R3.grass.count = Math.floor(R3.grassMax * q.grass); R3.grass.visible = q.grass > 0; }
  FX.mul = q.fx; R3.fxBase = q.fx; if (R3.uLavaQ) R3.uLavaQ.value = name === 'quiet' ? 0 : 1;
  r3Resize();
}
function r3Resize() {
  const el = R3.renderer.domElement.parentElement, w = el.clientWidth, h = el.clientHeight, dpr = window.devicePixelRatio || 1;
  let pr = Math.min(dpr, R3.q.pr); if (R3.qName !== 'ultra' && w * pr * h * pr > 8.5e6) pr = Math.max(1, Math.sqrt(8.5e6 / (w * h))); // 5K: cap internal res ~4K
  R3.renderer.setPixelRatio(pr); R3.renderer.setSize(w, h); R3.camera.aspect = w / h; R3.camera.updateProjectionMatrix();
  postResize(Math.floor(w * pr), Math.floor(h * pr), R3.q);
}
// ---------- markers, rings, contact shadows ----------
function buildMarkers() {
  const rg = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
  const mk = (c, n, o) => { const m = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o || 0.9, depthWrite: false, fog: false }), n); m.frustumCulled = false; m.count = 0; m.renderOrder = 6; R3.scene.add(m); return m; };
  R3.ringSel = mk(0x55ff88, 400); R3.ringEnemy = mk(0xff5544, 100); R3.ringHover = mk(0xffffff, 4, 0.45);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.6, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  R3.aoTex = new THREE.CanvasTexture(c);
  R3.blob = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: R3.aoTex, transparent: true, depthWrite: false, fog: false }), 800);
  R3.blob.frustumCulled = false; R3.blob.renderOrder = 1; R3.blob.count = 0; R3.scene.add(R3.blob);
  R3.rangeRings = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.55, depthWrite: false, fog: false })); m.visible = false; m.renderOrder = 7; R3.scene.add(m); R3.rangeRings.push(m); }
  R3.markPool = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, depthWrite: false, fog: false })); m.visible = false; m.renderOrder = 7; R3.scene.add(m); R3.markPool.push({ m, t: 0 }); }
}
function marker(x, y, attack) { const k = R3.markPool.find(k => k.t <= 0) || R3.markPool[0]; k.t = 0.5; k.m.visible = true; k.m.material.color.set(attack ? 0xff4433 : 0x55ff77); k.m.position.set(x, heightAt(x, y) + 0.1, y); }
// ---------- unit instancing ----------
function unitIM(t, team) {
  const key = t + '|' + team; let u = R3.uiMesh.get(key); if (u) return u;
  const model = getModel('u', t, team); u = { model, parts: {}, cap: 0, n: 0 };
  growIM(u, 32); R3.uiMesh.set(key, u); return u;
}
function growIM(u, cap) {
  for (const k in u.model) { if (k === 'piv') continue; const old = u.parts[k]; if (old) { R3.scene.remove(old); old.dispose(); }
    const im = new THREE.InstancedMesh(u.model[k], pbrMaterial(), cap); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.count = 0; R3.scene.add(im); u.parts[k] = im; }
  u.cap = cap;
}
const _M = { a: null }; function m4() { return new THREE.Matrix4(); }
const TMP = typeof THREE !== 'undefined' ? { b: m4(), t: m4(), l: m4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), s: new THREE.Vector3(1, 1, 1), one: new THREE.Vector3(1, 1, 1) } : null;
// ---------- buildings ----------
const bkey = b => b.bal ? 'gtowerB' : b.t; // v7.0.2 a converted Great Wall tower wears the Ballista model
function makeBuildingObj(b) {
  const model = getModel('b', bkey(b), b.team), g = new THREE.Group(), mat = pbrMaterial();
  const body = new THREE.Mesh(model.body, mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const parts = {};
  for (const k in model) { if (k === 'piv' || k === 'body') continue; const m = new THREE.Mesh(model[k], mat); m.castShadow = true; const pv = model.piv[k] || [0, 0, 0]; m.position.set(pv[0], pv[1], pv[2]); body.add(m); parts[k] = m; }
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 1.5, b.h * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: R3.aoTex, transparent: true, depthWrite: false, fog: false })); ao.position.y = 0.03; ao.renderOrder = 1; g.add(ao);
  const sc = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.96, 1.4, b.h * 0.96), new THREE.MeshBasicMaterial({ color: 0xffc94d, wireframe: true, transparent: true, opacity: 0.55, fog: false })); sc.position.y = 0.7; sc.visible = false; g.add(sc);
  g.position.set(b.x, heightAt(b.x, b.y), b.y);
  R3.scene.add(g); clearFoliage(b);
  return { g, body, parts, sc, team: b.team, piv: model.piv, mk: bkey(b) };
}
// v7.3: construction sites are drawn by js/gfx/construct.js (makeSite / conAnim / conBurst)
function disposeObj(id) { const o = R3.objs.get(id); if (!o) return; if (o.cs) csDispose(o); R3.scene.remove(o.g); R3.objs.delete(id); }
// ---------- events -> fx / sound ----------
function barrelTip(s) { const pv = s.kind === 'b' ? getModel('b', bkey(s), s.team).piv : getModel('u', s.t, s.team).piv; const tip = pv.tip || 0.3; const rs = R3.rs.get(s.id);
  const x = rs ? rs.x : s.x, y = rs ? rs.y : s.y, base = s.kind === 'b' ? heightAt(s.x, s.y) + (pv.tipZ || (pv.head ? pv.head[1] + 0.08 : 0.6)) : (rs ? rs.z : heightAt(x, y)) + (pv.turret ? pv.turret[1] + 0.07 : UT[s.t].armor === 'inf' ? 0.38 : 0.3);
  return { x: x + Math.cos(s.tang) * tip, y: y + Math.sin(s.tang) * tip, z: base }; }
// v6.0 Grand Cannon firing: recoil kick, huge muzzle fireball, muzzle-brake side jets, vertical shockwave ring, ground dust ring, shake
function gcannonBlast(s, p) {
  const o = R3.objs.get(s.id); if (o) { o.rc = 1; o.smk = 2.6; }
  const c = Math.cos(s.tang), sn = Math.sin(s.tang), px = -sn, py = c, m = FX.mul;
  flash(p.x, p.y, p.z, 3.2, 1, 0.82, 0.5); flash(p.x + c * 0.8, p.y + sn * 0.8, p.z, 2.2, 1, 0.65, 0.3);
  for (let i = 0; i < 16 * m; i++) { const v = 2 + Math.random() * 5; FX.fire.spawn(p.x, p.y, p.z, c * v + rnd(1.2), sn * v + rnd(1.2), rnd(0.8) + 0.3, 0.25 + Math.random() * 0.2, 0.35, 0.9, 1, 0.6 + Math.random() * 0.3, 0.2, 1, 0); }
  for (const sd of [1, -1]) for (let i = 0; i < 6 * m; i++) { const v = 2.5 + Math.random() * 2.5; FX.fire.spawn(p.x - c * 0.25, p.y - sn * 0.25, p.z, px * sd * v + c * 0.6, py * sd * v + sn * 0.6, rnd(0.5), 0.2, 0.2, 0.55, 1, 0.7, 0.3, 1, 0); puff(p.x - c * 0.2 + px * sd * 0.5, p.y - sn * 0.2 + py * sd * 0.5, p.z, 0.45, 2.2, 0.62, 0.55, 0.3); }
  for (let i = 0; i < 12 * m; i++) puff(p.x + c * (0.4 + Math.random() * 2.2) + rnd(0.6), p.y + sn * (0.4 + Math.random() * 2.2) + rnd(0.6), p.z + rnd(0.3), 0.6, 2.8, 0.58, 0.55, 0.35);
  for (let i = 0; i < 18 * m; i++) { const a = Math.random() * 6.28, r = 1.3 + Math.random() * 0.9; puff(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, heightAt(s.x, s.y) + 0.15, 0.45, 2.2, G.desert ? 0.75 : 0.55, 0.45, 0.15); }
  if (typeof vring === 'function') vring(p.x, p.y, p.z, s.tang, 2.4); ring(p.x, p.y, 2.4); shake(0.28);
}
function handleEvents() {
  const zfl = (x, y, z, sz, r, g, b) => FX.spark.spawn(x, y, z, 0, 0, 0, 0.26, sz, sz * 1.2, r, g, b, 1, 0, 0);
  for (const ev of G.events) if (ev.e === 'zap' && inView(ev.pts[0].x, ev.pts[0].y)) { // v5.3: big jagged bolt (2 strands + glow core), relay arcs between chained coils
    const bolt = (a, b, sz, J, n) => { const L = Math.hypot(b.x - a.x, b.y - a.y), N = Math.max(6, Math.ceil(L * 5)); for (let s = 0; s < n; s++) { let px = a.x, py = a.y, pz = a.z; for (let k = 1; k <= N; k++) { const f = k / N, j = k < N ? J : 0, nx = a.x + (b.x - a.x) * f + rnd(j), ny = a.y + (b.y - a.y) * f + rnd(j), nz = a.z + (b.z - a.z) * f + Math.sin(f * 3.14) * 0.3 + rnd(j); zfl((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2, sz, 0.16, 0.36, 0.9); zfl(nx, ny, nz, sz * 0.8, 0.3, 0.5, 1); px = nx; py = ny; pz = nz; } } };
    const k = Math.min(1.8, 1 + 0.15 * ((ev.n || 1) - 1));
    if (ev.rp) for (const r of ev.rp) bolt(r.a, r.b, 0.1, 0.16, 1);
    for (let i = 1; i < ev.pts.length; i++) bolt(ev.pts[i - 1], ev.pts[i], (i === 1 ? 0.16 : 0.12) * k, 0.24, i === 1 ? 2 : 1);
    const h = ev.pts[1]; if (h) flash(h.x, h.y, h.z, 0.6 * k, 0.3, 0.55, 1); }
  { let n = 0; for (const ev of G.events) if (ev.e === 'fire' || ev.e === 'hit') n++; R3.busy = (R3.busy || 0) * 0.9 + n * 0.1; FX.mul = (R3.fxBase || 1) * Math.max(0.25, Math.min(1, 6 / Math.max(1, R3.busy))); }
  for (const ev of G.events) {
    switch (ev.e) {
      case 'fire': {
        const s = ev.src; if (!visibleTo0(s) || !inView(s.x, s.y)) { sfx(ev.w.snd, s.x, s.y); break; }
        const p = barrelTip(s), w = ev.w.type, big = w === 'cannon' || w === 'shell'; if (s.kind === 'b' && s.t === 'gcannon') gcannonBlast(s, p);
        else if (w === 'bolt') { const o = R3.objs.get(s.id); if (o) { o.bk = 1; o.bfT = G.time; } flash(p.x, p.y, p.z, 0.5, 1, 0.9, 0.7); for (let i = 0; i < 5 * FX.mul; i++) puff(p.x - Math.cos(s.tang) * 0.6 + rnd(0.3), p.y - Math.sin(s.tang) * 0.6 + rnd(0.3), p.z, 0.2, 0.9, 0.62, 0.55, 0.45); shake(0.05); } // v7.0.2 Ballista release: string snap + dust else if (ev.w.big) { flash(p.x, p.y, p.z, 2.0, 1, 0.8, 0.5); for (let i = 0; i < 10 * FX.mul; i++) puff(p.x + rnd(0.5), p.y + rnd(0.5), p.z, 0.5, 2.0, 0.6, 0.55, 0.5); shake(0.15); }
        flash(p.x, p.y, p.z, big ? 0.9 : w === 'bullet' ? 0.35 : 0.55, 1, 0.8, 0.45);
        { const r0 = R3.rs.get(s.id); if (r0 && s.kind === 'u' && UT[s.t] && (UT[s.t].armor === 'inf' || UT[s.t].mech)) r0.kick = 1; }
        if (big) { for (let i = 0; i < 4 * FX.mul; i++) puff(p.x + Math.cos(s.tang) * 0.2, p.y + Math.sin(s.tang) * 0.2, p.z, 0.25, 1.1, 0.55, 0.45, 0.3); const rs = R3.rs.get(s.id); if (rs) rs.recoil = 0.09; }
        if (w === 'gat') { // v5.9 gatling: bright flash, ejected brass casings, faint gun smoke
          flash(p.x, p.y, p.z, 0.5, 1, 0.85, 0.4); const sx = -Math.sin(s.tang), sy = Math.cos(s.tang);
          for (let i = 0; i < 2 * FX.mul; i++) FX.spark.spawn(p.x - Math.cos(s.tang) * 0.45, p.y - Math.sin(s.tang) * 0.45, p.z, sx * (1.2 + Math.random()) + rnd(0.4), sy * (1.2 + Math.random()) + rnd(0.4), 1.2 + Math.random(), 0.7, 0.045, 0.04, 1, 0.75, 0.3, 1, 9, 0);
          if (Math.random() < 0.25 * FX.mul) puff(p.x, p.y, p.z, 0.18, 0.7, 0.6, 0.3, 0.3); }
        if (w === 'rocket') puff(p.x - Math.cos(s.tang) * 0.4, p.y - Math.sin(s.tang) * 0.4, p.z, 0.3, 0.8, 0.6, 0.5, 0.2);
        sfx(ev.w.snd, s.x, s.y); break;
      }
      case 'hit': {
        if (G.opts.fog && !vis0(idx(Math.floor(ev.x), Math.floor(ev.y)))) break;
        const z = (ev.z || 0) + (ev.z > 1.5 ? heightAt(ev.x, ev.y) * 0.3 : heightAt(ev.x, ev.y));
        if (ev.kind === 'bullet' || ev.kind === 'gat') { sparks(ev.x, ev.y, z + 0.2, 2, 2); flash(ev.x, ev.y, z + 0.25, 0.18, 1, 0.8, 0.5); }
        else if (ev.kind === 'bolt') { // v7.0.2 Ballista bolt: armour-cracking impact - spray of sparks, iron flash, debris + dust ring, short shake, heavy thunk
          sparks(ev.x, ev.y, z + 0.3, 14, 5); flash(ev.x, ev.y, z + 0.4, 1.3, 1, 0.85, 0.55); flash(ev.x, ev.y, z + 0.3, 0.7, 1, 1, 1);
          { const gz = heightAt(ev.x, ev.y), dc = G.desert ? [0.78, 0.64, 0.46] : [0.5, 0.45, 0.38]; for (let i = 0; i < 12 * FX.mul; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 2; puff(ev.x + Math.cos(a) * 0.3, ev.y + Math.sin(a) * 0.3, gz + 0.1, 0.25, 0.9 + Math.random() * 0.5, dc[0], dc[1], dc[2]); FX.spark.spawn(ev.x, ev.y, z + 0.3, Math.cos(a) * v, Math.sin(a) * v, 2 + Math.random() * 2, 0.9, 0.06, 0.05, 0.35, 0.3, 0.28, 1, 9, 0); } }
          sfx('boltHit', ev.x, ev.y); shake(0.1); }
        else if (ev.kind === 'snipe') { sparks(ev.x, ev.y, z + 0.2, 3, 2.5); flash(ev.x, ev.y, z + 0.25, 0.3, 1, 0.9, 0.7); }
        else if (ev.kind === 'fire') { for (let i = 0; i < 6 * FX.mul; i++) FX.fire.spawn(ev.x + rnd(0.8), ev.y + rnd(0.8), z + 0.15, rnd(0.5), rnd(0.5), 0.8, 0.5, 0.2, 0.6, 1, 0.45, 0.1, 0.9, -1); if (Math.random() < 0.3) puff(ev.x, ev.y, z + 0.4, 0.25, 1.4, 0.12, 0.5, 0.8); }
        else if (ev.kind === 'aam') { explosion3(ev.x, ev.y, z, 0.45); sfx('boom', ev.x, ev.y); }
        else if (ev.kind === 'mega') { explosion3(ev.x, ev.y, z, 2.4); explosion3(ev.x + 0.6, ev.y - 0.4, z, 1.2); for (let i = 0; i < 8 * FX.mul; i++) puff(ev.x + rnd(1.6), ev.y + rnd(1.6), z + 0.3, 0.6, 2.4, 0.2, 0.18, 0.16); flash(ev.x, ev.y, z + 0.6, 2.2, 1, 0.75, 0.4); sfx('boomBig', ev.x, ev.y); shake(0.35); { const gz = heightAt(ev.x, ev.y), dc = G.desert ? [0.78, 0.64, 0.46] : [0.5, 0.45, 0.38]; for (let i = 0; i < 22 * FX.mul; i++) { const a = Math.random() * 6.28, v = 2.2 + Math.random() * 2.5; FX.smoke.spawn(ev.x + Math.cos(a) * 0.6, ev.y + Math.sin(a) * 0.6, gz + 0.12, Math.cos(a) * v, Math.sin(a) * v, 0.15 + Math.random() * 0.3, 1.6 + Math.random(), 0.35, 1.5, dc[0], dc[1], dc[2], 0.5, 0); } for (let i = 0; i < 10 * FX.mul; i++) FX.spark.spawn(ev.x, ev.y, gz + 0.2, rnd(6), rnd(6), 3 + Math.random() * 4, 0.9, 0.06, 0.04, 0.5, 0.42, 0.32, 1, 9, 0); ring(ev.x, ev.y, 4.2); } }
        else if (ev.kind === 'bomb') { explosion3(ev.x, ev.y, z, 1.4); sfx('boomBig', ev.x, ev.y); shake(0.12); }
        else if (ev.kind === 'flak') { flash(ev.x, ev.y, z, 0.7, 1, 0.75, 0.4); puff(ev.x, ev.y, z, 0.35, 1.2, 0.18, 0.7, 0.1); sparks(ev.x, ev.y, z, 3, 3); }
        else { explosion3(ev.x, ev.y, z, ev.kind === 'shell' ? 1.1 : 0.55); sfx(ev.kind === 'shell' ? 'boomBig' : 'boom', ev.x, ev.y); }
        break;
      }
      case 'die': {
        const e = ev.ent; const seen = !G.opts.fog || visibleTo0(e);
        if (e.sold || !seen) { disposeObj(e.id); R3.rs.delete(e.id); break; }
        const rs = R3.rs.get(e.id), z = rs ? rs.z : heightAt(e.x, e.y);
        if (e.kind === 'u' && UT[e.t] && (UT[e.t].armor === 'inf' || UT[e.t].mech) && !UT[e.t].boss && rs) { R3.corpses.push({ t: e.t, team: e.team, rs: Object.assign({}, rs, { aim: 0, spd: 0, dead: 0, fallDir: Math.random() < 0.6 ? 1 : -1 }), t0: R3.time }); if (R3.corpses.length > 60) R3.corpses.shift(); }
        if (e.kind === 'b') { const n = Math.max(3, e.w * e.h); for (let i = 0; i < n; i++) setTimeout(() => explosion3(e.tx + Math.random() * e.w, e.ty + Math.random() * e.h, heightAt(e.x, e.y) + 0.4 + Math.random(), 1.1 + Math.random() * 0.7), i * 120);
          debris(e.x, e.y, 1, 16, 0, true); scorch3(e.x, e.y, e.w * 1.8); sfx('boomBig', e.x, e.y); shake(0.5); }
        else if (UT[e.t].armor === 'inf') { puff(e.x, e.y, z + 0.2, 0.3, 1, 0.4, 0.5, 0.3); sfx('die', e.x, e.y); }
        else { explosion3(e.x, e.y, z + 0.2, UT[e.t].air ? 1.0 : 1.3); debris(e.x, e.y, z + 0.3, 8, 0, true); sfx('boomBig', e.x, e.y); shake(0.18); }
        disposeObj(e.id); R3.rs.delete(e.id); break;
      }
      case 'place': for (let i = 0; i < 16 * FX.mul; i++) { const a = i / 16 * Math.PI * 2; FX.smoke.spawn(ev.b.x + Math.cos(a) * ev.b.w * 0.5, ev.b.y + Math.sin(a) * ev.b.h * 0.5, 0.2, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.3, 1.6, 0.4, 1.4, 0.55, 0.5, 0.42, 0.55, 0); }
        if (ev.b.team === ME) sfx('place'); break;
      case 'heal': if (visibleTo0(ev.src) && inView(ev.x, ev.y)) for (let i = 0; i < 3; i++) FX.spark.spawn(ev.x + rnd(0.3), ev.y + rnd(0.3), heightAt(ev.x, ev.y) + 0.3, 0, 0, 0.8, 0.6, 0.09, 0.03, 0.3, 1, 0.45, 1, 0); break;
      case 'walls': if (ev.team === ME) sfx('place'); break;
      case 'ready': if (ev.team === ME && BT[ev.t].cat === 'def' && !UI.placing && !UI.mode) UI.placing = ev.t;
        if (ev.team === ME) { sfx('ready'); uiMsg(BT[ev.t].n + ' ready to place'); } break;
      case 'unit': if (ev.team === ME) { sfx('unit'); if (ev.u && FACTIONS[G.players[ME].fac].sp === ev.u.t) announce(UT[ev.u.t].n + ' ready for battle', 'spu', 5); } break;
      case 'upgraded': if (ev.team === ME) { sfx('ready'); uiMsg(ev.b.upKind === 'sm3' ? '🛡 SM-3 Interceptor Battery online at the ' + BT[ev.b.t].n : ev.b.upKind === 'rs' ? `🔬 Research complete: ${RES.nm[ev.b.upCat]} level ${rsLvl(ev.team, ev.b.upCat)} (+${Math.round((RES_M[rsLvl(ev.team, ev.b.upCat)] - 1) * 100)}% damage & HP)` : ev.b.upKind === 'pads' ? '✈ Air Command: 8 dock slots' : ev.b.upKind === 'bal' ? '🏹 Ballista Tower ready: giant armour-piercing bolts' : BT[ev.b.t].n + ' upgraded to level ' + ev.b.lvl); } flash(ev.b.x, ev.b.y, 1, 1.5, 0.6, 0.9, 1); break;
      case 'capture': if (ev.team === ME || ev.b.team === ME) { sfx('ready'); uiMsg('Structure captured!'); } disposeObj(ev.b.id); break;
      case 'engCC': if (typeof uiMsg === 'function' && ev.team === ME) uiMsg('Engineer founded a new Command Center'); break;
      case 'derrick': if (typeof uiMsg === 'function') { const op = G.derricks.find(d => d.op && d.x === ev.x && d.y === ev.y); if (op && ev.team === ME) uiMsg('Outpost "' + op.name + '" captured! You can now BUILD within ' + OUTPOST_R + ' tiles — perfect spot for a Grand Cannon.'); else if (op && ev.prev === ME) uiMsg('We lost the outpost "' + op.name + '"!'); if (ev.team === ME) { if (!op) uiMsg('Oil derrick captured! +income'); announce('Derrick captured', 'dk', 3); } else if (ev.prev === ME) { uiMsg('We lost an oil derrick!'); UI.alerts.unshift({ txt: 'Derrick lost', x: ev.x, y: ev.y, t: 8 }); announce('Derrick lost', 'dkl', 3); } else if (foe(ev.team, ME)) uiMsg('Enemy captured an oil derrick'); } break;
      case 'launch': { const mine = ev.team === ME, ally = !foe(ev.team, ME); R3.misT = R3.misT || []; R3.misT.push({ ms: ev.ms, t0: R3.time });
        if (ev.big || !ally) { uiMsg(mine ? MIS[ev.k].n + ' launched!' : ally ? 'Allied ' + MIS[ev.k].n + ' launched' : '⚠ ENEMY ' + MIS[ev.k].n.toUpperCase() + ' LAUNCH DETECTED!'); if (!ally) { UI.alerts.unshift({ txt: 'Missile incoming', x: ev.x, y: ev.y, t: ev.T + 2 }); announce(ev.big ? 'Warning: warhead launch detected' : 'Missile launch detected', 'ml', 3); sfx('alert'); } }
        if (mine) sfx('ready'); if (inView(ev.ms.x0, ev.ms.y0)) { const z = heightAt(ev.ms.x0, ev.ms.y0); for (let i = 0; i < 14; i++) puff(ev.ms.x0 + rnd(0.6), ev.ms.y0 + rnd(0.6), z + 0.3, 0.5, 1.6, 0.6, 0.55, 0.5); flash(ev.ms.x0, ev.ms.y0, z + 0.6, 1.4, 1, 0.7, 0.3); } break; }
      case 'impact': { const z = heightAt(ev.x, ev.y); explosion3(ev.x, ev.y, z + 0.2, ev.big ? 3.2 : ev.k === 'cluster' ? 1.4 : 2); if (ev.big) { for (let i = 0; i < 10; i++) setTimeout(() => explosion3(ev.x + rnd(ev.r * 0.7), ev.y + rnd(ev.r * 0.7), z + 0.3, 1.6), i * 70); shake(1.2); } else shake(0.4); scorch3(ev.x, ev.y, ev.r * 1.6); sfx('boomBig', ev.x, ev.y); break; }
      case 'intercept': if (ev.sm3) sm3Streak(ev.bx, ev.by, ev.x, ev.y, 6, 2.4); else flash(ev.x, ev.y, 6, 2, 1, 0.8, 0.4); if (ev.team === ME || ev.ms.team === ME) uiMsg(ev.team === ME ? (ev.sm3 ? '🛡 SM-3 shot down an incoming ' + MIS[ev.ms.k].n + '!' : 'Missile intercepted by Flak!') : 'Our missile was intercepted'); break;
      case 'siege': if (inView(ev.u.x, ev.u.y)) { for (let k = 0; k < 4; k++) puff(ev.u.x + Math.cos(k * 1.57 + 0.78) * 0.45, ev.u.y + Math.sin(k * 1.57 + 0.78) * 0.45, heightAt(ev.u.x, ev.u.y) + 0.05, 0.22, 1.1, 0.55, 0.6, 0.2); if (ev.u.team === ME) sfx(ev.on ? 'ready' : 'click'); } break;
      case 'icpt': if (inView(ev.x, ev.y) || inView(ev.bx, ev.by)) sm3Streak(ev.bx, ev.by, ev.x, ev.y, Math.max(0.8, ev.z || 1), ev.big ? 1.4 : 0.8); break;
      case 'misReady': if (ev.team === ME) { sfx('ready'); uiMsg(MIS[ev.k].n + ' ready to launch (select the Warhead Launcher)'); announce('Missile ready', 'mr', 4); } break;
      case 'attacked': if (ev.team === ME && typeof uiAlert === 'function') { uiAlert(ev); announce(ev.harv ? 'Harvester under attack' : 'Base under attack', 'atk' + !!ev.harv, 25); } else if (!foe(ev.team, ME) && ev.team !== ME) { announce('Ally under attack', 'ally', 30); UI.pings.push({ x: ev.x, y: ev.y, t: 3 }); } break;
      case 'built': { const b = ev.b, wl = b.t === 'wall' || b.t === 'gate' || b.t === 'gtower'; conBurst(b); // v7.3 completion flash + dust burst + chime
        if (ev.team === ME && !wl) { if (!inView(b.x, b.y)) sfx('ready'); uiMsg('🏗 ' + BT[b.t].n + ' complete'); } } // v7.2 construction finished (announcements moved from placement)
        if (ev.b.t === 'cc') { if (ev.team === ME) announce('Expansion established', 'cc', 3); else if (!foe(ev.team, ME)) announce('Ally expanding', 'acc', 20); } else if (ev.team === ME && FACTIONS[G.players[ME].fac].sp === ev.b.t) announce(BT[ev.b.t].n + ' deployed', 'sp', 5); break;
      case 'eliminated': announce(ev.team === ME ? 'You have been eliminated' : G.players[ev.team].name + (foe(ev.team, ME) ? ' (enemy)' : ' (ally)') + ' eliminated', 'el' + ev.team, 1); break;
      case 'popcap': if (ev.team === ME) uiMsg('Unit cap reached (' + POP_CAP + ')'); break;
      // v7.0 Endless + new faction specials
      case 'wave': announce(ev.boss ? `☠ WAVE ${ev.n} — BOSS INCOMING` : `Wave ${ev.n} — ${ev.count} hostiles`, 'wave', 0.5); sfx('alert'); if (ev.boss) shake(0.35); break;
      case 'boss': { const u = ev.u; UI.pings.push({ x: u.x, y: u.y, t: 3 }); UI.alerts.unshift({ txt: 'Colossus sighted', x: u.x, y: u.y, t: 10 }); UI.alerts.length = Math.min(UI.alerts.length, 2); uiMsg('☠ A Horde COLOSSUS is marching on the passes!'); break; }
      case 'bossDown': announce('Colossus destroyed!', 'bd', 1); shake(0.6); explosion3(ev.x, ev.y, heightAt(ev.x, ev.y) + 0.5, 3); break;
      case 'waveClear': { const r = ev.reward; announce(r ? (r.kind === 'elite' ? `Boss wave ${ev.n} cleared clean — ELITE unit earned!` : `Boss wave ${ev.n} cleared — +$${r.cr} bonus`) : `Wave ${ev.n} cleared  +$${ev.pay}`, 'wc', 0.5); sfx('ready'); break; }
      case 'elite': if (ev.team === ME) uiMsg('★ Elite ' + UT[ev.u.t].n + ' has joined your base'); break;
      case 'skip': announce(ev.bonus ? `Break skipped  +$${ev.bonus}` : 'Break skipped', 'sk', 0.5); break;
      case 'kami': if (inView(ev.x, ev.y)) { const z = heightAt(ev.x, ev.y); flash(ev.x, ev.y, z + 0.6, 1.6, 1, 0.55, 0.2); for (let i = 0; i < 6 * FX.mul; i++) puff(ev.x + rnd(1), ev.y + rnd(1), z + 0.3, 0.4, 1.8, 0.25, 0.2, 0.18); sfx('boomBig', ev.x, ev.y); shake(0.15); } break;
      case 'xform': { const u = ev.u; if (inView(u.x, u.y) && (!G.opts.fog || visibleTo0(u))) { const z = heightAt(u.x, u.y) + (ev.air ? 0.5 : 1.2); flash(u.x, u.y, z, 1.4, 0.55, 0.75, 1); sparks(u.x, u.y, z, 14, 3); for (let i = 0; i < 6; i++) puff(u.x + rnd(0.6), u.y + rnd(0.6), z - 0.4, 0.3, 1.1, 0.7, 0.75, 0.8); }
        if (u.team === ME) sfx('ready', u.x, u.y); break; }
      case 'allyAck': if (foe(ev.team, ME) || ev.team === ME) break; announce(G.players[ev.team].name + ': on my way', 'ack', 4); UI.pings.push({ x: ev.x, y: ev.y, t: 3 }); break;
    }
  }
  G.events.length = 0;
}
function shake(a) { R3.shake = Math.max(R3.shake || 0, a); }
// v6.2 SM-3 intercept: a bright interceptor streak climbs from the battery to the threat, then a white-blue burst
function sm3Streak(bx, by, x, y, z, s) { const h0 = heightAt(bx, by) + 1.4, n = 12; for (let i = 1; i <= n; i++) { const f = i / n, px = bx + (x - bx) * f, py = by + (y - by) * f, pz = h0 + (z - h0) * f + Math.sin(f * Math.PI) * 1.2;
    FX.spark.spawn(px, py, pz, 0, 0, 0, 0.35 + 0.25 * f, 0.3 + 0.12 * f, 0.08, 0.55, 0.9, 1, 1, 0, 0); if (i % 2 === 0) puff(px, py, pz, 0.3, 1.1, 0.95, 0.5, 0.1); }
  FX.spark.spawn(x, y, z, 0, 0, 0, 0.5, s * 1.4, s * 2.2, 0.6, 0.9, 1, 1, 0, 0); flash(x, y, z, s * 0.7, 1, 1, 1); sparks(x, y, z, 16, 3); if (typeof sfx === 'function') sfx('flak', x, y); }
// v6.3 Seraph Medevac: green heal beams (tapered additive cones from the craft belly down to each target) + rising green motes
const BV1 = typeof THREE !== "undefined" ? new THREE.Vector3() : null, BV2 = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
function medBeams(dt) {
  if (!R3.beamPool) { R3.beamPool = []; R3.beamGeo = new THREE.CylinderGeometry(0.05, 0.22, 1, 10, 1, true).translate(0, -0.5, 0); }
  let n = 0; const pulse = 0.55 + 0.25 * Math.sin(R3.time * 9);
  for (const e of G.ents) { if (e.t !== 'medevac' || !e.beams || !e.beams.length || e.dead) continue; if (G.opts.fog && !visibleTo0(e)) continue;
    const a = R3.rs.get(e.id); if (!a || !inView(a.x, a.y)) continue;
    for (const id of e.beams) { const o = byId(id); const b = o && R3.rs.get(id); if (!b || o.hp <= 0) continue;
      let m = R3.beamPool[n]; if (!m) { m = new THREE.Mesh(R3.beamGeo, new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.frustumCulled = false; R3.scene.add(m); R3.beamPool.push(m); }
      n++; const y0 = a.z - 0.15, y1 = b.z + 0.35, dx = b.x - a.x, dz = b.y - a.y, dy = y1 - y0, L = Math.hypot(dx, dy, dz) || 0.01;
      m.visible = true; m.position.set(a.x, y0, a.y); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(BV1.set(0, -1, 0), BV2.set(dx / L, dy / L, dz / L)); m.material.opacity = pulse;
      if (Math.random() < dt * 10 * FX.mul) { const f = Math.random(); FX.spark.spawn(a.x + dx * f, a.y + dz * f, y0 + dy * f, 0, 0, 0.4, 0.5, 0.14, 0.04, 0.4, 1, 0.55, 1, 0); }
      if (Math.random() < dt * 6 * FX.mul) FX.spark.spawn(b.x + (Math.random() - 0.5) * 0.5, b.y + (Math.random() - 0.5) * 0.5, b.z + 0.1, 0, 0, 0.9, 0.7, 0.16, 0.05, 0.45, 1, 0.6, 1, 0); } }
  for (let i = n; i < R3.beamPool.length; i++) R3.beamPool[i].visible = false;
}
function inView(x, y) { const v = R3.view; return x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1; }
// ---------- per-frame ----------
function r3Render(dt) {
  missilesUpdate(dt); teslaArcs(dt); csFrameStart();
  medBeams(dt); lavaFX(dt);
  wallsUpdate(); offlineIcons(dt); lowPowerAlert(); derricksUpdate(dt); dayNight(dt);
  R3.time += dt; R3.uTime.value = R3.time; R3.renderer.info.reset();
  updCamera(dt); updView(); if (!R3.anisoDone && R3.time > 0.5) { R3.anisoDone = true; applyAniso(); }
  handleEvents();
  const k = 1 - Math.exp(-dt * 16);
  for (const u of R3.uiMesh.values()) u.n = 0;
  let nSel = 0, nEn = 0, nHov = 0, nBlob = 0, nRange = 0; const T = TMP;
  const alive = new Set();
  for (const e of G.ents) {
    alive.add(e.id);
    const vis = !G.opts.fog || visibleTo0(e);
    if (e.kind === 'b') {
      let o = R3.objs.get(e.id); if (o && (o.team !== e.team || o.mk !== bkey(e))) { disposeObj(e.id); o = null; }
      if (!o) { o = makeBuildingObj(e); R3.objs.set(e.id, o); }
      const show = vis && inView(e.x, e.y); o.g.visible = show; if (!show) { if (o.cs && !e.con) csDispose(o); continue; }
      const age = G.time - e.born, cons = e.con || e.fromCon ? 1 : Math.min(1, age / 1.5), ease = 1 - Math.pow(1 - cons, 3);
      let sy = e.con || o.cs ? 1 : 0.02 + 0.98 * ease; if (e.sell >= 0) sy = Math.max(0.02, 1 - (G.time - e.sell) / 1.2);
      o.body.scale.y = sy; o.sc.visible = !e.con && (cons < 1 || e.sell >= 0);
      if (e.con || o.cs) conAnim(e, o, dt); // v7.3 staged construction site (render only)
      if (o.parts.spin) o.parts.spin.rotation.y += dt * 1.4; if (o.parts.head) o.parts.head.rotation.y = -e.tang;
      if (o.parts.arrow) { // v7.0.2 Ballista: whole crossbow kicks back on release, the loaded bolt vanishes and is re-wound ~1.8 s later
        o.bk = Math.max(0, (o.bk || 0) - dt * 4); const c = Math.cos(e.tang), sn = Math.sin(e.tang), pv = o.piv.head, kb = o.bk * 0.1;
        o.parts.head.position.set(pv[0] - c * kb, pv[1], pv[2] - sn * kb); const a = o.parts.arrow; a.rotation.y = -e.tang; a.position.copy(o.parts.head.position); a.visible = G.time - (o.bfT == null ? -9 : o.bfT) > 1.8; }
      if (o.parts.gat) { // v5.9 gatling spin-up / spin-down; barrel cluster yaws with the head and rolls about its own axis
        const firing = e.tgt && e.tgt.hp > 0 && G.time - (e.lastFire || -9) < 0.5 && !e.offline; o.gv = (o.gv || 0) + ((firing ? 34 : 0) - (o.gv || 0)) * Math.min(1, dt * (firing ? 2.2 : 0.9)); o.gr = ((o.gr || 0) + o.gv * dt) % 628;
        const g = o.parts.gat, hp = o.parts.head.position; g.rotation.order = 'YXZ'; g.rotation.set(o.gr, -e.tang, 0); g.position.set(hp.x + Math.cos(e.tang) * 0.2, 0.66, hp.z + Math.sin(e.tang) * 0.2); }
      if (o.parts.gun) { // v6.0 Grand Cannon: barrel yaws with the turret, slams back on firing then runs out again; muzzle smoke lingers
        o.rc = Math.max(0, (o.rc || 0) - dt * 1.5); const k = o.rc > 0.85 ? (1 - o.rc) / 0.15 : o.rc / 0.85, back = 0.5 * Math.min(1, k) * (o.rc > 0.85 ? 1 : o.rc / 0.85 * 1.0), c = Math.cos(e.tang), sn = Math.sin(e.tang), g = o.parts.gun, pv = o.piv.gun;
        g.rotation.y = -e.tang; g.position.set(pv[0] - c * back * 0.9, pv[1], pv[2] - sn * back * 0.9); if (o.parts.head) o.parts.head.position.set(o.piv.head[0] - c * back * 0.12, o.piv.head[1], o.piv.head[2] - sn * back * 0.12);
        if (o.smk > 0) { o.smk -= dt; if (Math.random() < dt * 10 * FX.mul) { const p = barrelTip(e); puff(p.x, p.y, p.z, 0.16, 1.4, 0.55, 0.35, 0.5); } } }
      if ((e.lvl || 1) !== (o.lvl || 1)) setLevelDecor(o, e);
      if (e.upT != null && Math.random() < dt * 12) FX.spark.spawn(e.x + rnd(e.w), e.y + rnd(e.h), 0.5 + Math.random() * 0.6, rnd(1), rnd(1), 1.5, 0.5, 0.12, 0.04, 0.5, 0.9, 1, 1, 3);
      o.sc.visible = o.sc.visible || e.upT != null;
      if ((e.sel || e.id === R3.hoverId) && BT[e.t].wpn && nRange < 6) { const rg = R3.rangeRings[nRange++], r = defW(e).rng; rg.visible = true; rg.scale.set(r, 1, r); rg.position.set(e.x, heightAt(e.x, e.y) + 0.15, e.y); rg.material.color.set(e.team === ME ? 0xffd060 : 0xff6050); }
      if (o.parts.glow) o.parts.glow.visible = Math.sin(R3.time * 4 + e.id) > -0.3;
      if (typeof glbSync === 'function') glbSync(o, e); // blender-trial: .glb building models (visual only)
      if (o.piv.smoke && Math.random() < dt * 4 * FX.mul) puff(e.x + o.piv.smoke[0], e.y + o.piv.smoke[2], o.piv.smoke[1] + heightAt(e.x, e.y), 0.2, 2.5, 0.45, 0.35, 0.8);
      const f = e.hp / e.mhp;
      if (f < 0.5 && Math.random() < dt * (f < 0.25 ? 14 : 6) * FX.mul) puff(e.tx + Math.random() * e.w, e.ty + Math.random() * e.h, 0.9, 0.35, 2.4, 0.09, 0.75, 1.0);
      if (f < 0.3 && Math.random() < dt * 14 * FX.mul) FX.fire.spawn(e.tx + Math.random() * e.w, e.ty + Math.random() * e.h, 0.7, 0, 0, 1.0, 0.6, 0.3, 0.6, 1, 0.5, 0.15, 0.9, -1);
      if (e.repair && Math.random() < dt * 6) FX.spark.spawn(e.x + rnd(e.w * 0.6), e.y + rnd(e.h * 0.6), 1.2, 0, 0, 1, 0.6, 0.15, 0.08, 0.3, 1, 0.4, 1, 0);
      if (e.sel || e.id === R3.hoverId) { const im = e.sel ? (e.team === ME ? R3.ringSel : R3.ringEnemy) : R3.ringHover; const i = e.sel ? (e.team === ME ? nSel++ : nEn++) : nHov++; if (i < im.instanceMatrix.count) im.setMatrixAt(i, T.l.compose(T.p.set(e.x, heightAt(e.x, e.y) + 0.2, e.y), T.q.identity(), T.s.set(e.w * 0.78, 1, e.h * 0.78))); }
      continue;
    }
    // units
    let rs = R3.rs.get(e.id);
    if (!rs) { rs = { x: e.x, y: e.y, z: 0, ang: e.ang, tang: e.tang, recoil: 0, spin: 0 }; R3.rs.set(e.id, rs); }
    const d = UT[e.t], air = !!d.air, tz = heightAt(e.x, e.y) * (air ? 0.3 : 1) + e.z;
    if (Math.hypot(rs.x - e.x, rs.y - e.y) > 2) { rs.x = e.x; rs.y = e.y; rs.z = tz; } else { rs.x += (e.x - rs.x) * k; rs.y += (e.y - rs.y) * k; rs.z += (tz - rs.z) * k; }
    rs.ang += angDiff(rs.ang, e.ang) * k; rs.tang += angDiff(rs.tang, e.tang) * Math.min(1, k * 1.5);
    rs.recoil = Math.max(0, rs.recoil - dt * 0.35); rs.spin += dt * (e.t === 'gunship' || e.t === 'medevac' ? 28 : e.t === 'harv' ? (e.hst === 'mine' ? 8 : 0) : 3);
    if (!vis || !inView(rs.x, rs.y)) continue;
    const U = unitIM(e.t, e.team); if (U.n >= U.cap) growIM(U, U.cap * 2);
    const i = U.n++, pv = U.model.piv;
    const moving = e.path.length > 0, bob = 0;
    rs.bank = (rs.bank || 0) * 0.9 + angDiff(rs.pang == null ? rs.ang : rs.pang, rs.ang) * (d.jet ? 9 : 0); rs.pang = rs.ang;
    T.e.set(d.jet ? -Math.max(-0.7, Math.min(0.7, rs.bank)) : 0, -(d.armor === 'inf' ? rs.tang : rs.ang), air && !d.jet ? (moving ? -0.18 : 0) : 0, 'YXZ'); T.q.setFromEuler(T.e);
    const vs = (d.vs || 1) * (e.elite ? 1.18 : 1) * (d.vs ? 1 : (d.armor === 'inf' ? 1 : d.mech ? 0.85 : d.jet ? 1.1 : air ? 0.9 : e.t === 'harv' ? 0.62 : 0.8)); // v7.0 d.vs (boss) + elite scale; v6.2 smaller Ore Hauler
    if (pv.legs) {
      animGait(rs, e, d, dt, pv.legs);
      const sq = pv.squad || 1;
      for (let m = 0; m < sq; m++) {
        const ii = m === 0 ? i : U.n++; if (ii >= U.cap) { growIM(U, U.cap * 2); }
        const ox = sq > 1 ? [0.18, -0.2, -0.2][m] : 0, oz = sq > 1 ? [0, 0.24, -0.24][m] : 0;
        T.b.compose(T.p.set(rs.x, rs.z, rs.y), T.q, T.s.set(vs, vs, vs)); if (sq > 1) T.b.multiply(T.l.makeTranslation(ox, 0, oz));
        poseRig(U, ii, T.b, rs, pv.legs, m * 1.7, 0);
      }
    } else {
    T.b.compose(T.p.set(rs.x, rs.z + bob, rs.y), T.q, T.s.set(vs, vs, vs));
    U.parts.body.setMatrixAt(i, T.b);
    }
    const sgk = !e.sg ? 0 : e.sg === 2 ? 1 : e.sg === 1 ? Math.min(1, (G.time - e.sgT) / SIEGE.dep) : Math.max(0, 1 - (G.time - e.sgT) / SIEGE.pack); // v6.2 Howler siege deploy
    if (U.parts.spade) { const k = Math.max(0.001, sgk); T.l.compose(T.p.set(pv.spade[0], pv.spade[1], pv.spade[2]), T.q.identity(), T.s.set(k, 1, k)); U.parts.spade.setMatrixAt(i, T.t.multiplyMatrices(T.b, T.l)); }
    if (U.parts.turret) { T.e.set(0, -(rs.tang - rs.ang), sgk * 0.32); T.q.setFromEuler(T.e); T.l.compose(T.p.set(pv.turret[0] - rs.recoil, pv.turret[1] + sgk * 0.05, pv.turret[2]), T.q, T.one); U.parts.turret.setMatrixAt(i, T.t.multiplyMatrices(T.b, T.l)); }
    if (U.parts.rotor) { if (e.t === 'harv') T.e.set(0, 0, -rs.spin); else T.e.set(0, rs.spin, 0); T.q.setFromEuler(T.e); T.l.compose(T.p.set(pv.rotor[0], pv.rotor[1], pv.rotor[2]), T.q, T.one); U.parts.rotor.setMatrixAt(i, T.t.multiplyMatrices(T.b, T.l)); }
    if (U.parts.load) { const lf = e.load / HARV_CAP; T.l.compose(T.p.set(pv.load[0], pv.load[1], pv.load[2]), T.q.identity(), T.s.set(1, Math.max(0.001, lf), 1)); U.parts.load.setMatrixAt(i, T.t.multiplyMatrices(T.b, T.l)); }
    // contact shadow + rings
    const gz = heightAt(rs.x, rs.y), rr = d.r * (air ? 2.2 : 3.2);
    if (nBlob < 800) R3.blob.setMatrixAt(nBlob++, T.l.compose(T.p.set(rs.x, gz + 0.04, rs.y), T.q.identity(), T.s.set(rr, 1, rr)));
    if (e.sel || e.id === R3.hoverId) { const im = e.sel ? (e.team === ME ? R3.ringSel : R3.ringEnemy) : R3.ringHover; const j = e.sel ? (e.team === ME ? nSel++ : nEn++) : nHov++; const s = d.r * 1.15 + 0.1; if (j < im.instanceMatrix.count) im.setMatrixAt(j, T.l.compose(T.p.set(rs.x, gz + 0.06, rs.y), T.q.identity(), T.s.set(s, 1, s))); }
    // ambient unit fx
    if (e.t === 'harv' && e.hst === 'mine' && Math.random() < dt * 10 * FX.mul) FX.smoke.spawn(rs.x + Math.cos(rs.ang) * 0.7, rs.y + Math.sin(rs.ang) * 0.7, gz + 0.2, rnd(0.5), rnd(0.5), 0.5, 1.2, 0.2, 0.6, 0.55, 0.45, 0.28, 0.5, 0);
    if (d.jet && e.js !== 'landed' && Math.random() < dt * 25 * FX.mul) FX.smoke.spawn(rs.x - Math.cos(rs.ang) * 0.8, rs.y - Math.sin(rs.ang) * 0.8, rs.z, 0, 0, 0, 0.6, 0.05, 0.12, 0.85, 0.85, 0.85, 0.35, 0);
    if (!air && d.armor !== 'inf' && moving && Math.random() < dt * 8 * FX.mul) FX.smoke.spawn(rs.x - Math.cos(rs.ang) * d.r, rs.y - Math.sin(rs.ang) * d.r, gz + 0.08, rnd(0.3), rnd(0.3), 0.2, 1.0, 0.15, 0.5, 0.5, 0.45, 0.36, 0.35, 0);
    if (e.hp / e.mhp < 0.35 && d.armor !== 'inf' && Math.random() < dt * 8 * FX.mul) puff(rs.x, rs.y, rs.z + 0.4, 0.15, 1.4, 0.1, 0.7, 0.8);
  }
  R3.corpses = R3.corpses.filter(c => R3.time - c.t0 < 9);
  for (const c of R3.corpses) { const rs = c.rs; if (!inView(rs.x, rs.y)) continue; if (!UT[c.t]) { c.t0 = -1e9; continue; } const U = unitIM(c.t, c.team), pv = U.model.piv; if (!pv.legs) { c.t0 = -1e9; continue; } // v7.0.3: legless models (the Colossus boss is mech:1 but a tank) have no rig to collapse — this threw every frame and froze the game on the boss kill
    if (U.n + 3 >= U.cap) growIM(U, U.cap * 2);
    const age = R3.time - c.t0, f = Math.min(1, age / 0.55), ease = f * f * (3 - 2 * f), sink = Math.max(0, age - 6) * 0.12, vs = UT[c.t].mech ? 0.85 : 1;
    rs.dead = ease; T.e.set(0, -rs.tang, 0, 'YXZ'); T.q.setFromEuler(T.e);
    const sq = pv.squad || 1; for (let m = 0; m < sq; m++) { const ii = U.n++; T.b.compose(T.p.set(rs.x, rs.z - sink, rs.y), T.q, T.s.set(vs, vs, vs)); if (sq > 1) T.b.multiply(T.l.makeTranslation([0.18, -0.2, -0.2][m], 0, [0, 0.24, -0.24][m]));
      poseRig(U, ii, T.b, rs, pv.legs, m, c.rs.fallDir); } }
  for (const u of R3.uiMesh.values()) for (const kk in u.parts) { u.parts[kk].count = u.n; u.parts[kk].instanceMatrix.needsUpdate = true; }
  R3.ringSel.count = Math.min(nSel, 400); R3.ringEnemy.count = Math.min(nEn, 100); R3.ringHover.count = Math.min(nHov, 4); R3.blob.count = nBlob;
  R3.ringSel.instanceMatrix.needsUpdate = R3.ringEnemy.instanceMatrix.needsUpdate = R3.ringHover.instanceMatrix.needsUpdate = R3.blob.instanceMatrix.needsUpdate = true;
  if (UI.placing && BT[UI.placing].wpn && R3.ghost && R3.ghost.visible && nRange < 6) { const rg = R3.rangeRings[nRange++], r = W[BT[UI.placing].wpn].rng; rg.visible = true; rg.scale.set(r, 1, r); rg.position.copy(R3.ghost.position); rg.position.y += 0.15; rg.material.color.set(0xffd060); }
  for (let i = nRange; i < 6; i++) R3.rangeRings[i].visible = false;
  for (const id of [...R3.objs.keys()]) if (!alive.has(id)) disposeObj(id);
  if (G.tick % 300 === 0) for (const id of [...R3.rs.keys()]) if (!alive.has(id)) R3.rs.delete(id);
  for (const mk of R3.markPool) if (mk.t > 0) { mk.t -= dt; mk.m.scale.setScalar(0.2 + mk.t * 1.4); mk.m.material.opacity = mk.t * 2; if (mk.t <= 0) mk.m.visible = false; }
  updFx(dt); if (G.desert) desertFx(dt);
  updFogTex(dt);
  for (const v of R3.vents || []) if (inView(v.x, v.y) && Math.random() < dt * 9 * FX.mul && (!G.opts.fog || seen0(idx(Math.floor(v.x), Math.floor(v.y))))) FX.smoke.spawn(v.x + rnd(0.3), v.y + rnd(0.3), heightAt(v.x, v.y) + 0.15, rnd(0.15), rnd(0.15), 0.7, 1.6, 0.12, 0.5, 0.35, 0.95, 0.8, 0.35, 0);
  if (G.oreVer !== R3.oreVer) { R3.oreVer = G.oreVer; updOre(); }
  // sun/shadow follow camera (texel snapped)
  const c = R3.cam, half = Math.max(14, Math.ceil(c.d * 0.85 / 4) * 4), sh = R3.sun.shadow.camera;
  if (sh.right !== half) { sh.left = -half; sh.right = half; sh.top = half; sh.bottom = -half; sh.near = 1; sh.far = 120; sh.updateProjectionMatrix(); }
  // stable shadows: snap the shadow frustum centre to whole texels in light space (no swimming while panning)
  const texel = half * 2 / R3.sun.shadow.mapSize.x, L = R3.sunDir, rt = R3._srt || (R3._srt = new THREE.Vector3()), up = R3._sup || (R3._sup = new THREE.Vector3());
  rt.set(0, 1, 0).cross(L).normalize(); up.copy(L).cross(rt).normalize();
  const ctr = new THREE.Vector3(c.x, 0, c.y), a = Math.round(ctr.dot(rt) / texel) * texel, b = Math.round(ctr.dot(up) / texel) * texel, dl = ctr.dot(L);
  ctr.copy(rt).multiplyScalar(a).addScaledVector(up, b).addScaledVector(L, dl);
  R3.sun.position.copy(ctr).addScaledVector(L, 60); R3.sun.target.position.copy(ctr); R3.sun.target.updateMatrixWorld();
  postRender(R3.scene, R3.camera);
  // fps + auto quality
  R3.frames++; R3.fpsT += dt;
  if (R3.fpsT >= 1) { R3.fps = R3.frames / R3.fpsT; R3.frames = 0; R3.fpsT = 0; R3.calls = R3.renderer.info.render.calls; R3.tris = R3.renderer.info.render.triangles;
    if (R3.auto && G.time > 5) { R3.lowN = R3.fps < 38 ? (R3.lowN || 0) + 1 : 0; if (R3.lowN >= 4) { const order = ['ultra', 'high', 'med', 'low'], i = order.indexOf(R3.qName); if (i < 3) { applyQuality(order[i + 1]); uiMsg('Graphics quality lowered to ' + R3.q.label + ' (auto)'); } R3.lowN = 0; } } }
}
function applyAniso() { const mx = R3.renderer.capabilities.getMaxAnisotropy(); R3.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'aoMap', 'roughnessMap', 'normalMap', 'alphaMap']) if (m[k] && m[k].anisotropy !== mx) { m[k].anisotropy = mx; m[k].needsUpdate = true; } }); }
function updCamera(dt) {
  const c = R3.cam, k = 1 - Math.exp(-dt * 9);
  if (R3.camera) { const nn = Math.max(0.8, c.d * 0.35), ff = c.d * 3.2 + 50; if (Math.abs(R3.camera.near - nn) > 0.05 || Math.abs(R3.camera.far - ff) > 1) { R3.camera.near = nn; R3.camera.far = ff; R3.camera.updateProjectionMatrix(); } }
  c.tx = Math.max(3, Math.min(MW - 3, c.tx)); c.ty = Math.max(4, Math.min(MH + 6, c.ty)); c.td = Math.max(7, Math.min((G.spectate || G.watch) ? 110 : 60, c.td)); // v5.4: spectators may zoom far out
  c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; c.d += (c.td - c.d) * k;
  const pitch = 0.82 + (c.d - 10) / 40 * 0.3; let sx = 0, sz = 0;
  if (R3.shake > 0) { R3.shake -= dt; sx = rnd(R3.shake * 0.6); sz = rnd(R3.shake * 0.6); }
  R3.camera.position.set(c.x + sx, c.d * Math.sin(pitch), c.y + c.d * Math.cos(pitch) + sz); R3.camera.lookAt(c.x + sx, 0, c.y + sz);
  R3.camera.updateMatrixWorld();
}
function updView() {
  const el = R3.renderer.domElement, W = el.clientWidth, H = el.clientHeight, pts = [[0, 0], [W, 0], [0, H], [W, H]].map(([a, b]) => screenToWorld(a, b)).filter(Boolean);
  if (pts.length < 4) { R3.view = { x0: -99, y0: -99, x1: 999, y1: 999 }; return; }
  R3.view = { x0: Math.min(...pts.map(p => p.x)) - 2.5, x1: Math.max(...pts.map(p => p.x)) + 2.5, y0: Math.min(...pts.map(p => p.y)) - 3.5, y1: Math.max(...pts.map(p => p.y)) + 2 };
  R3.viewPts = pts;
}
function screenToWorld(sx, sy) {
  const el = R3.renderer.domElement, v = new THREE.Vector2(sx / el.clientWidth * 2 - 1, -(sy / el.clientHeight) * 2 + 1);
  R3.raycaster.setFromCamera(v, R3.camera); const p = new THREE.Vector3();
  if (!R3.raycaster.ray.intersectPlane(R3.ground, p)) return null;
  // v5.5: refine against terrain height (plateaus/hills) so the cursor hits what is drawn under it
  if (typeof heightAt === 'function') { // v5.7.1: march the ray to the FIRST terrain hit (fixed-point refinement could land on the wrong side of a cliff)
    const o = R3.raycaster.ray.origin, dv = R3.raycaster.ray.direction, top = 6; let t0 = dv.y < 0 ? Math.max(0, (o.y - top) / -dv.y) : 0, t1 = o.distanceTo(p) + 4, prev = t0, hit = -1;
    for (let t = t0; t <= t1; t += 0.25) { const x = o.x + dv.x * t, y = o.y + dv.y * t, z = o.z + dv.z * t; if (y <= heightAt(x, z)) { hit = t; break; } prev = t; }
    if (hit >= 0) { let a = prev, b = hit; for (let k = 0; k < 8; k++) { const m = (a + b) / 2, y = o.y + dv.y * m; if (y <= heightAt(o.x + dv.x * m, o.z + dv.z * m)) b = m; else a = m; } p.set(o.x + dv.x * b, 0, o.z + dv.z * b); } }
  return { x: p.x, y: p.z };
}
const _v3 = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function worldToScreen(x, y, z) { const el = R3.renderer.domElement; _v3.set(x, z, y).project(R3.camera); return { x: (_v3.x + 1) / 2 * el.clientWidth, y: (1 - _v3.y) / 2 * el.clientHeight, behind: _v3.z > 1 }; }
function ghost(t, tx, ty, ok) {
  if (!t) { if (R3.ghost) R3.ghost.visible = false; return; }
  if (!R3.ghost || R3.ghostT !== t) {
    if (R3.ghost) R3.scene.remove(R3.ghost);
    const g = new THREE.Group(), model = getModel('b', t, 0);
    R3.ghostMat = new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    g.add(new THREE.Mesh(model.body, R3.ghostMat)); for (const k in model) if (k !== 'piv' && k !== 'body') { const m = new THREE.Mesh(model[k], R3.ghostMat), pv = model.piv[k] || [0, 0, 0]; m.position.set(...pv); g.add(m); }
    const d = BT[t]; R3.ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x55ff88, transparent: true, opacity: 0.25, depthWrite: false, fog: false })); R3.ghostPad.position.y = 0.05; g.add(R3.ghostPad);
    g.renderOrder = 9; R3.ghost = g; R3.ghostT = t; R3.scene.add(g);
  }
  const d = BT[t]; R3.ghost.visible = true; R3.ghostMat.color.set(ok ? 0x55ff88 : 0xff4433); R3.ghostPad.material.color.set(ok ? 0x55ff88 : 0xff4433);
  R3.ghost.position.set(tx + d.w / 2, heightAt(tx + d.w / 2, ty + d.h / 2) + 0.02, ty + d.h / 2);
}
// ---------- portraits (real 3D renders of the models for sidebar & info panel) ----------
function makePortraits() {
  const r = R3.renderer, S = new THREE.Scene(); S.environment = R3.scene.environment;
  const l = new THREE.DirectionalLight(0xffffff, 3); l.position.set(-3, 5, 4); S.add(l); S.add(new THREE.HemisphereLight(0xcfe0ff, 0x302a20, 0.6));
  const cam = new THREE.PerspectiveCamera(30, 1.5, 0.1, 50);
  const oldSize = new THREE.Vector2(); r.getSize(oldSize); const oldPR = r.getPixelRatio();
  FOW.uFowOn.value = 0; r.setRenderTarget(null); r.setPixelRatio(1); r.setSize(192, 128, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
  const out = {};
  const shoot = (kind, t, mdl, key) => {
    const model = mdl || getModel(kind, t, 0), g = new THREE.Group(), mat = pbrMaterial(); g.add(new THREE.Mesh(model.body, mat));
    if (model.piv.legs) { // v6.2: rigged infantry/mechs are posed exactly like in game (one clean figure, legs attached)
      g.clear(); const U = { parts: {} }; for (const k in model) if (k !== 'piv') { const im = new THREE.InstancedMesh(model[k], mat, 1); U.parts[k] = im; g.add(im); }
      poseRig(U, 0, new THREE.Matrix4(), { spd: 0, ph: 0, aim: 0.6 }, model.piv.legs, 0, 0); for (const k in U.parts) U.parts[k].instanceMatrix.needsUpdate = true;
    } else for (const k in model) if (k !== 'piv' && k !== 'body' && k !== 'spade') { const m = new THREE.Mesh(model[k], mat), pv = model.piv[k] || [0, 0, 0]; m.position.set(...pv); if (k === 'load') m.scale.y = 0.7; g.add(m); }
    S.add(g); const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
    g.rotation.y = kind === 'u' ? -0.6 : 0.5;
    cam.position.set(c.x + sz * 0.95, c.y + sz * 0.75, c.z + sz * 1.25); cam.lookAt(c); r.clear(); r.render(S, cam); out[key || t] = r.domElement.toDataURL(); S.remove(g);
  };
  for (const t in UT) shoot('u', t); for (const t in BT) shoot('b', t);
  { const B = new MB(0); B.bld = true; B.chn = 1; BLD_MODELS.wall(B); shoot('b', 'wall', B.build(), 'wallChn'); } // v7.0 China Great Wall card
  FOW.uFowOn.value = 1; r.toneMapping = THREE.NoToneMapping; r.outputEncoding = THREE.LinearEncoding; r.setClearColor(0x000000, 1); r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y);
  R3.portraits = out;
}
// visual change per defense level: bigger head, rank chevrons, armor collar, extra glow
function setLevelDecor(o, e) {
  const l = e.lvl || 1; o.lvl = l; if (o.decor) { if (o.decor.parent) o.decor.parent.remove(o.decor); o.decor = null; }
  if (o.parts.head) o.parts.head.scale.setScalar(1 + 0.12 * (l - 1));
  if (l < 2) return;
  const B = new MB(e.team);
  for (let i = 0; i < l - 1; i++) { B.glow('d', 0.05, 0.03, 0.16, 'TL', 0.4 - i * 0.09, 0.2, 0, { ry: 0 }); B.glow('d', 0.05, 0.03, 0.16, 'TL', -0.4 + i * 0.09, 0.2, 0); }
  B.torus('d', 0.4, 0.035, COL.STEEL, PBR.METAL, 0, 0.42, 0, { rx: Math.PI / 2, seg: 24 });
  if (l >= 3) { B.torus('d', 0.47, 0.02, 'T', PBR.GLOW2, 0, 0.24, 0, { rx: Math.PI / 2, seg: 24 }); for (const a of [0.8, 2.4, 3.9, 5.5]) B.box('d', 0.12, 0.3, 0.06, COL.DARK, PBR.DARKM, Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4, { ry: -a }); }
  const m = new THREE.Mesh(B.build().d, pbrMaterial()); m.castShadow = true; o.body.add(m); o.decor = m;
}

// ===== procedural infantry / mech animation =====
// gait phase advances with distance travelled (no foot sliding); aim pose blends in when engaging; kick = recoil impulse
function animGait(rs, e, d, dt, L) {
  const px = rs.gx == null ? rs.x : rs.gx, py = rs.gy == null ? rs.y : rs.gy, dist = Math.hypot(rs.x - px, rs.y - py); rs.gx = rs.x; rs.gy = rs.y;
  if (dist > 1e-4) rs.mvA = Math.atan2(rs.y - py, rs.x - px); // v6.2: direction of travel (legs follow it, torso follows the aim)
  const v = dt > 0 ? Math.min(6, dist / dt) : 0; rs.spd = (rs.spd || 0) + (v - (rs.spd || 0)) * Math.min(1, dt * 8);
  rs.ph = ((rs.ph || (e.id * 1.3)) + dist / L.stride * Math.PI * 2 * (L.mech ? 1 : 1 / 0.85)) % (Math.PI * 200);
  const aimT = e.tgt && e.tgt.hp > 0 && rs.spd < 0.3 ? 1 : 0; rs.aim = (rs.aim || 0) + (aimT - (rs.aim || 0)) * Math.min(1, dt * 7);
  rs.kick = Math.max(0, (rs.kick || 0) - dt * 6); rs.dead = 0; rs.idleT = R3.time + e.id;
  if (L.mech) { // torso tracks the target independently of the legs; heavy footfalls
    rs.torso = -angDiff(rs.ang, rs.tang);
    const step = Math.floor(rs.ph / Math.PI); if (rs.lastStep != null && step !== rs.lastStep && rs.spd > 0.3) { if (inView(rs.x, rs.y) && visibleTo0(e)) { sfx('step', rs.x, rs.y); puff(rs.x, rs.y, rs.z + 0.05, 0.35, 0.9, 0.55, 0.35, 0.15); shake(0.02); } } rs.lastStep = step;
  }
}
const _RG = typeof THREE !== 'undefined' ? { P: m4(), A: m4(), B: m4(), C: m4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) } : null;
function rz(m, a) { _RG.e.set(0, 0, a); _RG.q.setFromEuler(_RG.e); return m.makeRotationFromQuaternion(_RG.q); }
function poseRig(U, i, base, rs, L, seed, fall) {
  if (!L) return; // v7.0.3 defensive: legless model has no rig
  const R = _RG, mech = L.mech, sp = rs.spd || 0, w = Math.min(1, sp / (mech ? 0.6 : 0.45)), run = Math.max(0, Math.min(1, (sp - 1.5) / 0.8));
  const ph = (rs.ph || 0) + seed, aim = rs.aim || 0, dead = rs.dead || 0, kick = rs.kick || 0, t = R3.time + seed * 3.1 + (rs.idleT || 0) * 0.01;
  const A = (mech ? 0.4 : 0.5 + 0.25 * run) * w;
  // v6.2: legs/feet step along the direction of travel even while the torso aims elsewhere (backpedal = reversed stride)
  let ly = 0, rev = 1; if (!mech && sp > 0.12 && rs.mvA != null) { let dl = angDiff(rs.tang, rs.mvA); if (Math.abs(dl) > 1.9) { dl = angDiff(rs.tang, rs.mvA + Math.PI); rev = -1; } ly = -dl; }
  let thL = Math.sin(ph) * A * rev, thR = -Math.sin(ph) * A * rev;
  let knL = (0.15 + (mech ? 0.6 : 1.0) * Math.max(0, -Math.cos(ph))) * w, knR = (0.15 + (mech ? 0.6 : 1.0) * Math.max(0, Math.cos(ph))) * w;
  // aiming stance: staggered feet, slight crouch
  thL += aim * 0.22 * (1 - w); thR -= aim * 0.12 * (1 - w); knL += aim * 0.2 * (1 - w); knR += aim * 0.28 * (1 - w);
  let bob = (Math.cos(ph * 2) * 0.5 - 0.5) * (mech ? 0.05 : 0.018 + 0.012 * run) * w - aim * 0.012 * (1 - w);
  let lean = -(0.06 + 0.2 * run) * w - aim * 0.07 + kick * 0.12 + Math.sin(t * 1.6) * 0.012 * (1 - w);
  let twist = Math.sin(ph) * 0.08 * w * (mech ? 0.5 : 1) + Math.sin(t * 0.7) * 0.02 * (1 - w) + (mech ? rs.torso || 0 : 0);
  // death fall: rotate whole body around feet, legs crumple
  if (dead > 0) { knL = knR = dead * 0.9; thL = thR = dead * 0.5; bob = -dead * L.hip * 0.35; lean = 0; }
  R.P.copy(base);
  if (dead > 0) { R.P.multiply(rz(R.A, dead * 1.45 * (fall || 1))); }
  R.P.multiply(R.A.makeTranslation(0, L.hip + bob * (L.mech ? 1 : 1), 0));
  // upper body
  R.B.copy(R.P).multiply(rz(R.A, lean)); R.e.set(0, twist, 0); R.q.setFromEuler(R.e); R.B.multiply(R.A.makeRotationFromQuaternion(R.q)); R.B.multiply(R.A.makeTranslation(-kick * 0.03, -L.hip, 0));
  U.parts.body.setMatrixAt(i, R.B);
  if (ly) R.P.multiply(R.A.makeRotationY(ly));
  for (const [side, z, th, kn] of [['L', L.hz, thL, knL], ['R', -L.hz, thR, knR]]) {
    R.B.copy(R.P).multiply(R.A.makeTranslation(0, 0, z)).multiply(rz(R.A, th)); U.parts['th' + side].setMatrixAt(i, R.B);
    R.C.copy(R.B).multiply(R.A.makeTranslation(0, -L.tl, 0)).multiply(rz(R.A, -kn)); U.parts['sh' + side].setMatrixAt(i, R.C);
  }
}

// ===== v4.2: connected wall chains, wall drag preview, offline-defense icons, low-power alert =====
function wallsUpdate() {
  if (R3.wallVer === G.bver && R3.wallSeen === (G.tick >> 4)) return; R3.wallVer = G.bver; R3.wallSeen = G.tick >> 4;
  if (!R3.wallSeg) {
    const mk = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0; R3.scene.add(m); return m; };
    const B = new MB(0); B.box('s', 1, 0.52, 0.34, COL.CONC, PBR.CONC, 0.5, 0.26, 0, { bevel: 0.04 }); for (const z of [-0.17, 0.17]) B.box('s', 1, 0.05, 0.03, 0x55595e, PBR.METAL, 0.5, 0.42, z, { bevel: 0 });
    R3.wallSeg = mk(B.build().s, pbrMaterial(), 1200);
    const C = new MB(0); C.box('c', 1, 0.06, 0.36, 0xffffff, PBR.PAINT, 0.5, 0.55, 0, { bevel: 0.01 });
    const cm = pbrMaterial().clone(); cm.onBeforeCompile = pbrMaterial().onBeforeCompile; cm.customProgramCacheKey = () => 'pbrv2ic';
    R3.wallCap = mk(C.build().c, cm, 1200); R3.wallCap.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3600).fill(1), 3);
    // v7.0 China Great Wall segment: taller weathered stone with merlons along the top
    const D = new MB(0); D.box('s', 1, 0.62, 0.4, 0x9a8f7c, PBR.CONC, 0.5, 0.31, 0, { bevel: 0.03 }); D.box('s', 1, 0.05, 0.44, 0x7a705f, PBR.CONC, 0.5, 0.64, 0, { bevel: 0 });
    for (let k = 0; k < 3; k++) for (const z of [-0.16, 0.16]) D.box('s', 0.16, 0.14, 0.08, 0x7a705f, PBR.CONC, 0.17 + k * 0.33, 0.73, z, { bevel: 0.01 });
    R3.wallChn = mk(D.build().s, pbrMaterial(), 800);
  }
  const at = new Map(); for (const e of G.ents) if ((e.t === 'wall' || e.t === 'gtower') && e.hp > 0 && (e.team === ME || seen0(idx(e.tx, e.ty)))) at.set(e.ty * MW + e.tx, e);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let n = 0, nc = 0;
  for (const [k, e] of at) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const o = at.get((e.ty + dy) * MW + e.tx + dx); if (!o || o.team !== e.team || n >= 1200) continue;
    if (dx && dy && at.has(e.ty * MW + e.tx + dx) && at.has((e.ty + dy) * MW + e.tx)) continue; // corner already closed orthogonally
    const len = Math.hypot(dx, dy), a = Math.atan2(dy, dx), h = heightAt(e.x, e.y);
    q.setFromAxisAngle(up, -a); m4.compose(new THREE.Vector3(e.x, h, e.y), q, new THREE.Vector3(len, 1, 1));
    if (G.players[e.team] && G.players[e.team].fac === 'chn') { if (nc < 800) R3.wallChn.setMatrixAt(nc++, m4); continue; }
    R3.wallSeg.setMatrixAt(n, m4); R3.wallCap.setMatrixAt(n, m4); col.setHex(TEAMPAINT[e.team]); R3.wallCap.setColorAt(n, col); n++;
  }
  R3.wallChn.count = nc; R3.wallChn.instanceMatrix.needsUpdate = true;
  R3.wallSeg.count = R3.wallCap.count = n; R3.wallSeg.instanceMatrix.needsUpdate = R3.wallCap.instanceMatrix.needsUpdate = true; R3.wallCap.instanceColor.needsUpdate = true;
}
function wallPreview(tiles) {
  if (!R3.wallPrev) { R3.wallPrev = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.6, 0.9).translate(0, 0.3, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, fog: false }), 30); R3.wallPrev.frustumCulled = false; R3.wallPrev.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(90), 3); R3.scene.add(R3.wallPrev); }
  const W = R3.wallPrev; if (!tiles) { W.count = 0; return; }
  const m4 = new THREE.Matrix4(), c = new THREE.Color(); let cr = G.players[ME].cr; W.count = Math.min(30, tiles.length);
  tiles.slice(0, 30).forEach(([x, y], i) => { const ok = canPlace('wall', ME, x, y) && (cr -= BT.wall.cost) >= 0; m4.makeTranslation(x + 0.5, heightAt(x + 0.5, y + 0.5), y + 0.5); W.setMatrixAt(i, m4); W.setColorAt(i, c.setHex(ok ? 0x55ff88 : 0xff4433)); });
  W.instanceMatrix.needsUpdate = true; W.instanceColor.needsUpdate = true;
}
function offlineIcons(dt) {
  if (!R3.offTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(20,10,0,.75)'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill(); x.strokeStyle = '#ff4d3d'; x.lineWidth = 4; x.stroke(); x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffd23d'; x.fillText('⚡', 32, 34); R3.offTex = new THREE.CanvasTexture(c); R3.offIcons = []; }
  R3.offBlink = (R3.offBlink || 0) + dt; let k = 0;
  for (const e of G.ents) if (e.kind === 'b' && e.offline && e.hp > 0 && (e.team === ME || visibleTo0(e))) {
    let s = R3.offIcons[k]; if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ map: R3.offTex, depthTest: false, transparent: true, fog: false })); s.renderOrder = 9; s.scale.set(0.8, 0.8, 1); R3.scene.add(s); R3.offIcons.push(s); }
    s.visible = (R3.offBlink % 1) < 0.7; s.position.set(e.x, heightAt(e.x, e.y) + (e.w > 1 ? 2.6 : 1.8), e.y); k++;
  }
  for (; k < R3.offIcons.length; k++) R3.offIcons[k].visible = false;
}
function lowPowerAlert() {
  const P = G.players[ME]; if (!P || G.spectate) return; const low = P.pow < 0;
  if (low && !R3.wasLow && G.ents.some(e => e.team === ME && e.kind === 'b' && BT[e.t].wpn && BT[e.t].pow < 0)) { announce('Low power — defenses offline', 'lowpow', 20); uiMsg('⚡ Low power: defenses are OFFLINE and production is slowed. Build a Power Plant (T).'); sfx('alert'); }
  if (!low && R3.wasLow) uiMsg('Power restored — defenses online');
  R3.wasLow = low;
}

// ===== v5.0: oil derricks (owner flag, pump animation) and day/night cycle =====
function derricksUpdate(dt) {
  if (!G.derricks) return;
  if (!R3.dk) { R3.dk = G.derricks.map(d => { const B = new MB(0);
      B.box('b', 1.3, 0.12, 1.3, COL.CONCD, PBR.CONC, 0, 0.06, 0, { bevel: 0.03 }); for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) B.box('b', 0.06, 1.4, 0.06, COL.STEEL, PBR.METAL, x * 0.6, 0.75, z * 0.6, { bevel: 0 });
      B.box('b', 0.3, 0.3, 0.3, COL.DARK, PBR.DARKM, 0, 1.45, 0, { bevel: 0.03 }); B.cyl('b', 0.12, 0.5, 0x3a2a1a, PBR.DARKM, 0.45, 0.35, 0.3, { seg: 10 });
      const A = new MB(0); A.box('a', 1.3, 0.1, 0.12, 0x9a6a1c, PBR.PAINT, 0.1, 0, 0, { bevel: 0.02 }); A.box('a', 0.18, 0.32, 0.16, COL.DARK, PBR.DARKM, 0.72, -0.12, 0, { bevel: 0.02 });
      const F = new MB(0); F.box('f', 0.36, 0.22, 0.02, 0xffffff, PBR.PAINT, 0.2, 0, 0, { bevel: 0 });
      const g = new THREE.Group(), h = heightAt(d.x, d.y); g.position.set(d.x, h, d.y);
      const bm = new THREE.Mesh(B.build().b, pbrMaterial()); bm.castShadow = bm.receiveShadow = true; g.add(bm);
      const arm = new THREE.Mesh(A.build().a, pbrMaterial()); arm.position.set(0, 1.62, 0); arm.castShadow = true; g.add(arm);
      const fm = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6, emissive: 0x000000 }), flag = new THREE.Mesh(F.build().f, fm); flag.position.set(0, 2.05, 0); g.add(flag);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), new THREE.MeshStandardMaterial({ color: 0x333333 })); pole.position.set(0, 1.85, 0); g.add(pole);
      let zone = null; if (d.op) { // v6.0 outpost: sandbag bunker ring, tall command mast, faint build-radius square when owned
        const O = new MB(0); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; O.cyl('o', 0.13, 0.42, 0xb09468, PBR.CLOTH, Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15, { rz: Math.PI / 2, ry: -a + Math.PI / 2, seg: 7 }); if (k % 2) O.cyl('o', 0.13, 0.42, 0xa08658, PBR.CLOTH, Math.cos(a) * 1.15, 0.32, Math.sin(a) * 1.15, { rz: Math.PI / 2, ry: -a + Math.PI / 2, seg: 7 }); }
        O.cyl('o', 0.035, 3.2, 0x2a2a2a, PBR.METAL, -0.7, 1.6, -0.7, { seg: 6 }); O.box('o', 0.5, 0.06, 0.06, 0x2a2a2a, PBR.METAL, -0.7, 3.0, -0.7, { bevel: 0 });
        const om = new THREE.Mesh(O.build().o, pbrMaterial()); om.castShadow = om.receiveShadow = true; g.add(om);
        flag.position.set(-0.5, 2.95, -0.7); flag.scale.set(2.2, 2.2, 1); pole.visible = false;
        const R = typeof OUTPOST_R !== 'undefined' ? OUTPOST_R : 7, sq = new THREE.EdgesGeometry(new THREE.PlaneGeometry(R * 2 + 1, R * 2 + 1).rotateX(-Math.PI / 2));
        zone = new THREE.LineSegments(sq, new THREE.LineBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.55, fog: false })); zone.position.set(d.x, h + 0.25, d.y); zone.visible = false; R3.scene.add(zone); }
      R3.scene.add(g); return { g, arm, fm, owner: -2, zone }; }); }
  G.derricks.forEach((d, i) => { const r = R3.dk[i]; r.g.visible = seen0(idx(Math.floor(d.x), Math.floor(d.y)));
    if (r.owner !== d.owner) { r.owner = d.owner; const c = d.owner >= 0 ? new THREE.Color(MMCOL[d.owner]) : new THREE.Color(0xdddddd); r.fm.color.copy(c); r.fm.emissive.copy(c).multiplyScalar(d.owner >= 0 ? 0.35 : 0); }
    if (d.owner >= 0) r.arm.rotation.z = Math.sin(R3.time * 1.8 + i) * 0.35;
    if (r.zone) { r.zone.visible = d.owner === ME && r.g.visible; if (r.zone.visible) r.zone.material.opacity = 0.35 + 0.25 * Math.sin(R3.time * 3); } });
}
// day/night: 8-minute cycle, render only (no sim effect -> lockstep-safe). Night keeps contrast and lets emissive lights glow.
function dayNight(dt) {
  if (!R3.sun || (typeof UI !== 'undefined' && UI.set && UI.set.noNight)) return;
  if (!R3.dn0) R3.dn0 = { sun: R3.sun.intensity, hemi: R3.hemi.intensity, sc: R3.sun.color.clone(), fog: R3.scene.fog.color.clone(), env: R3.scene.environment };
  const ph = ((G.time || 0) / 480 + 0.15) % 1, day = 0.5 + 0.5 * Math.cos(ph * Math.PI * 2), k = 0.28 + 0.72 * Math.min(1, Math.max(0, (day - 0.15) / 0.55));
  R3.sun.intensity = R3.dn0.sun * k; R3.hemi.intensity = R3.dn0.hemi * (0.6 + 0.4 * k);
  R3.sun.color.copy(R3.dn0.sc).lerp(new THREE.Color(0x8fa8ff), 1 - k).lerp(new THREE.Color(0xffa060), Math.max(0, 0.35 - Math.abs(day - 0.35)) * 1.6);
  R3.scene.fog.color.copy(R3.dn0.fog).multiplyScalar(0.35 + 0.65 * k); if (R3.scene.background && R3.scene.background.isColor) R3.scene.background.copy(R3.scene.fog.color);
  R3.night = 1 - k; if (POST.final) POST.final.uniforms.uExpo.value = 0.8 * (0.72 + 0.28 * k); if (G.weather && G.weather.on) R3.scene.fog.density = 0.02; else R3.scene.fog.density = 0.0065;
}

// ===== v5.2: missiles in flight (atmospheric arc), incoming target markers, silo missile visibility, Tesla crackle =====
function missilesUpdate(dt) {
  R3.misM = R3.misM || new Map(); const live = new Set();
  for (const ms of G.missiles || []) { live.add(ms.id); let o = R3.misM.get(ms.id);
    if (!o) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 10), new THREE.MeshStandardMaterial({ color: 0xdedcd2, roughness: 0.4, metalness: 0.3 })); body.rotation.x = Math.PI / 2; g.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 10), new THREE.MeshStandardMaterial({ color: TEAMCOL[ms.team], emissive: TEAMCOL[ms.team], emissiveIntensity: 0.4 })); tip.rotation.x = Math.PI / 2; tip.position.z = 0.75; g.add(tip);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb050 })); fl.position.z = -0.75; g.add(fl); const sc = ms.k === 'heavy' ? 1.8 : ms.k === 'cluster' ? 1.3 : 1; g.scale.setScalar(sc);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.scale.setScalar(MIS[ms.k].r + (MIS[ms.k].spread || 0));
      ring.position.set(ms.x1, heightAt(ms.x1, ms.y1) + 0.15, ms.y1); ring.renderOrder = 5; R3.scene.add(g); R3.scene.add(ring); o = { g, ring, last: null }; R3.misM.set(ms.id, o); }
    const s = Math.min(1, (G.time - ms.t0) / ms.T), D = Math.hypot(ms.x1 - ms.x0, ms.y1 - ms.y0), H = 8 + D * 0.55, x = ms.x0 + (ms.x1 - ms.x0) * s, y = ms.y0 + (ms.y1 - ms.y0) * s, z = heightAt(ms.x0, ms.y0) * (1 - s) + heightAt(ms.x1, ms.y1) * s + 4 * H * s * (1 - s) + 1.4 * (1 - s);
    const p = new THREE.Vector3(x, z, y); if (o.last) { const dir = p.clone().sub(o.last); if (dir.lengthSq() > 1e-6) o.g.lookAt(p.clone().add(dir)); } o.last = p; o.g.position.copy(p);
    if (Math.random() < 0.7) puff(x, y, z, 0.25 + s * 0.2, 2.5, 0.75, 0.72, 0.7);
    // target marker: visible to everyone from launch (counterplay: move units out), pulsing faster as impact nears
    const fo = foe(ms.team, ME) || ms.team === ME || !foe(ms.team, ME); o.ring.visible = fo; o.ring.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(R3.time * (3 + s * 12))); }
  for (const [id, o] of R3.misM) if (!live.has(id)) { R3.scene.remove(o.g); R3.scene.remove(o.ring); o.g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); o.ring.geometry.dispose(); R3.misM.delete(id); }
  for (const b of G.ents) if (b.t === 'silo') { const o = R3.objs && R3.objs.get(b.id), pv = o && o.parts.mis; if (pv) { pv.visible = !!(b.mis || b.mq); if (b.mq) pv.position.y = 0.25 - 1.6 * (1 - b.mq.p / MIS[b.mq.k].time); else pv.position.y = 0.25; } }
}
function teslaArcs(dt) { R3.tArc = (R3.tArc || 0) + dt; if (R3.tArc < 0.09) return; R3.tArc = 0;
  for (const b of G.ents) { if (b.t !== 'tesla' || b.hp <= 0 || b.offline || !inView(b.x, b.y) || (G.opts.fog && !seen0(idx(Math.floor(b.x), Math.floor(b.y))))) continue; if (Math.random() > 0.55) continue;
    const z0 = heightAt(b.x, b.y), hz = z0 + 2.2, a = Math.random() * 6.283, kind = Math.random();
    const ex = kind < 0.5 ? b.x + Math.cos(a) * 0.68 : b.x + Math.cos(a) * (0.5 + Math.random() * 0.5), ey = kind < 0.5 ? b.y + Math.sin(a) * 0.68 : b.y + Math.sin(a) * (0.5 + Math.random() * 0.5), ez = kind < 0.5 ? z0 + 0.86 : hz + (Math.random() - 0.6) * 0.8;
    let px = b.x, py = b.y, pz = hz; for (let k = 1; k <= 5; k++) { const f = k / 5, j = k < 5 ? 0.12 : 0; const nx = b.x + (ex - b.x) * f + rnd(j), ny = b.y + (ey - b.y) * f + rnd(j), nz = hz + (ez - hz) * f + rnd(j); flash((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2, 0.16, 0.55, 0.8, 1); flash(nx, ny, nz, 0.13, 0.7, 0.9, 1); px = nx; py = ny; pz = nz; } }
}
