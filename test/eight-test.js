// v5.5: 8-player Volcano Crown XL (4v4): layout, resources, 8 bots run
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const slots = [0,1,2,3,4,5,6,7].map(i => ({ ai: true, diff: 'hard', ally: i < 4 ? 0 : 1 }));
A.newGame({ seed: 5, map: 'volcano8', slots });
const G = A.G;
ok(A.MW === 112 && G.starts.length === 8, 'map 112x112 with 8 starts (MW=' + A.MW + ')');
ok(new Set(G.players.map(P => P.start)).size === 8, 'every player has its own base');
for (const P of G.players) { const [sx, sy] = G.starts[P.start];
  let ore = 0; for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const xx = Math.floor(sx + x), yy = Math.floor(sy + y); if (xx >= 0 && yy >= 0 && xx < A.MW && yy < A.MW) ore += G.ore[yy * A.MW + xx]; }
  const vent = G.vents.some(([vx, vy]) => Math.hypot(vx - sx, vy - sy) < 13);
  G.curTeam = P.team; const p = findPath(sx, sy + 3, A.MW / 2, A.MW / 2 + 9); G.curTeam = null;
  ok(ore > 2500 && vent && p && p.length, `base ${P.start} @${sx.toFixed(0)},${sy.toFixed(0)}: ore ${ore | 0}, gas ${vent}, path to centre ${!!(p && p.length)}`); }
const peak = G.players.map(() => 0); let err = null; try { for (let n = 0; n < 30 * 60 * 6 && !G.over; n++) { A.stepGame(); G.events.length = 0; if (n % 300 === 0) G.players.forEach((P, i) => { peak[i] = Math.max(peak[i], G.ents.filter(e => e.team === P.team && e.kind === 'b').length); }); } } catch (e) { err = e; console.log(e.stack); }
ok(!err, '8 bots run 6 min without errors');
const built = peak; // v5.8: peak (a base can legitimately be razed in an early 4v4 fight)
ok(built.every(n => n >= 5), 'every bot built a base (' + built.join(',') + ')');
console.log(fail ? 'EIGHT FAIL' : 'EIGHT OK'); process.exit(fail ? 1 : 0);
