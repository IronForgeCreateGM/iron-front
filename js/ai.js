'use strict';
// ===== AI opponent =====
// Each think: power check, build order (rebuilds losses), placement, harvesters,
// counter-composition army, base defense, waves, harass, scouting.
const AI_ORDER = ['power', 'barracks', 'refinery', 'power', 'factory', 'extractor', 'turret', 'refinery', 'power', 'tech', 'aagun', 'power', 'turret', 'airpad', 'power', 'turret', 'aagun', 'refinery', 'power'];
const AI_ORDER_CHIEF = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'power', 'turret', 'refinery', 'tech', 'power', 'aagun', 'turret', 'power', 'airfield', 'power', 'turret', 'extractor', 'gcannon', 'aagun', 'power', 'refinery', 'power'];
const AI_ORDER_SI = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'turret', 'power', 'tech', 'refinery', 'aagun', 'power', 'airfield', 'turret', 'power', 'extractor', 'gcannon', 'aagun', 'power', 'power'];
const AI_ORDER_AIR = AI_ORDER.concat(['power', 'airfield', 'extractor', 'power', 'gcannon', 'power']);
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
    else { const need = {}; for (const b of (D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : D.firstAttack ? AI_ORDER : AI_ORDER_AIR)) { if (BT[b].cat !== 'bld') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b)) { want = b; break; } } }
    if (want && avail(P.team, want) && P.cr > BT[want].cost * 0.3) enqueue(P.team, want);
  }
  if (!P.queues.def.length && !P.ready.def && (cnt.factory || 0) > 0) {
    const need = {}; for (const b of (D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : AI_ORDER)) { if (BT[b].cat !== 'def') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b)) { if (P.cr > 1200) enqueue(P.team, b); break; } }
  }
  // 3) harvesters
  const refs = cnt.refinery || 0, harvs = cnt.harv || 0;
  const threat = D.chief && G.time < 240 ? armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)) > armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn)) * 1.3 : false;
  const wantH = threat ? Math.min(2, refs * 2) : Math.min(D.chief ? 8 : 6, Math.max(1, refs) * 2);
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
    const myInf = me.filter(e => e.kind === 'u' && UT[e.t].armor === 'inf').length;
    if (P.queues.inf.length < 2) { const t = pick([['rifle', 2 + ft.inf], ['rocketeer', 1 + ft.armor * 1.5 + ft.air], ['sniper', ft.inf > 3 ? 1 + ft.inf * 0.25 : 0.2], ['pyro', 0.8 + ft.inf * 0.25], ['kommando', P.gas > 200 ? 1.5 : 0], ['medic', myInf > 6 && (cnt.medic || 0) < 2 + myInf / 10 ? 1.2 : 0]]); if (t) enqueue(P.team, t); }
    if (P.queues.veh.length < 2 && harvs >= Math.min(2, refs * 2)) {
      const t = pick([['light', 3], ['heavy', 2 + ft.armor], ['titan', P.gas > 300 ? 1.5 + ft.air * 0.3 : 0], ['tsar', P.gas > 350 ? 2 : 0], ['scout', 1 + ft.inf * 0.5], ['arty', 1 + ft.inf * 0.4], ['aa', ft.air * 2]]);
      if (t) enqueue(P.team, t);
    }
    const airN = (cnt.gunship || 0) + (cnt.jet || 0) + (cnt.intercept || 0) + (cnt.bomber || 0);
    if (P.queues.air.length < 1 && airN < (D.chief ? 9 : 6)) { const t = pick([['gunship', (cnt.gunship || 0) < 4 ? 2 : 0.3], ['jet', D.si ? ((cnt.jet || 0) < 4 ? 4 : 0) : 1.2 + knownB.length * 0.05], ['intercept', ft.air * 1.2 + (D.si && (cnt.jet || 0) >= 2 && (cnt.intercept || 0) < 2 ? 3 : 0)], ['bomber', P.cr > 3500 ? 0.8 : 0.1], ['stealth', P.gas > 250 ? 2 : 0]]); if (t) enqueue(P.team, t); }
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
  // 7b) air strikes: jets/bombers hit eco & production when armed
  const strikers = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth') && u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo);
  if (strikers.length && knownB.length && G.time > D.harassAfter && G.R() < 0.4) { const pri = ['refinery', 'power', 'factory', 'airfield', 'tech', 'barracks'], tg = knownB.slice().sort((a, b) => (pri.indexOf(a.t) + 1 || 9) - (pri.indexOf(b.t) + 1 || 9))[0]; if (tg) orderAttack(strikers, tg); }
  if (D.si) siExtras(P, S, me, foes, knownB, hq, estart, intruders);
  if (D.chief) { chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart); return; }
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
  if (t === 'extractor') { const vs = (G.vents || []).slice().sort((a, b) => Math.hypot(a[0] - hq.x, a[1] - hq.y) - Math.hypot(b[0] - hq.x, b[1] - hq.y));
    for (const [vx, vy] of vs) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (canPlace(t, P.team, vx - ox, vy - oy)) return [vx - ox, vy - oy]; return null; }
  const kb = P.aiS ? [...P.aiS.known.values()] : []; const ef = kb.find(f => f.t === 'hq') || kb[0] || { x: G.starts[1 - P.team][0], y: G.starts[1 - P.team][1] };
  if (t === 'refinery') { // near closest ore
    const refs = G.ents.filter(e => e.team === P.team && e.t === 'refinery');
    let b = -1, bd = 1e9; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 200) { const ox = i % MW, oy = (i / MW) | 0; const dd = Math.hypot(ox - hq.x, oy - hq.y) + (refs.some(r => Math.hypot(r.x - ox, r.y - oy) < 7) ? 14 : 0); if (dd < bd) { bd = dd; b = i; } }
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

// ===== Chief: stronger commander (no resource cheats) =====
const armyVal = l => l.reduce((a, u) => a + UT[u.t].cost * u.hp / u.mhp, 0);
function chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart) {
  S.eArmy = Math.max((S.eArmy || 0) * 0.995, armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)));
  const ground = home.filter(u => u.t !== 'harv' && !UT[u.t].jet && UT[u.t].wpn);
  const ang = Math.atan2(estart[1] - hq.y, estart[0] - hq.x);
  const stage = { x: hq.x + Math.cos(ang) * 9, y: hq.y + Math.sin(ang) * 9 };
  // group management
  S.grp = (S.grp || []).filter(u => u.hp > 0 && !u.dead);
  if (S.grp.length) {
    const v = armyVal(S.grp), c = { x: S.grp.reduce((a, u) => a + u.x, 0) / S.grp.length, y: S.grp.reduce((a, u) => a + u.y, 0) / S.grp.length };
    const near = foes.filter(f => f.kind === 'u' && UT[f.t].wpn && Math.hypot(f.x - c.x, f.y - c.y) < 10);
    if (v < S.grpV0 * 0.35 && armyVal(near) > v * 1.2) { // retreat & regroup
      orderMove(S.grp, stage.x, stage.y, false); S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; S.retreatT = G.time; S.wave = Math.max(S.wave, 12);
    } else if (G.time > (S.regT || 0)) {
      S.regT = G.time + 4;
      // regroup stragglers: leaders wait for the pack
      const far = S.grp.filter(u => Math.hypot(u.x - c.x, u.y - c.y) > 6);
      if (far.length > S.grp.length * 0.3 && !near.length) { orderMove(S.grp, c.x, c.y, true); }
      else {
        const tgts = knownB.slice(); const pref = ['turret', 'aagun', 'refinery', 'factory', 'barracks', 'power', 'airfield', 'tech', 'hq'];
        tgts.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) * 0.3 + (pref.indexOf(a.t) + 1 || 9) - Math.hypot(b.x - c.x, b.y - c.y) * 0.3 - (pref.indexOf(b.t) + 1 || 9));
        const t = tgts[0] || { x: estart[0], y: estart[1] };
        const step = Math.min(8, Math.hypot(t.x - c.x, t.y - c.y)), a2 = Math.atan2(t.y - c.y, t.x - c.x);
        if (!near.length && step > 3) orderMove(S.grp.filter(u => u.order !== 'attack'), c.x + Math.cos(a2) * step, c.y + Math.sin(a2) * step, true);
        else if (!near.length && tgts[0]) orderMove(S.grp.filter(u => u.order !== 'attack'), t.x, t.y, true);
      }
    }
  }
  // home army: hold in formation at stage point
  const idle = ground.filter(u => !S.grp.includes(u) && !S.attackers.has(u.id));
  if (!intruders.length && G.time > (S.formT || 0) && idle.length) { S.formT = G.time + 15; const stray = idle.filter(u => Math.hypot(u.x - stage.x, u.y - stage.y) > 5 && u.order === 'idle'); if (stray.length > 2) orderFormation(idle, stage.x, stage.y, ang); }
  // launch attack when strong enough
  const av = armyVal(idle);
  const need = Math.max(S.wave * 650, (S.eArmy || 0) * 1.4);
  if (!S.grp.length && !intruders.length && av >= need && G.time - S.lastAttack > D.waveGap && G.time > (S.retreatT || -99) + 25) {
    S.grp = idle.slice(); S.grpV0 = armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
    S.lastAttack = G.time; S.regT = 0; S.wave = Math.min(D.waveMax, S.wave + D.waveInc);
  }
}

// ===== Chief SI extras: rush defense, wounded retreat, coordinated jet strikes w/ escort =====
function siExtras(P, S, me, foes, knownB, hq, estart, intruders) {
  const ang = Math.atan2(estart[1] - hq.y, estart[0] - hq.x), stage = { x: hq.x + Math.cos(ang) * 8, y: hq.y + Math.sin(ang) * 8 };
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && !UT[u.t].air);
  // early rush: pull everything home, hold stance near base
  if (false && intruders.length && G.time < 360) { const inn = army.filter(u => Math.hypot(u.x - hq.x, u.y - hq.y) > 10 && !(S.grp || []).includes(u)); if (inn.length) orderMove(inn, hq.x + Math.cos(ang) * 4, hq.y + Math.sin(ang) * 4, true); }
  // retreat badly wounded units (not when defending at home)
  for (const u of army) if (u.hp < u.mhp * 0.3 && !u.retreating && Math.hypot(u.x - hq.x, u.y - hq.y) > 14 && u.t !== 'harv') { u.retreating = true; orderMove([u], stage.x, stage.y, false); if (S.grp) S.grp = S.grp.filter(x => x !== u); S.attackers.delete(u.id); }
  for (const u of army) if (u.retreating && (u.hp > u.mhp * 0.7 || Math.hypot(u.x - stage.x, u.y - stage.y) < 3)) u.retreating = false;
  // jet strike package: >=2 armed jets, escort interceptors follow
  const jets = me.filter(u => u.t === 'jet' && u.js === 'landed' && u.ammo >= W.jbomb.ammo);
  if (jets.length >= 2 && knownB.length && G.time > (S.strikeT || 0)) {
    const pri = ['refinery', 'power', 'factory', 'airfield', 'tech', 'barracks', 'hq'];
    const aaNear = b => knownB.filter(k => k.t === 'aagun' && Math.hypot(k.x - b.x, k.y - b.y) < 7).length;
    const tg = knownB.filter(b => BT[b.t].cat !== 'def').sort((a, b) => (pri.indexOf(a.t) + aaNear(a) * 3) - (pri.indexOf(b.t) + aaNear(b) * 3))[0];
    if (tg) { orderAttack(jets, tg); const esc = me.filter(u => u.t === 'intercept' && (u.order === 'idle' || u.js === 'landed')); if (esc.length) orderMove(esc, tg.x, tg.y, true); S.strikeT = G.time + 25; }
  }
  // scouting: keep enemy base memory fresh with a cheap unit
  if (G.time > (S.siScoutT || 60) && !knownB.length) { const sc = me.find(u => u.t === 'scout' || u.t === 'rifle'); if (sc) orderMove([sc], estart[0], estart[1], false); S.siScoutT = G.time + 60; }
}
