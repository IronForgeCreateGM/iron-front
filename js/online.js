'use strict';
// ===== Online lobby over Trystero (Nostr signalling, WebRTC data channels) =====
// Host owns the lobby: assigns slots, broadcasts seed/slots/version, starts when everyone is ready (host can start anyway with confirm).
// v7.9.7: big Host game / Join with code, a large I'm Ready button for host and joiner, empty seats stay closed (no auto Hard AI).
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
  if (s === 'relay') conf.startDelay = ONL.host || ONL.started || onlHideIP() ? 0 : (q.get('strategies') === 'relay' ? 0 : +(q.get('relaydelay') || 8000)); // guests give direct WebRTC 8s to win first
  if (s === 'torrent') { const u = q.get('trackers') ? urls(q.get('trackers')) : cfg.trackerUrls; if (u) conf.relayConfig = { urls: u }; }
  return conf;
}
function onlJoinRoom(code) {
  const cfg = window.IRONFRONT_NET || {}, q = new URLSearchParams(location.search);
  if (q.get('turn')) { const [u, n, c] = q.get('turn').split(','); cfg.turnConfig = [{ urls: [u], username: n, credential: c }].concat(cfg.turnConfig || []); }
  onlEnsureRelay(); let want = (q.get('strategies') || (cfg.strategies || ['nostr', 'mqtt', 'torrent', 'relay']).join(',')).split(',').filter(s => window.Trystero[s]);
  if (onlHideIP() && q.get('transport') !== 'local') { want = window.Trystero.relay ? ['relay'] : []; if (!want.length) { onlError('“Hide my IP” needs the relay server, which is turned off or unavailable. Untick “Hide my IP” to connect directly.', false); return; } }
  const subs = []; for (const s of want) { try { const T = window.Trystero[s]; subs.push({ s, T, room: T.joinRoom(onlStrategyConf(s, cfg, q), 'room-' + code) }); } catch (e) { console.warn('strategy ' + s + ' failed to start', e); } }
  if (!subs.length) { onlStatus('Online play unavailable (no matchmaking strategy could start).'); return; }
  const host = ONL.host, via = {}; let chosen = null; ONL.strategies = subs.map(x => x.s); ONL.selfId = subs[0].T.selfId; ONL.code = code;
  const commit = (sub, pid) => { if (chosen) return; chosen = sub; if (!host && pid) ONL.hostLock = pid; ONL.selfId = sub.T.selfId; ONL.strategy = sub.s; try { window.IF_AN && IF_AN.mpConnect(true, sub.s); } catch (e) {} setTimeout(() => { for (const o of subs) if (o !== sub) { try { o.room.leave(); } catch (e) {} } }, 1500); };
  const live = sub => host || !chosen || chosen === sub;
  const room = { getPeers: () => { const o = {}; for (const x of subs) if (live(x)) Object.assign(o, x.room.getPeers()); return o; }, leave: () => subs.forEach(x => { try { x.room.leave(); } catch (e) {} }), subs };
  ONL.room = room;
  for (const name of ['lobby', 'hello', 'ready', 'pref', 'chat', 'start', 'kick', 'in', 'turn', 'hash', 'desync', 'pg', 'po', 'sync', 'rejoin']) {
    const sends = subs.map(sub => { const a = sub.room.makeAction(name); const send = Array.isArray(a) ? (d, to) => a[0](d, to || null) : (d, to) => a.send(d, to ? { target: to } : undefined);
      const onm = (d, pid) => { if (!host && !chosen && ((name === 'lobby' && d && d.peers && typeof d.peers === 'object' && Object.prototype.hasOwnProperty.call(d.peers, sub.T.selfId)) || (name === 'sync' && ONL.started && NET.recon && d && d.full))) commit(sub, pid); /* v7.9.8: a reconnecting guest commits to the route the host resync came over */ if (!live(sub)) return; via[pid] = via[pid] || sub; onlDispatch(name, d, pid); };
      if (Array.isArray(a)) a[1]((d, pid) => onm(d, pid)); else a.onMessage = (d, meta) => onm(d, meta && meta.peerId || meta);
      return { sub, send }; });
    ONL.acts[name] = (d, to) => { if (to) { const v = via[to]; const t = v ? sends.find(x => x.sub === v) : null; (t ? [t] : sends.filter(x => live(x.sub))).forEach(x => x.send(d, to)); } else sends.filter(x => live(x.sub)).forEach(x => x.send(d)); };
  }
  for (const sub of subs) { const r = sub.room;
    const pj = pid => { if (!live(sub)) return; via[pid] = sub; ONL.stratSeen = sub.s; onlPeerJoin(pid, sub); }, pl = pid => { if (via[pid] !== sub) return; delete via[pid]; onlPeerLeave(pid); };
    if (typeof r.onPeerJoin === 'function' && r.onPeerJoin.length) { try { r.onPeerJoin(pj); r.onPeerLeave(pl); } catch (e) { r.onPeerJoin = pj; r.onPeerLeave = pl; } } else { r.onPeerJoin = pj; r.onPeerLeave = pl; } }
}
// v7.7.6 multiplayer security: every message from another player passes through here.
//  - only known message types; size cap per type; per-player rate limit (token bucket) per type
//  - on a guest, once the host is known, messages from anyone else are ignored (other guests can't impersonate the host)
//  - the host never accepts host-only messages (lobby/start/turn/sync/…) from guests
//  - each handler runs inside try/catch: a malformed message is dropped and never crashes the game
// limits: [max JSON chars, refill per second, burst, 'H' = host-only]
const ONL_LIMITS = { lobby: [65536, 20, 40, 'H'], hello: [2048, 2, 6], ready: [256, 5, 10], pref: [512, 5, 10], chat: [1024, 3, 6], start: [4194304, 2, 4, 'H'], kick: [4096, 2, 4, 'H'],
  in: [262144, 60, 150], mg: [262144, 2, 4], turn: [1048576, 90, 300, 'H'], hash: [512, 10, 20], desync: [512, 2, 4, 'H'], pg: [256, 5, 10, 'H'], po: [256, 5, 10], sync: [33554432, 2, 4, 'H'], rejoin: [1024, 2, 4] };
const ONL_SEC = { dropped: 0, errors: 0, rate: {}, why: {} };
function onlSecDrop(why) { ONL_SEC.dropped++; ONL_SEC.why[why] = (ONL_SEC.why[why] || 0) + 1; return false; }
function onlAccept(name, d, pid) {
  const L = ONL_LIMITS[name]; if (!L || !Object.prototype.hasOwnProperty.call(ONL_LIMITS, name)) return onlSecDrop('type');
  if (d == null || typeof d !== 'object' || Array.isArray(d)) return onlSecDrop('shape');
  if (ONL.host) { if (L[3] === 'H') return onlSecDrop('hostonly'); }
  else if (ONL.hostLock) { if (pid !== ONL.hostLock && !(name === 'mg' && ONL.started && ONL.peers[pid])) return onlSecDrop('nothost'); } // v7.9.5: a migration report may reach the next host just before it learns the old host left // locked once the host admitted us (or the match started)
  else if (!(name === 'lobby' || name === 'kick' || name === 'sync' || (name === 'chat' && pid === ONL.hostId))) return onlSecDrop('nohost');
  const now = Date.now(), k = pid + '|' + name, b = ONL_SEC.rate[k] || (ONL_SEC.rate[k] = { t: now, v: L[2] });
  b.v = Math.min(L[2], b.v + (now - b.t) / 1000 * L[1]); b.t = now; if (b.v < 1) return onlSecDrop('rate'); b.v -= 1;
  let n = 0; try { n = JSON.stringify(d).length; } catch (e) { return onlSecDrop('json'); } if (n > L[0]) return onlSecDrop('size');
  return true;
}
function onNetMigrate(nh, amHost) { ONL.hostId = nh; if (amHost) { ONL.host = true; ONL.hostLock = null; } else { ONL.host = false; ONL.hostLock = nh; } if (typeof QM !== 'undefined' && QM.state === 'started') QM.hostId = nh; } // v7.9.5 Quick Match host migration
// v7.9.8 reconnect: the guest lost the host mid-match. Wait a few seconds for the same connection to come back; if it doesn't,
// re-open the room over every route (direct + relay server, relay starts at once) and ask the host for a resync. Retried every 12 s.
function onNetHost(pid) { ONL.hostId = ONL.hostLock = pid; }
function onNetRecon(on) { clearTimeout(ONL.reconT); ONL.reconT = null; if (!on) return; if (ONL.host || !ONL.code) return;
  const again = () => { if (!NET.recon || !ONL.started) return; try { const old = ONL.room; ONL.hostLock = null; onlJoinRoom(ONL.code); if (old) setTimeout(() => { try { old.leave(); } catch (e) {} }, 0); } catch (e) { console.warn('[online] reconnect', e); } ONL.reconT = setTimeout(again, 12000); };
  ONL.reconT = setTimeout(again, 5000); }
function onlDispatch(name, d, pid) { const h = ONL.handlers[name]; if (!h || !onlAccept(name, d, pid)) return;
  try { h(d, pid); } catch (e) { ONL_SEC.errors++; console.warn('[online] dropped a malformed ' + name + ' message', e && e.message); } }
// v7.7.6: "Hide my IP" = relay-only. No WebRTC (direct peer-to-peer) connection is ever opened, so other players never see
// your IP address; game traffic goes through the WebSocket relay server instead (it can be a little slower). Off by default.
function onlHideIP() { try { return localStorage.getItem('if_hideip') === '1'; } catch (e) { return false; } }
const onlTransport = { send(type, data, to) { ONL.acts[type] && ONL.acts[type](data, to); }, on(type, cb) { ONL.handlers[type] = cb; }, onLeave(cb) { ONL.leaveCbs.push(cb); } };
function onlPeerJoin(pid, sub) { if (!ONL.host) { onlStatus('Connected to a peer' + (sub ? ' via ' + sub.s : '') + ' — asking the host for a slot…'); ONL.cid = ONL.cid || Math.random().toString(36).slice(2, 12); ONL.acts.hello({ name: ONL.name, ver: codeHash(), nv: NET_VERSION, cid: ONL.cid }, pid); } else onlChatLine('* a player is connecting' + (sub ? (sub.s === 'relay' ? ' via the relay server' : ' directly (via ' + sub.s + ' matchmaking)') : '') + '…'); }
function onlPeerLeave(pid) {
  if (ONL.started) { ONL.leaveCbs.forEach(f => f(pid)); return; }
  if (ONL.host && ONL.peers[pid]) { delete ONL.peers[pid]; onlBroadcastLobby(); onlChatLine('* a player left'); }
  if (!ONL.host && pid === ONL.hostId) { ONL.hostId = null; onlError('The host left the lobby (or their connection dropped). Ask them to keep the lobby open, then press Retry.'); }
}
// v7.9.24: share links from the App Store app must be the public https game, not capacitor://localhost/ (see js/extlinks.js)
function onlGameUrl() { return (typeof IF_LINKS !== 'undefined' && IF_LINKS.gameUrl) ? IF_LINKS.gameUrl() : location.origin + location.pathname; }
const onlInApp = () => typeof IF_LINKS !== 'undefined' && !!IF_LINKS.isApp && IF_LINKS.isApp();
function onlCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[(Math.random() * A.length) | 0]; return s; }
// v7.6.3: accept a pasted invite link, spaces, dashes and lower case in the join box
function onlParseCode(v) { v = String(v || '').trim(); const m = /[?&#]room=([A-Za-z0-9]+)/.exec(v); if (m) v = m[1]; return v.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8); }
// v7.6.3: errors are shown in red on screen with Retry + Reload buttons (never silent)
function onlError(html, retry) { const code = ONL.code; onlStatus(`<div class="onErr">❌ ${html}</div><div class="onErrBtns">${retry !== false && code ? '<button id="onRetry">↻ Retry</button> ' : ''}<button id="onReload">⟳ ${onlInApp() ? 'Restart' : 'Reload page'}</button> <span class="dim">[${typeof NET_VERSION !== 'undefined' ? NET_VERSION : ''}${ONL.strategy ? ' · ' + ONL.strategy : ''}]</span></div>`);
  const r = document.getElementById('onRetry'); if (r) r.onclick = () => onlRetry(); const l = document.getElementById('onReload'); if (l) l.onclick = () => onlHardReload(); console.warn('[online] ' + String(html).replace(/<[^>]+>/g, '')); }
function onlLeaveRoom() { clearInterval(ONL.reachI); clearTimeout(ONL.reachT); try { ONL.room && ONL.room.leave(); } catch (e) {} ONL.room = null; ONL.peers = {}; ONL.hostId = null; ONL.hostLock = null; ONL_SEC.rate = {}; ONL.started = false; ONL.ready = false; ONL.acts = {}; ONL.handlers = {}; ONL.leaveCbs = []; ONL.strategy = null; ONL.kicked = null;
  if (typeof RTCDIAG !== 'undefined') Object.keys(RTCDIAG).forEach(k => RTCDIAG[k] = 0); onlResetReadyBtn(); }
function onlRetry() { const code = ONL.code, host = ONL.host; onlLeaveRoom(); onlShowPanel(false); document.querySelectorAll('#lobby select').forEach(s => s.disabled = false); onlHostStartVisible(false);
  setTimeout(() => host ? onlHost(code) : onlJoin(code), 400); }
function onlHardReload() { const q = new URLSearchParams(location.search); q.set('v', Date.now().toString(36)); if (ONL.code && !ONL.host && !q.get('room')) q.set('room', ONL.code); location.replace(location.pathname + '?' + q.toString()); }
// v7.6.3: 'new version available' check (version.json is fetched with no-store, so a cached old page notices it is stale)
function onlVersionCheck() { if (typeof fetch !== 'function' || location.protocol === 'file:') return; fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !j.v || j.v === NET_VERSION || document.getElementById('verBanner')) return; const b = document.createElement('div'); b.id = 'verBanner';
    b.innerHTML = `🔄 A newer version of Iron Front (<b>${j.v}</b>) is available — you have ${NET_VERSION}. Online games need both players on the same version. <button id="verReload">Reload now</button> <button id="verX">✕</button>`;
    document.body.appendChild(b); document.getElementById('verReload').onclick = () => onlHardReload(); document.getElementById('verX').onclick = () => b.remove(); }).catch(() => {}); }
function onlStatus(t) { const e = document.getElementById('onStatus'); if (e) e.innerHTML = t; }
function onlChatLine(t, from) { // v7.9.11: lines go through js/chatsafe.js (word filter, per-player mute, chat on/off)
  if (typeof chatAddLine === 'function') { chatAddLine(t, from); return; }
  const e = document.getElementById('chatLog'); if (!e) return; const d = document.createElement('div'); d.textContent = t; e.appendChild(d); e.scrollTop = 1e9; }
const onlChatClean = m => typeof chatFilter === 'function' ? chatFilter(m) : m;
function onlName() { const v = netSafeName(document.getElementById('pname').value, ''); if (v) localStorage.setItem('if_name', v); return v || 'Commander' + ((Math.random() * 90 + 10) | 0); }
function onlResetReadyBtn() { const rb = document.getElementById('readyBtn'); if (rb) { rb.textContent = "I'm Ready"; rb.classList.remove('on'); } }
function onlHostStartVisible(on) {
  // v7.9.7: Start is large and stays on screen, but only once a friend has actually joined (so two hosts don't sit waiting in empty rooms)
  const hasHuman = Object.keys(ONL.peers || {}).length > 0;
  const os = document.getElementById('onStartBtn'), ab = document.getElementById('onSlotBtns');
  if (os) os.style.display = (on && hasHuman) ? '' : 'none';
  if (ab) ab.style.display = on ? '' : 'none';
}
function onlShowCode(code, link) {
  ONL.invite = link || ''; if (code) ONL.code = code;
  const box = document.getElementById('onCodeBox'), val = document.getElementById('onCodeVal'), a = document.getElementById('onInviteA');
  if (val) val.textContent = code || '';
  if (box) box.style.display = code ? 'flex' : 'none';
  if (a) { if (link) { a.href = link; a.textContent = link; a.style.display = 'block'; } else { a.removeAttribute('href'); a.textContent = ''; a.style.display = 'none'; } }
}
function onlCopyText(text, btn) {
  text = String(text || ''); if (!text) return;
  const done = ok => { if (btn) { const t = btn.textContent; btn.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { btn.textContent = t; }, 1600); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true)).catch(() => { try { const i = document.createElement('input'); i.value = text; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); done(true); } catch (e) { done(false); } });
  else done(false);
}
function onlOccupied() { const s = new Set(); if (ONL.meRow != null && ONL.meRow >= 0) s.add(ONL.meRow); for (const p of Object.values(ONL.peers || {})) if (p && p.row != null) s.add(p.row | 0); return s; }
function onlFfaMap() { const ms = document.getElementById('mapSel'), mv = ms && ms.value; return mv === 'razorwheel' || mv === 'shatteredmoon' || mv === 'deltakings' || mv === 'labyrinth' || mv === 'riftcanyon'; }
function onlPrepHostSlots() { // v7.9.7: You + one open seat; leftover AI rows close so an 8-player map is not 1v7 Hard AI
  const rows = lobbyRead();
  let me = rows.findIndex(r => r[0] === 'human'); if (me < 0) { me = 0; rows[0][0] = 'human'; }
  rows.forEach((r, i) => { if (i !== me && r[0] === 'human') r[0] = 'off'; });
  let remote = rows.findIndex((r, i) => i !== me && r[0] === 'remote');
  if (remote < 0) remote = rows.findIndex((r, i) => i !== me);
  rows.forEach((r, i) => {
    if (i === me) r[0] = 'human';
    else if (i === remote) { r[0] = 'remote'; if (onlFfaMap() && typeof TEAM_LET === 'string') r[1] = TEAM_LET[i] || r[1]; }
    else r[0] = 'off';
  });
  lobbySet(rows); ONL.meRow = me;
}
function onlCloseEmptyRemotes() {
  const rows = lobbyRead(), taken = onlOccupied(); let changed = false;
  rows.forEach((r, i) => { if (!taken.has(i) && r[0] === 'remote') { r[0] = 'off'; changed = true; } });
  if (changed) lobbySet(rows);
}
function onlFirstClosed() { const taken = onlOccupied(), rows = lobbyRead(); return rows.findIndex((r, i) => r[0] === 'off' && !taken.has(i)); }
function onlAddSlot(type) {
  if (!ONL.host || ONL.started) return; const rows = lobbyRead(), i = onlFirstClosed(); if (i < 0) { onlChatLine('* no closed slot left to open'); return; }
  rows[i][0] = type; if (onlFfaMap() && typeof TEAM_LET === 'string') rows[i][1] = TEAM_LET[i] || rows[i][1];
  lobbySet(rows); onlBroadcastLobby();
}
function onlNotReadyNames() {
  const need = Object.values(ONL.peers).filter(p => !p.ready).map(p => p.name);
  if (!ONL.ready) need.unshift(ONL.name || 'Host');
  return need;
}
function onlSetReady(on, fromPeer) {
  ONL.ready = !!on;
  const rb = document.getElementById('readyBtn');
  if (rb) { rb.textContent = ONL.ready ? "✔ I'm Ready" : "I'm Ready"; rb.classList.toggle('on', ONL.ready); rb.style.display = ''; }
  if (fromPeer) return;
  if (ONL.host) onlBroadcastLobby();
  else if (ONL.acts.ready) ONL.acts.ready({ r: ONL.ready });
}
function onlDockReadyBar(on) {
  const row = document.getElementById('onReadyRow'), home = document.getElementById('onPanel');
  if (!row) return;
  if (on) { document.body.appendChild(row); row.classList.add('onReadyFixed'); }
  else {
    row.classList.remove('onReadyFixed');
    if (home) { const chat = document.getElementById('chatLog'); if (chat && chat.parentNode === home) home.insertBefore(row, chat); else home.appendChild(row); }
  }
}
function onlShowPanel(on) {
  ['hostBtn', 'joinBtn'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = on; });
  const p = document.getElementById('onPanel'); if (p) p.style.display = on ? 'block' : 'none';
  const pr = document.getElementById('presets'); if (pr) pr.style.display = on ? 'none' : '';
  const su = document.getElementById('setup'); if (su) su.classList.toggle('onlineOn', !!on);
  const box = document.getElementById('onBox'); if (box) box.classList.toggle('inRoom', !!on);
  const jc = document.getElementById('joinCode'); if (jc) jc.disabled = on;
  if (!on) { onlDockReadyBar(false); onlShowCode(''); onlHostStartVisible(false); onlResetReadyBtn(); }
  else { onlDockReadyBar(true); const rb = document.getElementById('readyBtn'); if (rb) rb.style.display = ''; }
}
// ---- host ----
function onlHost(keep) {
  if (!onlAvailable()) { onlError('Online play unavailable (the network library failed to load). Reload the page; if it keeps happening, disable ad-blockers for this site.', false); return; }
  onlVersionCheck(); ONL.host = true; ONL.ready = false; ONL.name = onlName(); const code = keep || onlCode(); onlJoinRoom(code);
  onlPrepHostSlots();
  onlShowPanel(true); onlHostStartVisible(true); onlSetReady(false, true);
  const _q = new URLSearchParams(location.search), _x = ['relays', 'mqtt', 'trackers', 'strategies', 'turn'].filter(k => _q.get(k)).map(k => '&' + k + '=' + encodeURIComponent(_q.get(k))).join(''); const link = onlGameUrl() + '?room=' + code + _x + (onlHideIP() && !_q.get('strategies') ? '&strategies=relay' : ''); // share link keeps signalling/TURN overrides
  onlShowCode(code, link);
  onlStatus(`Share this room code with your friend, or send the invite link. ${onlHideIP() ? '<span class="dim">(🛡 IP hidden: relay only)</span> ' : ''}${location.protocol === 'file:' ? '⚠ Hosting from file:// — friends must open the same game build via https.' : ''}`);
  ONL.handlers.hello = (d, pid) => {
    if (ONL.started) { if (d.ver === codeHash() && NET.rejoinReq(pid, netSafeName(d.name), typeof d.cid === 'string' ? d.cid.slice(0, 24) : null)) onlChatLine('* ' + netSafeName(d.name) + ' rejoined'); else ONL.acts.kick({ reason: 'Match already running (no free slot to rejoin).' }, pid); return; }
    if (d.ver !== codeHash()) { ONL.acts.kick({ reason: 'Version mismatch — the host has ' + NET_VERSION + ', you have ' + String(d.nv || 'an older version').slice(0, 24) + '. Both players: reload the page (iPhone home-screen app: close it fully and reopen), then join again.', code: 'version', hv: NET_VERSION }, pid); onlChatLine('* ' + netSafeName(d.name, 'A player') + ' tried to join with ' + String(d.nv || 'an older version').slice(0, 24) + ' (you have ' + NET_VERSION + ') — they need to reload'); return; }
    const cid = typeof d.cid === 'string' ? d.cid.slice(0, 24) : null; if (cid && Object.values(ONL.peers).some(p => p.cid === cid)) return; // v5.9.2: same player reached us over a second signalling strategy
    const taken = new Set(Object.values(ONL.peers).map(p => p.row)), rows = lobbyRead();
    let row = rows.findIndex((r, i) => r[0] === 'remote' && !taken.has(i));
    if (row < 0) { ONL.acts.kick({ reason: 'Lobby is full — the host needs to press “Open a slot for a friend”.', code: 'full' }, pid); return; }
    ONL.peers[pid] = { name: netSafeName(d.name), row, ready: false, cid }; onlChatLine(`* ${ONL.peers[pid].name} joined (slot ${row + 1})`);
    onlCloseEmptyRemotes(); onlBroadcastLobby();
  };
  ONL.handlers.ready = (d, pid) => { if (ONL.peers[pid]) { ONL.peers[pid].ready = !!d.r; onlBroadcastLobby(); } };
  ONL.handlers.pref = (d, pid) => { const p = ONL.peers[pid]; if (!p) return; const rows = lobbyRead(); const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); if (own(FACTIONS, d.fac)) rows[p.row][2] = d.fac; if (own(TEAM_COLORS, d.color) && !rows.some((r, i) => i !== p.row && r[3] === d.color)) rows[p.row][3] = d.color; lobbySet(rows); onlBroadcastLobby(); };
  ONL.handlers.chat = (d, pid) => { const n = ONL.peers[pid] ? ONL.peers[pid].name : null, m = String(d.m == null ? '' : d.m).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140); if (!n || !m) return; const f = onlChatClean(m); onlChatLine(n + ': ' + f, n); ONL.acts.chat({ m: f, n }); };
  onlBroadcastLobby();
}
function lobbyChanged() { if (ONL.host && !ONL.started) onlBroadcastLobby(); }
function onlBroadcastLobby() {
  if (!ONL.room) return; const rows = lobbyRead();
  const st = { rows, peers: ONL.peers, hostName: ONL.name, hostRow: ONL.meRow, hostReady: !!ONL.ready, ver: codeHash() };
  ONL.acts.lobby(st); onlRenderPeers(st);
  // v7.9.7: Start stays clickable; if someone is not ready the host confirms. Empty remotes stay closed (they do not become Hard AI).
  const notReady = onlNotReadyNames(), label = notReady.length ? 'Start anyway' : 'Start game';
  const sb = document.getElementById('startBtn'), os = document.getElementById('onStartBtn');
  if (sb) { sb.disabled = false; sb.textContent = label; }
  if (os) { os.disabled = false; os.textContent = label; }
  if (ONL.host) onlHostStartVisible(true);
}
function onlPeerStatus(ready, isHost, isYou) {
  const tag = isHost ? 'host' : 'connected';
  const st = ready ? "✔ Ready" : (isYou ? "Pick your faction, then press I'm Ready" : "Not ready");
  return { tag, st, cls: ready ? 'ready' : 'wait' };
}
function onlRenderPeers(st) {
  const e = document.getElementById('onPeers'); if (!e) return;
  const hr = (st.hostRow != null ? st.hostRow : (st.rows ? st.rows.findIndex(r => r[0] === 'human') : 0)) | 0;
  const peers = st.peers || {}, open = st.rows ? st.rows.map((r, i) => r[0] === 'remote' && !Object.values(peers).some(p => p.row === i) ? i : -1).filter(i => i >= 0) : [];
  const ai = st.rows ? st.rows.map((r, i) => (r[0] === 'si' || r[0] === 'easy' || r[0] === 'normal') ? i : -1).filter(i => i >= 0) : [];
  const hostReady = st.hostReady != null ? !!st.hostReady : (ONL.host && ONL.ready);
  const hs = onlPeerStatus(hostReady, true, ONL.host);
  let html = `<div class="onPeer"><span class="who">Slot ${hr + 1}: <b>${netEsc(netSafeName(st.hostName, 'Host'))}</b> · ${hs.tag}${ONL.host ? ' · you' : ''}</span><span class="st ${hs.cls}">${hs.st}</span></div>`;
  html += Object.values(peers).map(p => { const me = !ONL.host && ONL.selfId && peers[ONL.selfId] === p; const s = onlPeerStatus(!!p.ready, false, me); return `<div class="onPeer"><span class="who">Slot ${(p.row | 0) + 1}: <b>${netEsc(netSafeName(p.name))}</b> · ${s.tag}${me ? ' · you' : ''}</span><span class="st ${s.cls}">${s.st}</span></div>`; }).join('');
  html += open.map(i => `<div class="onPeer"><span class="who dim">Slot ${i + 1}: open for a friend</span><span class="st open">Waiting</span></div>`).join('');
  html += ai.map(i => { const typ = st.rows[i][0]; const nm = typ === 'easy' ? 'Easy AI' : typ === 'normal' ? 'Medium AI' : 'Hard AI'; return `<div class="onPeer"><span class="who dim">Slot ${i + 1}: ${nm}</span><span class="st ai">AI</span></div>`; }).join('');
  e.innerHTML = html;
}
function onlStartHost() {
  // v7.9.7: if someone has not pressed I'm Ready, the host can still start after confirming
  const notReady = onlNotReadyNames();
  if (notReady.length && !confirm('Not everyone is ready yet (' + notReady.join(', ') + '). Start the match anyway?')) return;
  if (!ONL.ready) onlSetReady(true, true);
  // v7.8.5: host You-row cannot start as a locked country without Full Unlock (bots/remotes unrestricted)
  { const rows0 = lobbyRead(), me = rows0.find(r => r[0] === 'human'); if (me && typeof unlockHumanRowOk === 'function' && !unlockHumanRowOk(me)) { if (typeof unlockOffer === 'function') unlockOffer(me[2]); return; } } { const ms = document.getElementById('mapSel'), mv = MENU.mode === 'endless' ? 'endless' : ms ? ms.value : 'classic'; if (typeof unlockMapOk === 'function' && !unlockMapOk(mv)) { if (typeof unlockOfferMap === 'function') unlockOfferMap(mv); return; } } // v7.8.9 map gate (host pick only)
  const rows = lobbyRead(); rows.forEach((r, i) => { if (r[0] === 'remote' && !Object.values(ONL.peers).some(p => p.row === i)) r[0] = 'off'; }); lobbySet(rows);
  const names = { [Math.max(0, rows.findIndex(r => r[0] === 'human'))]: ONL.name }; for (const p of Object.values(ONL.peers)) names[p.row] = p.name;
  const slots = buildSlots(rows, names, lobbyOpts().map), seed = (Math.random() * 1e9) | 0;
  const peerTeam = {}; for (const pid in ONL.peers) { const k = slots.findIndex(s => s.row === ONL.peers[pid].row); if (k >= 0) peerTeam[pid] = k; }
  const me = slots.findIndex(s => s.local), humans = slots.map((s, i) => !s.ai ? i : -1).filter(i => i >= 0);
  const gopt = lobbyOpts(); ONL.acts.start({ seed, slots, peerTeam, humans, host: ONL.selfId, map: gopt.map, cmap: gopt.cmap, peace: gopt.peace, fog: gopt.fog });
  const teamCid = {}; for (const pid in ONL.peers) if (peerTeam[pid] != null && ONL.peers[pid].cid) teamCid[peerTeam[pid]] = ONL.peers[pid].cid;
  ONL.started = true; onlBegin({ seed, slots, me, humans, peerTeam, teamCid, host: true, hostPeer: ONL.selfId, map: gopt.map, cmap: gopt.cmap, peace: gopt.peace, fog: gopt.fog });
}
// ---- client ----
function onlJoin(code) {
  if (!onlAvailable()) { onlError('Online play unavailable (the network library failed to load). Reload the page; if it keeps happening, disable ad-blockers for this site.', false); return; }
  onlVersionCheck(); code = onlParseCode(code); if (!code) { onlError('Type the 5-letter room code (or paste the invite link) first.', false); return; }
  ONL.host = false; ONL.ready = false; ONL.name = onlName(); onlJoinRoom(code); onlShowPanel(true); onlHostStartVisible(false); onlSetReady(false, true); onlShowCode(code);
  document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); const sb = document.getElementById('startBtn'); if (sb) sb.style.display = 'none';
  ONL.joinT0 = Date.now(); clearTimeout(ONL.reachT); clearInterval(ONL.reachI);
  // v5.9.2: tell the joiner which stage is failing: matchmaking (signalling) vs the direct WebRTC connection
  // v7.6.3: staged join: direct WebRTC first (via nostr/mqtt/torrent signalling), then the WebSocket relay after ~8s, then a clear error + Retry at 30s
  ONL.reachI = setInterval(() => { if (ONL.hostId || ONL.started) { clearInterval(ONL.reachI); return; } const sec = (Date.now() - ONL.joinT0) / 1000, sig = RTCDIAG.remoteOffer + RTCDIAG.remoteAnswer;
    const rs = ONL.room && ONL.room.subs && ONL.room.subs.find(x => x.s === 'relay'), relayOn = rs && rs.room.isActive && rs.room.isActive(), relayUp = rs && rs.room.brokersUp ? rs.room.brokersUp() : 0;
    if (sec < 30) { onlStatus(relayOn ? `Room <b>${code}</b>: ${sig ? 'found the host, but a direct connection is blocked by one of your networks' : 'no direct route to the host yet'} — trying the relay server (${relayUp ? relayUp + ' relay server' + (relayUp > 1 ? 's' : '') + ' connected' : 'connecting'})… (${sec | 0}s)`
        : sig ? `Room <b>${code}</b>: host found via matchmaking — opening a direct connection… (${sec | 0}s)` : `Joining room <b>${code}</b>… looking for the host (${sec | 0}s)`); return; }
    clearInterval(ONL.reachI);
    try { window.IF_AN && IF_AN.mpConnect(false, relayOn ? 'relay' : 'direct', rs && !relayUp ? 'no_servers' : sig ? 'connect_blocked' : 'host_not_found'); } catch (e) {} // v7.7.4: anonymous analytics
    if (rs && !relayUp) onlError(`Can't reach any matchmaking or relay server for room <b>${code}</b>. Your network or an ad-blocker/firewall is blocking WebSocket servers. Turn off VPN / ad-blocker for this site or try mobile data, then press Retry.`);
    else if (sig) onlError(`Found the host of room <b>${code}</b> but could not connect (direct connection blocked and the relay got no answer). Make sure the host is still on the lobby screen with this room open and that you both have the same version (both reload), then press Retry.`);
    else onlError(`Can't find the host of room <b>${code}</b>. Check: 1) the code is right and the host still has the lobby open (if they closed it, they need to host again and send the new code); 2) you both have the same version — both reload the page / reopen the home-screen app. Then press Retry.`); }, 1000);
  ONL.handlers.lobby = (st, pid) => { if (ONL.kicked || !onlValidLobby(st)) return; ONL.hostId = pid; clearTimeout(ONL.reachT); clearInterval(ONL.reachI); lobbySet(st.rows); document.querySelectorAll('#lobby select').forEach(s => s.disabled = true); onlShowCode(code); onlRenderPeers(st);
    const mine = st.peers[ONL.selfId]; const rb = document.getElementById('readyBtn'); if (rb) rb.style.display = '';
    if (mine && ONL.ready && !mine.ready && ONL.acts.ready) ONL.acts.ready({ r: true }); // resend if the host missed our Ready
    onlStatus(`Joined <b>${code}</b> — host <b>${netEsc(netSafeName(st.hostName, 'Host'))}</b>. ${mine ? `You are slot ${(mine.row | 0) + 1}. Pick your faction, then press I'm Ready.` : 'Waiting for a slot…'} ${ONL.strategy ? `<span class="dim">(${ONL.strategy === 'relay' ? 'connected via relay server — a direct connection was blocked' : 'direct connection'})</span>` : ''}`); };
  ONL.handlers.kick = d => { clearInterval(ONL.reachI); if (d.code === 'full' && !ONL.started && (ONL.fullTries = (ONL.fullTries || 0) + 1) <= 3) { onlStatus('The host\'s lobby still shows your old connection — retrying in a few seconds…'); clearTimeout(ONL.fullT); ONL.fullT = setTimeout(() => onlRetry(), 5000); return; } // v7.9.8: refresh mid-lobby
    ONL.kicked = d; onlError(netEsc(String(d.reason || 'The host refused the connection.').slice(0, 400)), d.code !== 'version'); };
  ONL.handlers.chat = d => { const m = String(d.m == null ? '' : d.m).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140); if (m) { const n = netSafeName(d.n, '?'); onlChatLine(n + ': ' + m, n); } };
  ONL.handlers.sync = (d, pid) => { if (ONL.started || !d.full || !netValidSync(d) || !onlValidStart(d.opts)) return; ONL.started = true; ONL.hostId = ONL.hostLock = pid; const o = d.opts;
    onlBegin({ seed: o.seed, slots: o.slots, me: d.me, humans: d.humans, peerTeam: d.peerTeam, host: false, hostPeer: pid, map: o.map, cmap: o.cmap, peace: o.peace, fog: o.fog !== false }); NET._applySync(d); };
  ONL.handlers.start = (d, pid) => { if (ONL.started || !onlValidStart(d) || !d.peerTeam || typeof d.peerTeam !== 'object' || !Array.isArray(d.humans)) return; ONL.started = true; ONL.hostId = ONL.hostLock = pid; onlBegin({ seed: d.seed, slots: d.slots, me: d.peerTeam[ONL.selfId], humans: d.humans, peerTeam: d.peerTeam, host: false, hostPeer: pid, map: d.map, cmap: d.cmap, peace: d.peace, fog: d.fog !== false }); };
  const rb = document.getElementById('readyBtn'); if (rb) rb.style.display = '';
}
// v7.7.6: shape checks for the host's lobby and start packages (names are cleaned; nothing from a peer is ever run as code)
function onlValidLobby(st) {
  if (!st || !Array.isArray(st.rows) || st.rows.length > 16 || !st.peers || typeof st.peers !== 'object' || Array.isArray(st.peers)) return false;
  for (const r of st.rows) if (!Array.isArray(r) || r.length > 8 || !r.every(x => x == null || (typeof x === 'string' && x.length <= 24))) return false;
  const ps = Object.keys(st.peers); if (ps.length > 16) return false;
  for (const k of ps) { const p = st.peers[k]; if (NET_BADKEY[k] || !p || typeof p !== 'object' || !netInt(p.row, 0, 15)) return false; p.name = netSafeName(p.name); }
  st.hostName = netSafeName(st.hostName, 'Host'); if (st.hostRow != null && !netInt(st.hostRow, 0, 15)) return false; return true;
}
function onlValidStart(d) {
  if (!d || typeof d !== 'object' || !Number.isInteger(d.seed) || !Array.isArray(d.slots) || d.slots.length < 1 || d.slots.length > 16) return false;
  if (d.map != null && (typeof d.map !== 'string' || d.map.length > 40)) return false;
  if (d.humans && !d.humans.every(h => netInt(h, 0, 15))) return false;
  if (d.peerTeam) for (const k in d.peerTeam) if (NET_BADKEY[k] || !netInt(d.peerTeam[k], 0, 15)) return false;
  for (const s of d.slots) { if (!s || typeof s !== 'object' || Array.isArray(s)) return false; for (const k in s) if (NET_BADKEY[k]) return false;
    if (s.fac != null && (typeof s.fac !== 'string' || !Object.prototype.hasOwnProperty.call(FACTIONS, s.fac))) return false;
    if (s.name != null) s.name = netSafeName(s.name, 'Player'); }
  if (d.cmap != null) { if (typeof d.cmap !== 'object') return false; if (d.cmap.name != null) d.cmap.name = String(d.cmap.name).replace(/[<>&"'`]/g, '').slice(0, 40); }
  return true;
}
function onlBegin(o) {
  onlDockReadyBar(false); // v7.9.7: don't leave the Ready/Start bar over the match
  ONL.leaveCbs = []; // fresh leave handlers for this match (NET.begin will re-register)
  if (o.me == null) { onlStatus('You were not assigned a slot.'); return; }
  audioInit(); document.getElementById('menu').style.display = 'none';
  startGame('normal', { slots: o.slots, seed: o.seed, me: o.me, map: o.map, cmap: o.cmap, peace: o.peace, fog: o.fog !== false, online: { tr: onlTransport, host: o.host, me: o.me, humans: o.humans, peerTeam: o.peerTeam, hostPeer: o.hostPeer, migrate: !!o.migrate, selfPid: o.selfPid || null, teamCid: o.teamCid || {}, cid: ONL.cid || null } });
  announce('Online match — lockstep ' + NET.DELAY + ' ticks', 'net0', 1);
}
function onlInitUI() {
  const pn = document.getElementById('pname'); if (!pn) return; pn.value = new URLSearchParams(location.search).get('name') || localStorage.getItem('if_name') || '';
  const hi = document.getElementById('hideIp'); if (hi) { hi.checked = onlHideIP(); hi.onchange = () => { try { localStorage.setItem('if_hideip', hi.checked ? '1' : '0'); } catch (e) {} }; }
  document.getElementById('hostBtn').onclick = () => onlHost();
  document.getElementById('joinBtn').onclick = () => onlJoin(document.getElementById('joinCode').value);
  const jc = document.getElementById('joinCode'); if (jc) jc.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('joinBtn').click(); } });
  document.getElementById('readyBtn').onclick = () => onlSetReady(!ONL.ready);
  const os = document.getElementById('onStartBtn'); if (os) os.onclick = () => { const sb = document.getElementById('startBtn'); if (sb) sb.click(); };
  const ai = document.getElementById('addAiBtn'); if (ai) ai.onclick = () => onlAddSlot('si');
  const op = document.getElementById('addOpenBtn'); if (op) op.onclick = () => onlAddSlot('remote');
  const cc = document.getElementById('copyCodeBtn'); if (cc) cc.onclick = () => onlCopyText(ONL.code, cc);
  const cl = document.getElementById('copyLinkBtn'); if (cl) cl.onclick = () => onlCopyText(ONL.invite || (ONL.code ? onlGameUrl() + '?room=' + ONL.code : ''), cl);
  document.getElementById('chatIn').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim() && ONL.room && (typeof chatEnabled !== 'function' || chatEnabled())) { const m = onlChatClean(e.target.value.trim().slice(0, 140)); e.target.value = ''; if (ONL.host) { onlChatLine(ONL.name + ': ' + m, ONL.name); ONL.acts.chat({ m, n: ONL.name }); } else ONL.acts.chat({ m }); } e.stopPropagation(); };
  if (typeof chatInitUi === 'function') chatInitUi();
  const code = new URLSearchParams(location.search).get('room'); if (code) { document.getElementById('joinCode').value = code; setTimeout(() => onlJoin(code), 50); }
}
