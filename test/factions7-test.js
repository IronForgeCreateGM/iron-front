// v7.0 factions: Iran Shahed drones, China Great Wall, Japan Raijin Mech (+ bots use the specials). node test/factions7-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js', 'endless.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,execCmd,enqueue,avail,orderMove,orderAttack,xform,blk,isAir,stateHash,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < Math.round(s * 30); i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh(fa, fb, seed) { A.newGame({ seed: seed || 3, fog: false, slots: [{ fac: fa || 'irn', ally: 0, ai: false }, { fac: fb || 'usa', ally: 1, ai: false }] }); A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); }
const models = fs.readFileSync(path.join(__dirname, '../js/gfx/models.js'), 'utf8');
// --- roster
for (const [k, sp] of [['irn', 'drone'], ['chn', 'gtower'], ['jpn', 'raijin']]) { const F = FACTIONS[k]; chk(`${F && F.n}: flag, special, description, unique model`, F && F.flag && F.sp === sp && F.desc.length > 60 && new RegExp('\\b' + sp + '\\b').test(models), F && F.flag + ' ' + sp); }
chk('8 factions incl. Brazil (OP-ish main) and France untouched', FACTIONS.bra && FACTIONS.fra && Object.keys(FACTIONS).length >= 8, Object.keys(FACTIONS).join(','));
// ===== Iran
fresh('irn'); let G = A.G; const f0 = A.addB('factory', 0, 30, 30, true); A.addB('power', 0, 26, 30, true); A.addB('power', 0, 26, 33, true); G.players[0].cr = 5000;
chk('Iran can build the drone; other factions cannot', A.avail(0, 'drone') && !A.avail(1, 'drone'));
A.enqueue(0, 'drone'); run(12); let dr = G.ents.filter(u => u.t === 'drone' && u.team === 0);
chk('one order = a batch of 3 drones', dr.length === 3, dr.length + ' drones, cost $' + UT.drone.cost);
chk('drones are aircraft (AA can target them)', dr.every(u => A.isAir(u)));
fresh('irn'); G = A.G; { const d = A.addU('drone', 0, 20, 40), blob = [0, 1, 2, 3].map(i => A.addU('rifle', 1, 26 + (i % 2) * 0.6, 40 + (i >> 1) * 0.6)); blob.forEach(u => u.stance = 'hold'); A.orderAttack([d], blob[0]); run(4);
  const hurt = blob.filter(u => u.hp < u.mhp || !G.ents.includes(u)).length; chk('drone dives in and explodes with splash (whole blob damaged)', !G.ents.includes(d) && hurt === 4, hurt + '/4 hit'); }
fresh('irn'); G = A.G; { const d = A.addU('drone', 0, 20, 40); A.addU('rifle', 1, 26, 40).stance = 'hold'; let seen = false; for (let i = 0; i < 90; i++) { A.stepGame(); for (const e of G.events) if (e.e === 'kami') seen = true; G.events.length = 0; } chk('idle drone auto-acquires a target in sight', seen); }
fresh('irn'); G = A.G; { const ds = [0, 1, 2].map(i => A.addU('drone', 0, 14, 39 + i)), t = A.addB('power', 1, 34, 39, true); A.addU('aa', 1, 26, 40).stance = 'hold'; A.addU('aa', 1, 27, 41).stance = 'hold'; A.orderAttack(ds, t); let boom = 0; for (let i = 0; i < 30 * 8; i++) { A.stepGame(); for (const e of G.events) if (e.e === 'kami') boom++; G.events.length = 0; }
  chk('anti-air shoots drones down before they reach the target', boom < 3 && ds.filter(u => G.ents.includes(u)).length === 0, `${3 - boom}/3 shot down`); }
// ===== China
fresh('chn', 'usa'); G = A.G; G.players[0].cr = 9999; const ws = []; for (let i = 0; i < 10; i++) ws.push(A.addB('wall', 0, 20 + i, 50, true));
chk('China: every 5th wall piece becomes a Guard Tower', ws.filter(b => b.t === 'gtower').length === 2 && ws[4].t === 'gtower' && ws[9].t === 'gtower');
chk('China walls have +60% HP', ws[0].mhp === Math.round(BT.wall.hp * 1.6), ws[0].mhp + ' vs ' + BT.wall.hp);
const uw = []; for (let i = 0; i < 10; i++) uw.push(A.addB('wall', 1, 20 + i, 60, true)); chk('other factions: plain walls, no towers', uw.every(b => b.t === 'wall' && b.mhp === BT.wall.hp));
chk('Guard Tower is not in the build menu (only via walls), needs no power', BT.gtower.hide && BT.gtower.pow === 0);
{ const r = A.addU('rifle', 1, 22, 53), j = A.addU('jet', 1, 26, 47); r.stance = 'hold'; j.stance = 'hold'; const h0 = r.hp, hj = j.hp; run(3); chk('Guard Tower fires at ground and air', r.hp < h0 && j.hp < hj, `rifle ${h0}->${Math.max(0, r.hp | 0)}, jet ${hj}->${Math.max(0, j.hp | 0)}`); }
// v7.0.2 guard tower = garrisoned squad (Rifleman, Sniper, Rocketeer, Iron Marine), real weapons, longer range
chk('v7.0.2 Guard Tower garrison uses the real infantry weapons', JSON.stringify(GT_SQUAD.w) === JSON.stringify([UT.rifle.wpn, UT.sniper.wpn, UT.rocketeer.wpn, UT.marine.wpn]) && BT.gtower.squad, GT_SQUAD.w.join(','));
chk('tower range is beyond the sniper (old 5.5)', W.snipe.rng + GT_SQUAD.rng > W.snipe.rng && W.snipe.rng + GT_SQUAD.rng >= 10 && W.gtow.rng === W.snipe.rng + GT_SQUAD.rng && BT.gtower.sight >= W.gtow.rng, 'range ' + W.gtow.rng);
{ fresh('chn', 'usa'); G = A.G; let tw; for (let i = 0; i < 5; i++) tw = A.addB('wall', 0, 20 + i, 50, true); tw.born = -10;
  const far = A.addU('rifle', 1, 22.5, 50.5 + 9.6), tank = A.addU('heavy', 1, 28.5, 50.5);[far, tank].forEach(u => u.stance = 'hold');
  const kinds = {}, h = [far.hp, tank.hp]; for (let i = 0; i < 30 * 4; i++) { A.stepGame(); for (const e of G.events) if (e.e === 'fire' && e.src === tw) kinds[e.w.type] = (kinds[e.w.type] || 0) + 1; G.events.length = 0; }
  chk('tower fires all four weapon profiles (bullet, snipe, rocket, marine)', kinds.bullet && kinds.snipe && kinds.rocket && kinds.marine, JSON.stringify(kinds));
  chk('sniper reaches a rifleman 9.6 tiles out (old tower: 5.5)', far.hp < h[0] || !G.ents.includes(far), 'hp ' + h[0] + '->' + (far.hp | 0));
  chk('rockets hurt a tank', tank.hp < h[1], `tank ${h[1]}->${tank.hp | 0}`); }
{ fresh('chn', 'usa'); G = A.G; let tw; for (let i = 0; i < 5; i++) tw = A.addB('wall', 0, 20 + i, 50, true); const ts = [0, 1, 2, 3].map(i => A.addU('heavy', 1, 20 + i, 60)); A.orderAttack(ts, tw); run(40);
  chk('still beatable: 4 tanks take a guard tower down', tw.hp <= 0 || !G.ents.includes(tw), 'tower hp ' + (tw.hp | 0)); }
// ===== Japan
fresh('jpn', 'usa'); G = A.G; const rj = A.addU('raijin', 0, 20, 40);
chk('Raijin Mech: Japan-only, needs Tech Center', A.avail(0, 'raijin') === false && UT.raijin.req.includes('tech') && UT.raijin.fac === 'jpn');
chk('mech is a ground heavy with a chain-lightning cannon', !A.isAir(rj) && UT.raijin.armor === 'heavy' && W[UT.raijin.wpn].chain);
chk('transform command (T / ⚡) accepted', A.execCmd(0, { c: 'xform', u: [rj.id] }) === 1);
chk('enemy cannot transform my mech', A.execCmd(1, { c: 'xform', u: [rj.id] }) === 0);
run(0.5); chk('transforming takes time (immobile during)', rj.xfT != null);
run(1.2); chk('after 1.5 s it is a jet (air)', rj.t === 'raijinJ' && A.isAir(rj) && rj.xfT == null);
chk('cooldown blocks instant re-transform', A.xform(rj) === false); run(3.1);
// wall line between x=24..: jet flies over it
for (let y = 30; y < 52; y++) A.addB('wall', 1, 25, y, true);
A.orderMove([rj], 32, 40); run(4); chk('jet flies straight over a wall line', rj.x > 30, 'x ' + rj.x.toFixed(1));
A.orderMove([rj], 25.5, 40.5); run(3); A.xform(rj); run(2); chk('landing on a wall touches down beside it', rj.t === 'raijin' && !A.blk(rj.x, rj.y));
{ fresh('jpn', 'usa'); G = A.G; const m = A.addU('raijin', 0, 20, 40); A.orderMove([m], 40, 40); run(0.5); A.xform(m); run(4); chk('a move order continues after transforming', m.x > 28, 'x ' + m.x.toFixed(1)); }
{ fresh('jpn', 'usa'); G = A.G; const m = A.addU('raijin', 0, 20, 40), t = A.addU('heavy', 1, 24, 40); t.stance = 'hold'; const h = t.hp; run(3); chk('mech lightning cannon hurts tanks', t.hp < h, `${h}->${t.hp | 0}`); }
// ===== bots use the specials (hard bots, 16 min, no bonuses)
const botGame = (fa, fb, seed, mins) => { A.newGame({ seed, fog: true, slots: [{ ai: true, diff: 'hard', ally: 0, fac: fa }, { ai: true, diff: 'hard', ally: 1, fac: fb }] }); const st = { kami: 0, xform: 0, max: {} };
  for (let i = 0; i < 30 * 60 * mins && !A.G.over; i++) { A.stepGame(); for (const e of A.G.events) { if (e.e === 'kami') st.kami++; if (e.e === 'xform') st.xform++; } A.G.events.length = 0;
    if (i % 300 === 0) for (const t of ['drone', 'raijin', 'raijinJ', 'gtower', 'wall']) { const n = A.G.ents.filter(e => e.t === t && e.team === 0 && e.hp > 0).length; st.max[t] = Math.max(st.max[t] || 0, n); } } return st; };
let s = botGame('irn', 'chn', 3, 16); chk('Iran bot builds drone batches and uses them', s.max.drone >= 3 && s.kami >= 5, JSON.stringify(s));
s = botGame('chn', 'irn', 3, 16); chk('China bot builds wall lines with guard towers', s.max.gtower >= 2 && s.max.wall >= 8, JSON.stringify(s.max));
s = botGame('jpn', 'bra', 4, 16); chk('Japan bot builds Raijins and transforms them', (s.max.raijin || 0) + (s.max.raijinJ || 0) >= 1 && s.xform >= 2, JSON.stringify(s));
console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
