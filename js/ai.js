'use strict';
// ===== AI opponent =====
// Each think: power check, build order (rebuilds losses), placement, harvesters,
// counter-composition army, base defense, waves, harass, scouting.
const AI_ORDER = ['power', 'barracks', 'refinery', 'power', 'factory', 'extractor', 'turret', 'refinery', 'power', 'tech', 'aagun', 'power', 'turret', 'airpad', 'power', 'turret', 'aagun', 'refinery', 'power'];
const AI_ORDER_CHIEF = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'power', 'turret', 'refinery', 'tech', 'power', 'aagun', 'turret', 'power', 'airfield', 'power', 'turret', 'extractor', 'gcannon', 'aagun', 'power', 'refinery', 'power'];
const AI_ORDER_SI = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'turret', 'power', 'tech', 'refinery', 'aagun', 'power', 'airfield', 'turret', 'power', 'extractor', 'gcannon', 'aagun', 'power', 'power'];
const AI_ORDER_AIR = AI_ORDER.concat(['power', 'airfield', 'extractor', 'power', 'gcannon', 'power']);
function aiInit(P) { P.aiS = { next: 0, wave: DIFF[P.diff].wave0, scoutT: DIFF[P.diff].scoutAfter, lastAttack: 0, attackers: new Set(), known: new Map(), sellT: 0 }; }
// v5.0 peace window: no attacks on bases before G.opts.peace seconds (default 180; lobby Off/3/5/8 min)
function peaceOver() { return G.time >= (G.opts.peace == null ? 180 : G.opts.peace); }
function aiStep(P) {
  const S = P.aiS, D = DIFF[P.diff];
  const myBld = () => G.ents.filter(e => e.team === P.team && e.kind === 'b' && e.sell < 0);
  if (G.time < S.next) return;
  S.next = G.time + D.think;
  if (P.out) return;
  if (D.slip && G.R() < D.slip) { S.next += D.think; return; } // slower players hesitate / miss cycles
  const me = G.ents.filter(e => e.team === P.team), hq = me.find(e => e.t === 'hq') || me.find(e => e.t === 'cc') || me.find(e => e.kind === 'b');
  if (!hq) return;
  // pick the nearest surviving enemy player as primary target
  if (S.eTeam == null || G.players[S.eTeam].out || !foe(S.eTeam, P.team)) { let best = null, bd = 1e9; for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { const st = G.starts[Q.start], d = dhypot(st[0] - hq.x, st[1] - hq.y) + (Q.ai ? 0 : -3); if (d < bd) { bd = d; best = Q.team; } } S.eTeam = best == null ? (P.team ? 0 : 1) : best; }
  const enemyTeam = S.eTeam;
  // fog-respecting knowledge: visible units + remembered buildings (all enemy players)
  const foes = G.ents.filter(e => foe(e.team, P.team) && !G.players[e.team].out && visibleTo(P.team, e));
  for (const f of foes) if (f.kind === 'b') S.known.set(f.id, f);
  for (const [id, b] of S.known) if (b.hp <= 0 || b.dead || !foe(b.team, P.team) || (G.visT[P.team][idx(Math.floor(b.x), Math.floor(b.y))] && !foes.includes(b))) S.known.delete(id);
  let knownB = [...S.known.values()];
  if (knownB.some(b => b.team === enemyTeam)) knownB = knownB.filter(b => b.team === enemyTeam).concat(knownB.filter(b => b.team !== enemyTeam && dhypot(b.x - hq.x, b.y - hq.y) < 40));
  const estart = G.starts[G.players[enemyTeam].start];
  S.bad = S.bad || {};
  const cnt = {}; for (const e of me) cnt[e.t] = (cnt[e.t] || 0) + 1;
  // queued items count too
  for (const c in P.queues) for (const it of P.queues[c]) cnt[it.t] = (cnt[it.t] || 0) + 1;
  for (const c in P.ready) if (P.ready[c]) cnt[P.ready[c]] = (cnt[P.ready[c]] || 0) + 1;
  // 1) place ready buildings
  for (const cat of ['bld', 'def']) if (P.ready[cat]) { const rt = P.ready[cat], spot = aiSpot(P, rt, hq, foes); if (spot) placeReady(P.team, cat, spot[0], spot[1]); else { cancel(P.team, rt); S.bad[rt] = G.time + 60; } }
  // 2) structures: power emergency, then order list (rebuild handled by counting)
  if (!P.queues.bld.length && !P.ready.bld) {
    let want = null;
    if (P.pow < 20 && (cnt.power || 0) < 10) want = 'power';
    else if (G.time > D.expandAt * (1 + 0.7 * (cnt.cc || 0)) && (cnt.cc || 0) < 4 && (cnt.factory || 0) > 0 && avail(P.team, 'cc') && (S.bad.cc || 0) < G.time && aiSpot(P, 'cc', hq, foes)) want = 'cc';
    else if ((cnt.cc || 0) > 0 && (cnt.refinery || 0) < 2 + (cnt.cc || 0) && (S.bad.refinery || 0) < G.time) want = 'refinery';
    else { const need = {}; for (const b of (D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : D.firstAttack || P.diff === 'normal' ? AI_ORDER : AI_ORDER_AIR)) { if (BT[b].cat !== 'bld') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } want = b; break; } } }
    if (!want) want = aiGrowth(P, S, D, cnt, hq, foes);
    S.saving = want && avail(P.team, want) && P.cr <= BT[want].cost * 0.3 && ['refinery', 'cc', 'factory', 'power', 'extractor', 'barracks'].includes(want) ? want : null;
    if (want && avail(P.team, want) && P.cr > BT[want].cost * 0.3) enqueue(P.team, want);
  }
  if (!P.queues.def.length && !P.ready.def && (cnt.factory || 0) > 0) {
    const need = {}; for (const b of (D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : AI_ORDER)) { if (BT[b].cat !== 'def') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } if (P.cr > 1200) enqueue(P.team, b); break; } }
  }
  // 2b) ally pings
  aiPing(P, S, me);
  // 3) harvesters
  const refs = cnt.refinery || 0, harvs = cnt.harv || 0;
  const threat = D.chief && G.time < 240 ? armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)) > armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn)) * 1.3 : false;
  const wantH = threat ? Math.min(2, refs * 2) : Math.min((D.chief ? 8 : 6) + (cnt.cc || 0) * 3, (refs ? refs * 2 + (D.si && !SIOFF.harv ? me.filter(e => e.t === 'refinery').length : 0) : 2)); const wantHs = Math.max(2, Math.round(wantH * (D.sat || 1)));
  if (harvs < wantHs && avail(P.team, 'harv') && !P.queues.veh.some(q => q.t === 'harv')) { if (P.queues.veh.length >= 2) cancel(P.team, P.queues.veh[P.queues.veh.length - 1].t); enqueue(P.team, 'harv'); }
  // money stall breaker: no harvesters and broke -> sell non-essential structures
  const realH = me.filter(e => e.t === 'harv').length;
  if (realH === 0 && P.cr < UT.harv.cost && G.time > S.sellT) {
    const sac = ['airpad', 'tech', 'aagun', 'turret', 'wall'].map(t => myBld().find(b => b.t === t)).find(Boolean) || (cnt.barracks > 1 && myBld().find(b => b.t === 'barracks'));
    if (sac) { sellB(sac); S.sellT = G.time + 15; }
  }
  if (realH < 2 && P.cr < UT.harv.cost + 200) return; // save for harvesters
  if (!me.some(e => e.t === 'refinery' || e.t === 'cc') && P.cr < 1500 && G.time < 240) return; // never starve the first refinery
  if (S.saving && !intrudersEarly(P, foes, me) && G.time - (S.saveT0 || (S.saveT0 = G.time)) < 25) return; // save up for eco/production structures
  if (!S.saving) S.saveT0 = 0;
  // 4) army composition: counter what enemy fields
  const ft = { inf: 0, armor: 0, air: 0 };
  for (const f of foes) if (f.kind === 'u' && f.t !== 'harv') { const a = UT[f.t].armor; if (a === 'inf') ft.inf++; else if (a === 'air') ft.air++; else ft.armor++; }
  const pick = (list) => { const ok = list.filter(([t]) => avail(P.team, t)); let tot = 0; ok.forEach(o => tot += o[1]); let r = G.R() * tot; for (const o of ok) { r -= o[1]; if (r <= 0) return o[0]; } return ok.length ? ok[0][0] : null; };
  if (P.cr > 300) {
    const myInf = me.filter(e => e.kind === 'u' && UT[e.t].armor === 'inf').length;
    if (P.queues.inf.length < 2) { const t = pick([['rifle', 2 + ft.inf], ['rocketeer', 1 + ft.armor * 1.5 + ft.air], ['sniper', ft.inf > 3 ? 1 + ft.inf * 0.25 : 0.2], ['pyro', 0.8 + ft.inf * 0.25], ['kommando', P.gas > 200 ? 1.5 : 0], ['medic', myInf > 6 && (cnt.medic || 0) < 2 + myInf / 10 ? 1.2 : 0]]); if (t) enqueue(P.team, t); }
    if (P.queues.veh.length < 2 && harvs >= Math.min(2, refs * 2)) {
      const t = pick([['light', 3], ['heavy', 2 + ft.armor], ['titan', P.gas > 300 ? 1.5 + ft.air * 0.3 + (P.gas > 1200 ? 4 : 0) : 0], ['tsar', P.gas > 350 ? 2 + (P.gas > 1200 ? 4 : 0) : 0], ['scout', 1 + ft.inf * 0.5], ['arty', 1 + ft.inf * 0.4], ['aa', ft.air * 2]]);
      if (t) enqueue(P.team, t);
    }
    const airN = (cnt.gunship || 0) + (cnt.jet || 0) + (cnt.intercept || 0) + (cnt.bomber || 0);
    if (P.queues.air.length < 1 && airN < (D.chief ? 9 : 6)) { const t = pick([['gunship', (cnt.gunship || 0) < 4 ? 2 : 0.3], ['jet', D.si ? ((cnt.jet || 0) < 4 ? 4 : 0) : 1.2 + knownB.length * 0.05], ['intercept', ft.air * 1.2 + (D.si && (cnt.jet || 0) >= 2 && (cnt.intercept || 0) < 2 ? 3 : 0)], ['bomber', P.cr > 3500 ? 0.8 : 0.1], ['stealth', P.gas > 250 ? 2 : 0]]); if (t) enqueue(P.team, t); }
  }
  // 5) defense: enemies near any of my buildings
  const myB = me.filter(e => e.kind === 'b'), allyB = G.ents.filter(e => e.kind === 'b' && !foe(e.team, P.team));
  const army = me.filter(e => e.kind === 'u' && UT[e.t].wpn);
  const intruders = foes.filter(f => f.kind === 'u' && allyB.some(b => dhypot(b.x - f.x, b.y - f.y) < 10));
  G.danger = G.danger || {}; G.danger[P.team] = intruders.map(f => ({ x: f.x, y: f.y }));
  const home = army.filter(u => !S.attackers.has(u.id));
  if (intruders.length) {
    const mine = intruders.filter(f => myB.some(b => dhypot(b.x - f.x, b.y - f.y) < 12)), c = mine[0] || intruders[0];
    let defenders = home.filter(u => u.order !== 'attack' && dhypot(u.x - c.x, u.y - c.y) < 25);
    if (!mine.length && G.time > (S.helpT || 0) && armyVal(intruders) > 800 && armyVal(home) > 4000) { S.helpT = G.time + 40; defenders = home.filter(u => u.t !== 'harv' && !UT[u.t].jet).slice(0, Math.ceil(home.length * 0.4)); defenders.forEach(u => S.attackers.add(u.id)); G.events.push({ e: 'allyAck', team: P.team, x: c.x, y: c.y }); }
    if (D.firstAttack && G.time < D.firstAttack) defenders.forEach(u => S.attackers.delete(u.id));
    if (defenders.length) orderMove(defenders, c.x, c.y, true);
  }
  // 6) scouting
  if (G.time > S.scoutT) {
    S.scoutT = G.time + 60;
    const sc = home.find(u => u.t === 'scout') || home.find(u => u.t === 'rifle');
    if (sc && !intruders.length) { const tgt = S.known.size ? (G.sites ? (s => [s.x, s.y])(G.sites[(G.R() * G.sites.length) | 0]) : [10 + G.R() * (MW - 20), 10 + G.R() * (MH - 20)]) : estart; orderMove([sc], tgt[0], tgt[1], D.firstAttack ? false : true); S.attackers.add(sc.id); }
  }
  // 7) harass enemy harvesters with fast units / gunships
  if (D.harass && G.time > D.harassAfter && peaceOver() && G.R() < D.harass * 0.15) {
    const fh = foes.find(f => f.t === 'harv');
    const raiders = home.filter(u => u.t === 'scout' || u.t === 'gunship' || u.t === 'light').slice(0, 4);
    if (fh && raiders.length >= 2) { orderAttack(raiders, fh); raiders.forEach(u => S.attackers.add(u.id)); if (S.firstAttackT == null) S.firstAttackT = G.time; }
  }
  // 7b) air strikes: jets/bombers hit eco & production when armed
  const strikers = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth') && u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo);
  if (strikers.length && knownB.length && G.time > D.harassAfter && peaceOver() && G.R() < 0.4) { const pri = ['refinery', 'power', 'factory', 'airfield', 'tech', 'barracks'], tg = knownB.slice().sort((a, b) => (pri.indexOf(a.t) + 1 || 9) - (pri.indexOf(b.t) + 1 || 9))[0]; if (tg) orderAttack(strikers, tg); }
  macroMgr(P, S, D, cnt, me); harassMgr(P, S, D, me, foes, knownB, home, hq);
  if (D.si) siExtras(P, S, me, foes, knownB, hq, estart, intruders);
  if (D.chief || D.sys.sim) { chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart); return; }
  // 8) waves
  for (const id of [...S.attackers]) { const u = byId(id); if (!u) S.attackers.delete(id); else if (u.order === 'idle' && !u.tgt && G.R() < 0.2) S.attackers.delete(id); }
  const ready = home.filter(u => u.t !== 'harv');
  if (ready.length >= S.wave && !intruders.length && G.time >= D.firstAttack && peaceOver() && G.time - S.lastAttack > D.waveGap) {
    if (S.firstAttackT == null) S.firstAttackT = G.time;
    if (D.waveMax < 10) ready.splice(Math.min(ready.length, S.wave + 2));
    const tgts = aiFocus(P, knownB);
    if (!tgts.length) { const h = D.sys.close ? huntTarget(P, S, ready[0], estart) : { x: estart[0], y: estart[1] }; orderMove(ready, h.x, h.y, true); ready.forEach(u => S.attackers.add(u.id)); S.lastAttack = G.time; }
    else {
      // prefer production/eco targets; artillery-friendly
      const pref = ['refinery', 'factory', 'power', 'barracks', 'hq'];
      tgts.sort((a, b) => (pref.indexOf(a.t) + 1 || 9) - (pref.indexOf(b.t) + 1 || 9) + (dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y)) * 0.05);
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
  if (t === 'cc') { const site = aiSite(P, hq); if (!site) return null; for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) { const x = Math.round(site.x - 1.5) + ox, y = Math.round(site.y - 1.5) + oy; if (canPlace('cc', P.team, x, y)) return [x, y]; } return null; }
  if (t === 'extractor') { const vs = (G.vents || []).slice().sort((a, b) => dhypot(a[0] - hq.x, a[1] - hq.y) - dhypot(b[0] - hq.x, b[1] - hq.y));
    for (const [vx, vy] of vs) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (canPlace(t, P.team, vx - ox, vy - oy)) return [vx - ox, vy - oy]; return null; }
  const kb = P.aiS ? [...P.aiS.known.values()] : []; const ef = kb.find(f => f.t === 'hq') || kb[0] || (st => ({ x: st[0], y: st[1] }))(G.starts[G.players[P.aiS && P.aiS.eTeam != null ? P.aiS.eTeam : (P.team ? 0 : 1)].start]);
  if (t === 'refinery') { // near closest ore
    const refs = G.ents.filter(e => e.team === P.team && (e.t === 'refinery'));
    const bases = G.ents.filter(e => e.team === P.team && (e.t === 'hq' || e.t === 'cc'));
    let b = -1, bd = 1e9, bb = hq; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 200) { const ox = i % MW, oy = (i / MW) | 0; let nb = hq, nd = 1e9; for (const B of bases) { const q = dhypot(ox - B.x, oy - B.y); if (q < nd) { nd = q; nb = B; } } const dd = nd + (refs.some(r => dhypot(r.x - ox, r.y - oy) < 7) ? 14 : 0); if (dd < bd) { bd = dd; b = i; bb = nb; } }
    if (b >= 0) { ax = (b % MW + bb.x) / 2; ay = (((b / MW) | 0) + bb.y) / 2; }
  } else if (d.cat === 'def' && ef && DIFF[P.diff].sys.choke && t !== 'wall' && chokePoint(P, hq, ef) && G.R() < 0.75) { const cp = P.aiS.choke; ax = cp.x + (G.R() - 0.5) * 3; ay = cp.y + (G.R() - 0.5) * 3;
  } else if (d.cat === 'def' && ef) { const a = datan2(ef.y - hq.y, ef.x - hq.x) + (G.R() - 0.5) * 1.6; ax = hq.x + dcos(a) * 7; ay = hq.y + dsin(a) * 7; }
  const cands = [];
  for (let y = 1; y < MH - d.h; y++) for (let x = 1; x < MW - d.w; x++) { const dd = dhypot(x + d.w / 2 - ax, y + d.h / 2 - ay); if (dd < 14) cands.push([dd + G.R() * 1.5, x, y]); }
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


// ===== v4.4 layered managers (shared by all tiers; DIFF[*].sys enables/tunes each) =====
// combat simulator (Lanchester square-law estimate): strength = total dps * total effective hp, incl. static defenses
function unitDps(e) { const w = e.kind === 'u' ? (UT[e.t].wpn && W[UT[e.t].wpn]) : (BT[e.t].wpn && W[BT[e.t].wpn]); if (!w) return 0; if (e.kind === 'b' && e.offline) return 0; return w.dmg / w.cd * (e.lvl > 1 ? 1 + 0.35 * (e.lvl - 1) : 1) * (w.splash ? 1.4 : 1); }
function combatSim(mine, theirs) {
  let d1 = 0, h1 = 0, d2 = 0, h2 = 0; for (const u of mine) { d1 += unitDps(u); h1 += u.hp; } for (const f of theirs) { d2 += unitDps(f); h2 += f.hp; }
  if (d2 * h2 <= 0) return 9; return (d1 * h1) / (d2 * h2);
}
function threatsNear(P, foes, x, y, r) { return foes.filter(f => (f.kind === 'u' ? UT[f.t].wpn && f.t !== 'harv' : BT[f.t].wpn) && dhypot(f.x - x, f.y - y) < r); }
// macro manager: spending discipline (no float), production scaling
function macroMgr(P, S, D, cnt, me) {
  const Y = D.sys; if (!Y.float || P.cr < Y.float) return;
  const order = [['veh', ['heavy', 'light', 'arty', 'aa', 'titan', 'tsar']], ['inf', ['rocketeer', 'rifle', 'sniper', 'pyro', 'kommando']], ['air', ['gunship', 'intercept', 'jet', 'stealth']]];
  for (const [cat, list] of order) {
    const cap = Math.min(queueCap(P.team, cat), producers(P.team, cat) * 2);
    for (let k = 0; k < 4 && P.queues[cat].length < cap && P.cr > Y.float * 0.5; k++) { const ok = list.filter(t => avail(P.team, t) && P.gas >= (UT[t].gas || 0)); if (!ok.length) break; if (!enqueue(P.team, ok[(G.tick + k) % ok.length])) break; }
  }
  // defense upgrades with the surplus
  if (G.R() < 0.3) { const t = G.ents.find(b => b.team === P.team && b.kind === 'b' && UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); }
}
// defense manager: put static defense on the ground path toward the enemy (natural choke), not randomly around HQ
function chokePoint(P, hq, ef) {
  const S = P.aiS; if (S.choke && G.time - S.chokeT < 240) return S.choke;
  const path = findPath(Math.floor(hq.x), Math.floor(hq.y), Math.floor(ef.x), Math.floor(ef.y)); S.chokeT = G.time;
  if (!path || path.length < 6) return (S.choke = null);
  let pick = null; for (const c of path) { const x = c % MW, y = (c / MW) | 0; if (dhypot(x - hq.x, y - hq.y) >= 9) { pick = { x, y }; break; } }
  return (S.choke = pick);
}
// harass squad: small fast group raids harvesters / undefended refineries & expansions, retreats when outgunned
function harassMgr(P, S, D, me, foes, knownB, home, hq) {
  if (!D.sys.hsq || G.time < Math.max(D.harassAfter, 300) || !peaceOver()) return;
  S.hsq = (S.hsq || []).filter(u => u.hp > 0 && !u.dead);
  if (S.hsq.length < 3 && G.time > (S.hsqT || 0)) { const add = home.filter(u => (u.t === 'scout' || u.t === 'light' || u.t === 'gunship') && !S.hsq.includes(u)).slice(0, 4 - S.hsq.length); if (S.hsq.length + add.length >= 3) { add.forEach(u => { S.hsq.push(u); S.attackers.add(u.id); }); S.hsqT = G.time + 45; } }
  if (!S.hsq.length || G.time < (S.hsqGo || 0)) return; S.hsqGo = G.time + 3;
  const c = S.hsq[0], danger = threatsNear(P, foes, c.x, c.y, 8);
  if (danger.length && combatSim(S.hsq, danger) < 0.8) { orderMove(S.hsq, hq.x, hq.y, false); S.hsq.forEach(u => S.attackers.delete(u.id)); S.hsq = []; S.hsqT = G.time + 60; return; }
  const harv = foes.filter(f => f.t === 'harv').sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (harv) { if (!c.tgt || c.tgt.t !== 'harv') orderAttack(S.hsq, harv); return; }
  const soft = knownB.filter(b => (b.t === 'refinery' || b.t === 'cc' || b.t === 'extractor') && !knownB.some(k => BT[k.t].wpn && dhypot(k.x - b.x, k.y - b.y) < 8)).sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (soft) { if (c.order === 'idle' || !c.tgt) orderAttack(S.hsq, soft); }
}

// ===== Chief: stronger commander (no resource cheats) =====
const armyVal = l => l.reduce((a, u) => a + UT[u.t].cost * u.hp / u.mhp, 0);
function chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart) {
  if (D.chief && !D.si) { const st = { x: hq.x, y: hq.y }; for (const u of S.grp || []) if (u.hp < u.mhp * 0.25 && !u.retreating && UT[u.t].armor !== 'inf') { u.retreating = true; orderMove([u], st.x, st.y, false); S.attackers.delete(u.id); } if (S.grp) S.grp = S.grp.filter(u => !u.retreating); for (const u of me) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - st.x, u.y - st.y) < 4)) u.retreating = false; }
  S.eArmy = Math.max((S.eArmy || 0) * 0.995, armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)));
  const ground = home.filter(u => u.t !== 'harv' && !UT[u.t].jet && UT[u.t].wpn);
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x);
  const stage = { x: hq.x + dcos(ang) * 9, y: hq.y + dsin(ang) * 9 };
  // group management
  S.grp = (S.grp || []).filter(u => u.hp > 0 && !u.dead);
  if (S.grp.length) {
    const v = armyVal(S.grp), c = { x: S.grp.reduce((a, u) => a + u.x, 0) / S.grp.length, y: S.grp.reduce((a, u) => a + u.y, 0) / S.grp.length };
    const near = foes.filter(f => f.kind === 'u' && UT[f.t].wpn && dhypot(f.x - c.x, f.y - c.y) < 10);
    const thr = D.sys.sim ? threatsNear(P, foes, c.x, c.y, 10) : null, simR = thr && thr.length ? combatSim(S.grp, thr) : 9;
    if (D.sys.sim ? (simR < 0.5 && v < S.grpV0 * 0.85 && G.time - S.lastAttack > 20) : (v < S.grpV0 * 0.35 && armyVal(near) > v * 1.2)) { // combat-sim says losing -> retreat & regroup at home defenses
      orderMove(S.grp, stage.x, stage.y, false); S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; S.retreatT = G.time; S.wave = Math.max(S.wave, 12);
    } else if (G.time > (S.regT || 0)) {
      S.regT = G.time + 4;
      // regroup stragglers: leaders wait for the pack
      const far = S.grp.filter(u => dhypot(u.x - c.x, u.y - c.y) > 5 + Math.sqrt(S.grp.length) * 0.9);
      if (far.length > S.grp.length * 0.3 && !near.length && G.time > (S.regroupT || 0) && (S.regroupT = G.time + 12)) { orderMove(S.grp, c.x, c.y, true); }
      else {
        const tgts = knownB.slice(); const pref = D.si && !SIOFF.pref ? ['cc', 'factory', 'barracks', 'refinery', 'hq', 'airfield', 'turret', 'aagun', 'tech', 'power'] : ['turret', 'aagun', 'refinery', 'factory', 'barracks', 'power', 'airfield', 'tech', 'hq'];
        tgts.sort((a, b) => dhypot(a.x - c.x, a.y - c.y) * 0.3 + (pref.indexOf(a.t) + 1 || 9) - dhypot(b.x - c.x, b.y - c.y) * 0.3 - (pref.indexOf(b.t) + 1 || 9));
        const t = tgts[0] || huntTarget(P, S, c, estart);
        const step = Math.min(8, dhypot(t.x - c.x, t.y - c.y)), a2 = datan2(t.y - c.y, t.x - c.x);
        if (!near.length && step > 3) orderMove(S.grp.filter(u => u.order !== 'attack'), c.x + dcos(a2) * step, c.y + dsin(a2) * step, true);
        else if (!near.length && tgts[0]) orderMove(S.grp.filter(u => u.order !== 'attack'), t.x, t.y, true);
      }
    }
  }
  // home army: hold in formation at stage point
  const idle = ground.filter(u => !S.grp.includes(u) && !S.attackers.has(u.id));
  if (!intruders.length && G.time > (S.formT || 0) && idle.length) { S.formT = G.time + 15; const stray = idle.filter(u => dhypot(u.x - stage.x, u.y - stage.y) > 5 && u.order === 'idle'); if (stray.length > 2) orderFormation(idle, stage.x, stage.y, ang); }
  // launch attack when strong enough
  const av = armyVal(idle);
  const need = Math.max(S.wave * 650, (S.eArmy || 0) * 1.4);
  // reinforce a running attack with what has gathered at home
  if (S.grp.length && !intruders.length && (av > 5000 || idle.length > 14) && G.time > (S.reinfT || 0)) { S.reinfT = G.time + 20; const c = S.grp[0]; orderMove(idle, c.x, c.y, true); idle.forEach(u => { S.grp.push(u); S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; }); }
  const maxed = popOf(P.team) >= POP_CAP - 8;
  if (!S.grp.length && !intruders.length && peaceOver() && (av >= need || idle.length >= 30 || maxed && idle.length >= 10) && (G.time - S.lastAttack > D.waveGap || maxed) && G.time > (S.retreatT || -99) + (maxed ? 8 : 25)) {
    S.grp = idle.slice(); S.grpV0 = armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
    S.lastAttack = G.time; S.regT = 0; S.wave = Math.min(D.waveMax, S.wave + D.waveInc);
    // multi-prong: a fast flank squad hits a different (soft) target at the same time
    if (D.sys.prong && S.grp.length >= 12 && knownB.length >= 2) { const fast = S.grp.filter(u => UT[u.t].sp >= 2.2).slice(0, Math.floor(S.grp.length * 0.3)); if (fast.length >= 3) { S.grp = S.grp.filter(u => !fast.includes(u)); S.flank = fast; } }
  }
  if (S.flank) { S.flank = S.flank.filter(u => u.hp > 0 && !u.dead); if (!S.flank.length) S.flank = null; else if (G.time > (S.flankT || 0)) { S.flankT = G.time + 4; const f = S.flank[0];
    const soft = knownB.filter(b => ['refinery', 'cc', 'extractor', 'power', 'barracks'].includes(b.t)).sort((a, b) => dhypot(a.x - f.x, a.y - f.y) - dhypot(b.x - f.x, b.y - f.y))[0];
    const thr = threatsNear(P, foes, f.x, f.y, 9); if (thr.length && combatSim(S.flank, thr) < 0.6) { if (S.grp.length) orderMove(S.flank, S.grp[0].x, S.grp[0].y, true); S.grp.push(...S.flank); S.flank = null; }
    else if (soft && (!f.tgt || f.tgt.kind !== 'b')) orderAttack(S.flank, soft); else if (!soft) { S.grp.push(...S.flank); S.flank = null; } } }
}

// ===== Chief SI extras: rush defense, wounded retreat, coordinated jet strikes w/ escort =====
const SIOFF = (typeof globalThis !== 'undefined' && globalThis.SIOFF) || {};
function siExtras(P, S, me, foes, knownB, hq, estart, intruders) {
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x), stage = { x: hq.x + dcos(ang) * 8, y: hq.y + dsin(ang) * 8 };
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && !UT[u.t].air);
  // early rush defense: recall everything when base attacked in the first 6 minutes
  // base defense recall (any time): bring the attack group home if the base faces a real threat
  if (!SIOFF.recall2 && intruders.length && S.grp && S.grp.length && G.time > (S.recallT || 0)) { const iv = armyVal(intruders.filter(f => me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 12))), hv = armyVal(army.filter(u => !S.grp.includes(u) && dhypot(u.x - hq.x, u.y - hq.y) < 20));
    if (iv > Math.max(4500, hv * 1.5)) { const c = intruders[0]; S.recallT = G.time + 10; S.grp.forEach(u => S.attackers.delete(u.id)); orderMove(S.grp, c.x, c.y, true); S.grp = []; S.retreatT = G.time; } }
  if (!SIOFF.recall && intruders.length && G.time < 360) { const c = intruders.reduce((a, f) => (a.x += f.x / intruders.length, a.y += f.y / intruders.length, a), { x: 0, y: 0 });
    if (armyVal(intruders) > 500 && G.time > (S.recallT || 0)) { S.recallT = G.time + 6; const all = army.filter(u => u.t !== 'harv'); if (S.grp && S.grp.length) { S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; } orderMove(all, c.x, c.y, true); } }
  // 2 early turrets toward the enemy, gas-first upgrades
  const tur = me.filter(e => e.t === 'turret').length + P.queues.def.filter(q => q.t === 'turret').length + (P.ready.def === 'turret' ? 1 : 0);
  if (intruders.length && G.time < 360) S.rushed = true;
  if (!SIOFF.turrets && S.rushed && tur < 2 && !P.queues.def.length && !P.ready.def && P.cr > 250 && avail(P.team, 'turret')) enqueue(P.team, 'turret');
  // faction special as win condition
  const sp = FACTIONS[P.fac].sp, spD = UT[sp] || BT[sp];
  if (!SIOFF.special && spD && G.time > 300 && avail(P.team, sp) && P.gas >= (spD.gas || 0) && P.cr > spD.cost * 0.5) { const qc = UT[sp] ? (spD.from === 'barracks' ? 'inf' : spD.air ? 'air' : 'veh') : spD.cat; const have = me.filter(e => e.t === sp).length + P.queues[qc].filter(q => q.t === sp).length + (P.ready[qc] === sp ? 1 : 0); if (have < (BT[sp] ? 2 : 4) && P.queues[qc].length < 2) enqueue(P.team, sp); }
  // retreat badly wounded units (not when defending at home)
  if (!SIOFF.retreat) for (const u of army) if (u.hp < u.mhp * 0.3 && !u.retreating && dhypot(u.x - hq.x, u.y - hq.y) > 14 && u.t !== 'harv') { u.retreating = true; orderMove([u], stage.x, stage.y, false); if (S.grp) S.grp = S.grp.filter(x => x !== u); S.attackers.delete(u.id); }
  for (const u of army) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - stage.x, u.y - stage.y) < 3)) u.retreating = false;
  // jet strike waves (>=3 armed jets); interceptor escorts orbit the target instead of hovering
  const jets = me.filter(u => u.t === 'jet' && u.js === 'landed' && u.ammo >= W.jbomb.ammo);
  if (!SIOFF.jets && jets.length >= 3 && knownB.length && peaceOver() && G.time > (S.strikeT || 0)) {
    const pri = ['refinery', 'extractor', 'power', 'factory', 'airfield', 'tech', 'barracks', 'cc', 'hq'];
    const aaNear = b => knownB.filter(k => k.t === 'aagun' && dhypot(k.x - b.x, k.y - b.y) < 7).length;
    const tg = knownB.filter(b => BT[b.t].cat !== 'def').sort((a, b) => ((pri.indexOf(a.t) + 1 || 9) + aaNear(a) * 3) - ((pri.indexOf(b.t) + 1 || 9) + aaNear(b) * 3))[0];
    if (tg) { orderAttack(jets, tg); S.strike = { tg, until: G.time + 30 }; S.strikeT = G.time + 22; }
  }
  if (S.strike && (G.time > S.strike.until || S.strike.tg.hp <= 0)) S.strike = null;
  const esc = me.filter(u => u.t === 'intercept');
  if (!SIOFF.escort && esc.length) { S.escA = (S.escA || 0) + 0.9; const c = S.strike ? S.strike.tg : { x: hq.x + dcos(ang) * 6, y: hq.y + dsin(ang) * 6 }, r = S.strike ? 4 : 5;
    esc.forEach((u, k) => { if (u.tgt && u.tgt.hp > 0 && UT[u.tgt.t] && UT[u.tgt.t].air) return; const a = S.escA + k * 2 * Math.PI / esc.length; orderMove([u], Math.max(1, Math.min(MW - 1, c.x + dcos(a) * r)), Math.max(1, Math.min(MH - 1, c.y + dsin(a) * r)), true); }); }
  // scouting: keep enemy base memory fresh with a cheap unit
  if (G.time > (S.siScoutT || 60) && !knownB.length) { const sc = me.find(u => u.t === 'scout' || u.t === 'rifle'); if (sc) orderMove([sc], estart[0], estart[1], false); S.siScoutT = G.time + 60; }
}

// ===== expansions / growth =====
function aiSite(P, hq) {
  let best = null, bd = 1e9;
  for (const st of G.sites || []) {
    if (G.ents.some(e => e.kind === 'b' && dhypot(e.x - st.x, e.y - st.y) < 7)) continue;
    if (G.ents.some(e => foe(e.team, P.team) && dhypot(e.x - st.x, e.y - st.y) < 12)) continue;
    let ore = 0; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const x = Math.floor(st.x) + dx, y = Math.floor(st.y) + dy; if (inb(x, y)) ore += G.ore[idx(x, y)]; }
    if (ore < 4000) continue;
    const d = dhypot(st.x - hq.x, st.y - hq.y) - (st.k === 'mid' && DIFF[P.diff].expandAt < 320 && !(DIFF[P.diff].si && !(globalThis.SIOFF || {}).nomid) ? 4 : 0) + (st.k === 'mid' && DIFF[P.diff].si && !(globalThis.SIOFF || {}).nomid ? 12 : 0);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function aiGrowth(P, S, D, cnt, hq, foes) {
  // modest wall chain: one 5-segment line toward the enemy start (Medium/Hard/Chief), once rich
  if (P.diff !== 'easy' && !S.walled && G.time > 420 && P.cr > 2500 && G.starts) { S.walled = true;
    const es = G.players.filter(Q => foe(Q.team, P.team)).map(Q => G.starts[Q.start])[0];
    if (es) { const a = datan2(es[1] - hq.y, es[0] - hq.x), cx = Math.floor(hq.x + dcos(a) * 8), cy = Math.floor(hq.y + dsin(a) * 8), px = Math.round(-dsin(a) * 2), py = Math.round(dcos(a) * 2);
      buildWalls(P.team, wallLine(cx - px, cy - py, cx + px, cy + py).filter(([x, y]) => canPlace('wall', P.team, x, y))); } }
  const ok = t => avail(P.team, t) && (S.bad[t] || 0) < G.time && !!aiSpot(P, t, hq, foes);
  const nCC = cnt.cc || 0;
  // expansion: timing scaled by difficulty; more when bases run dry
  if ((cnt.refinery || 0) < 2 + nCC && nCC > 0 && ok('refinery')) return 'refinery';
  if ((cnt.extractor || 0) < 1 + nCC && ok('extractor')) return 'extractor';
  // extra production when floating money
  if (P.cr > Math.min(3000, (D.sys.float || 6000) * 0.8) && (cnt.factory || 0) < Math.ceil(D.sys.prodMax * 0.6) && ok('factory')) return 'factory';
  if (P.cr > 2500 && (cnt.barracks || 0) < Math.max(1, Math.floor(D.sys.prodMax * 0.5)) && ok('barracks')) return 'barracks';
  if (P.cr > 3500 && (cnt.airfield || 0) < (D.si ? 2 : 1) && (cnt.airfield || 0) > 0 && ok('airfield')) return 'airfield';
  if (P.pow < 40 && ok('power')) return 'power';
  return null;
}
// focus: if a human ally is pushing, attack what they attack; otherwise eco/production targets
function aiFocus(P, knownB) {
  const tg = knownB.slice(); const hum = G.players.find(Q => !Q.ai && !foe(Q.team, P.team) && Q.team !== P.team);
  if (hum) { const arm = G.ents.filter(e => e.team === hum.team && e.kind === 'u' && e.t !== 'harv'); if (arm.length) { const cx = arm.reduce((a, e) => a + e.x, 0) / arm.length, cy = arm.reduce((a, e) => a + e.y, 0) / arm.length; tg.sort((a, b) => dhypot(a.x - cx, a.y - cy) - dhypot(b.x - cx, b.y - cy)); return tg; } }
  return tg;
}
function aiPing(P, S, me) {
  for (const pg of G.pings || []) if (!foe(pg.team, P.team) && pg.team !== P.team && pg.t > (S.pingT || -1)) {
    S.pingT = pg.t; const arm = me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv' && !UT[u.t].jet);
    const n = pg.kind === 'attack' ? arm : arm.slice(0, Math.ceil(arm.length * 0.6));
    if (n.length) { orderMove(n, pg.x, pg.y, true); n.forEach(u => S.attackers.add(u.id)); }
    G.events.push({ e: 'allyAck', team: P.team, x: pg.x, y: pg.y });
  }
}

function intrudersEarly(P, foes, me) { return foes.some(f => f.kind === 'u' && UT[f.t].wpn && me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 12)); }

// with no known enemy buildings: sweep expansion sites / starts, nearest unvisited first
function huntTarget(P, S, c, estart) {
  S.hunted = S.hunted || {}; const vis = G.visT[P.team];
  const cands = [...G.starts.map(s => ({ x: s[0], y: s[1] })), ...(G.sites || [])].filter(s => { const k = (s.x | 0) + ',' + (s.y | 0); if (vis[idx(Math.floor(s.x), Math.floor(s.y))]) S.hunted[k] = G.time; return G.time - (S.hunted[k] ?? -999) > 90; });
  if (!cands.length) return { x: estart[0], y: estart[1] };
  cands.sort((a, b) => dhypot(a.x - estart[0], a.y - estart[1]) * 1.5 + dhypot(a.x - c.x, a.y - c.y) * 0.5 - dhypot(b.x - estart[0], b.y - estart[1]) * 1.5 - dhypot(b.x - c.x, b.y - c.y) * 0.5); return cands[0];
}
