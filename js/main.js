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
  const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); R3.cam.td = R3.cam.d = 26; jumpTo(hq.x + 3, hq.y + 2, true);
  if (opts.demo) {
    const hits = [];
    for (let i = 0; i < opts.demo * 30; i++) { stepGame(); for (const ev of G.events) if (ev.e === 'hit') hits.push({ x: ev.x, y: ev.y, t: G.time }); G.events.length = 0; if (G.over) break; }
    const recent = hits.filter(h => h.t > G.time - 4 && G.vis[idx(Math.floor(h.x), Math.floor(h.y))]); let best = null, bn = -1;
    for (const h of recent) { const n = recent.filter(o => Math.hypot(o.x - h.x, o.y - h.y) < 5).length; if (n > bn) { bn = n; best = h; } }
    const u0 = G.ents.filter(e => e.kind === 'u' && e.team === 0 && e.t !== 'harv');
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 22);
    if (!best) { const army = G.ents.filter(e => e.team === 0 && e.kind === 'u' && e.t !== 'harv'); if (army.length) best = { x: army.reduce((a, e) => a + e.x, 0) / army.length, y: army.reduce((a, e) => a + e.y, 0) / army.length }; }
    if (best) jumpTo(best.x + (+QS.get('ox') || 0), best.y + (+QS.get('oy') || 0), true);
    setSel(u0.filter(u => best && Math.hypot(u.x - best.x, u.y - best.y) < 8));
  }
  started = true; lastT = performance.now(); requestAnimationFrame(frame);
}
function frame(t) {
  const dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t;
  if (!paused && !G.over) { acc += dt; let n = 0; while (acc >= DT && n++ < 6) { stepGame(); acc -= DT; } if (n >= 6) acc = 0; }
  if (QS.get('dbg') && G.tick % 30 === 0) document.title = 'IM ' + JSON.stringify([...R3.uiMesh.entries()].map(([k, u]) => k + ':' + u.n + ':' + u.parts.body.count + ':' + u.parts.body.visible + ':' + (R3.scene.children.includes(u.parts.body)) + ':' + Array.from(u.parts.body.instanceMatrix.array.slice(12, 15)).map(v => v.toFixed(1)))) + ' view ' + JSON.stringify(R3.view) + ' cam ' + JSON.stringify(R3.cam) + ' units ' + JSON.stringify(G.ents.filter(e => e.kind === 'u' && e.team === 0).map(e => [e.t, e.x.toFixed(1), e.y.toFixed(1)]));
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
  if (QS.get('stress')) { startGame('normal', { demo: 1, seed: 4242 }); const n = +QS.get('stress'), types = ['rifle', 'rocketeer', 'light', 'heavy', 'arty', 'aa', 'scout', 'gunship'];
    for (let i = 0; i < n; i++) { const tm = i % 2, t = types[i % types.length]; const p = nearFree(28 + (tm ? 6 : -6) + (i % 7), 30 + ((i / 7) | 0) % 10, 6); addU(t, tm, p[0] + 0.5, p[1] + 0.5); }
    G.opts.fog = false; R3.cam.td = R3.cam.d = 34; jumpTo(32, 32, true);
    const ts = []; let k = 0; const tick = () => { const t0 = performance.now(); stepGame(); uiFrame(1 / 60); r3Render(1 / 60); ts.push(performance.now() - t0); if (++k < 90) setTimeout(tick, 0); else { ts.sort((a, b) => a - b); document.title = 'STRESS units=' + G.ents.filter(e => e.kind === 'u').length + ' median ms=' + ts[45].toFixed(1) + ' draws=' + R3.renderer.info.render.calls; } };
    paused = true; setTimeout(tick, 100);
  } else
  if (QS.get('demo')) startGame(QS.get('diff') || 'normal', { demo: +QS.get('demo'), seed: +QS.get('seed') || 4242 });
  else if (QS.get('autostart')) startGame(QS.get('diff') || 'normal', {});
});
// In-browser input smoke test: index.html?autostart=1&selftest=1  (result written to document.title)
let extra = '';
function selfTest() {
  try {
    const v = document.getElementById('view'), ev = (type, x, y, button, extra) => v.dispatchEvent(new MouseEvent(type, Object.assign({ clientX: x, clientY: y, button, bubbles: true }, extra || {})));
    r3Render(0.016); const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'), p = worldToScreen(hq.x + 3, hq.y + 4, 0);
    ev('mousedown', p.x - 150, p.y - 150, 0); ev('mousemove', p.x + 150, p.y + 150, 0); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    const s = worldToScreen(hq.x + 8, hq.y + 8, 0); ev('mousedown', s.x, s.y, 2); ev('mousedown', s.x + 40, s.y, 2, { shiftKey: true }); setSel([hq]); clickItem('harv', false, false); r3Render(0.016); uiFrame(0.2);
    for (const k in CATS) { UI.tab = k; buildGrid(); }
    clickItem('power', false); for (let i = 0; i < 400; i++) stepGame();
    clickItem('power', false); const pp = worldToScreen(hq.x + 4, hq.y - 1, 0); ev('mousemove', pp.x, pp.y, 0); uiFrame(0.016); ev('mousedown', pp.x, pp.y, 0);
    clickItem('barracks', false); clickItem('rifle', false); clickItem('rifle', true);
    ['a', 's', 'h', 'q', '1'].forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))); window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    UI.mode = 'repair'; ev('mousedown', worldToScreen(hq.x, hq.y, 1).x, worldToScreen(hq.x, hq.y, 1).y, 0);
    const mm = document.getElementById('minimap'), r = mm.getBoundingClientRect(); mm.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 100, clientY: r.top + 100, button: 0, bubbles: true }));
    for (let i = 0; i < 300; i++) stepGame();
    togglePause(); togglePause();
    for (const q of ['low', 'med', 'ultra', 'high']) { applyQuality(q); r3Render(0.016); }
    G.players[0].cr = 99999; addB('barracks', 0, 14, 4, true); addB('factory', 0, 14, 10, true); stepGame();
    const bar = G.ents.find(e => e.t === 'barracks' && e.team === 0); setSel([bar]); const tabOk = UI.tab === 'inf';
    clickItem('rifle', false, true); const q5 = G.players[0].queues.inf.length; clickItem('rifle', true, false); const q4 = G.players[0].queues.inf.length;
    showTip('heavy', document.querySelector('.item')); sidebar(); setSel([G.ents.find(e => e.t === 'hq' && e.team === 0)]); sidebar();
    const ctxBtns = document.querySelectorAll('#ctx .item').length;
    for (let i = 0; i < 300; i++) stepGame();
    for (let i = 0; i < 20; i++) { uiFrame(0.05); r3Render(0.05); }
    extra = ` tab=${tabOk} q5=${q5} q4=${q4} hqBtns=${ctxBtns} units=${G.ents.filter(e => e.team === 0 && e.kind === 'u').length}`;
    document.title = extra + ' SELFTEST OK sel=' + UI.sel.length + ' powerPlants=' + G.ents.filter(e => e.team === 0 && e.t === 'power').length;
  } catch (e) { document.title = 'SELFTEST FAIL ' + e.message; throw e; }
}
if (QS.get('selftest')) window.addEventListener('load', () => setTimeout(selfTest, 300));
