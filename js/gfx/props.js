// v7.6.2 Blender map props (models/props/*.glb + *_lod1.glb): trees, boulders, ore crystals, bridge, ruins and new
// debris / shoreline pebbles / lava-rim rocks / ice shards. VISUAL ONLY: placement uses the local render RNG
// (mkRng) and never touches sim state, so fixed-seed runs and replays stay identical.
// - The procedural meshes are built first and stay as the fallback; when a .glb arrives its geometry is swapped in
//   (instanced sets are split into one InstancedMesh per variant). If a file fails, nothing changes.
// - LOD1 on phones / Quiet / Low (propsApply re-picks it when the quality changes); the debris scatter is skipped there.
const PROPS = { dir: 'models/props/', cache: {}, sets: [] };
function propsOn() { return typeof GLB !== 'undefined' && GLB.on && !(typeof QS !== 'undefined' && QS.get('props') === '0') && !!THREE.GLTFLoader; }
function propsLod() { return (typeof texLight === 'function' && texLight()) || (typeof glbLod === 'function' && glbLod()) ? 1 : 0; }
function propsHash(j) { let h = (j + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h ^ (h >>> 13)) >>> 0; }
function propsGet(file, lod, cb) { // -> cb(variants[] | null); variants are baked BufferGeometries keyed by node name v0..vN
  const k = file + (lod ? '_lod1' : ''), c = PROPS.cache[k] || (PROPS.cache[k] = { st: 0, q: [], v: null });
  if (c.st === 2) return cb(c.v); if (c.st === 3) return cb(null); c.q.push(cb); if (c.st) return; c.st = 1;
  const done = v => { c.v = v; c.st = v ? 2 : 3; const q = c.q; c.q = []; for (const f of q) try { f(v); } catch (e) { console.warn('[props] ' + k, e); } };
  new THREE.GLTFLoader().load(PROPS.dir + k + '.glb', g => { try {
    const sc = g.scene; sc.updateMatrixWorld(true); const ore = new THREE.Color(COL.ORE), V = [];
    for (const ch of sc.children.slice().sort((a, b) => a.name < b.name ? -1 : 1)) { const ms = []; ch.traverse(m => { if (m.isMesh) ms.push(m); });
      for (const m of ms) if (m.material && m.material.name === 'Ore') { m.material = m.material.clone(); m.material.color.copy(ore); m.material.metalness = PBR.ORE[0]; m.material.roughness = PBR.ORE[1]; }
      const geo = glbBake(ms, new THREE.Matrix4().copy(ch.matrixWorld).invert(), 0, false);
      if (ms.some(m => m.material && m.material.name === 'Ore')) { const p = geo.attributes.pbr; for (let i = 0; i < p.count; i++) if (p.getX(i) > 0.5) p.setZ(i, PBR.ORE[2]); }
      V.push(geo); }
    done(V.length ? V : null); } catch (e) { console.warn('[props] bake ' + k, e); done(null); } },
  undefined, e => { console.warn('[props] ' + k + ' failed, keeping procedural', e && e.message); done(null); });
}
// existing procedural InstancedMesh (or Mesh) -> swap in the .glb variants
// o: { mesh, file, pick: [variant indices] (default all), upright: bool, sink: number }
function propsReg(o) { if (!o.mesh || !propsOn()) return; o.lod = -1; R3.propSets.push(o); propsSwap(o); }
// glb-only scatter set (no procedural version): o: { file, items: [[x, y, z, s, yaw, tile]], mat: fn, light: skip in light mode }
function propsScatter(o) { if (!o.items.length || !propsOn()) return; o.scatter = 1; o.lod = -1; R3.propSets.push(o); propsSwap(o); }
function propsSwap(o) { const lod = propsLod(); if (o.lod === lod || o.busy) return; o.busy = 1;
  propsGet(o.file, lod, V => { o.busy = 0; if (!V || o.dead || !R3.scene) return; o.lod = lod;
    if (o.scatter) return propsScatterBuild(o, V, lod);
    const pick = o.pick || V.map((_, i) => i), G2 = pick.map(i => V[Math.min(i, V.length - 1)]), pm = o.mesh;
    if (!pm.isInstancedMesh || G2.length === 1) { if (!o.g0) o.g0 = pm.geometry; pm.geometry = G2[0];
      if (o.upright && pm.isInstancedMesh && !o.up) { o.up = 1; propsUpright(o, pm); } return; }
    if (!o.split) { // split into one InstancedMesh per variant
      const n = pm.count, cnt = G2.map(() => 0), map = new Int32Array(n * 2), m4 = new THREE.Matrix4(), c = new THREE.Color();
      for (let j = 0; j < n; j++) { const v = propsHash(j) % G2.length; map[j * 2] = v; map[j * 2 + 1] = cnt[v]++; }
      o.split = G2.map((g, v) => { const im = new THREE.InstancedMesh(g, pm.material, Math.max(1, cnt[v])); im.count = cnt[v];
        im.castShadow = pm.castShadow; im.receiveShadow = pm.receiveShadow; im.frustumCulled = false;
        if (pm.instanceColor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cnt[v]) * 3).fill(1), 3); return im; });
      for (let j = 0; j < n; j++) { const im = o.split[map[j * 2]], k = map[j * 2 + 1]; pm.getMatrixAt(j, m4); im.setMatrixAt(k, m4); if (pm.instanceColor) { pm.getColorAt(j, c); im.setColorAt(k, c); } }
      o.map = map; if (o.upright) for (const im of o.split) propsUpright(o, im);
      for (const im of o.split) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; pm.parent.add(im); }
      pm.visible = false; R3.propSplit.set(pm, o);
    } else o.split.forEach((im, v) => { im.geometry = G2[v]; });
  });
}
function propsUpright(o, im) { // Blender boulders have flat bases + snow/moss caps -> stand them upright, yaw only, slightly sunk
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < im.count; k++) { im.getMatrixAt(k, m4); m4.decompose(p, q, s); if (s.x === 0) continue;
    q.setFromAxisAngle(up, (propsHash(k + 7) % 6283) / 1000); p.y -= s.y * (o.sink || 0); m4.compose(p, q, s); im.setMatrixAt(k, m4); }
  im.instanceMatrix.needsUpdate = true;
}
function propsScatterBuild(o, V, lod) {
  if (o.meshes) { o.meshes.forEach((im, v) => { im.geometry = V[v % V.length]; im.visible = !(o.light && lod); }); return; }
  const per = V.map(() => []); o.items.forEach((it, j) => per[(it[6] != null ? it[6] : propsHash(j)) % V.length].push(it));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), m0 = new THREE.Matrix4().makeScale(0, 0, 0);
  R3.propTile = R3.propTile || {};
  o.meshes = per.map((L, v) => { const im = new THREE.InstancedMesh(V[v], o.mat ? o.mat() : pbrMaterial(), Math.max(1, L.length)); im.count = L.length;
    im.castShadow = !!o.shadow; im.receiveShadow = true; im.frustumCulled = false;
    L.forEach(([x, y, z, sc, yaw, ti], k) => { q.setFromAxisAngle(up, yaw); p.set(x, z, y); s.set(sc, sc, sc); m4.compose(p, q, s);
      if (R3.cleared && R3.cleared.has(ti)) m4.copy(m0); im.setMatrixAt(k, m4); (R3.propTile[ti] = R3.propTile[ti] || []).push([im, k]); });
    im.instanceMatrix.needsUpdate = true; im.visible = !(o.light && lod); R3.scene.add(im); return im; });
}
function propsClear(pm, j) { // clearFoliage helper: zero instance j of a (possibly split) procedural set
  const m0 = new THREE.Matrix4().makeScale(0, 0, 0); pm.setMatrixAt(j, m0); pm.instanceMatrix.needsUpdate = true;
  const o = R3.propSplit && R3.propSplit.get(pm); if (o && o.map) { const im = o.split[o.map[j * 2]]; im.setMatrixAt(o.map[j * 2 + 1], m0); im.instanceMatrix.needsUpdate = true; }
}
function propsApply() { if (!R3.propSets) return; for (const o of R3.propSets) propsSwap(o); }
function propsReset() { for (const o of R3.propSets || []) o.dead = 1; R3.propSets = []; R3.propSplit = new Map(); R3.cleared = new Set(); R3.propTile = {}; }
// new scatter: shoreline pebbles + logs/stumps/pebbles on open ground, lava-rim rocks, ice shards (render RNG only)
function propsBuildScatter() {
  if (!propsOn()) return; const nearBase = (x, y) => G.starts.some(s => Math.hypot(s[0] - x, s[1] - y) < 7); const th = typeof texTheme === 'function' ? texTheme() : 'grass', R = mkRng(G.opts.seed + 91);
  const T = i => G.map[i], adj = (x, y, f) => { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + a, yy = y + b; if (inb(xx, yy) && f(yy * MW + xx)) return true; } return false; };
  const deb = [], lav = [], ice = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x;
    if (T(i) !== 0 || (G.bridge && G.bridge[i]) || (G.lava && G.lava[i]) || G.oreMax[i] > 0) { R(); R(); continue; }
    const shore = adj(x, y, j => T(j) === 2 && !(G.bridge && G.bridge[j])), r1 = R(), r2 = R();
    if (nearBase(x + 0.5, y + 0.5)) continue;
    const px = x + 0.15 + R() * 0.7, py = y + 0.15 + R() * 0.7, h = heightAt(px, py), yaw = R() * 6.283;
    if (shore && r1 < 0.32) deb.push([px, py, h - 0.02, 0.8 + r2 * 0.7, yaw, i, 0]);
    else if (!(G.ice && G.ice[i]) && r1 < 0.022 && h > -0.05 && h < 0.4) deb.push([px, py, h - 0.01, 0.75 + r2 * 0.6, yaw, i, r2 < 0.5 ? 0 : r2 < 0.78 ? 1 : 2]);
    if (G.lava && adj(x, y, j => G.lava[j]) && r2 < 0.4) lav.push([px, py, h - 0.03, 0.35 + R() * 0.45, yaw, i, (propsHash(i) % 3)]);
    if (G.ice && !G.ice[i] && adj(x, y, j => G.ice[j]) && r2 < 0.3) ice.push([px, py, h - 0.02, 0.8 + R() * 0.7, yaw, i, (propsHash(i) % 2)]); }
  propsScatter({ file: 'debris_' + th, items: deb, light: 1, shadow: 0 });
  if (lav.length) propsScatter({ file: 'lavarock', items: lav, shadow: 1 });
  if (ice.length) propsScatter({ file: 'iceshard', items: ice, mat: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.9, envMapIntensity: 1.2 }) });
}
