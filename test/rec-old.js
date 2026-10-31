// record a headless game with an older checkout's code (scripted human + 3 si2 bots, volcano8, flags r76/nt/m7) -> replay file for replay-uploads.js
// node test/rec-old.js <repoDir> <out.json> [minutes] [seed] [m7]
const fs = require('fs'), vm = require('vm'), path = require('path');
const [root, out, mins = 12, seed = 4242, m7 = 1] = process.argv.slice(2);
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(path.resolve(root), 'js', f), 'utf8'));
const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Array, Object, JSON, String, Number, isFinite, Date }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c);
const ev = s => vm.runInContext(s, c), TICKS = 30 * 60 * +mins;
const SLOTS = [{ ai: false, ally: 0, start: 0, fac: 'fra', name: 'Nicholas' }, { ai: true, diff: 'si2', ally: 1, start: 3, fac: 'bra' }, { ai: true, diff: 'si2', ally: 0, start: 2, fac: 'usa' }, { ai: true, diff: 'si2', ally: 1, start: 1, fac: 'chn' }];
ev(`ME=0; newGame({ seed: ${+seed}, map: 'volcano8', fog: false, peace: 180, r76: 1, nt: 1, m7: ${+m7}, slots: ${JSON.stringify(SLOTS)} }); recStart();`);
for (let t = 0; t < TICKS && !ev('G.over'); t++) { ev('stepGame()');
  if (t === 30) ev(`execCmd(0, { c: 'enq', t: 'power' })`); if (t % 600 === 300) ev(`{ const r = G.players[0].ready.bld; if (r) { const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); for (let k = 0; k < 40; k++) { const x = hq.tx + ((k * 7) % 13) - 6, y = hq.ty + ((k * 5) % 11) - 5; if (canPlace(r, 0, x, y)) { execCmd(0, { c: 'place', cat: 'bld', x, y }); break; } } } }`);
  if (t === 900) ev(`execCmd(0, { c: 'enq', t: 'barracks' })`); if (t > 2000 && t % 450 === 0) ev(`execCmd(0, { c: 'enq', t: 'rifle' })`);
  ev('G.events.length = 0'); }
const file = ev('replayFile()'); fs.writeFileSync(out, file); const d = JSON.parse(file);
console.log('recorded', out, 'ver', d.ver, 'm7', d.m7, 'len', d.len, 'hashes', d.hash.length, 'cmds', d.cmds.length);
