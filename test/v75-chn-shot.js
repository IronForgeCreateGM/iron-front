// v7.5.0: China Great Wall posts (wallChn.glb) + guard tower + Ballista Tower (gtowerB.glb), two teams, close shot + glb states.
// node test/v75-chn-shot.js <tag>   (needs http server on 127.0.0.1:8766 serving the repo)
const { chromium } = require('playwright-core');
const TAG = process.argv[2] || 'v75chn', OUT = '/workspace/rts-game/shots/';
(async () => {
  const br = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 1400, height: 900 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || /rror/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
  await pg.goto('http://127.0.0.1:8766/index.html?q=high'); await pg.waitForTimeout(2000);
  await pg.evaluate(() => { startGame('normal', { seed: 3, map: 'classic', fog: false, slots: buildSlots([['human', 'A', 'chn'], ['easy', 'B', 'chn']]) }); G.opts.fog = false; paused = true; });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { const P = G.players.find(P => !P.ai), E = G.players.find(Q => Q !== P), h = G.ents.find(e => e.t === 'hq' && e.team === P.team);
    for (const [team, oy] of [[P.team, 4], [E.team, 6]]) for (let k = 0; k < 10; k++) { const x = h.tx - 5 + k, y = h.ty + oy; if (canPlace('wall', team, x, y)) addB('wall', team, x, y, true, false); }
    const gts = G.ents.filter(e => e.t === 'gtower'); gts.forEach(g => { g.bal = 1; }); if (gts[0]) gts[0].bal = 0;
    window.__h = h; window.__gt = G.ents.filter(e => e.t === 'gtower').length; });
  await pg.evaluate(() => { paused = false; }); await pg.waitForTimeout(3000); await pg.evaluate(() => { paused = true; });
  await pg.evaluate(([D, OY, OX]) => { R3.cam.td = R3.cam.d = D; jumpTo(__h.x + +(OX), __h.y + OY, true); }, [+(process.env.D || 9), +(process.env.OY || -0.8)].concat([+(process.env.OX || 1)])); await pg.waitForTimeout(2500);
  console.log('cam', await pg.evaluate(() => JSON.stringify({ h: [__h.x, __h.y], cam: [R3.cam.x, R3.cam.y, R3.cam.d], ws: G.ents.filter(e => e.t === 'wall' || e.t === 'gtower').map(e => e.tx + ',' + e.ty).join(' ') })));
  await pg.screenshot({ path: OUT + `${TAG}_close.png` });
  const st = await pg.evaluate(() => JSON.stringify({ gt: __gt, wallChn: GLB.st.wallChn, gtower: GLB.st.gtower, gtowerB: GLB.st.gtowerB,
    glbObjs: [...R3.objs.values()].filter(o => o.glb).map(o => o.mk).reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {}) }));
  console.log('GLB', st); console.log('errors', errs.length, errs.slice(0, 3).join(' | ')); await br.close();
})();
