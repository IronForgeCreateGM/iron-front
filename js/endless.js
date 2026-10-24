'use strict';
// ===== v7.0 ENDLESS MODE =====
// Last Stand + Tower Defense on a Hellgate-style desert map. 1-4 defenders (humans and/or ally bots) hold the
// western plateau; the Horde pours in from the east through four wallable mountain passes, wave after wave, forever.
// All sim state lives in G.end and uses G.R / d-math only (deterministic lockstep). UI helpers at the bottom.
const END = {
  brk0: 45, brk: 25, brkBoss: 35,   // build breaks (s): first, normal, before a boss wave
  trickle: 0.25,                    // seconds between spawns
  cap: 80,                          // max horde units per wave (frame-rate cap; past it units just get tougher)
  pathBudget: 16,                   // v7.0.3: max horde re-plans (A*) per AI pass
  bossAttrT: 420, bossAttr: 0.01,   // v7.0.3: a boss still alive 7 min into its wave starts to wither too (no wave can stall forever)
  skipPay: 4,                       // $ per second of break skipped (paid to every defender)
  clearBase: 300, clearPer: 60,     // wave-clear bonus = 300 + 60 * wave (each defender)
  bounty: 0.25, bountyGrow: 0.02,   // kill bounty = 25% of unit cost * (1 + 2% per wave) to the killer
  bossClean: { t: 90, loss: 0.12 }, // boss clean-clear: under 90 s, no structures lost, <12% structure HP lost
  bossCash: 1500, bossCashPer: 150,
  attrT: 210, attr: 0.02,           // after 210 s a wave's stragglers lose 2% max HP per second
};
// [type, first wave, slot cost, weight(n)]
const END_POOL = [
  ['rifle', 1, 1, n => n < 6 ? 6 : n < 12 ? 3 : 2],
  ['rocketeer', 2, 1, n => 3],
  ['sniper', 3, 1, n => 1],
  ['scout', 4, 1.5, n => n < 12 ? 2.5 : 1.5],
  ['heavy', 6, 2.5, n => 3],
  ['arty', 8, 2.5, n => 1.2],
  ['gunship', 9, 2, n => 2],
  ['drone', 9, 0.8, n => 2],
  ['marine', 12, 1.2, n => 2],
  ['kommando', 12, 3, n => 0.8],
  ['raijin', 12, 3.5, n => 0.8],
  ['titan', 13, 4, n => 0.9],
  ['tsar', 15, 5, n => 0.7],
];
const END_LANES = [14, 36, 60, 82]; // pass centre lines (y)
const endHpM = n => 1 + 0.09 * (n - 1) + 0.0025 * (n - 1) * (n - 1);
const endDmgM = n => 1 + 0.04 * (n - 1);
const endArmM = n => 1 / (1 + 0.02 * (n - 1));

// lobby slots -> defenders (ally 0) + the Horde (ally 1, last slot)
function endlessSlots(slots) {
  const d = (slots && slots.length ? slots : [{ ai: false, ally: 0 }]).filter(s => !s.horde).slice(0, 4).map(s => Object.assign({}, s, { ally: 0 }));
  d.forEach((s, k) => { s.start = d.length === 1 ? 4 : k; });
  d.push({ ai: true, horde: true, ally: 1, fac: 'rus', diff: 'normal', start: 5, name: 'The Horde', color: 'red' });
  return d;
}

// ---------- map: "Hellgate Last Stand" 96x96 ----------
function genEndless(R) {
  const N = MW * MH;
  const nz = (() => { const s = 7, w = Math.ceil(MW / s) + 2, g = []; for (let i = 0; i < w * w * 3; i++) g.push(R()); const sm = t => t * t * (3 - 2 * t);
    return (x, y, o) => { x /= s; y /= s; const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), v = (a, b) => g[(o * w * w + b * w + a) % g.length];
      return (v(xi, yi) * (1 - fx) + v(xi + 1, yi) * fx) * (1 - fy) + (v(xi, yi + 1) * (1 - fx) + v(xi + 1, yi + 1) * fx) * fy; }; })();
  const each = (cx, cy, r, f) => { for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(MH - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(MW - 1, cx + r); x++) { const d = dhypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= r) f(idx(x, y), d, x, y); } };
  const fieldC = (cx, cy, r, rich) => each(cx, cy, r + 0.3, i => { G.map[i] = 0; G.ore[i] = (rich ? 560 : 420) * ORE_MULT * (0.8 + 0.4 * R()); G.rich[i] = rich ? 1 : 0; G.mud[i] = 0; });
  const clearC = (cx, cy, r) => each(cx, cy, r, i => { G.map[i] = 0; G.mud[i] = 0; G.ore[i] = 0; });
  const path = (pts, r, f) => { for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], n = Math.ceil(dhypot(x1 - x0, y1 - y0) * 2); for (let j = 0; j <= n; j++) each(x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n, r, f); } };
  G.mud = new Uint8Array(N); G.wadi = new Uint8Array(N); G.rim = new Uint8Array(N);
  G.vents = []; const vent = (x, y) => { clearC(x + 0.5, y + 0.5, 1.6); G.vents.push([x, y]); };
  G.sites = []; G.dkPos = []; const dk = (x, y) => G.dkPos.push([x, y]);
  G.monument = null; G.weather = null; G.ruins = null; G.crown = null; G.desert = true; G.outposts = [];
  const RX0 = 35, RX1 = 45; // the ridge
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = idx(x, y), n = nz(x, y, 0), m = nz(x, y, 1);
    G.elev[i] = n; G.map[i] = 0;
    const rx0 = RX0 + (nz(x, y, 2) - 0.5) * 3, rx1 = RX1 + (nz(x, y, 2) - 0.5) * 3;
    if (x < rx0) { G.lvl[i] = 1; if (n > 0.88 && x > 4) G.map[i] = 1; }
    else if (x <= rx1) { G.map[i] = 1; G.lvl[i] = 1; }
    else if ((n > 0.8 || m > 0.87) && x < 84) G.map[i] = 1; // mesas / rock spurs
    if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) G.map[i] = 1; }
  // four passes through the ridge: 5 tiles wide, ramping from the plateau (lvl 1) down to the desert (lvl 0)
  for (const py of END_LANES) for (let x = RX0 - 5; x <= RX1 + 5; x++) { const cy = py + 1.2 * dsin((x - RX0) * 0.5); for (let y = Math.floor(cy - 5); y <= cy + 5; y++) { if (!inb(x, y)) continue; const i = idx(x, y), d = Math.abs(y + 0.5 - cy);
      if (d < 2.6) G.map[i] = 0; else if (x >= RX0 - 1 && x <= RX1 + 1 && d < 4.5) G.map[i] = 1;
      if (x >= RX0 - 2 && d < 4.5) G.lvl[i] = Math.max(0, Math.min(1, (RX1 + 2 - x) / (RX1 - RX0 + 4))); } }
  // starts: 0-3 = co-op bases, 4 = solo base (centre), 5 = the Horde staging ground (east)
  G.starts = [[13.5, 34.5], [13.5, 62.5], [25.5, 14.5], [25.5, 82.5], [15.5, 48.5], [90.5, 48.5]];
  for (const [sx, sy] of G.starts.slice(0, 5)) clearC(sx, sy, 7.5);
  clearC(20, 48, 10);
  // horde staging strip + desert lanes from the strip to every pass mouth
  for (let y = 3; y < MH - 3; y++) for (let x = 84; x < MW - 3; x++) { const i = idx(x, y); G.map[i] = 0; G.ore[i] = 0; G.lvl[i] = 0; }
  END_LANES.forEach((py, k) => path([[RX1 + 2, py], [58, py + (k < 2 ? 3 : -3)], [72, py + (k % 2 ? -4 : 4)], [86, py]], 2.2, i => { G.map[i] = 0; G.mud[i] = 0; }));
  // dry wadi snaking N-S through the no-man's-land
  path([[64, 3], [68, 20], [62, 38], [66, 52], [70, 66], [63, 80], [66, 93]], 2.0, (i) => { G.map[i] = 0; G.wadi[i] = 1; G.elev[i] *= 0.4; });
  // ruined mud-brick compounds
  const compound = (x0, y0, w, h, gates) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { if (!inb(x, y)) continue; const i = idx(x, y), edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      G.ore[i] = 0; if (edge && !gates.some(([gx, gy]) => Math.abs(x - gx) <= 1 && Math.abs(y - gy) <= 1)) { G.map[i] = 1; G.mud[i] = 1; } else { G.map[i] = 0; G.mud[i] = 0; } } };
  compound(74, 24, 6, 5, [[76, 28]]); compound(75, 68, 6, 5, [[77, 68]]); compound(54, 44, 5, 5, [[54, 46], [58, 46]]);
  // ore: home fields on the plateau, rich (diamond) fields out in the desert
  fieldC(5.5, 30, 2.0); fieldC(5.5, 40, 1.7); fieldC(5.5, 56, 1.7); fieldC(5.5, 67, 2.0); fieldC(18, 6, 1.8); fieldC(32, 6, 1.5); fieldC(18, 90, 1.8); fieldC(32, 90, 1.5);
  fieldC(28, 48, 1.6); fieldC(54, 25, 1.6, 1); fieldC(54, 72, 1.6, 1); fieldC(64, 48, 1.5, 1);
  vent(21, 39); vent(21, 57); vent(7, 18); vent(7, 78); vent(31, 24); vent(31, 72);
  dk(31, 48); dk(52, 48); dk(52, 9); dk(52, 87);
  for (const s of G.starts.slice(0, 5)) { each(s[0], s[1], 4, i => { G.map[i] = 0; G.ore[i] = 0; G.mud[i] = 0; }); G.sites.push({ x: s[0], y: s[1], k: 'main' }); }
  G.sites.push({ x: 56, y: 30, k: 'nat' }, { x: 56, y: 66, k: 'nat' });
  for (let i = 0; i < N; i++) { G.forest[i] = 0; G.tier[i] = Math.round(G.lvl[i]); if (G.map[i] !== 1) G.mud[i] = 0; }
  // flood fill from the solo base: anything unreachable becomes rock (no sealed pockets)
  const seen = new Uint8Array(N), st = [idx(Math.floor(G.starts[4][0]), Math.floor(G.starts[4][1]))]; seen[st[0]] = 1;
  while (st.length) { const c = st.pop(), x = c % MW, y = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (!seen[n] && G.map[n] === 0) { seen[n] = 1; st.push(n); } } }
  for (let i = 0; i < N; i++) if (G.map[i] === 0 && !seen[i]) { G.map[i] = 1; G.ore[i] = 0; }
  G.six = true; G.oreMax = Float32Array.from(G.ore);
  G.passes = END_LANES.map(y => ({ x: RX0 - 2.5, y: y + 0.5, ex: RX1 + 3, ey: y + 0.5 }));
  // render-only decoration hints for buildDesert (wrecks in the no-man's-land, sandbag nests + watchtowers at the passes)
  G.deco = { wr: [47, 36, 5, 86], fixed: [[49, 16], [50, 58], [48, 80], [47, 37]],
    nests: END_LANES.flatMap(y => [[RX0 - 3.5, y - 3.6, 1.2, -0.2, 2.6, 2], [RX0 - 3.5, y + 4.4, 1.2, -2.6, 0.2, 2]]),
    towers: END_LANES.map((y, k) => [RX0 + 3 + (k % 2), y + (k % 2 ? 5.5 : -5)]) };
}

// ---------- director ----------
function endlessInit() {
  const H = G.players.find(P => P.horde);
  G.end = { wave: 0, phase: 'break', next: G.time + END.brk0, brk: END.brk0, spawnQ: [], spawnT: 0, alive: 0, score: 0, kills: 0, horde: H ? H.team : G.players.length - 1,
    votes: {}, blost: 0, bhp0: 0, bids: [], waveStart: 0, boss: false, lastReward: null, lw: [1, 1, 1, 1] };
  if (H) { H.cr = 0; H.gas = 0; } // the Horde never builds; it gets no economy at all
}
const endDefenders = () => G.players.filter(P => !P.horde && !P.out);
const endWallish = t => t === 'wall' || t === 'gate' || t === 'gtower';
function endlessCompose(n) {
  const E = G.end, defs = Math.max(1, G.players.filter(P => !P.horde).length);
  const boss = n % 10 === 0, q = [];
  let slots = (4 + 1.6 * n) * (1 + 0.55 * (defs - 1)) * (boss ? 0.5 : 1);
  if (boss) q.push('colossus');
  const pool = END_POOL.filter(p => n >= p[1]);
  const tot = pool.reduce((a, p) => a + p[3](n), 0);
  let guard = 0;
  while (slots > 0.5 && q.length < END.cap && guard++ < 400) {
    let r = G.R() * tot, pick = pool[0];
    for (const p of pool) { r -= p[3](n); if (r <= 0) { pick = p; break; } }
    q.push(pick[0]); slots -= pick[2];
  }
  // lane weights for this wave (some waves lean on one or two passes)
  E.lw = END_LANES.map(() => 0.3 + G.R() * (G.R() < 0.35 ? 2.5 : 1));
  return q;
}
function endlessStartWave() {
  const E = G.end, n = ++E.wave;
  E.phase = 'wave'; E.waveStart = G.time; E.votes = {}; E.boss = n % 10 === 0; E.spawnQ = endlessCompose(n); E.spawnT = G.time; E.total = E.spawnQ.length; E.blost = 0;
  const bs = G.ents.filter(e => e.kind === 'b' && !e.dead && e.hp > 0 && G.players[e.team] && G.players[e.team].ally === 0 && !endWallish(e.t));
  E.bids = bs.map(b => b.id); E.bhp0 = bs.reduce((a, b) => a + b.mhp, 0) || 1;
  G.events.push({ e: 'wave', n, boss: E.boss, count: E.total });
}
function endlessSpawn(t) {
  const E = G.end, n = E.wave, H = E.horde;
  let r = G.R() * E.lw.reduce((a, b) => a + b, 0), lane = 0; for (let k = 0; k < 4; k++) { r -= E.lw[k]; if (r <= 0) { lane = k; break; } }
  if (t === 'colossus') lane = 1 + (G.R() < 0.5 ? 1 : 0);
  const ly = END_LANES[lane], x = 87 + G.R() * 5, y = Math.max(4, Math.min(MH - 5, ly + 0.5 + (G.R() - 0.5) * 6));
  const u = addU(t, H, x, y), d = UT[t];
  u.hp = u.mhp = Math.round(d.hp * endHpM(n)); u.dmgM = endDmgM(n); u.armM = endArmM(n); u.ew = n; u.lane = lane; u.ang = u.tang = Math.PI;
  if (d.boss) { u.boss = 1; G.events.push({ e: 'boss', u }); }
  const ps = G.passes[lane], tg = hordeTarget(u);
  if (d.air) { if (tg) orderMove([u], tg.x, tg.y, true); }
  else orderMove([u], ps.x - 2, ps.y, true);
  return u;
}
function hordeTarget(u) { // nearest defender structure (walls last), else nearest defender unit
  let best = null, bd = 1e9;
  for (const e of G.ents) { if (e.hp <= 0 || e.dead || e.team === u.team || !G.players[e.team] || G.players[e.team].ally !== 0) continue; if (e.kind !== 'b' || endWallish(e.t)) continue;
    const d = dhypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
  if (best) return best;
  for (const e of G.ents) { if (e.hp <= 0 || e.dead || e.kind !== 'u' || !G.players[e.team] || G.players[e.team].ally !== 0) continue; const d = dhypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function endHordeAI() {
  const E = G.end, H = E.horde, slice = (G.tick / 30 | 0) % 2;
  let budget = END.pathBudget; // v7.0.3: cap re-plans per pass (each is a full-map A*); the rest wait for the next pass
  for (const u of G.ents) {
    if (budget <= 0) break;
    if (u.team !== H || u.kind !== 'u' || u.hp <= 0 || (u.id & 1) !== slice) continue;
    if (u.tgt && u.tgt.hp > 0 && !u.tgt.dead) continue;
    if (UT[u.t].kami && u.order !== 'idle') continue;
    const busy = u.path.length && (u.blockedT || 0) < 1.5;
    if (busy) continue;
    const tg = hordeTarget(u); if (!tg) continue; budget--;
    if (isAir(u)) { if (UT[u.t].kami) orderAttack([u], tg); else orderMove([u], tg.x, tg.y, true); continue; }
    orderMove([u], tg.x, tg.y, true);
    const end = u.path[u.path.length - 1], reach = 2.5 + (tg.w || 0);
    if (!end || dhypot(end.x - tg.x, end.y - tg.y) > reach) { // walled off: break through the nearest wall / tower
      const ref = end || u; let wb = null, wd = 1e9;
      for (const e of G.ents) { if (e.kind !== 'b' || e.hp <= 0 || e.dead || !G.players[e.team] || G.players[e.team].ally !== 0) continue; const d = dhypot(e.x - ref.x, e.y - ref.y); if (d < wd) { wd = d; wb = e; } }
      if (wb && UT[u.t].wpn && canHit(W[UT[u.t].wpn], wb)) orderAttack([u], wb);
    }
  }
}
function endAllyBots() { // ally bots never attack in Endless; their idle army guards the busiest pass
  const E = G.end, H = E.horde;
  let cx = 0, cy = 0, n = 0; for (const e of G.ents) if (e.team === H && e.kind === 'u' && e.hp > 0) { cx += e.x; cy += e.y; n++; }
  for (const P of G.players) { if (P.horde || !P.ai || P.out) continue;
    const hq = G.ents.find(e => e.team === P.team && (e.t === 'hq' || e.t === 'cc')); if (!hq) continue;
    let ps = G.passes[0], bd = 1e9; for (const p of G.passes) { const d = n ? dhypot(p.x - cx / n, p.y - cy / n) * 0.6 + dhypot(p.x - hq.x, p.y - hq.y) * 0.4 : dhypot(p.x - hq.x, p.y - hq.y); if (d < bd) { bd = d; ps = p; } }
    const idle = G.ents.filter(u => u.team === P.team && u.kind === 'u' && u.hp > 0 && UT[u.t].wpn && u.order === 'idle' && !u.tgt && !u.path.length && u.t !== 'harv' && dhypot(u.x - ps.x, u.y - ps.y) > 6);
    if (idle.length) orderMove(idle, ps.x - 3, ps.y, true);
  }
}
function endlessStep() {
  const E = G.end; if (!E || G.over) return;
  if (E.phase === 'break') { if (G.time >= E.next) endlessStartWave(); return; }
  if (E.spawnQ.length && G.time >= E.spawnT) { endlessSpawn(E.spawnQ.shift()); E.spawnT = G.time + END.trickle; }
  if (G.tick % 30 === 0) endHordeAI();
  if (G.tick % 300 === 150) endAllyBots();
  if (G.tick % 30 === 0 && G.time - E.waveStart > END.attrT && !E.spawnQ.length) for (const u of G.ents) if (u.team === E.horde && u.kind === 'u' && u.hp > 0 && (!u.boss || G.time - E.waveStart > END.bossAttrT)) u.hp -= u.mhp * (u.boss ? END.bossAttr : END.attr); // stragglers wither so a wave can never stall forever (v7.0.3: a boss that can't reach anything too, after bossAttrT)
  if (G.tick % 15 === 0) { let a = 0; for (const e of G.ents) if (e.team === E.horde && e.kind === 'u' && e.hp > 0) a++; E.alive = a; if (!a && !E.spawnQ.length) endlessClear(); }
}
function endlessClear() {
  const E = G.end, n = E.wave, defs = endDefenders(), pay = END.clearBase + END.clearPer * n;
  for (const P of defs) P.cr += pay;
  E.score += 100 * n;
  let reward = null;
  if (E.boss) {
    const alive = E.bids.map(byId).filter(b => b && b.hp > 0), hpNow = alive.reduce((a, b) => a + b.hp, 0), loss = 1 - hpNow / E.bhp0, dur = G.time - E.waveStart;
    const clean = E.blost === 0 && loss < END.bossClean.loss && dur < END.bossClean.t;
    if (clean) { reward = { kind: 'elite', units: [] }; for (const P of defs) { const u = endElite(P); if (u) reward.units.push(u.t); } E.score += 1000 * (n / 10); }
    else { const c = END.bossCash + END.bossCashPer * (n / 10); for (const P of defs) P.cr += c; reward = { kind: 'cash', cr: c }; E.score += 300 * (n / 10); }
    reward.dur = dur; reward.loss = loss; reward.lost = E.blost;
  }
  E.lastReward = reward;
  E.phase = 'break'; E.brk = (n + 1) % 10 === 0 ? END.brkBoss : END.brk; E.next = G.time + E.brk; E.votes = {};
  G.events.push({ e: 'waveClear', n, pay, reward });
}
function endElite(P) {
  const hq = G.ents.find(e => e.team === P.team && e.kind === 'b' && (e.t === 'hq' || e.t === 'cc') && e.hp > 0) || G.ents.find(e => e.team === P.team && e.kind === 'b' && e.hp > 0); if (!hq) return null;
  const t = { rus: 'tsar', ger: 'kommando', jpn: 'raijin' }[P.fac] || 'titan';
  const u = addU(t, P.team, hq.x + 2.5, hq.y + hq.h / 2 + 1.2); let f = nearFree(Math.floor(u.x), Math.floor(u.y), 6); if (getBlock()[idx(f[0], f[1])]) f = nearFree(Math.floor(u.x), Math.floor(u.y), 30); /* v7.0.3: HQ walled in tight -> look further out */ u.x = f[0] + 0.5; u.y = f[1] + 0.5; u.anchor = { x: u.x, y: u.y };
  u.hp = u.mhp = Math.round(u.mhp * 1.5); u.dmgM = 1.3; u.elite = 1; u.vet = 3;
  G.events.push({ e: 'unit', team: P.team, u }, { e: 'elite', team: P.team, u });
  return u;
}
function endlessDeath(e) {
  const E = G.end; if (!E) return;
  if (e.team === E.horde && e.kind === 'u') {
    const d = UT[e.t], K = e.lastHitBy != null ? G.players[e.lastHitBy] : null;
    if (K && !K.horde) K.cr += Math.round(d.cost * END.bounty * (1 + END.bountyGrow * E.wave));
    E.score += Math.round(d.cost / 10 * (1 + 0.05 * E.wave)); E.kills++;
    if (d.boss) G.events.push({ e: 'bossDown', x: e.x, y: e.y });
  } else if (e.kind === 'b' && !e.sold && G.players[e.team] && G.players[e.team].ally === 0 && !endWallish(e.t) && E.phase === 'wave') E.blost++;
}
function endlessVote(T) {
  const E = G.end, P = G.players[T]; if (!E || E.phase !== 'break' || !P || P.horde || P.out) return false;
  E.votes[T] = 1;
  const humans = endDefenders().filter(Q => !Q.ai);
  if (humans.every(Q => E.votes[Q.team])) { const rem = Math.max(0, E.next - G.time), bonus = Math.round(rem * END.skipPay); for (const Q of endDefenders()) Q.cr += bonus; E.next = G.time; G.events.push({ e: 'skip', bonus }); }
  return true;
}

// ---------- local high scores (UI side; never touches the sim) ----------
function endlessHS() { try { const h = JSON.parse(localStorage.getItem('ifEndlessHS')); if (h && h.solo && h.coop) return h; } catch (e) {} return { solo: [], coop: [] }; }
function endlessKind() { const ps = G.players.filter(P => !P.horde); return ps.length === 1 && !ps[0].ai ? 'solo' : 'coop'; }
function endlessRecord() {
  const E = G.end; if (!E || E.saved || G.replay || G.watch) return null; E.saved = 1;
  const k = endlessKind(), hs = endlessHS(), P = G.players[ME] || {};
  const rec = { score: E.score, wave: E.wave, kills: E.kills, fac: P.fac, n: G.players.filter(Q => !Q.horde).length, name: P.name || 'You', date: new Date().toISOString().slice(0, 10) };
  hs[k].push(rec); hs[k].sort((a, b) => b.score - a.score || b.wave - a.wave); hs[k] = hs[k].slice(0, 10);
  E.rank = hs[k].indexOf(rec) + 1; E.hsKind = k; E.best = hs[k][0];
  try { localStorage.setItem('ifEndlessHS', JSON.stringify(hs)); } catch (e) {}
  return rec;
}
function endlessHSHTML(kind, hi) {
  const hs = endlessHS(), rows = (kinds => kinds.map(k => `<div class="hsCol"><h4>${k === 'solo' ? 'Solo' : 'Co-op'}</h4>${hs[k].length ? `<table class="hsT"><tr><th>#</th><th>Wave</th><th>Score</th><th></th></tr>${hs[k].map((r, i) => `<tr class="${k === kind && i + 1 === hi ? 'me' : ''}"><td>${i + 1}</td><td>${r.wave}</td><td>${r.score.toLocaleString()}</td><td>${(FACTIONS[r.fac] || {}).flag || ''}${r.n > 1 ? ' ×' + r.n : ''}</td></tr>`).join('')}</table>` : '<div class="hsNone">No runs yet</div>'}</div>`).join(''))(['solo', 'coop']);
  return `<div class="hsBoard">${rows}</div>`;
}
// ---------- wave HUD (desktop + mobile) ----------
function endlessHud() {
  const el = document.getElementById('waveHud'); if (!el) return;
  const E = G.end; if (!E || G.over) { el.style.display = 'none'; return; } el.style.display = '';
  if (!el.firstChild) { // built once; later frames only touch text (a tap on Skip never lands on a node that was just replaced)
    el.innerHTML = '<div class="wvT"></div><div class="wvBar"><i></i></div><div class="wvN"></div><button id="skipBtn" class="skipBtn"></button><div class="wvS"></div>';
    const b = el.querySelector('#skipBtn'); b.addEventListener('pointerdown', ev => ev.stopPropagation()); b.addEventListener('touchstart', ev => ev.stopPropagation(), { passive: true });
    b.onclick = ev => { ev.stopPropagation(); if (G.end && G.end.phase === 'break' && !G.end.votes[ME]) { NET.issue({ c: 'skipwave' }); if (typeof sfx === 'function') sfx('click'); } }; }
  const brk = E.phase === 'break', rem = Math.max(0, Math.ceil(E.next - G.time)), voted = !!E.votes[ME], nextBoss = (E.wave + 1) % 10 === 0;
  const key = [E.wave, E.phase, rem, E.alive, E.spawnQ.length, voted, E.score].join('|'); if (el.dataset.k === key) return; el.dataset.k = key;
  const left = E.alive + E.spawnQ.length, hpct = E.total ? Math.round(100 * left / Math.max(1, E.total)) : 0, q = c => el.querySelector(c);
  el.className = brk ? 'brk' + (nextBoss ? ' boss' : '') : 'live' + (E.boss ? ' boss' : '');
  q('.wvT').textContent = brk ? (E.wave ? 'Wave ' + E.wave + ' cleared' : 'Prepare your defenses') : (E.boss ? '☠ BOSS WAVE ' : 'WAVE ') + E.wave;
  q('.wvN').innerHTML = brk ? `${nextBoss ? '☠ BOSS WAVE ' : 'Wave '}${E.wave + 1} in <b>${rem}s</b>` : `${left} ${left === 1 ? 'enemy' : 'enemies'} left`;
  q('.wvBar i').style.width = hpct + '%';
  const nh = endDefenders().filter(Q => !Q.ai).length, nv = Object.keys(E.votes).length;
  const b = q('#skipBtn'); b.disabled = voted; b.textContent = voted ? (nh > 1 ? `Waiting for team (${nv}/${nh})` : 'Skipping…') : `Skip ▶▶  +$${Math.round(rem * END.skipPay)}`;
  q('.wvS').textContent = `Score ${E.score.toLocaleString()} · ${E.kills} kills`;
}
