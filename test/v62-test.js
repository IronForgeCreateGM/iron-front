// v6.2 checklist tests (node, deterministic sim). node test/v62-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,orderMove,avail,execCmd,damage,impact,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < s * 30; i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh(f0, f1, ai, seed) { A.newGame({ seed: seed || 3, diff: 'hard', aiTeams: ai || [], fog: false, slots: [{ fac: f0, ally: 0, ai: (ai || []).includes(0) }, { fac: f1, ally: 1, ai: (ai || []).includes(1), diff: 'hard' }] });
  A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); }
const tech = (t, x0, y0) => { let i = 0; for (const b of ['power', 'power', 'power', 'barracks', 'refinery', 'factory', 'tech']) A.addB(b, t, (x0 || 70) + (i++) * 3, (y0 || 75) + t * 6, true); };
const S = process.argv[2] || 'all', on = k => S === 'all' || S === k;
// ===== 1. Iron Marine =====
if (on('marine')) {
  chk('marine stats: dmg 20 -> 21 (+5%), speed 1.52 -> 1.67 (+10%)', W.marine.dmg === 21 && UT.marine.sp === 1.67, W.marine.dmg + ' / ' + UT.marine.sp);
  fresh('bra', 'usa'); const m = A.addU('marine', 0, 31, 40), e1 = A.addU('rifle', 1, 37, 41); e1.stance = 'hold'; e1.hp = e1.mhp = 50000; run(3);
  chk('marine engages an enemy in range (idle auto-acquire)', m.tgt === e1);
  A.orderMove([m], 32.5, 44.5, false); chk('a plain move breaks off the target immediately', !m.tgt && m.order === 'move');
  let reacq = false, arrived = -1; for (let i = 0; i < 30 * 8; i++) { A.stepGame(); A.G.events.length = 0; if (m.order === 'move' && m.tgt) reacq = true; if (arrived < 0 && m.order === 'idle') arrived = i; }
  chk('...no re-acquire while the move is running (even with the enemy in range)', !reacq && arrived > 0, 'arrived after ' + (arrived / 30).toFixed(1) + 's');
  chk('arrives, then re-engages nearby enemies (short pull-back feel kept)', Math.hypot(m.x - 32.5, m.y - 44.5) < 2.6 && m.tgt === e1, `at ${m.x.toFixed(1)},${m.y.toFixed(1)} tgt=${m.tgt && m.tgt.t}`);
  // armor vs tanks / aircraft and splash
  fresh('bra', 'rus'); const mk = () => A.addU('marine', 0, 40, 40), tank = A.addU('light', 1, 44, 40), jet = A.addU('jet', 1, 44, 44);
  const hit = (srcU, w) => { const t = mk(); t.nb = 0; const h = t.hp; A.damage(t, 100, w, 1, srcU); const d = h - t.hp; t.hp = 0; return d; };
  const rf = A.addU('rifle', 1, 46, 46); const dT = hit(tank, W.lcannon), dR = hit(rf, W.lcannon), dJ = hit(jet, W.jbomb);
  chk('marine takes 15% less from tanks than the same weapon from infantry*veh', Math.abs(dT / (dR * MAR.veh) - 0.85) < 0.01, `tank ${dT.toFixed(1)} vs ${(dR * MAR.veh).toFixed(1)}`);
  chk('marine takes 15% less from aircraft/bombers', Math.abs(dJ / hit(null, W.jbomb) - 0.85) < 0.01, 'bomb ' + dJ.toFixed(1));
  { const t = mk(), r2 = A.addU('rifle', 0, 40.3, 40); t.nb = 0; const h1 = t.hp, h2 = r2.hp; A.impact({ w: W.arty, x: 40, y: 40, z: 0.5, tz: 0.5, team: 1, tgt: null, src: null });
    const dm = h1 - t.hp, dr = (h2 - r2.hp) / DMG.shell.inf; chk('marine takes 45% less splash (secondary)', Math.abs(dm / (W.arty.dmg * DMG.shell.inf) - 0.55) < 0.02, `marine ${dm.toFixed(1)} vs base ${dr.toFixed(1)}`); }
}
// ===== 2. upgrade all =====
if (on('upgall')) {
  fresh('usa', 'rus'); tech(0); const ts = [0, 1, 2].map(i => A.addB('turret', 0, 30 + i * 2, 30, true)); A.G.time += 5; const P = A.G.players[0]; P.cr = UPG.turret[0][0] * 2 + 100; P.gas = 0;
  const n = A.execCmd(0, { c: 'upgall', b: [ts[2].id, ts[0].id, ts[1].id] });
  chk('Upgrade all upgrades as many as affordable, in the given (nearest-first) order', n === 2 && ts[2].upT != null && ts[0].upT != null && ts[1].upT == null, 'n=' + n + ' cr left ' + P.cr);
  const bs = [0, 1].map(i => A.addB('barracks', 0, 40 + i * 3, 50, true)); A.execCmd(0, { c: 'rally', b: bs.map(b => b.id), x: 45, y: 60 });
  chk('one rally command sets a shared rally point for all selected production buildings', bs.every(b => b.rally && b.rally.x === 45 && b.rally.y === 60));
}
console.log(ok ? 'V62 OK' : 'V62 FAIL'); process.exit(ok ? 0 : 1);
