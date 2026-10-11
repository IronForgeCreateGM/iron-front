'use strict';
// ===== Terrain: smoothed heightfield, splat shader, water, foliage, fog overlay =====
const HR = 4, HW = MW * HR + 1, HH = MH * HR + 1; // heightfield resolution (verts)
let HF = null;
const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;
function heightAt(x, y) {
  const fx = Math.max(0, Math.min(HW - 1.001, x * HR)), fy = Math.max(0, Math.min(HH - 1.001, y * HR));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * HW + x0;
  return (HF[i] * (1 - tx) + HF[i + 1] * tx) * (1 - ty) + (HF[i + HW] * (1 - tx) + HF[i + HW + 1] * tx) * ty;
}
function buildHeightfield() {
  const R = mkRng(G.opts.seed + 11); HF = new Float32Array(HW * HH);
  const tileAt = (x, y) => G.map[Math.max(0, Math.min(MH - 1, y)) * MW + Math.max(0, Math.min(MW - 1, x))];
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { const t = tileAt(Math.floor((x - 0.5) / HR + 0.0001), Math.floor((y - 0.5) / HR + 0.0001)); HF[y * HW + x] = t === 1 ? 2.0 : t === 2 ? -1.1 : 0; }
  const blur = (r) => { const tmp = new Float32Array(HF.length);
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = Math.max(0, Math.min(HW - 1, x + k)); s += HF[y * HW + xx]; n++; } tmp[y * HW + x] = s / n; }
    for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = Math.max(0, Math.min(HH - 1, y + k)); s += tmp[yy * HW + x]; n++; } HF[y * HW + x] = s / n; } };
  blur(2); blur(2);
  // detail noise (stronger on rock), keep walkable tiles near 0
  const n2 = (x, y, f) => Math.sin(x * f * 1.7 + Math.sin(y * f * 1.3)) * Math.cos(y * f * 1.1 + Math.sin(x * f * 0.7));
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const i = y * HW + x, h = HF[i], wx = x / HR, wy = y / HR, rock = Math.max(0, Math.min(1, h / 1.2));
    HF[i] = h + rock * (n2(wx, wy, 0.9) * 0.35 + n2(wx, wy, 2.3) * 0.15 + 0.4 * rock) + (1 - rock) * n2(wx, wy, 0.6) * 0.03;
    const t = tileAt(Math.floor(wx), Math.floor(wy)); if (t === 0) HF[i] = Math.max(-0.22, Math.min(HF[i], 0.25 + HF[i] * 0.2));
  }
}
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 });
  m.extensions = { derivatives: true };
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vSplat;\nvarying vec3 vW;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `
        vec2 q = vW.xz;
        float fwq = length(fwidth(q)); float n1 = fbm(q * 0.35), n2 = fbm(q * 1.7 + 3.1), n3 = mix(0.5, vnoise(q * 9.0), clamp(1.0 - fwq * 9.0 * 0.6, 0.0, 1.0)), n4 = mix(0.5, vnoise(q * 31.0), clamp(1.0 - fwq * 31.0 * 0.6, 0.0, 1.0));
        vec3 grass = mix(vec3(0.075,0.15,0.035), vec3(0.17,0.25,0.06), n1) * (0.8 + 0.35*n3) * (0.9 + 0.2*n4);
        grass = mix(grass, vec3(0.24,0.22,0.09), smoothstep(0.55, 0.75, n2) * 0.45);
        vec3 dirt = mix(vec3(0.16,0.10,0.05), vec3(0.28,0.19,0.10), n2) * (0.75 + 0.45*n3);
        vec3 rock = mix(vec3(0.17,0.16,0.15), vec3(0.36,0.33,0.29), n2) * (0.7 + 0.5*vnoise(q*5.0 + vW.y*3.0));
        rock *= 0.85 + 0.15*sin(vW.y*11.0 + n1*6.0);
        vec3 sand = mix(vec3(0.38,0.31,0.19), vec3(0.50,0.42,0.27), n3);
        vec4 w = vSplat; w.y *= 0.7 + 0.6*n2; w.x *= 0.8 + 0.4*n1; w = max(w, vec4(0.0)); w /= max(0.0001, w.x+w.y+w.z+w.w);
        w = pow(w, vec4(1.6)); w /= (w.x+w.y+w.z+w.w);
        diffuseColor.rgb *= grass*w.x + dirt*w.y + rock*w.z + sand*w.w;
        float tRock = w.z; float tGrass = w.x;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.72, tRock) - n4*0.08;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hb = (fbm(q*2.0)*(0.03 + 0.3*tRock) + vnoise(q*9.0)*0.006) * clamp(1.0 - fwq * 4.0, 0.0, 1.0);
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hb), dhy = dFdy(hb);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2); normal = normalize(abs(det) * normal - grad * 2.5); }`);
    fowPatch(sh);
  };
  m.customProgramCacheKey = () => 'terrain3';
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
    let rock = Math.max(0, Math.min(1, (0.93 - ny) / 0.15)) + Math.max(0, Math.min(1, (h - 0.6) / 0.6));
    let sand = h < -0.1 ? Math.min(1, (-0.1 - h) / 0.3) : 0, dirt = oreAt(x, z) * 1.2;
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
  const sk = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2416, roughness: 1 }));
  sk.position.set(MW / 2, -0.6, MH / 2); R3.scene.add(sk);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(MW + 0.6, 0.6, MH + 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.9 })); edge.position.set(MW / 2, -0.62, MH / 2); R3.scene.add(edge);
  buildFogOverlay(); buildWater(); buildOre(); buildFoliage();
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
        float fa = texture2D(uFow, vec2(vW.x / 64.0, 1.0 - vW.z / 64.0)).a; col = mix(col, uFowC, fa * 0.97);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(MW, MH, 1, 1).rotateX(-Math.PI / 2), mat); w.position.set(MW / 2, -0.3, MH / 2); w.renderOrder = 2; mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2; R3.scene.add(w); R3.water = w;
}
function buildFogOverlay() {
  R3.fogData = new Uint8Array(MW * MH * 4); for (let i = 0; i < MW * MH; i++) R3.fogData[i * 4 + 3] = 255;
  R3.fogTex = new THREE.DataTexture(R3.fogData, MW, MH, THREE.RGBAFormat); R3.fogTex.magFilter = R3.fogTex.minFilter = THREE.LinearFilter; R3.fogTex.needsUpdate = true;
  FOW.uFow.value = R3.fogTex;
}
function updFogTex(dt) {
  const d = R3.fogData, f = R3.fogF || (R3.fogF = new Float32Array(MW * MH).fill(250)), k = 1 - Math.exp(-(dt || 0.016) * 7);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, j = ((MH - 1 - y) * MW + x) * 4; const a = vis0(i) ? 0 : seen0(i) ? 135 : 250; f[i] += (a - f[i]) * k; d[j + 3] = Math.round(f[i]); }
  R3.fogTex.needsUpdate = true;
}
function buildOre() {
  R3.oreTiles = []; for (let i = 0; i < MW * MH; i++) if (G.oreMax[i] > 0) R3.oreTiles.push(i);
  const geo = new THREE.OctahedronGeometry(0.2, 0); geo.scale(1, 1.7, 1);
  const B = new MB(0); B.add('c', geo, COL.ORE, PBR.ORE, 0, 0, 0); const g = B.build().c;
  R3.oreMesh = new THREE.InstancedMesh(g, pbrMaterial(), R3.oreTiles.length * 4); R3.oreMesh.castShadow = true; R3.oreMesh.receiveShadow = true; R3.oreMesh.frustumCulled = false; R3.scene.add(R3.oreMesh);
  const R = mkRng(5); R3.oreJ = R3.oreTiles.map(() => [0, 1, 2, 3].map(() => [R(), R(), R(), R()]));
}
function updOre() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  R3.oreTiles.forEach((i, k) => { const a = G.ore[i], seen = seen0(i), x = i % MW, y = (i / MW) | 0;
    for (let j = 0; j < 4; j++) { const r = R3.oreJ[k][j], f = a / Math.max(1, G.oreMax[i]); const sc = seen && a > 1 && f > j * 0.22 ? (0.3 + 0.45 * Math.sqrt(f)) * (0.6 + r[2] * 0.7) : 0;
      e.set((r[0] - 0.5) * 0.6, r[1] * 6, (r[3] - 0.5) * 0.6); q.setFromEuler(e); const px = x + 0.15 + r[0] * 0.7, pz = y + 0.15 + r[1] * 0.7; p.set(px, heightAt(px, pz) + sc * 0.12, pz); s.set(sc, sc, sc);
      m4.compose(p, q, s); R3.oreMesh.setMatrixAt(k * 4 + j, m4); } });
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
  const MAXG = 30000, gm = new THREE.InstancedMesh(tg, windMat(true, 0.9), MAXG); gm.receiveShadow = true; gm.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cl = new THREE.Color(); let k = 0; R3.grassTile = [];
  let tries = 0;
  while (k < MAXG && tries++ < MAXG * 4) {
    const x = R() * MW, y = R() * MH, ti = Math.floor(y) * MW + Math.floor(x); if (G.map[ti] !== 0 || G.oreMax[ti] > 0 || nearBase(x, y)) continue;
    const h = heightAt(x, y); if (h > 0.35 || h < -0.05) continue;
    const s = 0.45 + R() * 0.5; e.set(0, R() * 6.28, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, h, y), q, new THREE.Vector3(s, s * (0.8 + R() * 0.6), s)); gm.setMatrixAt(k, m4);
    cl.setRGB(0.8 + R() * 0.4, 0.85 + R() * 0.3, 0.7 + R() * 0.3); gm.setColorAt(k, cl); (R3.grassTile[ti] = R3.grassTile[ti] || []).push(k); k++;
  }
  gm.count = k; R3.grassMax = k; R3.grass = gm; R3.scene.add(gm);
  // trees (pine) near cliffs and scattered
  const B = new MB(0); B.cyl('t', 0.05, 0.4, 0x4a3524, PBR.RUB, 0, 0.2, 0, { seg: 6 });
  for (let i = 0; i < 3; i++) B.cone('t', 0.36 - i * 0.09, 0.5, 0x2f5a26 + i * 0x061006, [0, 0.85, 0], 0, 0.45 + i * 0.27, 0, { seg: 8 });
  const treeGeo = B.build().t; const trees = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (G.map[i] !== 0 || G.oreMax[i] > 0 || nearBase(x + 0.5, y + 0.5)) continue;
    const nearRock = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]].some(([a, b]) => inb(x + a, y + b) && G.map[(y + b) * MW + x + a] === 1);
    if (R() < (nearRock ? 0.5 : 0.015)) trees.push([x + 0.2 + R() * 0.6, y + 0.2 + R() * 0.6, 0.7 + R() * 0.7]); }
  const tm = new THREE.InstancedMesh(treeGeo, windMat(false, 0.8), trees.length); tm.castShadow = true; tm.receiveShadow = true; tm.frustumCulled = false;
  trees.forEach((t, j) => { e.set((R() - 0.5) * 0.1, R() * 6.28, (R() - 0.5) * 0.1); q.setFromEuler(e); m4.compose(new THREE.Vector3(t[0], heightAt(t[0], t[1]) - 0.05, t[1]), q, new THREE.Vector3(t[2], t[2] * (0.9 + R() * 0.4), t[2])); tm.setMatrixAt(j, m4);
    cl.setRGB(0.8 + R() * 0.4, 0.8 + R() * 0.4, 0.8 + R() * 0.3); tm.setColorAt(j, cl); (R3.treeTile = R3.treeTile || {})[Math.floor(t[1]) * MW + Math.floor(t[0])] = j; });
  R3.trees = tm; R3.scene.add(tm);
  // boulders on cliffs: displaced icosahedra
  const rg = new THREE.IcosahedronGeometry(0.5, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.8 + 0.35 * Math.sin(v.x * 7 + v.y * 5) * Math.cos(v.z * 6)); p.setXYZ(i, v.x, v.y * 0.75, v.z); } rg.computeVertexNormals(); }
  const RB = new MB(0); RB.add('r', rg, 0x77706a, [0, 0.85, 0], 0, 0, 0); const rgeo = RB.build().r; const rocks = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (G.map[i] === 1 && R() < 0.3) rocks.push([x + R(), y + R(), 0.25 + R() * 0.55]);
    else if (G.map[i] === 0 && !G.oreMax[i] && R() < 0.02 && !nearBase(x, y)) rocks.push([x + R(), y + R(), 0.1 + R() * 0.12]); }
  const rm = new THREE.InstancedMesh(rgeo, pbrMaterial(), rocks.length); rm.castShadow = true; rm.receiveShadow = true; rm.frustumCulled = false;
  rocks.forEach((r, j) => { e.set(R() * 3, R() * 6, R() * 3); q.setFromEuler(e); m4.compose(new THREE.Vector3(r[0], heightAt(r[0], r[1]) + r[2] * 0.1, r[1]), q, new THREE.Vector3(r[2], r[2], r[2])); rm.setMatrixAt(j, m4); });
  R3.scene.add(rm);
}
function clearFoliage(b) { // remove grass/trees under a new building
  const m0 = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let y = b.ty - 1; y <= b.ty + b.h; y++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) { if (!inb(x, y)) continue; const i = y * MW + x;
    const gl = R3.grassTile[i]; if (gl) { for (const k of gl) R3.grass.setMatrixAt(k, m0); R3.grass.instanceMatrix.needsUpdate = true; R3.grassTile[i] = null; }
    if (R3.treeTile && R3.treeTile[i] != null && x >= b.tx && x < b.tx + b.w && y >= b.ty && y < b.ty + b.h) { R3.trees.setMatrixAt(R3.treeTile[i], m0); R3.trees.instanceMatrix.needsUpdate = true; } }
}
