// v7.1: Chief SI allies back a human ally's push. node test/ai71-human-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
globalThis.SIOFF = {}; const J = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(J).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};');
A.newGame({ seed: 5, map: 'volcano', slots: [{ ai: false, fac: 'bra', ally: 0 }, { ai: true, diff: 'si', fac: 'rus', ally: 0 }, { ai: true, diff: 'normal', fac: 'ger', ally: 1 }, { ai: true, diff: 'normal', fac: 'irn', ally: 1 }] });
const G = A.G; let us = [], pushed = false, backed = 0, backT = null, ackT = null;
for (let n = 0; n < 11 * 60 * 30 && !G.over; n++) {
  A.stepGame();
  for (const ev of G.events) if (ev.e === 'allyAck' && ev.team === 1 && pushed && ackT == null) ackT = G.time; G.events.length = 0;
  if (!pushed && G.time >= 420) { pushed = true; const s0 = G.starts[G.players[0].start], hq = G.ents.find(e => e.team === 0 && e.kind === 'b' && e.hp > 0) || { x: s0[0], y: s0[1], ty: s0[1], h: 2 }; for (let k = 0; k < 12; k++) us.push(spawnUnit(0, 'heavy', hq));
    const E = G.players.filter(Q => Q.ally === 1).map(Q => G.starts[Q.start]).sort((a, b) => Math.hypot(a[0] - hq.x, a[1] - hq.y) - Math.hypot(b[0] - hq.x, b[1] - hq.y))[0]; orderMove(us, E[0], E[1], true); }
  if (pushed && n % 30 === 0 && backT == null) { const S = G.players[1].aiS, p = G.tp71 && G.tp71[0]; const al = us.filter(u => u.hp > 0), cx = al.length ? al.reduce((s, u) => s + u.x, 0) / al.length : -99, cy = al.length ? al.reduce((s, u) => s + u.y, 0) / al.length : -99; const nb = (S.grp || []).filter(u => Math.hypot(u.x - cx, u.y - cy) < 14).length; if (nb >= 4 && (p && p.hum || S.grpWp)) { backT = G.time; backed = nb; } }
}
console.log('human push at 420s; ally SI backed at', backT && backT.toFixed(0), 'with', backed, 'units; ack', ackT && ackT.toFixed(0));
ok(backT != null && backT - 420 < 120, 'Chief SI ally joins a human push within 2 min (' + backed + ' units)');
process.exit(fail ? 1 : 0);
