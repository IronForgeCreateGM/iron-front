// v5.8 Brazil Iron Marine balance: equal-cost fights. Marines should beat rifle / mixed infantry / light-tank mixes,
// but lose to their counters (sieged artillery, tesla) and not be a no-brainer vs everything.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB:typeof addB!=="undefined"?addB:null,setPath,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
let BUDV = +(process.env.BUDV || 6300);
function fight(mix, seed, defs) {
  A.newGame({ seed, diff: 'normal', aiTeams: [], fog: false, slots: [{ fac: 'bra', ally: 0 }, { fac: 'ger', ally: 1 }] }); const G = A.G;
  G.ents = G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); G.derricks = [];
  const X0 = 40, X1 = 52, Y = 40, mk = (list, team, x, dir) => { const out = []; let i = 0;
    for (const t of list) { const u = A.addU(t, team, x - dir * ((i / 6) | 0) * 0.9, Y - 2.5 + (i % 6) * 0.9); u.order = 'amove'; u.dest = { x: dir > 0 ? X1 + 4 : X0 - 4, y: Y }; A.setPath(u, u.dest.x, u.dest.y); out.push(u); i++; } return out; };
  const fill = (types, bud) => { const l = []; let c = 0, k = 0; while (true) { const t = types[k % types.length]; if (c + UT[t].cost > bud + 1) break; l.push(t); c += UT[t].cost; k++; } while (c + 100 <= bud + 1) { l.push('rifle'); c += 100; } return l; };
  const a = mk(fill(['marine'], BUDV), 0, X0, 1), b = mk(fill(mix, BUDV - (defs || []).reduce((s, d) => s + BT[d[0]].cost, 0)), 1, X1, -1);
  for (const u of b) if (UT[u.t].siege) { u.path = []; u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; u.sg = 2; u.sgT = -9; } // v6.2: Howlers defend pre-deployed in Siege Mode
  if (defs) { for (const [t, x, y] of [...defs, ['power', 70, 20], ['power', 73, 20]]) A.addB(t, 1, x, y, true); }
  for (let i = 0; i < 30 * 90; i++) { A.stepGame(); G.events.length = 0; const la = a.filter(u => u.hp > 0).length, lb = b.filter(u => u.hp > 0).length; if (!la || !lb) break; }
  const val = l => l.filter(u => u.hp > 0).reduce((s, u) => s + UT[u.t].cost * u.hp / u.mhp, 0);
  return { m: val(a) / BUDV, o: val(b) / BUDV, nA: a.length, nB: b.length };
}
const avg = (mix, defs) => { let m = 0, o = 0; for (const s of [1, 2, 3]) { const r = fight(mix, s, defs); m += r.m / 3; o += r.o / 3; } return { m: +m.toFixed(2), o: +o.toFixed(2) }; };

// v7.6 (f) Iron Marine balance CHECK ONLY (no stat changes): equal-cost fights vs the proper counters, 3 seeds each, two budgets
const out = {};
for (const bud of [6300, 12600]) { BUDV = bud;
  const R = (name, mix, defs) => { const r = avg(mix, defs); out[name + ' @' + bud] = r; console.log(`${name.padEnd(34)} $${bud}: marines left ${(r.m * 100) | 0}%  counter left ${(r.o * 100) | 0}%  -> ${r.m > r.o ? 'MARINES WIN' : 'counter wins'}`); };
  R('Warhound MBT (tank cannon)', ['heavy']);
  R('Tsar Siege Tank (cannon)', ['tsar']);
  R('Raijin Mech', ['raijin']);
  R('Howler artillery (sieged)', ['arty']);
  R('Falcon Strike Jets (bombs)', ['jet']);
  R('Thunder Bombers (bombs)', ['bomber']);
  R('Tesla coils x2 + rifles', ['rifle'], [['tesla', 49, 38], ['tesla', 49, 42]]);
  R('MBT + Howler mix', ['heavy', 'arty']);
}
console.log(JSON.stringify(out));
