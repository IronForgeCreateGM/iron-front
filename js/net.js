'use strict';
// ===== Commands + deterministic lockstep (host-relay) =====
// Every player action is a command {c:'move',...}. Offline: executed immediately.
// Online: tagged for tick (now + DELAY); the host collects every human's input for a tick,
// broadcasts the merged "turn", and all peers execute it before stepping that tick.
const NET_VERSION = 'v4.1';
const own = (T, ids) => (ids || []).map(byId).filter(e => e && e.team === T && e.hp > 0);
const CMD = {
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
  surrender(T, c) { const P = G.players[T]; if (!P || P.out) return; for (const e of G.ents) if (e.team === T && e.kind === 'b') e.hp = 0; },
};
function execCmd(T, c) { try { return CMD[c.c] ? CMD[c.c](T, c) : undefined; } catch (e) { console.error('cmd', c, e); } }

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

const NET = {
  online: false, host: false, me: 0, DELAY: 4, turns: new Map(), inputs: new Map(), pending: [], humans: [], waitT: 0, waiting: null,
  hashes: new Map(), desync: null, log: [], tr: null, peerTeam: {}, teamPeer: {}, lastSent: 0, dropped: new Set(), status: '',
  // issue a local command; offline executes now (returns result), online queues for tick+DELAY
  issue(c) {
    if (!this.online) return execCmd(ME, c);
    this.pending.push(c); return true;
  },
  // configure a lockstep session. tr = transport {send(type,data,to?), on(type,cb), onLeave(cb)}
  begin(tr, opts) {
    Object.assign(this, { online: true, tr, hostPeer: opts.hostPeer, status: '', host: opts.host, me: opts.me, humans: opts.humans.slice(), peerTeam: opts.peerTeam || {}, teamPeer: {}, turns: new Map(), inputs: new Map(), pending: [], hashes: new Map(), desync: null, log: [], dropped: new Set(), lastSent: 0 });
    for (const pid in this.peerTeam) this.teamPeer[this.peerTeam[pid]] = pid;
    for (let t = 1; t <= this.DELAY; t++) this.turns.set(t, []);
    tr.on('in', (d, from) => { if (!this.host) return; const team = this.peerTeam[from]; if (team == null) return; this._addInput(d.t, team, d.c); });
    tr.on('turn', d => { if (this.host) return; this.turns.set(d.t, d.c); });
    tr.on('hash', (d, from) => { if (this.host) this._checkHash(d.t, d.h, this.peerTeam[from]); });
    tr.on('desync', d => { this.desync = d; });
    tr.onLeave(pid => {
      if (this.host) { const team = this.peerTeam[pid]; if (team != null && !this.dropped.has(team)) { this.dropped.add(team); this._dropQ = (this._dropQ || []).concat({ c: 'drop', p: team, diff: 'normal' }); this.status = G.players[team].name + ' disconnected — AI takes over'; } }
      else if (this.hostPeer === pid) this.goOffline('Host disconnected — continuing offline vs AI');
    });
  },
  _addInput(t, team, c) { let m = this.inputs.get(t); if (!m) this.inputs.set(t, m = new Map()); m.set(team, c); this._tryFinalize(); },
  _tryFinalize() { // host: finalize every tick whose inputs are complete
    for (;;) {
      const t = this.lastSent + 1; if (this.turns.has(t) && t <= this.DELAY) { this.lastSent = t; continue; }
      const m = this.inputs.get(t); const need = this.humans.filter(h => !this.dropped.has(h));
      if (!m || need.some(h => !m.has(h))) { this.waiting = need.filter(h => !m || !m.has(h)); return; }
      const cmds = []; for (const h of this.humans) if (m.has(h)) for (const c of m.get(h)) cmds.push([h, c]);
      if (this._dropQ && this._dropQ.length) { for (const c of this._dropQ) cmds.push([c.p, c]); this._dropQ = []; }
      this.turns.set(t, cmds); this.inputs.delete(t); this.lastSent = t; this.waiting = null;
      this.tr.send('turn', { t, c: cmds });
    }
  },
  _checkHash(t, h, team) { let r = this.hashes.get(t); if (!r) this.hashes.set(t, r = {}); r[team] = h; const mine = r[this.me]; if (mine != null) for (const k in r) if (r[k] !== mine && !this.desync) { this.desync = { t, team: +k }; this.tr.send('desync', this.desync); } },
  // can the next tick run? (turn present)
  ready() { return !this.online || this.turns.has(G.tick + 1); },
  // run exactly one lockstep tick (assumes ready())
  tick() {
    if (!this.online) { stepGame(); return true; }
    const t = G.tick + 1; if (!this.turns.has(t)) return false;
    // submit my input for t + DELAY (also when empty)
    const tgt = t + this.DELAY, mine = this.pending; this.pending = [];
    if (this.host) this._addInput(tgt, this.me, mine); else this.tr.send('in', { t: tgt, c: mine }, this.hostPeer);
    const cmds = this.turns.get(t); this.turns.delete(t);
    for (const [team, c] of cmds) execCmd(team, c);
    this.log.push([t, cmds]); stepGame();
    if (G.tick % 30 === 0) { const h = stateHash(); if (this.host) this._checkHash(G.tick, h, this.me); else this.tr.send('hash', { t: G.tick, h }, this.hostPeer); if (this.hashes.size > 50) this.hashes.delete(this.hashes.keys().next().value); }
    return true;
  },
  goOffline(msg) {
    if (!this.online) return; this.online = false; this.status = msg || 'Offline';
    // remote humans become AI locally so the match can continue
    for (const P of G.players) if (!P.ai && P.team !== this.me) { P.ai = true; P.diff = 'normal'; P.name += ' (AI)'; aiInit(P); }
    for (const c of this.pending) execCmd(ME, c); this.pending = [];
  },
};
if (typeof module !== 'undefined') module.exports = { NET, CMD, execCmd, stateHash };
