// one game: node test/one.js <who> <seed> [opp] ; env SIOFF=a,b
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; (process.env.SIOFF || '').split(',').filter(Boolean).forEach(k => SIOFF[k] = 1);
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const [who, seed, opp] = [process.argv[2], +process.argv[3], process.argv[4] || 'hard'];
A.newGame({ seed, map: process.env.MAP || 'classic', slots: [{ ai: true, diff: who, ally: 0, start: 0 }, { ai: true, diff: opp, ally: 1, start: 3 }] });
for (let n = 0; n < 30 * 60 * 40 && !A.G.over; n++) { A.stepGame(); A.G.events.length = 0; }
let res = A.G.over; if (!res) { const v = t => A.G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0) + A.G.players[t].cr * 0.3, a = v(0), b = v(1); res = a > b * 1.3 ? 'victory(pts)' : b > a * 1.3 ? 'defeat(pts)' : 'timeout'; }
console.log(`${who} ${seed} ${res} ${(A.G.time / 60).toFixed(1)}`);
