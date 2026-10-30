'use strict';
// ===== Online lobby over Trystero (Nostr signalling, WebRTC data channels) =====
// Host owns the lobby: assigns 4 slots, broadcasts seed/slots/version, starts when all remote humans are ready.
const ONL = { room: null, host: false, code: null, peers: {}, acts: {}, handlers: {}, leaveCbs: [], hostId: null, name: '', ready: false, started: false };
// Same-browser transport (two tabs, ?transport=local): BroadcastChannel with a Trystero-like API. For local testing.
function bcTrystero(tag) {
  tag = tag || '';
  const selfId = Math.random().toString(36).slice(2, 10);
  return { selfId, joinRoom(conf, roomId) {
    const ch = new BroadcastChannel(conf.appId + ':' + tag + roomId), acts = {}, peers = {}, room = { onPeerJoin: null, onPeerLeave: null };
    const post = m => ch.postMessage(Object.assign({ from: selfId }, m));
    const seen = pid => { const n = !peers[pid]; peers[pid] = Date.now(); if (n && room.onPeerJoin) room.onPeerJoin(pid); };
    ch.onmessage = ({ data: m }) => { if (m.from === selfId || (m.to && m.to !== selfId)) return; if (m.t === 'bye') { if (peers[m.from]) { delete peers[m.from]; room.onPeerLeave && room.onPeerLeave(m.from); } return; }
      seen(m.from); if (m.t === 'hi') post({ t: 'hb', to: m.from }); if (m.t === 'msg' && acts[m.n] && acts[m.n].onMessage) acts[m.n].onMessage(m.d, { peerId: m.from }); };
    let closed = false; const iv = setInterval(() => { if (closed) return; post({ t: 'hb' }); for (const p in peers) if (Date.now() - peers[p] > 4000) { delete peers[p]; room.onPeerLeave && room.onPeerLeave(p); } }, 1000);
    addEventListener('pagehide', () => { if (!closed) post({ t: 'bye' }); });
    room.makeAction = n => (acts[n] = { onMessage: null, send: (d, o) => post({ t: 'msg', n, d, to: o && o.target }) });
    room.getPeers = () => Object.assign({}, peers); room.leave = () => { if (closed) return; post({ t: 'bye' }); closed = true; clearInterval(iv); ch.close(); };
    setTimeout(() => post({ t: 'hi' }), 30); return room; } };
}
function onlAvailable() { if (new URLSearchParams(location.search).get('transport') === 'local') { window.Trystero = window.__bcT || (window.__bcT = { nostr: bcTrystero('n:'), mqtt: bcTrystero('m:') }); /* two fake strategies exercise the multi-strategy join */ } return typeof window !== 'undefined' && window.Trystero && Object.keys(window.Trystero).length > 0; }
// v7.6.3: fresh WebSocket relay strategy per room (js/relay.js). ?relay=0 turns it off; ?strategies=relay forces relay-only.
function onlEnsureRelay() { const q = new URLSearchParams(location.search); if (q.get('transport') === 'local' || q.get('relay') === '0' || typeof relayTrystero !== 'function' || !window.Trystero) return; window.Trystero.relay = relayTrystero(); }
// v5.9.2: WebRTC handshake telemetry (signalling vs direct-connection), used for the joiner's status/diagnosis
const RTCDIAG = { pcs: 0, remoteOffer: 0, remoteAnswer: 0, connected: 0, failed: 0 };
(() => { if (typeof window === 'undefined' || !window.RTCPeerConnection || window.RTCPeerConnection.__ifw) return; const O = window.RTCPeerConnection;
  const W = function (c) { const pc = new O(c); RTCDIAG.pcs++; const sr = pc.setRemoteDescription.bind(pc);
    pc.setRemoteDescription = d => { if (d && d.type === 'offer') RTCDIAG.remoteOffer++; if (d && d.type === 'answer') RTCDIAG.remoteAnswer++; return sr(d); };
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'connected') RTCDIAG.connected++; if (pc.connectionState === 'failed') RTCDIAG.failed++; }); return pc; };
  W.prototype = O.prototype; W.__ifw = 1; Object.setPrototypeOf(W, O); window.RTCPeerConnection = W; })();
// v5.9.2: signalling strategies run in parallel (Nostr relays + MQTT brokers + WebTorrent trackers); the joiner commits to the
// strategy over which the host actually admitted it. Override with ?strategies=nostr,mqtt  ?relays=…(nostr)  ?mqtt=…  ?trackers=…  ?turn=turn:host:port,user,pass
function onlStrategyConf(s, cfg, q) {
  const conf = { appId: cfg.appId || 'ironfront-rts-v4' }, urls = l => l.split(',').map(u => u.includes('://') ? u : 'wss://' + u);
  if (cfg.turnConfig) conf.turnConfig = cfg.turnConfig;
  if (s === 'nostr') { const u = q.get('relays') ? urls(q.get('relays')) : cfg.relayUrls; if (u) conf.relayConfig = { urls: u }; }
  if (s === 'mqtt') { const u = q.get('mqtt') ? urls(q.get('mqtt')) : cfg.mqttUrls; if (u) conf.relayConfig = { urls: u }; }
  if (s === 'relay') conf.startDelay = ONL.host ? 0 : (q.get('strategies') === 'relay' ? 0 : +(q.get('relaydelay') || 8000)); // guests give direct WebRTC 8s to win first
  if (s === 'torrent') { const u = q.get('trackers') ? urls(q.get('trackers')) : cfg.trackerUrls; if (u) conf.relayConfig = { urls: u }; }
  return conf;
}
function onlJoinRoom(code) {
  const cfg = window.IRONFRONT_NET || {}, q = new URLSearchParams(location.search);
  if (q.get('turn')) { const [u, n, c] = q.get('turn').split(','); cfg.turnConfig = [{ urls: [u], username: n, credential: c }].concat(cfg.turnConfig || []); }
  onlEnsureRelay(); const want = (q.get('strategies') || (cfg.strategies || ['nostr', 'mqtt', 'torrent', 'relay']).join(',')).split(',').filter(s => window.Trystero[s]);
  const subs = []; for (const s of want) { try { const T = window.Trystero[s]; subs.push({ s, T, room: T.joinRoom(onlStrategyConf(s, cfg, q), 'room-' + code) }); } catch (e) { console.warn('strategy ' + s + ' failed to start', e); } }
  if (!subs.length) { onlStatus('Online play unavailable (no matchmaking strategy could start).'); return; }
  const host = ONL.host, via = {}; let chosen = null; ONL.strategies = subs.map(x => x.s); ONL.selfId = subs[0].T.selfId; ONL.code = code;
  const commit = sub => { if (chosen) return; chosen = sub; ONL.selfId = sub.T.selfId; ONL.strategy = sub.s; setTimeout(() => { for (const o of subs) if (o !== sub) { try { o.room.leave(); } catch (e) {} } }, 1500); };
  const live = sub => host || !chosen || chosen === sub;
  const room = { getPeers: () => { const o = {}; for (const x of subs) if (live(x)) Object.assign(o, x.room.getPeers()); return o; }, leave: () => subs.forEach(x => { try { x.room.leave(); } catch (e) {} }), subs };
  ONL.room = room;
  for (const name of ['lobby', 'hello', 'ready', 'pref', 'chat', 'start', 'kick', 'in', 'turn', 'hash', 'desync', 'pg', 'po', 'sync', 'rejoin']) {
    const sends = subs.map(sub => { const a = sub.room.makeAction(name); const send = Array.isArray(a) ? (d, to) => a[0](d, to || null) : (d, to) => a.send(d, to ? { target: to } : undefined);
      const onm = (d, pid) => { if (!host && !chosen && name === 'lobby' && d && d.peers && d.peers[sub.T.selfId]) commit(sub); if (!live(sub)) return; via[pid] = via[pid] || sub; onlDispatch(name, d, pid); };
      if (Array.isArray(a)) a[1]((d, pid) => onm(d, pid)); else a.onMessage = (d, meta) => onm(d, meta && meta.peerId || meta);
      return { sub, send }; });
    ONL.acts[name] = (d, to) => { if (to) { const v = via[to]; const t = v ? sends.find(x => x.sub === v) : null; (t ? [t] : sends.filter(x => live(x.sub))).forEach(x => x.send(d, to)); } else sends.filter(x => live(x.sub)).forEach(x => x.send(d)); };
  }
  for (const sub of subs) { const r = sub.room;
    const pj = pid => { if (!live(sub)) return; via[pid] = sub; ONL.stratSeen = sub.s; onlPeerJoin(pid, sub); }, pl = pid => { if (via[pid] !== sub) return; delete via[pid]; onlPeerLeave(pid); };
    if (typeof r.onPeerJoin === 'function' && r.onPeerJoin.length) { try { r.onPeerJoin(pj); r.onPeerLeave(pl); } catch (e) { r.onPeerJoin = pj; r.onPeerLeave = pl; } } else { r.onPeerJoin = pj; r.onPeerLeave = pl; } }
}
function onlDispatch(name, d, pid) { if (ONL.handlers[name]) ONL.handlers[name](d, pid); }
const onlTransport = { send(type, data, to) { ONL.acts[type] && ONL.acts[type](data, to); }, on(type, cb) { ONL.handlers[type] = cb; }, onLeave(cb) { ONL.leaveCbs.push(cb); } };
function onlPeerJoin(pid, sub) { if (!ONL.host) { onlStatus('Connected to a peer' + (sub ? ' via ' + sub.s : '') + ' — asking the host for a slot…'); ONL.cid = ONL.cid || Math.random().toString(36).slice(2, 12); ONL.acts.hello({ name: ONL.name, ver: codeHash(), nv: NET_VERSION, cid: ONL.cid }, pid); } else onlChatLine('* a player is connecting' + (sub ? (sub.s === 'relay' ? ' via the relay server' : ' directly (via ' + sub.s + ' matchmaking)') : '') + '…'); }
function onlPeerLeave(pid) {
  if (ONL.started) { ONL.leaveCbs.forEach(f => f(pid)); return; }
  if (ONL.host && ONL.peers[pid]) { delete ONL.peers[pid]; onlBroadcastLobby(); onlChatLine('* a player left'); }
  if (!ONL.host && pid === ONL.hostId) { ONL.hostId = null; onlError('The host left the lobby (or their connection dropped). Ask them to keep the lobby open, then press Retry.'); }
}
function onlCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }
// v7.6.3: accept a pasted invite link, spaces, dashes and lower case in the join box
function onlParseCode(v) { v = String(v || '').trim(); const m = /[?&#]room=([A-Za-z0-9]+)/.exec(v); if (m) v = m[1]; return v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8); }
// v7.6.3: errors are shown in red on screen with Retry + Reload buttons (never silent)
function onlError(html, retry) { const code = ONL.code; onlStatus(`<div class="onErr">❌ ${html}</div><div class="onErrBtns">${retry !== false && code ? '<button id="onRetry">↻ Retry</button> ' : ''}<button id="onReload">⟳ Reload page</button> <span class="dim">[${typeof NET_VERSION !== 'undefined' ? NET_VERSION : ''}${ONL.strategy ? ' · ' + ONL.strategy : ''}]</span></div>`);
  const r = document.getElementById('onRetry'); if (r) r.onclick = () => onlRetry(); const l = document.getElementById('onReload'); if (l) l.onclick = () => onlHardReload(); console.warn('[online] ' + String(html).replace(/<[^>]+>/g, '')); }
function onlLeaveRoom() { clearInterval(ONL.reachI); clearTimeout(ONL.reachT); try { ONL.room && ONL.room.leave(); } catch (e) {} ONL.room = null; ONL.peers = {}; ONL.hostId = null; ONL.started = false; ONL.ready = false; ONL.acts = {}; ONL.handlers = {}; ONL.strategy = null; ONL.kicked = null;
  if (typeof RTCDIAG !== 'undefined') Object.keys(RTCDIAG).forEach(k => RTCDIAG[k] = 0); const rb = document.getElementById('readyBtn'); if (rb) rb.textContent = 'Ready'; }
function onlRetry() { const code = ONL.code, host = ONL.host; onlLeaveRoom(); onlShowPanel(false); document.querySelectorAll('#lobby select').forEach(s => s.disabled = false); const sb = document.getElementById('startBtn'); if (sb) sb.style.display = '';
  setTimeout(() => host ? onlHost(code) : onlJoin(code), 400); }
function onlHardReload() { const q = new URLSearchParams(location.search); q.set('v', Date.now().toString(36)); if (ONL.code && !ONL.host && !q.get('room')) q.set('room', ONL.code); location.replace(location.pathname + '?' + q.toString()); }
// v7.6.3: 'new version available' check (version.json is fetched with no-store, so a cached old page notices it is stale)
function onlVersionCheck() { if (typeof fetch !== 'function' || location.protocol === 'file:') return; fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.v || j.v === NET_VERSION || document.getElementById('verBanner')) return; const b = document.createElement('div'); b.id = 'verBanner';
    b.innerHTML = `🔄 A newer version of Iron Front (<b>${j.v}</b>) is available — you have ${NET_VERSION}. Online games need both players on the same version. <button id="verReload">Reload now</button> <button id="verX">✕</button>`;
    document.body.appendChild(b); document.getElementById('verReload').onclick = () => onlHardReload(); document.getElementById('verX').onclick = () => b.remove(); }).catch(() => {}); }
function onlStatus(t) { const e = document.getElementById('onStatus'); if (e) e.innerHTML = t; }
function onlChatLine(t) { const e = document.getElementById('chatLog'); if (!e) return; const d = document.createElement('div'); d.textContent = t; e.appendChild(d); e.scrollTop = 1e9; }
function onlName() { const v = (document.getElementById('pname').value || '').trim().slice(0, 16); if (v) localStorage.setItem('if_name', v); return v || 'Commander' + ((Math.random() * 90 + 10) | 0); }
function onlShowPanel(on) { ['hostBtn', 'joinBtn'].forEach(id => document.getElementById(id).disabled = on); document.getElementById('onPanel').style.display = on ? 'block' : 'none'; document.getElementById('presets').style.display = on ? 'none' : ''; }
// ---- host ----
function onlHost(keep) {
  if (!onlAvailable()) { onlError('Online play unavailable (the network library failed to load). Reload the page; if it keeps happening, disable ad-blockers for this site.', false); return; }
  onlVersionCheck(); ONL.host = true; ONL.name = onlName(); const code = keep || onlCode(); onlJoinRoom(code);
  const rows = lobbyRead(); // v5.7.3: keep the host's chosen "You" row; exactly one human row; at least one remote row
  let me = rows.findIndex(r => r[0] === 'human'); if (me < 0) { me = 0; rows[0][0] = 'human'; } rows.forEach((r, i) => { if (i !== me && r[0] === 'human') r[0] = 'si'; });
  if (!rows.some(r => r[0] === 'remote')) { rows[me === 1 ? 0 : 1][0] = 'remote'; } lobbySet(rows); ONL.meRow = me;
  onlShowPanel(true); document.getElementById('readyBtn').style.display = 'none';
  const _q = new URLSearchParams(location.search), _x = ['relays', 'mqtt', 'trackers', 'strategies', 'turn'].filter(k => _q.get(k)).map(k => '&' + k + '=' + encodeURIComponent(_q.get(k))).join(''); const link = location.origin + location.pathname + '?room=' + code + _x; // share link keeps signalling/TURN overrides
  onlStatus(`Room <b>${code}</b> — share: <a href="${link}" target="_blank">${link}</a><br>${location.protocol === 'file:' ? '⚠ Hosting from file:// — friends must open the same game build via https.' : ''}`);
  ONL.handlers.hello = (d, pid) => {
    if (ONL.started) { if (d.ver === codeHash() && NET.rejoinReq(pid, d.name)) onlChatLine('* ' + d.name + ' rejoined'); else ONL.acts.kick({ reason: 'Match already running (no free slot to rejoin).' }, pid); return; }
    if (d.ver !== codeHash()) { ONL.acts.kick({ reason: 'Version mismatch — the host has ' + NET_VERSION + ', you have ' + (d.nv || 'an older version') + '. Both players: reload the page (iPhone home-screen app: close it fully and reopen), then join again.', code: 'version', hv: NET_VERSION }, pid); onlChatLine('* ' + String(d.name || 'A player').slice(0, 16) + ' tried to join with ' + (d.nv || 'an older version') + ' (you have ' + NET_VERSION + ') — they need to reload'); return; }
    if (d.cid && Object.values(ONL.peers).some(p => p.cid === d.cid)) return; // v5.9.2: same player reached us over a second signalling strategy
    const taken = new Set(Object.values(ONL.peers).map(p => p.row)), rows = lobbyRead();
    let row = rows.findIndex((r, i) => r[0] === 'remote' && !taken.has(i));
    if (row < 0) row = rows.findIndex((r, i) => i !== ONL.meRow && r[0] === 'off'); if (row >= 0 && rows[row][0] === 'off') { rows[row][0] = 'remote'; lobbySet(rows); }
    if (row < 0) { ONL.acts.kick({ reason: 'Lobby is full — the host needs to set a slot to "Remote player" (or open a new room).', code: 'full' }, pid); return; }
    ONL.peers[pid] = { name: String(d.name || 'Guest').slice(0, 16), row, ready: false, cid: d.cid }; onlChatLine(`* ${ONL.peers[pid].name} joined (slot ${row + 1})`); onlBroadcastLobby();
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
  const rows = lobbyRead(); rows.forEach((r, i) => { if (r[0] === 'remote' && !Object.values(ONL.peers).some(p => p.row === i)) r[0] = 'si'; }); lobbySet(rows);
  const names = { [Math.max(0, rows.findIndex(r => r[0] === 'human'))]: ONL.name }; for (const p of Object.values(ONL.peers)) names[p.row] = p.name;
  const slots = buildSlots(rows, names, lobbyOpts().map), seed = (Math.random() * 1e9) | 0;
  const peerTeam = {}; for (const pid in ONL.peers) { const k = slots.findIndex(s => s.row === ONL.peers[pid].row); if (k >= 0) peerTeam[pid] = k; }
  const me = slots.findIndex(s => s.local), humans = slots.map((s, i) => !s.ai ? i : -1).filter(i => i >= 0);
  const gopt = lobbyOpts(); ONL.acts.start({ seed, slots, peerTeam, humans, host: ONL.selfId, map: gopt.map, peace: gopt.peace, fog: gopt.fog });
  ONL.started = true; onlBegin({ seed, slots, me, humans, peerTeam, host: true, hostPeer: ONL.selfId, map: gopt.map, peace: gopt.peace, fog: gopt.fog });
}
// ---- client ----
function onlJoin(code) {
  if (!onlAvailable()) { onlError('Online play unavailable (the network library failed to load). Reload the page; if it keeps happening, disable ad-blockers for this site.', false); return; }
  onlVersionCheck(); code = onlParseCode(code); if (!code) { onlError('Type the 5-letter room code (or paste the invite link) first.', false); return; }
  ONL.host = false; ONL.name = onlName(); onlJoinRoom(code); onlShowPanel(true);
  document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); document.getElementById('startBtn').style.display = 'none';
  ONL.joinT0 = Date.now(); clearTimeout(ONL.reachT); clearInterval(ONL.reachI);
  // v5.9.2: tell the joiner which stage is failing: matchmaking (signalling) vs the direct WebRTC connection
  // v7.6.3: staged join: direct WebRTC first (via nostr/mqtt/torrent signalling), then the WebSocket relay after ~8s, then a clear error + Retry at 30s
  ONL.reachI = setInterval(() => { if (ONL.hostId || ONL.started) { clearInterval(ONL.reachI); return; } const sec = (Date.now() - ONL.joinT0) / 1000, sig = RTCDIAG.remoteOffer + RTCDIAG.remoteAnswer;
    const rs = ONL.room && ONL.room.subs && ONL.room.subs.find(x => x.s === 'relay'), relayOn = rs && rs.room.isActive && rs.room.isActive(), relayUp = rs && rs.room.brokersUp ? rs.room.brokersUp() : 0;
    if (sec < 30) { onlStatus(relayOn ? `Room <b>${code}</b>: ${sig ? 'found the host, but a direct connection is blocked by one of your networks' : 'no direct route to the host yet'} — trying the relay server (${relayUp ? relayUp + ' relay server' + (relayUp > 1 ? 's' : '') + ' connected' : 'connecting'})… (${sec | 0}s)`
        : sig ? `Room <b>${code}</b>: host found via matchmaking — opening a direct connection… (${sec | 0}s)` : `Joining room <b>${code}</b>… looking for the host (${sec | 0}s)`); return; }
    clearInterval(ONL.reachI);
    if (rs && !relayUp) onlError(`Can't reach any matchmaking or relay server for room <b>${code}</b>. Your network or an ad-blocker/firewall is blocking WebSocket servers. Turn off VPN / ad-blocker for this site or try mobile data, then press Retry.`);
    else if (sig) onlError(`Found the host of room <b>${code}</b> but could not connect (direct connection blocked and the relay got no answer). Make sure the host is still on the lobby screen with this room open and that you both have the same version (both reload), then press Retry.`);
    else onlError(`Can't find the host of room <b>${code}</b>. Check: 1) the code is right and the host still has the lobby open (if they closed it, they need to host again and send the new code); 2) you both have the same version — both reload the page / reopen the home-screen app. Then press Retry.`); }, 1000);
  ONL.handlers.lobby = (st, pid) => { if (ONL.kicked) return; ONL.hostId = pid; clearTimeout(ONL.reachT); clearInterval(ONL.reachI); lobbySet(st.rows); document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); onlRenderPeers(st);
    const mine = st.peers[ONL.selfId]; onlStatus(`Room <b>${code}</b> — host <b>${st.hostName}</b>. ${mine ? `You are slot ${mine.row + 1}. Pick your faction/colour, then press Ready.` : 'Waiting for a slot…'} <span class="dim">(${ONL.strategy === 'relay' ? 'connected via relay server — a direct connection was blocked' : 'direct connection'})</span>`); };
  ONL.handlers.kick = d => { clearInterval(ONL.reachI); ONL.kicked = d; onlError(String(d.reason || 'The host refused the connection.').replace(/</g, '&lt;'), d.code !== 'version'); };
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
