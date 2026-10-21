'use strict';
// ===== Procedural PBR models: merged geometry with per-vertex color + pbr(metal, rough, emissive) =====
const PBR = { PAINT: [0.12, 0.62, 0], METAL: [0.7, 0.48, 0], DARKM: [0.45, 0.62, 0], RUB: [0, 0.92, 0], CONC: [0, 0.9, 0], GLASS: [0.1, 0.18, 0.12], CLOTH: [0, 0.9, 0.001], ACC: [0.1, 0.5, 0.25], BPAINT: [0.1, 0.66, 0], GLOW: [0, 0.5, 2.0], GLOW2: [0, 0.5, 1.4], ORE: [0.55, 0.28, 0.22] };
const COL = { STEEL: 0x585d61, DARK: 0x2a2c2b, GUN: 0x1b1c1c, RUB: 0x151617, LIGHT: 0x8e8f88, KHAKI: 0x6b6446, PANTS: 0x4a4a36, WHITE: 0xc8c8c0, YEL: 0xb88a1c, GLASS: 0x86d4ff, HEAD: 0xfff1c4, RED: 0xff3322, GRN: 0x33ff66, CONC: 0x8d9094, CONCD: 0x6c6f73, SKIN: 0xd9a37a, ORE: 0xffc23a, SAND: 0xa59872 };
let PBR_MAT = null;
const GLSL_NOISE_M = `
float h12m(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise3(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h12m(i), h12m(i+vec2(1,0)), u.x), mix(h12m(i+vec2(0,1)), h12m(i+vec2(1,1)), u.x), u.y); }
float fbm3(vec2 p){ return 0.5*vnoise3(p) + 0.3*vnoise3(p*2.1+7.0) + 0.2*vnoise3(p*4.3+3.0); }
`;
// fog-of-war applied inside shaders (sampled from a 64x64 alpha texture in world space)
const FOW = { uMapS: { value: new THREE.Vector2(96, 96) }, uFow: { value: null }, uFowC: { value: new THREE.Color(0x04070b) }, uFowOn: { value: 1 } };
function fowPatch(sh) {
  sh.uniforms.uFow = FOW.uFow; sh.uniforms.uMapS = FOW.uMapS; sh.uniforms.uFowC = FOW.uFowC; sh.uniforms.uFowOn = FOW.uFowOn;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFowW;').replace('#include <project_vertex>', `#include <project_vertex>
    vec4 fowP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    fowP = instanceMatrix * fowP;
    #endif
    vFowW = (modelMatrix * fowP).xyz;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFowW; uniform sampler2D uFow; uniform vec2 uMapS; uniform vec3 uFowC; uniform float uFowOn;')
    .replace('#include <tonemapping_fragment>', `if (uFowOn > 0.5) { float fa = texture2D(uFow, vec2(vFowW.x / uMapS.x, 1.0 - vFowW.z / uMapS.y)).a; gl_FragColor.rgb = mix(gl_FragColor.rgb, uFowC, fa * 0.97); }
    #include <tonemapping_fragment>`);
}
function pbrMaterial() {
  if (PBR_MAT) return PBR_MAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, envMapIntensity: 0.42 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 pbr;\nvarying vec3 vPbr;\nvarying vec3 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = pbr; vLoc = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPbr;\nvarying vec3 vLoc;\n' + GLSL_NOISE_M)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vPbr.z < 0.01) {
          float paint = 1.0 - step(0.006, abs(vPbr.y - 0.62));
          float cm = fbm3(vLoc.xz * 5.0 + vLoc.y * 2.5);
          diffuseColor.rgb *= mix(1.0, mix(0.78, 1.08, smoothstep(0.42, 0.52, cm)) * mix(1.0, 0.86, smoothstep(0.6, 0.66, cm)), paint);
          float gr = vnoise3(vLoc.xz * 22.0 + vLoc.y * 17.0);
          diffuseColor.rgb *= 1.0 - 0.22 * gr * gr;
          float dirt = 1.0 - smoothstep(0.02, 0.3, vLoc.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.105, 0.075), dirt * 0.5);
        }`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.x;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vPbr.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vPbr.z;');
    fowPatch(sh);
  };
  m.customProgramCacheKey = () => 'pbrv2';
  return PBR_MAT = m;
}
const _geoCache = {};
function bevelBoxGeo(w, h, d, b) {
  b = Math.min(b, w / 2.2, h / 2.2, d / 2.2);
  const key = [w, h, d, b].map(v => v.toFixed(3)).join(',');
  if (_geoCache[key]) return _geoCache[key];
  const s = new THREE.Shape(), x = w / 2 - b, z = d / 2 - b;
  s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.lineTo(-x, -z);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, -(h / 2 - b), 0);
  return _geoCache[key] = g.index ? g.toNonIndexed() : g;
}
class MB {
  constructor(team) { this.team = team; this.parts = {}; this.piv = {}; }
  col(c) { if (this.bld && (c === COL.LIGHT || c === COL.STEEL)) return new THREE.Color(c).lerp(new THREE.Color(TEAMPAINT[this.team]), c === COL.LIGHT ? 0.55 : 0.3); if (c === 'T') return new THREE.Color(TEAMPAINT[this.team]); if (c === 'TD') return new THREE.Color(TEAMPAINT[this.team]).multiplyScalar(0.62); if (c === 'TA') return new THREE.Color(TEAMCOL[this.team]); if (c === 'TL') return new THREE.Color(TEAMCOL[this.team]).lerp(new THREE.Color(0xffffff), 0.3); return new THREE.Color(c); }
  add(part, geo, c, pbr, x, y, z, o) {
    if (this.bld && pbr === PBR.PAINT) pbr = PBR.BPAINT;
    o = o || {}; const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv2) g.deleteAttribute('uv2');
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const n = g.attributes.position.count, cl = this.col(c), ca = new Float32Array(n * 3), pa = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ca[i * 3] = cl.r; ca[i * 3 + 1] = cl.g; ca[i * 3 + 2] = cl.b; pa[i * 3] = pbr[0]; pa[i * 3 + 1] = pbr[1]; pa[i * 3 + 2] = pbr[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.setAttribute('pbr', new THREE.BufferAttribute(pa, 3));
    (this.parts[part] = this.parts[part] || []).push(g); return this;
  }
  box(p, w, h, d, c, pbr, x, y, z, o) { const bv = o && o.bevel != null ? o.bevel : Math.min(w, h, d) * 0.14; return this.add(p, bv > 0.004 ? bevelBoxGeo(w, h, d, bv) : new THREE.BoxGeometry(w, h, d), c, pbr, x, y, z, o); }
  cyl(p, r, h, c, pbr, x, y, z, o) { o = o || {}; return this.add(p, new THREE.CylinderGeometry(o.rt != null ? o.rt : r, r, h, o.seg || 16, 1, !!o.open), c, pbr, x, y, z, o); }
  sph(p, r, c, pbr, x, y, z, o) { o = o || {}; const g = new THREE.SphereGeometry(r, o.seg || 14, o.seg ? Math.max(4, o.seg >> 1) : 10, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI); if (o.sx || o.sy || o.sz) g.scale(o.sx || 1, o.sy || 1, o.sz || 1); return this.add(p, g, c, pbr, x, y, z, o); }
  cone(p, r, h, c, pbr, x, y, z, o) { o = o || {}; return this.add(p, new THREE.ConeGeometry(r, h, o.seg || 12), c, pbr, x, y, z, o); }
  torus(p, r, t, c, pbr, x, y, z, o) { o = o || {}; return this.add(p, new THREE.TorusGeometry(r, t, 8, o.seg || 24), c, pbr, x, y, z, o); }
  // barrel pointing along +x with elevation a
  barrel(p, len, r, x, y, z, a, c) { a = a || 0; const cx = x + Math.cos(a) * len / 2, cy = y + Math.sin(a) * len / 2; this.cyl(p, r, len, c || COL.GUN, PBR.DARKM, cx, cy, z, { rz: a - Math.PI / 2, seg: 10 });
    this.cyl(p, r * 1.5, len * 0.14, COL.GUN, PBR.DARKM, x + Math.cos(a) * len * 0.95, y + Math.sin(a) * len * 0.95, z, { rz: a - Math.PI / 2, seg: 10 }); return this; }
  glow(p, w, h, d, c, x, y, z, o) { if (c === 'T') c = 'TA'; return this.box(p, w, h, d, c, PBR.GLOW, x, y, z, Object.assign({ bevel: 0 }, o || {})); }
  build() { const out = {}; for (const k in this.parts) out[k] = mergeGeos(this.parts[k]); out.piv = this.piv; return out; }
}
function mergeGeos(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), pb = new Float32Array(n * 3); let o = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); const c = g.attributes.position.count * 3;
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o); pb.set(g.attributes.pbr.array, o); o += c; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('pbr', new THREE.BufferAttribute(pb, 3));
  g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
// ---------- tank helpers ----------
function tracks(B, L, W, H, wheels) {
  for (const sz of [-1, 1]) {
    const z = sz * W / 2;
    B.box('body', L, H, W * 0.3, COL.RUB, PBR.RUB, 0, H / 2 + 0.01, z, { bevel: H * 0.35 });
    for (let i = 0; i < wheels; i++) B.cyl('body', H * 0.32, W * 0.32, COL.DARK, PBR.DARKM, -L / 2 + L * (i + 0.5) / wheels, H * 0.42, z + sz * 0.005, { rx: Math.PI / 2, seg: 10 });
    B.box('body', L * 1.02, 0.03, W * 0.34, 'TD', PBR.PAINT, 0, H + 0.02, z);
  }
}
const UNIT_MODELS = {
  rifle(B) { inf(B, 'rifle'); }, marine(B) { marineModel(B); }, kommando(B) { inf(B, 'kommando'); B.piv.squad = 3; }, sniper(B) { inf(B, 'sniper'); }, pyro(B) { inf(B, 'pyro'); }, medic(B) { inf(B, 'medic'); }, rocketeer(B) { inf(B, 'rocketeer'); }, engineer(B) { inf(B, 'engineer'); },
  light(B) {
    tracks(B, 0.92, 0.6, 0.2, 5);
    B.box('body', 0.78, 0.17, 0.44, 'T', PBR.PAINT, -0.02, 0.29, 0);
    B.box('body', 0.22, 0.12, 0.42, 'T', PBR.PAINT, 0.4, 0.25, 0, { rz: -0.55 });
    B.box('body', 0.22, 0.05, 0.3, COL.DARK, PBR.DARKM, -0.28, 0.39, 0); for (let i = 0; i < 4; i++) B.box('body', 0.02, 0.02, 0.28, COL.GUN, PBR.DARKM, -0.36 + i * 0.05, 0.42, 0, { bevel: 0 });
    B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.47, 0.3, 0.15); B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.47, 0.3, -0.15);
    B.cyl('body', 0.025, 0.12, COL.GUN, PBR.DARKM, -0.42, 0.33, 0.14, { rz: Math.PI / 2 });
    B.piv.turret = [-0.02, 0.38, 0];
    B.box('turret', 0.4, 0.14, 0.34, 'T', PBR.PAINT, 0, 0.07, 0); B.box('turret', 0.16, 0.11, 0.3, 'TD', PBR.PAINT, -0.22, 0.06, 0);
    B.box('turret', 0.09, 0.1, 0.14, COL.STEEL, PBR.METAL, 0.22, 0.07, 0); B.barrel('turret', 0.48, 0.032, 0.24, 0.07, 0, 0);
    B.cyl('turret', 0.06, 0.04, 'TD', PBR.PAINT, -0.05, 0.16, 0.08); B.cyl('turret', 0.006, 0.4, COL.GUN, PBR.DARKM, -0.2, 0.33, -0.12, { seg: 4 }); B.glow('turret', 0.04, 0.03, 0.03, 'T', -0.31, 0.1, 0);
    B.piv.tip = 0.72;
  },
  heavy(B) {
    tracks(B, 1.18, 0.82, 0.25, 6);
    B.box('body', 1.02, 0.22, 0.6, 'T', PBR.PAINT, -0.03, 0.36, 0); B.box('body', 0.28, 0.15, 0.58, 'T', PBR.PAINT, 0.52, 0.31, 0, { rz: -0.55 });
    for (const z of [-0.36, 0.36]) B.box('body', 1.0, 0.13, 0.04, 'TD', PBR.PAINT, 0, 0.27, z);
    B.box('body', 0.3, 0.06, 0.4, COL.DARK, PBR.DARKM, -0.36, 0.49, 0);
    for (const z of [-0.2, 0.2]) { B.glow('body', 0.03, 0.05, 0.07, COL.HEAD, 0.62, 0.36, z); B.cyl('body', 0.035, 0.16, COL.GUN, PBR.DARKM, -0.56, 0.42, z, { rz: Math.PI / 2 }); }
    B.piv.turret = [-0.04, 0.48, 0];
    B.box('turret', 0.56, 0.18, 0.46, 'T', PBR.PAINT, 0, 0.09, 0); B.box('turret', 0.2, 0.14, 0.4, 'TD', PBR.PAINT, -0.3, 0.08, 0);
    B.box('turret', 0.12, 0.14, 0.3, COL.STEEL, PBR.METAL, 0.3, 0.08, 0);
    B.barrel('turret', 0.6, 0.038, 0.32, 0.09, 0.08, 0); B.barrel('turret', 0.6, 0.038, 0.32, 0.09, -0.08, 0);
    B.cyl('turret', 0.08, 0.05, 'TD', PBR.PAINT, -0.08, 0.2, 0.12); B.box('turret', 0.1, 0.06, 0.06, COL.GUN, PBR.DARKM, -0.08, 0.25, 0.12); B.glow('turret', 0.05, 0.03, 0.03, 'T', -0.41, 0.12, 0);
    B.cyl('turret', 0.006, 0.5, COL.GUN, PBR.DARKM, -0.28, 0.42, -0.16, { seg: 4 });
    B.piv.tip = 0.95;
  },
  arty(B) {
    tracks(B, 1.0, 0.62, 0.2, 5);
    B.box('body', 0.92, 0.16, 0.48, 'T', PBR.PAINT, 0, 0.28, 0); B.box('body', 0.18, 0.08, 0.5, COL.STEEL, PBR.METAL, -0.48, 0.2, 0);
    for (const z of [-0.18, 0.18]) B.box('body', 0.06, 0.12, 0.06, COL.DARK, PBR.DARKM, -0.52, 0.12, z);
    B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.47, 0.3, 0.15); B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.47, 0.3, -0.15);
    B.piv.turret = [-0.08, 0.36, 0];
    B.box('turret', 0.5, 0.22, 0.42, 'T', PBR.PAINT, -0.02, 0.11, 0); B.box('turret', 0.5, 0.04, 0.44, 'TD', PBR.PAINT, -0.02, 0.23, 0);
    B.barrel('turret', 0.95, 0.045, 0.15, 0.14, 0, 0.42); B.cyl('turret', 0.07, 0.3, COL.STEEL, PBR.METAL, 0.18, 0.17, 0, { rz: 0.42 - Math.PI / 2 });
    B.glow('turret', 0.04, 0.03, 0.03, 'T', -0.28, 0.14, 0.15);
    B.piv.tip = 0.95;
  },
  aa(B) {
    tracks(B, 0.88, 0.58, 0.2, 5);
    B.box('body', 0.78, 0.17, 0.44, 'T', PBR.PAINT, 0, 0.29, 0); B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.43, 0.3, 0.14); B.glow('body', 0.03, 0.04, 0.06, COL.HEAD, 0.43, 0.3, -0.14);
    B.piv.turret = [-0.02, 0.38, 0];
    B.box('turret', 0.36, 0.14, 0.34, 'T', PBR.PAINT, 0, 0.07, 0);
    for (const z of [-0.11, 0.11]) { B.box('turret', 0.16, 0.12, 0.08, COL.STEEL, PBR.METAL, 0.08, 0.13, z); B.barrel('turret', 0.42, 0.022, 0.1, 0.16, z, 0.85); B.barrel('turret', 0.42, 0.022, 0.1, 0.16, z + (z > 0 ? 0.04 : -0.04), 0.85); }
    B.piv.rotor = [-0.15, 0.62, 0];
    B.cyl('rotor', 0.012, 0.1, COL.GUN, PBR.DARKM, 0, -0.05, 0); B.box('rotor', 0.04, 0.12, 0.26, COL.LIGHT, PBR.METAL, 0, 0.04, 0, { rz: 0.3 }); B.glow('rotor', 0.02, 0.02, 0.02, COL.RED, 0, 0.11, 0);
    B.piv.tip = 0.45;
  },
  scout(B) {
    B.box('body', 0.68, 0.12, 0.38, 'T', PBR.PAINT, 0, 0.2, 0); B.box('body', 0.2, 0.1, 0.36, 'T', PBR.PAINT, 0.36, 0.17, 0, { rz: -0.35 });
    B.box('body', 0.22, 0.12, 0.3, COL.DARK, PBR.DARKM, -0.1, 0.3, 0);
    for (const [x, z] of [[0.24, 0.23], [-0.24, 0.23], [0.24, -0.23], [-0.24, -0.23]]) { B.cyl('body', 0.1, 0.08, COL.RUB, PBR.RUB, x, 0.1, z, { rx: Math.PI / 2, seg: 12 }); B.cyl('body', 0.05, 0.085, COL.STEEL, PBR.METAL, x, 0.1, z, { rx: Math.PI / 2, seg: 8 }); }
    for (const z of [-0.15, 0.15]) { B.cyl('body', 0.012, 0.25, COL.GUN, PBR.DARKM, 0.02, 0.38, z, { rz: 0.4 }); B.cyl('body', 0.012, 0.28, COL.GUN, PBR.DARKM, -0.12, 0.36, z, { rz: -0.4 }); }
    B.glow('body', 0.02, 0.03, 0.05, COL.HEAD, 0.45, 0.2, 0.12); B.glow('body', 0.02, 0.03, 0.05, COL.HEAD, 0.45, 0.2, -0.12);
    B.piv.turret = [-0.02, 0.44, 0];
    B.cyl('turret', 0.05, 0.06, COL.DARK, PBR.DARKM, 0, 0, 0); B.box('turret', 0.14, 0.06, 0.06, COL.STEEL, PBR.METAL, 0.05, 0.04, 0); B.barrel('turret', 0.25, 0.015, 0.1, 0.04, 0, 0);
    B.piv.tip = 0.38;
  },
  harv(B) {
    tracks(B, 1.22, 0.84, 0.24, 6);
    B.box('body', 1.1, 0.2, 0.66, COL.YEL, PBR.PAINT, -0.05, 0.36, 0);
    B.box('body', 0.7, 0.26, 0.64, COL.YEL, PBR.PAINT, -0.22, 0.58, 0, { bevel: 0.03 }); B.box('body', 0.66, 0.05, 0.6, COL.DARK, PBR.DARKM, -0.22, 0.47, 0);
    for (const z of [-0.33, 0.33]) for (let i = 0; i < 5; i++) B.box('body', 0.07, 0.24, 0.015, COL.DARK, PBR.DARKM, -0.5 + i * 0.14, 0.58, z, { bevel: 0 });
    B.box('body', 0.3, 0.3, 0.6, 'T', PBR.PAINT, 0.42, 0.6, 0); B.box('body', 0.02, 0.12, 0.48, COL.GLASS, PBR.GLASS, 0.575, 0.66, 0, { bevel: 0 });
    for (const z of [-0.22, 0.22]) B.glow('body', 0.03, 0.05, 0.08, COL.HEAD, 0.59, 0.5, z);
    B.glow('body', 0.05, 0.05, 0.05, 0xffaa22, 0.4, 0.78, 0.2); B.cyl('body', 0.03, 0.25, COL.GUN, PBR.DARKM, 0.3, 0.85, -0.22);
    B.piv.rotor = [0.66, 0.2, 0];
    B.cyl('rotor', 0.12, 0.7, COL.STEEL, PBR.METAL, 0, 0, 0, { rx: Math.PI / 2, seg: 8 }); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.box('rotor', 0.05, 0.05, 0.7, COL.DARK, PBR.DARKM, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0, { bevel: 0 }); }
    B.piv.load = [-0.22, 0.5, 0];
    const R = mkRng(9); for (let i = 0; i < 14; i++) B.add('load', new THREE.OctahedronGeometry(0.08 + R() * 0.06, 0), COL.ORE, PBR.ORE, (R() - 0.5) * 0.55, R() * 0.12 + 0.05, (R() - 0.5) * 0.5, { rx: R() * 3, ry: R() * 3 });
    B.box('load', 0.6, 0.08, 0.56, 0xb88a20, PBR.ORE, 0, 0.04, 0, { bevel: 0.02 });
  },
  titan(B) {
    // mech walker: legs rig (scaled) + armoured hull with twin rocket pods
    const s = 1;
    for (const [side, z] of [['L', 0.3], ['R', -0.3]]) {
      B.box('th' + side, 0.2, 0.5, 0.2, 'T', PBR.PAINT, 0, -0.25, 0); B.cyl('th' + side, 0.13, 0.24, COL.STEEL, PBR.METAL, 0, 0, 0, { rx: Math.PI / 2, seg: 10 });
      B.box('sh' + side, 0.16, 0.5, 0.18, COL.STEEL, PBR.METAL, 0.02, -0.25, 0); B.box('sh' + side, 0.12, 0.2, 0.2, 'T', PBR.PAINT, 0.06, -0.16, 0);
      B.box('sh' + side, 0.42, 0.08, 0.26, COL.DARK, PBR.DARKM, 0.06, -0.52, 0); B.cyl('sh' + side, 0.1, 0.22, COL.DARK, PBR.DARKM, 0, 0, 0, { rx: Math.PI / 2, seg: 10 });
    }
    B.box('body', 0.45, 0.2, 0.62, COL.DARK, PBR.DARKM, 0, 1.0, 0);
    B.box('body', 0.75, 0.42, 0.62, 'T', PBR.PAINT, 0.05, 1.3, 0); B.box('body', 0.35, 0.2, 0.5, 'T', PBR.PAINT, 0.32, 1.42, 0, { rz: -0.35 });
    B.box('body', 0.12, 0.08, 0.4, COL.GLASS, PBR.GLASS, 0.42, 1.38, 0); B.glow('body', 0.02, 0.04, 0.3, 'TL', 0.49, 1.38, 0);
    for (const z of [0.44, -0.44]) { B.box('body', 0.5, 0.26, 0.2, COL.STEEL, PBR.METAL, 0.05, 1.32, z); for (let k = 0; k < 6; k++) B.cyl('body', 0.03, 0.05, COL.GUN, PBR.DARKM, 0.31, 1.25 + (k % 2) * 0.12, z - 0.05 + (k >> 1) * 0.05, { rz: Math.PI / 2, seg: 6 }); }
    B.box('body', 0.3, 0.12, 0.3, COL.STEEL, PBR.METAL, -0.32, 1.38, 0); B.cyl('body', 0.012, 0.35, COL.GUN, PBR.DARKM, -0.38, 1.62, 0.15, { seg: 4 });
    B.piv.legs = { hip: 1.0, hz: 0.3, tl: 0.5, stride: 1.5, mech: 1 }; B.piv.tip = 0.35;
  },
  tsar(B) {
    tracks(B, 2.2, 1.5, 0.42, 7);
    B.box('body', 2.0, 0.4, 1.1, 'T', PBR.PAINT, 0, 0.58, 0); B.box('body', 0.5, 0.3, 1.0, 'T', PBR.PAINT, 0.8, 0.5, 0, { rz: 0.5 });
    for (const z of [0.62, -0.62]) B.box('body', 1.8, 0.08, 0.3, COL.DARK, PBR.DARKM, 0, 0.82, z);
    B.piv.turret = [-0.1, 0.8, 0];
    B.box('turret', 1.0, 0.36, 0.9, 'T', PBR.PAINT, 0, 0.18, 0); B.box('turret', 0.5, 0.26, 0.8, 'TD', PBR.PAINT, -0.55, 0.15, 0);
    for (const z of [0.18, -0.18]) { B.cyl('turret', 0.07, 1.25, COL.STEEL, PBR.METAL, 1.05, 0.2, z, { rz: -Math.PI / 2, seg: 10 }); B.cyl('turret', 0.1, 0.18, COL.DARK, PBR.DARKM, 1.62, 0.2, z, { rz: -Math.PI / 2, seg: 10 }); }
    for (const z of [0.55, -0.55]) { B.box('turret', 0.5, 0.25, 0.22, COL.STEEL, PBR.METAL, -0.1, 0.3, z); for (let k = 0; k < 4; k++) B.cyl('turret', 0.035, 0.04, COL.GUN, PBR.DARKM, 0.16, 0.24 + (k % 2) * 0.12, z - 0.05 + (k >> 1) * 0.1, { rz: Math.PI / 2, seg: 6 }); }
    B.glow('turret', 0.04, 0.06, 0.95, 'TL', -0.8, 0.22, 0); B.box('turret', 0.2, 0.18, 0.2, COL.DARK, PBR.DARKM, -0.2, 0.42, -0.2);
    B.piv.tip = 1.7;
  },
  stealth(B) {
    const wing = new THREE.Shape(); wing.moveTo(0.75, 0); wing.lineTo(-0.45, 0.85); wing.lineTo(-0.3, 0.3); wing.lineTo(-0.55, 0); wing.lineTo(-0.3, -0.3); wing.lineTo(-0.45, -0.85); wing.lineTo(0.75, 0);
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }); wg.rotateX(Math.PI / 2); B.add('body', wg, 0x2a2e33, PBR.DARKM, 0, 0.05, 0);
    B.sph('body', 0.09, 0x111316, PBR.GLASS, 0.3, 0.08, 0, { sx: 2.2, sy: 0.6, sz: 0.9, seg: 10 });
    for (const z of [0.18, -0.18]) B.box('body', 0.22, 0.2, 0.02, 0x2a2e33, PBR.DARKM, -0.38, 0.14, z, { rx: z > 0 ? -0.5 : 0.5, bevel: 0 });
    B.box('body', 0.5, 0.02, 0.12, 'T', PBR.PAINT, -0.05, 0.1, 0.45, { ry: 0.6, bevel: 0 }); B.box('body', 0.5, 0.02, 0.12, 'T', PBR.PAINT, -0.05, 0.1, -0.45, { ry: -0.6, bevel: 0 });
    B.glow('body', 0.02, 0.03, 0.2, 0x66aaff, -0.5, 0.06, 0); B.piv.tip = 0.3;
  },
  jet(B) {
    B.cyl('body', 0.09, 1.3, 'T', PBR.PAINT, 0, 0, 0, { rz: -Math.PI / 2, rt: 0.02, seg: 12 }); B.cyl('body', 0.11, 0.5, 'T', PBR.PAINT, -0.45, 0, 0, { rz: -Math.PI / 2, rt: 0.09, seg: 12 });
    B.sph('body', 0.08, COL.GLASS, PBR.GLASS, 0.25, 0.07, 0, { sx: 2.2, sy: 0.8, sz: 0.8, seg: 10 });
    const wing = new THREE.Shape(); wing.moveTo(0.15, 0); wing.lineTo(-0.35, 0.62); wing.lineTo(-0.5, 0.62); wing.lineTo(-0.4, 0); wing.lineTo(-0.5, -0.62); wing.lineTo(-0.35, -0.62); wing.lineTo(0.15, 0);
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.025, bevelEnabled: false }); wg.rotateX(Math.PI / 2); B.add('body', wg, 'T', PBR.PAINT, 0, 0.0, 0);
    for (const z of [0.12, -0.12]) B.box('body', 0.22, 0.25, 0.02, 'TD', PBR.PAINT, -0.6, 0.13, z, { rx: z > 0 ? -0.35 : 0.35, bevel: 0 });
    B.cyl('body', 0.07, 0.06, COL.DARK, PBR.DARKM, -0.72, 0, 0, { rz: Math.PI / 2 }); B.glow('body', 0.02, 0.1, 0.1, 0xff8a3a, -0.76, 0, 0);
    for (const z of [0.3, -0.3]) B.cyl('body', 0.035, 0.28, COL.STEEL, PBR.METAL, -0.15, -0.05, z, { rz: Math.PI / 2, seg: 8 });
    B.glow('body', 0.03, 0.02, 0.03, COL.RED, -0.5, 0.02, 0.62); B.glow('body', 0.03, 0.02, 0.03, COL.GRN, -0.5, 0.02, -0.62); B.glow('body', 0.08, 0.015, 0.05, 'TA', -0.3, 0.03, 0.35); B.glow('body', 0.08, 0.015, 0.05, 'TA', -0.3, 0.03, -0.35);
    B.piv.tip = 0.3;
  },
  intercept(B) {
    B.cyl('body', 0.075, 1.2, 0x6c7378, PBR.PAINT, 0, 0, 0, { rz: -Math.PI / 2, rt: 0.015, seg: 12 });
    B.sph('body', 0.07, COL.GLASS, PBR.GLASS, 0.22, 0.06, 0, { sx: 2.4, sy: 0.8, sz: 0.8, seg: 10 });
    const wing = new THREE.Shape(); wing.moveTo(0.05, 0); wing.lineTo(-0.4, 0.5); wing.lineTo(-0.48, 0.5); wing.lineTo(-0.42, 0); wing.lineTo(-0.48, -0.5); wing.lineTo(-0.4, -0.5); wing.lineTo(0.05, 0);
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.02, bevelEnabled: false }); wg.rotateX(Math.PI / 2); B.add('body', wg, 0x6c7378, PBR.PAINT, 0, 0, 0);
    for (const z of [0.1, -0.1]) B.box('body', 0.2, 0.22, 0.02, 0x5b6166, PBR.PAINT, -0.55, 0.12, z, { rx: z > 0 ? -0.3 : 0.3, bevel: 0 });
    for (const z of [0.4, -0.4, 0.25, -0.25]) { B.cyl('body', 0.018, 0.26, COL.WHITE, PBR.PAINT, -0.2, -0.03, z, { rz: Math.PI / 2, seg: 6 }); }
    for (const z of [0.05, -0.05]) B.glow('body', 0.02, 0.06, 0.06, 0xff8a3a, -0.64, 0, z);
    B.glow('body', 0.06, 0.015, 0.04, 'TA', -0.32, 0.03, 0.3); B.glow('body', 0.06, 0.015, 0.04, 'TA', -0.32, 0.03, -0.3);
    B.piv.tip = 0.3;
  },
  bomber(B) {
    B.cyl('body', 0.17, 1.8, 'T', PBR.PAINT, 0, 0, 0, { rz: -Math.PI / 2, rt: 0.08, seg: 14 });
    B.sph('body', 0.12, COL.GLASS, PBR.GLASS, 0.72, 0.06, 0, { sx: 1.6, sy: 0.7, sz: 1.0, seg: 10 });
    const wing = new THREE.Shape(); wing.moveTo(0.3, 0); wing.lineTo(-0.3, 1.25); wing.lineTo(-0.5, 1.25); wing.lineTo(-0.3, 0); wing.lineTo(-0.5, -1.25); wing.lineTo(-0.3, -1.25); wing.lineTo(0.3, 0);
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.04, bevelEnabled: false }); wg.rotateX(Math.PI / 2); B.add('body', wg, 'T', PBR.PAINT, 0, 0.02, 0);
    for (const z of [0.5, -0.5, 0.85, -0.85]) { B.cyl('body', 0.07, 0.32, COL.STEEL, PBR.METAL, -0.1, -0.08, z, { rz: Math.PI / 2, seg: 10 }); B.glow('body', 0.02, 0.09, 0.09, 0xff8a3a, -0.27, -0.08, z); }
    B.box('body', 0.3, 0.3, 0.025, 'TD', PBR.PAINT, -0.85, 0.18, 0, { bevel: 0 }); B.box('body', 0.25, 0.025, 0.7, 'TD', PBR.PAINT, -0.85, 0.05, 0, { bevel: 0 });
    B.glow('body', 0.12, 0.015, 0.08, 'TA', -0.4, 0.05, 0.9); B.glow('body', 0.12, 0.015, 0.08, 'TA', -0.4, 0.05, -0.9);
    B.piv.tip = 0.2;
  },
  hauler(B) {
    // tandem-rotor heavy transport: long fuselage, rear ramp, two rotor towers
    B.box('body', 1.5, 0.42, 0.46, 'T', PBR.PAINT, 0, 0, 0, { bevel: 0.12 }); B.box('body', 0.4, 0.3, 0.42, COL.DARK, PBR.DARKM, -0.85, 0.02, 0, { bevel: 0.08 });
    B.box('body', 0.3, 0.2, 0.4, COL.GLASS, PBR.GLASS, 0.72, 0.08, 0, { bevel: 0.08 }); B.box('body', 0.22, 0.3, 0.3, 'TD', PBR.PAINT, -0.62, 0.3, 0, { bevel: 0.05 });
    B.box('body', 0.2, 0.18, 0.26, 'TD', PBR.PAINT, 0.55, 0.26, 0, { bevel: 0.05 }); for (const z of [-0.26, 0.26]) { B.box('body', 0.9, 0.12, 0.08, COL.STEEL, PBR.METAL, -0.05, -0.18, z, { bevel: 0.02 }); B.glow('body', 0.03, 0.03, 0.03, z > 0 ? COL.GRN : COL.RED, 0.1, 0.12, z * 1.05); }
    for (const x of [-0.5, 0.5]) for (const z of [-0.2, 0.2]) B.cyl('body', 0.04, 0.12, COL.DARK, PBR.DARKM, x, -0.28, z);
    B.cyl('body', 0.75, 0.01, COL.GUN, PBR.DARKM, -0.62, 0.47, 0, { seg: 20 }); // rear rotor disc (motion blur)
    B.cyl('rotor', 0.05, 0.05, COL.DARK, PBR.DARKM, 0, 0, 0); B.box('rotor', 1.5, 0.015, 0.08, COL.GUN, PBR.DARKM, 0, 0.02, 0, { bevel: 0 }); B.box('rotor', 0.08, 0.015, 1.5, COL.GUN, PBR.DARKM, 0, 0.02, 0, { bevel: 0 });
    B.piv.rotor = [0.55, 0.38, 0]; B.piv.tip = 0.8;
  },
  gunship(B) {
    B.sph('body', 0.3, 'T', PBR.PAINT, 0, 0, 0, { sx: 1.8, sy: 0.85, sz: 0.9, seg: 16 });
    B.sph('body', 0.2, COL.GLASS, PBR.GLASS, 0.3, 0.06, 0, { sx: 1.4, sy: 0.8, sz: 0.85 });
    B.cyl('body', 0.07, 0.75, 'T', PBR.PAINT, -0.65, 0.05, 0, { rz: Math.PI / 2, rt: 0.04 }); B.box('body', 0.14, 0.26, 0.03, 'TD', PBR.PAINT, -1.0, 0.15, 0);
    B.cyl('body', 0.09, 0.02, COL.DARK, PBR.DARKM, -1.0, 0.1, 0.05, { rx: Math.PI / 2 });
    B.box('body', 0.16, 0.04, 0.95, COL.DARK, PBR.DARKM, -0.05, -0.04, 0); for (const z of [-0.45, 0.45]) { B.cyl('body', 0.05, 0.3, COL.STEEL, PBR.METAL, 0, -0.1, z, { rz: Math.PI / 2 }); B.glow('body', 0.03, 0.03, 0.03, z > 0 ? COL.GRN : COL.RED, -0.05, -0.02, z * 1.08); }
    for (const z of [-0.18, 0.18]) B.box('body', 0.6, 0.025, 0.025, COL.GUN, PBR.DARKM, 0, -0.27, z, { bevel: 0 });
    B.cyl('body', 0.05, 0.12, COL.DARK, PBR.DARKM, 0, 0.27, 0);
    B.piv.rotor = [0, 0.34, 0];
    B.cyl('rotor', 0.05, 0.05, COL.DARK, PBR.DARKM, 0, 0, 0); B.box('rotor', 1.9, 0.015, 0.09, COL.GUN, PBR.DARKM, 0, 0.02, 0, { bevel: 0 }); B.box('rotor', 0.09, 0.015, 1.9, COL.GUN, PBR.DARKM, 0, 0.02, 0, { bevel: 0 });
    B.piv.tip = 0.5;
  },
};
// jointed legs: parts thL/shL/thR/shR built around their joint origins (hip, knee); piv.legs drives animation
function legRig(B, s, hip, tl, sl, hz, pc, bc, w) {
  const S = v => v * s;
  for (const [side, z] of [['L', hz], ['R', -hz]]) {
    B.box('th' + side, S(0.05 * w), S(tl + 0.02), S(0.05 * w), pc, PBR.PAINT, 0, -S(tl / 2), 0, { bevel: 0.006 });
    B.box('th' + side, S(0.045 * w), S(0.03), S(0.03), COL.DARK, PBR.CLOTH, S(0.012), -S(tl * 0.5), S(0.02 * Math.sign(z)), { bevel: 0 }); // thigh pocket
    B.box('sh' + side, S(0.045 * w), S(sl - 0.02), S(0.045 * w), pc, PBR.PAINT, 0, -S((sl - 0.02) / 2), 0, { bevel: 0.006 });
    B.box('sh' + side, S(0.05 * w), S(0.035), S(0.05 * w), COL.DARK, PBR.RUB, S(0.006), -S(0.04), 0, { bevel: 0.006 }); // knee pad
    B.box('sh' + side, S(0.072 * w), S(0.032), S(0.055 * w), bc, PBR.RUB, S(0.014), -S(sl - 0.016), 0, { bevel: 0.006 }); // boot
  }
  B.piv.legs = { hip: S(hip), hz: S(hz), tl: S(tl), stride: S(0.62), mech: 0 };
}
function inf(B, kind) {
  const s = 1.2, P = (part, w, h, d, c, m, x, y, z, o) => B.box(part, w * s, h * s, d * s, c, m, x * s, y * s, z * s, Object.assign({ bevel: 0.006 }, o || {}));
  const pants = kind === 'medic' ? COL.KHAKI : 'T', top = kind === 'pyro' ? 0x5a4a32 : 'T';
  legRig(B, s, 0.27, 0.115, 0.155, 0.042, pants, kind === 'kommando' ? 0x2a2a26 : COL.DARK, 1);
  P('body', 0.09, 0.05, 0.13, COL.DARK, PBR.CLOTH, 0, 0.28, 0);
  P('body', 0.085, 0.15, 0.13, top, PBR.PAINT, 0, 0.36, 0);
  P('body', 0.1, 0.12, 0.14, kind === 'medic' ? COL.WHITE : COL.KHAKI, PBR.CLOTH, 0.006, 0.37, 0);            // plate carrier
  for (let i = 0; i < 3; i++) P('body', 0.02, 0.03, 0.025, COL.DARK, PBR.CLOTH, 0.06, 0.34, -0.04 + i * 0.04); // pouches
  P('body', 0.06, 0.13, 0.11, kind === 'pyro' ? COL.STEEL : COL.PANTS, PBR.CLOTH, -0.075, 0.37, 0);            // backpack
  B.cyl('body', 0.018 * s, 0.03 * s, COL.SKIN, PBR.RUB, 0, 0.455 * s, 0, { seg: 8 });
  B.sph('body', 0.036 * s, COL.SKIN, PBR.RUB, 0.004 * s, 0.495 * s, 0, { seg: 10 });
  B.sph('body', 0.045 * s, kind === 'medic' ? COL.WHITE : 'T', PBR.PAINT, 0, 0.505 * s, 0, { half: true, seg: 12, sy: 0.85 });
  B.box('body', 0.012 * s, 0.01 * s, 0.07 * s, COL.DARK, PBR.DARKM, 0.035 * s, 0.505 * s, 0, { bevel: 0 });
  // arms holding weapon forward
  for (const z of [0.075, -0.075]) { P('body', 0.11, 0.035, 0.035, top, PBR.PAINT, 0.04, 0.4, z, { rz: -0.5 }); P('body', 0.1, 0.03, 0.03, top, PBR.PAINT, 0.1, 0.36, z * 0.6, { ry: z > 0 ? 0.5 : -0.5 }); }
  B.box('body', 0.02 * s, 0.025 * s, 0.012 * s, 'TA', PBR.ACC, 0, 0.42 * s, 0.07 * s, { bevel: 0 });   // shoulder patch
  const gy = 0.36;
  if (kind === 'kommando') { P('body', 0.34, 0.035, 0.03, COL.GUN, PBR.DARKM, 0.15, gy, 0.03); P('body', 0.05, 0.03, 0.03, COL.GUN, PBR.DARKM, 0.26, gy + 0.03, 0.03); B.sph('body', 0.047 * s, 0x2b2d28, PBR.CLOTH, 0, 0.5 * s, 0, { half: true, seg: 10 }); P('body', 0.04, 0.02, 0.09, 0x111111, PBR.GLASS, 0.03, 0.495, 0); }
  if (kind === 'rifle' || kind === 'engineer') { P('body', 0.3, 0.03, 0.025, COL.GUN, PBR.DARKM, 0.14, gy, 0.03); P('body', 0.03, 0.06, 0.02, COL.GUN, PBR.DARKM, 0.1, gy - 0.04, 0.03); }
  if (kind === 'sniper') { P('body', 0.48, 0.025, 0.022, COL.GUN, PBR.DARKM, 0.18, gy, 0.03); B.cyl('body', 0.012 * s, 0.1 * s, COL.GUN, PBR.DARKM, 0.12 * s, (gy + 0.03) * s, 0.03 * s, { rz: Math.PI / 2 });
    const R = mkRng(3); for (let i = 0; i < 9; i++) B.sph('body', (0.025 + R() * 0.02) * s, R() < 0.5 ? 0x3d4a26 : 0x55502e, PBR.CLOTH, (-0.06 + R() * 0.08) * s, (0.4 + R() * 0.12) * s, (R() - 0.5) * 0.12 * s, { seg: 6 }); }
  if (kind === 'rocketeer') { B.cyl('body', 0.035 * s, 0.42 * s, 0x4d5238, PBR.PAINT, 0.04 * s, 0.45 * s, 0.07 * s, { rz: Math.PI / 2, seg: 10 }); B.glow('body', 0.01, 0.04, 0.04, 0xff5522, 0.25 * s, 0.45 * s, 0.07 * s); }
  if (kind === 'pyro') { for (const z of [0.03, -0.03]) B.cyl('body', 0.03 * s, 0.17 * s, 0x7a2c1c, PBR.PAINT, -0.1 * s, 0.38 * s, z * s, { seg: 8 }); P('body', 0.22, 0.035, 0.03, COL.STEEL, PBR.METAL, 0.12, gy, 0.03); B.glow('body', 0.015, 0.015, 0.015, 0x66aaff, 0.24 * s, gy * s, 0.03 * s);
    B.sph('body', 0.04 * s, COL.DARK, PBR.RUB, 0.02 * s, 0.495 * s, 0, { seg: 8 }); }
  if (kind === 'medic') { P('body', 0.2, 0.025, 0.02, COL.GUN, PBR.DARKM, 0.1, gy, 0.03); P('body', 0.005, 0.03, 0.01, 0xcc2222, PBR.PAINT, -0.106, 0.4, 0, { bevel: 0 }); P('body', 0.005, 0.01, 0.03, 0xcc2222, PBR.PAINT, -0.106, 0.4, 0, { bevel: 0 });
    B.glow('body', 0.01 * s, 0.012 * s, 0.03 * s, 0xff3333, 0, 0.545 * s, 0); P('body', 0.06, 0.06, 0.04, COL.WHITE, PBR.CLOTH, 0.02, 0.25, -0.08); }
  if (kind === 'engineer') { B.sph('body', 0.047 * s, COL.YEL, PBR.PAINT, 0, 0.51 * s, 0, { half: true, seg: 12 }); P('body', 0.12, 0.08, 0.06, COL.YEL, PBR.PAINT, -0.02, 0.17, 0.11); }
  B.piv.tip = 0.45;
}
// v5.8 Brazil Iron Marine: bulky powered plate armour over team paint, green/yellow accents, visored helmet, heavy carbine
function marineModel(B) {
  const s = 1.42, GR = 0x1f8a3c, YE = 0xf2c81a, P = (part, w, h, d, c, m, x, y, z, o) => B.box(part, w * s, h * s, d * s, c, m, x * s, y * s, z * s, Object.assign({ bevel: 0.008 }, o || {}));
  legRig(B, s, 0.27, 0.115, 0.155, 0.046, 'T', COL.DARK, 1.35);
  for (const z of [0.046, -0.046]) { P('body', 0.075, 0.05, 0.075, GR, PBR.PAINT, 0.01, 0.22, z); } // hip plates
  P('body', 0.11, 0.06, 0.15, COL.DARK, PBR.CLOTH, 0, 0.28, 0);
  P('body', 0.12, 0.17, 0.17, 'T', PBR.PAINT, 0, 0.37, 0);                       // armoured torso
  P('body', 0.13, 0.12, 0.175, COL.STEEL, PBR.METAL, 0.012, 0.38, 0);            // chest plate
  P('body', 0.005, 0.03, 0.12, YE, PBR.PAINT, 0.08, 0.4, 0, { bevel: 0 });        // yellow chest band
  P('body', 0.005, 0.025, 0.025, GR, PBR.PAINT, 0.081, 0.36, 0, { bevel: 0 });    // green diamond badge
  for (const z of [0.1, -0.1]) { P('body', 0.09, 0.05, 0.07, GR, PBR.PAINT, 0, 0.46, z, { bevel: 0.015 }); P('body', 0.092, 0.012, 0.072, YE, PBR.PAINT, 0, 0.437, z, { bevel: 0 }); } // pauldrons
  P('body', 0.08, 0.15, 0.14, COL.PANTS, PBR.CLOTH, -0.095, 0.38, 0);            // power pack
  B.glow('body', 0.01 * s, 0.03 * s, 0.08 * s, 0x5cff7a, -0.136 * s, 0.4 * s, 0);
  B.sph('body', 0.056 * s, 'T', PBR.PAINT, 0, 0.51 * s, 0, { seg: 12, sy: 0.95 }); // helmet
  P('body', 0.03, 0.022, 0.085, YE, PBR.GLASS, 0.045, 0.505, 0, { bevel: 0 });     // visor (yellow)
  P('body', 0.06, 0.012, 0.012, GR, PBR.PAINT, 0, 0.56, 0, { bevel: 0 });          // helmet crest stripe
  for (const z of [0.085, -0.085]) { P('body', 0.12, 0.045, 0.045, 'T', PBR.PAINT, 0.04, 0.4, z, { rz: -0.5 }); P('body', 0.11, 0.04, 0.04, COL.STEEL, PBR.METAL, 0.1, 0.36, z * 0.6, { ry: z > 0 ? 0.5 : -0.5 }); }
  const gy = 0.36; P('body', 0.34, 0.045, 0.035, COL.GUN, PBR.DARKM, 0.16, gy, 0.03); P('body', 0.08, 0.06, 0.04, COL.GUN, PBR.DARKM, 0.08, gy - 0.03, 0.03); P('body', 0.06, 0.02, 0.036, GR, PBR.PAINT, 0.2, gy + 0.03, 0.03);
  B.box('body', 0.02 * s, 0.025 * s, 0.012 * s, 'TA', PBR.ACC, 0, 0.44 * s, 0.13 * s, { bevel: 0 });
  B.piv.tip = 0.5;
}
// ---------- buildings ----------
function foundation(B, w, h) {
  B.box('body', w - 0.06, 0.14, h - 0.06, COL.CONCD, PBR.CONC, 0, 0.07, 0, { bevel: 0.05 });
  B.box('body', w - 0.3, 0.03, h - 0.3, COL.CONC, PBR.CONC, 0, 0.15, 0, { bevel: 0 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) B.glow('body', 0.06, 0.04, 0.06, 'T', sx * (w / 2 - 0.12), 0.17, sz * (h / 2 - 0.12));
}
function windows(B, x, y, z, len, axis, n, c) { for (let i = 0; i < n; i++) { const o = -len / 2 + len * (i + 0.5) / n; B.glow('body', axis === 'x' ? len / n * 0.7 : 0.02, 0.08, axis === 'x' ? 0.02 : len / n * 0.7, c || 0x9fe6ff, axis === 'x' ? x + o : x, y, axis === 'x' ? z : z + o); } }
const BLD_MODELS = {
  hq(B) {
    foundation(B, 3, 3);
    B.box('body', 2.3, 0.75, 2.1, COL.LIGHT, PBR.PAINT, -0.15, 0.53, -0.2); B.box('body', 2.34, 0.12, 2.14, 'T', PBR.PAINT, -0.15, 0.86, -0.2);
    windows(B, -0.15, 0.6, 0.86, 2.0, 'x', 6); windows(B, 1.01, 0.6, -0.2, 1.8, 'z', 5);
    B.box('body', 1.0, 0.65, 1.0, COL.STEEL, PBR.METAL, 0.45, 1.25, 0.25); B.box('body', 1.02, 0.1, 1.02, COL.GLASS, PBR.GLASS, 0.45, 1.45, 0.25, { bevel: 0 });
    B.box('body', 0.6, 0.35, 0.05, COL.DARK, PBR.DARKM, -0.6, 0.35, 0.88); for (let i = 0; i < 4; i++) B.box('body', 0.6, 0.015, 0.06, COL.YEL, PBR.PAINT, -0.6, 0.22 + i * 0.07, 0.9, { bevel: 0 });
    B.cyl('body', 0.05, 1.6, COL.STEEL, PBR.METAL, 1.25, 0.95, -1.15); B.box('body', 1.5, 0.08, 0.08, COL.YEL, PBR.PAINT, 0.6, 1.72, -1.15); B.cyl('body', 0.01, 0.5, COL.GUN, PBR.DARKM, 0.0, 1.45, -1.15, { seg: 4 });
    B.glow('body', 0.06, 0.06, 0.06, COL.RED, 1.25, 1.78, -1.15);
    for (const [x, z] of [[-1.2, -1.2], [-0.4, -1.2]]) { B.box('body', 0.3, 0.12, 0.3, COL.DARK, PBR.DARKM, x, 0.98, z); B.cyl('body', 0.1, 0.03, COL.GUN, PBR.DARKM, x, 1.06, z); }
    B.piv.spin = [-0.8, 0.92, 0.3];
    B.cyl('spin', 0.04, 0.4, COL.STEEL, PBR.METAL, 0, 0.2, 0); B.sph('spin', 0.32, COL.LIGHT, PBR.METAL, 0.06, 0.52, 0, { half: true, rz: -1.25, sy: 0.45 }); B.glow('spin', 0.03, 0.03, 0.03, COL.RED, 0.2, 0.55, 0);
  },
  power(B) {
    foundation(B, 2, 2);
    B.box('body', 1.6, 0.42, 0.7, COL.STEEL, PBR.METAL, 0, 0.36, 0.5); windows(B, 0, 0.42, 0.86, 1.3, 'x', 4, 0xffd27a);
    for (const x of [-0.45, 0.45]) {
      B.cyl('body', 0.36, 0.7, COL.LIGHT, PBR.PAINT, x, 0.5, -0.32, { rt: 0.27, seg: 20 }); B.cyl('body', 0.27, 0.5, COL.LIGHT, PBR.PAINT, x, 1.1, -0.32, { rt: 0.31, seg: 20 });
      B.torus('body', 0.3, 0.025, 'TA', PBR.GLOW2, x, 1.33, -0.32, { rx: Math.PI / 2 }); B.cyl('body', 0.26, 0.02, 'TL', PBR.GLOW2, x, 1.31, -0.32, { seg: 20 });
      for (let i = 0; i < 3; i++) B.torus('body', 0.33 - i * 0.02, 0.012, COL.CONCD, PBR.CONC, x, 0.3 + i * 0.25, -0.32, { rx: Math.PI / 2 });
    }
    for (const x of [-0.6, -0.2, 0.2, 0.6]) { B.box('body', 0.18, 0.2, 0.18, COL.DARK, PBR.DARKM, x, 0.68, 0.5); B.cyl('body', 0.03, 0.12, COL.LIGHT, PBR.PAINT, x, 0.84, 0.5, { seg: 8 }); }
    B.piv.glow = [0, 0, 0]; B.glow('glow', 1.3, 0.04, 0.05, 'T', 0, 0.22, 0.9);
  },
  refinery(B) {
    foundation(B, 3, 3);
    B.box('body', 1.7, 0.75, 1.7, COL.STEEL, PBR.METAL, -0.55, 0.52, -0.55); B.box('body', 1.74, 0.1, 1.74, 'T', PBR.PAINT, -0.55, 0.92, -0.55);
    windows(B, -0.55, 0.62, 0.31, 1.4, 'x', 4, 0xffd27a);
    for (const [x, z] of [[0.85, -0.9], [0.85, -0.1]]) { B.cyl('body', 0.36, 1.0, COL.YEL, PBR.PAINT, x, 0.65, z, { seg: 20 }); B.sph('body', 0.36, COL.LIGHT, PBR.METAL, x, 1.15, z, { half: true, sy: 0.5 }); for (let i = 0; i < 3; i++) B.torus('body', 0.37, 0.015, COL.DARK, PBR.DARKM, x, 0.35 + i * 0.3, z, { rx: Math.PI / 2 }); }
    B.cyl('body', 0.08, 0.9, COL.DARK, PBR.DARKM, -1.2, 1.3, -1.2); B.glow('body', 0.08, 0.04, 0.08, COL.RED, -1.2, 1.76, -1.2);
    B.box('body', 0.5, 0.06, 1.2, COL.DARK, PBR.DARKM, 0.0, 0.55, 0.45, { rx: -0.45 });
    B.box('body', 1.4, 0.04, 0.85, COL.DARK, PBR.DARKM, 0, 0.17, 1.05, { bevel: 0 });
    for (let i = 0; i < 7; i++) B.box('body', 0.1, 0.012, 0.85, i % 2 ? COL.YEL : COL.GUN, PBR.PAINT, -0.6 + i * 0.2, 0.2, 1.05, { bevel: 0, ry: 0.5 });
    B.cyl('body', 0.25, 0.08, COL.ORE, PBR.ORE, -0.55, 0.98, -0.55);
    B.glow('body', 0.05, 0.05, 0.05, COL.GRN, 0.68, 0.22, 1.42); B.glow('body', 0.05, 0.05, 0.05, COL.GRN, -0.68, 0.22, 1.42);
  },
  barracks(B) {
    foundation(B, 2, 2);
    B.box('body', 1.55, 0.5, 1.3, 0x7f8a70, PBR.PAINT, 0, 0.4, -0.1); B.box('body', 1.6, 0.06, 1.35, 'T', PBR.PAINT, 0, 0.66, -0.1);
    B.cyl('body', 0.62, 1.55, 'TD', PBR.PAINT, 0, 0.72, -0.1, { seg: 3, rz: Math.PI / 2, rx: Math.PI / 2 * 0 });
    B.box('body', 0.42, 0.34, 0.04, COL.DARK, PBR.DARKM, 0, 0.32, 0.56); B.glow('body', 0.3, 0.03, 0.02, COL.HEAD, 0, 0.53, 0.58);
    for (let i = 0; i < 6; i++) B.sph('body', 0.1, COL.SAND, PBR.RUB, -0.75 + i * 0.12, 0.2, 0.8, { sy: 0.55 }); for (let i = 0; i < 6; i++) B.sph('body', 0.1, COL.SAND, PBR.RUB, 0.15 + i * 0.12, 0.2, 0.8, { sy: 0.55 });
    B.cyl('body', 0.015, 1.3, COL.LIGHT, PBR.METAL, 0.8, 0.8, 0.7, { seg: 6 }); B.box('body', 0.34, 0.2, 0.01, 'TA', PBR.GLOW2, 0.98, 1.32, 0.7, { bevel: 0 });
    B.glow('body', 0.06, 0.06, 0.06, COL.HEAD, -0.75, 0.75, 0.55);
  },
  factory(B) {
    foundation(B, 3, 3);
    B.box('body', 2.7, 0.7, 2.4, COL.STEEL, PBR.METAL, 0, 0.5, -0.2);
    B.cyl('body', 1.2, 2.6, 'T', PBR.PAINT, 0, 0.85, -0.2, { rz: Math.PI / 2, seg: 18 });
    for (let i = 0; i < 5; i++) B.torus('body', 1.21, 0.02, COL.DARK, PBR.DARKM, -1.2 + i * 0.6, 0.85, -0.2, { ry: Math.PI / 2, seg: 18 });
    B.box('body', 1.3, 0.7, 0.05, COL.DARK, PBR.DARKM, 0, 0.5, 1.02); for (let i = 0; i < 7; i++) B.box('body', 1.3, 0.015, 0.06, COL.GUN, PBR.DARKM, 0, 0.22 + i * 0.09, 1.05, { bevel: 0 });
    for (const x of [-0.75, 0.75]) { B.box('body', 0.1, 0.8, 0.12, COL.YEL, PBR.PAINT, x, 0.55, 1.02); B.glow('body', 0.08, 0.08, 0.04, 0xffaa22, x, 1.0, 1.06); }
    B.box('body', 0.6, 0.5, 0.8, COL.LIGHT, PBR.PAINT, 1.05, 0.4, 0.55); windows(B, 1.36, 0.45, 0.55, 0.6, 'z', 3);
    B.cyl('body', 0.12, 0.9, COL.DARK, PBR.DARKM, -1.05, 1.4, -1.1); B.glow('body', 0.06, 0.06, 0.06, COL.RED, -1.05, 1.88, -1.1);
    B.piv.smoke = [-1.05, 1.9, -1.1];
  },
  tech(B) {
    foundation(B, 2, 2);
    B.box('body', 1.6, 0.45, 1.6, COL.LIGHT, PBR.PAINT, 0, 0.36, 0); B.box('body', 1.64, 0.06, 1.64, 'T', PBR.PAINT, 0, 0.6, 0);
    B.sph('body', 0.62, COL.GLASS, PBR.GLASS, 0, 0.6, 0, { half: true, seg: 24 }); B.sph('body', 0.3, 'TL', PBR.GLOW2, 0, 0.6, 0, { seg: 12 });
    for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) { B.cyl('body', 0.05, 0.5, COL.STEEL, PBR.METAL, x, 0.85, z, { seg: 8 }); B.glow('body', 0.07, 0.07, 0.07, 'T', x, 1.12, z); }
    windows(B, 0, 0.36, 0.81, 1.3, 'x', 5);
    B.piv.spin = [0, 1.22, 0];
    B.cyl('spin', 0.025, 0.2, COL.STEEL, PBR.METAL, 0, 0, 0); B.box('spin', 0.7, 0.03, 0.04, 'TL', PBR.GLOW, 0, 0.1, 0, { bevel: 0 }); B.box('spin', 0.04, 0.03, 0.7, 'TL', PBR.GLOW, 0, 0.1, 0, { bevel: 0 });
  },
  turret(B) {
    B.cyl('body', 0.46, 0.22, COL.CONCD, PBR.CONC, 0, 0.11, 0, { seg: 8 }); B.cyl('body', 0.36, 0.18, COL.STEEL, PBR.METAL, 0, 0.3, 0, { rt: 0.3, seg: 8 });
    B.piv.head = [0, 0.48, 0];
    B.sph('head', 0.28, 'T', PBR.PAINT, 0, 0, 0, { half: true, sy: 0.75, seg: 16 }); B.box('head', 0.2, 0.14, 0.24, COL.STEEL, PBR.METAL, 0.2, 0.07, 0);
    B.barrel('head', 0.55, 0.045, 0.25, 0.08, 0, 0); B.glow('head', 0.05, 0.04, 0.12, COL.RED, 0.12, 0.17, 0);
    B.piv.tip = 0.75;
  },
  gate(B) {
    for (const z of [-0.4, 0.4]) { B.box('body', 0.4, 0.8, 0.2, COL.CONC, PBR.CONC, 0, 0.4, z, { bevel: 0.04 }); B.box('body', 0.44, 0.08, 0.24, 'TD', PBR.PAINT, 0, 0.82, z, { bevel: 0.02 }); }
    for (const y of [0.25, 0.5]) B.box('body', 0.08, 0.07, 0.62, 'T', PBR.PAINT, 0, y, 0, { bevel: 0.01 }); B.glow('body', 0.05, 0.05, 0.05, COL.GRN, 0, 0.9, 0.4);
  },
  tesla(B) { // v5.3: matches tesla-reference.png - gold octagonal base, blue glowing core band, 4 side prongs, stacked coil rings, glowing orb
    const GOLD = 0x9a7a2a, IRON = 0x4a5058, BLUE = 0x3a8cff;
    B.cyl('body', 0.44, 0.16, GOLD, PBR.METAL, 0, 0.08, 0, { seg: 8 }); B.cyl('body', 0.36, 0.12, 0x2c2f33, PBR.DARKM, 0, 0.22, 0, { seg: 8 });
    B.cyl('body', 0.3, 0.42, BLUE, PBR.GLOW2, 0, 0.49, 0, { seg: 12 }); for (let k = 0; k < 6; k++) { const a = k * 1.047; B.box('body', 0.05, 0.44, 0.05, GOLD, PBR.METAL, Math.cos(a) * 0.31, 0.49, Math.sin(a) * 0.31, { bevel: 0 }); }
    B.cyl('body', 0.36, 0.1, GOLD, PBR.METAL, 0, 0.74, 0, { seg: 8 }); B.cyl('body', 0.24, 0.14, IRON, PBR.METAL, 0, 0.86, 0, { seg: 10 });
    for (let k = 0; k < 4; k++) { const a = 0.785 + k * 1.571, c = Math.cos(a), s = Math.sin(a); // side prongs with glowing tips
      B.cyl('body', 0.05, 0.5, IRON, PBR.METAL, c * 0.38, 0.86, s * 0.38, { rz: Math.PI / 2, ry: -a, seg: 8 }); B.cyl('body', 0.075, 0.1, IRON, PBR.DARKM, c * 0.62, 0.86, s * 0.62, { rz: Math.PI / 2, ry: -a, seg: 6 }); B.glow('body', 0.06, 0.06, 0.06, 0x88ccff, c * 0.68, 0.86, s * 0.68); }
    B.cyl('body', 0.07, 1.25, IRON, PBR.METAL, 0, 1.55, 0, { seg: 10 });
    const R = [0.4, 0.34, 0.27, 0.2]; R.forEach((r, k) => { const y = 1.12 + k * 0.27; B.torus('body', r, 0.055, IRON, PBR.METAL, 0, y, 0, { rx: Math.PI / 2, seg: 28 }); B.torus('body', r - 0.03, 0.03, BLUE, PBR.GLOW, 0, y - 0.035, 0, { rx: Math.PI / 2, seg: 28 }); });
    B.piv.head = [0, 2.2, 0]; B.sph('head', 0.15, 0x66bbff, PBR.GLOW, 0, 0, 0, { seg: 16 }); B.torus('head', 0.1, 0.02, IRON, PBR.METAL, 0, -0.13, 0, { rx: Math.PI / 2 }); B.piv.tip = 0.1;
  },
  gatling(B) { // v5.9 France Tourelle Gatling: armoured octagonal plinth, blue/white/red trim, yawing head with a six-barrel rotary cluster (part 'gat' rolls)
    const NAVY = 0x23356b, RED = 0xb8262c, WH = 0xd8d8d0;
    B.cyl('body', 0.47, 0.2, COL.CONCD, PBR.CONC, 0, 0.1, 0, { seg: 8 }); B.cyl('body', 0.4, 0.26, COL.STEEL, PBR.METAL, 0, 0.32, 0, { rt: 0.32, seg: 8 });
    for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.39; B.box('body', 0.07, 0.2, 0.2, 'T', PBR.PAINT, Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4, { ry: -a, bevel: 0.01 }); }
    for (const [c, y] of [[NAVY, 0.46], [WH, 0.49], [RED, 0.52]]) B.cyl('body', 0.34, 0.03, c, PBR.PAINT, 0, y, 0, { seg: 16 });
    B.glow('body', 0.05, 0.05, 0.05, 'TA', 0.0, 0.56, 0.3);
    B.piv.head = [0, 0.62, 0];
    B.box('head', 0.42, 0.26, 0.38, 'T', PBR.PAINT, -0.04, 0.06, 0, { bevel: 0.04 });            // gun housing
    B.box('head', 0.3, 0.06, 0.4, COL.STEEL, PBR.METAL, -0.06, 0.21, 0, { bevel: 0.02 });         // top armour
    for (const z of [0.21, -0.21]) { B.box('head', 0.36, 0.22, 0.04, COL.STEEL, PBR.METAL, 0.02, 0.06, z, { bevel: 0.01 }); B.box('head', 0.2, 0.03, 0.045, 'TA', PBR.ACC, 0.0, 0.14, z, { bevel: 0 }); }
    B.box('head', 0.18, 0.2, 0.16, COL.DARK, PBR.DARKM, -0.18, 0.02, 0.27, { bevel: 0.02 });       // ammo drum
    B.cyl('head', 0.012, 0.5, 0xc8a040, PBR.METAL, -0.1, 0.0, 0.2, { rz: Math.PI / 2, seg: 4 });    // ammo belt
    B.cyl('head', 0.08, 0.1, COL.GUN, PBR.DARKM, 0.2, 0.04, 0, { rz: Math.PI / 2, seg: 10 });       // barrel mount
    B.glow('head', 0.03, 0.03, 0.06, 0xff4422, 0.0, 0.26, 0.1);
    B.piv.gat = [0.2, 0.66, 0];                                                                      // rotary cluster (axis = local +x)
    B.cyl('gat', 0.065, 0.12, COL.STEEL, PBR.METAL, 0.06, 0, 0, { rz: Math.PI / 2, seg: 12 });
    for (let k = 0; k < 6; k++) { const a = k * 1.047, y = Math.cos(a) * 0.045, z = Math.sin(a) * 0.045; B.cyl('gat', 0.016, 0.5, COL.GUN, PBR.DARKM, 0.3, y, z, { rz: Math.PI / 2, seg: 6 }); }
    for (const x of [0.22, 0.48]) B.cyl('gat', 0.068, 0.025, x > 0.3 ? RED : COL.STEEL, PBR.METAL, x, 0, 0, { rz: Math.PI / 2, seg: 12 });
    B.cyl('gat', 0.02, 0.04, 0x111111, PBR.DARKM, 0.56, 0, 0, { rz: Math.PI / 2, seg: 8 });
    B.piv.tip = 0.78;
  },
  silo(B) { // v5.2 Warhead Launcher: pad, blast doors, gantry and an upright missile (piv 'mis' hidden when empty)
    B.box('body', 1.9, 0.18, 1.9, COL.CONCD, PBR.CONC, 0, 0.09, 0, { bevel: 0.05 }); B.box('body', 1.1, 0.06, 1.1, 0x2a2b2c, PBR.DARKM, 0.15, 0.2, 0.15, { bevel: 0.02 });
    for (const s of [-1, 1]) B.box('body', 0.52, 0.08, 1.05, 'T', PBR.PAINT, 0.15 + s * 0.3, 0.24, 0.15, { bevel: 0.02 });
    for (let i = 0; i < 5; i++) B.box('body', 0.08, 0.04, 0.3, i % 2 ? COL.DARK : 0xd8b028, PBR.PAINT, -0.25 + i * 0.2, 0.2, -0.72, { bevel: 0 });
    B.box('body', 0.22, 2.1, 0.22, COL.STEEL, PBR.METAL, -0.68, 1.15, -0.62, { bevel: 0.02 }); for (let k = 0; k < 4; k++) B.box('body', 0.55, 0.05, 0.06, COL.STEEL, PBR.METAL, -0.42, 0.5 + k * 0.48, -0.55, { bevel: 0 });
    B.glow('body', 0.08, 0.08, 0.08, COL.RED, -0.68, 2.25, -0.62); B.box('body', 0.4, 0.35, 0.4, 'T', PBR.PAINT, 0.7, 0.36, -0.65, { bevel: 0.04 }); B.box('body', 0.3, 0.1, 0.02, COL.GLASS, PBR.GLASS, 0.7, 0.42, -0.44, { bevel: 0 });
    B.piv.mis = [0.15, 0.25, 0.15]; B.cyl('mis', 0.16, 1.5, 0xd8d8d0, PBR.PAINT, 0, 0.8, 0, { seg: 14 }); B.cyl('mis', 0.16, 0.42, 'T', PBR.PAINT, 0, 1.75, 0, { rt: 0.02, seg: 14 });
    for (const a of [0, 1.57, 3.14, 4.71]) B.box('mis', 0.03, 0.3, 0.2, 'T', PBR.PAINT, Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17, { bevel: 0 });
  },
  aagun(B) {
    B.cyl('body', 0.46, 0.22, COL.CONCD, PBR.CONC, 0, 0.11, 0, { seg: 8 }); B.cyl('body', 0.3, 0.22, COL.STEEL, PBR.METAL, 0, 0.32, 0, { seg: 10 });
    B.piv.head = [0, 0.5, 0];
    B.box('head', 0.36, 0.18, 0.4, 'T', PBR.PAINT, 0, 0.06, 0);
    for (const z of [-0.14, 0.14]) { B.barrel('head', 0.5, 0.025, 0.08, 0.12, z, 0.95); B.barrel('head', 0.5, 0.025, 0.08, 0.12, z * 0.6, 0.95); }
    B.box('head', 0.05, 0.16, 0.2, COL.LIGHT, PBR.METAL, -0.2, 0.22, 0); B.glow('head', 0.04, 0.04, 0.04, COL.GRN, -0.2, 0.32, 0);
    B.piv.tip = 0.5;
  },
  airfield(B) { // v6.2 Air Command (4x3): runway along the front, 4 helipads at the back (2 lit + 2 add-on), hangar + control tower
    B.box('body', 3.94, 0.1, 2.94, 0x3a3b3a, PBR.CONC, 0, 0.05, 0, { bevel: 0.04 });
    B.box('body', 3.7, 0.02, 0.9, 0x2c2d2d, PBR.CONC, 0, 0.11, 0.75, { bevel: 0 });
    for (let i = 0; i < 8; i++) B.box('body', 0.22, 0.01, 0.05, COL.WHITE, PBR.PAINT, -1.55 + i * 0.44, 0.125, 0.75, { bevel: 0 });
    for (let i = 0; i < 10; i++) for (const z of [1.25, 0.25]) B.glow('body', 0.05, 0.03, 0.05, i % 2 ? 0xffd27a : 'TA', -1.7 + i * 0.38, 0.13, z);
    B.cyl('body', 0.5, 1.05, 'T', PBR.PAINT, -1.38, 0.1, -0.78, { rz: Math.PI / 2, seg: 14 }); B.box('body', 0.03, 0.4, 0.8, COL.DARK, PBR.DARKM, -0.84, 0.28, -0.78);
    for (const [x, add] of [[-0.45, 1], [0.25, 0], [0.95, 0], [1.65, 1]]) {
      B.cyl('body', 0.32, 0.06, COL.CONCD, PBR.CONC, x, 0.13, -0.75, { seg: 12 }); B.cyl('body', 0.27, 0.02, COL.DARK, PBR.DARKM, x, 0.17, -0.75, { seg: 12 });
      B.box('body', 0.04, 0.01, 0.26, add ? 0xe0b020 : COL.LIGHT, PBR.PAINT, x - 0.08, 0.185, -0.75, { bevel: 0 }); B.box('body', 0.04, 0.01, 0.26, add ? 0xe0b020 : COL.LIGHT, PBR.PAINT, x + 0.08, 0.185, -0.75, { bevel: 0 }); B.box('body', 0.16, 0.01, 0.04, add ? 0xe0b020 : COL.LIGHT, PBR.PAINT, x, 0.185, -0.75, { bevel: 0 });
      B.torus('body', 0.3, 0.012, add ? 0xe0b020 : 'TA', PBR.GLOW2, x, 0.17, -0.75, { rx: Math.PI / 2, seg: 24 }); }
    B.box('body', 0.34, 0.85, 0.34, COL.LIGHT, PBR.PAINT, -1.75, 0.5, -0.2); B.box('body', 0.44, 0.18, 0.44, COL.GLASS, PBR.GLASS, -1.75, 1.0, -0.2, { bevel: 0.02 }); B.cyl('body', 0.01, 0.4, COL.GUN, PBR.DARKM, -1.75, 1.3, -0.2, { seg: 4 });
    B.piv.spin = [-1.75, 1.11, -0.2]; B.box('spin', 0.4, 0.04, 0.05, COL.LIGHT, PBR.METAL, 0, 0, 0); B.glow('spin', 0.03, 0.03, 0.03, COL.RED, 0.2, 0.02, 0);
  },
  cc(B) { BLD_MODELS.hq(B); for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2]]) { B.cyl('body', 0.03, 1.4, COL.STEEL, PBR.METAL, x, 1.2, z, { seg: 6 }); B.glow('body', 0.06, 0.06, 0.06, 'TA', x, 1.92, z); } },
  extractor(B) {
    B.box('body', 1.9, 0.12, 1.9, 0x47494a, PBR.CONC, 0, 0.06, 0, { bevel: 0.04 });
    B.cyl('body', 0.5, 0.9, 'T', PBR.PAINT, -0.2, 0.55, -0.2, { seg: 16 }); B.cyl('body', 0.52, 0.08, COL.STEEL, PBR.METAL, -0.2, 0.95, -0.2, { seg: 16 });
    B.sph('body', 0.5, 'T', PBR.PAINT, -0.2, 1.0, -0.2, { half: true, seg: 14 });
    for (const [x, z] of [[0.55, 0.55], [0.55, -0.4], [-0.5, 0.6]]) { B.cyl('body', 0.14, 0.7, COL.STEEL, PBR.METAL, x, 0.45, z, { seg: 10 }); B.glow('body', 0.2, 0.05, 0.2, 0x55ffcc, x, 0.82, z); }
    B.box('body', 0.9, 0.08, 0.08, COL.STEEL, PBR.METAL, 0.2, 0.3, 0.55); B.box('body', 0.08, 0.08, 0.9, COL.STEEL, PBR.METAL, 0.55, 0.3, 0.1);
    B.glow('body', 0.6, 0.06, 0.6, 0x44ffbb, -0.2, 1.3, -0.2, { bevel: 0 }); B.piv.smoke = [-0.2, 1.4, -0.2];
  },
  gcannon(B) { // v6.0 Grand Cannon rework: fortified octagonal bastion, massive armoured turret, long 3-section barrel + muzzle brake (part 'gun' recoils)
    const fac = (typeof G !== 'undefined' && G.players && G.players[B.team]) ? G.players[B.team].fac : 'fra';
    const TRI = { fra: [0x1f3b8c, 0xe8e8e0, 0xc8232c], usa: [0x2b2f6b, 0xe8e8e0, 0xb22234], rus: [0xe8e8e0, 0x1e48a8, 0xc8232c], ger: [0x1a1a1a, 0xc8232c, 0xe0b020], bra: [0x009c3b, 0xffd400, 0x1a3a8a] }[fac] || ['TA', 'TL', 'TA'];
    const CON = 0x7d7a70, COND = 0x5c5a53, ARM = COL.STEEL;
    // bastion: stepped octagonal concrete fort with buttresses, firing-step parapet, armour skirt, team band + national stripes
    B.cyl('body', 1.02, 0.28, COND, PBR.CONC, 0, 0.14, 0, { rt: 0.98, seg: 8 }); B.cyl('body', 0.94, 0.3, CON, PBR.CONC, 0, 0.42, 0, { rt: 0.84, seg: 8 });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; B.box('body', 0.26, 0.5, 0.34, COND, PBR.CONC, Math.cos(a) * 0.9, 0.25, Math.sin(a) * 0.9, { ry: -a, bevel: 0.03 });
      B.box('body', 0.12, 0.14, 0.5, ARM, PBR.METAL, Math.cos(a + Math.PI / 8) * 0.83, 0.62, Math.sin(a + Math.PI / 8) * 0.83, { ry: -(a + Math.PI / 8) + Math.PI / 2, bevel: 0.02 }); }
    B.cyl('body', 0.86, 0.06, 'T', PBR.PAINT, 0, 0.58, 0, { seg: 8 });
    for (let k = 0; k < 3; k++) for (const sd of [1, -1]) B.box('body', 0.04, 0.16, 0.14, TRI[k], PBR.PAINT, sd * 0.955, 0.36, (k - 1) * 0.14, { bevel: 0 }); // stripes on both flanks
    for (let k = 0; k < 3; k++) B.box('body', 0.14, 0.16, 0.04, TRI[k], PBR.PAINT, (k - 1) * 0.14, 0.36, 0.955, { bevel: 0 });
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; B.cyl('body', 0.1, 0.36, 0xa89670, PBR.CLOTH, Math.cos(a) * 1.04, 0.07, Math.sin(a) * 1.04, { rz: Math.PI / 2, ry: -a + Math.PI / 2, seg: 7 }); } // sandbags at the foot
    B.box('body', 0.3, 0.12, 0.2, 0x4a4a3a, PBR.DARKM, -0.62, 0.66, 0.42, { bevel: 0.02 }); B.box('body', 0.3, 0.12, 0.2, 0x4a4a3a, PBR.DARKM, -0.62, 0.66, -0.42, { bevel: 0.02 }); // ammo lockers
    // turret (yaws): turntable ring, sloped glacis, side cheeks, rear bustle, commander cupola, periscopes, national stripe
    B.piv.head = [0, 0.66, 0];
    B.cyl('head', 0.72, 0.12, COL.DARK, PBR.DARKM, 0, 0.06, 0, { seg: 20 }); B.cyl('head', 0.66, 0.24, 'T', PBR.PAINT, 0, 0.24, 0, { rt: 0.6, seg: 16 });
    B.box('head', 1.0, 0.42, 0.9, 'T', PBR.PAINT, -0.05, 0.55, 0, { bevel: 0.06 }); B.box('head', 0.42, 0.34, 0.8, 'TD', PBR.PAINT, 0.48, 0.5, 0, { rz: 0.5, bevel: 0.05 }); // glacis
    for (const sd of [1, -1]) { B.box('head', 0.9, 0.36, 0.12, ARM, PBR.METAL, 0.02, 0.55, sd * 0.5, { ry: sd * 0.05, bevel: 0.03 }); for (let k = 0; k < 3; k++) B.box('head', 0.12, 0.1, 0.02, TRI[k], PBR.PAINT, -0.22 + k * 0.12, 0.62, sd * 0.565, { bevel: 0 }); }
    B.box('head', 0.42, 0.3, 0.7, 'TD', PBR.PAINT, -0.7, 0.55, 0, { bevel: 0.05 }); B.box('head', 0.08, 0.06, 0.74, COL.DARK, PBR.DARKM, -0.92, 0.62, 0, { bevel: 0 }); // bustle + rack
    B.cyl('head', 0.17, 0.16, 'T', PBR.PAINT, -0.3, 0.84, 0.22, { seg: 12 }); B.sph('head', 0.15, COL.STEEL, PBR.METAL, -0.3, 0.92, 0.22, { seg: 10, half: 1 }); B.glow('head', 0.05, 0.04, 0.12, 'TL', -0.16, 0.86, 0.22);
    B.box('head', 0.06, 0.14, 0.06, COL.DARK, PBR.DARKM, -0.05, 0.84, -0.25, { bevel: 0 }); B.cyl('head', 0.012, 0.5, 0x222222, PBR.METAL, -0.75, 1.0, -0.3, { seg: 4 }); // periscope + antenna
    B.cyl('head', 0.22, 0.36, COL.STEEL, PBR.METAL, 0.62, 0.55, 0, { rz: -Math.PI / 2, seg: 16 }); // mantlet
    // barrel (part 'gun', yaws with the turret + recoils): 3 tapering sections, reinforcement bands, fume extractor, muzzle brake
    B.piv.gun = [0, 0.66, 0]; const E = 0.07, ax = (d, r) => [0.62 + Math.cos(E) * d, 0.55 + Math.sin(E) * d]; const seg = (d0, len, r, c, pb) => { const [x, y] = ax(d0 + len / 2); B.cyl('gun', r, len, c || COL.GUN, pb || PBR.DARKM, x, y, 0, { rz: E - Math.PI / 2, seg: 14, rt: r * 0.96 }); };
    seg(0.1, 0.9, 0.17, COL.STEEL, PBR.METAL); seg(1.0, 0.85, 0.145); seg(1.85, 0.8, 0.125);
    for (const d of [0.95, 1.8]) seg(d, 0.1, d < 1 ? 0.195 : 0.165, ARM, PBR.METAL);
    seg(1.25, 0.3, 0.175, COL.DARK); // fume extractor
    seg(2.65, 0.08, 0.15, 'TA', PBR.ACC); seg(2.73, 0.36, 0.17, COL.DARK); // team band + muzzle brake body
    { const [x, y] = ax(2.9); for (const sd of [1, -1]) B.box('gun', 0.08, 0.13, 0.08, COL.GUN, PBR.DARKM, x, y, sd * 0.17, { bevel: 0.01 }); const [x2, y2] = ax(2.8); for (const sd of [1, -1]) B.box('gun', 0.08, 0.13, 0.08, COL.GUN, PBR.DARKM, x2, y2, sd * 0.17, { bevel: 0.01 }); }
    { const [x, y] = ax(3.1); B.piv.tip = 3.1 + 0.62; B.piv.tipZ = 0.66 + y; }
  },
  wall(B) { B.box('body', 0.42, 0.72, 0.42, COL.CONC, PBR.CONC, 0, 0.36, 0, { bevel: 0.05 }); B.box('body', 0.48, 0.08, 0.48, 'TD', PBR.PAINT, 0, 0.74, 0, { bevel: 0.02 }); B.box('body', 0.5, 0.1, 0.5, 0x55595e, PBR.METAL, 0, 0.05, 0, { bevel: 0.02 }); },
};
const MODEL_CACHE = {};
function getModel(kind, t, team) {
  const k = kind + t + team; if (MODEL_CACHE[k]) return MODEL_CACHE[k];
  const B = new MB(team); B.bld = kind !== 'u'; (kind === 'u' ? UNIT_MODELS : BLD_MODELS)[t](B);
  if (kind === 'u' && UT[t].armor !== 'inf' && !UT[t].air && t !== 'harv') { const g = mergeGeos(B.parts.body); const bb = g.boundingBox; for (const z of [bb.max.z + 0.004, bb.min.z - 0.004]) B.box('body', (bb.max.x - bb.min.x) * 0.3, 0.03, 0.006, 'TA', PBR.ACC, bb.min.x + (bb.max.x - bb.min.x) * 0.35, bb.min.y + (bb.max.y - bb.min.y) * 0.62, z, { bevel: 0 }); }
  return MODEL_CACHE[k] = B.build();
}
