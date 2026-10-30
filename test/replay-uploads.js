// v7.6.2: re-simulate uploaded replays headless; checks recorded hashes (bad must be 0). node test/replay-uploads.js [repoDir] files...
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(process.argv[2]);
const SRC = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
for (const f of process.argv.slice(3)) { const t0 = Date.now();
  const c = vm.createContext({ console, Math, Map, Set, Float64Array, Float32Array, Uint8Array, Uint32Array, Int32Array, Int8Array, Array, Object, JSON, String, Number, isFinite, Date }); c.globalThis = c; for (const s of SRC) vm.runInContext(s, c);
  const d = JSON.parse(fs.readFileSync(f, 'utf8')); c.D = d;
  vm.runInContext(`ME=D.me||0; newGame({ seed: D.seed, map: D.map, peace: D.peace, fog: D.fog, r76: D.r76 ? 1 : 0, nt: D.nt ? 1 : 0, me: D.me||0, slots: D.slots }); G.replay = { cmds: D.cmds, hash: D.hash, i: 0, checked: 0, bad: 0 };`, c);
  for (let t = 0; t < d.len + 5 && !vm.runInContext('G.over', c); t++) vm.runInContext('stepGame(); G.events.length = 0', c);
  const r = vm.runInContext('[G.replay.checked, G.replay.bad, G.tick, G.over||null]', c);
  console.log(path.basename(f), 'ver', d.ver, 'checked', r[0] + '/' + d.hash.length, 'bad', r[1], 'tick', r[2] + '/' + d.len, 'over', r[3], 'recorded', d.result, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
