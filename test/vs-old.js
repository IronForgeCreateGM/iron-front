// v7.1 benchmark: new Chief SI vs the frozen v7.0.3 Chief SI in one deterministic sim.
// node test/vs-old.js "si:usa,si:rus" "old:chn,old:fra" seed [map] [maxMin]   ('old' = v7.0.3 brain from test/fixtures/ai-v703.js)
// prints: <A> vs <B> s<seed> <map> <A|B|A(pts)|B(pts)|T> <min>m aiMs=<avg new>/<avg old> max=<worst single call>
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = Object.fromEntries((process.env.SIOFF || '').split(',').filter(Boolean).map(k => [k, 1])); const J = f => fs.readFileSync(path.join(process.env.JSDIR || path.join(__dirname, '../js'), f), 'utf8');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(J).join('\n') + '\n' + fs.readFileSync(path.join(__dirname, 'fixtures/ai-v703.js'), 'utf8') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};globalThis.NEWAI=aiStep;globalThis.OLDAI=O_aiStep;globalThis.OLDINIT=O_aiInit;');
const [sa, sb, seed, map, mm] = process.argv.slice(2);
const parse = (s, ally) => s.split(',').map(x => { const [diff, fac] = x.split(':'); return { ai: true, diff: diff === 'old' ? 'si' : diff, old: diff === 'old', fac, ally }; });
const slots = parse(sa, 0).concat(parse(sb, 1)); const maxT = (+mm || 30) * 60;
const ms = { n: [0, 0], c: [0, 0], max: 0, mx: [0, 0], mt: [0, 0], big: [0, 0] };
globalThis.aiStep = P => { const o = P.old ? 1 : 0, t = process.hrtime.bigint(); (o ? OLDAI : NEWAI)(P); const d = Number(process.hrtime.bigint() - t) / 1e6; ms.n[o] += d; ms.c[o]++; if (d > ms.max) ms.max = d; if (d > ms.mx[o]) { ms.mx[o] = d; ms.mt[o] = Math.round(A.G.time); } if (d > 30) ms.big[o]++; };
A.newGame({ seed: +seed, map: map || 'classic', slots });
A.G.players.forEach((P, i) => { if (slots[i].old) { P.old = true; OLDINIT(P); } });
for (let n = 0; n < maxT * 30 && !A.G.over; n++) { A.stepGame(); A.G.events.length = 0; const al = new Set(A.G.players.filter(P => !P.out).map(P => P.ally)); if (al.size < 2) break; }
const al = new Set(A.G.players.filter(P => !P.out).map(P => P.ally));
const v = a => A.G.ents.filter(e => A.G.players[e.team].ally === a && e.hp > 0).reduce((s, e) => s + ((UT[e.t] || BT[e.t]).cost || 0), 0);
const res = al.size === 1 ? (al.has(0) ? 'A' : 'B') : (v(0) > v(1) * 1.3 ? 'A(pts)' : v(1) > v(0) * 1.3 ? 'B(pts)' : 'T');
const st = A.G.players.map(P => `${P.fac}:${P.old ? 'o' : 'n'}:${(P.stats.mined / 1000) | 0}k/${P.stats.kills}k/${P.stats.lost}l${P.out ? 'X' : ''}`).join(' ');
console.log(`${sa} vs ${sb} s${seed} ${map || 'classic'} ${res} ${(A.G.time / 60).toFixed(1)}m aiMs=${(ms.n[0] / Math.max(1, ms.c[0])).toFixed(2)}/${(ms.n[1] / Math.max(1, ms.c[1])).toFixed(2)} max=${ms.mx[0].toFixed(0)}@${ms.mt[0]}s(${ms.big[0]})/${ms.mx[1].toFixed(0)}@${ms.mt[1]}s(${ms.big[1]}) r=${(v(0) / Math.max(1, v(1))).toFixed(2)} | ${st}`);
