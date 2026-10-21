// v5.6 regression: all-bot games must end, and no bot may sit blacked-out or idle.
// node test/endgame-test.js [quick]   (runs games in parallel child processes)
const fs = require('fs'), vm = require('vm'), path = require('path'), { fork } = require('child_process');
const CAP = 45 * 60, LIMIT_END = 40 * 60, LIMIT_STALL = 60;
const FAC = ['usa', 'rus', 'fra', 'ger'];
const GAMES = [
  { map: 'volcano8', seed: 11, A: ['si', 'chief', 'hard', 'si'], B: ['hard', 'si', 'chief', 'hard'] },
  { map: 'volcano8', seed: 22, A: ['hard', 'hard', 'chief', 'chief'], B: ['si', 'hard', 'hard', 'chief'] },
  { map: 'volcano8', seed: 33, A: ['chief', 'si', 'hard', 'hard'], B: ['chief', 'chief', 'si', 'hard'] },
  { map: 'volcano', seed: 44, A: ['si', 'hard', 'chief'], B: ['chief', 'hard', 'si'] },
  { map: 'frost', seed: 55, A: ['hard', 'si'], B: ['chief', 'hard'] },
];
function play(g) {
  vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
  const n = g.A.length, sA = n === 4 ? [0, 2, 4, 6] : [0, 2, 4], sB = n === 4 ? [3, 1, 5, 7] : [3, 1, 5];
  const slots = []; for (let i = 0; i < n; i++) { slots.push({ ai: true, diff: g.A[i], ally: 0, start: sA[i], fac: FAC[(g.seed + i) % 4] }); slots.push({ ai: true, diff: g.B[i], ally: 1, start: sB[i], fac: FAC[(g.seed + i + 2) % 4] }); }
  A.newGame({ seed: g.seed, map: g.map, slots, fog: true }); const G = () => A.G;
  const st = A.G.players.map(P => ({ team: P.team, diff: P.diff, ally: P.ally, neg: 0, negMax: 0, idle: 0, idleMax: 0, idleAt: 0, negAt: 0, outT: null }));
  while (!A.G.over && A.G.time < CAP) {
    A.stepGame(); A.G.events.length = 0;
    if (A.G.tick % 30) continue; const t = A.G.time;
    for (const P of A.G.players) { const s = st[P.team]; if (P.out) { if (s.outT == null) s.outT = t; continue; } if (t < 240) continue;
      if (P.pow < 0 && P.cr >= BT.power.cost) { s.neg++; if (s.neg > s.negMax) { s.negMax = s.neg; s.negAt = t; } } else s.neg = 0;
      let k = 0; for (const c in P.queues) for (const it of P.queues[c]) k += (it.prog || 0) + 1; const prod = k !== s.k; s.k = k;
      const fight = A.G.ents.some(e => e.team === P.team && e.kind === 'u' && e.t !== 'harv' && UT[e.t].wpn && (e.tgt || e.order === 'move' || e.order === 'attack'));
      const canAct = A.G.ents.some(e => e.team === P.team && e.kind === 'b' && e.hp > 0 && ['hq', 'cc', 'barracks', 'factory', 'airfield'].includes(e.t)) || A.G.ents.some(e => e.team === P.team && e.kind === 'u' && e.t !== 'harv' && UT[e.t].wpn);
      if (!prod && !fight && canAct && P.cr >= 100) { s.idle++; if (s.idle > s.idleMax) { s.idleMax = s.idle; s.idleAt = t; } } else s.idle = 0; }
  }
  return { g: `${g.map} seed ${g.seed} [${g.A.join(',')}] vs [${g.B.join(',')}]`, over: !!A.G.over, win: A.G.winAlly, min: +(A.G.time / 60).toFixed(1), st };
}
if (process.argv[2] === 'child') { process.on('message', g => { process.send(play(g)); process.exit(0); }); }
else {
  const list = process.argv[2] === 'quick' ? GAMES.slice(0, 2) : GAMES; const t0 = Date.now();
  Promise.all(list.map(g => new Promise(r => { const c = fork(__filename, ['child']); c.on('message', r); c.send(g); }))).then(res => {
    let fail = 0;
    for (const r of res) {
      const bad = r.st.filter(s => s.negMax > LIMIT_STALL || s.idleMax > LIMIT_STALL);
      const ok = r.over && r.min <= LIMIT_END && !bad.length; if (!ok) fail++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${r.g}: ${r.over ? 'winner team ' + (r.win ? 'B' : 'A') : 'NO WINNER'} at ${r.min} min`);
      console.log('   ' + r.st.map(s => `P${s.team}(${s.diff}${s.ally ? 'B' : 'A'}) neg${s.negMax}s@${(s.negAt / 60) | 0} idle${s.idleMax}s@${(s.idleAt / 60) | 0}${s.outT != null ? ' out@' + (s.outT / 60).toFixed(0) : ''}`).join(' '));
    }
    console.log(fail ? `ENDGAME FAIL (${fail}/${res.length})` : 'ENDGAME OK', ((Date.now() - t0) / 1000 | 0) + 's'); process.exit(fail ? 1 : 0);
  });
}
