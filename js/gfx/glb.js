// blender-trial: Blender-authored .glb building models (models/<type>.glb + <type>_lod1.glb).
// VISUAL ONLY - never reads or writes sim state, so the simulation stays deterministic.
// - LOD1 is used in Quiet mode (mobile forces Quiet on) or on the 'low' quality preset.
// - Team colour: materials named 'TeamColor' (TEAMPAINT) and 'TeamColor_Glow' (TEAMCOL) are recoloured per team.
// - Animated parts (spin/head/gun/gat/mis...) are separate glb nodes tagged with extras.part; every frame they copy
//   the procedural part's transform (the procedural body stays in the scene graph, hidden, and keeps animating).
// - If a file fails to load (or ?glb=0, or the page is opened from file://), the procedural mesh simply stays visible.
const GLB = {
  on: typeof THREE !== 'undefined' && typeof location !== 'undefined' && location.protocol !== 'file:' && !/[?&]glb=0\b/.test(location.search), // file:// cannot fetch .glb (CORS) -> procedural
  dir: 'models/', tpl: {}, st: {}, team: {}, c2: typeof THREE !== 'undefined' ? new THREE.Color() : null,
  KEYS: new Set(['hq', 'power', 'barracks', 'refinery', 'factory', 'tech', 'airfield', 'cc', 'extractor', 'silo',
    'turret', 'aagun', 'tesla', 'gatling', 'gcannon', 'gtower', 'gate', 'wall']),
};
function glbLod() { const s = typeof UI !== 'undefined' && UI.set; return (s && s.quiet) || (typeof MOB !== 'undefined' && MOB.on) || (typeof R3 !== 'undefined' && R3.qName === 'low') ? 1 : 0; }
function glbPrep(root) {
  root.traverse(m => {
    if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
    const mt = m.material; if (!mt) return;
    mt.envMapIntensity = 0.42; // match pbrMaterial() so metals sit in the same light as the procedural meshes
    const cap = { TeamColor_Glow: 1.6, Ore: 0.35, Gas: 0.8, Arc: 1.2 }[mt.name] || 1.3; // Cycles-strength emission -> bloom-friendly
    if (mt.emissiveIntensity > cap) mt.emissiveIntensity = cap;
  });
  root.traverse(n => { if (n.userData && n.userData.part) n.userData.p0 = n.position.clone(); });
}
function glbGet(k) { // k = 'hq' or 'hq_lod1' -> template scene or null (loading / failed)
  const st = GLB.st[k]; if (st === 'ok') return GLB.tpl[k]; if (st) return null;
  if (!THREE.GLTFLoader) { GLB.st[k] = 'fail'; return null; }
  GLB.st[k] = 'loading';
  new THREE.GLTFLoader().load(GLB.dir + k + '.glb', g => { glbPrep(g.scene); GLB.tpl[k] = g.scene; GLB.st[k] = 'ok'; },
    undefined, err => { GLB.st[k] = 'fail'; console.warn('[glb] ' + k + ' failed, using procedural model', err && err.message); });
  return null;
}
function glbTeamMat(mt, team) {
  const key = mt.uuid + '|' + team; let m = GLB.team[key]; if (m) return m;
  m = mt.clone();
  if (mt.name === 'TeamColor') m.color.setHex(TEAMPAINT[team]);
  else { m.color.setHex(TEAMCOL[team]); m.emissive.setHex(TEAMCOL[team]); }
  return GLB.team[key] = m;
}
function glbInstance(src, team) {
  const r = src.clone(true);
  r.traverse(m => { if (m.isMesh && m.material && (m.material.name === 'TeamColor' || m.material.name === 'TeamColor_Glow')) m.material = glbTeamMat(m.material, team); });
  const parts = {}; r.traverse(n => { if (n.userData && n.userData.part) { parts[n.userData.part] = n; n.userData.p0 = n.position.clone(); } });
  return { r, parts };
}
function glbSync(o, e) { // called once per frame per visible building (render.js)
  if (!GLB.on || o.glbX) return;
  if (!o.glb) {
    if (!GLB.KEYS.has(o.mk) || (o.mk === 'wall' && G.players[e.team] && G.players[e.team].fac === 'chn')) { o.glbX = 1; return; }
    const lod = glbLod(), k = o.mk + (lod ? '_lod1' : ''); let src = glbGet(k);
    if (!src && GLB.st[k] === 'fail' && lod) src = glbGet(o.mk); // LOD1 missing -> try LOD0
    if (!src) { if (GLB.st[k] === 'fail' && (!lod || GLB.st[o.mk] === 'fail')) o.glbX = 1; return; }
    const I = glbInstance(src, o.team); o.glb = I.r; o.gp = I.parts; o.g.add(o.glb);
  }
  const site = !!o.cs; o.glb.visible = !site; if (site) return; // staged construction keeps the procedural clip-plane animation
  o.body.visible = false; o.glb.scale.y = o.body.scale.y;
  for (const k in o.gp) {
    const n = o.gp[k], p = o.parts[k]; if (!p) continue; const pv = o.piv[k] || [0, 0, 0], p0 = n.userData.p0;
    n.position.set(p0.x + p.position.x - pv[0], p0.y + p.position.y - pv[1], p0.z + p.position.z - pv[2]);
    n.quaternion.copy(p.quaternion); n.scale.copy(p.scale); n.visible = p.visible;
  }
  if (o.decor !== o.gDecor) { if (o.gDecor && o.gDecor.parent) o.gDecor.parent.remove(o.gDecor); o.gDecor = o.decor; if (o.decor) o.glb.add(o.decor); } // level-up decor stays visible
}

// ---------- units (blender-trial): vehicles are drawn as InstancedMeshes with the shared vertex-colour pbrMaterial,
// so each glb part node is baked into one geometry: colour = material colour (team-recoloured), pbr attr = (metal, rough, emissive).
GLB.UNITS = new Set(['heavy', 'scout', 'harv', 'arty', 'aa', 'tsar', 'jet', 'intercept', 'bomber', 'stealth', 'medevac', 'gunship', 'drone']);
function glbUnitFile(t) { return 'u_' + t + (glbLod() ? '_lod1' : ''); }
function glbBake(meshes, rel, team, air) { // meshes -> one non-indexed geometry with position/normal/color/pbr (rel: Matrix4 inverse of part frame)
  // air: aircraft are centred on y=0, so pbr.z gets a tiny 0.005 marker that turns off the shader's ground-dirt band, and team paint is pushed toward the bright team colour so sides read from RTS zoom
  const geos = [], c = new THREE.Color(), m4 = new THREE.Matrix4();
  for (const m of meshes) {
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(rel, m.matrixWorld)); if (!g.attributes.normal) g.computeVertexNormals();
    const mt = m.material, n = g.attributes.position.count, col = new Float32Array(n * 3), pb = new Float32Array(n * 3);
    if (mt.name === 'TeamColor') { c.setHex(TEAMPAINT[team]); c.lerp(GLB.c2.setHex(TEAMCOL[team]), air ? 0.6 : 0.45); } else if (mt.name === 'TeamColor_Glow') c.setHex(TEAMCOL[team]); else c.copy(mt.color);
    const em = mt.emissive && (mt.emissive.r + mt.emissive.g + mt.emissive.b) > 0.05 ? Math.min(1.6, mt.emissiveIntensity || 1) : 0;
    if (em) c.lerp(mt.emissive, 0.5);
    const vc = g.attributes.color; // baked AO / dust / edge wear from Blender (COLOR_0, stored x0.5), multiplied into the material colour
    let vs = 2; // undo the x0.5 export scale; older three builds return raw ints from getX() on normalized attributes
    if (vc && vc.normalized) { let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, vc.getX(i)); if (mx > 1.001) vs = 2 / (vc.array instanceof Uint8Array ? 255 : 65535); }
    for (let i = 0; i < n; i++) {
      const kr = vc ? vs * vc.getX(i) : 1, kg = vc ? vs * vc.getY(i) : 1, kb = vc ? vs * vc.getZ(i) : 1;
      col[i * 3] = c.r * kr; col[i * 3 + 1] = c.g * kg; col[i * 3 + 2] = c.b * kb; pb[i * 3] = mt.metalness; pb[i * 3 + 1] = mt.roughness; pb[i * 3 + 2] = em || (air ? 0.005 : 0);
    }
    geos.push({ p: g.attributes.position.array, n: g.attributes.normal.array, col, pb });
  }
  let N = 0; for (const g of geos) N += g.p.length; const P = new Float32Array(N), Nn = new Float32Array(N), C = new Float32Array(N), B = new Float32Array(N); let o = 0;
  for (const g of geos) { P.set(g.p, o); Nn.set(g.n, o); C.set(g.col, o); B.set(g.pb, o); o += g.p.length; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('pbr', new THREE.BufferAttribute(B, 3));
  out.computeBoundingBox(); out.computeBoundingSphere(); return out;
}
function glbUnitModel(t, team, procPiv) { // -> {body, turret.., piv} or null (not available yet / failed)
  if (!GLB.on || !GLB.UNITS.has(t)) return null;
  const k = glbUnitFile(t), st = GLB.st[k];
  if (!st) { GLB.st[k] = 'loading'; if (!THREE.GLTFLoader) { GLB.st[k] = 'fail'; return null; }
    new THREE.GLTFLoader().load(GLB.dir + k + '.glb', g => { g.scene.updateMatrixWorld(true); GLB.tpl[k] = g.scene; GLB.st[k] = 'ok'; glbUnitRefresh(t); },
      undefined, err => { GLB.st[k] = 'fail'; console.warn('[glb] ' + k + ' failed, using procedural model', err && err.message); });
    return null; }
  if (st !== 'ok') return null;
  const root = GLB.tpl[k], out = { piv: Object.assign({}, procPiv || {}) }, body = [], parts = {};
  root.traverse(n => { if (!n.isMesh) return; let p = n; while (p && p !== root && !(p.userData && p.userData.part)) p = p.parent;
    if (p && p !== root) (parts[p.userData.part] = parts[p.userData.part] || { node: p, m: [] }).m.push(n); else body.push(n); });
  const inv = new THREE.Matrix4();
  const air = !!(UT[t] && UT[t].air);
  out.body = glbBake(body, inv.copy(root.matrixWorld).invert(), team, air);
  for (const pk in parts) { const P = parts[pk]; out[pk] = glbBake(P.m, new THREE.Matrix4().copy(P.node.matrixWorld).invert(), team, air); out.piv[pk] = P.node.position.toArray(); }
  return out;
}
function glbUnitRefresh(t) { // a unit glb finished loading: drop cached procedural models + instanced meshes so they rebuild from the glb
  if (typeof MODEL_CACHE !== 'undefined') for (const key in MODEL_CACHE) if (key.startsWith('u' + t) && /^-?\d+$/.test(key.slice(1 + t.length))) delete MODEL_CACHE[key];
  if (typeof R3 !== 'undefined' && R3.uiMesh) for (const [key, u] of [...R3.uiMesh]) if (key.split('|')[0] === t) { for (const pk in u.parts) { R3.scene.remove(u.parts[pk]); u.parts[pk].dispose(); } R3.uiMesh.delete(key); }
}
