'use strict';
// ===== Boot, menu, loop =====
let started = false, paused = false, acc = 0, lastT = 0;
const QS = new URLSearchParams(location.search);
window.addEventListener('error', e => { if (QS.get('stk')) document.title = 'STK ' + (e.error && e.error.stack); const d = document.getElementById('err'); if (d) { d.style.display = 'block'; d.textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n'; } });
function togglePause() { if (!started || G.over) return; if (NET.online) { const pz = document.getElementById('pause'); pz.style.display = pz.style.display === 'flex' ? 'none' : 'flex'; return; } paused = !paused; document.getElementById('pause').style.display = paused ? 'flex' : 'none'; }
const MENU = { fac: 'usa', aiFac: 'rand' };
// v7.3: three player-facing difficulties. Easy = 'easy', Medium = 'normal', Hard = the 'si' profile (the internal Chief SI benchmark bot).
// Old options (lobby rows, presets, URLs, Endless/online backfill) map to the nearest: hard/chief/si -> Hard. Replays keep their recorded profiles.
const DIFF_MAP = { easy: 'easy', normal: 'normal', medium: 'normal', hard: 'si', chief: 'si', si: 'si' };
const normDiff = d => DIFF_MAP[d] || d;
const liveDiff = d => d === 'si' ? 'si2' : d; // v7.6: the lobby's 'Hard AI' plays the reworked brain; replays keep their recorded diff
const DIFF_NAME = d => ({ si: 'Hard AI', si2: 'Hard AI', chief: 'Hard AI', easy: 'Easy AI', normal: 'Medium AI', hard: 'Hard AI' })[d] || d;
const SLOT_TYPES = { off: 'Closed', human: 'You', remote: 'Human (remote)', easy: 'Easy AI', normal: 'Medium AI', si: 'Hard AI' };
// v7.5.1: presets alternate A/B so each row sits on its team's side (lobby row N = map spot N; odd spots west, even spots east)
const PRESETS = {
  duel:   { n: '1v1', slots: [['human', 'A'], ['normal', 'B']] },
  ffa2:   { n: '2v2', slots: [['human', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B']] },
  t4v4:   { n: '4v4 (Volcano XL)', map: 'volcano8', slots: [['human', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B']] },
  hellgate: { n: '2v6 Hindu Kush Hellgate', map: 'hellgate', slots: [['human', 'A'], ['si', 'A'], ['si', 'B'], ['si', 'B'], ['si', 'B'], ['si', 'B'], ['si', 'B'], ['si', 'B']] },
  t3v3:   { n: '3v3', slots: [['human', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B']] },
  coop:   { n: 'Me + Hard AI vs 2 Medium', slots: [['human', 'A'], ['normal', 'B'], ['si', 'A'], ['normal', 'B']] },
  wsi:    { n: 'Watch: 2 Hard vs 2 Hard', slots: [['si', 'A'], ['si', 'B'], ['si', 'A'], ['si', 'B']] },
  w1:     { n: 'Watch: Medium vs Hard', slots: [['normal', 'A'], ['si', 'B']] },
  w2:     { n: 'Watch: Hard vs Hard', slots: [['si', 'A'], ['si', 'B']] },
};
function buildSlots(list, names, map) { // list rows: [type, team, fac, color]; names: row -> player name; map: lobby map (seats: row N -> spot N, see seatPlan in sim.js)
  const RF = () => FAC_KEYS[(Math.random() * FAC_KEYS.length) | 0], act = list.map((r, row) => [r, row]).filter(([r]) => r[0] !== 'off');
  const st = seatPlan(map || 'classic', act.map(([r, row]) => ({ row, ally: r[1] === 'A' ? 0 : 1 })));
  return act.map(([[type, team, fac, color], row], i) => ({ row, ai: type !== 'human' && type !== 'remote', local: type === 'human', diff: type === 'human' || type === 'remote' ? 'normal' : liveDiff(normDiff(type)), ally: team === 'A' ? 0 : 1, fac: fac && fac !== 'rand' ? fac : RF(), color: color && color !== 'auto' ? color : undefined, start: st[i], seat: 1, smap: map || 'classic', name: (names && names[row]) || (type === 'human' ? 'You' : type === 'remote' ? 'Remote ' + (row + 1) : SLOT_TYPES[type]) }));
}
function seatFix(slots, map) { if (slots.length && slots.every(s => s.seat && s.row != null && !s.horde) && slots.some(s => s.smap !== map)) { const st = seatPlan(map, slots.map(s => ({ row: s.row, ally: s.ally }))); slots.forEach((s, i) => { s.start = st[i]; s.smap = map; }); } return slots; }
function startGame(diff, opts) {
  opts = opts || {};
  try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch (e) {} // v5.7.2: no focus left in the lobby form
  document.getElementById('menu').style.display = 'none';
  let slots = opts.slots; const map0 = (opts.mode || QS.get('mode')) === 'endless' ? 'endless' : opts.map || QS.get('map') || 'classic';
  if (!slots) {
    if (opts.watch) slots = buildSlots([[opts.watch === 'si' ? 'si' : 'chief', 'A'], ['hard', 'B']], null, map0);
    else slots = buildSlots([[opts.demo ? 'normal' : 'human', 'A', MENU.fac], [diff, 'B', MENU.aiFac]], null, map0);
  }
  // v7.5.1: seats follow the map the game actually starts on (buildSlots may have been called without it); deterministic, so online peers agree
  seatFix(slots, map0);
  if (QS.get('fac')) slots[0].fac = QS.get('fac'); if (QS.get('aifac') && slots[1]) slots[1].fac = QS.get('aifac');
  ME = opts.me != null ? opts.me : Math.max(0, slots.findIndex(s => s.local));
  newGame({ diff, fog: opts.fog !== false, seed: opts.seed != null ? opts.seed : opts.replay ? undefined : ((Math.random() * 1e9) | 0) || 1, r76: opts.r76 != null ? opts.r76 : 1, slots, mode: opts.mode || QS.get('mode') || undefined, map: opts.map || QS.get('map') || 'classic', peace: opts.peace != null ? opts.peace : QS.get('peace') != null ? +QS.get('peace') : 180 });
  if (QS.get('dbg')) setTimeout(() => document.title = 'DBG map=' + G.mapName + ' np=' + G.players.length + ' t=' + (G.time | 0) + ' starts=' + G.players.map(P => P.start).join(''), 500);
  G.vis = G.visT[ME]; G.seen = G.seenT[ME];
  G.players.forEach((P, i) => P.name = (G.opts.slots[i] || {}).name || (P.ai ? DIFF_NAME(P.diff) : 'You'));
  if (opts.replay) { G.replay = { cmds: opts.replay.cmds || [], hash: opts.replay.hash || [], i: 0, checked: 0, bad: 0 }; G.spectate = true; G.watch = true; G.opts.fog = false; document.body.classList.add('watching'); RPL.on = false; RPL.data = null; G.players.forEach((P, i) => P.name = (opts.replay.slots[i] || {}).name || P.name); }
  else { recStart(); keepLastReplay(); }
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
  if (paused || G.over) return; acc += dt * NET.pace(); let n = 0, stall = false; const extra = 0;
  while ((acc >= DT || extra && n < extra) && n++ < maxN + extra) { if (!NET.ready()) { stall = true; break; } NET.tick(); acc = Math.max(0, acc - DT); }
  if (stall) acc = Math.min(acc, DT * 6); else if (n >= maxN) acc = 0; netOverlay(stall, dt);
}
// online: keep the lockstep running when this tab is hidden (rAF stops in background tabs)
setInterval(() => { if (!started || !NET.online) return; const now = performance.now(); if (now - lastT > 250) { const dt = Math.min(2, (now - lastT) / 1000); lastT = now; simAdvance(dt, 70); if (G.events.length > 3000) G.events.splice(0, G.events.length - 1000); } }, 100);
function frame(t, once) { // v7.0.3: the next frame is always scheduled, even if this one throws
  if (REC && !once) return;
  try { frameBody(t, once); } catch (e) { safeErr('frame', e); }
  if (!once) requestAnimationFrame(frame);
}
function frameBody(t, once) {
  // FPS cap (Quiet mode 60/30) and no rendering while the tab is hidden
  const cap = typeof UI !== 'undefined' && UI.set && UI.set.quiet ? (+UI.set.quietFps || 60) : (UI.set && +UI.set.fpsCap) || 0;
  if (!once && (document.hidden || cap && t - (R3.lastFrame || 0) < 1000 / cap - 2)) { if (document.hidden) { const dt0 = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t; simAdvance(dt0, 6); } return; }
  R3.lastFrame = t;
  const dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t;
  try { simAdvance(dt, 6); } catch (e) { safeErr('sim', e); acc = 0; }
  if (QS.get('dbg') && G.tick % 30 === 0) document.title = 'IM ' + JSON.stringify([...R3.uiMesh.entries()].map(([k, u]) => k + ':' + u.n + ':' + u.parts.body.count + ':' + u.parts.body.visible + ':' + (R3.scene.children.includes(u.parts.body)) + ':' + Array.from(u.parts.body.instanceMatrix.array.slice(12, 15)).map(v => v.toFixed(1)))) + ' view ' + JSON.stringify(R3.view) + ' cam ' + JSON.stringify(R3.cam) + ' units ' + JSON.stringify(G.ents.filter(e => e.kind === 'u' && e.team === ME).map(e => [e.t, e.x.toFixed(1), e.y.toFixed(1)]));
  if (G.watch && !paused) try { director(dt); } catch (e) { safeErr('director', e); }
  try { uiFrame(dt); r3Render(dt); } catch (e) { safeErr('render', e); if (QS.get('stk')) document.title = 'STK ' + e.stack; } // v7.0.3: never rethrow — a throw here used to skip requestAnimationFrame and freeze the game for good
  if (G.over && !UI.endShown) { UI.endShown = true; const P = G.players[ME];
    document.getElementById('end').style.display = 'flex';
    document.getElementById('endTitle').textContent = G.end && !G.watch ? `GAME OVER — WAVE ${G.end.wave}` : G.watch ? (G.over === 'victory' ? 'BLUE TEAM WINS' : 'RED TEAM WINS') + ` · ${(G.time / 60).toFixed(1)} min` : G.over === 'victory' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('endTitle').className = G.over + (G.end && !G.watch ? ' endl' : '');
    try { const rs = replayFile(); if (rs) localStorage.setItem('ifLastReplay', rs); } catch (e) {}
    endlessEndScreen();
    document.getElementById('endStats').innerHTML = endStatsHTML(); drawEndGraph(); sfx(G.over === 'victory' ? 'ready' : 'alert'); }
}
// v7.0.3 error recovery: a thrown frame must never stop the game loop. Errors are logged (first few with stacks) and counted;
// a sim error that repeats every tick triggers a sanitize pass that drops broken entities/projectiles so the game can carry on.
const ERR = { n: 0, sim: 0, last: '', shown: false };
function safeErr(where, e) {
  ERR.n++; const msg = where + ': ' + (e && e.message || e); if (ERR.n <= 5 || msg !== ERR.last) console.error('[v7.0.3 recovered]', msg, e && e.stack); ERR.last = msg;
  if (where === 'sim' && ++ERR.sim % 10 === 0) simSanitize();
  if (!ERR.shown && ERR.n >= 3 && typeof uiMsg === 'function') { ERR.shown = true; try { uiMsg('Recovered from a game error — play continues'); } catch (e2) {} }
}
function simSanitize() {
  const fin = v => typeof v === 'number' && isFinite(v);
  G.ents = G.ents.filter(e => e && (e.kind === 'b' ? BT[e.t] : UT[e.t]) && fin(e.x) && fin(e.y) && fin(e.hp));
  for (const e of G.ents) { if (e.tgt && (!G.ents.includes(e.tgt) || e.tgt.dead)) e.tgt = null; if (e.path && !Array.isArray(e.path)) e.path = []; }
  G.projs = (G.projs || []).filter(p => p && p.w && fin(p.x) && fin(p.y) && fin(p.tx) && fin(p.ty));
  if (G.events.length > 3000) G.events.length = 0;
}
// v5.2 replays: save (download a small .json) / load (file picker on the menu)
// v7.6: exactly one 'last game' replay is kept on this device: replaced the moment a new game starts, refreshed every 30 s, at the end, on quit / Play again and when the page closes
function keepLastReplay() { try { if (typeof RPL !== 'undefined' && RPL.on && RPL.data) { const s = replayFile(); if (s) localStorage.setItem('ifLastReplay', s); } } catch (e) {} }
function dlReplay(s, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
addEventListener('pagehide', keepLastReplay); addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keepLastReplay(); });
function saveReplay() { const s = replayFile(); if (!s) { uiMsg && uiMsg('No replay recorded for this game'); return; } try { localStorage.setItem('ifLastReplay', s); } catch (e) {}
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'application/json' })); a.download = 'ironfront-replay-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function loadReplay(d) { if (!d || d.game !== 'ironfront' || !d.slots) { alert('Not an Iron Front replay file'); return; } audioInit && audioInit();
  startGame(d.diff || 'normal', { replay: d, r76: d.r76 ? 1 : 0, seed: d.seed, map: d.map, peace: d.peace, fog: d.fog, me: d.me || 0, slots: d.slots.map((s, i) => Object.assign({}, s, { local: i === (d.me || 0) && !s.ai })) }); }
window.addEventListener('DOMContentLoaded', () => {
  { const rb = document.getElementById('replayBtn'), rf = document.getElementById('replayFile'); if (rb && rf) { rb.onclick = () => rf.click(); rf.onchange = () => { const f = rf.files[0]; if (!f) return; f.text().then(t => loadReplay(JSON.parse(t))).catch(e => alert('Could not read replay: ' + e.message)); }; }
    const lb = document.getElementById('lastReplayBtn'); if (lb) { let has = false; try { has = !!localStorage.getItem('ifLastReplay'); } catch (e) {} lb.style.display = has ? '' : 'none'; const ld = document.getElementById('lastReplayDl'); if (ld) { ld.style.display = has ? '' : 'none'; ld.onclick = () => { const s = localStorage.getItem('ifLastReplay'); if (!s) return alert('No saved replay'); let d = ''; try { d = (JSON.parse(s).date || '').slice(0, 16).replace(/[:T]/g, '-'); } catch (e) {} dlReplay(s, 'ironfront-replay-' + (d || 'last') + '.json'); }; } lb.onclick = () => { try { loadReplay(JSON.parse(localStorage.getItem('ifLastReplay'))); } catch (e) { alert('No saved replay'); } }; }
    const sb = document.getElementById('saveRepBtn'); if (sb) sb.onclick = saveReplay; }
  if (typeof THREE === 'undefined') { document.getElementById('err').style.display = 'block'; document.getElementById('err').textContent = 'Three.js failed to load (vendor/three.min.js)'; return; }
  let diff = 'normal';
  document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { diff = b.dataset.d; document.querySelectorAll('#diff button').forEach(x => x.classList.toggle('on', x === b)); });
  if (QS.get('preset')) { try { startGame('normal', { slots: buildSlots(PRESETS[QS.get('preset')].slots, null, PRESETS[QS.get('preset')].map || QS.get('map') || 'classic'), map: PRESETS[QS.get('preset')].map || undefined, seed: +QS.get('seed') || 5 }); } catch (er) { document.title = 'STK ' + er.stack; throw er; } }
  else if (QS.get('slots')) startGame('normal', { slots: buildSlots(QS.get('slots').split(',').map(r => r.split(':')), null, QS.get('map') || 'classic'), seed: +QS.get('seed') || 5 }); // e.g. ?slots=si:A:usa:yellow,hard:B
  else if (QS.get('watch')) startGame(QS.get('watch') === 'si' ? 'hard' : QS.get('watch'), { watch: QS.get('watch') === 'si' ? 'si' : 1, seed: +QS.get('seed') || 5 });
  { const box = document.getElementById('facs'), desc = document.getElementById('facDesc');
    const sel = f => { MENU.fac = f; if (ONL.room && !ONL.host && ONL.acts.pref) ONL.acts.pref({ fac: f }); const lf = document.querySelector('#lobby .lf'); if (lf) lf.value = f; box.querySelectorAll('.fcard').forEach(c => c.classList.toggle('on', c.dataset.f === f)); const F = FACTIONS[f]; desc.innerHTML = `<b>${F.flag} ${F.n}</b> — special: ${F.desc}`; };
    for (const f in FACTIONS) { const c = document.createElement('div'); c.className = 'fcard'; c.dataset.f = f; c.innerHTML = `<div class="fl">${FACTIONS[f].flag}</div>${FACTIONS[f].n}`; c.onclick = () => sel(f); box.appendChild(c); }
    sel('usa'); }
  lobbyInit(); if (QS.get('lobbytest')) setTimeout(lobbySelfTest, 0);
  document.getElementById('startBtn').onclick = () => { audioInit(); if (ONL.room && ONL.host) { onlStartHost(); return; } const rows = lobbyRead(); if (rows.some(r => r[0] === 'remote')) { uiMsgMenu('Remote slots need an online game: press “Host online game”.'); return; } startGame('normal', Object.assign({ slots: buildSlots(rows, null, lobbyOpts().map), fog: document.getElementById('fogChk').checked }, lobbyOpts())); };
  onlInitUI();
  document.getElementById('surrBtn').onclick = () => { if (!started || G.over) return; if (confirm('Surrender this match?')) { NET.issue({ c: 'surrender' }); document.getElementById('pause').style.display = 'none'; paused = false; } };
  document.getElementById('resumeBtn').onclick = () => togglePause();
  document.querySelectorAll('.quitBtn').forEach(b => b.onclick = () => { keepLastReplay(); location.href = location.pathname; });
  if (QS.get('v34')) { startGame('easy', { seed: 4242 }); G.opts.fog = false; G.spectate = true; G.players[0].fac = 'fra'; G.players[1].fac = 'rus'; G.players[1].ai = false;
    for (const [t, x, y] of [['power', 4, 12], ['barracks', 11, 3], ['refinery', 11, 12], ['factory', 15, 6], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10;
    const v = G.vents[0]; addB('extractor', 0, v[0], v[1], true).born = -10; addB('gcannon', 0, 16, 14, true).born = -10; const tu = addB('turret', 0, 19, 12, true); tu.born = -10; tu.lvl = 3;
    const mk = (t, tm, x, y) => addU(t, tm, x, y);
    const a0 = [], a1 = []; ['titan', 'kommando', 'rifle', 'sniper', 'rocketeer', 'engineer', 'rocketeer', 'rifle', 'heavy', 'rifle'].forEach((t, i) => a0.push(mk(t, 0, 19 + (i % 4) * 0.9, 19 + (i / 4 | 0) * 0.9)));
    ['tsar', 'rifle', 'rifle', 'rocketeer', 'rifle', 'kommando', 'heavy', 'rifle', 'sniper'].forEach((t, i) => a1.push(mk(t, 1, 26 + (i % 3) * 0.9, 25 + (i / 3 | 0) * 0.9)));
    for (let i = 0; i < 30; i++) stepGame(); orderMove(a0, 24, 23, true); orderMove(a1, 21, 21, true);
    for (let i = 0; i < 30 * (+QS.get('v34') || 5); i++) stepGame(); G.events.length = 0;
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 16); jumpTo(+(QS.get('cx') || 22), +(QS.get('cy') || 21), true); paused = !!QS.get('freeze');
  } else
  if (QS.get('showcase')) { startGame('easy', { seed: 4242 }); const P = G.players[0]; P.cr = 99999;
    for (const [t, x, y] of [['power', 4, 12], ['power', 1, 9], ['power', 4, 2], ['barracks', 11, 3], ['refinery', 11, 12], ['factory', 15, 6], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10;
    const t1 = addB('turret', 0, 16, 14, true), t2 = addB('turret', 0, 19, 11, true), t3 = addB('aagun', 0, 18, 15, true); t1.lvl = 3; t2.lvl = 2; [t1, t2, t3].forEach(b => b.born = -10);
    const army = []; ['heavy', 'heavy', 'heavy', 'scout', 'rifle', 'rifle', 'rocketeer', 'rocketeer', 'rifle', 'arty', 'aa', 'arty'].forEach((t, i) => army.push(addU(t, 0, 14 + (i % 4), 18 + (i / 4 | 0))));
    for (let i = 0; i < 30; i++) stepGame(); orderFormation(army, 20, 20, Math.PI / 4); for (let i = 0; i < 30 * 12; i++) stepGame();
    G.events.length = 0; setSel([t1]); R3.cam.td = R3.cam.d = 19; jumpTo(17, 15.5, true); paused = false;
  } else
  if (QS.get('replaytest')) { startGame('hard', { seed: 99, map: QS.get('map') || 'volcano' }); NET.issue({ c: 'enq', t: 'power' }); for (let i = 0; i < 2700; i++) { stepGame(); G.events.length = 0; if (i === 1500) NET.issue({ c: 'move', u: G.ents.filter(e => e.team === ME && e.kind === 'u').map(e => e.id), x: 40, y: 40 }); }
    const h0 = stateHash(), f = replayFile(); loadReplay(JSON.parse(f)); for (let i = 0; i < 2700; i++) { stepGame(); G.events.length = 0; }
    document.title = (stateHash() === h0 && !G.replay.bad && G.replay.checked >= 2 ? 'REPLAYTEST OK' : 'REPLAYTEST FAIL') + ' checked=' + G.replay.checked + ' size=' + f.length; } else
  if (QS.get('teslachain')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false; // v5.3 screenshot scene: 5-coil Tesla cluster chaining into one bolt
    for (let i = 0; i < 6; i++) addB('power', 0, 2 + i * 2, 24, true).born = -10;
    for (const [x, y] of [[36, 42], [34, 41], [34, 43.5], [36.5, 44.5], [32.5, 42.5]]) addB('tesla', 0, x, y, true).born = -10;
    const foes = []; for (let i = 0; i < 6; i++) foes.push(addU(i % 2 ? 'heavy' : 'rifle', 1, 40 + (i % 3) * 0.8, 41 + (i / 3 | 0) * 1.2)); foes.forEach(f => f.order = 'hold');
    let ev = null; for (let i = 0; i < 30 * 10 && !ev; i++) { stepGame(); ev = G.events.find(e => e.e === 'zap' && e.n >= 4) || null; if (!ev) G.events.length = 0; }
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 13); jumpTo(+(QS.get('cx') || 37), +(QS.get('cy') || 40), true); paused = false; foes.forEach(f => { f.hp = f.mhp = 1e6; }); if (ev && QS.get('hold')) setInterval(() => G.events.push(ev), 120);
    document.title = 'TESLACHAIN ' + (ev ? 'n=' + ev.n : 'none');
  } else
  if (QS.get('warhead')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false; // v5.2 screenshot/test scene: heavy warhead mid-flight + cluster about to land on a defence cluster
    for (const [t, x, y] of [['power', 4, 12], ['power', 1, 9], ['power', 4, 2], ['tech', 3, 15]]) addB(t, 0, x, y, true).born = -10; const s = addB('silo', 0, 16, 16, true); s.born = -10; const s2 = addB('silo', 0, 12, 20, true); s2.born = -10;
    for (const [t, x, y] of [['turret', 30, 30], ['turret', 33, 29], ['aagun', 31, 33], ['tesla', 34, 32], ['power', 36, 35], ['power', 33, 36]]) addB(t, 1, x, y, true).born = -10;
    for (let i = 0; i < 30; i++) stepGame(); s.mis = 'heavy'; siloLaunch(s, 34, 33); s2.mis = 'cluster'; siloLaunch(s2, 31, 31);
    for (let i = 0; i < 30 * (+QS.get('warhead') || 5); i++) stepGame();
    R3.cam.td = R3.cam.d = +(QS.get('zoom') || 30); jumpTo(+(QS.get('cx') || 25), +(QS.get('cy') || 25), true); paused = !!QS.get('freeze');
  } else
  if (QS.get('battle')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false; const types = ['heavy', 'rifle', 'rocketeer', 'scout', 'titan', 'arty', 'gunship', 'heavy', 'rifle', 'aa'];
    const A = [], B = []; for (let i = 0; i < 60; i++) { const tm = i % 2, t = types[(i >> 1) % types.length], p = nearFree(40 + (tm ? 7 : -7) + (i >> 1) % 4, 40 + ((i >> 3) % 8), 6); (tm ? B : A).push(addU(t, tm, p[0] + 0.5, p[1] + 0.5)); }
    orderMove(A, 48, 44, true); orderMove(B, 32, 44, true); for (let i = 0; i < 30 * (+QS.get('battle') || 4); i++) stepGame();
    R3.cam.td = R3.cam.d = 20; jumpTo(40, 40, true); paused = false;
  } else
  if (QS.get('titan')) { startGame('normal', { demo: 1, seed: 4242 }); G.opts.fog = false;
    const ts = [addU('titan', 0, 20, 30), addU('titan', 0, 22, 33), addU('rifle', 0, 21, 28), addU('rifle', 0, 23, 29)]; addB('turret', 1, 34, 24, true).born = -10;
    for (let i = 0; i < 30; i++) stepGame(); orderMove(ts, 31, 33, false); for (let i = 0; i < 30 * (+QS.get('titan') || 2.5); i++) stepGame();
    R3.cam.td = R3.cam.d = 15; jumpTo(ts[0].x + 1, ts[0].y, true); setSel(ts.slice(0, 2)); paused = false;
  } else
  if (QS.get('stress')) { startGame('normal', { demo: 1, seed: 4242 }); const n = +QS.get('stress'), types = ['rifle', 'rocketeer', 'scout', 'heavy', 'arty', 'aa', 'scout', 'gunship'];
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
    for (const k of ['bld','def']) { UI.tab = k; buildGrid(); } for (const k of ['inf','veh','air']) { UI.btab = k; buildBotGrid(); }
    clickItem('power', false); for (let i = 0; i < 400; i++) stepGame();
    clickItem('power', false); const pp = worldToScreen(hq.x + 4, hq.y - 1, 0); ev('mousemove', pp.x, pp.y, 0); uiFrame(0.016); ev('mousedown', pp.x, pp.y, 0);
    clickItem('barracks', false); clickItem('rifle', false); clickItem('rifle', true);
    ['f', 'c', 'h', 'q', 'm', 'm', '1'].forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))); window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    UI.mode = 'repair'; ev('mousedown', worldToScreen(hq.x, hq.y, 1).x, worldToScreen(hq.x, hq.y, 1).y, 0);
    const mm = document.getElementById('minimap'), r = mm.getBoundingClientRect(); mm.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 100, clientY: r.top + 100, button: 0, bubbles: true }));
    for (let i = 0; i < 300; i++) stepGame();
    togglePause(); togglePause();
    for (const q of ['low', 'med', 'ultra', 'high']) { applyQuality(q); r3Render(0.016); }
    G.players[0].cr = 99999; addB('barracks', 0, 14, 4, true); addB('factory', 0, 14, 10, true); stepGame();
    const bar = G.ents.find(e => e.t === 'barracks' && e.team === ME); setSel([bar]); const tabOk = UI.btab === 'inf';
    clickItem('rifle', false, true); const q5 = G.players[0].queues.inf.length; clickItem('rifle', true, false); const q4 = G.players[0].queues.inf.length;
    showTip('heavy', document.querySelector('.item')); sidebar(); setSel([G.ents.find(e => e.t === 'hq' && e.team === ME)]); sidebar();
    const ctxBtns = document.querySelectorAll('#ctx .item').length;
    const tur2 = addB('turret', 0, 12, 13, true); tur2.born = -10; const lv0 = defW(tur2).rng; const okU = upgradeB(tur2); for (let i = 0; i < 30 * 16; i++) stepGame(); const lv = tur2.lvl;
    const army = []; for (let i = 0; i < 8; i++) army.push(addU(['heavy', 'rifle', 'arty', 'rocketeer'][i % 4], 0, 16 + i % 3, 16 + (i / 3 | 0)));
    setSel(army); sidebar(); doFormation(false); const fmOk = army.every(u => u.stance === 'hold'); toggleStance(); const agg = army.every(u => u.stance === 'aggr');
    { r3Render(0.016); const c = worldToScreen(tur2.x, tur2.y, heightAt(tur2.x, tur2.y) + 0.9), pk = pickAt(c.x, c.y); extra += ` pick=${!!pk && pk.id === tur2.id}`; if (!pk || pk.id !== tur2.id) throw new Error('pick offset'); }
    { // v5.7.1: picks anywhere on screen must be near the clicked ground (no far-away/behind-camera objects)
      const el = R3.renderer.domElement; let bad = 0, n = 0; const sv = [R3.cam.x, R3.cam.y, R3.cam.d, R3.cam.tx, R3.cam.ty, R3.cam.td];
      for (const [cx, cy, d] of [[20, 30, 26], [48, 60, 40], [70, 20, 18], [30, 80, 60]]) { R3.cam.td = R3.cam.d = d; jumpTo(cx, cy, true); r3Render(0.016);
        for (let i = 1; i < 10; i++) for (let j = 1; j < 8; j++) { const sx = el.clientWidth * i / 10, sy = el.clientHeight * j / 8, w = screenToWorld(sx, sy), pk = pickAt(sx, sy); if (!w) continue; n++; if (pk && dhypot(pk.x - w.x, pk.y - w.y) > 6) bad++; } }
      [R3.cam.x, R3.cam.y, R3.cam.d, R3.cam.tx, R3.cam.ty, R3.cam.td] = sv; extra += ` farpick=${bad}/${n}`; if (bad) throw new Error('far pick ' + bad); }
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
    if (best && bs > 4 && (!stick || Math.hypot(best.x - DIR.cur.x, best.y - DIR.cur.y) < 8 || bs > (DIR.curS || 0) * 2)) { if (!DIR.cur || Math.hypot(best.x - DIR.cur.x, best.y - DIR.cur.y) > 3) DIR.hold = 6; DIR.cur = best; DIR.curS = bs; if (DIR.auto && !DIR.userZoom) R3.cam.td = bs > 25 ? 16 : 19; }
    else if (!stick || !best) { // calm: tour bases & armies
      if (DIR.hold <= 0) { const opts = []; for (const t of [0, 1]) { const army = G.ents.filter(e => e.team === t && e.kind === 'u' && e.t !== 'harv'); if (army.length) opts.push({ x: army.reduce((a, e) => a + e.x, 0) / army.length, y: army.reduce((a, e) => a + e.y, 0) / army.length }); const hq = G.ents.find(e => e.team === t && e.t === 'hq'); if (hq) opts.push({ x: hq.x + 2, y: hq.y + 2 }); }
        DIR.tour = ((DIR.tour || 0) + 1) % Math.max(1, opts.length); DIR.cur = opts[DIR.tour] || { x: 32, y: 32 }; DIR.curS = 0; DIR.hold = 7; if (DIR.auto && !DIR.userZoom) R3.cam.td = 21; }
    }
    if (DIR.cur && DIR.auto) { R3.cam.tx = DIR.cur.x; R3.cam.ty = DIR.cur.y + R3.cam.td * 0.18; }
  }
}

// ===== lobby =====
function lobbyInit() {
  const box = document.getElementById('lobby'); if (!box) return;
  const facOpt = '<option value="rand">Random</option>' + Object.keys(FACTIONS).map(f => `<option value="${f}">${FACTIONS[f].flag} ${FACTIONS[f].n}</option>`).join('');
  box.innerHTML = '<div class="lrow lh"><span title="Slot N starts at spot N on the map preview">Spot</span><span>Player</span><span>Team</span><span>Faction</span><span>Colour</span></div>' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<div class="lrow"><span class="lnum">${i + 1}</span>
    <select class="lt">${Object.keys(SLOT_TYPES).map(k => `<option value="${k}">${SLOT_TYPES[k]}</option>`).join('')}</select>
    <select class="la"><option value="A">Team A</option><option value="B">Team B</option></select><select class="lf">${facOpt}</select><select class="lc"><option value="auto">Auto</option>${Object.keys(TEAM_COLORS).map(c => `<option value="${c}">${TEAM_COLORS[c].n}</option>`).join('')}</select></div>`).join('');
  box.querySelectorAll('.lc').forEach(sel => sel.onchange = () => { if (sel.value === 'auto') return; box.querySelectorAll('.lc').forEach(o => { if (o !== sel && o.value === sel.value) o.value = 'auto'; }); if (typeof lobbyChanged === 'function') lobbyChanged(); });
  // v5.7.1: "You" can be any slot; only one row can be You (the previous one becomes a Hard AI = 'si')
  box.querySelectorAll('.lt').forEach(sel => sel.addEventListener('change', () => { if (sel.value !== 'human') return; box.querySelectorAll('.lt').forEach(o => { if (o !== sel && o.value === 'human') o.value = 'si'; }); }));
  box.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => { if (typeof lobbyChanged === 'function') lobbyChanged(); mapPreview(); }));
  const pb = document.getElementById('presets'); pb.innerHTML = Object.keys(PRESETS).filter(k => k[0] !== 'w').map(k => `<button data-p="${k}">${k[0] === 'w' ? '▶ ' : ''}${PRESETS[k].n}</button>`).join('');
  pb.querySelectorAll('button').forEach(b => b.onclick = () => { lobbySet(PRESETS[b.dataset.p].slots); { const ms = document.getElementById('mapSel'), pm = PRESETS[b.dataset.p].map; if (ms && pm) { ms.value = pm; ms.dispatchEvent(new Event('change')); } } if (b.dataset.p[0] === 'w') { audioInit(); startGame('normal', Object.assign(lobbyOpts(), { slots: buildSlots(lobbyRead(), null, lobbyOpts().map), seed: (Math.random() * 1e6) | 0 })); } });
  lobbySet(PRESETS.duel.slots);
  box.querySelector('.lf').onchange = e => { if (e.target.value !== 'rand') MENU.fac = e.target.value; };
}
// v6.0: picking Hindu Kush Hellgate auto-fills 2 humans (Team A) + 6 Hard AI warlords (Team B); the 'You' row and any joined peers keep their rows
function hellgateSetup() {
  const on = typeof ONL !== 'undefined' && ONL.room && ONL.host, cur = lobbyRead(), me0 = Math.max(0, cur.findIndex(r => r[0] === 'human')), me = on ? me0 : 0; // v7.5.1: offline, You move to row 1 (valley spot 1)
  if (!on && me0 !== 0) cur[0] = [cur[0][0], cur[0][1], cur[me0][2], cur[0][3]];
  const peerRows = on ? Object.values(ONL.peers || {}).map(p => p.row).filter(r => r != null && r !== me) : [];
  const rows = cur.map((r, i) => [i === me ? 'human' : 'si', i === me ? 'A' : 'B', r[2] || 'rand', 'auto']);
  const mate = on ? (peerRows.length ? peerRows : [me === 1 ? 0 : 1]) : [me === 1 ? 0 : 1];
  for (const i of mate) rows[i] = [on ? 'remote' : 'si', 'A', cur[i][2] || 'rand', 'auto'];
  if (rows[me][2] === 'rand' && MENU.fac) rows[me][2] = MENU.fac;
  { const ps = document.getElementById('peaceSel'); if (ps && ps.value === '180') ps.value = '300'; } // 5-min peace: time to dig in at the Hellgate
  lobbySet(rows); if (on) { ONL.meRow = me; if (typeof lobbyChanged === 'function') lobbyChanged(); }
}
function lobbySet(list) { const rows = document.querySelectorAll('#lobby .lrow:not(.lh)'); rows.forEach((r, i) => { const s = list[i] || ['off', i % 2 ? 'B' : 'A']; r.querySelector('.lt').value = normDiff(s[0]); r.querySelector('.la').value = s[1]; r.querySelector('.lf').value = s[2] || (i === 0 && s[0] === 'human' ? MENU.fac : 'rand'); r.querySelector('.lc').value = s[3] || 'auto'; }); if (typeof mapPreview === 'function') mapPreview(); }
// v7.0 lobby mode: Skirmish (any map, two teams) or Endless (up to 4 defenders on Hellgate Last Stand vs the Horde)
function setMode(m) {
  MENU.mode = m; const su = document.getElementById('setup'); if (!su) return; su.classList.toggle('endless', m === 'endless');
  document.querySelectorAll('#modeTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  const ms = document.getElementById('mapSel'), ei = document.getElementById('endInfo'), hs = document.getElementById('endHS');
  if (ei) ei.style.display = m === 'endless' ? '' : 'none'; if (hs) { hs.style.display = m === 'endless' ? '' : 'none'; if (m === 'endless') hs.innerHTML = '<div class="flbl">🏆 Endless high scores</div>' + endlessHSHTML(); }
  if (m === 'endless') { if (ms && ms.value !== 'endless') { MENU.prevMap = ms.value; ms.value = 'endless'; }
    const cur = lobbyRead(), on = typeof ONL !== 'undefined' && ONL.room; let me = cur.findIndex(r => r[0] === 'human'); if (me < 0 || me > 3) me = 0;
    const rows = cur.map((r, i) => i > 3 ? ['off', 'A'] : [i === me ? 'human' : r[0] === 'remote' ? 'remote' : 'off', 'A', i === me ? (r[2] !== 'rand' ? r[2] : MENU.fac) : r[2], r[3]]);
    lobbySet(rows); }
  else if (ms && ms.value === 'endless') { ms.value = MENU.prevMap || 'classic'; lobbySet(PRESETS.duel.slots); }
  const t = document.getElementById('setupTitle'); if (t && m === 'endless') t.textContent = 'Endless — Hellgate Last Stand';
  if (typeof lobbyChanged === 'function') lobbyChanged(); mapPreview();
}
function endlessEndScreen() { const box = document.getElementById('endRun'); if (!box) return; if (!G.end || G.watch) { box.style.display = 'none'; return; }
  const rec = endlessRecord(), E = G.end, k = E.hsKind || endlessKind();
  box.style.display = ''; box.innerHTML = `<div class="runStats"><div><b>${E.wave}</b><span>waves</span></div><div><b>${E.score.toLocaleString()}</b><span>score</span></div><div><b>${E.kills}</b><span>kills</span></div><div><b>${(G.time / 60).toFixed(1)}</b><span>minutes</span></div></div>` +
    (E.rank === 1 ? '<div class="newBest">★ NEW ' + (k === 'solo' ? 'SOLO' : 'CO-OP') + ' HIGH SCORE ★</div>' : E.rank ? `<div class="rankTxt">#${E.rank} on the ${k === 'solo' ? 'solo' : 'co-op'} board</div>` : '') + endlessHSHTML(k, E.rank);
}
function lobbyOpts() { const m = document.getElementById('mapSel'), p = document.getElementById('peaceSel'), f = document.getElementById('fogChk'); return { map: m ? m.value : 'classic', peace: p ? +p.value : 180, fog: f ? !!f.checked : true }; }
function lobbyRead() { return [...document.querySelectorAll('#lobby .lrow:not(.lh)')].map(r => [r.querySelector('.lt').value, r.querySelector('.la').value, r.querySelector('.lf').value, r.querySelector('.lc').value]); }


// Lobby regression: index.html?lobbytest=1 drives the real lobby DOM (presets + faction/colour/team changes with change events), builds slots, starts the sim and checks starts/HQs/teams/ME.
function lobbySelfTest() {
  const errs = [], box = document.getElementById('lobby'), rows = () => [...box.querySelectorAll('.lrow:not(.lh)')], ms = document.getElementById('mapSel');
  const setSel = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  const facs = ['rand', ...FAC_KEYS], cols = ['auto', ...Object.keys(TEAM_COLORS)], R = mkRng(99); let n = 0, exact = 0, moved = 0;
  const check = (label, map) => {
    const list = lobbyRead(), en = map === 'endless', slots = buildSlots(list, null, map), me = Math.max(0, slots.findIndex(s => s.local));
    if (slots.length < (en ? 1 : 2)) return;
    { const s0 = seatFix(buildSlots(list, null, 'classic'), map); if (s0.map(s => s.start).join() !== slots.map(s => s.start).join()) errs.push(label + ' seatFix differs from lobby seats'); }
    const prev = lobbySeats(); // what the map preview + Slot badges show
    newGame({ seed: 7, slots: slots.map(s => Object.assign({}, s)), map, mode: en ? 'endless' : undefined }); n++;
    const eff = en ? 'endless' : seatMap(map, slots.length), order = SEAT_ORDER[eff], hum = G.players.filter(P => !P.horde);
    const starts = G.players.map(P => P.start);
    if (new Set(starts).size !== starts.length) errs.push(label + ' dup starts ' + starts);
    G.players.forEach((P, t) => { if (P.horde) return; const hq = G.ents.filter(e => e.team === t && e.t === 'hq'); if (hq.length !== 1) errs.push(label + ' p' + t + ' hq=' + hq.length);
      if (G.ents.filter(e => e.team === t && e.kind === 'u').length < 5) errs.push(label + ' p' + t + ' units');
      const h = hq[0], st = G.starts[P.start]; if (h && Math.hypot(h.x - st[0], h.y - st[1]) > 2) errs.push(label + ' p' + t + ' hq off start'); });
    // v7.5.1 seat rule: lobby row N (human or bot) -> the spot labelled N in the preview (G.starts[SEAT_ORDER[map][N-1]]); documented exceptions:
    // Hellgate side conflict / spot not on the map -> lowest free spot on the row's own side; Endless solo -> centre base (4)
    slots.forEach((sl, t) => { const P = hum[t], own = order[sl.row], pv = prev.rows.find(r => r.row === sl.row);
      if (!pv || pv.start !== P.start) errs.push(label + ' preview/badge spot != game spot for row ' + (sl.row + 1));
      if (en && slots.length === 1) { if (P.start !== 4) errs.push(label + ' endless solo not at centre'); return; }
      const sideOk = own != null && (seatSide(eff, own) == null || seatSide(eff, own) === P.ally);
      if (sideOk) { if (P.start !== own || seatLabel(eff, slots.length, P.start) !== sl.row + 1) errs.push(label + ` row ${sl.row + 1} (${sl.ai ? 'bot' : 'human'}) at spot ${seatLabel(eff, slots.length, P.start)}`); else exact++; }
      else { moved++; if (eff === 'hellgate' && slots.filter(s => s.ally === P.ally).length <= (P.ally ? 6 : 2) && seatSide(eff, P.start) !== P.ally) errs.push(label + ' moved row ' + (sl.row + 1) + ' landed on the wrong side'); } });
    slots.forEach((sl, t) => { const row = list.filter(r => r[0] !== 'off')[t]; if (!en && (row[1] === 'A' ? 0 : 1) !== hum[t].ally) errs.push(label + ' team mismatch p' + t);
      if (row[2] !== 'rand' && hum[t].fac !== row[2]) errs.push(label + ' fac mismatch p' + t); if (row[3] !== 'auto' && !en && hum[t].color !== row[3]) errs.push(label + ' color mismatch p' + t); });
    if (new Set(G.players.map(P => P.color)).size !== G.players.length) errs.push(label + ' dup colours');
    if (list[0][0] === 'human' && !(hum[me] && !hum[me].ai && slots[me].row === 0)) errs.push(label + ' ME wrong');
  };
  for (const map of ['classic', 'frost', 'volcano', 'volcano8', 'hellgate']) { ms.value = map;
    for (const pk of Object.keys(PRESETS)) {
      lobbySet(PRESETS[pk].slots); check(pk + '@' + map, map);
      for (let k = 0; k < 12; k++) { const rs = rows(), r = rs[(R() * rs.length) | 0], what = (R() * 4) | 0;
        if (what === 0) setSel(r.querySelector('.lf'), facs[(R() * facs.length) | 0]); else if (what === 1) setSel(r.querySelector('.lc'), cols[(R() * cols.length) | 0]); else if (what === 2) setSel(r.querySelector('.la'), R() < 0.5 ? 'A' : 'B'); else setSel(r.querySelector('.lt'), ['off', 'si', 'easy', 'normal'][(R() * 4) | 0]);
        check(pk + '@' + map + '#' + k + ' ' + JSON.stringify(lobbyRead()), map); }
    }
    // all team splits for 4 active slots incl. 3v1 / 4v0, and You on every row
    for (let m = 0; m < 16; m++) { lobbySet([['human', m & 1 ? 'B' : 'A', 'fra', 'green'], ['si', m & 2 ? 'B' : 'A', 'rus'], ['normal', m & 4 ? 'B' : 'A', 'rand', 'blue'], ['hard', m & 8 ? 'B' : 'A']]); check('split' + m + '@' + map, map); }
    for (let h = 0; h < 8; h++) { const L = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [i === h ? 'human' : i < 6 || map === 'volcano8' || map === 'hellgate' ? 'si' : 'off', map === 'hellgate' ? (i < 2 ? 'A' : 'B') : i % 2 ? 'B' : 'A']); lobbySet(L); check('you@row' + (h + 1) + '@' + map, map); }
  }
  // Endless: up to 4 defenders on rows 1-4 (any subset), solo -> centre base
  setMode('endless');
  for (let m = 1; m < 16; m++) { lobbySet([0, 1, 2, 3].map(i => [m & (1 << i) ? (i === 0 ? 'human' : 'remote') : 'off', 'A'])); check('endless' + m, 'endless'); }
  setMode('skirmish'); ms.value = 'classic'; lobbySet(PRESETS.duel.slots);
  document.title = (errs.length ? 'LOBBYTEST FAIL ' + errs.length + ' ' + errs.slice(0, 3).join(' | ') : 'LOBBYTEST OK') + ' games=' + n + ' exact=' + exact + ' moved=' + moved;
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
function onNetResync() { // v5.5: state was rebuilt from the host's log -> drop stale object refs
  if (typeof UI !== 'undefined' && UI.sel) UI.sel = []; G.vis = G.visT[ME]; G.seen = G.seenT[ME]; if (typeof setSel === 'function') try { setSel([]); } catch (e) {}
  if (typeof R3 !== 'undefined' && R3.onReset) R3.onReset();
}
function netOverlay(stall, dt) {
  const el = document.getElementById('netWait'); if (!el) return;
  NET.waitT = stall ? NET.waitT + dt : 0;
  let txt = '';
  if (NET.desync) txt = `⚠ Desync at tick ${NET.desync.t} (player ${NET.desync.team + 1}) could not be repaired automatically — please restart the match.`;
  else if (NET.online && NET.waitT > 0.4) txt = NET.host && NET.waiting ? 'Waiting for ' + NET.waiting.map(t => G.players[t].name).join(', ') + '…' : 'Waiting for host…';
  if (NET.status) { uiMsg(NET.status); announce(NET.status, 'net' + NET.status, 5); NET.status = ''; }
  el.textContent = txt; el.style.display = txt ? 'block' : 'none';
}

function uiMsgMenu(t) { const e = document.getElementById('onStatus'); if (e) e.textContent = t; }
// ===== v5.5 home screen + map preview =====
function homeRecords() { const el = document.getElementById('homeHS'); if (!el || typeof endlessHS !== 'function') return; const h = endlessHS(), f = r => r ? `wave <b>${r.wave}</b> · ${r.score.toLocaleString()}` : '—';
  el.innerHTML = h.solo.length || h.coop.length ? `🏆 Endless best — Solo: ${f(h.solo[0])} &nbsp;|&nbsp; Co-op: ${f(h.coop[0])}` : '♾ New: <b>Endless mode</b> — hold four passes against infinite waves'; }
function homeShow(mode) { // mode: null = home, 'bots', 'online'
  const hb = document.getElementById('homeBtns'), su = document.getElementById('setup'), ow = document.getElementById('onWrap'); if (!hb || !su) return;
  hb.style.display = mode ? 'none' : ''; su.style.display = mode ? '' : 'none'; if (ow) ow.style.display = mode === 'online' ? '' : 'none';
  const t = document.getElementById('setupTitle'); if (t) t.textContent = mode === 'online' ? 'Online game — host or join, then set up slots' : 'Game vs bots';
  if (mode) mapPreview();
}
// v7.5.1: the preview shows the CURRENT lobby: each active row's number sits on the exact spot that player starts at (seatPlan),
// filled with its team colour (A blue, B red) and ringed in its player colour; free spots are dim, tinted by the side they suit.
function lobbySeats() { // -> { map, rows: [{ row, ally, color, start }] } for the current lobby (same rule startGame uses)
  const sel = document.getElementById('mapSel'), map = MENU.mode === 'endless' ? 'endless' : sel ? sel.value : 'classic', list = lobbyRead();
  const act = list.map((r, row) => ({ row, ally: MENU.mode === 'endless' ? 0 : r[1] === 'A' ? 0 : 1, color: r[3], type: r[0] })).filter(r => r.type !== 'off' && (MENU.mode !== 'endless' || r.row < 4));
  const st = act.length ? seatPlan(map, act) : []; act.forEach((r, i) => r.start = st[i]);
  return { map: map === 'endless' ? 'endless' : seatMap(map, act.length), n: act.length, rows: act };
}
function lobbySeatUI(S) { // row number badges: team colour + "N→M" when a row had to move (spot on the other side / not on this map)
  const rs = document.querySelectorAll('#lobby .lrow:not(.lh)');
  rs.forEach((el, i) => { const b = el.querySelector('.lnum'); if (!b) return; const r = S.rows.find(x => x.row === i);
    if (!r) { b.textContent = i + 1; b.className = 'lnum'; b.title = 'Closed'; return; }
    const lab = r.start === 4 && S.map === 'endless' ? 'C' : seatLabel(S.map, S.n, r.start), moved = String(lab) !== String(i + 1);
    b.textContent = moved ? (i + 1) + '→' + lab : i + 1; b.className = 'lnum ' + (r.ally ? 'tB' : 'tA') + (moved ? ' moved' : '');
    b.title = moved ? (lab === 'C' ? 'Solo: you start at the centre base' : `Spot ${i + 1} ${seatSide(S.map, SEAT_ORDER[S.map][i]) != null ? 'belongs to the other team' : 'does not exist on this map'}, so this player starts at spot ${lab}`) : `Starts at spot ${i + 1} on the map`; });
}
function mapPreview() {
  const cv = document.getElementById('mapPrev'), sel = document.getElementById('mapSel'); if (!cv || !sel || started) return;
  const S = lobbySeats(), map = S.map, six = map === 'classic' && (S.n > 4 || S.rows.some(r => r.start > 3)), key = map + (six ? '6' : '');
  if (!MP_CACHE[key]) {
    const n = map === 'volcano8' || map === 'hellgate' ? 8 : six || map === 'volcano' || map === 'frost' ? 6 : 4, slots = []; for (let i = 0; i < n; i++) slots.push({ ai: true, diff: 'easy', ally: map === 'hellgate' ? (i < 2 ? 0 : 1) : i % 2 });
    const G0 = typeof G !== 'undefined' ? G : null, MW0 = MW, MH0 = MH;
    try { newGame({ seed: 1, map, slots }); } catch (e) { G = G0; MW = MW0; MH = MH0; return; }
    const x = cv.getContext('2d'), W = cv.width, s = W / MW, img = x.createImageData(W, W), d = img.data;
    for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) { const tx = Math.floor(px / s), ty = Math.floor(py / s), i = ty * MW + tx, t = G.map[i], l = G.lvl[i];
      let r, g, b; if (t === 1) { r = G.mud && G.mud[i] ? 150 : G.desert ? 112 : 88; g = G.mud && G.mud[i] ? 106 : G.desert ? 88 : 82; b = G.mud && G.mud[i] ? 68 : G.desert ? 66 : 74; } else if (t === 2) { r = 28; g = 80; b = 120; } else if (G.lava[i]) { r = 230; g = 90; b = 30; } else if (G.ore[i] > 0) { r = 230; g = 190; b = 60; } else if (G.ice[i]) { r = 170; g = 210; b = 230; } else { const base = map === 'frost' ? [190, 205, 215] : map.startsWith('volcano') ? [70, 62, 58] : (map === 'hellgate' || map === 'endless') ? (G.wadi && G.wadi[i] ? [205, 180, 130] : [172, 138, 92]) : [70, 110, 60]; r = base[0] + l * 22; g = base[1] + l * 22; b = base[2] + l * 18; if (G.forest[i]) { r *= 0.7; g *= 0.85; b *= 0.7; } }
      const o = (py * W + px) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; }
    x.putImageData(img, 0, 0);
    x.fillStyle = '#4fe8dc'; for (const [vx, vy] of G.vents || []) { x.beginPath(); x.arc((vx + 0.5) * s, (vy + 0.5) * s, 2.6, 0, 7); x.fill(); }
    if (G.derricks) { x.fillStyle = '#ffffff'; x.strokeStyle = '#000'; for (const d of G.derricks) { if (d.op) { x.save(); x.fillStyle = '#ffd060'; x.beginPath(); x.moveTo(d.x * s, d.y * s - 6); x.lineTo(d.x * s + 6, d.y * s); x.lineTo(d.x * s, d.y * s + 6); x.lineTo(d.x * s - 6, d.y * s); x.closePath(); x.fill(); x.stroke(); x.restore(); continue; } x.fillRect(d.x * s - 2, d.y * s - 2, 4, 4); x.strokeRect(d.x * s - 2, d.y * s - 2, 4, 4); } }
    const txt = `${MW}×${MH} · ${map === 'endless' ? 4 : G.starts.length} spots · ${(G.vents || []).length} gas vents · ${(G.derricks || []).length} derricks` + (map === 'endless' ? ' · 4 mountain passes · Horde (H) spawns east · solo = centre base (C)' : '') + (map === 'hellgate' ? ` · ${G.derricks.filter(d => d.op).length} outposts (◆ capture = build radius) · Team A spots 1-2 vs 6 warlords (3-8) — one canyon in` : '');
    MP_CACHE[key] = { img: x.getImageData(0, 0, W, W), txt, starts: G.starts.map(p => p.slice()), MW };
    G = G0; MW = MW0; MH = MH0;
  }
  const C = MP_CACHE[key], x = cv.getContext('2d'), s = cv.width / C.MW; x.putImageData(C.img, 0, 0);
  x.font = 'bold 12px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const dot = (sx, sy, fill, ring, lab, a) => { x.globalAlpha = a; x.fillStyle = fill; x.beginPath(); x.arc(sx * s, sy * s, 8, 0, 7); x.fill(); if (ring) { x.lineWidth = 2.5; x.strokeStyle = ring; x.stroke(); } x.fillStyle = '#fff'; x.fillText(String(lab), sx * s, sy * s + 0.5); x.globalAlpha = 1; };
  const used = new Set(S.rows.map(r => r.start)), order = SEAT_ORDER[map];
  C.starts.forEach(([sx, sy], k) => { if (used.has(k) || order.indexOf(k) < 0) return; const side = map === 'hellgate' ? seatSide(map, k) : map === 'endless' ? 0 : order.indexOf(k) % 2; dot(sx, sy, side ? '#7a3a34' : '#34506e', null, order.indexOf(k) + 1, 0.75); });
  if (map === 'endless' && C.starts[5]) dot(C.starts[5][0], C.starts[5][1], '#ff5040', '#300', 'H', 1);
  for (const r of S.rows) { const p = C.starts[r.start]; if (!p) continue; const col = r.color && r.color !== 'auto' && TEAM_COLORS[r.color] ? TEAM_COLORS[r.color].css : null; dot(p[0], p[1], r.ally ? '#ff5040' : '#3d9cff', col || '#fff', r.row + 1, 1); }
  const moved = S.rows.filter(r => String(r.start === 4 && map === 'endless' ? 'C' : seatLabel(map, S.n, r.start)) !== String(r.row + 1) && !(map === 'endless' && S.n === 1)).length;
  document.getElementById('mapPrevTxt').textContent = C.txt + ' · number = lobby slot, blue = Team A, red = Team B' + (moved ? ` · ${moved} slot${moved > 1 ? 's' : ''} moved to a free spot on their side (see Slot column)` : '');
  lobbySeatUI(S);
}
const MP_CACHE = {};
window.addEventListener('load', () => {
  const $$ = id => document.getElementById(id);
  if ($$('playBotsBtn')) $$('playBotsBtn').onclick = () => { audioInit && audioInit(); homeShow('bots'); setMode('skirmish'); };
  if ($$('playEndlessBtn')) $$('playEndlessBtn').onclick = () => { audioInit && audioInit(); homeShow('bots'); setMode('endless'); };
  document.querySelectorAll('#modeTabs button').forEach(b => b.onclick = () => setMode(b.dataset.m));
  homeRecords();
  if ($$('playOnlineBtn')) $$('playOnlineBtn').onclick = () => { audioInit && audioInit(); homeShow('online'); };
  if ($$('backBtn')) $$('backBtn').onclick = () => homeShow(null);
  if ($$('mapSel')) $$('mapSel').addEventListener('change', () => { if ($$('mapSel').value === 'hellgate') hellgateSetup(); mapPreview(); });
  if (new URLSearchParams(location.search).get('room')) homeShow('online');
  if (QS.get('lobbytest') || QS.get('home')) homeShow(QS.get('home') === 'online' ? 'online' : 'bots');
  if (QS.get('home') === 'endless') setMode('endless');
});
