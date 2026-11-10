// v7.9.1 Delta of Kings: layout checks (exact 8-fold symmetry, fair seats, fords/bridges, reachability) + 8 Hard (si2) bots FFA.
// node test/delta-test.js [seed] [minutes]   (minutes 0 = layout only)
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const seed = +(process.argv[2] || 11), MIN = +(process.argv[3] ?? 14), FAC = ['usa', 'rus', 'chn', 'ger', 'fra', 'jpn', 'irn', 'bra'];
const slots = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ ai: true, diff: 'si2', ally: i, fac: FAC[(i + seed) % 8] }));
const t0 = Date.now(); A.newGame({ seed, map: 'deltakings', slots }); const G = A.G, W = A.MW;
ok(W === 224 && G.starts.length === 8 && G.mapName === 'deltakings', 'map 224x224, 8 starts (gen ' + (Date.now() - t0) + ' ms)');
ok(new Set(G.players.map(P => P.start)).size === 8, 'every player has its own start');
// exact symmetry: 90-degree rotation and mirror leave terrain / ore / fords / bridges unchanged
const rot = i => { const x = i % W, y = (i / W) | 0; return x * W + (W - 1 - y); }, mir = i => { const x = i % W, y = (i / W) | 0; return y * W + (W - 1 - x); };
let asym = 0; for (let i = 0; i < W * W; i++) for (const j of [rot(i), mir(i)]) if (G.map[i] !== G.map[j] || G.ore[i] !== G.ore[j] || G.ford[i] !== G.ford[j] || G.bridge[i] !== G.bridge[j] || G.lvl[i] !== G.lvl[j]) asym++;
ok(asym === 0, 'terrain, ore, fords, bridges and hills are exactly 8-fold symmetric (' + asym + ' mismatches)');
const cnt = a => a.reduce((s, v) => s + (v ? 1 : 0), 0);
console.log(`  tiles: water ${cnt(G.map.map(t => t === 2))}, ford ${cnt(G.ford)}, bridge ${cnt(G.bridge)}, rock ${cnt(G.map.map(t => t === 1))}, vents ${G.vents.length}, derricks ${G.derricks.length}, sites ${G.sites.length}`);
// per-seat land / ore / gas within 26 tiles; flood-fill reachability with fords+bridges, and without them
const flood = (blockCross) => { const seen = new Uint8Array(W * W), s0 = Math.floor(G.starts[0][1]) * W + Math.floor(G.starts[0][0]), st = [s0]; seen[s0] = 1;
  while (st.length) { const c = st.pop(), x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue; const n = ny * W + nx; if (seen[n] || G.map[n] !== 0 || (blockCross && (G.ford[n] || G.bridge[n]))) continue; seen[n] = 1; st.push(n); } } return seen; };
const all = flood(false), dry = flood(true), sIdx = k => Math.floor(G.starts[k][1]) * W + Math.floor(G.starts[k][0]);
const areas = [], ores = [];
for (let k = 0; k < 8; k++) { const [sx, sy] = G.starts[k]; let a = 0, ore = 0;
  for (let y = -27; y <= 27; y++) for (let x = -27; x <= 27; x++) { const i = Math.floor(sy + y) * W + Math.floor(sx + x); if (Math.hypot(x, y) <= 26 && G.map[i] === 0) { a++; ore += G.ore[i]; } }
  const vents = G.vents.filter(([vx, vy]) => Math.hypot(vx + 0.5 - sx, vy + 0.5 - sy) < 14).length; areas.push(a); ores.push(ore | 0);
  const pn = findPath(sx, sy + 3, G.starts[(k + 1) % 8][0], G.starts[(k + 1) % 8][1] + 3), pc = findPath(sx, sy + 3, W / 2 + 6, W / 2 + 6);
  ok(vents === 2 && ore > 50000 && all[sIdx(k)] && pn && pn.length && pc && pc.length, `seat ${k + 1} (${sx},${sy}): ${vents} gas, ore ${ore | 0}, land ${a}, reachable ${!!all[sIdx(k)]}, path to next seat ${pn ? pn.length : 0}, to King's Isle ${pc ? pc.length : 0}`); }
ok(Math.max(...areas) === Math.min(...areas) && Math.max(...ores) - Math.min(...ores) < 1, 'every seat has identical land (' + areas[0] + ') and ore (' + ores[0] + ')');
const isl = [0, 1, 2, 3, 4, 5, 6, 7].map(k => !!dry[sIdx(k)]);
ok(isl.join() === 'true,true,false,false,false,false,false,false', 'without fords/bridges seat 1 can only reach its island-mate (seat 2): ' + isl.map(v => v ? 1 : 0).join(''));
ok(G.derricks.length === 8 && G.derricks.every(d => all[Math.floor(d.y) * W + Math.floor(d.x)]), '8 derricks, all reachable (' + G.derricks.map(d => d.x + ',' + d.y).join(' ') + ')');
if (MIN > 0) {
  const home = P => G.starts[P.start], off = G.players.map(() => 0), peak = G.players.map(() => 0), exp = G.players.map(() => 0), firstAtk = G.players.map(() => null), wet = G.players.map(() => 0);
  let err = null, n = 0; const last = new Map(); let stuckMax = 0, stuckAt = ''; G.watch = true;
  const T0 = Date.now(), marks = [], side = (x, y) => { const u = x - W / 2, v = y - W / 2; return Math.abs(v) >= Math.abs(u) ? (v < 0 ? 0 : 2) : (u > 0 ? 1 : 3); };
  try { for (; n < MIN * 60 * 30 && G.players.filter(P => !P.out).length > 1; n++) { A.stepGame(); G.events.length = 0;
    if (n % 150 === 0) G.players.forEach((P, t) => { const [hx, hy] = home(P), hs = side(hx, hy), mine = G.ents.filter(e => e.team === t && e.hp > 0);
      peak[t] = Math.max(peak[t], mine.filter(e => BT[e.t]).length);
      exp[t] = Math.max(exp[t], mine.filter(e => (e.t === 'refinery' || e.t === 'cc') && Math.hypot(e.x - hx, e.y - hy) > 22).length);
      const g = mine.filter(e => UT[e.t] && !UT[e.t].air && e.t !== 'harv' && e.t !== 'engineer');
      const away = g.filter(e => Math.hypot(e.x - hx, e.y - hy) > 30).length; off[t] = Math.max(off[t], away);
      wet[t] = Math.max(wet[t], g.filter(e => side(e.x, e.y) !== hs && Math.hypot(e.x - W / 2, e.y - W / 2) > 20).length + g.filter(e => Math.hypot(e.x - W / 2, e.y - W / 2) < 16).length);
      if (away >= 4 && firstAtk[t] == null) firstAtk[t] = (G.time / 60).toFixed(1); });
    if (n % 600 === 0) { let st = 0; for (const e of G.ents) { if (!UT[e.t] || UT[e.t].air || e.hp <= 0 || !(e.path && e.path.length)) { last.delete(e.id); continue; } const l = last.get(e.id);
        if (l && Math.hypot(e.x - l[0], e.y - l[1]) < 0.5) st++; last.set(e.id, [e.x, e.y]); } if (st > stuckMax) { stuckMax = st; stuckAt = (G.time / 60).toFixed(1) + 'm'; } }
    if (n % (180 * 30) === 0 && n) marks.push(`${n / 1800 | 0}m alive ${G.players.filter(P => !P.out).length} units ${G.ents.filter(e => UT[e.t]).length}`);
  } } catch (e) { err = e; console.log(e.stack); }
  ok(!err, `8 Hard bots ran ${(G.time / 60).toFixed(1)} game-min without errors (${((Date.now() - T0) / 1000) | 0}s wall, ${((Date.now() - T0) / Math.max(1, n)).toFixed(2)} ms/tick)`);
  console.log(marks.join(' | ')); console.log('  alive', G.players.filter(P => !P.out).length, '| most ground units with a path that moved <0.5 tile in 20 s:', stuckMax, 'at', stuckAt, 'of', G.ents.filter(e => UT[e.t] && !UT[e.t].air).length, 'ground units now');
  console.log('  derricks owned:', G.derricks.map(d => d.owner).join(','));
  G.players.forEach((P, t) => console.log(`  bot ${t + 1} ${P.fac}@seat${P.start + 1}: peak bldgs ${peak[t]}, expansions ${exp[t]}, kills ${P.stats.kills}, lost ${P.stats.lost}, max ground units >30 tiles out ${off[t]} (first push ${firstAtk[t] || '-'} min), max across the water ${wet[t]}, mined ${(P.stats.mined / 1000) | 0}k, out ${P.out}`));
  ok(peak.every(v => v >= 6), 'every bot built a base (' + peak.join(',') + ')');
  ok(exp.filter(v => v > 0).length >= 6, 'bots expand (' + exp.join(',') + ')');
  ok(wet.filter(v => v >= 4).length >= 4 && G.players.every((P, t) => P.out || wet[t] >= 4), 'bot armies cross the rivers (fords / bridges / King\'s Isle): >= 4 bots and every survivor (' + wet.join(',') + ')'); // bots knocked out by their island-mate never get to cross
  ok(G.players.reduce((s, P) => s + P.stats.kills, 0) > 40, 'bots fight (total kills ' + G.players.reduce((s, P) => s + P.stats.kills, 0) + ')');
}
console.log(fail ? 'DELTA FAIL' : 'DELTA OK'); process.exit(fail ? 1 : 0);
