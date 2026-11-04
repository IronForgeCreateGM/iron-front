// v7.7.6 multiplayer security (node): hostile peer messages are dropped, honest commands all pass, nothing throws.
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
function ctx() { const c = vm.createContext({ console: { log() {}, warn() {}, error() {} }, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Array, Object, JSON, String, Number, isFinite, globalThis: null }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c); return c; }
const ev = (c, s) => vm.runInContext(s, c);
let fail = 0; const ok = (b, m) => { console.log((b ? 'PASS ' : 'FAIL ') + m); if (!b) fail++; };
const SLOTS = [{ ai: false, ally: 0, start: 0, fac: 'usa', name: 'Host' }, { ai: false, ally: 1, start: 3, fac: 'rus', name: 'Guest' }, { ai: false, ally: 1, start: 1, fac: 'ger', name: 'G2' }];
function mk(host) { const c = ctx(), H = {}, sent = []; ev(c, 'newGame')({ seed: 5, slots: SLOTS.map(s => Object.assign({}, s)) });
  const tr = { send: (t, d, to) => sent.push([t, d, to]), on: (t, f) => H[t] = f, onLeave() {} };
  ev(c, 'NET').begin(tr, { host, me: host ? 0 : 1, humans: [0, 1, 2], peerTeam: { hp: 0, g1: 1, g2: 2 }, hostPeer: 'hp' }); return { c, H, sent, NET: ev(c, 'NET'), G: () => ev(c, 'G') }; }
const valid = c => ev(A.c, 'netValidCmd')(c, false), A = mk(true);
// every command shape the real UI sends must pass
const honest = [{ c: 'attack', u: [1, 2], t: 9 }, { c: 'bcancel', b: 3 }, { c: 'board', u: [4], tr: 5 }, { c: 'build', t: 'power', x: 10, y: 12 }, { c: 'cancel', t: 'rifle', n: 5 }, { c: 'derrick', u: [1], k: 2 },
  { c: 'enq', t: 'harv', n: 1 }, { c: 'enq', t: 'power' }, { c: 'form', u: [1, 2], x: 3.5, y: 4.25, a: 1.2 }, { c: 'mbuild', b: 1, k: 'nuke' }, { c: 'mlaunch', b: 1, x: 20.5, y: 30 }, { c: 'move', u: Array.from({ length: 1500 }, (_, i) => i), x: 40, y: 40, am: true, q: false },
  { c: 'ping', x: 1, y: 2, k: 'attack' }, { c: 'rally', b: [1, 2], x: 3, y: 4 }, { c: 'repair', b: 1, on: true }, { c: 'research', b: 1, k: 'armor' }, { c: 'sell', b: 1 }, { c: 'siege', u: [1], on: 1 }, { c: 'skipwave' },
  { c: 'stance', u: [1], s: 'hold' }, { c: 'stop', u: [1] }, { c: 'surrender' }, { c: 'unload', tr: 1, x: 2, y: 3 }, { c: 'upg', b: 1 }, { c: 'upgall', b: [1, 2, 3] }, { c: 'walls', t: Array.from({ length: 300 }, (_, i) => [i % 90, 7]) }, { c: 'xform', u: [1] }, { c: 'place', cat: 'bld', x: 5, y: 6 }];
ok(honest.every(valid), 'all ' + honest.length + ' honest command shapes pass (' + honest.filter(h => !valid(h)).map(h => h.c).join(',') + ')');
const bad = [null, 5, 'x', [], { c: 'nope' }, { c: '__proto__' }, { c: 'constructor' }, { c: 'drop', p: 0 }, { c: 'retake', p: 2 }, { c: 'enq', t: 'rifle', n: 1e9 }, { c: 'cancel', t: 'rifle', n: -1 }, { c: 'move', u: Array(5000).fill(1), x: 1, y: 1 },
  { c: 'move', u: [1], x: 1e12, y: 1 }, { c: 'enq', t: '__proto__' }, JSON.parse('{"c":"move","u":[1],"x":1,"y":1,"__proto__":{"polluted":1}}'), { c: 'move', u: [[[[1]]]], x: 1, y: 1 }, { c: 'chat', m: 'x'.repeat(100) }];
ok([{ c: 'retake', p: 2, n: 'P2' }, { c: 'drop', p: 1, diff: 'normal' }].every(c => ev(A.c, 'netValidCmd')(c, true)), 'host-made drop/retake pass when they come from the host');
ok(bad.every(b => !valid(b)), 'all ' + bad.length + ' hostile commands rejected (' + bad.filter(valid).map(b => JSON.stringify(b).slice(0, 40)).join(' | ') + ')');
// host: hostile 'in' messages from guest g1
const H = A.H; let threw = 0; const call = (f, ...a) => { try { f(...a); } catch (e) { threw++; console.log('  threw', e.message); } };
for (const d of [null, 'x', 7, [], {}, { t: 'abc' }, { t: 1e15, c: [] }, { t: 10, c: 'x' }, { t: 10, c: Array(300).fill({ c: 'stop', u: [] }) }, { t: 10, c: bad }, { t: 10, h: ['a', {}] }]) call(H.in, d, 'g1');
call(H.in, { t: 10, c: [{ c: 'drop', p: 0 }, { c: 'enq', t: 'rifle', n: 1e9 }, { c: 'stop', u: [1] }] }, 'g1');
const queued = [...A.NET.cin.values()].flat();
ok(queued.length === 1 && queued[0][1].c === 'stop' && queued[0][0] === 1, 'host keeps only the valid command, under the sender\'s own team (' + JSON.stringify(queued).slice(0, 80) + ')');
call(H.in, { t: 10, c: [{ c: 'stop', u: [1] }] }, 'stranger'); ok([...A.NET.cin.values()].flat().length === 1, 'input from a peer with no slot is ignored');
for (const d of [null, {}, { s: 'x' }, { s: Infinity }]) call(H.po, d, 'g1'); call(H.hash, { t: 'x', h: {} }, 'g1'); call(H.rejoin, null, 'g1'); call(H.rejoin, { name: '<img src=x onerror=alert(1)>' }, 'g9');
ok(!A.G().players[0].ai && !A.G().players[1].ai, 'no player was turned into AI');
// client: host-only messages from a non-host are ignored; hostile host data is bounded
const B = mk(false); B.G().tick = 0;
call(B.H.turn, { t: 1, n: 3, c: [[0, 0, { c: 'surrender' }]] }, 'g2'); ok(!B.NET.turns.get(1).length, 'turn from a non-host peer ignored');
call(B.H.turn, { t: 2, n: 1e9, c: [] }, 'hp'); ok(B.NET.maxTurn < 1000, 'huge turn count rejected');
call(B.H.turn, { t: 2, n: 1, c: [[0, 0, { c: 'enq', t: 'rifle', n: 1e9 }], [0, 1, { c: 'stop', u: [1] }], 'junk', [0, 99, { c: 'stop' }]] }, 'hp');
ok(B.NET.turns.get(2).length === 1 && B.NET.turns.get(2)[0][1].c === 'stop', 'client keeps only valid turn commands');
const D0 = B.NET.DELAY; call(B.H.pg, { s: 1, d: 1e9 }, 'hp'); call(B.H.pg, { s: 1, d: 9 }, 'g2'); ok(B.NET.DELAY === D0, 'bad/foreign delay ignored');
const t0 = Date.now(); call(B.H.sync, { full: false, last: 1e12, log: [], names: [] }, 'hp'); call(B.H.sync, { full: true, last: 5, log: [[1, [[0, { c: 'enq', n: 1e9, t: 'rifle' }]]]], names: [], me: 1, humans: [0, 1], peerTeam: {} }, 'hp');
call(B.H.sync, 'x', 'hp'); call(B.H.sync, null, 'hp'); call(B.H.desync, { t: 'x' }, 'hp'); ok(Date.now() - t0 < 2000 && B.G().tick === 0 && !B.NET.desync, 'hostile sync/desync rejected instantly (no freeze)');
call(B.H.sync, { full: false, last: 30, log: [[3, [[1, { c: 'stop', u: [] }]]]], names: ['<b>x</b>', null, null], d: 5 }, 'hp'); ok(B.G().tick === 30 && B.G().players[0].name === 'bx/b', 'valid resync still works; names cleaned (' + B.G().players[0].name + ')');
ok(ev(A.c, 'netSafeName')('<script>alert(1)</script>') === 'scriptalert(1)/s' && ev(A.c, 'netEsc')('<a href="x">') === '&lt;a href=&quot;x&quot;&gt;', 'name cleaning + escaping');
ok(threw === 0, 'no handler threw (' + threw + ')');
ok(({}).polluted === undefined, 'no prototype pollution');
console.log(fail ? 'NETSEC FAIL' : 'NETSEC OK'); process.exit(fail ? 1 : 0);
