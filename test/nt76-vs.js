// Part B quick head-to-head: si2 with the no-trap check (A) vs si2 without it (B = the live v7.6.3/7.6.4 Hard brain; ntOff also disables the seed-77 no-gate fix)
// node test/nt76-vs.js map seed facA facB swap maxMin
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
const [map, seed, fa, fb, swap, mm] = process.argv.slice(2), sw = swap === '1';
const slots = [{ ai: true, diff: 'si2', fac: sw ? fb : fa, start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: sw ? fa : fb, start: 1, ally: 1 }];
newGame({ seed: +seed, map, slots }); const newT = sw ? 1 : 0; G.players[1 - newT].ntOff = true;
const maxT = (+mm || 25) * 60 * 30, t0 = Date.now();
for (let n = 0; n < maxT && !G.over; n++) { stepGame(); G.events.length = 0; if (G.players.filter(P => !P.out).length < 2) break; }
const v = t => G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
const alive = G.players.filter(P => !P.out).map(P => P.team);
const res = alive.length === 1 ? (alive[0] === newT ? 'NEW' : 'OLD') : v(newT) > v(1 - newT) * 1.3 ? 'NEW(pts)' : v(1 - newT) > v(newT) * 1.3 ? 'OLD(pts)' : 'TIE';
console.log(`${map} s${seed} new=${G.players[newT].fac}@start${newT} ${res} ${(G.time / 60).toFixed(1)}m new ${(G.players[newT].stats.mined / 1000) | 0}k val${v(newT)} | old ${(G.players[1 - newT].stats.mined / 1000) | 0}k val${v(1 - newT)} | ntChecks ${G.ntChecks || 0} rej ${G.ntRej || 0} ${JSON.stringify(G.ntWhy || {})} ${((Date.now() - t0) / 1000) | 0}s`);
