'use strict';
// ===== Boot, menu, loop =====
let started = false, paused = false, acc = 0, lastT = 0;
const QS = new URLSearchParams(location.search);
window.addEventListener('error', e => { if (QS.get('stk')) document.title = 'STK ' + (e.error && e.error.stack); const d = document.getElementById('err'); if (d) { d.style.display = 'block'; d.textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n'; } });
function togglePause() { if (!started || G.over) return; if (NET.online) { const pz = document.getElementById('pause'); pz.style.display = pz.style.display === 'flex' ? 'none' : 'flex'; return; } paused = !paused; document.getElementById('pause').style.display = paused ? 'flex' : 'none'; }
const MENU = { fac: 'usa', aiFac: 'rand' };
const DIFF_NAME = d => ({ si: 'Chief SI', chief: 'Chief', easy: 'Easy AI', normal: 'Medium AI', hard: 'Hard AI' })[d] || d;
const SLOT_TYPES = { off: 'Closed', human: 'Human (you)', remote: 'Human (remote)', si: 'Chief SI', chief: 'Chief', easy: 'Easy AI', normal: 'Medium AI', hard: 'Hard AI' };
const PRESETS = {
  duel:   { n: '1v1', slots: [['human', 'A'], ['normal', 'B']] },
  ffa2:   { n: '2v2', slots: [['human', 'A'], ['hard', 'A'], ['hard', 'B'], ['hard', 'B']] },
  t3v3:   { n: '3v3', slots: [['human', 'A'], ['hard', 'A'], ['hard', 'A'], ['hard', 'B'], ['hard', 'B'], ['hard', 'B']] },
  coop:   { n: 'Me + Chief SI vs 2 Medium', slots: [['human', 'A'], ['si', 'A'], ['normal', 'B'], ['normal', 'B']] },
  wsi:    { n: 'Watch: Chief SI + Chief vs 2 Hard', slots: [['si', 'A'], ['chief', 'A'], ['hard', 'B'], ['hard', 'B']] },
  w1:     { n: 'Watch: Chief vs Hard', slots: [['chief', 'A'], ['hard', 'B']] },
  w2:     { n: 'Watch: Chief (SI) vs Hard', slots: [['si', 'A'], ['hard', 'B']] },
};
function buildSlots(list, names) { // list rows: [type, team, fac, color]; names: row -> player name
  const RF = () => ['usa', 'rus', 'fra', 'ger'][(Math.random() * 4) | 0], pref = { A: [0, 2, 4, 1, 3, 5], B: [3, 1, 5, 2, 0, 4] }, taken = new Set(), startFor = team => { const s = (pref[team] || pref.A).find(k => !taken.has(k)); taken.add(s); return s; };
  return list.map((r, row) => [r, row]).filter(([r]) => r[0] !== 'off').map(([[type, team, fac, color], row]) => ({ row, ai: type !== 'human' && type !== 'remote', local: type === 'human', diff: type === 'human' || type === 'remote' ? 'normal' : type, ally: team === 'A' ? 0 : 1, fac: fac && fac !== 'rand' ? fac : RF(), color: color && color !== 'auto' ? color : undefined, start: startFor(team === 'B' ? 'B' : 'A'), name: (names && names[row]) || (type === 'human' ? 'You' : type === 'remote' ? 'Remote ' + (row + 1) : SLOT_TYPES[type]) }));
}
function startGame(diff, opts) {
  opts = opts || {};
  document.getElementById('menu').style.display = 'none';
  let slots = opts.slots;
  if (!slots) {
    if (opts.watch) slots = buildSlots([[opts.watch === 'si' ? 'si' : 'chief', 'A'], ['hard', 'B']]);
    else slots = buildSlots([[opts.demo ? 'normal' : 'human', 'A', MENU.fac], [diff, 'B', MENU.aiFac]]);
  }
  if (QS.get('fac')) slots[0].fac = QS.get('fac'); if (QS.get('aifac') && slots[1]) slots[1].fac = QS.get('aifac');
  ME = opts.me != null ? opts.me : Math.max(0, slots.findIndex(s => s.local));
  newGame({ diff, fog: opts.fog !== false, seed: opts.seed, slots, map: opts.map || QS.get('map') || 'classic', peace: opts.peace != null ? opts.peace : QS.get('peace') != null ? +QS.get('peace') : 180 });
  if (QS.get('dbg')) setTimeout(() => document.title = 'DBG map=' + G.mapName + ' np=' + G.players.length + ' t=' + (G.time | 0) + ' starts=' + G.players.map(P => P.start).join(''), 500);
  G.vis = G.visT[ME]; G.seen = G.seenT[ME];
  G.players.forEach((P, i) => P.name = slots[i].name || (P.ai ? DIFF_NAME(P.diff) : 'You'));
  if (opts.online) NET.begin(opts.online.tr, opts.online);
  if (G.players[ME].ai && !opts.demo) { DIR.auto = !!QS.get('auto'); G.spectate = true; G.watch = true; document.body.classList.add('watching'); }
  { const ff = +QS.get('ff') || 0, fft = +QS.get('fft') || ff * 30; for (let i = 0; i < fft && !G.over; i++) { stepGame(); if (G.watch) director(DT); G.events.length = 0; } }
  r3Init(document.getElementById('view'));
  uiSetup();
  const hq = G.ents.find(e => e.team === ME && (e.t === 'hq' || e.t === 'cc')) || { x: G.starts[G.players[ME].start][0], y: G.starts[G.players[ME].start][1] }; R3.cam.td = R3.cam.d = 26; jumpTo(hq.x + 3, hq.y + 2, true);
  if (G.watch && DIR.cur && DIR.auto) { R3.cam.td = R3.cam.d = 20; jumpTo(DIR.cur.x, DIR.cur.y, true); }
  if (QS.get('cx') && !QS.get('v34')) { R3.cam.td = R3.cam.d = +(QS.get('zoom') || 26); jumpTo(+QS.get('cx'), +QS.get('cy'), true); if (QS.get('nofog')) G.opts.fog = false; }
  if (opts.demo) {
    const hits = [];
    for (let i = 0; i < opts.demo * 30; i++) { stepGame(); for (const ev of G.events) if (ev.e === 'hit') hits.push({ x: ev.x, y: ev.y, t: G.time }); G.events.length = 0; if (G.over) break; }
    const recent = hits.filter(h => h.t > G.time - 4 && vis0(idx(Math.floor(h.x), Math.floor(h.y)))); let best = null, bn = -1;
    for (const h of recent) { const n = recent.filter(o => Math.hypot(o.x - h.x, o.y - h.y) < 5).length; if (n > bn) { bn = n; best = h; } }
    const u0 = G.ents.filter(e => e.kind === 'u' && e.team === ME && e.t !== 'harv');
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 22);
    if (!best) { const army = G.ents.filter(e => e.team === ME && e.kind === 'u' && e.t !== 'harv'); if (army.length) best = { x: army.reduce((a, e) => a + e.x, 0) / army.length, y: army.reduce((a, e) => a + e.y, 0) / army.length }; }
    if (best) jumpTo(best.x + (+QS.get('ox') || 0), best.y + (+QS.get('oy') || 0), true);
    setSel(u0.filter(u => best && Math.hypot(u.x - best.x, u.y - best.y) < 8));
  }
  started = true; lastT = performance.now(); requestAnimationFrame(frame);
}
const REC = QS.get('rec');
window.__rec = n => { for (let i = 0; i < n && !G.over; i++) stepGame(); director(n * DT); uiFrame(n * DT); r3Render(n * DT); if (G.over && !UI.endShown) frame(performance.now(), true); return { t: G.time, tick: G.tick, over: G.over || null }; };
function simAdvance(dt, maxN) {
  if (paused || G.over) return; acc += dt; let n = 0, stall = false; const extra = NET.online && NET.turns.size > NET.DELAY + 3 ? 4 : 0;
  while ((acc >= DT || extra && n < extra) && n++ < maxN + extra) { if (!NET.ready()) { stall = true; break; } NET.tick(); acc = Math.max(0, acc - DT); }
  if (stall) acc = Math.min(acc, DT * 6); else if (n >= maxN) acc = 0; netOverlay(stall, dt);
}
// online: keep the lockstep running when this tab is hidden (rAF stops in background tabs)
setInterval(() => { if (!started || !NET.online) return; const now = performance.now(); if (now - lastT > 250) { const dt = Math.min(2, (now - lastT) / 1000); lastT = now; simAdvance(dt, 70); if (G.events.length > 3000) G.events.splice(0, G.events.length - 1000); } }, 100);
function frame(t, once) {
  if (REC && !once) return;
  // FPS cap (Quiet mode 60/30) and no rendering while the tab is hidden
  const cap = typeof UI !== 'undefined' && UI.set && UI.set.quiet ? (+UI.set.quietFps || 60) : (UI.set && +UI.set.fpsCap) || 0;
  if (!once && (document.hidden || cap && t - (R3.lastFrame || 0) < 1000 / cap - 2)) { if (document.hidden) { const dt0 = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t; simAdvance(dt0, 6); } requestAnimationFrame(frame); return; }
  R3.lastFrame = t;
  const dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t;
  simAdvance(dt, 6);
  if (QS.get('dbg') && G.tick % 30 === 0) document.title = 'IM ' + JSON.stringify([...R3.uiMesh.entries()].map(([k, u]) => k + ':' + u.n + ':' + u.parts.body.count + ':' + u.parts.body.visible + ':' + (R3.scene.children.includes(u.parts.body)) + ':' + Array.from(u.parts.body.instanceMatrix.array.slice(12, 15)).map(v => v.toFixed(1)))) + ' view ' + JSON.stringify(R3.view) + ' cam ' + JSON.stringify(R3.cam) + ' units ' + JSON.stringify(G.ents.filter(e => e.kind === 'u' && e.team === ME).map(e => [e.t, e.x.toFixed(1), e.y.toFixed(1)]));
  if (G.watch && !paused) director(dt);
  try { uiFrame(dt); r3Render(dt); } catch (e) { console.error(e); if (QS.get('stk')) document.title = 'STK ' + e.stack; throw e; }
  if (G.over && !UI.endShown) { UI.endShown = true; const P = G.players[ME];
    document.getElementById('end').style.display = 'flex';
    document.getElementById('endTitle').textContent = G.watch ? (G.over === 'victory' ? 'BLUE TEAM WINS' : 'RED TEAM WINS') + ` · ${(G.time / 60).toFixed(1)} min` : G.over === 'victory' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('endTitle').className = G.over;
    document.getElementById('endStats').innerHTML = endStatsHTML(); drawEndGraph(); sfx(G.over === 'victory' ? 'ready' : 'alert'); }
  if (!once) requestAnimationFrame(frame);
}
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') { document.getElementById('err').style.display = 'block'; document.getElementById('err').textContent = 'Three.js failed to load (vendor/three.min.js)'; return; }
  let diff = 'normal';
  document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { diff = b.dataset.d; document.querySelectorAll('#diff button').forEach(x => x.classList.toggle('on', x === b)); });
  if (QS.get('preset')) { try { startGame('normal', { slots: buildSlots(PRESETS[QS.get('preset')].slots), seed: +QS.get('seed') || 5 }); } catch (er) { document.title = 'STK ' + er.stack; throw er; } }
  else if (QS.get('slots')) startGame('normal', { slots: buildSlots(QS.get('slots').split(',').map(r => r.split(':'))), seed: +QS.get('seed') || 5 }); // e.g. ?slots=si:A:usa:yellow,hard:B
  else if (QS.get('watch')) startGame(QS.get('watch') === 'si' ? 'hard' : QS.get('watch'), { watch: QS.get('watch') === 'si' ? 'si' : 1, seed: +QS.get('seed') || 5 });
  { const box = document.getElementById('facs'), desc = document.getElementById('facDesc');
    const sel = f => { MENU.fac = f; if (ONL.room && !ONL.host && ONL.acts.pref) ONL.acts.pref({ fac: f }); const lf = document.querySelector('#lobby .lf'); if (lf) lf.value = f; box.querySelectorAll('.fcard').forEach(c => c.classList.toggle('on', c.dataset.f === f)); const F = FACTIONS[f]; desc.innerHTML = `<b>${F.flag} ${F.n}</b> — special: ${F.desc}`; };
    for (const f in FACTIONS) { const c = document.createElement('div'); c.className = 'fcard'; c.dataset.f = f; c.innerHTML = `<div class="fl">${FACTIONS[f].flag}</div>${FACTIONS[f].n}`; c.onclick = () => sel(f); box.appendChild(c); }
    sel('usa'); }
  lobbyInit(); if (QS.get('lobbytest')) setTimeout(lobbySelfTest, 0);
  document.getElementById('startBtn').onclick = () => { audioInit(); if (ONL.room && ONL.host) { onlStartHost(); return; } const rows = lobbyRead(); if (rows.some(r => r[0] === 'remote')) { uiMsgMenu('Remote slots need an online game: press “Host online game”.'); return; } startGame('normal', Object.assign({ slots: buildSlots(rows), fog: document.getElementById('fogChk').checked }, lobbyOpts())); };
  onlInitUI();
  document.getElementById('surrBtn').onclick = () => { if (!started || G.over) return; if (confirm('Surrender this match?')) { NET.issue({ c: 'surrender' }); document.getElementById('pause').style.display = 'none'; paused = false; } };
  document.getElementById('resumeBtn').onclick = () => togglePause();
  document.querySelectorAll('.quitBtn').forEach(b => b.onclick = () => location.href = location.pathname);
  if (QS.get('v34')) { startGame('easy', { seed: 4242 }); G.opts.fog = false; G.spectate = true; G.players[0].fac = 'fra'; G.players[1].fac = 'rus'; G.players[1].ai = false;
    for (const [t, x, y] of [['power', 4, 12], ['barracks', 11, 3], ['refinery', 11, 12], ['factory', 15, 6], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10;
    const v = G.vents[0]; addB('extractor', 0, v[0], v[1], true).born = -10; addB('gcannon', 0, 16, 14, true).born = -10; const tu = addB('turret', 0, 19, 12, true); tu.born = -10; tu.lvl = 3;
    const mk = (t, tm, x, y) => addU(t, tm, x, y);
    const a0 = [], a1 = []; ['titan', 'kommando', 'rifle', 'sniper', 'pyro', 'medic', 'rocketeer', 'rifle', 'heavy', 'rifle'].forEach((t, i) => a0.push(mk(t, 0, 19 + (i % 4) * 0.9, 19 + (i / 4 | 0) * 0.9)));
    ['tsar', 'rifle', 'rifle', 'rocketeer', 'pyro', 'kommando', 'light', 'rifle', 'sniper'].forEach((t, i) => a1.push(mk(t, 1, 26 + (i % 3) * 0.9, 25 + (i / 3 | 0) * 0.9)));
    for (let i = 0; i < 30; i++) stepGame(); orderMove(a0, 24, 23, true); orderMove(a1, 21, 21, true);
    for (let i = 0; i < 30 * (+QS.get('v34') || 5); i++) stepGame(); G.events.length = 0;
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 16); jumpTo(+(QS.get('cx') || 22), +(QS.get('cy') || 21), true); paused = !!QS.get('freeze');
  } else
  if (QS.get('showcase')) { startGame('easy', { seed: 4242 }); const P = G.players[0]; P.cr = 99999;
    for (const [t, x, y] of [['power', 4, 12], ['power', 1, 9], ['power', 4, 2], ['barracks', 11, 3], ['refinery', 11, 12], ['factory', 15, 6], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10;
    const t1 = addB('turret', 0, 16, 14, true), t2 = addB('turret', 0, 19, 11, true), t3 = addB('aagun', 0, 18, 15, true); t1.lvl = 3; t2.lvl = 2; [t1, t2, t3].forEach(b => b.born = -10);
    const army = []; ['heavy', 'heavy', 'light', 'light', 'rifle', 'rifle', 'rocketeer', 'rocketeer', 'rifle', 'arty', 'aa', 'arty'].forEach((t, i) => army.push(addU(t, 0, 14 + (i % 4), 18 + (i / 4 | 0))));
    for (let i = 0; i < 30; i++) stepGame(); orderFormation(army, 20, 20, Math.PI / 4); for (let i = 0; i < 30 * 12; i++) stepGame();
    G.events.length = 0; setSel([t1]); R3.cam.td = R3.cam.d = 19; jumpTo(17, 15.5, true); paused = false;
  } else
  if (QS.get('warhead')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false; // v5.2 screenshot/test scene: heavy warhead mid-flight + cluster about to land on a defence cluster
    for (const [t, x, y] of [['power', 4, 12], ['power', 1, 9], ['power', 4, 2], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10; const s = addB('silo', 0, 16, 16, true); s.born = -10; const s2 = addB('silo', 0, 12, 20, true); s2.born = -10;
    for (const [t, x, y] of [['turret', 30, 30], ['turret', 33, 29], ['aagun', 31, 33], ['tesla', 34, 32], ['power', 36, 35], ['power', 33, 36]]) addB(t, 1, x, y, true).born = -10;
    for (let i = 0; i < 30; i++) stepGame(); s.mis = 'heavy'; siloLaunch(s, 34, 33); s2.mis = 'cluster'; siloLaunch(s2, 31, 31);
    for (let i = 0; i < 30 * (+QS.get('warhead') || 5); i++) stepGame();
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 30); jumpTo(+(QS.get('cx') || 25), +(QS.get('cy') || 25), true); paused = !!QS.get('freeze');
  } else
  if (QS.get('battle')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false; const types = ['heavy', 'rifle', 'rocketeer', 'light', 'titan', 'arty', 'gunship', 'heavy', 'pyro', 'aa'];
    const A = [], B = []; for (let i = 0; i < 60; i++) { const tm = i % 2, t = types[(i >> 1) % types.length], p = nearFree(40 + (tm ? 7 : -7) + (i >> 1) % 4, 40 + ((i >> 3) % 8), 6); (tm ? B : A).push(addU(t, tm, p[0] + 0.5, p[1] + 0.5)); }
    orderMove(A, 48, 44, true); orderMove(B, 32, 44, true); for (let i = 0; i < 30 * (+QS.get('battle') || 4); i++) stepGame();
    R3.cam.td = R3.cam.d = 20; jumpTo(40, 40, true); paused = false;
  } else
  if (QS.get('titan')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false;
    const ts = [addU('titan', 0, 20, 30), addU('titan', 0, 22, 33), addU('rifle', 0, 21, 28), addU('rifle', 0, 23, 29)]; addB('turret', 1, 34, 24, true).born = -10;
    for (let i = 0; i < 30; i++) stepGame(); orderMove(ts, 31, 33, false); for (let i = 0; i < 30 * (+QS.get('titan') || 2.5); i++) stepGame();
    R3.cam.td = R3.cam.d = 15; jumpTo(ts[0].x + 1, ts[0].y, true); setSel(ts.slice(0, 2)); paused = false;
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
    r3Render(0.016); const hq = G.ents.find(e => e.team === ME && e.t === 'hq'), p = worldToScreen(hq.x + 3, hq.y + 4, 0);
    ev('mousedown', p.x - 150, p.y - 150, 0); ev('mousemove', p.x + 150, p.y + 150, 0); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    const s = worldToScreen(hq.x + 8, hq.y + 8, 0); ev('mousedown', s.x, s.y, 2); ev('mousedown', s.x + 40, s.y, 2, { shiftKey: true }); setSel([hq]); clickItem('harv', false, false); r3Render(0.016); uiFrame(0.2);
    for (const k in CATS) { UI.tab = k; buildGrid(); }
    clickItem('power', false); for (let i = 0; i < 400; i++) stepGame();
    clickItem('power', false); const pp = worldToScreen(hq.x + 4, hq.y - 1, 0); ev('mousemove', pp.x, pp.y, 0); uiFrame(0.016); ev('mousedown', pp.x, pp.y, 0);
    clickItem('barracks', false); clickItem('rifle', false); clickItem('rifle', true);
    ['a', 's', 'h', 'q', 'n', 'n', '1'].forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))); window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    UI.mode = 'repair'; ev('mousedown', worldToScreen(hq.x, hq.y, 1).x, worldToScreen(hq.x, hq.y, 1).y, 0);
    const mm = document.getElementById('minimap'), r = mm.getBoundingClientRect(); mm.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 100, clientY: r.top + 100, button: 0, bubbles: true }));
    for (let i = 0; i < 300; i++) stepGame();
    togglePause(); togglePause();
    for (const q of ['low', 'med', 'ultra', 'high']) { applyQuality(q); r3Render(0.016); }
    G.players[0].cr = 99999; addB('barracks', 0, 14, 4, true); addB('factory', 0, 14, 10, true); stepGame();
    const bar = G.ents.find(e => e.t === 'barracks' && e.team === ME); setSel([bar]); const tabOk = UI.tab === 'inf';
    clickItem('rifle', false, true); const q5 = G.players[0].queues.inf.length; clickItem('rifle', true, false); const q4 = G.players[0].queues.inf.length;
    showTip('heavy', document.querySelector('.item')); sidebar(); setSel([G.ents.find(e => e.t === 'hq' && e.team === ME)]); sidebar();
    const ctxBtns = document.querySelectorAll('#ctx .item').length;
    const tur2 = addB('turret', 0, 12, 13, true); tur2.born = -10; const lv0 = defW(tur2).rng; const okU = upgradeB(tur2); for (let i = 0; i < 30 * 16; i++) stepGame(); const lv = tur2.lvl;
    const army = []; for (let i = 0; i < 8; i++) army.push(addU(['heavy', 'rifle', 'arty', 'rocketeer'][i % 4], 0, 16 + i % 3, 16 + (i / 3 | 0)));
    setSel(army); sidebar(); doFormation(false); const fmOk = army.every(u => u.stance === 'hold'); toggleStance(); const agg = army.every(u => u.stance === 'aggr');
    extra += ` upg=${okU}:${lv}:${lv0}->${defW(tur2).rng} formation=${fmOk} stance=${agg}`;
    for (let i = 0; i < 300; i++) stepGame();
    for (let i = 0; i < 20; i++) { uiFrame(0.05); r3Render(0.05); }
    extra += ` tab=${tabOk} q5=${q5} q4=${q4} hqBtns=${ctxBtns} units=${G.ents.filter(e => e.team === ME && e.kind === 'u').length}`;
    document.title = extra + ' SELFTEST OK sel=' + UI.sel.length + ' powerPlants=' + G.ents.filter(e => e.team === ME && e.t === 'power').length;
  } catch (e) { document.title = 'SELFTEST FAIL ' + e.message; throw e; }
}
if (QS.get('selftest')) window.addEventListener('load', () => setTimeout(selfTest, 300));

// ===== spectator camera director: follows fights, cycles key moments =====
const DIR = { auto: false, t: 0, hot: [], cur: null, hold: 0 };
function director(dt) {
  for (const ev of G.events) if (ev.e === 'hit' || ev.e === 'die') DIR.hot.push({ x: ev.x != null ? ev.x : ev.ent.x, y: ev.y != null ? ev.y : ev.ent.y, t: G.time, w: ev.e === 'die' ? (ev.ent.kind === 'b' ? 8 : 3) : 1 });
  DIR.hot = DIR.hot.filter(h => G.time - h.t < 5);
  const wt = document.getElementById('watchTag'); if (wt && G.time - (DIR.tagT || -9) > 0.5) { DIR.tagT = G.time; const av = t => Math.round(G.ents.filter(e => e.team === t && e.kind === 'u' && e.t !== 'harv').reduce((a, e) => a + UT[e.t].cost, 0) / 100) / 10; const side = al => G.players.filter(P => P.ally === al).map(P => `${P.name} ${FACTIONS[P.fac].flag} ${P.out ? '✖' : av(P.team) + 'k'}`).join(' + '); wt.textContent = `${side(0)}  ·  ${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}  ·  ${side(1)}  ·  [C] auto-cam ${DIR.auto ? 'ON' : 'OFF'}`; }
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
    if (DIR.cur && DIR.auto) { R3.cam.tx = DIR.cur.x; R3.cam.ty = DIR.cur.y + R3.cam.td * 0.18; }
  }
}

// ===== lobby =====
function lobbyInit() {
  const box = document.getElementById('lobby'); if (!box) return;
  const facOpt = '<option value="rand">Random</option>' + Object.keys(FACTIONS).map(f => `<option value="${f}">${FACTIONS[f].flag} ${FACTIONS[f].n}</option>`).join('');
  box.innerHTML = '<div class="lrow lh"><span>Slot</span><span>Player</span><span>Team</span><span>Faction</span><span>Colour</span></div>' + [0, 1, 2, 3, 4, 5].map(i => `<div class="lrow"><span>${i + 1}</span>
    <select class="lt">${Object.keys(SLOT_TYPES).filter(k => i === 0 ? k !== 'remote' : k !== 'human').map(k => `<option value="${k}">${SLOT_TYPES[k]}</option>`).join('')}</select>
    <select class="la"><option value="A">Team A</option><option value="B">Team B</option></select><select class="lf">${facOpt}</select><select class="lc"><option value="auto">Auto</option>${Object.keys(TEAM_COLORS).map(c => `<option value="${c}">${TEAM_COLORS[c].n}</option>`).join('')}</select></div>`).join('');
  box.querySelectorAll('.lc').forEach(sel => sel.onchange = () => { if (sel.value === 'auto') return; box.querySelectorAll('.lc').forEach(o => { if (o !== sel && o.value === sel.value) o.value = 'auto'; }); if (typeof lobbyChanged === 'function') lobbyChanged(); });
  box.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => { if (typeof lobbyChanged === 'function') lobbyChanged(); }));
  const pb = document.getElementById('presets'); pb.innerHTML = Object.keys(PRESETS).filter(k => k[0] !== 'w').map(k => `<button data-p="${k}">${k[0] === 'w' ? '▶ ' : ''}${PRESETS[k].n}</button>`).join('');
  pb.querySelectorAll('button').forEach(b => b.onclick = () => { lobbySet(PRESETS[b.dataset.p].slots); if (b.dataset.p[0] === 'w') { audioInit(); startGame('normal', { slots: buildSlots(lobbyRead()), seed: (Math.random() * 1e6) | 0 }); } });
  lobbySet(PRESETS.duel.slots);
  box.querySelector('.lf').onchange = e => { if (e.target.value !== 'rand') MENU.fac = e.target.value; };
}
function lobbySet(list) { const rows = document.querySelectorAll('#lobby .lrow:not(.lh)'); rows.forEach((r, i) => { const s = list[i] || ['off', i % 2 ? 'B' : 'A']; r.querySelector('.lt').value = s[0]; r.querySelector('.la').value = s[1]; r.querySelector('.lf').value = s[2] || (i === 0 && s[0] === 'human' ? MENU.fac : 'rand'); r.querySelector('.lc').value = s[3] || 'auto'; }); }
function lobbyOpts() { const m = document.getElementById('mapSel'), p = document.getElementById('peaceSel'); return { map: m ? m.value : 'classic', peace: p ? +p.value : 180 }; }
function lobbyRead() { return [...document.querySelectorAll('#lobby .lrow:not(.lh)')].map(r => [r.querySelector('.lt').value, r.querySelector('.la').value, r.querySelector('.lf').value, r.querySelector('.lc').value]); }


// Lobby regression: index.html?lobbytest=1 drives the real lobby DOM (presets + faction/colour/team changes with change events), builds slots, starts the sim and checks starts/HQs/teams/ME.
function lobbySelfTest() {
  const errs = [], box = document.getElementById('lobby'), rows = () => [...box.querySelectorAll('.lrow:not(.lh)')];
  const setSel = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const facs = ['rand', 'usa', 'rus', 'fra', 'ger'], cols = ['auto', ...Object.keys(TEAM_COLORS)], R = mkRng(99); let n = 0;
  const check = (label) => {
    const list = lobbyRead(), slots = buildSlots(list), me = Math.max(0, slots.findIndex(s => s.local));
    if (slots.length < 2) return; newGame({ seed: 7, slots }); n++;
    const starts = G.players.map(P => P.start);
    if (new Set(starts).size !== starts.length) errs.push(label + ' dup starts ' + starts);
    G.players.forEach((P, t) => { const hq = G.ents.filter(e => e.team === t && e.t === 'hq'); if (hq.length !== 1) errs.push(label + ' p' + t + ' hq=' + hq.length);
      if (G.ents.filter(e => e.team === t && e.kind === 'u').length < 5) errs.push(label + ' p' + t + ' units');
      const h = hq[0], st = G.starts[P.start]; if (h && Math.hypot(h.x - st[0], h.y - st[1]) > 2) errs.push(label + ' p' + t + ' hq off start'); });
    slots.forEach((sl, t) => { const row = list.filter(r => r[0] !== 'off')[t]; if ((row[1] === 'A' ? 0 : 1) !== G.players[t].ally) errs.push(label + ' team mismatch p' + t);
      if (row[2] !== 'rand' && G.players[t].fac !== row[2]) errs.push(label + ' fac mismatch p' + t); if (row[3] !== 'auto' && G.players[t].color !== row[3]) errs.push(label + ' color mismatch p' + t); });
    if (new Set(G.players.map(P => P.color)).size !== G.players.length) errs.push(label + ' dup colours');
    if (list[0][0] === 'human' && !(G.players[me] && !G.players[me].ai && slots[me].row === 0)) errs.push(label + ' ME wrong');
  };
  for (const pk of Object.keys(PRESETS)) {
    lobbySet(PRESETS[pk].slots); check(pk);
    for (let k = 0; k < 40; k++) { const rs = rows(), r = rs[(R() * rs.length) | 0], what = (R() * 3) | 0;
      if (what === 0) setSel(r.querySelector('.lf'), facs[(R() * facs.length) | 0]); else if (what === 1) setSel(r.querySelector('.lc'), cols[(R() * cols.length) | 0]); else setSel(r.querySelector('.la'), R() < 0.5 ? 'A' : 'B');
      check(pk + '#' + k + ' ' + JSON.stringify(lobbyRead())); }
  }
  // all team splits for 4 active slots incl. 3v1 / 4v0
  for (let m = 0; m < 16; m++) { lobbySet([['human', m & 1 ? 'B' : 'A', 'fra', 'green'], ['si', m & 2 ? 'B' : 'A', 'rus'], ['normal', m & 4 ? 'B' : 'A', 'rand', 'blue'], ['hard', m & 8 ? 'B' : 'A']]); check('split' + m); }
  document.title = (errs.length ? 'LOBBYTEST FAIL ' + errs.length + ' ' + errs.slice(0, 3).join(' | ') : 'LOBBYTEST OK') + ' games=' + n;
}

// ===== end-game stats + army graph =====
function endStatsHTML() {
  const rows = G.players.map(P => `<tr style="color:${MMCOL[P.team]}"><td>${FACTIONS[P.fac].flag} ${P.name}</td><td>${P.ally ? 'B' : 'A'}</td><td>${P.stats.kills}</td><td>${P.stats.lost}</td><td>$${Math.floor(P.stats.mined)}</td><td>${P.stats.built || 0}</td><td>${P.out ? 'eliminated' : 'alive'}</td></tr>`).join('');
  return `Time ${Math.floor(G.time / 60)}:${String(Math.floor(G.time % 60)).padStart(2, '0')}<table class="est"><tr><th>Player</th><th>Team</th><th>Kills</th><th>Lost</th><th>Mined</th><th>Built</th><th></th></tr>${rows}</table><canvas id="endGraph" width="520" height="150"></canvas><div style="font-size:11px;color:#9ab">Army value over time</div>`;
}
function drawEndGraph() {
  const c = document.getElementById('endGraph'); if (!c || G.hist.length < 2) return; const x = c.getContext('2d'), H = G.hist, mx = Math.max(1, ...H.flatMap(h => h.p.map(p => p.army)));
  x.strokeStyle = 'rgba(255,255,255,.12)'; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * 37.5); x.lineTo(520, i * 37.5); x.stroke(); }
  G.players.forEach((P, k) => { x.strokeStyle = MMCOL[k]; x.lineWidth = 2; x.beginPath(); H.forEach((h, i) => { const px = i / (H.length - 1) * 510 + 5, py = 145 - h.p[k].army / mx * 135; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); });
}

// ===== online: stall / status overlay =====
function netOverlay(stall, dt) {
  const el = document.getElementById('netWait'); if (!el) return;
  NET.waitT = stall ? NET.waitT + dt : 0;
  let txt = '';
  if (NET.desync) txt = `⚠ Desync detected at tick ${NET.desync.t} (player ${NET.desync.team + 1}). The game state differs between players — please restart the match.`;
  else if (NET.online && NET.waitT > 0.4) txt = NET.host && NET.waiting ? 'Waiting for ' + NET.waiting.map(t => G.players[t].name).join(', ') + '…' : 'Waiting for host…';
  if (NET.status) { uiMsg(NET.status); announce(NET.status, 'net' + NET.status, 5); NET.status = ''; }
  el.textContent = txt; el.style.display = txt ? 'block' : 'none';
}

function uiMsgMenu(t) { const e = document.getElementById('onStatus'); if (e) e.textContent = t; }
