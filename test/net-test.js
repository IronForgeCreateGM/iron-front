// Lockstep determinism tests (node). 1) N peers in separate VM contexts over a fake laggy
// transport play a match (human bots + AI slots) -> all state hashes identical, no desync.
// 2) Replaying the host's command log (twice) in fresh contexts reproduces the same hashes.
// 3) A peer disconnects mid-game -> its slot becomes AI, remaining peers stay in sync.
// usage: node test/net-test.js [minutes=4]
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
const MIN = +process.argv[2] || 4, TICKS = MIN * 60 * 30;
function ctx() { const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Array, Object, JSON, String, Number, isFinite, globalThis: null }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c); return c; }
const ev = (c, s) => vm.runInContext(s, c);
function mkRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const SLOTS = [{ ai: false, ally: 0, start: 0, fac: 'usa', name: 'P0' }, { ai: false, ally: 1, start: 3, fac: 'rus', name: 'P1' }, { ai: true, diff: 'chief', ally: 0, start: 2, fac: 'fra', name: 'Chief' }, { ai: true, diff: 'hard', ally: 1, start: 1, fac: 'ger', name: 'Hard' }];
function bot(c, team, R) { // random but valid human-like commands, issued only by the owning peer
  ev(c, 'G').tick % 20 || (() => {
    const G = ev(c, 'G'), P = G.players[team], NET = ev(c, 'NET'), r = R();
    const hq = G.ents.find(e => e.team === team && (e.t === 'hq' || e.t === 'cc')); if (!hq || P.out) return;
    if (P.ready.bld) { const sv = G.R; G.R = R; const s = ev(c, 'aiSpot')(P, P.ready.bld, hq, []); G.R = sv; if (s) NET.issue({ c: 'place', cat: 'bld', x: s[0], y: s[1] }); else NET.issue({ c: 'cancel', t: P.ready.bld }); return; }
    const opts = ['power', 'barracks', 'refinery', 'factory', 'rifle', 'rifle', 'light', 'rocketeer', 'harv', 'heavy'];
    if (r < 0.5) { const t = opts[(R() * opts.length) | 0]; if (ev(c, 'avail')(team, t)) NET.issue({ c: 'enq', t, n: 1 + ((R() * 2) | 0) }); }
    const army = G.ents.filter(e => e.team === team && e.kind === 'u' && e.t !== 'harv').map(e => e.id);
    if (r > 0.85 && army.length) NET.issue({ c: 'move', u: army, x: 10 + R() * 76, y: 10 + R() * 76, am: true });
    else if (r > 0.8 && army.length) NET.issue({ c: 'form', u: army.slice(0, 8), x: hq.x + 6, y: hq.y + 6, a: R() * 6 });
    else if (r > 0.78 && army.length) NET.issue({ c: 'stance', u: army, s: R() < 0.5 ? 'hold' : 'aggr' });
    else if (r > 0.76) NET.issue({ c: 'ping', x: 48, y: 48, k: 'attack' });
  })();
}
function lockstepGame({ npeers, seed, dropAt, ticks }) {
  const R = mkRng(seed * 7 + 1), peers = [], queue = []; let now = 0;
  const humans = SLOTS.map((s, i) => s.ai ? -1 : i).filter(i => i >= 0).slice(0, npeers);
  const slots = SLOTS.map((s, i) => Object.assign({}, s, i < 4 && !s.ai && i >= npeers ? { ai: true, diff: 'normal' } : {}));
  for (let p = 0; p < npeers; p++) {
    const c = ctx(), id = 'peer' + p, handlers = {}, leave = [];
    const tr = { send(type, data) { for (const q of peers) if (q.id !== id && q.alive) { const lag = 20 + R() * 110; queue.push({ at: now + lag, to: q, type, data: JSON.parse(JSON.stringify(data)), from: id }); } }, on(t, cb) { handlers[t] = cb; }, onLeave(cb) { leave.push(cb); } };
    ev(c, 'newGame')({ seed, slots, fog: true }); ev(c, 'ME = ' + humans[p]);
    const peerTeam = {}; humans.forEach((t, k) => peerTeam['peer' + k] = t);
    ev(c, 'NET').begin(tr, { host: p === 0, me: humans[p], humans, peerTeam, hostPeer: 'peer0' });
    peers.push({ id, c, handlers, leave, alive: true, team: humans[p], R: mkRng(seed + p * 99), hashes: {} });
  }
  queue.sort((a, b) => a.at - b.at);
  let stalls = 0;
  while (peers.some(p => p.alive && ev(p.c, 'G').tick < ticks)) {
    now += 33.3;
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= now) { const m = queue.shift(); if (m.to.alive && m.to.handlers[m.type]) m.to.handlers[m.type](m.data, m.from); }
    for (const p of peers) if (p.alive) {
      if (dropAt && p.id === 'peer' + (npeers - 1) && ev(p.c, 'G').tick >= dropAt) { p.alive = false; for (const q of peers) if (q.alive) q.leave.forEach(f => f(p.id)); continue; }
      for (let k = 0; k < 2 && ev(p.c, 'G').tick < ticks; k++) { // allow slight catch-up
        if (!ev(p.c, 'NET').ready()) { stalls++; break; }
        bot(p.c, p.team, p.R); ev(p.c, 'NET').tick(); const G = ev(p.c, 'G'); if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')();
      }
    }
    if (now > ticks * 33.3 * 20) throw new Error('lockstep did not finish (deadlock?)');
  }
  return { peers, stalls };
}
function replay(seed, log, ticks, slots) {
  const c = ctx(); ev(c, 'newGame')({ seed, slots, fog: true }); const hs = {}; const L = new Map(log);
  for (let t = 1; t <= ticks; t++) { for (const [team, cmd] of L.get(t) || []) ev(c, 'execCmd')(team, cmd); ev(c, 'stepGame')(); if (t % 30 === 0) hs[t] = ev(c, 'stateHash')(); }
  return hs;
}
let ok = true; const t0 = Date.now();
// ---- 1: 2 peers + 2 AIs
{ const seed = 4242, { peers, stalls } = lockstepGame({ npeers: 2, seed, ticks: TICKS });
  const [a, b] = peers; let cmp = 0, bad = 0; for (const t in a.hashes) if (b.hashes[t] != null) { cmp++; if (a.hashes[t] !== b.hashes[t]) bad++; }
  const des = peers.map(p => ev(p.c, 'NET').desync); const G = ev(a.c, 'G');
  const ncmd = ev(a.c, 'NET').log.reduce((s, [, c]) => s + c.length, 0);
  console.log(`[2 peers, ${MIN} min] compared ${cmp} hash checkpoints, mismatches ${bad}, desync flags ${JSON.stringify(des)}, stalls ${stalls}, commands ${ncmd}, ents ${G.ents.length}, final ${a.hashes[TICKS]} / ${b.hashes[TICKS]}`);
  if (bad || des.some(Boolean) || !cmp || ncmd < 20) ok = false;
  // ---- 2: replay host log twice
  const slots = SLOTS.map(s => Object.assign({}, s));
  const r1 = replay(seed, ev(a.c, 'NET').log, TICKS, slots), r2 = replay(seed, ev(a.c, 'NET').log, TICKS, slots);
  let rb = 0; for (const t in a.hashes) { if (r1[t] !== a.hashes[t] || r2[t] !== r1[t]) rb++; }
  console.log(`[replay x2] checkpoints ${Object.keys(r1).length}, mismatches vs live ${rb}, final ${r1[TICKS]} ${r2[TICKS]}`);
  if (rb) ok = false;
}
// ---- 3: 2 humans, peer1 drops at tick 1200 -> AI takeover; host continues
{ const { peers } = lockstepGame({ npeers: 2, seed: 99, ticks: Math.min(TICKS, 2400), dropAt: 1200 });
  const G = ev(peers[0].c, 'G'); console.log(`[drop] host reached tick ${G.tick}, P1 ai=${G.players[1].ai} name="${G.players[1].name}"`); if (!G.players[1].ai || G.tick < Math.min(TICKS, 2400)) ok = false; }
// ---- 4: negative control: a perturbed peer must be detected
{ const c1 = ctx(), c2 = ctx(); for (const c of [c1, c2]) ev(c, 'newGame')({ seed: 5, slots: SLOTS, fog: true });
  for (let i = 0; i < 300; i++) { ev(c1, 'stepGame')(); ev(c2, 'stepGame')(); if (i === 100) ev(c2, 'G').ents[3].x += 1e-9; }
  const d = ev(c1, 'stateHash')() !== ev(c2, 'stateHash')(); console.log(`[negative control] 1e-9 perturbation detected: ${d}`); if (!d) ok = false; }
console.log(ok ? 'NET TEST OK' : 'NET TEST FAIL', ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(ok ? 0 : 1);
