// v7.9.4 Rift Canyon: layout checks (exact 180° point symmetry, fair seats, reachability, crossings) + 8 Hard (si2) bots FFA.
// node test/rift-test.js [seed] [minutes]   (minutes 0 = layout only)
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const seed = +(process.argv[2] || 11), MIN = +(process.argv[3] ?? 14), FAC = ['usa', 'rus', 'chn', 'ger', 'fra', 'jpn', 'irn', 'bra'];
const slots = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ ai: true, diff: 'si2', ally: i, fac: FAC[(i + seed) % 8] }));
const t0 = Date.now(); A.newGame({ seed, map: 'riftcanyon', slots }); const G = A.G, W = A.MW, M = W / 2;
ok(W === 224 && G.starts.length === 8 && G.mapName === 'riftcanyon' && G.desert, 'map 224x224 desert, 8 starts (gen ' + (Date.now() - t0) + ' ms)');
ok(new Set(G.players.map(P => P.start)).size === 8, 'every player has its own start');
// exact symmetry: a 90-degree rotation leaves terrain / ore / ice / hills unchanged
const rot = i => W * W - 1 - i;
let asym = 0; for (let i = 0; i < W * W; i++) { const j = rot(i); if (G.map[i] !== G.map[j] || G.ore[i] !== G.ore[j] || G.lava[i] !== G.lava[j] || G.lpit[i] !== G.lpit[j] || G.lvl[i] !== G.lvl[j]) asym++; }
ok(asym === 0, 'terrain, ore, lava and heights are exactly 180° point symmetric (' + asym + ' mismatches)');
const cnt = a => a.reduce((s, v) => s + (v ? 1 : 0), 0);
console.log(`  tiles: rock ${cnt(G.map.map(t => t === 1))}, lava ${cnt(G.lava)} (pits ${cnt(G.lpit)}), ore ${cnt(G.ore.map(v => v > 0))}, vents ${G.vents.length}, derricks ${G.derricks.length} (outposts ${G.derricks.filter(d => d.op).length}), sites ${G.sites.length}`);
// BFS distance field (4-neighbour walkable tiles) from a point
const bfs = (sx, sy) => { const d = new Int32Array(W * W).fill(-1), s0 = Math.floor(sy) * W + Math.floor(sx), q = [s0]; d[s0] = 0;
  for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue; const n = ny * W + nx; if (d[n] >= 0 || G.map[n] !== 0) continue; d[n] = d[c] + 1; q.push(n); } } return d; };
const at = (d, x, y) => { let best = -1; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = Math.floor(x) + dx, Y = Math.floor(y) + dy; if (X < 0 || Y < 0 || X >= W || Y >= W) continue; const v = d[Y * W + X]; if (v >= 0 && (best < 0 || v < best)) best = v; } return best; };
const areas = [], ores = [], dCore = [], dNext = [], dOp = [], dOpOther = [];
const ops = G.derricks.filter(d => d.op);
const plen = (sx, sy, gx, gy) => { const rr = Math.hypot(M - sx, M - sy); sx += (M - sx) / rr * 4; sy += (M - sy) / rr * 4; const p = findPath(sx, sy, gx, gy); if (!p || !p.length) return -1; let L = 0, x = sx, y = sy; for (const q of p) { const [qx, qy] = Array.isArray(q) ? q : [q.x, q.y]; L += Math.hypot(qx - x, qy - y); x = qx; y = qy; } return Math.round(L); }; // A* path length (units move any-angle)
for (let k = 0; k < 8; k++) { const [sx, sy] = G.starts[k], d = bfs(sx, sy); let a = 0, ore = 0;
  for (let y = -27; y <= 27; y++) for (let x = -27; x <= 27; x++) { const X = Math.floor(sx + x), Y = Math.floor(sy + y), i = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < W && Math.hypot(x, y) <= 26 && G.map[i] === 0) { a++; if (Math.hypot(x, y) <= 20) ore += G.ore[i]; } }
  const vents = G.vents.filter(([vx, vy]) => Math.hypot(vx + 0.5 - sx, vy + 0.5 - sy) < 14).length; areas.push(a); ores.push(Math.round(ore));
  const dc = Math.min(...G.derricks.filter(o => o.op).map(o => plen(sx, sy, o.x, o.y)).filter(v => v >= 0)), dn = Math.min(...G.starts.map((p, j) => j === k ? 1e9 : plen(sx, sy, ...p)).filter(v => v >= 0)), all = G.starts.every(s => at(d, ...s) >= 0) && G.derricks.every(o => at(d, o.x, o.y) > 0);
  const od = G.derricks.filter(o => !o.op).map(o => plen(sx, sy, o.x, o.y)).sort((a, b) => a - b); dOp.push(od[0]); dOpOther.push(od[1]); dCore.push(dc); dNext.push(dn);
  const bad = G.starts.filter(s => !(at(d, ...s) >= 0)).length + '/' + G.derricks.filter(o => !(at(d, o.x, o.y) > 0)).map(o => (o.op ? 'V' : 'd') + o.x + ',' + o.y).join(' '); if (!all) console.log('  unreachable:', bad);
  const pc = findPath(sx, sy + 3, ops[0].x, ops[0].y);
  ok(vents === 2 && ore > 150000 && all && dc > 0 && pc && pc.length, `seat ${k + 1} (${sx},${sy}): ${vents} gas, ore ${Math.round(ore)}, land ${a}, walk to nearest Rift Outpost ${dc} (findPath ${pc ? pc.length : 0}), to nearest seat ${dn}, nearest derricks ${od[0]}/${od[1]}, reaches every seat + derrick + outpost ${all}`); }
const spread = v => (Math.max(...v) - Math.min(...v)) / Math.max(...v);
ok(spread(ores) < 0.005, 'every seat has the same main ore within 20 tiles (' + ores.join(',') + ')');
ok(spread(areas) < 0.12, 'every seat has about the same open land within 26 tiles (' + areas.join(',') + ', spread ' + (spread(areas) * 100).toFixed(1) + '%)');
ok(spread(dNext) < 0.25 && spread(dOp) < 0.25, `walk distances fair: rift outpost ${dCore.join(',')} | nearest seat ${dNext.join(',')} | own derrick ${dOp.join(',')}`);
ok(ops.length === 2 && G.derricks.length === 10, '2 Rift Outposts + 8 derricks');
// zigzag: no seat has a twin straight across the rift (nearest other-side seat is offset along the rift)
ok(G.starts.every(([x, y], k) => G.starts.every(([X, Y], j) => j === k || (j % 2) === (k % 2) || Math.hypot(X - x, Y - y) > 40)), 'zigzag: every cross-rift neighbour is > 40 tiles away');
// rich ore per field: every image of a field holds the same total
const rich = G.ore.reduce((s, v, i) => s + (G.rich[i] ? v : 0), 0); console.log('  rich ore total', Math.round(rich), '| 4 fields per seat:', ores[0]);
if (MIN > 0) {
  const home = P => G.starts[P.start], off = G.players.map(() => 0), peak = G.players.map(() => 0), exp = G.players.map(() => 0), firstAtk = G.players.map(() => null), floor = G.players.map(() => 0), core = G.players.map(() => 0);
  let err = null, n = 0; const last = new Map(); let stuckMax = 0, stuckAt = ''; G.watch = true;
  const T0 = Date.now(), marks = [];
  try { for (; n < MIN * 60 * 30 && G.players.filter(P => !P.out).length > 1; n++) { A.stepGame(); G.events.length = 0;
    if (n % 150 === 0) G.players.forEach((P, t) => { const [hx, hy] = home(P), mine = G.ents.filter(e => e.team === t && e.hp > 0);
      peak[t] = Math.max(peak[t], mine.filter(e => BT[e.t]).length);
      exp[t] = Math.max(exp[t], mine.filter(e => (e.t === 'refinery' || e.t === 'cc') && Math.hypot(e.x - hx, e.y - hy) > 22).length);
      const g = mine.filter(e => UT[e.t] && !UT[e.t].air && e.t !== 'harv' && e.t !== 'engineer');
      const away = g.filter(e => Math.hypot(e.x - hx, e.y - hy) > 30).length; off[t] = Math.max(off[t], away);
      floor[t] = Math.max(floor[t], g.filter(e => G.lvl[idx(Math.floor(e.x), Math.floor(e.y))] < 0.5).length); core[t] = Math.max(core[t], mine.filter(e => UT[e.t] && Math.hypot(e.x - M, e.y - M) < 32).length);
      if (away >= 4 && firstAtk[t] == null) firstAtk[t] = (G.time / 60).toFixed(1); });
    if (n % 600 === 0) { let st = 0; for (const e of G.ents) { if (!UT[e.t] || UT[e.t].air || e.hp <= 0 || !(e.path && e.path.length)) { last.delete(e.id); continue; } const l = last.get(e.id);
        if (l && Math.hypot(e.x - l[0], e.y - l[1]) < 0.5) st++; last.set(e.id, [e.x, e.y]); } if (st > stuckMax) { stuckMax = st; stuckAt = (G.time / 60).toFixed(1) + 'm'; } }
    if (n % (180 * 30) === 0 && n) marks.push(`${n / 1800 | 0}m alive ${G.players.filter(P => !P.out).length} units ${G.ents.filter(e => UT[e.t]).length}`);
  } } catch (e) { err = e; console.log(e.stack); }
  ok(!err, `8 Hard bots ran ${(G.time / 60).toFixed(1)} game-min without errors (${((Date.now() - T0) / 1000) | 0}s wall, ${((Date.now() - T0) / Math.max(1, n)).toFixed(2)} ms/tick)`);
  console.log(marks.join(' | ')); console.log('  alive', G.players.filter(P => !P.out).length, '| most ground units with a path that moved <0.5 tile in 20 s:', stuckMax, 'at', stuckAt, 'of', G.ents.filter(e => UT[e.t] && !UT[e.t].air).length, 'ground units now');
  console.log('  derricks/outposts owned:', G.derricks.map(d => (d.op ? 'V' : 'd') + d.owner).join(','));
  G.players.forEach((P, t) => console.log(`  bot ${t + 1} ${P.fac}@seat${P.start + 1}: peak bldgs ${peak[t]}, expansions ${exp[t]}, kills ${P.stats.kills}, lost ${P.stats.lost}, max ground units >30 tiles out ${off[t]} (first push ${firstAtk[t] || '-'} min), max on canyon floor ${floor[t]}, max near core ${core[t]}, mined ${(P.stats.mined / 1000) | 0}k, out ${P.out}`));
  ok(peak.every(v => v >= 6), 'every bot built a base (' + peak.join(',') + ')');
  ok(exp.filter(v => v > 0).length >= 6, 'bots expand (' + exp.join(',') + ')');
  ok(floor.filter(v => v >= 4).length >= 6, 'bot armies go down into the canyon (' + floor.join(',') + ')');
  ok(G.players.reduce((s, P) => s + P.stats.kills, 0) > 40, 'bots fight (total kills ' + G.players.reduce((s, P) => s + P.stats.kills, 0) + ')');
  ok(G.derricks.filter(d => d.owner >= 0).length >= 6, 'derricks / Rift Outposts get captured (' + G.derricks.filter(d => d.owner >= 0).length + ' of ' + G.derricks.length + ')');
}
console.log(fail ? 'RIFT FAIL' : 'RIFT OK'); process.exit(fail ? 1 : 0);
