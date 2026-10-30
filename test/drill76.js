// v7.6.1 drill: spending breakdown per team at minute marks. node test/drill76.js '<slots json>' seed maxMin ; env MAP, MARKS (min list)
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; (process.env.SIOFF || '').split(',').filter(Boolean).forEach(k => SIOFF[k] = 1);
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const slots = JSON.parse(process.argv[2]), seed = +process.argv[3] || 1, maxMin = +process.argv[4] || 6;
A.newGame({ seed, map: process.env.MAP || 'classic', slots: slots.map((s, i) => ({ ai: true, diff: s.diff, fac: s.fac, ally: s.ally, start: s.start != null ? s.start : i })) });
const marks = (process.env.MARKS || '3,5,7,9').split(',').map(Number);
const sp = slots.map(() => ({ eco: 0, prod: 0, def: 0, army: 0, harvEng: 0, other: 0, nU: 0, lostArmy: 0, lostB: 0 }));
const ECO = ['power', 'refinery', 'cc', 'extractor'], PROD = ['barracks', 'factory', 'airfield', 'tech', 'silo'];
for (let n = 0; n < 30 * 60 * maxMin && !A.G.over; n++) { A.stepGame(); const G = A.G;
  for (const e of G.events) {
    if (e.e === 'built' && sp[e.b.team]) { const t = e.b.t, c = BT[t].cost; const s = sp[e.b.team]; if (ECO.includes(t)) s.eco += c; else if (PROD.includes(t)) s.prod += c; else if (BT[t].cat === 'def') s.def += c; else s.other += c; }
    if (e.e === 'unit' && sp[e.team]) { const t = e.u.t, c = UT[t].cost; const s = sp[e.team]; if (t === 'harv' || t === 'engineer') s.harvEng += c; else { s.army += c; s.nU++; } }
    if (e.e === 'die' && e.ent && sp[e.ent.team]) { const x = e.ent; if (x.kind === 'u' && UT[x.t].wpn && x.t !== 'harv') { const st = G.starts[G.players[x.team].start], d = Math.hypot(x.x - st[0], x.y - st[1]); if (d < 28) sp[x.team].lostHome = (sp[x.team].lostHome || 0) + UT[x.t].cost; else sp[x.team].lostArmy += UT[x.t].cost; } }
  }
  G.events.length = 0;
  if (G.tick % 1800 === 0 && marks.includes(G.tick / 1800)) { console.log(`-- ${G.tick / 1800} min`);
    G.players.forEach((P, i) => { const m = G.ents.filter(e => e.team === P.team && e.hp > 0); const s = sp[i]; const c = t => m.filter(e => e.t === t && !e.con).length;
      const army = m.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv').reduce((a, u) => a + UT[u.t].cost, 0);
      const q = Object.entries(P.queues).map(([k, v]) => k + v.length).join(' ');
      console.log(`  t${i} ${P.diff}/${P.fac} cr${P.cr | 0} rv${(P._rv || 0) | 0} mined${P.stats.mined|0} | eco${s.eco} prod${s.prod} def${s.def} army+${s.army}(${s.nU}u) hv/eng${s.harvEng} oth${s.other} lostAway${s.lostArmy} lostHome${s.lostHome||0} atk${P.aiS.lastAttack|0} | armyNow${army} ref${c('refinery')} hv${c('harv')} fac${c('factory')} bar${c('barracks')} air${c('airfield')} yd${c('hq') + c('cc')} pow${P.pow} q[${q}]`); }); }
}
console.log('over', A.G.over ? 'ally' + A.G.winAlly : 'no', (A.G.time / 60).toFixed(1));
