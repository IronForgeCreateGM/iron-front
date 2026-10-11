'use strict';
// ===== Boot, menu, loop =====
let started = false, paused = false, acc = 0, lastT = 0;
const QS = new URLSearchParams(location.search);
window.addEventListener('error', e => { const d = document.getElementById('err'); if (d) { d.style.display = 'block'; d.textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n'; } });
function togglePause() { if (!started || G.over) return; paused = !paused; document.getElementById('pause').style.display = paused ? 'flex' : 'none'; }
function startGame(diff, opts) {
  opts = opts || {};
  document.getElementById('menu').style.display = 'none';
  newGame({ diff, aiTeams: opts.demo || opts.watch ? [0, 1] : [1], fog: opts.fog !== false, seed: opts.seed });
  if (opts.demo) G.players[0].diff = 'normal';
  if (opts.watch) { G.players[0].diff = 'chief'; aiInit(G.players[0]); G.spectate = true; G.watch = true; document.body.classList.add('watching'); const ff = +QS.get('ff') || 0; for (let i = 0; i < ff * 30 && !G.over; i++) { stepGame(); director(DT); G.events.length = 0; } if (DIR.cur) { R3 && 0; } }
  r3Init(document.getElementById('view'));
  uiSetup();
  const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); R3.cam.td = R3.cam.d = 26; jumpTo(hq.x + 3, hq.y + 2, true);
  if (G.watch && DIR.cur) { R3.cam.td = R3.cam.d = 20; jumpTo(DIR.cur.x, DIR.cur.y, true); }
  if (opts.demo) {
    const hits = [];
    for (let i = 0; i < opts.demo * 30; i++) { stepGame(); for (const ev of G.events) if (ev.e === 'hit') hits.push({ x: ev.x, y: ev.y, t: G.time }); G.events.length = 0; if (G.over) break; }
    const recent = hits.filter(h => h.t > G.time - 4 && vis0(idx(Math.floor(h.x), Math.floor(h.y)))); let best = null, bn = -1;
    for (const h of recent) { const n = recent.filter(o => Math.hypot(o.x - h.x, o.y - h.y) < 5).length; if (n > bn) { bn = n; best = h; } }
    const u0 = G.ents.filter(e => e.kind === 'u' && e.team === 0 && e.t !== 'harv');
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 22);
    if (!best) { const army = G.ents.filter(e => e.team === 0 && e.kind === 'u' && e.t !== 'harv'); if (army.length) best = { x: army.reduce((a, e) => a + e.x, 0) / army.length, y: army.reduce((a, e) => a + e.y, 0) / army.length }; }
    if (best) jumpTo(best.x + (+QS.get('ox') || 0), best.y + (+QS.get('oy') || 0), true);
    setSel(u0.filter(u => best && Math.hypot(u.x - best.x, u.y - best.y) < 8));
  }
  started = true; lastT = performance.now(); requestAnimationFrame(frame);
}
const REC = QS.get('rec');
window.__rec = n => { for (let i = 0; i < n && !G.over; i++) stepGame(); director(n * DT); uiFrame(n * DT); r3Render(n * DT); if (G.over && !UI.endShown) frame(performance.now(), true); return { t: G.time, over: G.over || null }; };
function frame(t, once) {
  if (REC && !once) return;
  const dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t;
  if (!paused && !G.over) { acc += dt; let n = 0; while (acc >= DT && n++ < 6) { stepGame(); acc -= DT; } if (n >= 6) acc = 0; }
  if (QS.get('dbg') && G.tick % 30 === 0) document.title = 'IM ' + JSON.stringify([...R3.uiMesh.entries()].map(([k, u]) => k + ':' + u.n + ':' + u.parts.body.count + ':' + u.parts.body.visible + ':' + (R3.scene.children.includes(u.parts.body)) + ':' + Array.from(u.parts.body.instanceMatrix.array.slice(12, 15)).map(v => v.toFixed(1)))) + ' view ' + JSON.stringify(R3.view) + ' cam ' + JSON.stringify(R3.cam) + ' units ' + JSON.stringify(G.ents.filter(e => e.kind === 'u' && e.team === 0).map(e => [e.t, e.x.toFixed(1), e.y.toFixed(1)]));
  if (G.watch && !paused) director(dt);
  try { uiFrame(dt); r3Render(dt); } catch (e) { console.error(e); throw e; }
  if (G.over && !UI.endShown) { UI.endShown = true; const P = G.players[0];
    document.getElementById('end').style.display = 'flex';
    document.getElementById('endTitle').textContent = G.watch ? (G.over === 'victory' ? 'CHIEF WINS' : 'HARD AI WINS') + ` · ${(G.time / 60).toFixed(1)} min` : G.over === 'victory' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('endTitle').className = G.over;
    document.getElementById('endStats').innerHTML = `Time ${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')} · Kills ${P.stats.kills} · Losses ${P.stats.lost} · Ore mined $${Math.floor(P.stats.mined)}`; sfx(G.over === 'victory' ? 'ready' : 'alert'); }
  if (!once) requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') { document.getElementById('err').style.display = 'block'; document.getElementById('err').textContent = 'Three.js failed to load (vendor/three.min.js)'; return; }
  let diff = 'normal';
  document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { diff = b.dataset.d; document.querySelectorAll('#diff button').forEach(x => x.classList.toggle('on', x === b)); });
  document.getElementById('watchBtn').onclick = () => { audioInit(); startGame('hard', { watch: 1, seed: (Math.random() * 1e6) | 0 }); };
  if (QS.get('watch')) startGame(QS.get('watch'), { watch: 1, seed: +QS.get('seed') || 5 });
  document.getElementById('startBtn').onclick = () => { audioInit(); startGame(diff, { fog: document.getElementById('fogChk').checked }); };
  document.getElementById('resumeBtn').onclick = () => togglePause();
  document.querySelectorAll('.quitBtn').forEach(b => b.onclick = () => location.href = location.pathname);
  if (QS.get('showcase')) { startGame('easy', { seed: 4242 }); const P = G.players[0]; P.cr = 99999;
    for (const [t, x, y] of [['power', 4, 12], ['power', 1, 9], ['power', 4, 2], ['barracks', 11, 3], ['refinery', 11, 12], ['factory', 15, 6], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10;
    const t1 = addB('turret', 0, 16, 14, true), t2 = addB('turret', 0, 19, 11, true), t3 = addB('aagun', 0, 18, 15, true); t1.lvl = 3; t2.lvl = 2; [t1, t2, t3].forEach(b => b.born = -10);
    const army = []; ['heavy', 'heavy', 'light', 'light', 'rifle', 'rifle', 'rocketeer', 'rocketeer', 'rifle', 'arty', 'aa', 'arty'].forEach((t, i) => army.push(addU(t, 0, 14 + (i % 4), 18 + (i / 4 | 0))));
    for (let i = 0; i < 30; i++) stepGame(); orderFormation(army, 20, 20, Math.PI / 4); for (let i = 0; i < 30 * 12; i++) stepGame();
    G.events.length = 0; setSel([t1]); R3.cam.td = R3.cam.d = 19; jumpTo(17, 15.5, true); paused = false;
  } else
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
    const tur2 = addB('turret', 0, 12, 13, true); tur2.born = -10; const lv0 = defW(tur2).rng; const okU = upgradeB(tur2); for (let i = 0; i < 30 * 16; i++) stepGame(); const lv = tur2.lvl;
    const army = []; for (let i = 0; i < 8; i++) army.push(addU(['heavy', 'rifle', 'arty', 'rocketeer'][i % 4], 0, 16 + i % 3, 16 + (i / 3 | 0)));
    setSel(army); sidebar(); doFormation(false); const fmOk = army.every(u => u.stance === 'hold'); toggleStance(); const agg = army.every(u => u.stance === 'aggr');
    extra += ` upg=${okU}:${lv}:${lv0}->${defW(tur2).rng} formation=${fmOk} stance=${agg}`;
    for (let i = 0; i < 300; i++) stepGame();
    for (let i = 0; i < 20; i++) { uiFrame(0.05); r3Render(0.05); }
    extra += ` tab=${tabOk} q5=${q5} q4=${q4} hqBtns=${ctxBtns} units=${G.ents.filter(e => e.team === 0 && e.kind === 'u').length}`;
    document.title = extra + ' SELFTEST OK sel=' + UI.sel.length + ' powerPlants=' + G.ents.filter(e => e.team === 0 && e.t === 'power').length;
  } catch (e) { document.title = 'SELFTEST FAIL ' + e.message; throw e; }
}
if (QS.get('selftest')) window.addEventListener('load', () => setTimeout(selfTest, 300));

// ===== spectator camera director: follows fights, cycles key moments =====
const DIR = { t: 0, hot: [], cur: null, hold: 0 };
function director(dt) {
  for (const ev of G.events) if (ev.e === 'hit' || ev.e === 'die') DIR.hot.push({ x: ev.x != null ? ev.x : ev.ent.x, y: ev.y != null ? ev.y : ev.ent.y, t: G.time, w: ev.e === 'die' ? (ev.ent.kind === 'b' ? 8 : 3) : 1 });
  DIR.hot = DIR.hot.filter(h => G.time - h.t < 5);
  const wt = document.getElementById('watchTag'); if (wt && G.tick % 15 === 0) { const av = t => Math.round(G.ents.filter(e => e.team === t && e.kind === 'u' && e.t !== 'harv').reduce((a, e) => a + UT[e.t].cost, 0) / 100) / 10; wt.textContent = `CHIEF (olive) ${av(0)}k army  ·  ${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}  ·  HARD AI (tan) ${av(1)}k army`; }
  DIR.t -= dt; DIR.hold -= dt;
  if (DIR.t <= 0) {
    DIR.t = 0.8; let best = null, bs = 0;
    for (const h of DIR.hot) { let sc = 0; for (const o of DIR.hot) if (Math.hypot(o.x - h.x, o.y - h.y) < 6) sc += o.w * (1 - (G.time - o.t) / 5); if (sc > bs) { bs = sc; best = h; } }
    const stick = DIR.cur && DIR.hold > 0;
    if (best && bs > 4 && (!stick || Math.hypot(best.x - DIR.cur.x, best.y - DIR.cur.y) < 8 || bs > (DIR.curS || 0) * 2)) { if (!DIR.cur || Math.hypot(best.x - DIR.cur.x, best.y - DIR.cur.y) > 3) DIR.hold = 6; DIR.cur = best; DIR.curS = bs; R3.cam.td = bs > 25 ? 16 : 19; }
    else if (!stick || !best) { // calm: tour bases & armies
      if (DIR.hold <= 0) { const opts = []; for (const t of [0, 1]) { const army = G.ents.filter(e => e.team === t && e.kind === 'u' && e.t !== 'harv'); if (army.length) opts.push({ x: army.reduce((a, e) => a + e.x, 0) / army.length, y: army.reduce((a, e) => a + e.y, 0) / army.length }); const hq = G.ents.find(e => e.team === t && e.t === 'hq'); if (hq) opts.push({ x: hq.x + 2, y: hq.y + 2 }); }
        DIR.tour = ((DIR.tour || 0) + 1) % Math.max(1, opts.length); DIR.cur = opts[DIR.tour] || { x: 32, y: 32 }; DIR.curS = 0; DIR.hold = 7; R3.cam.td = 21; }
    }
    if (DIR.cur) { R3.cam.tx = DIR.cur.x; R3.cam.ty = DIR.cur.y + R3.cam.td * 0.18; }
  }
}
