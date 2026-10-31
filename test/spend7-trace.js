// where does each side's money go? same args/env as eco7-trace.js; prints per 2 min: built value by class (army units / harv / defences / other buildings) and army value lost, plus top unit types
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SION = JSON.parse(process.env.SION || '{}'); const OFF = JSON.parse(process.env.SIOFF || '{}');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
Object.assign(SIOFF, OFF);
const [map, seed, fa, fb, swap, mm, sa, sb] = process.argv.slice(2), sw = swap === '1';
const slots = [{ ai: true, diff: 'si2', fac: fa, start: sa != null ? +sa : 0, ally: 0 }, { ai: true, diff: 'si2', fac: fb, start: sb != null ? +sb : 1, ally: 1 }];
newGame({ seed: +seed, map, slots, r76: 1, peace: +(process.env.PEACE || 0) || undefined, fog: process.env.FOG !== '0' }); const newT = sw ? 1 : 0; G.players[1 - newT].m7Off = true;
const maxT = (+mm || 15) * 60 * 30, seen = new Map(), S = [0, 1].map(() => ({ army: 0, harv: 0, def: 0, bld: 0, lost: 0, types: {} }));
const cost = e => (e.kind === 'u' ? UT[e.t] : BT[e.t]).cost || 0;
for (let n = 1; n <= maxT && !G.over; n++) { stepGame(); G.events.length = 0;
  if (n % 30 === 0) { const now = new Set();
    for (const e of G.ents) { if (e.team > 1 || e.con) continue; now.add(e.id); if (seen.has(e.id)) continue; seen.set(e.id, e); const s = S[e.team], c = cost(e);
      if (e.kind === 'u') { if (e.t === 'harv') s.harv += c; else { s.army += c; s.types[e.t] = (s.types[e.t] || 0) + c; } } else if (BT[e.t].wpn) s.def += c; else s.bld += c; }
    for (const [id, e] of seen) if (!now.has(id)) { if (e.kind === 'u' && e.t !== 'harv') S[e.team].lost += cost(e); seen.delete(id); } }
  if (n % 3600 === 0) { const f = t => { const s = S[t]; const top = Object.entries(s.types).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + ((v / 1000) | 0)).join(' ');
      return `${G.players[t].fac} army${(s.army / 1000) | 0}k harv${(s.harv / 1000) | 0}k def${(s.def / 1000) | 0}k bld${(s.bld / 1000) | 0}k lost${(s.lost / 1000) | 0}k [${top}]`; };
    console.log(`${n / 1800}m NEW ${f(newT)} || OLD ${f(1 - newT)}`); } }
