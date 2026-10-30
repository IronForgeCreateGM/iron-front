// v7.6 drill/game harness: node test/v76-game.js '<json slots>' seed [maxMin] ; env MAP. slots: [{diff,fac,ally,start}]
// prints result + per-team economy/army/warhead stats (minute marks in GAMEMIN env, default 5,10,15)
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; (process.env.SIOFF || '').split(',').filter(Boolean).forEach(k => SIOFF[k] = 1);
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const slots = JSON.parse(process.argv[2]), seed = +process.argv[3] || 1, maxMin = +process.argv[4] || 30;
A.newGame({ seed, map: process.env.MAP || 'classic', peace: +(process.env.PEACE || 0), slots: slots.map((s, i) => ({ ai: true, diff: s.diff, fac: s.fac, ally: s.ally, start: s.start != null ? s.start : i, color: s.color })) });
const st = slots.map(() => ({ launch: {}, engCC: 0, sm3: 0, built: {}, lost: 0, idleArmySec: 0 })), marks = (process.env.GAMEMIN || '5,10,15').split(',').map(Number); const snaps = [];
const t0 = Date.now();
for (let n = 0; n < 30 * 60 * maxMin && !A.G.over; n++) { A.stepGame(); const G = A.G;
  for (const e of G.events) { if (e.e === 'launch' && st[e.team]) st[e.team].launch[e.k] = (st[e.team].launch[e.k] || 0) + 1; if (e.e === 'engCC' && st[e.team]) st[e.team].engCC++; if (e.e === 'built' && st[e.b.team]) st[e.b.team].built[e.b.t] = (st[e.b.team].built[e.b.t] || 0) + 1; }
  G.events.length = 0;
  if (G.tick % 1800 === 0 && marks.includes(G.tick / 1800)) snaps.push(G.players.map(P => { const m = G.ents.filter(e => e.team === P.team && e.hp > 0); const c = t => m.filter(e => e.t === t && !e.con).length;
    return `t${P.team}:${P.diff}/${P.fac} cr${Math.round(P.cr)} yd${c('hq') + c('cc')} ref${c('refinery')} hv${c('harv')} dk${(G.derricks || []).filter(d => d.owner === P.team).length} fac${c('factory')} bar${c('barracks')} silo${c('silo')} def${m.filter(e => e.kind === 'b' && BT[e.t].cat === 'def').length} army${Math.round(m.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv').reduce((a, e) => a + UT[e.t].cost, 0) / 100) / 10}k pop${popOf(P.team)} K${P.stats.kills}${P.out ? ' OUT' : ''}${process.env.BUILT ? ' B' + JSON.stringify(st[P.team].built) + ' lostU' + (P.stats.lost || 0) : ''}`; }).join(' | ')); }
const G = A.G; let res = G.over;
const val = t => G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0) + G.players[t].cr * 0.3;
const allyV = a => G.players.filter(P => P.ally === a && !P.out).reduce((s, P) => s + val(P.team), 0);
if (!res) { const a = allyV(0), b = allyV(1); res = a > b * 1.3 ? 'ally0(pts)' : b > a * 1.3 ? 'ally1(pts)' : 'timeout'; } else res = 'ally' + G.winAlly + ' wins';
console.log(`RESULT seed ${seed} ${res} at ${(G.time / 60).toFixed(1)}min (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
for (const s of snaps) console.log('  ' + s);
G.players.forEach((P, i) => console.log(`  t${i} ${P.diff}/${P.fac} ${P.out ? 'OUT' : 'alive'} launches ${JSON.stringify(st[i].launch)} engCC ${st[i].engCC} sm3 ${G.ents.filter(e => e.team === i && e.sm3).length} built ${JSON.stringify(st[i].built)}`));
