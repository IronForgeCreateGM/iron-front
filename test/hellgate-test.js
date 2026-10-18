// v6.0: Hindu Kush Hellgate (128x128, 2v6): layout, canyon, resources, start seats, 8-bot sims (length, stalls, canyon traffic, perf)
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G},get MW(){return MW}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const FULL = !!process.env.FULL, MAXMIN = +(process.env.MAXMIN || (FULL ? 40 : 12));
const mk = (a, b) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ ai: true, diff: i < 2 ? a : b, ally: i < 2 ? 0 : 1 }));
// --- layout
A.newGame({ seed: 3, map: 'hellgate', slots: mk('hard', 'hard') });
let G = A.G; const MW = A.MW;
ok(MW === 128 && G.mapName === 'hellgate' && G.starts.length === 8, 'map 128x128, 8 starts');
ok(G.players.map(P => P.start).join() === '0,1,2,3,4,5,6,7', 'Team A on seats 1-2, Team B on 3-8');
ok(G.players.every(P => G.ents.some(e => e.team === P.team && e.t === 'hq')), 'all HQs placed');
const ws = []; for (let x = 39; x <= 49; x++) { let n = 0; for (let y = 40; y < 90; y++) if (G.map[y * MW + x] !== 1) n++; ws.push(n); }
ok(ws.every(n => n >= 6 && n <= 8), 'single 6-8 tile canyon through the ridge (widths ' + ws.join(',') + ')');
for (let y = 3; y < MW - 3; y++) if (Math.abs(y - 64) > 8 && G.map[y * MW + 44] !== 1) { ok(false, 'ridge open at y=' + y); break; }
const res = G.players.map(P => { const [sx, sy] = G.starts[P.start]; let ore = 0; for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const xx = Math.floor(sx + x), yy = Math.floor(sy + y); if (xx >= 0 && yy >= 0 && xx < MW && yy < MW) ore += G.ore[yy * MW + xx]; }
  return { ore: ore | 0, gas: G.vents.filter(([vx, vy]) => Math.hypot(vx - sx, vy - sy) < 13).length, dk: G.derricks.filter(d => Math.hypot(d.x - sx, d.y - sy) < 20).length }; });
console.log('per-base', res.map((r, i) => `${i + 1}: ore ${r.ore} gas ${r.gas} dk ${r.dk}`).join(' | '));
ok(res.every(r => r.ore > 2500 && r.gas >= 2 && r.dk >= 1), 'every base: ore, 2+ gas vents, a derrick nearby');
ok(G.derricks.length >= 20, 'capture points (derricks): ' + G.derricks.length);
const nrich = G.rich.reduce((a, b) => a + b, 0); ok(nrich >= 60, 'rich ore tiles: ' + nrich + ', total ore tiles ' + G.ore.filter(v => v > 0).length + ', vents ' + G.vents.length);
ok(G.derricks.filter(d => d.x > 50 && d.x < 70 && Math.abs(d.y - 64) < 12).length >= 2, 'rich derricks at the canyon mouth');
for (let k = 2; k < 8; k++) { const [gx, gy] = G.starts[k]; G.curTeam = 0; const p = [{ x: 16, y: 64 }].concat(findPath(16, 64, gx, gy + (gy < 64 ? 3 : -3))); G.curTeam = null;
  const pl = p && p.length ? p.reduce((a, q, j) => a + (j ? Math.hypot(q.x - p[j - 1].x, q.y - p[j - 1].y) : Math.hypot(q.x - 16, q.y - 64)), 0) : 0, last = p && p[p.length - 1];
  ok(pl > 0 && Math.hypot(last.x - gx, last.y - gy) < 6 && p.some((q, j) => j && (p[j - 1].x - 44) * (q.x - 44) <= 0 && Math.abs(p[j - 1].y + (q.y - p[j - 1].y) * (44 - p[j - 1].x) / ((q.x - p[j - 1].x) || 1) - 64) < 6), `path valley -> base ${k + 1} goes through the Hellgate (${pl | 0} tiles)`); }
// --- outposts (capturable mesa overlooks that grant a build radius)
const ops = G.derricks.filter(d => d.op); ok(ops.length >= 5, 'outposts: ' + ops.map(o => o.name).join(', '));
for (const o of ops) { const ti = Math.floor(o.y) * MW + Math.floor(o.x); G.curTeam = 0; const p1 = findPath(16, 64, o.x, o.y), p2 = findPath(G.starts[3][0], G.starts[3][1] + 3, o.x, o.y); G.curTeam = null;
  const reach = q => q && q.length && Math.hypot(q[q.length - 1].x - o.x, q[q.length - 1].y - o.y) < 1.5;
  const tx = Math.floor(o.x) + 1, ty = Math.floor(o.y) - 2, before = canPlace('gcannon', 0, tx, ty); o.owner = 0; const after = canPlace('gcannon', 0, tx, ty); o.owner = -1;
  ok(G.tier[ti] === 1 && reach(p1) && reach(p2) && !before && after, `outpost ${o.name} @${o.x},${o.y}: high ground ${G.tier[ti] === 1}, reachable by Team A ${!!reach(p1)} + warlords ${!!reach(p2)}, Grand Cannon placeable only after capture (${before}->${after})`); }
{ const o = ops[0]; o.owner = 0; G.players[0].cr = 9999; G.players[0].gas = 999; G.players[0].fac = 'fra'; addB('tech', 0, 10, 60, true); const tx = Math.floor(o.x) + 1, ty = Math.floor(o.y) - 2; const ok1 = canPlace('gcannon', 0, tx, ty) && avail(0, 'gcannon') !== false;
  const b = addB('gcannon', 0, tx, ty, true); ok(ok1 && b && Math.hypot(b.x - 52, b.y - 64) <= 16, 'Grand Cannon built on ' + o.name + ' covers the Hellgate mouth (dist ' + (b ? Math.hypot(b.x - 52, b.y - 64).toFixed(1) : '?') + ', range 15)'); o.owner = -1; }
// --- sims
function run(seed, a, b, mins) {
  A.newGame({ seed, map: 'hellgate', peace: 300, slots: mk(a, b) }); G = A.G;
  const peak = G.players.map(() => 0), cross = new Set(), firstHit = {}; let worst = 0, tot = 0, ticks = 0, err = null, mid = null;
  try { for (let n = 0; n < 30 * 60 * mins && !G.over; n++) { const t0 = process.hrtime.bigint(); A.stepGame(); const dt = Number(process.hrtime.bigint() - t0) / 1e6; tot += dt; ticks++; if (dt > worst && n > 30) worst = dt;
      G.events.length = 0;
      if (n % 30 === 0) for (const e of G.ents) if (e.kind === 'u' && e.team >= 2 && e.x < 44 && e.x > 36 && Math.abs(e.y - 64) < 6) cross.add(e.id);
      if (n % 30 === 0) { const c = {}; for (const e of G.ents) if (e.kind === 'u' && e.team >= 2 && e.x < 40 && !isAir(e) && UT[e.t].wpn && e.t !== 'harv') c[e.team] = (c[e.team] || 0) + 1; for (const t in c) if (c[t] >= 4 && firstHit[t] == null) firstHit[t] = G.time | 0; } // first real warlord push (4+ units) through the Hellgate
      if (n % 300 === 0) G.players.forEach((P, i) => { peak[i] = Math.max(peak[i], G.ents.filter(e => e.team === P.team && e.kind === 'b').length); });
      if (!mid && G.time >= 600) mid = G.players.map(P => { const me = G.ents.filter(e => e.team === P.team && e.hp > 0); return { out: !!P.out, pow: P.pow, cr: P.cr | 0, fac: me.filter(e => e.t === 'factory' || e.t === 'barracks').length, army: me.filter(e => e.kind === 'u' && UT[e.t].wpn && e.t !== 'harv').length, b: me.filter(e => e.kind === 'b').length }; });
    } } catch (e) { err = e; }
  const win = G.over ? (G.over.winner != null ? G.over.winner : JSON.stringify(G.over).slice(0, 40)) : 'none';
  const opOwn = G.derricks.filter(d => d.op).map(d => d.owner);
  return { opOwn, err, t: G.time, over: !!G.over, win, peak, cross: cross.size, firstHit, mid, avg: tot / ticks, worst, alive: G.players.map(P => !P.out) };
}
const runs = FULL ? [[11, 'hard', 'hard'], [12, 'si', 'hard'], [13, 'chief', 'hard'], [14, 'si', 'normal']] : [[11, 'si', 'hard']];
for (const [seed, a, b] of runs) {
  const r = run(seed, a, b, MAXMIN);
  console.log(`seed ${seed} A=${a} B=${b}: t=${(r.t / 60).toFixed(1)}min over=${r.over} winner=${r.win} alive=${r.alive.map(v => v ? 1 : 0).join('')} peakB=${r.peak.join(',')} canyonCrossers=${r.cross} firstAttack=${JSON.stringify(r.firstHit)} step avg ${r.avg.toFixed(2)}ms worst ${r.worst.toFixed(0)}ms outpostOwners=${r.opOwn.join(',')}`);
  if (r.mid) console.log('  @10min', r.mid.map((x, i) => `P${i + 1}${x.out ? ' OUT' : ''} b${x.b} fac${x.fac} army${x.army} pow${x.pow} $${x.cr}`).join(' | '));
  ok(!r.err, `seed ${seed}: runs without errors ${r.err ? r.err.stack : ''}`);
  ok(r.peak.every(n => n >= 5), `seed ${seed}: every bot built a base`);
  ok(!r.mid || r.mid.filter(x => !x.out).every(x => x.fac >= 1 && (x.pow > -80 || x.cr < 250)), `seed ${seed}: no stalled/blacked-out bot at 10 min`);
  ok(r.t >= 9 * 60 || !r.over, `seed ${seed}: no instant steamroll (lasted ${(r.t / 60).toFixed(1)} min)`);
  const fh = Object.values(r.firstHit); ok(fh.filter(t => t < 300 + 150).length <= 3 && fh.every(t => t >= 290), `seed ${seed}: no push before peace ends, at most 3 of 6 warlords hit the Hellgate in the first 2.5 min after it (${JSON.stringify(r.firstHit)})`);
  ok(r.avg < 12, `seed ${seed}: sim perf avg ${r.avg.toFixed(2)} ms/tick (budget 33)`);
}
console.log(fail ? 'HELLGATE FAIL' : 'HELLGATE OK'); process.exit(fail ? 1 : 0);
