// one game: node test/one.js <who> <seed> [opp] ; env SIOFF=a,b
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; (process.env.SIOFF || '').split(',').filter(Boolean).forEach(k => SIOFF[k] = 1);
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const [who, seed, opp] = [process.argv[2], +process.argv[3], process.argv[4] || 'hard'];
A.newGame({ seed, slots: [{ ai: true, diff: who, ally: 0, start: 0 }, { ai: true, diff: opp, ally: 1, start: 3 }] });
for (let n = 0; n < 30 * 60 * 30 && !A.G.over; n++) { A.stepGame(); A.G.events.length = 0; }
console.log(`${who} ${seed} ${A.G.over || 'timeout'} ${(A.G.time / 60).toFixed(1)}`);
