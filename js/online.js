'use strict';
// ===== Online lobby over Trystero (Nostr signalling, WebRTC data channels) =====
// Host owns the lobby: assigns 4 slots, broadcasts seed/slots/version, starts when all remote humans are ready.
const ONL = { room: null, host: false, code: null, peers: {}, acts: {}, handlers: {}, leaveCbs: [], hostId: null, name: '', ready: false, started: false };
// Same-browser transport (two tabs, ?transport=local): BroadcastChannel with a Trystero-like API. For local testing.
function bcTrystero() {
  const selfId = Math.random().toString(36).slice(2, 10);
  return { selfId, joinRoom(conf, roomId) {
    const ch = new BroadcastChannel(conf.appId + ':' + roomId), acts = {}, peers = {}, room = { onPeerJoin: null, onPeerLeave: null };
    const post = m => ch.postMessage(Object.assign({ from: selfId }, m));
    const seen = pid => { const n = !peers[pid]; peers[pid] = Date.now(); if (n && room.onPeerJoin) room.onPeerJoin(pid); };
    ch.onmessage = ({ data: m }) => { if (m.from === selfId || (m.to && m.to !== selfId)) return; if (m.t === 'bye') { if (peers[m.from]) { delete peers[m.from]; room.onPeerLeave && room.onPeerLeave(m.from); } return; }
      seen(m.from); if (m.t === 'hi') post({ t: 'hb', to: m.from }); if (m.t === 'msg' && acts[m.n] && acts[m.n].onMessage) acts[m.n].onMessage(m.d, { peerId: m.from }); };
    setInterval(() => { post({ t: 'hb' }); for (const p in peers) if (Date.now() - peers[p] > 4000) { delete peers[p]; room.onPeerLeave && room.onPeerLeave(p); } }, 1000);
    addEventListener('pagehide', () => post({ t: 'bye' }));
    room.makeAction = n => (acts[n] = { onMessage: null, send: (d, o) => post({ t: 'msg', n, d, to: o && o.target }) });
    room.getPeers = () => Object.assign({}, peers); room.leave = () => { post({ t: 'bye' }); ch.close(); };
    setTimeout(() => post({ t: 'hi' }), 30); return room; } };
}
function onlAvailable() { if (new URLSearchParams(location.search).get('transport') === 'local') { window.Trystero = { nostr: window.__bcT || (window.__bcT = bcTrystero()) }; } return typeof window !== 'undefined' && window.Trystero && window.Trystero.nostr; }
function onlJoinRoom(code) {
  const cfg = window.IRONFRONT_NET || {}, T = window.Trystero.nostr;
  const qr = new URLSearchParams(location.search).get('relays'); if (qr) cfg.relayUrls = qr.split(',').map(u => u.includes('://') ? u : 'wss://' + u);
  const conf = { appId: cfg.appId || 'ironfront-rts-v4' }; if (cfg.relayUrls) conf.relayConfig = { urls: cfg.relayUrls }; if (cfg.turnConfig) conf.turnConfig = cfg.turnConfig;
  const room = T.joinRoom(conf, 'room-' + code); ONL.room = room; ONL.code = code; ONL.selfId = T.selfId;
  for (const name of ['lobby', 'hello', 'ready', 'pref', 'chat', 'start', 'kick', 'in', 'turn', 'hash', 'desync', 'pg', 'po', 'sync', 'rejoin']) {
    const a = room.makeAction(name);
    if (Array.isArray(a)) { ONL.acts[name] = (d, to) => a[0](d, to || null); a[1]((d, pid) => onlDispatch(name, d, pid)); }
    else { ONL.acts[name] = (d, to) => a.send(d, to ? { target: to } : undefined); a.onMessage = (d, meta) => onlDispatch(name, d, meta && meta.peerId || meta); }
  }
  const pj = pid => onlPeerJoin(pid), pl = pid => onlPeerLeave(pid);
  if (typeof room.onPeerJoin === 'function' && room.onPeerJoin.length) { try { room.onPeerJoin(pj); room.onPeerLeave(pl); } catch (e) { room.onPeerJoin = pj; room.onPeerLeave = pl; } } else { room.onPeerJoin = pj; room.onPeerLeave = pl; }
}
function onlDispatch(name, d, pid) { if (ONL.handlers[name]) ONL.handlers[name](d, pid); }
const onlTransport = { send(type, data, to) { ONL.acts[type] && ONL.acts[type](data, to); }, on(type, cb) { ONL.handlers[type] = cb; }, onLeave(cb) { ONL.leaveCbs.push(cb); } };
function onlPeerJoin(pid) { if (!ONL.host) { onlStatus('Connected to a peer…'); ONL.acts.hello({ name: ONL.name, ver: codeHash() }); } else onlStatus('Peer connecting…'); }
function onlPeerLeave(pid) {
  if (ONL.started) { ONL.leaveCbs.forEach(f => f(pid)); return; }
  if (ONL.host && ONL.peers[pid]) { delete ONL.peers[pid]; onlBroadcastLobby(); onlChatLine('* a player left'); }
  if (!ONL.host && pid === ONL.hostId) { onlStatus('Host left the lobby.'); }
}
function onlCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }
function onlStatus(t) { const e = document.getElementById('onStatus'); if (e) e.innerHTML = t; }
function onlChatLine(t) { const e = document.getElementById('chatLog'); if (!e) return; const d = document.createElement('div'); d.textContent = t; e.appendChild(d); e.scrollTop = 1e9; }
function onlName() { const v = (document.getElementById('pname').value || '').trim().slice(0, 16); if (v) localStorage.setItem('if_name', v); return v || 'Commander' + ((Math.random() * 90 + 10) | 0); }
function onlShowPanel(on) { ['hostBtn', 'joinBtn'].forEach(id => document.getElementById(id).disabled = on); document.getElementById('onPanel').style.display = on ? 'block' : 'none'; document.getElementById('presets').style.display = on ? 'none' : ''; }
// ---- host ----
function onlHost() {
  if (!onlAvailable()) { onlStatus('Online play unavailable (network library failed to load).'); return; }
  ONL.host = true; ONL.name = onlName(); const code = onlCode(); onlJoinRoom(code);
  const rows = lobbyRead(); // v5.7.3: keep the host's chosen "You" row; exactly one human row; at least one remote row
  let me = rows.findIndex(r => r[0] === 'human'); if (me < 0) { me = 0; rows[0][0] = 'human'; } rows.forEach((r, i) => { if (i !== me && r[0] === 'human') r[0] = 'hard'; });
  if (!rows.some(r => r[0] === 'remote')) { rows[me === 1 ? 0 : 1][0] = 'remote'; } lobbySet(rows); ONL.meRow = me;
  onlShowPanel(true); document.getElementById('readyBtn').style.display = 'none';
  const link = location.origin + location.pathname + '?room=' + code;
  onlStatus(`Room <b>${code}</b> — share: <a href="${link}" target="_blank">${link}</a><br>${location.protocol === 'file:' ? '⚠ Hosting from file:// — friends must open the same game build via https.' : ''}`);
  ONL.handlers.hello = (d, pid) => {
    if (ONL.started) { if (d.ver === codeHash() && NET.rejoinReq(pid, d.name)) onlChatLine('* ' + d.name + ' rejoined'); else ONL.acts.kick({ reason: 'Match already running (no free slot to rejoin).' }, pid); return; }
    if (d.ver !== codeHash()) { ONL.acts.kick({ reason: 'Version mismatch — reload the page (host ' + codeHash() + ', you ' + d.ver + ').' }, pid); return; }
    const taken = new Set(Object.values(ONL.peers).map(p => p.row)), rows = lobbyRead();
    let row = rows.findIndex((r, i) => r[0] === 'remote' && !taken.has(i));
    if (row < 0) row = rows.findIndex((r, i) => i !== ONL.meRow && r[0] === 'off'); if (row >= 0 && rows[row][0] === 'off') { rows[row][0] = 'remote'; lobbySet(rows); }
    if (row < 0) { ONL.acts.kick({ reason: 'Lobby is full.' }, pid); return; }
    ONL.peers[pid] = { name: String(d.name || 'Guest').slice(0, 16), row, ready: false }; onlChatLine(`* ${ONL.peers[pid].name} joined (slot ${row + 1})`); onlBroadcastLobby();
  };
  ONL.handlers.ready = (d, pid) => { if (ONL.peers[pid]) { ONL.peers[pid].ready = !!d.r; onlBroadcastLobby(); } };
  ONL.handlers.pref = (d, pid) => { const p = ONL.peers[pid]; if (!p) return; const rows = lobbyRead(); if (d.fac && FACTIONS[d.fac]) rows[p.row][2] = d.fac; if (d.color && TEAM_COLORS[d.color] && !rows.some((r, i) => i !== p.row && r[3] === d.color)) rows[p.row][3] = d.color; lobbySet(rows); onlBroadcastLobby(); };
  ONL.handlers.chat = (d, pid) => { const n = ONL.peers[pid] ? ONL.peers[pid].name : '?'; onlChatLine(n + ': ' + d.m); ONL.acts.chat({ m: d.m, n }); };
  onlBroadcastLobby();
}
function lobbyChanged() { if (ONL.host && !ONL.started) onlBroadcastLobby(); }
function onlBroadcastLobby() {
  if (!ONL.room) return; const rows = lobbyRead();
  // remote rows that lost their peer stay 'remote' (open)
  const st = { rows, peers: ONL.peers, hostName: ONL.name, hostRow: ONL.meRow, ver: codeHash() };
  ONL.acts.lobby(st); onlRenderPeers(st);
  // v5.7.3: empty remote rows never block START (they become Hard AI); only joined-but-not-ready players do
  const need = Object.values(ONL.peers), openRemote = rows.filter((r, i) => r[0] === 'remote' && !need.some(p => p.row === i)).length, notReady = need.filter(p => !p.ready);
  const sb = document.getElementById('startBtn'); sb.disabled = notReady.length > 0;
  sb.textContent = notReady.length ? 'WAITING FOR ' + notReady.map(p => p.name).join(', ') + ' TO PRESS READY' : 'START ONLINE' + (openRemote ? ` (${openRemote} empty slot${openRemote > 1 ? 's become' : ' becomes'} Hard AI)` : '');
}
function onlRenderPeers(st) {
  const e = document.getElementById('onPeers'); if (!e) return;
  const hr = st.rows ? st.rows.findIndex(r => r[0] === 'human') : 0, open = st.rows ? st.rows.map((r, i) => r[0] === 'remote' && !Object.values(st.peers).some(p => p.row === i) ? i : -1).filter(i => i >= 0) : [];
  e.innerHTML = `<div>Slot ${(st.hostRow != null ? st.hostRow : Math.max(0, hr)) + 1}: <b>${st.hostName}</b> (host) 🟢</div>` + Object.values(st.peers).map(p => `<div>Slot ${p.row + 1}: <b>${p.name}</b> 🟢 connected · ${p.ready ? '✔ READY' : '⏳ not ready yet'}</div>`).join('') + open.map(i => `<div class="dim">Slot ${i + 1}: open — waiting for a friend to open the link (becomes Hard AI if empty)</div>`).join('');
}
function onlStartHost() {
  const rows = lobbyRead(); rows.forEach((r, i) => { if (r[0] === 'remote' && !Object.values(ONL.peers).some(p => p.row === i)) r[0] = 'hard'; }); lobbySet(rows);
  const names = { [Math.max(0, rows.findIndex(r => r[0] === 'human'))]: ONL.name }; for (const p of Object.values(ONL.peers)) names[p.row] = p.name;
  const slots = buildSlots(rows, names), seed = (Math.random() * 1e9) | 0;
  const peerTeam = {}; for (const pid in ONL.peers) { const k = slots.findIndex(s => s.row === ONL.peers[pid].row); if (k >= 0) peerTeam[pid] = k; }
  const me = slots.findIndex(s => s.local), humans = slots.map((s, i) => !s.ai ? i : -1).filter(i => i >= 0);
  const gopt = lobbyOpts(); ONL.acts.start({ seed, slots, peerTeam, humans, host: ONL.selfId, map: gopt.map, peace: gopt.peace, fog: gopt.fog });
  ONL.started = true; onlBegin({ seed, slots, me, humans, peerTeam, host: true, hostPeer: ONL.selfId, map: gopt.map, peace: gopt.peace, fog: gopt.fog });
}
// ---- client ----
function onlJoin(code) {
  if (!onlAvailable()) { onlStatus('Online play unavailable (network library failed to load).'); return; }
  code = String(code || '').trim().toUpperCase(); if (!code) return;
  ONL.host = false; ONL.name = onlName(); onlJoinRoom(code); onlShowPanel(true);
  document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); document.getElementById('startBtn').style.display = 'none';
  onlStatus(`Joining room <b>${code}</b>… (looking for host via relays)`);
  ONL.joinT0 = Date.now(); clearTimeout(ONL.reachT); ONL.reachT = setTimeout(() => { if (ONL.hostId || ONL.started) return;
    onlStatus(`❌ Can't reach the host of room <b>${code}</b> yet. Check: 1) the host is still on the lobby screen with this room open; 2) you both have the same version (reload this page — the host too); 3) try again with <b>Join</b>. If it never connects, one of your networks blocks direct connections: a TURN relay is needed (js/net-config.js → turnConfig) or try a different network (e.g. phone hotspot).`); }, 20000);
  ONL.handlers.lobby = (st, pid) => { ONL.hostId = pid; clearTimeout(ONL.reachT); lobbySet(st.rows); document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); onlRenderPeers(st);
    const mine = st.peers[ONL.selfId]; onlStatus(`Room <b>${code}</b> — host <b>${st.hostName}</b>. ${mine ? `You are slot ${mine.row + 1}. Pick your faction/colour, then press Ready.` : 'Waiting for a slot…'}`); };
  ONL.handlers.kick = d => { onlStatus('❌ ' + d.reason); };
  ONL.handlers.chat = d => onlChatLine(d.n + ': ' + d.m);
  ONL.handlers.sync = (d, pid) => { if (ONL.started || !d.full) return; ONL.started = true; ONL.hostId = pid; const o = d.opts;
    onlBegin({ seed: o.seed, slots: o.slots, me: d.me, humans: d.humans, peerTeam: d.peerTeam, host: false, hostPeer: pid, map: o.map, peace: o.peace, fog: o.fog !== false }); NET._applySync(d); };
  ONL.handlers.start = (d, pid) => { ONL.started = true; ONL.hostId = pid; onlBegin({ seed: d.seed, slots: d.slots, me: d.peerTeam[ONL.selfId], humans: d.humans, peerTeam: d.peerTeam, host: false, hostPeer: pid, map: d.map, peace: d.peace, fog: d.fog !== false }); };
  document.getElementById('readyBtn').style.display = '';
}
function onlBegin(o) {
  if (o.me == null) { onlStatus('You were not assigned a slot.'); return; }
  audioInit(); document.getElementById('menu').style.display = 'none';
  startGame('normal', { slots: o.slots, seed: o.seed, me: o.me, map: o.map, peace: o.peace, fog: o.fog !== false, online: { tr: onlTransport, host: o.host, me: o.me, humans: o.humans, peerTeam: o.peerTeam, hostPeer: o.hostPeer } });
  announce('Online match — lockstep ' + NET.DELAY + ' ticks', 'net0', 1);
}
function onlInitUI() {
  const pn = document.getElementById('pname'); if (!pn) return; pn.value = new URLSearchParams(location.search).get('name') || localStorage.getItem('if_name') || '';
  document.getElementById('hostBtn').onclick = () => onlHost();
  document.getElementById('joinBtn').onclick = () => onlJoin(document.getElementById('joinCode').value);
  document.getElementById('readyBtn').onclick = () => { ONL.ready = !ONL.ready; ONL.acts.ready && ONL.acts.ready({ r: ONL.ready }); document.getElementById('readyBtn').textContent = ONL.ready ? '✔ Ready' : 'Ready'; };
  document.getElementById('chatIn').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim() && ONL.room) { const m = e.target.value.trim().slice(0, 140); e.target.value = ''; if (ONL.host) { onlChatLine(ONL.name + ': ' + m); ONL.acts.chat({ m, n: ONL.name }); } else ONL.acts.chat({ m }); } e.stopPropagation(); };
  const code = new URLSearchParams(location.search).get('room'); if (code) { document.getElementById('joinCode').value = code; setTimeout(() => onlJoin(code), 50); }
}
