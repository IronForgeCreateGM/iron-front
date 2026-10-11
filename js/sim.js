'use strict';
// ===== Simulation (no DOM; runs in node for tests) =====
let G = null;
function mkRng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const idx = (x, y) => y * MW + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const isAir = e => e.kind === 'u' && !!UT[e.t].air;
const defOf = e => e.kind === 'b' ? BT[e.t] : UT[e.t];
const armorOf = e => e.kind === 'b' ? 'bldg' : UT[e.t].armor;

function newGame(opts) {
  opts = Object.assign({ seed: (Math.random() * 1e9) | 0, diff: 'normal', aiTeams: [1], fog: true }, opts || {});
  const R = mkRng(opts.seed);
  G = { R, opts, tick: 0, time: 0, ents: [], projs: [], events: [], nid: 1, over: null, bver: 1, blockVer: 0, block: null,
    map: new Uint8Array(MW * MH), ore: new Float32Array(MW * MH), elev: new Float32Array(MW * MH),
    visT: [new Uint8Array(MW * MH), new Uint8Array(MW * MH)], seenT: [new Uint8Array(MW * MH), new Uint8Array(MW * MH)], oreVer: 0, players: [] };
  G.vis = G.visT[0]; G.seen = G.seenT[0]; G.dens = new Uint8Array(MW * MH); G.starts = [[7.5, 7.5], [56.5, 56.5]];
  genMap(R);
  for (let t = 0; t < 2; t++) G.players.push({ team: t, cr: 5000, pow: 0, gen: 0, use: 0, ai: opts.aiTeams.includes(t), diff: opts.diff,
    queues: { bld: [], def: [], inf: [], veh: [], air: [] }, ready: { bld: null, def: null }, stats: { kills: 0, lost: 0, mined: 0 } });
  const bases = [[6, 6], [55, 55]];
  bases.forEach(([x, y], t) => {
    addB('hq', t, x, y, true);
    addU('harv', t, x + (t ? -1.5 : 4.5), y + (t ? -1.5 : 4.5));
    for (let i = 0; i < 3; i++) addU('rifle', t, x + 1 + i * 0.6 + (t ? -2 : 3), y + (t ? -2 : 4));
    addU('light', t, x + (t ? -2.5 : 5.5), y + (t ? 1 : 1.5));
  });
  if (typeof aiInit === 'function') G.players.forEach(p => p.ai && aiInit(p));
  updFog();
  return G;
}
function genMap(R) {
  const N = MW * MH, gs = 8, gw = MW / gs + 2;
  const mk = () => { const a = []; for (let i = 0; i < gw * gw; i++) a.push(R()); return a; };
  const g1 = mk(), g2 = mk();
  const sm = t => t * t * (3 - 2 * t);
  const vn = (g, x, y, s) => { x /= s; y /= s; const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const w = Math.ceil(MW / s) + 2, v = (a, b) => g[(b * w + a) % g.length];
    return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy; };
  for (let i = 0; i < N / 2; i++) {
    const x = i % MW, y = (i / MW) | 0;
    const n = vn(g1, x, y, 8) * 0.7 + vn(g2, x, y, 4) * 0.3;
    let t = 0; if (n > 0.66) t = 1; else if (n < 0.27) t = 2;
    G.map[i] = t; G.map[N - 1 - i] = t; G.elev[i] = G.elev[N - 1 - i] = n;
  }
  const clear = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
    if (inb(x, y) && Math.hypot(x - cx, y - cy) <= r) { G.map[idx(x, y)] = 0; G.map[N - 1 - idx(x, y)] = 0; } };
  clear(8, 8, 11);
  for (let k = 0; k <= 60; k++) { const t = k / 60; clear(8 + 47 * t, 8 + 47 * t + Math.sin(t * 9) * 4, 1.8); clear(8 + 47 * t + Math.sin(t * 7) * 10, 8 + 47 * t - Math.sin(t * 7) * 10, 1.4); }
  const field = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inb(x, y)) {
      const d = Math.hypot(x - cx, y - cy); if (d <= r + 0.3) { const a = (350 + (r - d) * 120) * ORE_MULT; for (const j of [idx(x, y), N - 1 - idx(x, y)]) { G.map[j] = 0; G.ore[j] = a; } } } };
  field(17, 9, 2); field(9, 19, 2); field(30, 29, 3); field(12, 44, 2); field(42, 15, 2);
  // flood fill from base: unreachable open tiles become rock
  const seen = new Uint8Array(N), st = [idx(8, 8)]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny);
      if (!seen[n] && G.map[n] === 0) { seen[n] = 1; st.push(n); } } }
  for (let i = 0; i < N; i++) if (G.map[i] === 0 && !seen[i]) { G.map[i] = 1; G.ore[i] = 0; }
  G.oreMax = Float32Array.from(G.ore);
}
function addB(t, team, tx, ty, instant) {
  const d = BT[t];
  const b = { id: G.nid++, kind: 'b', t, team, tx, ty, w: d.w, h: d.h, x: tx + d.w / 2, y: ty + d.h / 2, hp: d.hp, mhp: d.hp,
    born: instant ? -10 : G.time, tang: 0, rally: null, repair: false, sell: -1, cd: 0, ang: team ? Math.PI * 0.75 : -Math.PI / 4, tgt: null };
  G.ents.push(b); G.bver++;
  // push units off footprint
  for (const u of G.ents) if (u.kind === 'u' && !isAir(u) && u.x >= tx - 0.3 && u.x <= tx + d.w + 0.3 && u.y >= ty - 0.3 && u.y <= ty + d.h + 0.3) { u.y = ty + d.h + 0.6; u.path = []; }
  G.events.push({ e: 'place', b });
  return b;
}
function addU(t, team, x, y) {
  const d = UT[t];
  const u = { id: G.nid++, kind: 'u', t, team, x, y, z: d.air ? 2.6 : 0, hp: d.hp, mhp: d.hp, ang: team ? Math.PI * 0.75 : -Math.PI / 4, tang: 0,
    path: [], order: 'idle', tgt: null, dest: null, anchor: { x, y }, cd: 0, load: 0, hst: 'idle', moveT: 0, lastP: { x, y }, vet: 0 };
  u.tang = u.ang;
  G.ents.push(u);
  return u;
}
function byId(id) { for (const e of G.ents) if (e.id === id) return e; return null; }
function teamEnts(team, t) { return G.ents.filter(e => e.team === team && (!t || e.t === t)); }
function hasBuilt(team, t) { return G.ents.some(e => e.kind === 'b' && e.team === team && e.t === t && e.hp > 0 && e.sell < 0); }
function reqOk(team, d) { return d.req.every(r => hasBuilt(team, r)); }
function avail(team, t) {
  if (BT[t]) return hasBuilt(team, 'hq') && reqOk(team, BT[t]);
  const d = UT[t]; return (hasBuilt(team, d.from) || (d.alt || []).some(a => hasBuilt(team, a))) && reqOk(team, d);
}
function catOf(t) { return BT[t] ? BT[t].cat : FROMCAT[UT[t].from]; }
function getBlock() {
  if (G.blockVer === G.bver) return G.block;
  const g = new Uint8Array(MW * MH);
  for (let i = 0; i < g.length; i++) g[i] = G.map[i] ? 1 : 0;
  for (const e of G.ents) if (e.kind === 'b') for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) g[idx(x, y)] = 2;
  const nr = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (g[idx(x, y)]) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inb(x + dx, y + dy) || g[idx(x + dx, y + dy)]) nr[idx(x, y)] = 1; }
  G.near = nr; G.block = g; G.blockVer = G.bver; return g;
}
const blk = (x, y) => { x = Math.floor(x); y = Math.floor(y); return !inb(x, y) || getBlock()[idx(x, y)] > 0; };

// ---------- placement ----------
function canPlace(t, team, tx, ty) {
  const d = BT[t];
  if (tx < 0 || ty < 0 || tx + d.w > MW || ty + d.h > MH) return false;
  const g = getBlock();
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) if (g[idx(x, y)] || G.ore[idx(x, y)] > 0) return false;
  for (const e of G.ents) if (e.kind === 'u' && !isAir(e) && e.team !== team && e.x > tx && e.x < tx + d.w && e.y > ty && e.y < ty + d.h) return false;
  const R = 5;
  return G.ents.some(e => e.kind === 'b' && e.team === team && e.t !== 'wall' && tx < e.tx + e.w + R && tx + d.w > e.tx - R && ty < e.ty + e.h + R && ty + d.h > e.ty - R);
}
function placeReady(team, cat, tx, ty) {
  const P = G.players[team], t = P.ready[cat];
  if (!t || !canPlace(t, team, tx, ty)) return null;
  P.ready[cat] = null;
  const b = addB(t, team, tx, ty);
  if (t === 'refinery') { const h = addU('harv', team, b.x, b.ty + b.h + 0.6); h.born = G.time; }
  return b;
}
// ---------- production ----------
function enqueue(team, t) {
  const P = G.players[team], cat = catOf(t);
  if (!avail(team, t)) return false;
  const q = P.queues[cat];
  if (q.length >= (cat === 'bld' || cat === 'def' ? 1 : 6)) return false;
  if ((cat === 'bld' || cat === 'def') && P.ready[cat]) return false;
  q.push({ t, prog: 0, paid: 0 });
  return true;
}
function cancel(team, t) {
  const P = G.players[team], cat = catOf(t), q = P.queues[cat];
  if (P.ready[cat] === t && !q.length) { P.ready[cat] = null; P.cr += BT[t].cost; return true; }
  for (let i = q.length - 1; i >= 0; i--) if (q[i].t === t) { P.cr += q[i].paid; q.splice(i, 1); return true; }
  return false;
}
function stepProduction(P) {
  const slow = P.pow < 0 ? 0.5 : 1, ai = P.ai ? DIFF[P.diff].build : 1;
  for (const cat in P.queues) {
    const q = P.queues[cat]; if (!q.length) continue;
    if ((cat === 'bld' || cat === 'def') && P.ready[cat]) continue;
    const it = q[0], d = BT[it.t] || UT[it.t];
    const src = BT[it.t] ? 'hq' : d.from;
    let prod = G.ents.filter(e => e.kind === 'b' && e.team === P.team && e.t === src && e.sell < 0 && G.time - e.born > 1.5);
    if (!prod.length && d.alt) prod = G.ents.filter(e => e.kind === 'b' && e.team === P.team && d.alt.includes(e.t) && e.sell < 0 && G.time - e.born > 1.5);
    if (!prod.length || !reqOk(P.team, d)) continue;
    const dp = Math.min(1 - it.prog, DT * (1 + 0.5 * (prod.length - 1)) * slow * ai / d.time), c = d.cost * dp;
    if (P.cr >= c) { P.cr -= c; it.prog += dp; it.paid += c; }
    if (it.prog >= 0.9999) {
      q.shift();
      if (BT[it.t]) { P.ready[cat] = it.t; G.events.push({ e: 'ready', team: P.team, t: it.t }); }
      else spawnUnit(P.team, it.t, prod[(G.tick >> 3) % prod.length]);
    }
  }
}
function spawnUnit(team, t, b) {
  let x = b.x, y = b.ty + b.h + 0.5;
  if (UT[t].air) y = b.y;
  else if (blk(x, y)) { const f = nearFree(Math.floor(x), Math.floor(y)); x = f[0] + 0.5; y = f[1] + 0.5; }
  const u = addU(t, team, x, y);
  G.events.push({ e: 'unit', team, u });
  if (t === 'harv') return u;
  if (b.rally) orderMove([u], b.rally.x, b.rally.y, true);
  else if (!UT[t].air) orderMove([u], x + (G.R() - 0.5) * 2, y + 1.5 + G.R(), true);
  return u;
}
function nearFree(x, y, maxR) {
  const g = getBlock();
  for (let r = 0; r <= (maxR || 12); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const nx = x + dx, ny = y + dy; if (inb(nx, ny) && !g[idx(nx, ny)]) return [nx, ny];
  }
  return [x, y];
}
// ---------- pathfinding: A* w/ binary heap + LOS smoothing ----------
function findPath(sx, sy, gx, gy) {
  const g = getBlock(); G.pathCalls = (G.pathCalls || 0) + 1;
  let six = Math.floor(sx), siy = Math.floor(sy), gix = Math.max(0, Math.min(MW - 1, Math.floor(gx))), giy = Math.max(0, Math.min(MH - 1, Math.floor(gy)));
  if (!inb(six, siy)) return [];
  if (g[idx(gix, giy)]) { const f = nearFree(gix, giy, 8); gix = f[0]; giy = f[1]; gx = gix + 0.5; gy = giy + 0.5; }
  const N = MW * MH, gs = new Float32Array(N).fill(1e9), par = new Int32Array(N).fill(-1), cl = new Uint8Array(N);
  const s = idx(six, siy), goal = idx(gix, giy);
  const heap = [], push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
    if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const H = (x, y) => { const dx = Math.abs(x - gix), dy = Math.abs(y - giy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  gs[s] = 0; push(H(six, siy), s);
  let best = s, bh = 1e9, it = 0;
  while (heap.length && it++ < 8000) {
    const c = pop()[1]; if (cl[c]) continue; cl[c] = 1;
    const cx = c % MW, cy = (c / MW) | 0, h = H(cx, cy);
    if (h < bh) { bh = h; best = c; }
    if (c === goal) break;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue; const n = idx(nx, ny);
      if (cl[n] || g[n]) continue;
      if (dx && dy && (g[idx(nx, cy)] || g[idx(cx, ny)])) continue;
      const ng = gs[c] + (dx && dy ? 1.414 : 1) + (G.near[n] ? 0.35 : 0) + (n !== goal ? G.dens[n] * 0.8 : 0);
      if (ng < gs[n]) { gs[n] = ng; par[n] = c; push(ng + H(nx, ny), n); }
    }
  }
  const pts = []; let c = best;
  while (c !== s && c >= 0) { pts.push({ x: c % MW + 0.5, y: ((c / MW) | 0) + 0.5 }); c = par[c]; }
  pts.reverse();
  if (best === goal && pts.length) pts[pts.length - 1] = { x: gx, y: gy };
  else if (best === goal && !pts.length) pts.push({ x: gx, y: gy });
  // string pulling
  const out = []; let from = { x: sx, y: sy }, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(from, pts[j])) j--; out.push(pts[j]); from = pts[j]; i = j + 1; }
  return out;
}
function los(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 0.01) return true;
  const px = -dy / d * 0.35, py = dx / d * 0.35, n = Math.ceil(d / 0.2);
  for (let k = 1; k <= n; k++) { const x = a.x + dx * k / n, y = a.y + dy * k / n;
    if (blk(x, y) || blk(x + px, y + py) || blk(x - px, y - py)) return false; }
  return true;
}
// ---------- orders ----------
function setPath(u, x, y) {
  u.dest = { x, y }; u.moveT = 0; u.lastP = { x: u.x, y: u.y };
  if (isAir(u)) u.path = [{ x: Math.max(0.5, Math.min(MW - 0.5, x)), y: Math.max(0.5, Math.min(MH - 0.5, y)) }];
  else u.path = findPath(u.x, u.y, x, y);
}
function orderMove(units, x, y, attackMove, queue) {
  units = units.filter(u => u.kind === 'u'); if (!units.length) return;
  let cx = 0, cy = 0; units.forEach(u => { cx += u.x; cy += u.y; }); cx /= units.length; cy /= units.length;
  const dir = Math.atan2(y - cy, x - cx), cols = Math.ceil(Math.sqrt(units.length * 1.5)), sp = units.some(u => UT[u.t].armor !== 'inf') ? 1.25 : 0.85;
  const slots = [];
  for (let i = 0; i < units.length; i++) {
    const r = Math.floor(i / cols), c = i % cols, rowN = Math.min(cols, units.length - r * cols);
    const lat = (c - (rowN - 1) / 2) * sp, back = -r * sp;
    let sx = x + Math.cos(dir) * back - Math.sin(dir) * lat, sy = y + Math.sin(dir) * back + Math.cos(dir) * lat;
    if (blk(sx, sy)) { const f = nearFree(Math.floor(sx), Math.floor(sy), 4); sx = f[0] + 0.5; sy = f[1] + 0.5; }
    slots.push({ x: sx, y: sy });
  }
  // fastest/frontline first: greedy nearest assignment
  const left = units.slice();
  for (const s of slots) { let bi = 0, bd = 1e9; left.forEach((u, i) => { const d = Math.hypot(u.x - s.x, u.y - s.y); if (d < bd) { bd = d; bi = i; } });
    const u = left.splice(bi, 1)[0]; u.grp = units.length;
    if (queue && (u.path.length || (u.wq && u.wq.length))) { (u.wq = u.wq || []).push({ x: s.x, y: s.y, am: attackMove }); continue; }
    u.wq = []; u.order = attackMove ? 'amove' : 'move'; u.face = null; if (u.stance === 'hold') u.guard = { x: s.x, y: s.y }; u.tgt = null; u.anchor = { x: s.x, y: s.y };
    if (u.t === 'harv') { u.hst = 'manual'; const oi = idx(Math.floor(s.x), Math.floor(s.y)); if (G.ore[oi] > 0) { u.hst = 'idle'; u.prefOre = oi; } }
    setPath(u, s.x, s.y); }
}
function orderAttack(units, tgt) {
  for (const u of units) {
    if (u.kind !== 'u') continue;
    const d = UT[u.t];
    if (d.engineer) { u.order = 'capture'; u.tgt = tgt; setPath(u, tgt.x, tgt.y); continue; }
    if (!d.wpn || !canHit(W[d.wpn], tgt)) { orderMove([u], tgt.x, tgt.y, true); continue; }
    u.order = 'attack'; u.tgt = tgt; u.path = []; u.repathT = 0;
  }
}
function orderStop(units) { for (const u of units) if (u.kind === 'u') { u.path = []; u.order = 'idle'; u.tgt = null; u.anchor = { x: u.x, y: u.y }; if (u.t === 'harv') u.hst = 'idle'; } }
function canHit(w, e) { return !!w && e && e.hp > 0 && (isAir(e) ? !!w.air : !!w.ground) && (e.kind !== 'b' || e.t !== 'wall' || true); }
function distTo(a, e) {
  if (e.kind !== 'b') return Math.hypot(a.x - e.x, a.y - e.y);
  const cx = Math.max(e.tx, Math.min(a.x, e.tx + e.w)), cy = Math.max(e.ty, Math.min(a.y, e.ty + e.h));
  return Math.hypot(a.x - cx, a.y - cy);
}
function sellB(b) { if (b.kind === 'b' && b.sell < 0 && b.t !== 'hq' || (b.kind === 'b' && b.t === 'hq' && b.sell < 0 && G.ents.filter(e => e.team === b.team && e.t === 'hq').length > 1)) { b.sell = G.time; G.events.push({ e: 'sell', b }); } }
// ---------- main step ----------
function stepGame() {
  if (G.over) return;
  G.tick++; G.time += DT;
  if (G.tick % 15 === 1) for (const P of G.players) {
    let gen = 0, use = 0;
    for (const e of G.ents) if (e.kind === 'b' && e.team === P.team && e.sell < 0 && G.time - e.born > 1.5) { const p = BT[e.t].pow; if (p > 0) gen += p * (0.5 + 0.5 * e.hp / e.mhp); else use -= p; }
    P.gen = Math.round(gen); P.use = use; P.pow = P.gen - use;
  }
  for (const P of G.players) stepProduction(P);
  // spatial hash for separation
  const hash = new Map();
  for (const e of G.ents) if (e.kind === 'u') { const k = (Math.floor(e.x) << 8) | Math.floor(e.y) | (isAir(e) ? 1 << 20 : 0); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(e); }
  G.hash = hash;
  G.dens.fill(0);
  for (const e of G.ents) if (e.kind === 'u' && !e.path.length && !isAir(e)) { const i = idx(Math.floor(e.x), Math.floor(e.y)); if (G.dens[i] < 6) G.dens[i]++; }
  if (G.tick % 30 === 0) { for (let i = 0; i < G.ore.length; i++) if (G.oreMax[i] > 0 && G.ore[i] < G.oreMax[i]) { const was = G.ore[i]; G.ore[i] = Math.min(G.oreMax[i], G.ore[i] + ORE_REGROW * (was > 0 ? 1 : 0.5)); } G.oreVer++; }
  for (const e of G.ents) { if (e.hp <= 0) continue; if (e.kind === 'b') stepBuilding(e); else stepUnit(e); }
  separate(hash);
  stepProjs();
  // removal
  for (const e of G.ents) if (e.hp <= 0 && !e.dead) { e.dead = true; onDeath(e); }
  if (G.ents.some(e => e.dead)) { G.ents = G.ents.filter(e => !e.dead); G.bver++; }
  for (const P of G.players) if (P.ai && typeof aiStep === 'function') aiStep(P);
  if (G.tick % 6 === 0) updFog();
  const alive = t => G.ents.some(e => e.team === t && e.kind === 'b' && e.t === 'hq') ||
    G.ents.some(e => e.team === t && e.kind === 'b' && e.t !== 'wall' && e.t !== 'turret' && e.t !== 'aagun' && e.t !== 'power');
  if (!alive(0)) G.over = 'defeat'; else if (!alive(1)) G.over = 'victory';
}
function onDeath(e) {
  G.events.push({ e: 'die', ent: e });
  const P = G.players[e.team]; if (P) P.stats.lost++;
  if (e.lastHitBy != null && G.players[e.lastHitBy]) G.players[e.lastHitBy].stats.kills++;
}
function stepBuilding(b) {
  const d = BT[b.t], P = G.players[b.team];
  if (b.sell >= 0) { if (G.time - b.sell > 1.2) { P.cr += Math.floor(d.cost * 0.5 * b.hp / b.mhp); b.hp = 0; b.sold = true; } return; }
  if (b.repair && b.hp < b.mhp) { const dh = b.mhp * 0.04 * DT, c = d.cost * 0.4 * dh / b.mhp; if (P.cr >= c) { P.cr -= c; b.hp = Math.min(b.mhp, b.hp + dh); } }
  if (b.repair && b.hp >= b.mhp) b.repair = false;
  if (b.upT != null && G.time - b.upT >= b.upDur) { b.upT = null; if (b.upKind === 'def') { P.defUp = true; G.ents.forEach(e => { if (e.team === b.team && UPG[e.t]) { e.mhp = Math.round(BT[e.t].hp * DEF_RESEARCH.hp); e.hp = Math.min(e.mhp, e.hp * DEF_RESEARCH.hp); } }); } else b.lvl = (b.lvl || 1) + 1; G.events.push({ e: 'upgraded', b, team: b.team }); }
  if (!d.wpn || G.time - b.born < 1.5) return;
  if (P.pow < 0 && d.pow < 0) return; // offline
  const w = defW(b); combat(b, w, d.sight + (w.rng - W[d.wpn].rng), false);
}
function tscore(e, w, o, d) {
  const eff = DMG[w.type][armorOf(o)]; if (eff <= 0.05) return 1e9;
  let s = d * 0.6 - eff * 3;
  if (o.kind === 'b') s += o.t === 'wall' ? 8 : (BT[o.t].wpn ? 1 : 4);
  if (o.t === 'harv') s += 1;
  if (o.kind === 'u' && UT[o.t].wpn && canHit(W[UT[o.t].wpn], e)) s -= 1.5;
  if (o.kind === 'u' && UT[o.t].heal) s -= 1;
  if (o.tgt === e) s -= 2.5;                       // threats shooting me
  s -= (1 - o.hp / o.mhp) * 2.5;                    // finish wounded
  const inc = o.inc || 0; if (inc >= o.hp * 1.1) s += 6; else if (inc > 0) s -= 1; // focus fire, avoid overkill
  return s;
}
function acquire(e, w, range) {
  let best = null, bs = 1e9;
  for (const o of G.ents) {
    if (o.team === e.team || o.hp <= 0 || !canHit(w, o)) continue;
    const d = distTo(e, o); if (d > range) continue;
    if (e.team != null && G.visT && !visibleTo(e.team, o)) continue;
    const s = tscore(e, w, o, d); if (s < bs) { bs = s; best = o; }
  }
  e._bs = bs; return best;
}
// returns true if engaging (in range or chasing)
function combat(e, w, sight, mobile) {
  if (e.tgt && (e.tgt.hp <= 0 || e.tgt.dead || e.tgt.team === e.team)) e.tgt = null;
  if (e.cd > 0) e.cd -= DT;
  const forced = e.order === 'attack';
  if (!e.tgt && e.order !== 'move' && (G.tick + e.id) % 8 === 0) e.tgt = acquire(e, w, sight);
  else if (e.tgt && !forced && e.order !== 'move' && (G.tick + e.id) % 24 === 0) {
    const nb = acquire(e, w, mobile && e.stance !== 'hold' ? sight : w.rng + 0.5);
    if (nb && nb !== e.tgt && e._bs < tscore(e, w, e.tgt, distTo(e, e.tgt)) - 1.5) e.tgt = nb;
  }
  if (e.tgt && !forced && mobile && e.order !== 'move') {
    const dt = distTo(e.anchor, e.tgt); if (e.order === 'idle' && dt > (e.stance === 'hold' ? w.rng + 1.5 : sight + 3)) { e.tgt = null; }
  }
  if (!e.tgt) return false;
  const t = e.tgt, d = distTo(e, t), tr = t.kind === 'u' ? UT[t.t].r : 0;
  const want = Math.atan2(t.y - e.y, t.x - e.x);
  const jetRun = mobile && UT[e.t].jet && w.type === 'bomb';
  if (d <= w.rng + tr && (!w.minRng || d >= w.minRng)) {
    if (jetRun) { e.tang = e.ang; if (e.cd <= 0 && e.ammo > 0) { fire(e, w, t); e.passT = G.time + 1.4; setPath(e, t.x + Math.cos(e.ang) * 4, t.y + Math.sin(e.ang) * 4); } else if (!e.path.length) setPath(e, t.x, t.y); return true; }
    // kite: keep range advantage vs slower-ranged threats
    if (mobile && !forced && e.stance !== 'hold' && !UT[e.t].air && t.kind === 'u' && UT[t.t].wpn && e.cd > 0.3 && G.time > (e.kiteT || 0)) {
      const tw = W[UT[t.t].wpn]; if (w.rng > tw.rng + 1.2 && d < tw.rng + 0.6 && canHit(tw, e)) { const kx = e.x - Math.cos(want) * 1.6, ky = e.y - Math.sin(want) * 1.6; if (!blk(Math.floor(kx), Math.floor(ky))) { setPath(e, kx, ky); e.kiteT = G.time + 0.9; } }
    }
    if (mobile && G.time > (e.kiteT || 0)) e.path = [];
    e.tang = turnTo(e.tang, want, 5 * DT);
    if (mobile && !UT[e.t].turret) e.ang = e.tang;
    if (e.cd <= 0 && Math.abs(angDiff(e.tang, want)) < 0.25) fire(e, w, t);
    return true;
  }
  if (mobile) {
    if (w.minRng && d < w.minRng) { if (!e.path.length) setPath(e, e.x - Math.cos(want) * 3, e.y - Math.sin(want) * 3); return true; }
    e.repathT = (e.repathT || 0) - DT;
    if (jetRun && G.time < (e.passT || 0)) return true;
    if (!e.path.length || e.repathT <= 0) { setPath(e, t.x, t.y); e.repathT = 1 + G.R(); }
    return true;
  }
  e.tang = turnTo(e.tang, want, 3 * DT);
  return false;
}
function fire(e, w, t) {
  e.cd = w.cd * (0.9 + G.R() * 0.2);
  const z0 = e.kind === 'u' ? e.z : 0.8, tz = t.kind === 'u' ? t.z : 0.5;
  const shots = w.twin ? 2 : 1;
  if (w.ammo) e.ammo = (e.ammo == null ? w.ammo : e.ammo) - 1;
  const est = w.dmg * DMG[w.type][armorOf(t)] * shots; t.inc = (t.inc || 0) + est;
  for (let s = 0; s < shots; s++) {
    const spread = w.spread || (w.type === 'shell' ? 0.8 : 0);
    G.projs.push({ id: G.nid++, x: e.x, y: e.y, z: z0 + 0.4, sx: e.x, sy: e.y, w, team: e.team, tgt: t, src: e, est: est / shots, home: w.type !== 'shell' && w.type !== 'bomb',
      tx: t.x + (G.R() - 0.5) * spread, ty: t.y + (G.R() - 0.5) * spread, tz, delay: s * 0.12, kind: w.type });
  }
  G.events.push({ e: 'fire', src: e, w });
}
function stepProjs() {
  for (const p of G.projs) {
    if (p.delay > 0) { p.delay -= DT; continue; }
    if (p.home && p.tgt && p.tgt.hp > 0) { p.tx = p.tgt.x; p.ty = p.tgt.y; p.tz = p.tgt.kind === 'u' ? p.tgt.z : 0.5; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), st = p.w.spd * DT;
    if (d <= st) { p.x = p.tx; p.y = p.ty; p.done = true; impact(p); continue; }
    p.x += dx / d * st; p.y += dy / d * st;
    if (p.w.arc) { const tot = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, f = 1 - d / tot; p.z = 0.8 + Math.sin(f * Math.PI) * tot * 0.35; }
    else p.z += (p.tz - p.z) * Math.min(1, st / Math.max(d, 0.01));
  }
  G.projs = G.projs.filter(p => !p.done);
}
function respond(u, src) {
  if (!src || src.hp <= 0 || u.kind !== 'u' || u.hp <= 0 || u.order === 'move' || u.order === 'attack' || u.order === 'capture') return;
  const d = UT[u.t]; if (!d.wpn || (u.tgt && u.tgt.hp > 0 && u.tgt.tgt === u)) return;
  const w = W[d.wpn]; if (!canHit(w, src) || DMG[w.type][armorOf(src)] <= 0.05) return;
  const dist = distTo(u, src); if (u.stance === 'hold' ? dist > w.rng + 0.5 : dist > d.sight + 6) return;
  if (!u.tgt || u.tgt.hp <= 0 || distTo(u, u.tgt) > w.rng) u.tgt = src;
}
function damage(t, amt, w, team, src) {
  if (src && t.team !== team && t.kind === 'u') { respond(t, src); if (G.time - (t.helpT || 0) > 1) { t.helpT = G.time; for (const o of G.ents) if (o.team === t.team && o.kind === 'u' && o !== t && !o.tgt && Math.hypot(o.x - t.x, o.y - t.y) < 5) respond(o, src); } }
  if (t.hp <= 0) return;
  t.hp -= amt * DMG[w.type][armorOf(t)];
  t.lastHitBy = team; t.hitT = G.time;
  const TP = G.players[t.team]; if (TP && G.time - (TP.alertT || -99) > 12) { TP.alertT = G.time; G.events.push({ e: 'attacked', team: t.team, x: t.x, y: t.y, harv: t.t === 'harv' }); }
  if (t.kind === 'u' && t.order === 'idle' && !t.tgt && t.team !== team) t.underFire = G.time;
}
function impact(p) {
  const w = p.w; if (p.tgt) p.tgt.inc = Math.max(0, (p.tgt.inc || 0) - (p.est || 0));
  if (w.splash) {
    for (const o of G.ents) { if (o.team === p.team) continue; if (isAir(o) !== (p.tz > 1.5)) continue;
      const d = distTo(p, o); if (d < w.splash) damage(o, w.dmg * (1 - 0.6 * d / w.splash), w, p.team, p.src); }
  } else if (p.tgt && p.tgt.hp > 0 && distTo(p, p.tgt) < 1.2) damage(p.tgt, w.dmg, w, p.team, p.src);
  G.events.push({ e: 'hit', x: p.x, y: p.y, z: p.z, kind: w.type });
}
function turnTo(a, b, rate) { const d = angDiff(a, b); return Math.abs(d) <= rate ? b : a + Math.sign(d) * rate; }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function stepUnit(u) {
  const d = UT[u.t];
  if (u.t === 'harv') harvest(u);
  if (d.engineer && u.order === 'capture') {
    const t = u.tgt; if (!t || t.hp <= 0) { u.order = 'idle'; u.tgt = null; }
    else if (distTo(u, t) < 0.8) {
      if (t.team === u.team) { t.hp = t.mhp; } else { G.events.push({ e: 'capture', b: t, team: u.team }); t.team = u.team; t.tgt = null; G.bver++; }
      u.hp = 0; u.sold = true; return;
    } else if (!u.path.length) setPath(u, t.x, t.y);
  }
  if (d.heal) medic(u, d);
  if (d.jet && jetStep(u, d)) return;
  let engaged = false;
  if (d.wpn && !(d.jet && u.ammo <= 0)) engaged = combat(u, W[d.wpn], Math.max(d.sight, W[d.wpn].rng + 0.5), true);
  if (!engaged && u.order === 'attack') { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; }
  if (u.stance === 'hold' && u.guard && u.order === 'idle') u.anchor = u.guard;
  if (!engaged && u.order === 'idle' && !u.path.length && Math.hypot(u.x - u.anchor.x, u.y - u.anchor.y) > (u.stance === 'hold' ? 0.5 : 2.5) && u.t !== 'harv') setPath(u, u.anchor.x, u.anchor.y);
  if (!engaged && u.order === 'idle' && !u.path.length && u.face != null && u.stance === 'hold') { u.ang = turnTo(u.ang, u.face, 2 * DT); u.tang = turnTo(u.tang, u.face, 2 * DT); }
  if (!engaged && u.order === 'amove' && !u.path.length && u.dest && Math.hypot(u.x - u.dest.x, u.y - u.dest.y) > 1.5) setPath(u, u.dest.x, u.dest.y);
  // movement
  if (u.path.length) {
    const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, dist = Math.hypot(dx, dy);
    const last = u.path.length === 1;
    const crowdArrive = last && u.grp > 1 && dist < 0.6 + 0.35 * Math.sqrt(u.grp) && u.blockedT > 0.6;
    if (dist < (last ? 0.12 : 0.4) || crowdArrive) { u.path.shift(); if (crowdArrive) u.path = [];
      if (!u.path.length && u.wq && u.wq.length) { const w = u.wq.shift(); u.order = w.am ? 'amove' : 'move'; u.anchor = { x: w.x, y: w.y }; setPath(u, w.x, w.y); }
      else if (!u.path.length && (u.order === 'move' || u.order === 'amove')) { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; } }
    else {
      const want = Math.atan2(dy, dx);
      const veh = d.armor !== 'inf';
      u.ang = turnTo(u.ang, want, (veh ? 4 : 10) * DT);
      const f = veh ? Math.max(0, Math.cos(angDiff(u.ang, want))) : 1;
      const sp = Math.min(dist, d.sp * DT * f * (d.armor === 'inf' && u.underFire && G.time - u.underFire < 2 ? 1.2 : 1));
      const nx = u.x + Math.cos(u.ang) * sp, ny = u.y + Math.sin(u.ang) * sp;
      const ox = u.x, oy = u.y;
      if (d.air || !blk(nx, ny)) { u.x = nx; u.y = ny; }
      else if (!blk(nx, u.y)) u.x = nx; else if (!blk(u.x, ny)) u.y = ny;
      if (!UT[u.t].turret && !u.tgt) u.tang = u.ang;
      u.prevP = { x: ox, y: oy };
    }
    if (u.prevP) { const prog = Math.hypot(u.x - u.prevP.x, u.y - u.prevP.y); u.blockedT = prog < d.sp * DT * 0.25 ? (u.blockedT || 0) + DT : 0; }
    u.moveT += DT;
    if (u.moveT > 2) { // stuck detection
      if (Math.hypot(u.x - u.lastP.x, u.y - u.lastP.y) < 0.3 && u.dest) { const dd = u.dest; u.stuckN = (u.stuckN || 0) + 1; if (u.stuckN > 3 && Math.hypot(u.x - dd.x, u.y - dd.y) < 3) { u.path = []; u.stuckN = 0; } else setPath(u, dd.x + (G.R() - 0.5) * u.stuckN, dd.y + (G.R() - 0.5) * u.stuckN); } else u.stuckN = 0;
      u.moveT = 0; u.lastP = { x: u.x, y: u.y };
    }
  } else if (UT[u.t].turret && !u.tgt) u.tang = turnTo(u.tang, u.ang, 2 * DT);
  if (d.jet) u.z += ((u.js === 'landed' ? 0.32 : 3.4) - u.z) * 0.05;
  else if (d.air) u.z = 2.6 + Math.sin(G.time * 2 + u.id) * 0.1;
}
function airBase(u) { let b = null, bd = 1e9; for (const e of G.ents) if (e.team === u.team && e.kind === 'b' && (e.t === 'airfield' || e.t === 'airpad') && e.sell < 0) { const d = Math.hypot(e.x - u.x, e.y - u.y) + (e.t === 'airfield' ? 0 : 6); if (d < bd) { bd = d; b = e; } } return b || G.ents.find(e => e.team === u.team && e.t === 'hq'); }
function jetStep(u, d) {
  const w = W[d.wpn]; if (u.ammo == null) u.ammo = w.ammo;
  if (u.js === 'rtb' || (u.ammo <= 0 && u.js !== 'landed')) {
    const b = airBase(u); if (!b) return false;
    const px = b.x + ((u.id % 3) - 1) * 0.8, py = b.y + 0.3;
    if (u.js !== 'rtb') { u.js = 'rtb'; u.tgt = null; u.order = 'rtb'; u.wq = []; setPath(u, px, py); }
    if (Math.hypot(u.x - px, u.y - py) < 0.4) { u.js = 'landed'; u.path = []; u.order = 'idle'; u.reloadT = 0; u.anchor = { x: u.x, y: u.y }; }
    else if (!u.path.length) setPath(u, px, py);
    return false;
  }
  if (u.js === 'landed') {
    if (u.ammo < w.ammo) { u.reloadT = (u.reloadT || 0) + DT; if (u.reloadT > 2.5) { u.ammo++; u.reloadT = 0; } }
    if (u.path.length || u.order === 'attack' || u.order === 'amove') u.js = 'fly'; else { u.ang = turnTo(u.ang, -Math.PI / 2, DT); return u.ammo < w.ammo; }
  }
  u.js = 'fly';
  if (u.order === 'idle' && !u.tgt && !u.path.length && (G.tick + u.id) % 60 === 0) { const b = airBase(u); if (b && Math.hypot(b.x - u.x, b.y - u.y) > 2.5) u.js = 'rtb'; else if (b) { u.js = 'rtb'; } }
  return false;
}
function medic(u, d) {
  if ((G.tick + u.id) % 15 === 0) { let best = null, bs = 0; for (const o of G.ents) if (o.team === u.team && o.kind === 'u' && UT[o.t].armor === 'inf' && o.hp < o.mhp && o.hp > 0) { const dd = Math.hypot(o.x - u.x, o.y - u.y); if (dd < 7) { const sc = (1 - o.hp / o.mhp) * 10 - dd; if (!best || sc > bs) { bs = sc; best = o; } } } u.healT = best; }
  const o = u.healT; if (!o || o.hp <= 0 || o.hp >= o.mhp) { u.healT = null; return; }
  const dd = Math.hypot(o.x - u.x, o.y - u.y);
  if (dd > 1.6) { if ((u.order === 'idle' || u.order === 'amove') && (!u.path.length || (G.tick + u.id) % 20 === 0)) setPath(u, o.x, o.y); }
  else { if (u.order === 'idle') u.path = []; o.hp = Math.min(o.mhp, o.hp + d.heal * DT); if ((G.tick + u.id) % 15 === 0) G.events.push({ e: 'heal', x: o.x, y: o.y, src: u }); }
}
function separate(hash) {
  for (const a of G.ents) {
    if (a.kind !== 'u' || a.hp <= 0) continue;
    const air = isAir(a), ra = UT[a.t].r, cx = Math.floor(a.x), cy = Math.floor(a.y);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const l = hash.get((gx << 8) | gy | (air ? 1 << 20 : 0)); if (!l) continue;
      for (const b of l) {
        if (b === a || b.id < a.id) continue;
        let dx = a.x - b.x, dy = a.y - b.y, dd = Math.hypot(dx, dy); const min = ra + UT[b.t].r;
        if (dd >= min) continue;
        if (dd < 1e-4) { dx = G.R() - 0.5; dy = G.R() - 0.5; dd = Math.hypot(dx, dy); }
        const soft = a.t === 'harv' && b.t === 'harv' ? 0.4 : 1, ov = (min - dd) * 0.5 * soft, am = a.path.length ? 0.3 : 1, bm = b.path.length ? 0.3 : 1, tot = am + bm;
        const pa = ov * am / tot * 2 * 0.5, pb = ov * bm / tot * 2 * 0.5;
        const ax = a.x + dx / dd * pa, ay = a.y + dy / dd * pa, bx = b.x - dx / dd * pb, by = b.y - dy / dd * pb;
        if (air || !blk(ax, ay)) { a.x = ax; a.y = ay; }
        if (air || !blk(bx, by)) { b.x = bx; b.y = by; }
      }
    }
    if (!air && blk(a.x, a.y)) { const f = nearFree(Math.floor(a.x), Math.floor(a.y), 4); a.x += (f[0] + 0.5 - a.x) * 0.2; a.y += (f[1] + 0.5 - a.y) * 0.2; }
    a.x = Math.max(0.2, Math.min(MW - 0.2, a.x)); a.y = Math.max(0.2, Math.min(MH - 0.2, a.y));
  }
}
// ---------- harvester ----------
function oreScore(u, i, refs) {
  const x = i % MW + 0.5, y = ((i / MW) | 0) + 0.5;
  let d = Math.hypot(x - u.x, y - u.y) * 0.6;
  let rd = 1e9; for (const r of refs) rd = Math.min(rd, Math.hypot(x - r.x, y - r.y)); d += Math.min(rd, 60) * 0.9;
  for (const o of G.ents) if (o !== u && o.t === 'harv' && o.team === u.team && o.oreT != null) {
    if (o.oreT === i) return 1e9; // reserved
    const ox = o.oreT % MW + 0.5, oy = ((o.oreT / MW) | 0) + 0.5; const dd = Math.hypot(ox - x, oy - y); if (dd < 3) d += (3 - dd) * 2.5; // spread across patches
  }
  if (G.danger && G.danger[u.team] && G.danger[u.team].some(p => Math.hypot(p.x - x, p.y - y) < 6)) d += 40;
  if (G.ore[i] < 200) d += 6;
  return d;
}
function nearestOre(u, pref) {
  const refs = G.ents.filter(e => e.team === u.team && e.t === 'refinery');
  if (pref != null && G.ore[pref] > 0 && oreScore(u, pref, refs) < 1e9) return pref;
  let b = -1, bd = 1e9;
  for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 30) { const d = oreScore(u, i, refs); if (d < bd) { bd = d; b = i; } }
  return b;
}
function harvest(h) {
  const P = G.players[h.team], CAP = HARV_CAP;
  switch (h.hst) {
    case 'manual': if (!h.path.length) h.hst = h.load >= CAP ? 'ret' : 'idle'; break;
    case 'idle': {
      h.oreT = null;
      if (h.load >= CAP) { h.hst = 'ret'; break; }
      if ((G.tick + h.id) % 10) break;
      const i = nearestOre(h, h.prefOre); h.prefOre = null; if (i < 0) { if (h.load > 0) h.hst = 'ret'; break; }
      h.oreT = i; h.toT = G.time; setPath(h, i % MW + 0.5, ((i / MW) | 0) + 0.5); h.order = 'idle'; h.hst = 'toOre'; break;
    }
    case 'toOre': {
      if (h.oreT == null || G.ore[h.oreT] <= 0) { h.hst = 'idle'; break; }
      const tx = h.oreT % MW + 0.5, ty = ((h.oreT / MW) | 0) + 0.5;
      if (Math.hypot(h.x - tx, h.y - ty) < 1.1) { h.path = []; h.hst = 'mine'; h.ang = turnTo(h.ang, Math.atan2(ty - h.y, tx - h.x), 1); break; }
      if (G.time - h.toT > 15) { h.hst = 'idle'; break; }
      if (!h.path.length) setPath(h, tx, ty);
      break;
    }
    case 'mine': {
      const i = h.oreT;
      if (i == null) { h.hst = 'idle'; break; }
      if (G.ore[i] > 0) { const a = Math.min(G.ore[i], MINE_RATE * DT, CAP - h.load); G.ore[i] -= a; h.load += a; if (G.ore[i] <= 0) { G.ore[i] = 0; G.oreVer++; } }
      if (h.load >= CAP - 0.01) { h.hst = 'ret'; h.oreT = null; break; }
      if (G.ore[i] <= 0) { // next patch nearby (unreserved)
        const x = i % MW, y = (i / MW) | 0, refs = G.ents.filter(e => e.team === h.team && e.t === 'refinery'); let n = -1, bs = 1e9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = idx(x + dx, y + dy); if (inb(x + dx, y + dy) && G.ore[j] > 30) { const sc = oreScore(h, j, refs); if (sc < bs) { bs = sc; n = j; } } }
        if (n >= 0) { h.oreT = n; h.toT = G.time; h.hst = 'toOre'; setPath(h, n % MW + 0.5, ((n / MW) | 0) + 0.5); } else { h.hst = h.load > CAP * 0.3 ? 'ret' : 'idle'; h.oreT = null; }
      }
      break;
    }
    case 'ret': {
      let r = null, bd = 1e9; for (const e of G.ents) if (e.team === h.team && e.t === 'refinery' && e.sell < 0) { const busy = e.dockBy && e.dockBy !== h.id && byId(e.dockBy) ? 8 : 0; const d = Math.hypot(e.x - h.x, e.y - h.y) + busy; if (d < bd) { bd = d; r = e; } }
      if (!r) break;
      const dock = { x: r.x, y: r.ty + r.h + 0.5 };
      const free = !r.dockBy || r.dockBy === h.id || !byId(r.dockBy) || byId(r.dockBy).hst !== 'unload' && byId(r.dockBy).dockR !== r.id;
      const dd = Math.hypot(h.x - dock.x, h.y - dock.y);
      if (free) { r.dockBy = h.id; h.dockR = r.id; }
      if (free && dd < 0.9) { h.hst = 'unload'; h.path = []; h.ang = -Math.PI / 2; }
      else if (!free && dd < 3) { h.path = []; } // wait in line
      else if (!h.path.length || G.tick % 45 === h.id % 45) setPath(h, free ? dock.x : dock.x + 2.5, free ? dock.y : dock.y + 1.5);
      break;
    }
    case 'unload': {
      const a = Math.min(h.load, UNLOAD_RATE * DT); h.load -= a;
      const mult = (P.ai ? DIFF[P.diff].income : 1) * ORE_VALUE; P.cr += a * mult; P.stats.mined += a * mult;
      if (h.load <= 0) { h.load = 0; h.hst = 'idle'; const r = byId(h.dockR); if (r && r.dockBy === h.id) r.dockBy = null; h.dockR = null; h.path = []; setPath(h, h.x, h.y + 1.5); }
      break;
    }
  }
}
// ---------- fog (per team) ----------
function updFog() {
  for (let t = 0; t < 2; t++) {
    const v = G.visT[t], sn = G.seenT[t]; v.fill(0);
    for (const e of G.ents) {
      if (e.team !== t) continue;
      const r = e.kind === 'b' ? (BT[e.t].sight || 5) + e.w / 2 : UT[e.t].sight, cx = e.x, cy = e.y, r2 = r * r;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MH - 1, cy + r); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MW - 1, cx + r); x++)
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) { v[idx(x, y)] = 1; sn[idx(x, y)] = 1; }
    }
    if (!G.opts.fog && t === 0) { v.fill(1); sn.fill(1); }
  }
}
function visibleTo(team, e) {
  if (e.team === team) return true;
  const V = G.visT[team], S = G.seenT[team];
  if (e.kind === 'b') { for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) if (S[idx(x, y)]) return true; return false; }
  return !!V[idx(Math.floor(e.x), Math.floor(e.y))];
}
function visibleTo0(e) { return visibleTo(0, e); }
// ---------- defense upgrades ----------
const _defWC = {};
function defW(b) { const d = BT[b.t], P = G.players[b.team], l = b.lvl || 1, k = d.wpn + l + (P.defUp ? 'd' : '');
  if (!_defWC[k]) { const base = W[d.wpn]; _defWC[k] = Object.assign({}, base, { dmg: Math.round(base.dmg * UPG_DMG[l - 1] * (P.defUp ? DEF_RESEARCH.dmg : 1)), rng: base.rng + UPG_RNG[l - 1] + (P.defUp ? DEF_RESEARCH.rng : 0) }); }
  return _defWC[k]; }
function upgradeInfo(b) {
  if (b.t === 'tech') { const P = G.players[b.team]; if (P.defUp || b.upT != null) return null; return { cost: DEF_RESEARCH.cost, time: DEF_RESEARCH.time, kind: 'def' }; }
  const u = UPG[b.t]; if (!u) return null; const l = b.lvl || 1; if (l >= 3) return null; return { cost: u[l - 1][0], time: u[l - 1][1], kind: 'lvl', next: l + 1 };
}
function upgradeB(b) {
  if (b.upT != null || b.sell >= 0 || G.time - b.born < 1.5) return false; const P = G.players[b.team], inf = upgradeInfo(b); if (!inf || P.cr < inf.cost) return false;
  if (inf.kind === 'def' && G.ents.some(e => e.team === b.team && e.upKind === 'def' && e.upT != null)) return false;
  P.cr -= inf.cost; b.upT = G.time; b.upDur = inf.time; b.upKind = inf.kind; return true;
}
// ---------- formations & stances ----------
const ROWOF = t => { const d = UT[t]; if (t === 'arty' || t === 'aa') return 2; if (d.armor === 'inf') return 1; if (d.air) return 1; return 0; };
function formationSlots(units, cx, cy, face) {
  const rows = [[], [], []]; for (const u of units) rows[ROWOF(u.t)].push(u);
  const fx = Math.cos(face), fy = Math.sin(face), px = -fy, py = fx, out = [];
  let depth = 0.0;
  rows.forEach((row, ri) => { if (!row.length) return; const sp = ri === 1 ? 0.8 : 1.25, perLine = Math.max(3, Math.ceil(Math.sqrt(row.length * 3)));
    // sort by lateral position to reduce crossing
    row.sort((a, b) => ((a.x - cx) * px + (a.y - cy) * py) - ((b.x - cx) * px + (b.y - cy) * py));
    row.forEach((u, i) => { const line = Math.floor(i / perLine), inLine = Math.min(perLine, row.length - line * perLine), k = i % perLine - (inLine - 1) / 2;
      const back = depth + line * sp; let x = cx + px * k * sp - fx * back, y = cy + py * k * sp - fy * back;
      if (blk(Math.floor(x), Math.floor(y))) { const f = nearFree(Math.floor(x), Math.floor(y), 4); x = f[0] + 0.5; y = f[1] + 0.5; }
      out.push({ u, x, y }); });
    depth += Math.ceil(row.length / perLine) * sp + 0.6; });
  return out;
}
function orderFormation(units, cx, cy, face) {
  units = units.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv'); if (!units.length) return 0;
  for (const s of formationSlots(units, cx, cy, face)) { const u = s.u; u.wq = []; u.tgt = null; u.order = 'move'; u.grp = 1; setPath(u, s.x, s.y); u.anchor = { x: s.x, y: s.y }; u.guard = { x: s.x, y: s.y }; u.face = face; u.stance = 'hold'; }
  return units.length;
}
function setStance(units, st) { for (const u of units) if (u.kind === 'u') { u.stance = st; if (st === 'hold') { u.guard = { x: u.x, y: u.y }; u.anchor = { x: u.x, y: u.y }; } else u.guard = null; } }
