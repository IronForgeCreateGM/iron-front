'use strict';
// ===== AI opponent =====
// Each think: power check, build order (rebuilds losses), placement, harvesters,
// counter-composition army, base defense, waves, harass, scouting.
const AI_ORDER = ['power', 'barracks', 'refinery', 'power', 'factory', 'extractor', 'turret', 'refinery', 'power', 'tech', 'aagun', 'power', 'turret', 'airfield', 'power', 'turret', 'aagun', 'refinery', 'power'];
const AI_ORDER_CHIEF = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'power', 'turret', 'refinery', 'tech', 'power', 'aagun', 'turret', 'power', 'airfield', 'power', 'turret', 'extractor', 'gcannon', 'aagun', 'power', 'refinery', 'power'];
const facDef = (P, b) => b === 'tesla' && P.fac === 'fra' ? 'gatling' : b; // v5.9 France builds the Gatling Bastion where others build Teslas
const AI_ORDER_SI = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'turret', 'power', 'tech', 'refinery', 'aagun', 'power', 'power', 'tesla', 'airfield', 'turret', 'power', 'extractor', 'gcannon', 'aagun', 'power', 'power'];
const AI_ORDER_AIR = AI_ORDER.concat(['power', 'airfield', 'extractor', 'power', 'gcannon', 'power']);
function aiInit(P) { P.aiS = { next: 0, wave: DIFF[P.diff].wave0, scoutT: DIFF[P.diff].scoutAfter, lastAttack: 0, attackers: new Set(), known: new Map(), sellT: 0 }; }
// v5.0 peace window: no attacks on bases before G.opts.peace seconds (default 180; lobby Off/3/5/8 min)
function peaceOver(P) { if (G.end) return false; /* v7.0 Endless: defender bots never march out (the Horde has no base) */ if (P && DIFF[P.diff].human) return true; const t0 = (G.opts.peace == null ? 180 : G.opts.peace) + ((P && P.stagger) || 0); if (G.time < t0) return false;
  // v6.0 Hellgate warlords wake up one at a time, then raid in 3.5-min-on / 1.5-min-off cycles (offset per warlord) until the endgame
  if (P && P.stagger != null && G.time < END_T) return (G.time - t0) % 300 < 210; return true; }
function aiStep(P) {
  if (!P.ai) return; // bot logic never touches a human player's units
  const S = P.aiS, D = DIFF[P.diff], doc = (!D.order || D.doc) && !SIOFF.doc;
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
  // intel: is the enemy tower-heavy? (static D value vs mobile army) -> siege plan: knock out power from the air, bring artillery, then push the front wall
  { const eDef = knownB.filter(b => BT[b.t].wpn); S.eDefV = eDef.reduce((a, b) => a + BT[b.t].cost, 0); S.towerHeavy = eDef.length >= 4 && S.eDefV > (S.eArmy || 0) * 0.6; S.siege = S.towerHeavy || knownB.filter(b => b.t === 'wall' || b.t === 'gate').length >= 6; S.eOffline = eDef.filter(b => b.offline).length; }
  S.bad = S.bad || {};
  const V6 = isV76(P), X6 = V6 && !SIOFF.x76, NK = !!D.nick, V = isV71(P), VE = V && !SIOFF.e71, VP = V && !SIOFF.p71, VD = V && !SIOFF.d71, VA = V && !SIOFF.a71; if (V) intel71(P, S, foes, knownB);
  const cnt = {}; for (const e of me) cnt[e.t] = (cnt[e.t] || 0) + 1;
  // queued items count too
  for (const c in P.queues) for (const it of P.queues[c]) cnt[it.t] = (cnt[it.t] || 0) + 1;
  for (const c in P.ready) if (P.ready[c]) cnt[P.ready[c]] = (cnt[P.ready[c]] || 0) + 1;
  if (V6 && !SIOFF.k76) pre76(P, S, D, me, cnt, hq, foes, knownB);
  if (m7On(P, 'c')) spend7(P, S, cnt, me, hq);
  // 1) place ready buildings
  for (const cat of ['bld', 'def']) if (P.ready[cat]) { const rt = P.ready[cat], spot = aiSpot(P, rt, hq, foes); if (spot) placeReady(P.team, cat, spot[0], spot[1]); else { cancel(P.team, rt); S.bad[rt] = G.time + 60; } }
  // 2) structures: power emergency, then order list (rebuild handled by counting)
  if (V6) S.bank76 = (S.bank76 || 0) * 0.85 + P.cr * 0.15;
  if (V6 && !SIOFF.sf76 && !NK && G.time > (S.sf76T || 0)) { S.sf76T = G.time + 3; const my = armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv' && !UT[u.t].engineer)); S.safe76 = sf2On(P) ? G.time < 360 && eta76(foes, hq, 40) > my * 1.2 + 1500 : G.time < 480 && (S.compTot || 0) > my * 1.2 + 1500; } // v7.6.1 (SC2 'army supply parity'): the enemy has shown more army than I own -> units before greed
  if (!P.queues.bld.length && !P.ready.bld) {
    let want = null;
    if (P.pow < (doc && G.time > 400 ? 60 : 20) && (cnt.power || 0) < (doc ? 30 : 10)) want = 'power';
    else if (!(V6 && S.safe76 && !(sf2On(P) && !(cnt.cc || 0))) && G.time > (X6 && SIOFF.xa ? D.expandAt : VE ? 195 : D.expandAt) * (1 + (X6 ? 0.55 : 0.7) * (cnt.cc || 0)) && (!VE || (cnt.refinery || 0) >= (X6 && SIOFF.xa ? 1 : 2) + (cnt.cc || 0)) && !NK && (cnt.cc || 0) < (X6 ? 5 : 4) && (cnt.factory || 0) > (X6 ? Math.min(2, cnt.cc || 0) : 0) && avail(P.team, 'cc') && (S.bad.cc || 0) < G.time && aiSpot(P, 'cc', hq, foes)) want = 'cc';
    else if ((NK || (cnt.cc || 0) > 0 || pg76(P, V6)) && !(V6 && S.safe76 && (cnt.refinery || 0) >= 2) && (cnt.refinery || 0) < (NK ? 5 : X6 ? 2 + Math.round((cnt.cc || 0) * 1.5) + (pg76(P, V6) ? 2 : 0) : 2 + (cnt.cc || 0)) && (S.bad.refinery || 0) < G.time) want = 'refinery';
    else if (V6 && !SIOFF.m76 && !NK && (S.bank76 || 0) > 450 && P.cr > 500 && G.time > 100 && (P.queues.inf.length || (!SIOFF.pp76 && popOf(P.team) > 45)) && P.queues.veh.length && P.pow > 10 && (cnt.factory || 0) + (cnt.barracks || 0) < 4 + 2 * (cnt.cc || 0) && (cnt.factory || 0) + (cnt.barracks || 0) >= 2 && (S.m76T || 0) < G.time && (want = macro76(P, S, cnt, hq, foes))) S.m76T = G.time + 20; // v7.6.1 macro: money piling up while every producer is busy -> more production (SC2 'add production when the bank grows')
    else if (V6 && !SIOFF.f76 && !NK && G.time > 200 && (cnt.factory || 0) < Math.min(3, 1 + (cnt.cc || 0)) && P.cr > 400 && avail(P.team, 'factory') && (S.bad.factory || 0) < G.time && aiSpot(P, 'factory', hq, foes)) want = 'factory'; // v7.6: each new base brings another factory (expansions never starve the army)
    else { const need = {}; for (const b of (D.order || (VE ? AI_ORDER_SI71 : D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : D.firstAttack || P.diff === 'normal' ? AI_ORDER : AI_ORDER_AIR))) { if (BT[b].cat !== 'bld') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } want = b; break; } } }
    if (VE) { if (!want || (P.cr > 1500 && !['power', 'cc', 'refinery', 'tech'].includes(want)) || (V6 && !SIOFF.pd76 && P.cr > 3000 && want !== 'power')) want = prodTarget71(P, S, D, cnt, hq, foes) || want; }
    else if (doc && (!want || (P.cr > 2600 && want !== 'power'))) want = prodTarget(P, S, D, cnt, hq, foes) || want;
    if (!want) want = aiGrowth(P, S, D, cnt, hq, foes);
    if (NK && (want === 'factory' && (cnt.factory || 0) >= 1 || want === 'airfield' || want === 'cc')) want = null;
    S.saving = want && avail(P.team, want) && P.cr <= BT[want].cost * 0.3 && (['refinery', 'cc', 'factory', 'power', 'extractor', 'barracks'].includes(want) || V6 && (want === 'silo' || want === 'tech')) ? want : null;
    if (want && avail(P.team, want) && P.cr > BT[want].cost * 0.3) enqueue(P.team, want);
  }
  if (V6 && !SIOFF.q76) post76(P, S, D, me, cnt, hq);
  { const nd = me.filter(e => e.kind === 'b' && BT[e.t].cat === 'def' && e.t !== 'wall' && e.t !== 'gate' && e.t !== 'gtower').length, nw = (cnt.wall || 0) + (cnt.gate || 0) + (cnt.gtower || 0);
    S.defFull = (VD && !G.end ? nd >= (P.fac === 'fra' ? 18 + 6 * (cnt.cc || 0) : P.fac === 'chn' ? 10 + 4 * (cnt.cc || 0) : 5 + 3 * (cnt.cc || 0)) * (S.underAttack ? 1.4 : 1) * (popOf(P.team) >= POP_CAP - 6 && P.cr > 3000 ? 1.5 : 1) : nd >= 14 + 4 * (cnt.cc || 0)) || (G.time > END_T && nd >= 8); S.wallFull = nw >= 36 || G.time > END_T; // v5.6: towers must not starve the army
    if (S.defFull && (!S.underAttack || (VD && !G.end))) for (const it of P.queues.def.slice()) if (it.t !== 'wall' && it.prog < 0.3) cancel(P.team, it.t); }
  if (doc && (VD && !G.end ? !S.defFull : !(S.defFull && !S.underAttack))) defenseMgr(P, S, D, me, cnt, hq);
  else if (!(VD && !G.end) && !P.queues.def.length && !P.ready.def && (cnt.factory || 0) > 0) {
    const need = {}; for (const b0 of (D.order || (D.si ? AI_ORDER_SI : D.chief ? AI_ORDER_CHIEF : AI_ORDER))) { const b = facDef(P, b0); if (BT[b].cat !== 'def') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } if (P.cr > (D.defCr || 1200)) enqueue(P.team, b); break; } }
  }
  // 2b) ally pings
  aiPing(P, S, me);
  facAI(P, S, D, me, cnt, hq, foes);
  // 3) harvesters
  const refs = cnt.refinery || 0, harvs = cnt.harv || 0;
  const threat = D.chief && G.time < 240 ? armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)) > armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn)) * 1.3 : false;
  const wantH = threat ? Math.min(2, refs * 2) : Math.min((D.chief ? 8 : 6) + (cnt.cc || 0) * 3, (refs ? refs * 2 + (D.si && !SIOFF.harv ? me.filter(e => e.t === 'refinery').length : 0) : 2)); const wantHs = Math.min(FIELD_CAP * Math.max(1, refs + (cnt.cc || 0)), Math.max(2, Math.round(wantH * 1.5 * (D.sat || 1)))); // v6.2: haulers carry 40% less but cost ~half -> ~1.5x as many, max 4 per field
  if (harvs < wantHs && !(V6 && S.safe76 && !sf2On(P) && harvs >= Math.max(4, refs * 2)) && avail(P.team, 'harv') && !P.queues.veh.some(q => q.t === 'harv')) { if (P.queues.veh.length >= 2) cancel(P.team, P.queues.veh[P.queues.veh.length - 1].t); enqueue(P.team, 'harv'); }
  // money stall breaker: no harvesters and broke -> sell non-essential structures
  const realH = me.filter(e => e.t === 'harv').length;
  if (realH === 0 && P.cr < UT.harv.cost && G.time > S.sellT) {
    const sac = ['airfield', 'tech', 'aagun', 'turret', 'wall'].map(t => myBld().find(b => b.t === t)).find(Boolean) || (cnt.barracks > 1 && myBld().find(b => b.t === 'barracks'));
    if (sac) { sellB(sac); S.sellT = G.time + 15; }
  }
  // v5.6: no construction yard left -> power can't be rebuilt; sell dark power consumers (defenses first) until the grid is positive
  if (P.pow < 0 && !me.some(e => (e.t === 'hq' || e.t === 'cc') && e.hp > 0) && G.time > (S.shedT || 0)) { const dr = myBld().filter(b => BT[b.t].pow < 0 && b.t !== 'factory' && b.t !== 'barracks').sort((a, b) => (BT[a.t].cat === 'def' ? 0 : 1) - (BT[b.t].cat === 'def' ? 0 : 1) || BT[a.t].pow - BT[b.t].pow)[0]; if (dr) { sellB(dr); S.shedT = G.time + 2; } }
  // v5.4 power watchdog: never sit dark — rebuild/expand power before any other spend
  const conPow = me.some(e => e.con && e.t === 'power' && e.hp > 0); // v7.2: a power plant already going up counts
  if ((P.pow < (G.time > 300 ? 60 : 40) || me.some(e => e.offline)) && avail(P.team, 'power') && (cnt.power || 0) < 60 && !(conPow && P.pow >= 0)) {
    if (P.queues.bld.length && P.queues.bld[0].t !== 'power' && P.pow < 0) cancel(P.team, P.queues.bld[0].t); // power before anything else
    if (!P.queues.bld.length && !P.ready.bld && P.cr > BT.power.cost * 0.25) enqueue(P.team, 'power');
    if ((S.bad.power || 0) > G.time && G.time > (S.clearT || 0)) { const jb = myBld().filter(b => b.t === 'wall' || b.t === 'turret' || b.t === 'aagun' || b.t === 'gate').sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y))[0]; if (jb) { sellB(jb); S.clearT = G.time + 6; S.bad.power = 0; } }
    if (P.pow < 0) return; // stay focused on power while blacked out
  }
  if (realH < 2 && P.cr < UT.harv.cost + 200 && P.pow >= 0) return; // save for harvesters
  if (!me.some(e => e.t === 'refinery' || e.t === 'cc') && P.cr < 1500 && G.time < 240) return; // never starve the first refinery
  if (VE && G.time < 270 && !S.rushed && me.filter(e => e.t === 'refinery' && e.hp > 0).length < 2 && P.cr < BT.refinery.cost + 400 && P.pow >= 0) return; // v7.1 pro opener: 2nd refinery before units
  if (S.saving && !intrudersEarly(P, foes, me) && (VE ? (G.time - (S.saveT0 || (S.saveT0 = G.time))) % 65 < 45 : G.time - (S.saveT0 || (S.saveT0 = G.time)) < 25) && P.pow >= (VE ? 0 : 20) && !(VE ? P.cr > BT[S.saving].cost : cnt.factory >= 1 && P.cr > 800 && G.time > 300)) return; // save up, but never starve army after the first factory
  if (!S.saving) S.saveT0 = 0;
  // 4) army composition: counter what enemy fields
  const ft = { inf: 0, armor: 0, air: 0 };
  for (const f of foes) if (f.kind === 'u' && f.t !== 'harv') { const a = UT[f.t].armor; if (a === 'inf') ft.inf++; else if (a === 'air') ft.air++; else ft.armor++; }
  const pick = (list) => { const ok = list.filter(([t]) => avail(P.team, t)); let tot = 0; ok.forEach(o => tot += o[1]); let r = G.R() * tot; for (const o of ok) { r -= o[1]; if (r <= 0) return o[0]; } return ok.length ? ok[0][0] : null; };
  if (VP && P.cr > 250 + (S.saving ? BT[S.saving].cost : 0)) prodMix71(P, S, cnt, harvs, refs); // never starve the eco build for units
  else if (P.cr > 300) {
    const myInf = me.filter(e => e.kind === 'u' && UT[e.t].armor === 'inf').length;
    const pq = c => S.rsSave && P.cr < S.rsSave ? 0 : Math.max(2, Math.ceil(producers(P.team, c) * (doc ? 1.5 : 1)));
    if (P.queues.inf.length < pq('inf')) { const t = pick([['rifle', 2 + ft.inf], ['rocketeer', 1 + ft.armor * 1.5 + ft.air], ['sniper', ft.inf > 3 ? 1 + ft.inf * 0.25 : 0.2], ['kommando', P.gas > 200 ? 1.5 : 0], ['marine', 8 + ft.inf * 0.5 + ft.armor * 0.3 + ft.air * 0.5], ['engineer', myInf > 6 && (cnt.engineer || 0) < 1 + myInf / 12 ? 0.8 : 0]]); if (t) enqueue(P.team, t); }
    if (P.queues.veh.length < pq('veh') && harvs >= Math.min(2, refs * 2)) {
      const t = pick([['heavy', 5 + ft.armor], ['drone', 2.5 + ft.armor * 0.4 + ft.inf * 0.3 + (S.siege ? 1.5 : 0)], ['raijin', P.gas > 260 ? 2.5 + (S.siege ? 2 : 0) + (P.gas > 1200 ? 3 : 0) : 0], ['titan', P.gas > 300 ? 1.5 + ft.air * 0.3 + (P.gas > 1200 ? 4 : 0) : 0], ['tsar', P.gas > 350 ? 2 + (P.gas > 1200 ? 4 : 0) : 0], ['scout', 1 + ft.inf * 0.5], ['arty', 1 + ft.inf * 0.4 + (S.towerHeavy ? 5 : S.siege ? 3 : 0)], ['aa', ft.air * 2]]);
      if (t) enqueue(P.team, t);
    }
    const airN = (cnt.gunship || 0) + (cnt.jet || 0) + (cnt.intercept || 0) + (cnt.bomber || 0);
    if (P.queues.air.length < (doc ? producers(P.team, 'air') : 1) && airN < (doc ? 14 : D.chief ? 9 : 6)) { const t = pick([['gunship', (cnt.gunship || 0) < 4 ? 2 : 0.3], ['jet', D.si ? ((cnt.jet || 0) < 4 ? 4 : 0) : 1.2 + knownB.length * 0.05], ['intercept', ft.air * 1.2 + (D.si && (cnt.jet || 0) >= 2 && (cnt.intercept || 0) < 2 ? 3 : 0)], ['bomber', (P.cr > 3500 ? 0.8 : 0.1) + (S.towerHeavy ? 3 : 0)], ['stealth', P.gas > 250 ? 2 : 0]]); if (t) enqueue(P.team, t); }
  }
  // 5) defense: enemies near any of my buildings
  const myB = me.filter(e => e.kind === 'b'), allyB = G.ents.filter(e => e.kind === 'b' && !foe(e.team, P.team));
  const army = me.filter(e => e.kind === 'u' && UT[e.t].wpn);
  aiV62(P, S, cnt, myB);
  const intruders = foes.filter(f => f.kind === 'u' && allyB.some(b => dhypot(b.x - f.x, b.y - f.y) < 10));
  S.underAttack = intruders.length > 0 || G.time - (S.uaT || -99) < 60; if (intruders.length) S.uaT = G.time;
  if (pw76On(P)) { const al = new Set(); for (const e of G.ents) if (e.kind === 'u' && e.hp > 0 && foe(e.team, P.team)) al.add(e.id); pw76Track(P, S, intruders, al); }
  G.danger = G.danger || {}; G.danger[P.team] = intruders.map(f => ({ x: f.x, y: f.y }));
  const home = army.filter(u => !S.attackers.has(u.id));
  if (VA && !SIOFF.dfn && intruders.length) defend71(P, S, D, me, myB, home, intruders, hq);
  else if (intruders.length) {
    const mine = intruders.filter(f => myB.some(b => dhypot(b.x - f.x, b.y - f.y) < 12)), c = mine[0] || intruders[0];
    let defenders = home.filter(u => u.order !== 'attack' && dhypot(u.x - c.x, u.y - c.y) < 25);
    if (!mine.length && G.time > (S.helpT || 0) && armyVal(intruders) > 500 && armyVal(home) > 1500) { S.helpT = G.time + 30; defenders = home.filter(u => u.t !== 'harv' && !UT[u.t].jet).slice(0, Math.ceil(home.length * 0.55)); defenders.forEach(u => S.attackers.add(u.id)); G.events.push({ e: 'allyAck', team: P.team, x: c.x, y: c.y }); }
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
  if (D.harass && G.time > D.harassAfter && peaceOver(P) && G.R() < D.harass * 0.15) {
    const fh = foes.find(f => f.t === 'harv');
    const raiders = home.filter(u => u.t === 'scout' || u.t === 'gunship').slice(0, 4);
    if (fh && raiders.length >= 2) { orderAttack(raiders, fh); raiders.forEach(u => S.attackers.add(u.id)); if (S.firstAttackT == null) S.firstAttackT = G.time; }
  }
  // 7b) air strikes: jets/bombers hit eco & production when armed
  const strikers = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth') && u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo);
  if (!doc && strikers.length && knownB.length && G.time > D.harassAfter && peaceOver(P) && G.R() < 0.4) { const pri = S.towerHeavy ? ['power', 'refinery', 'factory', 'airfield', 'tech', 'barracks'] : ['refinery', 'power', 'factory', 'airfield', 'tech', 'barracks'], tg = knownB.slice().sort((a, b) => (pri.indexOf(a.t) + 1 || 9) - (pri.indexOf(b.t) + 1 || 9))[0]; if (tg) orderAttack(strikers, tg); }
  if (doc) { airRaidMgr(P, S, D, me, foes, knownB, hq); if (V6 && !SIOFF.wh76) warhead76(P, S, D, me, foes, knownB, intruders); else warheadMgr(P, S, D, me, foes, knownB); }
  macroMgr(P, S, D, cnt, me); harassMgr(P, S, D, me, foes, knownB, home, hq); dropMgr(P, S, D, me, foes, knownB, home, hq); medevacMgr(P, S, D, me, hq); derrickMgr(P, S, D, me, cnt, hq);
  S.doc = doc;
  if (D.si) siExtras(P, S, me, foes, knownB, hq, estart, intruders);
  if (D.chief || D.sys.sim) { if (G.time <= END_T) chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart); keepBusy(P, S, D, me, cnt, hq, intruders); return; }
  // 8) waves
  for (const id of [...S.attackers]) { const u = byId(id); if (!u) S.attackers.delete(id); else if (u.order === 'idle' && !u.tgt && G.R() < 0.2) S.attackers.delete(id); }
  const ready = home.filter(u => u.t !== 'harv');
  if (ready.length >= S.wave && !intruders.length && G.time >= D.firstAttack && peaceOver(P) && G.time - S.lastAttack > D.waveGap) {
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
  if (P.cr > 3200 && G.time > 420 && (cnt.tech || 0) && G.R() < 0.06) { const t = myB.find(b => (b.t === 'hq' || b.t === 'cc') && !b.sm3 && b.upT == null); if (t) upgradeB(t); } // v6.2 bots buy SM-3 too (same price)
  keepBusy(P, S, D, me, cnt, hq, intruders);
  // 9) repair damaged buildings
  for (const b of myB) if (b.hp < b.mhp * 0.6 && P.cr > (G.time > END_T ? 1500 : 500)) b.repair = true; else if (G.time > END_T && P.cr < 800) b.repair = false;
}
function aiV62(P, S, cnt, myB) { // v6.2: Air Command pads, Howler siege, research (all deterministic, no bonuses)
  if (P.cr > 1400 && G.time >= (S.t62p || 0)) { S.t62p = G.time + 3; const af = myB.find(b => b.t === 'airfield' && !b.pads && b.upT == null); if (af && G.ents.filter(e => e.team === P.team && e.kind === 'u' && UT[e.t].jet).length >= 3) upgradeB(af); } // v6.2 Air Command extra pads when the jet wing outgrows 4 slots
  if (G.time >= (S.t62s || 0) && (S.t62s = G.time + 1)) for (const u of G.ents) if (u.team === P.team && u.t === 'arty' && u.hp > 0) { // v6.2 bots use Howler Siege Mode
    let near = 1e9, inR = false; for (const o of G.ents) if (o.hp > 0 && foe(o.team, P.team) && (o.kind === 'b' || !UT[o.t].air)) { const dd = dhypot(o.x - u.x, o.y - u.y); if (o.kind === 'u' && dd < near) near = dd; if (dd < SIEGE.rng - 0.3 && dd > W.arty.minRng + 0.5) inR = true; }
    if (!u.sg && inR && near > 4.5 && (!u.path.length || u.order === 'amove' || u.order === 'idle')) { if (siegeToggle(u, 1)) u.sgHold = true; }
    else if (u.sg === 2 && (near < 3.2 || !inR)) siegeToggle(u, 0); }
  if (isV71(P) && !SIOFF.art && S.grp && S.grp.length && G.time >= (S.art71T || 0)) { S.art71T = G.time + 1; // v7.1.1: Howlers at the back of a big fight walk up to siege range instead of idling out of reach
    for (const u of S.grp) if (u.t === 'arty' && u.hp > 0 && !u.sg && (u.order === 'idle' || u.order === 'amove') && !u.tgt) { let nr = 1e9, ne = null; for (const o of G.ents) if (o.kind === 'u' && o.hp > 0 && foe(o.team, P.team) && !isAir(o) && o.t !== 'harv' && dhypot(o.x - u.x, o.y - u.y) < 17 && visibleTo(P.team, o)) { const dd = dhypot(o.x - u.x, o.y - u.y); if (dd < nr) { nr = dd; ne = o; } }
      if (ne && nr > SIEGE.rng - 0.6 && nr < 17) { const k = (nr - (SIEGE.rng - 1.6)) / nr; orderMove([u], u.x + (ne.x - u.x) * k, u.y + (ne.y - u.y) * k, false); } } }
  S.rsSave = 0;
  if (cnt.tech && G.time > 360 && G.time >= (S.t62r || 0)) { // v6.2 bots research the track matching their army (same prices as the player; they save up for it)
    const lab = myB.find(b => b.t === 'tech' && b.upT == null && b.sell < 0 && b.hp > 0 && G.time - b.born > 2); if (lab) { const n = {}; for (const e of G.ents) if (e.team === P.team && e.hp > 0) { const c = resCat(e); if (c) n[c] = (n[c] || 0) + (e.kind === 'b' ? 1.5 : 1); }
      const best = RES.cats.map(c => [c, n[c] || 0]).filter(([c, v]) => v >= 3 && (() => { const i = researchInfo(P.team, c); return i && !i.busy && !i.lock && P.gas >= i.gas; })()).sort((a, b) => b[1] - a[1])[0];
      if (best) { const i = researchInfo(P.team, best[0]); if (P.cr >= i.cost + 150) { if (researchB(lab, best[0])) S.t62r = G.time + 60; } else if (!S.underAttack) S.rsSave = i.cost + 150; } } }
}
function aiSpot(P, t, hq, foes) {
  const d = BT[t];
  let ax = hq.x, ay = hq.y;
  if (t === 'cc') { for (let tries = isV71(P) ? 3 : 1; tries > 0; tries--) { const site = aiSite(P, hq); if (!site) return null; for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) { const x = Math.round(site.x - 1.5) + ox, y = Math.round(site.y - 1.5) + oy; if (canPlace('cc', P.team, x, y)) return [x, y]; }
    if (isV71(P) && P.aiS) { (P.aiS.siteBad = P.aiS.siteBad || {})[site.x + ',' + site.y] = G.time + 90; } } return null; } // v7.1: a blocked site no longer stalls expansion - try the next one
  if (t === 'extractor') { const vs = (G.vents || []).slice().sort((a, b) => dhypot(a[0] - hq.x, a[1] - hq.y) - dhypot(b[0] - hq.x, b[1] - hq.y));
    for (const [vx, vy] of vs) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (canPlace(t, P.team, vx - ox, vy - oy)) return [vx - ox, vy - oy]; return null; }
  const kb = P.aiS ? [...P.aiS.known.values()] : []; const ef = kb.find(f => f.t === 'hq') || kb[0] || (st => ({ x: st[0], y: st[1] }))(G.starts[G.players[P.aiS && P.aiS.eTeam != null ? P.aiS.eTeam : (P.team ? 0 : 1)].start]);
  if (t === 'refinery') { // near closest ore
    const refs = G.ents.filter(e => e.team === P.team && (e.t === 'refinery'));
    const bases = G.ents.filter(e => e.team === P.team && (e.t === 'hq' || e.t === 'cc'));
    let b = -1, bd = 1e9, bb = hq; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 200) { const ox = i % MW, oy = (i / MW) | 0; let nb = hq, nd = 1e9; for (const B of bases) { const q = dhypot(ox - B.x, oy - B.y); if (q < nd) { nd = q; nb = B; } } const dd = nd + (refs.some(r => dhypot(r.x - ox, r.y - oy) < 7) ? 14 : 0); if (dd < bd) { bd = dd; b = i; bb = nb; } }
    if (b >= 0) { ax = (b % MW + bb.x) / 2; ay = (((b / MW) | 0) + bb.y) / 2; }
  } else if (d.cat === 'def' && P.aiS && P.aiS.defAt && G.time - P.aiS.defAtT < 60 && t !== 'wall') { ax = P.aiS.defAt.x; ay = P.aiS.defAt.y;
  } else if (d.cat === 'def' && ef && DIFF[P.diff].sys.choke && t !== 'wall' && chokePoint(P, hq, ef) && G.R() < 0.75) { const cp = P.aiS.choke; ax = cp.x + (G.R() - 0.5) * 3; ay = cp.y + (G.R() - 0.5) * 3;
  } else if (d.cat === 'def' && ef) { const a = datan2(ef.y - hq.y, ef.x - hq.x) + (G.R() - 0.5) * 1.6; ax = hq.x + dcos(a) * 7; ay = hq.y + dsin(a) * 7; }
  const cands = [];
  const y0 = Math.max(1, Math.floor(ay - d.h / 2 - 15)), y1 = Math.min(MH - d.h, Math.ceil(ay - d.h / 2 + 15)), x0 = Math.max(1, Math.floor(ax - d.w / 2 - 15)), x1 = Math.min(MW - d.w, Math.ceil(ax - d.w / 2 + 15)); // v7.1: same candidates, bounded scan
  const R7 = t === 'refinery' && m7On(P, 'e') ? ref7Tiles(ax, ay) : null; // v7.6.7 m7e: refinery dock faces the ore (shortest harvester round trip)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const dd = dhypot(x + d.w / 2 - ax, y + d.h / 2 - ay); if (dd < 14) cands.push([(R7 && R7.length ? ref7Score(R7, x, y, d, dd) : dd) + G.R() * 1.5, x, y]); }
  cands.sort((a, b) => a[0] - b[0]);
  const g = getBlock(), NT = nt76On(P); let ntF = 0;
  for (const [, x, y] of cands) {
    if (!canPlace(t, P.team, x, y)) continue;
    if (P.aiS && P.aiS.lanes && t !== 'wall' && P.aiS.lanes.some(l => dhypot(l.x - x - d.w / 2, l.y - y - d.h / 2) < 1.4 + d.w * 0.5)) continue; // keep entrance lanes open
    // keep 1-tile gap around non-defense buildings so units can flow
    if (d.cat !== 'def') { let ok = true; for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy) && g[idx(xx, yy)] === 2) { ok = false; break; } if (!ok) continue; }
    if (NT && !nt76Ok(P, x + d.w / 2, y + d.h / 2, nt76Foot(t, x, y), null, false /* 2-wide lane check off: it starved builds in drills */, nt76Src(P, t, x, y))) { if (++ntF >= 8) return null; continue; } // v7.6.5 no-trap
    return [x, y];
  }
  if (d.cat === 'bld' && !aiSpot.inner) { aiSpot.inner = true; try { return aiSpotWide(P, t, hq); } finally { aiSpot.inner = false; } }
  return null;
}
// v5.6: crowded base -> look around every own building (expansions too) out to 22 tiles, then without the spacing rule
function aiSpotWide(P, t, hq) {
  const NT = nt76On(P); let ntF = 0;
  const d = BT[t], g = getBlock(), anchors = G.ents.filter(e => e.team === P.team && e.kind === 'b' && e.t !== 'wall' && e.t !== 'gate' && e.hp > 0);
  for (const strict of [true, false]) { const cands = [];
    for (const a of anchors) for (let y = Math.max(1, Math.floor(a.y - 9)); y < Math.min(MH - d.h, a.y + 9); y++) for (let x = Math.max(1, Math.floor(a.x - 9)); x < Math.min(MW - d.w, a.x + 9); x++) cands.push([dhypot(x - hq.x, y - hq.y) + (a.t === 'hq' || a.t === 'cc' ? 0 : 3), x, y]);
    cands.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]); let last = -1;
    for (const [dd, x, y] of cands) { if (dd > 26) break; const k = y * MW + x; if (k === last) continue; last = k; if (!canPlace(t, P.team, x, y)) continue;
      if (P.aiS && P.aiS.lanes && P.aiS.lanes.some(l => dhypot(l.x - x - d.w / 2, l.y - y - d.h / 2) < 1.2 + d.w * 0.5)) continue;
      if (strict) { let ok = true; for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy) && g[idx(xx, yy)] === 2) { ok = false; break; } if (!ok) continue; }
      if (NT && !nt76Ok(P, x + d.w / 2, y + d.h / 2, nt76Foot(t, x, y), null, false /* 2-wide lane check off: it starved builds in drills */, nt76Src(P, t, x, y))) { if (++ntF >= 8) return null; continue; } // v7.6.5 no-trap
      return [x, y]; } }
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
  if (isV71(P) && !SIOFF.p71) { for (let k = 0; k < 3 && P.cr > Y.float * 0.5; k++) { const c0 = {}; for (const e of me) c0[e.t] = (c0[e.t] || 0) + 1; for (const c in P.queues) for (const it of P.queues[c]) c0[it.t] = (c0[it.t] || 0) + 1; for (const cat of D.nick ? ['inf'] : ['veh', 'inf', 'air']) { if (!producers(P.team, cat) || P.queues[cat].length >= producers(P.team, cat) * 2) continue; const t = D.nick && avail(P.team, 'marine') ? 'marine' : produce71(P, S, cat, c0); if (t) enqueue(P.team, t); } } if (G.R() < 0.3) { const t = G.ents.find(b => b.team === P.team && b.kind === 'b' && UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); } return; }
  const order = [['veh', ['heavy', 'heavy', 'arty', 'aa', 'titan', 'tsar']], ['inf', ['rocketeer', 'rifle', 'sniper', 'kommando', 'marine', 'marine']], ['air', ['gunship', 'intercept', 'jet', 'stealth']]];
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
  if (!D.sys.hsq || G.time < Math.max(D.harassAfter, 300) || !peaceOver(P)) return;
  S.hsq = (S.hsq || []).filter(u => u.hp > 0 && !u.dead);
  if (S.hsq.length < 3 && G.time > (S.hsqT || 0)) { const add = home.filter(u => (u.t === 'scout' || u.t === 'gunship') && !S.hsq.includes(u)).slice(0, 4 - S.hsq.length); if (S.hsq.length + add.length >= 3) { add.forEach(u => { S.hsq.push(u); S.attackers.add(u.id); }); S.hsqT = G.time + 45; } }
  if (!S.hsq.length || G.time < (S.hsqGo || 0)) return; S.hsqGo = G.time + 3;
  const c = S.hsq[0], danger = threatsNear(P, foes, c.x, c.y, 8);
  if (danger.length && combatSim(S.hsq, danger) < 0.8) { orderMove(S.hsq, hq.x, hq.y, false); S.hsq.forEach(u => S.attackers.delete(u.id)); S.hsq = []; S.hsqT = G.time + 60; return; }
  const harv = foes.filter(f => f.t === 'harv').sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (harv) { if (!c.tgt || c.tgt.t !== 'harv') orderAttack(S.hsq, harv); return; }
  const soft = knownB.filter(b => (b.t === 'refinery' || b.t === 'cc' || b.t === 'extractor') && !knownB.some(k => BT[k.t].wpn && dhypot(k.x - b.x, k.y - b.y) < 8)).sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (soft) { if (c.order === 'idle' || !c.tgt) orderAttack(S.hsq, soft); }
}


// transport drops: load a strike team at home, fly around the front (flank waypoint, avoid known flak), unload behind the wall on power/eco/production
// v6.3 Seraph Medevac: bots field one flying medic once the ground army is sizable and park it over the most-hurt cluster of their troops
function medevacMgr(P, S, D, me, hq) {
  if (P.diff === 'easy' || !hq) return;
  const meds = me.filter(u => u.t === 'medevac'), drop = S.drop && S.drop.tr, army = me.filter(u => u.kind === 'u' && !isAir(u) && u.t !== 'harv' && UT[u.t] && UT[u.t].wpn);
  if (!meds.some(m => m.id !== drop) && army.length >= 10 && G.time > 300 && avail(P.team, 'medevac') && !P.queues.air.some(q => q.t === 'medevac') && P.cr > 1300 && G.time > (S.medT || 0)) { enqueue(P.team, 'medevac'); S.medT = G.time + 60; }
  for (const m of meds) { if (m.id === drop || (m.cargo && m.cargo.length) || m.order === 'board' || m.order === 'unload') continue;
    if (m.hp < m.mhp * 0.35) { if (dhypot(m.x - hq.x, m.y - hq.y) > 4) orderMove([m], hq.x, hq.y, false); continue; }
    let best = null, bs = 0; for (const u of army) { if (u.hp >= u.mhp * 0.9) continue; let sc = 1 - u.hp / u.mhp; for (const o of army) if (o !== u && o.hp < o.mhp && dhypot(o.x - u.x, o.y - u.y) < MEDEVAC.r) sc += 1 - o.hp / o.mhp; if (sc > bs) { bs = sc; best = u; } }
    if (best) { // v7.0.2: escort the troops around the most damaged unit (same hang-back logic as the player's Medevac) instead of flying onto it
      const cur = m.order === 'escort' && m.esc && m.esc.ids.some(id => { const g = army.find(a => a.id === id); return g && dhypot(g.x - best.x, g.y - best.y) < 10; });
      if (!cur) { const grp = army.filter(a => dhypot(a.x - best.x, a.y - best.y) < 9); escortGroup([m, ...grp], best.x, best.y, true, false); } }
    else if (m.order === 'escort') continue;
    else if (dhypot(m.x - hq.x, m.y - hq.y) > 8 && m.order === 'idle') orderMove([m], hq.x + 2, hq.y + 2, false); } }
function dropMgr(P, S, D, me, foes, knownB, home, hq) {
  if (P.diff === 'easy' || !peaceOver(P) || G.time < 420) return;
  const trs = me.filter(u => u.t === 'medevac');
  const want = (S.towerHeavy || knownB.some(b => b.t === 'wall') || G.time > 720) && knownB.length;
  if (want && !trs.length && avail(P.team, 'medevac') && !P.queues.air.some(q => q.t === 'medevac') && P.cr > 1500 && G.time > (S.dropT || 0)) enqueue(P.team, 'medevac');
  if (!S.drop) { const tr = trs.find(t => !t.cargo.length && dhypot(t.x - hq.x, t.y - hq.y) < 16 && t.order === 'idle');
    if (!tr || !want || G.time < (S.dropT || 0)) return;
    if (S.siege && D.si && !(S.grp || []).length && !SIOFF.siege) return; // time drops with the main push
    const pool = home.filter(u => !isAir(u) && u.t !== 'harv' && UT[u.t].wpn && dhypot(u.x - hq.x, u.y - hq.y) < 20 && !(S.grp || []).includes(u));
    const veh = pool.filter(u => u.t === 'heavy' || u.t === 'titan').slice(0, 1), inf = pool.filter(u => UT[u.t].armor === 'inf' && u.t !== 'engineer').slice(0, veh.length ? 4 : 8);
    const team = veh.concat(inf); if (team.length < 3) return;
    orderMove([tr], hq.x, hq.y, false); orderBoard(team, tr); team.forEach(u => S.attackers.add(u.id)); S.drop = { tr: tr.id, ph: 'load', t0: G.time }; return; }
  const dr = S.drop, tr = byId(dr.tr);
  if (!tr) { S.drop = null; S.dropT = G.time + 150; return; }
  if (dr.ph === 'load' && (cargoUsed(tr) >= 6 || G.time - dr.t0 > 25)) {
    if (!tr.cargo.length) { S.drop = null; S.dropT = G.time + 60; return; }
    const flak = knownB.filter(b => b.t === 'aagun'); const pri = ['power', 'refinery', 'factory', 'barracks', 'airfield', 'tech', 'cc', 'hq'];
    const tg = knownB.filter(b => BT[b.t].cat !== 'def').sort((a, b) => ((pri.indexOf(a.t) + 1 || 9) + flak.filter(f => dhypot(f.x - a.x, f.y - a.y) < 7).length * 4) - ((pri.indexOf(b.t) + 1 || 9) + flak.filter(f => dhypot(f.x - b.x, f.y - b.y) < 7).length * 4))[0];
    if (!tg) return;
    // flank waypoint: perpendicular offset from the direct line, on the side with fewer known flak
    const mx = (tr.x + tg.x) / 2, my = (tr.y + tg.y) / 2, a = datan2(tg.y - tr.y, tg.x - tr.x), side = flak.filter(f => (f.x - mx) * -dsin(a) + (f.y - my) * dcos(a) > 0).length > flak.length / 2 ? -1 : 1;
    const wp = { x: Math.max(2, Math.min(MW - 2, mx - dsin(a) * 14 * side)), y: Math.max(2, Math.min(MH - 2, my + dcos(a) * 14 * side)) };
    const land = nearFree(Math.floor(tg.x + dcos(a) * 3), Math.floor(tg.y + dsin(a) * 3), 5);
    orderUnload(tr, land[0] + 0.5, land[1] + 0.5); tr.path = [wp, { x: land[0] + 0.5, y: land[1] + 0.5 }]; dr.ph = 'fly'; dr.tg = tg.id; dr.n = tr.cargo.length; return; }
  if (dr.ph === 'fly' && tr.order !== 'unload' && !tr.cargo.length) { // dropped: strike team attacks, transport goes home
    const tg = byId(dr.tg), near = me.filter(u => !isAir(u) && dhypot(u.x - tr.x, u.y - tr.y) < 5);
    if (tg && tg.hp > 0) orderAttack(near, tg); else orderMove(near, tr.x, tr.y, true);
    orderMove([tr], hq.x, hq.y, false); S.drop = null; S.dropT = G.time + (D.si ? 90 : D.chief ? 120 : 180); }
}


// derricks: send engineers to the nearest unowned/enemy derrick (escort optional); slower tiers react later
function derrickMgr(P, S, D, me, cnt, hq) {
  const V6 = isV76(P) && !SIOFF.dk76; if (!G.derricks || G.time < (V6 ? 30 : D.firstAttack ? 300 : 60) || G.time < (S.dkT || 0)) return; S.dkT = G.time + (V6 ? 4 : 10 + D.think * 10);
  const mine = G.derricks.filter(d => d.owner === P.team).length, free = G.derricks.filter(d => d.owner < 0 || d.owner !== P.team && foe(d.owner, P.team));
  if (!free.length || mine >= (P.diff === 'easy' ? 2 : 8)) return;
  const eng = me.filter(u => u.t === 'engineer'), busy = eng.filter(u => u.order === 'derrick');
  if (eng.length - busy.length === 0 && (cnt.engineer || 0) < (P.diff === 'easy' ? 1 : 3) && avail(P.team, 'engineer') && P.cr > (V6 ? 250 : 600) && P.queues.inf.length < (V6 ? 6 : 3) && !(V6 && P.queues.inf.some(q => (q.t || q) === 'engineer'))) enqueue(P.team, 'engineer');
  for (const u of eng) if (u.order !== 'derrick') { const tg = free.filter(d => !busy.some(b => b.dk === d.id)).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - (a.op ? 14 : 0) - dhypot(b.x - hq.x, b.y - hq.y) + (b.op ? 14 : 0))[0]; if (tg) { orderDerrick([u], tg.id); busy.push(u); } }
}

// ===== Chief: stronger commander (no resource cheats) =====
const armyVal = l => l.reduce((a, u) => a + UT[u.t].cost * u.hp / u.mhp, 0);
// v7.1.1: a maxed army's group order costs one A* per unit (60-110 ms for ~100 units on 96-tile maps) — Chief SI orders big groups in waves of 30 over consecutive AI ticks, later waves forming up behind
function oM71(P, S, us, x, y, am) { if (!isV71(P) || SIOFF.chunk || us.length <= 34) { S.mvQ = null; return orderMove(us, x, y, am); }
  let cx = 0, cy = 0; for (const u of us) { cx += u.x; cy += u.y; } cx /= us.length; cy /= us.length; const s = us.slice().sort((a, b) => dhypot(a.x - x, a.y - y) - dhypot(b.x - x, b.y - y) || a.id - b.id), d = Math.max(1, dhypot(cx - x, cy - y)), bx = (cx - x) / d, by = (cy - y) / d;
  orderMove(s.slice(0, 30), x, y, am); S.mvQ = { u: s.slice(30), x, y, am, bx, by, k: 1 }; }
function mvQ71(S) { const q = S.mvQ; if (!q) return; const part = q.u.splice(0, 30).filter(u => u.hp > 0 && !u.dead && S.grp && S.grp.includes(u)); const tx = Math.max(1, Math.min(MW - 1, q.x + q.bx * 3.5 * q.k)), ty = Math.max(1, Math.min(MH - 1, q.y + q.by * 3.5 * q.k)); q.k++;
  if (part.length) orderMove(part, tx, ty, q.am); if (!q.u.length) S.mvQ = null; }
function chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart) {
  if (D.chief && !D.si) { const st = { x: hq.x, y: hq.y }; for (const u of S.grp || []) if (u.hp < u.mhp * 0.25 && !u.retreating && UT[u.t].armor !== 'inf') { u.retreating = true; orderMove([u], st.x, st.y, false); S.attackers.delete(u.id); } if (S.grp) S.grp = S.grp.filter(u => !u.retreating); for (const u of me) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - st.x, u.y - st.y) < 4)) u.retreating = false; }
  if (isV76(P) && !SIOFF.rl76) release76(P, S);
  S.eArmy = Math.max((S.eArmy || 0) * 0.995, armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)));
  const V = isV71(P) && !SIOFF.a71;
  if (S.mvQ) mvQ71(S);
  if (V && !SIOFF.ts) { const hx = hq.x + 2, hy = hq.y + 2; for (const u of me) if (u.t === 'tsar' && u.hp > 0) { // v7.1.1: Tsars are 3200+gas — pull a badly hurt one home to regenerate instead of trading it
      if (!u.tsR && u.hp < u.mhp * 0.42) { u.tsR = 1; S.attackers.delete(u.id); orderMove([u], hx, hy, false); } else if (u.tsR && u.hp >= u.mhp * 0.9) u.tsR = 0; else if (u.tsR && u.order === 'idle' && dhypot(u.x - hx, u.y - hy) > 6) orderMove([u], hx, hy, false); }
    if (S.grp) S.grp = S.grp.filter(u => !u.tsR); }
  const ground = home.filter(u => u.t !== 'harv' && !UT[u.t].jet && UT[u.t].wpn && !u.tsR);
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x);
  const stage = home76(P, S, { x: hq.x + dcos(ang) * 9, y: hq.y + dsin(ang) * 9 });
  // group management
  if (V && !SIOFF.bl) { const dd = (S.grp || []).filter(u => u.hp <= 0 || u.dead); S.bl71 = (S.bl71 || []).filter(x => G.time - x[0] < 16); if (dd.length) S.bl71.push([G.time, dd.length, dd.reduce((a, u) => a + UT[u.t].cost, 0)]); if (S.kl71 == null || G.time - (S.kl71T || 0) > 16) { S.kl71 = P.stats.kills; S.kl71T = G.time; } }
  S.grp = (S.grp || []).filter(u => u.hp > 0 && !u.dead);
  if (S.grp.length) {
    const v = armyVal(S.grp), c = { x: S.grp.reduce((a, u) => a + u.x, 0) / S.grp.length, y: S.grp.reduce((a, u) => a + u.y, 0) / S.grp.length };
    // v5.4 stuck-army: if the pack barely moved for 12s while ordered out, clear paths and re-issue
    if (!S.grpMark || G.time - S.grpMark.t > 12) {
      if (S.grpMark && dhypot(c.x - S.grpMark.x, c.y - S.grpMark.y) < 2.5 && !foes.some(f => f.kind === 'u' && dhypot(f.x - c.x, f.y - c.y) < 8)) {
        const dest = S.grpWp || knownB[0] || { x: estart[0], y: estart[1] };
        if (m7On(P, 'b') && !S.grpWp) { S.grp.forEach(u => { u.path = []; u.stuckN = 0; }); S.regT = 0; S.st7 = (S.st7 || 0) + 1; if (S.st7 >= 3 && S.tg7) { S.bad7 = S.bad7 || {}; S.bad7[S.tg7.id] = G.time + 45; S.tg7 = null; S.st7 = 0; } } // v7.6.6: no random jitter; the field step re-issues, a target stuck on 3x is dropped
        else { S.grp.forEach(u => { u.path = []; u.stuckN = 0; }); oM71(P, S, S.grp, dest.x + (G.R() - 0.5) * 4, dest.y + (G.R() - 0.5) * 4, true); }
      } else if (S.grpMark) S.st7 = 0;
      S.grpMark = { x: c.x, y: c.y, t: G.time };
    }
    const near = foes.filter(f => f.kind === 'u' && UT[f.t].wpn && dhypot(f.x - c.x, f.y - c.y) < 10);
    const thr = D.sys.sim ? threatsNear(P, foes, c.x, c.y, 10) : null, simR = thr && thr.length ? combatSim(S.grp, thr) : 9;
    if (V) plan71Tick(P, S, c, near);
    if (V && G.time > (S.humT || 0)) { const hp = humanPush71(P); const pp0 = hp && !SIOFF.hp2 ? plan71(P) : null, tg0 = S.grpWp && !S.grpWp.hold ? S.grpWp : pp0 && !pp0.hum ? pp0 : { x: estart[0], y: estart[1] }, dh = hp ? dhypot(hp.x - c.x, hp.y - c.y) : 1e9, nowJoin = hp && !SIOFF.hp2 && !(S.grpWp && S.grpWp.hum) && (dh < dhypot(tg0.x - c.x, tg0.y - c.y) * 0.85 || (hp.v || 0) > armyVal(S.grp) * 0.6); // v7.1.2: mid-attack, re-evaluate — the human's push is nearer or worth more -> retarget everyone now
      if (hp && dh < 80 && (!near.length || nowJoin)) { S.humT = G.time + 10; S.grpWp = { x: hp.x, y: hp.y, t: G.time + 25, hum: 1 }; if (nowJoin) oM71(P, S, S.grp.filter(u => u.order !== 'attack' || dhypot(u.x - hp.x, u.y - hp.y) > 14), hp.x, hp.y, true); const p = plan71(P); if (p && !p.hum) { p.x = hp.x; p.y = hp.y; p.team = hp.team; p.hum = 1; } } } // converge on the human ally's push
    const commit = S.doc && !SIOFF.commit; let fr = c; if (V && !SIOFF.rt2) { const pp = plan71(P), tg = S.grpWp && !S.grpWp.hold ? S.grpWp : pp ? pp : { x: estart[0], y: estart[1] }; let bd = 1e9; for (const u of S.grp) { const d = dhypot(u.x - tg.x, u.y - tg.y); if (d < bd) { bd = d; fr = u; } } } // v7.1.1: read the fight at the spearhead, not the (spread-out) centroid
    const thrF = V && !SIOFF.rt2 ? (() => { const l = threatsNear(P, foes, c.x, c.y, 11); for (const f of threatsNear(P, foes, fr.x, fr.y, 12)) if (!l.includes(f)) l.push(f); for (const b of knownB) if (BT[b.t].wpn && b.hp > 0 && !b.offline && dhypot(b.x - fr.x, b.y - fr.y) < 12 && !l.includes(b)) l.push(b); return l; })() : thr;
    const lost71 = V && !SIOFF.ret && thrF && thrF.length && (() => { const r = sim71(S.grp.concat(home.filter(u => !S.grp.includes(u) && dhypot(u.x - c.x, u.y - c.y) < 10), allyU76(P, c.x, c.y, 12)), thrF); S.simR71 = r; return SIOFF.rt2 ? r < 0.4 && v < S.grpV0 * 0.75 && G.time - S.lastAttack > 15 : G.time - S.lastAttack > 15 && ((r < 0.5 && v < S.grpV0 * 0.8) || (r < 1.1 && v < S.grpV0 * 0.5)); })();
    const bleed71 = V && !SIOFF.bl && !lost71 && G.time - S.lastAttack > 15 && (() => { const mx = popOf(P.team) >= POP_CAP - 10; let n = 0, val = 0; for (const x of S.bl71 || []) { n += x[1]; val += x[2]; } const kd = P.stats.kills - (S.kl71 || 0); if (n >= 6 && val > Math.max(2500, (v + val) * 0.3) && kd < n * (mx ? 0.4 : 0.6)) { S.bl71 = []; return true; } return false; })(); // v7.1.1: losing units fast without trading (towers/snipers in the fog) -> the sim is blind, pull out
    const avoid71 = V && !SIOFF.eng && !lost71 && !bleed71 && G.time > (S.engT || 0) && (S.engT = G.time + 1) && !(plan71(P) || {}).hum && popOf(P.team) < POP_CAP - 12 && (() => { // pros don't take bad fights: read the engagement before it starts
      const t15 = threatsNear(P, foes, c.x, c.y, 15); if (!SIOFF.rt2) { for (const f of threatsNear(P, foes, fr.x, fr.y, 14)) if (!t15.includes(f)) t15.push(f); for (const b of knownB) if (BT[b.t].wpn && b.hp > 0 && !b.offline && dhypot(b.x - fr.x, b.y - fr.y) < 14 && !t15.includes(b)) t15.push(b); } if (!t15.length || armyVal(t15.filter(f => f.kind === 'u')) + t15.filter(f => f.kind === 'b').length * 400 < v * 0.35) return false;
      const r = sim71(S.grp.concat(home.filter(u => !S.grp.includes(u) && dhypot(u.x - c.x, u.y - c.y) < 12), allyU76(P, c.x, c.y, 14)), t15); return r < 0.7; })();
    if (V && !SIOFF.mic && thr && thr.length && !lost71) micro71(P, S, S.grp);
    if (V && !SIOFF.ret ? lost71 || avoid71 || bleed71 : D.sys.sim ? (commit ? simR < 0.22 && v < S.grpV0 * 0.45 && G.time - S.lastAttack > 30 : simR < (S.siege && D.si && !SIOFF.siege ? 0.3 : 0.5) && v < S.grpV0 * 0.85 && G.time - S.lastAttack > 20) : (v < S.grpV0 * 0.35 && armyVal(near) > v * 1.2)) { // combat-sim says losing -> retreat & regroup at home defenses
      orderMove(S.grp, stage.x, stage.y, false); S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; S.grpWp = null; S.retreatT = G.time; S.wave = Math.max(S.wave, 12);
    } else if (G.time > (S.regT || 0)) {
      S.regT = G.time + 4;
      // regroup stragglers: leaders wait for the pack
      const far = S.grp.filter(u => dhypot(u.x - c.x, u.y - c.y) > 5 + Math.sqrt(S.grp.length) * 0.9);
      if (S.grpWp && !S.grpWp.hold && !near.length && (dhypot(c.x - S.grpWp.x, c.y - S.grpWp.y) < 4.5 || G.time > S.grpWp.t)) S.grpWp = null; // flank waypoint reached
      if (S.grpWp && S.grpWp.hold) { if (!near.length && dhypot(c.x - S.grpWp.x, c.y - S.grpWp.y) > 4) oM71(P, S, S.grp.filter(u => u.order !== 'attack'), S.grpWp.x, S.grpWp.y, true); } // v7.1: wait at the rally until the whole team is in place
      else if (S.grpWp && !near.length) oM71(P, S, S.grp, S.grpWp.x, S.grpWp.y, true);
      else if (far.length > S.grp.length * (m7On(P, 'b') ? 0.45 : 0.3) && !near.length && G.time > (S.regroupT || 0) && (S.regroupT = G.time + (m7On(P, 'b') ? 20 : 12))) { oM71(P, S, S.grp, c.x, c.y, true); }
      else {
        const tgts = knownB.slice(); const pref = S.towerHeavy ? ['turret', 'tesla', 'gatling', 'gcannon', 'aagun', 'wall', 'power', 'refinery', 'factory', 'barracks', 'cc', 'hq'] : D.si && !SIOFF.pref ? ['cc', 'factory', 'barracks', 'refinery', 'hq', 'airfield', 'turret', 'aagun', 'tech', 'power'] : ['turret', 'aagun', 'refinery', 'factory', 'barracks', 'power', 'airfield', 'tech', 'hq'];
        tgts.sort((a, b) => dhypot(a.x - c.x, a.y - c.y) * 0.3 + (pref.indexOf(a.t) + 1 || 9) - dhypot(b.x - c.x, b.y - c.y) * 0.3 - (pref.indexOf(b.t) + 1 || 9));
        const M7 = m7On(P, 'b'); let t = (M7 && tgts.length ? tgt7(P, S, c, tgts) : null) || tgts[0] || huntTarget(P, S, c, estart);
        // v5.1 siege: break the weakest section of the wall/defence line in front of the pack (lowest hp, closest)
        if ((S.siege || S.doc && !SIOFF.commit) && (D.si || S.doc) && !SIOFF.siege) { const line = knownB.filter(b => (b.t === 'wall' || b.t === 'gate' || BT[b.t].wpn) && dhypot(b.x - c.x, b.y - c.y) < 13);
          if (line.length) { const real = line.map(b => byId(b.id) || b); real.sort((a, b) => (a.hp || 0) / 80 + dhypot(a.x - c.x, a.y - c.y) - (b.hp || 0) / 80 - dhypot(b.x - c.x, b.y - c.y)); const w = real[0];
            if (w && w.hp > 0 && G.time > (S.breachT || 0)) { S.breachT = G.time + 3; orderAttack(S.grp.filter(u => !u.tgt || u.tgt.kind !== 'u'), w); } } }
        const step = Math.min(8, dhypot(t.x - c.x, t.y - c.y)), a2 = datan2(t.y - c.y, t.x - c.x);
        if (M7 && t.kind === 'b' && move7(P, S, c, t, near)) {}
        else if (!near.length && step > 3) oM71(P, S, S.grp.filter(u => u.order !== 'attack'), c.x + dcos(a2) * step, c.y + dsin(a2) * step, true);
        else if (!near.length && tgts[0]) oM71(P, S, S.grp.filter(u => u.order !== 'attack'), t.x, t.y, true);
      }
    }
  }
  // home army: hold in formation at stage point
  const idle = ground.filter(u => !S.grp.includes(u) && !S.attackers.has(u.id));
  if (!intruders.length && G.time > (S.formT || 0) && idle.length) { S.formT = G.time + 15; const stray = idle.filter(u => dhypot(u.x - stage.x, u.y - stage.y) > 5 && u.order === 'idle'); if (stray.length > 2) orderFormation(idle, stage.x, stage.y, ang); }
  // launch attack when strong enough
  const av = armyVal(idle); S.av71 = intruders.length ? 0 : av;
  let need = Math.max(S.wave * 650, (S.eArmy || 0) * 1.4); if (S.doc) need = Math.max(need, (S.eArmy || 0) * 1.25 + (S.eDefV || 0) * 0.7);
  if (S.towerHeavy) { const arty = idle.filter(u => u.t === 'arty').length; need = Math.max(need, (S.eArmy || 0) * 1.2 + S.eDefV * (S.eOffline ? 0.5 : 1.1)); if (arty < 3 && !S.eOffline && idle.length < 30) need *= 1.5; }
  // reinforce a running attack with what has gathered at home
  const rl = S.doc && !SIOFF.commit; if (S.grp.length && !intruders.length && (rl ? av > 2200 || idle.length > 7 : av > 5000 || idle.length > 14) && G.time > (S.reinfT || 0)) { S.reinfT = G.time + (rl ? 10 : 20); const c = S.grp[0]; orderMove(idle, c.x, c.y, true); if (!SIOFF.rt2) S.grpV0 = (S.grpV0 || 0) + armyVal(idle); idle.forEach(u => { S.grp.push(u); S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; }); }
  const maxed = popOf(P.team) >= POP_CAP - 8;
  const tp = S.doc && !SIOFF.team && !(V && !SIOFF.plan) ? teamPlan(P) : null, join = tp && tp.team !== P.team && av >= need * 0.55 && idle.length >= 6;
  if (V && !SIOFF.plan) { if (army71(P, S, D, me, foes, knownB, idle, intruders, hq, estart) && D.sys.prong && S.grp.length >= 14 && knownB.length >= 2) { const fast = S.grp.filter(u => UT[u.t].sp >= 2.2 && !UT[u.t].air).slice(0, Math.min(6, Math.floor(S.grp.length * 0.2))); if (fast.length >= 3) { S.grp = S.grp.filter(u => !fast.includes(u)); S.flank = fast; S.flankT = G.time + 25; } } }
  else if (!S.grp.length && !intruders.length && peaceOver(P) && (av >= need || join || idle.length >= 30 || maxed && idle.length >= 10) && (G.time - S.lastAttack > D.waveGap * (S.doc ? 0.6 : 1) || maxed || join) && G.time > (S.retreatT || -99) + (maxed ? 8 : 25)) {
    S.grp = idle.slice(); S.grpV0 = armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
    S.lastAttack = G.time; S.regT = 0; S.wave = Math.min(D.waveMax, S.wave + D.waveInc); S.grpWp = null;
    if (S.doc && !SIOFF.team) { G.tplan = G.tplan || {}; // allied sync: joiners swing round to a different angle on the same target
      if (join) { const side = (P.team % 2 ? 1 : -1) * (tp.n % 2 ? 1 : -1), a = tp.a + side * 1.0; const wx = Math.max(3, Math.min(MW - 3, tp.x + dcos(a) * 13)), wy = Math.max(3, Math.min(MH - 3, tp.y + dsin(a) * 13)); const f = nearFree(Math.floor(wx), Math.floor(wy), 6); S.grpWp = { x: f[0] + 0.5, y: f[1] + 0.5, t: G.time + 45 }; tp.n++; }
      else G.tplan[P.ally] = { t: G.time, team: P.team, x: estart[0], y: estart[1], a: datan2(hq.y - estart[1], hq.x - estart[0]), n: 0 }; }
    // multi-prong: a fast flank squad hits a different (soft) target at the same time
    if (D.sys.prong && S.grp.length >= 12 && knownB.length >= 2) { const fast = S.grp.filter(u => UT[u.t].sp >= 2.2).slice(0, Math.floor(S.grp.length * 0.3)); if (fast.length >= 3) { S.grp = S.grp.filter(u => !fast.includes(u)); S.flank = fast; } }
  }
  // v5.4 close-out: late game allied mass push on the weakest surviving enemy
  if (S.doc && !V && G.time > 900 && !S.grp.length && !intruders.length && peaceOver(P) && idle.length >= 8 && G.time > (S.closeT || 0)) {
    const foesAlive = G.players.filter(Q => foe(Q.team, P.team) && !Q.out);
    if (foesAlive.length) {
      foesAlive.sort((a, b) => armyVal(G.ents.filter(e => e.team === a.team && e.kind === 'u' && e.hp > 0 && UT[e.t] && UT[e.t].wpn)) - armyVal(G.ents.filter(e => e.team === b.team && e.kind === 'u' && e.hp > 0 && UT[e.t] && UT[e.t].wpn)));
      const weak = foesAlive[0], wh = G.ents.find(e => e.team === weak.team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0) || { x: G.starts[weak.start][0], y: G.starts[weak.start][1] };
      G.tplan = G.tplan || {}; G.tplan[P.ally] = { t: G.time, team: P.team, x: wh.x, y: wh.y, a: datan2(hq.y - wh.y, hq.x - wh.x), n: 0, close: 1 };
      S.grp = idle.slice(); S.grpV0 = armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
      S.lastAttack = G.time; S.closeT = G.time + 45; oM71(P, S, S.grp, wh.x, wh.y, true);
    }
  }
  if (S.flank) { S.flank = S.flank.filter(u => u.hp > 0 && !u.dead); if (!S.flank.length) S.flank = null; else if (G.time > (S.flankT || 0)) { S.flankT = G.time + 4; const f = S.flank[0];
    const soft = knownB.filter(b => ['refinery', 'cc', 'extractor', 'power', 'barracks'].includes(b.t)).sort((a, b) => dhypot(a.x - f.x, a.y - f.y) - dhypot(b.x - f.x, b.y - f.y))[0];
    const thr = threatsNear(P, foes, f.x, f.y, 9); if (thr.length && combatSim(S.flank, thr) < 0.6) { if (S.grp.length) orderMove(S.flank, S.grp[0].x, S.grp[0].y, true); S.grp.push(...S.flank); S.flank = null; }
    else if (soft && (!f.tgt || f.tgt.kind !== 'b')) orderAttack(S.flank, soft); else if (!soft) { S.grp.push(...S.flank); S.flank = null; } } }
}

// ===== Chief SI extras: rush defense, wounded retreat, coordinated jet strikes w/ escort =====
const SIOFF = (typeof globalThis !== 'undefined' && globalThis.SIOFF) || {};
// 4c opt-in experiments (default OFF, so live games and replays are untouched): SION.pw76 = counter-attack window after a won defence,
// SION.fp76 = France/China 'fortress-punish' style (picked from the game seed, 1 option in 3): heavier static defence, absorb, then punish
const wg76On = P => !!G.r76 && !!G.nt && !SIOFF.wg76 && !P.ntOff; // v7.6.5: every bot's wall line has a gate (all difficulties; old replays have nt=0)
const SION = (typeof globalThis !== 'undefined' && globalThis.SION) || {};
const pw76On = P => !!G.r76 && !!G.nt && isV76(P) && !SIOFF.pw76 && !P.pwOff; // v7.6.5: counter-attack window ON for lobby Hard (si2) in games with the nt replay flag
function style76(P) { const S = P.aiS; if (S.style76 !== undefined) return S.style76; let st = null;
  if (SION.fp76 && !P.pwOff && !P.m7Off && G.r76 && isV76(P) && (P.fac === 'fra' || P.fac === 'chn')) { let h = ((G.opts.seed | 0) ^ Math.imul(P.team + 1, 0x9E3779B1)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B) >>> 0; h ^= h >>> 13; if (SION.fp76 === 'all' || h % 3 === 0) st = 'fortress'; }
  return (S.style76 = st); }
const fort76 = P => style76(P) === 'fortress';
const FP76_SHARE = { fra: +SION.fpShF || 0.3, chn: +SION.fpShC || 0.24 }, FP76_BAR = +SION.fpBar || 1.0; // fortress: static D capped at this share of everything mined (normal: fra 0.27, chn 0.18); normal-push bar x1.0 (1.1-1.4 starved the army in drills)
// counter-attack window: remember who came in and what they brought; when the attack is beaten (most of it dead, my base clear), open a short window
function pw76Track(P, S, intruders, alive) {
  const w = S.pw76 || (S.pw76 = { ids: new Map(), t: 0 }); const ground = intruders.filter(f => !isAir(f) && UT[f.t] && UT[f.t].wpn);
  for (const f of ground) if (!w.ids.has(f.id)) w.ids.set(f.id, { team: f.team, v: UT[f.t].cost }); if (ground.length) w.t = G.time;
  if (!w.ids.size || ground.length || G.time - w.t < 6) return;
  let seen = 0, dead = 0; const by = {}; for (const [id, m] of w.ids) { seen += m.v; by[m.team] = (by[m.team] || 0) + m.v; if (!alive.has(id)) dead += m.v; }
  w.ids = new Map(); const team = +Object.keys(by).sort((a, b) => by[b] - by[a])[0];
  if (seen >= 2500 && dead >= seen * 0.65 && G.players[team] && !G.players[team].out) { S.pwOpen = { team, until: G.time + (fort76(P) ? 70 : 50), seen, dead }; G.events.push({ e: 'pw76', team: P.team, foe: team, seen, dead }); G.pw76n = (G.pw76n || 0) + 1; } }
// in army71: a beaten attacker's army is weak right now -> go at its base with what is idle (lower bar than a normal push)
function pw76Launch(P, S, idle, av, knownB, hq, allies) {
  const o = S.pwOpen; if (!o || G.time > o.until) { S.pwOpen = null; return false; } const Q = G.players[o.team]; if (!Q || Q.out) { S.pwOpen = null; return false; }
  let left = 0; for (const [, m] of S.mem || []) if (m.team === o.team) left += UT[m.t] ? UT[m.t].cost : 0;
  let def = 0; for (const b of knownB) if (b.team === o.team && BT[b.t].wpn) def += BT[b.t].cost;
  if (!(idle.length >= 8 && av >= Math.max(3500, left * 1.8 + def))) return false;
  const tb = knownB.filter(b => b.team === o.team && !BT[b.t].wpn).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y))[0], st = G.starts[Q.start];
  const p = G.tp71[P.ally] = { t0: G.time, team: o.team, x: tb ? tb.x : st[0], y: tb ? tb.y : st[1], m: {}, go: G.time, pw: 1 };
  p.m[P.team] = { rp: { x: p.x, y: p.y }, live: 1, ready: 1 }; launch71(P, S, idle, p); S.grpWp = null; S.pwOpen = null; G.pw76go = (G.pw76go || 0) + 1;
  G.events.push({ e: 'pw76go', team: P.team, foe: o.team, av, left, def }); return true; }
function siExtras(P, S, me, foes, knownB, hq, estart, intruders) {
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x), stage = home76(P, S, { x: hq.x + dcos(ang) * 8, y: hq.y + dsin(ang) * 8 });
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && !UT[u.t].air);
  // early rush defense: recall everything when base attacked in the first 6 minutes
  // base defense recall (any time): bring the attack group home if the base faces a real threat
  if (!SIOFF.recall2 && intruders.length && S.grp && S.grp.length && G.time > (S.recallT || 0)) { const iv = armyVal((isV71(P) && !SIOFF.air2 ? intruders.filter(f => !isAir(f) && UT[f.t].wpn) : intruders).filter(f => me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 12))), hv = armyVal(army.filter(u => !S.grp.includes(u) && dhypot(u.x - hq.x, u.y - hq.y) < 20));
    if (iv > Math.max(4500, hv * 1.5)) { const c = intruders[0]; S.recallT = G.time + 10; S.grp.forEach(u => S.attackers.delete(u.id)); orderMove(S.grp, c.x, c.y, true); S.grp = []; S.retreatT = G.time; } }
  if (!SIOFF.recall && intruders.length && G.time < 360) { const c = intruders.reduce((a, f) => (a.x += f.x / intruders.length, a.y += f.y / intruders.length, a), { x: 0, y: 0 });
    if (armyVal(intruders) > 500 && G.time > (S.recallT || 0)) { S.recallT = G.time + 6; const all = army.filter(u => u.t !== 'harv'); if (S.grp && S.grp.length) { S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; } if (er76On(P)) { const myB = me.filter(b => b.kind === 'b'), thr = intruders.filter(f => UT[f.t].wpn && dhypot(f.x - c.x, f.y - c.y) < 14), tw = myB.filter(b => BT[b.t].wpn && !b.offline), core = dhypot(c.x - hq.x, c.y - hq.y) < 9; // v7.6.5 (replay flag nt): outgunned early -> fight under the turrets instead of running out to meet the rush piecemeal
        if (!core && thr.length && sim71(all.concat(tw.filter(b => dhypot(b.x - c.x, b.y - c.y) < 9)), thr) < 0.8) { const t0 = tw.slice().sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0], hx = t0 ? t0.x + (hq.x - t0.x) * 0.25 : hq.x, hy = t0 ? t0.y + (hq.y - t0.y) * 0.25 : hq.y; const far = all.filter(u => dhypot(u.x - hx, u.y - hy) > 4); if (far.length) orderMove(far, hx, hy, true); G.er76n = (G.er76n || 0) + 1; } else orderMove(all, c.x, c.y, true); }
      else orderMove(all, c.x, c.y, true); } }
  // 2 early turrets toward the enemy, gas-first upgrades
  const tur = me.filter(e => e.t === 'turret').length + P.queues.def.filter(q => q.t === 'turret').length + (P.ready.def === 'turret' ? 1 : 0);
  if (intruders.length && G.time < 360) S.rushed = true;
  if (!SIOFF.turrets && S.rushed && tur < 2 && !P.queues.def.length && !P.ready.def && P.cr > 250 && avail(P.team, 'turret')) enqueue(P.team, 'turret');
  // faction special as win condition
  const sp = FACTIONS[P.fac].sp, spD = UT[sp] || BT[sp];
  if (!SIOFF.special && spD && G.time > (isV71(P) ? 200 : 300) && !(isV71(P) && S.saving && P.cr < BT[S.saving].cost + 500) && avail(P.team, sp) && P.gas >= (spD.gas || 0) && P.cr > spD.cost * 0.5) { const qc = UT[sp] ? (spD.from === 'barracks' ? 'inf' : spD.air ? 'air' : 'veh') : spD.cat; const have = me.filter(e => e.t === sp).length + P.queues[qc].filter(q => q.t === sp).length + (P.ready[qc] === sp ? 1 : 0); if (have < (isV71(P) ? (BT[sp] ? 3 + 2 * me.filter(e => e.t === 'cc').length : sp === 'marine' ? 999 : sp === 'drone' ? 9 + Math.floor(G.time / 120) : 4 + Math.floor(G.time / 200)) : BT[sp] ? 2 : 4) && P.queues[qc].length < 2) enqueue(P.team, sp); }
  // retreat badly wounded units (not when defending at home)
  if (!SIOFF.retreat) for (const u of army) if (u.hp < u.mhp * 0.3 && !u.retreating && dhypot(u.x - hq.x, u.y - hq.y) > 14 && u.t !== 'harv') { u.retreating = true; if (cl76On(P)) { const a = u.id * 2.39996, r = 1.5 + (u.id % 4); const f = nearFree(Math.floor(stage.x + dcos(a) * r), Math.floor(stage.y + dsin(a) * r), 3); orderMove([u], f[0] + 0.5, f[1] + 0.5, false); } else orderMove([u], stage.x, stage.y, false); if (S.grp) S.grp = S.grp.filter(x => x !== u); S.attackers.delete(u.id); }
  for (const u of army) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - stage.x, u.y - stage.y) < 3)) u.retreating = false;
  // jet strike waves (>=3 armed jets); interceptor escorts orbit the target instead of hovering
  const jets = me.filter(u => u.t === 'jet' && u.js === 'landed' && u.ammo >= W.jbomb.ammo);
  if (!SIOFF.jets && !S.doc && jets.length >= 3 && knownB.length && peaceOver(P) && G.time > (S.strikeT || 0)) {
    const pri = S.towerHeavy ? ['power', 'refinery', 'extractor', 'factory', 'airfield', 'tech', 'barracks', 'cc', 'hq'] : ['refinery', 'extractor', 'power', 'factory', 'airfield', 'tech', 'barracks', 'cc', 'hq'];
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
    if (P.aiS && P.aiS.siteBad && P.aiS.siteBad[st.x + ',' + st.y] > G.time) continue;
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
      const tiles = wallLine(cx - px, cy - py, cx + px, cy + py); const mid = tiles[tiles.length >> 1]; const n0 = G.nid;
      let gt = null; if (mid && avail(P.team, 'gate') && canPlace('gate', P.team, mid[0], mid[1]) && P.cr >= BT.gate.cost) { buyPiece(P.team, 'gate', mid[0], mid[1]); gt = mid; }
      if (!gt && wg76On(P)) { for (const t of tiles.slice().sort((a, b) => Math.abs(tiles.indexOf(a) - (tiles.length >> 1)) - Math.abs(tiles.indexOf(b) - (tiles.length >> 1)))) if (avail(P.team, 'gate') && canPlace('gate', P.team, t[0], t[1]) && P.cr >= BT.gate.cost) { buyPiece(P.team, 'gate', t[0], t[1]); gt = t; break; } }
      if (gt || !wg76On(P)) buildWalls(P.team, tiles.filter(([x, y]) => !(gt ? x === gt[0] && y === gt[1] : mid && x === mid[0] && y === mid[1]) && canPlace('wall', P.team, x, y))); // v7.6.5 (replay flag nt): a wall line always gets a gate, else no line
      if (!aiExitFree(P, hq)) { for (const e of G.ents.filter(e => e.team === P.team && (e.t === 'wall' || e.t === 'gate') && dhypot(e.x - cx, e.y - cy) < 4)) { e.hp = 0; e.dead = true; } G.bver++; }
      if (nt76On(P)) nt76Walls(P, G.ents.filter(e => e.id >= n0 && e.team === P.team && isWallT(e.t) && e.hp > 0 && !e.dead), cx, cy); } }
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
// ===== v7.0 faction specials for bots (deterministic, no bonuses) =====
function facAI(P, S, D, me, cnt, hq, foes) {
  if (P.fac === 'irn') droneMgr(P, S, me, foes, hq);
  else if (P.fac === 'chn') { greatWallMgr(P, S, me, cnt, hq); ballistaMgr(P, S, me); }
  else if (P.fac === 'jpn') raijinMgr(P, S, me, foes);
}
// Iran: hold drones at home until a swarm of 6+ (3 in Endless / when defending), then throw it at the densest visible enemy blob (or a key building)
function droneMgr(P, S, me, foes, hq) {
  const dr = me.filter(u => u.t === 'drone' && u.hp > 0 && !u.tgt && u.order !== 'move'); if (!dr.length) return;
  const pushing = isV71(P) && S.grp && S.grp.length >= 6 && !S.grpWp, need = G.end || S.underAttack ? 2 : pushing ? 4 : isV71(P) ? 9 : 6; if (dr.length < need && G.time - (S.droneT || 0) < (isV71(P) ? 150 : 90)) return;
  if (isV71(P) && !G.end && !S.underAttack && !pushing && dr.length < 15) return; // v7.1: the swarm flies ahead of the tanks, not alone
  let best = null, bs = 0;
  for (const f of foes) { if (f.hp <= 0 || isAir(f)) continue; let n = 0; if (f.kind === 'u') { if (!UT[f.t].wpn) continue; for (const q of foes) if (q.kind === 'u' && !isAir(q) && Math.abs(q.x - f.x) < 2 && Math.abs(q.y - f.y) < 2) n += UT[q.t].armor === 'inf' ? 1 : 2; }
    else n = ({ factory: 5, refinery: 5, power: 4, tech: 4, airfield: 4, hq: 3, cc: 3, gcannon: 4, tesla: 4 })[f.t] || 0;
    const sc = n - dhypot(f.x - hq.x, f.y - hq.y) * 0.02; if (n >= 3 && sc > bs) { bs = sc; best = f; } }
  if (!best) { const kb = [...S.known.values()].filter(b => b.hp > 0 && ['refinery', 'power', 'factory', 'tech'].includes(b.t)); if (kb.length && dr.length >= 6 && peaceOver(P)) best = kb[(G.R() * kb.length) | 0]; }
  if (!best) return; S.droneT = G.time; orderAttack(dr, best); dr.forEach(u => S.attackers.add(u.id));
}
// v7.0.2 China: once teched and rich, convert a FEW key guard towers (closest to the enemy's approach) into Ballista Towers — 2 early, 3 later (4 in Endless)
function ballistaMgr(P, S, me) {
  if (G.time < (S.balT || 0)) return; S.balT = G.time + 5;
  const gt = me.filter(e => e.kind === 'b' && e.t === 'gtower' && e.hp > 0 && e.sell < 0 && !e.con); const nb = gt.filter(e => e.bal || e.upKind === 'bal').length;
  const ok = gt.length && nb < (G.end ? 4 : isV71(P) ? (G.time < 600 ? 2 : G.time < 900 ? 4 : 6) : G.time < 900 ? 2 : 3) && nb < gt.length && hasBuilt(P.team, BALLISTA.req);
  // bots earmark a slice of income into a Ballista fund (the AI otherwise spends every credit on queues); the fund is released if there is nothing left to convert
  if (!ok) { if (S.balFund) { P.cr += S.balFund; S.balFund = 0; } return; }
  if ((S.balFund || 0) < BALLISTA.cost) { const take = Math.min(P.cr, G.end ? 140 : 90, BALLISTA.cost - (S.balFund || 0)); P.cr -= take; S.balFund = (S.balFund || 0) + take; return; }
  if ((P.gas || 0) < BALLISTA.gas + 50 || P.pow + BALLISTA.pow < 0) return;
  const fs = G.players.filter(Q => foe(Q.team, P.team) && !Q.out).map(Q => G.starts[Q.start]).filter(Boolean); if (!fs.length && !G.end) return;
  const sc = e => fs.length ? Math.min(...fs.map(st => dhypot(st[0] - e.x, st[1] - e.y))) : -e.hp; let best = null;
  for (const e of gt) if (!e.bal && e.upT == null && (!best || sc(e) < sc(best))) best = e;
  if (!best) return; P.cr += S.balFund; S.balFund = 0; upgradeB(best); }
// China: Great Wall lines across every entrance (each 5th piece rises as a guard tower) — always with a gate lane
function greatWallMgr(P, S, me, cnt, hq) {
  const V = isV71(P) && !G.end; if (G.time < (S.gwT || 0) || G.time < (G.end ? 20 : V ? 170 : 200) || !avail(P.team, 'wall')) return; S.gwT = G.time + (G.end ? 40 : V ? 60 : 110);
  const nw = (cnt.wall || 0) + (cnt.gtower || 0) + (cnt.gate || 0); if (nw >= (G.end ? 110 : V ? 140 : 70)) return;
  if (isV76(P) && !SIOFF.dc76 && !G.end) { const wv = (cnt.wall || 0) * BT.wall.cost + (cnt.gtower || 0) * BT.gtower.cost + (cnt.gate || 0) * BT.gate.cost; if ((!peaceOver(P) && G.time < peaceEnd76() - 75) || wv > 2000 + Math.max(S.compTot || 0, S.eArmy || 0) * 0.35 + (S.underAttack ? 2500 : 0)) return; } // v7.6.1: the Great Wall follows the seen threat too
  if (V && !SIOFF.wcap) { const wv = (cnt.wall || 0) * BT.wall.cost + (cnt.gtower || 0) * BT.gtower.cost + (cnt.gate || 0) * BT.gate.cost; if ((S.saving && P.cr < BT[S.saving].cost + 300) || (wv > (!SIOFF.gw2 && (S.underAttack || (S.eArmy || 0) > 1.4 * armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv'))) ? 2000 : 1200) && wv > (P.stats.mined || 0) * 0.05)) { S.gwT = G.time + 8; return; } } // v7.1.2: outgunned -> cheap wall pieces (50 cr) are the best value, allow up to 2000 cr of wall // v7.1.1: the wall may not starve the economy or the army
  const gw2 = V && !SIOFF.gw2 && S.underAttack && (S.eArmy || 0) > 0.8 * armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv')); if (P.cr < (G.end ? 600 : gw2 ? 150 : V ? 250 : 900)) { if (V) S.gwT = G.time + 3; return; } // v7.1: income is spent fast, so poll and build the wall piece by piece
  const ents = baseEntrances(P, S, hq); if (!ents.length) return;
  const en = ents[(S.gwI = ((S.gwI || 0) + (gw2 && S.gwHold ? 0 : 1))) % ents.length]; S.gwHold = 0; if (G.time < (en.gwT || 0)) return; en.gwT = G.time + (V ? 150 : 400); if (V && (en.gwN || 0) >= 4) return;
  const placed = aiWallEntrance(P, en, G.end ? 9 : V ? 9 : 7, 2.2 + (en.gwN || 0) * 2, V ? 60 : 300); if (V && P.cr < 200) { en.gwT = 0; S.gwT = G.time + 4; S.gwHold = 1; return; } en.gwN = (en.gwN || 0) + 1; return placed;
}
// Japan: Raijin flies (jet) to far targets over walls and cliffs, lands (mech) to fight; idle jets land
function raijinMgr(P, S, me, foes) {
  for (const u of me) { if ((u.t !== 'raijin' && u.t !== 'raijinJ') || u.hp <= 0 || u.xfT != null || G.time < (u.xfCd || 0)) continue;
    const jet = u.t === 'raijinJ', dst = u.tgt || (u.order !== 'idle' && u.anchor) || null, dd = dst ? dhypot(dst.x - u.x, dst.y - u.y) : 0;
    let near = false; for (const f of foes) if (f.kind === 'u' && UT[f.t].wpn && !isAir(f) && Math.abs(f.x - u.x) < 6 && Math.abs(f.y - u.y) < 6) { near = true; break; }
    if (!jet && dst && dd > 16 && !near) xform(u);
    else if (jet && (!dst || u.order === 'idle' || dd < 6 || near) && !blk(u.x, u.y)) xform(u); }
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

// ===== v5.2 doctrine (ALL levels use every behaviour; DIFF only changes execution: think/slip/sat) =====
// base entrances: where ground paths from each of my bases toward enemies / the map centre leave the base
function baseEntrances(P, S, hq) {
  if (S.ents && G.time - S.entsT < 150) return S.ents; S.entsT = G.time;
  const bases = G.ents.filter(e => e.team === P.team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0), out = [];
  const goals = G.players.filter(Q => foe(Q.team, P.team) && !Q.out).map(Q => G.starts[Q.start]).concat([[MW / 2, MH / 2]]);
  for (const b of bases.slice(0, 3)) for (const g of goals) { const ga = datan2(g[1] - b.y, g[0] - b.x), f0 = nearFree(Math.floor(b.x + dcos(ga) * 2.8), Math.floor(b.y + dsin(ga) * 2.8), 4), p = findPath(f0[0] + 0.5, f0[1] + 0.5, g[0], g[1]); if (!p || !p.length) continue;
      let pt = null, px = b.x, py = b.y; const pts = p.map(c => typeof c === 'number' ? { x: c % MW + 0.5, y: ((c / MW) | 0) + 0.5 } : c), lane = [];
      for (const c of pts) { const n = Math.ceil(dhypot(c.x - px, c.y - py) * 2); for (let k = 1; k <= n; k++) { const x = px + (c.x - px) * k / n, y = py + (c.y - py) * k / n, d = dhypot(x - b.x, y - b.y); if (d >= 5 && d < 15) lane.push({ x, y }); if (!pt && d >= 8.5) pt = { x, y }; } if (lane.length && dhypot(c.x - b.x, c.y - b.y) > 15) break; px = c.x; py = c.y; }
      const dup = pt && out.find(o => dhypot(o.x - pt.x, o.y - pt.y) < 6); if (dup) dup.lane.push(...lane); else if (pt) out.push({ x: pt.x, y: pt.y, b, lane }); }
  // ring scan: walkable gaps in a circle around each base = ramps / entrances (catches back doors the paths miss)
  const g = getBlock();
  for (const b of bases.slice(0, 3)) for (const R of [11, 13.5, 20.5]) { const N = 96, open = []; for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, x = Math.floor(b.x + dcos(a) * R), y = Math.floor(b.y + dsin(a) * R); open.push(inb(x, y) && G.map[idx(x, y)] === 0); }
    if (open.filter(Boolean).length > N * 0.45) continue; // open field, not a walled base
    for (let k0 = 0; k0 < N; k0++) if (open[k0] && !open[(k0 + N - 1) % N]) { let k1 = k0; while (open[(k1 + 1) % N] && k1 - k0 < N) k1++; const am = ((k0 + k1) / 2) / N * Math.PI * 2, pt = { x: b.x + dcos(am) * (R - 1.5), y: b.y + dsin(am) * (R - 1.5) };
      { const ox = Math.floor(b.x + dcos(am) * (R + 3.5)), oy = Math.floor(b.y + dsin(am) * (R + 3.5)), ix = Math.floor(b.x + dcos(am) * (R - 2.5)), iy = Math.floor(b.y + dsin(am) * (R - 2.5)); if (!inb(ox, oy) || G.map[idx(ox, oy)] !== 0 || G.lvl[idx(ix, iy)] < G.lvl[idx(ox, oy)] + 0.4) continue; }
      if (!out.some(o => dhypot(o.x - pt.x, o.y - pt.y) < 4)) { const lane = []; for (let r = 5; r < 15; r += 0.7) lane.push({ x: b.x + dcos(am) * r, y: b.y + dsin(am) * r }); out.push({ x: pt.x, y: pt.y, b, lane }); } } }
  return (S.ents = out.slice(0, 6));
}
// static defence at EVERY entrance + flak over the core; Tesla / Grand Cannon once teched. Spends from the def queue only.
function defenseMgr(P, S, D, me, cnt, hq) {
  if (P.queues.def.length || P.ready.def || !avail(P.team, 'turret') || G.time < 90) return;
  let ents = baseEntrances(P, S, hq); if (!ents.length) return;
  const myD = me.filter(e => e.kind === 'b' && BT[e.t].cat === 'def' && BT[e.t].wpn);
  const tier = G.time < 300 ? 1 : !hasBuilt(P.team, 'tech') ? 2 : G.time < 840 ? 3 : 4;
  const gc = avail(P.team, 'gcannon'), TES = facDef(P, 'tesla'), heavyDef = gc && TES === 'tesla' ? 'gcannon' : TES; // France: Gatlings first at the entrance, Grand Cannons behind (tier 4 + special)
  // v5.3 defence-first: many towers per entrance; Teslas come in clusters of 2-3 (they chain/stack), Grand Cannon behind
  const V = isV71(P) && !G.end && !SIOFF.d71; let plan = tier === 1 ? [['turret', 2]] : tier === 2 ? [['turret', 2], ['aagun', 1], ['turret', 3]] : tier === 3 ? [['turret', 2], ['aagun', 1], [heavyDef, 1], [TES, 2], ['turret', 3]] : [['turret', 3], ['aagun', 2], [heavyDef, 1], [TES, 3], ['gcannon', gc ? 2 : 0], ['aagun', 3]];
  if (V && S.saving && !S.underAttack && !S.rushed && P.cr < BT[S.saving].cost + 400) return; // v7.1: the expansion/refinery comes first
  if (V && G.time < 270 && !S.rushed && me.filter(e => e.t === 'refinery' && e.hp > 0).length < 2 && P.cr < BT.refinery.cost + 400) return;
  if (V) { plan = defPlan71(P, S, tier); if (!FORT71[P.fac] && !S.rushed && !S.underAttack) ents = ents.slice(0, tier >= 3 || (cnt.cc || 0) ? 3 : 1); }
  if (P.cr < 150) return;
  // budget: static D may not starve the army; defence-first allows a big share (more when under attack / army wiped)
  const dv = myD.reduce((a, d) => a + BT[d.t].cost, 0), av = armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv')); const share = SIOFF.def53 ? (S.underAttack ? 0.45 : 0.3) : (S.underAttack ? 0.6 : 0.45); let capped = V ? !(!SIOFF.bank && popOf(P.team) >= POP_CAP - 6 && P.cr > 3000) && dv > 1500 && dv > (P.stats.mined || 0) * (fort76(P) ? FP76_SHARE[P.fac] + (S.underAttack ? 0.06 : 0) : (P.fac === 'fra' ? (SIOFF.pe ? 0.3 : 0.27) : P.fac === 'chn' ? (SIOFF.pe ? 0.24 : 0.18) : 0.1) + (S.underAttack ? 0.08 : 0) + (popOf(P.team) >= POP_CAP - 6 ? (SIOFF.pe ? 0.1 : 0.16) : 0)) : dv > 1500 && dv > (av + dv) * share; // v7.1: static D budget tracks the economy, not the (fluctuating) army
  if (isV76(P) && !SIOFF.dc76) { const c76 = defCap76(P, S, dv, av); if (c76 === 2) return; if (c76) capped = true; } // v7.6.1 defense manager: towers scale with the threat actually seen, never during peace
  S.lanes = ents.flatMap(e => e.lane);
  // entrance walls with a gate (own units pass, enemies must break through under tower fire)
  if (!SIOFF.walls && !S.wallFull && tier >= 2 && P.cr > 700 && avail(P.team, 'wall')) for (const en of ents) if (G.time > (en.wallT || 0) && myD.filter(d => dhypot(d.x - en.x, d.y - en.y) < 5).length >= 2) { en.wallT = G.time + 150; aiWallEntrance(P, en); return; }
  for (const [t, n] of plan) for (const en of ents) { if (!n || !avail(P.team, t) || (S.bad[t] || 0) > G.time || (capped && !(t === 'turret' && n <= 2)) || P.gas < (BT[t].gas || 0)) continue; const have = myD.filter(d => d.t === t && dhypot(d.x - en.x, d.y - en.y) < 5.5).length; if (have < n) { if (BT[t].pow < 0 && P.pow + BT[t].pow < 0) return; // never build towers that would black out the base
      let at = { x: en.x + (en.b.x - en.x) * 0.15, y: en.y + (en.b.y - en.y) * 0.15 };
      if (t === 'tesla') { const near = myD.find(d => d.t === 'tesla' && dhypot(d.x - en.x, d.y - en.y) < 5.5); if (near) at = { x: near.x, y: near.y }; } // cluster within relay range
      if (t === 'gcannon') at = { x: en.x + (en.b.x - en.x) * 0.35, y: en.y + (en.b.y - en.y) * 0.35 };
      S.defAt = at; S.defAtT = G.time; enqueue(P.team, t); return; } }
  // flak over the core (power/production) against air raids
  const core = me.filter(e => e.t === 'power' || e.t === 'factory' || e.t === 'refinery'); const coreAA = myD.filter(d => d.t === 'aagun' && dhypot(d.x - hq.x, d.y - hq.y) < 9).length;
  if (!capped && tier >= 2 && coreAA < (V ? (S.eAir > 1500 ? Math.min(3, Math.ceil(S.eAir / 3000)) : 0) : tier >= 4 ? 3 : tier >= 3 ? 2 : 1) && core.length && avail(P.team, 'aagun')) { const c = core[(G.tick >> 4) % core.length]; S.defAt = { x: c.x, y: c.y }; S.defAtT = G.time; enqueue(P.team, 'aagun'); return; }
  // upgrades once the plan is met
  if (P.cr > 2000) { const t = myD.find(b => UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); }
}
function aiExitFree(P, hq) {
  // path from a free tile near HQ out past the base (own gates open). Try several ranges/angles — Volcano ramps sit at fixed headings.
  const foeP = G.players.find(Q => foe(Q.team, P.team) && !Q.out) || G.players.find(Q => foe(Q.team, P.team)) || G.players[0];
  const st = G.starts[foeP.start] || [MW / 2, MH / 2], baseA = datan2(st[1] - hq.y, st[0] - hq.x);
  const start = nearFree(Math.floor(hq.x), Math.floor(hq.y), 4);
  G.curTeam = P.team;
  let ok = false;
  for (const da of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) for (const R of [12, 16, 22]) {
    const a = baseA + da, tx = Math.floor(hq.x + dcos(a) * R), ty = Math.floor(hq.y + dsin(a) * R);
    if (!inb(tx, ty) || G.map[idx(tx, ty)] !== 0) continue;
    const out = nearFree(tx, ty, 6), path = findPath(start[0] + 0.5, start[1] + 0.5, out[0] + 0.5, out[1] + 0.5);
    if (path && path.length) { ok = true; break; }
  }
  G.curTeam = null; return ok;
}
// v7.6.5 no-trap check (si2 only, new games only; SIOFF.nt76 turns it off). Before a bot structure goes down (and right after a bot wall line goes
// up) flood-fill the map (own gates open) and make sure every source near the spot still gets out: the yard, each barracks / factory exit and each
// refinery must reach the open map (flood seeded at the map centre and the enemy starts, so a dead-end pocket next to the base does not count as
// "out"), and the yard / refineries an ore field. A structure may also not squeeze a route that was 2+ tiles wide down to a 1-tile slot (walls are
// exempt from that: their gates are the lane). add = tiles about to be blocked; pre = tiles of pieces just placed (open terrain in the "before" picture).
const NT76_R = 22, NT76_SRC = { barracks: 1, factory: 1, hq: 1, cc: 1, refinery: 1 };
const nt76On = P => !!G.r76 && !!G.nt && isV76(P) && !SIOFF.nt76 && !P.ntOff; // G.nt: replay flag (replays without it = pre-no-trap brain); P.ntOff: test-only per-player switch
function nt76Flood(o, seeds, W, H) { const N = W * H, r = new Uint8Array(N), q = []; for (const k of seeds) if (o[k] && !r[k]) { r[k] = 1; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h], x = k % W;
    if (x > 0 && !r[k - 1] && o[k - 1]) { r[k - 1] = 1; q.push(k - 1); } if (x < W - 1 && !r[k + 1] && o[k + 1]) { r[k + 1] = 1; q.push(k + 1); }
    if (k >= W && !r[k - W] && o[k - W]) { r[k - W] = 1; q.push(k - W); } if (k + W < N && !r[k + W] && o[k + W]) { r[k + W] = 1; q.push(k + W); } } return r; }
function nt76Wide(o, W, H) { const w = new Uint8Array(W * H); for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const k = y * W + x; if (o[k] && o[k + 1] && o[k + W] && o[k + W + 1]) w[k] = w[k + 1] = w[k + W] = w[k + W + 1] = 1; } return w; }
function nt76Ok(P, ax, ay, add, pre, narrow, extraSrc) {
  const g = getBlock(), team = P.team, N = MW * MH; G.ntChecks = (G.ntChecks || 0) + 1;
  const bases = G.ents.filter(e => e.team === team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0 && !e.dead && dhypot(e.x - ax, e.y - ay) < NT76_R + 4);
  if (!bases.length) return true;
  const gone = new Set(); for (const e of G.ents) if (e.kind === 'b' && (e.dead || e.hp <= 0)) for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) gone.add(idx(x, y)); // torn down this tick, still in the block grid
  const addS = new Set((add || []).map(([x, y]) => idx(x, y))), preS = new Set((pre || []).map(([x, y]) => idx(x, y)));
  const fail = why => { G.ntLast = { team, why, t: G.time }; const W = G.ntWhy || (G.ntWhy = {}); W[why] = (W[why] || 0) + 1; G.ntRej = (G.ntRej || 0) + 1; return false; };
  // sources near the spot
  const srcs = [];
  const ring = e => { const t = []; for (let y = e.ty - 1; y <= e.ty + e.h; y++) for (let x = e.tx - 1; x <= e.tx + e.w; x++) if ((x < e.tx || x >= e.tx + e.w || y < e.ty || y >= e.ty + e.h) && inb(x, y)) t.push(idx(x, y)); return t; };
  const allyF = m7On(P, 'f'); // m7f (v7.6.7): an ally's barracks / factory next to our base counts too (seen: France walled China's factory mouth shut, volcano 77)
  for (const e of G.ents.concat(extraSrc || [])) if ((e.team === team || (allyF && (e.t === 'barracks' || e.t === 'factory') && G.players[e.team] && !foe(e.team, team))) && e.kind === 'b' && NT76_SRC[e.t] && e.hp > 0 && !e.dead && bases.some(b => dhypot(e.x - b.x, e.y - b.y) < NT76_R - 4)) {
    const prod = e.t === 'barracks' || e.t === 'factory';
    srcs.push({ t: prod ? null : ring(e), ore: !prod, ty: e.t, b: e }); }
  if (!srcs.length) return true;
  // whole-map pictures: before (pre pieces not there yet) / after (add tiles blocked)
  const key = team + ':' + G.bver + ':' + G.tick; const CC = G.ntC || (G.ntC = {}); let C = CC[team]; // cache lives on G: per game, never shared across games
  if (!C || C.key !== key || preS.size) { const o0 = new Uint8Array(N); for (let i = 0; i < N; i++) o0[i] = g[i] === 0 || (g[i] === 3 && G.gateT[i] >= 0 && !foe(G.gateT[i], team)) || (gone.has(i) && !G.map[i]) ? 1 : 0;
    C = { key, base: o0.slice() }; for (const i of preS) if (!G.map[i]) o0[i] = 1; C.o0 = o0;
    const sd = G.players.filter(Q => foe(Q.team, team)).map(Q => G.starts[Q.start]).concat([[MW / 2, MH / 2]]).map(([x, y]) => { const f = nearFree(Math.floor(x), Math.floor(y), 10); return idx(f[0], f[1]); }); C.seeds = sd;
    C.r0 = nt76Flood(o0, sd, MW, MH); C.w0 = null; if (!preS.size) CC[team] = C; }
  const o1 = C.base.slice(); for (const i of addS) o1[i] = 0;
  const has = (r, t) => t.some(k => r[k]), near = (r, t) => t.some(k => r[k] || (k % MW > 0 && r[k - 1]) || (k % MW < MW - 1 && r[k + 1]) || (k >= MW && r[k - MW]) || (k + MW < N && r[k + MW]));
  const r1 = nt76Flood(o1, C.seeds, MW, MH);
  const T0 = s => s.t || nt76Spawn(C.o0, s.b), T1 = s => s.t || nt76Spawn(o1, s.b);
  for (const s of srcs) if (has(C.r0, T0(s)) && !has(r1, T1(s))) return fail('out-cut:' + s.ty);
  if (narrow) { if (!C.w0) { C.w0 = nt76Flood(nt76Wide(C.o0, MW, MH), C.seeds, MW, MH); } const w1 = nt76Flood(nt76Wide(o1, MW, MH), C.seeds, MW, MH);
    const near2 = (r, t) => t.some(k => { const x = k % MW, y = (k / MW) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(x + dx, y + dy) && r[idx(x + dx, y + dy)]) return true; return false; }); // a 2-wide lane within 2 tiles of the spawn / ring
    for (const s of srcs) if (near2(C.w0, T0(s)) && !near2(w1, T1(s))) return fail('out-narrow:' + s.ty); }
  // ore: yard / refineries must keep a route to an ore tile within reach of their base (local box)
  const oreS = srcs.filter(s => s.ore); if (!oreS.length) return true;
  const oreSeeds = []; for (const b of bases) { const R = NT76_R; for (let y = Math.max(0, Math.floor(b.y - R)); y <= Math.min(MH - 1, b.y + R); y++) for (let x = Math.max(0, Math.floor(b.x - R)); x <= Math.min(MW - 1, b.x + R); x++) { const i = idx(x, y); if (G.ore[i] > 0) oreSeeds.push(i); } }
  if (!oreSeeds.length) return true;
  const q0 = nt76Flood(C.o0, oreSeeds.filter(i => C.o0[i]), MW, MH), q1 = nt76Flood(o1, oreSeeds.filter(i => o1[i]), MW, MH);
  for (const s of oreS) if (has(q0, s.t) && !has(q1, s.t)) return fail('ore-cut:' + s.ty);
  return true;
}
// the tile spawnUnit would put a new unit on, given an open-tiles picture o (1 = free)
function nt76Spawn(o, b) { const x = Math.floor(b.x), y = Math.floor(b.ty + b.h + 0.5);
  for (let r = 0; r <= 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x + dx, ny = y + dy; if (inb(nx, ny) && o[idx(nx, ny)]) return [idx(nx, ny)]; }
  return [idx(Math.min(MW - 1, x), Math.min(MH - 1, y))]; }
const nt76Src = (P, t, x, y) => NT76_SRC[t] ? [{ team: P.team, kind: 'b', t, hp: 1, tx: x, ty: y, w: BT[t].w, h: BT[t].h, x: x + BT[t].w / 2, y: y + BT[t].h / 2 }] : null;
// walls just placed (pieces): if they cut a source off, swap the piece nearest the line centre for a gate, then tear the rest down (half refund, as before)
function nt76Walls(P, placed, cx, cy) {
  const live = () => placed.filter(b => b.hp > 0 && !b.dead), tiles = () => live().map(b => [b.tx, b.ty]);
  if (nt76Ok(P, cx, cy, null, tiles(), false)) return true;
  const w = live().filter(b => b.t === 'wall' || b.t === 'gtower').sort((a, b) => dhypot(a.x - cx, a.y - cy) - dhypot(b.x - cx, b.y - cy) || a.id - b.id)[0];
  if (w && avail(P.team, 'gate')) { w.hp = 0; w.dead = true; P.cr += Math.floor(BT.wall.cost * 0.6); G.bver++; if (P.cr >= BT.gate.cost) { placed.push(buyPiece(P.team, 'gate', w.tx, w.ty)); G.bver++; } if (nt76Ok(P, cx, cy, null, tiles(), false)) return true; } // the torn wall's tile is free terrain (the dead piece leaves the grid at the end of the tick)
  for (const b of live()) if (b.t === 'wall' || b.t === 'gtower') { P.cr += Math.floor(BT.wall.cost * 0.5); b.hp = 0; b.dead = true; } G.bver++; G.ntTorn = (G.ntTorn || 0) + 1; return false;
}
const nt76Foot = (t, x, y) => { const d = BT[t], o = []; for (let yy = y; yy < y + d.h; yy++) for (let xx = x; xx < x + d.w; xx++) o.push([xx, yy]); return o; };
function aiWallEntrance(P, en, half, off, rsv) {
  // v5.4: always leave a gate lane, never seal the base; roll back if exit path dies
  const a = datan2(en.y - en.b.y, en.x - en.b.x), cx = en.x + dcos(a) * (off || 2.2), cy = en.y + dsin(a) * (off || 2.2), px = -dsin(a), py = dcos(a), tiles = [], seen = new Set();
  for (let k = -(half || 5); k <= (half || 5); k += 0.5) { const x = Math.floor(cx + px * k), y = Math.floor(cy + py * k), i = idx(x, y); if (!inb(x, y) || seen.has(i)) continue; seen.add(i); tiles.push([x, y, Math.abs(k)]); }
  const placed = []; let n = 0, gates = 0;
  // place gate(s) first on the centre 3 tiles so a lane always exists
  for (const [x, y, k] of tiles) if (k < 1.1) { if (!avail(P.team, 'gate') || P.cr < BT.gate.cost + 200 || !canPlace('gate', P.team, x, y)) continue; const b = buyPiece(P.team, 'gate', x, y); placed.push(b); n++; gates++; }
  if (!gates) { // force one gate even if canPlace was picky: clear a centre tile and put a gate
    const gx = Math.floor(cx), gy = Math.floor(cy); if (inb(gx, gy) && avail(P.team, 'gate') && P.cr >= BT.gate.cost) {
      for (const e of G.ents) if (e.kind === 'b' && e.team === P.team && e.t === 'wall' && e.tx === gx && e.ty === gy) { P.cr += Math.floor(BT.wall.cost * 0.5); e.hp = 0; e.dead = true; }
      if (canPlace('gate', P.team, gx, gy)) { placed.push(buyPiece(P.team, 'gate', gx, gy)); n++; gates++; } } }
  if (!gates && (nt76On(P) || wg76On(P))) return; // v7.6.5: no gate lane (centre on a cliff / no money for a gate) -> no wall line at all (the seed-77 '5 walls, 0 gates' case)
  for (const [x, y, k] of tiles) if (k >= 1.1) { if (!avail(P.team, 'wall') || P.cr < BT.wall.cost + (rsv ?? 300) || !canPlace('wall', P.team, x, y)) continue; placed.push(buyPiece(P.team, 'wall', x, y)); n++; }
  if (n) { G.bver = (G.bver || 0) + 1; G.events.push({ e: 'walls', team: P.team, n }); }
  // verify exit; if sealed, convert centre walls to gates or tear the last wall segment
  if (n && !aiExitFree(P, en.b)) {
    for (const b of placed) if (b.t === 'wall' && dhypot(b.x - cx, b.y - cy) < 1.6) { const x = b.tx, y = b.ty; b.hp = 0; b.dead = true; P.cr += Math.floor(BT.wall.cost * 0.6); if (canPlace('gate', P.team, x, y) && P.cr >= BT.gate.cost) { buyPiece(P.team, 'gate', x, y); } }
    G.bver = (G.bver || 0) + 1;
    if (!aiExitFree(P, en.b)) { for (const b of placed) if (b.hp > 0) { P.cr += Math.floor(BT[b.t].cost * 0.5); b.hp = 0; b.dead = true; } G.bver++; }
  }
  if (n && nt76On(P)) nt76Walls(P, placed, cx, cy); // v7.6.5: the wall line may not cut a barracks / factory / refinery off (aiExitFree only checks the yard)
}
// production targets: many factories / barracks / airfields (never sit on money)
function prodTarget(P, S, D, cnt, hq, foes) {
  const t = G.time, ok = k => avail(P.team, k) && (S.bad[k] || 0) < G.time && !!aiSpot(P, k, hq, foes);
  const e53 = !SIOFF.eco53, fac = e53 ? (t < 240 ? 1 : t < 420 ? 2 : t < 620 ? 3 : t < 900 ? 4 : 5) : t < 300 ? 1 : t < 540 ? 2 : t < 780 ? 3 : t < 1100 ? 4 : 5, bar = t < 360 ? 1 : t < 720 ? 2 : 3, air = t < 420 ? 0 : t < 720 ? 1 : t < 1000 ? 2 : 3;
  const rich = P.cr > 1800;
  if ((cnt.factory || 0) < fac && (cnt.factory || 0) >= 1 && (rich || t > (e53 ? 240 : 400) && P.cr > 600) && ok('factory')) return 'factory';
  if ((cnt.barracks || 0) < bar && rich && ok('barracks')) return 'barracks';
  if ((cnt.airfield || 0) < air && hasBuilt(P.team, 'tech') && (rich || (cnt.airfield || 0) === 0) && ok('airfield')) return 'airfield';
  if (t > 600 && !(cnt.silo || 0) && P.cr > 3500 && P.gas > 600 && ok('silo')) return 'silo';
  if (P.cr > 4000 && (cnt.factory || 0) < fac + 2 && ok('factory')) return 'factory';
  return null;
}
// massed air raids: hold armed strike craft until >=5 (or 4 late), probe 8 approach angles for the side with least known AA, strike together
function airRaidMgr(P, S, D, me, foes, knownB, hq) {
  const air = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth'));
  if (S.raid) { const R = S.raid; R.u = R.u.filter(u => u.hp > 0 && !u.dead); const tg = R.tg;
    if (!R.u.length || tg.hp <= 0 || G.time > R.t0 + 60) { S.raid = null; S.raidT = G.time + 8; }
    else if (R.ph === 'wp') { const c = R.u.reduce((a, u) => (a.x += u.x / R.u.length, a.y += u.y / R.u.length, a), { x: 0, y: 0 }); if (dhypot(c.x - R.wp.x, c.y - R.wp.y) < 3.5 || G.time > R.t0 + 18) { orderAttack(R.u, tg); R.ph = 'hit'; } else if (G.tick % 30 < 15) R.u.forEach(u => { if (!u.path.length) orderMove([u], R.wp.x, R.wp.y, false); }); }
    return; }
  if (!peaceOver(P) || G.time < (S.raidT || 0) || !knownB.length) return;
  const armed = air.filter(u => u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo); if (armed.length < (isV71(P) && G.tp71 && G.tp71[P.ally] && !G.tp71[P.ally].go ? 2 : isV71(P) && !SIOFF.jr ? 3 : G.time > 1300 ? 4 : 5)) return; // v7.1.1: an airfield parks 4 — waiting for 5 meant extra strike craft circled forever and never struck
  const aa = knownB.filter(b => b.t === 'aagun' || b.t === 'tesla' || b.t === 'gatling').concat(foes.filter(f => f.kind === 'u' && (f.t === 'aa' || f.t === 'intercept' || f.t === 'rocketeer')));
  const aaAt = (x, y) => aa.reduce((s, a) => s + (dhypot(a.x - x, a.y - y) < 7.5 ? (a.kind === 'b' ? 2 * ((a.lvl || 1) + 1) / 2 : 1) : 0), 0);
  const pri = isV71(P) && (S.towerHeavy || S.siege) ? { power: 0, aagun: 1, gcannon: 1, tesla: 2, refinery: 3, factory: 3, silo: 0, tech: 3 } : S.towerHeavy ? { power: 0, refinery: 2, factory: 2, silo: 0, airfield: 3, tech: 3 } : { refinery: 0, power: 1, factory: 1, silo: 0, airfield: 2, tech: 3, barracks: 3, extractor: 2 };
  const cands = knownB.filter(b => pri[b.t] != null).map(b => ({ b, s: pri[b.t] * 2 + aaAt(b.x, b.y) * 1.5 })).sort((a, b) => a.s - b.s); if (!cands.length) return;
  const tg = cands[0].b; let best = null, bs = 1e9;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + (G.R() - 0.5) * 0.3, wp = { x: Math.max(2, Math.min(MW - 2, tg.x + dcos(a) * 15)), y: Math.max(2, Math.min(MH - 2, tg.y + dsin(a) * 15)) };
    let s = 0; for (let j = 0; j <= 6; j++) s += aaAt(wp.x + (tg.x - wp.x) * j / 6, wp.y + (tg.y - wp.y) * j / 6); s += (S.lastRaidA != null && Math.abs(a - S.lastRaidA) < 0.5 ? 2 : 0); if (s < bs) { bs = s; best = { wp, a }; } }
  S.lastRaidA = best.a; S.raid = { u: armed, tg, wp: best.wp, ph: 'wp', t0: G.time }; orderMove(armed, best.wp.x, best.wp.y, false);
}
// warhead launcher: build the biggest affordable missile, fire at the densest power/defence cluster, timed with the main push
function warheadMgr(P, S, D, me, foes, knownB) {
  const silos = me.filter(e => e.t === 'silo' && e.hp > 0 && G.time - e.born > 1.5); if (!silos.length) return;
  for (const s of silos) {
    if (!s.mis && !s.mq) { const k = P.gas > 1300 && P.cr > 3600 ? 'heavy' : P.gas > 500 && P.cr > 1800 ? 'cluster' : P.gas > 250 && P.cr > 1000 ? 'small' : null; if (k) siloBuild(s, k); continue; }
    if (!s.mis || G.time < (s.cdT || 0) || !knownB.length) continue; const m = MIS[s.mis];
    const pushing = S.grp && S.grp.length > 6, stalled = G.time > 720 && (!(S.grp && S.grp.length) || G.time - S.lastAttack > 90), held = G.time - (s.readyT || (s.readyT = G.time)) > (stalled ? 25 : 90); if (!pushing && !held && !stalled) continue;
    let best = null, bv = 0; for (const b of knownB) { if (dhypot(b.x - s.x, b.y - s.y) > m.rng) continue; const R = m.r + (m.spread || 0);
      if (G.ents.some(e => !foe(e.team, P.team) && e.hp > 0 && dhypot(e.x - b.x, e.y - b.y) < R + 1.5)) continue;
      let v = 0; for (const o of knownB) { const d = dhypot(o.x - b.x, o.y - b.y); if (d < R + 1) v += BT[o.t].cost * (BT[o.t].cat === 'def' || o.t === 'power' ? 1.6 : 1) * (1 - d / (R + 2)); } if (v > bv) { bv = v; best = b; } }
    if (best && bv > 1500) { siloLaunch(s, best.x, best.y); s.readyT = null; }
  }
}
// allied coordination: post a team attack plan; allies with a decent army launch at the same time from another angle
function teamPlan(P) { G.tplan = G.tplan || {}; const p = G.tplan[P.ally]; return p && G.time - p.t < 25 ? p : null; }

// ===== v5.6 keep-busy layer: idle watchdog, rich-spend, map centre, endgame all-in =====
const END_T = 22 * 60;
function endTarget(P) { // shared per alliance: weakest surviving enemy (fewest known structures) -> its nearest known building / start
  G.etgt = G.etgt || {}; let e = G.etgt[P.ally];
  if (!e || G.players[e.team].out || G.time - e.t > 20) { let best = null, bv = 1e9; const S = P.aiS;
    for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { let v = 0; for (const b of S.known.values()) if (b.team === Q.team) v += BT[b.t].cost; v = v || 1e5 - Q.team; if (v < bv) { bv = v; best = Q.team; } }
    if (best == null) return null; e = G.etgt[P.ally] = { team: best, t: G.time }; }
  const st = G.starts[G.players[e.team].start]; let tx = st[0], ty = st[1], bd = 1e9; const hq = G.ents.find(x => x.team === P.team && x.kind === 'b');
  for (const b of P.aiS.known.values()) if (b.team === e.team && b.hp > 0) { const d = dhypot(b.x - (hq ? hq.x : tx), b.y - (hq ? hq.y : ty)); if (d < bd) { bd = d; tx = b.x; ty = b.y; } }
  return { team: e.team, x: tx, y: ty };
}
function keepBusy(P, S, D, me, cnt, hq, intruders) {
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv' && !UT[u.t].engineer && u.hp > 0);
  // production progress key
  let key = 0; for (const c in P.queues) for (const it of P.queues[c]) key += (it.prog || 0) + 1; for (const c in P.ready) if (P.ready[c]) key += 7;
  if (key !== S.pKey || army.some(u => u.tgt)) { S.pKey = key; S.busyT = G.time; }
  const idleFor = G.time - (S.busyT || G.time);
  const rich = P.cr > 2500 && P.pow >= 0;
  if (!P.queues.bld.length && !P.ready.bld && P.pow >= 30 && P.cr > 3000 && G.time > 360) { // turn a bank into production
    const t = (cnt.factory || 0) < 3 ? 'factory' : (cnt.barracks || 0) < 2 ? 'barracks' : (cnt.refinery || 0) < 4 && G.ore.some(o => o > 200) ? 'refinery' : avail(P.team, 'silo') && !(cnt.silo) && G.time > 900 ? 'silo' : (cnt.airfield || 0) < 2 && avail(P.team, 'airfield') ? 'airfield' : null;
    if (t && avail(P.team, t) && (S.bad[t] || 0) < G.time && aiSpot(P, t, hq, [])) enqueue(P.team, t);
  }
  if (isV71(P) && !SIOFF.p71) { if (P.pow >= 0 && P.cr > 600 + (S.saving ? BT[S.saving].cost : 0) && (rich || idleFor > 15)) prodMix71(P, S, cnt, me.filter(e => e.t === 'harv').length, cnt.refinery || 0); }
  else if (P.pow >= 0 && P.cr > 600) { for (const [c, t] of [['inf', 'rifle'], ['veh', 'heavy']]) if (producers(P.team, c) && P.queues[c].length < Math.min(5, producers(P.team, c) * 2) && (rich || idleFor > 15)) { const opts = c === 'inf' ? ['rifle', 'rocketeer', 'rifle', 'sniper'] : ['heavy', 'heavy', 'arty', 'heavy', 'titan', 'tsar']; const pk = opts.filter(x => avail(P.team, x)); if (pk.length) enqueue(P.team, pk[(G.R() * pk.length) | 0]); } }
  // idle watchdog
  if (idleFor > 20) { S.busyT = G.time - 10;
    if (!(cnt.refinery) && avail(P.team, 'refinery')) enqueue(P.team, 'refinery');
    else if (me.filter(e => e.t === 'harv').length < 2 && avail(P.team, 'harv')) enqueue(P.team, 'harv');
    else if (!(cnt.barracks) && avail(P.team, 'barracks')) enqueue(P.team, 'barracks');
    else if (!(cnt.factory) && avail(P.team, 'factory')) enqueue(P.team, 'factory');
    else if (avail(P.team, 'rifle')) enqueue(P.team, 'rifle');
    const lazy = army.filter(u => u.order === 'idle' && !u.tgt && !UT[u.t].jet);
    if (lazy.length && !intruders.length && peaceOver(P) && !isV71(P)) { const e = G.time > END_T ? endTarget(P) : null, M = MW / 2; const x = e ? e.x : M + (G.R() - 0.5) * 8, y = e ? e.y : MH / 2 + (G.R() - 0.5) * 8; orderMove(lazy, x, y, true); for (const u of lazy) S.attackers.add(u.id); }
  }
  // endgame: allied all-in on the weakest enemy, nonstop reinforcement, no retreat
  if (G.time > END_T) { for (const it of P.queues.def.slice()) if (it.t !== 'wall' && it.prog < 0.5 && !S.underAttack) cancel(P.team, it.t);
    if (P.gas > 300 && P.cr > 400) { const gu = ['titan', 'tsar', 'kommando', 'stealth'].filter(t => avail(P.team, t)); const t = gu[(G.R() * gu.length) | 0]; if (t) { const c = UT[t].from === 'barracks' ? 'inf' : UT[t].from === 'factory' ? 'veh' : 'air'; if (P.queues[c] && P.queues[c].length < 4) enqueue(P.team, t); } } }
  if (G.time > END_T && G.time > (S.endT || 0)) { S.endT = G.time + 4; const e = endTarget(P); if (!e) return;
    const mine = intruders.filter(f => me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 9));
    const go = army.filter(u => !UT[u.t].jet && !(u.order === 'attack' && u.tgt) && !(mine.length && dhypot(u.x - mine[0].x, u.y - mine[0].y) < 14 && army.length < 25));
    const far = go.filter(u => dhypot(u.x - e.x, u.y - e.y) > 6 || u.order === 'idle'); if (far.length) { orderMove(far, e.x, e.y, true); for (const u of far) S.attackers.add(u.id); }
    S.allIn = true; S.lastAttack = G.time;
    if (!(cnt.silo) && avail(P.team, 'silo') && P.cr > 3500 && !P.queues.bld.length && !P.ready.bld && aiSpot(P, 'silo', hq, [])) enqueue(P.team, 'silo');
  }
}

// v7.1 home defence: fight as one army under the towers when the sim favours it; otherwise hold the line at the guns (no piecemeal leaks); help allies only with a winning sim
function defend71(P, S, D, me, myB, home, intruders, hq) {
  const mine = intruders.filter(f => myB.some(b => dhypot(b.x - f.x, b.y - f.y) < 12));
  if (!mine.length) { // ally under attack
    if (G.time < (S.helpT || 0)) return; const c = intruders[0], thr = intruders.filter(f => dhypot(f.x - c.x, f.y - c.y) < 10 && UT[f.t].wpn), pool = home.filter(u => !UT[u.t].jet && u.t !== 'harv');
    if (armyVal(thr) > 500 && armyVal(pool) > 1500 && sim71(isV76(P) && !SIOFF.ah76 ? pool.concat(G.ents.filter(e => e.team !== P.team && e.hp > 0 && !foe(e.team, P.team) && (e.kind === 'u' ? UT[e.t].wpn && e.t !== 'harv' : BT[e.t].wpn && !e.offline) && dhypot(e.x - c.x, e.y - c.y) < 13), SIOFF.jd76 ? [] : teamHome76(P, c)) : pool, thr.concat(G.ents.filter(e => e.kind === 'b' && foe(e.team, P.team) && BT[e.t].wpn && dhypot(e.x - c.x, e.y - c.y) < 9))) > (isV76(P) && !SIOFF.ah76 ? 1.1 : 1.3)) { S.helpT = G.time + 25; pool.forEach(u => S.attackers.add(u.id)); orderMove(pool, c.x, c.y, true); G.events.push({ e: 'allyAck', team: P.team, x: c.x, y: c.y }); }
    return; }
  let cx = 0, cy = 0; for (const f of mine) { cx += f.x; cy += f.y; } cx /= mine.length; cy /= mine.length;
  const thr = intruders.filter(f => dhypot(f.x - cx, f.y - cy) < 12 && UT[f.t].wpn), pool = home.filter(u => u.order !== 'attack' && u.t !== 'harv' && dhypot(u.x - cx, u.y - cy) < 30);
  const towers = myB.filter(b => BT[b.t].wpn && !b.offline && dhypot(b.x - cx, b.y - cy) < 9), r = sim71(pool.concat(towers), thr), core = dhypot(cx - hq.x, cy - hq.y) < 9;
  if (r >= 0.7 || core || !thr.length) { if (pool.length && (G.time > (S.dmvT || 0) || !S.dmv || dhypot(S.dmv.x - cx, S.dmv.y - cy) > 4)) { S.dmvT = G.time + 2; S.dmv = { x: cx, y: cy }; orderMove(pool, cx, cy, true); } if (G.time > (S.dmfT || 0)) { S.dmfT = G.time + 1; const eng = pool.filter(u => dhypot(u.x - cx, u.y - cy) < 10); if (eng.length >= 3) micro71(P, S, eng); } }
  else if (G.time > (S.holdT || 0)) { S.holdT = G.time + 4; const tw = myB.filter(b => BT[b.t].wpn && !b.offline).sort((a, b) => dhypot(a.x - cx, a.y - cy) - dhypot(b.x - cx, b.y - cy))[0], hx = tw ? tw.x + (hq.x - tw.x) * 0.25 : hq.x, hy = tw ? tw.y + (hq.y - tw.y) * 0.25 : hq.y; orderMove(pool, hx, hy, true); }
}

// ===== v7.1 Chief SI "super-intelligence" layer (DIFF.si.v71). Pure decision-making: no resource, stat or vision bonuses. =====
// intel memory -> counter-matrix production -> lean early D (fortress factions excepted) -> income-scaled macro ->
// synchronized multi-prong team pushes (gather at per-bot rally points, air pre-strike, go together) -> focus-fire micro.
const isV71 = P => !!(P && DIFF[P.diff] && DIFF[P.diff].v71 && !SIOFF.v71);
const FORT71 = { fra: 1, chn: 1 };
const D71 = {}; // static per-type descriptors (lazy)
function d71(k) { let d = D71[k]; if (d) return d; const u = UT[k], b = BT[k];
  if (u) d = { k, w: u.wpn ? W[u.wpn] : null, armor: u.armor, air: !!u.air, kami: !!u.kami, marine: !!u.marine, veh: !u.air && u.armor !== 'inf', tank: u.armor === 'heavy' && !!u.turret, cost: u.cost + (u.gas || 0) * 2, hp: u.hp * (u.marine ? 1.6 : 1) * (u.regen ? 1.15 : 1) };
  else if (k === 'bal') d = { k, w: W.balS, armor: 'bldg', cost: BALLISTA.cost + 200, hp: BALLISTA.hp };
  else d = { k, w: b.wpn ? W[b.wpn] : null, armor: 'bldg', stat: 1, cost: b.cost, hp: b.hp * (k === 'gtower' ? 1.6 : 1) };
  return (D71[k] = d); }
const DPS71 = {};
function dps71(a, b) { // counter-aware per-unit dps of type a vs type b (DMG table, marine plating, splash/chain vs blobs, range, sortie ammo)
  const key = a + '|' + b; let v = DPS71[key]; if (v != null) return v; const A = d71(a), B = d71(b);
  if (A.kami) v = B.air ? 0 : 175 * DMG.kami[B.armor] * (B.armor === 'inf' ? 0.5 : 0.28);
  else if (!A.w || (B.air ? !A.w.air : !A.w.ground)) v = 0;
  else { const w = A.w; v = w.dmg / w.cd * (w.twin ? 2 : 1) * (DMG[w.type][B.armor] || 0);
    if (w.ammo) v *= 0.3; if (w.splash) v *= 1 + w.splash * (B.armor === 'inf' ? (SIOFF.pe ? 0.55 : 1.1) : 0.25); if (w.chain) v *= 1 + (B.armor === 'inf' ? 0.7 : 0.35);
    if (B.marine) { if (A.veh && !MAR.counter[w.type]) v *= MAR.veh; if (A.air || A.tank) v *= MAR.vsTank; if (w.splash) v *= MAR.splash; if (MAR.take[w.type]) v *= MAR.take[w.type]; else if (MAR.plated[w.type]) v *= 1 - MAR.plated[w.type] - MAR.drN * 4; }
    if (A.marine) v *= 1 + MAR.dmgN * 4; if (A.stat && w.rng > 9) v *= 0.8; v *= 1 + Math.max(0, Math.min(10, w.rng) - 5) * 0.05; }
  return (DPS71[key] = v); }
// counter-aware Lanchester estimate (replaces the raw-dps combatSim for v7.1 decisions)
function sim71(mine, theirs) {
  const hist = l => { const h = new Map(); let hp = 0; for (const e of l) { const k = e.kind === 'b' ? (e.bal ? 'bal' : e.t) : e.t; if (e.kind === 'b' && (e.offline || !BT[e.t].wpn)) continue; h.set(k, (h.get(k) || 0) + 1); hp += e.hp; } return { h, hp }; };
  const A = hist(mine), B = hist(theirs); if (!B.hp) return 9; if (!A.hp) return 0;
  const side = (X, Y) => { let d = 0; for (const [a, na] of X.h) { let s = 0, n = 0; for (const [b, nb] of Y.h) { s += dps71(a, b) * nb * d71(b).hp; n += nb * d71(b).hp; } d += na * (n ? s / n : 0); } return d; };
  const d1 = side(A, B), d2 = side(B, A); if (d2 <= 0) return 9; return (d1 * A.hp) / (d2 * B.hp); }
// intel: remember every enemy unit seen (type/value), decays after 4 min; composition + air threat
function intel71(P, S, foes, knownB) {
  S.mem = S.mem || new Map();
  for (const f of foes) if (f.kind === 'u' && f.t !== 'harv') S.mem.set(f.id, { t: f.t, team: f.team, ts: G.time });
  if (G.time < (S.compT || 0)) return; S.compT = G.time + 3;
  const alive = new Set(); for (const e of G.ents) if (e.kind === 'u' && e.hp > 0 && foe(e.team, P.team)) alive.add(e.id);
  const comp = {}; let tot = 0, air = 0;
  for (const [id, m] of S.mem) { if (!alive.has(id) || G.time - m.ts > 240) { S.mem.delete(id); continue; } const t = m.t === 'raijinJ' ? 'raijin' : m.t, u = UT[t]; if (!u || (!u.wpn && !u.kami)) continue; const w = u.cost * (G.time - m.ts < 75 ? 1 : 0.6); comp[t] = (comp[t] || 0) + w; tot += w; if (u.air && !u.medevac && (u.wpn || u.kami) && t !== 'raijin') air += w; }
  // enemy faction priors until we have seen enough
  if (tot < 4000) { const pr = { rifle: 400, rocketeer: 600, heavy: 3000, arty: 800 }; for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { const sp = FACTIONS[Q.fac] && FACTIONS[Q.fac].sp; if (sp && UT[sp]) pr[sp] = (pr[sp] || 0) + (sp === 'marine' ? 2500 : 1500); }
    const k = 1 - tot / 4000; for (const t in pr) { comp[t] = (comp[t] || 0) + pr[t] * k; } }
  S.comp = comp; S.compTot = tot; S.eAir = air;
  let def = 0; for (const b of knownB) if (BT[b.t].wpn) def += BT[b.t].cost; S.eDef71 = def;
  S.score71 = null; }
const CAND71 = { inf: ['rifle', 'rocketeer', 'sniper', 'kommando', 'marine'], veh: ['heavy', 'arty', 'aa', 'titan', 'tsar', 'scout', 'drone', 'raijin'], air: ['gunship', 'jet', 'intercept', 'bomber', 'stealth'] };
function score71(P, S, t) { // value per credit vs the remembered enemy mix (offense) x survivability
  const comp = S.comp || {}; let tot = 0; for (const c in comp) tot += comp[c]; if (!tot) return 1;
  const A = d71(t); let off = 0, inc = 0;
  for (const c in comp) { const s = comp[c] / tot, C = d71(c); off += s * dps71(t, c) * C.cost / C.hp; inc += s * dps71(c, t) / C.cost; }
  off /= A.cost; const surv = A.hp / A.cost / Math.max(1e-5, inc);
  let sc = off * Math.sqrt(surv);
  if (S.siege && A.w && A.w.ground) sc *= 1 + 0.6 * (DMG[A.w.type].bldg || 0) * (A.w.rng >= 7 ? 1.6 : 1); // tower-heavy enemy: long-range anti-structure
  if (!SIOFF.pe) { const pw = Math.max(0, Math.min(1, (popOf(P.team) - 35) / 45)); if (pw) sc *= Math.pow(Math.max(0.1, A.cost / 700), 0.6 * pw); } // pro supply efficiency: near max, value per pop slot matters
  return sc; }
// deterministic deficit production: target shares from counter scores + guaranteed special / AA / siege shares
function produce71(P, S, cat, myCnt, noJet) {
  if (!producers(P.team, cat)) return null;
  S.score71 = S.score71 || {}; const sp = FACTIONS[P.fac] && FACTIONS[P.fac].sp;
  const opts = CAND71[cat].filter(t => avail(P.team, t) && !(noJet && UT[t].jet)); if (!opts.length) return null;
  const sc = {}; for (const t of opts) sc[t] = S.score71[t] != null ? S.score71[t] : (S.score71[t] = score71(P, S, t));
  if (cat === 'air') { for (const t of opts) if (t === 'intercept') sc[t] = S.eAir > 1500 ? sc[t] * 2 : 0; }
  const aaFull = !SIOFF.aac && (myCnt.aa || 0) * UT.aa.cost > (S.eAir || 0) * 0.8 + 1400; // v7.1.1: enough Skyguards for the air we have seen — the rest of the factory goes to ground power
  if (cat === 'veh') { if (sc.aa != null) sc.aa = S.eAir > 1200 && !aaFull ? sc.aa * 1.5 : 0; if (sc.scout != null) sc.scout *= 0.5; }
  if (cat === 'inf' && sc.sniper != null && !(S.comp && (S.comp.rifle || 0) + (S.comp.rocketeer || 0) > 2000)) sc.sniper *= 0.5;
  const ranked = opts.slice().sort((a, b) => sc[b] - sc[a] || (a < b ? -1 : 1)).slice(0, 3); const share = {}; let st = 0;
  for (const t of ranked) { share[t] = sc[t] * sc[t]; st += share[t]; } for (const t of ranked) share[t] = st ? share[t] / st : 1 / ranked.length;
  const force = (t, s) => { if (!opts.includes(t)) return; const cur = share[t] || 0; if (cur >= s) return; const k = (1 - s) / Math.max(1e-6, 1 - cur); for (const o in share) share[o] *= k; share[t] = s; };
  if (sp && UT[sp] && UT[sp].from && FROMCAT[UT[sp].from] === cat) force(sp, sp === 'marine' ? 0.7 : sp === 'drone' ? 0.3 : sp === 'stealth' ? 0.55 : 0.4);
  if (cat === 'veh' && S.eAir > 1200 && !aaFull) force('aa', Math.min(0.4, 0.12 + S.eAir / Math.max(1, S.compTot) * 0.8));
  if (cat === 'veh' && (S.siege || S.towerHeavy)) force('arty', 0.25);
  if (isV76(P) && !SIOFF.im76 && infMass76(S)) { if (cat === 'veh') { force('arty', 0.35); if (P.fac === 'jpn') force('raijin', 0.4); } } // v7.6.1: infantry/marine mass -> Howlers outrange it (7 / 10 sieged, splash), Raijin chain lightning
  if (cat === 'inf' && S.eAir > 1200 && !opts.includes('marine')) force('rocketeer', 0.35);
  let n = 0; for (const t in share) n += myCnt[t] || 0;
  const gb = P.gas > 500 ? Math.min(0.2, (P.gas - 500) / 4000) : 0, maxed = popOf(P.team) >= POP_CAP - 6;
  let best = null, bd = -9; const spG = sp ? ((UT[sp] || BT[sp]).gas || 0) : 0; // keep gas for the faction special (tsar/stealth/raijin/kommando/Grand Cannon)
  for (const t in share) { const g = UT[t].gas || 0; if (P.gas < g || (g && t !== sp && P.gas - g < spG)) continue; const dd = share[t] - (n ? (myCnt[t] || 0) / n : 0) + (g ? gb : 0) + (maxed ? UT[t].cost / 20000 : 0); if (dd > bd) { bd = dd; best = t; } }
  if (!best) best = ranked.find(t => !(UT[t].gas)) || null; return best; }
function prodMix71(P, S, cnt, harvs, refs) {
  if (P.cr < 250) return; const air = (cnt.gunship || 0) + (cnt.jet || 0) + (cnt.intercept || 0) + (cnt.bomber || 0) + (cnt.stealth || 0);
  const NK = DIFF[P.diff].nick; for (const cat of NK ? ['inf'] : ['veh', 'inf', 'air']) { const pr = producers(P.team, cat); if (!pr) continue; if (cat === 'veh' && harvs < Math.min(2, refs * 2)) continue;
    if (cat === 'air' && air >= Math.min(16, 4 + Math.floor(G.time / 120))) continue;
    if (cat === 'air' && !SIOFF.jr && (cnt.jet || 0) + (cnt.bomber || 0) + (cnt.stealth || 0) >= G.ents.reduce((n, b) => n + (b.team === P.team && b.t === 'airfield' && b.hp > 0 && b.kind === 'b' ? airSlots(b) : 0), 0) && producers(P.team, 'air') && (S.jrN = 1)) { const t = produce71(P, S, cat, cnt, 1); if (t && enqueue(P.team, t)) cnt[t] = (cnt[t] || 0) + 1; continue; } // v7.1.1: no more strike craft than parking slots
    if (P.queues[cat].length >= pr + 1) continue;
    if (cat === 'inf' && isV76(P) && !SIOFF.pp76 && popInf76(P, S, cnt)) continue; // v7.6.1 SC2 supply efficiency: past ~45 pop the barracks stop cheap rifles/rocketeers; pop slots go to tanks/Howlers
    if (cat === 'inf' && !SIOFF.pe && popOf(P.team) > 55 && P.cr < 1500 && !['marine', 'kommando'].includes(FACTIONS[P.fac] && FACTIONS[P.fac].sp) && producers(P.team, 'veh') && (cnt.rifle || 0) + (cnt.rocketeer || 0) > 14) continue; // late: pop goes to tanks/arty, infantry only as a topped-up screen
    const t = NK && avail(P.team, 'marine') ? 'marine' : produce71(P, S, cat, cnt); if (t && enqueue(P.team, t)) cnt[t] = (cnt[t] || 0) + 1; } }
// macro: production buildings scale with measured income (1-min window), never float
function income71(P, S) { S.incH = S.incH || []; if (G.time >= (S.incT || 0)) { S.incT = G.time + 10; S.incH.push(P.stats.mined || 0); if (S.incH.length > 7) S.incH.shift(); }
  const h = S.incH; return h.length > 1 ? (h[h.length - 1] - h[0]) / ((h.length - 1) * 10) : 0; }
function prodTarget71(P, S, D, cnt, hq, foes) {
  const ok = k => avail(P.team, k) && (S.bad[k] || 0) < G.time && !!aiSpot(P, k, hq, foes), inc = income71(P, S), t = G.time;
  const nf = cnt.factory || 0, nb = cnt.barracks || 0, na = cnt.airfield || 0, bra = P.fac === 'bra' || P.fac === 'ger';
  // pro macro: production scales with income so the army remaxes fast after every trade (+1 of each while banking)
  const wf = Math.max(t < 200 ? 1 : 2, Math.min(7, Math.round(inc * (bra ? 0.5 : 0.7) / 95 + (P.cr > 2000 ? 1 : 0))));
  const wb = Math.max(1, Math.min(bra ? 7 : 5, Math.round(inc * (bra ? 0.5 : 0.3) / 55 + (P.cr > 2500 ? 1 : 0))));
  const wa = hasBuilt(P.team, 'tech') ? Math.max(t < 420 ? 0 : 1, Math.min(P.fac === 'usa' ? 4 : 3, Math.round(inc * (P.fac === 'usa' ? 0.25 : 0.12) / 130))) : 0;
  if (t > 150 && ((P.gas < 450 && P.cr > 700) || ((cnt.extractor || 0) < 2 && P.cr > BT.extractor.cost + 50)) && (cnt.extractor || 0) < 2 + 2 * (cnt.cc || 0) && ok('extractor')) return 'extractor'; // gas = specials + tier-3 units; take every vent we can hold
  if (DIFF[P.diff].nick) { // sparring 'Nicholas': one factory (harvesters), barracks scale hard with income, early launcher, nothing else
    if (t > 150 && (cnt.extractor || 0) < 2 && P.cr > BT.extractor.cost + 50 && ok('extractor')) return 'extractor';
    if (silo76(P, S, cnt, inc) && ok('silo')) { S.siloSave76 = true; return 'silo'; } S.siloSave76 = false;
    const wbN = Math.max(2, Math.min(25, Math.round(inc / 40 + (P.cr > 2500 ? 2 : 0) + (P.cr > 10000 ? 4 : 0))));
    if (nb < wbN && P.cr > 350 && ok('barracks')) return 'barracks'; return null; }
  if (nf < wf && nf >= 1 && P.cr > 500 && ok('factory')) return 'factory';
  if (nb < wb && P.cr > 350 && ok('barracks')) return 'barracks';
  if (na < wa && P.cr > 900 && ok('airfield')) return 'airfield';
  if (isV76(P) && !SIOFF.sl76) { S.siloSave76 = silo76(P, S, cnt, inc) && ok('silo'); if (S.siloSave76) return 'silo'; }
  else if (t > 600 && !(cnt.silo || 0) && P.cr > 3500 && P.gas > 600 && ok('silo')) return 'silo';
  if (P.cr > 3500 && nf < 8 && ok('factory')) return 'factory';
  return null; }
const AI_ORDER_SI71 = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'power', 'tech', 'power', 'refinery', 'barracks', 'power', 'factory', 'airfield', 'power', 'extractor', 'power', 'power', 'power'];
// lean, layered static D: enemy-facing entrances only until tech/expansion; France/China fortress doctrine
function defPlan71(P, S, tier) {
  if (isV76(P) && !SIOFF.im76 && infMass76(S) && tier >= 3 && P.fac !== 'fra') { const T = facDef(P, 'tesla'); return [['turret', 1], [T, 2], ['aagun', S.eAir > 1500 ? 1 : 0], [T, 3]]; } // cannon turrets do 0.35x to infantry: Tesla clusters instead
  const air = S.eAir > 1500 ? Math.min(3, Math.ceil(S.eAir / 3000)) : 0;
  if (fort76(P) && tier >= 3) { if (P.fac === 'fra') return tier === 3 ? [['gatling', 2], ['gcannon', 2], ['turret', 2], ['aagun', air ? 1 : 0], ['gatling', 3], ['gcannon', 3]] : [['gatling', 3], ['gcannon', 3], ['turret', 2], ['aagun', Math.max(1, air)], ['gatling', 4], ['gcannon', 5]]; // Grand Cannon lines
    if (P.fac === 'chn') return tier === 3 ? [['turret', 2], ['tesla', 2], ['aagun', air ? 1 : 0], ['turret', 3]] : [['turret', 3], ['tesla', 3], ['aagun', Math.max(1, air)], ['turret', 4], ['tesla', 4]]; } // + Great Wall / Ballista managers as usual
  if (P.fac === 'fra') return tier === 1 ? [['turret', 2]] : tier === 2 ? [['turret', 2], ['aagun', air ? 1 : 0]] : tier === 3 ? [['gatling', 2], ['turret', 2], ['gcannon', 1], ['aagun', air ? 1 : 0], ['gatling', 3]] : [['gatling', 3], ['gcannon', 2], ['turret', 2], ['aagun', air], ['gatling', 4], ['gcannon', 3]];
  if (P.fac === 'chn') return tier === 1 ? [['turret', 1]] : tier === 2 ? [['turret', 2]] : tier === 3 ? [['turret', 2], ['tesla', 1], ['aagun', air ? 1 : 0]] : [['turret', 2], ['tesla', 2], ['aagun', air]];
  const T = facDef(P, 'tesla'); return tier <= 2 ? [['turret', tier]] : tier === 3 ? [['turret', 2], [T, 1], ['aagun', air ? 1 : 0]] : [['turret', 2], [T, 2], ['aagun', air]]; }
// ---- synchronized team pushes ----
function plan71(P) { G.tp71 = G.tp71 || {}; const p = G.tp71[P.ally]; if (p && (G.time - p.t0 > 200 || (!SIOFF.ps76 && isV76(P) && !p.go && G.time - p.t0 > 20 && !Object.values(p.m).some(m => m.live)) || (p.go && G.time - p.go > 40 && !Object.values(p.m).some(m => m.live)))) { delete G.tp71[P.ally]; return null; } return p || null; }
function rally71(p, P, hq) { // per-member rally ~17 tiles short of the target, each on its own approach angle (concave / multi-prong)
  if (isV76(P) && !SIOFF.tg76 && !p.hum) { const r = stage76(p, P); if (r) return clear76(P, r); }
  const n = Object.keys(p.m).length, a0 = datan2(hq.y - p.y, hq.x - p.x), side = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.7;
  for (const r of [17, 14, 20, 11]) { const a = a0 + side, x = Math.max(3, Math.min(MW - 3, p.x + dcos(a) * r)), y = Math.max(3, Math.min(MH - 3, p.y + dsin(a) * r)); const f = nearFree(Math.floor(x), Math.floor(y), 5); if (f) return clear76(P, { x: f[0] + 0.5, y: f[1] + 0.5 }); }
  return { x: hq.x, y: hq.y }; }
function army71(P, S, D, me, foes, knownB, idle, intruders, hq, estart) { // returns true if it launched / joined
  if (!peaceOver(P) || S.grp.length) return false; if (SIOFF.air2 ? intruders.length : armyVal(intruders.filter(f => !isAir(f) && UT[f.t].wpn)) > 900 || intruders.filter(f => !isAir(f)).length >= 3) return false;
  const av = armyVal(idle), maxed = popOf(P.team) >= POP_CAP - 8; let p = plan71(P);
  const hp = humanPush71(P); // a human ally is pushing: back the push now with everything idle (no waiting for a team plan)
  if (hp && av >= 1200 && idle.length >= 4) { if (!p || p.team !== hp.team || !p.hum) p = G.tp71[P.ally] = { t0: G.time, team: hp.team, x: hp.x, y: hp.y, m: {}, go: G.time, hum: 1 };
    if (!p.m[P.team] || !p.m[P.team].live) { p.m[P.team] = { rp: { x: hp.x, y: hp.y }, live: 1, ready: 1 }; launch71(P, S, idle, p); S.grpWp = null; G.events.push({ e: 'allyAck', team: P.team, x: hp.x, y: hp.y }); return true; } }
  if (G.time <= (S.retreatT || -99) + 20) return false;
  if (p && p.m[P.team]) p.m[P.team].live = 0; // my group is gone (S.grp empty here)
  if (p && p.go && !p.m[P.team] && G.time - p.go < 40 && av >= 1500 && idle.length >= 5) { p.m[P.team] = { rp: { x: p.x, y: p.y }, live: 1, ready: 1 }; launch71(P, S, idle, p); S.grpWp = null; return true; } // late joiner: straight in as a reinforcement wave
  if (p && !p.go && !p.m[P.team] && av >= 1500 && idle.length >= 5) { p.m[P.team] = { rp: rally71(p, P, hq), live: 1 }; launch71(P, S, idle, p); return true; }
  if (p) return false;
  if (pw76On(P) && S.pwOpen && pw76Launch(P, S, idle, av, knownB, hq)) return true;
  // create a plan: whole-team available army vs remembered enemy army + their static D at the target
  const allies = G.players.filter(Q => Q.ally === P.ally && !Q.out && Q.ai && isV71(Q)); let teamAv = 0;
  for (const Q of allies) teamAv += Q === P ? av : (Q.aiS.av71 || 0);
  const eArmy = S.compTot || 0, fortF = G.players.some(Q => foe(Q.team, P.team) && !Q.out && FORT71[Q.fac]) ? 1.3 : 1, dPrior = SIOFF.dp ? Math.max(S.eDef71 || 0, G.time * 4) : Math.max((S.eDef71 || 0) * 1.2, Math.min(Math.max(0, G.time - 60) * 34, 18000) * fortF), need0 = Math.max(2800 + G.time * 3, eArmy * 1.15 + dPrior * (SIOFF.x ? 0.6 : 0.95)) * (allies.length > 1 ? 1 : 0.85); let need = need0;
  const n76 = isV76(P) && !SIOFF.nd76 ? need76(P, S, knownB, hq, allies) : null; if (n76) need = n76.need;
  if (fort76(P) && !maxed) need *= FP76_BAR; // fortress style: sit behind the defences, let them come, punish via the window above
  if (D.nick) { if (!(popOf(P.team) >= POP_CAP - 8 && idle.length >= 30)) return false; need = 0; }
  S.need71 = need; const timing = n76 ? G.time > 300 && av >= 2500 && G.time - S.lastAttack > 90 && (allies.length > 1 && !SIOFF.ts76 ? teamAv >= need * 1.05 && av >= Math.min(need * 0.3, 5000) : av >= need * 0.8 || teamAv >= need * 0.7 && G.time - S.lastAttack > 150) : G.time > 360 && av >= 3000 && G.time - S.lastAttack > 150 && av >= need * (SIOFF.x ? 0.7 : 0.9);
  if (G.time < (er76On(P) ? 420 : 300) && teamAv < Math.max(need, SIOFF.ea ? 0 : ((er76On(P) ? Math.max(eArmy, (G.time - 60) * 45) : eArmy) * 1.15 + Math.max(S.eDef71 || 0, 2400)) * 0.85) * (SIOFF.dp ? 2 : fortF > 1 && G.time < 300 ? 2.4 : 1.5)) return false; // no blind early all-ins into unscouted towers
  let lanGo = false; if (m7On(P, 'a') && n76 && n76.tgt && !fort76(P) && G.time > 300 && av >= 2500 && idle.length >= 6 && G.time - S.lastAttack > 60 && G.time >= (S.lan7T || 0)) { S.lan7T = G.time + 3; // v7.6.6: attack when the square law says we win with >~45% left
    const tb0 = n76.silo || knownB.filter(b => b.team === n76.tgt.team).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y) || a.id - b.id)[0]; lanGo = lan7(P, S, idle, n76.tgt.team, knownB, tb0, teamAv, av, maxed) >= (+SION.lanR || 1.3); }
  if (!(teamAv >= need && av >= Math.min(need * 0.4, 6000)) && !(maxed && idle.length >= 10) && !timing && !lanGo) return false;
  // target: the enemy player whose known army+defence is weakest relative to distance
  let tgt = null, bs = 1e18; for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { let v = 0; for (const [, m] of S.mem || []) if (m.team === Q.team) v += UT[m.t].cost; for (const b of knownB) if (b.team === Q.team && BT[b.t].wpn) v += BT[b.t].cost * 0.5; const st = G.starts[Q.start], s = v + dhypot(st[0] - hq.x, st[1] - hq.y) * 60; if (s < bs) { bs = s; tgt = Q; } }
  if (n76) tgt = n76.tgt;
  if (!tgt) return false; const tb = (n76 && n76.silo) || knownB.filter(b => b.team === tgt.team).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y))[0], st = G.starts[tgt.start];
  p = G.tp71[P.ally] = { t0: G.time, team: tgt.team, x: tb ? tb.x : st[0], y: tb ? tb.y : st[1], m: {}, go: 0 };
  p.m[P.team] = { rp: rally71(p, P, hq), live: 1 }; launch71(P, S, idle, p);
  for (const Q of allies) if (Q.aiS) Q.aiS.raidT = 0; // air pre-strike on power/AA as the armies gather
  return true; }
function humanPush71(P) { // human ally's army is committed on the enemy side of the map -> {team,x,y} of what it is hitting
  const c = G.hp71 || (G.hp71 = {}), k = P.ally; if (c[k] && G.time < c[k].t) return c[k].r; let r = null;
  for (const Q of G.players) { if (Q.ai || Q.ally !== P.ally || Q.team === P.team) continue; const own = G.starts[Q.start]; let n = 0, v = 0, x = 0, y = 0; const hs = G.hp71s || (G.hp71s = {}), H2 = SIOFF.hp2 ? null : hs[Q.team] && G.time < hs[Q.team].t ? hs[Q.team] : { ids: new Set(), t: 0 }; // v7.1.2: the push is seen from the order itself (attack-move aimed at the enemy), and stays tracked ~45 s even if the units get side-tracked
    for (const u of G.ents) if (u.kind === 'u' && u.team === Q.team && u.hp > 0 && UT[u.t].wpn && u.t !== 'harv') { let fe = 1e9, oe = dhypot(u.x - own[0], u.y - own[1]); for (const E of G.players) if (foe(E.team, P.team) && !E.out) { const s = G.starts[E.start]; fe = Math.min(fe, dhypot(u.x - s[0], u.y - s[1])); } if (((fe < oe * 1.25 || (oe > 18 && fe < oe * 1.8)) && fe < 60) || (H2 && (H2.ids.has(u.id) || pushOrd71(u, own, P)))) { if (H2) H2.ids.add(u.id); n++; v += UT[u.t].cost; x += u.x; y += u.y; } }
    if (H2 && n >= 4 && v >= 2500) { if (!H2.t) H2.t = G.time + 45; hs[Q.team] = H2; }
    if (n >= 4 && v >= 2500) { x /= n; y /= n; let tb = null, bd = 1e9; for (const b of G.ents) if (b.kind === 'b' && b.hp > 0 && foe(b.team, P.team) && visibleTo(P.team, b)) { const d = dhypot(b.x - x, b.y - y); if (d < bd) { bd = d; tb = b; } }
      r = tb && bd < 18 ? { team: tb.team, x: tb.x, y: tb.y } : { team: (G.players.filter(E => foe(E.team, P.team) && !E.out).sort((a, b) => dhypot(G.starts[a.start][0] - x, G.starts[a.start][1] - y) - dhypot(G.starts[b.start][0] - x, G.starts[b.start][1] - y))[0] || {}).team, x, y }; r.v = v; break; } }
  c[k] = { t: G.time + 2, r: r && r.team != null ? r : null }; return c[k].r; }
function pushOrd71(u, own, P) { if (u.order !== 'amove' || !u.anchor) return false; const ao = dhypot(u.anchor.x - own[0], u.anchor.y - own[1]); if (ao < 20) return false; // v7.1.2: attack-move ordered toward an enemy base
  for (const E of G.players) if (foe(E.team, P.team) && !E.out) { const s = G.starts[E.start]; if (dhypot(u.anchor.x - s[0], u.anchor.y - s[1]) < Math.min(25, ao)) return true; } return false; }
function launch71(P, S, idle, p) {
  const mm = p.m[P.team]; S.grp = idle.slice(); S.grpV0 = armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
  S.lastAttack = G.time; S.regT = 0; S.grpWp = { x: mm.rp.x, y: mm.rp.y, t: p.t0 + (isV76(P) && !SIOFF.tg76 && !p.hum ? 100 : 55), hold: 1 }; oM71(P, S, S.grp, mm.rp.x, mm.rp.y, true);
  if (S.firstAttackT == null) S.firstAttackT = G.time; }
function plan71Tick(P, S, c, near) { // group at its rally: mark ready; plan goes when every member is in place (or on timeout)
  const p = plan71(P); if (!p || !p.m[P.team]) { if (S.grpWp && S.grpWp.hold) S.grpWp = null; return; }
  const mm = p.m[P.team]; mm.live = S.grp.length ? 1 : 0;
  if (!p.go) { if (S.grpWp && dhypot(c.x - S.grpWp.x, c.y - S.grpWp.y) < 6) mm.ready = 1; if (near.length) mm.ready = 1;
    if (Object.values(p.m).every(m => m.ready || !m.live) || G.time > p.t0 + (isV76(P) && !SIOFF.tg76 && !p.hum && Object.keys(p.m).length > 1 ? 100 : 55)) p.go = G.time; }
  if (p.go && S.grpWp && S.grpWp.hold) { S.grpWp = null; S.regT = 0; } }
// focus fire: priority targets (artillery/healers/specials/damaged) get just enough guns (no overkill)
const PRI71 = { medevac: 2.6, arty: 2.2, drone: 1.6, engineer: 1.3, tsar: 1.7, raijin: 1.7, raijinJ: 1.7, kommando: 1.8, stealth: 1.6, sniper: 1.6, titan: 1.4, bomber: 1.5, harv: 0.5 };
function micro71(P, S, units) {
  if (G.time < (S.mfT || 0) || units.length < 3) return; S.mfT = G.time + 1;
  let cx = 0, cy = 0; for (const u of units) { cx += u.x; cy += u.y; } cx /= units.length; cy /= units.length;
  const E = []; for (const e of G.ents) if (e.kind === 'u' && e.hp > 0 && foe(e.team, P.team) && Math.abs(e.x - cx) < 12 && Math.abs(e.y - cy) < 12 && visibleTo(P.team, e)) E.push(e);
  if (!E.length) return;
  const sc = e => { const k = e.t, th = UT[k].wpn ? Math.max(5, dps71(k, 'heavy') + dps71(k, 'rifle')) : 3; return th * (PRI71[k] || 1) / Math.max(60, e.hp) * (e.sg === 2 ? 1.4 : 1); };
  const ranked = E.map(e => [sc(e), e]).sort((a, b) => b[0] - a[0] || a[1].id - b[1].id).slice(0, 6).map(x => x[1]);
  const used = new Set();
  for (const e of ranked) { let dmg = 0; const need = e.hp * 1.15, kk = e.t === 'raijinJ' ? 'raijin' : e.t;
    const cand = units.filter(u => !used.has(u.id) && UT[u.t].wpn && !UT[u.t].jet && u.sg !== 2).map(u => [dhypot(u.x - e.x, u.y - e.y), u]).filter(([d, u]) => { const w = uW(u); return w && canHit(w, e) && d < w.rng + 1.2 && dps71(u.t, kk) > 0; }).sort((a, b) => a[0] - b[0] || a[1].id - b[1].id);
    for (const [, u] of cand) { if (dmg >= need) break; used.add(u.id); dmg += dps71(u.t, kk) * 2.5; if (u.tgt !== e) orderAttack([u], e); } } }

// ===== v7.6 Hard rework layer (DIFF.si2.v76). Decision-making only: no resource, stat or vision bonuses. 'si' never runs this. =====
const isV76 = P => !!(P && DIFF[P.diff] && DIFF[P.diff].v76 && !SIOFF.v76);
function hold76(P, amt) { const r = Math.max(0, Math.min(P.cr, amt)); P.cr -= r; P._rv = (P._rv || 0) + r; } // keep money in the bank for this think step (returned by aiThink)
function engSpot76(P, eng, foes) { // a legal Command Center spot next to one of my engineers, away from visible enemies
  let best = null, bs = 1e9;
  for (const u of eng) for (let r = 1; r <= 7; r++) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, x = Math.round(u.x - 1.5 + Math.cos(a) * r), y = Math.round(u.y - 1.5 + Math.sin(a) * r);
    if (!canPlace('cc', P.team, x, y)) continue; let s = r; for (const f of foes) if (f.kind === 'u' && UT[f.t].wpn) { const d = dhypot(f.x - x - 1.5, f.y - y - 1.5); if (d < 12) s += (12 - d) * 3; } if (s < bs) { bs = s; best = [x, y]; } }
  return best; }
function pre76(P, S, D, me, cnt, hq, foes, knownB) {
  const t = G.time, yd = me.filter(e => (e.t === 'hq' || e.t === 'cc') && e.hp > 0 && e.sell < 0);
  // (d) base wiped: an engineer founds a new Command Center (the same rule and price as for players) - this beats everything else
  if (!yd.length) { S.wiped76 = t;
    const eng = me.filter(u => u.t === 'engineer' && u.hp > 0);
    if (!eng.length) { if (!(cnt.engineer || 0) && avail(P.team, 'engineer') && P.cr >= UT.engineer.cost) enqueue(P.team, 'engineer'); return; }
    if (P.ready.bld === 'cc') { const sp = engSpot76(P, eng, foes); if (sp) placeReady(P.team, 'bld', sp[0], sp[1]); else if (G.time > (S.engMvT || 0)) { S.engMvT = G.time + 6; orderMove(eng.slice(0, 1), hq.x + (G.R() - 0.5) * 8, hq.y + (G.R() - 0.5) * 8, false); } return; }
    if (!me.some(e => e.t === 'cc' && e.con) && !P.queues.bld.some(q => q.t === 'cc')) { if (P.ready.bld) cancel(P.team, P.ready.bld); for (const it of P.queues.bld.slice()) cancel(P.team, it.t); enqueue(P.team, 'cc'); }
    return; }
  // warhead threat seen (enemy silo known, or an enemy missile in the air) -> SM-3 on the key yards ASAP
  if (!S.war76 && (knownB.some(b => b.t === 'silo') || (G.missiles || []).some(ms => foe(ms.team, P.team)))) S.war76 = t;
  if (S.war76 && hasBuilt(P.team, 'tech')) { const need = yd.filter(b => !b.con && !b.sm3 && b.upT == null).sort((a, b) => (a.t === 'hq' ? 0 : 1) - (b.t === 'hq' ? 0 : 1));
    const busy = yd.some(b => b.upT != null && b.upKind === 'sm3'); if (need.length && !busy && yd.filter(b => b.sm3).length < 3) { const rv = P._rv || 0; P.cr += rv; P._rv = 0; if (!upgradeB(need[0])) S.sm3Save = 1; else S.sm3Save = 0; P._rv = Math.min(P.cr, rv); P.cr -= P._rv; } else S.sm3Save = 0; }
  // repair what is damaged; keep defenses upgraded when the bank allows or they are being hit
  if (t > (S.rp76 || 0)) { S.rp76 = t + 2; for (const b of me) if (b.kind === 'b' && !b.con && b.hp > 0) { if (b.hp < b.mhp * 0.7 && P.cr > 300) b.repair = true; else if (P.cr < 120) b.repair = false; }
    if ((P.cr > 1600 || S.underAttack && P.cr > 700) && G.R() < 0.5) { const d = me.filter(b => b.kind === 'b' && !b.con && UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y))[0]; if (d) upgradeB(d); }
    // never float: a maxed pro with a big bank turns it into upgraded towers and Grand Cannons on every base
    if (!D.nick && P.cr > 6000) { for (const d of me.filter(b => b.kind === 'b' && !b.con && UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null).slice(0, 3)) if (P.cr > 4000) upgradeB(d);
      if (popOf(P.team) >= POP_CAP - 8 && !P.queues.def.length && !P.ready.def && (cnt.gcannon || 0) + (cnt.tesla || 0) + (cnt.gatling || 0) < 6 + 4 * yd.length) { const k = ['gcannon', facDef(P, 'tesla'), 'turret'].find(k => BT[k] && avail(P.team, k) && P.gas >= (BT[k].gas || 0)); if (k) enqueue(P.team, k); } } }
}
function post76(P, S, D, me, cnt, hq) { // runs after the structure orders: money a pro keeps in the bank this step
  const t = G.time, yd = (cnt.hq || 0) + (cnt.cc || 0); let r = 0;
  if (S.sm3Save) r += SM3.cost;
  if (yd <= 1 && t > 240) r += S.war76 ? BT.cc.cost : BT.cc.cost * 0.6; // backup Command Center money while I only have one yard
  if (S.siloSave76 && !(cnt.silo || 0)) r += 1500;
  if (r && P.cr < r + 4000) hold76(P, r);
  // gas: the Warhead Launcher (500) and then a Titan Warhead (1000) are worth more than a few more gas units
  let g = 0; const silo = me.find(e => e.t === 'silo' && e.hp > 0); if (!silo && hasBuilt(P.team, 'tech') && t > 400 && (cnt.cc || 0) >= 1) g = BT.silo.gas; else if (silo && !silo.mis && !silo.mq && !S.underAttack) g = MIS.heavy.gas;
  if (g) { const h = Math.min(P.gas, g); P.gas -= h; P._rvG = (P._rvG || 0) + h; } }
function silo76(P, S, cnt, inc) { // pros build the launcher once tech + a second base run; saving for it beats a random extra factory
  return G.time > (DIFF[P.diff].nick ? 330 : 420) && !(cnt.silo || 0) && hasBuilt(P.team, 'tech') && ((cnt.cc || 0) >= 1 || DIFF[P.diff].nick) && inc > 120 && P.gas >= BT.silo.gas; }
function mass76(P, f, R) { let v = 0; for (const o of P.aiS.vis76) if (dhypot(o.x - f.x, o.y - f.y) < R) v += UT[o.t].cost * (o.hp / o.mhp); return v; }
function friendly76(P, x, y, R) { let v = 0; for (const e of G.ents) if (!foe(e.team, P.team) && e.hp > 0 && (e.kind === 'u' || e.kind === 'b') && dhypot(e.x - x, e.y - y) < R + 1.5) v += e.kind === 'b' ? BT[e.t].cost : UT[e.t].cost; return v; }
function warhead76(P, S, D, me, foes, knownB, intruders) {
  const silos = me.filter(e => e.t === 'silo' && e.hp > 0 && !e.con && G.time - e.born > 1.5); if (!silos.length) return;
  const sm3B = knownB.filter(b => (b.t === 'hq' || b.t === 'cc') && b.sm3 && b.hp > 0), cover = (x, y) => sm3B.filter(b => dhypot(b.x - x, b.y - y) < SM3.r + 3).length;
  S.vis76 = foes.filter(f => f.kind === 'u' && UT[f.t].wpn && !isAir(f));
  for (const s of silos) {
    if (!s.mis && !s.mq) { // build: Titan for bases when the gas is there; a quick Viper when my base is hit; Hydra if the Titan is far off
      if (s.emptyT == null) s.emptyT = G.time; const wait = G.time - s.emptyT;
      const k = P.gas >= MIS.heavy.gas && P.cr >= MIS.heavy.cost + 300 ? 'heavy' : S.underAttack && armyVal(intruders) > 1200 && P.gas >= MIS.small.gas && P.cr >= MIS.small.cost ? 'small' : wait > 100 && P.gas >= MIS.cluster.gas && P.cr >= MIS.cluster.cost + 400 ? 'cluster' : wait > 160 && P.gas >= MIS.small.gas && P.cr >= MIS.small.cost + 600 ? 'small' : null;
      const k7 = m7On(P, 'd') ? mis7(P, S, s, knownB, wait, intruders) : k; // v7.6.6: never build a missile with nothing in its range
      if (k7 && siloBuild(s, k7)) s.emptyT = null; continue; }
    if (!s.mis || G.time < (s.cdT || 0)) continue; const k = s.mis, m = MIS[k], R = m.r + (m.spread || 0) * 0.6;
    const M7 = m7On(P, 'd'); if (M7) { if (s.rd7 == null) s.rd7 = G.time; const pp = plan71(P); // a Titan waits (<=45 s) for my push to reach its target, then lands with it
      if (k === 'heavy' && pp && pp.go && S.grp.length >= 6 && G.time - s.rd7 < 45) { const c = S.grp[0]; if (dhypot(c.x - pp.x, c.y - pp.y) > 30) continue; } }
    const lo7 = M7 ? (G.time - s.rd7 > 60 ? 0.4 : 1) : 1;
    let best = null, bv = 0;
    if (k !== 'heavy') { // armies: attackers at my base first (defense), then mid-range field armies
      for (const f of S.vis76) { if (dhypot(f.x - s.x, f.y - s.y) > m.rng || cover(f.x, f.y)) continue; const v = mass76(P, f, R), home = intruders.includes(f), fr = friendly76(P, f.x, f.y, R);
        if (fr > v * (home ? 0.3 : 0.15)) continue; const sc = v * (home ? 1.6 : 1); if (sc > bv) { bv = sc; best = f; } }
      if (best && bv < (k === 'small' ? 900 : 1500) * lo7) best = null; }
    if (!best && (k === 'heavy' || G.time - (s.lastLaunch || s.born) > 150 || lo7 < 1)) { // bases: biggest cluster of buildings, never into SM-3 umbrellas with small ones
      bv = 0; for (const b of knownB) { if (dhypot(b.x - s.x, b.y - s.y) > m.rng) continue; const c = cover(b.x, b.y); if (c && (k !== 'heavy' || c > 1)) continue; if (friendly76(P, b.x, b.y, R) > 0) continue;
        let v = 0; for (const o of knownB) { const d = dhypot(o.x - b.x, o.y - b.y); if (d < R + 1) v += BT[o.t].cost * (o.t === 'hq' || o.t === 'cc' || o.t === 'silo' || o.t === 'factory' ? 1.5 : BT[o.t].cat === 'def' || o.t === 'power' ? 1.3 : 1) * (1 - d / (R + 2)); }
        v *= c ? 0.5 : 1; if (v > bv) { bv = v; best = b; } }
      if (best && bv < (k === 'heavy' ? 2500 : 1200) * lo7) best = null; }
    if (best && siloLaunch(s, best.x, best.y)) { s.readyT = null; s.rd7 = null; G.events.push({ e: 'aiWar', team: P.team, k }); }
  }
}
function infMass76(S) { const c = S.comp || {}, tot = S.compTot || 0; if (tot < 3000) return false; let inf = 0; for (const k in c) { const u = d71(k); if (u && u.armor === 'inf') inf += c[k]; } return inf > tot * 0.55; }
function macro76(P, S, cnt, hq, foes) { const f = cnt.factory || 0, br = cnt.barracks || 0;
  for (const t of f <= br ? ['factory', 'barracks'] : ['barracks', 'factory']) if (avail(P.team, t) && (S.bad[t] || 0) < G.time && P.cr > BT[t].cost * 0.6) { if (aiSpot(P, t, hq, foes)) return t; S.bad[t] = G.time + 45; }
  return null; }
function release76(P, S) { // one role per unit: anything flagged 'attacking' that no squad owns and that stands idle goes back to the home army
  if (G.time < (S.orT || 0)) return; S.orT = G.time + 3; const keep = new Set();
  for (const L of [S.grp, S.flank, S.hsq]) for (const u of L || []) keep.add(u.id); if (S.raid && S.raid.u) for (const u of S.raid.u) keep.add(u.id);
  for (const id of [...S.attackers]) { const u = byId(id); if (!u || u.hp <= 0 || u.dead) { S.attackers.delete(id); continue; } if (keep.has(id) || u.tsR || isAir(u) || u.t === 'engineer' || u.order === 'derrick') continue; if (u.order === 'idle' && !u.tgt && !(u.path && u.path.length)) S.attackers.delete(id); } }
function need76(P, S, knownB, hq, allies) { // what it takes to beat the ONE enemy we'd hit (its remembered army + its known static D), not the sum of the whole enemy alliance
  let tgt = null, bs = 1e18, bi = null;
  for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { let a = 0, d = 0, nb = 0;
    for (const [, m] of S.mem || []) if (m.team === Q.team) { const u = UT[m.t === 'raijinJ' ? 'raijin' : m.t]; if (u && (u.wpn || u.kami)) a += u.cost * (G.time - m.ts < 75 ? 1 : 0.6); }
    for (const b of knownB) if (b.team === Q.team) { nb++; if (BT[b.t].wpn && !b.offline) d += BT[b.t].cost * ((b.lvl || 1) > 1 ? 1.4 : 1); }
    const dp = nb >= 5 ? d : Math.max(d, Math.min(Math.max(0, G.time - 90) * 10, 5000)); // barely scouted: assume some towers
    const st = G.starts[Q.start], s = a * 1.1 + dp * 0.8 + dhypot(st[0] - hq.x, st[1] - hq.y) * 40; if (s < bs) { bs = s; tgt = Q; bi = { a, d: dp }; } }
  if (!tgt) return null;
  const need = Math.max(2200 + G.time * 2, bi.a * 1.1 + bi.d * 0.8) * (allies.length > 1 ? 1 : 0.9);
  const silo = knownB.find(b => b.team === tgt.team && b.t === 'silo' && b.hp > 0) || null; // their Warhead Launcher is the first objective
  return { tgt, need, silo }; }

// ===== v7.6.1 managers (SC2 bot architecture: macro / intel / army / defense managers; see docs/sc2-bot-strategies.md) =====
function allyU76(P, x, y, r) { if (!isV76(P) || SIOFF.as76) return []; const o = []; for (const e of G.ents) if (e.kind === 'u' && e.team !== P.team && e.hp > 0 && !foe(e.team, P.team) && UT[e.t].wpn && e.t !== 'harv' && dhypot(e.x - x, e.y - y) < r) o.push(e); return o; } // combat sim counts allied units in the fight (sharpy/Ares: simulate with every friendly unit in range)
function peaceEnd76() { return G.opts.peace == null ? 180 : G.opts.peace; }
function defCap76(P, S, dv, av) { // 0 = ok, 1 = capped (only the 2 basic turrets per entrance), 2 = build nothing now
  const pe = peaceEnd76(); if (!peaceOver(P) && G.time < pe - 75) return dv >= 600 ? 2 : 0; // peace: nobody can hit me before the timer, money goes to production + army (SC2: no static D without a threat)
  const thr = Math.max(S.compTot || 0, S.eArmy || 0), cap = 1500 + thr * 0.5 + av * 0.2 + (S.underAttack ? 2500 : 0) + (FORT71[P.fac] ? 2000 : 0);
  return dv > cap ? 1 : 0; }
function popInf76(P, S, cnt) { // true -> skip the barracks this step
  if (popOf(P.team) <= 45 || !producers(P.team, 'veh')) return false; const sp = FACTIONS[P.fac] && FACTIONS[P.fac].sp; if (sp === 'marine' || sp === 'kommando') return false;
  if (S.eAir > 1200 && (cnt.rocketeer || 0) < 8) return false; return (cnt.rifle || 0) + (cnt.rocketeer || 0) + (cnt.scout || 0) >= 10; }
const cl76On = P => !!G.r76 && !!G.nt && isV76(P) && !SIOFF.cl76 && !P.ntOff;
function clear76(P, q, R) { // v7.6.5 (replay flag nt): nudge a gather / staging point onto open ground (no building within R tiles) so a whole army never jams between buildings or behind a turret line
  if (!q || !cl76On(P)) return q; const g = getBlock(), x0 = Math.floor(q.x), y0 = Math.floor(q.y); R = R || 3;
  let hq = null, tmax = 0; if (!SIOFF.cl76b) for (const e of G.ents) if (e.team === P.team && e.hp > 0) { if (e.t === 'hq' && !hq) hq = e; } // v7.6.5b: never move a point further from the HQ than it was, nor past my outermost defence
  if (hq) for (const e of G.ents) if (e.team === P.team && e.hp > 0 && e.kind === 'b' && BT[e.t] && BT[e.t].cat === 'def' && e.t !== 'wall' && e.t !== 'gate') tmax = Math.max(tmax, dhypot(e.x - hq.x, e.y - hq.y));
  const lim = hq ? Math.min(dhypot(q.x - hq.x, q.y - hq.y), tmax > 0 ? tmax : 1e9) + 0.01 : 1e9;
  for (let r = 0; r <= 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x0 + dx, ny = y0 + dy; if (!inb(nx, ny) || g[idx(nx, ny)]) continue; if (r && hq && dhypot(nx + 0.5 - hq.x, ny + 0.5 - hq.y) > lim) continue;
    let ok = true; for (let yy = -R; yy <= R && ok; yy++) for (let xx = -R; xx <= R; xx++) { const ax = nx + xx, ay = ny + yy; if (inb(ax, ay) && g[idx(ax, ay)] >= 2) { ok = false; break; } }
    if (ok) return { x: nx + 0.5, y: ny + 0.5 }; }
  return q; }
const sf2On = P => !!G.r76 && !!G.nt && isV76(P) && !SIOFF.sf2 && !P.ntOff; // v7.6.5b safe76: threat = enemy army that could reach my HQ within T s (straight-line / speed), 6 min cap, never caps harvesters or blocks the first expansion
function eta76(foes, hq, T) { let v = 0; if (!hq) return 0; for (const f of foes) { if (f.kind !== 'u' || f.t === 'harv') continue; const d = UT[f.t]; if (!d || !d.wpn || d.engineer || !d.sp) continue; if (dhypot(f.x - hq.x, f.y - hq.y) / d.sp < T) v += d.cost || 0; } return v; }
const er76On = P => !!G.r76 && !!G.nt && isV76(P) && !SIOFF.er76 && !P.ntOff;
function home76(P, S, q) { if (!cl76On(P)) return q; const k = (G.bver || 0) + ':' + q.x.toFixed(1) + ':' + q.y.toFixed(1); S.hm76 = S.hm76 || {}; // cached per building layout
  if (!S.hm76[k]) { if (Object.keys(S.hm76).length > 8) S.hm76 = {}; S.hm76[k] = clear76(P, q); } return S.hm76[k]; }
function stage76(p, P) { // one shared staging point ~28 tiles short of the target on the team's side: armies gather out of the defender's reach, then hit together (SC2 bots: regroup before engaging)
  const al = G.players.filter(Q => Q.ally === P.ally && !Q.out); if (al.filter(Q => Q.ai).length < 2) return null; let x = 0, y = 0; for (const Q of al) { const s = G.starts[Q.start]; x += s[0]; y += s[1]; } x /= al.length; y /= al.length;
  const d = dhypot(x - p.x, y - p.y); if (d < 34) return null; const k = Math.min(0.85, 28 / d), n = Object.keys(p.m).length, o = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 3;
  const ax = p.x + (x - p.x) * k, ay = p.y + (y - p.y) * k, nx = -(y - p.y) / d, ny = (x - p.x) / d;
  const f = nearFree(Math.floor(Math.max(3, Math.min(MW - 3, ax + nx * o))), Math.floor(Math.max(3, Math.min(MH - 3, ay + ny * o))), 6); return f ? { x: f[0] + 0.5, y: f[1] + 0.5 } : null; }
function teamHome76(P, c) { // joint defence: the other bots' idle home armies that answer the same call (each ally runs the same check, so they move together)
  const o = []; for (const Q of G.players) { if (Q.team === P.team || Q.ally !== P.ally || Q.out || !Q.ai || !isV76(Q) || !Q.aiS) continue; const g = new Set((Q.aiS.grp || []).map(u => u.id)); const st = G.starts[Q.start];
    for (const e of G.ents) if (e.kind === 'u' && e.team === Q.team && e.hp > 0 && UT[e.t].wpn && e.t !== 'harv' && !UT[e.t].jet && !g.has(e.id) && dhypot(e.x - st[0], e.y - st[1]) < 22 && dhypot(e.x - c.x, e.y - c.y) < 45) o.push(e); }
  return o; }
function pg76(P, V6) { return V6 && !SIOFF.pg76 && !G.end && peaceEnd76() >= 300 && G.time > 60 && G.time < peaceEnd76() - 90; } // v7.6.1 macro: a long peace is safe time -> extra refineries on the main before the expansion (SC2 bots go greedy when no attack can come)
// ===================== v7.6.6 phase-1 math layer (replay flag m7; lobby Hard = si2 only) =====================
// a) Lanchester launch gate   b) distance-field movement + target hysteresis   c) knapsack spend sink   d) expected-value silo use
const m7On = (P, k) => !!G.r76 && !!G.nt && !!G.m7 && isV76(P) && !SIOFF.m7 && !P.m7Off && !(k && SIOFF['m7' + k]) && (k !== 'e' && k !== 'f' || G.m7 >= 2) && (k !== 'g' || G.m7 >= 3) && !(k && P.m7Skip && P.m7Skip.includes(k)); // e, f: replay level 2 (v7.6.7); g: level 3 (v7.6.8); P.m7Skip = test-only per-bot part switch
// --- b) distance field (Dijkstra, integer costs 10/14, deterministic heap tie-break on tile index) ---
function heap7() { const k = [], v = []; return { n: () => k.length,
  push(key, val) { let i = k.length; k.push(key); v.push(val); while (i) { const p = (i - 1) >> 1; if (k[p] < key || (k[p] === key && v[p] <= val)) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; },
  pop() { const rk = k[0], rv = v[0], lk = k.pop(), lv = v.pop(); if (k.length) { let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i, mk = lk, mv = lv; if (l < k.length && (k[l] < mk || (k[l] === mk && v[l] < mv))) { m = l; mk = k[l]; mv = v[l]; } if (r < k.length && (k[r] < mk || (k[r] === mk && v[r] < mv))) { m = r; mk = k[r]; mv = v[r]; } if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; } k[i] = lk; v[i] = lv; } return [rk, rv]; } }; }
function field7(P, S, tb) { // cost-to-target over the map; enemy walls/gates are breachable (high cost), everything else built is solid
  const key = (tb.id || 0) + ':' + Math.floor(tb.x) + ',' + Math.floor(tb.y), f = S.f7;
  if (f && f.key === key && (f.bv === G.bver || G.time - f.t < 6)) return f;
  const g = getBlock(), N = MW * MH, D = new Int32Array(N).fill(1 << 30), own = new Int16Array(N).fill(-1), wl = new Uint8Array(N);
  for (const e of G.ents) if (e.kind === 'b') for (let y = e.ty; y < e.ty + e.h; y++) for (let x = e.tx; x < e.tx + e.w; x++) { const i = idx(x, y); own[i] = e.team; if ((e.t === 'wall' || e.t === 'gate') && foe(e.team, P.team)) wl[i] = 1; }
  const H = heap7(), tx = Math.floor(tb.x), ty = Math.floor(tb.y), bw = tb.w || (BT[tb.t] || {}).w || 1, bh = tb.h || (BT[tb.t] || {}).h || 1, x0 = tb.tx != null ? tb.tx : tx - (bw >> 1), y0 = tb.ty != null ? tb.ty : ty - (bh >> 1);
  for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) if (inb(x, y)) { const i = idx(x, y); D[i] = 0; H.push(0, i); }
  if (!H.n() && inb(tx, ty)) { D[idx(tx, ty)] = 0; H.push(0, idx(tx, ty)); }
  const pass = i => g[i] === 0 ? 0 : g[i] === 1 ? -1 : wl[i] ? 140 : g[i] === 3 && own[i] >= 0 && !foe(own[i], P.team) ? 0 : -1;
  let pops = 0;
  while (H.n() && pops < 30000) { const [d, i] = H.pop(); pops++; if (d > D[i]) continue; const x = i % MW, y = (i / MW) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny), pj = pass(j); if (pj < 0) continue;
      if (dx && dy && (pass(idx(x + dx, y)) !== 0 || pass(idx(x, y + dy)) !== 0)) continue; // no corner cutting
      const nd = d + (dx && dy ? 14 : 10) + pj; if (nd < D[j]) { D[j] = nd; H.push(nd, j); } } }
  return (S.f7 = { key, bv: G.bver, t: G.time, D, wl }); }
function step7(P, S, f, c, grp, n) { // walk n tiles down the field from the pack (centroid snapped to the nearest reached tile)
  const D = f.D; let si = -1, bd = 1e18;
  const tryT = (x, y) => { if (!inb(x, y)) return; const i = idx(x, y); if (D[i] < bd && D[i] < (1 << 30)) { bd = D[i]; si = i; } };
  for (let r = 0; r <= 3 && si < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) tryT(Math.floor(c.x) + dx, Math.floor(c.y) + dy);
  if (si < 0) for (const u of grp) tryT(Math.floor(u.x), Math.floor(u.y)); // centroid sits in rock -> best member tile
  if (si < 0) return null;
  let i = si, wall = -1;
  for (let s = 0; s < n && D[i] > 0; s++) { const x = i % MW, y = (i / MW) | 0; let bj = -1, bv = D[i];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (D[j] < bv) { bv = D[j]; bj = j; } }
    if (bj < 0) break; if (f.wl[bj]) { wall = bj; break; } i = bj; }
  let wb = null; if (wall >= 0) { const wx = wall % MW, wy = (wall / MW) | 0; wb = G.ents.find(e => e.kind === 'b' && e.hp > 0 && wx >= e.tx && wx < e.tx + e.w && wy >= e.ty && wy < e.ty + e.h) || null; }
  return { x: (i % MW) + 0.5, y: ((i / MW) | 0) + 0.5, d: D[i] / 10, d0: D[si] / 10, wall: wb }; }
function tgt7(P, S, c, tgts) { // target hysteresis: keep the current objective ~20 s unless it dies / turns unreachable / something far better shows up
  const cur = S.tg7 && tgts.find(b => b.id === S.tg7.id);
  if (cur && (byId(cur.id) || cur).hp > 0 && !S.tg7.bad && G.time < S.tg7.until) return cur;
  const t = tgts.find(b => !(S.bad7 && S.bad7[b.id] > G.time)) || null;
  if (t) S.tg7 = { id: t.id, until: G.time + 20 }; return t; }
function move7(P, S, c, t, near) { // returns true if it issued (or deliberately held) the step order
  if (!t || t.kind !== 'b' && !(BT[t.t])) return false; const f = field7(P, S, t), st = step7(P, S, f, c, S.grp, 8);
  if (!st) { if (S.tg7 && S.tg7.id === t.id) { S.bad7 = S.bad7 || {}; S.bad7[t.id] = G.time + 45; S.tg7 = null; } return false; } // unreachable from here: drop it for 45 s
  if (near.length) return true;
  const free = S.grp.filter(u => u.order !== 'attack');
  if (st.wall && G.time > (S.breachT || 0)) { S.breachT = G.time + 3; orderAttack(S.grp.filter(u => !u.tgt || u.tgt.kind !== 'u'), st.wall); return true; }
  if (st.d0 > 4) oM71(P, S, free, st.x, st.y, true); else oM71(P, S, free, t.x, t.y, true);
  return true; }
// --- a) Lanchester launch: square law on the counter-aware dps table; survivors = sqrt(1 - 1/r) ---
function lan7(P, S, idle, tgtTeam, knownB, tb, teamAv, av, maxed) {
  const theirs = [];
  for (const [, m] of S.mem || []) if (m.team === tgtTeam) { const u = UT[m.t === 'raijinJ' ? 'raijin' : m.t]; if (u && (u.wpn || u.kami)) theirs.push({ kind: 'u', t: m.t === 'raijinJ' ? 'raijin' : m.t, hp: u.hp * (G.time - m.ts < 75 ? 1 : 0.6) }); }
  if (tb) for (const b of knownB) if (b.team === tgtTeam && BT[b.t] && BT[b.t].wpn && !b.offline && dhypot(b.x - tb.x, b.y - tb.y) < 22) theirs.push({ kind: 'b', t: b.t, hp: (byId(b.id) || b).hp || BT[b.t].hp });
  let mv = 0; for (const e of theirs) if (e.kind === 'u') mv += UT[e.t].cost; // unseen prior: what they could have built that we never saw
  const prior = G.opts.fog === false ? 0 : Math.max(0, Math.min(14000, (G.time - 150) * 22) - mv);
  for (let k = Math.floor(prior / UT.heavy.cost); k > 0; k--) theirs.push({ kind: 'u', t: 'heavy', hp: UT.heavy.hp });
  let r = sim71(idle, theirs); if (r >= 9) r = 9;
  const sc = Math.min(2, teamAv / Math.max(1, av)); r *= sc * sc; // allied armies join the fight (square law: strength ~ N^2)
  if (maxed) r *= 1 + Math.min(0.5, P.cr / 60000); // a banked max-pop army re-buys its losses at once
  S.lan7 = Math.round(r * 100) / 100; return r; }
// --- c) spend sink: 0/1 knapsack over what the bank can buy that still adds strength ---
function spend7(P, S, cnt, me, hq) {
  if (G.time < (S.sp7T || 0)) return; S.sp7T = G.time + 4;
  const maxed = popOf(P.team) >= POP_CAP - 8, bank = P.cr - 2500; if (bank < 4000 && !(maxed && P.cr > 2500)) return;
  const items = [], yards = me.filter(e => (e.t === 'hq' || e.t === 'cc') && e.hp > 0 && !e.con).length;
  if (maxed && (cnt.silo || 0) < Math.min(3, 1 + yards) && P.gas > BT.silo.gas + 600 && avail(P.team, 'silo') && !P.queues.bld.length && !P.ready.bld) items.push({ k: 'silo', c: BT.silo.cost, v: 9 });
  const lab = me.find(b => b.t === 'tech' && b.upT == null && b.sell < 0 && b.hp > 0 && !b.con && G.time - b.born > 2);
  if (lab && maxed) for (const c of RES.cats) { const ri = researchInfo(P.team, c); if (ri && !ri.busy && !ri.lock && P.gas >= ri.gas + 300) { items.push({ k: 'rs', c: ri.cost, v: 6, cat: c }); break; } }
  const rich = maxed && m7On(P, 'g') ? Math.max(0, Math.min(10, Math.floor((P.cr - 12000) / 4000))) : 0; // m7g (v7.6.8): maxed out and still banking -> turn the float into more towers and production
  if (rich >= 2) { const prod = (cnt.factory || 0) + (cnt.barracks || 0); if (prod < 4 + 2 * yards && !P.queues.bld.length && !P.ready.bld) { const t = (cnt.factory || 0) <= (cnt.barracks || 0) ? 'factory' : 'barracks'; if (avail(P.team, t) && aiSpot(P, t, hq, [])) items.push({ k: 'bld', t, c: BT[t].cost, v: 5 }); } }
  const dcap = (maxed ? 10 : 6) + (maxed ? 6 : 4) * yards + rich * 2, dn = me.filter(e => e.kind === 'b' && BT[e.t].wpn).length;
  if (dn < dcap && !P.queues.def.length && !P.ready.def) for (const t of ['tesla', 'gcannon', 'gatling', 'aagun', 'turret']) if (avail(P.team, t)) { items.push({ k: 'def', t, c: BT[t].cost, v: 4 }); break; }
  if (!items.length) return;
  const U = 500, W = Math.floor(Math.max(0, P.cr - 2500) / U), n = items.length, w = items.map(i => Math.ceil(i.c / U)); // DP over bank in 500-credit units
  const best = Array.from({ length: n + 1 }, () => new Int32Array(W + 1));
  for (let i = 1; i <= n; i++) for (let x = 0; x <= W; x++) { best[i][x] = best[i - 1][x]; if (w[i - 1] <= x) best[i][x] = Math.max(best[i][x], best[i - 1][x - w[i - 1]] + items[i - 1].v); }
  let x = W; const pick = []; for (let i = n; i >= 1; i--) if (best[i][x] !== best[i - 1][x]) { pick.push(items[i - 1]); x -= w[i - 1]; }
  for (const it of pick) { if (it.k === 'rs') researchB(lab, it.cat);
    else if (it.k === 'def' || it.k === 'bld') enqueue(P.team, it.t); else if (it.k === 'silo' && aiSpot(P, 'silo', hq, [])) enqueue(P.team, 'silo'); } }
// --- d) missile choice by expected value: (value it can reach) / (credits + 2x gas); nothing in range -> do not build it
function mis7(P, S, s, knownB, wait, intruders) {
  let bk = null, be = 0;
  for (const k of ['heavy', 'cluster', 'small']) { const m = MIS[k]; if (P.gas < m.gas + (k === 'heavy' ? 0 : 100) || P.cr < m.cost + 300) continue; let v = 0;
    for (const b of knownB) if (dhypot(b.x - s.x, b.y - s.y) <= m.rng && BT[b.t]) v = Math.max(v, BT[b.t].cost * (b.t === 'cc' || b.t === 'hq' || b.t === 'silo' || b.t === 'factory' ? 1.5 : 1));
    for (const f of S.vis76 || []) if (dhypot(f.x - s.x, f.y - s.y) <= m.rng) v = Math.max(v, mass76(P, f, m.r + (m.spread || 0) * 0.6) * (intruders.includes(f) ? 1.6 : 1));
    if (!v) continue; const e = Math.min(v, m.dmg * (m.sub || 1)) / (m.cost + m.gas * 2) * (k === 'heavy' ? 1.2 : 1);
    if (k !== 'heavy' && !(S.underAttack && k === 'small') && wait < (k === 'cluster' ? 100 : 160)) continue; // keep saving for a Titan unless it has waited
    if (e > be) { be = e; bk = k; } }
  return bk; }

// --- e) refinery placement (m7e): harvesters dock on the refinery's south side (sim.js harvest 'ret'), so score a spot by the
// mean distance from its dock to the 12 nearest rich ore tiles, plus a small pull toward the planned spot (keeps it inside the base)
function ref7Tiles(ax, ay) { const out = [], x0 = Math.max(0, Math.floor(ax - 16)), x1 = Math.min(MW - 1, Math.ceil(ax + 16)), y0 = Math.max(0, Math.floor(ay - 16)), y1 = Math.min(MH - 1, Math.ceil(ay + 16));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (G.ore[y * MW + x] > 200) out.push([x + 0.5, y + 0.5, dhypot(x + 0.5 - ax, y + 0.5 - ay)]);
  out.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]); return out.slice(0, 40); }
function ref7Score(T, x, y, d, dd) { const dx = x + d.w / 2, dy = y + d.h + 0.5, ds = T.map(o => dhypot(o[0] - dx, o[1] - dy)).sort((a, b) => a - b); let s = 0; const k = Math.min(12, ds.length); for (let i = 0; i < k; i++) s += ds[i];
  return s / k + dd * 0.35; }
