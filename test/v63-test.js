// v6.3 checks: Seraph Medevac (heal beam, no stacking, load/unload, bot use). node test/v63-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,execCmd,damage,cargoUsed,medevacMgr,aiStep:typeof aiStep!=="undefined"?aiStep:null,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
const run = s => { for (let i = 0; i < Math.round(s * 30); i++) { A.stepGame(); A.G.events.length = 0; } };
function fresh(seed) { A.newGame({ seed: seed || 3, fog: false, slots: [{ fac: 'usa', ally: 0, ai: false }, { fac: 'rus', ally: 1, ai: false }] }); A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); }
const M = UT.medevac;
chk('Hauler Transport replaced by Seraph Medevac (same 8-slot cap, airfield, tech req)', !UT.hauler && M.n === 'Seraph Medevac' && M.cap === 8 && M.from === 'airfield' && M.req.includes('tech') && M.air && M.armor === 'air', `hp ${M.hp} $${M.cost}`);
chk('balance: radius 2.5, 12 HP/s per target, max 3 beams, fragile (560 HP vs old 1000)', MEDEVAC.r === 2.5 && MEDEVAC.hps === 12 && MEDEVAC.max === 3 && M.hp === 560);
// --- healing works
fresh(); const md = A.addU('medevac', 0, 40, 40), r = A.addU('rifle', 0, 40.5, 40.3); r.hp = r.mhp * 0.3; const h0 = r.hp; run(2);
const g = r.hp - h0; chk('damaged rifle under the craft heals ~12 HP/s', Math.abs(g - 24) <= 6.1, `+${g.toFixed(1)} HP in 2s`);
chk('craft reports the beam target (for the green beam FX)', (md.beams || []).includes(r.id));
run(30); chk('heals to full over time and never above max', r.hp === r.mhp, r.hp + '/' + r.mhp);
chk('no beam once the target is full', !(md.beams || []).length);
const tk = A.addU('heavy', 0, 41, 41); tk.hp = 100; run(2); chk('vehicles are healed too', tk.hp > 100 + 18, tk.hp.toFixed(1));
const far = A.addU('rifle', 0, 44, 40); far.hp = 20; run(2); chk('units outside the 2.5-tile radius are not healed', far.hp === 20);
const en = A.addU('rifle', 1, 40.2, 39.6); en.stance = 'hold'; en.hp = 20; const jet = A.addU('jet', 0, 40, 40.5); jet.hp = 50; const b = A.addB('power', 0, 39, 39, true); b.hp = 10;
run(1); chk('enemies, aircraft and buildings are not healed', en.hp <= 20 && jet.hp === 50 && b.hp <= 10, `${en.hp} ${jet.hp} ${b.hp}`);
// --- no stacking + beam cap
fresh(); const m1 = A.addU('medevac', 0, 40, 40), m2 = A.addU('medevac', 0, 40.3, 40), m3 = A.addU('medevac', 0, 39.8, 40.2), t1 = A.addU('rifle', 0, 40.1, 40.1); t1.hp = 20; run(2);
chk('3 medevacs over one rifle heal it no faster than one (no stacking)', Math.abs(t1.hp - 20 - 24) <= 6.1, `+${(t1.hp - 20).toFixed(1)} HP in 2s`);
chk('only one craft beams a given target per heal window', [m1, m2, m3].filter(m => (m.beams || []).includes(t1.id)).length === 1);
fresh(); const mm = A.addU('medevac', 0, 40, 40), five = [0, 1, 2, 3, 4].map(i => { const u = A.addU('rifle', 0, 39.4 + i * 0.3, 40.4); u.hp = 20; return u; }); run(1);
chk('one craft beams at most 3 targets at once', (mm.beams || []).length === 3 && five.filter(u => u.hp > 20).length === 3, five.map(u => u.hp.toFixed(0)).join(','));
const m4 = A.addU('medevac', 0, 40.2, 40); run(1); chk('a second craft picks up the other wounded (2 crafts -> all 5 healed)', five.every(u => u.hp > 20));
// --- load / unload via commands
fresh(); const tr = A.addU('medevac', 0, 30, 30), inf = [0, 1, 2, 3, 4, 5].map(i => A.addU('rifle', 0, 33 + i * 0.4, 32)), vh = A.addU('heavy', 0, 28, 33);
chk('one-click board command accepted', A.execCmd(0, { c: 'board', u: inf.concat(vh).map(u => u.id), tr: tr.id }) !== false); run(14);
chk('6 rifles boarded, tank does not fit (6+4 > 8)', tr.cargo.length === 6 && A.cargoUsed(tr) === 6 && A.G.ents.includes(vh), 'used ' + A.cargoUsed(tr));
inf.forEach(u => u.hp = 30); run(3); chk('passengers are not healed in the cargo bay (no beam inside)', inf.every(u => u.hp === 30));
A.execCmd(0, { c: 'unload', tr: tr.id, x: tr.x, y: tr.y }); run(4);
chk('Unload all drops every passenger at the craft', tr.cargo.length === 0 && inf.every(u => A.G.ents.includes(u) && Math.hypot(u.x - tr.x, u.y - tr.y) < 3.5));
run(2); chk('...and the unloaded wounded are healed by the craft', inf.filter(u => u.hp > 30).length === 3);
chk('enemy cannot unload my craft', A.execCmd(1, { c: 'unload', tr: tr.id, x: 10, y: 10 }) === false);
// --- fragile vs AA
fresh(); const fm = A.addU('medevac', 0, 40, 40), fl = A.addU('aa', 1, 43, 41); let tDie = -1; for (let i = 0; i < 30 * 40 && tDie < 0; i++) { A.stepGame(); A.G.events.length = 0; if (fm.hp <= 0 || !A.G.ents.includes(fm)) tDie = i / 30; }
chk('fragile: a single Skyguard AA vehicle downs it', tDie > 0, 'in ' + tDie.toFixed(1) + 's');
// --- bot AI parks it over its hurt troops
fresh(); const P = A.G.players[0], hq = A.G.ents.find(e => e.t === 'hq' && e.team === 0), bm = A.addU('medevac', 0, hq.x + 2, hq.y + 2);
const army = [...Array(10).keys()].map(i => A.addU('rifle', 0, 50 + (i % 5) * 0.5, 55 + (i / 5 | 0) * 0.5)); army.slice(0, 6).forEach(u => u.hp = 25);
P.diff = 'hard'; A.medevacMgr(P, {}, {}, A.G.ents.filter(e => e.team === 0 && e.kind === 'u'), hq); run(25);
chk('bot medevac flies to its wounded cluster and heals it', Math.hypot(bm.x - 51, bm.y - 55.3) < 3 && army.slice(0, 6).some(u => u.hp > 25), `at ${bm.x.toFixed(1)},${bm.y.toFixed(1)}`);
bm.hp = 100; A.medevacMgr(P, {}, {}, A.G.ents.filter(e => e.team === 0 && e.kind === 'u'), hq); chk('bot pulls a badly damaged medevac back to base', bm.order === 'move');
// --- determinism
const sig = () => { fresh(7); const a = A.addU('medevac', 0, 40, 40), x = [0, 1, 2].map(i => { const u = A.addU('rifle', 0, 40 + i * 0.4, 40); u.hp = 10 + i; return u; }); A.addU('medevac', 0, 40.5, 40); run(3); return x.map(u => u.hp.toFixed(4)).join(','); };
const s1 = sig(), s2 = sig(); chk('healing is deterministic (lockstep-safe)', s1 === s2, s1);
console.log(ok ? 'V63 OK' : 'V63 FAIL'); process.exit(ok ? 0 : 1);
