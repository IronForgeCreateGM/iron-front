'use strict';
// ===== Custom post-processing (no ES modules needed): HDR scene RT -> bloom chain -> ACES + grading + vignette -> FXAA =====
const POST = { on: true };
const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
function postInit(renderer) {
  const P = POST; P.r = renderer;
  P.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); P.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); P.scene = new THREE.Scene(); P.scene.add(P.quad); P.quad.frustumCulled = false;
  const gl = renderer.getContext(), isGL2 = renderer.capabilities.isWebGL2;
  P.half = isGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  P.type = P.half ? THREE.HalfFloatType : THREE.UnsignedByteType; P.isGL2 = isGL2;
  const mk = (frag, uni) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms: uni, depthTest: false, depthWrite: false });
  P.bright = mk(`uniform sampler2D tD; uniform float uT; varying vec2 vUv; void main(){ vec3 c = texture2D(tD, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uT, uT + 0.6, l), 1.0); }`, { tD: { value: null }, uT: { value: 1.4 } });
  P.blur = mk(`uniform sampler2D tD; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 c = texture2D(tD, vUv).rgb * 0.227027;
    c += texture2D(tD, vUv + uDir * 1.3846).rgb * 0.3162162; c += texture2D(tD, vUv - uDir * 1.3846).rgb * 0.3162162;
    c += texture2D(tD, vUv + uDir * 3.2308).rgb * 0.0702703; c += texture2D(tD, vUv - uDir * 3.2308).rgb * 0.0702703; gl_FragColor = vec4(c, 1.0); }`, { tD: { value: null }, uDir: { value: new THREE.Vector2() } });
  P.final = mk(`uniform sampler2D tD, tB1, tB2, tB3; uniform float uBloom, uExpo, uVig, uSat, uHasBloom, uCon, uBri; uniform vec3 uLift, uGain; varying vec2 vUv;
    vec3 aces(vec3 x){ x *= 0.6; return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    void main(){ vec3 c = texture2D(tD, vUv).rgb;
      if (uHasBloom > 0.5) c += (texture2D(tB1, vUv).rgb * 0.5 + texture2D(tB2, vUv).rgb * 0.8 + texture2D(tB3, vUv).rgb * 1.1) * uBloom;
      c = aces(c * uExpo);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat);
      c = c * uGain + uLift * (1.0 - c);
      c = toSRGB(c);
      c = clamp((c - 0.5) * uCon + 0.5 + uBri, 0.0, 1.0);
      vec2 d = vUv - 0.5; c *= 1.0 - uVig * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(c, 1.0); }`,
    { tD: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null }, uBloom: { value: 0.5 }, uExpo: { value: 0.8 }, uVig: { value: 0.4 }, uSat: { value: 1.22 }, uCon: { value: 1.15 }, uBri: { value: 0 }, uHasBloom: { value: 1 },
      uLift: { value: new THREE.Vector3(0.0, 0.006, 0.018) }, uGain: { value: new THREE.Vector3(1.04, 1.0, 0.95) } });
  P.fxaa = mk(`uniform sampler2D tD; uniform vec2 uRes; varying vec2 vUv;
    void main(){ vec2 px = 1.0 / uRes;
      vec3 rgbNW = texture2D(tD, vUv + vec2(-1.0,-1.0)*px).rgb, rgbNE = texture2D(tD, vUv + vec2(1.0,-1.0)*px).rgb, rgbSW = texture2D(tD, vUv + vec2(-1.0,1.0)*px).rgb, rgbSE = texture2D(tD, vUv + vec2(1.0,1.0)*px).rgb, rgbM = texture2D(tD, vUv).rgb;
      vec3 luma = vec3(0.299, 0.587, 0.114); float lNW = dot(rgbNW, luma), lNE = dot(rgbNE, luma), lSW = dot(rgbSW, luma), lSE = dot(rgbSE, luma), lM = dot(rgbM, luma);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125); float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, -8.0, 8.0) * px;
      vec3 A = 0.5 * (texture2D(tD, vUv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(tD, vUv + dir * (2.0/3.0 - 0.5)).rgb);
      vec3 B = A * 0.5 + 0.25 * (texture2D(tD, vUv + dir * -0.5).rgb + texture2D(tD, vUv + dir * 0.5).rgb);
      float lB = dot(B, luma); gl_FragColor = vec4((lB < lMin || lB > lMax) ? A : B, 1.0); }`, { tD: { value: null }, uRes: { value: new THREE.Vector2() } });
  P.copy = mk(`uniform sampler2D tD; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tD, vUv); }`, { tD: { value: null } });
}
function postResize(w, h, q) {
  const P = POST; P.q = q; P.w = w; P.h = h;
  for (const k of ['main', 'ldr', 'b1', 'b2', 'b3', 't1', 't2', 't3']) if (P[k]) P[k].dispose();
  const o = (extra) => Object.assign({ type: P.type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }, extra || {});
  P.main = new THREE.WebGLRenderTarget(w, h, o({ depthBuffer: true, samples: P.isGL2 && q.msaa ? q.msaa : 0 }));
  P.ldr = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const s = [2, 4, 8]; [1, 2, 3].forEach((i, k) => { const bw = Math.max(1, Math.floor(w / s[k])), bh = Math.max(1, Math.floor(h / s[k])); P['b' + i] = new THREE.WebGLRenderTarget(bw, bh, o()); P['t' + i] = new THREE.WebGLRenderTarget(bw, bh, o()); });
  P.fxaa.uniforms.uRes.value.set(w, h);
}
function pass(mat, target) { POST.quad.material = mat; POST.r.setRenderTarget(target); POST.r.render(POST.scene, POST.cam); }
function postRender(scene, camera) {
  const P = POST, r = P.r, q = P.q;
  r.setRenderTarget(P.main); r.clear(); r.render(scene, camera);
  const bloom = q.bloom;
  if (bloom) {
    P.bright.uniforms.tD.value = P.main.texture; pass(P.bright, P.b1);
    let src = P.b1;
    for (let i = 1; i <= 3; i++) {
      const b = P['b' + i], t = P['t' + i];
      if (i > 1) { P.copy.uniforms.tD.value = src.texture; pass(P.copy, b); }
      P.blur.uniforms.tD.value = b.texture; P.blur.uniforms.uDir.value.set(1 / b.width, 0); pass(P.blur, t);
      P.blur.uniforms.tD.value = t.texture; P.blur.uniforms.uDir.value.set(0, 1 / b.height); pass(P.blur, b);
      src = b;
    }
  }
  const f = P.final.uniforms; f.tD.value = P.main.texture; f.tB1.value = P.b1.texture; f.tB2.value = P.b2.texture; f.tB3.value = P.b3.texture; f.uHasBloom.value = bloom ? 1 : 0;
  if (q.fxaa) { pass(P.final, P.ldr); P.fxaa.uniforms.tD.value = P.ldr.texture; pass(P.fxaa, null); }
  else pass(P.final, null);
}
