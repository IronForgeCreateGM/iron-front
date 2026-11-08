// v7.8.8 f80 drills: idle air-stack flank strike + Grand Cannon nuke punish
// node test/f80-air-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
globalThis.SIOFF = globalThis.SIOFF || {};
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };

function nearPlace(t, team, hx, hy) {
  for (let r = 4; r < 24; r++) {
    for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
      const x = Math.floor(hx) + dx, y = Math.floor(hy) + dy;
      if (inb(x, y) && typeof canPlace === 'function' && canPlace(t, team, x, y)) return addB(t, team, x, y, true);
    }
    for (let dy = -r + 1; dy < r; dy++) for (const dx of [-r, r]) {
      const x = Math.floor(hx) + dx, y = Math.floor(hy) + dy;
      if (inb(x, y) && typeof canPlace === 'function' && canPlace(t, team, x, y)) return addB(t, team, x, y, true);
    }
  }
  return null;
}

function boot(f80, facB) {
  newGame({ seed: 5, map: 'classic', fog: false, peace: 0, r76: 1, nt: 1, m7: 2, f79: 1, f80,
    slots: [{ ai: true, diff: 'si2', fac: 'usa', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: facB || 'rus', start: 3, ally: 1 }] });
  for (let i = 0; i < 8; i++) stepGame();
  return G.players[0];
}

function hqOf(team) { return G.ents.find(e => e.team === team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0); }

// ---------- 1) idle air mass launches a back-of-base flank strike at infrastructure ----------
{
  const P = boot(1, 'rus');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 20000; P.gas = 3000; P.pow = 200;
  const jets = [], ints = [];
  for (let i = 0; i < 12; i++) {
    const u = addU('jet', 0, h0.x + (i % 4) - 1.5, h0.y + ((i / 4) | 0) - 1);
    u.js = 'fly'; u.ammo = W.jbomb.ammo; u.order = 'idle'; u.path = []; jets.push(u);
  }
  for (let i = 0; i < 8; i++) {
    const u = addU('intercept', 0, h0.x + (i % 4) + 0.5, h0.y + ((i / 4) | 0) + 0.5);
    u.js = 'fly'; u.ammo = W.aam.ammo; u.order = 'idle'; u.path = []; ints.push(u);
  }
  const power = nearPlace('power', 1, h1.x, h1.y);
  const ref = nearPlace('refinery', 1, h1.x, h1.y);
  const silo = nearPlace('silo', 1, h1.x, h1.y);
  // flak on the FRONT face (between the two yards) so a straight-in path is the dangerous one
  const fx = h0.x + (h1.x - h0.x) * 0.62, fy = h0.y + (h1.y - h0.y) * 0.62;
  const aa = []; for (const [dx, dy] of [[0, 0], [2, 1], [-2, -1]]) {
    const b = nearPlace('aagun', 1, fx + dx, fy + dy); if (b) aa.push(b);
  }
  for (const b of [power, ref, silo, ...aa]) if (b) P.aiS.known.set(b.id, b);
  P.aiS.next = 0; P.aiS.raidT = 0; P.aiS.raid = null;
  let ev = null;
  for (let n = 0; n < 30 * 25 && !ev; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiAir80' && e.team === 0) ev = e;
    G.events.length = 0;
  }
  ok(!!ev, 'f80 launches an idle-air flank strike (' + (ev ? ('n=' + ev.n + ' bombs=' + ev.bombs + ' tg=' + ev.tg) : 'none') + ')');
  if (ev) {
    ok(ev.bombs >= 10, 'whole strike wing goes together (bombs ' + ev.bombs + ' of 12 circling jets)');
    ok(ev.n >= 18, 'fighters go with the package (group ' + ev.n + ' of 20)');
    ok(['power', 'refinery', 'silo', 'cc', 'hq'].includes(ev.tg), 'target is critical infrastructure (' + ev.tg + ')');
    const ecx = h1.x, ecy = h1.y;
    const dot = (ev.wx - ecx) * (ecx - h0.x) + (ev.wy - ecy) * (ecy - h0.y);
    ok(dot > 0, 'waypoint is on the far/back side of the enemy base (dot ' + dot.toFixed(1) + ' wp=' + ev.wx.toFixed(1) + ',' + ev.wy.toFixed(1) + ')');
  }
}

// control: f80 off must ignore jets that are circling because every pad is full (the live bug)
{
  const P = boot(0, 'rus');
  const h0 = hqOf(0), h1 = hqOf(1);
  const af = G.ents.find(e => e.team === 0 && e.t === 'airfield' && e.hp > 0) || nearPlace('airfield', 0, h0.x, h0.y);
  const pads = af ? airSlots(af) : 4;
  if (af) for (let k = 0; k < pads; k++) {
    const u = addU('intercept', 0, af.x, af.y); u.js = 'landed'; u.dockB = af.id; u.dockK = k; u.ammo = W.aam.ammo; u.order = 'idle';
  }
  for (let i = 0; i < 12; i++) {
    const u = addU('jet', 0, h0.x + (i % 4) - 1.5, h0.y + ((i / 4) | 0) - 1);
    u.js = 'fly'; u.ammo = W.jbomb.ammo; u.order = 'idle'; u.path = []; u.dockB = null;
  }
  const power = nearPlace('power', 1, h1.x, h1.y);
  const ref = nearPlace('refinery', 1, h1.x, h1.y);
  if (power) P.aiS.known.set(power.id, power);
  if (ref) P.aiS.known.set(ref.id, ref);
  P.aiS.next = 0; P.aiS.raidT = 0; P.aiS.raid = null;
  let launched = false;
  for (let n = 0; n < 30 * 12; n++) {
    stepGame();
    if (P.aiS.raid && P.aiS.raid.u && P.aiS.raid.u.some(u => u.t === 'jet')) launched = true;
    G.events.length = 0;
  }
  ok(!launched, 'f80 off: circling (unlanded) jets stay home and do not start a raid');
}

// ---------- 2) stuck vs Grand Cannons: build a Titan and fire it at a cannon (accept SM-3) ----------
{
  const P = boot(1, 'fra');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 30000; P.gas = 4000; P.pow = 300;
  if (!G.ents.some(e => e.team === 0 && e.t === 'tech')) nearPlace('tech', 0, h0.x, h0.y);
  for (let i = 0; i < 6; i++) nearPlace('power', 0, h0.x, h0.y);
  const silo = nearPlace('silo', 0, h0.x, h0.y); if (silo) silo.born = -10;
  const gcs = [];
  for (let i = 0; i < 4; i++) {
    const b = nearPlace('gcannon', 1, h1.x + (i % 2) * 3, h1.y + ((i / 2) | 0) * 3);
    if (b) gcs.push(b);
  }
  if (h1) { h1.sm3 = 1; } // accept intercepts: HQ has SM-3 covering the yard
  ok(silo && gcs.length >= 3, 'GC drill setup (silo=' + !!silo + ' gcs=' + gcs.length + ')');
  G.ents.forEach(e => { if (e.team === 0 && e.kind === 'u') e.hp = 0; }); // keep our army out of the blast so the bot will still aim at the cannons
  G.time = 480; P.aiS.next = 0; P.aiS.lastAttack = 200; P.aiS.siege = true; P.aiS.towerHeavy = true;
  for (const b of gcs) P.aiS.known.set(b.id, b);
  if (h1) P.aiS.known.set(h1.id, h1);
  let built = null, fired = null;
  let lastPow = 0;
  for (let n = 0; n < 30 * 150; n++) {
    if (n % 30 === 0) { P.cr = Math.max(P.cr, 12000); P.gas = Math.max(P.gas, 2000); for (const b of gcs) if (b.hp > 0) P.aiS.known.set(b.id, b); }
    stepGame(); lastPow = P.pow;
    if (silo && (silo.mis === 'heavy' || (silo.mq && silo.mq.k === 'heavy'))) built = 'heavy';
    for (const e of G.events) if (e.e === 'aiWar' && e.team === 0) fired = e;
    G.events.length = 0;
    if (fired) break;
  }
  ok(built === 'heavy', 'stuck-vs-GC bot builds a Titan Warhead (' + built + ')');
  ok(!!fired, 'stuck-vs-GC bot launches a warhead (' + (fired ? fired.k : 'none') + '; silo mis=' + (silo && silo.mis) + ' mq=' + (silo && silo.mq && silo.mq.k) + ' p=' + (silo && silo.mq && silo.mq.p && silo.mq.p.toFixed(1)) + ' pow=' + lastPow + ')');
  if (fired) {
    ok(fired.k === 'heavy', 'the launch is the biggest nuke (' + fired.k + ')');
    let aimed = fired.gc80 === 1;
    if (!aimed && G.missiles && G.missiles.length) {
      const ms = G.missiles[G.missiles.length - 1];
      aimed = gcs.some(g => dhypot(ms.x1 - g.x, ms.y1 - g.y) < 8);
    }
    ok(aimed, 'Titan is aimed at a Grand Cannon (gc80=' + (fired.gc80 || 0) + ')');
  }
}

// control: f80 off should not set gc80
{
  const P = boot(0, 'fra');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 30000; P.gas = 4000;
  const silo = nearPlace('silo', 0, h0.x, h0.y); if (silo) silo.born = -10;
  const gcs = [];
  for (let i = 0; i < 4; i++) { const b = nearPlace('gcannon', 1, h1.x + (i % 2) * 3, h1.y + ((i / 2) | 0) * 3); if (b) gcs.push(b); }
  G.time = 480; P.aiS.next = 0; P.aiS.lastAttack = 200; P.aiS.siege = true;
  for (const b of gcs) P.aiS.known.set(b.id, b);
  let gcShot = false;
  for (let n = 0; n < 30 * 90; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiWar' && e.gc80) gcShot = true;
    G.events.length = 0;
  }
  ok(!gcShot, 'f80 off: warhead events are not tagged as GC-punish shots');
}

console.log(fail ? 'F80 FAIL' : 'F80 OK');
process.exit(fail ? 1 : 0);
