// v5.9: France Gatling Bastion (replaces Tesla for France; hits ground + air) and Iron Marine auto-engage on the move
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,orderMove,avail,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < s * 30; i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh(f0, f1, ai) { A.newGame({ seed: 3, diff: 'hard', aiTeams: ai || [], fog: false, slots: [{ fac: f0, ally: 0, ai: (ai || []).includes(0) }, { fac: f1, ally: 1, ai: (ai || []).includes(1), diff: 'hard' }] });
  A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); for (const t of [0, 1]) for (const b of ['power', 'power', 'barracks', 'refinery', 'factory', 'tech']) { const s = A.G.starts[A.G.players[t].start]; void s; } }
const tech = t => { for (const b of ['power', 'power', 'power', 'barracks', 'refinery', 'factory', 'tech']) { const p = A.G.ents.find(e => e.team === t && e.t === 'hq'); A.addB(b, t, 70 + A.G.ents.length % 9 * 2, 75 + t * 6, true); } };
// --- France build menu: Gatling instead of Tesla
fresh('fra', 'rus'); tech(0); tech(1);
chk('France can build Gatling Bastion, not Tesla', A.avail(0, 'gatling') && !A.avail(0, 'tesla'));
chk('other factions keep Tesla, no Gatling', A.avail(1, 'tesla') && !A.avail(1, 'gatling'));
// --- Gatling hits ground and air
fresh('fra', 'usa'); tech(0); const g = A.addB('gatling', 0, 40, 40, true); const r = A.addU('rifle', 1, 46, 40.5), gs = A.addU('gunship', 1, 41, 46); r.order = gs.order = 'idle'; run(8);
chk('Gatling kills infantry (ground)', r.hp <= 0, 'rifle hp ' + Math.max(0, r.hp | 0)); chk('Gatling shoots down aircraft', gs.hp <= 0, 'gunship hp ' + Math.max(0, gs.hp | 0));
fresh('fra', 'rus'); tech(0); A.addB('gatling', 0, 40, 40, true); const hv = A.addU('heavy', 1, 46, 40.5); hv.order = 'idle'; hv.stance = 'hold'; const h0 = hv.hp; run(6);
const gDps = (h0 - hv.hp) / 6; chk('Gatling is weak vs heavy armor', gDps < 40, 'dps vs Bastion ' + gDps.toFixed(1));
// tower-vs-tower: Gatling between Tesla and Grand Cannon on cost/HP
const c = t => BT[t].cost, h = t => BT[t].hp; chk('Gatling cost/HP between Tesla and Grand Cannon', c('tesla') < c('gatling') && c('gatling') < c('gcannon') && h('tesla') < h('gatling') && h('gatling') < h('gcannon'), `${c('gatling')}/${h('gatling')}`);
// --- France bot builds Gatlings where others build Teslas
{ A.newGame({ seed: 9, diff: 'hard', aiTeams: [0, 1], fog: false, slots: [{ ai: 1, diff: 'hard', fac: 'fra', ally: 0 }, { ai: 1, diff: 'hard', fac: 'ger', ally: 1 }] });
  let gt = 0, tz = 0; for (let i = 0; i < 30 * 900 && !A.G.over; i++) { A.stepGame(); A.G.events.length = 0; if (i % 900 === 0) { gt = Math.max(gt, A.G.ents.filter(e => e.team === 0 && e.t === 'gatling').length); tz = Math.max(tz, A.G.ents.filter(e => e.team === 0 && e.t === 'tesla').length); } }
  chk('France bot builds Gatling Bastions (no Teslas)', gt >= 1 && tz === 0, 'gatlings peak ' + gt + ', teslas ' + tz); }
// --- Iron Marine auto-engage while moving, then resumes; hold stance = plain move; stop respected
fresh('bra', 'usa'); const m = A.addU('marine', 0, 30, 40), e1 = A.addU('rifle', 1, 37, 41); e1.order = 'idle'; e1.stance = 'hold';
A.orderMove([m], 50, 40, true); let stopped = false; // v6.2: auto-engage on the move is the attack-move (plain moves now break off — see v62-test) for (let i = 0; i < 30 * 30; i++) { A.stepGame(); A.G.events.length = 0; if (m.tgt === e1 && e1.hp > 0) stopped = true; }
chk('marine on an attack-move engages an enemy it meets', stopped && e1.hp <= 0, 'enemy hp ' + Math.max(0, e1.hp | 0));
chk('...then resumes and reaches its destination', Math.hypot(m.x - 50, m.y - 40) < 2, `at ${m.x.toFixed(1)},${m.y.toFixed(1)} order=${m.order}`);
fresh('bra', 'usa'); const mh = A.addU('marine', 0, 30, 40), e2 = A.addU('rifle', 1, 37, 41); e2.order = 'idle'; e2.stance = 'hold'; mh.stance = 'hold';
A.orderMove([mh], 50, 40, false); run(14); chk('Hold-stance marine does a plain move (no auto-engage detour)', mh.x > 45 && mh.order !== 'amove', `x=${mh.x.toFixed(1)} order=${mh.order}`);
fresh('bra', 'usa'); const ms = A.addU('marine', 0, 30, 40); A.orderMove([ms], 50, 40, false); run(1); ms.order = 'idle'; ms.path = []; ms.anchor = { x: ms.x, y: ms.y }; const sx = ms.x; run(4);
chk('explicit stop is respected (no resume)', Math.abs(ms.x - sx) < 0.6, 'moved ' + (ms.x - sx).toFixed(2));
// bots never command human marines
fresh('bra', 'rus', [1]); tech(0); const hm = [0, 1, 2].map(i => A.addU('marine', 0, 20 + i, 20)); A.orderMove(hm, 24, 26, false); run(20);
chk('human marines keep the human order under a bot game', hm.every(u => Math.hypot(u.x - 24, u.y - 26) < 3), hm.map(u => u.x.toFixed(1) + ',' + u.y.toFixed(1)).join(' '));
// determinism with both new features
const hash = () => { A.newGame({ seed: 21, diff: 'hard', aiTeams: [0, 1], fog: true, slots: [{ ai: 1, diff: 'hard', fac: 'fra', ally: 0 }, { ai: 1, diff: 'hard', fac: 'bra', ally: 1 }] }); run(420); return A.G.ents.reduce((a, e) => (a * 31 + Math.round(e.x * 1000 + e.hp * 7)) % 1000000007, 7) + '#' + A.G.ents.length; };
const h1 = hash(), h2 = hash(); chk('France vs Brazil bot game deterministic', h1 === h2, h1 + ' / ' + h2);
console.log(ok ? 'V59 OK' : 'V59 FAIL'); process.exit(ok ? 0 : 1);
