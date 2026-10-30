'use strict';
// ===== Terrain: smoothed heightfield, splat shader, water, foliage, fog overlay =====
const HR = 4; let HW = MW * HR + 1, HH = MH * HR + 1; // heightfield resolution (verts)
let HF = null;
const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;
const LVL_H = 1.5; // world height per elevation level
function lvlAt(x, y) { // bilinear level (smooth ramps)
  const fx = Math.max(0, Math.min(MW - 1.001, x - 0.5)), fy = Math.max(0, Math.min(MH - 1.001, y - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * MW + x0, L = G.lvl;
  return (L[i] * (1 - tx) + L[Math.min(L.length - 1, i + 1)] * tx) * (1 - ty) + (L[Math.min(L.length - 1, i + MW)] * (1 - tx) + L[Math.min(L.length - 1, i + MW + 1)] * tx) * ty; }
function heightAt(x, y) {
  const fx = Math.max(0, Math.min(HW - 1.001, x * HR)), fy = Math.max(0, Math.min(HH - 1.001, y * HR));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * HW + x0;
  return (HF[i] * (1 - tx) + HF[i + 1] * tx) * (1 - ty) + (HF[i + HW] * (1 - tx) + HF[i + HW + 1] * tx) * ty;
}
function buildHeightfield() {
  HW = MW * HR + 1; HH = MH * HR + 1; const R = mkRng(G.opts.seed + 11); HF = new Float32Array(HW * HH);
  const tileAt = (x, y) => G.map[Math.max(0, Math.min(MH - 1, y)) * MW + Math.max(0, Math.min(MW - 1, x))];
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { const t = tileAt(Math.floor((x - 0.5) / HR + 0.0001), Math.floor((y - 0.5) / HR + 0.0001)); const tx = Math.max(0, Math.min(MW - 1, Math.floor((x - 0.5) / HR + 0.0001))), ty = Math.max(0, Math.min(MH - 1, Math.floor((y - 0.5) / HR + 0.0001))), L = G.lvl[ty * MW + tx] * LVL_H; HF[y * HW + x] = (t === 1 ? (G.desert ? (G.mud && G.mud[ty * MW + tx] ? 0.15 : G.rim && G.rim[ty * MW + tx] ? 0.35 : 2.7) : 2.0) : t === 2 ? -1.1 : G.desert && G.wadi && G.wadi[ty * MW + tx] ? -0.45 : 0) + L; }
  const blur = (r) => { const tmp = new Float32Array(HF.length);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = Math.max(0, Math.min(HW - 1, x + k)); s += HF[y * HW + xx]; n++; } tmp[y * HW + x] = s / n; }
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = Math.max(0, Math.min(HH - 1, y + k)); s += tmp[yy * HW + x]; n++; } HF[y * HW + x] = s / n; } };
  blur(2); blur(2);
  // detail noise (stronger on rock), keep walkable tiles near 0
  const n2 = (x, y, f) => Math.sin(x * f * 1.7 + Math.sin(y * f * 1.3)) * Math.cos(y * f * 1.1 + Math.sin(x * f * 0.7));
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const i = y * HW + x, h = HF[i], wx = x / HR, wy = y / HR, rock = Math.max(0, Math.min(1, h / 1.2));
    HF[i] = h + rock * (n2(wx, wy, 0.9) * 0.35 + n2(wx, wy, 2.3) * 0.15 + 0.4 * rock) + (1 - rock) * n2(wx, wy, 0.6) * 0.03;
    const t = tileAt(Math.floor(wx), Math.floor(wy)), L = lvlAt(wx, wy) * LVL_H; if (t === 0) HF[i] = Math.max(L - 0.22, Math.min(HF[i], L + 0.25 + (HF[i] - L) * 0.2));
  }
}
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 });
  m.extensions = { derivatives: true };
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vW = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    Object.assign(sh.uniforms, texUniforms());
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vSplat;\nvarying vec3 vW;\nvarying vec3 vWN;\n' + GLSL_NOISE + TEX_GLSL_HEAD)
      .replace('#include <map_fragment>', `
        vec2 q = vW.xz; vec3 tNrm = vec3(0.0);
        float fwq = length(fwidth(q)); float n1 = fbm(q * 0.35), n2 = fbm(q * 1.7 + 3.1), n3 = mix(0.5, vnoise(q * 9.0), clamp(1.0 - fwq * 9.0 * 0.6, 0.0, 1.0)), n4 = mix(0.5, vnoise(q * 31.0), clamp(1.0 - fwq * 31.0 * 0.6, 0.0, 1.0));
        vec4 w = vSplat; w.y *= 0.7 + 0.6*n2; w.x *= 0.8 + 0.4*n1; w = max(w, vec4(0.0)); w /= max(0.0001, w.x+w.y+w.z+w.w);
        w = pow(w, vec4(1.6)); w /= (w.x+w.y+w.z+w.w);
        #if TEXQ == 0
        vec3 grass = mix(vec3(0.075,0.15,0.035), vec3(0.17,0.25,0.06), n1) * (0.8 + 0.35*n3) * (0.9 + 0.2*n4);
        grass = mix(grass, vec3(0.24,0.22,0.09), smoothstep(0.55, 0.75, n2) * 0.45);
        vec3 dirt = mix(vec3(0.16,0.10,0.05), vec3(0.28,0.19,0.10), n2) * (0.75 + 0.45*n3);
        vec3 rock = mix(vec3(0.17,0.16,0.15), vec3(0.36,0.33,0.29), n2) * (0.7 + 0.5*vnoise(q*5.0 + vW.y*3.0));
        rock *= 0.85 + 0.15*sin(vW.y*11.0 + n1*6.0);
        vec3 sand = mix(vec3(0.38,0.31,0.19), vec3(0.50,0.42,0.27), n3);
        #if THEME == 1
          grass = mix(vec3(0.46,0.5,0.56), vec3(0.66,0.7,0.76), n1) * (0.85 + 0.2*n3); dirt = mix(vec3(0.30,0.30,0.32), vec3(0.45,0.46,0.5), n2); sand = vec3(0.55,0.62,0.7); rock = mix(rock, vec3(0.5,0.55,0.6), 0.35);
        #elif THEME == 2
          grass = mix(vec3(0.07,0.06,0.055), vec3(0.16,0.13,0.11), n1) * (0.8 + 0.35*n3); dirt = mix(vec3(0.2,0.1,0.05), vec3(0.32,0.16,0.07), n2); rock = rock * vec3(0.7,0.62,0.58);
        #elif THEME == 3
          { float rip = 0.5 + 0.5*sin(q.x*2.3 + q.y*0.9 + n1*9.0);
          grass = mix(vec3(0.42,0.29,0.15), vec3(0.56,0.41,0.22), n1) * (0.86 + 0.18*n3) * (0.94 + 0.08*rip); grass = mix(grass, vec3(0.36,0.27,0.16), smoothstep(0.6, 0.8, n2) * 0.5);
          dirt = mix(vec3(0.27,0.17,0.09), vec3(0.38,0.25,0.13), n2) * (0.8 + 0.35*n3); sand = mix(vec3(0.62,0.5,0.32), vec3(0.72,0.6,0.4), n3) * (0.92 + 0.1*rip);
          rock = rock * vec3(1.55,1.12,0.8) * (0.9 + 0.25*smoothstep(0.3, 0.7, fract(vW.y*1.6 + n1*0.6))); }
        #endif
        #endif
        ` + TEX_GLSL_COLOR + `
        float tRock = w.z; float tGrass = w.x;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.72, tRock) - n4*0.08;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #if TEXQ == 0
        { float hb = (fbm(q*2.0)*(0.03 + 0.3*tRock) + vnoise(q*9.0)*0.006) * clamp(1.0 - fwq * 4.0, 0.0, 1.0);
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hb), dhy = dFdy(hb);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - grad * 2.5); }
        #endif` + TEX_GLSL_NORMAL);
    fowPatch(sh);
  };
  m.defines = { THEME: G.mapName === 'frost' ? 1 : G.mapName === 'volcano' ? 2 : G.desert ? 3 : 0, TEXQ: 0 }; m.customProgramCacheKey = () => 'terrain3_' + m.defines.THEME + '_' + m.defines.TEXQ;
  TEX.mats = [m]; TEX.ready = ''; texLoad(); // v7.6.2: swap in the texture set when it arrives
  return m;
}
function buildTerrain3() {
  buildHeightfield();
  const geo = new THREE.PlaneGeometry(MW, MH, HW - 1, HH - 1); geo.rotateX(-Math.PI / 2); geo.translate(MW / 2, 0, MH / 2);
  const pos = geo.attributes.position, n = pos.count;
  // PlaneGeometry vertex order: rows from z=0 (after rotation) ... compute from coords
  for (let i = 0; i < n; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal, spl = new Float32Array(n * 4), col = new Float32Array(n * 3);
  // ore mask blurred
  const oreAt = (x, y) => { let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tx = Math.floor(x + dx * 0.6), ty = Math.floor(y + dy * 0.6); if (inb(tx, ty) && G.oreMax[ty * MW + tx] > 0) s++; } return s / 9; };
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nor.getY(i);
    const hl = h - lvlAt(x, z) * LVL_H; let rock = Math.max(0, Math.min(1, (0.93 - ny) / 0.15)) * (lvlAt(x, z) % 1 > 0.05 && lvlAt(x, z) % 1 < 0.95 ? 0.25 : 1) + Math.max(0, Math.min(1, (hl - 0.6) / 0.6));
    let sand = hl < -0.1 ? Math.min(1, (-0.1 - hl) / 0.3) : 0, dirt = oreAt(x, z) * 1.2; if (G.wadi && G.wadi[Math.min(MH - 1, Math.floor(z)) * MW + Math.min(MW - 1, Math.floor(x))]) sand = Math.max(sand, 0.85);
    rock = Math.min(1, rock); const grass = Math.max(0, 1 - rock - sand - dirt);
    spl.set([grass, dirt, rock, sand], i * 4);
    // cavity AO: compare with neighborhood
    const avg = (heightAt(x + 1, z) + heightAt(x - 1, z) + heightAt(x, z + 1) + heightAt(x, z - 1)) / 4;
    const ao = Math.max(0.3, Math.min(1, 1 - (avg - h) * 0.9));
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(spl, 4)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, terrainMaterial()); mesh.receiveShadow = true; R3.scene.add(mesh); R3.terrain = mesh;
  // outside skirt
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: G.desert ? 0x4a3a28 : 0x1c2416, roughness: 1 }));
  sk.position.set(MW / 2, -0.6, MH / 2); R3.scene.add(sk);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(MW + 0.6, 0.6, MH + 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.9 })); edge.position.set(MW / 2, -0.62, MH / 2); R3.scene.add(edge);
  buildFogOverlay(); buildWater(); buildOre(); buildFoliage(); buildVents(); buildLandmarks(); buildSurfaces(); if (G.desert) buildDesert();
}
function buildWater() {
  // height texture for shoreline foam (bytes)
  const S = 256, d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const h = heightAt((x + 0.5) / S * MW, (y + 0.5) / S * MH), v = Math.max(0, Math.min(255, (h + 1.5) / 4 * 255)); d.set([v, v, v, 255], (y * S + x) * 4); }
  const ht = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: R3.uTime, uH: { value: ht }, uSun: { value: R3.sunDir }, uSky: { value: new THREE.Color(0x9fc4e8) }, uDeep: { value: new THREE.Color(0x06263a) }, uShallow: { value: new THREE.Color(0x1d7f8a) }, uFow: FOW.uFow, uFowC: FOW.uFowC },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: GLSL_NOISE + `
      uniform float uTime; uniform sampler2D uH, uFow; uniform vec3 uFowC; uniform vec3 uSun, uSky, uDeep, uShallow; varying vec3 vW;
      void main(){
        vec2 q = vW.xz; float t = mod(uTime, 628.3185); float aa = clamp(1.0 - length(fwidth(q)) * 2.5, 0.0, 1.0);
        vec2 g = vec2(0.0);
        g += vec2(cos(q.x*1.3 + t*1.1), sin(q.y*1.1 - t*0.9)) * 0.08;
        g += vec2(cos(q.x*3.1 - q.y*2.0 + t*2.0), sin(q.y*2.7 + q.x*1.7 + t*1.7)) * 0.04 * aa;
        g += (vec2(vnoise(q*4.0 + t*0.6), vnoise(q*4.0 - t*0.5)) - 0.5) * 0.12 * aa;
        vec3 N = normalize(vec3(g.x, 1.0, g.y));
        vec3 V = normalize(cameraPosition - vW);
        float th = texture2D(uH, vec2(vW.x/${MW}.0, vW.z/${MH}.0)).r * 4.0 - 1.5;
        float depth = max(0.0, vW.y - th);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.9, depth));
        float fres = 0.04 + 0.96*pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uSky*0.7, uSky*1.25, clamp(R.y, 0.0, 1.0));
        col = mix(col, sky, fres*0.8);
        float spec = pow(max(dot(R, uSun), 0.0), 90.0) * 1.6 * aa;
        float foamN = vnoise(q*6.0 + vec2(t*0.4, -t*0.3)) * mix(0.5, vnoise(q*13.0 - t*0.5), aa);
        float foam = smoothstep(0.32, 0.0, depth) * (0.55 + 0.9*foamN) + smoothstep(0.55, 0.45, abs(depth - 0.25 - 0.1*sin(t*1.5 + q.x*2.0)))*0.25*foamN;
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col + spec, vec3(0.85, 0.9, 0.92), foam);
        float a = clamp(0.55 + depth*0.6 + fres*0.3, 0.0, 0.94); a = max(a, foam);
        a *= smoothstep(0.0, 0.14, depth + 0.03);
        float fa = texture2D(uFow, vec2(vW.x / ${MW}.0, 1.0 - vW.z / ${MH}.0)).a; col = mix(col, uFowC, fa * 0.97);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH, 1, 1).rotateX(-Math.PI / 2), mat); w.position.set(MW / 2, -0.3, MH / 2); w.renderOrder = 2; mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2; R3.scene.add(w); R3.water = w;
}
function buildFogOverlay() {
  R3.fogData = new Uint8Array(MW * MH * 4); for (let i = 0; i < MW * MH; i++) R3.fogData[i * 4 + 3] = 255;
  R3.fogTex = new THREE.DataTexture(R3.fogData, MW, MH, THREE.RGBAFormat); R3.fogTex.magFilter = R3.fogTex.minFilter = THREE.LinearFilter; R3.fogTex.needsUpdate = true;
  FOW.uFow.value = R3.fogTex; FOW.uMapS.value.set(MW, MH);
}
function updFogTex(dt) {
  const d = R3.fogData, f = (R3.fogF && R3.fogF.length === MW * MH) ? R3.fogF : (R3.fogF = new Float32Array(MW * MH).fill(250)), k = 1 - Math.exp(-(dt || 0.016) * 7);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, j = ((MH - 1 - y) * MW + x) * 4; const a = vis0(i) ? 0 : seen0(i) ? 135 : 250; f[i] += (a - f[i]) * k; d[j + 3] = Math.round(f[i]); }
  R3.fogTex.needsUpdate = true;
}
function buildOre() { if (typeof ensureFields === 'function') ensureFields();
  { const oc = new THREE.Color(COL.ORE), f = (v, t) => Math.min(40, t / Math.max(0.02, v)); R3.diaCol = new THREE.Color(f(oc.r, 0.25), f(oc.g, 0.85), f(oc.b, 1.1)); R3.diaRich = new THREE.Color(f(oc.r, 0.55), f(oc.g, 1.2), f(oc.b, 1.5)); } // v6.2 diamond ore: true cyan regardless of the gold base colour
  R3.oreTiles = []; for (let i = 0; i < MW * MH; i++) if (G.oreMax[i] > 0) R3.oreTiles.push(i);
  const geo = new THREE.OctahedronGeometry(0.2, 0); geo.scale(1, 1.7, 1);
  const B = new MB(0); B.add('c', geo, COL.ORE, PBR.ORE, 0, 0, 0); const g = B.build().c;
  // own material: ore uses per-instance colour (rich gold); sharing PBR_MAT made other instanced meshes pick the instanceColor program (black units)
  const om = pbrMaterial().clone(); om.onBeforeCompile = pbrMaterial().onBeforeCompile; om.customProgramCacheKey = () => 'pbrv2ic';
  R3.oreMesh = new THREE.InstancedMesh(g, om, R3.oreTiles.length * 4); R3.oreMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(R3.oreTiles.length * 12).fill(1), 3); R3.oreMesh.castShadow = true; R3.oreMesh.receiveShadow = true; R3.oreMesh.frustumCulled = false; R3.scene.add(R3.oreMesh);
  const R = mkRng(5); R3.oreJ = R3.oreTiles.map(() => [0, 1, 2, 3].map(() => [R(), R(), R(), R()]));
}
function updOre() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  R3.oreTiles.forEach((i, k) => { const a = G.ore[i], seen = seen0(i), x = i % MW, y = (i / MW) | 0;
    for (let j = 0; j < 4; j++) { const r = R3.oreJ[k][j], f = a / Math.max(1, G.oreMax[i]); const sc = seen && a > 1 && f > j * 0.22 ? (0.3 + 0.45 * Math.sqrt(f)) * (0.6 + r[2] * 0.7) : 0;
      e.set((r[0] - 0.5) * 0.6, r[1] * 6, (r[3] - 0.5) * 0.6); q.setFromEuler(e); const px = x + 0.15 + r[0] * 0.7, pz = y + 0.15 + r[1] * 0.7; p.set(px, heightAt(px, pz) + sc * 0.12, pz); s.set(sc, sc, sc);
      m4.compose(p, q, s); R3.oreMesh.setMatrixAt(k * 4 + j, m4); if (!R3.oreCol) R3.oreMesh.setColorAt(k * 4 + j, G.dia && G.dia[i] ? (G.rich && G.rich[i] ? R3.diaRich : R3.diaCol) : G.rich && G.rich[i] ? new THREE.Color(2.2, 1.35, 0.25) : new THREE.Color(1, 1, 1)); } });
  if (!R3.oreCol) { R3.oreCol = 1; R3.oreMesh.instanceColor.needsUpdate = true; }
  R3.oreMesh.instanceMatrix.needsUpdate = true;
}
function windMat(upNormal, rough) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough || 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => { sh.uniforms.uTime = R3.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      float sw = sin(uTime*1.8 + ip.x*0.6 + ip.z*0.4) + 0.5*sin(uTime*3.1 + ip.x*1.3);
      transformed.x += sw * 0.06 * max(position.y, 0.0) * 2.5; transformed.z += sw * 0.03 * max(position.y, 0.0) * 2.5;
      #endif`);
    if (upNormal) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);');
    fowPatch(sh); };
  m.customProgramCacheKey = () => 'wind' + (rough || 0) + (upNormal ? 'u' : ''); return m;
}
function buildFoliage() {
  const R = mkRng(G.opts.seed + 3);
  const nearBase = (x, y) => G.starts.some(s => Math.hypot(s[0] - x, s[1] - y) < 7);
  // grass tufts: 5 crossed blades with vertex color gradient
  const blades = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI, h = 0.18 + (i % 3) * 0.05; const g = new THREE.BufferGeometry();
    const c = Math.cos(a) * 0.05, s = Math.sin(a) * 0.05, ox = Math.cos(a * 2.3) * 0.04, oz = Math.sin(a * 1.7) * 0.04;
    g.setAttribute('position', new THREE.Float32BufferAttribute([ox - c, 0, oz - s, ox + c, 0, oz + s, ox + c * 0.1 + 0.03, h, oz + s * 0.1], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.08, 0.15, 0.035, 0.08, 0.15, 0.035, 0.2, 0.3, 0.07], 3)); g.computeVertexNormals();
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); blades.push(g); }
  const tg = new THREE.BufferGeometry(); { let P = [], C = [], N = []; for (const b of blades) { P.push(...b.attributes.position.array); C.push(...b.attributes.color.array); N.push(...b.attributes.normal.array); }
    tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); }
  const MAXG = G.desert ? 12000 : 30000, gm = new THREE.InstancedMesh(tg, windMat(true, 0.9), MAXG); gm.receiveShadow = true; gm.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cl = new THREE.Color(); let k = 0; R3.grassTile = [];
  let tries = 0;
  while (k < MAXG && tries++ < MAXG * 4) {
    const x = R() * MW, y = R() * MH, ti = Math.floor(y) * MW + Math.floor(x); if (G.map[ti] !== 0 || G.oreMax[ti] > 0 || nearBase(x, y)) continue;
    const h = heightAt(x, y); if (h > 0.35 || h < -0.05) continue;
    const s = 0.45 + R() * 0.5; e.set(0, R() * 6.28, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, h, y), q, new THREE.Vector3(s, s * (0.8 + R() * 0.6), s)); gm.setMatrixAt(k, m4);
    cl.setRGB(0.8 + R() * 0.4, 0.85 + R() * 0.3, 0.7 + R() * 0.3); gm.setColorAt(k, cl); (R3.grassTile[ti] = R3.grassTile[ti] || []).push(k); k++;
  }
  gm.count = k; R3.grassMax = k; R3.grass = gm; if (G.mapName === 'frost' || G.mapName === 'volcano' || G.desert) { gm.material = gm.material.clone(); gm.material.color.set(G.mapName === 'frost' ? 0x9aa4ad : G.desert ? 0x8a6c3c : 0x3a2e26); } R3.scene.add(gm);
  // trees (pine) near cliffs and scattered
  const B = new MB(0); B.cyl('t', 0.05, 0.4, 0x4a3524, PBR.RUB, 0, 0.2, 0, { seg: 6 });
  for (let i = 0; i < 3; i++) B.cone('t', 0.36 - i * 0.09, 0.5, 0x2f5a26 + i * 0x061006, [0, 0.85, 0], 0, 0.45 + i * 0.27, 0, { seg: 8 });
  const treeGeo = B.build().t; const trees = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (G.map[i] !== 0 || G.oreMax[i] > 0 || nearBase(x + 0.5, y + 0.5)) continue;
    const nearRock = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].some(([a, b]) => inb(x + a, y + b) && G.map[(y + b) * MW + x + a] === 1);
    if (R() < (G.desert ? 0 : G.forest && G.forest[i] ? 0.6 : nearRock ? 0.45 : 0.012)) trees.push([x + 0.2 + R() * 0.6, y + 0.2 + R() * 0.6, 0.7 + R() * 0.7]); }
  const tm = new THREE.InstancedMesh(treeGeo, windMat(false, 0.8), trees.length); tm.castShadow = true; tm.receiveShadow = true; tm.frustumCulled = false;
  trees.forEach((t, j) => { e.set((R() - 0.5) * 0.1, R() * 6.28, (R() - 0.5) * 0.1); q.setFromEuler(e); m4.compose(new THREE.Vector3(t[0], heightAt(t[0], t[1]) - 0.05, t[1]), q, new THREE.Vector3(t[2], t[2] * (0.9 + R() * 0.4), t[2])); tm.setMatrixAt(j, m4);
    cl.setRGB(0.8 + R() * 0.4, 0.8 + R() * 0.4, 0.8 + R() * 0.3); tm.setColorAt(j, cl); (R3.treeTile = R3.treeTile || {})[Math.floor(t[1]) * MW + Math.floor(t[0])] = j; });
  R3.trees = tm; R3.scene.add(tm);
  // boulders on cliffs: displaced icosahedra
  const rg = new THREE.IcosahedronGeometry(0.5, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.8 + 0.35 * Math.sin(v.x * 7 + v.y * 5) * Math.cos(v.z * 6)); p.setXYZ(i, v.x, v.y * 0.75, v.z); } rg.computeVertexNormals(); }
  const RB = new MB(0); RB.add('r', rg, G.desert ? 0x9a7652 : 0x77706a, [0, 0.85, 0], 0, 0, 0); const rgeo = RB.build().r; const rocks = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (G.map[i] === 1 && !(G.mud && G.mud[i]) && R() < 0.3) rocks.push([x + R(), y + R(), 0.25 + R() * 0.55]);
    else if (G.map[i] === 0 && !G.oreMax[i] && R() < 0.02 && !nearBase(x, y)) rocks.push([x + R(), y + R(), 0.1 + R() * 0.12]); }
  const rm = new THREE.InstancedMesh(rgeo, pbrMaterial(), rocks.length); rm.castShadow = true; rm.receiveShadow = true; rm.frustumCulled = false;
  rocks.forEach((r, j) => { e.set(R() * 3, R() * 6, R() * 3); q.setFromEuler(e); m4.compose(new THREE.Vector3(r[0], heightAt(r[0], r[1]) + r[2] * 0.1, r[1]), q, new THREE.Vector3(r[2], r[2], r[2])); rm.setMatrixAt(j, m4); });
  R3.scene.add(rm);
}
function buildLandmarks() {
  // bridges: plank decks + rails over river causeways
  const tiles = []; for (let i = 0; i < MW * MH; i++) if (G.bridge && G.bridge[i]) tiles.push(i);
  if (tiles.length) {
    const B = new MB(0); B.box('d', 1.0, 0.1, 1.0, 0x5a4330, PBR.RUB, 0, 0.05, 0, { bevel: 0.01 }); for (let k = -2; k <= 2; k++) B.box('d', 0.98, 0.02, 0.04, 0x3a2a1c, PBR.RUB, 0, 0.105, k * 0.2, { bevel: 0 });
    const RB = new MB(0); RB.box('r', 0.08, 0.32, 1.0, 0x6d6e70, PBR.METAL, 0, 0.2, 0, { bevel: 0.01 }); RB.box('r', 0.12, 0.05, 1.0, 0x8a8c90, PBR.METAL, 0, 0.36, 0, { bevel: 0.01 });
    const dm = new THREE.InstancedMesh(B.build().d, pbrMaterial(), tiles.length), rails = [];
    const m4 = new THREE.Matrix4(); tiles.forEach((i, k) => { const x = i % MW, y = (i / MW) | 0; m4.makeTranslation(x + 0.5, 0.06, y + 0.5); dm.setMatrixAt(k, m4);
      if (!G.bridge[i - 1]) rails.push([x + 0.06, y + 0.5]); if (!G.bridge[i + 1]) rails.push([x + 0.94, y + 0.5]); });
    const rm = new THREE.InstancedMesh(RB.build().r, pbrMaterial(), rails.length); rails.forEach(([x, y], k) => { m4.makeTranslation(x, 0.06, y); rm.setMatrixAt(k, m4); });
    for (const m of [dm, rm]) { m.castShadow = m.receiveShadow = true; m.frustumCulled = false; R3.scene.add(m); }
  }
  // central landmark: ancient reactor spire
  if (G.monument) { const [mx, my] = G.monument, B = new MB(0);
    for (let k = 0; k < 3; k++) B.box('m', 3.8 - k * 0.8, 0.35, 3.8 - k * 0.8, 0x8d877c, [0, 0.8, 0], 0, 0.2 + k * 0.35, 0, { bevel: 0.04 });
    B.cyl('m', 0.55, 4.2, 0x5b5f66, PBR.METAL, 0, 3.1, 0, { seg: 8 }); B.cone('m', 0.55, 1.0, 0x5b5f66, PBR.METAL, 0, 5.7, 0, { seg: 8 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; B.box('m', 0.35, 2.4, 0.35, 0x7d776c, [0, 0.8, 0], Math.cos(a) * 1.5, 2.2, Math.sin(a) * 1.5, { bevel: 0.03 }); B.box('m', 0.2, 0.2, 0.2, 0x40e0ff, PBR.GLOW, Math.cos(a) * 1.5, 3.5, Math.sin(a) * 1.5, { bevel: 0 }); }
    for (let k = 0; k < 3; k++) B.cyl('m', 0.62, 0.08, 0x40e0ff, PBR.GLOW, 0, 2.0 + k * 1.1, 0, { seg: 12 });
    const g = B.build(); { const mesh = new THREE.Mesh(g.m, pbrMaterial()); mesh.position.set(mx, heightAt(mx, my) + 0.4, my); mesh.castShadow = mesh.receiveShadow = true; R3.scene.add(mesh); R3.monument = mesh; } }
}
function clearFoliage(b) { // remove grass/trees under a new building
  const m0 = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let y = b.ty - 1; y <= b.ty + b.h; y++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) { if (!inb(x, y)) continue; const i = y * MW + x;
    const gl = R3.grassTile[i]; if (gl) { for (const k of gl) R3.grass.setMatrixAt(k, m0); R3.grass.instanceMatrix.needsUpdate = true; R3.grassTile[i] = null; }
    if (R3.propTile && R3.propTile[i]) { for (const [mesh, k] of R3.propTile[i]) { mesh.setMatrixAt(k, m0); mesh.instanceMatrix.needsUpdate = true; } R3.propTile[i] = null; }
    if (R3.treeTile && R3.treeTile[i] != null && x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) { R3.trees.setMatrixAt(R3.treeTile[i], m0); R3.trees.instanceMatrix.needsUpdate = true; } }
}

// Plasma Gas vents: dark rocky crater with glowing teal core + rising gas wisps (render.js spawns wisps)
function buildVents() {
  R3.vents = [];
  for (const [vx, vy] of G.vents || []) {
    const x = vx + 0.5, y = vy + 0.5, h = heightAt(x, y), g = new THREE.Group(); g.position.set(x, h, y);
    const B = new MB(0);
    B.cyl('body', 0.62, 0.12, 0x2b2722, PBR.CONC, 0, 0.04, 0, { rt: 0.85, seg: 14 });
    const R = mkRng(vx * 31 + vy); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + R(); B.box('body', 0.22 + R() * 0.15, 0.12 + R() * 0.12, 0.18 + R() * 0.1, 0x3a352e, PBR.CONC, Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6, { ry: R() * 3 }); }
    B.cyl('body', 0.34, 0.03, 0x5fffd0, PBR.GLOW2, 0, 0.11, 0, { seg: 16 });
    const m = B.build(); const mesh = new THREE.Mesh(m.body, pbrMaterial()); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
    R3.scene.add(g); R3.vents.push({ x, y, g });
  }
}

// v6.3 lava: smooth organic shorelines + flowing molten shader. A blurred lava mask (per-vertex aF on a 3x3-subdivided
// grid that extends 2 tiles past the lava) is noise-perturbed in the shader, so the edge is rounded and fades through a
// cooled-basalt rim into the surrounding rock. Surface: domain-warped scrolling fbm, drifting cracked crust plates
// (voronoi seams glow), pulsing emissive, heat ripple. Bubbles / embers / haze are particles (lavaFX). Visual only:
// G.lava (gameplay) is untouched. Quiet mode (uLavaQ = 0) drops the warp + voronoi and the particles.
const LAVA_GLSL = `
vec2 lvVoro(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = vec2(hash12(i + g), hash12(i + g + 19.7)); float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return vec2(d1, d2); }
`;
function buildLava() {
  R3.lavaCore = null; R3.lavaVis = null;
  if (!G.lava || !G.lava.some(v => v)) return;
  // blurred mask at tile centres (two 3x3 box passes) -> smooth 0..1 field, ~0.5 on the original tile edges
  let f = Float32Array.from(G.lava); for (let pass = 0; pass < 2; pass++) { const o = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = Math.min(MW - 1, Math.max(0, x + dx)), yy = Math.min(MH - 1, Math.max(0, y + dy)); s += f[yy * MW + xx]; n++; } o[y * MW + x] = s / n; } f = o; }
  const fieldAt = (x, y) => { const fx = Math.max(0, Math.min(MW - 1.001, x - 0.5)), fy = Math.max(0, Math.min(MH - 1.001, y - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * MW + x0;
    const a = f[i], b = f[Math.min(i + 1, MW * MH - 1)], c = f[Math.min(i + MW, MW * MH - 1)], d = f[Math.min(i + MW + 1, MW * MH - 1)]; return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty; };
  const S = 3, pos = [], fa = [], idx = []; let n = 0;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (f[y * MW + x] < 0.012 && !G.lava[y * MW + x]) continue;
    const b0 = n; for (let j = 0; j <= S; j++) for (let k = 0; k <= S; k++) { const px = x + k / S, py = y + j / S; pos.push(px, heightAt(px, py) + 0.05, py); fa.push(fieldAt(px, py)); n++; }
    for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) { const a = b0 + j * (S + 1) + k, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(fa, 1)); g.setIndex(idx);
  R3.uLavaQ = R3.uLavaQ || { value: R3.qName === 'quiet' ? 0 : 1 };
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: R3.uTime, uQ: R3.uLavaQ }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'attribute float aF; varying vec3 vW; varying float vF; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vF = aF; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: GLSL_NOISE + LAVA_GLSL + `uniform float uTime, uQ; varying vec3 vW; varying float vF;
void main(){
  vec2 q = vW.xz; float t = uTime;
  float en = vnoise(q*1.3)*0.55 + vnoise(q*3.7 + 4.0)*0.3 + vnoise(q*9.0)*0.15;     // organic, rounded shoreline
  float e = vF + (en - 0.5)*0.42;
  if (e < 0.16) discard;
  float a = smoothstep(0.16, 0.3, e), molten = smoothstep(0.4, 0.64, e);
  q += uQ*0.05*vec2(sin(q.y*3.1 + t*3.7), cos(q.x*2.7 + t*3.1));                   // heat ripple / shimmer
  vec2 fl = vec2(t*0.055, t*0.032);
  vec2 w = q*0.5; if (uQ > 0.5) w += vec2(fbm(q*0.33 + fl), fbm(q*0.33 - fl + 5.2))*1.5;  // domain-warped flow
  float n = fbm(w + fl*2.0);
  float seam = 1.0, pl = 0.0;
  if (uQ > 0.5) { vec2 v = lvVoro(w*1.5 - fl*2.5); seam = v.y - v.x; pl = 1.0 - smoothstep(0.03, 0.14 + 0.12*n, seam); }
  else { pl = 1.0 - smoothstep(0.0, 0.08, abs(vnoise(w*2.0 - fl*2.0) - 0.5)); }
  float pulse = 0.82 + 0.18*sin(t*1.6 + n*7.0) + 0.06*sin(t*5.3 + q.x*0.7);
  float n2 = vnoise(w*3.3 + fl*5.0);
  vec3 hot = mix(vec3(0.75,0.08,0.01), vec3(1.25,0.42,0.04), smoothstep(0.25, 0.65, n)) * pulse;
  hot += vec3(1.3,0.95,0.45) * pow(smoothstep(0.55, 0.95, n2*0.6 + n*0.5), 2.0) * pulse;      // white-hot streaks in the flow
  vec3 rock = vec3(0.05,0.035,0.03) + vec3(0.06,0.045,0.035)*vnoise(q*7.0);
  float crust = mix(0.95, smoothstep(0.42, 0.62, n)*0.9, molten);                  // shore mostly cooled crust, interior mostly molten
  vec3 crustC = mix(rock, hot*0.9, pl*(0.55 + 0.45*molten));                          // glowing seams between drifting plates
  vec3 col = mix(hot, crustC, crust);
  col += vec3(0.9,0.25,0.03)*(1.0 - molten)*smoothstep(0.25, 0.45, e)*0.35*pulse;     // warm glow bleeding onto the rim
  gl_FragColor = vec4(col, a); }` });
  const me = new THREE.Mesh(g, m); me.renderOrder = 1; R3.scene.add(me); R3.lava = me;
  R3.lavaCore = []; for (let i = 0; i < MW * MH; i++) if (f[i] > 0.85) R3.lavaCore.push(i);   // deep lava tiles for bubbles/embers
}
function lavaFX(dt) { // v6.3: bubbles, embers and heat haze over visible lava (off in quiet mode)
  const L = R3.lavaCore; if (!L || !L.length || R3.qName === 'quiet') return;
  if (!R3.lavaVis || R3.time > R3.lavaVisT) { const v = R3.view; R3.lavaVisT = R3.time + 0.4; R3.lavaVis = L.filter(i => { const x = i % MW + 0.5, y = (i / MW | 0) + 0.5; return x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1; }); }
  const V = R3.lavaVis; if (!V.length) return; const rate = Math.min(70, V.length * 0.4) * FX.mul * dt, cnt = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
  for (let k = 0; k < cnt; k++) { const i = V[(Math.random() * V.length) | 0], x = i % MW + Math.random(), y = (i / MW | 0) + Math.random(), h = heightAt(x, y) + 0.06, r = Math.random();
    if (r < 0.45) { FX.fire.spawn(x, y, h, 0, 0, 0.04, 0.7 + Math.random() * 0.5, 0.06, 0.3 + Math.random() * 0.2, 1, 0.5, 0.12, 0.85, 0); if (Math.random() < 0.5) for (let s = 0; s < 3; s++) FX.spark.spawn(x, y, h + 0.15, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0.8 + Math.random(), 0.5, 0.05, 0.02, 1, 0.55, 0.15, 1, 2); }
    else if (r < 0.85) FX.spark.spawn(x, y, h + 0.1, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 1.2, 1.6 + Math.random() * 1.4, 0.07, 0.02, 1, 0.45 + Math.random() * 0.25, 0.08, 1, -0.05);
    else puff(x, y, h + 0.3, 0.7, 2.6, 0.95, 0.045, 0.55); }
}
// v5.0: lava (emissive, animated) and ice (glossy) surface overlays, built from tile masks as merged quads
function buildSurfaces() {
  const mk = (mask, y0) => { const pos = [], idxs = []; let n = 0;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (mask[y * MW + x]) { for (const [dx, dy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) pos.push(x + dx, heightAt(x + dx, y + dy) + y0, y + dy); idxs.push(n, n + 2, n + 1, n, n + 3, n + 2); n += 4; }
    if (!n) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idxs); g.computeVertexNormals(); return g; };
  buildLava();
  const ig = mk(G.ice, 0.03);
  if (ig) { const me = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ color: 0xbfe3f5, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85, envMapIntensity: 1.2 })); me.receiveShadow = true; R3.scene.add(me); }
  if (G.ruins) { const [mx, my] = G.ruins, B = new MB(0); for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 1.2 + (k % 3) * 0.5; B.box('m', 0.5 + (k % 2) * 0.4, 0.4 + (k % 3) * 0.35, 0.35, 0x8a8f96, PBR.CONC, Math.cos(a) * r, 0.25, Math.sin(a) * r, { bevel: 0.05, ry: a }); }
    B.box('m', 0.25, 2.2, 0.25, 0x5b5f66, PBR.METAL, 0.3, 1.1, -0.2, { bevel: 0.02 }); const mesh = new THREE.Mesh(B.build().m, pbrMaterial()); mesh.position.set(mx, heightAt(mx, my), my); mesh.castShadow = mesh.receiveShadow = true; R3.scene.add(mesh); }
}

// v6.0 Hindu Kush Hellgate desert dressing: mud-brick compound walls (on blocking G.mud tiles), burnt-out wrecks,
// sandbag nests at the canyon mouths, warm dust haze. All visual-only and seeded locally (never touches the sim RNG).
function buildDesert() {
  const R = mkRng((G.opts.seed | 0) + 606), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), cl = new THREE.Color();
  R3.propTile = {}; const tag = (x, y, mesh, k) => { const i = Math.floor(y) * MW + Math.floor(x); (R3.propTile[i] = R3.propTile[i] || []).push([mesh, k]); };
  const S = R3.scene; S.fog.color.set(0xcdb08a); S.fog.density = 0.0058; if (S.background && S.background.isColor) S.background.set(0xcdb08a);
  if (R3.hemi) { R3.hemi.color.set(0xffe2b8); R3.hemi.groundColor.set(0x6a4a2a); R3.hemi.intensity *= 1.3; } if (R3.sun) R3.sun.color.lerp(new THREE.Color(0xffd8a0), 0.35);
  // mud-brick walls: one crumbling block per wall tile + parapet bumps
  const mud = []; for (let i = 0; i < MW * MH; i++) if (G.mud && G.mud[i]) mud.push(i);
  if (mud.length) { const B = new MB(0); B.box('w', 1.0, 1.0, 1.0, 0xffffff, PBR.CONC, 0, 0.5, 0, { bevel: 0.06 });
    const wm = new THREE.InstancedMesh(B.build().w, pbrMaterial(), mud.length * 2); let k = 0;
    for (const i of mud) { const x = i % MW + 0.5, y = (i / MW | 0) + 0.5, h = heightAt(x, y) - 0.05, hh = 0.75 + R() * 0.65 * (R() < 0.8 ? 1 : 0.3);
      e.set(0, (R() - 0.5) * 0.08, 0); q.setFromEuler(e); m4.compose(v.set(x, h, y), q, sc.set(1.0, hh, 1.0)); wm.setMatrixAt(k, m4); cl.setRGB(0.58 + R() * 0.08, 0.42 + R() * 0.05, 0.27 + R() * 0.04); wm.setColorAt(k++, cl);
      if (R() < 0.45) { m4.compose(v.set(x + (R() - 0.5) * 0.5, h + hh, y + (R() - 0.5) * 0.5), q, sc.set(0.3, 0.22, 0.3)); wm.setMatrixAt(k, m4); cl.setRGB(0.52, 0.38, 0.24); wm.setColorAt(k++, cl); } }
    wm.count = k; wm.castShadow = wm.receiveShadow = true; wm.frustumCulled = false; S.add(wm); }
  // wrecks: burnt tank hulks + gutted trucks in no-man's-land and along the wadi
  const W = new MB(0);
  W.box('t', 1.5, 0.42, 0.85, 0x2e2620, PBR.DARKM, 0, 0.32, 0, { bevel: 0.05 }); W.box('t', 1.55, 0.18, 0.22, 0x1c1814, PBR.RUB, 0, 0.12, 0.42); W.box('t', 1.55, 0.18, 0.22, 0x1c1814, PBR.RUB, 0, 0.12, -0.42);
  W.box('t', 0.7, 0.3, 0.6, 0x3a2c22, PBR.DARKM, -0.1, 0.66, 0.05, { ry: 0.5, bevel: 0.05 }); W.cyl('t', 0.05, 1.1, 0x241e1a, PBR.DARKM, 0.45, 0.62, 0.35, { rz: -1.3, ry: 0.5, seg: 6 });
  W.box('t', 0.5, 0.06, 0.4, 0x6a4a30, PBR.RUB, 0.35, 0.56, -0.1, { ry: 0.3, bevel: 0 }); // rust patch
  W.box('k', 0.55, 0.5, 0.7, 0x4a3a2c, PBR.DARKM, 0.6, 0.38, 0, { bevel: 0.05 }); W.box('k', 1.0, 0.12, 0.72, 0x3a3028, PBR.DARKM, -0.25, 0.3, 0, { bevel: 0.02 });
  for (const [wx, wz] of [[0.65, 0.36], [0.65, -0.36], [-0.45, 0.36], [-0.45, -0.36]]) W.cyl('k', 0.16, 0.1, 0x161210, PBR.RUB, wx, 0.15, wz, { rx: Math.PI / 2, seg: 8 });
  const wg = W.build(), spots = [];
  for (let n = 0; n < 400 && spots.length < 34; n++) { const WR = (G.deco && G.deco.wr) || [52, 6, 72, 116], x = WR[0] + R() * WR[2], y = WR[1] + R() * WR[3]; const i = Math.floor(y) * MW + Math.floor(x); if (G.map[i] !== 0 || G.oreMax[i] > 0 || G.starts.some(s => Math.hypot(s[0] - x, s[1] - y) < 11) || spots.some(p => Math.hypot(p[0] - x, p[1] - y) < 3.5)) continue; spots.push([x, y]); }
  for (const p of (G.deco && G.deco.fixed) || [[57, 61], [58, 68], [34, 62.5]]) spots.push(p);
  for (const key of ['t', 'k']) { const list = spots.filter((_, j) => (j % 3 === 2) === (key === 'k')); const im = new THREE.InstancedMesh(wg[key], pbrMaterial(), list.length);
    list.forEach(([x, y], k) => { e.set((R() - 0.5) * 0.12, R() * 6.28, (R() - 0.5) * 0.18); q.setFromEuler(e); const s = 0.9 + R() * 0.3; m4.compose(v.set(x, heightAt(x, y) - 0.08, y), q, sc.set(s, s, s)); im.setMatrixAt(k, m4); tag(x, y, im, k); });
    im.castShadow = im.receiveShadow = true; im.frustumCulled = false; S.add(im); R3.wrecks = (R3.wrecks || []).concat([im]); R3.wreckSpots = spots; }
  // sandbag nests: arcs at both canyon mouths + a few around the village
  const SB = new MB(0); SB.cyl('s', 0.13, 0.42, 0xffffff, PBR.CLOTH, 0, 0.12, 0, { rz: Math.PI / 2, seg: 7 }); const bags = [];
  const nest = (cx, cy, r, a0, a1, rows) => { for (let row = 0; row < rows; row++) for (let a = a0; a <= a1; a += 0.42 / r) bags.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, a + Math.PI / 2, row]); };
  const cyW = (G.canyon && G.canyon.y) || 64;
  if (G.deco && G.deco.nests) for (const n of G.deco.nests) nest(...n); else { nest(33.5, cyW - 4.6, 1.3, -0.2, 2.6, 2); nest(33.5, cyW + 4.6, 1.3, -2.6, 0.2, 2); nest(29.5, cyW, 1.6, -1.2, 1.2, 2);
  nest(55.5, cyW - 5, 1.2, 1.2, 3.6, 2); nest(55.5, cyW + 5.5, 1.2, -3.6, -1.2, 2); nest(86, 52.5, 1.4, 0, 3.1, 2); nest(86, 75.5, 1.4, -3.1, 0, 2); nest(102, 64, 1.3, 1.6, 4.6, 2); }
  const bm = new THREE.InstancedMesh(SB.build().s, pbrMaterial(), bags.length);
  bags.forEach(([x, y, a, row], k) => { e.set(0, -a, 0); q.setFromEuler(e); m4.compose(v.set(x, heightAt(x, y) + row * 0.2, y), q, sc.set(1, 1, 1)); bm.setMatrixAt(k, m4); cl.setRGB(0.62 + R() * 0.08, 0.52 + R() * 0.06, 0.34 + R() * 0.05); bm.setColorAt(k, cl); tag(x, y, bm, k); });
  bm.castShadow = bm.receiveShadow = true; bm.frustumCulled = false; S.add(bm);
  // ruined watchtowers on the ridge flanks of the Hellgate
  const T = new MB(0); T.box('m', 1.1, 2.2, 1.1, 0x8e6a46, PBR.CONC, 0, 1.1, 0, { bevel: 0.08 }); T.box('m', 1.3, 0.18, 1.3, 0x7a5a3a, PBR.CONC, 0, 2.25, 0, { bevel: 0.03 }); T.box('m', 0.3, 0.3, 0.06, 0x1a120c, PBR.RUB, 0, 1.6, 0.56, { bevel: 0 });
  const tg = T.build().m; for (const [x, y] of (G.deco && G.deco.towers) || [[41.5, cyW - 6.5], [47.5, cyW + 6.5], [44, cyW - 7.5]]) { const mesh = new THREE.Mesh(tg, pbrMaterial()); mesh.position.set(x, heightAt(x, y) - 0.4, y); mesh.castShadow = mesh.receiveShadow = true; S.add(mesh); }
}
// v6.0: drifting desert dust + the odd dust devil near the camera (render-only, Math.random is fine here)
function desertFx(dt) {
  if (!G.desert || !FX.smoke) return; const c = R3.cam, sp = Math.max(8, c.d * 0.7);
  if (Math.random() < dt * 7 * FX.mul) { const x = c.tx + (Math.random() - 0.5) * sp * 2, y = c.ty + (Math.random() - 0.5) * sp * 1.4; if (x > 0 && y > 0 && x < MW && y < MH) FX.smoke.spawn(x, y, heightAt(x, y) + 0.15, 0.9 + Math.random() * 0.5, 0.25, 0.04, 4.5, 0.7, 2.6, 0.78, 0.64, 0.46, 0.1, 0); }
  R3.devT = (R3.devT || 0) - dt; if (R3.devT <= 0) { R3.devT = 9 + Math.random() * 12; R3.dev = { x: c.tx + (Math.random() - 0.5) * sp, y: c.ty + (Math.random() - 0.5) * sp * 0.8, t: 5 }; }
  const d = R3.dev; if (d && d.t > 0) { d.t -= dt; d.x += dt * 0.8; d.y += dt * 0.25; if (Math.random() < dt * 30 * FX.mul) { const a = Math.random() * 6.28, r = 0.25 + Math.random() * 0.4; FX.smoke.spawn(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, heightAt(d.x, d.y) + 0.1, -Math.sin(a) * 1.4, Math.cos(a) * 1.4, 1.6 + Math.random(), 1.6, 0.25, 0.9, 0.8, 0.66, 0.48, 0.22, 0); } }
}
