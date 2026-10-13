// v5.2 replay recorder: record a game (scripted "human" commands + AIs) in one VM, replay the file in a fresh VM -> identical hashes + outcome
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'));
function ctx() { const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Array, Object, JSON, String, Number, isFinite, Date }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c); return c; }
const ev = (c, s) => vm.runInContext(s, c), TICKS = 30 * 60 * 5;
const SLOTS = [{ ai: false, ally: 0, start: 0, fac: 'fra', name: 'Nicholas' }, { ai: true, diff: 'hard', ally: 1, start: 3, fac: 'rus' }, { ai: true, diff: 'si', ally: 0, start: 2, fac: 'usa' }, { ai: true, diff: 'hard', ally: 1, start: 1, fac: 'ger' }];
const a = ctx(); ev(a, `ME=0; newGame({ seed: 777, map: 'volcano', slots: ${JSON.stringify(SLOTS)} }); recStart();`);
// scripted human: build power/barracks, train rifles, attack-move
let t0 = Date.now();
for (let t = 0; t < TICKS; t++) { ev(a, 'stepGame()');
  if (t === 30) ev(a, `execCmd(0, { c: 'enq', t: 'power' })`); if (t % 600 === 300) ev(a, `{ const r = G.players[0].ready.bld; if (r) { const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); for (let k = 0; k < 40; k++) { const x = hq.tx + ((k * 7) % 13) - 6, y = hq.ty + ((k * 5) % 11) - 5; if (canPlace(r, 0, x, y)) { execCmd(0, { c: 'place', cat: 'bld', x, y }); break; } } } }`);
  if (t === 900) ev(a, `execCmd(0, { c: 'enq', t: 'barracks' })`); if (t > 2000 && t % 450 === 0) ev(a, `execCmd(0, { c: 'enq', t: 'rifle' })`);
  if (t > 3000 && t % 900 === 0) ev(a, `{ const u = G.ents.filter(e => e.team === 0 && e.kind === 'u' && e.t !== 'harv').map(e => e.id); if (u.length) execCmd(0, { c: 'move', u, x: 48, y: 48, am: true }); }`);
  ev(a, 'G.events.length = 0'); }
const file = ev(a, 'replayFile()'), d = JSON.parse(file), hA = ev(a, 'stateHash()');
console.log('recorded', d.cmds.length, 'cmds,', (file.length / 1024).toFixed(1), 'KB,', d.hash.length, 'hashes');
const b = ctx(); ev(b, `ME=0; G={}; const d=${file}; newGame({ seed: d.seed, map: d.map, peace: d.peace, slots: d.slots }); G.replay = { cmds: d.cmds, hash: d.hash, i: 0, checked: 0, bad: 0 };`);
for (let t = 0; t < TICKS; t++) { ev(b, 'stepGame(); G.events.length = 0'); }
const hB = ev(b, 'stateHash()'), chk = ev(b, 'G.replay.checked'), bad = ev(b, 'G.replay.bad');
console.log('final hash', hA, hB, 'checked', chk, 'bad', bad, ((Date.now() - t0) / 1000).toFixed(1) + 's');
const ok = hA === hB && !bad && chk >= 5 && d.cmds.length > 5 && file.length < 200000;
console.log(ok ? 'REPLAY OK' : 'REPLAY FAIL'); process.exit(ok ? 0 : 1);
