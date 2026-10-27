// v4.2 regression: powered defenses auto-fire (all types, upgraded too); low power -> offline; production scaling; wall chains.
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n') + '\nglobalThis.A={newGame,stepGame,addB,addU,enqueue,queueCap,execCmd,get G(){return G}};');
let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
const slots = [{ ai: false, ally: 0, start: 0 }, { ai: false, ally: 1, start: 3 }];
function scen(def, enemy, powered, lvl) {
  A.newGame({ seed: 3, slots, fog: false }); const G = A.G; G.ents = G.ents.filter(e => e.t === 'hq');
  const b = A.addB(def, 0, 40, 40, true); if (lvl) b.lvl = lvl;
  if (powered) for (let i = 0; i < 3; i++) A.addB('power', 0, 30 + i * 3, 30, true); else A.addB('barracks', 0, 30, 30, true);
  const e = A.addU(enemy, 1, 44.5, 41); e.hold = true; const hp0 = e.hp;
  for (let i = 0; i < 30 * 8; i++) { e.x = 44.5; e.y = 41; e.path = []; A.stepGame(); }
  return { dmg: hp0 - e.hp, off: b.offline };
}
for (const [d, en, lvl] of [['turret', 'heavy'], ['turret', 'heavy', 3], ['aagun', 'gunship'], ['aagun', 'gunship', 3], ['gcannon', 'heavy']]) {
  const p = scen(d, en, true, lvl), u = scen(d, en, false, lvl);
  chk(p.dmg > 0 && !p.off, `${d}${lvl ? ' lvl' + lvl : ''} powered fires at ${en} (dmg ${Math.round(p.dmg)})`);
  chk(u.dmg === 0 && u.off === true, `${d}${lvl ? ' lvl' + lvl : ''} low power -> offline, no fire`);
}
// production scaling
A.newGame({ seed: 3, slots, fog: false }); let G = A.G, P = G.players[0]; P.cr = 1e6;
A.addB('power', 0, 8, 16, true); A.addB('power', 0, 4, 16, true); A.addB('barracks', 0, 14, 4, true); chk(A.queueCap(0, 'inf') === 6, 'inf cap 6 with 1 barracks');
A.addB('barracks', 0, 14, 8, true); A.addB('barracks', 0, 18, 8, true); chk(A.queueCap(0, 'inf') === 18, 'inf cap 18 with 3 barracks');
for (let i = 0; i < 18; i++) A.enqueue(0, 'rifle'); chk(P.queues.inf.length === 18, 'queued 18 rifles');
const n0 = G.ents.filter(e => e.t === 'rifle' && e.team === 0).length; for (let i = 0; i < 30 * (UT.rifle.time + 0.5); i++) A.stepGame();
console.log('rifles', G.ents.filter(e => e.t === 'rifle' && e.team === 0).length - n0, P.queues.inf.slice(0,4).map(q=>q.prog.toFixed(2))); chk(G.ents.filter(e => e.t === 'rifle' && e.team === 0).length - n0 === 3, '3 barracks build 3 rifles in parallel');
// defenses queue several
A.addB('power', 0, 20, 14, true); P.cr += 2000; for (let i = 0; i < 3; i++) A.execCmd(0, { c: 'build', t: 'turret', x: 14 + i * 2, y: 18 }); chk(G.ents.filter(e => e.t === 'turret' && e.con).length === 3, 'v7.2: place 3 turret sites at once (each paid up front)');
// wall chain via command
const cr0 = P.cr; A.execCmd(0, { c: 'walls', t: wallLine(16, 12, 20, 16) }); console.log('walls', G.ents.filter(e => e.t === 'wall').length, cr0 - P.cr); chk(G.ents.filter(e => e.t === 'wall').length === 5 && cr0 - P.cr === 250, 'diagonal wall chain of 5 built for $250');
console.log(ok ? 'DEFENSE TEST OK' : 'DEFENSE TEST FAIL'); process.exit(ok ? 0 : 1);
