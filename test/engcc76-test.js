// v7.6 rule drill: engineer founds a new Command Center once a side has no yard left (players: rule check; Hard bot: recovers by itself)
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = {};
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addU,placeBuild,canPlace,avail,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// 1) player rule
A.newGame({ seed: 4, map: 'classic', slots: [{ fac: 'usa', ally: 0 }, { ai: true, diff: 'normal', fac: 'rus', ally: 1 }] });
let G = A.G, P = G.players[0]; P.cr = 5000;
const hq = G.ents.find(e => e.team === 0 && e.t === 'hq');
const eng = A.addU('engineer', 0, hq.x + 8, hq.y + 8);
hq.hp = 0; for (let i = 0; i < 5; i++) { A.stepGame(); G.events.length = 0; }
ok(A.avail(0, 'cc'), 'no yard + engineer: Command Center is available');
const fx = Math.round(eng.x - 1.5), fy = Math.round(eng.y - 1.5);
ok(!A.canPlace('cc', 0, fx + 25, fy), 'spot far from the engineer is refused');
let near = null; for (let r = 1; r <= 6 && !near; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (!near && A.canPlace('cc', 0, fx + dx, fy + dy)) near = [fx + dx, fy + dy];
ok(!!near, 'spot next to the engineer is allowed');
const cr0 = P.cr, b = near && A.placeBuild(0, 'cc', near[0], near[1]);
ok(!!b && cr0 - P.cr === BT.cc.cost, 'same price ($' + BT.cc.cost + ')');
for (let i = 0; i < 4; i++) { A.stepGame(); G.events.length = 0; }
ok(eng.hp <= 0 || !G.ents.includes(eng), 'engineer is used up');
for (let i = 0; i < 30 * 30 && b.con; i++) { A.stepGame(); G.events.length = 0; }
ok(b.hp > 0 && !b.con, 'Command Center finishes building without a yard');
// 2) old rules (replays without r76): no engineer founding
A.newGame({ seed: 4, map: 'classic', r76: 0, slots: [{ fac: 'usa', ally: 0 }, { ai: true, diff: 'normal', fac: 'rus', ally: 1 }] }); G = A.G;
const h2 = G.ents.find(e => e.team === 0 && e.t === 'hq'); A.addU('engineer', 0, h2.x + 8, h2.y + 8); h2.hp = 0; for (let i = 0; i < 5; i++) { A.stepGame(); G.events.length = 0; }
ok(!A.avail(0, 'cc'), 'r76 off (old replays): rule not active');
// 3) Hard bot recovers: wipe its yards at 8:00, keep the rest
A.newGame({ seed: 7, map: 'classic', slots: [{ ai: true, diff: 'si2', fac: 'usa', ally: 0 }, { ai: true, diff: 'normal', fac: 'rus', ally: 1 }] }); G = A.G;
for (let n = 0; n < 30 * 480; n++) { A.stepGame(); G.events.length = 0; }
for (const e of G.ents) if (e.team === 0 && (e.t === 'hq' || e.t === 'cc')) e.hp = 0;
let got = null; for (let n = 0; n < 30 * 120 && !got; n++) { A.stepGame(); for (const e of G.events) if (e.e === 'engCC' && e.team === 0) got = G.time; G.events.length = 0; }
ok(got != null && got - 480 < 90, 'Hard bot founds a new Command Center with an engineer after losing every yard (' + (got ? (got - 480).toFixed(0) + ' s' : 'never') + ')');
console.log(fail ? 'ENGCC FAIL ' + fail : 'ENGCC OK'); process.exit(fail ? 1 : 0);
