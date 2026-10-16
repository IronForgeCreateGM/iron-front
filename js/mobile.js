'use strict';
// v5.7 Mobile view: responsive layout, touch camera (drag pan / pinch zoom / tap minimap / double-tap follow), light rendering.
const MOB = { on: false, touch: typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) };
function mobSet(on, save) {
  MOB.on = !!on; document.body.classList.toggle('mobile', MOB.on); if (save !== false) try { localStorage.setItem('ifMobile', MOB.on ? '1' : '0'); } catch (e) {}
  const b = document.getElementById('mobileBtn'); if (b) b.textContent = '📱 Mobile view: ' + (MOB.on ? 'On' : 'Off');
  const w = document.getElementById('mobWatchBtn'); if (w) w.style.display = MOB.on ? '' : 'none';
  if (typeof R3 !== 'undefined' && R3.renderer && MOB.on) mobPerf();
}
function mobPerf() { // lower pixel ratio, no shadows, quiet-style effects + 30 fps cap
  if (typeof UI !== 'undefined' && UI.set) { UI.set.quiet = true; UI.set.quietFps = '30'; }
  QUALITY.mobile = Object.assign({}, QUALITY.low, { pr: Math.min(1.5, window.devicePixelRatio || 1), shadows: false, grass: 0, fx: 0.35, label: 'Mobile' });
  R3.auto = false; applyQuality('mobile');
}
function mobWatch4v4() { // all-bot 4v4 on Volcano Crown XL, spectated
  homeShow('bots'); const ms = document.getElementById('mapSel'); ms.value = 'volcano8'; ms.dispatchEvent(new Event('change'));
  lobbySet([['si', 'A'], ['chief', 'A'], ['hard', 'A'], ['si', 'A'], ['hard', 'B'], ['si', 'B'], ['chief', 'B'], ['hard', 'B']]);
  document.getElementById('startBtn').click();
}
function mobInitTouch() {
  const cv = document.getElementById('view'); if (!cv || cv.__mob) return; cv.__mob = true;
  const T = MOB.T = { pts: new Map(), last: 0, lastXY: null, moved: false, d0: 0, z0: 0 };
  const scale = () => R3.cam.d / Math.max(200, cv.clientHeight) * 1.6; // world units per pixel (approx)
  const dist = () => { const p = [...T.pts.values()]; return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  cv.addEventListener('touchstart', e => { if (!MOB.on) return; e.preventDefault();
    for (const t of e.changedTouches) T.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (T.pts.size === 1) { T.moved = false; const t = e.changedTouches[0]; T.sx = t.clientX; T.sy = t.clientY; }
    if (T.pts.size === 2) { T.d0 = dist(); T.z0 = R3.cam.td; T.moved = true; } }, { passive: false });
  cv.addEventListener('touchmove', e => { if (!MOB.on) return; e.preventDefault();
    const prev = new Map(T.pts); for (const t of e.changedTouches) T.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (T.pts.size === 1) { const [id, p] = [...T.pts][0], q = prev.get(id); if (!q) return; const dx = p.x - q.x, dy = p.y - q.y;
      if (Math.hypot(p.x - T.sx, p.y - T.sy) > 8) T.moved = true; const s = scale(); R3.cam.tx -= dx * s; R3.cam.ty -= dy * s; R3.cam.x = R3.cam.tx; R3.cam.y = R3.cam.ty; DIR.auto = false; }
    else if (T.pts.size >= 2 && T.d0) { const z = Math.max(6, Math.min(G.spectate || G.watch ? 110 : 60, T.z0 * T.d0 / Math.max(10, dist()))); R3.cam.td = z; DIR.userZoom = true; } }, { passive: false });
  const end = e => { if (!MOB.on) return; e.preventDefault(); for (const t of e.changedTouches) T.pts.delete(t.identifier);
    if (T.pts.size < 2) T.d0 = 0;
    if (!T.pts.size && !T.moved) { const now = e.timeStamp || performance.now(), t = e.changedTouches[0];
      if (now - T.last < 400 && T.lastXY && Math.hypot(t.clientX - T.lastXY.x, t.clientY - T.lastXY.y) < 40) { DIR.auto = true; DIR.userZoom = true; DIR.hold = 0; if (typeof uiMsg === 'function') uiMsg('🎥 Following the action (drag to take over)'); T.last = 0; }
      else { T.last = now; T.lastXY = { x: t.clientX, y: t.clientY }; } } };
  cv.addEventListener('touchend', end, { passive: false }); cv.addEventListener('touchcancel', end, { passive: false });
  const mm = document.getElementById('minimap');
  const mmT = e => { if (!MOB.on) return; e.preventDefault(); const t = e.touches[0] || e.changedTouches[0], r = mm.getBoundingClientRect(); jumpTo((t.clientX - r.left) / r.width * MW, (t.clientY - r.top) / r.height * MH, true); DIR.auto = false; };
  mm.addEventListener('touchstart', mmT, { passive: false }); mm.addEventListener('touchmove', mmT, { passive: false });
}
window.addEventListener('load', () => {
  let saved = null; try { saved = localStorage.getItem('ifMobile'); } catch (e) {}
  const qs = new URLSearchParams(location.search).get('mobile');
  const hint = document.getElementById('mobHint'); if (hint && MOB.touch && saved == null) hint.style.display = 'block';
  document.getElementById('mobileBtn').onclick = () => { mobSet(!MOB.on); if (hint) hint.style.display = 'none'; };
  document.getElementById('mobWatchBtn').onclick = mobWatch4v4;
  document.getElementById('mobMenuBtn').onclick = () => { if (typeof togglePause === 'function') togglePause(); };
  document.addEventListener('gesturestart', e => { if (MOB.on) e.preventDefault(); }); // iOS page pinch
  mobSet(qs != null ? qs === '1' : saved === '1', qs == null);
  setInterval(() => { const m = document.getElementById('menu'); document.body.classList.toggle('inmenu', !!m && getComputedStyle(m).display !== 'none'); }, 250);
  const iv = setInterval(() => { if (typeof R3 !== 'undefined' && R3.renderer) { clearInterval(iv); mobInitTouch(); if (MOB.on) mobPerf(); } }, 300);
});
