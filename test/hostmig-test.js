// v7.9.5 Quick Match host migration over a simulated network (per-peer latency + jitter, one slow peer).
// The host leaves mid-match; the remaining humans elect the lowest id, keep playing TOGETHER in lockstep (identical state hashes),
// the old host's seat goes to the AI. Variants: slow peer, the new host also leaves (second migration),
// only one human left (-> offline vs AI), migrate off (room game: everyone continues offline, as before).
// usage: node test/hostmig-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
function ctx() { const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Uint16Array, Int16Array, Array, Object, JSON, String, Number, isFinite, Date, globalThis: null }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c); return c; }
const ev = (c, s) => vm.runInContext(s, c);
function mkRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const SLOTS = [0, 1, 2, 3].map(i => ({ ai: false, ally: i, start: [0, 3, 2, 1][i], fac: ['usa', 'rus', 'fra', 'ger'][i], name: 'P' + i }));
function bot(c, team, R) {
  const G = ev(c, 'G'); if (G.tick % 15) return; const P = G.players[team], NET = ev(c, 'NET'), r = R(); if (P.ai) return;
  const hq = G.ents.find(e => e.team === team && (e.t === 'hq' || e.t === 'cc')); if (!hq || P.out) return;
  if (P.ready.bld) { const sv = G.R; G.R = R; const s = ev(c, 'aiSpot')(P, P.ready.bld, hq, []); G.R = sv; if (s) NET.issue({ c: 'place', cat: 'bld', x: s[0], y: s[1] }); else NET.issue({ c: 'cancel', t: P.ready.bld }); return; }
  const opts = ['power', 'barracks', 'refinery', 'factory', 'rifle', 'rifle', 'scout', 'rocketeer', 'harv', 'heavy'];
  if (r < 0.5) { const t = opts[(R() * opts.length) | 0]; if (ev(c, 'avail')(team, t)) NET.issue({ c: 'enq', t, n: 1 }); }
  const army = G.ents.filter(e => e.team === team && e.kind === 'u' && e.t !== 'harv').map(e => e.id);
  if (r > 0.8 && army.length) NET.issue({ c: 'move', u: army, x: 10 + R() * 76, y: 10 + R() * 76, am: true });
}
function run({ seed = 7, n = 4, slow = 3, slowMs = 260, killAt = 600, kill2At = 0, migrate = true, end = 2400, label }) {
  const R = mkRng(seed), peers = [], queue = []; let now = 0;
  const humans = [...Array(n).keys()], peerTeam = {}; for (let p = 1; p < n; p++) peerTeam['peer' + p] = p; // like Quick Match: the host is not in peerTeam
  const lat = (a, b) => { const base = (a === 'peer' + slow || b === 'peer' + slow) ? slowMs / 2 : 35; return base + R() * base * 0.6; };
  for (let p = 0; p < n; p++) { const c = ctx(), id = 'peer' + p, handlers = {}, leave = [];
    const tr = { send(type, data, to) { for (const q of peers) if (q.id !== id && q.alive && (!to || to === q.id)) { const s = JSON.stringify(data); const at = Math.max(now + lat(id, q.id), q.lastAt[id] || 0); q.lastAt[id] = at; queue.push({ at, to: q, type, data: JSON.parse(s), from: id }); } }, on(t, cb) { handlers[t] = cb; }, onLeave(cb) { leave.push(cb); } };
    ev(c, 'newGame')({ seed, slots: SLOTS.slice(0, n).map(s => Object.assign({}, s)), fog: true }); ev(c, 'ME = ' + p);
    ev(c, 'NET').now = () => now; ev(c, 'NET').begin(tr, { host: p === 0, me: p, humans, peerTeam, hostPeer: 'peer0', migrate, selfPid: id });
    peers.push({ id, c, handlers, leave, alive: true, team: p, R: mkRng(seed + p * 99), hashes: {}, lastAt: {}, stalls: 0, acc: 0 }); }
  const kill = p => { p.alive = false; for (const q of peers) if (q.alive) q.leave.forEach(f => f(p.id)); }; // its in-flight messages still land (like a real link)
  let frames = 0, killed = 0;
  const refTick = () => Math.max(...peers.filter(p => p.alive).map(p => ev(p.c, 'G').tick));
  while (refTick() < end && frames < end * 10) {
    now += 1000 / 60; frames++;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= now) { const m = queue.shift(); if (m.to.alive && m.to.handlers[m.type]) m.to.handlers[m.type](m.data, m.from); }
    for (const p of peers) if (p.alive) {
      const NET = ev(p.c, 'NET'), G = ev(p.c, 'G');
      if (killed === 0 && p.id === 'peer0' && G.tick >= killAt) { killed = 1; kill(p); continue; }
      if (kill2At && killed === 1 && NET.host && p.id !== 'peer0' && G.tick >= kill2At) { killed = 2; kill(p); continue; }
      if (!NET.online) { p.acc += 1 / 60; while (p.acc >= 1 / 30) { ev(p.c, 'stepGame')(); p.acc -= 1 / 30; if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')(); } continue; }
      p.acc += 1 / 60; let k = 0; const pace = NET.pace();
      while (p.acc >= (1 / 30) / pace && k++ < 4) { if (!NET.ready()) { p.stalls++; p.acc = Math.min(p.acc, 0.1); break; } bot(p.c, p.team, p.R); NET.tick(); p.acc -= (1 / 30) / pace; if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')(); }
    }
  }
  const live = peers.filter(p => p.alive), st = live.map(p => { const N = ev(p.c, 'NET'), G = ev(p.c, 'G'); return { id: p.id, tick: G.tick, online: N.online, host: N.host, hp: N.hostPeer, mig: N.migrations, resyncs: N.resyncs, desync: !!N.desync, ai: G.players.map(P => P.ai ? 1 : 0).join(''), status: N.status, stalls: p.stalls }; });
  let cmp = 0, bad = 0; const ref = live[0] && live[0].hashes; for (const p of live.slice(1)) for (const t in p.hashes) if (ref[t] != null) { cmp++; if (ref[t] !== p.hashes[t]) bad++; }
  return { label, st, cmp, bad, frames };
}
let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
const t0 = Date.now();
{ const r = run({ label: 'base', seed: 7 }); const s = r.st;
  ok(s.length === 3 && s.every(x => x.online && x.hp === 'peer1' && x.mig === 1) && s[0].host && !s[1].host && !s[2].host, 'host left -> peer1 (lowest id) hosts, peers 2 and 3 follow, all online', s.map(x => [x.id, x.online, x.host, x.hp, x.status]));
  ok(s.every(x => x.tick >= 2390 && x.ai === '1000'), 'the match carries on to the end; the old host\'s seat is AI on every phone', s.map(x => [x.tick, x.ai]));
  ok(r.cmp > 150 && r.bad === 0 && s.every(x => !x.desync), 'identical state hashes on all three phones after the migration (' + r.cmp + ' checks)', { bad: r.bad, resyncs: s.map(x => x.resyncs), stalls: s.map(x => x.stalls) }); }
{ const r = run({ label: 'slow host link', seed: 21, slow: 0, slowMs: 300, killAt: 900 }); const s = r.st;
  ok(s.every(x => x.online && x.hp === 'peer1') && r.bad === 0 && s.every(x => x.tick >= 2390), 'slow old host (300 ms): migration still in lockstep', { cmp: r.cmp, bad: r.bad, st: s.map(x => [x.id, x.tick, x.resyncs]) }); }
{ const r = run({ label: 'slow guest', seed: 33, slow: 3, slowMs: 320, killAt: 700 }); const s = r.st;
  ok(s.every(x => x.online && x.hp === 'peer1') && r.bad === 0 && s.every(x => x.tick >= 2390), 'slow guest (320 ms): migration still in lockstep', { cmp: r.cmp, bad: r.bad, st: s.map(x => [x.id, x.tick, x.resyncs]) }); }
{ const r = run({ label: 'second migration', seed: 9, killAt: 500, kill2At: 1300, end: 2600 }); const s = r.st;
  ok(s.length === 2 && s.every(x => x.online && x.hp === 'peer2' && x.mig === 2) && s[0].host && r.bad === 0 && s.every(x => x.ai === '1100'), 'the new host leaves too -> peer2 hosts, peer3 follows, still in lockstep', { cmp: r.cmp, bad: r.bad, st: s.map(x => [x.id, x.host, x.hp, x.ai, x.tick]) }); }
{ const r = run({ label: 'two humans', seed: 5, n: 2, slow: 9, killAt: 600, end: 1200 }); const s = r.st;
  ok(s.length === 1 && !s[0].online && /Host disconnected/.test(s[0].status) && s[0].tick >= 1190, 'only one human left -> continues offline vs AI (unchanged)', s); }
{ const r = run({ label: 'room game', seed: 7, migrate: false, end: 1200 }); const s = r.st;
  ok(s.every(x => !x.online && /Host disconnected/.test(x.status)), 'migrate off (room games): everyone continues offline as before', s.map(x => [x.id, x.online, x.status])); }
console.log((fail ? 'HOSTMIG FAIL ' + fail : 'HOSTMIG OK') + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(fail ? 1 : 0);
