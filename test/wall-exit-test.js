// v5.4: AI wall placement must leave a gate and a path out
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addB,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
A.newGame({ seed: 3, map: 'classic', slots: [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }] });
const P = A.G.players[0]; P.cr = 20000; P.aiS = { bad: {} };
const hq = A.G.ents.find(e => e.team === 0 && e.t === 'hq');
for (const [t,x,y] of [['barracks',8,14],['turret',18,12],['turret',19,14],['turret',17,15]]) A.addB(t, 0, x, y, true).born = -10;
const en = { x: 20, y: 14, b: hq, lane: [], wallT: 0 };
aiWallEntrance(P, en);
const walls = A.G.ents.filter(e => e.team === 0 && e.t === 'wall' && e.hp > 0).length;
const gates = A.G.ents.filter(e => e.team === 0 && e.t === 'gate' && e.hp > 0).length;
const free = aiExitFree(P, hq);
ok(gates >= 1, 'at least one gate placed (gates=' + gates + ', walls=' + walls + ')');
ok(free, 'exit path remains after walling');
console.log(fail ? 'WALL-EXIT FAIL' : 'WALL-EXIT OK');
process.exit(fail ? 1 : 0);
