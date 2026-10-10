'use strict';
// ===== Boot, menu, loop =====
let started = false, paused = false, acc = 0, lastT = 0;
const QS = new URLSearchParams(location.search);
window.addEventListener('error', e => { const d = document.getElementById('err'); if (d) { d.style.display = 'block'; d.textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n'; } });
function togglePause() { if (!started || G.over) return; paused = !paused; document.getElementById('pause').style.display = paused ? 'flex' : 'none'; }
function startGame(diff, opts) {
  opts = opts || {};
  document.getElementById('menu').style.display = 'none';
  newGame({ diff, aiTeams: opts.demo ? [0, 1] : [1], fog: opts.fog !== false, seed: opts.seed });
  if (opts.demo) G.players[0].diff = 'normal';
  r3Init(document.getElementById('view'));
  uiSetup();
  const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); R3.cam.x = hq.x + 4; R3.cam.y = hq.y + 8;
  if (opts.demo) {
    const hits = [];
    for (let i = 0; i < opts.demo * 30; i++) { stepGame(); for (const ev of G.events) if (ev.e === 'hit') hits.push({ x: ev.x, y: ev.y, t: G.time }); G.events.length = 0; if (G.over) break; }
    const recent = hits.filter(h => h.t > G.time - 4); let best = null, bn = -1;
    for (const h of recent) { const n = recent.filter(o => Math.hypot(o.x - h.x, o.y - h.y) < 5).length; if (n > bn) { bn = n; best = h; } }
    const u0 = G.ents.filter(e => e.kind === 'u' && e.team === 0 && e.t !== 'harv');
    if (best) { R3.cam.x = best.x; R3.cam.y = best.y + 5; R3.cam.d = 24; }
    setSel(u0.filter(u => best && Math.hypot(u.x - best.x, u.y - best.y) < 8));
  }
  started = true; lastT = performance.now(); requestAnimationFrame(frame);
}
function frame(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (!paused && !G.over) { acc += dt; let n = 0; while (acc >= DT && n++ < 6) { stepGame(); acc -= DT; } if (n >= 6) acc = 0; }
  try { uiFrame(dt); r3Render(dt); } catch (e) { console.error(e); throw e; }
  if (G.over && !UI.endShown) { UI.endShown = true; const P = G.players[0];
    document.getElementById('end').style.display = 'flex';
    document.getElementById('endTitle').textContent = G.over === 'victory' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('endTitle').className = G.over;
    document.getElementById('endStats').innerHTML = `Time ${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')} · Kills ${P.stats.kills} · Losses ${P.stats.lost} · Ore mined $${Math.floor(P.stats.mined)}`; sfx(G.over === 'victory' ? 'ready' : 'alert'); }
  requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') { document.getElementById('err').style.display = 'block'; document.getElementById('err').textContent = 'Three.js failed to load (vendor/three.min.js)'; return; }
  let diff = 'normal';
  document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { diff = b.dataset.d; document.querySelectorAll('#diff button').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('startBtn').onclick = () => { audioInit(); startGame(diff, { fog: document.getElementById('fogChk').checked }); };
  document.getElementById('resumeBtn').onclick = () => togglePause();
  document.querySelectorAll('.quitBtn').forEach(b => b.onclick = () => location.href = location.pathname);
  if (QS.get('demo')) startGame(QS.get('diff') || 'normal', { demo: +QS.get('demo'), seed: +QS.get('seed') || 4242 });
  else if (QS.get('autostart')) startGame(QS.get('diff') || 'normal', {});
});
// In-browser input smoke test: index.html?autostart=1&selftest=1  (result written to document.title)
function selfTest() {
  try {
    const v = document.getElementById('view'), ev = (type, x, y, button, extra) => v.dispatchEvent(new MouseEvent(type, Object.assign({ clientX: x, clientY: y, button, bubbles: true }, extra || {})));
    const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'), p = worldToScreen(hq.x + 3, hq.y + 4, 0);
    ev('mousedown', p.x - 150, p.y - 150, 0); ev('mousemove', p.x + 150, p.y + 150, 0); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    const s = worldToScreen(hq.x + 8, hq.y + 8, 0); ev('mousedown', s.x, s.y, 2);
    for (const k in CATS) { UI.tab = k; buildGrid(); }
    clickItem('power', false); for (let i = 0; i < 400; i++) stepGame();
    clickItem('power', false); const pp = worldToScreen(hq.x + 4, hq.y - 1, 0); ev('mousemove', pp.x, pp.y, 0); uiFrame(0.016); ev('mousedown', pp.x, pp.y, 0);
    clickItem('barracks', false); clickItem('rifle', false); clickItem('rifle', true);
    ['a', 's', 'h', 'q', '1'].forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))); window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    UI.mode = 'repair'; ev('mousedown', worldToScreen(hq.x, hq.y, 1).x, worldToScreen(hq.x, hq.y, 1).y, 0);
    const mm = document.getElementById('minimap'), r = mm.getBoundingClientRect(); mm.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 100, clientY: r.top + 100, button: 0, bubbles: true }));
    for (let i = 0; i < 300; i++) stepGame();
    togglePause(); togglePause();
    document.title = 'SELFTEST OK sel=' + UI.sel.length + ' powerPlants=' + G.ents.filter(e => e.team === 0 && e.t === 'power').length;
  } catch (e) { document.title = 'SELFTEST FAIL ' + e.message; throw e; }
}
if (QS.get('selftest')) window.addEventListener('load', () => setTimeout(selfTest, 300));
