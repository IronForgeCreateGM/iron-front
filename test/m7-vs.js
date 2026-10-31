// v7.6.6 head-to-head: si2 with the m7 math layer (NEW) vs si2 with m7 off (OLD = the live v7.6.5 Hard brain)
// node test/m7-vs.js map seed facA facB swap maxMin [startA startB]  (NEW = slot0 facA, or slot1 facB if swap=1)   env SION='{"lanR":1.3}' SIOFF='{"m7b":1}'
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SION = JSON.parse(process.env.SION || '{}'); const OFF = JSON.parse(process.env.SIOFF || '{}');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
Object.assign(SIOFF, OFF);
const [map, seed, fa, fb, swap, mm, sa, sb] = process.argv.slice(2), sw = swap === '1';
const s0 = sa != null ? +sa : 0, s1 = sb != null ? +sb : 1;
const slots = [{ ai: true, diff: 'si2', fac: fa, start: s0, ally: 0 }, { ai: true, diff: 'si2', fac: fb, start: s1, ally: 1 }]; // swap=1 -> NEW plays slot 1 (fb at start s1)
newGame({ seed: +seed, map, slots, r76: 1, peace: +(process.env.PEACE || 0) || undefined, fog: process.env.FOG !== '0' }); const newT = sw ? 1 : 0; G.players[1 - newT].m7Off = true; if (process.env.BOTHOLD) G.players[newT].m7Off = true;
const maxT = (+mm || 25) * 60 * 30, t0 = Date.now(); const marks = [];
for (let n = 0; n < maxT && !G.over; n++) { stepGame(); G.events.length = 0; if (G.players.filter(P => !P.out).length < 2) break; if (n % (180 * 30) === 0 && n) marks.push(`${n / 30 | 0}s:${[newT, 1 - newT].map(t => { const P = G.players[t]; return `${(P.cr / 1000) | 0}k/${G.ents.filter(e => e.team === t && e.kind === 'u' && e.hp > 0).length}u`; }).join('v')}`); }
const v = t => G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
const alive = G.players.filter(P => !P.out).map(P => P.team);
const res = alive.length === 1 ? (alive[0] === newT ? 'NEW' : 'OLD') : v(newT) > v(1 - newT) * 1.3 ? 'NEW(pts)' : v(1 - newT) > v(newT) * 1.3 ? 'OLD(pts)' : 'TIE';
const N = G.players[newT];
console.log(`${map} s${seed} new=${N.fac}@${N.start} old=${G.players[1 - newT].fac} ${res} ${(G.time / 60).toFixed(1)}m new ${(N.stats.mined / 1000) | 0}k val${v(newT)} | old ${(G.players[1 - newT].stats.mined / 1000) | 0}k val${v(1 - newT)} | lan ${N.aiS.lan7} | ${marks.join(' ')} ${((Date.now() - t0) / 1000) | 0}s`);
