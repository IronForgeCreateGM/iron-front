// v7.5.0: infantry / mech / boss Blender models. Spawns every infantry type + titan, raijin, raijinJ, colossus near the HQ,
// walks half of them (walk-cycle rig check), screenshots close (d=7) and at default zoom (d=26), reports glb states + page errors.
// node test/v75-shot.js <tag> [extra query]   (needs http server on 127.0.0.1:8766 serving the repo)
const { chromium } = require('playwright-core');
const TAG = process.argv[2] || 'v75', Q = process.argv[3] || '', OUT = '/workspace/rts-game/shots/';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [], logs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/glb|rror/i.test(m.text())) logs.push(m.text()); });
  await pg.goto('http://127.0.0.1:8766/index.html?q=high' + (Q ? '&' + Q : '')); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { startGame('normal', { seed: 3, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'bra'], ['easy', 'B', 'rus']]) }); G.opts.fog = false; paused = true; });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const P = G.players.find(P => !P.ai), h = G.ents.find(e => e.t === 'hq' && e.team === P.team), E = G.ents.find(e => e.t === 'hq' && e.team !== P.team);
    const inf = ['rifle', 'rocketeer', 'engineer', 'sniper', 'kommando', 'marine'], walk = [];
    inf.forEach((t, k) => { const u = spawnUnit(P.team, t, h); u.x = h.x - 1.6 + k * 0.62; u.y = h.y + 3.2; u.ang = u.tang = 0.3; const w = spawnUnit(P.team, t, h); w.x = h.x - 1.6 + k * 0.62; w.y = h.y + 4.3; walk.push(w); });
    [['titan', -8.2], ['raijin', -6.2], ['colossus', -3.2]].forEach(([t, dx]) => { const u = spawnUnit(P.team, t, h); u.x = h.x + dx; u.y = h.y + 5.2; u.ang = u.tang = 0.4; });
    const j = spawnUnit(P.team, 'raijinJ', h); j.x = h.x - 5.2; j.y = h.y + 7.2; j.ang = 0.4;
    window.__E = E; window.__h = h; window.__walk = walk; });
  await pg.evaluate(() => { paused = false; }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { orderMove(__walk, __h.x + 6, __h.y + 4.3); }); await pg.waitForTimeout(900); await pg.evaluate(() => { paused = true;
    [['rifle', 0], ['marine', 0.6], ['kommando', 1.2], ['titan', 2.6]].forEach(([t, dx]) => { const u = spawnUnit(__E.team, t, __h); u.x = __h.x - 1.4 + dx; u.y = __h.y + 8.6; u.ang = u.tang = 2.6; }); });
  await pg.evaluate(() => { R3.cam.td = R3.cam.d = 6; jumpTo(__h.x + 0.4, __h.y + 0.2, true); }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + `${TAG}_close.png` });
  await pg.evaluate(() => { R3.cam.td = R3.cam.d = 10; jumpTo(__h.x - 5.6, __h.y + 1.2, true); }); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + `${TAG}_mechs.png` });
  await pg.evaluate(() => { R3.cam.td = R3.cam.d = 26; jumpTo(__h.x + 0.6, __h.y + 4.6, true); }); await pg.waitForTimeout(2000);
  await pg.screenshot({ path: OUT + `${TAG}_d26.png` });
  console.log('GLB', await pg.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(GLB.st).filter(([k]) => k.startsWith('u_'))))));
  console.log('errors', errs.length, errs.slice(0, 3).join(' | '), logs.slice(0, 5).join(' | ')); await br.close();
})();
