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
// v5.3 chaining: a 4-coil cluster relays into one bolt; compare first-bolt damage and time-to-kill vs a lone coil
function run(n) { A.newGame({ seed: 4, slots: [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }] }); A.G.opts.fog = false;
  for (let i = 0; i < 6; i++) A.addB('power', 0, 4 + i * 2, 18, true).born = -10;
  const pos = [[14, 10], [12, 10], [14, 12], [12, 12]]; for (let i = 0; i < n; i++) A.addB('tesla', 0, pos[i][0], pos[i][1], true).born = -10;
  const tk = A.addU('heavy', 1, 18.5, 10.5); tk.order = 'hold'; const hp0 = tk.hp; let firstN = 0, rp = 0, t = 0, firstDmg = 0;
  for (let i = 0; i < 30 * 30 && tk.hp > 0; i++) { A.stepGame(); for (const e of A.G.events) if (e.e === 'zap' && !firstN) { firstN = e.n; rp = (e.rp || []).length; firstDmg = hp0 - tk.hp; } A.G.events.length = 0; t = i; }
  return { firstN, rp, ttk: (t + 1) / 30, firstDmg, dead: tk.hp <= 0 }; }
const s1 = run(1), s4 = run(4); console.log('solo', JSON.stringify(s1), 'cluster4', JSON.stringify(s4));
ok(s4.firstN === 4 && s4.rp === 3, 'cluster of 4 relays into one bolt (n=' + s4.firstN + ', relay arcs ' + s4.rp + ')');
ok(s4.firstDmg > s1.firstDmg * 3.5 && s4.firstDmg < s1.firstDmg * 5, 'stacked bolt ' + s4.firstDmg.toFixed(0) + ' vs solo ' + s1.firstDmg.toFixed(0));
ok(s4.dead && (!s1.dead || s4.ttk < s1.ttk * 0.5), 'cluster kills heavy tank much faster (' + s4.ttk.toFixed(1) + 's vs ' + (s1.dead ? s1.ttk.toFixed(1) + 's' : 'alive') + ')');
console.log(fail ? 'TESLA FAIL' : 'TESLA OK'); process.exit(fail ? 1 : 0);
