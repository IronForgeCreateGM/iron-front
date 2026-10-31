// economy trace: node test/eco7-trace.js map seed facA facB swap maxMin [startA startB]  (same env/semantics as m7-vs.js); prints every 60 s per side: cr, gas, mined, harv, ref, yards, pop, army value
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SION = JSON.parse(process.env.SION || '{}'); const OFF = JSON.parse(process.env.SIOFF || '{}');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
Object.assign(SIOFF, OFF);
const [map, seed, fa, fb, swap, mm, sa, sb] = process.argv.slice(2), sw = swap === '1';
const slots = [{ ai: true, diff: 'si2', fac: fa, start: sa != null ? +sa : 0, ally: 0 }, { ai: true, diff: 'si2', fac: fb, start: sb != null ? +sb : 1, ally: 1 }];
newGame({ seed: +seed, map, slots, r76: 1, peace: +(process.env.PEACE || 0) || undefined, fog: process.env.FOG !== '0' }); const newT = sw ? 1 : 0; G.players[1 - newT].m7Off = true; if (process.env.BOTHOLD) G.players[newT].m7Off = true;
const maxT = (+mm || 15) * 60 * 30;
const row = t => { const P = G.players[t], me = G.ents.filter(e => e.team === t && e.hp > 0); const c = k => me.filter(e => e.t === k && !e.con).length;
  const av = me.filter(e => e.kind === 'u' && e.t !== 'harv').reduce((s, e) => s + UT[e.t].cost, 0);
  return `${P.fac} cr${(P.cr / 1000).toFixed(1)}k g${P.gas | 0} mined${(P.stats.mined / 1000) | 0}k harv${c('harv')} ref${c('refinery')} yard${c('hq') + c('cc')} ext${c('extractor')} bar${c('barracks')} fac${c('factory')} air${c('airfield')} def${me.filter(e => e.kind === 'b' && BT[e.t].wpn).length} army${(av / 1000) | 0}k`; };
for (let n = 1; n <= maxT && !G.over; n++) { stepGame(); G.events.length = 0; if (n % 1800 === 0) console.log(`${n / 1800}m NEW ${row(newT)} || OLD ${row(1 - newT)}`); }
