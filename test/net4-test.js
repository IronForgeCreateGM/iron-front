// v5.5: 4 human peers over a simulated network (per-peer latency + jitter, one slow peer, optional drop/rejoin/desync)
// Measures: stalls (frames where the next tick wasn't ready), effective sim speed, messages/s and bytes/s, input latency.
// usage: node test/net4-test.js [seconds=90] [slowMs=260]
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
const SEC = +process.argv[2] || 90, SLOW = +process.argv[3] || 260, TICKS = SEC * 30;
function ctx() { const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Uint16Array, Array, Object, JSON, String, Number, isFinite, Date, globalThis: null }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c); return c; }
const ev = (c, s) => vm.runInContext(s, c);
function mkRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const SLOTS = [0, 1, 2, 3].map(i => ({ ai: false, ally: i % 2, start: [0, 3, 2, 1][i], fac: ['usa', 'rus', 'fra', 'ger'][i], name: 'P' + i }));
function bot(c, team, R) {
  const G = ev(c, 'G'); if (G.tick % 15) return; const P = G.players[team], NET = ev(c, 'NET'), r = R();
  const hq = G.ents.find(e => e.team === team && (e.t === 'hq' || e.t === 'cc')); if (!hq || P.out) return;
  if (P.ready.bld) { const sv = G.R; G.R = R; const s = ev(c, 'aiSpot')(P, P.ready.bld, hq, []); G.R = sv; if (s) NET.issue({ c: 'place', cat: 'bld', x: s[0], y: s[1] }); else NET.issue({ c: 'cancel', t: P.ready.bld }); return; }
  const opts = ['power', 'barracks', 'refinery', 'factory', 'rifle', 'rifle', 'light', 'rocketeer', 'harv', 'heavy'];
  if (r < 0.5) { const t = opts[(R() * opts.length) | 0]; if (ev(c, 'avail')(team, t)) NET.issue({ c: 'enq', t, n: 1 }); }
  const army = G.ents.filter(e => e.team === team && e.kind === 'u' && e.t !== 'harv').map(e => e.id);
  if (r > 0.8 && army.length) NET.issue({ c: 'move', u: army, x: 10 + R() * 76, y: 10 + R() * 76, am: true });
}
function run({ seed = 7, slowPeer = 3, dropAt = 0, rejoinAt = 0, desyncAt = 0, freezeAt = 0, label }) {
  const R = mkRng(seed), peers = [], queue = []; let now = 0, msgs = 0, bytes = 0;
  const humans = [0, 1, 2, 3], peerTeam = { peer0: 0, peer1: 1, peer2: 2, peer3: 3 };
  const lat = (a, b) => { const base = (a === 'peer' + slowPeer || b === 'peer' + slowPeer) ? SLOW / 2 : 35; return base + R() * base * 0.6; };
  const mk = p => { const c = ctx(), id = 'peer' + p, handlers = {}, leave = [];
    const tr = { send(type, data, to) { for (const q of peers) if (q.id !== id && q.alive && (!to || to === q.id)) { const s = JSON.stringify(data); msgs++; bytes += s.length + type.length + 8; const at = Math.max(now + lat(id, q.id), q.lastAt[id] || 0); q.lastAt[id] = at; queue.push({ at, to: q, type, data: JSON.parse(s), from: id }); } }, on(t, cb) { handlers[t] = cb; }, onLeave(cb) { leave.push(cb); } };
    ev(c, 'newGame')({ seed, slots: SLOTS.map(s => Object.assign({}, s)), fog: true }); ev(c, 'ME = ' + p);
    ev(c, 'NET').now = () => now; ev(c, 'NET').begin(tr, { host: p === 0, me: p, humans, peerTeam, hostPeer: 'peer0' });
    return { id, c, handlers, leave, alive: true, team: p, R: mkRng(seed + p * 99), hashes: {}, lastAt: {}, stalls: 0, acc: 0 }; };
  for (let p = 0; p < 4; p++) peers.push(mk(p));
  const t0 = Date.now(); let simMs = 0, frames = 0, rejoined = false;
  while (peers[0].alive && ev(peers[0].c, 'G').tick < TICKS) {
    now += 1000 / 60; frames++;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= now) { const m = queue.shift(); if (m.to.alive && m.to.handlers[m.type]) m.to.handlers[m.type](m.data, m.from); }
    for (const p of peers) if (p.alive) {
      const NET = ev(p.c, 'NET'), G = ev(p.c, 'G');
      if (freezeAt && p.id === 'peer2' && G.tick >= freezeAt) continue;
      if (dropAt && p.id === 'peer2' && G.tick >= dropAt && !p.dropped) { p.alive = false; p.dropped = true; for (const q of peers) if (q.alive) q.leave.forEach(f => f(p.id)); continue; }
      if (desyncAt && p.id === 'peer1' && G.tick === desyncAt && !p.hit) { p.hit = true; G.ents[5].x += 0.01; }
      if (NET.offline || !NET.online) continue;
      p.acc += 1 / 60; let n = 0;
      const pace = NET.pace ? NET.pace() : 1; // adaptive: run slightly faster/slower to keep the buffer healthy
      while (p.acc >= (1 / 30) / pace && n++ < 4) { if (!NET.ready()) { p.stalls++; p.acc = Math.min(p.acc, 0.1); break; } const s = Date.now(); bot(p.c, p.team, p.R); NET.tick(); simMs += Date.now() - s; p.acc -= (1 / 30) / pace; if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')(); }
    }
    if (rejoinAt && !rejoined && ev(peers[0].c, 'G').tick >= rejoinAt) { rejoined = true; const old = peers[2]; const c = ctx(), id = 'peer2b', handlers = {}, leave = [];
      const tr = { send(type, data, to) { for (const q of peers) if (q.id !== id && q.alive && (!to || to === q.id)) { const s = JSON.stringify(data); msgs++; bytes += s.length + 8; const at = Math.max(now + 40 + R() * 20, q.lastAt[id] || 0); q.lastAt[id] = at; queue.push({ at, to: q, type, data: JSON.parse(s), from: id }); } }, on(t, cb) { handlers[t] = cb; }, onLeave(cb) { leave.push(cb); } };
      const np = { id, c, handlers, leave, alive: true, team: 2, R: mkRng(1234), hashes: {}, lastAt: {}, stalls: 0, acc: 0 }; peers[2] = np;
      ev(c, 'newGame')({ seed, slots: SLOTS.map(s => Object.assign({}, s)), fog: true }); ev(c, 'ME = 2'); ev(c, 'NET').now = () => now; ev(c, 'NET').begin(tr, { host: false, me: 2, humans, peerTeam, hostPeer: 'peer0' }); tr.send('rejoin', { name: 'P2' }, 'peer0'); }
    if (frames > TICKS * 8) throw new Error('lockstep did not finish');
  }
  const live = peers.filter(p => p.alive); let cmp = 0, bad = 0; const ref = peers[0].hashes;
  for (const p of live.slice(1)) for (const t in p.hashes) if (ref[t] != null && !(desyncAt && +t <= desyncAt + 150)) { cmp++; if (ref[t] !== p.hashes[t]) bad++; }
  const N0 = ev(peers[0].c, 'NET'), wall = frames / 60, gameSec = ev(peers[0].c, 'G').tick / 30;
  const res = { label, gameSec: +gameSec.toFixed(1), wallSec: +wall.toFixed(1), speed: +(gameSec / wall).toFixed(3), stalls: live.map(p => p.stalls), msgPerSec: +(msgs / wall).toFixed(1), kbPerSec: +(bytes / wall / 1024).toFixed(2), delay: N0.DELAY, cmp, bad, desync: live.map(p => !!ev(p.c, 'NET').desync), resyncs: live.map(p => ev(p.c, 'NET').resyncs || 0), simMsPerTick: +(simMs / Math.max(1, ev(peers[0].c, 'G').tick * live.length)).toFixed(3), real: ((Date.now() - t0) / 1000).toFixed(1) + 's' };
  return { res, peers };
}
module.exports = { run };
if (require.main === module) {
  const mode = process.argv[4] || 'all'; const out = [];
  let ok = true; const chk = (r, cond, why) => { r.ok = !!cond; if (!cond) { ok = false; r.why = why; } out.push(r); console.log(JSON.stringify(r)); };
  let r = run({ label: '4 peers ~70ms RTT', slowPeer: -1 }).res; chk(r, r.speed > 0.97 && !r.bad && r.cmp > 50, 'speed/hash');
  r = run({ label: '4 peers, one at ' + SLOW + 'ms RTT', seed: 8 }).res; chk(r, r.speed > 0.95 && !r.bad && r.cmp > 50, 'slow peer speed/hash');
  r = run({ label: 'peer1 state corrupted at t=600 -> resync', seed: 9, slowPeer: -1, desyncAt: 600 }).res; chk(r, !r.bad && r.resyncs[1] >= 1 && !r.desync.some(Boolean), 'desync not recovered');
  { const { res, peers } = run({ label: 'peer2 freezes at t=450 -> AI after 20s', seed: 10, slowPeer: -1, freezeAt: 450 }); res.p2ai = ev(peers[0].c, 'G').players[2].ai; chk(res, res.p2ai && res.gameSec >= SEC - 1, 'freeze not handled'); }
  { const { res, peers } = run({ label: 'peer2 drops t=600, rejoins t=900', seed: 11, slowPeer: -1, dropAt: 600, rejoinAt: 900 }); const G0 = ev(peers[0].c, 'G'), G2 = ev(peers[2].c, 'G'); res.p2human = !G0.players[2].ai; res.p2tick = G2.tick;
    chk(res, res.p2human && !res.bad && res.cmp > 50, 'rejoin failed'); }
  console.log(ok ? 'NET4 TEST OK' : 'NET4 TEST FAIL'); process.exit(ok ? 0 : 1);
}
