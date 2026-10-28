'use strict';
// ===== v7.3 construction animation (RENDER ONLY: reads e.con.p / e.con.w, never writes sim state; Math.random only feeds particles) =====
// Stages by build progress p: ground marking + rebar (0-8%), foundation pour (2-14%), scaffold + crane rise (5-24%), steel frame (12-42%),
// walls assemble course by course from the ground up with welding sparks (22-88%), faction-colored panels snap on (72-92%),
// completion: flash + dust burst + chime, scaffold and crane drop away. Walls/gates use a cheap version (1-2 draw calls).
const CS = { mats: {}, budget: 0, on: typeof THREE !== 'undefined' };
const CS_BOX = CS.on ? new THREE.BoxGeometry(1, 1, 1) : null;
const csS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function csMat(c, emi) { const k = c + '|' + (emi || 0); return CS.mats[k] || (CS.mats[k] = new THREE.MeshLambertMaterial({ color: c, emissive: emi ? c : 0, emissiveIntensity: emi || 0 })); }
// merge many boxes into ONE geometry (one draw call per material): list of [sx, sy, sz, x, y, z, rotZ, rotY]
function csMerge(list) { const pos = [], nor = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Matrix3();
  const src = CS_BOX.toNonIndexed(), P = src.attributes.position.array, Nn = src.attributes.normal.array;
  for (const b of list) { E.set(0, b[7] || 0, b[6] || 0); Q.setFromEuler(E); M.compose(V.set(b[3], b[4], b[5]), Q, S.set(b[0], b[1], b[2])); N.getNormalMatrix(M);
    for (let i = 0; i < P.length; i += 3) { const v = new THREE.Vector3(P[i], P[i + 1], P[i + 2]).applyMatrix4(M); pos.push(v.x, v.y, v.z); const n = new THREE.Vector3(Nn[i], Nn[i + 1], Nn[i + 2]).applyMatrix3(N).normalize(); nor.push(n.x, n.y, n.z); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return g; }
const csWall = t => t === 'wall' || t === 'gate' || t === 'gtower';
function csLite() { return !R3.q || R3.q.quiet || R3.qName === 'mobile' || R3.qName === 'low'; }
function makeSite(e, o) {
  if (!R3.renderer.localClippingEnabled) R3.renderer.localClippingEnabled = true;
  const s = new THREE.Group(), wall = csWall(e.t), W = e.w * 0.98, D = e.h * 0.98, sz = Math.sqrt(e.w * e.h), cs = { s, wall, sz, W, D, own: [], snap: [], course: -1, p: 0, doneT: -1 };
  // body extents (group-local), measured at full height
  o.body.scale.y = 1; o.g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o.body), gp = o.g.position;
  const cl = (v, m) => Math.max(-m, Math.min(m, v)); cs.x0 = cl(bb.min.x - gp.x, W * 0.55); cs.x1 = cl(bb.max.x - gp.x, W * 0.55); cs.z0 = cl(bb.min.z - gp.z, D * 0.55); cs.z1 = cl(bb.max.z - gp.z, D * 0.55);
  cs.bh = Math.max(0.25, Math.min(3.4, bb.max.y - gp.y)); const bh = cs.bh;
  // 1) ground marking: survey tape + corner stakes, rebar grid
  const tape = [[W, 0.02, 0.04, 0, 0.02, -D / 2], [W, 0.02, 0.04, 0, 0.02, D / 2], [0.04, 0.02, D, -W / 2, 0.02, 0], [0.04, 0.02, D, W / 2, 0.02, 0]];
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) tape.push([0.04, 0.28, 0.04, x, 0.14, z]);
  cs.mark = new THREE.Mesh(csMerge(tape), csMat(0xff8a1a, 0.35)); s.add(cs.mark); cs.own.push(cs.mark.geometry);
  if (!wall) { const rb = []; const n = Math.max(2, Math.round(sz * 2)); for (let i = 1; i < n; i++) { rb.push([W * 0.92, 0.02, 0.02, 0, 0.05, -D / 2 + D * i / n]); rb.push([0.02, 0.02, D * 0.92, -W / 2 + W * i / n, 0.05, 0]); }
    cs.rebar = new THREE.Mesh(csMerge(rb), csMat(0x6a4630)); s.add(cs.rebar); cs.own.push(cs.rebar.geometry); }
  // 2) foundation slab: own material so the poured concrete can dry from dark-wet to light-grey
  cs.slabM = new THREE.MeshLambertMaterial({ color: 0x4a4a48 }); cs.slab = new THREE.Mesh(CS_BOX, cs.slabM); cs.slab.receiveShadow = true; s.add(cs.slab);
  // 3) scaffold (merged): poles round the perimeter, rails + planks per level, cross braces
  const ht = wall ? 0.62 : Math.min(3.4, bh + 0.25), sp = 0.55, nx = Math.max(2, Math.round(W / sp) + 1), nz = Math.max(2, Math.round(D / sp) + 1), lv = wall ? 2 : Math.max(2, Math.round(ht / 0.45)), poles = [], rails = [], planks = [];
  const pw = W + 0.12, pd = D + 0.12;
  for (let i = 0; i < nx; i++) for (const z of [-pd / 2, pd / 2]) poles.push([0.045, ht, 0.045, -pw / 2 + pw * i / (nx - 1), ht / 2, z]);
  for (let j = 1; j < nz - 1; j++) for (const x of [-pw / 2, pw / 2]) poles.push([0.045, ht, 0.045, x, ht / 2, -pd / 2 + pd * j / (nz - 1)]);
  for (let l = 1; l <= lv; l++) { const y = ht * l / lv - 0.02; rails.push([pw, 0.035, 0.035, 0, y, -pd / 2], [pw, 0.035, 0.035, 0, y, pd / 2], [0.035, 0.035, pd, -pw / 2, y, 0], [0.035, 0.035, pd, pw / 2, y, 0]);
    if (l < lv) planks.push([pw + 0.1, 0.03, 0.13, 0, y + 0.03, pd / 2 + 0.07], [pw + 0.1, 0.03, 0.13, 0, y + 0.03, -pd / 2 - 0.07]); }
  if (!wall) { const br = Math.hypot(pw, ht / lv), a = Math.atan2(ht / lv, pw); for (let l = 0; l < lv; l++) for (const z of [-pd / 2 - 0.02, pd / 2 + 0.02]) poles.push([br, 0.025, 0.025, 0, ht * (l + 0.5) / lv, z, (l + (z > 0 ? 1 : 0)) % 2 ? a : -a]); }
  cs.scaf = new THREE.Group(); s.add(cs.scaf);
  for (const [L, c] of [[poles, 0xb8bcc0], [rails, 0xe0a830], [planks, 0x8b5a2b]]) if (L.length) { const m = new THREE.Mesh(csMerge(L), csMat(c)); cs.scaf.add(m); cs.own.push(m.geometry); }
  cs.ht = ht;
  // work lamp (blinks while work goes on)
  cs.lampM = new THREE.MeshBasicMaterial({ color: 0xffb030 }); cs.lamp = new THREE.Mesh(CS_BOX, cs.lampM); cs.lamp.scale.setScalar(0.1); cs.lamp.position.set(-pw / 2, ht + 0.07, -pd / 2); cs.scaf.add(cs.lamp);
  if (!wall) {
    // 4) steel frame: columns + level beams hugging the body extents (merged; grows upward)
    const fr = [], fx = [cs.x0 + 0.04, cs.x1 - 0.04], fz = [cs.z0 + 0.04, cs.z1 - 0.04], mx = (fx[0] + fx[1]) / 2, mz = (fz[0] + fz[1]) / 2, fl = Math.max(2, Math.round(bh / 0.4));
    for (const x of [fx[0], mx, fx[1]]) for (const z of [fz[0], mz, fz[1]]) if (x !== mx || z !== mz) fr.push([0.06, bh, 0.06, x, bh / 2, z]);
    for (let l = 1; l <= fl; l++) { const y = bh * l / fl - 0.03; fr.push([fx[1] - fx[0], 0.05, 0.05, mx, y, fz[0]], [fx[1] - fx[0], 0.05, 0.05, mx, y, fz[1]], [0.05, 0.05, fz[1] - fz[0], fx[0], y, mz], [0.05, 0.05, fz[1] - fz[0], fx[1], y, mz]); }
    cs.frame = new THREE.Mesh(csMerge(fr), csMat(0x5a6068)); s.add(cs.frame); cs.own.push(cs.frame.geometry);
    // working deck: hides the open cut while the walls rise
    cs.deck = new THREE.Mesh(CS_BOX, csMat(0x3a3d42)); s.add(cs.deck);
    // 5) faction-colored panels that snap on (one per side), team accent colour
    const tc = TEAMCOL[e.team] != null ? TEAMCOL[e.team] : 0xffd060, pm = csMat(tc, 0.4), ph = Math.max(0.06, bh * 0.08), py = bh * 0.32;
    cs.panels = [[cs.x1 - cs.x0, ph, 0.05, (cs.x0 + cs.x1) / 2, py, cs.z1 + 0.03], [0.05, ph, cs.z1 - cs.z0, cs.x1 + 0.03, py, (cs.z0 + cs.z1) / 2], [cs.x1 - cs.x0, ph, 0.05, (cs.x0 + cs.x1) / 2, py, cs.z0 - 0.03], [0.05, ph, cs.z1 - cs.z0, cs.x0 - 0.03, py, (cs.z0 + cs.z1) / 2]]
      .map(b => { const m = new THREE.Mesh(CS_BOX, pm); m.scale.set(b[0], b[1], b[2]); m.position.set(b[3], b[4], b[5]); m.userData.y = b[4]; m.visible = false; s.add(m); return m; });
    // 6) crane (big sites) or a small hoist mast (1-tile defenses)
    const big = sz >= 1.7, mh = ht + (big ? 0.9 : 0.45), jl = big ? Math.max(1.3, W * 0.85) : 0.7, cr = new THREE.Group(), cy = 0xf2c230;
    cr.position.set(pw / 2 - 0.08, 0, -pd / 2 + 0.08);
    const mast = [[0.1, mh, 0.1, 0, mh / 2, 0]]; if (big) for (let k = 1; k < Math.round(mh / 0.3); k++) mast.push([0.13, 0.025, 0.13, 0, k * 0.3, 0]);
    const mm = new THREE.Mesh(csMerge(mast), csMat(cy)); mm.castShadow = true; cr.add(mm); cs.own.push(mm.geometry);
    const sl = new THREE.Group(); sl.position.y = mh; cr.add(sl);
    const jb = [[jl, 0.07, 0.07, -jl / 2 + 0.05, 0.04, 0], [0.18, 0.14, 0.14, 0, -0.03, 0]]; if (big) jb.push([jl * 0.35, 0.06, 0.06, jl * 0.175, 0.04, 0], [0.2, 0.16, 0.16, jl * 0.33, 0, 0], [0.04, 0.3, 0.04, 0, 0.18, 0]);
    const jm = new THREE.Mesh(csMerge(jb), csMat(cy)); jm.castShadow = true; sl.add(jm); cs.own.push(jm.geometry);
    const tr = new THREE.Group(); sl.add(tr); const cab = new THREE.Mesh(CS_BOX, csMat(0x2a2a2a)); cab.scale.set(0.015, 1, 0.015); tr.add(cab);
    const load = new THREE.Mesh(CS_BOX, csMat(0x6a7078)); load.scale.set(big ? 0.5 : 0.3, 0.06, 0.08); tr.add(load);
    s.add(cr); Object.assign(cs, { crane: cr, slew: sl, trolley: tr, cable: cab, load, jl, mh, pm, loadSteel: csMat(0x6a7078) });
    // 7) clipping: the real model is revealed from the ground up (own material clone per site; restored on completion)
    const base = pbrMaterial(), cm = base.clone(); cm.onBeforeCompile = base.onBeforeCompile; cm.customProgramCacheKey = base.customProgramCacheKey; cs.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0); cm.clippingPlanes = [cs.plane]; cm.clipShadows = true;
    cs.cm = cm; cs.base = base; o.body.traverse(m => { if (m.isMesh && m.material === base) m.material = cm; });
    cs.courses = Math.max(3, Math.min(9, Math.round(bh / 0.22)));
  }
  o.g.add(s); return cs;
}
function csRestore(o) { const cs = o.cs; if (!cs) return; if (cs.cm) { o.body.traverse(m => { if (m.isMesh && m.material === cs.cm) m.material = cs.base; }); cs.cm.dispose(); cs.cm = null; } o.body.visible = true; }
function csDispose(o) { const cs = o.cs; if (!cs) return; csRestore(o); o.g.remove(cs.s); for (const g of cs.own) g.dispose(); cs.slabM.dispose(); cs.lampM.dispose(); o.cs = null; }
function csSpark(x, y, z, n, sp, white) { for (let i = 0; i < n && CS.budget > 0; i++, CS.budget--) FX.spark.spawn(x, y, z, rnd(sp), rnd(sp), Math.random() * sp, 0.25 + Math.random() * 0.35, 0.06, 0.015, 1, white ? 0.95 : 0.78, white ? 0.85 : 0.35, 1, 9, 0); }
function csPuff(x, y, z, size, rise) { if (CS.budget-- > 0) puff(x, y, z, size, 1.6, G.desert ? 0.74 : 0.62, 0.42, rise); }
function csFrameStart() { CS.budget = Math.round((csLite() ? 10 : 28) * Math.max(0.3, FX.mul)); }
// per frame for a visible building with a site (under construction, or just finished -> drop-away)
function conAnim(e, o, dt) {
  if (e.con && !o.cs) o.cs = makeSite(e, o); const cs = o.cs; if (!cs) return;
  const gy = o.g.position.y, T = R3.time, W = cs.W, D = cs.D, lite = csLite(), m = FX.mul * (lite ? 0.5 : 1), wx = e.x, wz = e.y;
  if (!e.con) { // finished: scaffold + crane fall away, slab sinks, then the site is removed
    if (cs.doneT < 0) { cs.doneT = T; csRestore(o); o.body.scale.y = 1; for (const k of ['mark', 'rebar', 'frame', 'deck']) if (cs[k]) cs[k].visible = false; if (cs.panels) cs.panels.forEach(p => p.visible = false); }
    const t = (T - cs.doneT) / 0.85; if (t >= 1) { csDispose(o); return; }
    const f = t * t; cs.scaf.position.y = -cs.ht * 1.1 * f; cs.scaf.scale.set(1 + 0.08 * t, 1 - 0.5 * f, 1 + 0.08 * t);
    if (cs.crane) { cs.crane.rotation.z = -1.1 * f; cs.crane.position.y = -0.6 * f; cs.crane.scale.setScalar(Math.max(0.05, 1 - 0.7 * f)); cs.crane.visible = t < 0.85; }
    cs.slab.position.y = 0.05 - 0.12 * t; return;
  }
  const p = cs.p = cs.p + (e.con.p - cs.p) * Math.min(1, dt * 8), wait = !!e.con.w;
  if (cs.wall) { // cheap walls: tape -> slab -> low scaffold, the wall block rises
    cs.mark.visible = p < 0.25; const a = csS(0, 0.2, p); cs.slab.scale.set(W * (0.6 + 0.4 * a), 0.01 + 0.07 * a, D * (0.6 + 0.4 * a)); cs.slab.position.y = cs.slab.scale.y / 2; cs.slabM.color.setHex(p < 0.35 ? 0x55554f : 0x8e8c84);
    cs.scaf.scale.y = 0.05 + 0.95 * csS(0.05, 0.3, p); o.body.scale.y = 0.04 + 0.96 * csS(0.25, 1, p); cs.lamp.visible = !lite;
    if (!wait && Math.random() < dt * 1.2 * m) csSpark(wx + rnd(W * 0.5), wz + rnd(D * 0.5), gy + 0.1 + o.body.scale.y * 0.5, 2, 0.8); return; }
  // ground marking + rebar, then the pour
  cs.mark.visible = p < 0.3; if (cs.rebar) cs.rebar.visible = p < 0.1;
  const pour = csS(0.02, 0.14, p); cs.slab.visible = pour > 0; cs.slab.scale.set(W * (0.35 + 0.65 * pour), 0.005 + 0.1 * pour, D * (0.35 + 0.65 * pour)); cs.slab.position.y = cs.slab.scale.y / 2;
  { const dry = csS(0.12, 0.3, p); cs.slabM.color.setRGB(0.29 + 0.31 * dry, 0.29 + 0.3 * dry, 0.28 + 0.28 * dry); }
  // scaffold and crane rise
  const rise = csS(0.05, 0.24, p); cs.scaf.visible = rise > 0.01; cs.scaf.scale.y = Math.max(0.01, rise);
  cs.crane.visible = p > 0.05; cs.crane.scale.y = Math.max(0.01, csS(0.05, 0.2, p));
  // crane works: slews back and forth, trolley runs along the jib, hook lifts a steel beam then a coloured panel
  if (!wait) { cs.slew.rotation.y = Math.sin(T * 0.4 + e.id) * 0.9 + 0.5; const tx = -cs.jl * (0.45 + 0.35 * Math.sin(T * 0.55 + e.id * 1.7)), L = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(T * 0.8 + e.id)); cs.trolley.position.x = tx; cs.cable.scale.y = L; cs.cable.position.y = -L / 2; cs.load.position.y = -L - 0.03; }
  cs.load.visible = p > 0.14 && p < 0.93; cs.load.material = p > 0.7 ? cs.pm : cs.loadSteel;
  // steel frame grows ahead of the walls
  const fr = csS(0.12, 0.42, p); cs.frame.visible = fr > 0.01 && p < 0.92; cs.frame.scale.y = Math.max(0.01, fr);
  // walls: course by course from the ground up (each course slides up quickly, then a short pause)
  const n = cs.courses, f = csS(0.22, 0.88, p) * n, ci = Math.min(n, Math.floor(f)), fr2 = f - ci, h = Math.min(1, (ci + csS(0.45, 1, fr2)) / n), cutY = cs.bh * h;
  o.body.visible = p > 0.2; o.body.scale.y = 1; cs.plane.constant = gy + 0.02 + cutY + (h >= 1 ? 9 : 0);
  const k = 1 - 0.4 * csS(0.5, 1, h); cs.deck.visible = o.body.visible && h > 0.02 && h < 1; cs.deck.scale.set((cs.x1 - cs.x0) * 0.97 * k, 0.03, (cs.z1 - cs.z0) * 0.97 * k); cs.deck.position.set((cs.x0 + cs.x1) / 2, cutY + 0.02, (cs.z0 + cs.z1) / 2);
  if (ci !== cs.course) { if (cs.course >= 0 && ci > cs.course && p > 0.22 && p < 0.9) { // a course locks in: little dust + spark shower round the base
      for (let i = 0; i < Math.round(3 * cs.sz * m); i++) { const a = Math.random() * 6.28; csPuff(wx + Math.cos(a) * W * 0.55, wz + Math.sin(a) * D * 0.55, gy + 0.1, 0.3 + 0.1 * cs.sz, 0.3); }
      csSpark(wx + rnd(W * 0.4), wz + rnd(D * 0.4), gy + cutY, Math.round(5 * m), 1.4); }
    cs.course = ci; }
  // panels snap on (drop in with an overshoot, flash + clank when they lock)
  for (let i = 0; i < 4; i++) { const thr = 0.72 + i * 0.05, pn = cs.panels[i]; if (p >= thr && cs.snap[i] == null) { cs.snap[i] = T; } const st = cs.snap[i]; pn.visible = st != null;
    if (st != null) { const u = Math.min(1, (T - st) / 0.32), back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2); pn.position.y = pn.userData.y + 0.7 * (1 - back);
      if (u >= 1 && !pn.userData.lk) { pn.userData.lk = 1; csSpark(wx + pn.position.x, wz + pn.position.z, gy + pn.position.y, Math.round(6 * m), 1.2); if (e.team === ME && inView(wx, wz)) sfx('clank', wx, wz); } } }
  // lamp blink; welding sparks + blue-white arc flashes along the rising edge; dust off the slab while pouring
  cs.lampM.color.setHex(wait ? 0x6a5020 : Math.sin(T * 9 + e.id) > 0 ? 0xffe070 : 0xff8a20);
  if (wait) return;
  if (p > 0.22 && p < 0.9 && Math.random() < dt * 9 * cs.sz * m) { const side = Math.random() * 4 | 0, u = Math.random(), x = side < 2 ? cs.x0 + (cs.x1 - cs.x0) * u : side === 2 ? cs.x0 : cs.x1, z = side >= 2 ? cs.z0 + (cs.z1 - cs.z0) * u : side === 0 ? cs.z0 : cs.z1;
    csSpark(wx + x, wz + z, gy + cutY + 0.02, 3, 1.1); if (!lite && Math.random() < 0.3 && CS.budget-- > 0) flash(wx + x, wz + z, gy + cutY + 0.04, 0.22, 0.75, 0.85, 1); }
  if (p > 0.12 && p < 0.42 && Math.random() < dt * 3 * cs.sz * m) csSpark(wx + rnd(W * 0.4), wz + rnd(D * 0.4), gy + cs.bh * csS(0.12, 0.42, p), 2, 0.9, 1);
  if (p > 0.02 && p < 0.2 && Math.random() < dt * 2.5 * cs.sz * m) csPuff(wx + rnd(W * 0.45), wz + rnd(D * 0.45), gy + 0.12, 0.25 + 0.08 * cs.sz, 0.25);
}
// completion burst (from the sim's 'built' event, render side only)
function conBurst(b) {
  if (!inView(b.x, b.y)) return; const gy = heightAt(b.x, b.y), wl = csWall(b.t), m = FX.mul * (csLite() ? 0.6 : 1), sz = Math.sqrt(b.w * b.h);
  if (wl) { for (let i = 0; i < 3 * m; i++) puff(b.x + rnd(b.w * 0.5), b.y + rnd(b.h * 0.5), gy + 0.1, 0.3, 1.2, 0.6, 0.4, 0.3); return; }
  flash(b.x, b.y, gy + 1.0, 1.1 + 0.4 * sz, 1, 0.92, 0.7); ring(b.x, b.y, 0.9 + 0.5 * sz);
  const n = Math.round(14 * sz * m); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 0.5 * Math.max(b.w, b.h); FX.smoke.spawn(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, gy + 0.2, Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.35, 1.3, 0.35, 1.3, 0.62, 0.57, 0.48, 0.55, 0); }
  for (let i = 0; i < 10 * sz * m; i++) FX.spark.spawn(b.x + rnd(b.w * 0.5), b.y + rnd(b.h * 0.5), gy + 0.4 + Math.random() * 0.8, rnd(2.2), rnd(2.2), 1 + Math.random() * 2, 0.4 + Math.random() * 0.4, 0.07, 0.02, 1, 0.85, 0.45, 1, 9, 0);
  if (b.team === ME) sfx('built', b.x, b.y);
}
