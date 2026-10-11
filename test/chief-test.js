// Chief (team 0) vs Hard (team 1) across seeds: node test/chief-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,get G(){return G}};');
const A = globalThis.__api; const seeds = (process.argv[2] || '1,2,3,4,5').split(',').map(Number); let wins = 0;
for (const seed of seeds) {
  A.newGame({ seed, diff: 'hard', aiTeams: [0, 1] }); A.G.players[0].diff = 'chief'; aiInit(A.G.players[0]);
  let n = 0; const ore0 = A.G.ore.reduce((a, b) => a + b, 0); let ore20 = null;
  while (!A.G.over && n < 30 * 60 * 40) { A.stepGame(); A.G.events.length = 0; n++; if (n === 30 * 60 * 20) ore20 = A.G.ore.reduce((a, b) => a + b, 0) / ore0; }
  const win = A.G.over === 'victory'; if (win) wins++;
  console.log(`seed ${seed}: ${A.G.over || 'timeout'} at ${(A.G.time / 60).toFixed(1)} min  mined=${A.G.players.map(p => p.stats.mined | 0)} cr=${A.G.players.map(p => p.cr | 0)} ore@20min=${ore20 == null ? '-' : (ore20 * 100).toFixed(0) + '%'}`);
}
console.log(`Chief vs Hard: ${wins}/${seeds.length} wins`);
