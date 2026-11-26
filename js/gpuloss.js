// v7.9.27: GPU context loss recovery (App Store stability). iOS/iPadOS/macOS drop a web view's WebGL context under memory
// pressure or after the app sat in the background; until then the match was a black screen that kept running (offline) with
// only a 3 s toast. Now: an offline match pauses the moment graphics are lost (the normal pause menu waits under the panel,
// the player taps Resume once the picture is back), a "Graphics paused" panel covers the black screen, and if the system
// has not handed the GPU back after 6 s the panel offers "Try again" and "Restart". Online matches keep running (lockstep)
// and only get the panel. Render/UI only: no sim, AI, replay or netcode change. QA: IF_GPU.test() loses+restores once.
const IF_GPU = { lost: false, at: 0, autoPaused: false, ext: null, cv: null, timer: 0, losses: 0, restores: 0, waitMs: 6000 };
function gpuPanel() {
  let p = document.getElementById('gpuLost');
  if (!p) {
    p = document.createElement('div'); p.id = 'gpuLost'; p.setAttribute('role', 'alertdialog'); p.setAttribute('aria-live', 'assertive');
    p.style.cssText = 'position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:#05080c;color:#dfe8f2;font:16px system-ui,-apple-system,sans-serif;text-align:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));box-sizing:border-box';
    p.innerHTML = '<div style="max-width:420px"><div style="font-size:20px;font-weight:700;margin-bottom:8px">Graphics paused</div>'
      + '<div id="gpuLostTxt" style="opacity:.85;line-height:1.4">Your device took the graphics memory back for a moment. Restoring…</div>'
      + '<div id="gpuLostBtns" style="display:none;margin-top:16px;gap:12px;justify-content:center;flex-wrap:wrap">'
      + '<button id="gpuRetry" style="min-height:44px;min-width:140px;background:#13243a;color:#dfe8f2;border:1px solid #3a6ea5;border-radius:8px;font:600 16px system-ui,-apple-system,sans-serif;padding:10px 18px;cursor:pointer">Try again</button>'
      + '<button id="gpuRestart" style="min-height:44px;min-width:140px;background:#13243a;color:#dfe8f2;border:1px solid #3a6ea5;border-radius:8px;font:600 16px system-ui,-apple-system,sans-serif;padding:10px 18px;cursor:pointer">Restart</button></div></div>';
    document.body.appendChild(p);
    p.querySelector('#gpuRetry').onclick = () => gpuRetry();
    p.querySelector('#gpuRestart').onclick = () => { try { location.reload(); } catch (e) {} };
  }
  return p;
}
function gpuShowPanel(stuck) {
  const p = gpuPanel(); p.style.display = 'flex';
  const online = typeof NET !== 'undefined' && NET.online;
  p.querySelector('#gpuLostTxt').textContent = stuck
    ? (online ? 'The graphics have not come back yet. The online match is still running. Try again, or Restart and rejoin with the room code.'
              : 'The graphics have not come back yet. Your match is paused. Try again, or Restart (this match will end).')
    : (online ? 'Your device took the graphics memory back for a moment. Restoring… (the online match keeps running)'
              : 'Your device took the graphics memory back for a moment. Your match is paused. Restoring…');
  p.querySelector('#gpuLostBtns').style.display = stuck ? 'flex' : 'none';
}
function gpuHidePanel() { const p = document.getElementById('gpuLost'); if (p) p.style.display = 'none'; }
function gpuRetry() {
  gpuShowPanel(false); clearTimeout(IF_GPU.timer); IF_GPU.timer = setTimeout(() => { if (IF_GPU.lost) gpuShowPanel(true); }, IF_GPU.waitMs);
  try { if (IF_GPU.ext) IF_GPU.ext.restoreContext(); } catch (e) {} // only works if the loss came from this extension; a real loss waits for the system
}
function gpuOnLost(e) {
  e.preventDefault(); // without this the browser never offers the context back
  if (IF_GPU.lost) return; IF_GPU.lost = true; IF_GPU.at = performance.now(); IF_GPU.losses++;
  if (typeof MOB !== 'undefined') MOB.lost = true;
  IF_GPU.autoPaused = false;
  try { if (typeof started !== 'undefined' && started && typeof NET !== 'undefined' && !NET.online && typeof G !== 'undefined' && G && !G.over && !paused) { togglePause(); IF_GPU.autoPaused = true; } } catch (err) {}
  if (typeof started !== 'undefined' && started) gpuShowPanel(false); else if (typeof uiMsg === 'function') uiMsg('Graphics paused (GPU context lost) — restoring…');
  clearTimeout(IF_GPU.timer); IF_GPU.timer = setTimeout(() => { if (IF_GPU.lost) gpuShowPanel(true); }, IF_GPU.waitMs);
}
function gpuOnRestored() {
  IF_GPU.lost = false; IF_GPU.restores++; clearTimeout(IF_GPU.timer);
  if (typeof MOB !== 'undefined') MOB.lost = false;
  try { if (typeof applyQuality === 'function' && typeof R3 !== 'undefined') applyQuality(R3.qName || 'mobile'); } catch (e) {}
  gpuHidePanel(); // an auto-paused offline match stays on the pause menu: the player taps Resume (same as coming back from the background)
  if (typeof uiMsg === 'function') uiMsg('Graphics restored');
}
function gpuAttach(cv) {
  if (!cv || IF_GPU.cv === cv) return; IF_GPU.cv = cv;
  try { const gl = typeof R3 !== 'undefined' && R3.renderer ? R3.renderer.getContext() : null; IF_GPU.ext = gl ? gl.getExtension('WEBGL_lose_context') : null; } catch (e) {}
  cv.addEventListener('webglcontextlost', gpuOnLost, false);
  cv.addEventListener('webglcontextrestored', gpuOnRestored, false);
}
IF_GPU.attach = gpuAttach; IF_GPU.retry = gpuRetry;
IF_GPU.test = (ms) => { if (!IF_GPU.ext) return false; IF_GPU.ext.loseContext(); setTimeout(() => { try { IF_GPU.ext.restoreContext(); } catch (e) {} }, ms || 1500); return true; };
(function gpuWait() { if (typeof R3 !== 'undefined' && R3.renderer) gpuAttach(R3.renderer.domElement); else setTimeout(gpuWait, 300); })();
// while the panel is up, keys (Esc / P / hotkeys) must not resume or order a match the player cannot see
window.addEventListener('keydown', e => { if (IF_GPU.lost && typeof started !== 'undefined' && started) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
