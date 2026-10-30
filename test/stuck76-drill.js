// 4c drill: where do Hard (si2) armies get stuck? 4v4, every 10 s: a ground combat unit with a move/amove order and no target that moved < 1.5 tiles in 30 s = stuck.
// node test/stuck76-drill.js [map=volcano8] [seed=5] [min=12] [old=0 -> 1: every bot uses the live brain (ntOff/pwOff)]
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
const [map = 'volcano8', seed = '5', mm = '12', old = '0'] = process.argv.slice(2);
const facs = ['fra', 'chn', 'ger', 'rus', 'usa', 'fra', 'chn', 'ger'];
const n = map === 'volcano8' ? 8 : 2, slots = [...Array(n)].map((_, i) => ({ ai: true, diff: 'si2', fac: facs[i], ally: i < n / 2 ? 0 : 1 }));
newGame({ seed: +seed, map, slots }); if (old === '1') for (const P of G.players) { P.ntOff = true; P.pwOff = true; }
const hist = new Map(), spots = new Map(); let samples = 0, stuck = 0;
const near = u => { let bd = 1e9, bt = 'open'; for (const e of G.ents) if (e.kind === 'b' && e.hp > 0) { const d = Math.hypot(e.x - u.x, e.y - u.y) - Math.max(BT[e.t].w, BT[e.t].h) / 2; if (d < bd) { bd = d; bt = (e.team === u.team ? 'own ' : G.players[e.team] && G.players[e.team].ally === G.players[u.team].ally ? 'ally ' : 'foe ') + e.t; } } return bd < 3 ? bt : 'open'; };
for (let k = 0; k < +mm * 60 * 30 && !G.over; k++) { stepGame(); G.events.length = 0;
  if (G.tick % 300) continue;
  for (const u of G.ents) { if (u.kind !== 'u' || u.hp <= 0 || !UT[u.t].wpn || UT[u.t].air || u.t === 'harv') continue;
    const h = hist.get(u.id) || []; h.push([G.time, u.x, u.y]); while (h.length > 4) h.shift(); hist.set(u.id, h);
    if ((u.order !== 'move' && u.order !== 'amove') || u.tgt || h.length < 4) continue; samples++;
    if (Math.hypot(h[3][1] - h[0][1], h[3][2] - h[0][2]) < 1.5) { stuck++; const key = `${Math.floor(u.x / 8) * 8},${Math.floor(u.y / 8) * 8} ${near(u)}`; spots.set(key, (spots.get(key) || 0) + 1); } } }
console.log(`${map} s${seed} ${old === '1' ? 'LIVE' : 'NEW'} ${(G.time / 60).toFixed(1)}m moving-unit samples ${samples} stuck ${stuck} (${(100 * stuck / Math.max(1, samples)).toFixed(1)}%)`);
console.log('top spots:', [...spots].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} x${v}`).join(' | '));
