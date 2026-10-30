'use strict';
// ===== v7.6.2 ground textures: tileable albedo + normal/height sets per map theme (made by blender-iron-front/scripts/ground_tex.py) =====
// Render-only. Textures load async; until they arrive (or if any fails) the terrain keeps the old procedural shader (TEXQ 0).
// TEXQ 2 = full (two-scale anti-tiling, normal maps, height blending, triplanar cliffs); TEXQ 1 = light (phones / Quiet / Low: albedo only).
const TEX = { st: 'off', theme: '', cache: {}, mats: [], light: false, fails: 0 };
const TEX_LAYERS = ['grass', 'dirt', 'rock', 'sand'];
function texTheme() { return G.mapName === 'frost' ? 'frost' : G.mapName === 'volcano' ? 'volcano' : G.desert ? 'desert' : 'grass'; }
function texLight() { return !!((typeof UI !== 'undefined' && UI.set && UI.set.quiet) || (typeof MOB !== 'undefined' && MOB.on) || R3.qName === 'low' || R3.qName === 'quiet' || R3.qName === 'mobile'); }
function texOn() { if (typeof QS !== 'undefined' && QS.get('tex') === '0') return false; return typeof location === 'undefined' || location.protocol !== 'file:'; }
function texUniforms() { // one shared uniform block; the sampler values are filled in when the textures arrive
  if (!TEX.u) { TEX.u = { uTS: { value: 1 / 2.6 } }; for (let i = 0; i < 4; i++) { TEX.u['tC' + i] = { value: null }; TEX.u['tN' + i] = { value: null }; } }
  return TEX.u; }
function texLoad(cb) {
  const th = texTheme(); TEX.theme = th; if (!texOn()) { TEX.st = 'off'; return; }
  const c = TEX.cache[th]; if (c && c.ok) { texBind(c); cb && cb(); return; }
  if (c && c.loading) { c.cbs.push(cb); return; }
  const ent = TEX.cache[th] = { loading: true, ok: false, cbs: [cb], tex: {}, n: 0, bad: 0 }; TEX.st = 'loading';
  const L = new THREE.TextureLoader(), mx = R3.renderer ? R3.renderer.capabilities.getMaxAnisotropy() : 4, files = [];
  for (const l of TEX_LAYERS) files.push(l + '_c', l + '_n');
  const done = () => { if (++ent.n < files.length) return; ent.loading = false;
    if (ent.bad) { TEX.st = 'failed (' + ent.bad + ')'; TEX.fails++; delete TEX.cache[th]; return; } // keep procedural ground
    ent.ok = true; if (TEX.theme === th) { texBind(ent); for (const f of ent.cbs) f && f(); } ent.cbs = []; };
  for (const f of files) L.load('models/terrain/' + th + '_' + f + '.webp', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, mx); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; ent.tex[f] = t; done(); }, undefined, () => { ent.bad++; done(); });
}
function texBind(ent) { const u = texUniforms(); TEX_LAYERS.forEach((l, i) => { u['tC' + i].value = ent.tex[l + '_c']; u['tN' + i].value = ent.tex[l + '_n']; }); TEX.ready = TEX.theme; texApply(); }
function texApply() { // (re)select the shader path for the current quality; called after load and from applyQuality
  if (TEX.ready !== TEX.theme) return; const lt = texLight(), q = lt ? 1 : 2; TEX.light = lt; TEX.st = lt ? 'light' : 'full';
  for (const m of TEX.mats) if (m.defines.TEXQ !== q) { m.defines.TEXQ = q; m.needsUpdate = true; }
}
// GLSL chunk spliced into terrainMaterial (replaces the procedural colour block when TEXQ > 0)
const TEX_GLSL_HEAD = `
#if TEXQ > 0
uniform sampler2D tC0, tC1, tC2, tC3, tN0, tN1, tN2, tN3; uniform float uTS;
vec3 tdec(vec3 c){ return c*c*(0.3+0.7*c); } // ~sRGB -> linear
#endif`;
const TEX_GLSL_COLOR = `
#if TEXQ > 0
  { vec2 uA = q * uTS;
  #if TEXQ == 2
    vec2 uB = mat2(0.8, -0.6, 0.6, 0.8) * q * uTS * 0.63 + vec2(0.37, 0.71); float tm = smoothstep(0.3, 0.7, n1 * 0.7 + n2 * 0.5 - 0.1);
    #define TS(t) mix(texture2D(t, uA), texture2D(t, uB), tm)
    vec4 c0 = TS(tC0), c1 = TS(tC1), c3 = TS(tC3), m0 = TS(tN0), m1 = TS(tN1), m3 = TS(tN3);
    // rock: triplanar so cliffs are not stretched
    vec3 an = abs(vWN); an = pow(an, vec3(4.0)); an /= (an.x + an.y + an.z);
    vec2 rA = vW.zy * uTS * 1.3, rB = vW.xy * uTS * 1.3, rC = uA * 1.1;
    vec4 c2 = texture2D(tC2, rA) * an.x + texture2D(tC2, rB) * an.z + texture2D(tC2, rC) * an.y;
    vec4 m2 = texture2D(tN2, rA) * an.x + texture2D(tN2, rB) * an.z + texture2D(tN2, rC) * an.y;
    vec4 hs = vec4(m0.b, m1.b, m2.b, m3.b);
    vec4 t4 = vSplat + hs * 0.55; float mx = max(max(t4.x, t4.y), max(t4.z, t4.w));
    vec4 hw = max(t4 - mx + 0.22, 0.0) * step(0.002, vSplat); hw /= max(0.0001, hw.x + hw.y + hw.z + hw.w); w = hw;
    vec2 nG = (m0.rg - 0.5) * w.x + (m1.rg - 0.5) * w.y + (m3.rg - 0.5) * w.w;
    vec2 nR = (m2.rg - 0.5) * w.z;
    tNrm = vec3(nG.x, 0.0, nG.y) * 1.6 + (vec3(0.0, nR.y, nR.x) * an.x + vec3(nR.x, nR.y, 0.0) * an.z + vec3(nR.x, 0.0, nR.y) * an.y) * 2.2;
  #else
    vec4 c0 = texture2D(tC0, uA), c1 = texture2D(tC1, uA), c2 = texture2D(tC2, uA * 1.1), c3 = texture2D(tC3, uA);
  #endif
  vec3 g0 = tdec(c0.rgb);
  #if THEME == 0
    g0 = mix(g0, g0 * vec3(1.45, 1.12, 0.62), smoothstep(0.55, 0.78, n2) * 0.55) * (0.92 + 0.16 * n3); // dry patches + fine tone breakup
  #elif THEME == 2
    g0 *= 0.9 + 0.2 * n3;
  #endif
  vec3 tex = g0 * w.x + tdec(c1.rgb) * w.y + tdec(c2.rgb) * w.z + tdec(c3.rgb) * w.w;
  tex *= 0.86 + 0.28 * n1; // large-scale variation so the repeat never reads
  diffuseColor.rgb *= tex; }
#else
  diffuseColor.rgb *= grass*w.x + dirt*w.y + rock*w.z + sand*w.w;
#endif`;
const TEX_GLSL_NORMAL = `
#if TEXQ == 2
  { float fade = clamp(1.0 - fwq * 1.2, 0.0, 1.0); vec3 nW = normalize(vWN + tNrm * fade); normal = normalize(mix(normal, normalize(mat3(viewMatrix) * nW), 0.85)); }
#endif`;
