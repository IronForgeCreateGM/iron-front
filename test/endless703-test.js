// v7.0.3 regression: Endless boss-wave freeze (iPhone, China, walled base). NODE_PATH=/tmp/tb/node_modules node test/endless703-test.js
// Root cause: the Colossus boss is mech:1 but has a tank model with no leg rig; on its death the renderer queued a "falling mech" corpse and
// poseRig() threw every frame; main.js rethrew, so requestAnimationFrame was never called again -> the whole game froze on the boss kill.
const fs = require('fs'), vm = require('vm'), path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
// ---------- 1. node: sealed China base, many towers, Endless through two boss waves (no exceptions, no long ticks, no stalled wave)
{
  const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const src = ['data.js', 'sim.js', 'ai.js', 'endless.js', 'net.js'].map(f => fs.readFileSync(path.join(__dirname, '../js', f), 'utf8')).join('\n');
  vm.runInThisContext(src + '\nglobalThis.__api={newGame,stepGame,addU,addB,canPlace,upgradeB,endElite,getBlock,idx,END,get G(){return G}};');
  const A = globalThis.__api; A.newGame({ mode: 'endless', seed: 5, fog: false, slots: [{ ai: false, ally: 0, fac: 'chn' }] }); const G = A.G, P = G.players[0]; P.cr = 1e6; P.gas = 1e5;
  for (const ps of G.passes) { const tx = Math.floor(ps.x) - 9, ty = Math.floor(ps.y) - 1; if ([0, 1].every(a => [0, 1].every(b => G.map[(ty + b) * MW + tx + a] === 0))) A.addB('power', 0, tx, ty, true);
    for (const x of [Math.floor(ps.x) - 1, Math.floor(ps.x) - 4]) for (let y = Math.floor(ps.y) - 6; y <= Math.floor(ps.y) + 6; y++) if (G.map[y * MW + x] === 0 && A.canPlace('wall', 0, x, y)) A.addB('wall', 0, x, y, true); }
  for (let i = 0; i < 12; i++) A.addU(i % 3 ? 'rifle' : 'heavy', 0, 24 + (i % 4), 46 + (i >> 2));
  const nWall = G.ents.filter(e => e.t === 'wall' || e.t === 'gtower').length, nTow = G.ents.filter(e => e.t === 'gtower').length;
  let errs = 0, maxMs = 0, bossSeen = 0, t0 = Date.now(), err1 = '';
  while ((G.end.wave < 21 || G.end.phase === 'wave') && !G.over && Date.now() - t0 < 60000) {
    if (G.end.phase === 'break') G.end.next = Math.min(G.end.next, G.time + 1);
    P.cr = Math.max(P.cr, 5e4); if (G.tick % 300 === 0) for (const e of G.ents) if (e.team === 0 && e.kind === 'b') e.hp = e.mhp; for (const e of G.ents) if (e.t === 'hq' && e.team === 0) e.hp = e.mhp;
    const a = process.hrtime.bigint(); try { A.stepGame(); } catch (e) { errs++; err1 = err1 || e.stack; } G.events.length = 0; maxMs = Math.max(maxMs, Number(process.hrtime.bigint() - a) / 1e6);
    if (G.ents.some(u => u.t === 'colossus')) bossSeen |= G.end.wave === 10 ? 1 : G.end.wave === 20 ? 2 : 0;
  }
  ok(nWall >= 30 && nTow >= 5, `sealed China base: ${nWall} wall pieces, ${nTow} guard towers`);
  ok(errs === 0, 'no sim exceptions through wave 21 ' + err1.split('\n')[0]);
  ok(G.end.wave >= 21 && !G.over, `reached wave ${G.end.wave} (both boss waves cleared, none stalled) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  ok(bossSeen === 3, 'Colossus fought on waves 10 and 20');
  ok(maxMs < 50, `worst sim tick ${maxMs.toFixed(1)} ms (< 50)`);
  // a boss that can never reach anything withers after END.bossAttrT (the HQ above was invulnerable, so wave 20 only ended that way)
  ok(A.END.bossAttrT > 0 && A.END.bossAttr > 0 && A.END.pathBudget > 0, 'boss withering + horde re-plan budget configured');
  // elite reward with the HQ walled in tight: never placed inside a wall
  const hq = G.ents.find(e => e.t === 'hq' && e.team === 0); for (let y = hq.ty - 7; y <= hq.ty + hq.h + 7; y++) for (let x = hq.tx - 7; x <= hq.tx + hq.w + 7; x++) if (G.map[y * MW + x] === 0 && !A.getBlock()[A.idx(x, y)]) A.addB('wall', 0, x, y, true);
  const el = A.endElite(P); ok(el && !A.getBlock()[A.idx(Math.floor(el.x), Math.floor(el.y))], `elite reward lands on a free tile even with the HQ fully walled in (${el && el.x},${el && el.y})`);
}
// ---------- 2. browser (iPhone, touch): the boss kill must not freeze the game loop
(async () => {
  const { chromium } = require('playwright-core'), URL0 = 'file://' + path.resolve(__dirname, '../index.html');
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const start = async (fac, vp) => { const pg = await br.newPage({ viewport: vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
    await pg.goto(URL0); await pg.waitForTimeout(2000); await pg.evaluate(() => { const t = document.getElementById('titleScreen'); if (t) t.click(); }); await pg.waitForTimeout(400);
    await pg.evaluate(() => document.getElementById('playEndlessBtn').click()); await pg.waitForTimeout(400);
    await pg.evaluate(f => { const c = [...document.querySelectorAll('.fcard')].find(c => c.textContent.includes(f)); if (c) c.click(); document.getElementById('startBtn').click(); }, fac); await pg.waitForTimeout(3500); return pg; };
  const wall = pg => pg.evaluate(() => { const P = G.players[ME]; P.cr = 60000; const hq = G.ents.find(e => e.team === ME && e.t === 'hq'), X0 = hq.tx - 8, X1 = hq.tx + 12, Y0 = hq.ty - 8, Y1 = hq.ty + 9; let n = 0;
    for (let y = Y0 + 2; y < Y1 - 2; y += 5) for (let x = X0 + 2; x < X1 - 2; x += 5) if (canPlace('power', ME, x, y)) addB('power', ME, x, y, true);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if ((y === Y0 || y === Y1 || x === X0 || x === X1 || (x - X0) % 5 === 4 || (y - Y0) % 5 === 4) && G.map[y * MW + x] === 0 && canPlace('wall', ME, x, y)) { addB('wall', ME, x, y, true); n++; }
    return n; });
  const toBoss = pg => pg.evaluate(() => { G.end.wave = 9; G.end.next = G.time; for (let i = 0; i < 30 * 7; i++) stepGame(); const c = G.ents.find(u => u.t === 'colossus'), hq = G.ents.find(e => e.team === ME && e.t === 'hq');
    if (c) { const f = nearFree(Math.floor(hq.x + 6), Math.floor(hq.y - 1), 8); c.x = f[0] + 0.5; c.y = f[1] + 0.5; c.path = []; } R3.cam.td = R3.cam.d = 22; jumpTo(hq.x + 4, hq.y, true); return !!c; });
  const clock = pg => pg.evaluate(() => ({ lf: R3.lastFrame || 0, tick: G.tick }));
  const running = async (pg, ms) => { const a = await clock(pg); await pg.waitForTimeout(ms); const b = await clock(pg); return b.lf > a.lf && b.tick > a.tick; };
  for (const [name, vp] of (process.env.FACS ? [] : [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]])) {
    const pg = await start('China', vp); const nw = await wall(pg); const boss = await toBoss(pg);
    ok(nw > 60 && boss, `${name}: China walled base (${nw} pieces) + Colossus inside it on boss wave 10`);
    await pg.evaluate(() => { const E = G.end; E.blost = 0; E.waveStart = G.time; for (const id of E.bids) { const b = byId(id); if (b) b.hp = b.mhp; } for (const u of G.ents) if (u.team === E.horde && u.kind === 'u') { u.lastHitBy = ME; u.hp = 0; } });
    const run1 = await running(pg, 3500);
    const st = await pg.evaluate(() => ({ ph: G.end.phase, rw: G.end.lastReward && G.end.lastReward.kind, boss: G.ents.some(u => u.t === 'colossus'), el: (u => u && { t: u.t, free: !getBlock()[idx(Math.floor(u.x), Math.floor(u.y))] })(G.ents.find(u => u.elite)) }));
    ok(run1 && !st.boss, `${name}: game loop keeps running after the boss dies (v7.0.2 froze here)`);
    ok(st.ph === 'break' && st.rw === 'elite' && st.el && st.el.free, `${name}: wave clears -> clean-clear elite reward on a free tile ${JSON.stringify(st)}`);
    await pg.evaluate(() => { const u = G.ents.find(u => u.elite); if (u) u.hp = 0; }); ok(await running(pg, 2500), `${name}: elite (Titan walker) death renders fine`);
    if (name === 'landscape') { // fault injection: one render error and one sim error must not stop the loop
      await pg.evaluate(() => { const r = window.r3Render; let k = 0; window.r3Render = r3Render = function () { if (!k++) throw new Error('injected render fault'); return r.apply(this, arguments); }; const s = stepGame; let j = 0; window.stepGame = stepGame = function () { if (!j++) throw new Error('injected sim fault'); return s.apply(this, arguments); }; });
      ok(await running(pg, 2500), 'injected render + sim faults: recovered, game keeps running');
      ok(await pg.evaluate(() => ERR.n >= 2), 'faults counted by the recovery handler');
    }
    ok(!pg.errs.length, `${name}: no page errors ${pg.errs.slice(0, 2).join(' | ')}`); await pg.close();
  }
  // other factions: boss kill + elite kill rendered through the real renderer (window.__rec renders once per call)
  for (const fac of (process.env.FACS ? process.env.FACS.split(',') : ['USA', 'Russia', 'France', 'Germany', 'Brazil', 'Iran', 'Japan'])) {
    const pg = await start(fac, { width: 844, height: 390 }); await toBoss(pg);
    const r = await pg.evaluate(() => { const E = G.end; E.blost = 0; E.waveStart = G.time; for (const id of E.bids) { const b = byId(id); if (b) b.hp = b.mhp; } for (const u of G.ents) if (u.team === E.horde && u.kind === 'u') u.hp = 0;
      let err = null; try { for (let i = 0; i < 6; i++) window.__rec(6); const u = G.ents.find(u => u.elite); if (u) u.hp = 0; for (let i = 0; i < 6; i++) window.__rec(6); } catch (e) { err = e.message; } return { err, ph: G.end.phase, rw: G.end.lastReward && G.end.lastReward.kind, fac: G.players[ME].fac, badT: G.ents.filter(e => e.kind === 'u' && !UT[e.t]).length }; });
    const live = await running(pg, 3000), ec = await pg.evaluate(() => ERR.n + ' ' + ERR.last); ok(!r.err && !r.badT && r.fac && r.ph === 'break' && live && !pg.errs.length, `${fac}: boss + elite deaths render, loop alive ${live} ${JSON.stringify(r)} recovered:${ec} ${pg.errs.slice(0, 1)}`); await pg.close();
  }
  await br.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
