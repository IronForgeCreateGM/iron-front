// v5.8 Brazil Iron Marine balance: equal-cost fights. Marines should beat rifle / mixed infantry / light-tank mixes,
// but lose to their counters (sieged artillery, tesla) and not be a no-brainer vs everything.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB:typeof addB!=="undefined"?addB:null,setPath,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const BUD = +(process.env.BUD || 6300);
function fight(mix, seed, defs) {
  A.newGame({ seed, diff: 'normal', aiTeams: [], fog: false, slots: [{ fac: 'bra', ally: 0 }, { fac: 'ger', ally: 1 }] }); const G = A.G;
  G.ents = G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); G.derricks = [];
  const X0 = 40, X1 = 52, Y = 40, mk = (list, team, x, dir) => { const out = []; let i = 0;
    for (const t of list) { const u = A.addU(t, team, x - dir * ((i / 6) | 0) * 0.9, Y - 2.5 + (i % 6) * 0.9); u.order = 'amove'; u.dest = { x: dir > 0 ? X1 + 4 : X0 - 4, y: Y }; A.setPath(u, u.dest.x, u.dest.y); out.push(u); i++; } return out; };
  const fill = (types, bud) => { const l = []; let c = 0, k = 0; while (true) { const t = types[k % types.length]; if (c + UT[t].cost > bud + 1) break; l.push(t); c += UT[t].cost; k++; } while (c + 100 <= bud + 1) { l.push('rifle'); c += 100; } return l; };
  const a = mk(fill(['marine'], BUD), 0, X0, 1), b = mk(fill(mix, BUD - (defs || []).reduce((s, d) => s + BT[d[0]].cost, 0)), 1, X1, -1);
  for (const u of b) if (UT[u.t].siege) { u.path = []; u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; u.sg = 2; u.sgT = -9; } // v6.2: Howlers defend pre-deployed in Siege Mode
  if (defs) { for (const [t, x, y] of [...defs, ['power', 70, 20], ['power', 73, 20]]) A.addB(t, 1, x, y, true); }
  for (let i = 0; i < 30 * 90; i++) { A.stepGame(); G.events.length = 0; const la = a.filter(u => u.hp > 0).length, lb = b.filter(u => u.hp > 0).length; if (!la || !lb) break; }
  const val = l => l.filter(u => u.hp > 0).reduce((s, u) => s + UT[u.t].cost * u.hp / u.mhp, 0);
  return { m: val(a) / BUD, o: val(b) / BUD, nA: a.length, nB: b.length };
}
const avg = (mix, defs) => { let m = 0, o = 0; for (const s of [1, 2, 3]) { const r = fight(mix, s, defs); m += r.m / 3; o += r.o / 3; } return { m: +m.toFixed(2), o: +o.toFixed(2) }; };
const res = {};
const T = (name, mix, expectWin, defs) => { const r = avg(mix, defs); res[name] = r; const win = r.m > r.o; chk(`${expectWin ? 'marines beat' : 'marines lose to'} ${name}`, win === expectWin, `marines left ${(r.m * 100) | 0}% vs ${(r.o * 100) | 0}%`); };
T('Riflemen', ['rifle'], true);
T('Rifle+Rocketeer mix', ['rifle', 'rifle', 'rocketeer'], true);
T('Warhound MBT + rifles', ['heavy', 'rifle', 'rifle', 'rifle'], true);
T('Rifles + sieged Howler artillery', ['rifle', 'rifle', 'arty'], false);
{ const r = avg(['heavy']); res['Warhound MBTs (info)'] = r; console.log('INFO vs Warhound MBTs: marines left ' + ((r.m * 100) | 0) + '% vs ' + ((r.o * 100) | 0) + '%'); }
{ const r = avg(['heavy', 'rocketeer', 'rocketeer']); res['MBT + rocketeers (info)'] = r; console.log('INFO vs MBT + rocketeers: marines left ' + ((r.m * 100) | 0) + '% vs ' + ((r.o * 100) | 0) + '%'); }
T('Howler artillery mass', ['arty'], false);
T('2 Tesla coils + riflemen (equal total cost)', ['rifle'], false, [['tesla', 49, 38], ['tesla', 49, 42]]);
// not strictly better: marines should not be a blowout vs everything; the counter wins should be clear
const blow = Object.values(res).filter(r => r.m > 0.75).length; chk('not a blowout vs every mix', blow < Object.keys(res).length, blow + ' blowouts');
// shoots air; strength in numbers is active in a blob
{ const r = fight(['gunship'], 4); res.Gunships = { m: +r.m.toFixed(2), o: +r.o.toFixed(2) }; chk('marines shoot down equal-cost gunships', r.m > r.o, JSON.stringify(res.Gunships)); }
{ A.newGame({ seed: 5, diff: 'normal', aiTeams: [], fog: false, slots: [{ fac: 'bra', ally: 0 }, { fac: 'usa', ally: 1 }] }); A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq');
  const l = []; for (let i = 0; i < 10; i++) l.push(A.addU('marine', 0, 40 + (i % 4) * 0.8, 40 + ((i / 4) | 0) * 0.8)); const solo = A.addU('marine', 0, 70, 70); for (let i = 0; i < 31; i++) A.stepGame();
  chk('strength in numbers: blob gets bonus, lone marine none', l.some(u => u.nb >= 4) && !solo.nb, 'blob nb=' + l.map(u => u.nb).join(',') + ' solo=' + solo.nb); }
// AI playing Brazil builds marines
{ A.newGame({ seed: 7, diff: 'hard', aiTeams: [0, 1], fog: false, slots: [{ ai: 1, diff: 'hard', fac: 'bra', ally: 0 }, { ai: 1, diff: 'hard', fac: 'rus', ally: 1 }] });
  let mx = 0; for (let i = 0; i < 30 * 420; i++) { A.stepGame(); A.G.events.length = 0; if (i % 300 === 0) mx = Math.max(mx, A.G.ents.filter(e => e.t === 'marine' && e.team === 0 && e.hp > 0).length); }
  const inf = A.G.ents.filter(e => e.team === 0 && e.kind === 'u' && UT[e.t].from === 'barracks').length; chk('Brazil bot masses marines', mx >= 6, 'peak marines=' + mx + ' barracks units now=' + inf);
  chk('non-Brazil bot cannot build marines', !A.G.ents.some(e => e.t === 'marine' && e.team === 1)); }
// lockstep determinism with Brazil in the game (online sync)
{ const h = () => { A.newGame({ seed: 11, diff: 'hard', aiTeams: [0, 1], fog: true, slots: [{ ai: 1, diff: 'hard', fac: 'bra', ally: 0 }, { ai: 1, diff: 'hard', fac: 'bra', ally: 1 }] }); for (let i = 0; i < 30 * 300; i++) { A.stepGame(); A.G.events.length = 0; } return A.G.ents.map(e => e.id + ':' + e.t + ':' + e.x.toFixed(4) + ':' + e.y.toFixed(4) + ':' + e.hp.toFixed(3)).join('|').length + '#' + A.G.ents.reduce((a, e) => (a * 31 + Math.round(e.x * 1000 + e.hp * 7)) % 1000000007, 7) + '#' + A.G.ents.filter(e => e.t === 'marine').length; };
  const h1 = h(), h2 = h(); chk('Brazil vs Brazil is deterministic (same state hash twice)', h1 === h2, h1 + ' / ' + h2); }
console.log(JSON.stringify(res)); console.log(ok ? 'MARINE OK' : 'MARINE FAIL'); process.exit(ok ? 0 : 1);
