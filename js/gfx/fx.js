'use strict';
// ===== Effects: instanced billboard particles with procedural flipbook, debris, decals, projectiles =====
function makeFlipbook() {
  const S = 1024, F = 4, fs = S / F, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); const R = mkRng(77);
  for (let f = 0; f < 16; f++) {
    const ox = (f % F) * fs + fs / 2, oy = Math.floor(f / F) * fs + fs / 2, k = f / 15;
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, d = R() * fs * (0.12 + 0.18 * k), r = fs * (0.1 + R() * 0.14) * (0.8 + k * 0.6);
      const px = ox + Math.cos(a) * d, py = oy + Math.sin(a) * d;
      const g = x.createRadialGradient(px, py - r * 0.25, 0, px, py, r);
      const br = 255 - Math.floor(R() * 60 + (py - oy + fs * 0.3) * 0.3), al = (0.32 - k * 0.12) * (0.6 + R() * 0.5);
      g.addColorStop(0, `rgba(${br},${br},${br},${al})`); g.addColorStop(0.6, `rgba(${br - 30},${br - 30},${br - 30},${al * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    }
    // erode later frames
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < k * 30; i++) { const px = ox + (R() - 0.5) * fs * 0.7, py = oy + (R() - 0.5) * fs * 0.7, r = fs * 0.04 * (1 + R() * 2); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-over';
  }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
class PSys {
  constructor(n, additive, tex, flip) {
    this.n = n; this.i = 0;
    const base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    this.A = new Float32Array(n * 4); this.B = new Float32Array(n * 4); this.C = new Float32Array(n * 4); this.D = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) this.B[i * 4 + 3] = -1;
    this.aA = new THREE.InstancedBufferAttribute(this.A, 4).setUsage(THREE.DynamicDrawUsage); this.aB = new THREE.InstancedBufferAttribute(this.B, 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(this.C, 4).setUsage(THREE.DynamicDrawUsage); this.aD = new THREE.InstancedBufferAttribute(this.D, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iA', this.aA); g.setAttribute('iB', this.aB); g.setAttribute('iC', this.aC); g.setAttribute('iD', this.aD); g.instanceCount = n;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uTime: R3.uTime, uTex: { value: tex }, uLight: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: `attribute vec4 iA, iB, iC, iD; uniform float uTime; varying vec2 vUv; varying vec4 vCol; varying float vK;
        void main(){ float t = uTime - iA.w; float k = t / iB.w; vK = k;
          if (k < 0.0 || k > 1.0 || iB.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float drag = 1.0 - 0.45*k;
          vec3 p = iA.xyz + iB.xyz * t * drag + vec3(0.0, -0.5 * iC.w * t * t, 0.0);
          float sz = mix(iC.x, iC.y, 1.0 - (1.0-k)*(1.0-k));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float r = iC.z * (1.0 + t*0.4); vec2 o = position.xy * sz; o = vec2(o.x*cos(r) - o.y*sin(r), o.x*sin(r) + o.y*cos(r));
          mv.xy += o; gl_Position = projectionMatrix * mv; vUv = uv; vCol = iD; }`,
      fragmentShader: `uniform sampler2D uTex; uniform vec3 uLight; varying vec2 vUv; varying vec4 vCol; varying float vK;
        void main(){ vec4 tx;
          ${flip ? `float f = floor(vK * 15.0); vec2 cell = vec2(mod(f, 4.0), 3.0 - floor(f / 4.0)); tx = texture2D(uTex, (cell + vUv) / 4.0);` : `tx = texture2D(uTex, vUv);`}
          float fade = smoothstep(0.0, 0.08, vK) * (1.0 - smoothstep(0.55, 1.0, vK));
          ${additive ? `gl_FragColor = vec4(vCol.rgb * tx.a * vCol.a * fade * (1.0 + (1.0 - vK)*1.5), 1.0);` : `gl_FragColor = vec4(vCol.rgb * tx.rgb * uLight, tx.a * vCol.a * fade);`}
          if (gl_FragColor.a < 0.003) discard; }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 9 : 8; R3.scene.add(this.mesh); this.dirty = false;
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, rot) {
    const i = this.i++ % this.n, j = i * 4;
    this.A[j] = x; this.A[j + 1] = z; this.A[j + 2] = y; this.A[j + 3] = R3.uTime.value;
    this.B[j] = vx; this.B[j + 1] = vz; this.B[j + 2] = vy; this.B[j + 3] = life;
    this.C[j] = s0; this.C[j + 1] = s1; this.C[j + 2] = rot != null ? rot : (Math.random() - 0.5) * 6; this.C[j + 3] = grav || 0;
    this.D[j] = r; this.D[j + 1] = g; this.D[j + 2] = b; this.D[j + 3] = a; this.dirty = true;
  }
  update() { if (!this.dirty) return; this.aA.needsUpdate = this.aB.needsUpdate = this.aC.needsUpdate = this.aD.needsUpdate = true; this.dirty = false; }
}
const FX = {};
function buildFx3() {
  const flip = makeFlipbook(), gl = glowTex();
  FX.smoke = new PSys(5000, false, flip, true);
  FX.fire = new PSys(4000, true, flip, true);
  FX.spark = new PSys(3000, true, gl, false);
  FX.mul = 1;
  // debris
  const B = new MB(0); B.box('d', 1, 1, 1, 0x3a3a3a, PBR.DARKM, 0, 0, 0, { bevel: 0.15 }); FX.debrisGeo = B.build().d;
  FX.debris = new THREE.InstancedMesh(FX.debrisGeo, pbrMaterial(), 200); FX.debris.castShadow = true; FX.debris.frustumCulled = false; FX.debris.count = 200; R3.scene.add(FX.debris);
  FX.dList = []; for (let i = 0; i < 200; i++) FX.dList.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: 0.1, burn: false });
  FX.dIdx = 0; const zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < 200; i++) FX.debris.setMatrixAt(i, zero);
  // scorch decals (instanced, fade via scale on color)
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const x = sc.getContext('2d'); const R = mkRng(3);
  for (let i = 0; i < 40; i++) { const px = 64 + (R() - 0.5) * 50, py = 64 + (R() - 0.5) * 50, r = 10 + R() * 30, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(10,8,6,.35)'); g.addColorStop(1, 'rgba(10,8,6,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  const st = new THREE.CanvasTexture(sc);
  FX.scorch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 80);
  FX.scorch.frustumCulled = false; FX.scorch.renderOrder = 1; for (let i = 0; i < 80; i++) FX.scorch.setMatrixAt(i, zero); R3.scene.add(FX.scorch); FX.sList = []; FX.sIdx = 0;
  // shockwave rings
  FX.rings = []; for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; R3.scene.add(m); FX.rings.push({ m, t: 0, s: 1 }); }
  // projectiles (instanced)
  const PB = new MB(0); PB.cyl('rocket', 0.035, 0.28, COL.LIGHT, PBR.METAL, 0, 0, 0, { rz: Math.PI / 2, seg: 6 }); PB.glow('rocket', 0.06, 0.06, 0.06, 0xffaa44, -0.16, 0, 0);
  PB.sph('shell', 0.07, 0xffc070, PBR.GLOW, 0, 0, 0, { seg: 8 }); PB.box('tracer', 0.5, 0.025, 0.025, 0xffe7a0, [0, 0.5, 6], 0, 0, 0, { bevel: 0 }); PB.sph('flak', 0.05, 0xffd080, PBR.GLOW, 0, 0, 0, { seg: 6 });
  const pg = PB.build(); FX.proj = {};
  for (const k of ['rocket', 'shell', 'tracer', 'flak']) { const im = new THREE.InstancedMesh(pg[k], pbrMaterial(), 400); im.frustumCulled = false; im.count = 0; R3.scene.add(im); FX.proj[k] = im; }
}
const _m4 = typeof THREE !== 'undefined' ? new THREE.Matrix4() : null, _q = typeof THREE !== 'undefined' ? new THREE.Quaternion() : null, _e = typeof THREE !== 'undefined' ? new THREE.Euler() : null, _v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null, _s = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const rnd = (a) => (Math.random() - 0.5) * a;
function puff(x, y, z, size, life, shade, alpha, rise) { FX.smoke.spawn(x, y, z, rnd(0.4), rnd(0.4), rise != null ? rise : 0.5 + Math.random() * 0.5, life, size * 0.6, size * 1.8, shade, shade * 0.97, shade * 0.93, alpha * 0.8, -0.05); }
function flash(x, y, z, size, r, g, b) { FX.spark.spawn(x, y, z, 0, 0, 0, 0.09, size, size * 1.3, r, g, b, 1, 0, 0); }
function sparks(x, y, z, n, sp) { for (let i = 0; i < n * FX.mul; i++) FX.spark.spawn(x, y, z, rnd(sp), rnd(sp), Math.random() * sp * 0.8, 0.3 + Math.random() * 0.4, 0.06, 0.02, 1, 0.75, 0.35, 1, 9, 0); }
function explosion3(x, y, z, size) {
  const n = Math.round((8 + size * 10) * FX.mul);
  flash(x, y, z + 0.3, size * 2.6, 1, 0.85, 0.6);
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = (0.5 + Math.random()) * size * 1.6;
    FX.fire.spawn(x + rnd(size * 0.4), y + rnd(size * 0.4), z + 0.15 + Math.random() * 0.2 * size, Math.cos(a) * sp, Math.sin(a) * sp, Math.random() * 1.8 * size, 0.35 + Math.random() * 0.4, size * 0.5, size * 1.4, 1, 0.45 + Math.random() * 0.25, 0.12, 0.9, -1.5); }
  for (let i = 0; i < n * 0.8; i++) puff(x + rnd(size), y + rnd(size), z + 0.3 + Math.random() * 0.4 * size, size * (0.7 + Math.random() * 0.6), 1.6 + Math.random() * 1.8, 0.13 + Math.random() * 0.1, 0.8, 0.5 + Math.random() * 0.9);
  sparks(x, y, z + 0.2, 6 + size * 8, 5 * size);
  if (size >= 0.8) debris(x, y, z + 0.3, Math.round(size * 5), 0x3a3634, size > 1.2);
  scorch3(x, y, size * 1.6); ring(x, y, size * 2.2);
}
function ring(x, y, s) { const r = FX.rings.find(r => r.t <= 0) || FX.rings[0]; r.t = 0.45; r.s = s; r.m.visible = true; r.m.position.set(x, heightAt(x, y) + 0.12, y); }
function scorch3(x, y, s) { const i = FX.sIdx++ % 80; FX.sList[i] = { x, y, s, life: 30, rot: Math.random() * 6 }; }
function debris(x, y, z, n, col, burn) {
  for (let k = 0; k < n * FX.mul; k++) { const d = FX.dList[FX.dIdx++ % FX.dList.length]; d.life = 1.6 + Math.random() * 1.2; d.p.set(x, z, y); d.v.set(rnd(6), 3 + Math.random() * 4.5, rnd(6)); d.r.set(Math.random() * 6, Math.random() * 6, 0); d.s = 0.05 + Math.random() * 0.13; d.burn = burn && Math.random() < 0.5; }
}
function updFx(dt) {
  FX.smoke.update(); FX.fire.update(); FX.spark.update();
  let dn = false;
  FX.dList.forEach((d, i) => { if (d.life <= 0) { if (d.was) { FX.debris.setMatrixAt(i, _m4.makeScale(0, 0, 0)); d.was = false; dn = true; } return; }
    d.was = true; dn = true; d.life -= dt; d.v.y -= 13 * dt; d.p.addScaledVector(d.v, dt); d.r.x += dt * 7; d.r.y += dt * 5;
    const gh = heightAt(d.p.x, d.p.z); if (d.p.y < gh + d.s * 0.5) { d.p.y = gh + d.s * 0.5; d.v.y *= -0.3; d.v.x *= 0.5; d.v.z *= 0.5; }
    if (d.burn && Math.random() < dt * 20) puff(d.p.x, d.p.z, d.p.y, 0.15, 0.8, 0.12, 0.6, 0.6);
    _q.setFromEuler(d.r); const sc = d.s * Math.min(1, d.life * 2); FX.debris.setMatrixAt(i, _m4.compose(d.p, _q, _s.set(sc, sc, sc))); });
  if (dn) FX.debris.instanceMatrix.needsUpdate = true;
  let sn = false;
  FX.sList.forEach((s, i) => { if (!s || s.life <= 0) return; s.life -= dt; sn = true; const k = s.life > 0 ? Math.min(1, s.life / 8) : 0, sc = s.s * (0.7 + 0.3 * k);
    _e.set(0, s.rot, 0); _q.setFromEuler(_e); FX.scorch.setMatrixAt(i, _m4.compose(_v.set(s.x, heightAt(s.x, s.y) + 0.04, s.y), _q, _s.set(sc * (k > 0 ? 1 : 0), 1, sc * (k > 0 ? 1 : 0)))); });
  if (sn) FX.scorch.instanceMatrix.needsUpdate = true;
  for (const r of FX.rings) if (r.t > 0) { r.t -= dt; const k = 1 - r.t / 0.45; r.m.scale.setScalar(0.2 + k * r.s); r.m.material.opacity = (1 - k) * 0.8; if (r.t <= 0) r.m.visible = false; }
  // projectiles
  const cnt = { rocket: 0, shell: 0, tracer: 0, flak: 0 };
  for (const p of G.projs) {
    if (p.delay > 0) continue; const vis = !G.opts.fog || G.vis[idx(Math.floor(p.x), Math.floor(p.y))]; if (!vis) continue;
    const k = p.kind === 'bullet' ? 'tracer' : p.kind === 'cannon' ? 'shell' : p.kind; const im = FX.proj[k]; if (!im || cnt[k] >= 400) continue;
    const gz = heightAt(p.x, p.y) * (p.tz > 1.5 ? 0.3 : 1) + p.z, ang = Math.atan2(p.ty - p.y, p.tx - p.x);
    _e.set(0, -ang, 0); _q.setFromEuler(_e); im.setMatrixAt(cnt[k]++, _m4.compose(_v.set(p.x, gz, p.y), _q, _s.set(1, 1, 1)));
    if (p.kind === 'rocket' && Math.random() < 0.9 * FX.mul) puff(p.x, p.y, gz, 0.1, 0.8, 0.42, 0.4, 0.2);
    if ((p.kind === 'shell') && Math.random() < 0.7 * FX.mul) FX.fire.spawn(p.x, p.y, gz, 0, 0, 0, 0.25, 0.15, 0.05, 1, 0.6, 0.3, 0.8, 0, 0);
    if (p.kind === 'cannon' && Math.random() < 0.5 * FX.mul) puff(p.x, p.y, gz, 0.07, 0.4, 0.6, 0.35, 0.1);
  }
  for (const k in FX.proj) { FX.proj[k].count = cnt[k]; FX.proj[k].instanceMatrix.needsUpdate = true; }
}
