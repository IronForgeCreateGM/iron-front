// transport: board 8 slots (inf 1, veh 4), capacity enforced, unload anywhere, cargo dies with transport
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addU,orderBoard,orderUnload,cargoUsed,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
A.newGame({ seed: 3, slots: [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }] });
const tr = A.addU('hauler', 0, 14, 14); A.G.opts.fog = false, tk = A.addU('heavy', 0, 12, 14), tk2 = A.addU('scout', 0, 12, 15), inf = [0, 1, 2, 3, 4].map(i => A.addU('rifle', 0, 15 + i * 0.4, 12));
A.orderBoard([tk, ...inf.slice(0, 4), tk2], tr); for (let i = 0; i < 30 * 12; i++) A.stepGame();
ok(A.cargoUsed(tr) === 8 && tr.cargo.length === 5, 'boarded heavy + 4 rifles = 8 slots (got ' + A.cargoUsed(tr) + ', n=' + tr.cargo.length + ')');
ok(!A.G.ents.includes(tk) && A.G.ents.includes(tk2), 'boarded units leave the map, overflow stays');
A.orderUnload(tr, 40, 30); for (let i = 0; i < 30 * 20; i++) A.stepGame();
ok(tr.cargo.length === 0 && A.G.ents.includes(tk) && Math.hypot(tk.x - 40, tk.y - 30) < 4, 'unloaded at destination (' + tk.x.toFixed(1) + ',' + tk.y.toFixed(1) + ')');
A.orderBoard(inf.slice(0, 3), tr); for (let i = 0; i < 30 * 8; i++) A.stepGame(); const n0 = tr.cargo.length; const lost0 = A.G.players[0].stats.lost; tr.hp = 0; A.stepGame();
console.log('n0', n0, A.G.players[0].stats.lost - lost0); ok(n0 === 3 && A.G.players[0].stats.lost - lost0 === 4, 'cargo dies with transport');
console.log(fail ? 'TRANSPORT FAIL' : 'TRANSPORT OK'); process.exit(fail ? 1 : 0);
