// v7.9.2 f81 drills: late-game air gathers as one wing; home CAP if threatened;
// stuck-vs-GC banks gas for a Titan (never a short-range Viper) and the army pushes once cannons weaken
// node test/f81-air-test.js
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

function boot(f80, f81, facB) {
  newGame({ seed: 5, map: 'classic', fog: false, peace: 0, r76: 1, nt: 1, m7: 2, f79: 1, f80, f81,
    slots: [{ ai: true, diff: 'si2', fac: 'usa', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: facB || 'rus', start: 3, ally: 1 }] });
  for (let i = 0; i < 8; i++) stepGame();
  return G.players[0];
}

function hqOf(team) { return G.ents.find(e => e.team === team && (e.t === 'hq' || e.t === 'cc') && e.hp > 0); }
function wipeAir(team) { for (const e of G.ents) if (e.team === team && e.kind === 'u' && UT[e.t] && UT[e.t].air) { e.hp = 0; e.dead = true; } }
function wipeArmy(team) { for (const e of G.ents) if (e.team === team && e.kind === 'u') { e.hp = 0; e.dead = true; } }

// ---------- 1) late-game: hold a small ready group until more of the wing is armed, then send them together ----------
{
  const P = boot(1, 1, 'rus');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 20000; P.gas = 3000; P.pow = 200;
  wipeAir(0); wipeAir(1);
  G.time = 720; // late game
  const early = [], late = [];
  for (let i = 0; i < 5; i++) {
    const u = addU('jet', 0, h0.x + (i % 5) - 2, h0.y - 1);
    u.js = 'fly'; u.ammo = W.jbomb.ammo; u.order = 'idle'; u.path = []; early.push(u);
  }
  for (let i = 0; i < 7; i++) {
    const u = addU('jet', 0, h0.x + (i % 5) - 2, h0.y + 1.5);
    u.js = 'fly'; u.ammo = 0; u.order = 'idle'; u.path = []; late.push(u);
  }
  const power = nearPlace('power', 1, h1.x, h1.y);
  const ref = nearPlace('refinery', 1, h1.x, h1.y);
  for (const b of [power, ref]) if (b) P.aiS.known.set(b.id, b);
  P.aiS.next = 0; P.aiS.raidT = 0; P.aiS.raid = null; P.aiS.airWait81 = 0;
  for (const c of ['air', 'veh', 'inf']) { P.queues[c].length = 0; P.ready[c] = null; }
  let evEarly = null, evFull = null;
  for (let n = 0; n < 30 * 8 && !evEarly; n++) { // first 8 s: only 5 are armed, should HOLD (want = 8). f80 would have already left.
    P.queues.air.length = 0; P.ready.air = null;
    for (const u of late) { u.ammo = 0; u.js = 'fly'; } // do not let them land and rearm during the hold
    stepGame();
    for (const e of G.events) if (e.e === 'aiAir80' && e.team === 0) evEarly = e;
    G.events.length = 0;
  }
  ok(!evEarly, 'f81 holds a 5-jet late-game group instead of dribbling them (early=' + (evEarly ? ('n=' + evEarly.n + ' bombs=' + evEarly.bombs) : 'none') + ')');
  if (P.aiS.raid) P.aiS.raid = null;
  P.aiS.raidT = 0; P.aiS.airWait81 = 0; P.aiS.next = 0;
  for (const u of late) { u.ammo = W.jbomb.ammo; u.hp = u.mhp; u.js = 'fly'; u.order = 'idle'; u.path = []; } // the rest of the wing rearms
  for (let n = 0; n < 30 * 20 && !evFull; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiAir80' && e.team === 0) evFull = e;
    G.events.length = 0;
  }
  ok(!!evFull, 'f81 launches once the wing is armed (' + (evFull ? ('n=' + evFull.n + ' bombs=' + evFull.bombs + ' tg=' + evFull.tg) : 'none') + ')');
  if (evFull) {
    ok(evFull.bombs >= 10, 'the gathered strike goes together (bombs ' + evFull.bombs + ' of 12)');
    ok(['power', 'refinery', 'silo', 'cc', 'hq', 'extractor', 'factory'].includes(evFull.tg), 'target is critical infrastructure (' + evFull.tg + ')');
    const ecx = h1.x, ecy = h1.y;
    const dot = (evFull.wx - ecx) * (ecx - h0.x) + (evFull.wy - ecy) * (ecy - h0.y);
    ok(dot > 0, 'waypoint is on the far/back side of the enemy base (dot ' + dot.toFixed(1) + ')');
    ok(evFull.f81 === 1, 'launch is tagged f81');
  }
}

// ---------- 2) keep enough fighters at home when the base is under air threat ----------
{
  const P = boot(1, 1, 'rus');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 20000; P.gas = 3000; P.pow = 200;
  wipeAir(0); wipeAir(1);
  G.time = 720;
  const jets = [];
  for (let i = 0; i < 10; i++) {
    const u = addU('jet', 0, h0.x + (i % 5) - 2, h0.y - 1);
    u.js = 'fly'; u.ammo = W.jbomb.ammo; u.order = 'idle'; u.path = []; jets.push(u);
  }
  const ints = [];
  for (let i = 0; i < 8; i++) {
    const u = addU('intercept', 0, h0.x + (i % 4) - 1.5, h0.y + 1);
    u.js = 'fly'; u.ammo = W.aam.ammo; u.order = 'idle'; u.path = []; ints.push(u);
  }
  // enemy air already on our yard
  const raiders = [];
  for (let i = 0; i < 5; i++) {
    const u = addU('jet', 1, h0.x + 3 + (i % 3), h0.y + (i / 3 | 0));
    u.js = 'fly'; u.ammo = W.jbomb.ammo; raiders.push(u);
  }
  const power = nearPlace('power', 1, h1.x, h1.y);
  if (power) P.aiS.known.set(power.id, power);
  const ref = nearPlace('refinery', 1, h1.x, h1.y);
  if (ref) P.aiS.known.set(ref.id, ref);
  P.aiS.next = 0; P.aiS.raidT = 0; P.aiS.raid = null;
  let ev = null;
  for (let n = 0; n < 30 * 25 && !ev; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiAir80' && e.team === 0) ev = e;
    G.events.length = 0;
  }
  ok(!!ev, 'f81 still launches a flank when home is under air threat (' + (ev ? ('n=' + ev.n + ' keep=' + ev.keep) : 'none') + ')');
  if (ev) {
    ok(ev.keep >= 2, 'keeps fighters at home against the incoming air (keep=' + ev.keep + ')');
    const homeInt = ints.filter(u => u.hp > 0 && dhypot(u.x - h0.x, u.y - h0.y) < 18 && !(ev && P.aiS.raid && P.aiS.raid.u && P.aiS.raid.u.includes(u)));
    // after the launch order, the kept interceptors should not all be in the raid package
    const inRaid = P.aiS.raid && P.aiS.raid.u ? P.aiS.raid.u.filter(u => u.t === 'intercept').length : 0;
    ok(inRaid <= 8 - 2, 'raid package does not take every interceptor (inRaid=' + inRaid + ' of 8)');
  }
}

// ---------- 3) control: f81 off (f80 only) dribbles a 5-jet late-game group right away ----------
{
  const P = boot(1, 0, 'rus');
  const h0 = hqOf(0), h1 = hqOf(1);
  wipeAir(0); wipeAir(1);
  G.time = 720;
  for (let i = 0; i < 5; i++) {
    const u = addU('jet', 0, h0.x + (i % 5) - 2, h0.y - 1);
    u.js = 'fly'; u.ammo = W.jbomb.ammo; u.order = 'idle'; u.path = [];
  }
  for (let i = 0; i < 7; i++) {
    const u = addU('jet', 0, h0.x + (i % 5) - 2, h0.y + 1.5);
    u.js = 'fly'; u.ammo = 0; u.order = 'idle'; u.path = [];
  }
  const power = nearPlace('power', 1, h1.x, h1.y);
  if (power) P.aiS.known.set(power.id, power);
  P.aiS.next = 0; P.aiS.raidT = 0; P.aiS.raid = null;
  let ev = null;
  for (let n = 0; n < 30 * 15 && !ev; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiAir80' && e.team === 0) ev = e;
    G.events.length = 0;
  }
  ok(!!ev && ev.bombs <= 5, 'f81 off: f80 still dribbles the 5 armed jets (bombs=' + (ev && ev.bombs) + ')');
}

// ---------- 4) stuck vs Grand Cannons: bank gas, wait for a Titan, never fire a short-range Viper ----------
{
  const P = boot(1, 1, 'fra');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 30000; P.gas = 350; P.pow = 300; // not enough for a Titan yet
  if (!G.ents.some(e => e.team === 0 && e.t === 'tech')) nearPlace('tech', 0, h0.x, h0.y);
  for (let i = 0; i < 6; i++) nearPlace('power', 0, h0.x, h0.y);
  const silo = nearPlace('silo', 0, h0.x, h0.y); if (silo) silo.born = -10;
  const gcs = [];
  for (let i = 0; i < 4; i++) {
    const b = nearPlace('gcannon', 1, h1.x + (i % 2) * 3, h1.y + ((i / 2) | 0) * 3);
    if (b) gcs.push(b);
  }
  if (h1) h1.sm3 = 1; // accept SM-3 intercepts
  ok(silo && gcs.length >= 3, 'GC Titan-wait setup (silo=' + !!silo + ' gcs=' + gcs.length + ')');
  G.ents.forEach(e => { if (e.team === 0 && e.kind === 'u') e.hp = 0; });
  G.time = 480; P.aiS.next = 0; P.aiS.lastAttack = 200; P.aiS.siege = true; P.aiS.towerHeavy = true;
  for (const b of gcs) P.aiS.known.set(b.id, b);
  if (h1) P.aiS.known.set(h1.id, h1);
  let builtSmall = false, builtHeavy = false, fired = null;
  for (let n = 0; n < 30 * 320; n++) {
    if (n % 30 === 0) {
      P.cr = Math.max(P.cr, 12000);
      // trickle gas in as if extractors are running, but well below a spend-it-all jet purchase
      P.gas = Math.min(2200, P.gas + 12);
      P.pow = Math.max(P.pow, 80);
      for (const b of gcs) if (b.hp > 0) P.aiS.known.set(b.id, b);
      // keep our own army out of the blast so the bot will still aim at the cannons
      for (const e of G.ents) if (e.team === 0 && e.kind === 'u' && e.hp > 0) { e.hp = 0; e.dead = true; }
    }
    stepGame();
    if (silo && (silo.mis === 'small' || (silo.mq && silo.mq.k === 'small') || silo.mis === 'cluster' || (silo.mq && silo.mq.k === 'cluster'))) builtSmall = true;
    if (silo && (silo.mis === 'heavy' || (silo.mq && silo.mq.k === 'heavy'))) builtHeavy = true;
    for (const e of G.events) if (e.e === 'aiWar' && e.team === 0) fired = e;
    G.events.length = 0;
    if (fired) break;
  }
  ok(!builtSmall, 'stuck-vs-GC f81 never settles for a Viper/Hydra (small=' + builtSmall + ')');
  ok(builtHeavy, 'stuck-vs-GC f81 banks gas and builds a Titan');
  ok(!!fired, 'stuck-vs-GC f81 launches a warhead (' + (fired ? fired.k : 'none') + ')');
  if (fired) {
    ok(fired.k === 'heavy', 'the launch is the biggest nuke (' + fired.k + ')');
    ok(fired.gc80 === 1, 'Titan is aimed at a Grand Cannon (gc80=' + (fired.gc80 || 0) + ')');
  }
}

// ---------- 5) once Grand Cannons are weakened, the sitting army pushes in ----------
{
  const P = boot(1, 1, 'fra');
  const h0 = hqOf(0), h1 = hqOf(1);
  P.cr = 20000; P.gas = 2000; P.pow = 200;
  G.time = 600; P.aiS.next = 0; P.aiS.lastAttack = 200; P.aiS.siege = true; P.aiS.towerHeavy = true; P.aiS.grp = [];
  const gcs = [];
  for (let i = 0; i < 5; i++) {
    const b = nearPlace('gcannon', 1, h1.x + (i % 3) * 3, h1.y + ((i / 3) | 0) * 3);
    if (b) { gcs.push(b); P.aiS.known.set(b.id, b); }
  }
  if (h1) P.aiS.known.set(h1.id, h1);
  // a real sitting army at home (enough value to push once the bar drops)
  const army = [];
  for (let i = 0; i < 16; i++) {
    const u = addU('heavy', 0, h0.x + (i % 4) - 1.5, h0.y + ((i / 4) | 0) - 2);
    u.order = 'idle'; u.path = []; army.push(u);
  }
  ok(gcs.length >= 4, 'GC weaken-push setup (gcs=' + gcs.length + ' army=' + army.length + ')');
  // first, let the AI snapshot the full fortress (stuckGC80 / noteGC81)
  for (let n = 0; n < 30 * 8; n++) {
    P.aiS.next = 0;
    for (const b of gcs) if (b.hp > 0) P.aiS.known.set(b.id, b);
    stepGame();
    G.events.length = 0;
  }
  const pushedBefore = !!(P.aiS.grp && P.aiS.grp.length >= 8);
  // now the Titans (or the fight) have broken the line: 3 cannons dead, 2 hurt
  gcs[0].hp = 0; gcs[0].dead = true;
  gcs[1].hp = 0; gcs[1].dead = true;
  gcs[2].hp = 0; gcs[2].dead = true;
  if (gcs[3]) gcs[3].hp = gcs[3].mhp * 0.3;
  P.aiS.known.delete(gcs[0].id); P.aiS.known.delete(gcs[1].id); P.aiS.known.delete(gcs[2].id);
  if (gcs[3]) P.aiS.known.set(gcs[3].id, gcs[3]);
  if (gcs[4]) P.aiS.known.set(gcs[4].id, gcs[4]);
  // retreat any accidental early group so the weaken-push is what we measure
  if (P.aiS.grp) { P.aiS.grp.forEach(u => P.aiS.attackers.delete(u.id)); P.aiS.grp = []; }
  P.aiS.lastAttack = G.time - 40;
  P.aiS.next = 0;
  let ev = null;
  for (let n = 0; n < 30 * 40 && !ev; n++) {
    stepGame();
    for (const e of G.events) if (e.e === 'aiGcPush81' && e.team === 0) ev = e;
    G.events.length = 0;
  }
  ok(!!ev, 'army pushes in once Grand Cannons are weakened (ev=' + (ev ? ('n=' + ev.n) : 'none') + ' grp=' + ((P.aiS.grp && P.aiS.grp.length) || 0) + ' weakT=' + (P.aiS.gcWeakT81 || 0) + ')');
}

console.log(fail ? 'F81 FAIL' : 'F81 OK');
process.exit(fail ? 1 : 0);
