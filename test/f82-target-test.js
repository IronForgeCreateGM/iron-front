// v7.9.25 f82 drill: Hard attack groups pick targets by utility (value + harvesters fed) / (distance + tower cover vs pack strength), and commit to them (cm82)
// node test/f82-target-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n'));
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok', m); };
const c = { x: 50, y: 50 }; let id = 1; const B = (t, x, y, o) => Object.assign({ id: id++, t, x, y, team: 1, hp: 500, kind: 'b' }, o || {});
const H = (x, y) => ({ id: id++, t: 'harv', x, y, team: 1, hp: 600, kind: 'u' });
// 1) economy first: a refinery with 3 harvesters 14 tiles away beats a barracks 6 tiles away
{ const bar = B('barracks', 56, 50), ref = B('refinery', 64, 50); const tg = [bar, ref]; util82({}, {}, c, tg, [H(63, 52), H(65, 48), H(62, 49)], 30000);
  ok(tg[0] === ref, 'refinery feeding 3 harvesters is picked over a nearer barracks'); }
// 2) a warhead launcher outranks a nearby power plant
{ const pw = B('power', 54, 50), silo = B('silo', 62, 50); const tg = [pw, silo]; util82({}, {}, c, tg, [], 30000); ok(tg[0] === silo, 'Warhead Launcher first'); }
// 3) tower cover vs pack strength: a small pack skips a refinery behind 4 Tesla coils, a big pack goes for it
{ const mk = () => { const ref = B('refinery', 62, 50), fac = B('factory', 58, 62); const ts = [0, 1, 2, 3].map(i => B('tesla', 60 + i, 47)); return { ref, fac, tg: [ref, fac, ...ts] }; };
  const a = mk(); util82({}, {}, c, a.tg, [], 3000); ok(a.tg[0] === a.fac, 'small pack (3k) avoids the Tesla-covered refinery');
  const b = mk(); util82({}, {}, c, b.tg, [], 80000); ok(b.tg[0] === b.ref, 'big pack (80k) walks through the cover to the refinery'); }
// 4) offline (unpowered) defences give no cover
{ const ref = B('refinery', 62, 50), fac = B('factory', 58, 62); const ts = [0, 1, 2, 3].map(i => B('tesla', 60 + i, 47, { offline: true })); const tg = [ref, fac, ...ts];
  util82({}, {}, c, tg, [], 3000); ok(tg[0] === ref, 'offline Teslas do not scare a small pack'); }
// 5) deterministic: equal scores break ties by id, input order does not matter
{ const x = B('barracks', 55, 50), y = B('barracks', 45, 50); const t1 = [y, x], t2 = [x, y]; util82({}, {}, c, t1, [], 9000); util82({}, {}, c, t2, [], 9000);
  ok(t1[0] === t2[0] && t1[0].id === Math.min(x.id, y.id), 'tie -> lower id, same result for any input order'); }
// 6) gate: on for a new si2 game, off for old replays (no f82 key) and per bot (P.f82Off)
{ newGame({ seed: 3, map: 'classic', slots: [{ ai: true, diff: 'si2', fac: 'usa', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: 'rus', start: 1, ally: 1 }], r76: 1, nt: 1, m7: 2, f79: 1, f80: 1, f81: 1, f82: 1 });
  ok(f82On(G.players[0], 'tg82'), 'f82 on in a new Hard game'); G.players[1].f82Off = true; ok(!f82On(G.players[1], 'tg82'), 'P.f82Off turns it off');
  newGame({ seed: 3, map: 'classic', slots: [{ ai: true, diff: 'si2', fac: 'usa', start: 0, ally: 0 }, { ai: true, diff: 'si2', fac: 'rus', start: 1, ally: 1 }], r76: 1, nt: 1, m7: 2, f79: 1, f80: 1, f81: 1 });
  ok(!f82On(G.players[0], 'tg82'), 'old replay (no f82) keeps the old target list'); }
// 7) cm82 commit band (tgt7): after the 20 s hold, keep the current target while its utility is >= 2/3 of the best, never past 60 s; no band without f82 scores
{ G.time = 100; const a = B('refinery', 60, 50), b = B('factory', 58, 50); const S = {};
  let sc = new Map([[a, 900], [b, 1000]]); S.sc82 = sc; ok(tgt7({}, S, c, [b, a]) === b, 'picks the best target first');
  G.time = 121; sc.set(b, 800); sc.set(a, 1000); ok(tgt7({}, S, c, [a, b]) === b, 'hold ran out, old target still >= 2/3 of the best -> stays');
  G.time = 140; sc.set(a, 2000); ok(tgt7({}, S, c, [a, b]) === a, 'clearly better target (< 2/3) -> switches');
  G.time = 161; sc.set(b, 1900); ok(tgt7({}, S, c, [b, a]) === a, 'switched target held again');
  G.time = 230; ok(tgt7({}, S, c, [b, a]) === b, 'past 60 s the band lets go');
  const S2 = { tg7: { id: a.id, until: 0 } }; G.time = 300; ok(tgt7({}, S2, c, [b, a]) === b, 'no f82 scores -> old 20 s behaviour'); }
console.log(bad ? 'F82 FAIL ' + bad : 'F82 OK'); process.exit(bad ? 1 : 0);
