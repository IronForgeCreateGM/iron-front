// v7.6.5 no-trap drill (si2). node test/nt76-drill.js [unit|game] ; env NT=0 runs with SIOFF.nt76 (old behaviour) for comparison.
// unit: a pocket next to a barracks exit must be refused, an open spot accepted, a sealing wall line gets a gate or is torn down.
// game: short si2 skirmishes; at checkpoints no ground unit / exit / refinery of an si2 bot may be cut off, harvesters keep mining, armies leave and return.
const fs = require('fs'), vm = require('vm'), path = require('path');
const MODE = process.argv[2] || 'all';
if (process.env.NT === '0') globalThis.SIOFF = { nt76: 1 };
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// full-map reach from a goal tile, own gates open
function reach(team, gx, gy) { const g = getBlock(), r = new Uint8Array(MW * MH), q = []; const open = i => g[i] === 0 || (g[i] === 3 && !foe(G.gateT[i], team));
  const s = nearFree(Math.floor(gx), Math.floor(gy), 8), si = idx(s[0], s[1]); r[si] = 1; q.push(si);
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (!r[n] && open(n)) { r[n] = 1; q.push(n); } } } return r; }
const near1 = (r, x, y) => { x = Math.floor(x); y = Math.floor(y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && r[idx(x + dx, y + dy)]) return true; return false; };
function audit(P) { const me = G.ents.filter(e => e.team === P.team && e.hp > 0 && !e.dead), hq = me.find(e => e.t === 'hq' || e.t === 'cc'); if (!hq) return null;
  const st = G.starts[G.players.find(Q => foe(Q.team, P.team)).start], r = reach(P.team, st[0], st[1]);
  const trapped = me.filter(u => u.kind === 'u' && !isAir(u) && !u.inside && !near1(r, u.x, u.y)).length;
  const exits = me.filter(b => b.t === 'barracks' || b.t === 'factory').filter(b => { let x = b.x, y = b.ty + b.h + 0.5; if (blk(x, y)) { const f = nearFree(Math.floor(x), Math.floor(y)); x = f[0] + 0.5; y = f[1] + 0.5; } return !near1(r, x, y); }).length; // where spawnUnit really puts them
  const refs = me.filter(b => b.t === 'refinery').filter(b => { for (let y = b.ty - 1; y <= b.ty + b.h; y++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) if (inb(x, y) && r[idx(x, y)]) return false; return true; }).length;
  return { trapped, exits, refs, hqOut: aiExitFree(P, hq), mined: P.stats.mined | 0, harv: me.filter(u => u.t === 'harv').length, walls: me.filter(e => e.t === 'wall').length, gates: me.filter(e => e.t === 'gate').length, bld: me.filter(e => e.kind === 'b').length };
}
if (MODE === 'unit' || MODE === 'all') {
  newGame({ seed: 5, map: 'classic', slots: [{ ai: true, diff: 'si2', fac: 'usa', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: 'rus', start: 1, ally: 1 }] });
  const P = G.players[0], hq = G.ents.find(e => e.t === 'hq' && e.team === 0);
  // a barracks with its exit in the open, then box the exit area in so only a 3-tile mouth (bottom row) stays
  const clear = (bx, by) => { for (let y = by - 3; y <= by + 7; y++) for (let x = bx - 4; x <= bx + 5; x++) if (!inb(x, y) || getBlock()[idx(x, y)] || G.ore[idx(x, y)] > 0) return false; return true; };
  let bx = 0, by = 0; search: for (let r = 6; r < 16; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) { bx = Math.floor(hq.x) + dx; by = Math.floor(hq.y) + dy; if (clear(bx, by) && canPlace('barracks', 0, bx, by)) break search; }
  const br = addB('barracks', 0, bx, by, true); const ex = Math.floor(br.x), ey = br.ty + br.h;
  const U = []; for (let x = ex - 3; x <= ex + 3; x++) { U.push([x, ey - 4]); if (Math.abs(x - ex) > 1) U.push([x, ey + 3]); } for (let y = ey - 3; y <= ey + 2; y++) U.push([ex - 3, y], [ex + 3, y]);
  for (const [x, y] of U) if (!getBlock()[idx(x, y)] && !G.ore[idx(x, y)]) addB('wall', 0, x, y, true);
  G.bver++;
  ok(nt76Ok(P, ex, ey, [], null, true), 'baseline: the boxed barracks still has its 3-wide mouth');
  const plug = [[ex - 1, ey + 3], [ex, ey + 3], [ex + 1, ey + 3]];
  ok(!nt76Ok(P, ex, ey, plug, null, true), 'plugging the mouth is refused (' + (G.ntLast && G.ntLast.why) + ')');
  ok(!nt76Ok(P, ex, ey, [[ex - 1, ey + 3], [ex, ey + 3]], null, true), 'narrowing the mouth to a 1-tile slot is refused (' + (G.ntLast && G.ntLast.why) + ')');
  ok(nt76Ok(P, ex, ey, [[ex - 1, ey + 3], [ex, ey + 3]], null, false), 'the same 1-tile slot is allowed for wall lines (no narrow rule; gates are the lane)');
  ok(nt76Ok(P, ex, ey, [[ex - 2, ey + 1]], null, true), 'a piece inside the box that leaves 2-wide room is accepted');
  ok(nt76Ok(P, hq.x - 8, hq.y + 8, [[Math.floor(hq.x) - 9, Math.floor(hq.y) + 8], [Math.floor(hq.x) - 8, Math.floor(hq.y) + 8]], null, true), 'a spot in the open is accepted');
  // a new barracks whose own exit would face a wall: refused via its extra source
  const nb = nt76Src(P, 'barracks', ex - 1, ey - 3); ok(!nt76Ok(P, ex, ey - 2, nt76Foot('barracks', ex - 1, ey - 3).concat(plug), null, true, nb), 'a new barracks inside the sealed box is refused');
  // the wall-line repair: wall the mouth shut with fresh pieces -> centre becomes a gate (or the pieces are torn down)
  P.cr = 5000; const placed = plug.map(([x, y]) => buyPiece(0, 'wall', x, y)); G.bver++;
  const r = nt76Walls(P, placed, ex, ey + 3); const live = placed.filter(b => b.hp > 0 && !b.dead);
  ok((r && live.some(b => b.t === 'gate')) || (!r && !live.some(b => b.t === 'wall')), 'sealing wall line: a gate is put in (' + live.map(b => b.t).join(',') + ') or the walls are torn down');
  // aiSpot with the mouth as the only room: a turret ordered to the mouth must not land on it
  P.aiS = P.aiS || { known: new Map(), bad: {} }; P.aiS.defAt = { x: ex, y: ey + 3 }; P.aiS.defAtT = G.time; for (const b of placed) { b.hp = 0; b.dead = true; } G.ents = G.ents.filter(e => !e.dead); G.bver++;
  const sp = aiSpot(P, 'turret', hq, []); ok(!sp || !plug.some(([x, y]) => x === sp[0] && y === sp[1]), 'aiSpot does not drop a turret into the mouth (' + sp + ')');
  // speed: 200 checks
  const t0 = Date.now(); for (let k = 0; k < 200; k++) nt76Ok(P, ex, ey, plug, null, true); const ms = (Date.now() - t0) / 200; console.log('check cost', ms.toFixed(2), 'ms'); ok(ms < 8, 'a check costs < 8 ms');
}
if (MODE === 'game' || MODE === 'all') {
  const games = (process.env.GAMES || 'volcano:77,frost:9,classic:5').split(',').map(s => s.split(':'));
  for (const [map, seed] of games) {
    const slots = [{ ai: true, diff: 'si2', fac: 'fra', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: 'chn', start: 1, ally: 0 }, { ai: true, diff: 'si', fac: 'bra', start: 2, ally: 1 }, { ai: true, diff: 'si', fac: 'ger', start: 3, ally: 1 }].slice(0, map === 'classic' ? 2 : 4);
    if (map === 'classic') slots[1] = { ai: true, diff: 'si', fac: 'chn', start: 1, ally: 1 };
    newGame({ seed: +seed, map, slots }); const t0 = Date.now(); const rows = []; let prevMined = {};
    for (let n = 0; n < (+process.env.MIN || 10) * 60 * 30 && !G.over; n++) { stepGame(); G.events.length = 0;
      if (n % (60 * 30) === 0 && n >= 4 * 60 * 30) for (const P of G.players) if (P.diff === 'si2' && !P.out) { const a = audit(P); if (!a) continue; a.t = G.time | 0; a.team = P.team; a.mineGain = a.mined - (prevMined[P.team] || 0); prevMined[P.team] = a.mined; rows.push(a); } }
    const last = {}; for (const r of rows) last[r.team] = r;
    console.log(map, seed, 'sec', ((Date.now() - t0) / 1000).toFixed(0), 'checks', G.ntChecks || 0, 'rejected', G.ntRej || 0, 'torn', G.ntTorn || 0, 'over', G.over || null, JSON.stringify(G.ntWhy || {}));
    for (const r of Object.values(last)) console.log('  P' + r.team, JSON.stringify(r));
    ok(rows.every(r => r.trapped === 0), map + ' ' + seed + ': no trapped si2 ground units at any checkpoint (' + rows.map(r => r.trapped).join('') + ')');
    ok(rows.every(r => r.exits === 0 && r.refs === 0), map + ' ' + seed + ': every barracks/factory exit and refinery reaches the enemy side');
    ok(rows.every(r => r.hqOut), map + ' ' + seed + ': armies can leave and return (yard exit open)');
    ok(rows.filter(r => r.t >= 300 && r.harv > 0).every(r => r.mineGain > 0), map + ' ' + seed + ': harvesters keep mining every minute');
  }
}
console.log(fail ? 'NT76 FAIL' : 'NT76 OK'); process.exit(fail ? 1 : 0);
