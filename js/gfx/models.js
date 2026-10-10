'use strict';
// ===== Procedural PBR models: merged geometry with per-vertex color + pbr(metal, rough, emissive) =====
const PBR = { PAINT: [0.35, 0.42, 0], METAL: [0.85, 0.3, 0], DARKM: [0.7, 0.5, 0], RUB: [0, 0.92, 0], CONC: [0, 0.88, 0], GLASS: [0.2, 0.05, 0.25], GLOW: [0, 0.5, 2.0], GLOW2: [0, 0.5, 1.4], ORE: [0.55, 0.28, 0.22] };
const COL = { STEEL: 0x5f6770, DARK: 0x2b2f35, GUN: 0x1c1f23, RUB: 0x151617, LIGHT: 0xb8c0c9, YEL: 0xe0a51a, GLASS: 0x86d4ff, HEAD: 0xfff1c4, RED: 0xff3322, GRN: 0x33ff66, CONC: 0x8d9094, CONCD: 0x6c6f73, SKIN: 0xd9a37a, ORE: 0xffc23a, SAND: 0xa59872 };
let PBR_MAT = null;
// fog-of-war applied inside shaders (sampled from a 64x64 alpha texture in world space)
const FOW = { uFow: { value: null }, uFowC: { value: new THREE.Color(0x04070b) }, uFowOn: { value: 1 } };
function fowPatch(sh) {
  sh.uniforms.uFow = FOW.uFow; sh.uniforms.uFowC = FOW.uFowC; sh.uniforms.uFowOn = FOW.uFowOn;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFowW;').replace('#include <project_vertex>', `#include <project_vertex>
    vec4 fowP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
    fowP = instanceMatrix * fowP;
    #endif
    vFowW = (modelMatrix * fowP).xyz;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFowW; uniform sampler2D uFow; uniform vec3 uFowC; uniform float uFowOn;')
    .replace('#include <tonemapping_fragment>', `if (uFowOn > 0.5) { float fa = texture2D(uFow, vec2(vFowW.x / ${MW}.0, 1.0 - vFowW.z / ${MH}.0)).a; gl_FragColor.rgb = mix(gl_FragColor.rgb, uFowC, fa * 0.97); }
    #include <tonemapping_fragment>`);
}
function pbrMaterial() {
  if (PBR_MAT) return PBR_MAT;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, envMapIntensity: 1.0 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 pbr;\nvarying vec3 vPbr;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = pbr;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPbr;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.x;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vPbr.y;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vPbr.z;');
    fowPatch(sh);
  };
  m.customProgramCacheKey = () => 'pbrv1';
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
  col(c) { if (c === 'T') return new THREE.Color(TEAMCOL[this.team]); if (c === 'TD') return new THREE.Color(TEAMCOL[this.team]).multiplyScalar(0.45); if (c === 'TL') return new THREE.Color(TEAMCOL[this.team]).lerp(new THREE.Color(0xffffff), 0.35); return new THREE.Color(c); }
  add(part, geo, c, pbr, x, y, z, o) {
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
  glow(p, w, h, d, c, x, y, z, o) { return this.box(p, w, h, d, c, PBR.GLOW, x, y, z, Object.assign({ bevel: 0 }, o || {})); }
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
  rifle(B) { inf(B, 'rifle'); }, rocketeer(B) { inf(B, 'rocketeer'); }, engineer(B) { inf(B, 'engineer'); },
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
function inf(B, kind) {
  const s = 1.25, P = (part, w, h, d, c, m, x, y, z, o) => B.box(part, w * s, h * s, d * s, c, m, x * s, y * s, z * s, o);
  P('body', 0.06, 0.2, 0.06, COL.DARK, PBR.RUB, 0, 0.1, 0.045); P('body', 0.06, 0.2, 0.06, COL.DARK, PBR.RUB, 0, 0.1, -0.045);
  P('body', 0.12, 0.17, 0.17, 'T', PBR.PAINT, 0, 0.29, 0); P('body', 0.08, 0.12, 0.14, 'TD', PBR.PAINT, -0.09, 0.3, 0);
  B.sph('body', 0.055 * s, COL.SKIN, PBR.RUB, 0.01 * s, 0.43 * s, 0);
  B.sph('body', 0.064 * s, kind === 'engineer' ? COL.YEL : 'TD', PBR.PAINT, 0, 0.455 * s, 0, { half: true });
  P('body', 0.05, 0.16, 0.05, 'T', PBR.PAINT, 0.05, 0.3, 0.1, { rz: -0.9 }); P('body', 0.05, 0.16, 0.05, 'T', PBR.PAINT, 0.05, 0.3, -0.1, { rz: -0.9 });
  if (kind === 'rifle') { P('body', 0.32, 0.035, 0.035, COL.GUN, PBR.DARKM, 0.13, 0.3, 0.06, { bevel: 0 }); P('body', 0.06, 0.06, 0.03, COL.GUN, PBR.DARKM, 0.08, 0.27, 0.06, { bevel: 0 }); }
  if (kind === 'rocketeer') { B.cyl('body', 0.04 * s, 0.42 * s, COL.STEEL, PBR.METAL, 0.04 * s, 0.42 * s, 0.07 * s, { rz: Math.PI / 2 }); B.glow('body', 0.02, 0.05, 0.05, 0xff5522, 0.26 * s, 0.42 * s, 0.07 * s); }
  if (kind === 'engineer') { P('body', 0.12, 0.08, 0.06, COL.YEL, PBR.PAINT, 0.04, 0.17, 0.12); B.glow('body', 0.02, 0.02, 0.02, COL.GRN, 0.07 * s, 0.32 * s, 0); }
  B.piv.tip = 0.45;
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
      B.torus('body', 0.3, 0.025, 'T', PBR.GLOW2, x, 1.33, -0.32, { rx: Math.PI / 2 }); B.cyl('body', 0.26, 0.02, 'TL', PBR.GLOW, x, 1.31, -0.32, { seg: 20 });
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
    B.cyl('body', 0.015, 1.3, COL.LIGHT, PBR.METAL, 0.8, 0.8, 0.7, { seg: 6 }); B.box('body', 0.34, 0.2, 0.01, 'T', PBR.GLOW2, 0.98, 1.32, 0.7, { bevel: 0 });
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
  airpad(B) {
    B.cyl('body', 0.98, 0.14, COL.CONCD, PBR.CONC, 0, 0.07, 0, { seg: 8 }); B.cyl('body', 0.85, 0.03, COL.DARK, PBR.DARKM, 0, 0.155, 0, { seg: 8 });
    B.box('body', 0.08, 0.01, 0.6, COL.LIGHT, PBR.PAINT, -0.22, 0.175, 0, { bevel: 0 }); B.box('body', 0.08, 0.01, 0.6, COL.LIGHT, PBR.PAINT, 0.22, 0.175, 0, { bevel: 0 }); B.box('body', 0.44, 0.01, 0.08, COL.LIGHT, PBR.PAINT, 0, 0.175, 0, { bevel: 0 });
    B.torus('body', 0.72, 0.015, 'T', PBR.GLOW2, 0, 0.17, 0, { rx: Math.PI / 2, seg: 32 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.glow('body', 0.05, 0.05, 0.05, i % 2 ? COL.GRN : 'T', Math.cos(a) * 0.9, 0.18, Math.sin(a) * 0.9); }
    B.box('body', 0.3, 0.6, 0.3, COL.LIGHT, PBR.PAINT, 0.8, 0.3, -0.8); B.box('body', 0.34, 0.12, 0.34, COL.GLASS, PBR.GLASS, 0.8, 0.66, -0.8, { bevel: 0 });
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
  aagun(B) {
    B.cyl('body', 0.46, 0.22, COL.CONCD, PBR.CONC, 0, 0.11, 0, { seg: 8 }); B.cyl('body', 0.3, 0.22, COL.STEEL, PBR.METAL, 0, 0.32, 0, { seg: 10 });
    B.piv.head = [0, 0.5, 0];
    B.box('head', 0.36, 0.18, 0.4, 'T', PBR.PAINT, 0, 0.06, 0);
    for (const z of [-0.14, 0.14]) { B.barrel('head', 0.5, 0.025, 0.08, 0.12, z, 0.95); B.barrel('head', 0.5, 0.025, 0.08, 0.12, z * 0.6, 0.95); }
    B.box('head', 0.05, 0.16, 0.2, COL.LIGHT, PBR.METAL, -0.2, 0.22, 0); B.glow('head', 0.04, 0.04, 0.04, COL.GRN, -0.2, 0.32, 0);
    B.piv.tip = 0.5;
  },
  wall(B) { B.box('body', 0.98, 0.62, 0.98, COL.CONC, PBR.CONC, 0, 0.31, 0, { bevel: 0.08 }); B.box('body', 1.0, 0.06, 1.0, 'TD', PBR.PAINT, 0, 0.6, 0, { bevel: 0.02 }); },
};
const MODEL_CACHE = {};
function getModel(kind, t, team) {
  const k = kind + t + team; if (MODEL_CACHE[k]) return MODEL_CACHE[k];
  const B = new MB(team); (kind === 'u' ? UNIT_MODELS : BLD_MODELS)[t](B);
  return MODEL_CACHE[k] = B.build();
}
