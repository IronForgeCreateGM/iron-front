// v7.0 Endless mode: map, waves, scaling, phase-in, boss rewards, skip vote, economy, high scores, determinism. node test/endless-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
const src = ['data.js', 'sim.js', 'ai.js', 'endless.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,execCmd,stateHash,findPath,endlessCompose,endlessStartWave,endlessRecord,endlessHS,endHpM,endDmgM,endArmM,END,UT,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < Math.round(s * 30); i++) { A.stepGame(); A.G.events.length = 0; } };
const solo = (seed, extra) => A.newGame(Object.assign({ mode: 'endless', seed: seed || 5, fog: false, slots: [{ ai: false, ally: 0, fac: 'bra' }] }, extra || {}));
const killHorde = () => { for (const u of A.G.ents) if (u.team === A.G.end.horde && u.kind === 'u') { u.hp = 0; } };
// --- setup
solo(); let G = A.G;
const H = G.players.find(P => P.horde);
chk('endless game: 96x96 desert map, You + The Horde (enemy team, last slot)', G.end && MW === 96 && G.desert && H && H.name === 'The Horde' && H.ally === 1 && G.players.length === 2 && G.players[0].ally === 0);
chk('solo defender spawns at the central plateau base (start 4), Horde in the east (start 5)', G.players[0].start === 4 && H.start === 5);
chk('normal base + money at start (HQ, harvesters, $5000 like skirmish)', G.ents.some(e => e.team === 0 && e.t === 'hq') && G.players[0].cr === 5000, '$' + G.players[0].cr);
chk('the Horde gets no economy (cr 0, no HQ)', H.cr === 0 && !G.ents.some(e => e.team === H.team && e.kind === 'b'));
chk('4 wallable passes through the ridge', G.passes.length === 4);
let reach = 0; for (const p of G.passes) { const pt = A.findPath(90.5, p.y, p.x - 3, p.y); if (pt && pt.length) reach++; }
chk('every pass is walkable from the Horde staging ground', reach === 4, reach + '/4');
const base = G.starts[4]; let rp = 0; for (const p of G.passes) { const pt = A.findPath(p.x - 3, p.y, base[0] + 3, base[1]); if (pt && pt.length) rp++; } chk('every pass leads to the defender base', rp === 4);
// --- break + countdown
chk('first build break 45 s, phase "break", wave 0', G.end.phase === 'break' && G.end.wave === 0 && Math.abs(G.end.next - G.time - 45) < 0.1);
run(44); chk('still in break at 44 s', G.end.phase === 'break');
run(2); chk('wave 1 starts automatically after the countdown', G.end.wave === 1 && G.end.phase === 'wave');
run(4); const w1 = G.ents.filter(e => e.team === H.team && e.kind === 'u');
chk('wave 1 = infantry only', w1.length > 0 && w1.every(u => UT[u.t].armor === 'inf'), w1.map(u => u.t).join(','));
const r0 = w1[0]; chk('Horde units march west toward the passes', r0.order === 'amove' && r0.anchor.x < 40);
// --- bounty + clear
const cr0 = G.players[0].cr; const vic = w1[0]; vic.lastHitBy = 0; vic.hp = 0; run(0.2);
chk('money per kill (bounty to the killer)', G.players[0].cr > cr0 && G.end.kills === 1, '+$' + (G.players[0].cr - cr0));
run(3); killHorde(); const cr1 = G.players[0].cr; run(1);
chk('wave clear -> wave-clear bonus (300 + 60*n) and a new break', G.end.phase === 'break' && G.players[0].cr - cr1 >= 360 && Math.abs(G.end.brk - 25) < 0.01, '+$' + (G.players[0].cr - cr1));
// --- skip
const cr2 = G.players[0].cr, rem = G.end.next - G.time; chk('Skip command accepted in break', A.execCmd(0, { c: 'skipwave' }) === true);
run(0.1); chk('Skip starts the next wave at once and pays $4/s skipped', G.end.wave === 2 && G.players[0].cr - cr2 >= Math.round(rem * 4) - 5, '+$' + (G.players[0].cr - cr2));
chk('Skip rejected during a wave / by the Horde', A.execCmd(0, { c: 'skipwave' }) === false && A.execCmd(H.team, { c: 'skipwave' }) === false);
// --- co-op skip vote needs every human
A.newGame({ mode: 'endless', seed: 7, fog: false, slots: [{ ai: false, ally: 0, fac: 'bra' }, { ai: false, ally: 0, fac: 'fra' }] }); G = A.G;
chk('co-op: 2 defenders on the same team at co-op starts', G.players.filter(P => !P.horde).length === 2 && G.players[0].ally === G.players[1].ally && G.players[0].start !== 4);
A.execCmd(0, { c: 'skipwave' }); run(0.1); chk('co-op: one vote does not skip', G.end.wave === 0);
A.execCmd(1, { c: 'skipwave' }); run(0.1); chk('co-op: both votes skip', G.end.wave === 1);
// --- composition / phase-in
solo(9); G = A.G; const comp = n => { const q = A.endlessCompose(n); return { q, inf: q.filter(t => UT[t].armor === 'inf').length, veh: q.filter(t => !UT[t].air && UT[t].armor !== 'inf').length, air: q.filter(t => UT[t].air).length }; };
const c3 = comp(3), c7 = comp(7), c11 = comp(11), c25 = comp(25);
chk('waves 1-5: infantry phase (no tanks, no air)', [1, 2, 3, 4, 5].every(n => comp(n).q.every(t => UT[t].armor === 'inf' || t === 'scout')));
chk('wave 7: tanks phase in', c7.veh > 0, JSON.stringify({ inf: c7.inf, veh: c7.veh }));
chk('wave 11: air phases in', c11.air > 0, 'air ' + c11.air);
chk('wave 25: mixed army incl. faction specials (marine/kommando/raijin/titan/tsar/drone)', c25.q.some(t => ['marine', 'kommando', 'raijin', 'titan', 'tsar', 'drone'].includes(t)) && c25.inf && c25.veh && c25.air, [...new Set(c25.q)].join(','));
{ const val = q => q.reduce((a, t) => a + UT[t].cost, 0), v3 = val(c3.q), v20 = val(comp(20).q); chk('wave size (army value) grows with the wave number', v20 > v3 * 2.5, '$' + v3 + ' -> $' + v20); }
chk('every 10th wave is a boss wave with the Colossus', comp(10).q[0] === 'colossus' && comp(30).q[0] === 'colossus' && !comp(11).q.includes('colossus'));
chk('HP / damage / armor scale every wave', A.endHpM(20) > A.endHpM(10) && A.endHpM(10) > 1 && A.endDmgM(20) > A.endDmgM(5) && A.endArmM(20) < A.endArmM(5), `hp x${A.endHpM(20).toFixed(2)} dmg x${A.endDmgM(20).toFixed(2)} taken x${A.endArmM(20).toFixed(2)} @20`);
chk('infinite: wave 60 still composes (capped count, tougher units)', comp(60).q.length > 10 && comp(60).q.length <= A.END.cap && A.endHpM(60) > 8);
// --- boss rewards
const boss = (clean) => { solo(11); G = A.G; G.end.wave = 9; G.end.next = G.time; run(0.1); chk('wave 10 announced as boss', G.end.boss && G.end.wave === 10);
  run(3); const col = G.ents.find(u => u.t === 'colossus'); chk('boss: a giant Colossus spawns', col && col.boss && col.mhp > 8000, col && 'hp ' + col.mhp);
  if (!clean) { for (let i = 0; i < 95; i++) { run(1); const hq = G.ents.find(e => e.team === 0 && e.t === 'hq'); if (hq) hq.hp = Math.max(hq.hp, hq.mhp * 0.5); } } // v7.6.7: attack-move units keep pushing after a fight, so an undefended HQ no longer survives 95 s; keep it alive (the test is about the slow-clear reward)
  if (!clean) for (const e of G.ents) if (e.team === 0 && e.kind === 'b' && e.t !== 'hq') { e.hp = 0; break; }
  run(0.5); killHorde(); const cr = G.players[0].cr; run(1); return { r: G.end.lastReward, d: G.players[0].cr - cr }; };
let br = boss(true); chk('clean, fast boss clear -> free elite unit', br.r && br.r.kind === 'elite' && G.ents.some(u => u.team === 0 && u.elite), br.r && br.r.units.join(','));
br = boss(false); chk('slow / costly boss clear -> bonus cash instead', br.r && br.r.kind === 'cash' && br.d >= 1650 + 360, '+$' + br.d);
// --- high scores
solo(5); G = A.G; G.end.score = 1200; G.end.wave = 8; A.endlessRecord(); solo(6); A.G.end.score = 3000; A.G.end.wave = 12; A.endlessRecord();
A.newGame({ mode: 'endless', seed: 7, fog: false, slots: [{ ai: false, ally: 0, fac: 'bra' }, { ai: true, ally: 0, fac: 'fra', diff: 'hard' }] }); A.G.end.score = 500; A.endlessRecord();
const hs = A.endlessHS(); chk('local high scores: separate solo and co-op tables, sorted', hs.solo.length === 2 && hs.solo[0].score === 3000 && hs.coop.length === 1, JSON.stringify(hs.solo.map(r => r.score)));
chk('record saved once per run (rank kept)', A.endlessRecord() === null && A.G.end.rank === 1);
// --- no bot bonuses + determinism
const hashRun = seed => { A.newGame({ mode: 'endless', seed, fog: false, slots: [{ ai: true, diff: 'hard', ally: 0, fac: 'irn' }, { ai: true, diff: 'hard', ally: 0, fac: 'chn' }] }); const c0 = A.G.players.map(P => P.cr); run(150); return [A.stateHash(), c0, A.G.end.wave]; };
const h1 = hashRun(21), h2 = hashRun(21);
chk('bots get no resource bonus in Endless (same $5000 start)', h1[1][0] === 5000 && h1[1][1] === 5000 && h1[1][2] === 0);
chk('deterministic: same seed -> same state hash after 150 s (lockstep safe)', h1[0] === h2[0] && h1[2] >= 2, 'wave ' + h1[2] + ' hash ' + h1[0]);
console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
