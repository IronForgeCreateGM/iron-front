// v5.7.1: human in slot 8 (Volcano XL) + bot endgame must never hijack the human's units; ordered engineer captures a nearby derrick.
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const sA = [0, 2, 4, 6], sB = [3, 1, 5, 7], slots = [];
for (let i = 0; i < 4; i++) { slots.push({ ai: true, diff: ['si', 'chief', 'hard', 'si'][i], ally: 0, start: sA[i], fac: 'usa' }); slots.push({ ai: i !== 3, diff: ['hard', 'si', 'chief', 'normal'][i], ally: 1, start: sB[i], fac: 'rus' }); }
const HUM = 7; globalThis.ME = HUM; A.newGame({ seed: 21, map: 'volcano8', slots, fog: true });
const G = () => A.G, P = A.G.players[HUM], hq = A.G.ents.find(e => e.team === HUM && e.t === 'hq'), st = A.G.starts[P.start];
ok(!P.ai && P.start === 7 && P.ally === 1 && hq && Math.hypot(hq.x - st[0], hq.y - st[1]) < 4, `slot 8 human gets start 8 (team B) base at (${hq.x},${hq.y})`);
const vents = (A.G.vents || []).filter(v => Math.hypot(v[0] - hq.x, v[1] - hq.y) < 16).length; ok(vents >= 2, 'slot 8 base has ' + vents + ' gas vents nearby');
for (let i = 0; i < 300 * 30; i++) { A.stepGame(); A.G.events.length = 0; }
A.G.time += 1100; // jump into the bot endgame (all-in / idle-watchdog phase) without simulating 18 more minutes
for (let i = 0; i < 20 * 30; i++) { A.stepGame(); A.G.events.length = 0; }
const allIn = A.G.players.filter(Q => Q.ai && Q.aiS && Q.aiS.allIn).length; ok(allIn >= 4, 'bots are in endgame all-in mode: ' + allIn);
const dk = A.G.derricks.filter(d => d.owner !== HUM).sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
const eng = spawnUnit(HUM, 'engineer', hq), rif = [0, 1, 2].map(() => spawnUnit(HUM, 'rifle', hq)); A.stepGame();
const tx = hq.x + (dk.x > hq.x ? -5 : 5), ty = hq.y;
execCmd(HUM, { c: 'derrick', u: [eng.id], k: dk.id }); execCmd(HUM, { c: 'move', u: rif.map(u => u.id), x: tx, y: ty });
let maxOff = 0;
for (let i = 0; i < 60 * 30 && dk.owner !== HUM; i++) { A.stepGame(); A.G.events.length = 0; if (eng.hp > 0 && eng.order !== 'derrick') { ok(false, 'engineer order hijacked -> ' + eng.order); break; } }
ok(dk.owner === HUM, `ordered engineer captured derrick ${dk.id} (${Math.hypot(dk.x - hq.x, dk.y - hq.y).toFixed(0)} tiles from base) at t=${(A.G.time | 0)}`);
let hij = 0; for (let i = 0; i < 15 * 30; i++) { A.stepGame(); A.G.events.length = 0; for (const u of rif) if (u.hp > 0 && u.order !== 'idle' && u.order !== 'move') hij++; }
// v7.6.7: bot armies on attack-move now keep pushing after a fight, so the riflemen can be killed by an enemy all-in at the base; dying is not a hijack -> check every tick they were alive
const live = rif.filter(u => u.hp > 0); for (const u of live) maxOff = Math.max(maxOff, Math.hypot(u.x - tx, u.y - ty));
ok(!hij && maxOff < 4 && live.every(u => u.order === 'idle' || u.order === 'move'), `human riflemen stay where ordered (max ${maxOff.toFixed(1)} tiles off, orders ${live.map(u => u.order)}, alive ${live.length}/3)`);
console.log(fail ? 'HUMAN-ORDER FAIL' : 'HUMAN-ORDER OK'); process.exit(fail ? 1 : 0);
