// v7.6.1 trace: per-30s army / attack-plan state. node test/trace761.js '<slots>' seed maxMin ; env MAP PEACE SIOFF EVERY(sec)
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {}; (process.env.SIOFF || '').split(',').filter(Boolean).forEach(k => SIOFF[k] = 1);
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
const slots = JSON.parse(process.argv[2]), seed = +process.argv[3] || 1, maxMin = +process.argv[4] || 15, ev = +(process.env.EVERY || 30);
A.newGame({ seed, map: process.env.MAP || 'classic', peace: +(process.env.PEACE || 0), slots: slots.map((s, i) => ({ ai: true, diff: s.diff, fac: s.fac, ally: s.ally, start: s.start != null ? s.start : i })) });
for (let n = 0; n < 30 * 60 * maxMin && !A.G.over; n++) { A.stepGame(); const G = A.G; G.events.length = 0;
  if (G.tick % (30 * ev) === 0) { const L = [];
    for (const P of G.players) { const S = P.aiS || {}; const m = G.ents.filter(e => e.team === P.team && e.hp > 0); const army = m.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv');
      const av = army.reduce((a, e) => a + UT[e.t].cost, 0); const st = G.starts[P.start]; const away = army.filter(u => Math.hypot(u.x - st[0], u.y - st[1]) > 30).length;
      const comp = {}; for (const u of army) comp[u.t] = (comp[u.t] || 0) + 1; const top = Object.entries(comp).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + v).join(',');
      L.push(`t${P.team}${P.diff}: a${(av / 1000).toFixed(1)}k p${popOf(P.team)} away${away} grp${(S.grp || []).length} need${((S.need71 || 0) / 1000).toFixed(0)}k cr${P.cr | 0} def${m.filter(e => e.kind === 'b' && BT[e.t].cat === 'def').length} [${top}]${P.out ? ' OUT' : ''}`); }
    const tp = G.tp71 || {}; console.log(`${(G.time / 60).toFixed(1)}m ` + L.join(' | ') + ' plan:' + JSON.stringify(Object.fromEntries(Object.entries(tp).map(([k, p]) => [k, p ? { tg: p.team, go: p.go | 0, m: Object.keys(p.m) } : null])))); } }
console.log('over', A.G.over ? 'ally' + A.G.winAlly : 'no', (A.G.time / 60).toFixed(1));
