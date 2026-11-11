// v7.9.2 head-to-head: si2 with f81 on (NEW) vs same brain with P.f81Off (OLD = live v7.9.1 Hard, f80 still on)
// node test/f81-vs.js map seed facA facB swap maxMin
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SION = JSON.parse(process.env.SION || '{}'); const OFF = JSON.parse(process.env.SIOFF || '{}');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
Object.assign(SIOFF, OFF);
const [map, seed, fa, fb, swap, mm] = process.argv.slice(2), sw = swap === '1';
const slots = [{ ai: true, diff: 'si2', fac: fa, start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: fb, start: 1, ally: 1 }];
newGame({ seed: +seed, map, slots, r76: 1, nt: 1, m7: 2, f79: 1, f80: 1, f81: 1, peace: +(process.env.PEACE || 0) || undefined, fog: process.env.FOG !== '0' });
const newT = sw ? 1 : 0; G.players[1 - newT].f81Off = true;
const maxT = (+mm || 25) * 60 * 30, t0 = Date.now(); const marks = [];
const air80 = [0, 0], gc80 = [0, 0], push81 = [0, 0];
for (let n = 0; n < maxT && !G.over; n++) {
  stepGame();
  for (const e of G.events) {
    if (e.e === 'aiAir80') air80[e.team] = (air80[e.team] || 0) + 1;
    if (e.e === 'aiWar' && e.gc80) gc80[e.team] = (gc80[e.team] || 0) + 1;
    if (e.e === 'aiGcPush81') push81[e.team] = (push81[e.team] || 0) + 1;
  }
  G.events.length = 0;
  if (G.players.filter(P => !P.out).length < 2) break;
  if (n % (180 * 30) === 0 && n) marks.push(`${n / 30 | 0}s:${[newT, 1 - newT].map(t => { const P = G.players[t]; return `${(P.cr / 1000) | 0}k/${G.ents.filter(e => e.team === t && e.kind === 'u' && e.hp > 0).length}u`; }).join('v')}`);
}
const v = t => G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
const alive = G.players.filter(P => !P.out).map(P => P.team);
const res = alive.length === 1 ? (alive[0] === newT ? 'NEW' : 'OLD') : v(newT) > v(1 - newT) * 1.3 ? 'NEW(pts)' : v(1 - newT) > v(newT) * 1.3 ? 'OLD(pts)' : 'TIE';
const N = G.players[newT];
console.log(`${map} s${seed} new=${N.fac}@${N.start} old=${G.players[1 - newT].fac} ${res} ${(G.time / 60).toFixed(1)}m new ${(N.stats.mined / 1000) | 0}k val${v(newT)} | old ${(G.players[1 - newT].stats.mined / 1000) | 0}k val${v(1 - newT)} | air80 n${air80[newT]||0}/o${air80[1-newT]||0} gc80 n${gc80[newT]||0}/o${gc80[1-newT]||0} push81 n${push81[newT]||0} | ${marks.join(' ')} ${((Date.now() - t0) / 1000) | 0}s`);
