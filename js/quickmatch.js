'use strict';
// ===== v7.7.7 Quick Match (iPhone app only): Apple Game Center auto-match, 2-8 players, empty slots = Hard bots =====
// The web build never shows this (no native bridge there) and keeps the normal Host / Join room codes.
// Everything after matchmaking reuses the existing online stack unchanged: messages go through onlDispatch -> onlAccept
// (v7.7.6 size caps, per-player rate limits, host lock, host-only types, try/catch) and the host's 'start' package passes
// onlValidStart; the lockstep (NET), drop-to-AI and "host left -> continue offline vs AI" behave exactly as in a room game.
//
// Native bridge (Capacitor plugin "IronGameCenter", see ios-plugin/ and GAME-CENTER.md). All methods return Promises:
//   authenticate()                          -> { playerId, alias }          (GKLocalPlayer.local, shows Apple's sign-in sheet if needed)
//   findMatch({ minPlayers, maxPlayers, playerGroup }) -> { players:[{playerId, alias}] }  (GKMatchmaker.findMatch, no Apple UI)
//   addPlayers({ maxPlayers, playerGroup }) keep looking for more players while the countdown runs (GKMatchmaker.addPlayers)
//   stopSearch()                            stop looking (GKMatchmaker.finishMatchmaking / cancel)
//   send({ data, to })                      data = string; to = [playerId] or null = everyone; always .reliable
//   disconnect()                            GKMatch.disconnect()
//   addListener(event, cb)                  'playerConnected' {playerId, alias} | 'playerDisconnected' {playerId} | 'data' {from, data}
const QM = { bridge: null, state: 'idle', me: null, alias: '', players: {}, hostId: null, hello: {}, endAt: 0, iv: null, MIN: 2, MAX: 8, COUNTDOWN: 30, listening: false, why: null };
ONL_LIMITS.qml = [4096, 5, 12, 'H']; // host -> guests: countdown + who is in (host-only, rate/size-limited like every other type)
function qmBridgeGet() { if (typeof window === 'undefined') return null; if (window.__qmBridge) return window.__qmBridge; // tests inject a fake Game Center
  const C = window.Capacitor; if (!C || !(typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.isNative)) return null;
  if (typeof C.getPlatform === 'function' && C.getPlatform() !== 'ios') return null; return C.Plugins && C.Plugins.IronGameCenter || null; }
function qmAvailable() { return !!qmBridgeGet(); }
function qmGroup() { return (parseInt(codeHash(), 36) % 4294967291) >>> 0; } // only players on the exact same build are ever matched together
function qmIds() { return Object.keys(QM.players).sort(); }
function qmElect() { const ids = qmIds(); return ids.length ? ids[0] : null; } // everybody computes the same host: lowest Game Center playerId
function qmUi(html, searching) { const e = document.getElementById('qmStatus'); if (e) e.innerHTML = html; const b = document.getElementById('qmBtn'), c = document.getElementById('qmCancel');
  if (b) b.disabled = !!searching; if (c) c.style.display = searching ? '' : 'none'; }
function qmSend(name, d, to) { if (!QM.bridge) return; let s; try { s = JSON.stringify({ n: name, d }); } catch (e) { return; } try { const p = QM.bridge.send({ data: s, to: to ? [to] : null }); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function qmOnData(ev) { // every byte from another iPhone lands here first
  if (!ev || typeof ev.from !== 'string' || ev.from.length > 64 || typeof ev.data !== 'string' || ev.data.length > 33554432 || !QM.players[ev.from] && QM.state !== 'started') { onlSecDrop('qmshape'); return; }
  let m; try { m = JSON.parse(ev.data); } catch (e) { onlSecDrop('json'); return; }
  if (!m || typeof m !== 'object' || typeof m.n !== 'string') { onlSecDrop('shape'); return; }
  onlDispatch(m.n, m.d, ev.from);
}
function qmAttach(b) { if (QM.listening) return; QM.listening = true;
  b.addListener('playerConnected', p => { if (!p || typeof p.playerId !== 'string' || QM.state === 'idle') return; if (QM.state === 'started') return; QM.players[p.playerId] = { alias: netSafeName(p.alias, 'Player') }; qmRoles(); });
  b.addListener('playerDisconnected', p => { if (!p || typeof p.playerId !== 'string') return; const id = p.playerId;
    if (QM.state === 'started') { onlPeerLeave(id); return; } // in-match: host drops them to AI / guests continue offline if the host left
    if (!QM.players[id] || id === QM.me) return; delete QM.players[id]; delete QM.hello[id]; qmRoles(); });
  b.addListener('data', qmOnData);
}
function qmActs() { ONL.acts = {}; for (const n of Object.keys(ONL_LIMITS)) ONL.acts[n] = (d, to) => qmSend(n, d, to); }
async function qmStart() {
  const b = qmBridgeGet(); if (!b || QM.state !== 'idle') return; QM.bridge = b; QM.why = null;
  qmUi('Signing in to Game Center…', true);
  let me; try { me = await b.authenticate(); } catch (e) { me = null; }
  if (!me || typeof me.playerId !== 'string') { qmUi('❌ Game Center sign-in failed. Open Settings → Game Center, sign in, then try again.'); return; }
  try { onlLeaveRoom(); } catch (e) {}
  Object.assign(QM, { state: 'search', me: me.playerId, alias: netSafeName(me.alias || onlName(), 'Commander'), players: { [me.playerId]: { alias: netSafeName(me.alias, 'Commander') } }, hello: {}, hostId: null, endAt: 0 });
  ONL.selfId = QM.me; ONL.name = QM.alias; ONL.started = false; ONL.host = false; ONL.hostLock = null; ONL.peers = {}; ONL_SEC.rate = {}; ONL.handlers = {}; qmActs(); qmAttach(b);
  qmUi('🔎 Finding players… (2-8 players, empty seats become Hard bots)', true);
  let r; try { r = await b.findMatch({ minPlayers: QM.MIN, maxPlayers: QM.MAX, playerGroup: qmGroup() }); } catch (e) { r = null; }
  if (QM.state !== 'search') return; // cancelled meanwhile
  if (!r || !Array.isArray(r.players)) { QM.state = 'idle'; qmUi('No match found right now. Try again, or play Skirmish vs Hard bots.'); return; }
  for (const p of r.players.slice(0, QM.MAX - 1)) if (p && typeof p.playerId === 'string' && p.playerId !== QM.me) QM.players[p.playerId] = { alias: netSafeName(p.alias, 'Player') };
  QM.state = 'lobby'; QM.endAt = Date.now() + QM.COUNTDOWN * 1000;
  try { const p = b.addPlayers({ maxPlayers: QM.MAX, playerGroup: qmGroup() }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  qmRoles(); clearInterval(QM.iv); QM.iv = setInterval(qmTick, 1000);
}
function qmRoles() { // (re-)elect the host whenever someone joins or leaves before the match starts
  if (QM.state !== 'lobby' && QM.state !== 'search') return;
  const h = qmElect(), was = QM.hostId; QM.hostId = h;
  if (h === QM.me) { ONL.host = true; ONL.hostLock = null;
    ONL.handlers.hello = (d, pid) => { if (QM.state === 'started') { ONL.acts.kick({ reason: 'Match already started.' }, pid); return; }
      if (!QM.players[pid]) return; if (d.ver !== codeHash()) { ONL.acts.kick({ reason: 'Version mismatch — update the app.', code: 'version' }, pid); return; }
      QM.hello[pid] = { name: netSafeName(d.name, QM.players[pid].alias), fac: typeof d.fac === 'string' && Object.prototype.hasOwnProperty.call(FACTIONS, d.fac) ? d.fac : 'rand' }; qmBroadcast(); };
    ONL.handlers.chat = () => {};
    if (was && was !== h && QM.state === 'lobby') QM.endAt = Math.max(QM.endAt, Date.now() + 10000); // new host after the old one left: 10 s more for everyone to re-check in
  } else { ONL.host = false; ONL.hostLock = h; // only the elected host's messages are accepted from now on
    ONL.handlers.qml = (d, pid) => { if (pid !== QM.hostId || !netInt(d.s, 0, 600) || !netInt(d.n, 1, 16)) return; QM.endAt = Date.now() + d.s * 1000; qmShow(d.n); };
    ONL.handlers.kick = d => { qmCancel('❌ ' + netEsc(String(d.reason || 'Removed from the match.').slice(0, 200))); };
    ONL.handlers.start = (d, pid) => { if (QM.state !== 'lobby' || pid !== QM.hostId || !onlValidStart(d) || !d.peerTeam || typeof d.peerTeam !== 'object' || !Array.isArray(d.humans) || !netInt(d.peerTeam[QM.me], 0, 15)) return; qmGo(d, false); };
    if (was !== h && h) qmSend('hello', { name: QM.alias, ver: codeHash(), nv: NET_VERSION, fac: typeof MENU !== 'undefined' ? MENU.fac : 'rand', cid: QM.me }, h);
  }
  if (QM.state === 'lobby' && qmIds().length < 2) { QM.state = 'search'; qmUi('Everyone else left — looking for more players…', true); }
  else if (QM.state === 'search' && qmIds().length >= 2) { QM.state = 'lobby'; QM.endAt = Date.now() + QM.COUNTDOWN * 1000; clearInterval(QM.iv); QM.iv = setInterval(qmTick, 1000); qmRoles(); return; }
  if (QM.hostId === QM.me) qmBroadcast(); else qmShow(qmIds().length);
}
function qmLeft() { return Math.max(0, Math.ceil((QM.endAt - Date.now()) / 1000)); }
function qmShow(n) { if (QM.state === 'lobby') qmUi(`⚡ Quick Match: <b>${n}</b> player${n > 1 ? 's' : ''} found · starting in <b>${qmLeft()}</b>s · ${qmBots(n)}`, true); }
function qmBots(n) { const k = Math.max(0, (n <= 4 ? 4 : 8) - n); return k ? k + ' Hard bot' + (k > 1 ? 's fill' : ' fills') + ' the empty seat' + (k > 1 ? 's' : '') : 'full lobby'; }
function qmBroadcast() { if (QM.hostId !== QM.me || QM.state !== 'lobby') return; const n = qmIds().length; qmSend('qml', { s: qmLeft(), n }); qmShow(n); }
function qmTick() {
  if (QM.state !== 'lobby') { if (QM.state !== 'search') clearInterval(QM.iv); return; }
  if (QM.hostId !== QM.me) { qmShow(qmIds().length); return; }
  const n = qmIds().length; if (n >= QM.MAX || qmLeft() <= 0) qmHostStart(); else qmBroadcast();
}
function qmPlan(humans) { // humans: [{id, name, fac}] (host first). <=4 players: 4-seat free-for-all on Classic; 5-8: 8-seat FFA on Volcano XL
  const seats = humans.length <= 4 ? 4 : 8, map = seats === 4 ? 'classic' : 'volcano8', rows = [], names = {};
  for (let i = 0; i < seats; i++) { const h = humans[i]; rows.push([h ? (i === 0 ? 'human' : 'remote') : 'si', 'ABCDEFGH'[i], h ? h.fac : 'rand']); if (h) names[i] = h.name; }
  return { rows, names, map };
}
function qmHostStart() {
  if (QM.state !== 'lobby' || QM.hostId !== QM.me) return;
  const ids = qmIds().filter(id => id === QM.me || QM.hello[id]), humans = [{ id: QM.me, name: QM.alias, fac: typeof MENU !== 'undefined' ? MENU.fac : 'rand' }].concat(ids.filter(id => id !== QM.me).slice(0, QM.MAX - 1).map(id => ({ id, name: QM.hello[id].name, fac: QM.hello[id].fac })));
  for (const id of qmIds()) if (id !== QM.me && !humans.some(h => h.id === id)) ONL.acts.kick({ reason: 'Your phone did not check in before the countdown ended.' }, id);
  const P = qmPlan(humans), slots = buildSlots(P.rows, P.names, P.map), seed = (Math.random() * 1e9) | 0, peerTeam = {};
  humans.forEach((h, i) => { if (i) { const k = slots.findIndex(s => s.row === i); if (k >= 0) peerTeam[h.id] = k; } });
  const me = slots.findIndex(s => s.local), hs = slots.map((s, i) => !s.ai ? i : -1).filter(i => i >= 0);
  try { const p = QM.bridge.stopSearch(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  const d = { seed, slots, peerTeam, humans: hs, host: QM.me, map: P.map, peace: 0, fog: true };
  ONL.acts.start(d); qmGo(Object.assign({}, d, { me }), true);
}
function qmGo(d, host) {
  clearInterval(QM.iv); QM.state = 'started'; ONL.started = true; ONL.hostId = d.host; if (!host) ONL.hostLock = d.host;
  for (const id of Object.keys(d.peerTeam)) ONL.peers[id] = { name: (QM.hello[id] || {}).name || (QM.players[id] || {}).alias || 'Player', row: d.peerTeam[id] };
  qmUi('');
  onlBegin({ seed: d.seed, slots: d.slots, me: host ? d.me : d.peerTeam[QM.me], humans: d.humans, peerTeam: d.peerTeam, host, hostPeer: d.host, map: d.map, cmap: null, peace: d.peace, fog: d.fog !== false });
}
function qmCancel(msg) { const st = QM.state; clearInterval(QM.iv); QM.state = 'idle'; QM.players = {}; QM.hello = {}; QM.hostId = null; ONL.hostLock = null; ONL.host = false;
  if (QM.bridge && st !== 'idle') { try { const p = QM.bridge.stopSearch(); if (p && p.catch) p.catch(() => {}); } catch (e) {} try { const p = QM.bridge.disconnect(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  qmUi(msg || ''); }
function qmInitUI() { const box = document.getElementById('qmBox'); if (!box) return; if (!qmAvailable()) { box.style.display = 'none'; return; }
  box.style.display = ''; document.getElementById('qmBtn').onclick = () => qmStart(); document.getElementById('qmCancel').onclick = () => qmCancel('Quick Match cancelled.'); }
if (typeof module !== 'undefined') module.exports = { QM, qmPlan, qmElect };
