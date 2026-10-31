'use strict';
// ===== Simulation (no DOM; runs in node for tests) =====
let G = null;
function mkRng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const idx = (x, y) => y * MW + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const isAir = e => e.kind === 'u' && !!UT[e.t].air;
const defOf = e => e.kind === 'b' ? BT[e.t] : UT[e.t];
const armorOf = e => e.kind === 'b' ? 'bldg' : UT[e.t].armor;

// players = slots. Each player has .ally (alliance id); entities' .team = player index.
function foe(a, b) { if (a === b) return false; if (a == null || b == null) return true; const A = G.players[a], B = G.players[b]; return !A || !B || A.ally !== B.ally; }
// v7.5.1 lobby seats: lobby row N (1-based) spawns at the map spot labelled N in the preview. SEAT_ORDER maps spot number -> G.starts index
// (the 4-corner/6-base maps keep their tuned diagonal 1v1: spot 1 NW, spot 2 SE; odd spots = west side, even spots = east side).
// Hellgate is the one team-sided map: spots 1-2 are Team A's valley seats, 3-8 the Team B warlord bases. A row whose spot is on the other
// team's side (or whose spot does not exist on the map) takes the lowest free spot on its own side instead; the lobby shows "N→M" for it.
// Endless: defenders sit at spots 1-4 by row (solo = the centre base), the Horde is east. Pure + deterministic (host computes it, peers get the result).
const SEAT_ORDER = { classic: [0, 3, 2, 1, 4, 5], frost: [0, 3, 2, 1, 4, 5], volcano: [0, 3, 2, 1, 4, 5], volcano8: [0, 3, 2, 1, 4, 5, 6, 7], hellgate: [0, 1, 2, 3, 4, 5, 6, 7], endless: [0, 1, 2, 3] };
function seatMap(map, n) { return map !== 'hellgate' && map !== 'endless' && n > 6 ? 'volcano8' : SEAT_ORDER[map] ? map : 'classic'; }
function seatSide(map, k) { return map === 'hellgate' ? (k < 2 ? 0 : 1) : null; } // start index -> required ally (null = any team may sit there)
function seatPlan(map, rows) { // rows: [{ row, ally }] (active lobby rows, in order) -> start index per row
  map = seatMap(map, rows.length); const order = SEAT_ORDER[map], taken = new Set(), out = rows.map(() => null);
  if (map === 'endless') { if (rows.length === 1) return [4]; }
  rows.forEach((r, i) => { const k = order[r.row]; if (k == null || taken.has(k)) return; const sd = seatSide(map, k); if (sd != null && sd !== (r.ally ? 1 : 0)) return; out[i] = k; taken.add(k); });
  rows.forEach((r, i) => { if (out[i] != null) return; const a = r.ally ? 1 : 0, pref = map === 'endless' ? order : map === 'hellgate' ? (a ? [2, 3, 4, 5, 6, 7, 0, 1] : [0, 1, 2, 3, 4, 5, 6, 7]) : order.filter((k, n) => n % 2 === a).concat(order.filter((k, n) => n % 2 !== a));
    out[i] = pref.find(k => !taken.has(k)); taken.add(out[i]); });
  return out;
}
const seatLabel = (map, n, k) => SEAT_ORDER[seatMap(map, n)].indexOf(k) + 1; // G.starts index -> spot number shown in the preview
function newGame(opts) {
  opts = Object.assign({ seed: (Math.random() * 1e9) | 0, diff: 'normal', aiTeams: [1], fog: true }, opts || {});
  const R = mkRng(opts.seed);
  if ((opts.mode === 'endless' || opts.map === 'endless') && typeof endlessSlots === 'function') { opts.map = 'endless'; opts.mode = 'endless'; if (!(opts.slots || []).some(s => s.horde)) opts.slots = endlessSlots(opts.slots); } // v7.0 Endless: defenders (ally 0) + the Horde (ally 1)
  // slots: [{ ai, diff, ally, fac, start }]; default 1v1 from legacy opts
  const slots = opts.slots || [0, 1].map(t => ({ ai: opts.aiTeams.includes(t), diff: t === 0 && opts.p0diff ? opts.p0diff : opts.diff, ally: t, fac: (opts.facs || [])[t], start: t ? 3 : 0 }));
  const HG = opts.map === 'hellgate', EN = opts.map === 'endless'; MW = MH = HG ? 128 : EN ? 96 : (opts.map === 'volcano8' || slots.length > 6) ? 112 : 96; if (slots.length > 6 && !HG) opts.map = 'volcano8';
  const NP = slots.length;
  // every player gets its own start corner (guards against duplicate/missing starts from any lobby path)
  if (EN) { /* endlessSlots() already seated everyone */ }
  else if (HG && slots.length && slots.every(sl => sl.seat) && new Set(slots.map(sl => sl.start)).size === slots.length && slots.every(sl => sl.start >= 0 && sl.start < 8)) { /* v7.5.1: lobby seats (seatPlan) are kept as-is */ }
  else if (HG) { const pool = { 0: [0, 1, 2, 3, 4, 5, 6, 7], 1: [2, 3, 4, 5, 6, 7, 0, 1] }, taken = new Set(); slots.forEach(sl => { sl.start = (pool[sl.ally ? 1 : 0]).find(k => !taken.has(k)); taken.add(sl.start); }); } // v6.0: Team A takes the valley seats 1-2, Team B the six warlord bases
  else { const taken = new Set(); slots.forEach(sl => { if (sl.start == null || sl.start < 0 || sl.start > 7 || taken.has(sl.start)) sl.start = null; else taken.add(sl.start); });
    slots.forEach(sl => { if (sl.start == null) { sl.start = (slots.length > 6 ? (sl.ally ? [3, 1, 5, 7, 2, 0, 4, 6] : [0, 2, 4, 6, 1, 3, 5, 7]) : (sl.ally ? [3, 1, 5, 2, 0, 4] : [0, 2, 4, 1, 3, 5])).find(k => !taken.has(k)); taken.add(sl.start); } }); }
  G = { R, opts, r76: opts.r76 !== 0, nt: opts.nt !== 0, m7: opts.m7 === 0 || opts.nt === 0 ? 0 : opts.m7 == null ? 2 : opts.m7 | 0, /* level: 1 = v7.6.6 m7 a-d, 2 = + m7e (v7.6.7) */ tick: 0, time: 0, ents: [], projs: [], events: [], nid: 1, over: null, bver: 1, blockVer: 0, block: null,
    map: new Uint8Array(MW * MH), ore: new Float32Array(MW * MH), elev: new Float32Array(MW * MH), rich: new Uint8Array(MW * MH), bridge: new Uint8Array(MW * MH), forest: new Uint8Array(MW * MH), lvl: new Float32Array(MW * MH), tier: new Uint8Array(MW * MH), lava: new Uint8Array(MW * MH), ice: new Uint8Array(MW * MH),
    visT: [], seenT: [], oreVer: 0, players: [], hist: [] };
  G.dens = new Uint8Array(MW * MH);
  genMap(R);
  // shared vision per alliance
  const allyArr = {}; for (let t = 0; t < NP; t++) { const al = slots[t].ally; if (!allyArr[al]) allyArr[al] = [new Uint8Array(MW * MH), new Uint8Array(MW * MH)]; G.visT[t] = allyArr[al][0]; G.seenT[t] = allyArr[al][1]; }
  G.vis = G.visT[0]; G.seen = G.seenT[0];
  // colours by alliance order
  // colours: each slot's chosen colour (unique), defaults blue/green for team A, red/yellow for team B
  { const used = new Set(slots.map(sl => sl.color).filter(Boolean)), def = { 0: ['blue', 'green', 'purple', 'teal', 'yellow', 'red', 'orange', 'white'], 1: ['red', 'yellow', 'orange', 'white', 'green', 'blue', 'purple', 'teal'] };
    slots.forEach((sl, t) => { let c = sl.color; if (!c || !TEAM_COLORS[c]) { c = (def[sl.ally] || def[0]).find(k => !used.has(k)) || 'blue'; used.add(c); } sl.color = c; const C = TEAM_COLORS[c]; TEAMPAINT[t] = C.paint; TEAMCOL[t] = C.acc; MMCOL[t] = C.css; }); }
  if (typeof MODEL_CACHE !== 'undefined') for (const k in MODEL_CACHE) delete MODEL_CACHE[k];
  for (let t = 0; t < NP; t++) { const sl = slots[t]; G.players.push({ team: t, color: sl.color, name: sl.name || (sl.ai ? sl.diff : 'Player ' + (t + 1)), ally: sl.ally, start: sl.start, cr: 5000, pow: 0, gen: 0, use: 0, ai: !!sl.ai, diff: sl.diff || opts.diff,
    gas: 150, fac: sl.fac || FAC_KEYS[(R() * FAC_KEYS.length) | 0], queues: { bld: [], def: [], inf: [], veh: [], air: [] }, ready: { bld: null, def: null }, stats: { kills: 0, lost: 0, mined: 0, built: 0 }, out: false, horde: !!sl.horde }); }
  G.players.forEach((P, t) => { if (P.horde) return;
    const [sx, sy] = G.starts[P.start], x = Math.round(sx - 1.5), y = Math.round(sy - 1.5), dx = sx < MW / 2 ? 1 : -1, dy = sy < MH / 2 ? 1 : -1;
    addB('hq', t, x, y, true);
    addU('harv', t, sx + dx * 3, sy + dy * 3);
    for (let i = 0; i < 3; i++) addU('rifle', t, sx + dx * (3 + i * 0.6), sy + dy * 4.2);
    addU('heavy', t, sx + dx * 4.5, sy + dy * 1.5);
  });
  // v5.0 capturable oil derricks (neutral map features): an Engineer captures one; owner gets a trickle of credits
  G.derricks = []; for (const [x, y] of G.dkPos ? [] : G.six ? [[25, 25], [40, 21], [24, 47]] : [[25, 25], [40, 21]]) for (const [a, b] of [[x, y], [MW - 1 - x, y], [x, MH - 1 - y], [MW - 1 - x, MH - 1 - y]]) { const f = nearFree(a, b, 6); if (!G.derricks.some(d => dhypot(d.x - f[0] - 0.5, d.y - f[1] - 0.5) < 3)) G.derricks.push({ id: G.derricks.length, x: f[0] + 0.5, y: f[1] + 0.5, owner: -1 }); }
  if (G.dkPos) for (const [x, y, op] of G.dkPos) { const f = nearFree(x, y, 6); if (!G.derricks.some(d => dhypot(d.x - f[0] - 0.5, d.y - f[1] - 0.5) < 3)) G.derricks.push(op ? { id: G.derricks.length, x: f[0] + 0.5, y: f[1] + 0.5, owner: -1, op: 1, name: op } : { id: G.derricks.length, x: f[0] + 0.5, y: f[1] + 0.5, owner: -1 }); }
  if (HG) { const tb = G.players.filter(P => P.ally === 1 && P.ai), n = tb.length; tb.forEach((P, k) => { P.stagger = Math.round((k * 7 % n) * 50); }); } // v6.0: 0..250 s staggered aggression for the six warlords
  if (typeof aiInit === 'function') G.players.forEach(p => p.ai && !p.horde && aiInit(p));
  if (EN && typeof endlessInit === 'function') endlessInit();
  if (HG) G.players.forEach((P, k) => { if (P.aiS) P.aiS.next = k * 0.067; }); // v6.0: phase-shift bot think ticks so 6-8 bots never all re-plan (and re-path) on the same tick
  updFog();
  return G;
}
// 96x96 four-fold mirrored map: mains in corners (cliff ring + 2 ramps), two naturals each,
// contested mid bases with rich (gold) fields, central monument, river with 4 bridges, forests.
function genMap(R) {
  G.mapName = G.opts.map || 'classic'; G.v8 = G.mapName === 'volcano8'; if (G.v8) G.mapName = 'volcano'; if (G.mapName === 'volcano' || G.mapName === 'frost') return genCustom(R); if (G.mapName === 'hellgate') return genHellgate(R); if (G.mapName === 'endless') return genEndless(R);
  const N = MW * MH, Q = MW / 2, gs = 8, gw = MW / gs + 2;
  const mk = () => { const a = []; for (let i = 0; i < gw * gw; i++) a.push(R()); return a; };
  const g1 = mk(), g2 = mk(), g3 = mk();
  const sm = t => t * t * (3 - 2 * t);
  const vn = (g, x, y, s) => { x /= s; y /= s; const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const w = Math.ceil(MW / s) + 2, v = (a, b) => g[(b * w + a) % g.length];
    return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy; };
  const mir = (x, y) => [[x, y], [MW - 1 - x, y], [x, MH - 1 - y], [MW - 1 - x, MH - 1 - y]];
  const setQ = (x, y, f) => { if (x < 0 || y < 0 || x >= Q || y >= Q) return; for (const [a, b] of mir(x, y)) f(idx(a, b)); };
  for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) {
    const n = vn(g1, x, y, 8) * 0.7 + vn(g2, x, y, 4) * 0.3, fo = vn(g3, x, y, 6);
    let t = 0; if (n > 0.7) t = 1; else if (n < 0.22) t = 2;
    setQ(x, y, i => { G.map[i] = t; G.elev[i] = n; G.forest[i] = fo > 0.62 && t === 0 ? 1 : 0; });
  }
  const disc = (cx, cy, r, f) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (dhypot(x + 0.5 - cx, y + 0.5 - cy) <= r) setQ(x, y, f); };
  const clear = (cx, cy, r) => disc(cx, cy, r, i => { G.map[i] = 0; G.forest[i] = 0; });
  const rock = (cx, cy, r) => disc(cx, cy, r, i => { G.map[i] = 1; G.forest[i] = 0; });
  const line = (x0, y0, x1, y1, r) => { const n = Math.ceil(dhypot(x1 - x0, y1 - y0) * 2); for (let k = 0; k <= n; k++) clear(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, r); };
  // main base + cliff ring with two ramps
  const MX = 11, MY = 11;
  for (let a = 0; a <= Math.PI / 2 + 0.01; a += 0.02) { const ramp = Math.abs(a - 0.32) < 0.12 || Math.abs(a - 1.25) < 0.12; if (ramp) continue; for (let r = 12.5; r <= 14.5; r += 0.5) rock(MX + dcos(a) * r, MY + dsin(a) * r, 0.7); }
  clear(MX, MY, 11.5);
  // corridors: ramps -> naturals -> mid -> bridges -> centre
  line(MX + dcos(0.32) * 11, MY + dsin(0.32) * 11, 31, 10, 1.6); line(MX + dcos(1.25) * 11, MY + dsin(1.25) * 11, 10, 31, 1.6);
  line(31, 10, 33, 33, 1.4); line(10, 31, 33, 33, 1.4); line(33, 33, 40, 40, 1.6); line(10, 31, 19, 44, 1.5); line(33, 33, 37, 44, 1.5); line(31, 10, Q, 10, 1.3); line(40, 40, Q, Q - 6, 1.5);
  // naturals & mid
  clear(31, 10, 6.5); clear(10, 31, 6.5); clear(33, 33, 6);
  // river (y 45..47 mirrored -> 45..50) with bridges at x 18..20 and 36..38
  for (let y = 45; y < Q; y++) for (let x = 0; x < Q; x++) setQ(x, y, i => { G.map[i] = 2; G.forest[i] = 0; G.elev[i] = 0.1; });
  for (const bx of [18, 36]) for (let y = 43; y < Q; y++) for (let x = bx; x < bx + 3; x++) setQ(x, y, i => { G.map[i] = 0; G.bridge[i] = y >= 45 ? 1 : 0; });
  // centre plaza + monument (blocking 4x4)
  clear(Q, Q - 7.5, 4); for (let y = 46; y < Q; y++) for (let x = 46; x < Q; x++) setQ(x, y, i => { G.map[i] = 1; G.bridge[i] = 0; });
  G.monument = [Q, Q];
  // resources
  const field = (cx, cy, r, rich) => disc(cx, cy, r + 0.3, i => { const x = i % MW, y = (i / MW) | 0; const d = 0; G.map[i] = 0; G.forest[i] = 0; G.ore[i] = (rich ? 520 : 400) * ORE_MULT * (0.8 + 0.4 * R()); G.rich[i] = rich ? 1 : 0; });
  field(19.5, 5.5, 2.2); field(5.5, 19.5, 2.2);          // main
  field(35, 6, 2); field(6, 35, 2);                      // naturals
  field(37.5, 37.5, 1.6, 1);                             // rich gold at mid
  field(Q - 3, 41, 1.2, 1);                              // gold near centre (mirrored pairs)
  G.vents = []; const vent = (x, y) => { clear(x + 0.5, y + 0.5, 1.8); for (const [a, b] of mir(x, y)) G.vents.push([a, b]); };
  vent(17, 16); vent(26, 13); vent(13, 26); vent(29, 33);
  // starts (4 corners) and expansion sites (CC centres)
  G.starts = mir(MX, MY).map(([x, y]) => [x + 0.5, y + 0.5]);
  // v5.1: 6-player maps (and Volcano Crown always) get a third raised base on each side, at the west/east edge midpoint
  G.six = (G.opts.slots || []).length > 4 || (G.opts.slots || []).some(s => s.start > 3) || G.opts.map === 'volcano';
  if (G.six) { const SX = 11, SY = Q - 0.5;
    disc(SX, SY, 15.5, i => { G.map[i] = 0; G.forest[i] = 0; G.ore[i] = 0; G.bridge[i] = 0; });
    for (let a = -Math.PI / 2; a <= Math.PI / 2 + 0.01; a += 0.02) { if (Math.abs(a - 0.55) < 0.13 || Math.abs(a + 0.55) < 0.13) continue; for (let r = 12.5; r <= 14.5; r += 0.5) rock(SX + dcos(a) * r, SY + dsin(a) * r, 0.7); }
    clear(SX, SY, 11.5); line(SX + dcos(0.55) * 11, SY + dsin(0.55) * 11, 30, Q - 10, 1.6); line(SX + dcos(0.55) * 11, SY + dsin(0.55) * 11, 10, 31, 1.5); line(30, Q - 10, 33, 33, 1.5);
    field(4.5, Q - 8.5, 1.8);
    G.starts.push([SX + 0.5, SY + 0.5], [MW - 1 - SX + 0.5, SY + 0.5]); }
  G.sites = []; for (const [x, y, k] of [[MX, MY, 'main'], [30, 9, 'nat'], [9, 30, 'nat'], [32, 31, 'mid']]) for (const [a, b] of mir(x, y)) G.sites.push({ x: a + 0.5, y: b + 0.5, k });
  if (G.six) for (const s of G.starts.slice(4)) G.sites.push({ x: s[0], y: s[1], k: 'main' });
  // v5.0 elevation: main bases sit on a raised plateau (level 1) reached by ramps through the cliff ring
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { let l = 0; for (const [sx, sy] of G.starts) { const d = dhypot(x + 0.5 - sx, y + 0.5 - sy); l = Math.max(l, d < 11.5 ? 1 : d < 15.5 ? 1 - (d - 11.5) / 4 : 0); } G.lvl[idx(x, y)] = l; }
  G.mapName = G.opts.map || 'classic';
  if (G.mapName === 'frost') mapFrost(R, Q, setQ, disc, clear, rock, line, field, vent);
  if (G.mapName === 'volcano') mapVolcano(R, Q, setQ, disc, clear, rock, line, field, vent);
  // v5.1: mid-map hills and ridges on the themed maps (smooth slopes = natural ramps; tier 1 tops give high-ground bonus)
  if (G.mapName !== 'classic') { const caps = G.mapName === 'frost' ? [[30, 22, 33, 26, 3.2], [21, 35, 25, 38, 3], [38, 31, 41, 35, 2.6]] : [[29, 21, 33, 24, 3.2], [20, 33, 24, 37, 3], [36, 30, 37, 36, 2.4]];
    for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) { let l = 0; for (const [ax, ay, bx, by, r] of caps) { const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / (vx * vx + vy * vy))), d = dhypot(x + 0.5 - ax - vx * t, y + 0.5 - ay - vy * t); l = Math.max(l, d < r ? 1 : d < r + 3 ? 1 - (d - r) / 3 : 0); }
      if (l > 0) setQ(x, y, i => { if (!G.lava[i]) G.lvl[i] = Math.max(G.lvl[i], l); }); } }
  if (G.six) for (const [sx, sy] of G.starts.slice(4)) for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const d = dhypot(x + 0.5 - sx, y + 0.5 - sy), i = idx(x, y);
    if (d < 15.5 && G.map[i] === 2) G.map[i] = 0; if (d < 15.5) { G.lava[i] = 0; G.ice[i] = 0; G.bridge[i] = 0; } if (d < 11.5 && G.map[i] === 1) G.map[i] = 0; }
  for (let i = 0; i < N; i++) G.tier[i] = Math.round(G.lvl[i]);
  // flood fill from each start: unreachable open tiles become rock
  const seen = new Uint8Array(N), st = [idx(MX, MY)]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny);
      if (!seen[n] && G.map[n] === 0) { seen[n] = 1; st.push(n); } } }
  for (let i = 0; i < N; i++) if (G.map[i] === 0 && !seen[i]) { G.map[i] = 1; G.ore[i] = 0; G.forest[i] = 0; }
  G.oreMax = Float32Array.from(G.ore);
}
// Frostline Pass: frozen lake crossing in the river (vehicles drive over ice), icy bridges, ruined outpost in the centre, blizzards
function mapFrost(R, Q, setQ, disc, clear, rock, line, field, vent) {
  for (let y = 45; y < Q; y++) for (let x = 22; x < 33; x++) setQ(x, y, i => { G.map[i] = 0; G.ice[i] = 1; G.bridge[i] = 0; });
  for (let y = 40; y < 45; y++) for (let x = 24; x < 31; x++) setQ(x, y, i => { if (G.map[i] !== 1) { G.map[i] = 0; G.ice[i] = 1; G.forest[i] = 0; } });
  for (let y = 46; y < Q; y++) for (let x = 46; x < Q; x++) setQ(x, y, i => { G.map[i] = 0; }); // monument -> ruined outpost
  for (const [x, y] of [[44, 44], [45, 41], [41, 45], [42, 42]]) setQ(x, y, i => { G.map[i] = 1; G.forest[i] = 0; });
  G.monument = null; G.ruins = [Q, Q]; G.weather = null; // v5.1: blizzards scrapped
}
// Volcano Crown: central raised crown (level 2) with a lava caldera, lava river with cooled-rock crossings, extra gas vents on the crown
function mapVolcano(R, Q, setQ, disc, clear, rock, line, field, vent) {
  for (let y = 45; y < Q; y++) for (let x = 0; x < Q; x++) setQ(x, y, i => { G.map[i] = 0; G.lava[i] = 1; G.forest[i] = 0; });
  for (const bx of [18, 36]) for (let y = 43; y < Q; y++) for (let x = bx; x < bx + 3; x++) setQ(x, y, i => { G.lava[i] = 0; G.bridge[i] = 0; }); // cooled rock crossings
  for (let y = 38; y < Q; y++) for (let x = 38; x < Q; x++) { const d = dhypot(x + 0.5 - Q, y + 0.5 - Q); setQ(x, y, i => { if (d < 9.5) { G.map[i] = 0; G.lava[i] = 0; G.forest[i] = 0; G.ore[i] = 0; }
    const l = d < 7 ? 2 : d < 9.5 ? 2 * (1 - (d - 7) / 2.5) : 0; G.lvl[i] = Math.max(G.lvl[i], l); if (d < 2.2) { G.lava[i] = 1; } }); }
  // ring wall around the crown with 4 diagonal ramps
  for (let a = 0; a < Math.PI * 2; a += 0.03) { if (Math.abs(((a + Math.PI / 4) % (Math.PI / 2)) - Math.PI / 4) < 0.22) continue; const x = Q + dcos(a) * 7.6, y = Q + dsin(a) * 7.6; const tx = Math.floor(x), ty = Math.floor(y); if (inb(tx, ty)) { G.map[idx(tx, ty)] = 1; } }
  vent(Q - 5, Q - 3); G.monument = null; G.crown = [Q, Q];
}
// ===== v5.2: hand-designed layouts for Volcano Crown (3v3, mirrored W/E) and Frostline Pass (2v2, 180deg rotational) =====
function genCustom(R) {
  const N = MW * MH, vol = G.mapName === 'volcano';
  const nz = (() => { const s = 7, w = Math.ceil(MW / s) + 2, g = []; for (let i = 0; i < w * w * 3; i++) g.push(R()); const sm = t => t * t * (3 - 2 * t);
    return (x, y, o) => { x /= s; y /= s; const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), v = (a, b) => g[(o * w * w + b * w + a) % g.length];
      return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy; }; })();
  // symmetry: every write is applied to the tile and its partner (mirror x for volcano, 180deg rotation for frost)
  const pr = vol ? (x, y) => [MW - 1 - x, y] : (x, y) => [MW - 1 - x, MH - 1 - y];
  const each = (cx, cy, r, f) => { for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MH - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MW - 1, cx + r); x++) { const d = dhypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) { const [px, py] = pr(x, y); f(idx(x, y), d, x, y, x, y); if (px !== x || py !== y) f(idx(px, py), d, px, py, x, y); } } };
  const set = (i, t) => { G.map[i] = t; if (t) { G.forest[i] = 0; G.ore[i] = 0; } };
  // base terrain: noise elevation, light forests, a few rock outcrops; rock border
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = idx(x, y), [px, py] = pr(x, y), xa = Math.min(x, px), ya = vol ? y : (x < px ? y : py), n = nz(xa, ya, 0), f = nz(xa, ya, 1);
    G.elev[i] = n; G.map[i] = (n > 0.8) ? 1 : 0; G.forest[i] = f > 0.66 && n < 0.8 ? 1 : 0; if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) G.map[i] = 1; }
  const fieldC = (cx, cy, r, rich) => each(cx, cy, r + 0.3, i => { G.map[i] = 0; G.forest[i] = 0; G.ore[i] = (rich ? 520 : 400) * ORE_MULT * (0.8 + 0.4 * R()); G.rich[i] = rich ? 1 : 0; });
  const clearC = (cx, cy, r) => each(cx, cy, r, i => { G.map[i] = 0; G.forest[i] = 0; });
  const path = (pts, r, f) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.ceil(dhypot(x1 - x0, y1 - y0) * 2); for (let j = 0; j <= n; j++) each(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, r, f); } };
  // plateau: level `top` inside r, cliff ring outside except ramp gaps (angles), smooth slope down to `bot` over `rl` tiles in the gaps
  const plateau = (cx, cy, r, top, bot, gaps, gw, rl) => { const ring = 2.2;
    each(cx, cy, r + rl + 0.5, (i, d, x, y, ox, oy) => { const aa = datan2(oy + 0.5 - cy, ox + 0.5 - cx);
      const inGap = gaps.some(g => { let da = Math.abs(aa - g) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da; return da < gw / Math.max(1, d) ; });
      if (d < r) { G.lvl[i] = Math.max(G.lvl[i], top); if (G.map[i] === 1 && d < r - 0.5) G.map[i] = 0; return; }
      if (inGap) { G.lvl[i] = Math.max(G.lvl[i], top - (top - bot) * Math.min(1, (d - r) / rl)); G.map[i] = 0; G.forest[i] = 0; }
      else if (d < r + ring) { set(i, 1); G.lvl[i] = Math.max(G.lvl[i], top - (top - bot) * (d - r) / ring); } }); };
  G.vents = []; const vent = (x, y) => { clearC(x + 0.5, y + 0.5, 1.6); G.vents.push([x, y]); const [a, b] = pr(x, y); G.vents.push([a, b]); };
  G.sites = []; const site = (x, y, k) => { G.sites.push({ x, y, k }); const [a, b] = pr(x - 0.5, y - 0.5); G.sites.push({ x: a + 0.5, y: b + 0.5, k }); };
  G.dkPos = []; const dk = (x, y) => { G.dkPos.push([x, y]); G.dkPos.push(pr(x, y)); };
  G.monument = null; G.weather = null; G.ruins = null; G.crown = null;
  const C = [48, 48];
  if (vol) {
    // v5.5: scaled by k (112/96 for the 8-player 4v4 variant); v8 adds top-middle + bottom-middle bases, wider ramps, bigger plateaus, more ore
    const k = MW / 96, v8 = !!G.v8, K = v => v * k, M = MW / 2, gwB = v8 ? 2.7 : 1.9, rB = v8 ? 11.5 : 10;
    const bases = [[K(14.5), K(16.5)], [K(14.5), K(79.5)], [K(11.5), M]];
    G.starts = [[K(14.5), K(16.5)], [MW - K(14.5), K(16.5)], [K(14.5), K(79.5)], [MW - K(14.5), K(79.5)], [K(11.5), M], [MW - K(11.5), M]];
    if (v8) G.starts.push([M, K(11.5)], [M, MH - K(11.5)]);
    const lane = pts => path(pts.map(([x, y]) => [K(x), K(y)]), 1.1, i => { G.lava[i] = 1; G.forest[i] = 0; if (G.map[i] === 1) G.map[i] = 0; });
    if (!v8) { lane([[47.5, 34], [45.5, 24], [48, 14], [46.5, 2]]); lane([[47.5, 61], [49.5, 71], [47, 82], [48.5, 94]]); } else { lane([[47.5, 34], [45.5, 26]]); lane([[47.5, 61], [49.5, 69]]); }
    lane([[38, 40], [32, 33], [26, 29]]); lane([[38, 56], [31, 61], [26, 66]]); lane([[38, 48], [30, 47], [24, 48.5]]);
    for (const [bx, by] of bases) { const a = datan2(M - by, M - bx), side = by < K(30) ? Math.PI / 2 : by > K(66) ? -Math.PI / 2 : (a > 0 ? 1 : -1) * 0.9; plateau(bx, by, rB, 1, 0, [a, by > K(30) && by < K(66) ? a + 1.0 : side], gwB, 4.5); }
    if (v8) for (const by of [K(11.5), MH - K(11.5)]) { const dn = by < M ? 1 : -1; plateau(M, by, rB, 1, 0, [dn * Math.PI / 2, dn * Math.PI / 2 + 1.1, dn * Math.PI / 2 - 1.1], gwB, 4.5); }
    plateau(M, M, K(12.5), 1, 0, [0, Math.PI / 2, Math.PI, -Math.PI / 2], 2.0 * (v8 ? 1.3 : 1), 4);
    plateau(M, M, K(6.5), 2, 1, [Math.PI / 2, -Math.PI / 2], 1.7, 3.5);
    each(M, M, K(3.2), (i, d) => { G.lava[i] = 1; G.map[i] = d < K(1.6) ? 1 : 0; G.forest[i] = 0; G.ore[i] = 0; });
    G.crown = [M, M];
    const F = (x, y, r, rich) => fieldC(K(x), K(y), r * (v8 ? 1.15 : 1), rich);
    F(8, 12, 1.8); F(19.5, 9.5, 1.7); F(8, 84, 1.8); F(19.5, 86.5, 1.7); F(6, 42.5, 1.7); F(6, 53.5, 1.7);
    F(27, 33.5, 2); F(27, 62, 2); F(38, 22, 1.5, 1); F(38, 74, 1.5, 1);
    site(K(24.5), K(37), 'nat'); site(K(24.5), K(59), 'nat'); site(K(37), K(18), 'mid'); site(K(37), K(78), 'mid');
    const V = (x, y) => vent(Math.floor(K(x)), Math.floor(K(y))); V(19, 21); V(19, 74); V(16, 47); V(41, 60); V(41, 35); V(33, 48);
    dk(Math.floor(K(30)), Math.floor(K(42))); dk(Math.floor(K(30)), Math.floor(K(54))); dk(Math.floor(K(48)), Math.floor(K(38)));
    if (!v8) { dk(40, 9); dk(40, 87); }
    else { // mid bases: own ore (behind, toward the map edge) + gas each; extra lowland ore for 8 players
      for (const by of [K(11.5), MH - K(11.5)]) { const dn = by < M ? -1 : 1; fieldC(M - 4.5, by + dn * 6, 1.9); }
      vent(Math.floor(M + 5), Math.floor(K(14))); vent(Math.floor(M + 5), Math.floor(MH - K(14) - 1));
      F(33, 8, 1.6); F(33, 88, 1.6); dk(Math.floor(K(30)), Math.floor(K(26))); dk(Math.floor(K(30)), Math.floor(K(70)));
    }
  } else {
    G.starts = [[12.5, 12.5], [64.5, 85.5], [31.5, 10.5], [83.5, 83.5], [10.5, 31.5], [85.5, 64.5]];
    // mountains in the NE / SW corners
    each(90, 4, 15, (i, d) => { if (d < 13 || nz(i % MW, i / MW | 0, 2) > 0.5) set(i, 1); });
    // river NE -> SW (water), broken by the frozen lakes (ice: walkable), the outpost hill pass and the icy bridges
    const riv = [[80, 10], [72, 16], [66, 22], [58, 31], [53, 39], [52, 43]];
    path(riv, 1.8, i => { G.map[i] = 2; G.forest[i] = 0; G.ore[i] = 0; });
    each(66, 22, 9, (i, d, x, y, qx, qy) => { const e = dhypot((qx + 0.5 - 66) / 1.35, qy + 0.5 - 22); if (e < 6.4) { G.map[i] = 0; G.ice[i] = 1; G.forest[i] = 0; G.ore[i] = 0; } });
    // icy bridge across the river (vehicles + infantry)
    path([[54, 33], [58.5, 37]], 1.3, i => { if (G.map[i] === 2) { G.map[i] = 0; G.bridge[i] = 1; G.ice[i] = 1; } });
    // ruined outpost on a central hill (lvl 1) with two ramps along the pass
    each(48, 48, 6, i => { if (G.map[i] === 2) G.map[i] = 0; }); plateau(48, 48, 6, 1, 0, [-3 * Math.PI / 4, Math.PI / 4], 1.8, 4);
    G.ruins = [48, 48];
    // team cliff base (shared by the team): big plateau with 2 stair ramps
    plateau(17, 17, 19.5, 1, 0, [Math.PI / 4 + 0.42, Math.PI / 4 - 0.42], 2.1, 5);
    // winding valley pass from the ramps to the centre + valley expansions
    path([[33, 28], [36, 34], [42, 36], [45, 41]], 2.2, i => { if (G.map[i] === 1) G.map[i] = 0; G.forest[i] = 0; });
    path([[28, 33], [26, 40], [22, 46]], 2.2, i => { if (G.map[i] === 1) G.map[i] = 0; G.forest[i] = 0; });
    path([[37, 23], [44, 18], [50, 15]], 2, i => { if (G.map[i] === 1) G.map[i] = 0; G.forest[i] = 0; });
    fieldC(5.5, 20, 1.9); fieldC(20, 5.5, 1.9); fieldC(25, 25, 1.6);
    fieldC(15, 50, 2); fieldC(50, 10, 1.8); fieldC(40, 42, 1.3, 1);
    site(19.5, 46, 'nat'); site(46, 15.5, 'nat'); site(38, 38, 'mid');
    // v5.4: TWO gas sites in each team base (one per player seat); 180° symmetry fills the other team
    vent(15, 17); vent(28, 14); vent(16, 28); // seats 0,2,4 — partners cover 3,1,5
    vent(42, 47); // contested mid
    dk(30, 44); dk(43, 28); dk(10, 60); dk(56, 7);
  }
  for (const s of G.starts) { const [sx, sy] = s; clearCirc(sx, sy, 4); }
  function clearCirc(cx, cy, r) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (inb(x, y) && dhypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { const i = idx(x, y); G.map[i] = 0; G.forest[i] = 0; G.ore[i] = 0; G.lava[i] = 0; } }
  for (const s of G.starts) G.sites.push({ x: s[0], y: s[1], k: 'main' });
  for (let i = 0; i < N; i++) { if (G.map[i] !== 0) G.forest[i] = 0; G.tier[i] = Math.round(G.lvl[i]); }
  // flood fill from start 0: unreachable open tiles become rock
  const seen = new Uint8Array(N), st = [idx(Math.floor(G.starts[0][0]), Math.floor(G.starts[0][1]))]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (!seen[n] && G.map[n] === 0) { seen[n] = 1; st.push(n); } } }
  for (let i = 0; i < N; i++) if (G.map[i] === 0 && !seen[i]) { G.map[i] = 1; G.ore[i] = 0; G.forest[i] = 0; }
  G.six = true; G.oreMax = Float32Array.from(G.ore);
}
// v6.0 "Hindu Kush Hellgate" — 128x128 2v6 desert warzone. Team A (2 seats) holds a raised western valley
// behind the Hindu Kush ridge; the ONLY way in is the 7-tile Hellgate canyon. Six warlord bases ring the eastern
// desert (seats 3-8). Dry wadi, mud-brick compounds (blocking), mesas, lots of ore + derricks in no-man's-land.
function genHellgate(R) {
  const N = MW * MH;
  const nz = (() => { const s = 7, w = Math.ceil(MW / s) + 2, g = []; for (let i = 0; i < w * w * 3; i++) g.push(R()); const sm = t => t * t * (3 - 2 * t);
    return (x, y, o) => { x /= s; y /= s; const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), v = (a, b) => g[(o * w * w + b * w + a) % g.length];
      return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy; }; })();
  const each = (cx, cy, r, f) => { for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MH - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MW - 1, cx + r); x++) { const d = dhypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) f(idx(x, y), d, x, y); } };
  const fieldC = (cx, cy, r, rich) => each(cx, cy, r + 0.3, i => { G.map[i] = 0; G.ore[i] = (rich ? 560 : 420) * ORE_MULT * (0.8 + 0.4 * R()); G.rich[i] = rich ? 1 : 0; G.mud[i] = 0; });
  const clearC = (cx, cy, r) => each(cx, cy, r, i => { G.map[i] = 0; G.mud[i] = 0; });
  const path = (pts, r, f) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.ceil(dhypot(x1 - x0, y1 - y0) * 2); for (let j = 0; j <= n; j++) each(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, r, f); } };
  G.mud = new Uint8Array(N); G.wadi = new Uint8Array(N); G.rim = new Uint8Array(N);
  G.vents = []; const vent = (x, y) => { clearC(x + 0.5, y + 0.5, 1.6); G.vents.push([x, y]); };
  G.sites = []; const site = (x, y, k) => G.sites.push({ x, y, k });
  G.dkPos = []; const dk = (x, y) => G.dkPos.push([x, y]);
  G.monument = null; G.weather = null; G.ruins = null; G.crown = null; G.desert = true;
  const RX0 = 38, RX1 = 50, CY = x => 64 + 1.6 * dsin((x - RX0) / (RX1 - RX0) * Math.PI * 2); // canyon centre line (gentle S-bend)
  G.canyon = { x0: RX0, x1: RX1, y: 64, w: 7 };
  // base: noise dunes + mesas in the east; west valley raised to lvl 1 (high ground); rock border
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = idx(x, y), n = nz(x, y, 0), m = nz(x, y, 1);
    G.elev[i] = n; G.map[i] = 0;
    const rx0 = RX0 + (nz(x, y, 2) - 0.5) * 4, rx1 = RX1 + (nz(x, y, 2) - 0.5) * 3;
    if (x < rx0) { G.lvl[i] = 1; if (y < 16 + m * 5 || y > MH - 17 - m * 5) G.map[i] = 1; else if (n > 0.86 && x > 4) G.map[i] = 1; }
    else if (x <= rx1) G.map[i] = 1; // the Hindu Kush ridge
    else if (n > 0.8 || m > 0.86) G.map[i] = 1; // mesas / rock spurs
    if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) G.map[i] = 1; }
  // the Hellgate canyon: 7 tiles wide, ramp from the valley (lvl 1) down to the desert (lvl 0)
  for (let x = RX0 - 6; x <= RX1 + 6; x++) { const cy = CY(Math.max(RX0, Math.min(RX1, x))); for (let y = Math.floor(cy - 6); y <= cy + 6; y++) { if (!inb(x, y)) continue; const i = idx(x, y), d = Math.abs(y + 0.5 - cy);
      if (d < 3.75) { G.map[i] = 0; } else if (x >= RX0 - 1 && x <= RX1 + 1 && d < 5.5) G.map[i] = 1; // crisp canyon walls
      if (x >= RX0 - 2 && x <= RX1 + 2) G.lvl[i] = Math.max(0, Math.min(1, (RX1 + 2 - x) / (RX1 - RX0 + 4))); } }
  for (let y = 0; y < MH; y++) for (let x = RX1 + 3; x < RX1 + 10; x++) { const i = idx(x, y); if (Math.abs(y - 64) > 10) continue; if (G.map[i] === 1 && Math.abs(y + 0.5 - 64) < 5) G.map[i] = 0; } // clear east mouth
  // starts: seats 1-2 = Team A valley (side by side), seats 3-8 = six warlord bases
  G.starts = [[14.5, 50.5], [14.5, 79.5], [64.5, 15.5], [101.5, 14.5], [116.5, 45.5], [116.5, 84.5], [101.5, 114.5], [64.5, 113.5]];
  const out = [[0, 0], [0, 0], [0, -1], [0.5, -0.86], [1, 0], [1, 0], [0.5, 0.86], [0, 1]];
  // Team A valley: wide open floor between the two HQs, generous fields
  clearC(15, 65, 13); clearC(14.5, 50.5, 9.5); clearC(14.5, 79.5, 9.5); path([[24, 64], [36, 64]], 4.5, i => { G.map[i] = 0; });
  fieldC(5.5, 42, 2.0); fieldC(23, 41, 1.8); fieldC(5.5, 88, 2.0); fieldC(23, 89, 1.8); fieldC(5.5, 65, 1.7);
  fieldC(26, 27, 1.9); fieldC(26, 102, 1.9); fieldC(31, 57, 1.4, 1); fieldC(31, 72, 1.4, 1);
  vent(9, 56); vent(21, 56); vent(9, 73); vent(21, 73); vent(13, 26); vent(13, 103);
  site(25.5, 31, 'nat'); site(25.5, 98, 'nat');
  dk(27, 49); dk(27, 80); dk(31, 33); dk(31, 96); dk(34, 61); dk(34, 68); dk(6, 22); dk(6, 107);
  // warlord bases: clear compound, two fields toward the map edge, two gas vents, one derrick toward the desert
  for (let k = 2; k < 8; k++) { const [bx, by] = G.starts[k], [ox, oy] = out[k], tx = -oy, ty = ox; clearC(bx, by, 9);
    fieldC(bx + ox * 6.5 + tx * 5, by + oy * 6.5 + ty * 5, 1.8); fieldC(bx + ox * 6.5 - tx * 5, by + oy * 6.5 - ty * 5, 1.8);
    vent(Math.floor(bx - ox * 1.5 + tx * 7.5), Math.floor(by - oy * 1.5 + ty * 7.5)); vent(Math.floor(bx - ox * 1.5 - tx * 7.5), Math.floor(by - oy * 1.5 - ty * 7.5));
    dk(Math.floor(bx - ox * 11), Math.floor(by - oy * 11)); }
  // dry wadi snaking N-S through no-man's-land (sand riverbed, cleared of rock)
  path([[58, 3], [66, 26], [76, 42], [72, 56], [70, 64], [74, 74], [77, 88], [66, 104], [58, 125]], 2.2, (i, d) => { G.map[i] = 0; G.wadi[i] = 1; G.elev[i] *= 0.4; });
  // mud-brick compounds (blocking walls with gates) — the ruined village of Deh-e Khak in the centre and two outposts
  const compound = (x0, y0, w, h, gates) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (!inb(x, y)) continue; const i = idx(x, y), edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      G.ore[i] = 0; if (edge && !gates.some(([gx, gy]) => Math.abs(x - gx) <= 1 && Math.abs(y - gy) <= 1)) { G.map[i] = 1; G.mud[i] = 1; } else { G.map[i] = 0; G.mud[i] = 0; } } };
  clearC(88, 64, 12);
  compound(81, 56, 7, 6, [[84, 61], [87, 58]]); compound(91, 66, 6, 7, [[91, 69], [94, 66]]); compound(80, 69, 5, 5, [[82, 69]]); compound(93, 54, 5, 5, [[95, 58]]);
  compound(82, 30, 6, 5, [[84, 34]]); compound(82, 94, 6, 5, [[84, 94]]);
  // v6.0 OUTPOSTS: raised mesa overlooks (lvl 1, cliff ring, one/two ramps) with a capturable command post on top.
  // An Engineer captures it; the owner can then build within OUTPOST_R tiles — perfect for a Grand Cannon (15 range) locking a lane.
  const mesa = (cx, cy, r, gaps, name) => { const ring = 2.2, rl = 4, gw = 2.3;
    each(cx, cy, r + ring + rl, (i, d, x, y) => { const aa = datan2(y + 0.5 - cy, x + 0.5 - cx), inGap = gaps.some(g => { let da = Math.abs(aa - g) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da; return da < gw / Math.max(1, d); });
      if (d < r) { G.lvl[i] = 1; G.map[i] = 0; G.ore[i] = 0; G.mud[i] = 0; G.wadi[i] = 0; return; }
      if (d < r + ring && !inGap) { G.map[i] = 1; G.ore[i] = 0; G.mud[i] = 0; G.rim[i] = 1; G.lvl[i] = Math.max(G.lvl[i], d < r + 1.2 ? 1 : 0.4); }
      else if (inGap) { G.map[i] = 0; G.ore[i] = 0; G.mud[i] = 0; G.lvl[i] = Math.max(G.lvl[i], 1 - Math.min(1, (d - r) / rl)); } });
    G.dkPos.push([Math.floor(cx), Math.floor(cy), name]); (G.outposts = G.outposts || []).push({ x: cx, y: cy, r, name }); };
  G.outposts = [];
  mesa(58, 52, 4.2, [0.55, 1.6], "Eagle's Nest");   // north overlook of the Hellgate mouth
  mesa(58, 76, 4.2, [-0.55, -1.6], 'Gunner\'s Rock'); // south overlook of the Hellgate mouth
  mesa(76, 64, 3.8, [0, Math.PI], 'Dead Man\'s Mesa'); // centre, over the wadi + village road
  mesa(100, 40, 4.0, [2.4, -0.7], 'Ghazni Watch');     // north warlord lane
  mesa(100, 88, 4.0, [-2.4, 0.7], 'Kandahar Watch');   // south warlord lane
  // rich fields: hot spots at the canyon mouth + no-man's-land
  fieldC(53, 58.5, 1.5, 1); fieldC(53, 69.5, 1.5, 1); fieldC(88, 64, 1.7, 1); fieldC(84, 42, 1.5, 1); fieldC(84, 86, 1.5, 1); fieldC(104, 64, 1.6, 1);
  fieldC(68, 34, 1.6); fieldC(68, 94, 1.6); fieldC(95, 29, 1.6); fieldC(95, 99, 1.6); fieldC(62, 64, 1.3);
  vent(76, 50); vent(76, 78); vent(98, 61); vent(64, 46); vent(64, 82);
  site(70, 38, 'nat'); site(70, 90, 'nat'); site(100, 30, 'nat'); site(100, 98, 'nat'); site(88, 46, 'mid'); site(88, 82, 'mid'); site(106, 64, 'mid'); site(60, 64, 'mid');
  dk(55, 59); dk(55, 69); dk(72, 44); dk(72, 84); dk(88, 50); dk(88, 78); dk(100, 70); dk(78, 22); dk(78, 106); dk(110, 30); dk(110, 98); dk(66, 64);
  for (const [sx, sy] of G.starts) each(sx, sy, 4, i => { G.map[i] = 0; G.ore[i] = 0; G.mud[i] = 0; });
  for (const s of G.starts) G.sites.push({ x: s[0], y: s[1], k: 'main' });
  for (let i = 0; i < N; i++) { G.forest[i] = 0; G.tier[i] = Math.round(G.lvl[i]); if (G.map[i] !== 1) G.mud[i] = 0; }
  const seen = new Uint8Array(N), st = [idx(Math.floor(G.starts[0][0]), Math.floor(G.starts[0][1]))]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (!seen[n] && G.map[n] === 0) { seen[n] = 1; st.push(n); } } }
  for (let i = 0; i < N; i++) if (G.map[i] === 0 && !seen[i]) { G.map[i] = 1; G.ore[i] = 0; }
  G.six = true; G.oreMax = Float32Array.from(G.ore);
}
function addB(t, team, tx, ty, instant, con) {
  const P0 = G.players[team], chn = t === 'wall' && P0 && P0.fac === 'chn'; // v7.0 China Great Wall: every 5th wall piece rises as a guard tower
  if (chn) { P0.wallN = (P0.wallN || 0) + 1; if (P0.wallN % CHN_WALL.every === 0) t = 'gtower'; }
  const d = BT[t];
  const b = { id: G.nid++, kind: 'b', t, team, tx, ty, w: d.w, h: d.h, x: tx + d.w / 2, y: ty + d.h / 2, hp: d.hp, mhp: d.hp,
    born: instant ? -10 : G.time, tang: 0, rally: null, repair: false, sell: -1, cd: 0, ang: team ? Math.PI * 0.75 : -Math.PI / 4, tgt: null };
  { const l = d.wpn ? rsLvl(team, 'def') : 1; if (l > 1) b.hp = b.mhp = Math.round(d.hp * RES_M[l]); }
  if (chn && t === 'wall') b.hp = b.mhp = Math.round(d.hp * CHN_WALL.hp);
  if (con) { b.con = { p: 0, w: 0 }; b.born = 1e9; b.hp = Math.max(1, Math.round(b.mhp * CON_HP0)); } // v7.2 place-then-build: a construction site (no function until done)
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
  u.tang = u.ang; if (d.cap) u.cargo = []; { const l = rsLvl(team, resCat(u)); if (l > 1) u.hp = u.mhp = Math.round(d.hp * RES_M[l]); }
  G.ents.push(u);
  return u;
}
function byId(id) { for (const e of G.ents) if (e.id === id) return e; return null; }
function teamEnts(team, t) { return G.ents.filter(e => e.team === team && (!t || e.t === t)); }
function hasBuilt(team, t) { return G.ents.some(e => e.kind === 'b' && e.team === team && e.t === t && e.hp > 0 && e.sell < 0 && !e.con); }
function reqOk(team, d) { return d.req.every(r => hasBuilt(team, r)); }
function avail(team, t) {
  const dd = BT[t] || UT[t]; if (!dd) return false; if (dd.fac && G.players[team].fac !== dd.fac) return false; if (dd.noFac && G.players[team].fac === dd.noFac) return false;
  if (BT[t]) return (hasBuilt(team, 'hq') || hasBuilt(team, 'cc')) && reqOk(team, BT[t]) || (t === 'cc' && engFound(team));
  const d = UT[t]; return (hasBuilt(team, d.from) || (d.alt || []).some(a => hasBuilt(team, a))) && reqOk(team, d);
}
// v7.6 rule (everyone, same cost): once a side has no Command Yard and no Command Center left (not even one being built), an Engineer can
// found a new Command Center next to itself: placed within ENG_CC_R tiles of one of its engineers, which walks in and is used up; the site builds without a yard.
const ENG_CC_R = 9;
function noYard(team) { return !G.ents.some(e => e.kind === 'b' && e.team === team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0 && e.sell < 0); }
function engFound(team) { return G.r76 && noYard(team) && G.ents.some(e => e.kind === 'u' && e.team === team && e.hp > 0 && UT[e.t].engineer); }
function catOf(t) { return BT[t] ? BT[t].cat : FROMCAT[UT[t].from]; }
function getBlock() {
  if (G.blockVer === G.bver) return G.block;
  const g = new Uint8Array(MW * MH);
  for (let i = 0; i < g.length; i++) g[i] = G.map[i] ? 1 : 0;
  G.gateT = G.gateT || new Int8Array(MW * MH); G.gateT.fill(-1);
  for (const e of G.ents) if (e.kind === 'b') for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) { g[idx(x, y)] = e.t === 'gate' ? 3 : 2; if (e.t === 'gate') G.gateT[idx(x, y)] = e.team; }
  const nr = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { if (g[idx(x, y)]) continue; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inb(x + dx, y + dy) || g[idx(x + dx, y + dy)]) nr[idx(x, y)] = 1; }
  G.near = nr; G.block = g; G.blockVer = G.bver; return g;
}
// gates (v5.0): block everyone except allies of the gate's owner (G.curTeam = team currently moving/pathing)
const gateOpen = i => G.block[i] === 3 && G.curTeam != null && G.gateT[i] >= 0 && !foe(G.gateT[i], G.curTeam);
const blk = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (!inb(x, y)) return true; const g = getBlock(), i = idx(x, y); return g[i] > 0 && !gateOpen(i); };

// ---------- placement ----------
const OUTPOST_R = 7; // v6.0: build radius (tiles) around a captured Hellgate outpost
function canPlace(t, team, tx, ty) {
  const d = BT[t];
  if (tx < 0 || ty < 0 || tx + d.w > MW || ty + d.h > MH) return false;
  const g = getBlock();
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) if (g[idx(x, y)] || G.ore[idx(x, y)] > 0) return false;
  const onVent = (G.vents || []).some(([vx, vy]) => vx >= tx && vx < tx + d.w && vy >= ty && vy < ty + d.h);
  if ((t === 'extractor') !== onVent) return false;
  for (const e of G.ents) if (e.kind === 'u' && !isAir(e) && foe(e.team, team) && e.x > tx && e.x < tx + d.w && e.y > ty && e.y < ty + d.h) return false;
  if (t === 'cc') { const cx = tx + 1.5, cy = ty + 1.5; if (G.ents.some(e => e.kind === 'b' && foe(e.team, team) && dhypot(e.x - cx, e.y - cy) < 12)) return false; if (G.ents.some(e => e.kind === 'b' && (e.t === 'cc' || e.t === 'hq') && dhypot(e.x - cx, e.y - cy) < 9)) return false; if (G.r76 && noYard(team)) return !!engNear(team, cx, cy); return !!G.seenT[team][idx(Math.floor(cx), Math.floor(cy))] || G.ents.some(e => e.kind === 'b' && e.team === team && dhypot(e.x - cx, e.y - cy) < 26); }
  if (G.derricks && G.derricks.some(o => o.x > tx && o.x < tx + d.w && o.y > ty && o.y < ty + d.h)) return false; // v6.0: never build on top of a derrick/outpost post
  if (G.derricks && t !== 'extractor' && G.derricks.some(o => o.op && o.owner === team && tx < o.x + OUTPOST_R && tx + d.w > o.x - OUTPOST_R && ty < o.y + OUTPOST_R && ty + d.h > o.y - OUTPOST_R)) return true; // v6.0 captured outpost = forward build radius
  return G.ents.some(e => { if (e.kind !== 'b' || e.team !== team || e.t === 'wall' || e.t === 'gtower') return false; const R = e.t === 'hq' || e.t === 'cc' ? 10 : t === 'extractor' ? 12 : 5; return tx < e.tx + e.w + R && tx + d.w > e.tx - R && ty < e.ty + e.h + R && ty + d.h > e.ty - R; });
}
// ---------- v7.2 place-then-build ----------
// Pick a structure, place it: the FULL price is paid on the spot and a construction site rises there (scaffolding + progress bar).
// One site per lane (structures / defenses) builds at a time at the old queue speed (+50% per extra Command Yard/Center, half speed on
// low power); more sites can be placed (paid) and wait their turn. Wall pieces/gates build in parallel. A site has no power,
// production or weapons until finished; its HP rises from 10% with progress. Cancel = full refund; destroyed = no refund.
const CON_HP0 = 0.1, CON_CAP = { bld: 3, def: 5 };
const isWallT = t => t === 'wall' || t === 'gate' || t === 'gtower';
function conSites(team, cat) { let n = 0; for (const e of G.ents) if (e.con && e.team === team && e.hp > 0 && !isWallT(e.t) && BT[e.t].cat === cat) n++; return n; }
function buildWhy(team, t, tx, ty) { // '' = ok, else the reason (shared by the UI for feedback and by the lockstep command)
  const d = BT[t], P = G.players[team]; if (!d || !P || t === 'hq') return 'bad'; if (!avail(team, t)) return 'req';
  if (P.cr < d.cost) return 'cr'; if (P.gas < (d.gas || 0)) return 'gas'; if (!isWallT(t) && conSites(team, d.cat) >= CON_CAP[d.cat]) return 'busy';
  if (tx != null && !canPlace(t, team, tx, ty)) return 'spot'; return ''; }
function engNear(team, cx, cy) { let best = null, bd = ENG_CC_R; for (const e of G.ents) if (e.kind === 'u' && e.team === team && e.hp > 0 && UT[e.t].engineer) { const d = dhypot(e.x - cx, e.y - cy); if (d <= bd) { bd = d; best = e; } } return best; }
function placeBuild(team, t, tx, ty) {
  if (buildWhy(team, t, tx, ty)) return null; const d = BT[t], P = G.players[team], eng = t === 'cc' && G.r76 && noYard(team) ? engNear(team, tx + 1.5, ty + 1.5) : null;
  P.cr -= d.cost; P.gas -= d.gas || 0; const b = addB(t, team, tx, ty, false, true); b.paid = d.cost; b.paidG = d.gas || 0;
  if (eng) { b.eng = 1; eng.hp = 0; eng.sold = true; G.events.push({ e: 'engCC', team, x: b.x, y: b.y }); }
  G.events.push({ e: 'placed', team, b }); return b;
}
function buyPiece(team, t, x, y) { const P = G.players[team]; P.cr -= BT[t].cost; const b = addB(t, team, x, y, false, true); b.paid = BT[t].cost; return b; } // bot wall/gate piece: paid, then built on the ground
function cancelBuild(team, id) { const b = byId(id), P = G.players[team];
  if (!b || b.kind !== 'b' || b.team !== team || !b.con || b.hp <= 0 || b.dead) return false;
  P.cr += b.paid != null ? b.paid : BT[b.t].cost; P.gas += b.paidG || 0; b.hp = 0; b.sold = true; b.cancelled = true; G.events.push({ e: 'bcancel', team, b }); return true; }
function conDone(b) { const P = G.players[b.team]; b.con = null; b.born = G.time; b.fromCon = 1; b.hp = Math.min(b.mhp, Math.max(b.hp, 1)); G.bver++;
  P.stats.built = (P.stats.built || 0) + 1; G.events.push({ e: 'built', team: b.team, b });
  if (b.t === 'refinery') { const h = addU('harv', b.team, b.x, b.ty + b.h + 0.6); h.born = G.time; } }
function stepConstruction() {
  const yards = {}, lane = {};
  for (const e of G.ents) if (e.kind === 'b' && (e.t === 'hq' || e.t === 'cc') && !e.con && e.hp > 0 && e.sell < 0 && G.time - e.born > 1.5) yards[e.team] = (yards[e.team] || 0) + 1;
  for (const b of G.ents) { if (!b.con || b.hp <= 0 || b.sell >= 0) continue; const d = BT[b.t], P = G.players[b.team]; let rate = 1;
    if (!isWallT(b.t)) { const k = b.team * 4 + (d.cat === 'def' ? 1 : 0), n = yards[b.team] || 0; if (b.eng && !n) rate = 1; else { if (lane[k] || !n) { b.con.w = 1; continue; } lane[k] = 1; rate = (1 + 0.5 * (n - 1)) * (P.pow < 0 ? 0.5 : 1); } }
    b.con.w = 0; const dp = Math.min(1 - b.con.p, DT * rate / d.time); b.con.p += dp; b.hp = Math.min(b.mhp, b.hp + b.mhp * (1 - CON_HP0) * dp);
    if (b.con.p >= 0.9999) conDone(b); }
}
// Bots: decide what to build (an 'order' that reserves the price, nothing is paid or counted down), and once the lane is free and
// the full price is in the bank the order turns ready; the bot then picks a spot and places it exactly like a player (placeBuild).
function placeReady(team, cat, tx, ty) {
  const P = G.players[team], t = P.ready[cat];
  if (!t) return null;
  const pg = (P.rg && P.rg[cat]) || 0; P.gas += pg; // the order's set-aside gas pays the gas part
  const rv = P._rv || 0; P.cr += rv; P._rv = 0; // inside the bot's think step: use the reserved credits
  const b = placeBuild(team, t, tx, ty); if (b) { P.ready[cat] = null; if (P.rg) P.rg[cat] = 0; } else P.gas -= pg;
  if (rv) { P._rv = Math.min(P.cr, resvOf(P)); P.cr -= P._rv; }
  return b;
}
function resvOf(P) { let r = 0; for (const cat of ['bld', 'def']) { if (P.ready[cat]) { r += BT[P.ready[cat]].cost; continue; } const it = P.queues[cat][0]; if (it && BT[it.t]) r += Math.round(BT[it.t].cost * Math.min(1, it.acc || 0)); } return r; } // v7.2: a pending order sets money aside at twice the old build pace (2 x cost/time per second), so the rest of the income stays spendable
// A bot "thinks" with its spendable credits only (the reserved price is already committed, as the old queue had spent it);
// the reservation is handed back only for the moment it actually places the structure.
function aiThink(P) { const r = Math.max(0, Math.min(P.cr, resvOf(P))); P.cr -= r; P._rv = r; try { aiStep(P); } finally { P.cr += P._rv; P._rv = 0; if (P._rvG) { P.gas += P._rvG; P._rvG = 0; } } }
// ---------- production ----------
const POP_CAP = 100;
function popOf(team) { let n = 0; for (const e of G.ents) if (e.team === team && e.kind === 'u' && e.t !== 'harv') n++; const P = G.players[team]; for (const c of ['inf', 'veh', 'air']) n += P.queues[c].filter(q => q.t !== 'harv').length; return n; }
function enqueue(team, t) {
  const P = G.players[team], cat = catOf(t);
  if (!avail(team, t)) return false;
  const q = P.queues[cat];
  if (q.length >= queueCap(team, cat)) return false;
  if (UT[t] && t !== 'harv' && popOf(team) >= POP_CAP) { G.events.push({ e: 'popcap', team }); return false; }
  if (cat === 'bld' && P.ready[cat]) return false;
  if (BT[t]) { if (!P.ai || (cat === 'bld' && conSites(team, 'bld'))) return false; const g = BT[t].gas || 0; if (P.gas < g) return false; P.gas -= g; q.push({ t, prog: 0, paid: 0, gas: g, ord: 1 }); return true; } // gas is set aside with the order (as before); credits are paid in full at placement // v7.2: players place structures directly; bots reserve an order
  const gas = (BT[t] || UT[t]).gas || 0; if (P.gas < gas) return false; P.gas -= gas;
  q.push({ t, prog: 0, paid: 0, gas });
  return true;
}
function cancel(team, t) {
  const P = G.players[team], cat = catOf(t), q = P.queues[cat];
  if (BT[t] && P.ready[cat] === t && !q.some(i => i.t === t)) { P.ready[cat] = null; P.gas += (P.rg && P.rg[cat]) || 0; if (P.rg) P.rg[cat] = 0; return true; } // v7.2: orders/ready are unpaid
  if (BT[t] && !q.some(i => i.t === t)) { let last = null; for (const e of G.ents) if (e.con && e.team === team && e.t === t && e.hp > 0) last = e; return last ? cancelBuild(team, last.id) : false; } // newest site of that type
  for (let i = q.length - 1; i >= 0; i--) if (q[i].t === t) { P.cr += q[i].paid; P.gas += q[i].gas || 0; q.splice(i, 1); return true; }
  return false;
}
// producers per queue category; unit queues hold 6 per producer and build in parallel (one item per producer)
const CAT_SRC = { inf: ['barracks'], veh: ['factory'], air: ['airfield'] };
function producers(team, cat) { const src = CAT_SRC[cat]; if (!src) return 1; let n = 0; for (const e of G.ents) if (e.kind === 'b' && e.team === team && src.includes(e.t) && e.sell < 0 && G.time - e.born > 1.5) n++; return n; }
function queueCap(team, cat) { return cat === 'bld' ? 1 : cat === 'def' ? 5 : 6 * Math.max(1, producers(team, cat)); }
function stepProduction(P) {
  const slow = P.pow < 0 ? 0.5 : 1, ai = 1; /* v4.3: no AI production bonus */
  const resv = resvOf(P); // v7.2: a bot's pending structure order keeps its price in the bank (like the old queue, which drained structures first)
  for (const cat in P.queues) {
    const q = P.queues[cat]; if (!q.length) continue;
    if ((cat === 'bld' || cat === 'def') && P.ready[cat]) continue;
    if (cat === 'bld' || cat === 'def') { const it = q[0], d = BT[it.t]; if (!d) { q.shift(); continue; }
      if ((it.acc || 0) < 1) { if (avail(P.team, it.t)) { const dp = Math.min(1 - (it.acc || 0), DT * slow * 2 / d.time); if (P.cr >= resv + d.cost * dp) it.acc = (it.acc || 0) + dp; } if (it.acc < 0.9999) continue; it.acc = 1; }
      if (conSites(P.team, cat) === 0 && avail(P.team, it.t) && P.cr >= d.cost) { q.shift(); P.ready[cat] = it.t; (P.rg || (P.rg = {}))[cat] = it.gas || 0; G.events.push({ e: 'ready', team: P.team, t: it.t }); }
      continue; }
    const used = new Map(), done = [];
    const lanes = cat === 'bld' || cat === 'def' ? 1 : q.length;
    for (let k = 0; k < lanes && k < q.length; k++) {
      const it = q[k], d = BT[it.t] || UT[it.t];
      const src = BT[it.t] ? 'hq' : d.from;
      let prod = G.ents.filter(e => e.kind === 'b' && e.team === P.team && (e.t === src || src === 'hq' && e.t === 'cc') && e.sell < 0 && G.time - e.born > 1.5);
      if (!prod.length && d.alt) prod = G.ents.filter(e => e.kind === 'b' && e.team === P.team && d.alt.includes(e.t) && e.sell < 0 && G.time - e.born > 1.5);
      if (!prod.length || !reqOk(P.team, d)) continue;
      const key = prod[0].t, u = used.get(key) || 0; if (UT[it.t] && u >= prod.length) continue; used.set(key, u + 1);
      const bonus = BT[it.t] ? 1 + 0.5 * (prod.length - 1) : 1;
      const dp = Math.min(1 - it.prog, DT * bonus * slow * ai / d.time), c = d.cost * dp;
      if (P.cr - resv >= c) { P.cr -= c; it.prog += dp; it.paid += c; }
      if (it.prog >= 0.9999) { done.push(k);
        if (BT[it.t]) { P.ready[cat] = it.t; G.events.push({ e: 'ready', team: P.team, t: it.t }); }
        else spawnUnit(P.team, it.t, prod[u % prod.length]); }
    }
    for (let i = done.length - 1; i >= 0; i--) q.splice(done[i], 1);
  }
}
// wall chain: build segments on tiles (each pays cost, must be placeable)
function wallLine(x0, y0, x1, y1) { const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), ax = Math.abs(x1 - x0), ay = Math.abs(y1 - y0);
  let n, sx, sy; if (ax > 2 * ay) { n = ax; sx = dx; sy = 0; } else if (ay > 2 * ax) { n = ay; sx = 0; sy = dy; } else { n = Math.max(ax, ay); sx = dx; sy = dy; }
  const out = []; for (let k = 0; k <= Math.min(n, 24); k++) out.push([x0 + sx * k, y0 + sy * k]); return out; }
function buildWalls(team, tiles) {
  const P = G.players[team]; if (!avail(team, 'wall')) return 0; let n = 0;
  for (const [x, y] of (tiles || []).slice(0, 25)) { if (P.cr < BT.wall.cost || !canPlace('wall', team, x, y)) continue; P.cr -= BT.wall.cost; const b = addB('wall', team, x, y, false, true); b.paid = BT.wall.cost; n++; } // v7.2: each piece paid on placement, then builds on the ground
  if (n) { G.bver = (G.bver || 0) + 1; G.events.push({ e: 'walls', team, n }); } return n;
}
function spawnUnit(team, t, b) {
  if (UT[t].batch && !b._bat) { b._bat = 1; let u; for (let k = 0; k < UT[t].batch; k++) { u = spawnUnit(team, t, b); if (k) { u.x += (k - 1.5) * 0.7; u.y += 0.4 * k; } } b._bat = 0; return u; } // v7.0 batch units (Iran drones)
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
      if (cl[n] || g[n] && !gateOpen(n)) continue;
      if (dx && dy && (g[idx(nx, cy)] && !gateOpen(idx(nx, cy)) || g[idx(cx, ny)] && !gateOpen(idx(cx, ny)))) continue;
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
  const dx = b.x - a.x, dy = b.y - a.y, d = dhypot(dx, dy); if (d < 0.01) return true;
  const px = -dy / d * 0.35, py = dx / d * 0.35, n = Math.ceil(d / 0.2);
  for (let k = 1; k <= n; k++) { const x = a.x + dx * k / n, y = a.y + dy * k / n;
    if (blk(x, y) || blk(x + px, y + py) || blk(x - px, y - py)) return false; }
  return true;
}
// ---------- orders ----------
function setPath(u, x, y) {
  u.dest = { x, y }; u.moveT = 0; u.lastP = { x: u.x, y: u.y };
  if (isAir(u)) u.path = [{ x: Math.max(0.5, Math.min(MW - 0.5, x)), y: Math.max(0.5, Math.min(MH - 0.5, y)) }];
  else { G.curTeam = u.team; u.path = findPath(u.x, u.y, x, y); }
}
function orderMove(units, x, y, attackMove, queue) {
  units = units.filter(u => u.kind === 'u'); if (!units.length) return;
  { const started = escortGroup(units, x, y, attackMove, queue); if (started) { units = units.filter(u => !started.has(u)); if (!units.length) return; } } // v7.0.2 Medevac hangs back behind the army
  let cx = 0, cy = 0; units.forEach(u => { cx += u.x; cy += u.y; }); cx /= units.length; cy /= units.length;
  const dir = datan2(y - cy, x - cx), cols = Math.ceil(Math.sqrt(units.length * 1.5)), sp = units.some(u => UT[u.t].armor !== 'inf') ? 1.25 : 0.85;
  const slots = [];
  for (let i = 0; i < units.length; i++) {
    const r = Math.floor(i / cols), c = i % cols, rowN = Math.min(cols, units.length - r * cols);
    const lat = (c - (rowN - 1) / 2) * sp, back = -r * sp;
    let sx = x + dcos(dir) * back - dsin(dir) * lat, sy = y + dsin(dir) * back + dcos(dir) * lat;
    if (blk(sx, sy)) { const f = nearFree(Math.floor(sx), Math.floor(sy), 4); sx = f[0] + 0.5; sy = f[1] + 0.5; }
    slots.push({ x: sx, y: sy });
  }
  // fastest/frontline first: greedy nearest assignment
  const left = units.slice(), mv = [];
  for (const s of slots) { let bi = 0, bd = 1e9; left.forEach((u, i) => { const d = dhypot(u.x - s.x, u.y - s.y); if (d < bd) { bd = d; bi = i; } });
    const u = left.splice(bi, 1)[0]; u.grp = units.length;
    if (queue && (u.path.length || (u.wq && u.wq.length))) { (u.wq = u.wq || []).push({ x: s.x, y: s.y, am: !!attackMove }); continue; }
    u.wq = []; u.order = attackMove ? 'amove' : 'move'; /* v6.2: a plain move (retreat/redirect) breaks off the fight for marines too; they re-engage once they arrive (idle auto-acquire) */ u.face = null; if (u.stance === 'hold') u.guard = { x: s.x, y: s.y }; u.tgt = null; u.anchor = { x: s.x, y: s.y }; u.amDest = u.order === 'amove' && UT[u.t].marine ? { x: s.x, y: s.y } : null; // v5.9 Iron Marines auto-engage on the move (attack-move by default)
    if (u.t === 'harv') { u.hst = 'manual'; const oi = idx(Math.floor(s.x), Math.floor(s.y)); if (G.ore[oi] > 0) { u.hst = 'idle'; u.prefOre = oi; } }
    mv.push([u, s]); }
  // v6.0 big maps (128+): a large group shares its leader's path (one A* instead of one per unit) when each unit can see the
  // leader's first waypoint and its own slot from the leader's last waypoint; otherwise it paths on its own. Deterministic.
  const share = MW >= 128 && mv.length >= 5, leads = [];
  if (share) mv.sort((p, q) => dhypot(p[0].x - cx, p[0].y - cy) - dhypot(q[0].x - cx, q[0].y - cy) || p[0].id - q[0].id); // centre-out, so the first leader is central
  for (const m of mv) { const [u, s] = m;
    if (share && !isAir(u)) { G.curTeam = u.team; let pth = null;
      for (const L of leads) { if (dhypot(u.x - L.x, u.y - L.y) >= 10) continue; const lp = L.p;
        if (!lp.length) continue; if (lp.length === 1 && los(u, s)) { pth = []; break; }
        if (los(u, lp[0])) { if (lp.length >= 2 && los(lp[lp.length - 2], s)) { pth = lp.slice(0, -1); break; } if (los(lp[lp.length - 1], s)) { pth = lp.slice(); break; } } }
      if (pth) { u.dest = { x: s.x, y: s.y }; u.moveT = 0; u.lastP = { x: u.x, y: u.y }; u.path = pth.map(q => ({ x: q.x, y: q.y })).concat([{ x: s.x, y: s.y }]); continue; }
      setPath(u, s.x, s.y); if (leads.length < 12) leads.push({ x: u.x, y: u.y, p: u.path }); continue; }
    setPath(u, s.x, s.y); }
}
function orderAttack(units, tgt) {
  { const started = escortGroup(units.filter(u => u.kind === 'u'), tgt.x, tgt.y, true, false); if (started) units = units.filter(u => !started.has(u)); }
  for (const u of units) {
    if (u.kind !== 'u') continue;
    const d = UT[u.t];
    if (d.engineer) { u.order = 'capture'; u.tgt = tgt; setPath(u, tgt.x, tgt.y); continue; }
    if (d.kami) { if (tgt.hp > 0 && !isAir(tgt) && foe(tgt.team, u.team)) { u.order = 'attack'; u.tgt = tgt; u.path = [{ x: tgt.x, y: tgt.y }]; } else orderMove([u], tgt.x, tgt.y, true); continue; }
    if (!d.wpn || !canHit(W[d.wpn], tgt)) { orderMove([u], tgt.x, tgt.y, true); continue; }
    u.order = 'attack'; u.tgt = tgt; u.path = []; u.repathT = 0;
  }
}
// ---- v5.0 transports: board / unload ----
const cargoSize = u => UT[u.t].armor === 'inf' ? 1 : 4;
function cargoUsed(tr) { return tr.cargo.reduce((a, c) => a + cargoSize(c), 0); }
function canBoard(u, tr) { return tr && tr.cargo && u.kind === 'u' && u.team === tr.team && !isAir(u) && u.t !== 'harv' && u !== tr; }
function orderBoard(units, tr) { let room = UT[tr.t].cap - cargoUsed(tr) - units.filter(u => u.order === 'board' && u.boardT === tr.id).reduce((a, u) => a + cargoSize(u), 0);
  for (const u of units) { if (!canBoard(u, tr) || cargoSize(u) > room) continue; room -= cargoSize(u); u.order = 'board'; u.boardT = tr.id; u.tgt = null; setPath(u, tr.x, tr.y); }
  if (tr.order === 'move' || tr.order === 'amove') return; tr.path = []; tr.order = 'idle'; }
function orderUnload(tr, x, y) { if (!tr || !tr.cargo) return; tr.order = 'unload'; tr.unloadAt = { x, y }; tr.tgt = null; setPath(tr, x, y); }
function stepBoard(u) { const tr = byId(u.boardT); if (!tr || tr.hp <= 0 || !tr.cargo) { u.order = 'idle'; u.boardT = null; return; }
  if (dhypot(u.x - tr.x, u.y - tr.y) < 1.4) { if (cargoUsed(tr) + cargoSize(u) <= UT[tr.t].cap) { tr.cargo.push(u); u.inside = tr.id; u.dead = true; u.order = 'idle'; u.path = []; G.events.push({ e: 'board', team: u.team, x: tr.x, y: tr.y }); } else { u.order = 'idle'; } return; }
  if (!u.path.length || G.tick % 30 === u.id % 30) setPath(u, tr.x, tr.y); }
function doUnload(tr) { const x0 = Math.floor(tr.x), y0 = Math.floor(tr.y); let k = 0;
  for (const c of tr.cargo) { const f = nearFree(x0 + (k % 3) - 1, y0 + ((k / 3) | 0) - 1, 5); k++; c.x = f[0] + 0.5; c.y = f[1] + 0.5; c.dead = false; c.inside = null; c.path = []; c.order = 'idle'; c.anchor = { x: c.x, y: c.y }; c.lastP = { x: c.x, y: c.y }; G.ents.push(c); }
  if (tr.cargo.length) G.events.push({ e: 'unload', team: tr.team, x: tr.x, y: tr.y, n: tr.cargo.length }); tr.cargo = []; tr.order = 'idle'; tr.anchor = { x: tr.x, y: tr.y }; G.bver++; }
function orderDerrick(units, k) { const dk = G.derricks[k]; if (!dk) return; for (const u of units) if (u.kind === 'u' && UT[u.t].engineer) { u.order = 'derrick'; u.dk = k; u.tgt = null; setPath(u, dk.x, dk.y); } }
function orderStop(units) { for (const u of units) if (u.kind === 'u') { u.path = []; u.order = 'idle'; u.tgt = null; u.anchor = { x: u.x, y: u.y }; if (u.t === 'harv') u.hst = 'idle'; } }
function canHit(w, e) { return !!w && e && e.hp > 0 && (isAir(e) ? !!w.air : !!w.ground) && (e.kind !== 'b' || e.t !== 'wall' || true); }
function distTo(a, e) {
  if (e.kind !== 'b') return dhypot(a.x - e.x, a.y - e.y);
  const cx = Math.max(e.tx, Math.min(a.x, e.tx + e.w)), cy = Math.max(e.ty, Math.min(a.y, e.ty + e.h));
  return dhypot(a.x - cx, a.y - cy);
}
function sellB(b) { if (b && b.con) return cancelBuild(b.team, b.id); if (b.kind === 'b' && b.sell < 0 && b.t !== 'hq' || (b.kind === 'b' && b.t === 'hq' && b.sell < 0 && G.ents.filter(e => e.team === b.team && e.t === 'hq').length > 1)) { b.sell = G.time; G.events.push({ e: 'sell', b }); } }
// ---------- main step ----------
// ===== v5.2 Warhead Launcher =====
function siloBuild(b, k) { const m = MIS[k], P = G.players[b.team]; if (!m || !b || b.t !== 'silo' || b.hp <= 0 || b.sell >= 0 || b.mq || b.mis || P.cr < m.cost || P.gas < m.gas) return false; P.cr -= m.cost; P.gas -= m.gas; b.mq = { k, p: 0 }; return true; }
function siloLaunch(b, x, y) { if (!b || b.t !== 'silo' || b.hp <= 0 || !b.mis || G.time < (b.cdT || 0)) return false; const m = MIS[b.mis]; if (dhypot(x - b.x, y - b.y) > m.rng) return false;
  x = Math.max(0.5, Math.min(MW - 0.5, x)); y = Math.max(0.5, Math.min(MH - 0.5, y));
  const ms = { id: G.nid++, team: b.team, k: b.mis, x0: b.x, y0: b.y, x1: x, y1: y, t0: G.time, T: m.T + dhypot(x - b.x, y - b.y) * 0.03 }; (G.missiles = G.missiles || []).push(ms);
  G.events.push({ e: 'launch', team: b.team, k: b.mis, x, y, T: ms.T, big: m.big || b.mis === 'cluster', ms }); b.mis = null; b.cdT = G.time + m.cd; b.lastLaunch = G.time; return true; }
function stepMissiles() { if (!G.missiles || !G.missiles.length) return;
  G.missiles = G.missiles.filter(ms => { const m = MIS[ms.k], s = (G.time - ms.t0) / ms.T, gx = ms.x0 + (ms.x1 - ms.x0) * s, gy = ms.y0 + (ms.y1 - ms.y0) * s;
    if (m.icpt && s > 0.45 && G.tick % 10 === ms.id % 10) { // top-tier AA (level-3 Flak Battery) can intercept small missiles on the way down
      for (const e of G.ents) if (e.kind === 'b' && e.t === 'aagun' && (e.lvl || 1) >= 3 && foe(e.team, ms.team) && e.hp > 0 && !e.offline && dhypot(e.x - gx, e.y - gy) < 9 && !(ms.tried = ms.tried || []).includes(e.id)) { ms.tried.push(e.id); if (G.R() < 0.4) { G.events.push({ e: 'intercept', x: gx, y: gy, team: e.team, ms }); return false; } } }
    if (s > 0.45 && G.sm3 && G.sm3.length) for (const b of G.sm3) if (foe(b.team, ms.team) && dhypot(b.x - gx, b.y - gy) < SM3.r + 2 && !(ms.tried = ms.tried || []).includes(b.id)) { ms.tried.push(b.id); if (G.R() < SM3.p) { G.events.push({ e: 'intercept', x: gx, y: gy, team: b.team, ms, sm3: 1, bx: b.x, by: b.y }); return false; } } // v6.2 SM-3
    if (s < 1) return true;
    for (let k = 0; k < m.sub; k++) { const a = k * 2.39996 + G.R() * 0.5, rr = m.sub > 1 ? (k ? m.spread * (0.4 + 0.6 * G.R()) : 0) : 0, cx = ms.x1 + dcos(a) * rr, cy = ms.y1 + dsin(a) * rr;
      for (const e of G.ents) { if (e.hp <= 0 || (e.kind === 'u' && isAir(e))) continue; const d = dhypot(e.x - cx, e.y - cy) - (e.kind === 'b' ? Math.min(e.w, e.h) / 2 : 0); if (d < m.r) damage(e, m.dmg * (1 - 0.55 * Math.max(0, d) / m.r), { type: 'warhead' }, ms.team, null); }
      G.events.push({ e: 'impact', x: cx, y: cy, k: ms.k, r: m.r, big: m.big }); }
    return false; }); }
function stepGame() {
  if (G.over) return;
  if (G.replay && typeof replayFeed === 'function') replayFeed(); else if (typeof recHash === 'function') recHash();
  G.tick++; G.time += DT;
  if (G.tick % 15 === 1) for (const P of G.players) {
    let gen = 0, use = 0;
    for (const e of G.ents) if (e.kind === 'b' && e.team === P.team && e.sell < 0 && G.time - e.born > 1.5) { const p = e.bal ? BALLISTA.pow : BT[e.t].pow; if (p > 0) gen += p * (0.5 + 0.5 * e.hp / e.mhp); else use -= p; }
    P.gen = Math.round(gen); P.use = use; P.pow = P.gen - use;
  }
  stepMissiles();
  if (G.weather && G.time > G.weather.next) { G.weather.on = !G.weather.on; G.weather.next = G.time + (G.weather.on ? 60 : 180 + G.R() * 120); G.events.push({ e: 'weather', on: G.weather.on }); }
  for (const P of G.players) stepProduction(P);
  stepConstruction();
  if (G.tick % 30 === 0 && G.derricks) for (const d of G.derricks) if (d.owner >= 0 && G.players[d.owner] && !G.players[d.owner].out) { const P = G.players[d.owner]; P.cr += DERRICK_RATE; P.stats.mined += DERRICK_RATE; }
  // spatial hash for separation
  const hash = new Map();
  for (const e of G.ents) if (e.kind === 'u') { const k = (Math.floor(e.x) << 8) | Math.floor(e.y) | (isAir(e) ? 1 << 20 : 0); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(e); }
  G.hash = hash;
  G.dens.fill(0);
  for (const e of G.ents) if (e.kind === 'u' && !e.path.length && !isAir(e)) { const i = idx(Math.floor(e.x), Math.floor(e.y)); if (G.dens[i] < 6) G.dens[i]++; }
  if (G.tick % 30 === 0) { for (let i = 0; i < G.ore.length; i++) if (G.oreMax[i] > 0 && G.ore[i] < G.oreMax[i]) { const was = G.ore[i]; G.ore[i] = Math.min(G.oreMax[i], G.ore[i] + ORE_REGROW * (was > 0 ? 1 : 0.5)); } G.oreVer++; }
  for (const e of G.ents) { if (e.hp <= 0) continue; G.curTeam = e.team; if (e.kind === 'b') stepBuilding(e); else stepUnit(e); }
  G.curTeam = null;
  separate(hash); G.curTeam = null;
  stepProjs();
  // removal
  for (const e of G.ents) if (e.hp <= 0 && !e.dead) { e.dead = true; onDeath(e); }
  if (G.ents.some(e => e.dead)) { G.ents = G.ents.filter(e => !e.dead); G.bver++; }
  for (const P of G.players) if (P.ai && !P.horde && typeof aiStep === 'function') aiThink(P);
  if (G.end && typeof endlessStep === 'function') endlessStep(); // v7.0 Endless wave director
  if (G.tick % 6 === 0) updFog();
  if (G.tick % 15 === 0) {
    const KEY = { hq: 1, cc: 1, barracks: 1, factory: 1, airfield: 1, refinery: 1, tech: 1 };
    for (const P of G.players) if (!P.out && !P.horde && !G.ents.some(e => e.team === P.team && e.kind === 'b' && KEY[e.t])) { P.out = true; G.events.push({ e: 'eliminated', team: P.team }); for (const e of G.ents) if (e.team === P.team && e.kind === 'b') e.hp = 0; }
    const live = new Set(G.players.filter(P => !P.out).map(P => P.ally)), me = G.players[ME] ? G.players[ME].ally : 0;
    if (live.size <= 1) { G.winAlly = [...live][0]; G.over = G.winAlly === me ? 'victory' : 'defeat'; }
    else if (!live.has(me) && !(typeof NET !== 'undefined' && NET.online)) G.over = 'defeat'; // offline: stop once my side is out
    if (G.tick % 300 === 0) G.hist.push({ t: G.time, p: G.players.map(P => ({ army: G.ents.reduce((a, e) => a + (e.team === P.team && e.kind === 'u' && e.t !== 'harv' ? UT[e.t].cost : 0), 0), mined: P.stats.mined | 0 })) });
  }
}
function onDeath(e) {
  G.events.push({ e: 'die', ent: e });
  const P = G.players[e.team]; if (P) P.stats.lost++;
  if (e.cargo && e.cargo.length) { if (P) P.stats.lost += e.cargo.length; e.cargo = []; }
  if (e.lastHitBy != null && G.players[e.lastHitBy]) G.players[e.lastHitBy].stats.kills++;
  if (G.end && typeof endlessDeath === 'function') endlessDeath(e);
}
function stepBuilding(b) {
  const d = BT[b.t], P = G.players[b.team];
  if (b.con) return; // v7.2 construction site: progress is handled in stepConstruction
  if (b.sell >= 0) { if (G.time - b.sell > 1.2) { P.cr += Math.floor((d.cost + (b.bal ? BALLISTA.cost : 0)) * 0.5 * b.hp / b.mhp); b.hp = 0; b.sold = true; } return; }
  if (b.repair && b.hp < b.mhp) { const dh = b.mhp * 0.04 * DT, c = d.cost * 0.4 * dh / b.mhp; if (P.cr >= c) { P.cr -= c; b.hp = Math.min(b.mhp, b.hp + dh); } }
  if (b.repair && b.hp >= b.mhp) b.repair = false;
  if (b.upT != null && G.time - b.upT >= b.upDur) { b.upT = null; if (b.upKind === 'sm3') b.sm3 = true; else if (b.upKind === 'pads') b.pads = true; else if (b.upKind === 'rs') resDone(b.team, b.upCat); else if (b.upKind === 'bal') { const rl = rsLvl(b.team, 'def'), m = Math.round(BALLISTA.hp * (rl > 1 ? RES_M[rl] : 1)); b.bal = true; b.hp = Math.min(m, b.hp + m - b.mhp); b.mhp = m; b.sq = null; } else if (b.upKind === 'def') { P.defUp = true; G.ents.forEach(e => { if (e.team === b.team && UPG[e.t]) { e.mhp = Math.round(BT[e.t].hp * DEF_RESEARCH.hp); e.hp = Math.min(e.mhp, e.hp * DEF_RESEARCH.hp); } }); } else b.lvl = (b.lvl || 1) + 1; G.events.push({ e: 'upgraded', b, team: b.team }); }
  if (b.t === 'extractor' && G.time - b.born > 1.5 && b.sell < 0) { const m = 1; P.gas += GAS_RATE * DT * m * (P.pow < 0 ? 0.5 : 1); b.gasT = (b.gasT || 0) + DT; }
  if (b.t === 'silo' && b.mq && G.time - b.born > 1.5 && P.pow >= 0) { b.mq.p += DT; if (b.mq.p >= MIS[b.mq.k].time) { b.mis = b.mq.k; b.mq = null; G.events.push({ e: 'misReady', team: b.team, k: b.mis }); } }
  if (!d.wpn || G.time - b.born < 1.5) return;
  if (P.pow < 0 && (b.bal ? BALLISTA.pow : d.pow) < 0) { b.offline = true; return; } // offline (low power)
  b.offline = false;
  if (d.squad) { stepSquad(b); return; }
  const w = defW(b); combat(b, w, d.sight + (w.rng - W[d.wpn].rng), false);
}
// v7.0.2 China guard tower: one Rifleman, Sniper, Rocketeer and Iron Marine 'garrisoned' — each weapon picks its own target and fires on its own cooldown
const _sqWC = {};
function sqW(b, k) { const l = b.lvl || 1, rl = rsLvl(b.team, 'def'), key = k + l + 'r' + rl;
  if (!_sqWC[key]) { const base = W[k]; _sqWC[key] = Object.assign({}, base, { dmg: Math.round(base.dmg * UPG_DMG[l - 1] * RES_M[rl]), rng: base.rng + GT_SQUAD.rng + UPG_RNG[l - 1] + (rl >= 3 ? 0.5 : 0) }); } return _sqWC[key]; }
const sqList = b => b.bal ? BALLISTA.w : GT_SQUAD.w; // v7.0.2 Ballista Tower: bolt + rifle + marine
function stepSquad(b) {
  const L = sqList(b); if (!b.sq || b.sq.length !== L.length) b.sq = L.map(() => ({ cd: 0, tgt: null }));
  for (let i = 0; i < L.length; i++) { const s = b.sq[i], w = sqW(b, L[i]);
    if (s.cd > 0) s.cd -= DT;
    const t0 = s.tgt; if (t0 && (t0.hp <= 0 || t0.dead || !foe(t0.team, b.team) || distTo(b, t0) > w.rng + (t0.kind === 'u' ? UT[t0.t].r : 0) || (w.minRng && distTo(b, t0) < w.minRng))) s.tgt = null;
    if (!s.tgt && (G.tick + b.id + i * 2) % 8 === 0) { const t = acquire(b, w, w.rng); s.tgt = t && !(w.minRng && distTo(b, t) < w.minRng) ? t : null; }
    const t = s.tgt; if (!t) continue; const a = datan2(t.y - b.y, t.x - b.x);
    if (b.bal && i === 0) b.tang = turnTo(b.tang, a, 4 * DT); // the ballista arm tracks its target; the bolt flies once it's lined up
    if (s.cd <= 0 && (!b.bal || i > 0 || Math.abs(angDiff(b.tang, a)) < 0.2)) { if (!b.bal) b.tang = a; fire(b, w, t); s.cd = b.cd; b.cd = 0; } }
  const a = b.sq.find(s => s.tgt); b.tgt = a ? a.tgt : null;
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
    if (!foe(o.team, e.team) || o.hp <= 0 || !canHit(w, o)) continue;
    const d = distTo(e, o); if (d > range) continue;
    if (e.team != null && G.visT && !visibleTo(e.team, o)) continue;
    const s = tscore(e, w, o, d); if (s < bs) { bs = s; best = o; }
  }
  e._bs = bs; return best;
}
// returns true if engaging (in range or chasing)
function combat(e, w, sight, mobile) {
  if (e.tgt && (e.tgt.hp <= 0 || e.tgt.dead || !foe(e.tgt.team, e.team))) e.tgt = null;
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
  const want = datan2(t.y - e.y, t.x - e.x);
  const jetRun = mobile && UT[e.t].jet && w.type === 'bomb';
  if (d <= w.rng + tr && (!w.minRng || d >= w.minRng)) {
    if (jetRun) { e.tang = e.ang; if (e.cd <= 0 && e.ammo > 0) { fire(e, w, t); e.passT = G.time + 1.4; setPath(e, t.x + dcos(e.ang) * 4, t.y + dsin(e.ang) * 4); } else if (!e.path.length) setPath(e, t.x, t.y); return true; }
    // kite: keep range advantage vs slower-ranged threats
    if (mobile && !forced && e.stance !== 'hold' && !UT[e.t].air && t.kind === 'u' && UT[t.t].wpn && e.cd > 0.3 && G.time > (e.kiteT || 0)) {
      const tw = W[UT[t.t].wpn]; if (w.rng > tw.rng + 1.2 && d < tw.rng + 0.6 && canHit(tw, e)) { const kx = e.x - dcos(want) * 1.6, ky = e.y - dsin(want) * 1.6; if (!blk(Math.floor(kx), Math.floor(ky))) { setPath(e, kx, ky); e.kiteT = G.time + 0.9; } }
    }
    if (mobile && G.time > (e.kiteT || 0)) e.path = [];
    e.tang = turnTo(e.tang, want, 5 * DT);
    if (mobile && !UT[e.t].turret) e.ang = e.tang;
    if (e.cd <= 0 && Math.abs(angDiff(e.tang, want)) < 0.25) fire(e, w, t);
    return true;
  }
  if (mobile) {
    if (w.minRng && d < w.minRng) { if (!e.path.length) setPath(e, e.x - dcos(want) * 3, e.y - dsin(want) * 3); return true; }
    e.repathT = (e.repathT || 0) - DT;
    if (jetRun && G.time < (e.passT || 0)) return true;
    if (!e.path.length || e.repathT <= 0) { setPath(e, t.x, t.y); e.repathT = 1 + G.R(); }
    return true;
  }
  e.tang = turnTo(e.tang, want, 3 * DT);
  return false;
}
const TESLA_RELAY = 4.2, TESLA_STACK = 1.25, TESLA_MAXC = 5;
function fire(e, w, t) {
  e.cd = w.cd * (0.9 + G.R() * 0.2);
  const z0 = e.kind === 'u' ? e.z : e.t === 'gtower' ? 1.6 : 0.8, tz = t.kind === 'u' ? t.z : 0.5;
  const shots = w.twin ? 2 : 1;
  if (w.chain) { // chain lightning: instant hit, arcs to nearby enemies with falloff
    // v5.3 Tesla CHAINING: ready friendly coils within TESLA_RELAY relay their charge tower-to-tower into the coil
    // closest to the target; each contributor adds TESLA_STACK x its own shot to that one bolt (and spends its charge).
    let src = e, amt = w.dmg * (e.lvl > 1 ? UPG_DMG[e.lvl - 1] : 1); const relay = [];
    if (e.kind === 'b' && e.t === 'tesla') { for (const o of G.ents) if (o !== e && o.t === 'tesla' && o.kind === 'b' && o.hp > 0 && o.team === e.team && !o.offline && !(o.cd > 0) && (o.bp == null || o.bp >= 1) && relay.length < TESLA_MAXC && dhypot(o.x - e.x, o.y - e.y) <= TESLA_RELAY) relay.push(o);
      for (const o of relay) { o.cd = W.tesla.cd * (0.9 + G.R() * 0.2); o.lastFire = G.time; amt += TESLA_STACK * W.tesla.dmg * (o.lvl > 1 ? UPG_DMG[o.lvl - 1] : 1);
        if (dhypot(o.x - t.x, o.y - t.y) < dhypot(src.x - t.x, src.y - t.y)) src = o; } }
    const rp = []; for (const o of [e, ...relay]) if (o !== src) rp.push({ a: { x: o.x, y: o.y, z: 2.2 }, b: { x: src.x, y: src.y, z: 2.2 } });
    const pts = [{ x: src.x, y: src.y, z: z0 + (e.kind === 'b' ? 2.2 : 1.8) }], hitL = [t]; let cur = t;
    for (let k = 0; k <= w.chain && cur; k++) { damage(cur, amt, w, e.team, e); pts.push({ x: cur.x, y: cur.y, z: cur.kind === 'u' ? cur.z + 0.4 : 0.6 }); amt *= 0.7;
      let nx = null, nd = 2.6; for (const o of G.ents) if (o.kind === 'u' && o.hp > 0 && foe(o.team, e.team) && !hitL.includes(o) && canHit(w, o)) { const dd = dhypot(o.x - cur.x, o.y - cur.y); if (dd < nd) { nd = dd; nx = o; } }
      cur = nx; if (nx) hitL.push(nx); }
    e.lastFire = G.time; G.events.push({ e: 'zap', pts, team: e.team, rp, n: relay.length + 1 }); G.events.push({ e: 'fire', src: e, w }); return; }
  e.lastFire = G.time; if (w.ammo) e.ammo = (e.ammo == null ? w.ammo : e.ammo) - 1;
  const est = w.dmg * DMG[w.type][armorOf(t)] * shots; t.inc = (t.inc || 0) + est;
  for (let s = 0; s < shots; s++) {
    const spread = w.spread || (w.type === 'shell' ? 0.8 : 0);
    G.projs.push({ id: G.nid++, x: e.x, y: e.y, z: z0 + 0.4, sx: e.x, sy: e.y, w, team: e.team, tgt: t, src: e, est: est / shots, home: w.type !== 'shell' && w.type !== 'bomb',
      tx: t.x + (G.R() - 0.5) * spread, ty: t.y + (G.R() - 0.5) * spread, tz, delay: s * 0.12, kind: w.type });
  }
  G.events.push({ e: 'fire', src: e, w });
}
function stepProjs() {
  G.sm3 = G.ents.filter(b => b.sm3 && b.kind === 'b' && b.hp > 0 && b.sell < 0); // v6.2 SM-3 batteries (few)
  for (const p of G.projs) {
    if (p.delay > 0) { p.delay -= DT; continue; }
    if (G.sm3.length && !p.ic && SM3_KIND[p.w.type]) for (const b of G.sm3) if (foe(b.team, p.team) && dhypot(b.x - p.x, b.y - p.y) < SM3.r) { p.ic = 1; if (G.R() < SM3.p) { p.done = true; if (p.tgt) p.tgt.inc = Math.max(0, (p.tgt.inc || 0) - (p.est || 0)); G.events.push({ e: 'icpt', x: p.x, y: p.y, z: p.z, bx: b.x, by: b.y, team: b.team, big: !!p.w.big }); } break; }
    if (p.done) continue;
    if (p.home && p.tgt && p.tgt.hp > 0) { p.tx = p.tgt.x; p.ty = p.tgt.y; p.tz = p.tgt.kind === 'u' ? p.tgt.z : 0.5; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = dhypot(dx, dy), st = p.w.spd * DT;
    if (d <= st) { p.x = p.tx; p.y = p.ty; p.done = true; impact(p); continue; }
    p.x += dx / d * st; p.y += dy / d * st;
    if (p.w.arc) { const tot = dhypot(p.tx - p.sx, p.ty - p.sy) || 1, f = 1 - d / tot; p.z = 0.8 + dsin(f * Math.PI) * tot * 0.35; }
    else p.z += (p.tz - p.z) * Math.min(1, st / Math.max(d, 0.01));
  }
  G.projs = G.projs.filter(p => !p.done);
}
function respond(u, src) {
  if (!src || src.hp <= 0 || u.kind !== 'u' || u.hp <= 0 || u.order === 'move' || u.order === 'attack' || u.order === 'capture') return;
  const d = UT[u.t]; if (!d.wpn || (u.tgt && u.tgt.hp > 0 && u.tgt.tgt === u)) return;
  if (u.sg === 1 || u.sg === 3) return; const w = uW(u); if (!canHit(w, src) || DMG[w.type][armorOf(src)] <= 0.05) return;
  const dist = distTo(u, src); if (u.stance === 'hold' ? dist > w.rng + 0.5 : dist > d.sight + 6) return;
  if (!u.tgt || u.tgt.hp <= 0 || distTo(u, u.tgt) > w.rng) u.tgt = src;
}
function damage(t, amt, w, team, src, spl) {
  if (src && foe(t.team, team) && t.kind === 'u') { respond(t, src); if (G.time - (t.helpT || 0) > 1) { t.helpT = G.time; for (const o of G.ents) if (o.team === t.team && o.kind === 'u' && o !== t && !o.tgt && dhypot(o.x - t.x, o.y - t.y) < 5) respond(o, src); } }
  if (t.hp <= 0) return;
  if (src && src.kind && !isAir(src) && !isAir(t) && G.tier[idx(Math.floor(t.x), Math.floor(t.y))] > G.tier[idx(Math.floor(src.x), Math.floor(src.y))]) amt *= 0.75; // high ground
  if (src && src.kind === 'u' && src.nb && UT[src.t].marine) amt *= 1 + MAR.dmgN * src.nb; // v5.8 strength in numbers
  if (t.kind === 'u' && UT[t.t].marine) { if (src && src.kind === 'u' && !UT[src.t].air && UT[src.t].armor !== 'inf' && !MAR.counter[w.type]) amt *= MAR.veh; // v5.9 vehicle-weapon resistance
    if (src && src.kind === 'u' && (UT[src.t].air || (UT[src.t].armor === 'heavy' && UT[src.t].turret))) amt *= MAR.vsTank; // v6.2 +15% armor vs tanks and aircraft/bombers
    if (spl) amt *= spl === 2 ? MAR.splash : MAR.splashDirect; // v6.2 marines were wiped by splash
    if (MAR.take[w.type]) amt *= MAR.take[w.type]; else if (MAR.plated[w.type]) amt *= 1 - MAR.plated[w.type] - MAR.drN * (t.nb || 0); }
  if (src && src.dmgM) amt *= src.dmgM; if (t.armM) amt *= t.armM; // v7.0 Endless wave scaling / elite units
  t.hp -= amt * DMG[w.type][armorOf(t)];
  t.lastHitBy = team; t.hitT = G.time;
  const TP = G.players[t.team]; if (TP && G.time - (TP.alertT || -99) > 12) { TP.alertT = G.time; G.events.push({ e: 'attacked', team: t.team, x: t.x, y: t.y, harv: t.t === 'harv' }); }
  if (t.kind === 'u' && t.order === 'idle' && !t.tgt && foe(t.team, team)) t.underFire = G.time;
}
function impact(p) {
  const w = p.w; if (p.tgt) p.tgt.inc = Math.max(0, (p.tgt.inc || 0) - (p.est || 0));
  if (w.splash) {
    for (const o of G.ents) { if (!foe(o.team, p.team)) continue; if (isAir(o) !== (p.tz > 1.5)) continue;
      const d = distTo(p, o); if (d < w.splash) damage(o, w.dmg * (1 - 0.6 * d / w.splash), w, p.team, p.src, o === p.tgt ? 1 : 2); }
  } else if (p.tgt && p.tgt.hp > 0 && distTo(p, p.tgt) < 1.2) damage(p.tgt, w.dmg, w, p.team, p.src);
  G.events.push({ e: 'hit', x: p.x, y: p.y, z: p.z, kind: w.big ? 'mega' : w.type });
}
function turnTo(a, b, rate) { const d = angDiff(a, b); return Math.abs(d) <= rate ? b : a + Math.sign(d) * rate; }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function stepUnit(u) {
  if (u.xfT != null) { const d0 = UT[u.t]; u.z += ((d0.air ? 2.6 : 0) - u.z) * 0.08; if (G.time < u.xfT) return; u.xfT = null; if (!d0.air) u.z = 0; if (u.xfGo) { const g = u.xfGo; u.xfGo = null; orderMove([u], g.x, g.y, g.am); } } // resume the move order given before the transform // v7.0 Raijin transforming (immobile, no fire)
  const d = UT[u.t];
  if (d.kami) { kamiStep(u, d); if (u.hp <= 0) return; }
  if (u.t === 'harv') harvest(u);
  if (d.engineer && u.order === 'derrick') { const dk = G.derricks[u.dk]; if (!dk || dk.owner === u.team) { u.order = 'idle'; }
    else if (dhypot(u.x - dk.x, u.y - dk.y) < 1.3) { const prev = dk.owner; dk.owner = u.team; G.events.push({ e: 'derrick', team: u.team, prev, x: dk.x, y: dk.y }); u.hp = 0; u.sold = true; return; }
    else if (!u.path.length) setPath(u, dk.x, dk.y); }
  if (d.engineer && u.order === 'capture') {
    const t = u.tgt; if (!t || t.hp <= 0) { u.order = 'idle'; u.tgt = null; }
    else if (distTo(u, t) < 0.8) {
      if (t.team === u.team) { u.order = 'idle'; u.tgt = null; u.healT = t; u.anchor = { x: u.x, y: u.y }; return; } else { G.events.push({ e: 'capture', b: t, team: u.team }); t.team = u.team; t.tgt = null; G.bver++; }
      u.hp = 0; u.sold = true; return;
    } else if (!u.path.length) setPath(u, t.x, t.y);
  }
  if (u.order === 'board') { stepBoard(u); if (u.dead) return; }
  if (d.cap && u.order === 'unload' && !u.path.length) doUnload(u);
  if (false) { // v5.1: lava is purely visual (no damage)
 u.hp -= 26 * DT * 6 * (d.armor === 'inf' ? 1 : 1.4); u.lastHitBy = null; u.hitT = G.time; }
  if (d.heal) medic(u, d);
  if (d.medevac && (G.tick + u.id) % 15 === 0) medevacHeal(u);
  if (d.medevac && u.order === 'escort') escortStep(u, d); else if (u.spCap) u.spCap = null;
  if (d.marine && (G.tick + u.id) % 15 === 0) { let n = 0; for (const o of G.ents) if (o !== u && o.kind === 'u' && o.t === 'marine' && o.team === u.team && o.hp > 0 && dhypot(o.x - u.x, o.y - u.y) < MAR.rad && ++n >= MAR.cap) break; u.nb = n; }
  if (d.regen && u.hp < u.mhp) u.hp = Math.min(u.mhp, u.hp + d.regen * DT);
  if (d.air && u.hp < u.mhp && (G.tick + u.id) % 15 === 0 && (u.js === 'landed' || !u.path.length)) { for (const b of G.ents) if (b.t === 'airfield' && b.team === u.team && b.kind === 'b' && b.sell < 0 && b.hp > 0 && Math.abs(b.x - u.x) < 2.6 && Math.abs(b.y - u.y) < 2.1) { u.hp = Math.min(u.mhp, u.hp + u.mhp * 0.04); if (!(G.tick % 30)) G.events.push({ e: 'heal', x: u.x, y: u.y, src: b, rep: 1 }); break; } } // v6.2 Air Command repairs docked aircraft (8%/s)
  if (d.jet && jetStep(u, d)) return;
  if (d.siege && u.sg) siegeStep(u);
  if (u.order === 'move' && !u.path.length && !u.sgPath && !(u.wq && u.wq.length) && !d.air) { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; } // v6.2: an unreachable plain move must not leave a unit inert (no acquire while 'move')
  let engaged = !!(d.kami && u.tgt);
  if (d.wpn && !(d.jet && u.ammo <= 0) && !(u.sg === 1 || u.sg === 3)) { const w = uW(u); engaged = combat(u, w, Math.max(d.sight, w.rng + 0.5), !u.sg); }
  if (!engaged && u.order === 'attack') { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; }
  if (u.stance === 'hold' && u.guard && u.order === 'idle') u.anchor = u.guard;
  if (!engaged && u.order === 'idle' && !u.path.length && !u.sg && dhypot(u.x - u.anchor.x, u.y - u.anchor.y) > (u.stance === 'hold' ? 0.5 : 2.5) && u.t !== 'harv') { if (!G.r76) setPath(u, u.anchor.x, u.anchor.y);
    else if (G.time >= (u.anchT || 0)) { u.anchT = G.time + 1; setPath(u, u.anchor.x, u.anchor.y); const e = u.path[u.path.length - 1], thr = u.stance === 'hold' ? 0.5 : 2.5; // v7.6: an unreachable / occupied anchor no longer re-paths every tick (stuck idle armies + huge A* cost): settle on the nearest reachable point
      if (!e) { u.anchor = { x: u.x, y: u.y }; u.path = []; } else if (dhypot(e.x - u.anchor.x, e.y - u.anchor.y) > thr) u.anchor = { x: e.x, y: e.y }; } }
  if (!engaged && u.order === 'idle' && !u.path.length && u.face != null && u.stance === 'hold') { u.ang = turnTo(u.ang, u.face, 2 * DT); u.tang = turnTo(u.tang, u.face, 2 * DT); }
  { const am7 = G.m7 >= 2 && u.order === 'amove' && !u.amDest && u.anchor, ad = u.amDest || (am7 ? u.anchor : u.dest); if (!engaged && u.order === 'amove' && !u.path.length && ad && dhypot(u.x - ad.x, u.y - ad.y) > 1.5) { setPath(u, ad.x, ad.y); if (am7 && !u.path.length) { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; } } } // v7.6.7 (replay level m7>=2): a non-marine attack-move resumes to its goal after a kite/fight cleared its path (was: stood still forever), and gives up (idle) when the goal is unreachable // v5.9: marines resume their original move destination after a fight
  // movement
  if (u.path.length) {
    const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, dist = dhypot(dx, dy);
    const last = u.path.length === 1;
    const crowdArrive = last && u.grp > 1 && dist < 0.6 + 0.35 * Math.sqrt(u.grp) && u.blockedT > 0.6;
    if (dist < (last ? 0.12 : 0.4) || crowdArrive) { u.path.shift(); if (crowdArrive) u.path = [];
      if (!u.path.length && u.wq && u.wq.length) { const w = u.wq.shift(); u.order = w.am ? 'amove' : 'move'; u.anchor = { x: w.x, y: w.y }; u.amDest = w.am && UT[u.t].marine ? { x: w.x, y: w.y } : null; setPath(u, w.x, w.y); }
      else if (!u.path.length && (u.order === 'move' || (u.order === 'amove' && !(u.amDest && dhypot(u.x - u.amDest.x, u.y - u.amDest.y) > 1.5)))) { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; } }
    else {
      const want = datan2(dy, dx);
      const veh = d.armor !== 'inf';
      u.ang = turnTo(u.ang, want, (veh ? 4 : 10) * DT);
      const f = veh ? Math.max(0, dcos(angDiff(u.ang, want))) : 1;
      const sp = Math.min(dist, (u.spCap || d.sp) * DT * f * (d.armor === 'inf' && u.underFire && G.time - u.underFire < 2 ? 1.2 : 1));
      const nx = u.x + dcos(u.ang) * sp, ny = u.y + dsin(u.ang) * sp;
      const ox = u.x, oy = u.y;
      if (d.air || !blk(nx, ny)) { u.x = nx; u.y = ny; }
      else if (!blk(nx, u.y)) u.x = nx; else if (!blk(u.x, ny)) u.y = ny;
      if (!UT[u.t].turret && !u.tgt) u.tang = u.ang;
      u.prevP = { x: ox, y: oy };
    }
    if (u.prevP) { const prog = dhypot(u.x - u.prevP.x, u.y - u.prevP.y); u.blockedT = prog < d.sp * DT * 0.25 ? (u.blockedT || 0) + DT : 0; }
    u.moveT += DT;
    if (u.moveT > 2) { // stuck detection
      if (dhypot(u.x - u.lastP.x, u.y - u.lastP.y) < 0.3 && u.dest) { const dd = u.dest; u.stuckN = (u.stuckN || 0) + 1; if (u.stuckN > 3 && dhypot(u.x - dd.x, u.y - dd.y) < 3) { u.path = []; u.stuckN = 0; } else setPath(u, dd.x + (G.R() - 0.5) * u.stuckN, dd.y + (G.R() - 0.5) * u.stuckN); } else u.stuckN = 0;
      u.moveT = 0; u.lastP = { x: u.x, y: u.y };
    }
  } else if (UT[u.t].turret && !u.tgt) u.tang = turnTo(u.tang, u.ang, 2 * DT);
  if (d.jet) u.z += ((u.js === 'landed' ? 0.32 : 3.4) - u.z) * 0.05;
  else if (d.kami && u.dv != null) u.z = 0.3 + 2.3 * Math.min(1, u.dv / 3.5); // diving
  else if (d.air) u.z = 2.6 + dsin(G.time * 2 + u.id) * 0.1;
}
// ===== v7.0 Iran Shahed kamikaze drone =====
function kamiStep(u, d) {
  let t = u.tgt;
  if (t && (t.hp <= 0 || t.dead || isAir(t) || !foe(t.team, u.team))) { t = u.tgt = null; u.dv = null; if (u.order === 'attack') { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; u.path = []; } }
  if (!t && u.order !== 'move' && (G.tick + u.id) % 6 === 0) { // pick the densest cluster in sight (buildings second, walls last)
    let best = null, bs = 1e9;
    for (const o of G.ents) { if (o.hp <= 0 || !foe(o.team, u.team) || isAir(o)) continue; const dd = distTo(u, o); if (dd > d.sight || !visibleTo(u.team, o)) continue;
      let n = 0; if (o.kind === 'u') for (const q of G.ents) if (q !== o && q.kind === 'u' && q.hp > 0 && !isAir(q) && foe(q.team, u.team) && Math.abs(q.x - o.x) < 1.8 && Math.abs(q.y - o.y) < 1.8) n++;
      const sc = dd - 1.3 * Math.min(n, 8) + (o.kind === 'b' ? (o.t === 'wall' || o.t === 'gate' ? 7 : 1.5) : 0);
      if (sc < bs) { bs = sc; best = o; } }
    if (best) { u.tgt = t = best; u.order = 'attack'; }
  }
  if (!t) { u.dv = null; return; }
  const dd = distTo(u, t); u.dv = dd;
  if (dd < 0.5) { kamiBoom(u); return; }
  if (!u.path.length || (G.tick + u.id) % 3 === 0) u.path = [{ x: t.x, y: t.y }];
}
function kamiBoom(u) {
  const w = W.kami;
  for (const o of G.ents) { if (o.hp <= 0 || !foe(o.team, u.team) || isAir(o)) continue; const dd = distTo(u, o); if (dd < w.splash) damage(o, w.dmg * (1 - 0.5 * dd / w.splash), w, u.team, u, o === u.tgt ? 1 : 2); }
  G.events.push({ e: 'hit', x: u.x, y: u.y, z: 0.3, kind: 'mega' }, { e: 'kami', x: u.x, y: u.y, team: u.team });
  u.hp = 0; u.boom = 1;
}
// ===== v7.0 Japan Raijin transform (mech <-> jet) =====
function xform(u) {
  const d = UT[u.t]; if (!d || !d.xform || u.hp <= 0 || u.xfT != null || G.time < (u.xfCd || 0)) return false;
  const to = UT[d.xform];
  if (!to.air && blk(u.x, u.y)) { const f = nearFree(Math.floor(u.x), Math.floor(u.y), 6); u.x = f[0] + 0.5; u.y = f[1] + 0.5; } // landing over a wall/cliff: touch down beside it
  u.xfGo = (u.order === 'move' || u.order === 'amove') && u.anchor && dhypot(u.anchor.x - u.x, u.anchor.y - u.y) > 1.5 ? { x: u.anchor.x, y: u.anchor.y, am: u.order === 'amove' } : null;
  u.t = d.xform; u.xfT = G.time + XFORM.t; u.xfCd = G.time + XFORM.t + XFORM.cd; u.path = []; u.tgt = null; u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; u.wq = null; u.cd = Math.max(u.cd || 0, 0.3);
  G.events.push({ e: 'xform', u, air: !!to.air }); return true;
}
function airSlots(b) { return b.pads ? 8 : 4; }
function airBase(u) { // v6.2 Air Command: keep my dock slot; else nearest base with a free slot (else nearest, wait)
  if (u.dockB != null) { const b = byId(u.dockB); if (b && b.hp > 0 && b.sell < 0 && b.team === u.team && b.t === 'airfield' && u.dockK < airSlots(b)) return b; u.dockB = null; }
  let best = null, bd = 1e9, any = null, ad = 1e9;
  for (const e of G.ents) if (e.team === u.team && e.kind === 'b' && e.t === 'airfield' && e.sell < 0 && e.hp > 0) { const d = dhypot(e.x - u.x, e.y - u.y); if (d < ad) { ad = d; any = e; }
    if (d < bd && airFree(e, u) >= 0) { bd = d; best = e; } }
  if (best) { u.dockB = best.id; u.dockK = airFree(best, u); return best; }
  return any || G.ents.find(e => e.team === u.team && e.t === 'hq'); }
function airFree(b, u) { const used = new Set(); for (const o of G.ents) if (o !== u && o.kind === 'u' && o.hp > 0 && o.dockB === b.id) used.add(o.dockK); for (let k = 0; k < airSlots(b); k++) if (!used.has(k)) return k; return -1; }
function airPark(u, b) { if (b.t === 'airfield' && u.dockB === b.id) { const s = AIR_SLOTS[u.dockK] || [0, 0]; return { x: b.x + s[0], y: b.y + s[1] }; } if (b.t !== 'airfield') return { x: b.x + ((u.id % 3) - 1) * 0.8, y: b.y + 0.3 }; const a = u.id * 2.4; return { x: b.x + dcos(a) * 2.8, y: b.y + dsin(a) * 2.8, wait: 1 }; }
function jetStep(u, d) {
  const w = W[d.wpn]; if (u.ammo == null) u.ammo = w.ammo;
  if (u.js === 'rtb' || (u.ammo <= 0 && u.js !== 'landed')) {
    const b = airBase(u); if (!b) return false;
    const pk = airPark(u, b), px = pk.x, py = pk.y;
    if (u.js !== 'rtb') { u.js = 'rtb'; u.tgt = null; u.order = 'rtb'; u.wq = []; setPath(u, px, py); }
    if (dhypot(u.x - px, u.y - py) < 0.4 && !pk.wait) { u.js = 'landed'; u.path = []; u.order = 'idle'; u.reloadT = 0; u.anchor = { x: u.x, y: u.y }; }
    else if (!u.path.length) setPath(u, px, py);
    return false;
  }
  if (u.js === 'landed') {
    if (u.ammo < w.ammo) { u.reloadT = (u.reloadT || 0) + DT; if (u.reloadT > 2.5) { u.ammo++; u.reloadT = 0; } }
    if (u.path.length || u.order === 'attack' || u.order === 'amove') u.js = 'fly'; else { u.ang = turnTo(u.ang, -Math.PI / 2, DT); return u.ammo < w.ammo; }
  }
  u.js = 'fly';
  if (u.order === 'idle' && !u.tgt && !u.path.length && (G.tick + u.id) % 60 === 0) { const b = airBase(u); if (b && dhypot(b.x - u.x, b.y - u.y) > 2.5) u.js = 'rtb'; else if (b) { u.js = 'rtb'; } }
  return false;
}
// ---- v7.0.2 Seraph Medevac escort: ordered together with combat units it never leads — it trails 3-5 tiles behind the army centre
// (away from the destination/enemy) at the army's pace, slides in to put damaged allies inside its beam from the safest side,
// and backs off when hit or targeted. A Medevac ordered on its own (or carrying cargo) still goes straight where it is told.
function escortGroup(units, x, y, am, queue) {
  if (queue || !MEDEVAC.escort) return null; const meds = units.filter(u => UT[u.t].medevac && !(u.cargo && u.cargo.length)); if (!meds.length) return null;
  const grp = units.filter(u => !UT[u.t].medevac && UT[u.t].wpn && u.t !== 'harv'); if (!grp.length) return null;
  let cx = 0, cy = 0; grp.forEach(g => { cx += g.x; cy += g.y; }); cx /= grp.length; cy /= grp.length; const dl = dhypot(x - cx, y - cy) || 1;
  for (const m of meds) { m.order = 'escort'; m.esc = { ids: grp.map(g => g.id), x, y, am: !!am, fx: (x - cx) / dl, fy: (y - cy) / dl, retT: -9 }; m.wq = []; m.tgt = null; m.face = null; m.path = []; m.anchor = { x: m.x, y: m.y }; m.grp = 1; }
  return new Set(meds); }
function airThreats(u, R) { const r = [];
  for (const o of G.ents) { if (o.hp <= 0 || o.dead || !foe(o.team, u.team)) continue; let rng = 0;
    if (o.kind === 'u') { const dd = UT[o.t]; if (!dd.wpn || o.cargoOf) continue; const w = W[dd.wpn]; if (!w.air) continue; rng = w.rng + 0.6; }
    else { const bd = BT[o.t]; if (!bd || !bd.wpn || o.offline) continue; if (bd.squad) { for (const k of sqList(o)) if (W[k].air) rng = Math.max(rng, sqW(o, k).rng); } else { const w = defW(o); if (!w.air) continue; rng = w.rng; } rng += 0.5; }
    if (!rng || dhypot(o.x - u.x, o.y - u.y) > rng + R) continue; if (G.visT && o.kind === 'u' && !visibleTo(u.team, o)) continue; r.push({ x: o.x, y: o.y, r: rng, o }); }
  return r; }
const escDanger = (th, x, y) => { let s = 0; for (const t of th) { const k = t.r + 1.2 - dhypot(x - t.x, y - t.y); if (k > 0) s += k; } return s; };
function escortStep(u, d) {
  if ((G.tick + u.id) % 6) return; const E = u.esc;
  const grp = []; for (const id of E.ids) { const g = G.ents.find(e => e.id === id); if (g && g.hp > 0 && !g.dead && !g.cargoOf) grp.push(g); }
  if (!grp.length) { u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; u.spCap = null; u.esc = null; return; } // the army is gone: hold here
  E.ids = grp.map(g => g.id);
  let cx = 0, cy = 0, sp = 0; for (const g of grp) { cx += g.x; cy += g.y; sp += UT[g.t].sp; } cx /= grp.length; cy /= grp.length; sp /= grp.length;
  const th = airThreats(u, 12);
  // forward = towards the destination; once the army is there, towards the nearest threat
  { const dd = dhypot(E.x - cx, E.y - cy); let fx = E.fx, fy = E.fy;
    if (dd > 2) { fx = (E.x - cx) / dd; fy = (E.y - cy) / dd; }
    else { let bt = null, bd = 14; for (const t of th) { const k = dhypot(t.x - cx, t.y - cy); if (k < bd) { bd = k; bt = t; } } if (bt && bd > 0.5) { fx = (bt.x - cx) / bd; fy = (bt.y - cy) / bd; } }
    E.fx = fx; E.fy = fy; }
  const fx = E.fx, fy = E.fy;
  const targeted = th.some(t => t.o.tgt === u), hurt = G.time - (u.hitT || -9) < 1.5;
  if (targeted || hurt) E.retT = G.time;
  const danger = G.time - E.retT < 2.5;
  // damaged ally to heal: near the army, worst first (with neighbours in the same beam), skipping ones deep inside enemy AA cover while in danger
  let ht = null, hs = 0.03;
  for (const o of G.ents) { if (o.kind !== 'u' || o.team !== u.team || o.hp <= 0 || o.dead || o.cargoOf || isAir(o) || o.hp >= o.mhp * 0.97) continue; { const dc = dhypot(o.x - cx, o.y - cy); if (dc > 8 && !(dc < 14 && E.ids.includes(o.id))) continue; }
    let sc = 1 - o.hp / o.mhp; for (const q of G.ents) if (q !== o && q.kind === 'u' && q.team === u.team && !isAir(q) && q.hp > 0 && q.hp < q.mhp && dhypot(q.x - o.x, q.y - o.y) < MEDEVAC.r) sc += (1 - q.hp / q.mhp) * 0.5;
    sc -= escDanger(th, o.x, o.y) * (danger ? 0.25 : 0.05); if (sc > hs) { hs = sc; ht = o; } }
  const tr = 4; let ix = cx - fx * tr, iy = cy - fy * tr; const cand = [];
  if (ht && !(danger && escDanger(th, ht.x, ht.y) > 2.5)) { ix = ht.x - fx * 1.5; iy = ht.y - fy * 1.5; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; for (const rr of [1.1, 1.9]) cand.push([ht.x + dcos(a) * rr, ht.y + dsin(a) * rr]); } }
  else { if (danger) { let bt = null, bd = 1e9; for (const t of th) { const k = dhypot(t.x - u.x, t.y - u.y); if (k < bd) { bd = k; bt = t; } } if (bt) { const k = bd || 1; ix = u.x + (u.x - bt.x) / k * 3.5; iy = u.y + (u.y - bt.y) / k * 3.5; } else { ix = cx - fx * 5.5; iy = cy - fy * 5.5; } }
    cand.push([ix, iy]); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; for (const rr of [1.5, 3]) cand.push([ix + dcos(a) * rr, iy + dsin(a) * rr]); } }
  let best = null, bs = 1e9;
  for (const [px0, py0] of cand) { const px = Math.max(0.5, Math.min(MW - 0.5, px0)), py = Math.max(0.5, Math.min(MH - 0.5, py0));
    const ahead = (px - cx) * fx + (py - cy) * fy; // never lead the push
    const sc = escDanger(th, px, py) * 8 + dhypot(px - ix, py - iy) + Math.max(0, ahead + 1.5) * 1.5 + dhypot(px - u.x, py - u.y) * 0.1 + Math.max(0, dhypot(px - cx, py - cy) - 9) * 2;
    if (sc < bs) { bs = sc; best = [px, py]; } }
  const dm = dhypot(best[0] - u.x, best[1] - u.y);
  u.spCap = danger || dm > 3 ? null : Math.max(0.6, sp * 1.15); // match the army's pace once in its trailing slot
  if (dm > 0.4) setPath(u, best[0], best[1]); else u.path = [];
  u.anchor = { x: best[0], y: best[1] }; }
function medevacHeal(u) { // v6.3: heal beam onto damaged friendly ground units below/near; a target already healed this window by another craft is skipped (no stacking)
  const w = G.tick - (G.tick % 15); if (G.healW !== w) { G.healW = w; G.healed = new Set(); }
  const c = []; for (const o of G.ents) if (o.kind === 'u' && o.team === u.team && o.hp > 0 && o.hp < o.mhp && !isAir(o) && !o.dead) { const dd = dhypot(o.x - u.x, o.y - u.y); if (dd < MEDEVAC.r) c.push([dd, o]); }
  c.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id); u.beams = [];
  for (const [, o] of c) { if (u.beams.length >= MEDEVAC.max) break; if (G.healed.has(o.id)) continue; G.healed.add(o.id); o.hp = Math.min(o.mhp, o.hp + MEDEVAC.hps * 15 * DT); u.beams.push(o.id); } }
function medic(u, d) { // v6.2 Engineer: auto-repair damaged buildings (fast) and heal nearby ground units (slower); never used up
  if (u.order !== 'idle' && u.order !== 'amove') { u.healT = null; return; }
  if ((G.tick + u.id) % 15 === 0) { let best = null, bs = -1e9;
    for (const o of G.ents) { if (o.team !== u.team || o.hp <= 0 || o.hp >= o.mhp || o === u) continue;
      if (o.kind === 'b') { if (!d.rep || o.sell >= 0 || o.con || o.upT != null && false) continue; const dd = dhypot(o.x - u.x, o.y - u.y) - Math.max(o.w, o.h) / 2; if (dd < 7) { const sc = (1 - o.hp / o.mhp) * 12 - dd + 4; if (sc > bs) { bs = sc; best = o; } } }
      else if (!isAir(o)) { const dd = dhypot(o.x - u.x, o.y - u.y); if (dd < 6) { const sc = (1 - o.hp / o.mhp) * 10 - dd; if (sc > bs) { bs = sc; best = o; } } } }
    u.healT = best; }
  const o = u.healT; if (!o || o.hp <= 0 || o.hp >= o.mhp || o.dead) { u.healT = null; return; }
  const reach = o.kind === 'b' ? Math.max(o.w, o.h) / 2 + 0.9 : 1.6, dd = dhypot(o.x - u.x, o.y - u.y);
  if (dd > reach) { if (!u.path.length || (G.tick + u.id) % 20 === 0) { if (o.kind === 'b') { const a = datan2(u.y - o.y, u.x - o.x), r = Math.max(o.w, o.h) / 2 + 0.6; setPath(u, o.x + dcos(a) * r, o.y + dsin(a) * r); } else setPath(u, o.x, o.y); } }
  else { if (u.order === 'idle') { u.path = []; u.anchor = { x: u.x, y: u.y }; } o.hp = Math.min(o.mhp, o.hp + (o.kind === 'b' ? Math.max(d.rep, o.mhp * 0.015) : d.heal) * DT); if ((G.tick + u.id) % 15 === 0) G.events.push({ e: 'heal', x: o.x, y: o.y, src: u, rep: o.kind === 'b' }); }
}
function separate(hash) {
  for (const a of G.ents) {
    if (a.kind !== 'u' || a.hp <= 0) continue;
    const air = isAir(a), ra = UT[a.t].r, cx = Math.floor(a.x), cy = Math.floor(a.y);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const l = hash.get((gx << 8) | gy | (air ? 1 << 20 : 0)); if (!l) continue;
      for (const b of l) {
        if (b === a || b.id < a.id) continue;
        let dx = a.x - b.x, dy = a.y - b.y, dd = dhypot(dx, dy); const min = ra + UT[b.t].r;
        if (dd >= min) continue;
        if (dd < 1e-4) { dx = G.R() - 0.5; dy = G.R() - 0.5; dd = dhypot(dx, dy); }
        const soft = a.t === 'harv' && b.t === 'harv' ? 0.4 : 1, ov = (min - dd) * 0.5 * soft, am = a.path.length ? 0.3 : 1, bm = b.path.length ? 0.3 : 1, tot = am + bm;
        const pa = ov * am / tot * 2 * 0.5, pb = ov * bm / tot * 2 * 0.5;
        const ax = a.x + dx / dd * pa, ay = a.y + dy / dd * pa, bx = b.x - dx / dd * pb, by = b.y - dy / dd * pb;
        G.curTeam = a.team; if (air || !blk(ax, ay)) { a.x = ax; a.y = ay; }
        if (air || !blk(bx, by)) { b.x = bx; b.y = by; }
      }
    }
    G.curTeam = a.team; if (!air && blk(a.x, a.y)) { const f = nearFree(Math.floor(a.x), Math.floor(a.y), 4); a.x += (f[0] + 0.5 - a.x) * 0.2; a.y += (f[1] + 0.5 - a.y) * 0.2; }
    a.x = Math.max(0.2, Math.min(MW - 0.2, a.x)); a.y = Math.max(0.2, Math.min(MH - 0.2, a.y));
  }
}
// ---------- harvester ----------
function oreScore(u, i, refs) {
  const x = i % MW + 0.5, y = ((i / MW) | 0) + 0.5;
  let d = dhypot(x - u.x, y - u.y) * 0.6;
  let rd = 1e9; for (const r of refs) rd = Math.min(rd, dhypot(x - r.x, y - r.y)); d += Math.min(rd, 60) * 0.9;
  for (const o of G.ents) if (o !== u && o.t === 'harv' && o.team === u.team && o.oreT != null) {
    if (o.oreT === i) return 1e9; // reserved
    const ox = o.oreT % MW + 0.5, oy = ((o.oreT / MW) | 0) + 0.5; const dd = dhypot(ox - x, oy - y); if (dd < 3) d += (3 - dd) * 2.5; // spread across patches
  }
  if (G.danger && G.danger[u.team] && G.danger[u.team].some(p => dhypot(p.x - x, p.y - y) < 6)) d += 40;
  if (G.ore[i] < 200) d += 6;
  return d;
}
// v6.2 ore fields: connected groups of ore tiles (8-neighbour, 1-tile gaps bridged) -> per-team hauler cap and diamond ore
function ensureFields() { if (G.fid && G.fid.length === MW * MH) return; const N = MW * MH; G.fid = new Int16Array(N).fill(-1); G.dia = new Uint8Array(N); G.fields = [];
  for (let s = 0; s < N; s++) { if (!(G.oreMax[s] > 0) || G.fid[s] >= 0) continue; const id = G.fields.length, st = [s], tiles = []; G.fid[s] = id;
    while (st.length) { const i = st.pop(); tiles.push(i); const x = i % MW, y = (i / MW) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (G.oreMax[j] > 0 && G.fid[j] < 0) { G.fid[j] = id; st.push(j); } } }
    let cx = 0, cy = 0; for (const i of tiles) { cx += i % MW + 0.5; cy += ((i / MW) | 0) + 0.5; } cx /= tiles.length; cy /= tiles.length;
    let sd = 1e9; for (const [sx, sy] of G.starts) sd = Math.min(sd, dhypot(sx - cx, sy - cy)); const dia = sd > DIA_DIST; if (dia) for (const i of tiles) G.dia[i] = 1;
    G.fields.push({ id, x: cx, y: cy, n: tiles.length, dia }); } }
function fieldLoad(team, skip) { ensureFields(); const c = {}; for (const o of G.ents) if (o.t === 'harv' && o.team === team && o !== skip && o.fld != null && o.fld >= 0) c[o.fld] = (c[o.fld] || 0) + 1; return c; }
function nearestOre(u, pref) {
  const refs = G.ents.filter(e => e.team === u.team && (e.t === 'refinery' || e.t === 'cc'));
  const fl = fieldLoad(u.team, u), room = i => (fl[G.fid[i]] || 0) < FIELD_CAP; // v6.2: max 4 haulers per field; full/depleted -> nearest field with room
  if (pref != null && G.ore[pref] > 0 && room(pref) && oreScore(u, pref, refs) < 1e9) return pref;
  let b = -1, bd = 1e9;
  for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 30 && room(i)) { const d = oreScore(u, i, refs) + (G.fid[i] === u.fld ? -4 : 0); if (d < bd) { bd = d; b = i; } }
  return b;
}
function harvest(h) {
  const P = G.players[h.team], CAP = HARV_CAP; ensureFields();
  switch (h.hst) {
    case 'manual': if (!h.path.length) h.hst = h.load >= CAP ? 'ret' : 'idle'; break;
    case 'idle': {
      h.oreT = null;
      if (h.load >= CAP) { h.hst = 'ret'; break; }
      if ((G.tick + h.id) % 10) break;
      const i = nearestOre(h, h.prefOre); h.prefOre = null; if (i < 0) { h.fld = null; if (h.load > 0) h.hst = 'ret'; break; }
      h.oreT = i; h.fld = G.fid[i]; h.toT = G.time; setPath(h, i % MW + 0.5, ((i / MW) | 0) + 0.5); h.order = 'idle'; h.hst = 'toOre'; break;
    }
    case 'toOre': {
      if (h.oreT == null || G.ore[h.oreT] <= 0) { h.hst = 'idle'; break; }
      const tx = h.oreT % MW + 0.5, ty = ((h.oreT / MW) | 0) + 0.5;
      if (dhypot(h.x - tx, h.y - ty) < 1.1) { h.path = []; h.hst = 'mine'; h.ang = turnTo(h.ang, datan2(ty - h.y, tx - h.x), 1); break; }
      if (G.time - h.toT > 15) { h.hst = 'idle'; break; }
      if (!h.path.length) setPath(h, tx, ty);
      break;
    }
    case 'mine': {
      const i = h.oreT;
      if (i == null) { h.hst = 'idle'; break; }
      if (G.ore[i] > 0) { const a = Math.min(G.ore[i], MINE_RATE * DT, CAP - h.load); G.ore[i] -= a; h.load += a; h.loadV = (h.loadV || 0) + a * (G.rich[i] ? 1.8 : 1) + (G.dia && G.dia[i] ? a * DIA_BONUS / (HARV_CAP * ORE_VALUE) : 0); if (G.ore[i] <= 0) { G.ore[i] = 0; G.oreVer++; } }
      if (h.load >= CAP - 0.01) { h.hst = 'ret'; h.oreT = null; break; }
      if (G.ore[i] <= 0) { // next patch nearby (unreserved)
        const x = i % MW, y = (i / MW) | 0, refs = G.ents.filter(e => e.team === h.team && (e.t === 'refinery' || e.t === 'cc')); let n = -1, bs = 1e9;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = idx(x + dx, y + dy); if (inb(x + dx, y + dy) && G.ore[j] > 30 && G.fid[j] === h.fld) { const sc = oreScore(h, j, refs); if (sc < bs) { bs = sc; n = j; } } }
        if (n >= 0) { h.oreT = n; h.toT = G.time; h.hst = 'toOre'; setPath(h, n % MW + 0.5, ((n / MW) | 0) + 0.5); } else { h.hst = h.load > CAP * 0.3 ? 'ret' : 'idle'; h.oreT = null; }
      }
      break;
    }
    case 'ret': {
      let r = null, bd = 1e9; for (const e of G.ents) if (e.team === h.team && (e.t === 'refinery' || e.t === 'cc') && e.sell < 0 && G.time - e.born > 1.5) { const busy = e.dockBy && e.dockBy !== h.id && byId(e.dockBy) ? 8 : 0; const d = dhypot(e.x - h.x, e.y - h.y) + busy; if (d < bd) { bd = d; r = e; } }
      if (!r) break;
      const dock = { x: r.x, y: r.ty + r.h + 0.5 };
      const free = !r.dockBy || r.dockBy === h.id || !byId(r.dockBy) || byId(r.dockBy).hst !== 'unload' && byId(r.dockBy).dockR !== r.id;
      const dd = dhypot(h.x - dock.x, h.y - dock.y);
      if (free) { r.dockBy = h.id; h.dockR = r.id; }
      if (free && dd < 0.9) { h.hst = 'unload'; h.path = []; h.ang = -Math.PI / 2; }
      else if (!free && dd < 3) { h.path = []; } // wait in line
      else if (!h.path.length || G.tick % 45 === h.id % 45) setPath(h, free ? dock.x : dock.x + 2.5, free ? dock.y : dock.y + 1.5);
      break;
    }
    case 'unload': {
      const a = Math.min(h.load, UNLOAD_RATE * DT), vr = h.load > 0 ? (h.loadV || h.load) / h.load : 1; h.loadV = Math.max(0, (h.loadV || 0) - a * vr); h.load -= a;
      const mult = ORE_VALUE * vr; /* v4.3: equal economy for everyone */ P.cr += a * mult; P.stats.mined += a * mult;
      if (h.load <= 0) { h.load = 0; h.hst = 'idle'; const r = byId(h.dockR); if (r && r.dockBy === h.id) r.dockBy = null; h.dockR = null; h.path = []; setPath(h, h.x, h.y + 1.5); }
      break;
    }
  }
}
// ---------- fog (per team) ----------
function updFog() {
  const done = new Set();
  for (let t = 0; t < G.players.length; t++) {
    const v = G.visT[t], sn = G.seenT[t]; if (done.has(v)) continue; done.add(v); v.fill(0);
    for (const e of G.ents) {
      if (foe(e.team, t)) continue;
      const air = e.kind === 'u' && UT[e.t].air, r = (e.kind === 'b' ? (BT[e.t].sight || 5) + e.w / 2 : UT[e.t].sight) * (G.weather && G.weather.on && !air ? 0.6 : 1), cx = e.x, cy = e.y, r2 = r * r, myT = air ? 9 : G.tier[idx(Math.floor(cx), Math.floor(cy))];
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MH - 1, cy + r); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MW - 1, cx + r); x++) { const dd = (x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy);
          if (dd <= r2 && (G.tier[idx(x, y)] <= myT || dd < 4)) { v[idx(x, y)] = 1; sn[idx(x, y)] = 1; } }
    }
    if (!G.opts.fog) { v.fill(1); sn.fill(1); } // v5.7.2: fog off = every team sees everything (was team 0 only)
  }
}
function visibleTo(team, e) {
  if (!foe(e.team, team)) return true;
  if (e.kind === 'u' && UT[e.t].stealthy && G.time - (e.lastFire || -9) > 2) { for (const o of G.ents) if (!foe(o.team, team) && Math.abs(o.x - e.x) < 3.2 && Math.abs(o.y - e.y) < 3.2 && dhypot(o.x - e.x, o.y - e.y) < 3.2) return true; return false; }
  const V = G.visT[team], S = G.seenT[team];
  if (e.kind === 'b') { for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) if (S[idx(x, y)]) return true; return false; }
  return !!V[idx(Math.floor(e.x), Math.floor(e.y))];
}
function visibleTo0(e) { return G.spectate || visibleTo(ME, e); }
function vis0(i) { return G.spectate || !!G.vis[i]; }
function seen0(i) { return G.spectate || !!G.seen[i]; }
// ---------- defense upgrades ----------
const _defWC = {};
// ---------- v6.2 research tracks + per-unit weapon (siege / research) ----------
function resCat(e) { if (e.kind === 'b') return BT[e.t].wpn ? 'def' : null; const d = UT[e.t]; if (d.armor === 'inf') return 'inf'; if (!d.wpn) return null; if (d.air) return 'air'; if (d.siege || W[d.wpn].arc) return 'arty'; return 'tank'; }
function rsLvl(team, c) { const P = c && G.players && G.players[team]; return P && P.rs ? P.rs[c] || 1 : 1; }
function resL3ok(team) { let n = 0; for (const e of G.ents) if (e.team === team && e.kind === 'b' && e.sell < 0 && e.hp > 0 && (e.t === 'tech' && ++n >= 2 || e.t === 'silo' || e.t === 'airfield')) return true; return false; }
function researchInfo(team, c) { const l = rsLvl(team, c); if (l >= 3) return null; const L = RES.lv[l + 1]; return { cost: L.cost, gas: L.gas, time: L.time, next: l + 1, busy: G.ents.some(e => e.team === team && e.upKind === 'rs' && e.upCat === c && e.upT != null), lock: l + 1 === 3 && !resL3ok(team) }; }
function researchB(b, c) {
  if (!b || b.t !== 'tech' || b.upT != null || b.sell >= 0 || b.hp <= 0 || G.time - b.born < 1.5 || !RES.nm[c]) return false; const P = G.players[b.team], i = researchInfo(b.team, c);
  if (!i || i.busy || i.lock || P.cr < i.cost || P.gas < i.gas) return false; P.cr -= i.cost; P.gas -= i.gas; b.upT = G.time; b.upDur = i.time; b.upKind = 'rs'; b.upCat = c; return true; }
function resDone(team, c) { const P = G.players[team]; P.rs = P.rs || {}; const o = RES_M[P.rs[c] || 1]; P.rs[c] = (P.rs[c] || 1) + 1; const m = RES_M[P.rs[c]];
  for (const e of G.ents) if (e.team === team && e.hp > 0 && resCat(e) === c) { const base = e.kind === 'b' ? (e.bal ? BALLISTA.hp : BT[e.t].hp) : UT[e.t].hp; e.mhp = Math.round(base * m); e.hp = Math.min(e.mhp, e.hp * m / o); } }
const _uWC = {};
function uW(u) { const d = UT[u.t]; if (!d.wpn) return null; const l = rsLvl(u.team, resCat(u)), sg = u.sg === 2 ? 1 : 0; if (l === 1 && !sg) return W[d.wpn]; const k = d.wpn + l + sg;
  if (!_uWC[k]) { const b = W[d.wpn]; _uWC[k] = Object.assign({}, b, { dmg: Math.round(b.dmg * RES_M[l]) }, sg ? { rng: SIEGE.rng, splash: SIEGE.splash } : {}); } return _uWC[k]; }
function siegeStep(u) { // 0 mobile, 1 deploying, 2 sieged, 3 packing. Movement is held (path stashed) until packed.
  if (u.path.length && u.sgHold && u.sg === 2 && u.order !== 'move') { u.path = []; if (u.order === 'amove') u.order = 'idle'; } // bot-held siege: squad attack-moves don't unpack it (the bot unpacks on its own rule)
  if (u.path.length) { u.sgPath = u.path; u.sgOrd = u.order; u.path = []; if (u.sg === 1 || u.sg === 2) { u.sg = 3; u.sgT = G.time; } }
  if (u.sg === 1 && G.time - u.sgT >= SIEGE.dep) { u.sg = 2; G.events.push({ e: 'siege', u, on: 1 }); }
  else if (u.sg === 3 && G.time - u.sgT >= SIEGE.pack) { u.sg = 0; G.events.push({ e: 'siege', u, on: 0 }); if (u.sgPath) { u.path = u.sgPath; u.order = u.sgOrd || 'move'; } u.sgPath = null; } }
function siegeToggle(u, want) { if (!u || !UT[u.t].siege || u.hp <= 0) return false; const on = want == null ? !(u.sg === 1 || u.sg === 2) : !!want;
  if (on && !u.sg) { u.sg = 1; u.sgT = G.time; u.path = []; u.sgPath = null; u.wq = []; if (u.order === 'move' || u.order === 'amove') u.order = 'idle'; u.anchor = { x: u.x, y: u.y }; return true; }
  if (!on && (u.sg === 1 || u.sg === 2)) { u.sgHold = false; u.sg = 3; u.sgT = G.time; u.sgPath = null; return true; } return false; }
function defW(b) { if (b.bal) return sqW(b, 'balS'); const d = BT[b.t], P = G.players[b.team], l = b.lvl || 1, rl = rsLvl(b.team, 'def'), k = d.wpn + l + 'r' + rl;
  if (!_defWC[k]) { const base = W[d.wpn]; _defWC[k] = Object.assign({}, base, { dmg: Math.round(base.dmg * UPG_DMG[l - 1] * RES_M[rl]), rng: base.rng + UPG_RNG[l - 1] + (rl >= 3 ? 0.5 : 0) }); }
  return _defWC[k]; }
function upgradeInfo(b) {
  if (b.t === 'hq' || b.t === 'cc') { if (b.sm3 || b.upT != null || !hasBuilt(b.team, 'tech')) return null; return { cost: SM3.cost, gas: SM3.gas, time: SM3.time, kind: 'sm3' }; }
  if (b.t === 'airfield') { if (b.pads || b.upT != null) return null; return { cost: AIRPADS.cost, gas: 0, time: AIRPADS.time, kind: 'pads' }; }
  if (b.t === 'gtower') { if (b.bal || b.upT != null || !hasBuilt(b.team, BALLISTA.req)) return null; return { cost: BALLISTA.cost, gas: BALLISTA.gas, time: BALLISTA.time, kind: 'bal' }; } // v7.0.2 China Ballista Tower
  const u = UPG[b.t]; if (!u) return null; const l = b.lvl || 1; if (l >= 3) return null; return { cost: u[l - 1][0], time: u[l - 1][1], gas: u[l - 1][2] || 0, kind: 'lvl', next: l + 1 };
}
function upgradeB(b) {
  if (b.upT != null || b.sell >= 0 || G.time - b.born < 1.5) return false; const P = G.players[b.team], inf = upgradeInfo(b); if (!inf || P.cr < inf.cost || P.gas < (inf.gas || 0)) return false;
  if (inf.kind === 'def' && G.ents.some(e => e.team === b.team && e.upKind === 'def' && e.upT != null)) return false;
  P.cr -= inf.cost; P.gas -= inf.gas || 0; b.upT = G.time; b.upDur = inf.time; b.upKind = inf.kind; return true;
}
// ---------- formations & stances ----------
const ROWOF = t => { const d = UT[t]; if (t === 'arty' || t === 'aa') return 2; if (d.armor === 'inf') return 1; if (d.air) return 1; return 0; };
function formationSlots(units, cx, cy, face) {
  const rows = [[], [], []]; for (const u of units) rows[ROWOF(u.t)].push(u);
  const fx = dcos(face), fy = dsin(face), px = -fy, py = fx, out = [];
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
