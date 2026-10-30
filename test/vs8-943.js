// Check from the Oct 30 replay study: volcano8 seed 943231385, USA si2 start0 vs Brazil si2 start3, fog off, peace 180.
// NEWT=0|1|both|none (which side runs the new brain; others get ntOff+pwOff = live v7.6.4 brain). OFF=a,b SIOFF flags.
globalThis.SION = {}; globalThis.SIOFF = Object.fromEntries((process.env.OFF || '').split(',').filter(Boolean).map(k => [k, 1]));
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
const NT = process.env.NEWT || '0', mm = +process.env.MM || 25;
const slots = [{ ai: true, diff: 'si2', ally: 0, fac: 'usa', color: 'blue', start: 0, seat: 1 }, { ai: true, diff: 'si2', ally: 1, fac: 'bra', color: 'red', start: 3, seat: 1 }];
newGame({ seed: 943231385, map: 'volcano8', peace: 180, fog: false, r76: 1, diff: 'normal', slots });
G.players.forEach((P, i) => { const isNew = NT === 'both' || NT === String(i); if (!isNew) { P.ntOff = true; P.pwOff = true; } });
const v = t => G.ents.filter(e => e.team === t && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
const army = t => G.ents.filter(e => e.team === t && e.hp > 0 && e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv').reduce((s, e) => s + (UT[e.t].cost || 0), 0);
const cnt = (t, k) => G.ents.filter(e => e.team === t && e.hp > 0 && e.t === k).length;
const marks = [300, 480, 840], out = [];
const maxT = mm * 60 * 30;
for (let n = 0; n < maxT && !G.over; n++) { stepGame(); G.events.length = 0;
  if (marks.includes(G.tick / 30)) out.push(`${G.tick / 30}s usa army ${army(0)} harv ${cnt(0, 'harv')} cc ${cnt(0, 'cc')} mined ${(G.players[0].stats.mined / 1000) | 0}k | bra army ${army(1)} harv ${cnt(1, 'harv')} cc ${cnt(1, 'cc')} mined ${(G.players[1].stats.mined / 1000) | 0}k`);
  if (G.players.filter(P => !P.out).length < 2) break; }
const alive = G.players.filter(P => !P.out).map(P => P.team);
const res = alive.length === 1 ? (alive[0] === 0 ? 'USA' : 'BRA') : v(0) > v(1) * 1.3 ? 'USA(pts)' : v(1) > v(0) * 1.3 ? 'BRA(pts)' : 'TIE';
console.log(`NEWT=${NT} OFF=${process.env.OFF || '-'} ${res} ${(G.time / 60).toFixed(1)}m usa mined ${(G.players[0].stats.mined / 1000) | 0}k val${v(0)} | bra mined ${(G.players[1].stats.mined / 1000) | 0}k val${v(1)}\n  ` + out.join('\n  '));
