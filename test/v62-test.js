// v6.2 checklist tests (node, deterministic sim). node test/v62-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,orderMove,avail,execCmd,damage,impact,ensureFields,upgradeB,uW,researchB,researchInfo,rsLvl,siegeToggle,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < s * 30; i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh(f0, f1, ai, seed) { A.newGame({ seed: seed || 3, diff: 'hard', aiTeams: ai || [], fog: false, slots: [{ fac: f0, ally: 0, ai: (ai || []).includes(0) }, { fac: f1, ally: 1, ai: (ai || []).includes(1), diff: 'hard' }] });
  A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); }
const tech = (t, x0, y0) => { let i = 0; for (const b of ['power', 'power', 'power', 'barracks', 'refinery', 'factory', 'tech']) A.addB(b, t, (x0 || 70) + (i++) * 3, (y0 || 75) + t * 6, true); };
const S = process.argv[2] || 'all', on = k => S === 'all' || S === k;
// ===== 1. Iron Marine =====
if (on('marine')) {
  chk('marine stats: dmg 20 -> 21 (+5%), speed 1.52 -> 1.67 (+10%)', W.marine.dmg === 21 && UT.marine.sp === 1.67, W.marine.dmg + ' / ' + UT.marine.sp);
  fresh('bra', 'usa'); const m = A.addU('marine', 0, 31, 40), e1 = A.addU('rifle', 1, 37, 41); e1.stance = 'hold'; e1.hp = e1.mhp = 50000; run(3);
  chk('marine engages an enemy in range (idle auto-acquire)', m.tgt === e1);
  A.orderMove([m], 32.5, 44.5, false); chk('a plain move breaks off the target immediately', !m.tgt && m.order === 'move');
  let reacq = false, arrived = -1; for (let i = 0; i < 30 * 8; i++) { A.stepGame(); A.G.events.length = 0; if (m.order === 'move' && m.tgt) reacq = true; if (arrived < 0 && m.order === 'idle') arrived = i; }
  chk('...no re-acquire while the move is running (even with the enemy in range)', !reacq && arrived > 0, 'arrived after ' + (arrived / 30).toFixed(1) + 's');
  chk('arrives, then re-engages nearby enemies (short pull-back feel kept)', Math.hypot(m.x - 32.5, m.y - 44.5) < 2.6 && m.tgt === e1, `at ${m.x.toFixed(1)},${m.y.toFixed(1)} tgt=${m.tgt && m.tgt.t}`);
  // armor vs tanks / aircraft and splash
  fresh('bra', 'rus'); const mk = () => A.addU('marine', 0, 40, 40), tank = A.addU('heavy', 1, 44, 40), jet = A.addU('jet', 1, 44, 44);
  const hit = (srcU, w) => { const t = mk(); t.nb = 0; const h = t.hp; A.damage(t, 100, w, 1, srcU); const d = h - t.hp; t.hp = 0; return d; };
  const rf = A.addU('rifle', 1, 46, 46); const dT = hit(tank, W.lcannon), dR = hit(rf, W.lcannon), dJ = hit(jet, W.jbomb);
  chk('marine takes 15% less from tanks than the same weapon from infantry*veh', Math.abs(dT / (dR * MAR.veh) - 0.85) < 0.01, `tank ${dT.toFixed(1)} vs ${(dR * MAR.veh).toFixed(1)}`);
  chk('marine takes 15% less from aircraft/bombers', Math.abs(dJ / hit(null, W.jbomb) - 0.85) < 0.01, 'bomb ' + dJ.toFixed(1));
  { const t = mk(), r2 = A.addU('rifle', 0, 40.3, 40); t.nb = 0; const h1 = t.hp, h2 = r2.hp; A.impact({ w: W.arty, x: 40, y: 40, z: 0.5, tz: 0.5, team: 1, tgt: null, src: null });
    const dm = h1 - t.hp, dr = (h2 - r2.hp) / DMG.shell.inf; chk('marine takes 45% less splash (secondary)', Math.abs(dm / (W.arty.dmg * DMG.shell.inf) - 0.55) < 0.02, `marine ${dm.toFixed(1)} vs base ${dr.toFixed(1)}`); }
}
// ===== 2. upgrade all =====
if (on('upgall')) {
  fresh('usa', 'rus'); tech(0); const ts = [0, 1, 2].map(i => A.addB('turret', 0, 30 + i * 2, 30, true)); A.G.time += 5; const P = A.G.players[0]; P.cr = UPG.turret[0][0] * 2 + 100; P.gas = 0;
  const n = A.execCmd(0, { c: 'upgall', b: [ts[2].id, ts[0].id, ts[1].id] });
  chk('Upgrade all upgrades as many as affordable, in the given (nearest-first) order', n === 2 && ts[2].upT != null && ts[0].upT != null && ts[1].upT == null, 'n=' + n + ' cr left ' + P.cr);
  const bs = [0, 1].map(i => A.addB('barracks', 0, 40 + i * 3, 50, true)); A.execCmd(0, { c: 'rally', b: bs.map(b => b.id), x: 45, y: 60 });
  chk('one rally command sets a shared rally point for all selected production buildings', bs.every(b => b.rally && b.rally.x === 45 && b.rally.y === 60));
}
// ===== 3. economy =====
if (on('eco')) {
  fresh('usa', 'rus'); A.G.derricks[0].owner = 0; const P = A.G.players[0], c0 = P.cr; run(10); const per = (P.cr - c0) / 10;
  chk('captured oil derrick pays out: 9 -> 11.25 $/s (+25%)', Math.abs(per - 11.25) < 0.01, per.toFixed(2) + ' $/s');
  chk('Ore Hauler $1400 -> $750, load 600 -> 360 (-40%), radius 0.6 -> 0.42', UT.harv.cost === 750 && HARV_CAP === 360 && UT.harv.r === 0.42);
  chk('ore patches +30% (ORE_MULT 11 -> 14.3)', ORE_MULT === 14.3);
  A.ensureFields(); const F = A.G.fields, dia = F.find(f => f.dia), home = F.find(f => !f.dia);
  chk('diamond fields exist away from starts, home fields stay normal', !!dia && !!home && F.filter(f => f.dia).every(f => A.G.starts.every(([x, y]) => Math.hypot(x - f.x, y - f.y) > DIA_DIST)), F.filter(f => f.dia).length + '/' + F.length + ' diamond');
  const loadOn = fld => { const ti = [...Array(MW * MH).keys()].find(i => A.G.fid[i] === fld.id && A.G.ore[i] > 500 && !A.G.rich[i]); const h = A.addU('harv', 0, ti % MW + 0.5, ((ti / MW) | 0) + 0.5); h.oreT = ti; h.fld = fld.id; h.hst = 'mine';
    for (let i = 0; i < 30 * 12 && h.hst === 'mine'; i++) { A.stepGame(); A.G.events.length = 0; } const v = h.loadV * ORE_VALUE; h.hp = 0; return v; };
  const vN = loadOn(home), vD = loadOn(dia);
  chk('normal load = $327.6 (was $546); diamond load = +$140', Math.abs(vN - 327.6) < 1 && Math.abs(vD - vN - 140) < 1, `normal $${vN.toFixed(1)}, diamond $${vD.toFixed(1)}`);
  // cap 4 per field + move on when full / depleted
  fresh('usa', 'rus'); tech(0); A.ensureFields(); const P0 = A.G.players[0], ref = A.G.ents.find(e => e.team === 0 && e.t === 'refinery');
  const hs = [0, 1, 2, 3, 4, 5].map(i => A.addU('harv', 0, ref.x + (i % 3) - 1, ref.y + 3 + (i / 3 | 0))); run(4);
  const cnt = {}; hs.forEach(h => { if (h.fld != null) cnt[h.fld] = (cnt[h.fld] || 0) + 1; });
  chk('max 4 haulers per ore field (6 haulers spread over >= 2 fields)', Object.values(cnt).every(n => n <= FIELD_CAP) && Object.keys(cnt).length >= 2, JSON.stringify(cnt));
  const f0 = hs[0].fld; for (let i = 0; i < MW * MH; i++) if (A.G.fid[i] === f0) { A.G.ore[i] = 0; A.G.oreMax[i] = 0; } run(4);
  chk('field depleted -> its haulers auto-move to the nearest field with room', hs.every(h => h.fld !== f0), hs.map(h => h.fld + ':' + h.hst).join(' '));
}
// ===== 4. SM-3 =====
if (on('sm3')) {
  fresh('usa', 'rus'); const hq = A.G.ents.find(e => e.team === 0 && e.t === 'hq'), P = A.G.players[0]; P.cr = 9000; P.gas = 900;
  chk('SM-3 needs a Research Lab', !A.upgradeB(hq)); tech(0, hq.x + 6, hq.y - 3); A.G.time += 2;
  chk('SM-3 upgrade bought on the Command Yard ($1800 + 200 gas)', A.upgradeB(hq) && P.cr === 9000 - SM3.cost); run(SM3.time + 1); chk('...and comes online', hq.sm3 === true);
  let ic = 0, hit = 0; const N = 400; for (let k = 0; k < N; k++) { const w = k % 2 ? W.rocket : W.arty; A.G.projs.push({ id: A.G.nid++, x: hq.x + 9.5, y: hq.y, z: 1, sx: hq.x + 9.5, sy: hq.y, w, team: 1, tgt: null, src: null, est: 0, home: false, tx: hq.x, ty: hq.y, tz: 0.5, delay: 0, kind: w.type });
    A.stepGame(); hq.hp = hq.mhp; for (const ev of A.G.events) { if (ev.e === 'icpt') ic++; } A.G.events.length = 0; }
  run(3); const pct = ic / N;
  chk('SM-3 shoots down ~50% of incoming rockets/artillery shells near the base', pct > 0.42 && pct < 0.58, (pct * 100).toFixed(1) + '% of ' + N);
  let mi = 0; hq.mhp = hq.hp = 1e7; for (let k = 0; k < 200; k++) { A.G.missiles = [{ id: A.G.nid++, team: 1, k: k % 3 ? 'small' : 'heavy', x0: hq.x + 60, y0: hq.y, x1: hq.x, y1: hq.y, t0: A.G.time, T: 6 }]; for (let i = 0; i < 30 * 7 && A.G.missiles.length; i++) { A.stepGame(); for (const ev of A.G.events) if (ev.e === 'intercept' && ev.sm3) mi++; A.G.events.length = 0; } hq.hp = hq.mhp; }
  chk('SM-3 shoots down ~50% of superweapon warheads/missiles too', mi / 200 > 0.38 && mi / 200 < 0.62, (mi / 2).toFixed(1) + '%');
  const sameRun = () => { fresh('usa', 'rus'); const h = A.G.ents.find(e => e.team === 0 && e.t === 'hq'); h.sm3 = true; let r = ''; for (let k = 0; k < 40; k++) { A.G.projs.push({ id: A.G.nid++, x: h.x + 9.5, y: h.y, z: 1, sx: h.x, sy: h.y, w: W.rocket, team: 1, tgt: null, src: null, est: 0, home: false, tx: h.x, ty: h.y, tz: 0.5, delay: 0, kind: 'rocket' }); A.stepGame(); r += A.G.events.some(e => e.e === 'icpt') ? 1 : 0; A.G.events.length = 0; } return r; };
  chk('intercept rolls use the seeded sim RNG (deterministic)', sameRun() === sameRun());
}
// ===== 5. Air Command =====
if (on('air')) {
  chk('Helipad removed, Airfield is now the 4x3 Air Command', !BT.airpad && BT.airfield.n === 'Air Command' && BT.airfield.w === 4 && BT.airfield.h === 3);
  chk('one queue builds every aircraft', Object.keys(UT).filter(k => UT[k].air && !UT[k].kami && !UT[k].hide).every(k => UT[k].from === 'airfield'), Object.keys(UT).filter(k => UT[k].air).map(k => k + ':' + UT[k].from).join(' ')); // v7.0: Iran's kamikaze drones come from the War Factory, the Raijin jet is a transform form
  fresh('usa', 'rus'); tech(0); const af = A.addB('airfield', 0, 60, 60, true); run(2);
  const jets = []; for (let i = 0; i < 6; i++) { const j = A.addU('jet', 0, 50 + i, 50); j.ammo = 0; j.hp = 100; jets.push(j); } run(25);
  const landed = () => jets.filter(j => j.js === 'landed').length; const l4 = landed();
  chk('4 dock slots: 4 jets land, the rest wait', l4 === 4, 'landed ' + l4 + '/6');
  chk('docked jets rearm + get repaired', jets.filter(j => j.js === 'landed' && j.ammo > 0 && j.hp > 300).length === 4, jets.map(j => j.js + '/' + j.ammo + '/' + Math.round(j.hp)).join(' '));
  A.G.players[0].cr = 5000; chk('Extra Pads add-on purchasable', A.upgradeB(af)); run(BT.airfield && AIRPADS.time + 22);
  chk('Extra Pads: 8 slots, all 6 jets docked', af.pads && landed() === 6, 'landed ' + landed());
  const slots = new Set(jets.map(j => j.dockK)); chk('every jet has its own slot', slots.size === 6);
}
// ===== 6/7. MBT + infantry =====
if (on('mbt')) {
  chk('Lancer+Bastion merged into one MBT', !UT.light && UT.heavy && UT.heavy.cost === 1050 && UT.heavy.hp === 590 && UT.heavy.sp === 1.8, UT.heavy.n);
  chk('Pyro and Field Medic removed', !UT.pyro && !UT.medic);
  chk('faction tanks kept', ['titan', 'tsar'].every(k => UT[k]));
  fresh('usa', 'rus'); const pw = A.G.ents.find(e => e.team === 0 && e.t === 'hq'); pw.hp = pw.mhp * 0.3; const en = A.addU('engineer', 0, pw.x + 3.5, pw.y + 2.5); run(40);
  chk('engineer auto-repairs a damaged building and is not used up', pw.hp > pw.mhp * 0.85 && en.hp > 0 && A.G.ents.includes(en), Math.round(pw.hp) + '/' + pw.mhp);
  pw.hp = pw.mhp; const tk = A.addU('heavy', 0, en.x + 1.5, en.y); tk.hp = 200; const h0 = tk.hp; run(5); const per = (tk.hp - h0) / 5;
  chk('engineer heals nearby units (slower than buildings)', per > 3 && per < UT.engineer.rep, per.toFixed(1) + ' hp/s vs ' + UT.engineer.rep + ' hp/s on buildings');
  // bots: build orders reference only existing types
  const bad = []; for (const arr of [AI_ORDER, AI_ORDER_CHIEF, AI_ORDER_SI, AI_ORDER_AIR]) for (const b of arr) if (!BT[b]) bad.push(b); chk('bot build orders only use existing buildings', !bad.length, bad.join(','));
  fresh('usa', 'rus', [0, 1], 5); for (let i = 0; i < 30 * 600; i++) { A.stepGame(); A.G.events.length = 0; }
  const ty = {}; A.G.ents.forEach(e => { if (e.kind === 'u') ty[e.t] = (ty[e.t] || 0) + 1; }); const af = A.G.ents.filter(e => e.t === 'airfield').length;
  chk('bots field MBTs and no removed units after 10 min', (ty.heavy || 0) > 0 && !ty.light && !ty.pyro && !ty.medic, JSON.stringify(ty) + ' aircmd=' + af);
}
// ===== 9. Howler siege =====
if (on('siege')) {
  chk('Howler mobile range cut 10 -> 7 (-30%)', W.arty.rng === 7);
  fresh('usa', 'rus'); const h = A.addU('arty', 0, 30, 40), t = A.addU('heavy', 1, 39, 40); t.stance = 'hold'; t.hp = t.mhp = 1e6; h.stance = 'hold'; run(4);
  chk('mobile Howler cannot reach a target 9 tiles away', t.hp === 1e6);
  A.execCmd(0, { c: 'siege', u: [h.id], on: 1 }); run(1); chk('deploying takes time (not sieged after 1 s, no fire)', h.sg === 1 && t.hp === 1e6);
  run(2.2); chk('sieged after ~3 s: range 10 + wider splash', h.sg === 2 && A.uW(h).rng === 10 && A.uW(h).splash > W.arty.splash, 'rng ' + A.uW(h).rng + ' splash ' + A.uW(h).splash);
  run(6); chk('sieged Howler hits the target at 9 tiles', t.hp < 1e6, 'dmg ' + (1e6 - t.hp).toFixed(0));
  const x0 = h.x; A.orderMove([h], 30, 46, false); run(1); chk('a move order packs up first (no movement while packing)', h.sg === 3 && Math.abs(h.x - x0) < 0.01);
  run(4); chk('...then drives off', !h.sg && Math.hypot(h.x - x0, h.y - 40) > 1, `${h.x.toFixed(1)},${h.y.toFixed(1)}`);
  // determinism + bots
  let sieged = 0; A.newGame({ seed: 9, diff: 'hard', aiTeams: [0, 1], fog: false, slots: [{ fac: 'usa', ally: 0, ai: 1, diff: 'hard' }, { fac: 'rus', ally: 1, ai: 1, diff: 'hard' }] }); for (let i = 0; i < 30 * 900; i++) { A.stepGame(); A.G.events.length = 0; if (i % 60 === 0) sieged = Math.max(sieged, A.G.ents.filter(e => e.t === 'arty' && e.sg === 2).length); }
  const arty = A.G.ents.filter(e => e.t === 'arty').length; chk('bots deploy Siege Mode in a bot-vs-bot game', sieged > 0, 'max sieged at once ' + sieged + ', howlers alive ' + arty);
  chk('bots research Lab tracks', A.G.players.some(P => P.rs && Object.keys(P.rs).length), JSON.stringify(A.G.players.map(P => P.rs || {})));
}
// ===== 10. Research Lab =====
if (on('research')) {
  fresh('usa', 'rus'); tech(0); const P = A.G.players[0]; P.cr = 20000; P.gas = 1000; const lab = A.G.ents.find(e => e.team === 0 && e.t === 'tech'); const tk = A.addU('heavy', 0, 40, 46); tk.hp = 295; run(2);
  chk('5 tracks', RES.cats.join() === 'tank,inf,air,arty,def');
  const c0 = P.cr; chk('L2 tanks: $1000, 60 s', A.researchB(lab, 'tank') && c0 - P.cr === 1000 && lab.upDur === 60);
  chk('one track per lab at a time', !A.researchB(lab, 'inf')); run(59); chk('not done before 60 s', A.rsLvl(0, 'tank') === 1); run(1.5);
  chk('L2 applies to existing units: HP +15% (hp fraction kept)', A.rsLvl(0, 'tank') === 2 && tk.mhp === Math.round(590 * 1.15) && Math.abs(tk.hp / tk.mhp - 0.5) < 0.02, tk.hp.toFixed(0) + '/' + tk.mhp);
  chk('...and damage +15%', A.uW(tk).dmg === Math.round(45 * 1.15), A.uW(tk).dmg);
  const nt = A.addU('heavy', 0, 41, 46); chk('new units get it too', nt.mhp === tk.mhp);
  const i3 = A.researchInfo(0, 'tank'); chk('L3 locked with one lab and no tech building', i3.lock && i3.cost === 2000 && i3.gas > 0 && !A.researchB(lab, 'tank'));
  const lab2 = A.addB('tech', 0, 50, 64, true); run(2); chk('2nd Research Lab unlocks L3 ($2000 + gas, 90 s)', A.researchB(lab2, 'tank') && lab2.upDur === 90); run(91);
  chk('L3 = +30% total', A.rsLvl(0, 'tank') === 3 && tk.mhp === Math.round(590 * 1.3) && A.uW(tk).dmg === Math.round(45 * 1.3), tk.mhp + ' / ' + A.uW(tk).dmg);
  const tr = A.G.ents.find(e => e.team === 0 && e.t === 'turret') || A.addB('turret', 0, 44, 70, true); A.researchB(lab, 'def'); run(61); chk('Defenses track boosts turrets', tr.mhp === Math.round(BT.turret.hp * 1.15));
}
console.log(ok ? 'V62 OK' : 'V62 FAIL'); process.exit(ok ? 0 : 1);
