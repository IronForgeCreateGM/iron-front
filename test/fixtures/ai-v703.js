// v7.0.3 AI (git 5f1a850 js/ai.js + DIFF table) with every top-level name prefixed O_ — the frozen baseline the v7.1 Chief SI is benchmarked against (test/ai71-test.js, test/vs-old.js). Not loaded by the game.
const O_DIFF = {
  easy:   { sys: { sim: 0, hsq: 0, prong: 0, float: 0, prodMax: 1, choke: 0, close: 1 },  sat: 0.6, slip: 0.3, expandAt: 1000, think: 3.0, wave0: 3, waveMax: 7, waveInc: 1, harass: 0.15, harassAfter: 1080, firstAttack: 570, waveGap: 150, scoutAfter: 600 },
  normal: { sys: { sim: 0, hsq: 0, prong: 0, float: 6000, prodMax: 1.5, choke: 0, close: 1 },  sat: 0.8, slip: 0.12, expandAt: 480, think: 1.6, wave0: 9, waveMax: 16, waveInc: 2, harass: 0.3, harassAfter: 0, firstAttack: 0, waveGap: 75, scoutAfter: 20 },
  chief:  { sys: { sim: 1, hsq: 1, prong: 0, float: 1800, prodMax: 4.5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 330, think: 0.45, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 45, scoutAfter: 15, chief: 1 },
  si:     { sys: { sim: 1, hsq: 1, prong: 1, float: 1400, prodMax: 5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 210, think: 0.25, wave0: 10, waveMax: 30, waveInc: 3, harass: 0.4, harassAfter: 240, firstAttack: 0, waveGap: 40, scoutAfter: 10, chief: 1, si: 1 },
  hard:   { sys: { sim: 1, hsq: 1, prong: 0, float: 4000, prodMax: 2.5, choke: 1, close: 1 },  sat: 1, slip: 0, expandAt: 300, think: 0.8, wave0: 7, waveMax: 20, waveInc: 2, harass: 0.5, harassAfter: 0, firstAttack: 0, waveGap: 30, scoutAfter: 20 },
  // scripted human-style sparring partners (tests only; ignore the peace window like a human would)
  h_strong: { human: 1, doc: 1, sys: { sim: 1, hsq: 1, prong: 1, float: 1400, prodMax: 5, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 240, think: 0.35, wave0: 9, waveMax: 30, waveInc: 3, harass: 0.5, harassAfter: 200, firstAttack: 0, waveGap: 35, scoutAfter: 10, chief: 1 }, // v5.3 sparring: a strong, macro-heavy human (fast expand, many factories, defended entrances, no SI tricks)
  h_rush:   { human: 1, order: ['power', 'barracks', 'refinery', 'barracks', 'power', 'factory', 'power', 'refinery', 'power', 'factory', 'turret', 'power', 'tech', 'power'], sys: { sim: 1, hsq: 1, prong: 0, float: 1500, prodMax: 4, choke: 1, close: 1 }, sat: 0.9, slip: 0, expandAt: 9999, think: 0.5, wave0: 6, waveMax: 30, waveInc: 2, harass: 0.6, harassAfter: 0, firstAttack: 0, waveGap: 20, scoutAfter: 10 },
  h_turtle: { human: 1, defCr: 400, order: ['power', 'barracks', 'refinery', 'turret', 'power', 'turret', 'factory', 'turret', 'refinery', 'power', 'aagun', 'turret', 'power', 'tech', 'turret', 'aagun', 'power', 'turret', 'gcannon', 'power', 'turret', 'aagun', 'refinery', 'power', 'turret', 'turret', 'power', 'aagun'], sys: { sim: 1, hsq: 0, prong: 0, float: 3000, prodMax: 4, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 600, think: 0.6, wave0: 30, waveMax: 40, waveInc: 2, harass: 0, harassAfter: 9999, firstAttack: 900, waveGap: 120, scoutAfter: 60, chief: 1 },
  h_tower:  { human: 1, defCr: 300, order: ['power', 'barracks', 'turret', 'refinery', 'turret', 'power', 'turret', 'factory', 'aagun', 'power', 'turret', 'refinery', 'turret', 'power', 'aagun', 'turret', 'tech', 'power', 'power', 'tesla', 'turret', 'power', 'aagun', 'tesla', 'power'], sys: { sim: 1, hsq: 1, prong: 0, float: 2500, prodMax: 3, choke: 1, close: 1 }, sat: 1, slip: 0, expandAt: 480, think: 0.6, wave0: 14, waveMax: 30, waveInc: 3, harass: 0.3, harassAfter: 300, firstAttack: 540, waveGap: 60, scoutAfter: 30, chief: 1 },
};
// ===== AI opponent =====
// Each think: power check, build order (rebuilds losses), placement, harvesters,
// counter-composition army, base defense, waves, harass, scouting.
const O_AI_ORDER = ['power', 'barracks', 'refinery', 'power', 'factory', 'extractor', 'turret', 'refinery', 'power', 'tech', 'aagun', 'power', 'turret', 'airfield', 'power', 'turret', 'aagun', 'refinery', 'power'];
const O_AI_ORDER_CHIEF = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'power', 'turret', 'refinery', 'tech', 'power', 'aagun', 'turret', 'power', 'airfield', 'power', 'turret', 'extractor', 'gcannon', 'aagun', 'power', 'refinery', 'power'];
const O_facDef = (P, b) => b === 'tesla' && P.fac === 'fra' ? 'gatling' : b; // v5.9 France builds the Gatling Bastion where others build Teslas
const O_AI_ORDER_SI = ['power', 'barracks', 'refinery', 'power', 'extractor', 'factory', 'refinery', 'turret', 'power', 'tech', 'refinery', 'aagun', 'power', 'power', 'tesla', 'airfield', 'turret', 'power', 'extractor', 'gcannon', 'aagun', 'power', 'power'];
const O_AI_ORDER_AIR = O_AI_ORDER.concat(['power', 'airfield', 'extractor', 'power', 'gcannon', 'power']);
function O_aiInit(P) { P.aiS = { next: 0, wave: O_DIFF[P.diff].wave0, scoutT: O_DIFF[P.diff].scoutAfter, lastAttack: 0, attackers: new Set(), known: new Map(), sellT: 0 }; }
// v5.0 peace window: no attacks on bases before G.opts.peace seconds (default 180; lobby Off/3/5/8 min)
function O_peaceOver(P) { if (G.end) return false; /* v7.0 Endless: defender bots never march out (the Horde has no base) */ if (P && O_DIFF[P.diff].human) return true; const t0 = (G.opts.peace == null ? 180 : G.opts.peace) + ((P && P.stagger) || 0); if (G.time < t0) return false;
  // v6.0 Hellgate warlords wake up one at a time, then raid in 3.5-min-on / 1.5-min-off cycles (offset per warlord) until the endgame
  if (P && P.stagger != null && G.time < O_END_T) return (G.time - t0) % 300 < 210; return true; }
function O_aiStep(P) {
  if (!P.ai) return; // bot logic never touches a human player's units
  const S = P.aiS, D = O_DIFF[P.diff], doc = (!D.order || D.doc) && !O_SIOFF.doc;
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
  const cnt = {}; for (const e of me) cnt[e.t] = (cnt[e.t] || 0) + 1;
  // queued items count too
  for (const c in P.queues) for (const it of P.queues[c]) cnt[it.t] = (cnt[it.t] || 0) + 1;
  for (const c in P.ready) if (P.ready[c]) cnt[P.ready[c]] = (cnt[P.ready[c]] || 0) + 1;
  // 1) place ready buildings
  for (const cat of ['bld', 'def']) if (P.ready[cat]) { const rt = P.ready[cat], spot = O_aiSpot(P, rt, hq, foes); if (spot) placeReady(P.team, cat, spot[0], spot[1]); else { cancel(P.team, rt); S.bad[rt] = G.time + 60; } }
  // 2) structures: power emergency, then order list (rebuild handled by counting)
  if (!P.queues.bld.length && !P.ready.bld) {
    let want = null;
    if (P.pow < (doc && G.time > 400 ? 60 : 20) && (cnt.power || 0) < (doc ? 30 : 10)) want = 'power';
    else if (G.time > D.expandAt * (1 + 0.7 * (cnt.cc || 0)) && (cnt.cc || 0) < 4 && (cnt.factory || 0) > 0 && avail(P.team, 'cc') && (S.bad.cc || 0) < G.time && O_aiSpot(P, 'cc', hq, foes)) want = 'cc';
    else if ((cnt.cc || 0) > 0 && (cnt.refinery || 0) < 2 + (cnt.cc || 0) && (S.bad.refinery || 0) < G.time) want = 'refinery';
    else { const need = {}; for (const b of (D.order || (D.si ? O_AI_ORDER_SI : D.chief ? O_AI_ORDER_CHIEF : D.firstAttack || P.diff === 'normal' ? O_AI_ORDER : O_AI_ORDER_AIR))) { if (BT[b].cat !== 'bld') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!O_aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } want = b; break; } } }
    if (doc && (!want || (P.cr > 2600 && want !== 'power'))) want = O_prodTarget(P, S, D, cnt, hq, foes) || want;
    if (!want) want = O_aiGrowth(P, S, D, cnt, hq, foes);
    S.saving = want && avail(P.team, want) && P.cr <= BT[want].cost * 0.3 && ['refinery', 'cc', 'factory', 'power', 'extractor', 'barracks'].includes(want) ? want : null;
    if (want && avail(P.team, want) && P.cr > BT[want].cost * 0.3) enqueue(P.team, want);
  }
  { const nd = me.filter(e => e.kind === 'b' && BT[e.t].cat === 'def' && e.t !== 'wall' && e.t !== 'gate' && e.t !== 'gtower').length, nw = (cnt.wall || 0) + (cnt.gate || 0) + (cnt.gtower || 0);
    S.defFull = nd >= 14 + 4 * (cnt.cc || 0) || (G.time > O_END_T && nd >= 8); S.wallFull = nw >= 36 || G.time > O_END_T; // v5.6: towers must not starve the army
    if (S.defFull && !S.underAttack) for (const it of P.queues.def.slice()) if (it.t !== 'wall' && it.prog < 0.3) cancel(P.team, it.t); }
  if (doc && !(S.defFull && !S.underAttack)) O_defenseMgr(P, S, D, me, cnt, hq);
  else if (!P.queues.def.length && !P.ready.def && (cnt.factory || 0) > 0) {
    const need = {}; for (const b0 of (D.order || (D.si ? O_AI_ORDER_SI : D.chief ? O_AI_ORDER_CHIEF : O_AI_ORDER))) { const b = O_facDef(P, b0); if (BT[b].cat !== 'def') continue; need[b] = (need[b] || 0) + 1; if ((cnt[b] || 0) < need[b] && avail(P.team, b) && (S.bad[b] || 0) < G.time) { if (!O_aiSpot(P, b, hq, foes)) { S.bad[b] = G.time + 45; continue; } if (P.cr > (D.defCr || 1200)) enqueue(P.team, b); break; } }
  }
  // 2b) ally pings
  O_aiPing(P, S, me);
  O_facAI(P, S, D, me, cnt, hq, foes);
  // 3) harvesters
  const refs = cnt.refinery || 0, harvs = cnt.harv || 0;
  const threat = D.chief && G.time < 240 ? O_armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)) > O_armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn)) * 1.3 : false;
  const wantH = threat ? Math.min(2, refs * 2) : Math.min((D.chief ? 8 : 6) + (cnt.cc || 0) * 3, (refs ? refs * 2 + (D.si && !O_SIOFF.harv ? me.filter(e => e.t === 'refinery').length : 0) : 2)); const wantHs = Math.min(FIELD_CAP * Math.max(1, refs + (cnt.cc || 0)), Math.max(2, Math.round(wantH * 1.5 * (D.sat || 1)))); // v6.2: haulers carry 40% less but cost ~half -> ~1.5x as many, max 4 per field
  if (harvs < wantHs && avail(P.team, 'harv') && !P.queues.veh.some(q => q.t === 'harv')) { if (P.queues.veh.length >= 2) cancel(P.team, P.queues.veh[P.queues.veh.length - 1].t); enqueue(P.team, 'harv'); }
  // money stall breaker: no harvesters and broke -> sell non-essential structures
  const realH = me.filter(e => e.t === 'harv').length;
  if (realH === 0 && P.cr < UT.harv.cost && G.time > S.sellT) {
    const sac = ['airfield', 'tech', 'aagun', 'turret', 'wall'].map(t => myBld().find(b => b.t === t)).find(Boolean) || (cnt.barracks > 1 && myBld().find(b => b.t === 'barracks'));
    if (sac) { sellB(sac); S.sellT = G.time + 15; }
  }
  // v5.6: no construction yard left -> power can't be rebuilt; sell dark power consumers (defenses first) until the grid is positive
  if (P.pow < 0 && !me.some(e => (e.t === 'hq' || e.t === 'cc') && e.hp > 0) && G.time > (S.shedT || 0)) { const dr = myBld().filter(b => BT[b.t].pow < 0 && b.t !== 'factory' && b.t !== 'barracks').sort((a, b) => (BT[a.t].cat === 'def' ? 0 : 1) - (BT[b.t].cat === 'def' ? 0 : 1) || BT[a.t].pow - BT[b.t].pow)[0]; if (dr) { sellB(dr); S.shedT = G.time + 2; } }
  // v5.4 power watchdog: never sit dark — rebuild/expand power before any other spend
  if ((P.pow < (G.time > 300 ? 60 : 40) || me.some(e => e.offline)) && avail(P.team, 'power') && (cnt.power || 0) < 60) {
    if (P.queues.bld.length && P.queues.bld[0].t !== 'power' && P.pow < 0) cancel(P.team, P.queues.bld[0].t); // power before anything else
    if (!P.queues.bld.length && !P.ready.bld && P.cr > BT.power.cost * 0.25) enqueue(P.team, 'power');
    if ((S.bad.power || 0) > G.time && G.time > (S.clearT || 0)) { const jb = myBld().filter(b => b.t === 'wall' || b.t === 'turret' || b.t === 'aagun' || b.t === 'gate').sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - dhypot(b.x - hq.x, b.y - hq.y))[0]; if (jb) { sellB(jb); S.clearT = G.time + 6; S.bad.power = 0; } }
    if (P.pow < 0) return; // stay focused on power while blacked out
  }
  if (realH < 2 && P.cr < UT.harv.cost + 200 && P.pow >= 0) return; // save for harvesters
  if (!me.some(e => e.t === 'refinery' || e.t === 'cc') && P.cr < 1500 && G.time < 240) return; // never starve the first refinery
  if (S.saving && !O_intrudersEarly(P, foes, me) && G.time - (S.saveT0 || (S.saveT0 = G.time)) < 25 && P.pow >= 20 && !(cnt.factory >= 1 && P.cr > 800 && G.time > 300)) return; // save up, but never starve army after the first factory
  if (!S.saving) S.saveT0 = 0;
  // 4) army composition: counter what enemy fields
  const ft = { inf: 0, armor: 0, air: 0 };
  for (const f of foes) if (f.kind === 'u' && f.t !== 'harv') { const a = UT[f.t].armor; if (a === 'inf') ft.inf++; else if (a === 'air') ft.air++; else ft.armor++; }
  const pick = (list) => { const ok = list.filter(([t]) => avail(P.team, t)); let tot = 0; ok.forEach(o => tot += o[1]); let r = G.R() * tot; for (const o of ok) { r -= o[1]; if (r <= 0) return o[0]; } return ok.length ? ok[0][0] : null; };
  if (P.cr > 300) {
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
  O_aiV62(P, S, cnt, myB);
  const intruders = foes.filter(f => f.kind === 'u' && allyB.some(b => dhypot(b.x - f.x, b.y - f.y) < 10));
  S.underAttack = intruders.length > 0 || G.time - (S.uaT || -99) < 60; if (intruders.length) S.uaT = G.time;
  G.danger = G.danger || {}; G.danger[P.team] = intruders.map(f => ({ x: f.x, y: f.y }));
  const home = army.filter(u => !S.attackers.has(u.id));
  if (intruders.length) {
    const mine = intruders.filter(f => myB.some(b => dhypot(b.x - f.x, b.y - f.y) < 12)), c = mine[0] || intruders[0];
    let defenders = home.filter(u => u.order !== 'attack' && dhypot(u.x - c.x, u.y - c.y) < 25);
    if (!mine.length && G.time > (S.helpT || 0) && O_armyVal(intruders) > 500 && O_armyVal(home) > 1500) { S.helpT = G.time + 30; defenders = home.filter(u => u.t !== 'harv' && !UT[u.t].jet).slice(0, Math.ceil(home.length * 0.55)); defenders.forEach(u => S.attackers.add(u.id)); G.events.push({ e: 'allyAck', team: P.team, x: c.x, y: c.y }); }
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
  if (D.harass && G.time > D.harassAfter && O_peaceOver(P) && G.R() < D.harass * 0.15) {
    const fh = foes.find(f => f.t === 'harv');
    const raiders = home.filter(u => u.t === 'scout' || u.t === 'gunship').slice(0, 4);
    if (fh && raiders.length >= 2) { orderAttack(raiders, fh); raiders.forEach(u => S.attackers.add(u.id)); if (S.firstAttackT == null) S.firstAttackT = G.time; }
  }
  // 7b) air strikes: jets/bombers hit eco & production when armed
  const strikers = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth') && u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo);
  if (!doc && strikers.length && knownB.length && G.time > D.harassAfter && O_peaceOver(P) && G.R() < 0.4) { const pri = S.towerHeavy ? ['power', 'refinery', 'factory', 'airfield', 'tech', 'barracks'] : ['refinery', 'power', 'factory', 'airfield', 'tech', 'barracks'], tg = knownB.slice().sort((a, b) => (pri.indexOf(a.t) + 1 || 9) - (pri.indexOf(b.t) + 1 || 9))[0]; if (tg) orderAttack(strikers, tg); }
  if (doc) { O_airRaidMgr(P, S, D, me, foes, knownB, hq); O_warheadMgr(P, S, D, me, foes, knownB); }
  O_macroMgr(P, S, D, cnt, me); O_harassMgr(P, S, D, me, foes, knownB, home, hq); O_dropMgr(P, S, D, me, foes, knownB, home, hq); O_medevacMgr(P, S, D, me, hq); O_derrickMgr(P, S, D, me, cnt, hq);
  S.doc = doc;
  if (D.si) O_siExtras(P, S, me, foes, knownB, hq, estart, intruders);
  if (D.chief || D.sys.sim) { if (G.time <= O_END_T) O_chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart); O_keepBusy(P, S, D, me, cnt, hq, intruders); return; }
  // 8) waves
  for (const id of [...S.attackers]) { const u = byId(id); if (!u) S.attackers.delete(id); else if (u.order === 'idle' && !u.tgt && G.R() < 0.2) S.attackers.delete(id); }
  const ready = home.filter(u => u.t !== 'harv');
  if (ready.length >= S.wave && !intruders.length && G.time >= D.firstAttack && O_peaceOver(P) && G.time - S.lastAttack > D.waveGap) {
    if (S.firstAttackT == null) S.firstAttackT = G.time;
    if (D.waveMax < 10) ready.splice(Math.min(ready.length, S.wave + 2));
    const tgts = O_aiFocus(P, knownB);
    if (!tgts.length) { const h = D.sys.close ? O_huntTarget(P, S, ready[0], estart) : { x: estart[0], y: estart[1] }; orderMove(ready, h.x, h.y, true); ready.forEach(u => S.attackers.add(u.id)); S.lastAttack = G.time; }
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
  O_keepBusy(P, S, D, me, cnt, hq, intruders);
  // 9) repair damaged buildings
  for (const b of myB) if (b.hp < b.mhp * 0.6 && P.cr > (G.time > O_END_T ? 1500 : 500)) b.repair = true; else if (G.time > O_END_T && P.cr < 800) b.repair = false;
}
function O_aiV62(P, S, cnt, myB) { // v6.2: Air Command pads, Howler siege, research (all deterministic, no bonuses)
  if (P.cr > 1400 && G.time >= (S.t62p || 0)) { S.t62p = G.time + 3; const af = myB.find(b => b.t === 'airfield' && !b.pads && b.upT == null); if (af && G.ents.filter(e => e.team === P.team && e.kind === 'u' && UT[e.t].jet).length >= 3) upgradeB(af); } // v6.2 Air Command extra pads when the jet wing outgrows 4 slots
  if (G.time >= (S.t62s || 0) && (S.t62s = G.time + 1)) for (const u of G.ents) if (u.team === P.team && u.t === 'arty' && u.hp > 0) { // v6.2 bots use Howler Siege Mode
    let near = 1e9, inR = false; for (const o of G.ents) if (o.hp > 0 && foe(o.team, P.team) && (o.kind === 'b' || !UT[o.t].air)) { const dd = dhypot(o.x - u.x, o.y - u.y); if (o.kind === 'u' && dd < near) near = dd; if (dd < SIEGE.rng - 0.3 && dd > W.arty.minRng + 0.5) inR = true; }
    if (!u.sg && inR && near > 4.5 && (!u.path.length || u.order === 'amove' || u.order === 'idle')) { if (siegeToggle(u, 1)) u.sgHold = true; }
    else if (u.sg === 2 && (near < 3.2 || !inR)) siegeToggle(u, 0); }
  S.rsSave = 0;
  if (cnt.tech && G.time > 360 && G.time >= (S.t62r || 0)) { // v6.2 bots research the track matching their army (same prices as the player; they save up for it)
    const lab = myB.find(b => b.t === 'tech' && b.upT == null && b.sell < 0 && b.hp > 0 && G.time - b.born > 2); if (lab) { const n = {}; for (const e of G.ents) if (e.team === P.team && e.hp > 0) { const c = resCat(e); if (c) n[c] = (n[c] || 0) + (e.kind === 'b' ? 1.5 : 1); }
      const best = RES.cats.map(c => [c, n[c] || 0]).filter(([c, v]) => v >= 3 && (() => { const i = researchInfo(P.team, c); return i && !i.busy && !i.lock && P.gas >= i.gas; })()).sort((a, b) => b[1] - a[1])[0];
      if (best) { const i = researchInfo(P.team, best[0]); if (P.cr >= i.cost + 150) { if (researchB(lab, best[0])) S.t62r = G.time + 60; } else if (!S.underAttack) S.rsSave = i.cost + 150; } } }
}
function O_aiSpot(P, t, hq, foes) {
  const d = BT[t];
  let ax = hq.x, ay = hq.y;
  if (t === 'cc') { const site = O_aiSite(P, hq); if (!site) return null; for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) { const x = Math.round(site.x - 1.5) + ox, y = Math.round(site.y - 1.5) + oy; if (canPlace('cc', P.team, x, y)) return [x, y]; } return null; }
  if (t === 'extractor') { const vs = (G.vents || []).slice().sort((a, b) => dhypot(a[0] - hq.x, a[1] - hq.y) - dhypot(b[0] - hq.x, b[1] - hq.y));
    for (const [vx, vy] of vs) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (canPlace(t, P.team, vx - ox, vy - oy)) return [vx - ox, vy - oy]; return null; }
  const kb = P.aiS ? [...P.aiS.known.values()] : []; const ef = kb.find(f => f.t === 'hq') || kb[0] || (st => ({ x: st[0], y: st[1] }))(G.starts[G.players[P.aiS && P.aiS.eTeam != null ? P.aiS.eTeam : (P.team ? 0 : 1)].start]);
  if (t === 'refinery') { // near closest ore
    const refs = G.ents.filter(e => e.team === P.team && (e.t === 'refinery'));
    const bases = G.ents.filter(e => e.team === P.team && (e.t === 'hq' || e.t === 'cc'));
    let b = -1, bd = 1e9, bb = hq; for (let i = 0; i < G.ore.length; i++) if (G.ore[i] > 200) { const ox = i % MW, oy = (i / MW) | 0; let nb = hq, nd = 1e9; for (const B of bases) { const q = dhypot(ox - B.x, oy - B.y); if (q < nd) { nd = q; nb = B; } } const dd = nd + (refs.some(r => dhypot(r.x - ox, r.y - oy) < 7) ? 14 : 0); if (dd < bd) { bd = dd; b = i; bb = nb; } }
    if (b >= 0) { ax = (b % MW + bb.x) / 2; ay = (((b / MW) | 0) + bb.y) / 2; }
  } else if (d.cat === 'def' && P.aiS && P.aiS.defAt && G.time - P.aiS.defAtT < 60 && t !== 'wall') { ax = P.aiS.defAt.x; ay = P.aiS.defAt.y;
  } else if (d.cat === 'def' && ef && O_DIFF[P.diff].sys.choke && t !== 'wall' && O_chokePoint(P, hq, ef) && G.R() < 0.75) { const cp = P.aiS.choke; ax = cp.x + (G.R() - 0.5) * 3; ay = cp.y + (G.R() - 0.5) * 3;
  } else if (d.cat === 'def' && ef) { const a = datan2(ef.y - hq.y, ef.x - hq.x) + (G.R() - 0.5) * 1.6; ax = hq.x + dcos(a) * 7; ay = hq.y + dsin(a) * 7; }
  const cands = [];
  for (let y = 1; y < MH - d.h; y++) for (let x = 1; x < MW - d.w; x++) { const dd = dhypot(x + d.w / 2 - ax, y + d.h / 2 - ay); if (dd < 14) cands.push([dd + G.R() * 1.5, x, y]); }
  cands.sort((a, b) => a[0] - b[0]);
  const g = getBlock();
  for (const [, x, y] of cands) {
    if (!canPlace(t, P.team, x, y)) continue;
    if (P.aiS && P.aiS.lanes && t !== 'wall' && P.aiS.lanes.some(l => dhypot(l.x - x - d.w / 2, l.y - y - d.h / 2) < 1.4 + d.w * 0.5)) continue; // keep entrance lanes open
    // keep 1-tile gap around non-defense buildings so units can flow
    if (d.cat !== 'def') { let ok = true; for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy) && g[idx(xx, yy)] === 2) { ok = false; break; } if (!ok) continue; }
    return [x, y];
  }
  if (d.cat === 'bld' && !O_aiSpot.inner) { O_aiSpot.inner = true; try { return O_aiSpotWide(P, t, hq); } finally { O_aiSpot.inner = false; } }
  return null;
}
// v5.6: crowded base -> look around every own building (expansions too) out to 22 tiles, then without the spacing rule
function O_aiSpotWide(P, t, hq) {
  const d = BT[t], g = getBlock(), anchors = G.ents.filter(e => e.team === P.team && e.kind === 'b' && e.t !== 'wall' && e.t !== 'gate' && e.hp > 0);
  for (const strict of [true, false]) { const cands = [];
    for (const a of anchors) for (let y = Math.max(1, Math.floor(a.y - 9)); y < Math.min(MH - d.h, a.y + 9); y++) for (let x = Math.max(1, Math.floor(a.x - 9)); x < Math.min(MW - d.w, a.x + 9); x++) cands.push([dhypot(x - hq.x, y - hq.y) + (a.t === 'hq' || a.t === 'cc' ? 0 : 3), x, y]);
    cands.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]); let last = -1;
    for (const [dd, x, y] of cands) { if (dd > 26) break; const k = y * MW + x; if (k === last) continue; last = k; if (!canPlace(t, P.team, x, y)) continue;
      if (P.aiS && P.aiS.lanes && P.aiS.lanes.some(l => dhypot(l.x - x - d.w / 2, l.y - y - d.h / 2) < 1.2 + d.w * 0.5)) continue;
      if (strict) { let ok = true; for (let yy = y - 1; yy <= y + d.h && ok; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) if (inb(xx, yy) && g[idx(xx, yy)] === 2) { ok = false; break; } if (!ok) continue; }
      return [x, y]; } }
  return null;
}


// ===== v4.4 layered managers (shared by all tiers; O_DIFF[*].sys enables/tunes each) =====
// combat simulator (Lanchester square-law estimate): strength = total dps * total effective hp, incl. static defenses
function O_unitDps(e) { const w = e.kind === 'u' ? (UT[e.t].wpn && W[UT[e.t].wpn]) : (BT[e.t].wpn && W[BT[e.t].wpn]); if (!w) return 0; if (e.kind === 'b' && e.offline) return 0; return w.dmg / w.cd * (e.lvl > 1 ? 1 + 0.35 * (e.lvl - 1) : 1) * (w.splash ? 1.4 : 1); }
function O_combatSim(mine, theirs) {
  let d1 = 0, h1 = 0, d2 = 0, h2 = 0; for (const u of mine) { d1 += O_unitDps(u); h1 += u.hp; } for (const f of theirs) { d2 += O_unitDps(f); h2 += f.hp; }
  if (d2 * h2 <= 0) return 9; return (d1 * h1) / (d2 * h2);
}
function O_threatsNear(P, foes, x, y, r) { return foes.filter(f => (f.kind === 'u' ? UT[f.t].wpn && f.t !== 'harv' : BT[f.t].wpn) && dhypot(f.x - x, f.y - y) < r); }
// macro manager: spending discipline (no float), production scaling
function O_macroMgr(P, S, D, cnt, me) {
  const Y = D.sys; if (!Y.float || P.cr < Y.float) return;
  const order = [['veh', ['heavy', 'heavy', 'arty', 'aa', 'titan', 'tsar']], ['inf', ['rocketeer', 'rifle', 'sniper', 'kommando', 'marine', 'marine']], ['air', ['gunship', 'intercept', 'jet', 'stealth']]];
  for (const [cat, list] of order) {
    const cap = Math.min(queueCap(P.team, cat), producers(P.team, cat) * 2);
    for (let k = 0; k < 4 && P.queues[cat].length < cap && P.cr > Y.float * 0.5; k++) { const ok = list.filter(t => avail(P.team, t) && P.gas >= (UT[t].gas || 0)); if (!ok.length) break; if (!enqueue(P.team, ok[(G.tick + k) % ok.length])) break; }
  }
  // defense upgrades with the surplus
  if (G.R() < 0.3) { const t = G.ents.find(b => b.team === P.team && b.kind === 'b' && UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); }
}
// defense manager: put static defense on the ground path toward the enemy (natural choke), not randomly around HQ
function O_chokePoint(P, hq, ef) {
  const S = P.aiS; if (S.choke && G.time - S.chokeT < 240) return S.choke;
  const path = findPath(Math.floor(hq.x), Math.floor(hq.y), Math.floor(ef.x), Math.floor(ef.y)); S.chokeT = G.time;
  if (!path || path.length < 6) return (S.choke = null);
  let pick = null; for (const c of path) { const x = c % MW, y = (c / MW) | 0; if (dhypot(x - hq.x, y - hq.y) >= 9) { pick = { x, y }; break; } }
  return (S.choke = pick);
}
// harass squad: small fast group raids harvesters / undefended refineries & expansions, retreats when outgunned
function O_harassMgr(P, S, D, me, foes, knownB, home, hq) {
  if (!D.sys.hsq || G.time < Math.max(D.harassAfter, 300) || !O_peaceOver(P)) return;
  S.hsq = (S.hsq || []).filter(u => u.hp > 0 && !u.dead);
  if (S.hsq.length < 3 && G.time > (S.hsqT || 0)) { const add = home.filter(u => (u.t === 'scout' || u.t === 'gunship') && !S.hsq.includes(u)).slice(0, 4 - S.hsq.length); if (S.hsq.length + add.length >= 3) { add.forEach(u => { S.hsq.push(u); S.attackers.add(u.id); }); S.hsqT = G.time + 45; } }
  if (!S.hsq.length || G.time < (S.hsqGo || 0)) return; S.hsqGo = G.time + 3;
  const c = S.hsq[0], danger = O_threatsNear(P, foes, c.x, c.y, 8);
  if (danger.length && O_combatSim(S.hsq, danger) < 0.8) { orderMove(S.hsq, hq.x, hq.y, false); S.hsq.forEach(u => S.attackers.delete(u.id)); S.hsq = []; S.hsqT = G.time + 60; return; }
  const harv = foes.filter(f => f.t === 'harv').sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (harv) { if (!c.tgt || c.tgt.t !== 'harv') orderAttack(S.hsq, harv); return; }
  const soft = knownB.filter(b => (b.t === 'refinery' || b.t === 'cc' || b.t === 'extractor') && !knownB.some(k => BT[k.t].wpn && dhypot(k.x - b.x, k.y - b.y) < 8)).sort((a, b) => dhypot(a.x - c.x, a.y - c.y) - dhypot(b.x - c.x, b.y - c.y))[0];
  if (soft) { if (c.order === 'idle' || !c.tgt) orderAttack(S.hsq, soft); }
}


// transport drops: load a strike team at home, fly around the front (flank waypoint, avoid known flak), unload behind the wall on power/eco/production
// v6.3 Seraph Medevac: bots field one flying medic once the ground army is sizable and park it over the most-hurt cluster of their troops
function O_medevacMgr(P, S, D, me, hq) {
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
function O_dropMgr(P, S, D, me, foes, knownB, home, hq) {
  if (P.diff === 'easy' || !O_peaceOver(P) || G.time < 420) return;
  const trs = me.filter(u => u.t === 'medevac');
  const want = (S.towerHeavy || knownB.some(b => b.t === 'wall') || G.time > 720) && knownB.length;
  if (want && !trs.length && avail(P.team, 'medevac') && !P.queues.air.some(q => q.t === 'medevac') && P.cr > 1500 && G.time > (S.dropT || 0)) enqueue(P.team, 'medevac');
  if (!S.drop) { const tr = trs.find(t => !t.cargo.length && dhypot(t.x - hq.x, t.y - hq.y) < 16 && t.order === 'idle');
    if (!tr || !want || G.time < (S.dropT || 0)) return;
    if (S.siege && D.si && !(S.grp || []).length && !O_SIOFF.siege) return; // time drops with the main push
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
function O_derrickMgr(P, S, D, me, cnt, hq) {
  if (!G.derricks || G.time < (D.firstAttack ? 300 : 60) || G.time < (S.dkT || 0)) return; S.dkT = G.time + 10 + D.think * 10;
  const mine = G.derricks.filter(d => d.owner === P.team).length, free = G.derricks.filter(d => d.owner < 0 || d.owner !== P.team && foe(d.owner, P.team));
  if (!free.length || mine >= (P.diff === 'easy' ? 2 : 8)) return;
  const eng = me.filter(u => u.t === 'engineer'), busy = eng.filter(u => u.order === 'derrick');
  if (eng.length - busy.length === 0 && (cnt.engineer || 0) < (P.diff === 'easy' ? 1 : 3) && avail(P.team, 'engineer') && P.cr > 600 && P.queues.inf.length < 3) enqueue(P.team, 'engineer');
  for (const u of eng) if (u.order !== 'derrick') { const tg = free.filter(d => !busy.some(b => b.dk === d.id)).sort((a, b) => dhypot(a.x - hq.x, a.y - hq.y) - (a.op ? 14 : 0) - dhypot(b.x - hq.x, b.y - hq.y) + (b.op ? 14 : 0))[0]; if (tg) { orderDerrick([u], tg.id); busy.push(u); } }
}

// ===== Chief: stronger commander (no resource cheats) =====
const O_armyVal = l => l.reduce((a, u) => a + UT[u.t].cost * u.hp / u.mhp, 0);
function O_chiefArmy(P, S, D, me, foes, knownB, home, intruders, hq, estart) {
  if (D.chief && !D.si) { const st = { x: hq.x, y: hq.y }; for (const u of S.grp || []) if (u.hp < u.mhp * 0.25 && !u.retreating && UT[u.t].armor !== 'inf') { u.retreating = true; orderMove([u], st.x, st.y, false); S.attackers.delete(u.id); } if (S.grp) S.grp = S.grp.filter(u => !u.retreating); for (const u of me) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - st.x, u.y - st.y) < 4)) u.retreating = false; }
  S.eArmy = Math.max((S.eArmy || 0) * 0.995, O_armyVal(foes.filter(f => f.kind === 'u' && UT[f.t].wpn)));
  const ground = home.filter(u => u.t !== 'harv' && !UT[u.t].jet && UT[u.t].wpn);
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x);
  const stage = { x: hq.x + dcos(ang) * 9, y: hq.y + dsin(ang) * 9 };
  // group management
  S.grp = (S.grp || []).filter(u => u.hp > 0 && !u.dead);
  if (S.grp.length) {
    const v = O_armyVal(S.grp), c = { x: S.grp.reduce((a, u) => a + u.x, 0) / S.grp.length, y: S.grp.reduce((a, u) => a + u.y, 0) / S.grp.length };
    // v5.4 stuck-army: if the pack barely moved for 12s while ordered out, clear paths and re-issue
    if (!S.grpMark || G.time - S.grpMark.t > 12) {
      if (S.grpMark && dhypot(c.x - S.grpMark.x, c.y - S.grpMark.y) < 2.5 && !foes.some(f => f.kind === 'u' && dhypot(f.x - c.x, f.y - c.y) < 8)) {
        const dest = S.grpWp || knownB[0] || { x: estart[0], y: estart[1] };
        S.grp.forEach(u => { u.path = []; u.stuckN = 0; }); orderMove(S.grp, dest.x + (G.R() - 0.5) * 4, dest.y + (G.R() - 0.5) * 4, true);
      }
      S.grpMark = { x: c.x, y: c.y, t: G.time };
    }
    const near = foes.filter(f => f.kind === 'u' && UT[f.t].wpn && dhypot(f.x - c.x, f.y - c.y) < 10);
    const thr = D.sys.sim ? O_threatsNear(P, foes, c.x, c.y, 10) : null, simR = thr && thr.length ? O_combatSim(S.grp, thr) : 9;
    const commit = S.doc && !O_SIOFF.commit; if (D.sys.sim ? (commit ? simR < 0.22 && v < S.grpV0 * 0.45 && G.time - S.lastAttack > 30 : simR < (S.siege && D.si && !O_SIOFF.siege ? 0.3 : 0.5) && v < S.grpV0 * 0.85 && G.time - S.lastAttack > 20) : (v < S.grpV0 * 0.35 && O_armyVal(near) > v * 1.2)) { // combat-sim says losing -> retreat & regroup at home defenses
      orderMove(S.grp, stage.x, stage.y, false); S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; S.grpWp = null; S.retreatT = G.time; S.wave = Math.max(S.wave, 12);
    } else if (G.time > (S.regT || 0)) {
      S.regT = G.time + 4;
      // regroup stragglers: leaders wait for the pack
      const far = S.grp.filter(u => dhypot(u.x - c.x, u.y - c.y) > 5 + Math.sqrt(S.grp.length) * 0.9);
      if (S.grpWp && !near.length && (dhypot(c.x - S.grpWp.x, c.y - S.grpWp.y) < 4.5 || G.time > S.grpWp.t)) S.grpWp = null; // flank waypoint reached
      if (S.grpWp && !near.length) orderMove(S.grp, S.grpWp.x, S.grpWp.y, true);
      else if (far.length > S.grp.length * 0.3 && !near.length && G.time > (S.regroupT || 0) && (S.regroupT = G.time + 12)) { orderMove(S.grp, c.x, c.y, true); }
      else {
        const tgts = knownB.slice(); const pref = S.towerHeavy ? ['turret', 'tesla', 'gatling', 'gcannon', 'aagun', 'wall', 'power', 'refinery', 'factory', 'barracks', 'cc', 'hq'] : D.si && !O_SIOFF.pref ? ['cc', 'factory', 'barracks', 'refinery', 'hq', 'airfield', 'turret', 'aagun', 'tech', 'power'] : ['turret', 'aagun', 'refinery', 'factory', 'barracks', 'power', 'airfield', 'tech', 'hq'];
        tgts.sort((a, b) => dhypot(a.x - c.x, a.y - c.y) * 0.3 + (pref.indexOf(a.t) + 1 || 9) - dhypot(b.x - c.x, b.y - c.y) * 0.3 - (pref.indexOf(b.t) + 1 || 9));
        let t = tgts[0] || O_huntTarget(P, S, c, estart);
        // v5.1 siege: break the weakest section of the wall/defence line in front of the pack (lowest hp, closest)
        if ((S.siege || S.doc && !O_SIOFF.commit) && (D.si || S.doc) && !O_SIOFF.siege) { const line = knownB.filter(b => (b.t === 'wall' || b.t === 'gate' || BT[b.t].wpn) && dhypot(b.x - c.x, b.y - c.y) < 13);
          if (line.length) { const real = line.map(b => byId(b.id) || b); real.sort((a, b) => (a.hp || 0) / 80 + dhypot(a.x - c.x, a.y - c.y) - (b.hp || 0) / 80 - dhypot(b.x - c.x, b.y - c.y)); const w = real[0];
            if (w && w.hp > 0 && G.time > (S.breachT || 0)) { S.breachT = G.time + 3; orderAttack(S.grp.filter(u => !u.tgt || u.tgt.kind !== 'u'), w); } } }
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
  const av = O_armyVal(idle);
  let need = Math.max(S.wave * 650, (S.eArmy || 0) * 1.4); if (S.doc) need = Math.max(need, (S.eArmy || 0) * 1.25 + (S.eDefV || 0) * 0.7);
  if (S.towerHeavy) { const arty = idle.filter(u => u.t === 'arty').length; need = Math.max(need, (S.eArmy || 0) * 1.2 + S.eDefV * (S.eOffline ? 0.5 : 1.1)); if (arty < 3 && !S.eOffline && idle.length < 30) need *= 1.5; }
  // reinforce a running attack with what has gathered at home
  const rl = S.doc && !O_SIOFF.commit; if (S.grp.length && !intruders.length && (rl ? av > 2200 || idle.length > 7 : av > 5000 || idle.length > 14) && G.time > (S.reinfT || 0)) { S.reinfT = G.time + (rl ? 10 : 20); const c = S.grp[0]; orderMove(idle, c.x, c.y, true); idle.forEach(u => { S.grp.push(u); S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; }); }
  const maxed = popOf(P.team) >= POP_CAP - 8;
  const tp = S.doc && !O_SIOFF.team ? O_teamPlan(P) : null, join = tp && tp.team !== P.team && av >= need * 0.55 && idle.length >= 6;
  if (!S.grp.length && !intruders.length && O_peaceOver(P) && (av >= need || join || idle.length >= 30 || maxed && idle.length >= 10) && (G.time - S.lastAttack > D.waveGap * (S.doc ? 0.6 : 1) || maxed || join) && G.time > (S.retreatT || -99) + (maxed ? 8 : 25)) {
    S.grp = idle.slice(); S.grpV0 = O_armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
    S.lastAttack = G.time; S.regT = 0; S.wave = Math.min(D.waveMax, S.wave + D.waveInc); S.grpWp = null;
    if (S.doc && !O_SIOFF.team) { G.tplan = G.tplan || {}; // allied sync: joiners swing round to a different angle on the same target
      if (join) { const side = (P.team % 2 ? 1 : -1) * (tp.n % 2 ? 1 : -1), a = tp.a + side * 1.0; const wx = Math.max(3, Math.min(MW - 3, tp.x + dcos(a) * 13)), wy = Math.max(3, Math.min(MH - 3, tp.y + dsin(a) * 13)); const f = nearFree(Math.floor(wx), Math.floor(wy), 6); S.grpWp = { x: f[0] + 0.5, y: f[1] + 0.5, t: G.time + 45 }; tp.n++; }
      else G.tplan[P.ally] = { t: G.time, team: P.team, x: estart[0], y: estart[1], a: datan2(hq.y - estart[1], hq.x - estart[0]), n: 0 }; }
    // multi-prong: a fast flank squad hits a different (soft) target at the same time
    if (D.sys.prong && S.grp.length >= 12 && knownB.length >= 2) { const fast = S.grp.filter(u => UT[u.t].sp >= 2.2).slice(0, Math.floor(S.grp.length * 0.3)); if (fast.length >= 3) { S.grp = S.grp.filter(u => !fast.includes(u)); S.flank = fast; } }
  }
  // v5.4 close-out: late game allied mass push on the weakest surviving enemy
  if (S.doc && G.time > 900 && !S.grp.length && !intruders.length && O_peaceOver(P) && idle.length >= 8 && G.time > (S.closeT || 0)) {
    const foesAlive = G.players.filter(Q => foe(Q.team, P.team) && !Q.out);
    if (foesAlive.length) {
      foesAlive.sort((a, b) => O_armyVal(G.ents.filter(e => e.team === a.team && e.kind === 'u' && e.hp > 0 && UT[e.t] && UT[e.t].wpn)) - O_armyVal(G.ents.filter(e => e.team === b.team && e.kind === 'u' && e.hp > 0 && UT[e.t] && UT[e.t].wpn)));
      const weak = foesAlive[0], wh = G.ents.find(e => e.team === weak.team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0) || { x: G.starts[weak.start][0], y: G.starts[weak.start][1] };
      G.tplan = G.tplan || {}; G.tplan[P.ally] = { t: G.time, team: P.team, x: wh.x, y: wh.y, a: datan2(hq.y - wh.y, hq.x - wh.x), n: 0, close: 1 };
      S.grp = idle.slice(); S.grpV0 = O_armyVal(S.grp); S.grp.forEach(u => { S.attackers.add(u.id); u.stance = 'aggr'; u.guard = null; u.face = null; });
      S.lastAttack = G.time; S.closeT = G.time + 45; orderMove(S.grp, wh.x, wh.y, true);
    }
  }
  if (S.flank) { S.flank = S.flank.filter(u => u.hp > 0 && !u.dead); if (!S.flank.length) S.flank = null; else if (G.time > (S.flankT || 0)) { S.flankT = G.time + 4; const f = S.flank[0];
    const soft = knownB.filter(b => ['refinery', 'cc', 'extractor', 'power', 'barracks'].includes(b.t)).sort((a, b) => dhypot(a.x - f.x, a.y - f.y) - dhypot(b.x - f.x, b.y - f.y))[0];
    const thr = O_threatsNear(P, foes, f.x, f.y, 9); if (thr.length && O_combatSim(S.flank, thr) < 0.6) { if (S.grp.length) orderMove(S.flank, S.grp[0].x, S.grp[0].y, true); S.grp.push(...S.flank); S.flank = null; }
    else if (soft && (!f.tgt || f.tgt.kind !== 'b')) orderAttack(S.flank, soft); else if (!soft) { S.grp.push(...S.flank); S.flank = null; } } }
}

// ===== Chief SI extras: rush defense, wounded retreat, coordinated jet strikes w/ escort =====
const O_SIOFF = (typeof globalThis !== 'undefined' && globalThis.SIOFF) || {};
function O_siExtras(P, S, me, foes, knownB, hq, estart, intruders) {
  const ang = datan2(estart[1] - hq.y, estart[0] - hq.x), stage = { x: hq.x + dcos(ang) * 8, y: hq.y + dsin(ang) * 8 };
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && !UT[u.t].air);
  // early rush defense: recall everything when base attacked in the first 6 minutes
  // base defense recall (any time): bring the attack group home if the base faces a real threat
  if (!O_SIOFF.recall2 && intruders.length && S.grp && S.grp.length && G.time > (S.recallT || 0)) { const iv = O_armyVal(intruders.filter(f => me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 12))), hv = O_armyVal(army.filter(u => !S.grp.includes(u) && dhypot(u.x - hq.x, u.y - hq.y) < 20));
    if (iv > Math.max(4500, hv * 1.5)) { const c = intruders[0]; S.recallT = G.time + 10; S.grp.forEach(u => S.attackers.delete(u.id)); orderMove(S.grp, c.x, c.y, true); S.grp = []; S.retreatT = G.time; } }
  if (!O_SIOFF.recall && intruders.length && G.time < 360) { const c = intruders.reduce((a, f) => (a.x += f.x / intruders.length, a.y += f.y / intruders.length, a), { x: 0, y: 0 });
    if (O_armyVal(intruders) > 500 && G.time > (S.recallT || 0)) { S.recallT = G.time + 6; const all = army.filter(u => u.t !== 'harv'); if (S.grp && S.grp.length) { S.grp.forEach(u => S.attackers.delete(u.id)); S.grp = []; } orderMove(all, c.x, c.y, true); } }
  // 2 early turrets toward the enemy, gas-first upgrades
  const tur = me.filter(e => e.t === 'turret').length + P.queues.def.filter(q => q.t === 'turret').length + (P.ready.def === 'turret' ? 1 : 0);
  if (intruders.length && G.time < 360) S.rushed = true;
  if (!O_SIOFF.turrets && S.rushed && tur < 2 && !P.queues.def.length && !P.ready.def && P.cr > 250 && avail(P.team, 'turret')) enqueue(P.team, 'turret');
  // faction special as win condition
  const sp = FACTIONS[P.fac].sp, spD = UT[sp] || BT[sp];
  if (!O_SIOFF.special && spD && G.time > 300 && avail(P.team, sp) && P.gas >= (spD.gas || 0) && P.cr > spD.cost * 0.5) { const qc = UT[sp] ? (spD.from === 'barracks' ? 'inf' : spD.air ? 'air' : 'veh') : spD.cat; const have = me.filter(e => e.t === sp).length + P.queues[qc].filter(q => q.t === sp).length + (P.ready[qc] === sp ? 1 : 0); if (have < (BT[sp] ? 2 : 4) && P.queues[qc].length < 2) enqueue(P.team, sp); }
  // retreat badly wounded units (not when defending at home)
  if (!O_SIOFF.retreat) for (const u of army) if (u.hp < u.mhp * 0.3 && !u.retreating && dhypot(u.x - hq.x, u.y - hq.y) > 14 && u.t !== 'harv') { u.retreating = true; orderMove([u], stage.x, stage.y, false); if (S.grp) S.grp = S.grp.filter(x => x !== u); S.attackers.delete(u.id); }
  for (const u of army) if (u.retreating && (u.hp > u.mhp * 0.7 || dhypot(u.x - stage.x, u.y - stage.y) < 3)) u.retreating = false;
  // jet strike waves (>=3 armed jets); interceptor escorts orbit the target instead of hovering
  const jets = me.filter(u => u.t === 'jet' && u.js === 'landed' && u.ammo >= W.jbomb.ammo);
  if (!O_SIOFF.jets && !S.doc && jets.length >= 3 && knownB.length && O_peaceOver(P) && G.time > (S.strikeT || 0)) {
    const pri = S.towerHeavy ? ['power', 'refinery', 'extractor', 'factory', 'airfield', 'tech', 'barracks', 'cc', 'hq'] : ['refinery', 'extractor', 'power', 'factory', 'airfield', 'tech', 'barracks', 'cc', 'hq'];
    const aaNear = b => knownB.filter(k => k.t === 'aagun' && dhypot(k.x - b.x, k.y - b.y) < 7).length;
    const tg = knownB.filter(b => BT[b.t].cat !== 'def').sort((a, b) => ((pri.indexOf(a.t) + 1 || 9) + aaNear(a) * 3) - ((pri.indexOf(b.t) + 1 || 9) + aaNear(b) * 3))[0];
    if (tg) { orderAttack(jets, tg); S.strike = { tg, until: G.time + 30 }; S.strikeT = G.time + 22; }
  }
  if (S.strike && (G.time > S.strike.until || S.strike.tg.hp <= 0)) S.strike = null;
  const esc = me.filter(u => u.t === 'intercept');
  if (!O_SIOFF.escort && esc.length) { S.escA = (S.escA || 0) + 0.9; const c = S.strike ? S.strike.tg : { x: hq.x + dcos(ang) * 6, y: hq.y + dsin(ang) * 6 }, r = S.strike ? 4 : 5;
    esc.forEach((u, k) => { if (u.tgt && u.tgt.hp > 0 && UT[u.tgt.t] && UT[u.tgt.t].air) return; const a = S.escA + k * 2 * Math.PI / esc.length; orderMove([u], Math.max(1, Math.min(MW - 1, c.x + dcos(a) * r)), Math.max(1, Math.min(MH - 1, c.y + dsin(a) * r)), true); }); }
  // scouting: keep enemy base memory fresh with a cheap unit
  if (G.time > (S.siScoutT || 60) && !knownB.length) { const sc = me.find(u => u.t === 'scout' || u.t === 'rifle'); if (sc) orderMove([sc], estart[0], estart[1], false); S.siScoutT = G.time + 60; }
}

// ===== expansions / growth =====
function O_aiSite(P, hq) {
  let best = null, bd = 1e9;
  for (const st of G.sites || []) {
    if (G.ents.some(e => e.kind === 'b' && dhypot(e.x - st.x, e.y - st.y) < 7)) continue;
    if (G.ents.some(e => foe(e.team, P.team) && dhypot(e.x - st.x, e.y - st.y) < 12)) continue;
    let ore = 0; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const x = Math.floor(st.x) + dx, y = Math.floor(st.y) + dy; if (inb(x, y)) ore += G.ore[idx(x, y)]; }
    if (ore < 4000) continue;
    const d = dhypot(st.x - hq.x, st.y - hq.y) - (st.k === 'mid' && O_DIFF[P.diff].expandAt < 320 && !(O_DIFF[P.diff].si && !(globalThis.SIOFF || {}).nomid) ? 4 : 0) + (st.k === 'mid' && O_DIFF[P.diff].si && !(globalThis.SIOFF || {}).nomid ? 12 : 0);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function O_aiGrowth(P, S, D, cnt, hq, foes) {
  // modest wall chain: one 5-segment line toward the enemy start (Medium/Hard/Chief), once rich
  if (P.diff !== 'easy' && !S.walled && G.time > 420 && P.cr > 2500 && G.starts) { S.walled = true;
    const es = G.players.filter(Q => foe(Q.team, P.team)).map(Q => G.starts[Q.start])[0];
    if (es) { const a = datan2(es[1] - hq.y, es[0] - hq.x), cx = Math.floor(hq.x + dcos(a) * 8), cy = Math.floor(hq.y + dsin(a) * 8), px = Math.round(-dsin(a) * 2), py = Math.round(dcos(a) * 2);
      const tiles = wallLine(cx - px, cy - py, cx + px, cy + py); const mid = tiles[tiles.length >> 1];
      if (mid && avail(P.team, 'gate') && canPlace('gate', P.team, mid[0], mid[1]) && P.cr >= BT.gate.cost) { P.cr -= BT.gate.cost; addB('gate', P.team, mid[0], mid[1]); }
      buildWalls(P.team, tiles.filter(([x, y]) => !(mid && x === mid[0] && y === mid[1]) && canPlace('wall', P.team, x, y)));
      if (!O_aiExitFree(P, hq)) { for (const e of G.ents.filter(e => e.team === P.team && (e.t === 'wall' || e.t === 'gate') && dhypot(e.x - cx, e.y - cy) < 4)) { e.hp = 0; e.dead = true; } G.bver++; } } }
  const ok = t => avail(P.team, t) && (S.bad[t] || 0) < G.time && !!O_aiSpot(P, t, hq, foes);
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
function O_aiFocus(P, knownB) {
  const tg = knownB.slice(); const hum = G.players.find(Q => !Q.ai && !foe(Q.team, P.team) && Q.team !== P.team);
  if (hum) { const arm = G.ents.filter(e => e.team === hum.team && e.kind === 'u' && e.t !== 'harv'); if (arm.length) { const cx = arm.reduce((a, e) => a + e.x, 0) / arm.length, cy = arm.reduce((a, e) => a + e.y, 0) / arm.length; tg.sort((a, b) => dhypot(a.x - cx, a.y - cy) - dhypot(b.x - cx, b.y - cy)); return tg; } }
  return tg;
}
// ===== v7.0 faction specials for bots (deterministic, no bonuses) =====
function O_facAI(P, S, D, me, cnt, hq, foes) {
  if (P.fac === 'irn') O_droneMgr(P, S, me, foes, hq);
  else if (P.fac === 'chn') { O_greatWallMgr(P, S, me, cnt, hq); O_ballistaMgr(P, S, me); }
  else if (P.fac === 'jpn') O_raijinMgr(P, S, me, foes);
}
// Iran: hold drones at home until a swarm of 6+ (3 in Endless / when defending), then throw it at the densest visible enemy blob (or a key building)
function O_droneMgr(P, S, me, foes, hq) {
  const dr = me.filter(u => u.t === 'drone' && u.hp > 0 && !u.tgt && u.order !== 'move'); if (!dr.length) return;
  const need = G.end || S.underAttack ? 2 : 6; if (dr.length < need && G.time - (S.droneT || 0) < 90) return;
  let best = null, bs = 0;
  for (const f of foes) { if (f.hp <= 0 || isAir(f)) continue; let n = 0; if (f.kind === 'u') { if (!UT[f.t].wpn) continue; for (const q of foes) if (q.kind === 'u' && !isAir(q) && Math.abs(q.x - f.x) < 2 && Math.abs(q.y - f.y) < 2) n += UT[q.t].armor === 'inf' ? 1 : 2; }
    else n = ({ factory: 5, refinery: 5, power: 4, tech: 4, airfield: 4, hq: 3, cc: 3, gcannon: 4, tesla: 4 })[f.t] || 0;
    const sc = n - dhypot(f.x - hq.x, f.y - hq.y) * 0.02; if (n >= 3 && sc > bs) { bs = sc; best = f; } }
  if (!best) { const kb = [...S.known.values()].filter(b => b.hp > 0 && ['refinery', 'power', 'factory', 'tech'].includes(b.t)); if (kb.length && dr.length >= 6 && O_peaceOver(P)) best = kb[(G.R() * kb.length) | 0]; }
  if (!best) return; S.droneT = G.time; orderAttack(dr, best); dr.forEach(u => S.attackers.add(u.id));
}
// v7.0.2 China: once teched and rich, convert a FEW key guard towers (closest to the enemy's approach) into Ballista Towers — 2 early, 3 later (4 in Endless)
function O_ballistaMgr(P, S, me) {
  if (G.time < (S.balT || 0)) return; S.balT = G.time + 5;
  const gt = me.filter(e => e.kind === 'b' && e.t === 'gtower' && e.hp > 0 && e.sell < 0); const nb = gt.filter(e => e.bal || e.upKind === 'bal').length;
  const ok = gt.length && nb < (G.end ? 4 : G.time < 900 ? 2 : 3) && nb < gt.length && hasBuilt(P.team, BALLISTA.req);
  // bots earmark a slice of income into a Ballista fund (the AI otherwise spends every credit on queues); the fund is released if there is nothing left to convert
  if (!ok) { if (S.balFund) { P.cr += S.balFund; S.balFund = 0; } return; }
  if ((S.balFund || 0) < BALLISTA.cost) { const take = Math.min(P.cr, G.end ? 140 : 90, BALLISTA.cost - (S.balFund || 0)); P.cr -= take; S.balFund = (S.balFund || 0) + take; return; }
  if ((P.gas || 0) < BALLISTA.gas + 50 || P.pow + BALLISTA.pow < 0) return;
  const fs = G.players.filter(Q => foe(Q.team, P.team) && !Q.out).map(Q => G.starts[Q.start]).filter(Boolean); if (!fs.length && !G.end) return;
  const sc = e => fs.length ? Math.min(...fs.map(st => dhypot(st[0] - e.x, st[1] - e.y))) : -e.hp; let best = null;
  for (const e of gt) if (!e.bal && e.upT == null && (!best || sc(e) < sc(best))) best = e;
  if (!best) return; P.cr += S.balFund; S.balFund = 0; upgradeB(best); }
// China: Great Wall lines across every entrance (each 5th piece rises as a guard tower) — always with a gate lane
function O_greatWallMgr(P, S, me, cnt, hq) {
  if (G.time < (S.gwT || 0) || G.time < (G.end ? 20 : 200) || !avail(P.team, 'wall')) return; S.gwT = G.time + (G.end ? 40 : 110);
  const nw = (cnt.wall || 0) + (cnt.gtower || 0) + (cnt.gate || 0); if (nw >= (G.end ? 110 : 70) || P.cr < (G.end ? 600 : 900)) return;
  const ents = O_baseEntrances(P, S, hq); if (!ents.length) return;
  const en = ents[(S.gwI = ((S.gwI || 0) + 1)) % ents.length]; if (G.time < (en.gwT || 0)) return; en.gwT = G.time + 400;
  O_aiWallEntrance(P, en, G.end ? 9 : 7, 2.2 + (en.gwN || 0) * 2); en.gwN = (en.gwN || 0) + 1;
}
// Japan: Raijin flies (jet) to far targets over walls and cliffs, lands (mech) to fight; idle jets land
function O_raijinMgr(P, S, me, foes) {
  for (const u of me) { if ((u.t !== 'raijin' && u.t !== 'raijinJ') || u.hp <= 0 || u.xfT != null || G.time < (u.xfCd || 0)) continue;
    const jet = u.t === 'raijinJ', dst = u.tgt || (u.order !== 'idle' && u.anchor) || null, dd = dst ? dhypot(dst.x - u.x, dst.y - u.y) : 0;
    let near = false; for (const f of foes) if (f.kind === 'u' && UT[f.t].wpn && !isAir(f) && Math.abs(f.x - u.x) < 6 && Math.abs(f.y - u.y) < 6) { near = true; break; }
    if (!jet && dst && dd > 16 && !near) xform(u);
    else if (jet && (!dst || u.order === 'idle' || dd < 6 || near) && !blk(u.x, u.y)) xform(u); }
}
function O_aiPing(P, S, me) {
  for (const pg of G.pings || []) if (!foe(pg.team, P.team) && pg.team !== P.team && pg.t > (S.pingT || -1)) {
    S.pingT = pg.t; const arm = me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv' && !UT[u.t].jet);
    const n = pg.kind === 'attack' ? arm : arm.slice(0, Math.ceil(arm.length * 0.6));
    if (n.length) { orderMove(n, pg.x, pg.y, true); n.forEach(u => S.attackers.add(u.id)); }
    G.events.push({ e: 'allyAck', team: P.team, x: pg.x, y: pg.y });
  }
}

function O_intrudersEarly(P, foes, me) { return foes.some(f => f.kind === 'u' && UT[f.t].wpn && me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 12)); }

// with no known enemy buildings: sweep expansion sites / starts, nearest unvisited first
function O_huntTarget(P, S, c, estart) {
  S.hunted = S.hunted || {}; const vis = G.visT[P.team];
  const cands = [...G.starts.map(s => ({ x: s[0], y: s[1] })), ...(G.sites || [])].filter(s => { const k = (s.x | 0) + ',' + (s.y | 0); if (vis[idx(Math.floor(s.x), Math.floor(s.y))]) S.hunted[k] = G.time; return G.time - (S.hunted[k] ?? -999) > 90; });
  if (!cands.length) return { x: estart[0], y: estart[1] };
  cands.sort((a, b) => dhypot(a.x - estart[0], a.y - estart[1]) * 1.5 + dhypot(a.x - c.x, a.y - c.y) * 0.5 - dhypot(b.x - estart[0], b.y - estart[1]) * 1.5 - dhypot(b.x - c.x, b.y - c.y) * 0.5); return cands[0];
}

// ===== v5.2 doctrine (ALL levels use every behaviour; O_DIFF only changes execution: think/slip/sat) =====
// base entrances: where ground paths from each of my bases toward enemies / the map centre leave the base
function O_baseEntrances(P, S, hq) {
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
function O_defenseMgr(P, S, D, me, cnt, hq) {
  if (P.queues.def.length || P.ready.def || !avail(P.team, 'turret') || G.time < 90) return;
  const ents = O_baseEntrances(P, S, hq); if (!ents.length) return;
  const myD = me.filter(e => e.kind === 'b' && BT[e.t].cat === 'def' && BT[e.t].wpn);
  const tier = G.time < 300 ? 1 : !hasBuilt(P.team, 'tech') ? 2 : G.time < 840 ? 3 : 4;
  const gc = avail(P.team, 'gcannon'), TES = O_facDef(P, 'tesla'), heavyDef = gc && TES === 'tesla' ? 'gcannon' : TES; // France: Gatlings first at the entrance, Grand Cannons behind (tier 4 + special)
  // v5.3 defence-first: many towers per entrance; Teslas come in clusters of 2-3 (they chain/stack), Grand Cannon behind
  const plan = tier === 1 ? [['turret', 2]] : tier === 2 ? [['turret', 2], ['aagun', 1], ['turret', 3]] : tier === 3 ? [['turret', 2], ['aagun', 1], [heavyDef, 1], [TES, 2], ['turret', 3]] : [['turret', 3], ['aagun', 2], [heavyDef, 1], [TES, 3], ['gcannon', gc ? 2 : 0], ['aagun', 3]];
  if (P.cr < 150) return;
  // budget: static D may not starve the army; defence-first allows a big share (more when under attack / army wiped)
  const dv = myD.reduce((a, d) => a + BT[d.t].cost, 0), av = O_armyVal(me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv')); const share = O_SIOFF.def53 ? (S.underAttack ? 0.45 : 0.3) : (S.underAttack ? 0.6 : 0.45); const capped = dv > 1500 && dv > (av + dv) * share;
  S.lanes = ents.flatMap(e => e.lane);
  // entrance walls with a gate (own units pass, enemies must break through under tower fire)
  if (!O_SIOFF.walls && !S.wallFull && tier >= 2 && P.cr > 700 && avail(P.team, 'wall')) for (const en of ents) if (G.time > (en.wallT || 0) && myD.filter(d => dhypot(d.x - en.x, d.y - en.y) < 5).length >= 2) { en.wallT = G.time + 150; O_aiWallEntrance(P, en); return; }
  for (const [t, n] of plan) for (const en of ents) { if (!n || !avail(P.team, t) || (S.bad[t] || 0) > G.time || (capped && !(t === 'turret' && n <= 2))) continue; const have = myD.filter(d => d.t === t && dhypot(d.x - en.x, d.y - en.y) < 5.5).length; if (have < n) { if (BT[t].pow < 0 && P.pow + BT[t].pow < 0) return; // never build towers that would black out the base
      let at = { x: en.x + (en.b.x - en.x) * 0.15, y: en.y + (en.b.y - en.y) * 0.15 };
      if (t === 'tesla') { const near = myD.find(d => d.t === 'tesla' && dhypot(d.x - en.x, d.y - en.y) < 5.5); if (near) at = { x: near.x, y: near.y }; } // cluster within relay range
      if (t === 'gcannon') at = { x: en.x + (en.b.x - en.x) * 0.35, y: en.y + (en.b.y - en.y) * 0.35 };
      S.defAt = at; S.defAtT = G.time; enqueue(P.team, t); return; } }
  // flak over the core (power/production) against air raids
  const core = me.filter(e => e.t === 'power' || e.t === 'factory' || e.t === 'refinery'); const coreAA = myD.filter(d => d.t === 'aagun' && dhypot(d.x - hq.x, d.y - hq.y) < 9).length;
  if (!capped && tier >= 2 && coreAA < (tier >= 4 ? 3 : tier >= 3 ? 2 : 1) && core.length && avail(P.team, 'aagun')) { const c = core[(G.tick >> 4) % core.length]; S.defAt = { x: c.x, y: c.y }; S.defAtT = G.time; enqueue(P.team, 'aagun'); return; }
  // upgrades once the plan is met
  if (P.cr > 2000) { const t = myD.find(b => UPG[b.t] && (b.lvl || 1) < 3 && b.upT == null); if (t) upgradeB(t); }
}
function O_aiExitFree(P, hq) {
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
function O_aiWallEntrance(P, en, half, off) {
  // v5.4: always leave a gate lane, never seal the base; roll back if exit path dies
  const a = datan2(en.y - en.b.y, en.x - en.b.x), cx = en.x + dcos(a) * (off || 2.2), cy = en.y + dsin(a) * (off || 2.2), px = -dsin(a), py = dcos(a), tiles = [], seen = new Set();
  for (let k = -(half || 5); k <= (half || 5); k += 0.5) { const x = Math.floor(cx + px * k), y = Math.floor(cy + py * k), i = idx(x, y); if (!inb(x, y) || seen.has(i)) continue; seen.add(i); tiles.push([x, y, Math.abs(k)]); }
  const placed = []; let n = 0, gates = 0;
  // place gate(s) first on the centre 3 tiles so a lane always exists
  for (const [x, y, k] of tiles) if (k < 1.1) { if (!avail(P.team, 'gate') || P.cr < BT.gate.cost + 200 || !canPlace('gate', P.team, x, y)) continue; P.cr -= BT.gate.cost; const b = addB('gate', P.team, x, y); placed.push(b); n++; gates++; }
  if (!gates) { // force one gate even if canPlace was picky: clear a centre tile and put a gate
    const gx = Math.floor(cx), gy = Math.floor(cy); if (inb(gx, gy) && avail(P.team, 'gate') && P.cr >= BT.gate.cost) {
      for (const e of G.ents) if (e.kind === 'b' && e.team === P.team && e.t === 'wall' && e.tx === gx && e.ty === gy) { P.cr += Math.floor(BT.wall.cost * 0.5); e.hp = 0; e.dead = true; }
      if (canPlace('gate', P.team, gx, gy)) { P.cr -= BT.gate.cost; placed.push(addB('gate', P.team, gx, gy)); n++; gates++; } } }
  for (const [x, y, k] of tiles) if (k >= 1.1) { if (!avail(P.team, 'wall') || P.cr < BT.wall.cost + 300 || !canPlace('wall', P.team, x, y)) continue; P.cr -= BT.wall.cost; placed.push(addB('wall', P.team, x, y)); n++; }
  if (n) { G.bver = (G.bver || 0) + 1; G.events.push({ e: 'walls', team: P.team, n }); }
  // verify exit; if sealed, convert centre walls to gates or tear the last wall segment
  if (n && !O_aiExitFree(P, en.b)) {
    for (const b of placed) if (b.t === 'wall' && dhypot(b.x - cx, b.y - cy) < 1.6) { const x = b.tx, y = b.ty; b.hp = 0; b.dead = true; P.cr += Math.floor(BT.wall.cost * 0.6); if (canPlace('gate', P.team, x, y) && P.cr >= BT.gate.cost) { P.cr -= BT.gate.cost; addB('gate', P.team, x, y); } }
    G.bver = (G.bver || 0) + 1;
    if (!O_aiExitFree(P, en.b)) { for (const b of placed) if (b.hp > 0) { P.cr += Math.floor(BT[b.t].cost * 0.5); b.hp = 0; b.dead = true; } G.bver++; }
  }
}
// production targets: many factories / barracks / airfields (never sit on money)
function O_prodTarget(P, S, D, cnt, hq, foes) {
  const t = G.time, ok = k => avail(P.team, k) && (S.bad[k] || 0) < G.time && !!O_aiSpot(P, k, hq, foes);
  const e53 = !O_SIOFF.eco53, fac = e53 ? (t < 240 ? 1 : t < 420 ? 2 : t < 620 ? 3 : t < 900 ? 4 : 5) : t < 300 ? 1 : t < 540 ? 2 : t < 780 ? 3 : t < 1100 ? 4 : 5, bar = t < 360 ? 1 : t < 720 ? 2 : 3, air = t < 420 ? 0 : t < 720 ? 1 : t < 1000 ? 2 : 3;
  const rich = P.cr > 1800;
  if ((cnt.factory || 0) < fac && (cnt.factory || 0) >= 1 && (rich || t > (e53 ? 240 : 400) && P.cr > 600) && ok('factory')) return 'factory';
  if ((cnt.barracks || 0) < bar && rich && ok('barracks')) return 'barracks';
  if ((cnt.airfield || 0) < air && hasBuilt(P.team, 'tech') && (rich || (cnt.airfield || 0) === 0) && ok('airfield')) return 'airfield';
  if (t > 600 && !(cnt.silo || 0) && P.cr > 3500 && P.gas > 600 && ok('silo')) return 'silo';
  if (P.cr > 4000 && (cnt.factory || 0) < fac + 2 && ok('factory')) return 'factory';
  return null;
}
// massed air raids: hold armed strike craft until >=5 (or 4 late), probe 8 approach angles for the side with least known AA, strike together
function O_airRaidMgr(P, S, D, me, foes, knownB, hq) {
  const air = me.filter(u => u.kind === 'u' && (u.t === 'jet' || u.t === 'bomber' || u.t === 'stealth'));
  if (S.raid) { const R = S.raid; R.u = R.u.filter(u => u.hp > 0 && !u.dead); const tg = R.tg;
    if (!R.u.length || tg.hp <= 0 || G.time > R.t0 + 60) { S.raid = null; S.raidT = G.time + 8; }
    else if (R.ph === 'wp') { const c = R.u.reduce((a, u) => (a.x += u.x / R.u.length, a.y += u.y / R.u.length, a), { x: 0, y: 0 }); if (dhypot(c.x - R.wp.x, c.y - R.wp.y) < 3.5 || G.time > R.t0 + 18) { orderAttack(R.u, tg); R.ph = 'hit'; } else if (G.tick % 30 < 15) R.u.forEach(u => { if (!u.path.length) orderMove([u], R.wp.x, R.wp.y, false); }); }
    return; }
  if (!O_peaceOver(P) || G.time < (S.raidT || 0) || !knownB.length) return;
  const armed = air.filter(u => u.js === 'landed' && u.ammo >= W[UT[u.t].wpn].ammo); if (armed.length < (G.time > 1300 ? 4 : 5)) return;
  const aa = knownB.filter(b => b.t === 'aagun' || b.t === 'tesla' || b.t === 'gatling').concat(foes.filter(f => f.kind === 'u' && (f.t === 'aa' || f.t === 'intercept' || f.t === 'rocketeer')));
  const aaAt = (x, y) => aa.reduce((s, a) => s + (dhypot(a.x - x, a.y - y) < 7.5 ? (a.kind === 'b' ? 2 * ((a.lvl || 1) + 1) / 2 : 1) : 0), 0);
  const pri = S.towerHeavy ? { power: 0, refinery: 2, factory: 2, silo: 0, airfield: 3, tech: 3 } : { refinery: 0, power: 1, factory: 1, silo: 0, airfield: 2, tech: 3, barracks: 3, extractor: 2 };
  const cands = knownB.filter(b => pri[b.t] != null).map(b => ({ b, s: pri[b.t] * 2 + aaAt(b.x, b.y) * 1.5 })).sort((a, b) => a.s - b.s); if (!cands.length) return;
  const tg = cands[0].b; let best = null, bs = 1e9;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + (G.R() - 0.5) * 0.3, wp = { x: Math.max(2, Math.min(MW - 2, tg.x + dcos(a) * 15)), y: Math.max(2, Math.min(MH - 2, tg.y + dsin(a) * 15)) };
    let s = 0; for (let j = 0; j <= 6; j++) s += aaAt(wp.x + (tg.x - wp.x) * j / 6, wp.y + (tg.y - wp.y) * j / 6); s += (S.lastRaidA != null && Math.abs(a - S.lastRaidA) < 0.5 ? 2 : 0); if (s < bs) { bs = s; best = { wp, a }; } }
  S.lastRaidA = best.a; S.raid = { u: armed, tg, wp: best.wp, ph: 'wp', t0: G.time }; orderMove(armed, best.wp.x, best.wp.y, false);
}
// warhead launcher: build the biggest affordable missile, fire at the densest power/defence cluster, timed with the main push
function O_warheadMgr(P, S, D, me, foes, knownB) {
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
function O_teamPlan(P) { G.tplan = G.tplan || {}; const p = G.tplan[P.ally]; return p && G.time - p.t < 25 ? p : null; }

// ===== v5.6 keep-busy layer: idle watchdog, rich-spend, map centre, endgame all-in =====
const O_END_T = 22 * 60;
function O_endTarget(P) { // shared per alliance: weakest surviving enemy (fewest known structures) -> its nearest known building / start
  G.etgt = G.etgt || {}; let e = G.etgt[P.ally];
  if (!e || G.players[e.team].out || G.time - e.t > 20) { let best = null, bv = 1e9; const S = P.aiS;
    for (const Q of G.players) if (foe(Q.team, P.team) && !Q.out) { let v = 0; for (const b of S.known.values()) if (b.team === Q.team) v += BT[b.t].cost; v = v || 1e5 - Q.team; if (v < bv) { bv = v; best = Q.team; } }
    if (best == null) return null; e = G.etgt[P.ally] = { team: best, t: G.time }; }
  const st = G.starts[G.players[e.team].start]; let tx = st[0], ty = st[1], bd = 1e9; const hq = G.ents.find(x => x.team === P.team && x.kind === 'b');
  for (const b of P.aiS.known.values()) if (b.team === e.team && b.hp > 0) { const d = dhypot(b.x - (hq ? hq.x : tx), b.y - (hq ? hq.y : ty)); if (d < bd) { bd = d; tx = b.x; ty = b.y; } }
  return { team: e.team, x: tx, y: ty };
}
function O_keepBusy(P, S, D, me, cnt, hq, intruders) {
  const army = me.filter(u => u.kind === 'u' && UT[u.t].wpn && u.t !== 'harv' && !UT[u.t].engineer && u.hp > 0);
  // production progress key
  let key = 0; for (const c in P.queues) for (const it of P.queues[c]) key += (it.prog || 0) + 1; for (const c in P.ready) if (P.ready[c]) key += 7;
  if (key !== S.pKey || army.some(u => u.tgt)) { S.pKey = key; S.busyT = G.time; }
  const idleFor = G.time - (S.busyT || G.time);
  const rich = P.cr > 2500 && P.pow >= 0;
  if (!P.queues.bld.length && !P.ready.bld && P.pow >= 30 && P.cr > 3000 && G.time > 360) { // turn a bank into production
    const t = (cnt.factory || 0) < 3 ? 'factory' : (cnt.barracks || 0) < 2 ? 'barracks' : (cnt.refinery || 0) < 4 && G.ore.some(o => o > 200) ? 'refinery' : avail(P.team, 'silo') && !(cnt.silo) && G.time > 900 ? 'silo' : (cnt.airfield || 0) < 2 && avail(P.team, 'airfield') ? 'airfield' : null;
    if (t && avail(P.team, t) && (S.bad[t] || 0) < G.time && O_aiSpot(P, t, hq, [])) enqueue(P.team, t);
  }
  if (P.pow >= 0 && P.cr > 600) { for (const [c, t] of [['inf', 'rifle'], ['veh', 'heavy']]) if (producers(P.team, c) && P.queues[c].length < Math.min(5, producers(P.team, c) * 2) && (rich || idleFor > 15)) { const opts = c === 'inf' ? ['rifle', 'rocketeer', 'rifle', 'sniper'] : ['heavy', 'heavy', 'arty', 'heavy', 'titan', 'tsar']; const pk = opts.filter(x => avail(P.team, x)); if (pk.length) enqueue(P.team, pk[(G.R() * pk.length) | 0]); } }
  // idle watchdog
  if (idleFor > 20) { S.busyT = G.time - 10;
    if (!(cnt.refinery) && avail(P.team, 'refinery')) enqueue(P.team, 'refinery');
    else if (me.filter(e => e.t === 'harv').length < 2 && avail(P.team, 'harv')) enqueue(P.team, 'harv');
    else if (!(cnt.barracks) && avail(P.team, 'barracks')) enqueue(P.team, 'barracks');
    else if (!(cnt.factory) && avail(P.team, 'factory')) enqueue(P.team, 'factory');
    else if (avail(P.team, 'rifle')) enqueue(P.team, 'rifle');
    const lazy = army.filter(u => u.order === 'idle' && !u.tgt && !UT[u.t].jet);
    if (lazy.length && !intruders.length && O_peaceOver(P)) { const e = G.time > O_END_T ? O_endTarget(P) : null, M = MW / 2; const x = e ? e.x : M + (G.R() - 0.5) * 8, y = e ? e.y : MH / 2 + (G.R() - 0.5) * 8; orderMove(lazy, x, y, true); for (const u of lazy) S.attackers.add(u.id); }
  }
  // endgame: allied all-in on the weakest enemy, nonstop reinforcement, no retreat
  if (G.time > O_END_T) { for (const it of P.queues.def.slice()) if (it.t !== 'wall' && it.prog < 0.5 && !S.underAttack) cancel(P.team, it.t);
    if (P.gas > 300 && P.cr > 400) { const gu = ['titan', 'tsar', 'kommando', 'stealth'].filter(t => avail(P.team, t)); const t = gu[(G.R() * gu.length) | 0]; if (t) { const c = UT[t].from === 'barracks' ? 'inf' : UT[t].from === 'factory' ? 'veh' : 'air'; if (P.queues[c] && P.queues[c].length < 4) enqueue(P.team, t); } } }
  if (G.time > O_END_T && G.time > (S.endT || 0)) { S.endT = G.time + 4; const e = O_endTarget(P); if (!e) return;
    const mine = intruders.filter(f => me.some(b => b.kind === 'b' && dhypot(b.x - f.x, b.y - f.y) < 9));
    const go = army.filter(u => !UT[u.t].jet && !(u.order === 'attack' && u.tgt) && !(mine.length && dhypot(u.x - mine[0].x, u.y - mine[0].y) < 14 && army.length < 25));
    const far = go.filter(u => dhypot(u.x - e.x, u.y - e.y) > 6 || u.order === 'idle'); if (far.length) { orderMove(far, e.x, e.y, true); for (const u of far) S.attackers.add(u.id); }
    S.allIn = true; S.lastAttack = G.time;
    if (!(cnt.silo) && avail(P.team, 'silo') && P.cr > 3500 && !P.queues.bld.length && !P.ready.bld && O_aiSpot(P, 'silo', hq, [])) enqueue(P.team, 'silo');
  }
}
