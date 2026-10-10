// Headless simulation test: node test/sim-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,get G(){return G}};');
const A = globalThis.__api;
for (const diff of ['easy', 'normal', 'hard']) {
  A.newGame({ seed: 12345, diff, aiTeams: [0, 1] });
  A.G.players[0].diff = 'normal'; aiInit(A.G.players[0]);
  const t0 = Date.now(); let n = 0;
  while (!A.G.over && n < 30 * 60 * 15) { A.stepGame(); A.G.events.length = 0; n++; }
  const c = t => { const o = {}; A.G.ents.filter(e => e.team === t).forEach(e => o[e.t] = (o[e.t] || 0) + 1); return JSON.stringify(o); };
  console.log(`[${diff}] ${(n / 30).toFixed(0)}s sim in ${Date.now() - t0}ms over=${A.G.over} cr=${A.G.players.map(p => p.cr | 0)} mined=${A.G.players.map(p => p.stats.mined | 0)}`);
  console.log('  P0', c(0)); console.log('  P1', c(1));
}
// Easy must not attack a passive/slow human before 8 game minutes
let fail = 0;
for (const seed of [12345, 777, 4242]) {
  A.newGame({ seed, diff: 'easy', aiTeams: [1] });
  let firstHit = null, n = 0;
  while (n < 30 * 60 * 14 && !A.G.over) { A.stepGame(); for (const ev of A.G.events) if (ev.e === 'attacked' && ev.team === 0 && firstHit == null) firstHit = A.G.time; A.G.events.length = 0; n++; }
  const fa = A.G.players[1].aiS.firstAttackT;
  const ok = (fa == null || fa >= 480) && (firstHit == null || firstHit >= 480);
  if (!ok) fail++;
  console.log(`[easy-vs-passive seed=${seed}] AI firstAttack=${fa == null ? 'none' : (fa / 60).toFixed(1) + 'min'} firstDamageToHuman=${firstHit == null ? 'none' : (firstHit / 60).toFixed(1) + 'min'} ${ok ? 'PASS' : 'FAIL'}`);
}
if (fail) { console.error('EASY EARLY-ATTACK CHECK FAILED'); process.exit(1); }
console.log('EASY CHECK OK');
