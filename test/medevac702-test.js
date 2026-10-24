// v7.0.2 Seraph Medevac hangs back: follows behind the army at its pace, never leads, heals from the rear, backs off when hit. node test/medevac702-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = ['data.js', 'sim.js', 'ai.js', 'endless.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,orderMove,orderAttack,execCmd,blk,get G(){return G}};');
const A = globalThis.__api; let ok = true; const chk = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + x : '')); ok = ok && c; };
function fresh() { A.newGame({ seed: 3, fog: false, slots: [{ fac: 'usa', ally: 0, ai: false }, { fac: 'rus', ally: 1, ai: false }] }); A.G.ents = A.G.ents.filter(e => e.kind === 'b' && e.t === 'hq'); return A.G; }
const step = n => { for (let i = 0; i < n; i++) { A.stepGame(); A.G.events.length = 0; } };
// find a long clear row (ground units must be able to walk it)
function lane() { for (let y = 8; y < MH - 8; y++) for (let x0 = 16; x0 < MW - 46; x0++) { let c = true; for (let x = x0; x < x0 + 40 && c; x++) for (let dy = -2; dy <= 2; dy++) if (A.blk(x + 0.5, y + dy + 0.5)) { c = false; break; } if (c) return [x0, y]; } return [20, 48]; }
function army(G, x0, y) { const g = []; for (let i = 0; i < 4; i++) g.push(A.addU('heavy', 0, x0 + 2 + (i % 2), y - 1 + (i / 2 | 0) * 2)); for (let i = 0; i < 4; i++) g.push(A.addU('rifle', 0, x0 + 1, y - 1.5 + i)); return g; }
// 1) group move: Medevac starts AHEAD of the army, ends up trailing, never leads, arrives later
{ const G = fresh(); const [x0, y] = lane(); const g = army(G, x0, y), m = A.addU('medevac', 0, x0 + 5, y);
  const tx = x0 + 34; A.execCmd(0, { c: 'move', u: [...g, m].map(e => e.id), x: tx, y: y + 0.5 });
  let lead = 0, behind = 0, n = 0, tLead = null, tMed = null, maxGap = -99;
  for (let s = 0; s < 30 * 40; s++) { step(1); if (s % 15) continue; const lx = Math.max(...g.map(u => u.x)), cx = g.reduce((a, u) => a + u.x, 0) / g.length;
    if (s > 30 * 4) { n++; if (m.x > lx + 0.3) lead++; if (m.x < cx - 1.5) behind++; maxGap = Math.max(maxGap, m.x - lx); }
    if (tLead == null && lx > tx - 5) tLead = s / 30; if (tMed == null && m.x > tx - 5) tMed = s / 30; }
  const cx = g.reduce((a, u) => a + u.x, 0) / g.length;
  chk('Medevac never leads the push (after it falls back)', lead === 0, `ahead of lead in ${lead}/${n} samples, max gap ${maxGap.toFixed(1)}`);
  chk('it trails behind the army centre on the way', behind >= n * 0.8, `${behind}/${n} samples behind centre`);
  chk('lead units arrive first, the Medevac later (or holds back)', tLead != null && (tMed == null || tMed > tLead), `lead ${tLead}s, medevac ${tMed == null ? 'stays back' : tMed + 's'}`);
  chk('holds 3-5 tiles behind the army centre after arriving', cx - m.x >= 2.5 && cx - m.x <= 6, `${(cx - m.x).toFixed(1)} tiles behind`);
  chk('escort order (not straight move) while with the army', m.order === 'escort');
  // 2) heals damaged units from the rear
  const near = t => g.filter(u => u.t === t).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0], T0 = near('heavy'), R0 = near('rifle');
  T0.hp = T0.mhp * 0.4; R0.hp = R0.mhp * 0.4; const h0 = T0.hp, h5 = R0.hp; step(30 * 8);
  chk('heals damaged allies (moves in so they are in beam range)', T0.hp > h0 + 50 && R0.hp > h5 + 30, `tank ${h0 | 0}->${T0.hp | 0}, rifle ${h5 | 0}->${R0.hp | 0}`);
  // 3) direct order on its own still goes straight there
  A.execCmd(0, { c: 'move', u: [m.id], x: tx + 6, y: y + 0.5 }); step(30 * 11);
  chk('ordered alone: goes straight where it is told', m.order !== 'escort' && Math.abs(m.x - (tx + 6)) < 1.2, `x ${m.x.toFixed(1)} (want ${tx + 6})`); }
// 4) skirmish: attack-move into enemy troops with anti-air; compare with the old behaviour (escort off)
function skirmish(esc, seedOff) { MEDEVAC.escort = esc; const G = fresh(); const [x0, y] = lane(); const g = army(G, x0, y), m = A.addU('medevac', 0, x0 + 4, y);
  const ex = x0 + 22; for (let i = 0; i < 2; i++) A.addU('aa', 1, ex + 2, y - 1 + i * 2); for (let i = 0; i < 3; i++) A.addU('rocketeer', 1, ex, y - 1.5 + i * 1.5); A.addU('heavy', 1, ex + 1, y + 2.5); A.addU('heavy', 1, ex + 1, y - 2.5);
  A.execCmd(0, { c: 'move', am: 1, u: [...g, m].map(e => e.id), x: ex + 4, y: y + 0.5 }); let t = 0, healed = 0, hpAt = null;
  for (; t < 30 * 60 && m.hp > 0 && G.ents.includes(m); t++) { const before = g.reduce((a, u) => a + Math.max(0, u.hp), 0); A.stepGame(); for (const e of A.G.events) if (e.e === 'heal' && e.src === m) healed++; A.G.events.length = 0; }
  MEDEVAC.escort = true; return { alive: m.hp > 0 && A.G.ents.includes(m), t: +(t / 30).toFixed(1), hp: Math.max(0, m.hp | 0), beams: (m.beams || []).length, foes: A.G.ents.filter(e => e.team === 1 && e.kind === 'u' && e.hp > 0).length, mine: g.filter(u => u.hp > 0).length }; }
const cmdOK = typeof execCmd === 'function'; const old = skirmish(false), neu = skirmish(true);
chk('skirmish: Medevac survives longer than before', (neu.alive && !old.alive) || neu.t > old.t + 3 || (neu.alive && old.alive && neu.hp > old.hp), `old ${JSON.stringify(old)}  new ${JSON.stringify(neu)}`);
chk('skirmish: army still wins with it', neu.foes === 0 || neu.mine >= old.mine, `foes left ${neu.foes}, mine ${neu.mine}`);
console.log(ok ? 'MEDEVAC702 OK' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
