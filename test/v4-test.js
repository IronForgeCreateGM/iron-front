// v4 sims: 1v1 Chief/SI vs Hard over N seeds, plus 2v2 sanity. usage: node test/v4-test.js [n] [mode]
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const N = +process.argv[2] || 10, mode = process.argv[3] || 'all', MAXT = 30 * 60 * 30;
function run(slots, seed) {
  A.newGame({ seed, slots, fog: true });
  let n = 0; for (; n < MAXT && !A.G.over; n++) { A.stepGame(); A.G.events.length = 0; }
  const G = A.G, cc = G.players.map(P => G.ents.filter(e => e.team === P.team && e.t === 'cc').length);
  return { over: G.over || 'timeout', t: (G.time / 60).toFixed(1), cc, maxcc: G.players.map(P => P.stats.built), out: G.players.map(P => P.out) };
}
const S = (diff, ally, start) => ({ ai: true, diff, ally, start });
if (mode === 'all' || mode === '1v1' || mode === 'chief' || mode === 'si') for (const who of (mode === 'chief' || mode === 'si' ? [mode] : ['chief', 'si'])) {
  let w = 0, l = 0, to = 0, ts = [];
  for (let s = 1; s <= N; s++) { const r = run([S(who, 0, 0), S('hard', 1, 3)], s * 101); if (r.over === 'victory') { w++; ts.push(+r.t); } else if (r.over === 'defeat') l++; else to++; console.log(`  ${who} seed ${s * 101}: ${r.over} @${r.t}min cc=${r.cc}`); }
  console.log(`[${who} vs hard] wins ${w}/${N} losses ${l} timeouts ${to} avgWin ${(ts.reduce((a, b) => a + b, 0) / Math.max(1, ts.length)).toFixed(1)}min`);
}
if (mode === 'all' || mode === '2v2') for (let s = 1; s <= Math.min(N, 4); s++) { const r = run([S('si', 0, 0), S('chief', 0, 2), S(process.env.OPP || 'hard', 1, 3), S(process.env.OPP || 'hard', 1, 1)], s * 7); console.log(`[2v2 SI+Chief vs 2 ${process.env.OPP || 'hard'} seed ${s * 7}] ${r.over} @${r.t}min cc=${r.cc} out=${r.out}`); }
if (mode === 'all' || mode === 'ffa') { const r = run([S('easy', 0, 0), S('normal', 1, 1), S('hard', 2, 2), S('normal', 3, 3)], 3); console.log(`[4-player FFA] ${r.over} @${r.t}min out=${r.out}`); }
