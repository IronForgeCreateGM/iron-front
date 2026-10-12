const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addU,addB,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const powered of [true, false]) {
  A.newGame({ seed: 4, slots: [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }] }); A.G.opts.fog = false;
  if (powered) for (const [x, y] of [[8, 16], [4, 16], [12, 16]]) A.addB('power', 0, x, y, true).born = -10;
  const t = A.addB('tesla', 0, 14, 10, true); t.born = -10; const foes = [0, 1, 2, 3, 4, 5].map(i => A.addU('rifle', 1, 17 + (i % 3) * 0.7, 10 + (i / 3 | 0) * 0.7)); foes.forEach(f => f.order = 'hold');
  let zaps = 0, maxChain = 0; for (let i = 0; i < 30 * 8; i++) { A.stepGame(); for (const e of A.G.events) if (e.e === 'zap') { zaps++; maxChain = Math.max(maxChain, e.pts.length - 1); } A.G.events.length = 0; }
  const dead = foes.filter(f => f.hp <= 0).length;
  if (powered) ok(zaps > 0 && maxChain >= 3 && dead >= 4, `powered tesla chains (zaps ${zaps}, chain ${maxChain}, killed ${dead}/6)`); else ok(zaps === 0, `unpowered tesla is offline (zaps ${zaps}, pow ${A.G.players[0].pow})`);
}
console.log(fail ? 'TESLA FAIL' : 'TESLA OK'); process.exit(fail ? 1 : 0);
