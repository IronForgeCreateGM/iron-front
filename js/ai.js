'use strict';
// ===== AI opponent =====
// Each think: power check, build order (rebuilds losses), placement, harvesters,
// counter-composition army, base defense, waves, harass, scouting.
const AI_ORDER = ['power', 'barracks', 'refinery', 'power', 'factory', 'turret', 'refinery', 'power', 'tech', 'aagun', 'power', 'turret', 'airpad', 'power', 'turret', 'aagun', 'refinery', 'power'];
function aiInit(P) { P.aiS = { next: 0, wave: DIFF[P.diff].wave0, scoutT: DIFF[P.diff].scoutAfter, lastAttack: 0, attackers: new Set(), known: new Map(), sellT: 0 }; }
function aiStep(P) {
  const S = P.aiS, D = DIFF[P.diff];
  const myBld = () => G.ents.filter(e => e.team === P.team && e.kind === 'b' && e.sell < 0);
  if (G.time < S.next) return;
  S.next = G.time + D.think;
  const me = G.ents.filter(e => e.team === P.team), hq = me.find(e => e.t === 'hq') || me.find(e => e.kind === 'b');
  if (!hq) return;
  const enemyTeam = 1 - P.team;
  // fog-respecting knowledge: visible units + remembered buildings
  const foes = G.ents.filter(e => e.team === enemyTeam && visibleTo(P.team, e));
  for (const f of foes) if (f.kind === 'b') S.known.set(f.id, f);
  for (const [id, b] of S.known) if (b.hp <= 0 || b.dead || b.team !== enemyTeam || (G.visT[P.team][idx(Math.floor(b.x), Math.floor(b.y))] && !foes.includes(b))) S.known.delete(id);
  const knownB = [...S.known.values()];
  const estart = G.starts[enemyTeam];
  const cnt = {}; for (const e of me) cnt[e.t] = (cnt[e.t] || 0) + 1;
  // queued items count too
  for (const c in P.queues) for (const it of P.queues[c]) cnt[it.t] = (cnt[it.t] || 0) + 1;
  for (const c in P.ready) if (P.ready[c]) cnt[P.ready[c]] = (cnt[P.ready[c]] || 0) + 1;
  // 1) place ready buildings
  for (const cat of ['bld', 'def']) if (P.ready[cat]) { const spot = aiSpot(P, P.ready[cat], hq, foes); if (spot) placeReady(P.team, cat, spot[0], spot[1]); else cancel(P.team, P.ready[cat]); }
  // 2) structures: power emergency, then order list (rebuild handled by counting)
  if (!P.queues.bld.length && !P.ready.bld) {
    let want = null;
    if (P.pow < 20 && (cnt.power || 0) < 10) want = 'power';
    else { const need = {}; for (const b of AI_ORDER) { if (BT[b].cat !== 'bld') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b)) { want = b; break; } } }
    if (want && avail(P.team, want) && P.cr > BT[want].cost * 0.3) enqueue(P.team, want);
  }
  if (!P.queues.def.length && !P.ready.def && (cnt.factory || 0) > 0) {
    const need = {}; for (const b of AI_ORDER) { if (BT[b].cat !== 'def') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b)) { if (P.cr > 1200) enqueue(P.team, b); break; } }
  }
  // 3) harvesters
  const refs = cnt.refinery || 0, harvs = cnt.harv || 0;
  const wantH = Math.min(6, Math.max(1, refs) * 2);
  if (harvs < wantH && avail(P.team, 'harv') && !P.queues.veh.some(q => q.t === 'harv')) { if (P.queues.veh.length >= 2) cancel(P.team, P.queues.veh[P.queues.veh.length - 1].t); enqueue(P.team, 'harv'); }
  // money stall breaker: no harvesters and broke -> sell non-essential structures
  const realH = me.filter(e => e.t === 'harv').length;
  if (realH === 0 && P.cr < UT.harv.cost && G.time > S.sellT) {
    const sac = ['airpad', 'tech', 'aagun', 'turret', 'wall'].map(t => myBld().find(b => b.t === t)).find(Boolean) || (cnt.barracks > 1 && myBld().find(b => b.t === 'barracks'));
    if (sac) { sellB(sac); S.sellT = G.time + 15; }
  }
  if (realH < 2 && P.cr < UT.harv.cost + 200) return; // save for harvesters
  // 4) army composition: counter what enemy fields
  const ft = { inf: 0, armor: 0, air: 0 };
  for (const f of foes) if (f.kind === 'u' && f.t !== 'harv') { const a = UT[f.t].armor; if (a === 'inf') ft.inf++; else if (a === 'air') ft.air++; else ft.armor++; }
  const pick = (list) => { const ok = list.filter(([t]) => avail(P.team, t)); let tot = 0; ok.forEach(o => tot += o[1]); let r = G.R() * tot; for (const o of ok) { r -= o[1]; if (r <= 0) return o[0]; } return ok.length ? ok[0][0] : null; };
  if (P.cr > 300) {
    if (P.queues.inf.length < 2) { const t = pick([['rifle', 2 + ft.inf], ['rocketeer', 1 + ft.armor * 1.5 + ft.air]]); if (t) enqueue(P.team, t); }
    if (P.queues.veh.length < 2 && harvs >= Math.min(2, refs * 2)) {
      const t = pick([['light', 3], ['heavy', 2 + ft.armor], ['scout', 1 + ft.inf * 0.5], ['arty', 1 + ft.inf * 0.4], ['aa', ft.air * 2]]);
      if (t) enqueue(P.team, t);
    }
    if (P.queues.air.length < 1 && (cnt.gunship || 0) < 4) enqueue(P.team, 'gunship');
  }
  // 5) defense: enemies near any of my buildings
  const myB = me.filter(e => e.kind === 'b');
  const army = me.filter(e => e.kind === 'u' && UT[e.t].wpn);
  const intruders = foes.filter(f => f.kind === 'u' && myB.some(b => Math.hypot(b.x - f.x, b.y - f.y) < 10));
  G.danger = G.danger || {}; G.danger[P.team] = intruders.map(f => ({ x: f.x, y: f.y }));
  const home = army.filter(u => !S.attackers.has(u.id));
  if (intruders.length) {
    const c = intruders[0];
    const defenders = home.filter(u => u.order !== 'attack' && Math.hypot(u.x - c.x, u.y - c.y) < 25);
    if (D.firstAttack && G.time < D.firstAttack) defenders.forEach(u => S.attackers.delete(u.id));
    if (defenders.length) orderMove(defenders, c.x, c.y, true);
  }
  // 6) scouting
  if (G.time > S.scoutT) {
    S.scoutT = G.time + 60;
    const sc = home.find(u => u.t === 'scout') || home.find(u => u.t === 'rifle');
    if (sc && !intruders.length) { const tgt = S.known.size ? [10 + G.R() * 44, 10 + G.R() * 44] : estart; orderMove([sc], tgt[0], tgt[1], D.firstAttack ? false : true); S.attackers.add(sc.id); }
  }
  // 7) harass enemy harvesters with fast units / gunships
  if (D.harass && G.time > D.harassAfter && G.R() < D.harass * 0.15) {
    const fh = foes.find(f => f.t === 'harv');
    const raiders = home.filter(u => u.t === 'scout' || u.t === 'gunship' || u.t === 'light').slice(0, 4);
    if (fh && raiders.length >= 2) { orderAttack(raiders, fh); raiders.forEach(u => S.attackers.add(u.id)); if (S.firstAttackT == null) S.firstAttackT = G.time; }
  }
  // 8) waves
  for (const id of [...S.attackers]) { const u = byId(id); if (!u) S.attackers.delete(id); else if (u.order === 'idle' && !u.tgt && G.R() < 0.2) S.attackers.delete(id); }
  const ready = home.filter(u => u.t !== 'harv');
  if (ready.length >= S.wave && !intruders.length && G.time >= D.firstAttack && G.time - S.lastAttack > D.waveGap) {
    if (S.firstAttackT == null) S.firstAttackT = G.time;
    if (D.waveMax < 10) ready.splice(Math.min(ready.length, S.wave + 2));
    const tgts = knownB.slice();
    if (!tgts.length) { orderMove(ready, estart[0], estart[1], true); ready.forEach(u => S.attackers.add(u.id)); S.lastAttack = G.time; }
    else {
      // prefer production/eco targets; artillery-friendly
      const pref = ['refinery', 'factory', 'power', 'barracks', 'hq'];
      tgts.sort((a, b) => (pref.indexOf(a.t) + 1 || 9) - (pref.indexOf(b.t) + 1 || 9) + (Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y)) * 0.05);
      const t = tgts[0]; if (!t) return;
      orderMove(ready, t.x, t.y, true); ready.forEach(u => S.attackers.add(u.id));
      S.wave = Math.min(D.waveMax, S.wave + D.waveInc); S.lastAttack = G.time;
    }
  }
  // 8b) defense upgrades when rich
  if (P.cr > 2500 && G.R() < 0.1) { const t = myB.find(b => UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); }
  // 9) repair damaged buildings
  for (const b of myB) if (b.hp < b.mhp * 0.6 && P.cr > 500) b.repair = true;
}
function aiSpot(P, t, hq, foes) {
  const d = BT[t];
  let ax = hq.x, ay = hq.y;
  const kb = P.aiS ? [...P.aiS.known.values()] : []; const ef = kb.find(f => f.t === 'hq') || kb[0] || { x: G.starts[1 - P.team][0], y: G.starts[1 - P.team][1] };
  if (t === 'refinery') { // near closest ore
    let b = -1, bd = 1e9; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 0) { const dd = Math.hypot(i % MW - hq.x, ((i / MW) | 0) - hq.y); if (dd < bd) { bd = dd; b = i; } }
    if (b >= 0) { ax = (b % MW + hq.x) / 2; ay = (((b / MW) | 0) + hq.y) / 2; }
  } else if (d.cat === 'def' && ef) { const a = Math.atan2(ef.y - hq.y, ef.x - hq.x) + (G.R() - 0.5) * 1.6; ax = hq.x + Math.cos(a) * 7; ay = hq.y + Math.sin(a) * 7; }
  const cands = [];
  for (let y = 1; y < MH - d.h; y++) for (let x = 1; x < MW - d.w; x++) { const dd = Math.hypot(x + d.w / 2 - ax, y + d.h / 2 - ay); if (dd < 14) cands.push([dd + G.R() * 1.5, x, y]); }
  cands.sort((a, b) => a[0] - b[0]);
  const g = getBlock();
  for (const [, x, y] of cands) {
    if (!canPlace(t, P.team, x, y)) continue;
    // keep 1-tile gap around non-defense buildings so units can flow
    if (d.cat !== 'def') { let ok = true; for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy) && g[idx(xx, yy)] === 2) { ok = false; break; } if (!ok) continue; }
    return [x, y];
  }
  return null;
}
