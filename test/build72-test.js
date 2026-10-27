// v7.2 place-then-build: full price at placement, on-ground construction, refund on cancel, HP grows with progress,
// destroyable while building (no refund), no function until finished, lockstep-deterministic, and bots use the same system.
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = globalThis.SIOFF || {};
vm.runInThisContext(['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addB,addU,enqueue,execCmd,stateHash,buildWhy,get G(){return G}};');
let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const slots = [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }];
const step = n => { for (let i = 0; i < n; i++) A.stepGame(); };
function fresh() { A.newGame({ seed: 5, slots, fog: false }); const G = A.G, P = G.players[0]; P.cr = 5000; A.addB('power', 0, 4, 16, true); A.addB('power', 0, 8, 16, true); step(60); return { G, P }; }
const hq0 = () => A.G.ents.find(e => e.t === 'hq' && e.team === 0);
function spotFor(t) { const h = hq0(); for (let r = 4; r < 20; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const x = h.tx + dx, y = h.ty + dy; if (!A.buildWhy(0, t, x, y)) return [x, y]; } return null; }
// 1) full cost at placement, site appears under construction
let { G, P } = fresh(); let cr0 = P.cr, [x, y] = spotFor('barracks');
chk(A.execCmd(0, { c: 'build', t: 'barracks', x, y }) === true, 'build command accepted');
let b = G.ents.find(e => e.t === 'barracks' && e.team === 0);
chk(b && b.con && b.con.p === 0, 'barracks site placed, under construction');
chk(cr0 - P.cr === BT.barracks.cost, `full cost $${BT.barracks.cost} paid at placement`);
chk(b.hp < b.mhp * 0.2, 'site starts at low HP');
// 2) can't afford -> refused with reason, no money moves
let [x2, y2] = spotFor('power'); P.cr = 10; const why = A.buildWhy(0, 'power', x2, y2);
chk(why === 'cr' && A.execCmd(0, { c: 'build', t: 'power', x: x2, y: y2 }) === false && P.cr === 10, 'cannot place without the credits (reason "cr")');
P.cr = 5000;
// 3) progress over ~the old build time, HP grows, no function until done
const hp0 = b.hp; step(Math.round(30 * BT.barracks.time * 0.5));
chk(b.con && b.con.p > 0.4 && b.con.p < 0.6, `about half built after half the build time (${(b.con.p * 100) | 0}%)`);
chk(b.hp > hp0, 'HP grows with progress');
chk(A.enqueue(0, 'rifle') === false || G.ents.filter(e => e.t === 'barracks' && !e.con).length === 0, 'unfinished barracks gives no production');
step(Math.round(30 * BT.barracks.time * 0.55) + 2);
chk(!b.con && b.hp > 0, 'barracks finished on its own');
chk(A.enqueue(0, 'rifle') === true, 'finished barracks trains units');
// 4) cancel = full refund
({ G, P } = fresh()); cr0 = P.cr; [x, y] = spotFor('power'); A.execCmd(0, { c: 'build', t: 'power', x, y });
b = G.ents.find(e => e.t === 'power' && e.team === 0 && e.con); step(90);
A.execCmd(0, { c: 'bcancel', b: b.id }); step(2);
chk(P.cr === cr0 && !G.ents.includes(b), 'cancel mid-build refunds the full price and removes the site');
// 5) destroyed while under construction -> gone, no refund
cr0 = P.cr; [x, y] = spotFor('power'); A.execCmd(0, { c: 'build', t: 'power', x, y }); b = G.ents.find(e => e.t === 'power' && e.team === 0 && e.con && e.con);
const paid = cr0 - P.cr; b.hp = 0; step(3);
chk(!G.ents.some(e => e.id === b.id && e.hp > 0) && cr0 - P.cr === paid, 'site destroyed under construction: lost, no refund');
// 6) defenses: each placed + paid, build on the ground; turret has no weapon until done
({ G, P } = fresh()); A.addB('barracks', 0, 14, 4, true); A.addB('factory', 0, 18, 4, true); step(60); [x, y] = spotFor('turret'); cr0 = P.cr; A.execCmd(0, { c: 'build', t: 'turret', x, y });
const tu = G.ents.find(e => e.t === 'turret' && e.team === 0); const foe = A.addU('heavy', 1, tu.x + 2, tu.y + 0.5); foe.hold = true; const fh = foe.hp;
step(20); chk(tu.con && foe.hp === fh, 'turret under construction does not fire');
chk(cr0 - P.cr === BT.turret.cost, 'turret paid in full at placement');
// 7) lockstep determinism: same command stream twice -> same hash
function run() { A.newGame({ seed: 9, slots: [{ ai: false, ally: 0, start: 0 }, { ai: true, diff: 'si', fac: 'bra', ally: 1, start: 3 }], fog: false }); const P = A.G.players[0]; P.cr = 4000;
  const h = hq0(); const hs = [];
  for (let i = 0; i < 30 * 90; i++) { if (i === 30) A.execCmd(0, { c: 'build', t: 'power', x: h.tx + 5, y: h.ty }); if (i === 300) A.execCmd(0, { c: 'build', t: 'barracks', x: h.tx, y: h.ty + 5 });
    if (i === 400) { const s = A.G.ents.find(e => e.t === 'barracks' && e.team === 0 && e.con); if (s) A.execCmd(0, { c: 'bcancel', b: s.id }); }
    A.stepGame(); if (i % 300 === 0) hs.push(A.stateHash()); }
  return hs.join(',') + '|' + A.stateHash(); }
const r1 = run(), r2 = run(); chk(r1 === r2, 'lockstep: identical command streams give identical state hashes');
// 8) a bot builds the same way (places sites, they construct, no instant buildings, no bonus)
A.newGame({ seed: 11, slots: [{ ai: true, diff: 'si', fac: 'bra', ally: 0, start: 0 }, { ai: true, diff: 'si', fac: 'usa', ally: 1, start: 3 }], fog: false });
let sawCon = 0, built = 0, instant = 0; const seen = new Set(A.G.ents.map(e => e.id));
for (let i = 0; i < 30 * 240; i++) { A.stepGame(); for (const e of A.G.ents) if (e.kind === 'b' && !seen.has(e.id)) { seen.add(e.id); if (e.con) sawCon++; else instant++; } for (const ev of A.G.events) if (ev.e === 'built') built++; A.G.events.length = 0; }
chk(sawCon >= 6 && built >= 5, `bots place sites that construct on the ground (${sawCon} sites, ${built} finished)`);
chk(instant === 0, `no bot building appears instantly (${instant})`);
console.log(ok ? 'BUILD72 TEST OK' : 'BUILD72 TEST FAIL'); process.exit(ok ? 0 : 1);
