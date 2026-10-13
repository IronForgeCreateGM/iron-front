// team game: node test/team.js "si:fra,si:fra" "hard,hard" seed [map] [maxMin]  -> prints A/B/timeout(pts)
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const [sa, sb, seed, map, mm] = process.argv.slice(2); const parse = (s, ally) => s.split(',').map(x => { const [diff, fac] = x.split(':'); return { ai: true, diff, fac, ally }; });
const slots = parse(sa, 0).concat(parse(sb, 1)); const maxT = (+mm || 40) * 60;
A.newGame({ seed: +seed, map: map || 'classic', slots });
let first = null; for (let n = 0; n < maxT * 30 && !A.G.over; n++) { A.stepGame(); for (const e of A.G.events) if (e.e === 'attacked' && first == null && A.G.time > 1) first = { t: A.G.time, team: e.team }; A.G.events.length = 0;
  const al = new Set(A.G.players.filter(P => !P.out).map(P => P.ally)); if (al.size < 2) break; }
const al = new Set(A.G.players.filter(P => !P.out).map(P => P.ally));
const v = a => A.G.ents.filter(e => A.G.players[e.team].ally === a && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
let res = al.size === 1 ? (al.has(0) ? 'A' : 'B') : (v(0) > v(1) * 1.3 ? 'A(pts)' : v(1) > v(0) * 1.3 ? 'B(pts)' : 'T');
console.log(`${sa} vs ${sb} s${seed} ${map || 'classic'} ${res} ${(A.G.time / 60).toFixed(1)}m`);
