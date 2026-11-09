// v7.9.0 Shattered Moon: layout checks (8 fair seats, 2 gas each, every base reachable over the bridges) + 8 Hard (si2) bots FFA.
// node test/moon-test.js [seed] [minutes]   Reports per bot: peak buildings, expansions, kills/losses, ground units seen off their asteroid.
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const seed = +(process.argv[2] || 11), MIN = +(process.argv[3] || 14), FAC = ['usa', 'rus', 'chn', 'ger', 'fra', 'jpn', 'irn', 'bra'];
const slots = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ ai: true, diff: 'si2', ally: i, fac: FAC[(i + seed) % 8] }));
const t0 = Date.now(); A.newGame({ seed, map: 'shatteredmoon', slots }); const G = A.G, W = A.MW;
ok(W === 224 && G.starts.length === 8 && G.mapName === 'shatteredmoon', 'map 224x224, 8 starts (gen ' + (Date.now() - t0) + ' ms)');
ok(new Set(G.players.map(P => P.start)).size === 8, 'every player has its own asteroid');
const areas = [];
for (let k = 0; k < 8; k++) { const [sx, sy] = G.starts[k]; let ore = 0, a = 0;
  for (let y = -22; y <= 22; y++) for (let x = -22; x <= 22; x++) { const i = Math.floor(sy + y) * W + Math.floor(sx + x); if (Math.hypot(x, y) <= 21 && G.map[i] === 0) { a++; ore += G.ore[i]; } }
  const vents = G.vents.filter(([vx, vy]) => Math.hypot(vx + 0.5 - sx, vy + 0.5 - sy) < 12).length; areas.push(a);
  const nx = G.starts[(k + 1) % 8], p1 = findPath(sx, sy + 3, W / 2, W / 2 + 8), p2 = findPath(sx, sy + 3, nx[0], nx[1] + 3);
  ok(vents === 2 && ore > 50000 && p1 && p1.length && p2 && p2.length, `seat ${k + 1}: ${vents} gas vents, ore ${ore | 0}, area ${a}, path to crater ${!!(p1 && p1.length)}, path to next base ${!!(p2 && p2.length)}`); }
ok(Math.max(...areas) - Math.min(...areas) <= 12, 'asteroids are the same size (' + Math.min(...areas) + '-' + Math.max(...areas) + ' tiles)');
ok(G.void && G.void.some(v => v) && G.void.every((v, i) => !v || G.map[i] === 1), 'space tiles are impassable');
// bots
const home = P => G.starts[P.start], off = G.players.map(() => 0), peak = G.players.map(() => 0), exp = G.players.map(() => 0), firstAtk = G.players.map(() => null);
let err = null, n = 0; const last = new Map(); let stuckMax = 0, stuckAt = ''; G.watch = true; // spectator: no early stop when bot 1 is eliminated
 const T0 = Date.now(), marks = [];
try { for (; n < MIN * 60 * 30 && G.players.filter(P => !P.out).length > 1; n++) { A.stepGame(); G.events.length = 0;
  if (n % 150 === 0) G.players.forEach((P, t) => { const [hx, hy] = home(P), mine = G.ents.filter(e => e.team === t && e.hp > 0);
    peak[t] = Math.max(peak[t], mine.filter(e => BT[e.t]).length);
    exp[t] = Math.max(exp[t], mine.filter(e => (e.t === 'refinery' || e.t === 'cc') && Math.hypot(e.x - hx, e.y - hy) > 22).length);
    const away = mine.filter(e => UT[e.t] && !UT[e.t].air && e.t !== 'harv' && e.t !== 'engineer' && Math.hypot(e.x - hx, e.y - hy) > 30).length; off[t] = Math.max(off[t], away);
    if (away >= 4 && firstAtk[t] == null) firstAtk[t] = (G.time / 60).toFixed(1); });
  if (n % 600 === 0) { let st = 0; for (const e of G.ents) { if (!UT[e.t] || UT[e.t].air || e.hp <= 0 || !(e.path && e.path.length)) { last.delete(e.id); continue; } const l = last.get(e.id);
      if (l && Math.hypot(e.x - l[0], e.y - l[1]) < 0.5) st++; last.set(e.id, [e.x, e.y]); } if (st > stuckMax) { stuckMax = st; stuckAt = (G.time / 60).toFixed(1) + 'm'; } }
  if (n % (180 * 30) === 0 && n) marks.push(`${n / 1800 | 0}m alive ${G.players.filter(P => !P.out).length} units ${G.ents.filter(e => UT[e.t]).length}`);
} } catch (e) { err = e; console.log(e.stack); }
ok(!err, `8 Hard bots ran ${(G.time / 60).toFixed(1)} game-min without errors (${((Date.now() - T0) / 1000) | 0}s wall, ${((Date.now() - T0) / Math.max(1, n)).toFixed(2)} ms/tick)`);
console.log(marks.join(' | ')); console.log('  over flag', G.over, '| most ground units with a path that moved <0.5 tile in 20 s:', stuckMax, 'at', stuckAt, 'of', G.ents.filter(e => UT[e.t] && !UT[e.t].air).length, 'ground units now');
G.players.forEach((P, t) => console.log(`  bot ${t + 1} ${P.fac}@seat${P.start + 1}: peak bldgs ${peak[t]}, expansions ${exp[t]}, kills ${P.stats.kills}, lost ${P.stats.lost}, max ground units off-asteroid ${off[t]} (first push ${firstAtk[t] || '-'} min), mined ${(P.stats.mined / 1000) | 0}k, out ${P.out}`));
ok(peak.every(v => v >= 6), 'every bot built a base (' + peak.join(',') + ')');
ok(exp.filter(v => v > 0).length >= 6, 'bots expand to the ore islets / crater (' + exp.join(',') + ')');
ok(off.filter(v => v >= 4).length >= 6, 'bot armies leave their asteroid over the bridges (' + off.join(',') + ')');
ok(G.players.reduce((s, P) => s + P.stats.kills, 0) > 40, 'bots fight (total kills ' + G.players.reduce((s, P) => s + P.stats.kills, 0) + ')');
console.log(fail ? 'MOON FAIL' : 'MOON OK'); process.exit(fail ? 1 : 0);
