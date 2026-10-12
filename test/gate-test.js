// wall gate: own units path through, enemies must go around / are blocked
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addU,addB,orderMove,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
A.newGame({ seed: 4, slots: [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }] });
// find an open 11x13 patch, then seal a pocket with a wall ring and a gate in its top wall
let X = -1, Y = -1; for (let y = 30; y < 80 && X < 0; y++) for (let x = 8; x < 80; x++) { let open = true; for (let dy = -4; dy < 9 && open; dy++) for (let dx = 0; dx < 11; dx++) if (A.G.map[(y + dy) * 96 + x + dx] || A.G.ore[(y + dy) * 96 + x + dx] > 0) { open = false; break; } if (open && Math.hypot(x - 10, y - 10) > 14) { X = x; Y = y; break; } }
const T = (x, y) => [x - 20 + X, y - 20 + Y];
for (let x = 20; x <= 26; x++) for (const y of [20, 26]) if (!(x === 23 && y === 20)) A.addB('wall', 0, ...T(x, y), true);
for (let y = 21; y <= 25; y++) for (const x of [20, 26]) A.addB('wall', 0, ...T(x, y), true);
A.addB('gate', 0, ...T(23, 20), true); A.G.bver++;
const mine = A.addU('rifle', 0, X + 3.5, Y - 2.5), his = A.addU('rifle', 1, X + 2.5, Y - 2.5);
A.orderMove([mine], X + 3.5, Y + 3.5); A.orderMove([his], X + 3.5, Y + 3.5);
for (let i = 0; i < 30 * 15; i++) { A.stepGame(); if (process.env.DBG && i % 15 === 0) console.log(i, mine.x.toFixed(2), mine.y.toFixed(2), mine.order, mine.path.length); }
const inside = u => u.x > X + 1 && u.x < X + 6 && u.y > Y + 1 && u.y < Y + 6;
ok(inside(mine), 'own rifle walks through the gate into the pocket (' + mine.x.toFixed(1) + ',' + mine.y.toFixed(1) + ')');
ok(!inside(his), 'enemy rifle is kept out (' + his.x.toFixed(1) + ',' + his.y.toFixed(1) + ')');
console.log(fail ? 'GATE FAIL' : 'GATE OK'); process.exit(fail ? 1 : 0);
