// v7.1 Chief SI regression: node test/ai71-test.js   (headless 4v4 all-Chief-SI on volcano8, ~16 game minutes)
// checks: fortress factions build their signature defences, every faction fields its special in numbers + a mixed army,
// allied armies launch coordinated multi-member pushes, no exceptions, AI tick cost budget, no bot bonuses, difficulty ladder intact.
const fs = require('fs'), vm = require('vm'), path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
globalThis.SIOFF = {}; const J = f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8');
vm.runInThisContext(['data.js', 'sim.js', 'ai.js'].map(J).join('\n') + '\nglobalThis.A={newGame,stepGame,get G(){return G}};globalThis.NEWAI=aiStep;');
// ---- difficulty ladder + skill-only
ok(DIFF.si.v71 && !DIFF.hard.v71 && !DIFF.normal.v71 && !DIFF.easy.v71, 'v7.1 brain is Chief SI only (Easy/Normal/Hard unchanged)');
const bonusKeys = ['inc', 'income', 'mine', 'hpMul', 'dmgMul', 'costMul', 'buildMul', 'cheat', 'bonus'];
ok(!Object.keys(DIFF.si).some(k => bonusKeys.includes(k)) && !Object.keys(DIFF.si.sys || {}).some(k => bonusKeys.includes(k)), 'Chief SI has no resource/stat bonus keys (skill only)');
// ---- 4v4
const facs = ['fra', 'chn', 'usa', 'rus', 'ger', 'bra', 'irn', 'jpn'], SPEC = { usa: ['stealth'], rus: ['tsar'], ger: ['kommando'], bra: ['marine'], irn: ['drone'], jpn: ['raijin', 'raijinJ'], fra: ['gatling', 'gcannon'], chn: ['gtower', 'ballista'] };
const ms = { n: 0, c: 0, max: 0 }; globalThis.aiStep = P => { const t = process.hrtime.bigint(); NEWAI(P); const d = Number(process.hrtime.bigint() - t) / 1e6; ms.n += d; ms.c++; if (d > ms.max) ms.max = d; };
A.newGame({ seed: 11, map: 'volcano8', slots: facs.map((fac, i) => ({ ai: true, diff: 'si', fac, ally: i < 4 ? 0 : 1 })) });
const G = A.G, mx = {}, types = {}; let errs = 0, err1 = '', plans = 0, maxMem = 0; const seenPlan = new Set();
const t0 = Date.now();
for (let n = 0; n < 16 * 60 * 30 && !G.over && Date.now() - t0 < 200000; n++) {
  try { A.stepGame(); } catch (e) { errs++; err1 = err1 || e.stack; } G.events.length = 0;
  if (n % 150) continue;
  const c = G.players.map(() => ({})); for (const e of G.ents) if (e.hp > 0 && e.team >= 0 && e.team < 8) { c[e.team][e.t] = (c[e.team][e.t] || 0) + 1; if (e.kind === 'u' && UT[e.t].wpn) (types[e.team] = types[e.team] || new Set()).add(e.t); }
  G.players.forEach((P, i) => { const m = mx[i] = mx[i] || {}; for (const k in c[i]) m[k] = Math.max(m[k] || 0, c[i][k]); m.spec = Math.max(m.spec || 0, SPEC[P.fac].reduce((s, k) => s + (c[i][k] || 0), 0)); });
  for (const a in G.tp71 || {}) { const p = G.tp71[a], k = a + ':' + p.t0; if (p.go && !seenPlan.has(k)) { seenPlan.add(k); const nm = Object.keys(p.m).length; if (nm >= 2) plans++; maxMem = Math.max(maxMem, nm); } }
}
ok(errs === 0, 'no sim/AI exceptions (' + errs + ') ' + err1.split('\n').slice(0, 4).join(' | '));
console.log(`  ran ${(G.time / 60).toFixed(1)} game min in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const fr = mx[0], cn = mx[1];
ok((fr.gatling || 0) + (fr.gcannon || 0) >= 8 && (fr.gcannon || 0) >= 2, `France fortress: ${fr.gatling || 0} Tourelle Gatling + ${fr.gcannon || 0} Grand Cannons (>= 8, >= 2 cannons)`);
ok((cn.wall || 0) + (cn.gtower || 0) >= 30 && (cn.gtower || 0) >= 6, `China Great Wall: ${cn.wall || 0} wall + ${cn.gtower || 0} guard towers`);
ok((cn.ballista || 0) >= 1, `China Ballista conversions: ${cn.ballista || 0}`);
G.players.forEach((P, i) => { const need = P.fac === 'fra' || P.fac === 'chn' ? 6 : P.fac === 'irn' ? 6 : P.fac === 'bra' ? 8 : 3;
  ok(mx[i].spec >= need && (types[i] ? types[i].size : 0) >= 5, `${P.fac}: special peak ${mx[i].spec} (>= ${need}), ${types[i] ? types[i].size : 0} combat unit types (>= 5)`); });
ok(plans >= 2 && maxMem >= 3, `coordinated team pushes: ${plans} multi-player plans launched, largest ${maxMem} players`);
const avg = ms.n / Math.max(1, ms.c);
ok(avg < 1.5, `AI think avg ${avg.toFixed(2)} ms/call (< 1.5)`); ok(ms.max < 60, `AI worst single call ${ms.max.toFixed(1)} ms (< 60)`);
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS'); process.exit(fail ? 1 : 0);
