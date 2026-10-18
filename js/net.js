'use strict';
// ===== Commands + deterministic lockstep (host-relay) =====
// Every player action is a command {c:'move',...}. Offline: executed immediately.
// Online: tagged for tick (now + DELAY); the host collects every human's input for a tick,
// broadcasts the merged "turn", and all peers execute it before stepping that tick.
const NET_VERSION = 'v5.9.2';
const own = (T, ids) => (ids || []).map(byId).filter(e => e && e.team === T && e.hp > 0);
const CMD = {
  mbuild(T, c) { const b = byId(c.b); return !!(b && b.team === T && siloBuild(b, c.k)); },
  mlaunch(T, c) { const b = byId(c.b); return !!(b && b.team === T && siloLaunch(b, c.x, c.y)); },
  move(T, c) { const u = own(T, c.u); if (u.length) orderMove(u, c.x, c.y, !!c.am, !!c.q); },
  attack(T, c) { const u = own(T, c.u), t = byId(c.t); if (u.length && t) orderAttack(u, t); },
  form(T, c) { const u = own(T, c.u); if (u.length) orderFormation(u, c.x, c.y, c.a); },
  stance(T, c) { setStance(own(T, c.u), c.s); },
  enq(T, c) { let n = 0; for (let i = 0; i < (c.n || 1); i++) if (enqueue(T, c.t)) n++; return n; },
  cancel(T, c) { let n = 0; for (let i = 0; i < (c.n || 1); i++) if (cancel(T, c.t)) n++; return n; },
  place(T, c) { return !!placeReady(T, c.cat, c.x, c.y); },
  sell(T, c) { const b = byId(c.b); if (b && b.team === T) sellB(b); },
  repair(T, c) { const b = byId(c.b); if (b && b.team === T) b.repair = !!c.on; },
  rally(T, c) { for (const b of own(T, c.b)) b.rally = { x: c.x, y: c.y }; },
  board(T, c) { const tr = byId(c.tr); if (!tr || tr.team !== T) return false; orderBoard(c.u.map(byId).filter(u => u && u.team === T), tr); return true; },
  unload(T, c) { const tr = byId(c.tr); if (!tr || tr.team !== T || !tr.cargo) return false; orderUnload(tr, c.x, c.y); return true; },
  derrick(T, c) { orderDerrick(c.u.map(byId).filter(u => u && u.team === T), c.k); return true; },
  walls(T, c) { return buildWalls(T, c.t); },
  upg(T, c) { const b = byId(c.b); return !!(b && b.team === T && upgradeB(b)); },
  ping(T, c) { (G.pings = G.pings || []).push({ team: T, x: c.x, y: c.y, t: G.time, kind: c.k }); G.events.push({ e: 'ping', team: T, x: c.x, y: c.y, k: c.k }); },
  drop(T, c) { const P = G.players[c.p]; if (!P || P.ai) return; P.ai = true; P.diff = c.diff || 'normal'; P.name += ' (AI)'; aiInit(P); G.events.push({ e: 'dropped', team: c.p }); },
  retake(T, c) { const P = G.players[c.p]; if (!P || !P.ai) return; P.ai = false; P.name = c.n || P.name.replace(/ \(AI\)$/, ''); G.events.push({ e: 'rejoined', team: c.p }); },
  surrender(T, c) { const P = G.players[T]; if (!P || P.out) return; for (const e of G.ents) if (e.team === T && e.kind === 'b') e.hp = 0; },
};
// v5.2 replay recorder: every executed command is logged with the tick it ran at (+ periodic state hashes for verification)
const RPL = { on: false, data: null };
function recStart() { RPL.on = !G.replay; RPL.data = RPL.on ? { v: 1, game: 'ironfront', ver: typeof NET_VERSION !== 'undefined' ? NET_VERSION : '', date: new Date().toISOString(), seed: G.opts.seed, map: G.opts.map || 'classic', peace: G.opts.peace, fog: G.opts.fog !== false, diff: G.opts.diff, me: typeof ME !== 'undefined' ? ME : 0,
  slots: G.opts.slots.map(s => ({ ai: !!s.ai, diff: s.diff, ally: s.ally, fac: s.fac, color: s.color, start: s.start, name: s.name })), cmds: [], hash: [] } : null; }
function recHash() { if (RPL.on && RPL.data && G.tick % 900 === 0 && typeof stateHash === 'function') { RPL.data.hash.push([G.tick, stateHash()]); if (G.tick % 1800 === 0 && typeof localStorage !== 'undefined') try { localStorage.setItem('ifLastReplay', replayFile()); } catch (e) {} } }
function replayFeed() { const R = G.replay; while (R.i < R.cmds.length && R.cmds[R.i][0] <= G.tick) { const [, T, c] = R.cmds[R.i++]; execCmd(T, c); }
  if (G.tick % 900 === 0) { const h = R.hash.find(x => x[0] === G.tick); if (h && typeof stateHash === 'function') { const m = stateHash() === h[1]; R.checked++; if (!m && !R.bad) R.bad = G.tick; } } }
function replayFile() { if (!RPL.data) return null; RPL.data.len = G.tick; RPL.data.result = G.over || null; return JSON.stringify(RPL.data); }
function execCmd(T, c) { if (RPL.on && RPL.data && c && c.c !== 'chat') RPL.data.cmds.push([G.tick, T, c]); try { return CMD[c.c] ? CMD[c.c](T, c) : undefined; } catch (e) { console.error('cmd', c, e); } }

// ----- state hash (FNV-1a over exact float bits) -----
const _hb = new Float64Array(1), _hu = new Uint32Array(_hb.buffer);
function stateHash() {
  let h = 2166136261 >>> 0; const mix = v => { h ^= v; h = Math.imul(h, 16777619) >>> 0; };
  const f = v => { _hb[0] = v || 0; mix(_hu[0]); mix(_hu[1]); };
  mix(G.tick); mix(G.ents.length); mix(G.nid);
  for (const e of G.ents) { mix(e.id); f(e.x); f(e.y); f(e.hp); mix(e.team + 7); }
  for (const P of G.players) { f(P.cr); f(P.gas); mix(P.ai ? 1 : 0); }
  mix(G.projs.length); return h >>> 0;
}
function codeHash() { let h = 2166136261 >>> 0; const s = NET_VERSION + [newGame, stepGame, genMap, aiStep, harvest, damage, execCmd, dsin, datan2].map(f => String(f)).join('|'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }

// v5.5 netcode: host-relay lockstep with
//  - input batching: clients send one 'in' message per B ticks (commands + coverage "upto" tick + piggy-backed state hash)
//  - turn batching: the host broadcasts finalized ticks in compact batches {t, n, c:[[dt, team, cmd]]} (empty ticks cost nothing)
//  - adaptive per-peer input delay from measured RTT/jitter (ping/pong every second), raised at once, lowered gradually
//  - pacing: sim runs slightly slower when the turn buffer is thin and faster when it has piled up (no hard stalls on jitter)
//  - slow peer: "Waiting for X"; after NET.DROP_MS of silence the host hands that slot to AI (player can rejoin)
//  - desync recovery: host detects a hash mismatch and sends that peer the command log; the peer re-simulates from the seed
//  - reconnect: a dropped player re-opening the room gets the log, re-simulates to the present and takes their slot back
const NET = {
  online: false, host: false, me: 0, DELAY: 4, B: 2, DROP_MS: 20000, turns: new Map(), pending: [], humans: [], waitT: 0, waiting: null,
  hashes: new Map(), desync: null, log: [], tr: null, peerTeam: {}, teamPeer: {}, lastSent: 0, dropped: new Set(), status: '', resyncs: 0,
  stats: { sent: 0, recv: 0, bytes: 0 },
  now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); },
  issue(c) {
    if (typeof G !== 'undefined' && G.spectate && !G.replay) return false; // spectating a bot team: never command its units
    if (!this.online) return execCmd(ME, c);
    this.pending.push(c); return true;
  },
  _send(type, data, to) { this.stats.sent++; try { this.stats.bytes += JSON.stringify(data).length; } catch (e) {} this.tr.send(type, data, to); },
  begin(tr, opts) {
    Object.assign(this, { online: true, offline: false, tr, hostPeer: opts.hostPeer, status: '', host: opts.host, me: opts.me, humans: opts.humans.slice(), peerTeam: Object.assign({}, opts.peerTeam || {}), teamPeer: {},
      DELAY: 4, turns: new Map(), pending: [], batch: [], hashes: new Map(), desync: null, log: [], dropped: new Set(), lastSent: 0, maxTurn: 0, upto: {}, cin: new Map(), unsent: [], dropQ: [],
      rtt: {}, dl: {}, waitSince: {}, lastHeard: {}, syncAt: {}, syncN: {}, resyncs: 0, stats: { sent: 0, recv: 0, bytes: 0 }, gopts: JSON.parse(JSON.stringify(G.opts)) });
    for (const pid in this.peerTeam) this.teamPeer[this.peerTeam[pid]] = pid;
    for (let t = 1; t <= this.DELAY; t++) this.turns.set(t, []);
    this.maxTurn = this.DELAY;
    if (this.host) { this.lastSent = this.DELAY; for (const h of this.humans) this.upto[h] = this.DELAY; }
    const R = () => this.stats.recv++;
    tr.on('in', (d, from) => { R(); if (!this.host) return; const team = this.peerTeam[from]; if (team == null || this.dropped.has(team)) return; this.lastHeard[team] = this.now();
      if (d.h) this._checkHash(d.h[0], d.h[1], team); this._addInput(team, d.t, d.c || []); });
    tr.on('turn', d => { R(); if (this.host) return; for (let i = 0; i < (d.n || 1); i++) if (d.t + i > G.tick) this.turns.set(d.t + i, []);
      for (const [dt, team, c] of d.c || []) { const a = this.turns.get(d.t + dt); if (a) a.push([team, c]); } this.maxTurn = Math.max(this.maxTurn, d.t + (d.n || 1) - 1); });
    tr.on('pg', (d, from) => { R(); if (this.host) return; this._send('po', { s: d.s }, from); if (d.d) this.DELAY = d.d; });
    tr.on('po', (d, from) => { R(); if (!this.host) return; const team = this.peerTeam[from]; if (team == null) return; const s = this.now() - d.s, r = this.rtt[team];
      if (!r) this.rtt[team] = { m: s, j: s * 0.2 }; else { r.j = r.j * 0.75 + Math.abs(s - r.m) * 0.25; r.m = r.m * 0.75 + s * 0.25; if (s > r.m + 2 * r.j) r.m = s * 0.5 + r.m * 0.5; } });
    tr.on('hash', (d, from) => { R(); if (this.host) this._checkHash(d.t, d.h, this.peerTeam[from]); });
    tr.on('desync', d => { R(); if (!this.host) this.desync = d; });
    tr.on('sync', d => { R(); if (!this.host) this._applySync(d); });
    tr.on('rejoin', (d, from) => { R(); if (this.host) this.rejoinReq(from, d.name); });
    tr.onLeave(pid => {
      if (this.host) { const team = this.peerTeam[pid]; if (team != null && this.teamPeer[team] === pid) this._drop(team, 'disconnected'); }
      else if (this.hostPeer === pid) this.goOffline('Host disconnected — continuing offline vs AI');
    });
  },
  _need() { return this.humans.filter(h => !this.dropped.has(h)); },
  _drop(team, why) { if (this.dropped.has(team)) return; this.dropped.add(team); this.dropQ.push({ c: 'drop', p: team, diff: 'normal' }); delete this.waitSince[team];
    this.status = G.players[team].name + ' ' + why + ' — AI takes over' + (why === 'disconnected' ? '' : ' (they can rejoin with the room link)'); this._tryFinalize(); },
  _addInput(team, t, cmds) {
    const tt = Math.max(t, this.lastSent + 1); // late input (delay just shrank) goes to the next open tick
    if (cmds.length) { let a = this.cin.get(tt); if (!a) this.cin.set(tt, a = []); for (const c of cmds) a.push([team, c]); }
    this.upto[team] = Math.max(this.upto[team] || 0, tt); this._tryFinalize();
  },
  _tryFinalize() { // host: finalize every tick that every connected human has covered
    const stalled = !this.turns.has(G.tick + 1), need = this._need(); let lo = Infinity; for (const h of need) lo = Math.min(lo, this.upto[h] || 0);
    if (lo === Infinity) lo = this.lastSent;
    while (this.lastSent < lo) { const t = ++this.lastSent, cmds = this.cin.get(t) || []; this.cin.delete(t);
      if (this.dropQ.length) { for (const c of this.dropQ) cmds.push([c.p, c]); this.dropQ = []; }
      this.turns.set(t, cmds); this.unsent.push([t, cmds]); this.maxTurn = t; }
    this.waiting = need.filter(h => (this.upto[h] || 0) <= this.lastSent && h !== this.me);
    if (this.unsent.length && (this.unsent.length >= this.B || stalled)) this._flush();
  },
  _flush() { if (!this.unsent.length) return; const t0 = this.unsent[0][0], c = []; for (const [t, cmds] of this.unsent) for (const [team, cmd] of cmds) c.push([t - t0, team, cmd]);
    this._send('turn', { t: t0, n: this.unsent.length, c }); this.unsent = []; },
  _adapt() { // host, once a second: ping everyone and set each peer's input delay from its RTT
    const now = this.now(), tk = 1000 / 30; let maxOw = 0; const ow = {};
    for (const h of this._need()) if (h !== this.me) { const r = this.rtt[h]; ow[h] = r ? (r.m + 2 * r.j) / 2 : 80; maxOw = Math.max(maxOw, ow[h]); }
    const want = h => h === this.me ? Math.ceil((maxOw + 25) / tk) + 1 : Math.ceil((ow[h] + maxOw + 25) / tk) + this.B;
    for (const h of this._need()) { const w = Math.max(3, Math.min(24, want(h))), cur = this.dl[h] || 4, d = w > cur ? w : w < cur ? cur - 1 : cur; this.dl[h] = d;
      if (h === this.me) this.DELAY = d; else if (this.teamPeer[h]) this._send('pg', { s: now, d }, this.teamPeer[h]); }
  },
  _checkHash(t, h, team) {
    if (team == null || t <= (this.syncAt[team] || 0)) return;
    let r = this.hashes.get(t); if (!r) this.hashes.set(t, r = {}); r[team] = h; const mine = r[this.me];
    if (mine != null) for (const k in r) if (r[k] !== mine && +k !== this.me) { delete r[k];
      if ((this.syncN[k] = (this.syncN[k] || 0) + 1) <= 3) this._sendSync(+k, false);
      else if (!this.desync) { this.desync = { t, team: +k }; this._send('desync', this.desync); } }
  },
  _compactLog() { const L = []; for (const [t, c] of this.log) if (c.length) L.push([t, c]); for (const [t, c] of this.turns) if (t > G.tick && c.length) L.push([t, c]); return L; },
  _sendSync(team, full) { const pid = this.teamPeer[team]; if (!pid) return; this._flush(); this.syncAt[team] = this.lastSent; this.resyncs++;
    this.status = full ? G.players[team].name + ' is rejoining…' : 'Resyncing ' + G.players[team].name + ' (state mismatch repaired)';
    this._send('sync', { full, last: this.lastSent, log: this._compactLog(), opts: this.gopts, names: G.players.map(P => P.name), me: team, humans: this.humans, peerTeam: this.peerTeam, d: this.dl[team] || this.DELAY }, pid); },
  rejoinReq(pid, name) { // host: a player re-opened the room during the match
    let team = this.peerTeam[pid]; const base = n => String(n || '').replace(/ \(AI\)$/, '');
    if (team == null || !this.dropped.has(team)) team = [...this.dropped].find(t => base(G.players[t].name) === name);
    if (team == null) team = [...this.dropped][0]; if (team == null) return false;
    const old = this.teamPeer[team]; if (old && old !== pid) delete this.peerTeam[old];
    this.peerTeam[pid] = team; this.teamPeer[team] = pid; this.dropped.delete(team); this.upto[team] = this.lastSent; this.lastHeard[team] = this.now(); delete this.syncN[team];
    this.dropQ.push({ c: 'retake', p: team, n: name || base(G.players[team].name) }); this._sendSync(team, true); return true;
  },
  _applySync(d) { // client: rebuild the exact state by re-simulating the host's command log from the seed
    if (d.full) { this.me = d.me; if (typeof ME !== 'undefined') ME = d.me; this.humans = d.humans.slice(); this.peerTeam = Object.assign({}, d.peerTeam); this.teamPeer = {}; for (const pid in this.peerTeam) this.teamPeer[this.peerTeam[pid]] = pid; }
    if (d.d) this.DELAY = d.d; if (d.opts) this.gopts = d.opts;
    const L = new Map(d.log), recOn = RPL.on; RPL.on = false;
    newGame(JSON.parse(JSON.stringify(this.gopts))); G.players.forEach((P, i) => { if (d.names[i] != null) P.name = d.names[i]; });
    const log = [];
    for (let t = 1; t <= d.last; t++) { const c = L.get(t) || []; for (const [team, cmd] of c) execCmd(team, cmd); log.push([t, c]); stepGame(); if (G.events.length > 500) G.events.length = 0; }
    G.events.length = 0; RPL.on = recOn; this.log = log; for (const t of [...this.turns.keys()]) if (t <= d.last) this.turns.delete(t);
    for (let t = d.last + 1; t <= Math.max(this.maxTurn, d.last); t++) if (!this.turns.has(t)) this.turns.set(t, []);
    this.maxTurn = Math.max(this.maxTurn, d.last); this.pending = []; this.batch = []; this.desync = null; this.resyncs++; this._lagNote = false;
    this.status = d.full ? 'Rejoined the match' : 'Resynced with host';
    if (typeof onNetResync === 'function') onNetResync();
  },
  // turn buffer health -> sim speed multiplier (smooths jitter instead of hard stalls)
  pace() { if (!this.online) return 1; const ahead = this.maxTurn - G.tick; return ahead > this.DELAY + 5 ? 1.3 : ahead > this.DELAY + 2 ? 1.08 : ahead <= 1 ? 0.85 : 1; },
  ready() {
    if (!this.online) return true; const ok = this.turns.has(G.tick + 1);
    if (this.host) { const now = this.now();
      for (const h of this._need()) if (h !== this.me) { const behind = (this.upto[h] || 0) <= G.tick + 1; if (!behind) { delete this.waitSince[h]; continue; } if (ok) continue;
        if (!this.waitSince[h]) this.waitSince[h] = now; else if (now - this.waitSince[h] > this.DROP_MS) this._drop(h, 'is not responding'); }
      if (!ok && this.turns.has(G.tick + 1)) return true; }
    return ok;
  },
  tick() {
    if (!this.online) { stepGame(); return true; }
    const t = G.tick + 1; if (!this.turns.has(t)) return false;
    const tgt = t + this.DELAY;
    if (this.host) { this._addInput(this.me, tgt, this.pending); this.pending = []; }
    else { for (const c of this.pending) this.batch.push(c); this.pending = [];
      if (t % this.B === 0 || this.batch.length && t % this.B === 0) { const m = { t: tgt, c: this.batch }; if (this._hq) { m.h = this._hq; this._hq = null; } this._send('in', m, this.hostPeer); this.batch = []; } }
    const cmds = this.turns.get(t); this.turns.delete(t);
    for (const [team, c] of cmds) execCmd(team, c);
    this.log.push([t, cmds]); stepGame();
    if (G.tick % 30 === 0) { const h = stateHash(); if (this.host) { this._checkHash(G.tick, h, this.me); this._adapt(); } else this._hq = [G.tick, h]; if (this.hashes.size > 50) this.hashes.delete(this.hashes.keys().next().value); }
    if (this.host && this.unsent.length && G.tick % this.B === 0) this._flush();
    if (!this.host && G.players[this.me] && G.players[this.me].ai && !this._lagNote) { this._lagNote = true; this.status = 'You were dropped (connection too slow) — AI took over. Re-open the room link to rejoin.'; }
    return true;
  },
  goOffline(msg) {
    if (!this.online) return; this.online = false; this.offline = true; this.status = msg || 'Offline';
    for (const P of G.players) if (!P.ai && P.team !== this.me) { P.ai = true; P.diff = 'normal'; P.name += ' (AI)'; aiInit(P); }
    for (const c of this.pending.concat(this.batch || [])) execCmd(ME, c); this.pending = []; this.batch = [];
  },
};
if (typeof module !== 'undefined') module.exports = { NET, CMD, execCmd, stateHash };
