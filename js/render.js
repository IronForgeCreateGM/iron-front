'use strict';
// ===== Renderer orchestrator: quality, lighting/env, instanced units, buildings, events, camera, picking =====
const QUALITY = {
  low:   { pr: 0.75, shadows: false, shadowSize: 1024, bloom: false, fxaa: false, msaa: 0, grass: 0, fx: 0.5, label: 'Low' },
  med:   { pr: 1.25, sharpen: 0.2, shadows: true, shadowSize: 1024, bloom: true, fxaa: true, msaa: 0, grass: 0.3, fx: 0.75, label: 'Medium' },
  high:  { pr: 2.0, sharpen: 0.25, shadows: true, shadowSize: 2048, bloom: true, fxaa: false, msaa: 2, grass: 0.55, fx: 1, label: 'High' },
  ultra: { pr: 2.0, sharpen: 0.3, shadows: true, shadowSize: 4096, bloom: true, fxaa: false, msaa: 4, grass: 0.85, fx: 1.2, label: 'Ultra' },
};
const R3 = { corpses: [], objs: new Map(), rs: new Map(), uiMesh: new Map(), markers: [], cam: { x: 12, y: 14, d: 30, tx: 12, ty: 14, td: 30 }, time: 0, uTime: { value: 0 }, sunDir: null, fps: 60, frames: 0, fpsT: 0, view: { x0: 0, y0: 0, x1: MW, y1: MH } };
function detectQuality() {
  if (QS.get('q') && QUALITY[QS.get('q')]) return QS.get('q');
  const saved = localStorage.getItem('if_quality'); if (saved && saved !== 'auto' && QUALITY[saved]) return saved;
  try { const gl = R3.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); const s = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    R3.gpu = s; if (/swiftshader|llvmpipe|software/i.test(s)) return 'low'; if (/intel/i.test(s) && !/iris xe|arc/i.test(s)) return 'med'; if (/apple m\d (max|ultra|pro)|rtx|radeon rx 6|radeon rx 7/i.test(s)) return 'ultra'; return 'high'; } catch (e) { return 'high'; }
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
  FX.mul = q.fx;
  r3Resize();
}
function r3Resize() {
  const el = R3.renderer.domElement.parentElement, w = el.clientWidth, h = el.clientHeight, pr = Math.min(window.devicePixelRatio || 1, R3.q.pr);
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
function makeBuildingObj(b) {
  const model = getModel('b', b.t, b.team), g = new THREE.Group(), mat = pbrMaterial();
  const body = new THREE.Mesh(model.body, mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const parts = {};
  for (const k in model) { if (k === 'piv' || k === 'body') continue; const m = new THREE.Mesh(model[k], mat); m.castShadow = true; const pv = model.piv[k] || [0, 0, 0]; m.position.set(pv[0], pv[1], pv[2]); body.add(m); parts[k] = m; }
  const ao = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 1.5, b.h * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: R3.aoTex, transparent: true, depthWrite: false, fog: false })); ao.position.y = 0.03; ao.renderOrder = 1; g.add(ao);
  const sc = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.96, 1.4, b.h * 0.96), new THREE.MeshBasicMaterial({ color: 0xffc94d, wireframe: true, transparent: true, opacity: 0.55, fog: false })); sc.position.y = 0.7; sc.visible = false; g.add(sc);
  g.position.set(b.x, heightAt(b.x, b.y), b.y);
  R3.scene.add(g); clearFoliage(b);
  return { g, body, parts, sc, team: b.team, piv: model.piv };
}
function disposeObj(id) { const o = R3.objs.get(id); if (!o) return; R3.scene.remove(o.g); R3.objs.delete(id); }
// ---------- events -> fx / sound ----------
function barrelTip(s) { const pv = s.kind === 'b' ? getModel('b', s.t, s.team).piv : getModel('u', s.t, s.team).piv; const tip = pv.tip || 0.3; const rs = R3.rs.get(s.id);
  const x = rs ? rs.x : s.x, y = rs ? rs.y : s.y, base = s.kind === 'b' ? heightAt(s.x, s.y) + (pv.head ? pv.head[1] + 0.08 : 0.6) : (rs ? rs.z : heightAt(x, y)) + (pv.turret ? pv.turret[1] + 0.07 : UT[s.t].armor === 'inf' ? 0.38 : 0.3);
  return { x: x + Math.cos(s.tang) * tip, y: y + Math.sin(s.tang) * tip, z: base }; }
function handleEvents() {
  for (const ev of G.events) {
    switch (ev.e) {
      case 'fire': {
        const s = ev.src; if (!visibleTo0(s) || !inView(s.x, s.y)) { sfx(ev.w.snd, s.x, s.y); break; }
        const p = barrelTip(s), w = ev.w.type, big = w === 'cannon' || w === 'shell'; if (ev.w.big) { flash(p.x, p.y, p.z, 2.0, 1, 0.8, 0.5); for (let i = 0; i < 10 * FX.mul; i++) puff(p.x + rnd(0.5), p.y + rnd(0.5), p.z, 0.5, 2.0, 0.6, 0.55, 0.5); shake(0.15); }
        flash(p.x, p.y, p.z, big ? 0.9 : w === 'bullet' ? 0.35 : 0.55, 1, 0.8, 0.45);
        { const r0 = R3.rs.get(s.id); if (r0 && s.kind === 'u' && (UT[s.t].armor === 'inf' || UT[s.t].mech)) r0.kick = 1; }
        if (big) { for (let i = 0; i < 4 * FX.mul; i++) puff(p.x + Math.cos(s.tang) * 0.2, p.y + Math.sin(s.tang) * 0.2, p.z, 0.25, 1.1, 0.55, 0.45, 0.3); const rs = R3.rs.get(s.id); if (rs) rs.recoil = 0.09; }
        if (w === 'rocket') puff(p.x - Math.cos(s.tang) * 0.4, p.y - Math.sin(s.tang) * 0.4, p.z, 0.3, 0.8, 0.6, 0.5, 0.2);
        sfx(ev.w.snd, s.x, s.y); break;
      }
      case 'hit': {
        if (G.opts.fog && !vis0(idx(Math.floor(ev.x), Math.floor(ev.y)))) break;
        const z = (ev.z || 0) + (ev.z > 1.5 ? heightAt(ev.x, ev.y) * 0.3 : heightAt(ev.x, ev.y));
        if (ev.kind === 'bullet') { sparks(ev.x, ev.y, z + 0.2, 2, 2); flash(ev.x, ev.y, z + 0.25, 0.18, 1, 0.8, 0.5); }
        else if (ev.kind === 'snipe') { sparks(ev.x, ev.y, z + 0.2, 3, 2.5); flash(ev.x, ev.y, z + 0.25, 0.3, 1, 0.9, 0.7); }
        else if (ev.kind === 'fire') { for (let i = 0; i < 6 * FX.mul; i++) FX.fire.spawn(ev.x + rnd(0.8), ev.y + rnd(0.8), z + 0.15, rnd(0.5), rnd(0.5), 0.8, 0.5, 0.2, 0.6, 1, 0.45, 0.1, 0.9, -1); if (Math.random() < 0.3) puff(ev.x, ev.y, z + 0.4, 0.25, 1.4, 0.12, 0.5, 0.8); }
        else if (ev.kind === 'aam') { explosion3(ev.x, ev.y, z, 0.45); sfx('boom', ev.x, ev.y); }
        else if (ev.kind === 'mega') { explosion3(ev.x, ev.y, z, 2.4); explosion3(ev.x + 0.6, ev.y - 0.4, z, 1.2); for (let i = 0; i < 8 * FX.mul; i++) puff(ev.x + rnd(1.6), ev.y + rnd(1.6), z + 0.3, 0.6, 2.4, 0.2, 0.18, 0.16); flash(ev.x, ev.y, z + 0.6, 2.2, 1, 0.75, 0.4); sfx('boomBig', ev.x, ev.y); shake(0.35); }
        else if (ev.kind === 'bomb') { explosion3(ev.x, ev.y, z, 1.4); sfx('boomBig', ev.x, ev.y); shake(0.12); }
        else if (ev.kind === 'flak') { flash(ev.x, ev.y, z, 0.7, 1, 0.75, 0.4); puff(ev.x, ev.y, z, 0.35, 1.2, 0.18, 0.7, 0.1); sparks(ev.x, ev.y, z, 3, 3); }
        else { explosion3(ev.x, ev.y, z, ev.kind === 'shell' ? 1.1 : 0.55); sfx(ev.kind === 'shell' ? 'boomBig' : 'boom', ev.x, ev.y); }
        break;
      }
      case 'die': {
        const e = ev.ent; const seen = !G.opts.fog || visibleTo0(e);
        if (e.sold || !seen) { disposeObj(e.id); R3.rs.delete(e.id); break; }
        const rs = R3.rs.get(e.id), z = rs ? rs.z : heightAt(e.x, e.y);
        if (e.kind === 'u' && (UT[e.t].armor === 'inf' || UT[e.t].mech) && rs) { R3.corpses.push({ t: e.t, team: e.team, rs: Object.assign({}, rs, { aim: 0, spd: 0, dead: 0, fallDir: Math.random() < 0.6 ? 1 : -1 }), t0: R3.time }); if (R3.corpses.length > 60) R3.corpses.shift(); }
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
      case 'upgraded': if (ev.team === ME) { sfx('ready'); uiMsg(ev.b.upKind === 'def' ? 'Research complete: ' + DEF_RESEARCH.n : BT[ev.b.t].n + ' upgraded to level ' + ev.b.lvl); } flash(ev.b.x, ev.b.y, 1, 1.5, 0.6, 0.9, 1); break;
      case 'capture': if (ev.team === ME || ev.b.team === ME) { sfx('ready'); uiMsg('Structure captured!'); } disposeObj(ev.b.id); break;
      case 'attacked': if (ev.team === ME && typeof uiAlert === 'function') { uiAlert(ev); announce(ev.harv ? 'Harvester under attack' : 'Base under attack', 'atk' + !!ev.harv, 25); } else if (!foe(ev.team, ME) && ev.team !== ME) { announce('Ally under attack', 'ally', 30); UI.pings.push({ x: ev.x, y: ev.y, t: 3 }); } break;
      case 'placed': if (ev.b.t === 'cc') { if (ev.team === ME) announce('Expansion established', 'cc', 3); else if (!foe(ev.team, ME)) announce('Ally expanding', 'acc', 20); } else if (ev.team === ME && FACTIONS[G.players[ME].fac].sp === ev.b.t) announce(BT[ev.b.t].n + ' deployed', 'sp', 5); break;
      case 'eliminated': announce(ev.team === ME ? 'You have been eliminated' : G.players[ev.team].name + (foe(ev.team, ME) ? ' (enemy)' : ' (ally)') + ' eliminated', 'el' + ev.team, 1); break;
      case 'popcap': if (ev.team === ME) uiMsg('Unit cap reached (' + POP_CAP + ')'); break;
      case 'allyAck': if (foe(ev.team, ME) || ev.team === ME) break; announce(G.players[ev.team].name + ': on my way', 'ack', 4); UI.pings.push({ x: ev.x, y: ev.y, t: 3 }); break;
    }
  }
  G.events.length = 0;
}
function shake(a) { R3.shake = Math.max(R3.shake || 0, a); }
function inView(x, y) { const v = R3.view; return x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1; }
// ---------- per-frame ----------
function r3Render(dt) {
  wallsUpdate(); offlineIcons(dt); lowPowerAlert();
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
      let o = R3.objs.get(e.id); if (o && o.team !== e.team) { disposeObj(e.id); o = null; }
      if (!o) { o = makeBuildingObj(e); R3.objs.set(e.id, o); }
      const show = vis && inView(e.x, e.y); o.g.visible = show; if (!show) continue;
      const age = G.time - e.born, cons = Math.min(1, age / 1.5), ease = 1 - Math.pow(1 - cons, 3);
      let sy = 0.02 + 0.98 * ease; if (e.sell >= 0) sy = Math.max(0.02, 1 - (G.time - e.sell) / 1.2);
      o.body.scale.y = sy; o.sc.visible = cons < 1 || e.sell >= 0;
      if (o.parts.spin) o.parts.spin.rotation.y += dt * 1.4; if (o.parts.head) o.parts.head.rotation.y = -e.tang;
      if ((e.lvl || 1) !== (o.lvl || 1)) setLevelDecor(o, e);
      if (e.upT != null && Math.random() < dt * 12) FX.spark.spawn(e.x + rnd(e.w), e.y + rnd(e.h), 0.5 + Math.random() * 0.6, rnd(1), rnd(1), 1.5, 0.5, 0.12, 0.04, 0.5, 0.9, 1, 1, 3);
      o.sc.visible = o.sc.visible || e.upT != null;
      if ((e.sel || e.id === R3.hoverId) && BT[e.t].wpn && nRange < 6) { const rg = R3.rangeRings[nRange++], r = defW(e).rng; rg.visible = true; rg.scale.set(r, 1, r); rg.position.set(e.x, heightAt(e.x, e.y) + 0.15, e.y); rg.material.color.set(e.team === ME ? 0xffd060 : 0xff6050); }
      if (o.parts.glow) o.parts.glow.visible = Math.sin(R3.time * 4 + e.id) > -0.3;
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
    rs.recoil = Math.max(0, rs.recoil - dt * 0.35); rs.spin += dt * (e.t === 'gunship' ? 28 : e.t === 'harv' ? (e.hst === 'mine' ? 8 : 0) : 3);
    if (!vis || !inView(rs.x, rs.y)) continue;
    const U = unitIM(e.t, e.team); if (U.n >= U.cap) growIM(U, U.cap * 2);
    const i = U.n++, pv = U.model.piv;
    const moving = e.path.length > 0, bob = 0;
    rs.bank = (rs.bank || 0) * 0.9 + angDiff(rs.pang == null ? rs.ang : rs.pang, rs.ang) * (d.jet ? 9 : 0); rs.pang = rs.ang;
    T.e.set(d.jet ? -Math.max(-0.7, Math.min(0.7, rs.bank)) : 0, -(d.armor === 'inf' || d.mech ? rs.tang : rs.ang), air && !d.jet ? (moving ? -0.18 : 0) : 0, 'YXZ'); T.q.setFromEuler(T.e);
    const vs = d.armor === 'inf' ? 1 : d.mech ? 0.85 : d.jet ? 1.1 : air ? 0.9 : 0.8;
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
    if (U.parts.turret) { T.e.set(0, -(rs.tang - rs.ang), 0); T.q.setFromEuler(T.e); T.l.compose(T.p.set(pv.turret[0] - rs.recoil, pv.turret[1], pv.turret[2]), T.q, T.one); U.parts.turret.setMatrixAt(i, T.t.multiplyMatrices(T.b, T.l)); }
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
  for (const c of R3.corpses) { const rs = c.rs; if (!inView(rs.x, rs.y)) continue; const U = unitIM(c.t, c.team), pv = U.model.piv; if (U.n + 3 >= U.cap) growIM(U, U.cap * 2);
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
  updFx(dt);
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
  c.tx = Math.max(3, Math.min(MW - 3, c.tx)); c.ty = Math.max(4, Math.min(MH + 6, c.ty)); c.td = Math.max(7, Math.min(60, c.td));
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
  if (!R3.raycaster.ray.intersectPlane(R3.ground, p)) return null; return { x: p.x, y: p.z };
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
  const shoot = (kind, t) => {
    const model = getModel(kind, t, 0), g = new THREE.Group(), mat = pbrMaterial(); g.add(new THREE.Mesh(model.body, mat));
    for (const k in model) if (k !== 'piv' && k !== 'body') { const m = new THREE.Mesh(model[k], mat), pv = model.piv[k] || [0, 0, 0]; m.position.set(...pv); if (k === 'load') m.scale.y = 0.7; g.add(m); }
    S.add(g); const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
    g.rotation.y = kind === 'u' ? -0.6 : 0.5;
    cam.position.set(c.x + sz * 0.95, c.y + sz * 0.75, c.z + sz * 1.25); cam.lookAt(c); r.clear(); r.render(S, cam); out[t] = r.domElement.toDataURL(); S.remove(g);
  };
  for (const t in UT) shoot('u', t); for (const t in BT) shoot('b', t);
  FOW.uFowOn.value = 1; r.toneMapping = THREE.NoToneMapping; r.outputEncoding = THREE.LinearEncoding; r.setClearColor(0x000000, 1); r.setPixelRatio(oldPR); r.setSize(oldSize.x, oldSize.y);
  R3.portraits = out;
}
// visual change per defense level: bigger head, rank chevrons, armor collar, extra glow
function setLevelDecor(o, e) {
  const l = e.lvl || 1; o.lvl = l; if (o.decor) { o.body.remove(o.decor); o.decor = null; }
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
  const v = dt > 0 ? Math.min(6, dist / dt) : 0; rs.spd = (rs.spd || 0) + (v - (rs.spd || 0)) * Math.min(1, dt * 8);
  rs.ph = ((rs.ph || (e.id * 1.3)) + dist / L.stride * Math.PI * 2 * (L.mech ? 1 : 1 / 0.85)) % (Math.PI * 200);
  const aimT = e.tgt && e.tgt.hp > 0 && rs.spd < 0.3 ? 1 : 0; rs.aim = (rs.aim || 0) + (aimT - (rs.aim || 0)) * Math.min(1, dt * 7);
  rs.kick = Math.max(0, (rs.kick || 0) - dt * 6); rs.dead = 0; rs.idleT = R3.time + e.id;
}
const _RG = typeof THREE !== 'undefined' ? { P: m4(), A: m4(), B: m4(), C: m4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) } : null;
function rz(m, a) { _RG.e.set(0, 0, a); _RG.q.setFromEuler(_RG.e); return m.makeRotationFromQuaternion(_RG.q); }
function poseRig(U, i, base, rs, L, seed, fall) {
  const R = _RG, mech = L.mech, sp = rs.spd || 0, w = Math.min(1, sp / (mech ? 0.6 : 0.45)), run = Math.max(0, Math.min(1, (sp - 1.5) / 0.8));
  const ph = (rs.ph || 0) + seed, aim = rs.aim || 0, dead = rs.dead || 0, kick = rs.kick || 0, t = R3.time + seed * 3.1 + (rs.idleT || 0) * 0.01;
  const A = (mech ? 0.4 : 0.5 + 0.25 * run) * w;
  let thL = Math.sin(ph) * A, thR = -Math.sin(ph) * A;
  let knL = (0.15 + (mech ? 0.6 : 1.0) * Math.max(0, -Math.cos(ph))) * w, knR = (0.15 + (mech ? 0.6 : 1.0) * Math.max(0, Math.cos(ph))) * w;
  // aiming stance: staggered feet, slight crouch
  thL += aim * 0.22 * (1 - w); thR -= aim * 0.12 * (1 - w); knL += aim * 0.2 * (1 - w); knR += aim * 0.28 * (1 - w);
  let bob = (Math.cos(ph * 2) * 0.5 - 0.5) * (mech ? 0.05 : 0.018 + 0.012 * run) * w - aim * 0.012 * (1 - w);
  let lean = -(0.06 + 0.2 * run) * w - aim * 0.07 + kick * 0.12 + Math.sin(t * 1.6) * 0.012 * (1 - w);
  let twist = Math.sin(ph) * 0.08 * w * (mech ? 0.5 : 1) + Math.sin(t * 0.7) * 0.02 * (1 - w);
  // death fall: rotate whole body around feet, legs crumple
  if (dead > 0) { knL = knR = dead * 0.9; thL = thR = dead * 0.5; bob = -dead * L.hip * 0.35; lean = 0; }
  R.P.copy(base);
  if (dead > 0) { R.P.multiply(rz(R.A, dead * 1.45 * (fall || 1))); }
  R.P.multiply(R.A.makeTranslation(0, L.hip + bob * (L.mech ? 1 : 1), 0));
  // upper body
  R.B.copy(R.P).multiply(rz(R.A, lean)); R.e.set(0, twist, 0); R.q.setFromEuler(R.e); R.B.multiply(R.A.makeRotationFromQuaternion(R.q)); R.B.multiply(R.A.makeTranslation(-kick * 0.03, -L.hip, 0));
  U.parts.body.setMatrixAt(i, R.B);
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
  }
  const at = new Map(); for (const e of G.ents) if (e.t === 'wall' && e.hp > 0 && (e.team === ME || seen0(idx(e.tx, e.ty)))) at.set(e.ty * MW + e.tx, e);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(); let n = 0;
  for (const [k, e] of at) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const o = at.get((e.ty + dy) * MW + e.tx + dx); if (!o || o.team !== e.team || n >= 1200) continue;
    if (dx && dy && at.has(e.ty * MW + e.tx + dx) && at.has((e.ty + dy) * MW + e.tx)) continue; // corner already closed orthogonally
    const len = Math.hypot(dx, dy), a = Math.atan2(dy, dx), h = heightAt(e.x, e.y);
    q.setFromAxisAngle(up, -a); m4.compose(new THREE.Vector3(e.x, h, e.y), q, new THREE.Vector3(len, 1, 1));
    R3.wallSeg.setMatrixAt(n, m4); R3.wallCap.setMatrixAt(n, m4); col.setHex(TEAMPAINT[e.team]); R3.wallCap.setColorAt(n, col); n++;
  }
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
