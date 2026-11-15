// v7.9.8 reconnect test (room games): simulated network with per-link latency/jitter. Covers:
//  A) a guest's link to the host drops for 6 s (both sides see "left") -> guest waits on "Reconnecting…", rejoins, back in lockstep
//  B) same, but the guest comes back over a brand-new connection (new peer id, same client id)
//  C) a guest freezes silently for 25 s (phone locked / tab asleep) -> host hands the seat to AI, guest wakes up and rejoins by itself
//  D) the host blips for 5 s in a 3-human game -> both guests reconnect, nobody splits off into an offline game
//  E) laggy links (220 ms + jitter) with a blip -> still recovers
// usage: node test/recon-test.js
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
// ev: { at: tick (of host), who: peer index, kind: 'blip' | 'newpid' | 'freeze' | 'hostblip', ms }
function run({ seed = 7, n = 2, latMs = 35, at = 600, kind = 'blip', ms = 6000, end = 1800, label }) {
  const R = mkRng(seed), peers = [], queue = []; let now = 0;
  const humans = [...Array(n).keys()], peerTeam = {}, teamCid = {}; for (let p = 1; p < n; p++) { peerTeam['peer' + p] = p; teamCid[p] = 'cid' + p; }
  const cut = new Set(); // 'a|b' links that are down
  const down = (a, b) => cut.has(a + '|' + b) || cut.has(b + '|' + a);
  const lat = () => latMs + R() * latMs * 0.6;
  const mk = (p, id) => { const c = ctx(), handlers = {}, leave = [];
    const me = { id, c, handlers, leave, alive: true, team: p, R: mkRng(seed + p * 99), hashes: {}, lastAt: {}, stalls: 0, acc: 0, frozen: false };
    const tr = { send(type, data, to) { if (me.frozen) return; for (const q of peers) if (q.id !== me.id && q.alive && (!to || to === q.id) && !down(me.id, q.id)) { const s = JSON.stringify(data); const atT = Math.max(now + lat(), q.lastAt[me.id] || 0); q.lastAt[me.id] = atT; queue.push({ at: atT, to: q, type, data: JSON.parse(s), from: me.id }); } }, on(t, cb) { handlers[t] = cb; }, onLeave(cb) { leave.push(cb); } };
    me.tr = tr; return me; };
  for (let p = 0; p < n; p++) { const P = mk(p, 'peer' + p);
    ev(P.c, 'newGame')({ seed, slots: SLOTS.slice(0, n).map(s => Object.assign({}, s)), fog: true }); ev(P.c, 'ME = ' + p);
    ev(P.c, 'NET').now = () => now; ev(P.c, 'NET').begin(P.tr, { host: p === 0, me: p, humans, peerTeam, hostPeer: 'peer0', teamCid: p === 0 ? teamCid : {}, cid: 'cid' + p });
    peers.push(P); }
  const leaveBoth = (a, b) => { a.leave.forEach(f => f(b.id)); b.leave.forEach(f => f(a.id)); };
  let phase = 0, restoreAt = 0, frames = 0; const notes = [];
  const H = () => peers[0], refTick = () => ev(H().c, 'G').tick;
  while (refTick() < end && frames < end * 30) {
    now += 1000 / 60; frames++;
    // scenario
    if (phase === 0 && refTick() >= at) { phase = 1; restoreAt = now + ms; const g = peers[1];
      if (kind === 'blip' || kind === 'newpid') { cut.add('peer0|peer1'); leaveBoth(H(), g); }
      if (kind === 'freeze') { g.frozen = true; }
      if (kind === 'hostblip') { for (const q of peers.slice(1)) { cut.add('peer0|' + q.id); leaveBoth(H(), q); } } }
    if (phase === 1 && now >= restoreAt) { phase = 2; cut.clear(); const g = peers[1];
      if (kind === 'freeze') g.frozen = false;
      if (kind === 'newpid') { // the guest's old connection is gone for good; it reconnects as a fresh peer id with the same client id
        g.alive = false; const ng = { ...g, id: 'peer1b', alive: true, lastAt: {} }; ng.tr = g.tr; peers[1] = ng; ev(g.c, 'NET').hostPeer = 'peer0';
        g.tr.send = (type, data, to) => { for (const q of peers) if (q.id !== 'peer1b' && q.alive && (!to || to === q.id)) { const atT = Math.max(now + lat(), q.lastAt['peer1b'] || 0); q.lastAt['peer1b'] = atT; queue.push({ at: atT, to: q, type, data: JSON.parse(JSON.stringify(data)), from: 'peer1b' }); } };
        const old = g; old.handlers = g.handlers; } }
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0].at <= now) { const m = queue.shift(); if (m.to.alive && !m.to.frozen && !down(m.from, m.to.id) && m.to.handlers[m.type]) m.to.handlers[m.type](m.data, m.from); }
    for (const p of peers) if (p.alive && !p.frozen) {
      const NET = ev(p.c, 'NET'), G = ev(p.c, 'G');
      if (!NET.online) { p.acc += 1 / 60; while (p.acc >= 1 / 30) { ev(p.c, 'stepGame')(); p.acc -= 1 / 30; if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')(); } continue; }
      p.acc += 1 / 60; let k = 0; const pace = NET.pace();
      while (p.acc >= (1 / 30) / pace && k++ < 4) { if (!NET.ready()) { p.stalls++; p.acc = Math.min(p.acc, 0.1); break; } bot(p.c, p.team, p.R); NET.tick(); p.acc -= (1 / 30) / pace; if (G.tick % 30 === 0) p.hashes[G.tick] = ev(p.c, 'stateHash')(); }
      if (NET.status) { notes.push(p.id + ': ' + NET.status); NET.lastStatus = NET.status; NET.status = ''; }
    }
  }
  const st = peers.map(p => { const N = ev(p.c, 'NET'), G = ev(p.c, 'G'); return { id: p.id, tick: G.tick, online: N.online, recon: !!N.recon, reconOK: N.reconOK, resyncs: N.resyncs, desync: !!N.desync, ai: G.players.map(P => P.ai ? 1 : 0).join(''), last: N.lastStatus }; });
  // compare hashes at ticks after the recovery (and before the event)
  let cmp = 0, bad = 0; const ref = peers[0].hashes; for (const p of peers.slice(1)) for (const t in p.hashes) if (ref[t] != null) { cmp++; if (ref[t] !== p.hashes[t]) bad++; }
  const fin = peers.map(p => ev(p.c, 'stateHash')()), sameEnd = peers.every(p => ev(p.c, 'G').tick === peers[0] && false) || null;
  return { label, st, cmp, bad, notes: [...new Set(notes)] };
}
let fail = 0; const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x) : '')); if (!c) fail++; };
const t0 = Date.now();
const good = (r, n) => r.st.length === n && r.st.every(x => x.online && !x.recon && !x.desync && x.ai === '0'.repeat(n) && x.tick >= 1700) && r.bad === 0 && r.cmp > 30;
{ const r = run({ label: 'A guest blip', seed: 7 }); ok(good(r, 2) && r.st[1].reconOK === 1, 'A) guest link down 6 s -> "Reconnecting…", rejoins, back in lockstep, own seat back from the AI', { st: r.st, cmp: r.cmp, bad: r.bad, notes: r.notes }); }
{ const r = run({ label: 'B new pid', seed: 11, kind: 'newpid' }); ok(good(r, 2) && r.st[1].reconOK === 1, 'B) guest comes back on a fresh connection (new peer id, same client id) -> host maps it back to the same seat', { st: r.st, cmp: r.cmp, bad: r.bad, notes: r.notes }); }
{ const r = run({ label: 'C freeze', seed: 13, kind: 'freeze', ms: 25000, end: 2600 }); ok(r.st.every(x => x.online && !x.desync && x.ai === '00') && r.bad === 0 && r.st[1].resyncs >= 1 && r.st.every(x => x.tick >= 2500), 'C) guest frozen 25 s (phone locked) -> AI covers, guest wakes and rejoins on its own, in lockstep', { st: r.st, cmp: r.cmp, bad: r.bad, notes: r.notes }); }
{ const r = run({ label: 'D host blip 3p', seed: 17, n: 3, kind: 'hostblip', ms: 5000 }); ok(good(r, 3) && r.st.slice(1).every(x => x.reconOK === 1), 'D) host blips 5 s in a 3-player game -> both guests reconnect, nobody splits off offline', { st: r.st, cmp: r.cmp, bad: r.bad, notes: r.notes }); }
{ const r = run({ label: 'E laggy', seed: 23, latMs: 220, ms: 8000 }); ok(good(r, 2), 'E) laggy links (220 ms + jitter) + 8 s blip -> still recovers in lockstep', { st: r.st, cmp: r.cmp, bad: r.bad, notes: r.notes }); }
console.log((fail ? 'RECON FAIL ' + fail : 'RECON OK') + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(fail ? 1 : 0);
